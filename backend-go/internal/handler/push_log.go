package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type PushLogHandler struct {
	svc *service.PushLogService
}

func NewPushLog(svc *service.PushLogService) *PushLogHandler {
	return &PushLogHandler{svc: svc}
}

// List는 GET /api/v1/push-logs/ — skip(0)/limit(100), ORDER BY plt_idx DESC.
func (h *PushLogHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, ok := h.svc.ListPushLogs(skip, limit)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/push-logs/:push_log_id. 없으면 404 "Push log not found".
func (h *PushLogHandler) Get(c *gin.Context) {
	idStr := c.Param("push_log_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "push_log_id", idStr)
		return
	}
	res, found, ok := h.svc.GetPushLog(id)
	if !ok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push log not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/push-logs/member/:member_id (최근 7일). Recent도 동일.
func (h *PushLogHandler) Member(c *gin.Context) {
	h.byMember(c)
}

// Recent는 GET /api/v1/push-logs/recent/:member_id — member와 동일.
func (h *PushLogHandler) Recent(c *gin.Context) {
	h.byMember(c)
}

func (h *PushLogHandler) byMember(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, ok := h.svc.MemberPushLogs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Schedule은 GET /api/v1/push-logs/schedule/:schedule_id.
func (h *PushLogHandler) Schedule(c *gin.Context) {
	idStr := c.Param("schedule_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "schedule_id", idStr)
		return
	}
	res, ok := h.svc.SchedulePushLogs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Unread는 GET /api/v1/push-logs/member/:member_id/unread.
func (h *PushLogHandler) Unread(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, ok := h.svc.UnreadPushLogs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}
