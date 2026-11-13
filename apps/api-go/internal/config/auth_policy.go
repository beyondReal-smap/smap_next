package config

import "fmt"

// validateAuthPolicy는 가입·로그인 정책 설정을 시작 시 검증한다(잘못된 값은 기본값으로 대체하지 않고 실패).
func (c *Config) validateAuthPolicy() error {
	if c.LoginFailLimitPerAccount < 1 || c.LoginFailLimitPerAccount > 1000 {
		return fmt.Errorf("config load: LOGIN_FAIL_LIMIT_PER_ACCOUNT는 1~1000이어야 합니다: %d", c.LoginFailLimitPerAccount)
	}
	if c.LoginFailLimitPerIP < 1 || c.LoginFailLimitPerIP > 100000 {
		return fmt.Errorf("config load: LOGIN_FAIL_LIMIT_PER_IP는 1~100000이어야 합니다: %d", c.LoginFailLimitPerIP)
	}
	if c.LoginFailWindowSeconds < 60 || c.LoginFailWindowSeconds > 86400 {
		return fmt.Errorf("config load: LOGIN_FAIL_WINDOW_SECONDS는 60~86400이어야 합니다: %d", c.LoginFailWindowSeconds)
	}
	return nil
}
