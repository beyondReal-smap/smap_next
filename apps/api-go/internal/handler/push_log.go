package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type PushLogHandler struct {
	svc  *service.PushLogService
	self *SelfGuard // 본인 것만 조회·읽음·삭제(G7)
}

// SetGuard는 본인 검사 가드를 주입한다.
func (h *PushLogHandler) SetGuard(g *SelfGuard) { h.self = g }

// ownLog는 푸시 로그 id의 소유자를 확인한다. 토큰이 있으면 본인 것이어야 한다(아니면 403).
// 없는 로그는 기존대로 404. 토큰이 없으면(ROUTE_AUTH_MODE 통과분) 소유자 비교 없이 통과한다.
func (h *PushLogHandler) ownLog(c *gin.Context, id int) bool {
	owner, found, ok := h.svc.PushLogOwner(id)
	if !ok {
		plainServerError(c)
		return false
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push log not found"})
		return false
	}
	return h.self.Owns(c, owner)
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
	// 앱이 쓰지 않는 경로: 토큰 필수 + 본인 로그만.
	if _, ok := h.self.RequireToken(c); !ok || !h.ownLog(c, id) {
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
	if _, ok := h.self.RequireToken(c); !ok { // 앱이 쓰지 않는 경로
		return
	}
	h.byMember(c)
}

func (h *PushLogHandler) byMember(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	if !h.self.Self(c, id) {
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
	// 앱이 쓰지 않는 경로: 토큰 필수, 일정에 얽힌 푸시 로그 중 본인 것만 돌려준다.
	uid, tok := h.self.RequireToken(c)
	if !tok {
		return
	}
	res, ok := h.svc.SchedulePushLogs(id)
	if !ok {
		plainServerError(c)
		return
	}
	own := make([]dto.PushLogResponse, 0, len(res))
	for _, r := range res {
		if r.MtIdx != nil && *r.MtIdx == uid {
			own = append(own, r)
		}
	}
	writeJSON(c, http.StatusOK, own)
}

// Unread는 GET /api/v1/push-logs/member/:member_id/unread.
func (h *PushLogHandler) Unread(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	if !h.self.SelfStrict(c, id) { // 앱이 쓰지 않는 경로
		return
	}
	res, ok := h.svc.UnreadPushLogs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}
