package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Provider는 소셜 로그인 공급자 식별자다.
type Provider string

const (
	ProviderGoogle Provider = "google"
	ProviderApple  Provider = "apple"
	ProviderKakao  Provider = "kakao"
)

// ParseProvider는 "google"|"apple"|"kakao"(대소문자·공백 허용)를 Provider로 바꾼다.
func ParseProvider(raw string) (Provider, error) {
	switch p := Provider(strings.ToLower(strings.TrimSpace(raw))); p {
	case ProviderGoogle, ProviderApple, ProviderKakao:
		return p, nil
	default:
		return "", fmt.Errorf("지원하지 않는 소셜 공급자입니다: %q", raw)
	}
}

// 검증 실패 종류. 호출자는 errors.Is로 구분해 HTTP 상태로 옮긴다.
//
//	ErrProviderTokenInvalid  -> 401 (위조·만료·aud/iss 불일치·형식 오류·Kakao 앱/사용자 ID 불일치)
//	ErrProviderNotConfigured -> 503 (해당 공급자의 허용 목록 설정이 비어 있음)
//	ErrProviderUnavailable   -> 502 (공급자 키/API 호출 실패·비정상 응답)
var (
	ErrProviderTokenInvalid  = errors.New("소셜 인증 토큰이 유효하지 않습니다")
	ErrProviderNotConfigured = errors.New("소셜 로그인 설정이 필요합니다")
	ErrProviderUnavailable   = errors.New("소셜 인증 서비스를 사용할 수 없습니다")
)

// ProviderIdentity는 공급자 토큰에서 검증된 신원이다. 호출자는 클라이언트가 보낸 ID/이메일 대신
// 이 값만 계정 식별에 사용해야 한다.
type ProviderIdentity struct {
	Provider Provider
	// Subject는 공급자 사용자 ID(Google/Apple sub, Kakao id의 10진 문자열).
	Subject string
	// Email은 토큰에 담긴 이메일(없을 수 있음). EmailVerified가 true일 때만 신뢰할 수 있다.
	// Kakao는 이메일을 제공하지 않는다(항상 빈 값).
	Email         string
	EmailVerified bool
	// 표시용 부가 정보(Google claim). 보안 판단에 쓰지 않는다.
	Name      string
	GivenName string
	Picture   string
}

// HTTPDoer는 공급자 HTTP 호출 추상화다(테스트에서 가짜 공급자를 주입한다).
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

const (
	defaultGoogleJWKSURL     = "https://www.googleapis.com/oauth2/v3/certs"
	defaultAppleJWKSURL      = "https://appleid.apple.com/auth/keys"
	defaultKakaoTokenInfoURL = "https://kapi.kakao.com/v1/user/access_token_info"
	defaultKakaoUserMeURL    = "https://kapi.kakao.com/v2/user/me"

	appleIssuer = "https://appleid.apple.com"

	defaultKeyCacheTTL     = time.Hour
	defaultKidMissCooldown = 30 * time.Second
	defaultHTTPTimeout     = 5 * time.Second
	defaultMaxBodyBytes    = 1 << 20 // 1 MiB: JWKS/Kakao 응답 상한
	maxProviderTokenLen    = 8192
	jwtLeeway              = 60 * time.Second
	minRSAKeyBits          = 2048
)

// ProviderVerifierConfig는 ProviderVerifier 설정이다. 허용 목록이 비어 있으면 그 공급자는
// Verify에서 ErrProviderNotConfigured를 돌려준다(검증을 조용히 건너뛰지 않는다).
type ProviderVerifierConfig struct {
	GoogleClientIDs []string // GOOGLE_ALLOWED_CLIENT_IDS (aud 허용 목록)
	AppleBundleIDs  []string // APPLE_ALLOWED_BUNDLE_IDS (aud 허용 목록)
	KakaoAppID      string   // KAKAO_ALLOWED_APP_ID (숫자)

	// HTTP는 공급자 호출 클라이언트. nil이면 타임아웃이 있는 기본 http.Client.
	HTTP HTTPDoer
	// Timeout은 공급자 호출 1건의 상한(기본 5초).
	Timeout time.Duration
	// Now는 시간 원천(기본 time.Now). 테스트에서 주입한다.
	Now func() time.Time
	// KeyCacheTTL은 JWKS 캐시 수명(기본 1시간).
	KeyCacheTTL time.Duration
	// KidMissCooldown은 kid 미스 시 재조회 허용 간격(기본 30초). 임의 kid로 공급자를 두드리는 것을 막는다.
	KidMissCooldown time.Duration
	// MaxBodyBytes는 공급자 응답 본문 상한(기본 1MiB).
	MaxBodyBytes int64

	// 아래 URL은 테스트용 재정의(비어 있으면 공급자 공식 주소).
	GoogleJWKSURL     string
	AppleJWKSURL      string
	KakaoTokenInfoURL string
	KakaoUserMeURL    string
}

