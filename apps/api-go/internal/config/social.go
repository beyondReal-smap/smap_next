package config

import (
	"fmt"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/auth"
)

// SocialTokenVerification은 검증된 SOCIAL_TOKEN_VERIFICATION 모드를 반환한다. Load가 값을 검증한다.
func (c *Config) SocialTokenVerification() (auth.SocialMode, error) {
	return auth.ParseSocialMode(c.SocialTokenVerificationRaw)
}

// GoogleAllowedClientIDs는 GOOGLE_ALLOWED_CLIENT_IDS를 공백 제거한 목록으로 돌려준다.
func (c *Config) GoogleAllowedClientIDs() []string {
	return auth.ParseAllowList(c.GoogleAllowedClientIDsRaw)
}

// AppleAllowedBundleIDs는 APPLE_ALLOWED_BUNDLE_IDS를 공백 제거한 목록으로 돌려준다.
func (c *Config) AppleAllowedBundleIDs() []string {
	return auth.ParseAllowList(c.AppleAllowedBundleIDsRaw)
}

// validateSocial은 소셜 검증 설정을 시작 시 검증한다(잘못된 값은 기본값으로 바꾸지 않고 실패).
func (c *Config) validateSocial() error {
	if _, err := auth.ParseSocialMode(c.SocialTokenVerificationRaw); err != nil {
		return fmt.Errorf("config load: %w", err)
	}
	if err := auth.ValidateKakaoAppID(strings.TrimSpace(c.KakaoAllowedAppID)); err != nil {
		return fmt.Errorf("config load: %w", err)
	}
	return nil
}
