package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// AppVersionHandler는 Python `/app/version-check` 엔드포인트를 이식한다.
type AppVersionHandler struct {
	svc *service.AppVersionService
}

func NewAppVersion(svc *service.AppVersionService) *AppVersionHandler {
	return &AppVersionHandler{svc: svc}
}

// VersionCheck는 GET /api/v1/app/version-check.
// platform/version은 FastAPI Query(...)로 필수 — 누락 시 422 + FastAPI 동형 detail.
func (h *AppVersionHandler) VersionCheck(c *gin.Context) {
	platform, hasPlatform := c.GetQuery("platform")
	version, hasVersion := c.GetQuery("version")

	// 필수 쿼리 누락 검증. loc 순서는 FastAPI 파라미터 정의 순서(platform → version)를 따른다.
	missing := make([]valErr, 0, 2)
	if !hasPlatform {
		missing = append(missing, valErr{
			Type: "missing", Loc: []string{"query", "platform"},
			Msg: "Field required", Input: nil,
		})
	}
	if !hasVersion {
		missing = append(missing, valErr{
			Type: "missing", Loc: []string{"query", "version"},
			Msg: "Field required", Input: nil,
		})
	}
	if len(missing) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": missing})
		return
	}

	writeJSON(c, http.StatusOK, h.svc.VersionCheck(platform, version))
}
