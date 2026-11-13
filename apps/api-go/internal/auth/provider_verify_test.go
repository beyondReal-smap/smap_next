package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
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
	tGoogleJWKS = "https://fake.google.test/certs"
	tAppleJWKS  = "https://fake.apple.test/keys"
	tKakaoInfo  = "https://fake.kakao.test/v1/user/access_token_info"
	tKakaoMe    = "https://fake.kakao.test/v2/user/me"
)

// fakeProvider는 공급자 HTTP 응답을 흉내 낸다(실제 네트워크 없음). URL별 호출 횟수를 센다.
type fakeProvider struct {
	mu       sync.Mutex
	calls    map[string]int
	handlers map[string]func(r *http.Request) (int, string)
	failNet  map[string]bool
	authSeen map[string]string
}

func newFakeProvider() *fakeProvider {
	return &fakeProvider{calls: map[string]int{}, handlers: map[string]func(*http.Request) (int, string){},
		failNet: map[string]bool{}, authSeen: map[string]string{}}
}

func (f *fakeProvider) Do(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u := req.URL.String()
	f.calls[u]++
	f.authSeen[u] = req.Header.Get("Authorization")
	if f.failNet[u] {
		return nil, errors.New("network down")
	}
	h, ok := f.handlers[u]
	if !ok {
		return &http.Response{StatusCode: 404, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	code, body := h(req)
	return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(body))}, nil
}

func (f *fakeProvider) set(url string, code int, body string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.handlers[url] = func(*http.Request) (int, string) { return code, body }
}

func (f *fakeProvider) count(url string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[url]
}

func genKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func jwksJSON(keys map[string]*rsa.PrivateKey) string {
	doc := map[string][]map[string]string{"keys": {}}
	for kid, k := range keys {
		doc["keys"] = append(doc["keys"], map[string]string{
			"kty": "RSA", "kid": kid, "alg": "RS256", "use": "sig",
			"n": base64.RawURLEncoding.EncodeToString(k.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.E)).Bytes()),
		})
	}
	b, _ := json.Marshal(doc)
	return string(b)
}

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }

type verifierEnv struct {
	v    *ProviderVerifier
	fp   *fakeProvider
	clk  *clock
	gKey *rsa.PrivateKey
	aKey *rsa.PrivateKey
}

const (
	gClient   = "web-client.apps.googleusercontent.com"
	gClientIO = "ios-client.apps.googleusercontent.com"
	aBundle   = "com.dmonster.smap"
	kApp      = "123456"
)

func newVerifierEnv(t *testing.T) *verifierEnv {
	t.Helper()
	e := &verifierEnv{fp: newFakeProvider(), clk: &clock{t: time.Unix(1_800_000_000, 0)}, gKey: genKey(t), aKey: genKey(t)}
	e.fp.set(tGoogleJWKS, 200, jwksJSON(map[string]*rsa.PrivateKey{"g1": e.gKey}))
	e.fp.set(tAppleJWKS, 200, jwksJSON(map[string]*rsa.PrivateKey{"a1": e.aKey}))
	v, err := NewProviderVerifier(ProviderVerifierConfig{
		GoogleClientIDs: []string{gClient, gClientIO}, AppleBundleIDs: []string{aBundle}, KakaoAppID: kApp,
		HTTP: e.fp, Now: e.clk.now,
		GoogleJWKSURL: tGoogleJWKS, AppleJWKSURL: tAppleJWKS, KakaoTokenInfoURL: tKakaoInfo, KakaoUserMeURL: tKakaoMe,
	})
	if err != nil {
		t.Fatal(err)
	}
	e.v = v
	return e
}

func (e *verifierEnv) claims(iss, aud, sub string) jwt.MapClaims {
	return jwt.MapClaims{"iss": iss, "aud": aud, "sub": sub,
		"iat": e.clk.t.Unix(), "exp": e.clk.t.Add(time.Hour).Unix(),
		"email": "u@example.com", "email_verified": true}
}

