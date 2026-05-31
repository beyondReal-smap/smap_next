package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type ScheduleHandler struct {
	svc *service.ScheduleService
}

func NewSchedule(svc *service.ScheduleService) *ScheduleHandler {
	return &ScheduleHandler{svc: svc}
}

// List는 GET /api/v1/schedules/ — skip(0)/limit(100), 필터 없음.
func (h *ScheduleHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, ok := h.svc.ListSchedules(skip, limit)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/schedules/:schedule_id. 없으면 404 "Schedule not found".
// (/before-30min은 Python에서 /{schedule_id}에 가려져 422 → Go도 미등록으로 동일 재현.)
func (h *ScheduleHandler) Get(c *gin.Context) {
	idStr := c.Param("schedule_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "schedule_id", idStr)
		return
	}
	res, found, ok := h.svc.GetSchedule(id)
	if !ok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/schedules/member/:member_id.
func (h *ScheduleHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, ok := h.svc.MemberSchedules(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Group은 GET /api/v1/schedules/group/:group_id — days(optional int) 날짜창. repo 에러 시
// Python except로 500 {"detail":"Internal server error: <e>"}.
func (h *ScheduleHandler) Group(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	var days *int
	if v, exists := c.GetQuery("days"); exists {
		n, ok := coerceInt(v)
		if !ok {
			writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{
				qErr("int_parsing", "days", msgIntParse, v),
			}})
			return
		}
		days = &n
	}
	res, err := h.svc.GroupSchedules(id, days)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "Internal server error: " + err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
