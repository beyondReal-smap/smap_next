package config

import (
	"strings"
	"testing"
)

func subDefaults() *Config {
	return &Config{SubscriptionFreeMaxPlaces: 2, SubscriptionFreeLogDays: 2, SubscriptionPremiumLogDays: 14,
		SubscriptionAppleMonthProductID: "m", SubscriptionAppleYearProductID: "y",
		SubscriptionGoogleMonthBasePlan: "monthly", SubscriptionGoogleYearBasePlan: "yearly"}
}

func TestSubscriptionWarningsDefaults(t *testing.T) {
	ws := SubscriptionStartupWarnings(subDefaults(), SubscriptionFacts{TableChecked: true, TableMissing: true})
	for _, want := range []string{"subscription_table_missing", "subscription_apple_not_configured", "subscription_google_not_configured",
		"subscription_rtdn_not_configured", "subscription_enforcement_off"} {
		if !has(ws, want) {
			t.Errorf("%s 누락: %v", want, codes(ws))
		}
	}
	if has(ws, "subscription_sandbox_allowed") {
		t.Error("샌드박스 기본 꺼짐")
	}
	if has(SubscriptionStartupWarnings(subDefaults(), SubscriptionFacts{}), "subscription_table_missing") {
		t.Error("확인하지 않았으면 테이블 경고 금지")
	}
}

func TestSubscriptionWarningsConfiguredNoLeak(t *testing.T) {
	c := subDefaults()
	c.AppleBundleID, c.AppleRootCAPath = "SECRET-BUNDLE", "/secret/path.pem"
	c.GooglePlayPackageName, c.GooglePlayServiceAccount = "secret.pkg", "/secret/sa.json"
	c.GoogleRTDNAudience, c.GoogleRTDNServiceAccount = "secret-aud", "secret@x"
	c.SubscriptionEnforcementEnabled, c.SubscriptionAllowSandbox = true, true
	ws := SubscriptionStartupWarnings(c, SubscriptionFacts{TableChecked: true})
	if len(ws) != 1 || ws[0].Code != "subscription_sandbox_allowed" {
		t.Fatalf("%v", codes(ws))
	}
	c.AppleBundleID = ""
	for _, w := range SubscriptionStartupWarnings(c, SubscriptionFacts{}) {
		if strings.Contains(w.Message, "secret") {
			t.Fatalf("값 누출: %s", w.Message)
		}
	}
}

func TestValidateSubscription(t *testing.T) {
	if err := subDefaults().validateSubscription(); err != nil {
		t.Fatal(err)
	}
	for name, mut := range map[string]func(*Config){
		"무료 일수 0":  func(c *Config) { c.SubscriptionFreeLogDays = 0 },
		"프리미엄<무료":  func(c *Config) { c.SubscriptionPremiumLogDays = 1 },
		"장소 음수":    func(c *Config) { c.SubscriptionFreeMaxPlaces = -1 },
		"보정 주기 30": func(c *Config) { c.SubscriptionLapseSyncIntervalSeconds = 30 },
		"월=연":      func(c *Config) { c.SubscriptionAppleYearProductID = "m" },
	} {
		c := subDefaults()
		mut(c)
		if c.validateSubscription() == nil {
			t.Errorf("%s 통과함", name)
		}
	}
}