// ProviderVerifier는 Google id_token / Apple identityToken / Kakao access_token을 검증한다.
// 동시 호출에 안전하다.
type ProviderVerifier struct {
	cfg    ProviderVerifierConfig
	google *jwksCache
	apple  *jwksCache
}

// NewProviderVerifier는 설정을 검증해 검증기를 만든다. KakaoAppID가 숫자가 아니면 에러.
func NewProviderVerifier(cfg ProviderVerifierConfig) (*ProviderVerifier, error) {
	cfg.GoogleClientIDs = cleanList(cfg.GoogleClientIDs)
	cfg.AppleBundleIDs = cleanList(cfg.AppleBundleIDs)
	cfg.KakaoAppID = strings.TrimSpace(cfg.KakaoAppID)
	if err := ValidateKakaoAppID(cfg.KakaoAppID); err != nil {
		return nil, err
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: defaultHTTPTimeout}
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultHTTPTimeout
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if cfg.KeyCacheTTL <= 0 {
		cfg.KeyCacheTTL = defaultKeyCacheTTL
	}
	if cfg.KidMissCooldown <= 0 {
		cfg.KidMissCooldown = defaultKidMissCooldown
	}
	if cfg.MaxBodyBytes <= 0 {
		cfg.MaxBodyBytes = defaultMaxBodyBytes
	}
	if cfg.GoogleJWKSURL == "" {
		cfg.GoogleJWKSURL = defaultGoogleJWKSURL
	}
	if cfg.AppleJWKSURL == "" {
		cfg.AppleJWKSURL = defaultAppleJWKSURL
	}
	if cfg.KakaoTokenInfoURL == "" {
		cfg.KakaoTokenInfoURL = defaultKakaoTokenInfoURL
	}
	if cfg.KakaoUserMeURL == "" {
		cfg.KakaoUserMeURL = defaultKakaoUserMeURL
	}
	return &ProviderVerifier{cfg: cfg, google: &jwksCache{}, apple: &jwksCache{}}, nil
}

// ValidateKakaoAppID는 KAKAO_ALLOWED_APP_ID 형식(비어 있거나 ASCII 숫자)을 검사한다.
func ValidateKakaoAppID(v string) error {
	if v == "" {
		return nil
	}
	for _, r := range v {
		if r < '0' || r > '9' {
			return fmt.Errorf("KAKAO_ALLOWED_APP_ID는 숫자여야 합니다")
		}
	}
	return nil
}

// ParseAllowList는 쉼표 구분 설정값을 공백 제거한 목록으로 바꾼다(빈 항목 제거).
func ParseAllowList(raw string) []string {
	return cleanList(strings.Split(raw, ","))
}

