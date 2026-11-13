package service

import (
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// pushFCMRepo는 PushFCMService가 의존하는 데이터 접근 인터페이스.
type pushFCMRepo interface {
	List(skip, limit int) ([]model.PushFCM, error)
	GetByID(id int) (*model.PushFCM, error)
	FindByMember(mtIdx int) ([]model.PushFCM, error)
	FindByCode(code string) ([]model.PushFCM, error)
	FindPending(mtIdx int, since *float64) ([]model.PushFCM, error)
	// Phase 3 write
	Create(p *model.PushFCM) error
	UpdateFields(id int, fields map[string]interface{}) error
	Delete(id int) error
}

// PushFCMService는 Python `app/api/v1/endpoints/push_fcms.py`의 read 핸들러를 이식한다.
type PushFCMService struct {
	repo pushFCMRepo
}

func NewPushFCM(repo pushFCMRepo) *PushFCMService {
	return &PushFCMService{repo: repo}
}

func toPushFCMResponse(p *model.PushFCM) (dto.PushFCMResponse, bool) {
	if hasZeroDate(p.PftRdate, p.PftSdate, p.PftEdate, p.PftWdate) {
		return dto.PushFCMResponse{}, false
	}
	return dto.PushFCMResponse{
		PftCode:      p.PftCode,
		PftTitle:     p.PftTitle,
		PftContent:   p.PftContent,
		PftSendType:  p.PftSendType,
		PftSendMtIdx: p.PftSendMtIdx,
		PftRdate:     pyISOPtr(p.PftRdate),
		PftURL:       p.PftURL,
		PftStatus:    p.PftStatus,
		PftShow:      p.PftShow,
		PftSdate:     pyISOPtr(p.PftSdate),
		PftEdate:     pyISOPtr(p.PftEdate),
		PftIdx:       p.PftIdx,
		PftWdate:     pyISOPtr(p.PftWdate),
	}, true
}

func toPushFCMResponses(items []model.PushFCM) ([]dto.PushFCMResponse, bool) {
	out := make([]dto.PushFCMResponse, 0, len(items))
	for i := range items {
		r, ok := toPushFCMResponse(&items[i])
		if !ok {
			return nil, false
		}
		out = append(out, r)
	}
	return out, true
}

func (s *PushFCMService) ListPushFCMs(skip, limit int) ([]dto.PushFCMResponse, bool) {
	items, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, false
	}
	return toPushFCMResponses(items)
}

// GetPushFCM은 단건. ok=false→500, found=false→404, 그 외 200.
func (s *PushFCMService) GetPushFCM(id int) (resp *dto.PushFCMResponse, found bool, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if p == nil {
		return nil, false, true
	}
	r, valid := toPushFCMResponse(p)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

func (s *PushFCMService) MemberPushFCMs(mtIdx int) ([]dto.PushFCMResponse, bool) {
	items, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, false
	}
	return toPushFCMResponses(items)
}

func (s *PushFCMService) CodePushFCMs(code string) ([]dto.PushFCMResponse, bool) {
	items, err := s.repo.FindByCode(code)
	if err != nil {
		return nil, false
	}
	return toPushFCMResponses(items)
}

// PendingPushFCMs는 보류된(미래 예약) 메시지. since(Unix ts)는 0/nil이면 미적용(Python truthy).
// DB 에러→(nil,true,err)로 핸들러가 500(한국어 detail); zero date→(nil,false,nil)로 plain 500.
func (s *PushFCMService) PendingPushFCMs(mtIdx int, since *float64) ([]dto.PushFCMResponse, bool, error) {
	items, err := s.repo.FindPending(mtIdx, since)
	if err != nil {
		return nil, true, err
	}
	out, ok := toPushFCMResponses(items)
	return out, ok, nil
}
