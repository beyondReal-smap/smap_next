package store

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var testNow = time.Date(2026, 11, 13, 3, 0, 0, 0, time.UTC)

type appleChain struct {
	rootPEM string
	x5c     []string
	leafKey *ecdsa.PrivateKey
}

func mkCert(t *testing.T, tmpl, parent *x509.Certificate, pub *ecdsa.PublicKey, signer *ecdsa.PrivateKey) (*x509.Certificate, []byte) {
	t.Helper()
	der, err := x509.CreateCertificate(rand.Reader, tmpl, parent, pub, signer)
	if err != nil {
		t.Fatal(err)
	}
	c, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	return c, der
}

// newAppleChain 은 테스트용 루트·중간·리프를 만든다. leafNotAfter 로 만료된 리프를 만들 수 있다.
func newAppleChain(t *testing.T, leafNotAfter time.Time, withOIDs bool) *appleChain {
	t.Helper()
	rootKey, _ := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	interKey, _ := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	leafKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	nb := testNow.Add(-24 * time.Hour * 365)
	na := testNow.Add(24 * time.Hour * 365)
	rootT := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Test Root"},
		NotBefore: nb, NotAfter: na, IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	root, rootDER := mkCert(t, rootT, rootT, &rootKey.PublicKey, rootKey)
	interT := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "Test Inter"},
		NotBefore: nb, NotAfter: na, IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	leafT := &x509.Certificate{SerialNumber: big.NewInt(3), Subject: pkix.Name{CommonName: "Test Leaf"},
		NotBefore: nb, NotAfter: leafNotAfter, KeyUsage: x509.KeyUsageDigitalSignature}
	if withOIDs {
		interT.ExtraExtensions = []pkix.Extension{{Id: oidAppleIntermediate, Value: []byte{5, 0}}}
		leafT.ExtraExtensions = []pkix.Extension{{Id: oidAppleLeaf, Value: []byte{5, 0}}}
	}
	inter, interDER := mkCert(t, interT, root, &interKey.PublicKey, rootKey)
	_, leafDER := mkCert(t, leafT, inter, &leafKey.PublicKey, interKey)
	return &appleChain{
		rootPEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: rootDER})),
		x5c: []string{base64.StdEncoding.EncodeToString(leafDER), base64.StdEncoding.EncodeToString(interDER),
			base64.StdEncoding.EncodeToString(rootDER)},
		leafKey: leafKey,
	}
}

