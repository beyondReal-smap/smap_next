package middleware

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeCounter struct {
	counts map[string]int64
	ttl    time.Duration
	err    error
}

func (f *fakeCounter) IncrWithExpire(_ context.Context, k string, _ time.Duration) (int64, error) {
	if f.err != nil {
		return 0, f.err
	}
	f.counts[k]++
	return f.counts[k], nil
}
func (f *fakeCounter) TTL(context.Context, string) (time.Duration, error) { return f.ttl, f.err }

func limitRouter(st *fakeCounter, header string, logger *slog.Logger, now func() time.Time) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/members/check/email/:email", IPLimit(IPLimitOptions{
		Name: "check_email", Store: st, Limit: 2, Window: time.Minute, TrustedHeader: header, Logger: logger, Now: now,
	}), func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	return r
}

func hit(r *gin.Engine, remote, hdrIP string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/members/check/email/a@b.c", nil)
	req.RemoteAddr = remote
	if hdrIP != "" {
		req.Header.Set("CF-Connecting-IP", hdrIP)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestIPLimitExceeded429WithRetryAfter(t *testing.T) {
	st := &fakeCounter{counts: map[string]int64{}, ttl: 42 * time.Second}
	r := limitRouter(st, "", nil, nil)
	for i := 0; i < 2; i++ {
		if w := hit(r, "203.0.113.5:1", ""); w.Code != 200 {
			t.Fatalf("한도 이내 요청이 막힘: %d", w.Code)
		}
	}
	w := hit(r, "203.0.113.5:1", "")
	if w.Code != 429 || w.Header().Get("Retry-After") != "42" || !strings.Contains(w.Body.String(), "42초") || !strings.Contains(w.Body.String(), `"detail"`) {
		t.Fatalf("429 오류: %d %q %s", w.Code, w.Header().Get("Retry-After"), w.Body.String())
	}
	// 다른 IP는 별도 카운터
	if w := hit(r, "203.0.113.6:1", ""); w.Code != 200 {
		t.Fatalf("다른 IP가 막힘: %d", w.Code)
	}
}

func TestIPLimitUsesTrustedHeader(t *testing.T) {
	st := &fakeCounter{counts: map[string]int64{}, ttl: time.Second}
	r := limitRouter(st, "CF-Connecting-IP", nil, nil)
	hit(r, "127.0.0.1:9", "198.51.100.7")
	if st.counts["limit:ip:check_email:198.51.100.7"] != 1 {
		t.Fatalf("신뢰 헤더 IP 기준이 아님: %v", st.counts)
	}
	// 공인 IP가 헤더를 위조해도 무시
	hit(r, "203.0.113.5:9", "198.51.100.99")
	if st.counts["limit:ip:check_email:203.0.113.5"] != 1 {
		t.Fatalf("위조 헤더가 쓰임: %v", st.counts)
	}
}

func TestIPLimitRedisDownAllowsAndWarnsThrottled(t *testing.T) {
	st := &fakeCounter{counts: map[string]int64{}, err: errors.New("redis down")}
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	clock := time.Unix(1_000_000, 0)
	r := limitRouter(st, "", logger, func() time.Time { return clock })
	for i := 0; i < 3; i++ {
		if w := hit(r, "203.0.113.5:1", ""); w.Code != 200 {
			t.Fatalf("Redis 장애 시 허용되어야 함: %d", w.Code)
		}
	}
	if n := strings.Count(buf.String(), "ip_limit_store_unavailable_allowing"); n != 1 {
		t.Fatalf("경고는 간격 내 1회여야 함: %d", n)
	}
	clock = clock.Add(2 * time.Minute)
	hit(r, "203.0.113.5:1", "")
	if n := strings.Count(buf.String(), "ip_limit_store_unavailable_allowing"); n != 2 {
		t.Fatalf("간격 경과 후 다시 경고해야 함: %d", n)
	}
	if strings.Contains(buf.String(), "a@b.c") {
		t.Fatalf("경고 로그에 경로 값이 남음")
	}
}
