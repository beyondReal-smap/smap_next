package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupScheduleManageHandler struct {
	svc *service.GroupScheduleManageService
}

func NewGroupScheduleManage(svc *service.GroupScheduleManageService) *GroupScheduleManageHandler {
	return &GroupScheduleManageHandler{svc: svc}
}

// gsmOptQueryInt는 옵션 int 쿼리(Python Query(None)). 누락→nil, 비정수→errs에 int_parsing 추가.
func gsmOptQueryInt(c *gin.Context, key string, errs *[]valErr) *int {
	raw, has := c.GetQuery(key)
	if !has {
		return nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"query", key}, Msg: msgIntParse, Input: raw})
		return nil
	}
	return &n
}

// gsmOptQueryStr은 옵션 문자열 쿼리. 누락/빈문자열→nil(Python `if x:` truthy 동작).
func gsmOptQueryStr(c *gin.Context, key string) *string {
	raw, has := c.GetQuery(key)
	if !has || raw == "" {
		return nil
	}
	return &raw
}

// TestAllColumns는 GET /schedule/test-all-columns — 관리자 전용(라우트 그룹이 보장). 대상은 토큰의 회원이다.
func (h *GroupScheduleManageHandler) TestAllColumns(c *gin.Context) {
	uid, ok := scheduleActor(c)
	if !ok {
		return
	}
	writeJSON(c, http.StatusOK, h.svc.TestAllColumns(uid))
}

// OwnerGroupsAllSchedules는 GET /schedule/owner-groups/all-schedules.
func (h *GroupScheduleManageHandler) OwnerGroupsAllSchedules(c *gin.Context) {
	uid, aok := scheduleActor(c)
	if !aok {
		return
	}
	errs := make([]valErr, 0, 2)
	year := gsmOptQueryInt(c, "year", &errs)
	month := gsmOptQueryInt(c, "month", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.OwnerGroupsAllSchedules(uid, year, month)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal server error: " + err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// GroupSchedules는 GET /schedule/group/:group_id/schedules.
func (h *GroupScheduleManageHandler) GroupSchedules(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	uid, aok := scheduleActor(c)
	if !aok {
		return
	}
	errs := make([]valErr, 0, 3)
	start := gsmOptQueryStr(c, "start_date")
	end := gsmOptQueryStr(c, "end_date")
	days := gsmOptQueryInt(c, "days", &errs)
	memberID := gsmOptQueryInt(c, "member_id", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, found, err := h.svc.GroupSchedules(c.Request.Context(), gid, start, end, days, memberID, uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if !found {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Group access denied"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CreateGroupSchedule은 POST /schedule/group/:group_id/schedules.
func (h *GroupScheduleManageHandler) CreateGroupSchedule(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	uid, aok := scheduleActor(c)
	if !aok {
		return
	}
	// body는 Python `Dict[str, Any]` — 스키마 검증 없음. UseNumber로 JSON 숫자(json.Number)와
	// 문자열(string) 타입을 보존해 Python 진릿값/타입 의미를 충실히 재현한다.
	body, ok := parseGSMCreateBody(c)
	if !ok {
		// 본문이 JSON 객체가 아니거나 파싱 실패 → FastAPI dict_type 422(상태 충실).
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "dict_type", Loc: []string{"body"}, Msg: "Input should be a valid dictionary",
		}}})
		return
	}

	resp, outcome, msg := h.svc.CreateGroupSchedule(c.Request.Context(), gid, body, uid)
	switch outcome {
	case service.GSMCreateOK:
		writeJSON(c, http.StatusOK, resp)
	case service.GSMCreate403GroupDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Group access denied"})
	case service.GSMCreate403TargetInvalid:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Schedule target must be a current group member"})
	case service.GSMCreate403ManageDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Only group owners or leaders can create schedules for other members"})
	case service.GSMCreate400NoStartDate:
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Start date is required"})
	default: // GSMCreate500
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal server error: " + msg})
	}
}

// UpdateGroupSchedule은 PUT /schedule/group/:group_id/schedules/:schedule_id.
func (h *GroupScheduleManageHandler) UpdateGroupSchedule(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	sidStr := c.Param("schedule_id")
	sid, err := strconv.Atoi(sidStr)
	if err != nil {
		pathIntErr(c, "schedule_id", sidStr)
		return
	}
	uid, aok := scheduleActor(c)
	if !aok {
		return
	}
	body, ok := parseGSMCreateBody(c)
	if !ok {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "dict_type", Loc: []string{"body"}, Msg: "Input should be a valid dictionary",
		}}})
		return
	}

	resp, outcome := h.svc.UpdateGroupSchedule(c.Request.Context(), gid, sid, body, uid)
	switch outcome {
	case service.GSMUpdateOK:
		writeJSON(c, http.StatusOK, resp)
	case service.GSMUpdate403GroupDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Group access denied"})
	case service.GSMUpdate403TargetInvalid:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Schedule target must be a current group member"})
	case service.GSMUpdate403EditDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "You can only edit your own schedules or you need owner/leader permission"})
	case service.GSMUpdate404:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
	case service.GSMUpdate400NoStartDate:
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Start date is required"})
	default: // GSMUpdate500
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
	}
}

