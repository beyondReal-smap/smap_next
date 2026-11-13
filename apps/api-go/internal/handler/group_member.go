package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupMemberHandler struct {
	svc *service.GroupMemberService
}

func NewGroupMember(svc *service.GroupMemberService) *GroupMemberHandler {
	return &GroupMemberHandler{svc: svc}
}

// Member는 GET /api/v1/group-members/member/:group_id — 그룹 멤버+최신위치.
// Python except는 500 {"detail":"Internal server error: <e>"}로 응답한다.
func (h *GroupMemberHandler) Member(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	res, err := h.svc.GroupMembers(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "Internal server error: " + err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
