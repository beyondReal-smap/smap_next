package config

import "fmt"

// validateAbuse는 남용 방지(G8) 설정을 시작 시 검증한다(잘못된 값은 기본값으로 대체하지 않고 실패).
func (c *Config) validateAbuse() error {
	if c.SMSSendLimitPerPhone < 1 || c.SMSSendLimitPerPhone > 1000 {
		return fmt.Errorf("config load: SMS_SEND_LIMIT_PER_PHONE는 1~1000이어야 합니다: %d", c.SMSSendLimitPerPhone)
	}
	if c.SMSSendLimitPerIP < 1 || c.SMSSendLimitPerIP > 100000 {
		return fmt.Errorf("config load: SMS_SEND_LIMIT_PER_IP는 1~100000이어야 합니다: %d", c.SMSSendLimitPerIP)
	}
	if c.SMSSendWindowSeconds < 60 || c.SMSSendWindowSeconds > 86400 {
		return fmt.Errorf("config load: SMS_SEND_WINDOW_SECONDS는 60~86400이어야 합니다: %d", c.SMSSendWindowSeconds)
	}
	if c.SMSVerifyMaxAttempts < 1 || c.SMSVerifyMaxAttempts > 100 {
		return fmt.Errorf("config load: SMS_VERIFY_MAX_ATTEMPTS는 1~100이어야 합니다: %d", c.SMSVerifyMaxAttempts)
	}
	if c.MemberCheckLimitPerIP < 1 || c.MemberCheckLimitPerIP > 100000 {
		return fmt.Errorf("config load: MEMBER_CHECK_LIMIT_PER_IP는 1~100000이어야 합니다: %d", c.MemberCheckLimitPerIP)
	}
	if c.MemberCheckWindowSeconds < 1 || c.MemberCheckWindowSeconds > 86400 {
		return fmt.Errorf("config load: MEMBER_CHECK_WINDOW_SECONDS는 1~86400이어야 합니다: %d", c.MemberCheckWindowSeconds)
	}
	return nil
}
