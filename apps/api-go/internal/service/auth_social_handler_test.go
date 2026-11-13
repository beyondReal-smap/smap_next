package service_test

// 핸들러 레벨 소셜 로그인 테스트: Android·iOS 앱이 실제로 보내는 요청 본문을 gin 라우터에 보내
// 상태코드·응답·검증 동작을 확인한다. 공급자(Google/Apple JWKS, Kakao API)는 로컬 RSA 키로 만든
// 가짜 공급자이며 실제 네트워크 호출은 없다.

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/service"
)

const (
	hGoogleJWKS = "https://fake.google.test/certs"
	hAppleJWKS  = "https://fake.apple.test/keys"
	hKakaoInfo  = "https://fake.kakao.test/info"
	hKakaoMe    = "https://fake.kakao.test/me"

	hWebClient = "web-client-id.apps.googleusercontent.com" // Android가 id_token을 받는 웹 클라이언트 ID
	hIOSClient = "ios-client-id.apps.googleusercontent.com" // iOS 클라이언트 ID
	hBundle    = "com.dmonster.smap"
	hKakaoApp  = "424242"
)

type hFake struct {
	mu     sync.Mutex
	bodies map[string]hResp
	calls  map[string]int
}
type hResp struct {
	code int
	body string
	err  bool
}

func (f *hFake) Do(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u := req.URL.String()
	f.calls[u]++
	r, ok := f.bodies[u]
	if !ok {
		return &http.Response{StatusCode: 404, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	if r.err {
		return nil, errors.New("down")
	}
	return &http.Response{StatusCode: r.code, Body: io.NopCloser(strings.NewReader(r.body))}, nil
}

func (f *hFake) set(u string, code int, body string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.bodies[u] = hResp{code: code, body: body}
}

func jwks(kid string, k *rsa.PrivateKey) string {
	b, _ := json.Marshal(map[string]any{"keys": []map[string]string{{
		"kty": "RSA", "kid": kid, "alg": "RS256", "use": "sig",
		"n": base64.RawURLEncoding.EncodeToString(k.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.E)).Bytes()),
	}}})
	return string(b)
}

type hEnv struct {
	r     *gin.Engine
	world *service.SocialTestWorld
	fp    *hFake
	logs  *bytes.Buffer
	gKey  *rsa.PrivateKey
	aKey  *rsa.PrivateKey
}

func newHEnv(t *testing.T, mode auth.SocialMode, ver auth.ProviderVerifierConfig) *hEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	gk, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	ak, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	fp := &hFake{bodies: map[string]hResp{}, calls: map[string]int{}}
	fp.set(hGoogleJWKS, 200, jwks("g1", gk))
	fp.set(hAppleJWKS, 200, jwks("a1", ak))
	ver.HTTP = fp
	ver.GoogleJWKSURL, ver.AppleJWKSURL, ver.KakaoTokenInfoURL, ver.KakaoUserMeURL = hGoogleJWKS, hAppleJWKS, hKakaoInfo, hKakaoMe
	v, err := auth.NewProviderVerifier(ver)
	if err != nil {
		t.Fatal(err)
	}
	logs := &bytes.Buffer{}
	world := service.NewSocialTestWorld(v, mode, slog.New(slog.NewJSONHandler(logs, nil)))
	h := handler.NewAuth(world.Svc, &config.Config{})
	r := gin.New()
	r.POST("/api/v1/auth/kakao-login", h.KakaoLogin)
	r.POST("/api/v1/auth/google-login", h.GoogleLogin)
	r.POST("/api/v1/auth/apple-login", h.AppleLogin)
	r.POST("/api/v1/members/google-login", h.GoogleLoginStrict)
	return &hEnv{r: r, world: world, fp: fp, logs: logs, gKey: gk, aKey: ak}
}

func fullCfg() auth.ProviderVerifierConfig {
	return auth.ProviderVerifierConfig{GoogleClientIDs: []string{hWebClient, hIOSClient}, AppleBundleIDs: []string{hBundle}, KakaoAppID: hKakaoApp}
}