func sign(t *testing.T, key *rsa.PrivateKey, kid string, c jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, c)
	if kid != "" {
		tok.Header["kid"] = kid
	}
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func wantErr(t *testing.T, err, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("에러 불일치: got %v, want %v", err, target)
	}
}

func TestGoogleVerifyOK(t *testing.T) {
	e := newVerifierEnv(t)
	for _, iss := range []string{"https://accounts.google.com", "accounts.google.com"} {
		for _, aud := range []string{gClient, gClientIO} { // Android(웹 클라이언트)·iOS 클라이언트 모두 허용 목록에서 통과
			c := e.claims(iss, aud, "sub-1")
			c["name"], c["given_name"], c["picture"] = "홍길동", "길동", "https://img.test/p.png"
			id, err := e.v.Verify(context.Background(), ProviderGoogle, sign(t, e.gKey, "g1", c))
			if err != nil {
				t.Fatalf("iss=%s aud=%s: %v", iss, aud, err)
			}
			if id.Subject != "sub-1" || id.Email != "u@example.com" || !id.EmailVerified || id.Name != "홍길동" || id.Provider != ProviderGoogle {
				t.Fatalf("신원 불일치: %+v", id)
			}
		}
	}
}

func TestGoogleAudAsArray(t *testing.T) {
	e := newVerifierEnv(t)
	c := e.claims("https://accounts.google.com", "", "s")
	c["aud"] = []string{"other", gClient}
	if _, err := e.v.Verify(context.Background(), ProviderGoogle, sign(t, e.gKey, "g1", c)); err != nil {
		t.Fatalf("aud 배열 허용 실패: %v", err)
	}
}

func TestGoogleRejects(t *testing.T) {
	e := newVerifierEnv(t)
	ctx := context.Background()
	good := e.claims("https://accounts.google.com", gClient, "s")

	cases := map[string]string{}
	// 위조 서명: 다른 키로 같은 kid
	cases["forged"] = sign(t, genKey(t), "g1", good)
	// 만료
	exp := e.claims("https://accounts.google.com", gClient, "s")
	exp["exp"] = e.clk.t.Add(-time.Hour).Unix()
	cases["expired"] = sign(t, e.gKey, "g1", exp)
	// exp 없음
	noExp := e.claims("https://accounts.google.com", gClient, "s")
	delete(noExp, "exp")
	cases["no_exp"] = sign(t, e.gKey, "g1", noExp)
	// aud 불일치
	cases["aud"] = sign(t, e.gKey, "g1", e.claims("https://accounts.google.com", "someone-else", "s"))
	// iss 불일치(Apple 발급자)
	cases["iss"] = sign(t, e.gKey, "g1", e.claims("https://appleid.apple.com", gClient, "s"))
	// sub 없음
	noSub := e.claims("https://accounts.google.com", gClient, "")
	delete(noSub, "sub")
	cases["no_sub"] = sign(t, e.gKey, "g1", noSub)
	// kid 없음
	cases["no_kid"] = sign(t, e.gKey, "", good)
	// 미래 iat
	fut := e.claims("https://accounts.google.com", gClient, "s")
	fut["iat"] = e.clk.t.Add(time.Hour).Unix()
	cases["future_iat"] = sign(t, e.gKey, "g1", fut)
	// alg=none
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, good).SignedString(jwt.UnsafeAllowNoneSignatureType)
	cases["alg_none"] = none
	// HS256: 공개키 바이트를 비밀로 서명(알고리즘 혼동 공격)
	hs := jwt.NewWithClaims(jwt.SigningMethodHS256, good)
	hs.Header["kid"] = "g1"
	hsTok, _ := hs.SignedString(e.gKey.N.Bytes())
	cases["alg_hs256"] = hsTok
	cases["garbage"] = "not.a.jwt"

	for name, tok := range cases {
		_, err := e.v.Verify(ctx, ProviderGoogle, tok)
		if !errors.Is(err, ErrProviderTokenInvalid) {
			t.Errorf("%s: 거부되어야 함(ErrProviderTokenInvalid): got %v", name, err)
		}
	}
}

