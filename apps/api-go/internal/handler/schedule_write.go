package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Create는 POST /schedules/ — 신원은 토큰. 본인 일정은 그 그룹 현재 멤버면 누구나, 타인 일정은 그룹장·리더만.
// ScheduleCreate(전 Optional) INSERT 후 재조회 → ScheduleResponse.
func (h *ScheduleHandler) Create(c *gin.Context) {
	actor, ok := scheduleActor(c)
	if !ok {
		return
	}
	present, errs := parseScheduleBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, err := h.svc.CreateSchedule(c.Request.Context(), actor, present)
	if err != nil {
		writeScheduleErr(c, err, "생성")
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Update는 PUT /schedules/:schedule_id — 작성자 본인 또는 그 그룹의 그룹장·리더. exclude_unset → 존재 컬럼만 UPDATE. 404 "Schedule not found".
func (h *ScheduleHandler) Update(c *gin.Context) {
	actor, aok := scheduleActor(c)
	if !aok {
		return
	}
	id, ok := schedulePathID(c)
	if !ok {
		return
	}
	present, errs := parseScheduleBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, err := h.svc.UpdateSchedule(c.Request.Context(), actor, id, present)
	if err != nil {
		writeScheduleErr(c, err, "수정")
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete는 DELETE /schedules/:schedule_id — 작성자 본인 또는 그 그룹의 그룹장·리더. 하드 삭제, {"message":"Schedule deleted successfully"}.
func (h *ScheduleHandler) Delete(c *gin.Context) {
	actor, aok := scheduleActor(c)
	if !aok {
		return
	}
	id, ok := schedulePathID(c)
	if !ok {
		return
	}
	found, err := h.svc.DeleteSchedule(c.Request.Context(), actor, id)
	if err != nil {
		writeScheduleErr(c, err, "삭제")
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"message": "Schedule deleted successfully"})
}

func schedulePathID(c *gin.Context) (int, bool) {
	idStr := c.Param("schedule_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "schedule_id", idStr)
		return 0, false
	}
	return id, true
}

// parseScheduleBody는 ScheduleBase(전 Optional)를 필드 순서대로 파싱해 present 맵(컬럼→값)을 만든다.
func parseScheduleBody(c *gin.Context) (map[string]interface{}, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present := map[string]interface{}{}
	var errs []valErr
	bodyOptInt(body, "sst_pidx", present, &errs)
	bodyOptInt(body, "mt_idx", present, &errs)
	bodyOptStr(body, "sst_title", present, &errs)
	bodyOptDatetime(body, "sst_sdate", present, &errs)
	bodyOptDatetime(body, "sst_edate", present, &errs)
	bodyOptStr(body, "sst_sedate", present, &errs)
	bodyOptStr(body, "sst_all_day", present, &errs)
	bodyOptStr(body, "sst_repeat_json", present, &errs)
	bodyOptStr(body, "sst_repeat_json_v", present, &errs)
	bodyOptInt(body, "sgt_idx", present, &errs)
	bodyOptInt(body, "sgdt_idx", present, &errs)
	bodyOptStr(body, "sgdt_idx_t", present, &errs)
	bodyOptInt(body, "sst_alram", present, &errs)
	bodyOptStr(body, "sst_alram_t", present, &errs)
	bodyOptDatetime(body, "sst_adate", present, &errs)
	bodyOptInt(body, "slt_idx", present, &errs)
	bodyOptStr(body, "slt_idx_t", present, &errs)
	bodyOptStr(body, "sst_location_title", present, &errs)
	bodyOptStr(body, "sst_location_add", present, &errs)
	bodyOptDecimal(body, "sst_location_lat", present, &errs)
	bodyOptDecimal(body, "sst_location_long", present, &errs)
	bodyOptStr(body, "sst_supplies", present, &errs)
	bodyOptStr(body, "sst_memo", present, &errs)
	bodyOptStr(body, "sst_show", present, &errs)
	bodyOptInt(body, "sst_location_alarm", present, &errs)
	bodyOptStr(body, "sst_schedule_alarm_chk", present, &errs)
	bodyOptStr(body, "sst_pick_type", present, &errs)
	bodyOptInt(body, "sst_pick_result", present, &errs)
	bodyOptDatetime(body, "sst_schedule_alarm", present, &errs)
	bodyOptStr(body, "sst_update_chk", present, &errs)
	bodyOptStr(body, "sst_in_chk", present, &errs)
	bodyOptStr(body, "sst_schedule_chk", present, &errs)
	bodyOptInt(body, "sst_entry_cnt", present, &errs)
	bodyOptInt(body, "sst_exit_cnt", present, &errs)
	return present, errs
}

// bodyOptDecimal은 Optional Decimal 필드(숫자/문자열 모두 허용 → 문자열로 저장; DB DECIMAL 라운드트립이 표기 정규화).
func bodyOptDecimal(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	switch v := raw.(type) {
	case float64:
		present[key] = strconv.FormatFloat(v, 'f', -1, 64)
	case string:
		present[key] = v
	default:
		*errs = append(*errs, valErr{Type: "decimal_parsing", Loc: []string{"body", key}, Msg: "Input should be a valid decimal", Input: raw})
	}
}