func (e *hEnv) token(t *testing.T, key *rsa.PrivateKey, kid, iss, aud, sub, email string, mut func(jwt.MapClaims)) string {
	t.Helper()
	c := jwt.MapClaims{"iss": iss, "aud": aud, "sub": sub, "email": email, "email_verified": true,
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix()}
	if mut != nil {
		mut(c)
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, c)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func (e *hEnv) googleToken(t *testing.T, aud, sub, email string) string {
	return e.token(t, e.gKey, "g1", "https://accounts.google.com", aud, sub, email, nil)
}
func (e *hEnv) appleToken(t *testing.T, sub, email string) string {
	return e.token(t, e.aKey, "a1", "https://appleid.apple.com", hBundle, sub, email, nil)
}

func (e *hEnv) post(path, ua string, body any) (int, map[string]any, string) {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out, w.Body.String()
}

func dataOf(m map[string]any) map[string]any {
	d, _ := m["data"].(map[string]any)
	return d
}

// --- 앱이 보내는 요청 본문 ---

// Android GoogleLoginRequest(kotlinx.serialization, 기본값 포함 인코딩): null 필드는 생략, 나머지 기본값 포함.
func androidGoogleBody(idToken, googleID, email string) map[string]any {
	return map[string]any{
		"google_id": googleID, "email": email, "name": "안드로이드 사용자", "id_token": idToken,
		"lookup_strategy": "email_first", "search_by_email": true, "verify_email_match": true,
		"email_first_lookup": true, "lookup_priority": "email",
	}
}

// iOS GoogleLoginRequest(JSONEncoder): nil 생략, lookup_* 포함.
func iosGoogleBody(idToken, googleID, email string) map[string]any {
	return map[string]any{
		"google_id": googleID, "email": email, "name": "iOS 사용자", "id_token": idToken,
		"lookup_strategy": "email_first", "search_by_email": true, "verify_email_match": true,
		"email_first_lookup": true, "lookup_priority": "email",
	}
}

// Android KakaoLoginRequest: kakao_id/nickname은 빈 문자열일 수 있다(기본값).
func androidKakaoBody(accessToken, kakaoID, email string) map[string]any {
	b := map[string]any{"kakao_id": kakaoID, "nickname": "", "access_token": accessToken, "lookup_strategy": "email_first"}
	if email != "" {
		b["email"] = email
	}
	return b
}

// iOS KakaoLoginRequest.
func iosKakaoBody(accessToken, kakaoID, email string) map[string]any {
	return map[string]any{"kakao_id": kakaoID, "email": email, "nickname": "카카오", "access_token": accessToken, "os_type": "ios"}
}

// iOS AppleLoginRequest.
func iosAppleBody(sub, email, identityToken string) map[string]any {
	return map[string]any{"userIdentifier": sub, "email": email, "userName": "애플 사용자", "identityToken": identityToken, "authorizationCode": "auth-code"}
}

func (e *hEnv) kakaoOK(id string) {
	e.fp.set(hKakaoInfo, 200, `{"id":`+id+`,"app_id":`+hKakaoApp+`,"expires_in":3600}`)
	e.fp.set(hKakaoMe, 200, `{"id":`+id+`}`)
}

const (
	androidUA = "SMAP-Android/3.2.8 (Pixel 7; Android 14)"
	iosUA     = "SMAP-iOS/3.2.8 (iPhone15,2; iOS 18.0)"
)

// --- 정상 흐름 ---

func TestHandlerGoogleBothAppsExistingMember(t *testing.T) {
	for _, tc := range []struct {
		name, aud, ua string
		body          func(tok, gid, email string) map[string]any
	}{
		{"android(웹 클라이언트 ID)", hWebClient, androidUA, androidGoogleBody},
		{"ios(iOS 클라이언트 ID)", hIOSClient, iosUA, iosGoogleBody},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
			e.world.AddMember(10, "me@x.com", 2, 1, "", "g-sub-1", "")
			tok := e.googleToken(t, tc.aud, "g-sub-1", "me@x.com")
			code, out, raw := e.post("/api/v1/auth/google-login", tc.ua, tc.body(tok, "client-sent-id-ignored", "me@x.com"))
			d := dataOf(out)
			if code != 200 || out["success"] != true || d["token"] == "" || d["refresh_token"] != "refresh-raw" || d["expires_in"] == nil || d["is_new_user"] != false {
				t.Fatalf("정상 로그인 응답 오류: %d %s", code, raw)
			}
			if strings.Contains(e.logs.String(), tok) || strings.Contains(raw, tok) {
				t.Fatal("토큰이 로그/응답에 노출됨")
			}
		})
	}
}

