package auth

import (
	"fmt"
	"strings"
)

// LocationAuthMode는 LOCATION_AUTH_MODE 설정값이다. 위치 라우트의 무토큰 요청 처리를 따로 조일 수 있게 한다.
type LocationAuthMode string

const (
	// LocationAuthInherit: ROUTE_AUTH_MODE를 따른다.
	LocationAuthInherit LocationAuthMode = "inherit"
	// LocationAuthWarn: ROUTE_AUTH_MODE와 무관하게 무토큰 통과 + 계측.
	LocationAuthWarn LocationAuthMode = "warn"
	// LocationAuthEnforce: ROUTE_AUTH_MODE와 무관하게 무토큰 401.
	LocationAuthEnforce LocationAuthMode = "enforce"
)

// ParseLocationAuthMode는 설정 문자열을 변환한다. 잘못된 값(빈 문자열 포함)은 에러다(기본값으로 숨기지 않음).
func ParseLocationAuthMode(raw string) (LocationAuthMode, error) {
	switch m := LocationAuthMode(strings.ToLower(strings.TrimSpace(raw))); m {
	case LocationAuthInherit, LocationAuthWarn, LocationAuthEnforce:
		return m, nil
	default:
		return "", fmt.Errorf("LOCATION_AUTH_MODE 값이 올바르지 않습니다: %q (허용: inherit, warn, enforce)", raw)
	}
}

// EffectiveRouteMode는 위치 라우트에 적용할 무토큰 처리 모드를 계산한다.
// inherit이면 ROUTE_AUTH_MODE를 따르되, 위치 라우트는 "토큰이 있으면 항상 소유권 검사"를 해야 하므로
// ROUTE_AUTH_MODE=off는 warn으로 올려 쓴다(토큰 신원 확인은 하되 무토큰은 통과).
func (m LocationAuthMode) EffectiveRouteMode(route RouteMode) RouteMode {
	switch m {
	case LocationAuthWarn:
		return RouteModeWarn
	case LocationAuthEnforce:
		return RouteModeEnforce
	}
	if route == RouteModeOff {
		return RouteModeWarn
	}
	return route
}
