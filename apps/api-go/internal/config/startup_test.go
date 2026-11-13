package config

import (
	"strings"
	"testing"
)

// healthyCfg는 경고가 하나도 나지 않는 운영 설정이다.
func healthyCfg() *Config {
	return &Config{
		RedisURL: "redis://x", TrustedClientIPHeader: "CF-Connecting-IP",
		RouteAuthModeRaw: "enforce", LocationAuthModeRaw: "inherit", LocationWriteRequireToken: true,
		SocialTokenVerificationRaw: "when_present",
		GoogleAllowedClientIDsRaw:  "g", AppleAllowedBundleIDsRaw: "a", KakaoAllowedAppID: "123",
		AllowLegacyPhoneRegister: false, SocialRegisterRequireToken: true,
		EmailSender: "s", EmailPassword: "p",
		AligoUserID: "u", AligoKey: "k", AligoSender: "s",
		RequireGroupInviteCode: true,
	}
}

func codes(ws []StartupWarning) []string {
	out := make([]string, len(ws))
	for i, w := range ws {
		out[i] = w.Code
	}
	return out
}

func has(ws []StartupWarning, code string) bool {
	for _, w := range ws {
		if w.Code == code {
			return true
		}
	}
	return false
}

func TestStartupWarningsHealthyIsEmpty(t *testing.T) {
	if ws := StartupWarnings(healthyCfg(), RuntimeFacts{RedisConnected: true}); len(ws) != 0 {
		t.Fatalf("정상 설정에 경고가 나옴: %v", codes(ws))
	}
}

func TestStartupWarningsDefaultsLikeProduction(t *testing.T) {
	// 환경변수 없이 기본값만 쓴 설정: 흩어져 있던 경고들이 모두 나와야 한다.
	t.Setenv("MYSQL_USER", "u")
	t.Setenv("MYSQL_PASSWORD", "p")
	t.Setenv("JWT_SECRET_KEY", "s")
	t.Chdir(t.TempDir())
	cfg, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	ws := StartupWarnings(cfg, RuntimeFacts{RedisConnected: true})
	for _, want := range []string{"trusted_client_ip_header_empty", "route_auth_warn", "location_auth_unenforced", "location_write_token_optional",
		"social_allowlist_empty", "legacy_phone_register_open", "social_register_without_token", "mail_not_configured", "sms_not_configured"} {
		if !has(ws, want) {
			t.Errorf("기본 설정에서 %s 경고 누락: %v", want, codes(ws))
		}
	}
	if !has(ws, "group_invite_code_optional") {
		t.Errorf("기본값(REQUIRE_GROUP_INVITE_CODE=false)에서 초대 코드 경고 누락: %v", codes(ws))
	}
	if has(ws, "redis_not_configured") || has(ws, "debug_enabled") {
		t.Errorf("나오면 안 되는 경고: %v", codes(ws))
	}
}

func TestStartupWarningsRedis(t *testing.T) {
	c := healthyCfg()
	c.RedisURL = ""
	ws := StartupWarnings(c, RuntimeFacts{})
	if !has(ws, "redis_not_configured") || has(ws, "redis_connect_failed") {
		t.Fatalf("REDIS_URL 미설정: %v", codes(ws))
	}
	c.RedisURL = "redis://x"
	ws = StartupWarnings(c, RuntimeFacts{})
	if !has(ws, "redis_connect_failed") || has(ws, "redis_not_configured") {
		t.Fatalf("연결 실패: %v", codes(ws))
	}
	for _, w := range ws {
		if w.Code == "redis_connect_failed" && !strings.Contains(w.Message, "503") {
			t.Fatalf("결과(503)가 문구에 없음: %s", w.Message)
		}
	}
}

func TestStartupWarningsAuthModes(t *testing.T) {
	cases := []struct {
		route, loc string
		want       []string
		not        []string
	}{
		{"enforce", "inherit", nil, []string{"route_auth_warn", "route_auth_off", "location_auth_unenforced"}},
		{"warn", "inherit", []string{"route_auth_warn", "location_auth_unenforced"}, nil},
		{"enforce", "warn", []string{"location_auth_unenforced"}, []string{"route_auth_warn"}},
		{"warn", "enforce", []string{"route_auth_warn"}, []string{"location_auth_unenforced"}},
		{"off", "inherit", []string{"route_auth_off", "location_auth_unenforced"}, []string{"route_auth_warn"}},
	}
	for _, tc := range cases {
		c := healthyCfg()
		c.RouteAuthModeRaw, c.LocationAuthModeRaw = tc.route, tc.loc
		ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true})
		for _, w := range tc.want {
			if !has(ws, w) {
				t.Errorf("route=%s loc=%s: %s 누락 %v", tc.route, tc.loc, w, codes(ws))
			}
		}
		for _, w := range tc.not {
			if has(ws, w) {
				t.Errorf("route=%s loc=%s: %s 불필요 %v", tc.route, tc.loc, w, codes(ws))
			}
		}
	}
}

