package auth

import (
	"fmt"
	"strings"
)

// SocialMode는 SOCIAL_TOKEN_VERIFICATION 설정값이다(소셜 로그인의 공급자 토큰 검증 강도).
type SocialMode string

const (
	// SocialModeOff: 검증하지 않는다(기존 동작). 토큰이 와도 무시한다.
	SocialModeOff SocialMode = "off"
	// SocialModeWhenPresent: 토큰이 있으면 검증하고 실패 시 거부, 없으면 기존 동작 + 경고 계측.
	SocialModeWhenPresent SocialMode = "when_present"
	// SocialModeRequired: 토큰이 없거나 무효면 거부.
	SocialModeRequired SocialMode = "required"
)

// ParseSocialMode는 설정 문자열을 SocialMode로 변환한다. 알 수 없는 값은 기본값으로 바꾸지 않고
// 에러를 돌려준다(시작 시 명확히 실패). 앞뒤 공백과 대소문자는 허용한다.
func ParseSocialMode(raw string) (SocialMode, error) {
	switch m := SocialMode(strings.ToLower(strings.TrimSpace(raw))); m {
	case SocialModeOff, SocialModeWhenPresent, SocialModeRequired:
		return m, nil
	default:
		return "", fmt.Errorf("SOCIAL_TOKEN_VERIFICATION 값이 올바르지 않습니다: %q (허용: off, when_present, required)", raw)
	}
}
