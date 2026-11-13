package config

import (
	"fmt"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/auth"
)

// StartupWarning은 시작 시 설정 점검이 내는 경고 한 건이다. Code는 안정적인 식별자(로그 검색용),
// Message는 "무엇이 어떤 상태 → 그 결과 무엇이 어떻게 되는지" 한 줄이다. 설정 값은 담지 않는다(이름과 상태만).
type StartupWarning struct {
	Code    string
	Message string
}

// RuntimeFacts는 설정만으로는 알 수 없는, 시작 과정에서 드러난 사실이다.
type RuntimeFacts struct {
	// RedisConnected는 Redis 연결이 성립했는지다(REDIS_URL 미설정이거나 연결 실패면 false).
	RedisConnected bool
}

// StartupWarnings는 운영에 필요한 설정이 비어 있거나 위험한 값일 때의 경고 목록을 돌려준다(순수 함수).
// 시작을 막지 않는다 — 시작 실패는 Load의 검증이 담당한다. 순서는 항상 같다.
func StartupWarnings(cfg *Config, f RuntimeFacts) []StartupWarning {
	var out []StartupWarning
	add := func(code, format string, args ...interface{}) {
		out = append(out, StartupWarning{Code: code, Message: fmt.Sprintf(format, args...)})
	}

	// --- Redis ---
	if !f.RedisConnected {
		const effects = "이메일 인증·SMS 인증번호 발송/검증은 503으로 실패하고, 로그인 실패 한도·소셜 가입 증거는 무력화(통과)되며, 가입 확인 한도는 적용되지 않고, 비밀번호 변경 이전 토큰 무효 기준을 조회할 수 없음"
		if strings.TrimSpace(cfg.RedisURL) == "" {
			add("redis_not_configured", "REDIS_URL 미설정 → Redis 없이 동작: %s", effects)
		} else {
			add("redis_connect_failed", "REDIS_URL 설정됨, 연결 실패 → Redis 없이 동작: %s", effects)
		}
	}

	// --- 클라이언트 IP ---
	if strings.TrimSpace(cfg.TrustedClientIPHeader) == "" {
		add("trusted_client_ip_header_empty", "TRUSTED_CLIENT_IP_HEADER 비어 있음 → IP 한도(이메일 인증·SMS·가입 확인·로그인 실패)가 직접 접속 주소 기준으로 계산되어, 프록시/터널 뒤에서는 모든 사용자가 한 주소로 합산됨")
	}

	// --- 인증 모드 ---
	routeMode, _ := auth.ParseRouteMode(cfg.RouteAuthModeRaw)
	switch routeMode {
	case auth.RouteModeOff:
		add("route_auth_off", "ROUTE_AUTH_MODE=off → 일반 사용자 인증 미들웨어가 꺼져 있어 로그인이 필요한 라우트가 토큰 없이도 처리됨")
	case auth.RouteModeWarn:
		add("route_auth_warn", "ROUTE_AUTH_MODE=warn → 토큰이 없거나 무효인 요청도 통과시키고 계측만 함(유효 토큰이 있으면 권한 검사는 적용)")
	}
	locMode, _ := auth.ParseLocationAuthMode(cfg.LocationAuthModeRaw)
	if locMode.EffectiveRouteMode(routeMode) != auth.RouteModeEnforce {
		add("location_auth_unenforced", "LOCATION_AUTH_MODE=%s(ROUTE_AUTH_MODE=%s) → 위치 라우트가 토큰 없이도 통과하여 다른 사용자의 위치를 토큰 없이 조회할 수 있음", locMode, routeMode)
	}
	if !cfg.LocationWriteRequireToken {
		add("location_write_token_optional", "LOCATION_WRITE_REQUIRE_TOKEN=false → 위치 업로드가 토큰 없이도 본문 mt_idx 기준으로 기록됨(계측만)")
	}

	// --- 소셜 로그인 ---
	socialMode, _ := auth.ParseSocialMode(cfg.SocialTokenVerificationRaw)
	if socialMode == auth.SocialModeOff {
		add("social_verification_off", "SOCIAL_TOKEN_VERIFICATION=off → 소셜 로그인의 공급자 토큰을 검증하지 않음")
	} else {
		configured := map[string]bool{
			string(auth.ProviderGoogle): len(cfg.GoogleAllowedClientIDs()) > 0,
			string(auth.ProviderApple):  len(cfg.AppleAllowedBundleIDs()) > 0,
			string(auth.ProviderKakao):  strings.TrimSpace(cfg.KakaoAllowedAppID) != "",
		}
		for _, p := range []auth.Provider{auth.ProviderGoogle, auth.ProviderApple, auth.ProviderKakao} {
			if configured[string(p)] {
				continue
			}
			if socialMode == auth.SocialModeRequired {
				add("social_allowlist_empty", "%s 허용 목록 비어 있음(SOCIAL_TOKEN_VERIFICATION=required) → %s 소셜 로그인 전부 503", p, p)
			} else {
				add("social_allowlist_empty", "%s 허용 목록 비어 있음(SOCIAL_TOKEN_VERIFICATION=when_present) → 공급자 토큰을 보내는 %s 소셜 로그인은 503, 토큰 없는 구버전 로그인은 검증 없이 통과", p, p)
			}
		}
	}

	// --- 가입 정책 ---
	if cfg.AllowLegacyPhoneRegister && !cfg.LegacyRegisterRequireSMSVerified {
		add("legacy_phone_register_open", "ALLOW_LEGACY_PHONE_REGISTER=true, LEGACY_REGISTER_REQUIRE_SMS_VERIFIED=false → 이메일 토큰 없는 전화번호 가입이 SMS 인증 상태 확인 없이 허용됨")
	}
	if !cfg.SocialRegisterRequireToken && !cfg.SocialRegisterRequireLoginProof {
		add("social_register_without_token", "SOCIAL_REGISTER_REQUIRE_TOKEN=false, SOCIAL_REGISTER_REQUIRE_LOGIN_PROOF=false → 소셜 가입이 공급자 토큰·로그인 증거 없이 클라이언트가 보낸 ID로 허용됨")
	}
	if !cfg.RequireGroupInviteCode {
		add("group_invite_code_optional", "REQUIRE_GROUP_INVITE_CODE=false → 초대 코드 없이 그룹 번호만으로 그룹 가입이 허용됨(구버전 앱 호환)")
	}

	// --- 발송 채널 ---
	nwConfigured := cfg.NaverworksClientID != "" && cfg.NaverworksClientSecret != "" && cfg.NaverworksDomain != ""
	gmailConfigured := cfg.EmailSender != "" && cfg.EmailPassword != ""
	if !nwConfigured && !gmailConfigured {
		add("mail_not_configured", "EMAIL_SENDER/EMAIL_PASSWORD, NAVERWORKS_* 모두 미설정 → 이메일 인증번호·비밀번호 재설정 메일 발송 불가(이메일 가입·재설정 실패)")
	}
	if cfg.AligoUserID == "" || cfg.AligoKey == "" || cfg.AligoSender == "" {
		add("sms_not_configured", "ALIGO_USER_ID/ALIGO_KEY/ALIGO_SENDER 중 비어 있는 항목 있음 → SMS 인증번호·비밀번호 재설정 문자 발송 실패")
	}

	// --- 기타 ---
	if cfg.Debug {
		add("debug_enabled", "DEBUG=true → member-fcm-token의 DEBUG 전용 라우트 4종이 활성화됨(운영에서는 꺼야 함)")
	}
	return out
}
