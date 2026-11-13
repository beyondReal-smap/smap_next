package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 그룹 도메인 계측 종류(RouteAuth 요약 로그의 kind). 회원 번호·초대 코드·토큰은 담지 않는다.
const (
	kindGroupTokenRequired = "group_token_required"    // 앱이 쓰지 않는 그룹 경로에 무토큰 도착(항상 401)
	kindGroupJoinNoCode    = "group_join_without_code" // 초대 코드 없는 가입(REQUIRE_GROUP_INVITE_CODE=false라 통과)
	kindGroupRejected      = "group_forbidden"
	actionGroupRejected    = "rejected"
	actionGroupAllowed     = "allowed"
)

func writeForbiddenDetail(c *gin.Context) {
	writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다."})
}

func writeUnauthorizedDetail(c *gin.Context) {
	c.Header("WWW-Authenticate", "Bearer")
	writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
}

// GroupGuard는 그룹 라우트 핸들러가 공유하는 인가 진입점이다. 판정은 service.GroupAuthz에 있고
// 여기서는 요청 신원 추출과 401/403 응답만 맡는다(LocationGuard와 같은 구조).
// 메서드는 "계속 진행해도 되는가"를 bool로 돌려주며 false면 응답을 이미 썼다.
type GroupGuard struct {
	authz  *service.GroupAuthz
	events LocationEvents // 계측(선택). RouteAuth.RecordEvent 구현
}

func NewGroupGuard(authz *service.GroupAuthz, events LocationEvents) *GroupGuard {
	return &GroupGuard{authz: authz, events: events}
}

// Viewer는 미들웨어가 검증해 둔 요청자를 돌려준다.
func (g *GroupGuard) Viewer(c *gin.Context) service.Viewer {
	uid, ok := middleware.UserID(c)
	return service.Viewer{MtIdx: uid, Authenticated: ok}
}

// ready: 가드가 배선되지 않았으면 요청을 통과시키지 않는다(fail-closed).
func (g *GroupGuard) ready(c *gin.Context) bool {
	if g == nil || g.authz == nil {
		slog.Error("group guard not configured", slog.String("route", c.FullPath()))
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return false
	}
	return true
}

func (g *GroupGuard) result(c *gin.Context, err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, service.ErrForbidden) {
		writeForbiddenDetail(c)
		return false
	}
	slog.Error("group authz failed", slog.String("route", c.FullPath()), slog.String("err", err.Error()))
	writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
	return false
}

// RecordJoinWithoutCode는 코드 없는 가입이 통과했음을 계측한다(구버전 앱 비중 확인용).
func (g *GroupGuard) RecordJoinWithoutCode(c *gin.Context) {
	if g != nil && g.events != nil {
		g.events.RecordEvent(c, kindGroupJoinNoCode, actionGroupAllowed)
	}
}

// ViewGroup: 그룹의 현재 멤버만.
func (g *GroupGuard) ViewGroup(c *gin.Context, sgtIdx int) bool {
	return g.ready(c) && g.result(c, g.authz.CanViewGroup(c.Request.Context(), g.Viewer(c), sgtIdx))
}

// ManageGroup: 그룹장만.
func (g *GroupGuard) ManageGroup(c *gin.Context, sgtIdx int) bool {
	return g.ready(c) && g.result(c, g.authz.CanManageGroup(c.Request.Context(), g.Viewer(c), sgtIdx))
}

// Self: 본인만.
func (g *GroupGuard) Self(c *gin.Context, target int) bool {
	return g.ready(c) && g.result(c, g.authz.CanSelf(g.Viewer(c), target))
}

// Removal: 멤버 제거 요청의 종류(자진 탈퇴/강퇴)를 판정한다. 타인 제거는 그룹장만.
func (g *GroupGuard) Removal(c *gin.Context, sgtIdx, target int) (service.RemovalKind, bool) {
	if !g.ready(c) {
		return service.RemovalKick, false
	}
	kind, err := g.authz.AuthorizeRemoval(c.Request.Context(), g.Viewer(c), sgtIdx, target)
	return kind, g.result(c, err)
}

// RequireToken: 앱이 호출하지 않는 경로는 유효 토큰이 없으면 ROUTE_AUTH_MODE와 무관하게 401.
func (g *GroupGuard) RequireToken(c *gin.Context) bool {
	if g == nil {
		slog.Error("group guard not configured", slog.String("route", c.FullPath()))
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return false
	}
	if g.Viewer(c).Authenticated {
		return true
	}
	if g.events != nil {
		g.events.RecordEvent(c, kindGroupTokenRequired, actionGroupRejected)
	}
	writeUnauthorizedDetail(c)
	return false
}