func TestVerifyRejectsMalformedTokenInput(t *testing.T) {
	e := newVerifierEnv(t)
	for name, tok := range map[string]string{
		"empty": "", "crlf": "abc\r\nX-Evil: 1", "space": "a b", "long": strings.Repeat("a", maxProviderTokenLen+1), "non_ascii": "토큰",
	} {
		for _, p := range []Provider{ProviderGoogle, ProviderApple, ProviderKakao} {
			if _, err := e.v.Verify(context.Background(), p, tok); !errors.Is(err, ErrProviderTokenInvalid) {
				t.Errorf("%s/%s: got %v", name, p, err)
			}
		}
	}
	if n := e.fp.count(tKakaoInfo) + e.fp.count(tGoogleJWKS); n != 0 {
		t.Fatalf("형식 오류 토큰으로 공급자를 호출하면 안 됨: %d", n)
	}
}

func TestKeyCacheAndKidMissRefetch(t *testing.T) {
	e := newVerifierEnv(t)
	ctx := context.Background()
	tok := func(key *rsa.PrivateKey, kid string) string {
		return sign(t, key, kid, e.claims("https://accounts.google.com", gClient, "s"))
	}

	// 1) 첫 검증: 조회 1회. 이후 TTL 안에서는 캐시 사용.
	if _, err := e.v.Verify(ctx, ProviderGoogle, tok(e.gKey, "g1")); err != nil {
		t.Fatal(err)
	}
	if _, err := e.v.Verify(ctx, ProviderGoogle, tok(e.gKey, "g1")); err != nil {
		t.Fatal(err)
	}
	if n := e.fp.count(tGoogleJWKS); n != 1 {
		t.Fatalf("캐시 사용 시 조회는 1회여야 함: %d", n)
	}

	// 2) 공급자가 키를 회전(g2 추가). 쿨다운 이내에는 kid 미스로 재조회하지 않는다.
	newKey := genKey(t)
	e.fp.set(tGoogleJWKS, 200, jwksJSON(map[string]*rsa.PrivateKey{"g1": e.gKey, "g2": newKey}))
	e.clk.advance(5 * time.Second)
	_, err := e.v.Verify(ctx, ProviderGoogle, tok(newKey, "g2"))
	wantErr(t, err, ErrProviderTokenInvalid)
	if n := e.fp.count(tGoogleJWKS); n != 1 {
		t.Fatalf("쿨다운 이내에는 재조회하지 않아야 함: %d", n)
	}

	// 3) 쿨다운 경과 후 kid 미스 -> 정확히 1회 재조회, 새 키로 검증 성공.
	e.clk.advance(time.Minute)
	if _, err := e.v.Verify(ctx, ProviderGoogle, tok(newKey, "g2")); err != nil {
		t.Fatalf("재조회 후 검증 실패: %v", err)
	}
	if n := e.fp.count(tGoogleJWKS); n != 2 {
		t.Fatalf("kid 미스 재조회는 1회여야 함: %d", n)
	}

	// 4) 이후 g2 검증은 캐시 사용(추가 조회 없음).
	if _, err := e.v.Verify(ctx, ProviderGoogle, tok(newKey, "g2")); err != nil {
		t.Fatal(err)
	}
	if n := e.fp.count(tGoogleJWKS); n != 2 {
		t.Fatalf("캐시 적중 시 조회 없음: %d", n)
	}

	// 5) 존재하지 않는 kid: 쿨다운 경과 후 1회 재조회 뒤에도 없으면 무효. 같은 시각 반복 요청은 재조회하지 않는다.
	e.clk.advance(time.Minute)
	for i := 0; i < 3; i++ {
		_, err = e.v.Verify(ctx, ProviderGoogle, tok(newKey, "ghost"))
		wantErr(t, err, ErrProviderTokenInvalid)
	}
	if n := e.fp.count(tGoogleJWKS); n != 3 {
		t.Fatalf("없는 kid 반복에도 재조회는 1회뿐이어야 함: %d", n)
	}

	// 6) TTL(1시간) 경과 후에는 kid가 있어도 재조회.
	e.clk.advance(2 * time.Hour)
	c := e.claims("https://accounts.google.com", gClient, "s")
	if _, err := e.v.Verify(ctx, ProviderGoogle, sign(t, e.gKey, "g1", c)); err != nil {
		t.Fatal(err)
	}
	if n := e.fp.count(tGoogleJWKS); n != 4 {
		t.Fatalf("TTL 경과 후 재조회: %d", n)
	}
}

