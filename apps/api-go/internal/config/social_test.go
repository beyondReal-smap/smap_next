package config

import "testing"

func setBaseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("MYSQL_USER", "u")
	t.Setenv("MYSQL_PASSWORD", "p")
	t.Setenv("JWT_SECRET_KEY", "test-secret")
}

// 기본값은 when_present, 허용 목록은 비어 있고, 잘못된 모드·Kakao 앱 ID는 시작 시 에러다.
func TestLoadSocialVerification(t *testing.T) {
	setBaseEnv(t)
	c, err := Load("")
	if err != nil {
		t.Fatalf("기본 Load 실패: %v", err)
	}
	if mode, _ := c.SocialTokenVerification(); mode != "when_present" {
		t.Errorf("기본 모드는 when_present: %q", mode)
	}
	if len(c.GoogleAllowedClientIDs()) != 0 || len(c.AppleAllowedBundleIDs()) != 0 || c.KakaoAllowedAppID != "" {
		t.Error("허용 목록 기본값은 비어 있어야 함")
	}

	t.Setenv("SOCIAL_TOKEN_VERIFICATION", "requierd") // 오타
	if _, err := Load(""); err == nil {
		t.Error("잘못된 SOCIAL_TOKEN_VERIFICATION은 Load 에러여야 함")
	}
	t.Setenv("SOCIAL_TOKEN_VERIFICATION", "")
	if _, err := Load(""); err == nil {
		t.Error("빈 SOCIAL_TOKEN_VERIFICATION은 Load 에러여야 함(기본값으로 숨기지 않음)")
	}
	t.Setenv("SOCIAL_TOKEN_VERIFICATION", "required")
	t.Setenv("GOOGLE_ALLOWED_CLIENT_IDS", " web.apps.googleusercontent.com , ios.apps.googleusercontent.com ,")
	t.Setenv("APPLE_ALLOWED_BUNDLE_IDS", "com.dmonster.smap")
	t.Setenv("KAKAO_ALLOWED_APP_ID", "123456")
	c, err = Load("")
	if err != nil {
		t.Fatalf("정상 설정 Load 실패: %v", err)
	}
	if got := c.GoogleAllowedClientIDs(); len(got) != 2 || got[0] != "web.apps.googleusercontent.com" || got[1] != "ios.apps.googleusercontent.com" {
		t.Errorf("Google 허용 목록 파싱: %v", got)
	}
	if got := c.AppleAllowedBundleIDs(); len(got) != 1 || got[0] != "com.dmonster.smap" {
		t.Errorf("Apple 허용 목록 파싱: %v", got)
	}

	t.Setenv("KAKAO_ALLOWED_APP_ID", "12ab")
	if _, err := Load(""); err == nil {
		t.Error("숫자가 아닌 KAKAO_ALLOWED_APP_ID는 Load 에러여야 함")
	}
}
