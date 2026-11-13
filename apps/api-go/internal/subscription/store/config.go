package store

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// 계약 1절의 상품 ID. 설정이 비어 있을 때의 기본 허용 목록이다(허용 범위를 넓히는 기본값이 아니다).
var (
	DefaultAppleProductIDs  = []string{"com.dmonster.smap.sub_month", "com.dmonster.smap.sub_year"}
	DefaultGoogleProductIDs = []string{"smap_premium"}
)

// Config 는 스토어 검증 설정이다. 값은 로그에 남기지 않는다.
// 설정이 없는 항목은 해당 검증 호출이 ErrNotConfigured 를 돌려준다(검증 없이 성공시키지 않는다).
type Config struct {
	// Apple
	AppleBundleID     string   // APPLE_BUNDLE_ID
	AppleRootCAPath   string   // APPLE_ROOT_CA_PATH (PEM 파일)
	AppleRootCAPEM    string   // 테스트·주입용 PEM 본문(경로보다 우선)
	AppleRootCASHA256 string   // APPLE_ROOT_CA_SHA256 (선택, 16진수 핀. 지정 시 로드한 루트 지문과 일치해야 함)
	AppleProductIDs   []string // APPLE_PRODUCT_IDS (비면 DefaultAppleProductIDs)

	// Google Play
	GooglePackageName        string   // GOOGLE_PLAY_PACKAGE_NAME
	GoogleProductIDs         []string // GOOGLE_PLAY_PRODUCT_IDS (비면 DefaultGoogleProductIDs)
	GoogleBasePlanIDs        []string // GOOGLE_PLAY_BASE_PLAN_IDS (비면 기본 요금제 검사 생략)
	GoogleServiceAccountPath string   // GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (파일 경로)
	GoogleServiceAccountJSON string   // 인라인 JSON 또는 base64(JSON) (경로보다 우선; 시크릿 env 용)

	// Google RTDN (Pub/Sub push OIDC)
	GoogleRTDNAudience            string // GOOGLE_RTDN_AUDIENCE
	GoogleRTDNServiceAccountEmail string // GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL

	AllowSandbox bool // SUBSCRIPTION_ALLOW_SANDBOX (기본 false)
}

// HTTPDoer 는 스토어/인증 서버 호출 추상화다(테스트에서 가짜 서버 주입).
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// Options 는 주입 가능한 의존성과 테스트용 URL 재정의다.
type Options struct {
	HTTP         HTTPDoer         // nil 이면 타임아웃이 있는 기본 클라이언트(앱 수명주기로 1개)
	Now          func() time.Time // nil 이면 time.Now
	Timeout      time.Duration    // 호출 1건 상한(기본 10초)
	MaxBodyBytes int64            // 응답 본문 상한(기본 1MiB)

	// 테스트용 재정의(비우면 공식 주소)
	GoogleTokenURL string
	GoogleAPIBase  string
	GoogleJWKSURL  string
	// DisableAppleOIDCheck: 테스트에서 Apple 전용 OID 확장을 생략한 체인을 쓸 때만. 운영 코드에서 쓰지 않는다.
	DisableAppleOIDCheck bool
}

const (
	defaultTimeout       = 10 * time.Second
	defaultMaxBody       = 1 << 20
	defaultGoogleToken   = "https://oauth2.googleapis.com/token"
	defaultGoogleAPIBase = "https://androidpublisher.googleapis.com"
	defaultGoogleJWKS    = "https://www.googleapis.com/oauth2/v3/certs"
	publisherScope       = "https://www.googleapis.com/auth/androidpublisher"
	jwtLeeway            = 60 * time.Second
)

// Service 는 Verifier 와 NotificationVerifier 를 모두 구현한다. 동시 호출에 안전하다.
type Service struct {
	cfg  Config
	opt  Options
	http HTTPDoer
	now  func() time.Time

	appleRoots   *x509.CertPool // nil 이면 미설정
	appleRootErr error          // 설정은 있으나 잘못된 경우(New 가 에러로 돌려주므로 보관만)

	sa    *serviceAccount // nil 이면 미설정
	token tokenCache
	oidc  jwksCache
}

var (
	_ Verifier             = (*Service)(nil)
	_ NotificationVerifier = (*Service)(nil)
)