// DeleteGroupSchedule은 DELETE /schedule/group/:group_id/schedules/:schedule_id.
func (h *GroupScheduleManageHandler) DeleteGroupSchedule(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	sidStr := c.Param("schedule_id")
	sid, err := strconv.Atoi(sidStr)
	if err != nil {
		pathIntErr(c, "schedule_id", sidStr)
		return
	}
	uid, aok := scheduleActor(c)
	if !aok {
		return
	}
	// body는 Optional(없거나 null이면 None). 객체가 아니면(배열/스칼라) 422.
	body, ok := parseGSMOptionalBody(c)
	if !ok {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "dict_type", Loc: []string{"body"}, Msg: "Input should be a valid dictionary",
		}}})
		return
	}

	resp, outcome := h.svc.DeleteGroupSchedule(c.Request.Context(), gid, sid, body, uid)
	switch outcome {
	case service.GSMDeleteOK:
		writeJSON(c, http.StatusOK, resp)
	case service.GSMDelete403GroupDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "Group access denied"})
	case service.GSMDelete403DeleteDenied:
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "You can only delete your own schedules or you need owner/leader permission"})
	case service.GSMDelete404:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
	default: // GSMDelete500
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
	}
}

// parseGSMOptionalBody는 Optional 본문을 디코딩한다(UseNumber). 빈본문/null→(nil,true)=None,
// JSON 객체→(map,true), 배열/스칼라/깨진JSON→(nil,false)=422.
func parseGSMOptionalBody(c *gin.Context) (map[string]interface{}, bool) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, false
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, true // 본문 없음 → None
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v interface{}
	if err := dec.Decode(&v); err != nil {
		return nil, false
	}
	if v == nil {
		return nil, true // JSON null → None
	}
	m, ok := v.(map[string]interface{})
	if !ok {
		return nil, false // 배열/스칼라 → 422
	}
	return m, true
}

// parseGSMCreateBody는 요청 본문을 map[string]interface{}로 디코딩한다(UseNumber).
// JSON 객체가 아니면(배열/스칼라/빈본문) ok=false.
func parseGSMCreateBody(c *gin.Context) (map[string]interface{}, bool) {
	dec := json.NewDecoder(c.Request.Body)
	dec.UseNumber()
	var body map[string]interface{}
	if err := dec.Decode(&body); err != nil || body == nil {
		return nil, false
	}
	return body, true
}

// DebugSchedule은 GET /schedule/debug/schedule/:schedule_id — 관리자 전용(라우트 그룹이 보장).
func (h *GroupScheduleManageHandler) DebugSchedule(c *gin.Context) {
	sidStr := c.Param("schedule_id")
	sid, err := strconv.Atoi(sidStr)
	if err != nil {
		pathIntErr(c, "schedule_id", sidStr)
		return
	}
	writeJSON(c, http.StatusOK, h.svc.DebugSchedule(sid))
}
