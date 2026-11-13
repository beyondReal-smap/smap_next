package store

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Apple WWDR 체인의 전용 확장 OID (App Store Server Library 와 동일 기준).
var (
	oidAppleLeaf         = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 11, 1}
	oidAppleIntermediate = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 2, 1}
)

const maxJWSLen = 64 * 1024

func (s *Service) appleConfigured() error {
	if strings.TrimSpace(s.cfg.AppleBundleID) == "" {
		return fmt.Errorf("%w: APPLE_BUNDLE_ID", ErrNotConfigured)
	}
	if s.appleRoots == nil {
		return fmt.Errorf("%w: Apple 루트 인증서(APPLE_ROOT_CA_PATH)", ErrNotConfigured)
	}
	return nil
}

// verifyAppleJWS 는 x5c 체인을 Apple 루트까지 검증하고 ES256 서명을 확인한 뒤 payload 클레임을 돌려준다.
// 서명 검증은 golang-jwt 의 ES256 구현, 체인 검증은 crypto/x509 를 사용한다.
func (s *Service) verifyAppleJWS(token string, out interface{}) error {
	if token == "" || len(token) > maxJWSLen || strings.Count(token, ".") != 2 {
		return ErrInvalidProof
	}
	keyfunc := func(t *jwt.Token) (interface{}, error) {
		raw, ok := t.Header["x5c"].([]interface{})
		if !ok {
			return nil, errors.New("x5c 없음")
		}
		return s.verifyAppleChain(raw)
	}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"ES256"}), jwt.WithTimeFunc(s.now))
	claims := jwt.MapClaims{}
	if _, err := parser.ParseWithClaims(token, claims, keyfunc); err != nil {
		return ErrInvalidProof
	}
	// 클레임을 구조체로 재해석(숫자 정밀도 유지를 위해 payload 원문을 다시 디코딩)
	parts := strings.Split(token, ".")
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ErrInvalidProof
	}
	if json.Unmarshal(payload, out) != nil {
		return ErrInvalidProof
	}
	return nil
}

func (s *Service) verifyAppleChain(x5c []interface{}) (*ecdsa.PublicKey, error) {
	if len(x5c) != 3 {
		return nil, errors.New("x5c 길이 오류")
	}
	certs := make([]*x509.Certificate, 3)
	for i, e := range x5c {
		str, ok := e.(string)
		if !ok {
			return nil, errors.New("x5c 형식 오류")
		}
		der, err := base64.StdEncoding.DecodeString(str)
		if err != nil {
			return nil, errors.New("x5c base64 오류")
		}
		c, err := x509.ParseCertificate(der)
		if err != nil {
			return nil, errors.New("x5c 인증서 오류")
		}
		certs[i] = c
	}
	leaf := certs[0]
	inter := x509.NewCertPool()
	inter.AddCert(certs[1])
	inter.AddCert(certs[2])
	if _, err := leaf.Verify(x509.VerifyOptions{
		Roots:         s.appleRoots,
		Intermediates: inter,
		CurrentTime:   s.now(),
		KeyUsages:     []x509.ExtKeyUsage{x509.ExtKeyUsageAny},
	}); err != nil {
		return nil, errors.New("인증서 체인 검증 실패")
	}
	if !s.opt.DisableAppleOIDCheck {
		if !hasExt(leaf, oidAppleLeaf) || !hasExt(certs[1], oidAppleIntermediate) {
			return nil, errors.New("Apple 전용 확장 없음")
		}
	}
	pub, ok := leaf.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("리프 키가 ECDSA 가 아님")
	}
	return pub, nil
}

func hasExt(c *x509.Certificate, oid asn1.ObjectIdentifier) bool {
	for _, e := range c.Extensions {
		if e.Id.Equal(oid) {
			return true
		}
	}
	return false
}

