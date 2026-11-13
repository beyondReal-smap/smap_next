package config

import "testing"

func validBase() *Config {
	return &Config{
		RouteAuthModeRaw:                "warn",
		RouteAuthStatusCacheTTLSeconds:  30,
		RouteAuthSummaryIntervalSeconds: 60,
		HwgiMaxUploadBytes:              10 << 20,
	}
}

func TestValidateRouteAuth(t *testing.T) {
	if err := validBase().validateRouteAuth(); err != nil {
		t.Fatalf("기본 설정은 통과해야 함: %v", err)
	}
	cases := map[string]func(*Config){
		"잘못된 모드":      func(c *Config) { c.RouteAuthModeRaw = "enforced" },
		"빈 모드":        func(c *Config) { c.RouteAuthModeRaw = "" },
		"음수 캐시 TTL":   func(c *Config) { c.RouteAuthStatusCacheTTLSeconds = -1 },
		"과도한 캐시 TTL":  func(c *Config) { c.RouteAuthStatusCacheTTLSeconds = 301 },
		"너무 짧은 요약 주기": func(c *Config) { c.RouteAuthSummaryIntervalSeconds = 1 },
		"0 업로드 한도":    func(c *Config) { c.HwgiMaxUploadBytes = 0 },
	}
	for name, mut := range cases {
		c := validBase()
		mut(c)
		if err := c.validateRouteAuth(); err == nil {
			t.Errorf("%s: 에러여야 함", name)
		}
	}
	for _, m := range []string{"off", "warn", "enforce"} {
		c := validBase()
		c.RouteAuthModeRaw = m
		if mode, err := c.RouteAuthMode(); err != nil || string(mode) != m {
			t.Errorf("%s 모드 파싱 실패: %v %v", m, mode, err)
		}
	}
}

// Load는 ROUTE_AUTH_MODE 기본값을 warn으로 하고, 잘못된 값은 시작 시 에러로 막는다.
func TestLoadRouteAuthMode(t *testing.T) {
	t.Setenv("MYSQL_USER", "u")
	t.Setenv("MYSQL_PASSWORD", "p")
	t.Setenv("JWT_SECRET_KEY", "test-secret")

	c, err := Load("")
	if err != nil {
		t.Fatalf("기본 Load 실패: %v", err)
	}
	if mode, _ := c.RouteAuthMode(); mode != "warn" {
		t.Errorf("기본 모드는 warn이어야 함: %q", mode)
	}
	if c.RouteAuthStatusCacheTTLSeconds != 30 || c.RouteAuthSummaryIntervalSeconds != 60 {
		t.Errorf("기본 TTL/요약 주기가 30/60이어야 함: %d/%d", c.RouteAuthStatusCacheTTLSeconds, c.RouteAuthSummaryIntervalSeconds)
	}

	t.Setenv("ROUTE_AUTH_MODE", "enforced") // 오타
	if _, err := Load(""); err == nil {
		t.Error("잘못된 ROUTE_AUTH_MODE는 Load 에러여야 함")
	}
	t.Setenv("ROUTE_AUTH_MODE", "")
	if _, err := Load(""); err == nil {
		t.Error("빈 ROUTE_AUTH_MODE는 Load 에러여야 함(기본값으로 숨기지 않음)")
	}
	t.Setenv("ROUTE_AUTH_MODE", "enforce")
	if c, err := Load(""); err != nil || func() string { m, _ := c.RouteAuthMode(); return string(m) }() != "enforce" {
		t.Errorf("enforce Load 실패: %v", err)
	}
}