func TestStartupWarningsSocialModes(t *testing.T) {
	// when_present + 목록 비어 있음 → 토큰 보내는 로그인 503
	c := healthyCfg()
	c.GoogleAllowedClientIDsRaw, c.AppleAllowedBundleIDsRaw, c.KakaoAllowedAppID = "", "", ""
	ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true})
	n := 0
	for _, w := range ws {
		if w.Code == "social_allowlist_empty" {
			n++
			if !strings.Contains(w.Message, "when_present") || !strings.Contains(w.Message, "503") {
				t.Fatalf("모드별 결과 문구 오류: %s", w.Message)
			}
		}
	}
	if n != 3 {
		t.Fatalf("공급자별 3건이어야 함: %d", n)
	}
	// 일부만 비어 있음
	c = healthyCfg()
	c.AppleAllowedBundleIDsRaw = " , "
	ws = StartupWarnings(c, RuntimeFacts{RedisConnected: true})
	if len(ws) != 1 || !strings.Contains(ws[0].Message, "Apple") && !strings.Contains(ws[0].Message, "apple") {
		t.Fatalf("Apple만 경고여야 함: %+v", ws)
	}
	// required
	c = healthyCfg()
	c.SocialTokenVerificationRaw, c.KakaoAllowedAppID = "required", ""
	ws = StartupWarnings(c, RuntimeFacts{RedisConnected: true})
	if len(ws) != 1 || !strings.Contains(ws[0].Message, "required") || !strings.Contains(ws[0].Message, "전부 503") {
		t.Fatalf("required 문구 오류: %+v", ws)
	}
	// off: 목록 점검 대신 검증 꺼짐 경고
	c = healthyCfg()
	c.SocialTokenVerificationRaw, c.GoogleAllowedClientIDsRaw = "off", ""
	ws = StartupWarnings(c, RuntimeFacts{RedisConnected: true})
	if len(ws) != 1 || ws[0].Code != "social_verification_off" {
		t.Fatalf("off 경고 오류: %v", codes(ws))
	}
}

func TestStartupWarningsInviteCode(t *testing.T) {
	c := healthyCfg()
	if ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true}); has(ws, "group_invite_code_optional") {
		t.Fatalf("true면 경고하지 않아야 함")
	}
	c.RequireGroupInviteCode = false
	ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true})
	if !has(ws, "group_invite_code_optional") {
		t.Fatalf("false면 경고해야 함")
	}
}

func TestStartupWarningsMail(t *testing.T) {
	c := healthyCfg()
	c.EmailSender, c.EmailPassword = "", ""
	if ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true}); !has(ws, "mail_not_configured") {
		t.Fatalf("메일 설정 없음 경고 누락")
	}
	c.NaverworksClientID, c.NaverworksClientSecret, c.NaverworksDomain = "i", "s", "d"
	if ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true}); has(ws, "mail_not_configured") {
		t.Fatalf("네이버웍스가 완전하면 경고하지 않아야 함")
	}
	c.NaverworksDomain = "" // 일부만 있으면 미설정과 같다(발송기와 같은 판정)
	if ws := StartupWarnings(c, RuntimeFacts{RedisConnected: true}); !has(ws, "mail_not_configured") {
		t.Fatalf("네이버웍스 불완전 + Gmail 없음이면 경고해야 함")
	}
}

func TestStartupWarningsDoNotLeakValues(t *testing.T) {
	c := healthyCfg()
	c.Debug, c.AllowLegacyPhoneRegister = true, true
	c.RedisURL = "redis://:SECRETPW@host:6379/0"
	c.TrustedClientIPHeader = ""
	c.GoogleAllowedClientIDsRaw = ""
	c.EmailPassword, c.AligoKey = "", ""
	c.JWTSecretKey = "JWTSECRETVALUE"
	c.KakaoAllowedAppID = "KAKAOID999"
	for _, w := range StartupWarnings(c, RuntimeFacts{}) {
		for _, secret := range []string{"SECRETPW", "JWTSECRETVALUE", "KAKAOID999", "redis://"} {
			if strings.Contains(w.Message, secret) || strings.Contains(w.Code, secret) {
				t.Fatalf("경고에 값이 포함됨(%s): %s", w.Code, w.Message)
			}
		}
	}
}

func TestValidateAbuse(t *testing.T) {
	t.Setenv("MYSQL_USER", "u")
	t.Setenv("MYSQL_PASSWORD", "p")
	t.Setenv("JWT_SECRET_KEY", "s")
	t.Chdir(t.TempDir())
	cfg, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SMSSendLimitPerPhone != 5 || cfg.SMSSendLimitPerIP != 20 || cfg.SMSSendWindowSeconds != 3600 ||
		cfg.SMSVerifyMaxAttempts != 5 || cfg.MemberCheckLimitPerIP != 60 || cfg.MemberCheckWindowSeconds != 60 {
		t.Fatalf("기본값 오류: %+v", cfg)
	}
	for _, kv := range [][2]string{{"SMS_SEND_LIMIT_PER_PHONE", "0"}, {"SMS_SEND_WINDOW_SECONDS", "10"}, {"SMS_VERIFY_MAX_ATTEMPTS", "0"}, {"MEMBER_CHECK_LIMIT_PER_IP", "0"}} {
		t.Setenv(kv[0], kv[1])
		if _, err := Load(""); err == nil {
			t.Fatalf("%s=%s 인데 시작 검증이 통과함", kv[0], kv[1])
		}
		t.Setenv(kv[0], "")
	}
}