func cleanList(in []string) []string {
	out := make([]string, 0, len(in))
	for _, v := range in {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// Configured는 해당 공급자의 허용 목록 설정이 있는지 알려 준다(모드 판정용).
func (v *ProviderVerifier) Configured(p Provider) bool {
	switch p {
	case ProviderGoogle:
		return len(v.cfg.GoogleClientIDs) > 0
	case ProviderApple:
		return len(v.cfg.AppleBundleIDs) > 0
	case ProviderKakao:
		return v.cfg.KakaoAppID != ""
	default:
		return false
	}
}

// Verify는 공급자 토큰을 검증하고 신원을 돌려준다. 에러는 ErrProviderTokenInvalid /
// ErrProviderNotConfigured / ErrProviderUnavailable 중 하나다(errors.Is). 토큰·ID·이메일은
// 에러 메시지에 담지 않는다. 설정 검사가 토큰 검사보다 먼저다.
func (v *ProviderVerifier) Verify(ctx context.Context, p Provider, token string) (*ProviderIdentity, error) {
	if !v.Configured(p) {
		if p != ProviderGoogle && p != ProviderApple && p != ProviderKakao {
			return nil, fmt.Errorf("%w: 알 수 없는 공급자", ErrProviderTokenInvalid)
		}
		return nil, ErrProviderNotConfigured
	}
	if token == "" || len(token) > maxProviderTokenLen || !printableASCII(token) {
		return nil, ErrProviderTokenInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, v.cfg.Timeout)
	defer cancel()
	switch p {
	case ProviderGoogle:
		return v.verifyJWT(ctx, p, token, v.google, v.cfg.GoogleJWKSURL, v.cfg.GoogleClientIDs)
	case ProviderApple:
		return v.verifyJWT(ctx, p, token, v.apple, v.cfg.AppleJWKSURL, v.cfg.AppleBundleIDs)
	default:
		return v.verifyKakao(ctx, token)
	}
}

// printableASCII는 헤더 주입(CR/LF)·제어문자·공백을 거른다. JWT/Kakao 토큰은 모두 공백 없는 ASCII다.
func printableASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] <= 0x20 || s[i] >= 0x7f {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------
// Google / Apple (JWKS + RS256)
// ---------------------------------------------------------------------------

func (v *ProviderVerifier) verifyJWT(ctx context.Context, p Provider, token string, cache *jwksCache, jwksURL string, audiences []string) (*ProviderIdentity, error) {
	var keyErr error // 키 조회 실패(공급자 장애)를 토큰 무효와 구분하기 위해 보관
	keyfunc := func(t *jwt.Token) (interface{}, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("kid 없음")
		}
		key, err := v.lookupKey(ctx, cache, jwksURL, kid)
		if err != nil {
			keyErr = err
			return nil, err
		}
		return key, nil
	}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"RS256"}), // alg=none/HS256 등 거부(키 혼동 방지)
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(jwtLeeway),
		jwt.WithTimeFunc(v.cfg.Now),
	)
	claims := jwt.MapClaims{}
	if _, err := parser.ParseWithClaims(token, claims, keyfunc); err != nil {
		if keyErr != nil && errors.Is(keyErr, ErrProviderUnavailable) {
			return nil, ErrProviderUnavailable
		}
		return nil, ErrProviderTokenInvalid
	}

	iss, _ := claims["iss"].(string)
	if !issuerAllowed(p, iss) {
		return nil, ErrProviderTokenInvalid
	}
	if !audienceAllowed(claims, audiences) {
		return nil, ErrProviderTokenInvalid
	}
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return nil, ErrProviderTokenInvalid
	}
	id := &ProviderIdentity{Provider: p, Subject: sub}
	id.Email, _ = claims["email"].(string)
	id.EmailVerified = claimTrue(claims["email_verified"])
	id.Name, _ = claims["name"].(string)
	id.GivenName, _ = claims["given_name"].(string)
	id.Picture, _ = claims["picture"].(string)
	return id, nil
}

func issuerAllowed(p Provider, iss string) bool {
	switch p {
	case ProviderGoogle:
		return iss == "https://accounts.google.com" || iss == "accounts.google.com"
	case ProviderApple:
		return iss == appleIssuer
	}
	return false
}

// audienceAllowed: aud(문자열 또는 배열) 중 하나라도 허용 목록에 있으면 true.
func audienceAllowed(claims jwt.MapClaims, allowed []string) bool {
	aud, err := claims.GetAudience()
	if err != nil || len(aud) == 0 {
		return false
	}
	for _, a := range aud {
		for _, ok := range allowed {
			if a == ok {
				return true
			}
		}
	}
	return false
}

// claimTrue: Google은 bool, Apple은 bool 또는 "true" 문자열을 쓴다.
func claimTrue(v interface{}) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true"
	}
	return false
}