type appleTransaction struct {
	OriginalTransactionID string `json:"originalTransactionId"`
	TransactionID         string `json:"transactionId"`
	BundleID              string `json:"bundleId"`
	ProductID             string `json:"productId"`
	Type                  string `json:"type"`
	Environment           string `json:"environment"`
	PurchaseDate          int64  `json:"purchaseDate"`
	OriginalPurchaseDate  int64  `json:"originalPurchaseDate"`
	ExpiresDate           int64  `json:"expiresDate"`
	RevocationDate        int64  `json:"revocationDate"`
	SignedDate            int64  `json:"signedDate"`
	AppAccountToken       string `json:"appAccountToken"`
}

type appleRenewal struct {
	OriginalTransactionID  string `json:"originalTransactionId"`
	AutoRenewProductID     string `json:"autoRenewProductId"`
	AutoRenewStatus        int    `json:"autoRenewStatus"`
	IsInBillingRetryPeriod bool   `json:"isInBillingRetryPeriod"`
	GracePeriodExpiresDate int64  `json:"gracePeriodExpiresDate"`
	Environment            string `json:"environment"`
	SignedDate             int64  `json:"signedDate"`
}

func msTime(ms int64) time.Time {
	if ms <= 0 {
		return time.Time{}
	}
	return time.UnixMilli(ms).UTC()
}

// toVerified 는 검증된 거래 페이로드를 공통 형식으로 바꾼다(번들·상품·환경 확인 포함).
func (s *Service) appleToVerified(tx *appleTransaction) (*Verified, error) {
	if tx.BundleID != s.cfg.AppleBundleID {
		return nil, ErrInvalidProof
	}
	if !contains(s.cfg.AppleProductIDs, tx.ProductID) {
		return nil, ErrInvalidProof
	}
	if tx.Type != "" && tx.Type != "Auto-Renewable Subscription" {
		return nil, ErrInvalidProof
	}
	if tx.OriginalTransactionID == "" {
		return nil, ErrInvalidProof
	}
	var env string
	switch tx.Environment {
	case "Production":
		env = EnvProduction
	case "Sandbox":
		env = EnvSandbox
		if !s.cfg.AllowSandbox {
			return nil, ErrSandboxNotAllowed
		}
	default: // Xcode, LocalTesting 등은 어떤 설정에서도 받지 않는다
		return nil, ErrInvalidProof
	}
	now := s.now()
	v := &Verified{
		Provider:        ProviderApple,
		TransactionKey:  tx.OriginalTransactionID,
		ProductID:       tx.ProductID,
		Environment:     env,
		PurchasedAt:     msTime(tx.PurchaseDate),
		ExpiresAt:       msTime(tx.ExpiresDate),
		AutoRenew:       true, // 거래 JWS 에는 갱신 정보가 없다 → 추정값(AutoRenewKnown=false)
		AppAccountToken: tx.AppAccountToken,
		LatestEventAt:   msTime(tx.SignedDate),
		Acknowledged:    true,
	}
	if v.ExpiresAt.IsZero() {
		return nil, ErrInvalidProof // 구독 거래는 만료일이 있어야 한다
	}
	switch {
	case tx.RevocationDate > 0:
		v.State = StateRevoked
		v.AutoRenew = false
	case !v.ExpiresAt.After(now):
		v.State = StateExpired
	default:
		v.State = StateActive
	}
	return v, nil
}

// VerifyApple 은 StoreKit 2 가 준 서명된 거래 JWS 를 검증한다.
func (s *Service) VerifyApple(ctx context.Context, signedTransactionJWS string) (*Verified, error) {
	if err := s.appleConfigured(); err != nil {
		return nil, err
	}
	var tx appleTransaction
	if err := s.verifyAppleJWS(strings.TrimSpace(signedTransactionJWS), &tx); err != nil {
		return nil, err
	}
	return s.appleToVerified(&tx)
}

