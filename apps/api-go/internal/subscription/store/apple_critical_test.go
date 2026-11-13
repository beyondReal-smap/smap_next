package store

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"math/big"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// 임의 확장을 critical 로 넣은 체인을 만든다(리프·중간에 Apple OID, 필요하면 알 수 없는 OID 도 critical 로).
func chainWithExtensions(t *testing.T, appleCritical bool, unknownCritical bool) *appleChain {
	t.Helper()
	rootKey, _ := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	interKey, _ := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	leafKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	nb, na := testNow.Add(-24*time.Hour), testNow.Add(24*time.Hour*365)
	null, _ := asn1.Marshal(asn1.NullRawValue)
	rootT := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "R"}, NotBefore: nb, NotAfter: na,
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	root, rootDER := mkCert(t, rootT, rootT, &rootKey.PublicKey, rootKey)
	interExt := []pkix.Extension{{Id: oidAppleIntermediate, Critical: appleCritical, Value: null}}
	leafExt := []pkix.Extension{{Id: oidAppleLeaf, Critical: appleCritical, Value: null}}
	if unknownCritical {
		leafExt = append(leafExt, pkix.Extension{Id: asn1.ObjectIdentifier{1, 2, 3, 4, 5, 6}, Critical: true, Value: null})
	}
	interT := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "I"}, NotBefore: nb, NotAfter: na,
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign, ExtraExtensions: interExt}
	inter, interDER := mkCert(t, interT, root, &interKey.PublicKey, rootKey)
	leafT := &x509.Certificate{SerialNumber: big.NewInt(3), Subject: pkix.Name{CommonName: "L"}, NotBefore: nb, NotAfter: na,
		KeyUsage: x509.KeyUsageDigitalSignature, ExtraExtensions: leafExt}
	_, leafDER := mkCert(t, leafT, inter, &leafKey.PublicKey, interKey)
	return &appleChain{
		rootPEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: rootDER})),
		x5c: []string{base64.StdEncoding.EncodeToString(leafDER), base64.StdEncoding.EncodeToString(interDER),
			base64.StdEncoding.EncodeToString(rootDER)},
		leafKey: leafKey,
	}
}

// 리뷰 PoC8 의 후속: Apple 전용 OID 가 critical 이어도 체인이 통과해야 한다(우리가 직접 검사하는 OID 만 처리됨으로 표시).
func TestAppleCriticalAppleOIDsAccepted(t *testing.T) {
	for _, crit := range []bool{false, true} {
		ch := chainWithExtensions(t, crit, false)
		s := newApple(t, ch, false)
		if _, err := s.VerifyApple(context.Background(), ch.sign(t, txClaims(nil))); err != nil {
			t.Fatalf("Apple OID critical=%v 인데 거부됨: %v", crit, err)
		}
	}
}

// 그 밖의 알 수 없는 critical 확장은 여전히 거부한다(X.509 의 critical 의미를 우회하지 않는다).
func TestAppleUnknownCriticalStillRejected(t *testing.T) {
	ch := chainWithExtensions(t, true, true)
	s := newApple(t, ch, false)
	if _, err := s.VerifyApple(context.Background(), ch.sign(t, txClaims(nil))); !errors.Is(err, ErrInvalidProof) {
		t.Fatalf("알 수 없는 critical 확장: %v", err)
	}
}

// 실제 Apple 공개 인증서(testdata/apple): 출처·지문 고정, 중간 인증서가 루트로 서명됐고 Apple OID 가 있으며 critical 이 아님.
func TestRealAppleCertificates(t *testing.T) {
	want := map[string]string{
		"testdata/apple/AppleRootCA-G3.cer": "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179",
		"testdata/apple/AppleWWDRCAG6.cer":  "bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30",
	}
	certs := map[string]*x509.Certificate{}
	for path, sha := range want {
		der, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256(der)
		if hex.EncodeToString(sum[:]) != sha {
			t.Fatalf("%s 지문 불일치(파일이 바뀜)", path)
		}
		c, err := x509.ParseCertificate(der)
		if err != nil {
			t.Fatal(err)
		}
		certs[path] = c
	}
	root, inter := certs["testdata/apple/AppleRootCA-G3.cer"], certs["testdata/apple/AppleWWDRCAG6.cer"]
	if err := inter.CheckSignatureFrom(root); err != nil {
		t.Fatalf("WWDR G6 가 Apple Root CA G3 로 서명되지 않음: %v", err)
	}
	if !hasExt(inter, oidAppleIntermediate) {
		t.Fatal("WWDR G6 에 1.2.840.113635.100.6.2.1 없음")
	}
	for _, e := range inter.Extensions {
		if e.Id.Equal(oidAppleIntermediate) && e.Critical {
			t.Fatal("실제 WWDR G6 의 Apple OID 가 critical 이 아니어야 함(확인된 사실이 바뀜)")
		}
	}
	// 코드의 루트 고정 로더가 실제 루트 PEM 을 받아들인다(운영 설정과 같은 경로).
	pemBytes, err := os.ReadFile("testdata/apple/AppleRootCA-G3.pem")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := New(Config{AppleBundleID: "x", AppleRootCAPEM: string(pemBytes), AppleRootCASHA256: want["testdata/apple/AppleRootCA-G3.cer"]},
		Options{Now: func() time.Time { return testNow }}); err != nil {
		t.Fatalf("실제 루트 로드: %v", err)
	}
}

// L-2: 동시 요청이 몰려도 JWKS 조회는 한 번, 네트워크 조회 중에도 캐시 적중 요청은 막히지 않는다.
func TestJWKSSingleFlight(t *testing.T) {
	f := newFakeGoogle(t)
	var fetches atomic.Int32
	f.jwksKeys = func() []map[string]string {
		fetches.Add(1)
		time.Sleep(150 * time.Millisecond)
		return []map[string]string{jwk("kid1", &f.oidcKey.PublicKey)}
	}
	s := newGoogleSvc(t, f, nil)
	body := pushBody(t, subNote(2), "m")
	hdr := f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "kid1")
	var wg sync.WaitGroup
	errs := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.ParseGoogle(context.Background(), hdr, body)
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if n := fetches.Load(); n != 1 {
		t.Fatalf("JWKS 조회 %d회(1회여야 함)", n)
	}
}

// L-2: 조회 실패 직후에는 쿨다운 동안 다시 조회하지 않고 바로 일시 장애로 응답하며, 쿨다운이 지나면 재시도한다.
func TestJWKSFailureCooldown(t *testing.T) {
	f := newFakeGoogle(t)
	var fetches atomic.Int32
	f.jwksKeys = func() []map[string]string { fetches.Add(1); return nil } // 키 없음 = 조회 실패
	s := newGoogleSvc(t, f, nil)
	now := testNow
	s.now = func() time.Time { return now }
	hdr := f.oidc(t, nil, jwt.SigningMethodRS256, f.oidcKey, "kid1")
	body := pushBody(t, subNote(2), "m")
	for i := 0; i < 5; i++ {
		if _, err := s.ParseGoogle(context.Background(), hdr, body); !errors.Is(err, ErrStoreUnavailable) {
			t.Fatalf("시도 %d: %v", i, err)
		}
	}
	if n := fetches.Load(); n != 1 {
		t.Fatalf("쿨다운 안에서 조회 %d회(1회여야 함)", n)
	}
	now = testNow.Add(failCooldown + time.Second)
	_, _ = s.ParseGoogle(context.Background(), hdr, body)
	if n := fetches.Load(); n != 2 {
		t.Fatalf("쿨다운 뒤 재조회 안 됨: %d", n)
	}
}
