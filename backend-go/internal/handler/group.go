package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupHandler struct {
	svc *service.GroupService
}

func NewGroup(svc *service.GroupService) *GroupHandler {
	return &GroupHandler{svc: svc}
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
