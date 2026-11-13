package store

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	tPkg   = "com.dmonster.smap"
	tAud   = "https://api.example.test/api/v1/subscriptions/google/notifications"
	tEmail = "pubsub-push@proj.iam.gserviceaccount.com"
)

type fakeGoogle struct {
	mu          sync.Mutex
	t           *testing.T
	calls       map[string]int
	subResp     func(token string) (int, string)
	tokenStatus int
	ackStatus   int
	expireTok   bool // 첫 API 호출을 401 로
	oidcKey     *rsa.PrivateKey
	oidcKid     string
	jwksKeys    func() []map[string]string
	lastAuth    string
}

func (f *fakeGoogle) Do(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u := req.URL.String()
	resp := func(code int, body string) (*http.Response, error) {
		return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
	}
	switch {
	case strings.Contains(u, "oauth2.test/token"):
		f.calls["token"]++
		if f.tokenStatus != 0 {
			return resp(f.tokenStatus, `{"error":"invalid_grant"}`)
		}
		b, _ := io.ReadAll(req.Body)
		if !bytes.Contains(b, []byte("assertion=")) || !bytes.Contains(b, []byte("jwt-bearer")) {
			return resp(400, `{}`)
		}
		return resp(200, `{"access_token":"tok-`+string(rune('0'+f.calls["token"]))+`","expires_in":3600}`)
	case strings.Contains(u, "jwks.test"):
		f.calls["jwks"]++
		b, _ := json.Marshal(map[string]interface{}{"keys": f.jwksKeys()})
		return resp(200, string(b))
	case strings.Contains(u, ":acknowledge"):
		f.calls["ack"]++
		if f.ackStatus != 0 {
			return resp(f.ackStatus, `{}`)
		}
		return resp(204, ``)
	case strings.Contains(u, "subscriptionsv2/tokens/"):
		f.calls["sub"]++
		f.lastAuth = req.Header.Get("Authorization")
		if f.expireTok && f.calls["sub"] == 1 {
			return resp(401, `{}`)
		}
		tok := u[strings.LastIndex(u, "/")+1:]
		code, body := f.subResp(tok)
		return resp(code, body)
	}
	f.t.Fatalf("unexpected url %s", u)
	return nil, nil
}

func rsaPEM(t *testing.T, k *rsa.PrivateKey) string {
	der, _ := x509.MarshalPKCS8PrivateKey(k)
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

func newFakeGoogle(t *testing.T) *fakeGoogle {
	k, _ := rsa.GenerateKey(rand.Reader, 2048)
	f := &fakeGoogle{t: t, calls: map[string]int{}, oidcKey: k, oidcKid: "kid1"}
	f.jwksKeys = func() []map[string]string { return []map[string]string{jwk(f.oidcKid, &f.oidcKey.PublicKey)} }
	f.subResp = func(string) (int, string) {
		return 200, subJSON("SUBSCRIPTION_STATE_ACTIVE", "smap_premium", "yearly", testNow.Add(72*time.Hour), true, false)
	}
	return f
}

func jwk(kid string, pub *rsa.PublicKey) map[string]string {
	return map[string]string{"kty": "RSA", "kid": kid, "alg": "RS256", "use": "sig",
		"n": base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())}
}

