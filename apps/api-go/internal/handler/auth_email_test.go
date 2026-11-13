package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// --- 가짜 의존성(서비스의 좁은 인터페이스 구현) ---

type hStore struct {
	vals   map[string]string
	counts map[string]int64
	ttls   map[string]time.Duration
}

func newHStore() *hStore {
	return &hStore{vals: map[string]string{}, counts: map[string]int64{}, ttls: map[string]time.Duration{}}
}
func (s *hStore) IncrWithExpire(_ context.Context, k string, ttl time.Duration) (int64, error) {
	s.counts[k]++
	s.ttls[k] = ttl
	return s.counts[k], nil
}
func (s *hStore) TTL(_ context.Context, k string) (time.Duration, error) { return s.ttls[k], nil }
func (s *hStore) SetEX(_ context.Context, k, v string, ttl time.Duration) error {
	s.vals[k], s.ttls[k] = v, ttl
	return nil
}
func (s *hStore) SetNXEX(_ context.Context, k, v string, ttl time.Duration) (bool, error) {
	if _, ok := s.vals[k]; ok {
		return false, nil
	}
	s.vals[k] = v
	return true, nil
}
func (s *hStore) GetString(_ context.Context, k string) (string, bool, error) {
	v, ok := s.vals[k]
	return v, ok, nil
}
func (s *hStore) DelKeys(_ context.Context, keys ...string) (int64, error) {
	var n int64
	for _, k := range keys {
		if _, ok := s.vals[k]; ok {
			n++
		}
		delete(s.vals, k)
		delete(s.counts, k)
	}
	return n, nil
}

type hMailer struct{ codes []string }

func (m *hMailer) SendVerificationCode(_, code string) error {
	m.codes = append(m.codes, code)
	return nil
}

type hMembers struct{ active map[int]*model.Member }

func (m *hMembers) FindByEmail(string) ([]model.Member, error) { return nil, nil }
func (m *hMembers) IdentifierTaken(string, int) (bool, error)  { return false, nil }
func (m *hMembers) GetByID(id int) (*model.Member, error)      { return m.active[id], nil }
func (m *hMembers) ResetPassword(int, string) error            { return nil }
func (m *hMembers) ChangeEmail(int, string) error              { return nil }

type emailEnv struct {
	r      *gin.Engine
	mailer *hMailer
	cfg    *config.Config
}

func newEmailEnv(t *testing.T, trustedHeader string) *emailEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{JWTSecretKey: "test-secret-0123456789abcdef", JWTAlgorithm: "HS256", TrustedClientIPHeader: trustedHeader}
	mailer := &hMailer{}
	svc := service.NewEmailAuth(newHStore(), &hMembers{active: map[int]*model.Member{9: {MtIdx: 9}}}, mailer,
		service.EmailAuthConfig{Secret: cfg.JWTSecretKey, Algorithm: "HS256", BcryptCost: 4,
			Policy: auth.PasswordPolicy{MinLength: 8}}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	h := NewEmailAuth(svc, cfg, nil)
	r := gin.New()
	r.POST("/auth/email/send-code", h.SendCode)
	r.POST("/auth/email/verify-code", h.VerifyCode)
	r.POST("/auth/email/change", h.ChangeEmail)
	r.POST("/auth/reset-password-by-email", h.ResetPasswordByEmail)
	return &emailEnv{r: r, mailer: mailer, cfg: cfg}
}

