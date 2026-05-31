package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type LocationHandler struct {
	svc *service.LocationService
}

func NewLocation(svc *service.LocationService) *LocationHandler {
	return &LocationHandler{svc: svc}
}

// List는 GET /api/v1/locations/ — skip(0)/limit(100), 필터 없음.
func (h *LocationHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.ListLocations(skip, limit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/locations/:location_id. 없으면 404 "Location not found".
func (h *LocationHandler) Get(c *gin.Context) {
	idStr := c.Param("location_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "location_id", idStr)
		return
	}
	res, err := h.svc.GetLocation(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Location not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/locations/member/:member_id.
func (h *LocationHandler) Member(c *gin.Context) {
	h.byMember(c, "member_id")
}

// OtherMembers는 GET /api/v1/locations/other-members/:member_id (member와 동일 구현).
func (h *LocationHandler) OtherMembers(c *gin.Context) {
	h.byMember(c, "member_id")
}

func (h *LocationHandler) byMember(c *gin.Context, loc string) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, loc, idStr)
		return
	}
	res, err := h.svc.MemberLocations(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// GroupDetail은 GET /api/v1/locations/group-detail/:group_detail_id.
func (h *LocationHandler) GroupDetail(c *gin.Context) {
	idStr := c.Param("group_detail_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_detail_id", idStr)
		return
	}
	res, err := h.svc.GroupDetailLocations(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// MyplaysIn은 GET /api/v1/locations/myplays/in. Python dict(row) 버그로 항상 [].
func (h *LocationHandler) MyplaysIn(c *gin.Context) {
	writeJSON(c, http.StatusOK, h.svc.InMyplays())
}

// MyplaysOut은 GET /api/v1/locations/myplays/out. Python dict(row) 버그로 항상 [].
func (h *LocationHandler) MyplaysOut(c *gin.Context) {
	writeJSON(c, http.StatusOK, h.svc.OutMyplays())
}
