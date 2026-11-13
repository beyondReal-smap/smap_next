package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// PushFCMWriteInput은 PushFCMCreate/Update의 입력(전 필드 Optional).
type PushFCMWriteInput struct {
	PftCode      *string
	PftTitle     *string
	PftContent   *string
	PftSendType  *int
	PftSendMtIdx *int
	PftRdate     *time.Time
	PftURL       *string
	PftStatus    *int
	PftShow      *string
	PftSdate     *time.Time
	PftEdate     *time.Time
}

// CreatePushFCM은 Python create_push_fcm을 이식한다(INSERT 후 재조회). ok=false→500.
func (s *PushFCMService) CreatePushFCM(in PushFCMWriteInput) (*dto.PushFCMResponse, bool) {
	p := &model.PushFCM{
		PftCode: in.PftCode, PftTitle: in.PftTitle, PftContent: in.PftContent,
		PftSendType: in.PftSendType, PftSendMtIdx: in.PftSendMtIdx, PftRdate: in.PftRdate,
		PftURL: in.PftURL, PftStatus: in.PftStatus, PftShow: in.PftShow,
		PftSdate: in.PftSdate, PftEdate: in.PftEdate,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, false
	}
	saved, err := s.repo.GetByID(p.PftIdx)
	if err != nil || saved == nil {
		return nil, false
	}
	r, valid := toPushFCMResponse(saved)
	if !valid {
		return nil, false
	}
	return &r, true
}

// UpdatePushFCM은 Python update_push_fcm을 이식한다(present 컬럼만 UPDATE). found=false→404, ok=false→500.
func (s *PushFCMService) UpdatePushFCM(id int, fields map[string]interface{}) (resp *dto.PushFCMResponse, found, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if p == nil {
		return nil, false, true
	}
	if err := s.repo.UpdateFields(id, fields); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	r, valid := toPushFCMResponse(saved)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

// DeletePushFCM은 Python delete_push_fcm을 이식한다(하드 삭제). found=false→404, ok=false→500.
func (s *PushFCMService) DeletePushFCM(id int) (found, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if p == nil {
		return false, true
	}
	if err := s.repo.Delete(id); err != nil {
		return true, false
	}
	return true, true
}

// MarkDelivered는 Python mark_push_fcm_delivered를 이식한다.
// ⚠️ PushFCM에 delivered_at 컬럼이 없어 Python의 hasattr 분기가 거짓 → 상태 변경 없는 no-op + 메시지.
// found=false→404, ok=false→500(여기선 DB 변경 없음).
func (s *PushFCMService) MarkDelivered(id int) (found, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if p == nil {
		return false, true
	}
	return true, true
}