func TestJWKSOutageIsUnavailableNotInvalid(t *testing.T) {
	e := newVerifierEnv(t)
	tok := sign(t, e.gKey, "g1", e.claims("https://accounts.google.com", gClient, "s"))

	e.fp.failNet[tGoogleJWKS] = true
	_, err := e.v.Verify(context.Background(), ProviderGoogle, tok)
	wantErr(t, err, ErrProviderUnavailable)

	e.fp.failNet[tGoogleJWKS] = false
	for name, body := range map[string]struct {
		code int
		body string
	}{"500": {500, ""}, "bad_json": {200, "{"}, "no_keys": {200, `{"keys":[]}`}, "non_rsa": {200, `{"keys":[{"kty":"EC","kid":"g1"}]}`}} {
		e.fp.set(tGoogleJWKS, body.code, body.body)
		_, err := e.v.Verify(context.Background(), ProviderGoogle, tok)
		if !errors.Is(err, ErrProviderUnavailable) {
			t.Errorf("%s: got %v, want unavailable", name, err)
		}
	}
}

func TestJWKSResponseSizeLimit(t *testing.T) {
	e := newVerifierEnv(t)
	v, _ := NewProviderVerifier(ProviderVerifierConfig{GoogleClientIDs: []string{gClient}, HTTP: e.fp, Now: e.clk.now,
		GoogleJWKSURL: tGoogleJWKS, MaxBodyBytes: 64})
	tok := sign(t, e.gKey, "g1", e.claims("https://accounts.google.com", gClient, "s"))
	_, err := v.Verify(context.Background(), ProviderGoogle, tok)
	wantErr(t, err, ErrProviderUnavailable) // 상한 초과로 잘린 JSON은 파싱 실패 -> 공급자 장애로 취급
}

func TestHTTPTimeoutAppliesViaContext(t *testing.T) {
	blocked := &blockingDoer{}
	v, _ := NewProviderVerifier(ProviderVerifierConfig{GoogleClientIDs: []string{gClient}, HTTP: blocked, Timeout: 50 * time.Millisecond, GoogleJWKSURL: tGoogleJWKS})
	k := genKey(t)
	tok := sign(t, k, "g1", jwt.MapClaims{"iss": "accounts.google.com", "aud": gClient, "sub": "s", "exp": time.Now().Add(time.Hour).Unix()})
	start := time.Now()
	_, err := v.Verify(context.Background(), ProviderGoogle, tok)
	wantErr(t, err, ErrProviderUnavailable)
	if time.Since(start) > 2*time.Second {
		t.Fatal("타임아웃이 적용되지 않음")
	}
}

type blockingDoer struct{}

func (blockingDoer) Do(req *http.Request) (*http.Response, error) {
	<-req.Context().Done()
	return nil, req.Context().Err()
}

func TestNotConfiguredIsReportedBeforeToken(t *testing.T) {
	v, err := NewProviderVerifier(ProviderVerifierConfig{HTTP: newFakeProvider()})
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range []Provider{ProviderGoogle, ProviderApple, ProviderKakao} {
		if v.Configured(p) {
			t.Fatalf("%s: 설정이 비어 있는데 Configured=true", p)
		}
		for _, tok := range []string{"", "x.y.z"} {
			_, err := v.Verify(context.Background(), p, tok)
			wantErr(t, err, ErrProviderNotConfigured)
		}
	}
	// 일부만 설정된 경우 해당 공급자만 통과 대상이 된다.
	v2, _ := NewProviderVerifier(ProviderVerifierConfig{GoogleClientIDs: []string{gClient}, HTTP: newFakeProvider()})
	if !v2.Configured(ProviderGoogle) || v2.Configured(ProviderApple) {
		t.Fatal("Configured 판정 오류")
	}
}

