package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type AdminHandler struct {
	svc *service.AdminService
}

func NewAdmin(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

// Stats는 GET /api/v1/admin/stats. 인증은 RequireAdmin 미들웨어가 선처리한다.
// repo 에러 시 Python처럼 200 + success:false + message(str(e))로 응답한다.
func (h *AdminHandler) Stats(c *gin.Context) {
	resp, err := h.svc.GetStats()
	if err != nil {
		writeJSON(c, http.StatusOK, dto.AdminStatsResponse{
			Success: false,
			Message: err.Error(),
			Data:    dto.AdminStatsData{},
		})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Groups는 GET /api/v1/admin/groups — offset(ge=0)/limit(ge=1,le=1000)/show_hidden.
// Python은 예외를 raise하므로 500 Internal Server Error로 응답한다.
func (h *AdminHandler) Groups(c *gin.Context) {
	errs := make([]valErr, 0)
	offset := parseIntQuery(c, &errs, "offset", 0, true, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, true, 1, true, 1000)
	showHidden := parseBoolQuery(c, &errs, "show_hidden", false)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.GetGroups(offset, limit, showHidden)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