func TestHandlerGoogleNewUserThenEmailCollision(t *testing.T) {
	e := newHEnv(t, auth.SocialModeRequired, fullCfg())
	// 신규 공급자 ID + 겹치지 않는 이메일 -> 신규 사용자 흐름(기존 응답 형식)
	tok := e.googleToken(t, hWebClient, "g-new", "fresh@x.com")
	code, out, raw := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody(tok, "g-new", "fresh@x.com"))
	d := dataOf(out)
	if code != 200 || out["success"] != true || d["is_new_user"] != true || d["isNewUser"] != true || d["token"] != nil {
		t.Fatalf("신규 사용자 응답: %d %s", code, raw)
	}
	// 같은 이메일을 쓰는 활성 계정이 있으면 success=false + 안내 문구(200)
	e.world.AddMember(11, "taken@x.com", 2, 1, "", "", "")
	tok = e.googleToken(t, hWebClient, "g-attacker", "taken@x.com")
	code, out, raw = e.post("/api/v1/auth/google-login", iosUA, iosGoogleBody(tok, "g-attacker", "taken@x.com"))
	if code != 200 || out["success"] != false || out["message"] != "이미 이 이메일로 가입된 계정이 있어요. 이메일과 비밀번호로 로그인해 주세요." {
		t.Fatalf("이메일 겹침 안내 오류: %d %s", code, raw)
	}
	if e.world.Wrote() {
		t.Fatal("자동 연결/로그인 쓰기가 발생함")
	}
}

func TestHandlerAppleIOS(t *testing.T) {
	e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
	e.world.AddMember(12, "ap@x.com", 2, 1, "", "", "apple-sub-1")
	tok := e.appleToken(t, "apple-sub-1", "ap@x.com")
	code, out, raw := e.post("/api/v1/auth/apple-login", iosUA, iosAppleBody("spoofed-id", "ap@x.com", tok))
	d := dataOf(out)
	if code != 200 || out["success"] != true || d["token"] == "" || d["refresh_token"] != "refresh-raw" || d["is_new_user"] != false {
		t.Fatalf("Apple 로그인: %d %s", code, raw)
	}
	// 위조(다른 키 서명)
	bad := e.token(t, mustKey(t), "a1", "https://appleid.apple.com", hBundle, "apple-sub-1", "ap@x.com", nil)
	code, out, _ = e.post("/api/v1/auth/apple-login", iosUA, iosAppleBody("apple-sub-1", "ap@x.com", bad))
	if code != 401 || out["detail"] != "소셜 인증 토큰이 유효하지 않습니다." {
		t.Fatalf("Apple 위조 토큰은 401이어야 함: %d %v", code, out)
	}
}

func mustKey(t *testing.T) *rsa.PrivateKey {
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func TestHandlerKakaoBothApps(t *testing.T) {
	for _, tc := range []struct {
		name, ua string
		body     func(tok, id, email string) map[string]any
	}{
		{"android(kakao_id 비어 있음)", androidUA, androidKakaoBody},
		{"ios", iosUA, iosKakaoBody},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
			e.world.AddMember(13, "k@x.com", 2, 1, "9001", "", "")
			e.kakaoOK("9001")
			clientID := ""
			if tc.name == "ios" {
				clientID = "7777777" // 클라이언트가 보낸 ID는 서버가 검증값으로 덮어쓴다
			}
			code, out, raw := e.post("/api/v1/auth/kakao-login", tc.ua, tc.body("kakao-access-token", clientID, ""))
			d := dataOf(out)
			if code != 200 || out["success"] != true || d["token"] == "" || d["refresh_token"] != "refresh-raw" || d["isNewUser"] != false {
				t.Fatalf("카카오 정상: %d %s", code, raw)
			}
			if strings.Contains(e.logs.String(), "kakao-access-token") {
				t.Fatal("카카오 토큰이 로그에 노출됨")
			}
		})
	}
}

// --- 거부 ---