func (c *appleChain) sign(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	tok.Header["x5c"] = c.x5c
	s, err := tok.SignedString(c.leafKey)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func ms(t time.Time) int64 { return t.UnixMilli() }

func txClaims(over map[string]interface{}) jwt.MapClaims {
	m := jwt.MapClaims{
		"originalTransactionId": "2000000123", "transactionId": "2000000456",
		"bundleId": "com.dmonster.smap", "productId": "com.dmonster.smap.sub_year",
		"type": "Auto-Renewable Subscription", "environment": "Production",
		"purchaseDate": ms(testNow.Add(-24 * time.Hour)), "expiresDate": ms(testNow.Add(30 * 24 * time.Hour)),
		"signedDate": ms(testNow),
	}
	for k, v := range over {
		if v == nil {
			delete(m, k)
		} else {
			m[k] = v
		}
	}
	return m
}

func newApple(t *testing.T, ch *appleChain, allowSandbox bool) *Service {
	t.Helper()
	s, err := New(Config{AppleBundleID: "com.dmonster.smap", AppleRootCAPEM: ch.rootPEM, AllowSandbox: allowSandbox},
		Options{Now: func() time.Time { return testNow }})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func okChain(t *testing.T) *appleChain { return newAppleChain(t, testNow.Add(24*time.Hour*30), true) }

func TestVerifyAppleSuccess(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, false)
	v, err := s.VerifyApple(context.Background(), ch.sign(t, txClaims(nil)))
	if err != nil {
		t.Fatal(err)
	}
	if v.TransactionKey != "2000000123" || v.State != StateActive || v.Environment != EnvProduction ||
		v.Provider != ProviderApple || v.ProductID != "com.dmonster.smap.sub_year" || v.AutoRenewKnown {
		t.Fatalf("unexpected: %+v", v)
	}
	if !v.ExpiresAt.Equal(testNow.Add(30 * 24 * time.Hour)) {
		t.Fatalf("expires %v", v.ExpiresAt)
	}
}

func TestVerifyAppleRejects(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, false)
	ctx := context.Background()

	cases := []struct {
		name string
		tok  func() string
		want error
	}{
		{"bundle mismatch", func() string { return ch.sign(t, txClaims(map[string]interface{}{"bundleId": "com.evil"})) }, ErrInvalidProof},
		{"product mismatch", func() string { return ch.sign(t, txClaims(map[string]interface{}{"productId": "other.product"})) }, ErrInvalidProof},
		{"sandbox denied", func() string { return ch.sign(t, txClaims(map[string]interface{}{"environment": "Sandbox"})) }, ErrSandboxNotAllowed},
		{"xcode env", func() string { return ch.sign(t, txClaims(map[string]interface{}{"environment": "Xcode"})) }, ErrInvalidProof},
		{"no expiry", func() string { return ch.sign(t, txClaims(map[string]interface{}{"expiresDate": nil})) }, ErrInvalidProof},
		{"garbage", func() string { return "abc" }, ErrInvalidProof},
		{"tampered", func() string {
			tok := ch.sign(t, txClaims(nil))
			return tok[:len(tok)-4] + "AAAA"
		}, ErrInvalidProof},
		{"foreign signing key", func() string {
			k, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			other := *ch
			other.leafKey = k // x5c 의 리프 공개키와 서명키 불일치
			return other.sign(t, txClaims(nil))
		}, ErrInvalidProof},
		{"alg none", func() string {
			tk := jwt.NewWithClaims(jwt.SigningMethodNone, txClaims(nil))
			tk.Header["x5c"] = ch.x5c
			s, _ := tk.SignedString(jwt.UnsafeAllowNoneSignatureType)
			return s
		}, ErrInvalidProof},
	}
	for _, c := range cases {
		if _, err := s.VerifyApple(ctx, c.tok()); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v want %v", c.name, err, c.want)
		}
	}
}

func TestVerifyAppleOtherRootAndExpiredCert(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, false)
	other := okChain(t) // 다른 루트
	if _, err := s.VerifyApple(context.Background(), other.sign(t, txClaims(nil))); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("other root: %v", err)
	}
	expired := newAppleChain(t, testNow.Add(-time.Hour), true)
	s2 := newApple(t, expired, false)
	if _, err := s2.VerifyApple(context.Background(), expired.sign(t, txClaims(nil))); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("expired cert: %v", err)
	}
	noOID := newAppleChain(t, testNow.Add(24*time.Hour), false)
	s3 := newApple(t, noOID, false)
	if _, err := s3.VerifyApple(context.Background(), noOID.sign(t, txClaims(nil))); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("missing apple OID: %v", err)
	}
}

func TestVerifyAppleSandboxAllowedAndStates(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, true)
	ctx := context.Background()
	v, err := s.VerifyApple(ctx, ch.sign(t, txClaims(map[string]interface{}{"environment": "Sandbox"})))
	if err != nil || v.Environment != EnvSandbox {
		t.Fatalf("sandbox: %v %+v", err, v)
	}
	v, err = s.VerifyApple(ctx, ch.sign(t, txClaims(map[string]interface{}{"expiresDate": ms(testNow.Add(-time.Hour))})))
	if err != nil || v.State != StateExpired {
		t.Fatalf("expired: %v %+v", err, v)
	}
	v, err = s.VerifyApple(ctx, ch.sign(t, txClaims(map[string]interface{}{"revocationDate": ms(testNow)})))
	if err != nil || v.State != StateRevoked {
		t.Fatalf("revoked: %v %+v", err, v)
	}
}