func (e *emailEnv) post(path, body string, hdr map[string]string, remote string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if remote != "" {
		req.RemoteAddr = remote
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	return w
}

func detailOf(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var out struct {
		Detail string `json:"detail"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return out.Detail
}

func TestEmailAuthHandlerAppRequestBodies(t *testing.T) {
	e := newEmailEnv(t, "")
	// 앱이 보내는 본문(Android EmailCodeRequest / iOS emailAuth): email, purpose[, code]
	w := e.post("/auth/email/send-code", `{"email":" New@Example.com ","purpose":"register"}`, nil, "198.51.100.1:1")
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != `{"success":true}` {
		t.Fatalf("send-code: %d %s", w.Code, w.Body.String())
	}
	if len(e.mailer.codes) != 1 {
		t.Fatal("발송 1건")
	}
	w = e.post("/auth/email/verify-code", `{"email":"new@example.com","purpose":"register","code":"`+e.mailer.codes[0]+`"}`, nil, "198.51.100.1:1")
	var vr struct {
		Success           bool   `json:"success"`
		VerificationToken string `json:"verification_token"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &vr) != nil || !vr.Success || vr.VerificationToken == "" {
		t.Fatalf("verify-code: %d %s", w.Code, w.Body.String())
	}
	w = e.post("/auth/email/verify-code", `{"email":"new@example.com","purpose":"register","code":"`+e.mailer.codes[0]+`"}`, nil, "198.51.100.1:1")
	if w.Code != 400 {
		t.Fatalf("코드 재사용 400: %d", w.Code)
	}
}

func TestEmailAuthHandlerValidation422(t *testing.T) {
	e := newEmailEnv(t, "")
	for _, body := range []string{
		`{}`,
		`{"email":"not-an-email","purpose":"register"}`,
		`{"email":"a@example.com","purpose":"bogus"}`,
		`{"email":"a@example.com"}`,
		`{"email":123,"purpose":"register"}`,
	} {
		if w := e.post("/auth/email/send-code", body, nil, "198.51.100.1:1"); w.Code != 422 {
			t.Errorf("%s → %d (422 기대)", body, w.Code)
		}
	}
	if w := e.post("/auth/email/verify-code", `{"email":"a@example.com","purpose":"register"}`, nil, "198.51.100.1:1"); w.Code != 422 {
		t.Errorf("code 누락 422: %d", w.Code)
	}
	if w := e.post("/auth/reset-password-by-email", `{"email":"a@example.com","verification_token":"t"}`, nil, "198.51.100.1:1"); w.Code != 422 {
		t.Errorf("new_password 누락 422: %d", w.Code)
	}
}

func TestEmailAuthHandlerChangeEmailRequiresBearer(t *testing.T) {
	e := newEmailEnv(t, "")
	body := `{"email":"a@example.com","purpose":"change_email"}`
	if w := e.post("/auth/email/send-code", body, nil, "198.51.100.1:1"); w.Code != 401 || w.Header().Get("WWW-Authenticate") != "Bearer" {
		t.Fatalf("토큰 없음 401: %d", w.Code)
	}
	if w := e.post("/auth/email/send-code", body, map[string]string{"Authorization": "Bearer garbage"}, "198.51.100.1:1"); w.Code != 401 {
		t.Fatalf("무효 토큰 401: %d", w.Code)
	}
	if w := e.post("/auth/email/change", `{"email":"a@example.com","verification_token":"t"}`, nil, "198.51.100.1:1"); w.Code != 401 {
		t.Fatalf("change 토큰 없음 401: %d", w.Code)
	}
	// 이메일 인증 토큰(type claim)은 로그인 토큰으로 통용되지 않는다
	svc := e.mustEmailToken(t)
	if w := e.post("/auth/email/send-code", body, map[string]string{"Authorization": "Bearer " + svc}, "198.51.100.1:1"); w.Code != 401 {
		t.Fatalf("이메일 인증 토큰으로 로그인 불가: %d", w.Code)
	}
	// 유효한 access 토큰이면 통과(회원 9는 활성)
	acc, _ := auth.CreateAccessToken(9, "x", nil, e.cfg.JWTSecretKey, "HS256", 10)
	hdr := map[string]string{"Authorization": "Bearer " + acc}
	if w := e.post("/auth/email/send-code", body, hdr, "198.51.100.1:1"); w.Code != 200 {
		t.Fatalf("로그인 회원 발송 200: %d %s", w.Code, w.Body.String())
	}
	// 다른(존재하지 않는) 회원 번호의 토큰은 401
	acc2, _ := auth.CreateAccessToken(77, "x", nil, e.cfg.JWTSecretKey, "HS256", 10)
	if w := e.post("/auth/email/send-code", body, map[string]string{"Authorization": "Bearer " + acc2}, "198.51.100.1:1"); w.Code != 401 {
		t.Fatalf("없는 회원 401: %d", w.Code)
	}
}

func (e *emailEnv) mustEmailToken(t *testing.T) string {
	t.Helper()
	svc := service.NewEmailAuth(nil, nil, nil, service.EmailAuthConfig{Secret: e.cfg.JWTSecretKey, Algorithm: "HS256"}, nil)
	tok, err := svc.IssueEmailToken("a@example.com", service.EmailPurposeChangeEmail, 9)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestEmailAuthHandlerRateLimit429UsesTrustedHeader(t *testing.T) {
	// 신뢰 헤더 설정 + loopback 접속(터널): 헤더의 IP별로 한도가 분리된다.
	e := newEmailEnv(t, "CF-Connecting-IP")
	for i := 0; i < 20; i++ {
		body := `{"email":"u` + string(rune('a'+i)) + `@example.com","purpose":"register"}`
		if w := e.post("/auth/email/send-code", body, map[string]string{"CF-Connecting-IP": "203.0.113.5"}, "127.0.0.1:9"); w.Code != 200 {
			t.Fatalf("%d번째 200 기대: %d", i+1, w.Code)
		}
	}
	w := e.post("/auth/email/send-code", `{"email":"uz@example.com","purpose":"register"}`, map[string]string{"CF-Connecting-IP": "203.0.113.5"}, "127.0.0.1:9")
	if w.Code != 429 || w.Header().Get("Retry-After") == "" || !strings.Contains(detailOf(t, w), "초 후") {
		t.Fatalf("429 + Retry-After 기대: %d %v %s", w.Code, w.Header(), w.Body.String())
	}
	if w := e.post("/auth/email/send-code", `{"email":"uz@example.com","purpose":"register"}`, map[string]string{"CF-Connecting-IP": "203.0.113.6"}, "127.0.0.1:9"); w.Code != 200 {
		t.Fatalf("다른 클라이언트 IP는 별도 한도: %d", w.Code)
	}
	// 외부에서 직접 접속한 요청이 헤더를 바꿔가며 한도를 우회할 수 없다
	e2 := newEmailEnv(t, "CF-Connecting-IP")
	for i := 0; i < 20; i++ {
		body := `{"email":"u` + string(rune('a'+i)) + `@example.com","purpose":"register"}`
		e2.post("/auth/email/send-code", body, map[string]string{"CF-Connecting-IP": "10.9.9." + string(rune('1'+i%9))}, "198.51.100.77:9")
	}
	if w := e2.post("/auth/email/send-code", `{"email":"uz@example.com","purpose":"register"}`, map[string]string{"CF-Connecting-IP": "1.1.1.1"}, "198.51.100.77:9"); w.Code != 429 {
		t.Fatalf("위조 헤더로 우회되면 안 됨: %d", w.Code)
	}
}
