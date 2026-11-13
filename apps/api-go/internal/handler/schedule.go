package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type ScheduleHandler struct {
	svc *service.ScheduleService
}

func NewSchedule(svc *service.ScheduleService) *ScheduleHandler {
	return &ScheduleHandler{svc: svc}
}

// scheduleActor는 일정 라우트의 요청자(토큰의 회원 번호)다. 일정 API의 신원은 토큰에서만 읽는다 — 쿼리·본문의
// current_user_id/mt_idx는 신원으로 쓰지 않는다. 유효한 토큰이 없으면 ROUTE_AUTH_MODE와 무관하게 401(앱은 일정 API를
// 항상 토큰과 함께 부른다: 15·18단계 이력 조사).
func scheduleActor(c *gin.Context) (int, bool) {
	uid, ok := middleware.UserID(c)
	if !ok {
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return 0, false
	}
	return uid, true
}

// writeScheduleErr는 일정 서비스의 인가 오류를 403으로, 그 외 오류는 기존대로 500(plain)으로 응답한다.
// action은 "조회|생성|수정|삭제" — 권한 없음 메시지에 쓴다. 403 사유는 로그에 (라우트, 종류)만 남긴다.
func writeScheduleErr(c *gin.Context, err error, action string) {
	var detail string
	switch {
	case errors.Is(err, service.ErrScheduleNotMember):
		detail = "그룹 멤버만 이용할 수 있습니다."
	case errors.Is(err, service.ErrScheduleManageDenied):
		detail = "일정 " + action + " 권한이 없습니다."
	case errors.Is(err, service.ErrScheduleTargetInvalid):
		detail = "일정 대상은 그룹의 현재 멤버여야 합니다."
	case errors.Is(err, service.ErrScheduleOwnerChange):
		detail = "일정 소유자를 변경할 수 없습니다."
	default:
		slog.Error("schedule request failed", slog.String("route", c.FullPath()), slog.String("err", err.Error()))
		plainServerError(c)
		return
	}
	slog.Info("schedule_forbidden", slog.String("route", c.FullPath()), slog.String("method", c.Request.Method), slog.String("reason", detail))
	writeJSON(c, http.StatusForbidden, gin.H{"detail": detail})
}

// List는 GET /api/v1/schedules/ — skip(0)/limit(100). 요청자와 관련된 일정(본인 + 현재 멤버인 그룹)만.
func (h *ScheduleHandler) List(c *gin.Context) {
	actor, ok := scheduleActor(c)
	if !ok {
		return
	}
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, lok := h.svc.ListSchedules(actor, skip, limit)
	if !lok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/schedules/:schedule_id. 없으면 404 "Schedule not found".
// (/before-30min은 Python에서 /{schedule_id}에 가려져 422 → Go도 미등록으로 동일 재현.)
func (h *ScheduleHandler) Get(c *gin.Context) {
	actor, ok := scheduleActor(c)
	if !ok {
		return
	}
	idStr := c.Param("schedule_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "schedule_id", idStr)
		return
	}
	res, found, err := h.svc.GetScheduleFor(c.Request.Context(), actor, id)
	if err != nil {
		writeScheduleErr(c, err, "조회")
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Schedule not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// NowInMembers는 GET /api/v1/schedules/now/in-members. 시간창 매칭 일정(zero date 행 있으면 500).
func (h *ScheduleHandler) NowInMembers(c *gin.Context) {
	res, ok := h.svc.NowScheduleInMembers()
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// NowOutMembers는 GET /api/v1/schedules/now/out-members.
func (h *ScheduleHandler) NowOutMembers(c *gin.Context) {
	res, ok := h.svc.NowScheduleOutMembers()
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// NowPush는 GET /api/v1/schedules/now/push.
func (h *ScheduleHandler) NowPush(c *gin.Context) {
	res, ok := h.svc.NowSchedulePush()
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/schedules/member/:member_id — 본인 것만(앱은 쓰지 않는다).
func (h *ScheduleHandler) Member(c *gin.Context) {
	actor, ok := scheduleActor(c)
	if !ok {
		return
	}
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	if id != actor {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "본인의 일정만 조회할 수 있습니다."})
		return
	}
	res, mok := h.svc.MemberSchedules(id)
	if !mok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Group은 GET /api/v1/schedules/group/:group_id — days(optional int) 날짜창. 그 그룹의 현재 멤버만, 삭제되지 않은 그 그룹 일정만. repo 에러 시
// Python except로 500 {"detail":"Internal server error: <e>"}.
func (h *ScheduleHandler) Group(c *gin.Context) {
	actor, aok := scheduleActor(c)
	if !aok {
		return
	}
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
	res, err := h.svc.GroupSchedulesFor(c.Request.Context(), actor, id, days)
	if errors.Is(err, service.ErrScheduleNotMember) {
		writeScheduleErr(c, err, "조회")
		return
	}
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "Internal server error: " + err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