func TestHandlerRejections(t *testing.T) {
	e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
	e.world.AddMember(14, "me@x.com", 2, 1, "9001", "g-sub-1", "")
	e.kakaoOK("9001")

	type rc struct {
		name, path string
		body       map[string]any
		want       int
	}
	forged := e.token(t, mustKey(t), "g1", "https://accounts.google.com", hWebClient, "g-sub-1", "me@x.com", nil)
	expired := e.token(t, e.gKey, "g1", "https://accounts.google.com", hWebClient, "g-sub-1", "me@x.com", func(c jwt.MapClaims) {
		c["exp"] = time.Now().Add(-time.Hour).Unix()
		c["iat"] = time.Now().Add(-2 * time.Hour).Unix()
	})
	wrongAud := e.googleToken(t, "attacker-app.apps.googleusercontent.com", "g-sub-1", "me@x.com")
	wrongIss := e.token(t, e.gKey, "g1", "https://evil.example", hWebClient, "g-sub-1", "me@x.com", nil)
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"iss": "https://accounts.google.com", "aud": hWebClient, "sub": "g-sub-1", "exp": time.Now().Add(time.Hour).Unix()}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	hs := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"iss": "https://accounts.google.com", "aud": hWebClient, "sub": "g-sub-1", "exp": time.Now().Add(time.Hour).Unix()})
	hs.Header["kid"] = "g1"
	hsTok, _ := hs.SignedString(e.gKey.N.Bytes())

	for _, c := range []rc{
		{"google 위조 서명", "/api/v1/auth/google-login", androidGoogleBody(forged, "g-sub-1", "me@x.com"), 401},
		{"google 만료", "/api/v1/auth/google-login", androidGoogleBody(expired, "g-sub-1", "me@x.com"), 401},
		{"google aud 불일치", "/api/v1/auth/google-login", androidGoogleBody(wrongAud, "g-sub-1", "me@x.com"), 401},
		{"google iss 불일치", "/api/v1/auth/google-login", androidGoogleBody(wrongIss, "g-sub-1", "me@x.com"), 401},
		{"google alg=none", "/api/v1/auth/google-login", androidGoogleBody(none, "g-sub-1", "me@x.com"), 401},
		{"google alg=HS256", "/api/v1/auth/google-login", androidGoogleBody(hsTok, "g-sub-1", "me@x.com"), 401},
		{"members/google 위조", "/api/v1/members/google-login", androidGoogleBody(forged, "g-sub-1", "me@x.com"), 401},
	} {
		code, out, raw := e.post(c.path, androidUA, c.body)
		if code != c.want || out["detail"] != "소셜 인증 토큰이 유효하지 않습니다." {
			t.Errorf("%s: %d %s", c.name, code, raw)
		}
	}

	// Kakao: 앱 ID 불일치, 사용자 ID 불일치, 토큰 무효(401), 공급자 장애(502)
	e.fp.set(hKakaoInfo, 200, `{"id":9001,"app_id":1}`)
	if code, out, _ := e.post("/api/v1/auth/kakao-login", androidUA, androidKakaoBody("t", "", "")); code != 401 || out["detail"] == nil {
		t.Errorf("kakao 앱 ID 불일치: %d", code)
	}
	e.fp.set(hKakaoInfo, 200, `{"id":9001,"app_id":`+hKakaoApp+`}`)
	e.fp.set(hKakaoMe, 200, `{"id":9002}`)
	if code, _, _ := e.post("/api/v1/auth/kakao-login", iosUA, iosKakaoBody("t", "9001", "")); code != 401 {
		t.Errorf("kakao 사용자 ID 불일치: %d", code)
	}
	e.fp.set(hKakaoInfo, 401, `{"code":-401}`)
	if code, _, _ := e.post("/api/v1/auth/kakao-login", iosUA, iosKakaoBody("t", "9001", "")); code != 401 {
		t.Errorf("kakao 무효 토큰: %d", code)
	}
	e.fp.set(hKakaoInfo, 500, ``)
	code, out, _ := e.post("/api/v1/auth/kakao-login", iosUA, iosKakaoBody("t", "9001", ""))
	if code != 502 || out["detail"] != "소셜 인증 서비스를 사용할 수 없습니다." {
		t.Errorf("kakao 공급자 장애는 502: %d %v", code, out)
	}
	if e.world.Wrote() {
		t.Fatal("검증 실패 요청이 회원 행을 변경함")
	}
}

func TestHandlerJWKSOutageIs502(t *testing.T) {
	e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
	tok := e.googleToken(t, hWebClient, "s", "a@x.com")
	e.fp.set(hGoogleJWKS, 500, "")
	code, out, _ := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody(tok, "s", "a@x.com"))
	if code != 502 || out["detail"] != "소셜 인증 서비스를 사용할 수 없습니다." {
		t.Fatalf("%d %v", code, out)
	}
}

// --- 설정 비어 있음: 모드별 ---

