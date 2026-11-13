package service

import (
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

// CreateSchedule은 Python create_schedule을 이식한다(INSERT 후 재조회). ok=false→500(zero date 등).
func (s *ScheduleService) CreateSchedule(present map[string]interface{}) (*dto.ScheduleResponse, bool) {
	m := buildScheduleModel(present)
	if err := s.repo.Create(m); err != nil {
		return nil, false
	}
	saved, err := s.repo.GetByID(m.SstIdx)
	if err != nil || saved == nil {
		return nil, false
	}
	r, ok := toScheduleResponse(saved)
	if !ok {
		return nil, false
	}
	return &r, true
}

// UpdateSchedule은 Python update_schedule을 이식한다(present 컬럼만 UPDATE). found=false→404, ok=false→500.
func (s *ScheduleService) UpdateSchedule(id int, present map[string]interface{}) (resp *dto.ScheduleResponse, found, ok bool) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if sc == nil {
		return nil, false, true
	}
	if err := s.repo.UpdateFields(id, present); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	r, valid := toScheduleResponse(saved)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

// DeleteSchedule은 Python delete_schedule을 이식한다(하드 삭제). found=false→404, ok=false→500.
func (s *ScheduleService) DeleteSchedule(id int) (found, ok bool) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if sc == nil {
		return false, true
	}
	if err := s.repo.Delete(id); err != nil {
		return true, false
	}
	return true, true
}
