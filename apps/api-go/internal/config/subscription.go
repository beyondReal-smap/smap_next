package config

import (
	"fmt"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

// validateSubscription은 구독 설정을 시작 시 검증한다. 잘못된 값은 기본값으로 바꾸지 않고 시작을 막는다.
func (c *Config) validateSubscription() error {
	if c.SubscriptionFreeMaxPlaces < 0 {
		return fmt.Errorf("config load: SUBSCRIPTION_FREE_MAX_PLACES는 0 이상이어야 합니다: %d", c.SubscriptionFreeMaxPlaces)
	}
	if c.SubscriptionFreeLogDays < 1 || c.SubscriptionPremiumLogDays < c.SubscriptionFreeLogDays || c.SubscriptionPremiumLogDays > 366 {
		return fmt.Errorf("config load: SUBSCRIPTION_FREE_LOG_DAYS는 1 이상, SUBSCRIPTION_PREMIUM_LOG_DAYS는 무료 이상 366 이하여야 합니다: %d, %d",
			c.SubscriptionFreeLogDays, c.SubscriptionPremiumLogDays)
	}
	if c.SubscriptionLapseSyncIntervalSeconds < 0 || (c.SubscriptionLapseSyncIntervalSeconds > 0 && c.SubscriptionLapseSyncIntervalSeconds < 60) {
		return fmt.Errorf("config load: SUBSCRIPTION_LAPSE_SYNC_INTERVAL_SECONDS는 0(끔) 또는 60 이상이어야 합니다: %d", c.SubscriptionLapseSyncIntervalSeconds)
	}
	if strings.TrimSpace(c.SubscriptionAppleMonthProductID) == "" || strings.TrimSpace(c.SubscriptionAppleYearProductID) == "" ||
		strings.TrimSpace(c.SubscriptionGoogleMonthBasePlan) == "" || strings.TrimSpace(c.SubscriptionGoogleYearBasePlan) == "" {
		return fmt.Errorf("config load: SUBSCRIPTION_*_PRODUCT_ID / SUBSCRIPTION_*_BASE_PLAN은 비어 있을 수 없습니다")
	}
	if c.SubscriptionAppleMonthProductID == c.SubscriptionAppleYearProductID || c.SubscriptionGoogleMonthBasePlan == c.SubscriptionGoogleYearBasePlan {
		return fmt.Errorf("config load: 월간/연간 상품 ID(기본 요금제 ID)가 같을 수 없습니다")
	}
	if sec := strings.TrimSpace(c.SubscriptionAccountTokenSecret); sec != "" && len(sec) < 32 {
		return fmt.Errorf("config load: SUBSCRIPTION_ACCOUNT_TOKEN_SECRET은 비우거나 32자 이상이어야 합니다")
	}
	if c.SubscriptionVerifyLimitPerMember < 1 || c.SubscriptionVerifyLimitPerMember > 100000 ||
		c.SubscriptionVerifyLimitPerIP < 1 || c.SubscriptionVerifyLimitPerIP > 1000000 {
		return fmt.Errorf("config load: SUBSCRIPTION_VERIFY_LIMIT_PER_MEMBER(1~100000)/SUBSCRIPTION_VERIFY_LIMIT_PER_IP(1~1000000) 범위 오류: %d, %d",
			c.SubscriptionVerifyLimitPerMember, c.SubscriptionVerifyLimitPerIP)
	}
	if c.SubscriptionVerifyWindowSeconds < 1 || c.SubscriptionVerifyWindowSeconds > 86400 {
		return fmt.Errorf("config load: SUBSCRIPTION_VERIFY_WINDOW_SECONDS는 1~86400이어야 합니다: %d", c.SubscriptionVerifyWindowSeconds)
	}
	if c.SubscriptionNotifyLimitPerIPPerMinute < 1 || c.SubscriptionNotifyLimitPerIPPerMinute > 1000000 {
		return fmt.Errorf("config load: SUBSCRIPTION_NOTIFY_LIMIT_PER_IP_PER_MINUTE는 1~1000000이어야 합니다: %d", c.SubscriptionNotifyLimitPerIPPerMinute)
	}
	return nil
}

// SubscriptionStoreConfig는 스토어 검증 계층(store.New) 설정을 만든다. 월간/연간 매핑 값은 허용 목록에 자동으로 포함된다.
func (c *Config) SubscriptionStoreConfig() store.Config {
	var googleProducts []string
	for _, v := range strings.Split(c.GooglePlayProductIDsRaw, ",") {
		if v = strings.TrimSpace(v); v != "" {
			googleProducts = append(googleProducts, v)
		}
	}
	return store.Config{
		AppleBundleID:                 strings.TrimSpace(c.AppleBundleID),
		AppleRootCAPath:               strings.TrimSpace(c.AppleRootCAPath),
		AppleRootCASHA256:             strings.TrimSpace(c.AppleRootCASHA256),
		AppleProductIDs:               []string{c.SubscriptionAppleMonthProductID, c.SubscriptionAppleYearProductID},
		GooglePackageName:             strings.TrimSpace(c.GooglePlayPackageName),
		GoogleProductIDs:              googleProducts,
		GoogleBasePlanIDs:             []string{c.SubscriptionGoogleMonthBasePlan, c.SubscriptionGoogleYearBasePlan},
		GoogleServiceAccountPath:      strings.TrimSpace(c.GooglePlayServiceAccount),
		GoogleServiceAccountJSON:      strings.TrimSpace(c.GooglePlayServiceAccountInline),
		GoogleRTDNAudience:            strings.TrimSpace(c.GoogleRTDNAudience),
		GoogleRTDNServiceAccountEmail: strings.TrimSpace(c.GoogleRTDNServiceAccount),
		AllowSandbox:                  c.SubscriptionAllowSandbox,
	}
}

// AppleStoreConfigured / GoogleStoreConfigured는 스토어 검증에 필요한 설정이 모두 있는지(값은 보지 않고 유무만)다.
func (c *Config) AppleStoreConfigured() bool {
	return strings.TrimSpace(c.AppleBundleID) != "" && strings.TrimSpace(c.AppleRootCAPath) != ""
}

func (c *Config) GoogleStoreConfigured() bool {
	return strings.TrimSpace(c.GooglePlayPackageName) != "" &&
		(strings.TrimSpace(c.GooglePlayServiceAccount) != "" || strings.TrimSpace(c.GooglePlayServiceAccountInline) != "")
}

// GoogleRTDNConfigured는 Pub/Sub push 발신자 검증 설정(audience, 서비스 계정 이메일)이 모두 있는지다.
func (c *Config) GoogleRTDNConfigured() bool {
	return strings.TrimSpace(c.GoogleRTDNAudience) != "" && strings.TrimSpace(c.GoogleRTDNServiceAccount) != ""
}

// SubscriptionFacts는 설정만으로 알 수 없는 구독 관련 사실이다.
type SubscriptionFacts struct {
	// TableChecked: 시작 시 구독 테이블 존재 확인을 수행했는지. false면 테이블 경고를 내지 않는다.
	TableChecked bool
	// TableMissing: 확인 결과 subscription_transactions 테이블이 없음.
	TableMissing bool
}

// SubscriptionStartupWarnings는 구독 관련 시작 점검 경고다(순수 함수). StartupWarnings와 같은 형식이며 시작을 막지 않는다.
// 설정 값은 담지 않는다(이름과 상태만).
func SubscriptionStartupWarnings(cfg *Config, f SubscriptionFacts) []StartupWarning {
	var out []StartupWarning
	add := func(code, format string, args ...interface{}) {
		out = append(out, StartupWarning{Code: code, Message: fmt.Sprintf(format, args...)})
	}
	if f.TableChecked && f.TableMissing {
		add("subscription_table_missing", "subscription_transactions 테이블 없음 → /subscriptions/* 가 503으로 실패하고 구독 상태 반영·혜택 판정이 동작하지 않음(구독 외 기능은 정상). apps/api-go/migrations의 SQL 적용 필요")
	}
	if !cfg.AppleStoreConfigured() {
		add("subscription_apple_not_configured", "APPLE_BUNDLE_ID/APPLE_ROOT_CA_PATH 중 비어 있는 항목 있음 → iOS 구독 검증(/subscriptions/verify)과 Apple 알림이 503")
	}
	if !cfg.GoogleStoreConfigured() {
		add("subscription_google_not_configured", "GOOGLE_PLAY_PACKAGE_NAME 또는 서비스 계정(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON[_B64]) 비어 있음 → Android 구독 검증과 Google 알림이 503")
	}
	if !cfg.GoogleRTDNConfigured() {
		add("subscription_rtdn_not_configured", "GOOGLE_RTDN_AUDIENCE/GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL 중 비어 있는 항목 있음 → Google 실시간 알림(Pub/Sub push)을 모두 거부(503)하여 갱신·환불이 앱 재실행 때 검증으로만 반영됨")
	}
	if !cfg.SubscriptionEnforcementEnabled {
		add("subscription_enforcement_off", "SUBSCRIPTION_ENFORCEMENT_ENABLED=false → 무료 회원 제한(내 장소 %d개, 활동 기록 %d일)을 적용하지 않음(막혔을 요청 수만 계측)", cfg.SubscriptionFreeMaxPlaces, cfg.SubscriptionFreeLogDays)
	} else if !cfg.AppleStoreConfigured() || !cfg.GoogleStoreConfigured() {
		add("subscription_enforcement_without_store", "SUBSCRIPTION_ENFORCEMENT_ENABLED=true 인데 스토어 설정이 불완전 → 구독할 수 없는 플랫폼의 사용자가 제한만 받음")
	}
	if strings.TrimSpace(cfg.SubscriptionAccountTokenSecret) == "" {
		add("subscription_account_token_secret_empty", "SUBSCRIPTION_ACCOUNT_TOKEN_SECRET 비어 있음 → 구매를 회원 계정에 묶는 account_token 을 내려주지 않고 증빙의 계정 토큰 대조도 하지 않음(다른 계정이 남의 구매 증빙을 가져와 연결하는 공격을 막지 못함)")
	}
	if cfg.SubscriptionAllowSandbox {
		add("subscription_sandbox_allowed", "SUBSCRIPTION_ALLOW_SANDBOX=true → 샌드박스(테스트) 구매도 프리미엄으로 인정됨(App Store 심사 기간 외에는 꺼야 함)")
	}
	return out
}