func TestAppleVerify(t *testing.T) {
	e := newVerifierEnv(t)
	ctx := context.Background()
	c := e.claims("https://appleid.apple.com", aBundle, "apple-sub-1")
	c["email_verified"] = "true" // Apple은 문자열로 줄 수 있다
	id, err := e.v.Verify(ctx, ProviderApple, sign(t, e.aKey, "a1", c))
	if err != nil {
		t.Fatal(err)
	}
	if id.Subject != "apple-sub-1" || !id.EmailVerified || id.Email != "u@example.com" {
		t.Fatalf("신원 불일치: %+v", id)
	}
	c2 := e.claims("https://appleid.apple.com", aBundle, "s")
	c2["email_verified"] = "false"
	id, err = e.v.Verify(ctx, ProviderApple, sign(t, e.aKey, "a1", c2))
	if err != nil || id.EmailVerified {
		t.Fatalf("email_verified=false 처리 오류: %+v %v", id, err)
	}

	bad := map[string]string{
		"aud":                  sign(t, e.aKey, "a1", e.claims("https://appleid.apple.com", "com.other.app", "s")),
		"iss":                  sign(t, e.aKey, "a1", e.claims("https://accounts.google.com", aBundle, "s")),
		"forged":               sign(t, genKey(t), "a1", e.claims("https://appleid.apple.com", aBundle, "s")),
		"google_key_for_apple": sign(t, e.gKey, "g1", e.claims("https://appleid.apple.com", aBundle, "s")),
	}
	exp := e.claims("https://appleid.apple.com", aBundle, "s")
	exp["exp"] = e.clk.t.Add(-time.Minute * 5).Unix()
	bad["expired"] = sign(t, e.aKey, "a1", exp)
	for name, tok := range bad {
		if _, err := e.v.Verify(ctx, ProviderApple, tok); !errors.Is(err, ErrProviderTokenInvalid) {
			t.Errorf("%s: 거부되어야 함: %v", name, err)
		}
	}
}

func TestGoogleTokenNotValidForApple(t *testing.T) {
	// 공급자 간 혼용: Google이 서명한 토큰을 apple 공급자로 검증하면 거부.
	e := newVerifierEnv(t)
	tok := sign(t, e.gKey, "g1", e.claims("https://accounts.google.com", gClient, "s"))
	if _, err := e.v.Verify(context.Background(), ProviderApple, tok); !errors.Is(err, ErrProviderTokenInvalid) {
		t.Fatalf("got %v", err)
	}
}

func kakaoBody(id, appID string) string {
	return `{"id":` + id + `,"app_id":` + appID + `,"expires_in":3600}`
}

