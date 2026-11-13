package auth

import (
	"fmt"
	"strings"
)

// RouteMode는 ROUTE_AUTH_MODE 설정값이다(일반 사용자 인증 미들웨어의 강도).
type RouteMode string

const (
	// RouteModeOff: 미들웨어가 아무 것도 하지 않는다(기존 동작).
	RouteModeOff RouteMode = "off"
	// RouteModeWarn: 토큰이 없거나 무효여도 통과시키되 계측한다. 유효 토큰은 회원 상태를 확인한다.
	RouteModeWarn RouteMode = "warn"
	// RouteModeEnforce: 토큰이 없거나 무효면 401.
	RouteModeEnforce RouteMode = "enforce"
)

// ParseRouteMode는 설정 문자열을 RouteMode로 변환한다. 알 수 없는 값은 기본값으로 바꾸지 않고
// 에러를 돌려준다(시작 시 명확히 실패시키기 위함). 앞뒤 공백과 대소문자는 허용한다.
func ParseRouteMode(raw string) (RouteMode, error) {
	switch m := RouteMode(strings.ToLower(strings.TrimSpace(raw))); m {
	case RouteModeOff, RouteModeWarn, RouteModeEnforce:
		return m, nil
	default:
		return "", fmt.Errorf("ROUTE_AUTH_MODE 값이 올바르지 않습니다: %q (허용: off, warn, enforce)", raw)
	}
}