type appleNotificationPayload struct {
	NotificationType string `json:"notificationType"`
	Subtype          string `json:"subtype"`
	NotificationUUID string `json:"notificationUUID"`
	SignedDate       int64  `json:"signedDate"`
	Data             *struct {
		Environment           string `json:"environment"`
		BundleID              string `json:"bundleId"`
		SignedTransactionInfo string `json:"signedTransactionInfo"`
		SignedRenewalInfo     string `json:"signedRenewalInfo"`
	} `json:"data"`
}

// ParseApple 은 App Store Server Notifications V2 의 signedPayload 를 검증·파싱한다.
func (s *Service) ParseApple(ctx context.Context, signedPayload string) (*Notification, error) {
	if err := s.appleConfigured(); err != nil {
		return nil, err
	}
	var p appleNotificationPayload
	if err := s.verifyAppleJWS(strings.TrimSpace(signedPayload), &p); err != nil {
		return nil, err
	}
	if p.NotificationType == "" || p.NotificationUUID == "" {
		return nil, ErrInvalidProof
	}
	n := &Notification{Type: p.NotificationType, Subtype: p.Subtype, NotificationID: p.NotificationUUID}
	if p.Data != nil && p.Data.BundleID != "" && p.Data.BundleID != s.cfg.AppleBundleID {
		return nil, ErrInvalidProof
	}
	if p.NotificationType == "TEST" {
		n.IsTest, n.Ignore = true, true
		return n, nil
	}
	if p.Data == nil || p.Data.SignedTransactionInfo == "" {
		n.Ignore = true // 요약 알림(RENEWAL_EXTENSION summary) 등 거래 정보가 없는 알림
		return n, nil
	}
	var tx appleTransaction
	if err := s.verifyAppleJWS(p.Data.SignedTransactionInfo, &tx); err != nil {
		return nil, err
	}
	v, err := s.appleToVerified(&tx)
	if err != nil {
		return nil, err
	}
	v.LatestEventAt = msTime(p.SignedDate)

	var ren *appleRenewal
	if p.Data.SignedRenewalInfo != "" {
		ren = &appleRenewal{}
		if err := s.verifyAppleJWS(p.Data.SignedRenewalInfo, ren); err != nil {
			return nil, err
		}
		if ren.OriginalTransactionID != "" && ren.OriginalTransactionID != tx.OriginalTransactionID {
			return nil, ErrInvalidProof
		}
		v.AutoRenew = ren.AutoRenewStatus == 1
		v.AutoRenewKnown = true
	}
	applyAppleNotificationState(v, p.NotificationType, p.Subtype, ren)
	n.Verified = *v
	return n, nil
}

// applyAppleNotificationState 는 알림 유형에 따라 State 를 확정한다. 기본은 거래의 만료/해지 상태를 따른다.
func applyAppleNotificationState(v *Verified, typ, sub string, ren *appleRenewal) {
	switch typ {
	case "REFUND":
		v.State, v.AutoRenew = StateRefunded, false
	case "REVOKE":
		v.State, v.AutoRenew = StateRevoked, false
	case "EXPIRED", "GRACE_PERIOD_EXPIRED":
		if typ == "EXPIRED" {
			v.State = StateExpired
		} else {
			v.State = StateOnHold
		}
	case "DID_FAIL_TO_RENEW":
		if sub == "GRACE_PERIOD" {
			v.State = StateGrace
			if ren != nil && ren.GracePeriodExpiresDate > 0 {
				v.ExpiresAt = msTime(ren.GracePeriodExpiresDate)
			}
		} else {
			v.State = StateOnHold
		}
	case "DID_CHANGE_RENEWAL_STATUS":
		if v.State == StateActive && sub == "AUTO_RENEW_DISABLED" {
			v.State, v.AutoRenew, v.AutoRenewKnown = StateCanceled, false, true
		}
	default:
		// 활성 거래에서 갱신이 꺼져 있으면 해지(만료 시각까지 유효)
		if v.State == StateActive && v.AutoRenewKnown && !v.AutoRenew {
			v.State = StateCanceled
		}
	}
}
