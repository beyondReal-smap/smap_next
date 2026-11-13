package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// G8 — /sms/send-verification-code, /sms/verify-code의 429/503 응답 형식.

type g8Store struct {
	vals   map[string]string
	counts map[string]int64
	ttls   map[string]time.Duration
	err    error
}

func newG8Store() *g8Store {
	return &g8Store{vals: map[string]string{}, counts: map[string]int64{}, ttls: map[string]time.Duration{}}
}
func (s *g8Store) IncrWithExpire(_ context.Context, k string, ttl time.Duration) (int64, error) {
	if s.err != nil {
		return 0, s.err
	}
	s.counts[k]++
	if _, ok := s.ttls[k]; !ok {
		s.ttls[k] = ttl
	}
	return s.counts[k], nil
}
func (s *g8Store) TTL(_ context.Context, k string) (time.Duration, error) { return s.ttls[k], s.err }
func (s *g8Store) SetEX(_ context.Context, k, v string, ttl time.Duration) error {
	if s.err != nil {
		return s.err
	}
	s.vals[k], s.ttls[k] = v, ttl
	return nil
}
func (s *g8Store) GetString(_ context.Context, k string) (string, bool, error) {
	v, ok := s.vals[k]
	return v, ok, s.err
}
func (s *g8Store) DelKeys(_ context.Context, ks ...string) (int64, error) {
	for _, k := range ks {
		delete(s.vals, k)
		delete(s.counts, k)
	}
	return 0, s.err
}

type g8Sender struct{ calls int }

func (g *g8Sender) SendSMS(_, _, _ string) service.SMSResult {
	g.calls++
	return service.SMSResult{Success: true}
}

func g8Router(st *g8Store, sender *g8Sender, cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.TestMode)
	limits := service.SMSLimits{PerPhone: 1, PerIP: 20, Window: time.Hour, MaxAttempts: 5}
	h := NewSMS(service.NewSMSVerify(sender, st, limits, nil), nil, cfg)
	r := gin.New()
	r.POST("/sms/send-verification-code", h.SendVerificationCode)
	r.POST("/sms/verify-code", h.VerifyCode)
	return r
}

func g8Post(r *gin.Engine, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "203.0.113.5:4000"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestSMSSendSuccessKeepsLegacyShape(t *testing.T) {
	r := g8Router(newG8Store(), &g8Sender{}, &config.Config{})
	w := g8Post(r, "/sms/send-verification-code", `{"phone_number":"01011112222"}`)
	if w.Code != 200 || w.Body.String() != `{"success":true,"error":null}` {
		t.Fatalf("성공 응답 형식 변경됨: %d %s", w.Code, w.Body.String())
	}
}

func TestSMSSendRateLimited429HasRetryAfterAndLegacyKeys(t *testing.T) {
	st := newG8Store()
	r := g8Router(st, &g8Sender{}, &config.Config{})
	g8Post(r, "/sms/send-verification-code", `{"phone_number":"01011112222"}`)
	st.ttls["sms:rate:01011112222"] = 120 * time.Second
	w := g8Post(r, "/sms/send-verification-code", `{"phone_number":"01011112222"}`)
	if w.Code != 429 || w.Header().Get("Retry-After") != "120" {
		t.Fatalf("429/Retry-After 오류: %d %q", w.Code, w.Header().Get("Retry-After"))
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	// Android verify는 본문의 "error" 값을 읽고, FastAPI/이메일 한도와 호환되도록 "detail"도 둔다.
	if body["success"] != false || body["error"] == nil || body["error"] != body["detail"] || !strings.Contains(body["error"].(string), "2분") {
		t.Fatalf("429 본문 오류: %v", body)
	}
}

func TestSMSRedisDown503BothEndpoints(t *testing.T) {
	st := newG8Store()
	st.err = errors.New("redis down")
	sender := &g8Sender{}
	r := g8Router(st, sender, &config.Config{})
	for _, c := range []struct{ path, body string }{
		{"/sms/send-verification-code", `{"phone_number":"01011112222"}`},
		{"/sms/verify-code", `{"phone_number":"01011112222","code":"123456"}`},
	} {
		w := g8Post(r, c.path, c.body)
		if w.Code != 503 || strings.Contains(w.Body.String(), "redis") {
			t.Fatalf("%s 503 오류: %d %s", c.path, w.Code, w.Body.String())
		}
	}
	if sender.calls != 0 {
		t.Fatalf("Redis 장애 중 SMS 발송됨")
	}
}

func TestSMSSendUsesTrustedHeaderIP(t *testing.T) {
	st := newG8Store()
	cfg := &config.Config{TrustedClientIPHeader: "CF-Connecting-IP"}
	r := g8Router(st, &g8Sender{}, cfg)
	req := httptest.NewRequest(http.MethodPost, "/sms/send-verification-code", strings.NewReader(`{"phone_number":"01011112222"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("CF-Connecting-IP", "198.51.100.7")
	req.RemoteAddr = "127.0.0.1:5000" // 터널(loopback)에서 온 요청
	r.ServeHTTP(httptest.NewRecorder(), req)
	if st.counts["sms:rate_ip:198.51.100.7"] != 1 {
		t.Fatalf("신뢰 헤더 IP로 한도를 세지 않음: %v", st.counts)
	}
}
