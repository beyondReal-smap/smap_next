// Package store 는 Apple App Store / Google Play 의 구독 증빙과 알림을 검증한다.
// 서비스 계층은 이 패키지의 인터페이스(Verifier, NotificationVerifier)만 의존한다.
package store

import (
	"context"
	"errors"
	"time"
)

// Provider 는 스토어 종류다.
type Provider string

const (
	ProviderApple  Provider = "apple"
	ProviderGoogle Provider = "google"
)

// State 는 스토어가 알려 준 구독 상태를 정규화한 값이다.
type State string

const (
	StateActive   State = "active"   // 정상 이용 중
	StateGrace    State = "grace"    // 결제 실패 후 유예 기간(만료 시각까지 혜택 유지)
	StateOnHold   State = "on_hold"  // 결제 보류(혜택 없음)
	StateCanceled State = "canceled" // 자동 갱신 해지, 만료 시각까지는 유효
	StateExpired  State = "expired"  // 만료
	StateRefunded State = "refunded" // 환불
	StateRevoked  State = "revoked"  // 취소/회수(가족 공유 해제 등)
)

const (
	EnvProduction = "production"
	EnvSandbox    = "sandbox"
)

// Verified 는 스토어 검증을 통과한 거래 정보다.
type Verified struct {
	Provider Provider
	// TransactionKey: Apple originalTransactionId, Google purchaseToken.
	TransactionKey string
	ProductID      string
	Environment    string // EnvProduction | EnvSandbox
	PurchasedAt    time.Time
	ExpiresAt      time.Time
	AutoRenew      bool
	State          State
	// AppAccountToken: Apple appAccountToken / Google obfuscatedExternalAccountId (있을 때만).
	AppAccountToken string
	// LatestEventAt: 알림 순서 판단용. Apple signedDate(알림) / 거래 signedDate, Google eventTime(알림) / 조회 시각.
	LatestEventAt time.Time
	// AutoRenewKnown: AutoRenew 값이 스토어가 알려 준 것인지. false 이면 AutoRenew 는 추정값이다
	// (Apple 거래 JWS 단독 검증은 갱신 정보가 없어 false, 계약 3.1 의 auto_renew=null 에 대응).
	AutoRenewKnown bool
	// BasePlanID: Google 기본 요금제(monthly/yearly). Apple 은 빈 값(ProductID 로 구분).
	BasePlanID string
	// LinkedTransactionKey: Google linkedPurchaseToken(재가입·변경 시 이전 토큰). 없으면 빈 값.
	LinkedTransactionKey string
	// Acknowledged: Google 구매 승인 여부. Apple은 항상 true.
	Acknowledged bool
}

// Verifier 는 앱이 보낸 구매 증빙을 스토어 기준으로 검증한다.
type Verifier interface {
	// VerifyApple: StoreKit 2 가 준 서명된 거래 JWS 문자열.
	VerifyApple(ctx context.Context, signedTransactionJWS string) (*Verified, error)
	// VerifyGoogle: Play Developer API purchases.subscriptionsv2.get 조회.
	VerifyGoogle(ctx context.Context, productID, purchaseToken string) (*Verified, error)
	// AcknowledgeGoogle: 승인되지 않은 구매를 승인한다(계약 3.2). 이미 승인됐으면 호출하지 않아도 된다.
	AcknowledgeGoogle(ctx context.Context, productID, purchaseToken string) error
}

// Notification 은 스토어 서버 알림 한 건이다.
type Notification struct {
	Verified
	Type           string
	Subtype        string
	NotificationID string // 중복 제거용(Apple notificationUUID / Google Pub/Sub messageId)
	// IsTest 가 true 이면 상태 반영 없이 200 으로 응답만 한다(Verified 는 비어 있음).
	IsTest bool
	// Ignore 가 true 이면 반영할 거래 정보가 없는 알림(요약 알림, 구독과 무관한 알림 등)이다. 200 으로 응답만 한다.
	Ignore bool
}

// NotificationVerifier 는 스토어 알림의 서명·발신자를 검증하고 파싱한다.
type NotificationVerifier interface {
	// ParseApple: App Store Server Notifications V2 의 signedPayload.
	ParseApple(ctx context.Context, signedPayload string) (*Notification, error)
	// ParseGoogle: Pub/Sub push 의 Authorization 헤더(Bearer OIDC)와 본문.
	// 알림 본문의 상태를 그대로 믿지 않고 subscriptionsv2 로 재조회한 결과를 Verified 에 채운다.
	ParseGoogle(ctx context.Context, authorizationHeader string, body []byte) (*Notification, error)
}

// 오류 종류. errors.Is 로 구분한다.
var (
	// ErrInvalidProof: 위조·서명 불일치·번들/패키지/상품 불일치·알 수 없는 증빙. 권장 HTTP 400(알림은 400).
	ErrInvalidProof = errors.New("store: invalid proof")
	// ErrExpired: 이미 만료된 거래로 판명된 경우(호출측이 400 으로 매핑).
	ErrExpired = errors.New("store: subscription expired")
	// ErrUnauthorized: 알림 발신자 검증(OIDC 토큰) 실패. 권장 HTTP 401/403.
	ErrUnauthorized = errors.New("store: unauthorized sender")
	// ErrSandboxNotAllowed: 샌드박스 거래인데 허용 설정이 꺼져 있음. 권장 HTTP 400.
	ErrSandboxNotAllowed = errors.New("store: sandbox not allowed")
	// ErrNotConfigured: 검증에 필요한 설정이 없음. 권장 HTTP 503.
	ErrNotConfigured = errors.New("store: not configured")
	// ErrStoreUnavailable: 스토어/인증 서버 장애·타임아웃. 권장 HTTP 502(알림은 5xx 로 재시도 유도).
	ErrStoreUnavailable = errors.New("store: store unavailable")
	// ErrNotFound: 스토어가 해당 구매를 모른다(Google 404/410). 호출측이 400 으로 매핑.
	ErrNotFound = errors.New("store: purchase not found")
)