func TestHandlerEmptyAllowListsByMode(t *testing.T) {
	// 허용 목록 전부 비어 있는 서버에서 같은 요청이 모드에 따라 어떻게 되는지
	type res struct{ withToken, noToken int }
	got := map[auth.SocialMode]res{}
	for _, mode := range []auth.SocialMode{auth.SocialModeOff, auth.SocialModeWhenPresent, auth.SocialModeRequired} {
		e := newHEnv(t, mode, auth.ProviderVerifierConfig{})
		tok := e.googleToken(t, hWebClient, "s", "a@x.com")
		c1, _, _ := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody(tok, "s", "a@x.com"))
		c2, _, _ := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody("", "s", "a@x.com"))
		got[mode] = res{c1, c2}
	}
	want := map[auth.SocialMode]res{
		auth.SocialModeOff:         {200, 200}, // 검증 안 함
		auth.SocialModeWhenPresent: {503, 200}, // 토큰이 있는데 검증 설정이 없음 -> 503, 토큰 없음 -> 기존 동작
		auth.SocialModeRequired:    {503, 503},
	}
	for m, w := range want {
		if got[m] != w {
			t.Errorf("%s: got %+v want %+v", m, got[m], w)
		}
	}
}

// --- 모드 × 토큰 유무 (핸들러 레벨) ---

func TestHandlerModeMatrix(t *testing.T) {
	for _, mode := range []auth.SocialMode{auth.SocialModeOff, auth.SocialModeWhenPresent, auth.SocialModeRequired} {
		t.Run(string(mode), func(t *testing.T) {
			e := newHEnv(t, mode, fullCfg())
			e.world.AddMember(20, "me@x.com", 2, 1, "", "g-sub-1", "")
			valid := e.googleToken(t, hWebClient, "g-sub-1", "me@x.com")
			forged := e.token(t, mustKey(t), "g1", "https://accounts.google.com", hWebClient, "g-sub-1", "me@x.com", nil)

			// 유효 토큰: 항상 200 로그인
			code, out, _ := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody(valid, "g-sub-1", "me@x.com"))
			if code != 200 || out["success"] != true {
				t.Errorf("유효 토큰: %d %v", code, out)
			}
			// 위조 토큰: off는 검증하지 않아 구버전과 같이 처리(요청의 google_id로 로그인), 그 외는 401
			code, out, _ = e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody(forged, "g-sub-1", "me@x.com"))
			if mode == auth.SocialModeOff {
				if code != 200 || out["success"] != true {
					t.Errorf("off 위조 토큰: %d %v", code, out)
				}
			} else if code != 401 {
				t.Errorf("위조 토큰은 401: %d", code)
			}
			// 토큰 없음: required만 401, 나머지는 기존 동작(google_id로 로그인)
			code, out, _ = e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody("", "g-sub-1", "me@x.com"))
			if mode == auth.SocialModeRequired {
				if code != 401 {
					t.Errorf("required 토큰 없음: %d", code)
				}
			} else if code != 200 || out["success"] != true {
				t.Errorf("%s 토큰 없음(기존 동작): %d %v", mode, code, out)
			}
			// id_token 필드 자체가 없는 구버전 본문
			legacy := androidGoogleBody("", "g-sub-1", "me@x.com")
			delete(legacy, "id_token")
			code, _, _ = e.post("/api/v1/auth/google-login", androidUA, legacy)
			if (mode == auth.SocialModeRequired) != (code == 401) {
				t.Errorf("id_token 필드 없음: %d", code)
			}
		})
	}
}

func TestHandlerWhenPresentTokenlessWarnsWithoutSensitiveData(t *testing.T) {
	e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
	e.world.AddMember(21, "me@x.com", 2, 1, "", "g-sub-1", "")
	code, _, _ := e.post("/api/v1/auth/google-login", androidUA, androidGoogleBody("", "g-sub-1", "me@x.com"))
	if code != 200 {
		t.Fatal(code)
	}
	out := e.logs.String()
	if !strings.Contains(out, "social login without provider token") || !strings.Contains(out, `"provider":"google"`) || !strings.Contains(out, "SMAP-Android/3.2.8") {
		t.Fatalf("경고 계측 로그 누락: %s", out)
	}
	for _, leak := range []string{"g-sub-1", "me@x.com", "Pixel"} {
		if strings.Contains(out, leak) {
			t.Fatalf("로그에 %q 노출", leak)
		}
	}
}

