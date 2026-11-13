package dto

// SubscriptionLimits는 /subscriptions/me 의 limits(계약 3.1). max_places는 null이면 무제한이라 포인터다.
type SubscriptionLimits struct {
	MaxPlaces        *int `json:"max_places"`
	LogRetentionDays int  `json:"log_retention_days"`
}

// SubscriptionStatus는 /subscriptions/me, /subscriptions/verify 의 응답(계약 3.1). null 가능 필드는 생략하지 않고 null로 낸다.
type SubscriptionStatus struct {
	IsPremium          bool               `json:"is_premium"`
	Plan               *string            `json:"plan"`
	Platform           *string            `json:"platform"`
	ExpiresAt          *string            `json:"expires_at"`
	AutoRenew          *bool              `json:"auto_renew"`
	InGracePeriod      bool               `json:"in_grace_period"`
	Limits             SubscriptionLimits `json:"limits"`
	EnforcementEnabled bool               `json:"enforcement_enabled"`
	// AccountToken: 구매 시 앱이 Apple appAccountToken / Google obfuscatedExternalAccountId 로 넣을 서버 발급 값(UUID).
	// 서버 비밀이 설정된 경우에만 내려가며(없으면 필드 생략), 기존 필드는 그대로다.
	AccountToken string `json:"account_token,omitempty"`
}

// SubscriptionVerifyRequest는 POST /subscriptions/verify 본문(계약 3.2). iOS: platform+signed_transaction,
// Android: platform+product_id+purchase_token. platform이 비어 있어도 증빙 필드로 판별한다(앱 직렬화 차이 방어).
type SubscriptionVerifyRequest struct {
	Platform          string `json:"platform"`
	SignedTransaction string `json:"signed_transaction"`
	ProductID         string `json:"product_id"`
	PurchaseToken     string `json:"purchase_token"`
}

// AppleNotificationRequest는 App Store Server Notifications V2 본문이다.
type AppleNotificationRequest struct {
	SignedPayload string `json:"signedPayload"`
}

// PlaceLimitDetail / LogRetentionDetail은 혜택 강제 403 의 detail 객체(계약 4절)다.
type PlaceLimitDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Limit   int    `json:"limit"`
}

type LogRetentionDetail struct {
	Code          string `json:"code"`
	Message       string `json:"message"`
	RetentionDays int    `json:"retention_days"`
}