func subJSON(state, product, basePlan string, exp time.Time, autoRenew, test bool) string {
	m := map[string]interface{}{
		"startTime": testNow.Add(-48 * time.Hour).Format(time.RFC3339), "subscriptionState": state,
		"acknowledgementState": "ACKNOWLEDGEMENT_STATE_PENDING",
		"lineItems": []map[string]interface{}{{"productId": product, "expiryTime": exp.Format(time.RFC3339),
			"autoRenewingPlan": map[string]bool{"autoRenewEnabled": autoRenew}, "offerDetails": map[string]string{"basePlanId": basePlan}}},
	}
	if test {
		m["testPurchase"] = map[string]interface{}{}
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func newGoogleSvc(t *testing.T, f *fakeGoogle, mut func(*Config)) *Service {
	t.Helper()
	sak, _ := rsa.GenerateKey(rand.Reader, 2048)
	saJSON, _ := json.Marshal(map[string]string{"type": "service_account", "client_email": "svc@proj.iam.gserviceaccount.com", "private_key": rsaPEM(t, sak)})
	cfg := Config{GooglePackageName: tPkg, GoogleServiceAccountJSON: string(saJSON), GoogleBasePlanIDs: []string{"monthly", "yearly"},
		GoogleRTDNAudience: tAud, GoogleRTDNServiceAccountEmail: tEmail}
	if mut != nil {
		mut(&cfg)
	}
	s, err := New(cfg, Options{HTTP: f, Now: func() time.Time { return testNow },
		GoogleTokenURL: "https://oauth2.test/token", GoogleAPIBase: "https://api.test", GoogleJWKSURL: "https://jwks.test/certs"})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestVerifyGoogleStates(t *testing.T) {
	f := newFakeGoogle(t)
	s := newGoogleSvc(t, f, nil)
	exp := testNow.Add(72 * time.Hour)
	cases := []struct {
		name  string
		state string
		exp   time.Time
		renew bool
		want  State
	}{
		{"active", "SUBSCRIPTION_STATE_ACTIVE", exp, true, StateActive},
		{"grace", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", exp, true, StateGrace},
		{"hold", "SUBSCRIPTION_STATE_ON_HOLD", testNow.Add(-time.Hour), true, StateOnHold},
		{"paused", "SUBSCRIPTION_STATE_PAUSED", exp, false, StateOnHold},
		{"canceled", "SUBSCRIPTION_STATE_CANCELED", exp, false, StateCanceled},
		{"expired", "SUBSCRIPTION_STATE_EXPIRED", testNow.Add(-time.Hour), false, StateExpired},
		{"active but past expiry", "SUBSCRIPTION_STATE_ACTIVE", testNow.Add(-time.Minute), true, StateExpired},
	}
	for _, c := range cases {
		f.subResp = func(string) (int, string) {
			return 200, subJSON(c.state, "smap_premium", "monthly", c.exp, c.renew, false)
		}
		v, err := s.VerifyGoogle(context.Background(), "smap_premium", "ptoken")
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if v.State != c.want || v.TransactionKey != "ptoken" || v.BasePlanID != "monthly" || v.Environment != EnvProduction ||
			v.Acknowledged || !v.ExpiresAt.Equal(c.exp) {
			t.Errorf("%s: %+v", c.name, v)
		}
	}
	if f.calls["token"] != 1 {
		t.Errorf("토큰 캐시 안 됨: %d", f.calls["token"])
	}
}

func TestVerifyGoogleErrors(t *testing.T) {
	f := newFakeGoogle(t)
	s := newGoogleSvc(t, f, nil)
	ctx := context.Background()
	exp := testNow.Add(time.Hour)
	set := func(code int, body string) { f.subResp = func(string) (int, string) { return code, body } }

	set(500, `{}`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrStoreUnavailable) {
		t.Errorf("5xx: %v", err)
	}
	set(429, `{}`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrStoreUnavailable) {
		t.Errorf("429: %v", err)
	}
	set(404, `{}`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrNotFound) {
		t.Errorf("404: %v", err)
	}
	set(400, `{}`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrInvalidProof) {
		t.Errorf("400: %v", err)
	}
	set(403, `{}`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("403: %v", err)
	}
	set(200, subJSON("SUBSCRIPTION_STATE_ACTIVE", "other_product", "monthly", exp, true, false))
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrInvalidProof) {
		t.Errorf("product: %v", err)
	}
	set(200, subJSON("SUBSCRIPTION_STATE_ACTIVE", "smap_premium", "weekly", exp, true, false))
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrInvalidProof) {
		t.Errorf("base plan: %v", err)
	}
	set(200, `not json`)
	if _, err := s.VerifyGoogle(ctx, "smap_premium", "t"); !errors.Is(err, ErrStoreUnavailable) {
		t.Errorf("bad json: %v", err)
	}
	if _, err := s.VerifyGoogle(ctx, "evil_product", "t"); !errors.Is(err, ErrInvalidProof) {
		t.Errorf("req product: %v", err)
	}
	if _, err := s.VerifyGoogle(ctx, "smap_premium", ""); !errors.Is(err, ErrInvalidProof) {
		t.Errorf("empty token: %v", err)
	}
}

func TestVerifyGoogleTestPurchase(t *testing.T) {
	f := newFakeGoogle(t)
	f.subResp = func(string) (int, string) {
		return 200, subJSON("SUBSCRIPTION_STATE_ACTIVE", "smap_premium", "yearly", testNow.Add(time.Hour), true, true)
	}
	if _, err := newGoogleSvc(t, f, nil).VerifyGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrSandboxNotAllowed) {
		t.Fatalf("denied: %v", err)
	}
	s := newGoogleSvc(t, f, func(c *Config) { c.AllowSandbox = true })
	v, err := s.VerifyGoogle(context.Background(), "smap_premium", "t")
	if err != nil || v.Environment != EnvSandbox {
		t.Fatalf("allowed: %v %+v", err, v)
	}
}

func TestGoogleTokenRefreshAndErrors(t *testing.T) {
	f := newFakeGoogle(t)
	f.expireTok = true // 첫 API 호출 401 → 토큰 재발급 후 재시도
	s := newGoogleSvc(t, f, nil)
	if _, err := s.VerifyGoogle(context.Background(), "smap_premium", "t"); err != nil {
		t.Fatal(err)
	}
	if f.calls["token"] != 2 || f.lastAuth != "Bearer tok-2" {
		t.Fatalf("refresh: %v %s", f.calls, f.lastAuth)
	}

	f2 := newFakeGoogle(t)
	f2.tokenStatus = 400
	if _, err := newGoogleSvc(t, f2, nil).VerifyGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("token 400: %v", err)
	}
	f3 := newFakeGoogle(t)
	f3.tokenStatus = 503
	if _, err := newGoogleSvc(t, f3, nil).VerifyGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrStoreUnavailable) {
		t.Errorf("token 503: %v", err)
	}
}

