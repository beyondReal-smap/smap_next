package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupDetailHandler struct {
	svc *service.GroupDetailService
}

func NewGroupDetail(svc *service.GroupDetailService) *GroupDetailHandler {
	return &GroupDetailHandler{svc: svc}
}

// List는 GET /api/v1/group-details/ — skip(default 0)/limit(default 100), ge·le 제약 없음.
func (h *GroupDetailHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.ListGroupDetails(skip, limit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/group-details/:group_detail_id. 없으면 404 "GroupDetail not found".
func (h *GroupDetailHandler) Get(c *gin.Context) {
	idStr := c.Param("group_detail_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_detail_id", idStr)
		return
	}
	res, err := h.svc.GetGroupDetail(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "GroupDetail not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/group-details/member/:member_id — 멤버의 그룹 상세(수동 dict 목록).
func (h *GroupDetailHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, err := h.svc.MemberGroupDetails(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Group은 GET /api/v1/group-details/group/:group_id — 그룹의 멤버 상세(GroupDetailResponse 목록).
func (h *GroupDetailHandler) Group(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	res, err := h.svc.GroupMemberDetails(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
