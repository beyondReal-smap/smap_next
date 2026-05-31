package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupHandler struct {
	svc *service.GroupService
	cfg *config.Config
}

func NewGroup(svc *service.GroupService, cfg *config.Config) *GroupHandler {
	return &GroupHandler{svc: svc, cfg: cfg}
}

// Hidden은 GET /api/v1/groups/hidden — 숨김 그룹(sgt_show='N') 목록. 무인증.
func (h *GroupHandler) Hidden(c *gin.Context) {
	res, err := h.svc.HiddenGroups()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/groups/:group_id — sgt_show 무관 단건 조회. 없으면 404 "Group not found".
// path 정수 검증 실패 시 공유 pathIntErr(notice.go)로 FastAPI 동형 422를 응답한다.
func (h *GroupHandler) Get(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	res, err := h.svc.GetGroup(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Public은 GET /api/v1/groups/:group_id/public. ⚠️ Python 동작 그대로 이식:
// 없으면 404 "그룹을 찾을 수 없습니다.", 숨김이면 404 "존재하지 않는 그룹입니다.",
// 활성이면 sgt_content 미매핑 AttributeError로 500(plain text).
func (h *GroupHandler) Public(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	found, shown, err := h.svc.GroupShow(id)
	if err != nil {
		plainServerError(c) // Python try/except 없음 → 미처리 500
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "그룹을 찾을 수 없습니다."})
		return
	}
	if !shown {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "존재하지 않는 그룹입니다."})
		return
	}
	plainServerError(c) // 활성 그룹 → sgt_content AttributeError → 500
}

// List는 GET /api/v1/groups/ — skip(default 0)/limit(default 10000)/show_hidden(default false).
// Python get_groups는 skip/limit에 ge/le 제약이 없으므로 범위 검증도 하지 않는다.
func (h *GroupHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 10000, false, 0, false, 0)
	showHidden := parseBoolQuery(c, &errs, "show_hidden", false)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.ListGroups(skip, limit, showHidden)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/groups/member/:member_id — 멤버가 속한 그룹 목록.
func (h *GroupHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, err := h.svc.MemberGroups(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// ByCode는 GET /api/v1/groups/code/:code — 코드로 단건 조회. 없으면 404 "Group not found".
func (h *GroupHandler) ByCode(c *gin.Context) {
	code := c.Param("code")
	res, err := h.svc.GroupByCode(code)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CurrentUserSummary는 GET /api/v1/groups/current-user/summary (Python get_current_user_group_summary).
// get_required_user_id: 미인증 시 401 detail "인증이 필요합니다."(마침표 포함). 무파라미터.
func (h *GroupHandler) CurrentUserSummary(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	res, err := h.svc.CurrentUserGroupSummary(uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CurrentUser는 GET /api/v1/groups/current-user (Python get_current_user_groups).
// get_required_user_id: 미인증 시 401 "인증이 필요합니다."(마침표). List[dict] 반환.
func (h *GroupHandler) CurrentUser(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	res, err := h.svc.CurrentUserGroups(uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Stats는 GET /api/v1/groups/:group_id/stats (Python get_group_stats, groups.py:587 활성 라우트). 무인증.
// Python은 핸들러 전체가 try로 감싸였으나 `except HTTPException: raise` 가드가 있어(groups.py:720)
// 그룹 미발견 시 raise HTTPException(404, "Group not found")가 그대로 404로 재전파된다(500 재포장 아님).
// DB 등 일반 예외만 `except Exception`이 잡아 500 detail "그룹 통계 조회 중 오류가 발생했습니다: <str(e)>".
// 7일 창은 datetime.now() 기준이라 시각 의존(비결정적).
func (h *GroupHandler) Stats(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	// 그룹 존재 확인(sgt_show 무관 단건). 미발견 → 404 "Group not found"(except HTTPException:raise).
	grp, err := h.svc.GetGroup(id)
	if err != nil {
		// DB 오류 → except Exception → 500(Python 메시지 형식: 접두 "그룹 통계 조회 중...").
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 통계 조회 중 오류가 발생했습니다: Internal Server Error"})
		return
	}
	if grp == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	end := time.Now()
	start := end.Add(-7 * 24 * time.Hour)
	res, err := h.svc.GroupStats(id, grp.SgtTitle, start, end)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 통계 조회 중 오류가 발생했습니다: Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
