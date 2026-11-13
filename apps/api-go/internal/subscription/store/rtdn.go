package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const maxRTDNBody = 1 << 20

var googleNotificationTypes = map[int]string{
	1: "SUBSCRIPTION_RECOVERED", 2: "SUBSCRIPTION_RENEWED", 3: "SUBSCRIPTION_CANCELED",
	4: "SUBSCRIPTION_PURCHASED", 5: "SUBSCRIPTION_ON_HOLD", 6: "SUBSCRIPTION_IN_GRACE_PERIOD",
	7: "SUBSCRIPTION_RESTARTED", 8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED", 9: "SUBSCRIPTION_DEFERRED",
	10: "SUBSCRIPTION_PAUSED", 11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED", 12: "SUBSCRIPTION_REVOKED",
	13: "SUBSCRIPTION_EXPIRED", 20: "SUBSCRIPTION_PENDING_PURCHASE_CANCELED",
}

// verifyOIDC 는 Pub/Sub push 의 Authorization: Bearer <OIDC JWT> 를 검증한다.
func (s *Service) verifyOIDC(ctx context.Context, header string) error {
	if strings.TrimSpace(s.cfg.GoogleRTDNAudience) == "" || strings.TrimSpace(s.cfg.GoogleRTDNServiceAccountEmail) == "" {
		return fmt.Errorf("%w: GOOGLE_RTDN_AUDIENCE/GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL", ErrNotConfigured)
	}
	const prefix = "bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return ErrUnauthorized
	}
	tok := strings.TrimSpace(header[len(prefix):])
	if tok == "" || len(tok) > 8192 {
		return ErrUnauthorized
	}
	var keyErr error
	keyfunc := func(t *jwt.Token) (interface{}, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("kid 없음")
		}
		k, err := s.lookupKey(ctx, kid)
		if err != nil {
			keyErr = err
			return nil, err
		}
		return k, nil
	}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(jwtLeeway),
		jwt.WithTimeFunc(s.now),
	)
	claims := jwt.MapClaims{}
	if _, err := parser.ParseWithClaims(tok, claims, keyfunc); err != nil {
		if keyErr != nil && errors.Is(keyErr, ErrStoreUnavailable) {
			return ErrStoreUnavailable
		}
		return ErrUnauthorized
	}
	iss, _ := claims["iss"].(string)
	if iss != "https://accounts.google.com" && iss != "accounts.google.com" {
		return ErrUnauthorized
	}
	if !audMatches(claims["aud"], s.cfg.GoogleRTDNAudience) {
		return ErrUnauthorized
	}
	email, _ := claims["email"].(string)
	if email == "" || !strings.EqualFold(email, s.cfg.GoogleRTDNServiceAccountEmail) {
		return ErrUnauthorized
	}
	if !truthy(claims["email_verified"]) {
		return ErrUnauthorized
	}
	return nil
}

func audMatches(v interface{}, want string) bool {
	switch a := v.(type) {
	case string:
		return a == want
	case []interface{}:
		for _, x := range a {
			if str, ok := x.(string); ok && str == want {
				return true
			}
		}
	}
	return false
}

func truthy(v interface{}) bool {
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return b == "true"
	}
	return false
}

type pubsubPush struct {
	Message struct {
		Data       string `json:"data"`
		MessageID  string `json:"messageId"`
		MessageID2 string `json:"message_id"`
	} `json:"message"`
}

type rtdnPayload struct {
	PackageName      string    `json:"packageName"`
	EventTimeMillis  string    `json:"eventTimeMillis"`
	TestNotification *struct{} `json:"testNotification"`
	SubNotification  *struct {
		NotificationType int    `json:"notificationType"`
		PurchaseToken    string `json:"purchaseToken"`
		SubscriptionID   string `json:"subscriptionId"`
	} `json:"subscriptionNotification"`
	VoidedNotification *struct {
		PurchaseToken string `json:"purchaseToken"`
		ProductType   int    `json:"productType"`
	} `json:"voidedPurchaseNotification"`
}

// ParseGoogle 은 OIDC 토큰을 검증한 뒤 알림을 파싱하고, 구독 알림은 subscriptionsv2 로 재조회한 상태를 담는다.
func (s *Service) ParseGoogle(ctx context.Context, authorizationHeader string, body []byte) (*Notification, error) {
	if err := s.verifyOIDC(ctx, authorizationHeader); err != nil {
		return nil, err
	}
	if len(body) == 0 || len(body) > maxRTDNBody {
		return nil, ErrInvalidProof
	}
	var push pubsubPush
	if json.Unmarshal(body, &push) != nil || push.Message.Data == "" {
		return nil, ErrInvalidProof
	}
	raw, err := decodeBase64Any(push.Message.Data)
	if err != nil {
		return nil, ErrInvalidProof
	}
	var p rtdnPayload
	if json.Unmarshal(raw, &p) != nil {
		return nil, ErrInvalidProof
	}
	msgID := push.Message.MessageID
	if msgID == "" {
		msgID = push.Message.MessageID2
	}
	n := &Notification{NotificationID: msgID}
	if strings.TrimSpace(s.cfg.GooglePackageName) == "" {
		return nil, fmt.Errorf("%w: GOOGLE_PLAY_PACKAGE_NAME", ErrNotConfigured)
	}
	if p.PackageName != s.cfg.GooglePackageName {
		return nil, ErrInvalidProof
	}
	var eventAt time.Time
	if ms := strings.TrimSpace(p.EventTimeMillis); ms != "" {
		var v int64
		if _, err := fmt.Sscan(ms, &v); err == nil && v > 0 {
			eventAt = time.UnixMilli(v).UTC()
		}
	}
	switch {
	case p.TestNotification != nil:
		n.Type, n.IsTest, n.Ignore = "TEST", true, true
		return n, nil
	case p.SubNotification != nil:
		sn := p.SubNotification
		n.Type = googleNotificationTypes[sn.NotificationType]
		if n.Type == "" {
			n.Type = fmt.Sprintf("UNKNOWN_%d", sn.NotificationType)
		}
		v, err := s.VerifyGoogle(ctx, sn.SubscriptionID, sn.PurchaseToken)
		if err != nil {
			return nil, err
		}
		if !eventAt.IsZero() {
			v.LatestEventAt = eventAt
		}
		if sn.NotificationType == 12 { // REVOKED: 환불·회수
			v.State = StateRevoked
		}
		n.Verified = *v
		return n, nil
	case p.VoidedNotification != nil && p.VoidedNotification.ProductType == 1:
		n.Type = "VOIDED_PURCHASE"
		v, err := s.VerifyGoogle(ctx, "", p.VoidedNotification.PurchaseToken)
		if err != nil {
			return nil, err
		}
		if !eventAt.IsZero() {
			v.LatestEventAt = eventAt
		}
		v.State = StateRefunded
		n.Verified = *v
		return n, nil
	default:
		n.Type, n.Ignore = "IGNORED", true // 일회성 상품·기타 알림
		return n, nil
	}
}
