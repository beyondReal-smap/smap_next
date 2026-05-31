package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type MemberHandler struct {
	svc *service.MemberService
}

func NewMember(svc *service.MemberService) *MemberHandler {
	return &MemberHandler{svc: svc}
}

// CheckPhone은 GET /api/v1/members/check/phone/:phone — 무인증.
func (h *MemberHandler) CheckPhone(c *gin.Context) {
	res, err := h.svc.CheckPhone(c.Param("phone"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CheckEmail은 GET /api/v1/members/check/email/:email — 무인증.
func (h *MemberHandler) CheckEmail(c *gin.Context) {
	res, err := h.svc.CheckEmail(c.Param("email"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CheckNickname은 GET /api/v1/members/check/nickname/:nickname — 무인증.
func (h *MemberHandler) CheckNickname(c *gin.Context) {
	res, err := h.svc.CheckNickname(c.Param("nickname"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// List는 GET /api/v1/members/ — skip(default 0)/limit(default 10000)/id(optional).
// Python `if id:`처럼 id가 0/None이면 목록, 양수면 단건(없으면 빈 목록). 쿼리 검증 순서: skip→limit→id.
func (h *MemberHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 10000, false, 0, false, 0)
	var idVal *int
	if s, ok := c.GetQuery("id"); ok {
		n, ok2 := coerceInt(s)
		if !ok2 {
			errs = append(errs, qErr("int_parsing", "id", msgIntParse, s))
		} else {
			idVal = &n
		}
	}
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}

	if idVal != nil && *idVal != 0 {
		res, err := h.svc.MemberForList(*idVal)
		if err != nil {
			writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
			return
		}
		writeJSON(c, http.StatusOK, res)
		return
	}

	res, err := h.svc.ListMembers(skip, limit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/members/:member_id — MemberResponse. 없으면 404 "Member not found".
func (h *MemberHandler) Get(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, err := h.svc.GetMemberDetail(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Group은 GET /api/v1/members/group/:group_id — 그룹 멤버 목록(Member+GroupDetail).
func (h *MemberHandler) Group(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	res, err := h.svc.GroupMembers(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
