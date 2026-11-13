package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 위치 계측 종류(RouteAuth 요약 로그의 kind). 좌표·회원 번호·토큰은 담지 않는다.
const (
	kindLocationWriteNoToken = "location_write_no_token" // 위치 업로드가 유효 토큰 없이 도착
	kindLocationTokenNeeded  = "location_token_required" // 앱이 쓰지 않는 쓰기 경로에 무토큰 도착(항상 401)
	actionLocAllowed         = "allowed"
	actionLocRejected        = "rejected"
)

// LocationEvents는 계측 카운터 기록기다(구현: middleware.RouteAuth).
type LocationEvents interface {
	RecordEvent(c *gin.Context, kind, action string)
}

// LocationGuard는 위치 라우트 핸들러가 공유하는 인가 진입점이다. 판정 자체는 service.LocationAuthz에 있고,
// 여기서는 요청 신원(미들웨어가 넣은 uid) 추출과 403/401 응답 형식만 맡는다.
// 모든 메서드는 "계속 진행해도 되는가"를 bool로 돌려주며, false면 응답을 이미 썼다.
type LocationGuard struct {
	authz             *service.LocationAuthz
	events            LocationEvents
	writeRequireToken bool
}

func NewLocationGuard(authz *service.LocationAuthz, events LocationEvents, writeRequireToken bool) *LocationGuard {
	return &LocationGuard{authz: authz, events: events, writeRequireToken: writeRequireToken}
}

// Viewer는 미들웨어가 검증해 둔 요청자를 돌려준다.
func (g *LocationGuard) Viewer(c *gin.Context) service.Viewer {
	uid, ok := middleware.UserID(c)
	return service.Viewer{MtIdx: uid, Authenticated: ok}
}

// ready는 가드가 배선되지 않았을 때 요청을 통과시키지 않는다(인가 누락을 조용히 허용하지 않는다).
func (g *LocationGuard) ready(c *gin.Context) bool {
	if g == nil || g.authz == nil {
		slog.Error("location guard not configured", slog.String("route", c.FullPath()))
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return false
	}
	return true
}

func (g *LocationGuard) result(c *gin.Context, err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, service.ErrForbidden) {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다."})
		return false
	}
	slog.Error("location authz failed", slog.String("route", c.FullPath()), slog.String("err", err.Error()))
	writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
	return false
}

// ViewMember: 본인 또는 같은 그룹 현재 멤버의 데이터만 본다.
func (g *LocationGuard) ViewMember(c *gin.Context, target int) bool {
	return g.ready(c) && g.result(c, g.authz.CanViewMember(c.Request.Context(), g.Viewer(c), target))
}

// ViewGroup: 그룹의 현재 멤버만 그룹 단위 데이터를 본다.
func (g *LocationGuard) ViewGroup(c *gin.Context, sgtIdx int) bool {
	return g.ready(c) && g.result(c, g.authz.CanViewGroup(c.Request.Context(), g.Viewer(c), sgtIdx))
}

// ViewGroupDetail: sgdt_idx 행 회원의 데이터를 볼 수 있는지.
func (g *LocationGuard) ViewGroupDetail(c *gin.Context, sgdtIdx int) bool {
	return g.ready(c) && g.result(c, g.authz.CanViewGroupDetail(c.Request.Context(), g.Viewer(c), sgdtIdx))
}

// Self: 본인 명의로만 허용.
func (g *LocationGuard) Self(c *gin.Context, target int) bool {
	return g.ready(c) && g.result(c, g.authz.CanSelf(g.Viewer(c), target))
}

// ManagePlace: 장소 소유자(owner)에 대한 생성·수정·삭제·알림 변경 권한.
func (g *LocationGuard) ManagePlace(c *gin.Context, owner int) bool {
	return g.ready(c) && g.result(c, g.authz.CanManagePlace(c.Request.Context(), g.Viewer(c), owner))
}

// NoBulkDump: 전체 회원 덤프 라우트는 토큰이 있는 요청에는 열지 않는다(앱이 쓰지 않는다).
func (g *LocationGuard) NoBulkDump(c *gin.Context) bool {
	if !g.ready(c) {
		return false
	}
	if g.Viewer(c).Authenticated {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다."})
		return false
	}
	return true
}

// FilterGroupMembers: 토큰이 있으면 ids를 그룹 현재 멤버로 좁힌다. 없으면(warn 통과) 그대로.
func (g *LocationGuard) FilterGroupMembers(c *gin.Context, sgtIdx int, ids []int) ([]int, bool) {
	if !g.ready(c) {
		return nil, false
	}
	if !g.Viewer(c).Authenticated {
		return ids, true
	}
	out, err := g.authz.FilterGroupMembers(c.Request.Context(), sgtIdx, ids)
	if !g.result(c, err) {
		return nil, false
	}
	return out, true
}

func (g *LocationGuard) unauthorized(c *gin.Context) {
	c.Header("WWW-Authenticate", "Bearer")
	writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
}

// RequireToken: 앱이 호출하지 않는 쓰기 경로(위치 로그 수정·삭제, 회원 위치 덮어쓰기)는 유효 토큰이 없으면
// LOCATION_AUTH_MODE와 무관하게 401. (warn 전환기에도 무토큰으로 남의 기록을 고칠 수 없게 한다.)
func (g *LocationGuard) RequireToken(c *gin.Context) bool {
	if !g.ready(c) {
		return false
	}
	if g.Viewer(c).Authenticated {
		return true
	}
	if g.events != nil {
		g.events.RecordEvent(c, kindLocationTokenNeeded, actionLocRejected)
	}
	g.unauthorized(c)
	return false
}

// UploadTokenGate: 위치 업로드. 유효 토큰이 없으면 LOCATION_WRITE_REQUIRE_TOKEN에 따라 401 또는 계측 후 통과.
func (g *LocationGuard) UploadTokenGate(c *gin.Context) bool {
	if !g.ready(c) {
		return false
	}
	if g.Viewer(c).Authenticated {
		return true
	}
	if g.writeRequireToken {
		if g.events != nil {
			g.events.RecordEvent(c, kindLocationWriteNoToken, actionLocRejected)
		}
		g.unauthorized(c)
		return false
	}
	if g.events != nil {
		g.events.RecordEvent(c, kindLocationWriteNoToken, actionLocAllowed)
	}
	return true
}
