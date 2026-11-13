package service

import (
	"context"
	"math"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// NoticeService는 Python `app/api/v1/endpoints/notices.py` + `crud/notice.py`의
// 비즈니스 로직을 이식한다.
type NoticeService struct {
	repo  *repository.NoticeRepository
	cache *cache.Store // create/update/delete 후 cache_delete_pattern("notices:*") 무효화용(nil 허용).
}

func NewNotice(repo *repository.NoticeRepository, store *cache.Store) *NoticeService {
	return &NoticeService{repo: repo, cache: store}
}

// invalidateNoticeCache는 Python cache_delete_pattern("notices:*")를 이식한다(GET / @cached 무효화).
func (s *NoticeService) invalidateNoticeCache() {
	if s.cache != nil {
		s.cache.DeletePattern(context.Background(), "notices:*")
	}
}

// NoticeWriteInput은 NoticeCreate/Update 본문(핸들러가 파싱·검증해 전달). exclude_unset용 present 키 동봉.
type NoticeWriteInput struct {
	MtIdx     *int
	NtTitle   *string
	NtFile1   *string
	NtContent *string
	NtShow    *string
}

// CreateNotice는 Python create_notice를 이식한다. Notice(**model_dump())+commit+refresh → cache 무효화.
// nt_hit=0, nt_wdate/uwdate=now(컬럼 DEFAULT 없음 → Python func.now()/default=0와 동등하게 명시 설정).
func (s *NoticeService) CreateNotice(in NoticeWriteInput, title, content string) (dto.NoticeResponse, bool) {
	now := time.Now()
	show := "Y"
	if in.NtShow != nil {
		show = *in.NtShow
	}
	n := &model.Notice{
		MtIdx: in.MtIdx, NtTitle: &title, NtFile1: in.NtFile1, NtContent: &content,
		NtShow: show, NtHit: 0, NtWdate: now, NtUwdate: now,
	}
	if err := s.repo.Create(n); err != nil {
		return dto.NoticeResponse{}, false
	}
	saved, err := s.repo.GetByID(n.NtIdx)
	if err != nil || saved == nil {
		return dto.NoticeResponse{}, false
	}
	s.invalidateNoticeCache()
	return toNoticeResponse(saved), true
}

// UpdateNotice는 Python update_notice를 이식한다(exclude_unset setattr + onupdate nt_uwdate=now). found=false→404.
func (s *NoticeService) UpdateNotice(id int, present map[string]interface{}) (resp *dto.NoticeResponse, found, ok bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true
	}
	// SQLAlchemy onupdate=func.now() 재현: 변경 시 nt_uwdate=now. present가 비어도 Python은 변경 없으면
	// UPDATE 미발생이나, exclude_unset로 최소 1개 필드가 오는 일반 경로를 따른다.
	present["nt_uwdate"] = time.Now()
	if _, err := s.repo.UpdateFields(id, present); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	s.invalidateNoticeCache()
	r := toNoticeResponse(saved)
	return &r, true, true
}

// DeleteNotice는 Python delete_notice를 이식한다(하드 삭제). found=false→404.
func (s *NoticeService) DeleteNotice(id int) (found, ok bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if cur == nil {
		return false, true
	}
	if err := s.repo.Delete(id); err != nil {
		return true, false
	}
	s.invalidateNoticeCache()
	return true, true
}

// SetNoticeShow는 hide('N')/show('Y')를 이식한다(nt_show 변경 + onupdate nt_uwdate). found=false→404.
// ⚠️ Python: 값 변경 없으면 SQLAlchemy가 UPDATE 미발생(nt_uwdate 미갱신) → 이미 target이면 갱신 없이 반환.
// hide/show는 cache_delete_pattern 호출 안 함(Python 충실).
func (s *NoticeService) SetNoticeShow(id int, target string) (resp *dto.NoticeResponse, found, ok bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true
	}
	if cur.NtShow != target { // 변경될 때만 UPDATE(+onupdate nt_uwdate)
		if _, err := s.repo.UpdateFields(id, map[string]interface{}{"nt_show": target, "nt_uwdate": time.Now()}); err != nil {
			return nil, true, false
		}
		cur, err = s.repo.GetByID(id)
		if err != nil || cur == nil {
			return nil, true, false
		}
	}
	r := toNoticeResponse(cur)
	return &r, true, true
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toNoticeResponse(n *model.Notice) dto.NoticeResponse {
	return dto.NoticeResponse{
		NtIdx:     n.NtIdx,
		NtTitle:   derefStr(n.NtTitle),
		NtContent: derefStr(n.NtContent),
		NtFile1:   n.NtFile1,
		NtHit:     n.NtHit,
		NtWdate:   dto.PyTime(n.NtWdate),
		NtUwdate:  dto.PyTime(n.NtUwdate),
	}
}

func toNoticeListItem(n model.Notice) dto.NoticeListItem {
	return dto.NoticeListItem{
		NtIdx:     n.NtIdx,
		NtTitle:   derefStr(n.NtTitle),
		NtContent: derefStr(n.NtContent),
		NtHit:     n.NtHit,
		NtWdate:   dto.PyTime(n.NtWdate),
	}
}

// GetNotice는 단건 조회. incrementHit이면 조회수 +1. 없으면 (nil, nil)로 404 신호.
func (s *NoticeService) GetNotice(id int, incrementHit bool) (*dto.NoticeResponse, error) {
	var (
		n   *model.Notice
		err error
	)
	if incrementHit {
		n, err = s.repo.IncrementHitAndGet(id)
	} else {
		n, err = s.repo.GetByID(id)
	}
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, nil
	}
	r := toNoticeResponse(n)
	return &r, nil
}

// ListNotices는 페이지네이션 목록. Python get_notices_with_pagination과 동등:
// skip=(page-1)*size, total_pages=ceil(total/size) (total=0이면 1).
func (s *NoticeService) ListNotices(page, size int, showOnly bool) (*dto.NoticeListWithPagination, error) {
	skip := (page - 1) * size
	total, err := s.repo.Count(showOnly)
	if err != nil {
		return nil, err
	}
	notices, err := s.repo.List(skip, size, showOnly)
	if err != nil {
		return nil, err
	}
	totalPages := 1
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(size)))
	}
	items := make([]dto.NoticeListItem, 0, len(notices))
	for _, n := range notices {
		items = append(items, toNoticeListItem(n))
	}
	return &dto.NoticeListWithPagination{
		Notices:    items,
		Total:      int(total),
		Page:       page,
		Size:       size,
		TotalPages: totalPages,
	}, nil
}

// SearchNotices는 키워드 검색 목록(List[NoticeListResponse]).
func (s *NoticeService) SearchNotices(keyword string, skip, limit int, showOnly bool) ([]dto.NoticeListItem, error) {
	notices, err := s.repo.Search(keyword, skip, limit, showOnly)
	if err != nil {
		return nil, err
	}
	items := make([]dto.NoticeListItem, 0, len(notices))
	for _, n := range notices {
		items = append(items, toNoticeListItem(n))
	}
	return items, nil
}
