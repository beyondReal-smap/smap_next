package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type LocationHandler struct {
	svc *service.LocationService
	// guard: 내 장소 조회·변경 인가(nil이면 500, fail-closed).
	guard *LocationGuard
}

// SetGuard는 위치 인가 가드를 주입한다.
func (h *LocationHandler) SetGuard(g *LocationGuard) { h.guard = g }

// manageExisting은 기존 장소를 수정·삭제·알림 변경하려는 요청을 인가한다.
// 장소가 없으면 통과시켜 핸들러의 기존 404 흐름을 유지한다. 토큰이 없는 요청은 신원을 알 수 없어 건너뛴다.
func (h *LocationHandler) manageExisting(c *gin.Context, id int) bool {
	if !h.guard.ready(c) {
		return false
	}
	if !h.guard.Viewer(c).Authenticated {
		return true
	}
	owner, found, err := h.svc.LocationOwner(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return false
	}
	if !found {
		return true
	}
	return h.guard.ManagePlace(c, owner)
}

func NewLocation(svc *service.LocationService) *LocationHandler {
	return &LocationHandler{svc: svc}
}

// List는 GET /api/v1/locations/ — skip(0)/limit(100), 필터 없음.
func (h *LocationHandler) List(c *gin.Context) {
	// 전 회원 장소 덤프: 토큰이 있는 요청에는 열지 않는다(앱 미사용).
	if !h.guard.NoBulkDump(c) {
		return
	}
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
	owner := 0
	if res.MtIdx != nil {
		owner = *res.MtIdx
	}
	if !h.guard.ViewMember(c, owner) {
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
	if !h.guard.ViewMember(c, id) {
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
	if !h.guard.ViewGroupDetail(c, id) {
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
