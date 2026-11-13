package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// pushLogRepo는 PushLogService가 의존하는 데이터 접근 인터페이스.
type pushLogRepo interface {
	List(skip, limit int) ([]model.PushLog, error)
	GetByID(id int) (*model.PushLog, error)
	FindByMember(mtIdx int) ([]model.PushLog, error)
	FindBySchedule(sstIdx int) ([]model.PushLog, error)
	FindUnread(mtIdx int) ([]model.PushLog, error)
	// Phase 3 write
	Create(p *model.PushLog) error
	UpdateFields(id int, fields map[string]interface{}) error
	Delete(id int) error
	MarkReadByID(id int, now time.Time) error
	SoftDeleteAllForMember(mtIdx int, now time.Time) error
	MarkReadAllForMember(mtIdx int, now time.Time) error
}

// PushLogService는 Python `app/api/v1/endpoints/push_logs.py`의 read 핸들러를 이식한다.
type PushLogService struct {
	repo pushLogRepo
}

func NewPushLog(repo pushLogRepo) *PushLogService {
	return &PushLogService{repo: repo}
}

// toPushLogResponse는 변환. zero date가 있으면 ok=false(→ Python ResponseValidationError 500).
func toPushLogResponse(p *model.PushLog) (dto.PushLogResponse, bool) {
	if hasZeroDate(p.PltSdate, p.PltWdate, p.PltRdate) {
		return dto.PushLogResponse{}, false
	}
	return dto.PushLogResponse{
		PltType:      p.PltType,
		MtIdx:        p.MtIdx,
		SstIdx:       p.SstIdx,
		PltCondition: p.PltCondition,
		PltMemo:      p.PltMemo,
		PltTitle:     p.PltTitle,
		PltContent:   p.PltContent,
		PltSdate:     pyISOPtr(p.PltSdate),
		PltStatus:    p.PltStatus,
		PltReadChk:   p.PltReadChk,
		PltShow:      p.PltShow,
		PushJSON:     p.PushJSON,
		PltIdx:       p.PltIdx,
		PltWdate:     pyISOPtr(p.PltWdate),
		PltRdate:     pyISOPtr(p.PltRdate),
	}, true
}

func toPushLogResponses(items []model.PushLog) ([]dto.PushLogResponse, bool) {
	out := make([]dto.PushLogResponse, 0, len(items))
	for i := range items {
		r, ok := toPushLogResponse(&items[i])
		if !ok {
			return nil, false
		}
		out = append(out, r)
	}
	return out, true
}

func (s *PushLogService) ListPushLogs(skip, limit int) ([]dto.PushLogResponse, bool) {
	items, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, false
	}
	return toPushLogResponses(items)
}

// GetPushLog은 단건. ok=false→500, found=false→404, 그 외 200.
func (s *PushLogService) GetPushLog(id int) (resp *dto.PushLogResponse, found bool, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if p == nil {
		return nil, false, true
	}
	r, valid := toPushLogResponse(p)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

// MemberPushLogs는 회원의 최근 7일 푸시 로그(member·recent 공용).
func (s *PushLogService) MemberPushLogs(mtIdx int) ([]dto.PushLogResponse, bool) {
	items, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, false
	}
	return toPushLogResponses(items)
}

func (s *PushLogService) SchedulePushLogs(sstIdx int) ([]dto.PushLogResponse, bool) {
	items, err := s.repo.FindBySchedule(sstIdx)
	if err != nil {
		return nil, false
	}
	return toPushLogResponses(items)
}

func (s *PushLogService) UnreadPushLogs(mtIdx int) ([]dto.PushLogResponse, bool) {
	items, err := s.repo.FindUnread(mtIdx)
	if err != nil {
		return nil, false
	}
	return toPushLogResponses(items)
}

// PushLogOwner는 푸시 로그의 소유 회원(plt.mt_idx)을 돌려준다(본인 것만 조회·읽음·삭제하는 인가용).
// 응답 변환(zero date 검사)을 거치지 않으므로 표시용 DTO가 500이 되는 행에서도 소유자는 확인된다.
// found=false→404, ok=false→500.
func (s *PushLogService) PushLogOwner(id int) (owner *int, found, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if p == nil {
		return nil, false, true
	}
	return p.MtIdx, true, true
}
