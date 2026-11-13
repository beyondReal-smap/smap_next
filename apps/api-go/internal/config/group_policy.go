package config

import "fmt"

// validateGroupPolicy는 그룹 초대 코드 호출 한도 설정을 검증한다. 0 이하 값은 한도를 사실상 끄는 실수라
// 기본값으로 바꾸지 않고 시작을 막는다.
func (c *Config) validateGroupPolicy() error {
	if c.GroupCodeLimitPerMember < 1 || c.GroupCodeLimitPerIP < 1 || c.GroupCodeWindowSeconds < 1 {
		return fmt.Errorf("config load: GROUP_CODE_LIMIT_PER_MEMBER, GROUP_CODE_LIMIT_PER_IP, GROUP_CODE_WINDOW_SECONDS는 1 이상이어야 합니다")
	}
	return nil
}
