package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/middleware"
)

// kindSelfTokenRequired: 앱이 쓰지 않는 본인 전용 경로(푸시 기록·날씨 등)에 무토큰이 도착해 401로 막은 횟수.
const kindSelfTokenRequired = "self_token_required"

// SelfGuard는 "본인 것만" 규칙(푸시 기록·푸시 FCM·날씨)의 단일 구현이다. DB 조회가 필요 없는
// 신원 비교뿐이라 서비스 계층 없이 핸들러 가드로 둔다(그룹 도메인은 GroupGuard).
// 토큰이 있으면 모드와 무관하게 항상 비교하고, 토큰이 없을 때만 라우트가 정한 규칙을 따른다:
// Self는 미들웨어(ROUTE_AUTH_MODE)에 맡기고, SelfStrict·RequireToken은 모드와 무관하게 401.
type SelfGuard struct {
	events LocationEvents
}

func NewSelfGuard(events LocationEvents) *SelfGuard { return &SelfGuard{events: events} }

// uid는 미들웨어가 검증해 둔 요청자다.
func (g *SelfGuard) uid(c *gin.Context) (int, bool) { return middleware.UserID(c) }

// Self: 토큰이 있으면 target과 같아야 한다(다르면 403). 토큰이 없으면 통과(미들웨어 모드가 이미 결정).
func (g *SelfGuard) Self(c *gin.Context, target int) bool {
	uid, ok := g.uid(c)
	if !ok || uid == target {
		return true
	}
	writeForbiddenDetail(c)
	return false
}

// RequireToken: 유효 토큰이 없으면 모드와 무관하게 401(앱 미사용 경로).
func (g *SelfGuard) RequireToken(c *gin.Context) (int, bool) {
	uid, ok := g.uid(c)
	if ok {
		return uid, true
	}
	if g != nil && g.events != nil {
		g.events.RecordEvent(c, kindSelfTokenRequired, actionGroupRejected)
	}
	writeUnauthorizedDetail(c)
	return 0, false
}

// SelfStrict: 앱 미사용 경로의 본인 전용 — 토큰 필수(401) + 본인(403).
func (g *SelfGuard) SelfStrict(c *gin.Context, target int) bool {
	uid, ok := g.RequireToken(c)
	if !ok {
		return false
	}
	if uid != target {
		writeForbiddenDetail(c)
		return false
	}
	return true
}

// Viewer는 토큰이 있을 때만 요청자를 돌려준다(소유자 비교용).
func (g *SelfGuard) Viewer(c *gin.Context) (int, bool) { return g.uid(c) }

// Owns: 토큰이 있으면 owner와 같아야 한다(다르면 403). 토큰이 없으면 통과.
func (g *SelfGuard) Owns(c *gin.Context, owner *int) bool {
	uid, ok := g.uid(c)
	if !ok {
		return true
	}
	if owner == nil || *owner != uid {
		writeForbiddenDetail(c)
		return false
	}
	return true
}
