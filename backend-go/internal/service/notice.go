package service

import (
	"math"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// NoticeService는 Python `app/api/v1/endpoints/notices.py` + `crud/notice.py`의
// 비즈니스 로직을 이식한다.
type NoticeService struct {
	repo *repository.NoticeRepository
}

func NewNotice(repo *repository.NoticeRepository) *NoticeService {
	return &NoticeService{repo: repo}
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