func TestKakaoVerify(t *testing.T) {
	e := newVerifierEnv(t)
	ctx := context.Background()

	e.fp.set(tKakaoInfo, 200, kakaoBody("987654321", kApp))
	e.fp.set(tKakaoMe, 200, `{"id":987654321,"connected_at":"2024-01-01T00:00:00Z"}`)
	id, err := e.v.Verify(ctx, ProviderKakao, "opaque-token")
	if err != nil || id.Subject != "987654321" || id.Provider != ProviderKakao || id.Email != "" {
		t.Fatalf("정상: %+v %v", id, err)
	}
	if e.fp.authSeen[tKakaoInfo] != "Bearer opaque-token" || e.fp.authSeen[tKakaoMe] != "Bearer opaque-token" {
		t.Fatal("Authorization 헤더 전달 오류")
	}

	// 다른 앱에서 발급된 토큰(앱 ID 불일치)
	e.fp.set(tKakaoInfo, 200, kakaoBody("987654321", "999999"))
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderTokenInvalid)

	// 사용자 ID 불일치(token_info.id != user/me.id)
	e.fp.set(tKakaoInfo, 200, kakaoBody("111", kApp))
	e.fp.set(tKakaoMe, 200, `{"id":222}`)
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderTokenInvalid)

	// 비정상 ID 형식(문자열, 0, 음수, 소수)
	for _, bad := range []string{`"987"`, `0`, `-5`, `1.5`, `null`} {
		e.fp.set(tKakaoInfo, 200, `{"id":`+bad+`,"app_id":`+kApp+`}`)
		e.fp.set(tKakaoMe, 200, `{"id":`+bad+`}`)
		if _, err := e.v.Verify(ctx, ProviderKakao, "opaque-token"); !errors.Is(err, ErrProviderTokenInvalid) {
			t.Errorf("id=%s: got %v", bad, err)
		}
	}

	// app_id/id 누락
	e.fp.set(tKakaoInfo, 200, `{"id":5}`)
	e.fp.set(tKakaoMe, 200, `{"id":5}`)
	if _, err := e.v.Verify(ctx, ProviderKakao, "opaque-token"); !errors.Is(err, ErrProviderTokenInvalid) {
		t.Errorf("app_id 누락: %v", err)
	}

	// 토큰 무효(401/403/400) -> invalid, 공급자 5xx·네트워크 오류·깨진 JSON -> unavailable
	e.fp.set(tKakaoInfo, 200, kakaoBody("5", kApp))
	e.fp.set(tKakaoMe, 200, `{"id":5}`)
	for _, code := range []int{400, 401, 403} {
		e.fp.set(tKakaoInfo, code, `{"code":-401}`)
		_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
		wantErr(t, err, ErrProviderTokenInvalid)
	}
	for _, code := range []int{429, 500, 503} {
		e.fp.set(tKakaoInfo, code, ``)
		_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
		wantErr(t, err, ErrProviderUnavailable)
	}
	e.fp.set(tKakaoInfo, 200, `{broken`)
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderUnavailable)

	// user/me 단계 실패
	e.fp.set(tKakaoInfo, 200, kakaoBody("5", kApp))
	e.fp.set(tKakaoMe, 401, ``)
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderTokenInvalid)
	e.fp.set(tKakaoMe, 502, ``)
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderUnavailable)
	e.fp.failNet[tKakaoMe] = true
	_, err = e.v.Verify(ctx, ProviderKakao, "opaque-token")
	wantErr(t, err, ErrProviderUnavailable)
}

func TestKakaoAppIDConfigValidation(t *testing.T) {
	if _, err := NewProviderVerifier(ProviderVerifierConfig{KakaoAppID: "12ab"}); err == nil {
		t.Fatal("숫자가 아닌 앱 ID는 시작 시 실패해야 함")
	}
	if _, err := NewProviderVerifier(ProviderVerifierConfig{KakaoAppID: " 123 "}); err != nil {
		t.Fatalf("공백은 제거되어야 함: %v", err)
	}
}

func TestParseSocialMode(t *testing.T) {
	for in, want := range map[string]SocialMode{"off": SocialModeOff, " When_Present ": SocialModeWhenPresent, "REQUIRED": SocialModeRequired} {
		got, err := ParseSocialMode(in)
		if err != nil || got != want {
			t.Errorf("%q: %v %v", in, got, err)
		}
	}
	for _, bad := range []string{"", "warn", "on", "true"} {
		if _, err := ParseSocialMode(bad); err == nil {
			t.Errorf("%q는 에러여야 함", bad)
		}
	}
}

func TestParseAllowListAndProvider(t *testing.T) {
	got := ParseAllowList(" a ,, b,c ")
	if strings.Join(got, "|") != "a|b|c" {
		t.Fatalf("%v", got)
	}
	if len(ParseAllowList("")) != 0 {
		t.Fatal("빈 문자열은 빈 목록")
	}
	if p, err := ParseProvider(" Google "); err != nil || p != ProviderGoogle {
		t.Fatal("ParseProvider")
	}
	if _, err := ParseProvider("facebook"); err == nil {
		t.Fatal("지원하지 않는 공급자는 에러")
	}
}
