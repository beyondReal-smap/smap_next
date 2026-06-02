package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// PushLogWriteInput은 PushLogCreate/Update의 입력(전 필드 Optional). 핸들러가 파싱해 전달한다.
// Present 맵은 PUT(exclude_unset)용 — body에 존재한 컬럼만 UPDATE한다(null 명시도 present).
type PushLogWriteInput struct {
	PltType      *int
	MtIdx        *int
	SstIdx       *int
	PltCondition *string
	PltMemo      *string
	PltTitle     *string
	PltContent   *string
	PltSdate     *time.Time
	PltStatus    *int
	PltReadChk   *string
	PltShow      *string
	PushJSON     *string
}

// CreatePushLog는 Python create_push_log를 이식한다.
// plt_memo=="API3_FCM_service" 또는 plt_condition=="system_auto"면 DB 저장 없이 가짜 응답(plt_idx=0, plt_wdate=now).
func (s *PushLogService) CreatePushLog(in PushLogWriteInput) (*dto.PushLogResponse, bool) {
	if derefStr(in.PltMemo) == "API3_FCM_service" || derefStr(in.PltCondition) == "system_auto" {
		now := pyISO(time.Now())
		r := dto.PushLogResponse{
			PltType: in.PltType, MtIdx: in.MtIdx, SstIdx: in.SstIdx,
			PltCondition: in.PltCondition, PltMemo: in.PltMemo, PltTitle: in.PltTitle, PltContent: in.PltContent,
			PltSdate: pyISOPtr(in.PltSdate), PltStatus: in.PltStatus, PltReadChk: in.PltReadChk, PltShow: in.PltShow,
			PushJSON: in.PushJSON, PltIdx: 0, PltWdate: &now, PltRdate: nil,
		}
		return &r, true
	}
	p := &model.PushLog{
		PltType: in.PltType, MtIdx: in.MtIdx, SstIdx: in.SstIdx,
		PltCondition: in.PltCondition, PltMemo: in.PltMemo, PltTitle: in.PltTitle, PltContent: in.PltContent,
		PltSdate: in.PltSdate, PltStatus: in.PltStatus, PltReadChk: in.PltReadChk, PltShow: in.PltShow,
		PushJSON: in.PushJSON,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, false
	}
	saved, err := s.repo.GetByID(p.PltIdx) // db.refresh 등가(DB default 반영)
	if err != nil || saved == nil {
		return nil, false
	}
	r, valid := toPushLogResponse(saved)
	if !valid {
		return nil, false
	}
	return &r, true
}

// UpdatePushLog는 Python update_push_log를 이식한다(present 컬럼만 UPDATE). found=false→404, ok=false→500.
func (s *PushLogService) UpdatePushLog(id int, fields map[string]interface{}) (resp *dto.PushLogResponse, found, ok bool) {
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
	r, valid := toPushLogResponse(saved)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

// DeletePushLog는 Python delete_push_log를 이식한다(하드 삭제). found=false→404, ok=false→500.
func (s *PushLogService) DeletePushLog(id int) (found, ok bool) {
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

// MarkPushLogRead는 Python mark_push_log_as_read를 이식한다. found=false→404, ok=false→500.
func (s *PushLogService) MarkPushLogRead(id int) (found, ok bool) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if p == nil {
		return false, true
	}
	if err := s.repo.MarkReadByID(id, time.Now()); err != nil {
		return true, false
	}
	return true, true
}

// DeleteAllPushLogs는 Python delete_all_push_logs를 이식한다(소프트삭제 plt_show='N'). ok=false→500.
func (s *PushLogService) DeleteAllPushLogs(mtIdx int) bool {
	return s.repo.SoftDeleteAllForMember(mtIdx, time.Now()) == nil
}

// ReadAllPushLogs는 Python read_all_push_logs를 이식한다(미읽음 일괄 읽음). ok=false→500.
func (s *PushLogService) ReadAllPushLogs(mtIdx int) bool {
	return s.repo.MarkReadAllForMember(mtIdx, time.Now()) == nil
}
