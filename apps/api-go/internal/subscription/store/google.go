package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// accessToken 은 androidpublisher 스코프의 OAuth 액세스 토큰을 돌려준다(만료 60초 전 갱신).
func (s *Service) accessToken(ctx context.Context, force bool) (string, error) {
	if s.sa == nil {
		return "", fmt.Errorf("%w: Google 서비스 계정", ErrNotConfigured)
	}
	c := &s.token
	c.mu.Lock()
	defer c.mu.Unlock()
	now := s.now()
	if !force && c.token != "" && now.Add(60*time.Second).Before(c.expires) {
		return c.token, nil
	}
	claims := jwt.MapClaims{
		"iss":   s.sa.email,
		"scope": publisherScope,
		"aud":   s.opt.GoogleTokenURL,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(s.sa.key)
	if err != nil {
		return "", fmt.Errorf("%w: 서비스 계정 키로 서명할 수 없음", ErrNotConfigured)
	}
	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.opt.GoogleTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", ErrStoreUnavailable
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	code, body, err := s.doLimited(req)
	if err != nil {
		return "", err
	}
	switch {
	case code == http.StatusOK:
	case code == http.StatusTooManyRequests || code >= 500:
		return "", ErrStoreUnavailable
	default:
		// invalid_grant 등: 키 폐기·권한 문제 → 설정 오류
		return "", fmt.Errorf("%w: Google OAuth 토큰 교환 거부(%d)", ErrNotConfigured, code)
	}
	var tr struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if json.Unmarshal(body, &tr) != nil || tr.AccessToken == "" {
		return "", ErrStoreUnavailable
	}
	if tr.ExpiresIn <= 0 {
		tr.ExpiresIn = 300
	}
	c.token = tr.AccessToken
	c.expires = now.Add(time.Duration(tr.ExpiresIn) * time.Second)
	return c.token, nil
}

// googleCall 은 Play Developer API 를 호출한다. 401 이면 토큰을 새로 받아 1회 재시도한다.
func (s *Service) googleCall(ctx context.Context, method, path string, body []byte) (int, []byte, error) {
	for attempt := 0; attempt < 2; attempt++ {
		tok, err := s.accessToken(ctx, attempt > 0)
		if err != nil {
			return 0, nil, err
		}
		var rd *bytes.Reader
		if body != nil {
			rd = bytes.NewReader(body)
		} else {
			rd = bytes.NewReader(nil)
		}
		req, err := http.NewRequestWithContext(ctx, method, s.opt.GoogleAPIBase+path, rd)
		if err != nil {
			return 0, nil, ErrStoreUnavailable
		}
		req.Header.Set("Authorization", "Bearer "+tok)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		code, b, err := s.doLimited(req)
		if err != nil {
			return 0, nil, err
		}
		if code == http.StatusUnauthorized && attempt == 0 {
			continue
		}
		return code, b, nil
	}
	return 0, nil, ErrStoreUnavailable
}

func (s *Service) googleConfigured() error {
	if strings.TrimSpace(s.cfg.GooglePackageName) == "" {
		return fmt.Errorf("%w: GOOGLE_PLAY_PACKAGE_NAME", ErrNotConfigured)
	}
	if s.sa == nil {
		return fmt.Errorf("%w: Google 서비스 계정", ErrNotConfigured)
	}
	return nil
}

func mapGoogleStatus(code int) error {
	switch {
	case code == http.StatusBadRequest:
		return ErrInvalidProof
	case code == http.StatusNotFound || code == http.StatusGone:
		return ErrNotFound
	case code == http.StatusUnauthorized || code == http.StatusForbidden:
		// 서비스 계정에 Play Console 권한이 없음 등 → 서버 설정 문제
		return fmt.Errorf("%w: Google Play API 권한 거부(%d)", ErrNotConfigured, code)
	default:
		return ErrStoreUnavailable
	}
}

type googleSubV2 struct {
	StartTime         string    `json:"startTime"`
	SubscriptionState string    `json:"subscriptionState"`
	LinkedPurchase    string    `json:"linkedPurchaseToken"`
	LatestOrderID     string    `json:"latestOrderId"`
	AckState          string    `json:"acknowledgementState"`
	TestPurchase      *struct{} `json:"testPurchase"`
	ExternalAccount   struct {
		Obfuscated string `json:"obfuscatedExternalAccountId"`
	} `json:"externalAccountIdentifiers"`
	LineItems []struct {
		ProductID  string `json:"productId"`
		ExpiryTime string `json:"expiryTime"`
		AutoRenew  *struct {
			Enabled bool `json:"autoRenewEnabled"`
		} `json:"autoRenewingPlan"`
		OfferDetails struct {
			BasePlanID string `json:"basePlanId"`
		} `json:"offerDetails"`
	} `json:"lineItems"`
}

// VerifyGoogle 은 purchases.subscriptionsv2.get 으로 구독 상태를 조회한다.
func (s *Service) VerifyGoogle(ctx context.Context, productID, purchaseToken string) (*Verified, error) {
	if err := s.googleConfigured(); err != nil {
		return nil, err
	}
	purchaseToken = strings.TrimSpace(purchaseToken)
	if purchaseToken == "" || len(purchaseToken) > 4096 {
		return nil, ErrInvalidProof
	}
	if productID != "" && !contains(s.cfg.GoogleProductIDs, productID) {
		return nil, ErrInvalidProof
	}
	path := "/androidpublisher/v3/applications/" + url.PathEscape(s.cfg.GooglePackageName) +
		"/purchases/subscriptionsv2/tokens/" + url.PathEscape(purchaseToken)
	code, body, err := s.googleCall(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	if code != http.StatusOK {
		return nil, mapGoogleStatus(code)
	}
	var r googleSubV2
	if json.Unmarshal(body, &r) != nil {
		return nil, ErrStoreUnavailable
	}
	return s.googleVerified(&r, productID, purchaseToken)
}

func (s *Service) googleVerified(r *googleSubV2, wantProduct, token string) (*Verified, error) {
	now := s.now()
	// 허용 상품의 line item 선택
	idx := -1
	for i, li := range r.LineItems {
		if !contains(s.cfg.GoogleProductIDs, li.ProductID) {
			continue
		}
		if wantProduct != "" && li.ProductID != wantProduct {
			continue
		}
		idx = i
		break
	}
	if idx < 0 {
		return nil, ErrInvalidProof
	}
	li := r.LineItems[idx]
	if len(s.cfg.GoogleBasePlanIDs) > 0 && !contains(s.cfg.GoogleBasePlanIDs, li.OfferDetails.BasePlanID) {
		return nil, ErrInvalidProof
	}
	exp, err := time.Parse(time.RFC3339, li.ExpiryTime)
	if err != nil {
		return nil, ErrStoreUnavailable
	}
	v := &Verified{
		Provider:             ProviderGoogle,
		TransactionKey:       token,
		ProductID:            li.ProductID,
		BasePlanID:           li.OfferDetails.BasePlanID,
		Environment:          EnvProduction,
		ExpiresAt:            exp.UTC(),
		LatestEventAt:        now.UTC(),
		AppAccountToken:      r.ExternalAccount.Obfuscated,
		LinkedTransactionKey: r.LinkedPurchase,
		Acknowledged:         r.AckState == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
		AutoRenewKnown:       li.AutoRenew != nil || r.SubscriptionState != "",
		AutoRenew:            li.AutoRenew != nil && li.AutoRenew.Enabled,
	}
	if st, err := time.Parse(time.RFC3339, r.StartTime); err == nil {
		v.PurchasedAt = st.UTC()
	}
	if r.TestPurchase != nil {
		v.Environment = EnvSandbox
		if !s.cfg.AllowSandbox {
			return nil, ErrSandboxNotAllowed
		}
	}
	switch r.SubscriptionState {
	case "SUBSCRIPTION_STATE_ACTIVE":
		v.State = StateActive
	case "SUBSCRIPTION_STATE_CANCELED":
		v.State = StateCanceled
		v.AutoRenew = false
	case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
		v.State = StateGrace
	case "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_PENDING":
		v.State = StateOnHold
	case "SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
		v.State = StateExpired
	default:
		return nil, ErrStoreUnavailable // 알 수 없는 상태는 추측하지 않는다
	}
	// 방어: 유효한 상태라도 만료 시각이 지났으면 만료로 본다
	if (v.State == StateActive || v.State == StateCanceled || v.State == StateGrace) && !exp.After(now) {
		v.State = StateExpired
	}
	return v, nil
}

// AcknowledgeGoogle 은 구매를 승인한다(subscriptions v1 acknowledge). 이미 승인된 구매는 호출하지 않는다.
func (s *Service) AcknowledgeGoogle(ctx context.Context, productID, purchaseToken string) error {
	if err := s.googleConfigured(); err != nil {
		return err
	}
	if !contains(s.cfg.GoogleProductIDs, productID) || strings.TrimSpace(purchaseToken) == "" {
		return ErrInvalidProof
	}
	path := "/androidpublisher/v3/applications/" + url.PathEscape(s.cfg.GooglePackageName) +
		"/purchases/subscriptions/" + url.PathEscape(productID) +
		"/tokens/" + url.PathEscape(purchaseToken) + ":acknowledge"
	code, _, err := s.googleCall(ctx, http.MethodPost, path, []byte("{}"))
	if err != nil {
		return err
	}
	if code/100 == 2 {
		return nil
	}
	return mapGoogleStatus(code)
}