func TestGoogleNotConfigured(t *testing.T) {
	s, _ := New(Config{}, Options{})
	if _, err := s.VerifyGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("verify: %v", err)
	}
	if err := s.AcknowledgeGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("ack: %v", err)
	}
	if _, err := s.ParseGoogle(context.Background(), "Bearer x", []byte("{}")); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("parse: %v", err)
	}
	if _, err := New(Config{GoogleServiceAccountJSON: "{not json"}, Options{}); err == nil {
		t.Error("잘못된 서비스 계정 JSON 은 시작 시 에러여야 함")
	}
}

func TestAcknowledgeGoogle(t *testing.T) {
	f := newFakeGoogle(t)
	s := newGoogleSvc(t, f, nil)
	if err := s.AcknowledgeGoogle(context.Background(), "smap_premium", "t"); err != nil || f.calls["ack"] != 1 {
		t.Fatalf("ack: %v %v", err, f.calls)
	}
	f.ackStatus = 500
	if err := s.AcknowledgeGoogle(context.Background(), "smap_premium", "t"); !errors.Is(err, ErrStoreUnavailable) {
		t.Fatalf("ack 500: %v", err)
	}
}

// ---- RTDN ----

func (f *fakeGoogle) oidc(t *testing.T, mut func(jwt.MapClaims), method jwt.SigningMethod, key interface{}, kid string) string {
	c := jwt.MapClaims{"iss": "https://accounts.google.com", "aud": tAud, "email": tEmail, "email_verified": true,
		"exp": testNow.Add(time.Hour).Unix(), "iat": testNow.Unix()}
	if mut != nil {
		mut(c)
	}
	tk := jwt.NewWithClaims(method, c)
	tk.Header["kid"] = kid
	s, err := tk.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + s
}