// jwksCache는 공급자 한 곳의 RSA 공개키 캐시다.
type jwksCache struct {
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

// lookupKey는 kid에 맞는 공개키를 돌려준다.
//   - 캐시가 없거나 TTL이 지났으면 조회한다.
//   - 캐시가 유효한데 kid가 없으면, 마지막 조회가 KidMissCooldown보다 오래됐을 때만 1회 재조회한다.
//
// 조회 실패는 ErrProviderUnavailable, kid 부재는 ErrProviderTokenInvalid.
func (v *ProviderVerifier) lookupKey(ctx context.Context, c *jwksCache, url, kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := v.cfg.Now()

	fresh := c.keys != nil && now.Sub(c.fetchedAt) < v.cfg.KeyCacheTTL
	if fresh {
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
		if now.Sub(c.fetchedAt) < v.cfg.KidMissCooldown {
			return nil, ErrProviderTokenInvalid
		}
	}
	keys, err := v.fetchJWKS(ctx, url)
	if err != nil {
		return nil, err
	}
	c.keys, c.fetchedAt = keys, now
	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return nil, ErrProviderTokenInvalid
}

type jwksDoc struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func (v *ProviderVerifier) fetchJWKS(ctx context.Context, url string) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	resp, err := v.cfg.HTTP.Do(req)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, ErrProviderUnavailable
	}
	var doc jwksDoc
	if err := json.NewDecoder(io.LimitReader(resp.Body, v.cfg.MaxBodyBytes)).Decode(&doc); err != nil {
		return nil, ErrProviderUnavailable
	}
	keys := make(map[string]*rsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		pub, err := rsaKeyFromJWK(k.N, k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = pub
	}
	if len(keys) == 0 {
		return nil, ErrProviderUnavailable
	}
	return keys, nil
}

func rsaKeyFromJWK(nB64, eB64 string) (*rsa.PublicKey, error) {
	nb, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eb, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(nb)
	e := new(big.Int).SetBytes(eb)
	if n.BitLen() < minRSAKeyBits || !e.IsInt64() || e.Int64() < 3 || e.Int64() > 1<<31-1 {
		return nil, errors.New("부적절한 RSA 키")
	}
	return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
}

// ---------------------------------------------------------------------------
// Kakao (access_token_info + user/me)
// ---------------------------------------------------------------------------

// Kakao 응답의 id/app_id는 원문 그대로 받아 직접 해석한다(따옴표 문자열·소수 등을 숫자로 오인하지 않기 위함).
type kakaoTokenInfo struct {
	ID    json.RawMessage `json:"id"`
	AppID json.RawMessage `json:"app_id"`
}

type kakaoUserMe struct {
	ID json.RawMessage `json:"id"`
}

// verifyKakao: ① access_token_info의 app_id가 허용 앱 ID인지, ② user/me의 id가 token_info의 id와 같은지 확인한다.
func (v *ProviderVerifier) verifyKakao(ctx context.Context, token string) (*ProviderIdentity, error) {
	var info kakaoTokenInfo
	if err := v.kakaoGet(ctx, v.cfg.KakaoTokenInfoURL, token, &info); err != nil {
		return nil, err
	}
	// app_id는 숫자(또는 숫자 문자열)로 오며 설정된 앱 ID와 정확히 같아야 한다.
	if strings.Trim(string(info.AppID), `"`) != v.cfg.KakaoAppID {
		return nil, ErrProviderTokenInvalid
	}
	infoID, ok := positiveIntString(info.ID)
	if !ok {
		return nil, ErrProviderTokenInvalid
	}
	var me kakaoUserMe
	if err := v.kakaoGet(ctx, v.cfg.KakaoUserMeURL, token, &me); err != nil {
		return nil, err
	}
	meID, ok := positiveIntString(me.ID)
	if !ok || meID != infoID {
		return nil, ErrProviderTokenInvalid
	}
	return &ProviderIdentity{Provider: ProviderKakao, Subject: meID}, nil
}

// positiveIntString은 JSON 원문이 따옴표 없는 양의 정수(10진)일 때 그 문자열을 돌려준다.
func positiveIntString(raw json.RawMessage) (string, bool) {
	s := string(raw)
	if s == "" || s[0] == '0' {
		return "", false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return "", false
		}
	}
	return s, true
}

func (v *ProviderVerifier) kakaoGet(ctx context.Context, url, token string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ErrProviderUnavailable
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := v.cfg.HTTP.Do(req)
	if err != nil {
		return ErrProviderUnavailable
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden:
		return ErrProviderTokenInvalid
	default:
		return ErrProviderUnavailable
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, v.cfg.MaxBodyBytes)).Decode(out); err != nil {
		return ErrProviderUnavailable
	}
	return nil
}
