package service

import (
	"context"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// buildScheduleModel은 present 맵(컬럼→값)으로 model.Schedule을 구성한다(create용). 미존재 컬럼은 nil(NULL).
func buildScheduleModel(p map[string]interface{}) *model.Schedule {
	s := &model.Schedule{}
	pi := func(k string) *int {
		if v, ok := p[k].(int); ok {
			return &v
		}
		return nil
	}
	ps := func(k string) *string {
		if v, ok := p[k].(string); ok {
			return &v
		}
		return nil
	}
	pt := func(k string) *time.Time {
		if v, ok := p[k].(time.Time); ok {
			return &v
		}
		return nil
	}
	s.SstPidx = pi("sst_pidx")
	s.MtIdx = pi("mt_idx")
	s.SstTitle = ps("sst_title")
	s.SstSdate = pt("sst_sdate")
	s.SstEdate = pt("sst_edate")
	s.SstSedate = ps("sst_sedate")
	s.SstAllDay = ps("sst_all_day")
	s.SstRepeatJSON = ps("sst_repeat_json")
	s.SstRepeatJSONV = ps("sst_repeat_json_v")
	s.SgtIdx = pi("sgt_idx")
	s.SgdtIdx = pi("sgdt_idx")
	s.SgdtIdxT = ps("sgdt_idx_t")
	s.SstAlram = pi("sst_alram")
	s.SstAlramT = ps("sst_alram_t")
	s.SstAdate = pt("sst_adate")
	s.SltIdx = pi("slt_idx")
	s.SltIdxT = ps("slt_idx_t")
	s.SstLocationTitle = ps("sst_location_title")
	s.SstLocationAdd = ps("sst_location_add")
	s.SstLocationLat = ps("sst_location_lat")
	s.SstLocationLong = ps("sst_location_long")
	s.SstSupplies = ps("sst_supplies")
	s.SstMemo = ps("sst_memo")
	s.SstShow = ps("sst_show")
	s.SstLocationAlarm = pi("sst_location_alarm")
	s.SstScheduleAlarmChk = ps("sst_schedule_alarm_chk")
	s.SstPickType = ps("sst_pick_type")
	s.SstPickResult = pi("sst_pick_result")
	s.SstScheduleAlarm = pt("sst_schedule_alarm")
	s.SstUpdateChk = ps("sst_update_chk")
	s.SstInChk = ps("sst_in_chk")
	s.SstScheduleChk = ps("sst_schedule_chk")
	s.SstEntryCnt = pi("sst_entry_cnt")
	s.SstExitCnt = pi("sst_exit_cnt")
	return s
}

// optInt는 present 맵의 정수 값을 꺼낸다. 키가 없거나 null이면 nil.
func optInt(p map[string]interface{}, k string) *int {
	if v, ok := p[k].(int); ok {
		return &v
	}
	return nil
}

// CreateSchedule은 POST /schedules/ — 신원은 토큰(actor)이다.
//
//   - 그룹 일정(sgt_idx 있음): 요청자가 그 그룹의 현재 멤버여야 한다. 본문 mt_idx가 없거나 본인이면 본인 일정(관리 권한 불필요 —
//     Android는 본문 mt_idx로 본인을 보낸다). 타인이면 요청자가 그룹장·리더이고 대상이 현재 멤버일 때만. 소유자·sgdt_idx는
//     확정된 대상 값으로 덮어쓴다.
//   - 개인 일정: 본인 것만.
//
// 클라이언트가 보낸 sst_pidx(반복 부모 번호)는 쓰지 않는다(S-1). 새 일정은 항상 sst_show='Y'.
func (s *ScheduleService) CreateSchedule(ctx context.Context, actor int, present map[string]interface{}) (*dto.ScheduleResponse, error) {
	if err := s.needAuthz(); err != nil {
		return nil, err
	}
	sgt := optInt(present, "sgt_idx")
	if sgt != nil && *sgt != 0 {
		role, err := s.authz.RequireMember(ctx, actor, *sgt)
		if err != nil {
			return nil, err
		}
		target, err := s.authz.ResolveCreateTarget(ctx, actor, *sgt, role, optInt(present, "mt_idx"), optInt(present, "sgdt_idx"))
		if err != nil {
			return nil, err
		}
		present["mt_idx"] = target.MtIdx
		present["sgdt_idx"] = target.SgdtIdx
	} else {
		if mt := optInt(present, "mt_idx"); mt != nil && *mt != actor {
			return nil, ErrScheduleManageDenied
		}
		if optInt(present, "sgdt_idx") != nil {
			return nil, ErrScheduleOwnerChange
		}
		present["mt_idx"] = actor
	}
	delete(present, "sst_pidx")
	present["sst_show"] = "Y"

	m := buildScheduleModel(present)
	if err := s.repo.Create(m); err != nil {
		return nil, err
	}
	saved, err := s.repo.GetByID(m.SstIdx)
	if err != nil {
		return nil, err
	}
	if saved == nil {
		return nil, errScheduleInternal
	}
	r, ok := toScheduleResponse(saved)
	if !ok {
		return nil, errScheduleInternal
	}
	return &r, nil
}

// UpdateSchedule은 PUT /schedules/:id — 작성자 본인 또는 그 그룹의 그룹장·리더(`/schedule/group/...`와 같은 규칙).
// found=false→404. 대상 멤버를 바꾸면 그 그룹의 현재 멤버인지 확인하고, 그룹·반복 부모(sst_pidx)는 바꿀 수 없다.
func (s *ScheduleService) UpdateSchedule(ctx context.Context, actor, id int, present map[string]interface{}) (*dto.ScheduleResponse, bool, error) {
	if err := s.needAuthz(); err != nil {
		return nil, false, err
	}
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, err
	}
	if sc == nil {
		return nil, false, nil
	}
	delete(present, "sst_pidx")
	if v, ok := present["sgt_idx"]; ok {
		cur := 0
		if sc.SgtIdx != nil {
			cur = *sc.SgtIdx
		}
		n, isInt := v.(int) // null은 0(개인 일정)으로 본다
		if (!isInt && v != nil) || n != cur {
			return nil, true, ErrScheduleOwnerChange
		}
	}
	if isPersonal(sc.SgtIdx) {
		if sc.MtIdx == nil || *sc.MtIdx != actor {
			return nil, true, ErrScheduleManageDenied
		}
		_, hasMt := present["mt_idx"]
		_, hasSgdt := present["sgdt_idx"]
		if hasMt || hasSgdt {
			return nil, true, ErrScheduleOwnerChange
		}
	} else {
		role, err := s.authz.Role(ctx, actor, *sc.SgtIdx)
		if err != nil {
			return nil, true, err
		}
		if !role.Found {
			return nil, true, ErrScheduleNotMember
		}
		if err := s.authz.CanModify(ctx, actor, *sc.SgtIdx, role, sc.MtIdx); err != nil {
			return nil, true, err
		}
		_, hasMt := present["mt_idx"]
		_, hasSgdt := present["sgdt_idx"]
		if hasMt || hasSgdt {
			target := sc.MtIdx
			if hasMt {
				target = optInt(present, "mt_idx")
				if target == nil {
					return nil, true, ErrScheduleTargetInvalid
				}
			}
			t, err := s.authz.ResolveTarget(ctx, actor, *sc.SgtIdx, role, target, optInt(present, "sgdt_idx"))
			if err != nil {
				return nil, true, err
			}
			present["mt_idx"] = t.MtIdx
			present["sgdt_idx"] = t.SgdtIdx
		}
	}
	if err := s.repo.UpdateFields(id, present); err != nil {
		return nil, true, err
	}
	saved, err := s.repo.GetByID(id)
	if err != nil {
		return nil, true, err
	}
	if saved == nil {
		return nil, true, errScheduleInternal
	}
	r, valid := toScheduleResponse(saved)
	if !valid {
		return nil, true, errScheduleInternal
	}
	return &r, true, nil
}

// DeleteSchedule은 DELETE /schedules/:id(하드 삭제) — 작성자 본인 또는 그 그룹의 그룹장·리더. found=false→404.
func (s *ScheduleService) DeleteSchedule(ctx context.Context, actor, id int) (bool, error) {
	if err := s.needAuthz(); err != nil {
		return false, err
	}
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return false, err
	}
	if sc == nil {
		return false, nil
	}
	if isPersonal(sc.SgtIdx) {
		if sc.MtIdx == nil || *sc.MtIdx != actor {
			return true, ErrScheduleManageDenied
		}
	} else {
		role, err := s.authz.Role(ctx, actor, *sc.SgtIdx)
		if err != nil {
			return true, err
		}
		if !role.Found {
			return true, ErrScheduleNotMember
		}
		if err := s.authz.CanModify(ctx, actor, *sc.SgtIdx, role, sc.MtIdx); err != nil {
			return true, err
		}
	}
	if err := s.repo.Delete(id); err != nil {
		return true, err
	}
	return true, nil
}