func pushBody(t *testing.T, payload map[string]interface{}, msgID string) []byte {
	raw, _ := json.Marshal(payload)
	b, _ := json.Marshal(map[string]interface{}{"message": map[string]string{"data": base64.StdEncoding.EncodeToString(raw), "messageId": msgID}, "subscription": "projects/p/subscriptions/s"})
	return b
}

func subNote(typ int) map[string]interface{} {
	return map[string]interface{}{"version": "1.0", "packageName": tPkg, "eventTimeMillis": "1790000000000",
		"subscriptionNotification": map[string]interface{}{"version": "1.0", "notificationType": typ, "purchaseToken": "ptok", "subscriptionId": "smap_premium"}}
}

func TestParseGoogleNotification(t *testing.T) {
	f := newFakeGoogle(t)
	s := newGoogleSvc(t, f, nil)
	ctx := context.Background()
	auth := f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "kid1")

	n, err := s.ParseGoogle(ctx, auth, pushBody(t, subNote(2), "msg-1"))
	if err != nil {
		t.Fatal(err)
	}
	if n.Type != "SUBSCRIPTION_RENEWED" || n.NotificationID != "msg-1" || n.State != StateActive || n.TransactionKey != "ptok" ||
		!n.LatestEventAt.Equal(time.UnixMilli(1790000000000).UTC()) {
		t.Fatalf("%+v", n)
	}
	// 재조회 결과를 사용(본문 유형이 아니라)
	f.subResp = func(string) (int, string) {
		return 200, subJSON("SUBSCRIPTION_STATE_ON_HOLD", "smap_premium", "yearly", testNow.Add(-time.Hour), true, false)
	}
	n, err = s.ParseGoogle(ctx, auth, pushBody(t, subNote(2), "msg-2"))
	if err != nil || n.State != StateOnHold {
		t.Fatalf("requery: %v %+v", err, n)
	}
	// REVOKED(12) → revoked
	n, err = s.ParseGoogle(ctx, auth, pushBody(t, subNote(12), "msg-3"))
	if err != nil || n.State != StateRevoked || n.Type != "SUBSCRIPTION_REVOKED" {
		t.Fatalf("revoked: %v %+v", err, n)
	}
	// 테스트 알림
	n, err = s.ParseGoogle(ctx, auth, pushBody(t, map[string]interface{}{"version": "1.0", "packageName": tPkg, "testNotification": map[string]string{"version": "1.0"}}, "m"))
	if err != nil || !n.IsTest || !n.Ignore {
		t.Fatalf("test: %v %+v", err, n)
	}
	// 다른 패키지
	p := subNote(2)
	p["packageName"] = "com.other"
	if _, err := s.ParseGoogle(ctx, auth, pushBody(t, p, "m")); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("pkg: %v", err)
	}
	// 깨진 본문
	if _, err := s.ParseGoogle(ctx, auth, []byte(`{"message":{"data":"!!"}}`)); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("bad body: %v", err)
	}
	// 일회성 상품 알림은 무시
	n, err = s.ParseGoogle(ctx, auth, pushBody(t, map[string]interface{}{"packageName": tPkg, "oneTimeProductNotification": map[string]string{"sku": "x"}}, "m"))
	if err != nil || !n.Ignore {
		t.Fatalf("one-time: %v %+v", err, n)
	}
	// 환불(voided) → refunded
	n, err = s.ParseGoogle(ctx, auth, pushBody(t, map[string]interface{}{"packageName": tPkg, "eventTimeMillis": "1790000000000",
		"voidedPurchaseNotification": map[string]interface{}{"purchaseToken": "ptok", "productType": 1}}, "m"))
	if err != nil || n.State != StateRefunded {
		t.Fatalf("voided: %v %+v", err, n)
	}
}