// --- 토큰 없는 요청이 이메일만으로 남의 계정을 얻지 못함(자동 연결 금지) ---

func TestHandlerTokenlessEmailTakeoverBlocked(t *testing.T) {
	e := newHEnv(t, auth.SocialModeWhenPresent, fullCfg())
	e.world.AddMember(30, "victim@x.com", 2, 1, "", "", "")
	for name, c := range map[string]struct {
		path string
		body map[string]any
	}{
		"google": {"/api/v1/auth/google-login", androidGoogleBody("", "attacker-id", "victim@x.com")},
		"apple":  {"/api/v1/auth/apple-login", iosAppleBody("attacker-apple", "victim@x.com", "")},
		"kakao":  {"/api/v1/auth/kakao-login", androidKakaoBody("", "attacker-kakao", "victim@x.com")},
	} {
		code, out, raw := e.post(c.path, androidUA, c.body)
		if code != 200 || out["success"] != false || out["message"] != "이미 이 이메일로 가입된 계정이 있어요. 이메일과 비밀번호로 로그인해 주세요." {
			t.Errorf("%s: %d %s", name, code, raw)
		}
		if strings.Contains(raw, `"token"`) {
			t.Errorf("%s: 토큰이 발급됨", name)
		}
	}
	if e.world.Wrote() {
		t.Fatal("피해자 계정에 쓰기가 발생함")
	}
}

// --- 탈퇴·정지 회원 ---

func TestHandlerWithdrawnAndSuspendedRejected(t *testing.T) {
	e := newHEnv(t, auth.SocialModeRequired, fullCfg())
	e.world.AddMember(40, "w1@x.com", 1, 1, "", "g-gone", "")
	e.world.AddMember(41, "w2@x.com", 1, 1, "", "", "apple-gone")
	e.world.AddMember(42, "w3@x.com", 1, 1, "5555", "", "")
	e.world.AddMember(43, "s1@x.com", 2, 2, "", "g-susp", "")
	e.kakaoOK("5555")

	check := func(name, path string, body map[string]any, msg string) {
		code, out, raw := e.post(path, iosUA, body)
		if code != 200 || out["success"] != false || out["message"] != msg || strings.Contains(raw, `"token"`) {
			t.Errorf("%s: %d %s", name, code, raw)
		}
	}
	inactive := "비활성화된 계정입니다. 고객센터에 문의해주세요."
	check("google 탈퇴", "/api/v1/auth/google-login", iosGoogleBody(e.googleToken(t, hIOSClient, "g-gone", "w1@x.com"), "", ""), inactive)
	check("apple 탈퇴", "/api/v1/auth/apple-login", iosAppleBody("", "", e.appleToken(t, "apple-gone", "w2@x.com")), inactive)
	check("kakao 탈퇴", "/api/v1/auth/kakao-login", iosKakaoBody("t", "", ""), "탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.")
	check("google 정지", "/api/v1/auth/google-login", iosGoogleBody(e.googleToken(t, hIOSClient, "g-susp", "s1@x.com"), "", ""), inactive)
}

// --- /members/google-login ---

func TestHandlerMembersGoogleLoginVerified(t *testing.T) {
	e := newHEnv(t, auth.SocialModeRequired, fullCfg())
	e.world.AddMember(50, "m@x.com", 2, 1, "", "g-m", "")
	tok := e.googleToken(t, hWebClient, "g-m", "m@x.com")
	code, out, raw := e.post("/api/v1/members/google-login", androidUA, androidGoogleBody(tok, "g-m", "m@x.com"))
	if code != 200 || out["success"] != true {
		t.Fatalf("members/google-login 정상: %d %s", code, raw)
	}
	// 필수 필드 누락은 기존대로 422(검증보다 먼저)
	code, _, _ = e.post("/api/v1/members/google-login", androidUA, map[string]any{"id_token": tok})
	if code != 422 {
		t.Fatalf("422 기대: %d", code)
	}
}

// --- 서버 설정 오류는 숨기지 않음: kakao 앱 ID 설정 형식 ---

func TestKakaoAppIDMustBeNumeric(t *testing.T) {
	if _, err := auth.NewProviderVerifier(auth.ProviderVerifierConfig{KakaoAppID: "abc"}); err == nil {
		t.Fatal("숫자가 아닌 KAKAO_ALLOWED_APP_ID는 에러")
	}
}