// New 는 설정을 검증해 Service 를 만든다. 비어 있는 항목은 허용(해당 호출이 ErrNotConfigured),
// 값이 있는데 형식이 잘못된 경우(PEM/JSON/핀 불일치)는 즉시 에러로 알린다(시작 시 fail-fast).
func New(cfg Config, opt Options) (*Service, error) {
	s := &Service{cfg: cfg, opt: opt}
	s.now = opt.Now
	if s.now == nil {
		s.now = time.Now
	}
	if opt.Timeout <= 0 {
		s.opt.Timeout = defaultTimeout
	}
	if opt.MaxBodyBytes <= 0 {
		s.opt.MaxBodyBytes = defaultMaxBody
	}
	s.http = opt.HTTP
	if s.http == nil {
		s.http = &http.Client{Timeout: s.opt.Timeout}
	}
	if s.opt.GoogleTokenURL == "" {
		s.opt.GoogleTokenURL = defaultGoogleToken
	}
	if s.opt.GoogleAPIBase == "" {
		s.opt.GoogleAPIBase = defaultGoogleAPIBase
	}
	if s.opt.GoogleJWKSURL == "" {
		s.opt.GoogleJWKSURL = defaultGoogleJWKS
	}
	s.cfg.AppleProductIDs = cleanList(cfg.AppleProductIDs)
	if len(s.cfg.AppleProductIDs) == 0 {
		s.cfg.AppleProductIDs = DefaultAppleProductIDs
	}
	s.cfg.GoogleProductIDs = cleanList(cfg.GoogleProductIDs)
	if len(s.cfg.GoogleProductIDs) == 0 {
		s.cfg.GoogleProductIDs = DefaultGoogleProductIDs
	}
	s.cfg.GoogleBasePlanIDs = cleanList(cfg.GoogleBasePlanIDs)

	pemBytes, err := loadRootPEM(cfg)
	if err != nil {
		return nil, err
	}
	if len(pemBytes) > 0 {
		pool, err := rootPool(pemBytes, cfg.AppleRootCASHA256)
		if err != nil {
			return nil, err
		}
		s.appleRoots = pool
	}

	saRaw, err := loadServiceAccountRaw(cfg)
	if err != nil {
		return nil, err
	}
	if len(saRaw) > 0 {
		sa, err := parseServiceAccount(saRaw)
		if err != nil {
			return nil, err
		}
		s.sa = sa
	}
	return s, nil
}

func cleanList(in []string) []string {
	var out []string
	for _, v := range in {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func loadRootPEM(cfg Config) ([]byte, error) {
	if strings.TrimSpace(cfg.AppleRootCAPEM) != "" {
		return []byte(cfg.AppleRootCAPEM), nil
	}
	if strings.TrimSpace(cfg.AppleRootCAPath) == "" {
		return nil, nil
	}
	b, err := os.ReadFile(cfg.AppleRootCAPath)
	if err != nil {
		return nil, fmt.Errorf("%w: Apple 루트 인증서 파일을 읽을 수 없음", ErrNotConfigured)
	}
	return b, nil
}

func rootPool(pemBytes []byte, pinHex string) (*x509.CertPool, error) {
	pool := x509.NewCertPool()
	n := 0
	rest := pemBytes
	for {
		var blk *pem.Block
		blk, rest = pem.Decode(rest)
		if blk == nil {
			break
		}
		if blk.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(blk.Bytes)
		if err != nil {
			return nil, errors.New("store: Apple 루트 인증서 PEM 파싱 실패")
		}
		if pin := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(pinHex), ":", "")); pin != "" {
			sum := sha256.Sum256(cert.Raw)
			if hex.EncodeToString(sum[:]) != pin {
				return nil, errors.New("store: Apple 루트 인증서 지문이 APPLE_ROOT_CA_SHA256 과 다름")
			}
		}
		pool.AddCert(cert)
		n++
	}
	if n == 0 {
		return nil, errors.New("store: Apple 루트 인증서 PEM 에 인증서가 없음")
	}
	return pool, nil
}

// serviceAccount 는 서비스 계정 JSON 중 필요한 필드만 보관한다. 값은 로그에 남기지 않는다.
type serviceAccount struct {
	email string
	key   interface{} // *rsa.PrivateKey
}

type serviceAccountFile struct {
	Type        string `json:"type"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
}

func loadServiceAccountRaw(cfg Config) ([]byte, error) {
	if v := strings.TrimSpace(cfg.GoogleServiceAccountJSON); v != "" {
		if strings.HasPrefix(v, "{") {
			return []byte(v), nil
		}
		dec, err := decodeBase64Any(v)
		if err != nil {
			return nil, errors.New("store: GOOGLE 서비스 계정 값이 JSON 도 base64 도 아님")
		}
		return dec, nil
	}
	if p := strings.TrimSpace(cfg.GoogleServiceAccountPath); p != "" {
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("%w: Google 서비스 계정 파일을 읽을 수 없음", ErrNotConfigured)
		}
		return b, nil
	}
	return nil, nil
}

func parseServiceAccount(raw []byte) (*serviceAccount, error) {
	var f serviceAccountFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, errors.New("store: Google 서비스 계정 JSON 파싱 실패")
	}
	if f.ClientEmail == "" || f.PrivateKey == "" {
		return nil, errors.New("store: Google 서비스 계정 JSON 에 client_email/private_key 없음")
	}
	key, err := parseRSAPrivateKey(f.PrivateKey)
	if err != nil {
		return nil, err
	}
	return &serviceAccount{email: f.ClientEmail, key: key}, nil
}

// tokenCache 는 Google OAuth 액세스 토큰 캐시다.
type tokenCache struct {
	mu      sync.Mutex
	token   string
	expires time.Time
}