func TestGoogleOIDCRejections(t *testing.T) {
	f := newFakeGoogle(t)
	s := newGoogleSvc(t, f, nil)
	ctx := context.Background()
	body := pushBody(t, subNote(2), "m")
	other, _ := rsa.GenerateKey(rand.Reader, 2048)

	cases := []struct {
		name string
		hdr  string
	}{
		{"no header", ""},
		{"not bearer", "Basic abc"},
		{"garbage", "Bearer abc.def.ghi"},
		{"aud mismatch", f.oidc(t, func(c jwt.MapClaims) { c["aud"] = "https://evil" }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"email mismatch", f.oidc(t, func(c jwt.MapClaims) { c["email"] = "evil@x.iam.gserviceaccount.com" }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"email unverified", f.oidc(t, func(c jwt.MapClaims) { c["email_verified"] = false }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"issuer mismatch", f.oidc(t, func(c jwt.MapClaims) { c["iss"] = "https://evil" }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"expired", f.oidc(t, func(c jwt.MapClaims) { c["exp"] = testNow.Add(-time.Hour).Unix() }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"no exp", f.oidc(t, func(c jwt.MapClaims) { delete(c, "exp") }, jwt.SigningMethodRS256, f.oidcKey, "kid1")},
		{"wrong key", f.oidc(t, nil, jwt.SigningMethodRS256, other, "kid1")},
		{"hs256", f.oidc(t, nil, jwt.SigningMethodHS256, []byte("secret"), "kid1")},
		{"alg none", f.oidc(t, nil, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, "kid1")},
		{"unknown kid", f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "nokid")},
	}
	for _, c := range cases {
		if _, err := s.ParseGoogle(ctx, c.hdr, body); !errors.Is(err, ErrUnauthorized) {
			t.Errorf("%s: got %v", c.name, err)
		}
	}
}

func TestGoogleOIDCKidMissRefetch(t *testing.T) {
	f := newFakeGoogle(t)
	now := testNow
	s := newGoogleSvc(t, f, nil)
	s.now = func() time.Time { return now }
	ctx := context.Background()
	body := pushBody(t, subNote(2), "m")

	if _, err := s.ParseGoogle(ctx, f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "kid1"), body); err != nil {
		t.Fatal(err)
	}
	// 키 회전: 새 kid 가 JWKS 에 추가됨 → 쿨다운 안에서는 재조회 안 함
	newKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	f.jwksKeys = func() []map[string]string {
		return []map[string]string{jwk("kid1", &f.oidcKey.PublicKey), jwk("kid2", &newKey.PublicKey)}
	}
	hdr := f.oidc(t, nil, jwt.SigningMethodRS256, newKey, "kid2")
	if _, err := s.ParseGoogle(ctx, hdr, body); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("cooldown: %v", err)
	}
	if f.calls["jwks"] != 1 {
		t.Fatalf("jwks calls %d", f.calls["jwks"])
	}
	now = testNow.Add(time.Minute)
	if _, err := s.ParseGoogle(ctx, hdr, body); err != nil {
		t.Fatalf("after cooldown: %v", err)
	}
	if f.calls["jwks"] != 2 {
		t.Fatalf("jwks calls %d", f.calls["jwks"])
	}
}

func TestGoogleOIDCJWKSDown(t *testing.T) {
	f := newFakeGoogle(t)
	f.jwksKeys = func() []map[string]string { return nil }
	s := newGoogleSvc(t, f, nil)
	hdr := f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "kid1")
	if _, err := s.ParseGoogle(context.Background(), hdr, pushBody(t, subNote(2), "m")); !errors.Is(err, ErrStoreUnavailable) {
		t.Fatalf("got %v", err)
	}
}