func TestAppleNotConfigured(t *testing.T) {
	s, _ := New(Config{}, Options{})
	if _, err := s.VerifyApple(context.Background(), "a.b.c"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
	if _, err := s.ParseApple(context.Background(), "a.b.c"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
	// 번들만 있고 루트가 없으면 역시 미설정
	s2, _ := New(Config{AppleBundleID: "x"}, Options{})
	if _, err := s2.VerifyApple(context.Background(), "a.b.c"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
}

func TestRootPinMismatchFailsFast(t *testing.T) {
	ch := okChain(t)
	_, err := New(Config{AppleBundleID: "x", AppleRootCAPEM: ch.rootPEM, AppleRootCASHA256: "00"}, Options{})
	if err == nil {
		t.Fatal("expected pin mismatch error")
	}
}

func notif(t *testing.T, ch *appleChain, typ, sub, uuid string, signedDate time.Time, tx, ren jwt.MapClaims) string {
	t.Helper()
	data := map[string]interface{}{"environment": "Production", "bundleId": "com.dmonster.smap"}
	if tx != nil {
		data["signedTransactionInfo"] = ch.sign(t, tx)
	}
	if ren != nil {
		data["signedRenewalInfo"] = ch.sign(t, ren)
	}
	p := jwt.MapClaims{"notificationType": typ, "notificationUUID": uuid, "signedDate": ms(signedDate), "data": data}
	if sub != "" {
		p["subtype"] = sub
	}
	return ch.sign(t, p)
}

func TestParseAppleNotifications(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, false)
	ctx := context.Background()
	expired := map[string]interface{}{"expiresDate": ms(testNow.Add(-time.Hour))}

	tests := []struct {
		name  string
		typ   string
		sub   string
		tx    jwt.MapClaims
		ren   jwt.MapClaims
		state State
	}{
		{"renew", "DID_RENEW", "", txClaims(nil), jwt.MapClaims{"autoRenewStatus": 1}, StateActive},
		{"cancel renewal", "DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED", txClaims(nil), jwt.MapClaims{"autoRenewStatus": 0}, StateCanceled},
		{"expired", "EXPIRED", "VOLUNTARY", txClaims(expired), jwt.MapClaims{"autoRenewStatus": 0}, StateExpired},
		{"refund", "REFUND", "", txClaims(map[string]interface{}{"revocationDate": ms(testNow)}), nil, StateRefunded},
		{"revoke", "REVOKE", "", txClaims(nil), nil, StateRevoked},
		{"grace", "DID_FAIL_TO_RENEW", "GRACE_PERIOD", txClaims(expired),
			jwt.MapClaims{"autoRenewStatus": 1, "gracePeriodExpiresDate": ms(testNow.Add(48 * time.Hour))}, StateGrace},
		{"billing retry", "DID_FAIL_TO_RENEW", "", txClaims(expired), jwt.MapClaims{"autoRenewStatus": 1}, StateOnHold},
	}
	for i, c := range tests {
		sd := testNow.Add(-time.Duration(i) * time.Minute)
		n, err := s.ParseApple(ctx, notif(t, ch, c.typ, c.sub, "uuid-"+c.name, sd, c.tx, c.ren))
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if n.State != c.state || n.NotificationID != "uuid-"+c.name || n.Type != c.typ || !n.LatestEventAt.Equal(sd) {
			t.Errorf("%s: %+v", c.name, n)
		}
		if c.name == "grace" && !n.ExpiresAt.Equal(testNow.Add(48*time.Hour)) {
			t.Errorf("grace expiry %v", n.ExpiresAt)
		}
	}
}

func TestParseAppleTestAndSummaryAndForged(t *testing.T) {
	ch := okChain(t)
	s := newApple(t, ch, false)
	ctx := context.Background()
	n, err := s.ParseApple(ctx, notif(t, ch, "TEST", "", "u1", testNow, nil, nil))
	if err != nil || !n.IsTest || !n.Ignore {
		t.Fatalf("test: %v %+v", err, n)
	}
	n, err = s.ParseApple(ctx, ch.sign(t, jwt.MapClaims{"notificationType": "RENEWAL_EXTENSION", "subtype": "SUMMARY",
		"notificationUUID": "u2", "signedDate": ms(testNow), "summary": map[string]interface{}{"bundleId": "com.dmonster.smap"}}))
	if err != nil || !n.Ignore {
		t.Fatalf("summary: %v %+v", err, n)
	}
	// 다른 루트가 서명한 알림
	evil := okChain(t)
	if _, err := s.ParseApple(ctx, notif(t, evil, "DID_RENEW", "", "u3", testNow, txClaims(nil), nil)); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("forged: %v", err)
	}
	// 알림 내부 거래가 다른 번들
	if _, err := s.ParseApple(ctx, notif(t, ch, "DID_RENEW", "", "u4", testNow,
		txClaims(map[string]interface{}{"bundleId": "com.evil"}), nil)); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("bundle: %v", err)
	}
}
