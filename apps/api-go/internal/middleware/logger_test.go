package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func logRouter(buf *bytes.Buffer) *gin.Engine {
	gin.SetMode(gin.TestMode)
	logger := slog.New(slog.NewJSONHandler(buf, nil))
	r := gin.New()
	r.Use(AccessLog(logger))
	r.GET("/members/check/email/:email", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/members/check/phone/:phone", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/users/token/:token", func(c *gin.Context) { c.String(404, "no") })
	return r
}

func TestAccessLogUsesRoutePatternNotValues(t *testing.T) {
	var buf bytes.Buffer
	r := logRouter(&buf)
	for _, p := range []string{
		"/members/check/email/someone@example.com?token=SECRETQ",
		"/members/check/phone/01012345678",
		"/users/token/fcmTOKEN123:abcDEF",
	} {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, p, nil))
	}
	out := buf.String()
	for _, secret := range []string{"someone@example.com", "01012345678", "fcmTOKEN123", "SECRETQ", "token="} {
		if strings.Contains(out, secret) {
			t.Fatalf("접근 로그에 %q 가 남음:\n%s", secret, out)
		}
	}
	for _, want := range []string{`"path":"/members/check/email/:email"`, `"path":"/members/check/phone/:phone"`, `"path":"/users/token/:token"`,
		`"method":"GET"`, `"status":200`, `"dur"`, `"client_ip"`} {
		if !strings.Contains(out, want) {
			t.Fatalf("기존 로그 필드/패턴 %s 누락:\n%s", want, out)
		}
	}
}

func TestAccessLogUnmatchedPathIsMasked(t *testing.T) {
	var buf bytes.Buffer
	r := logRouter(&buf)
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/members/foo@example.com/01099998888", nil))
	out := buf.String()
	if strings.Contains(out, "foo@example.com") || strings.Contains(out, "01099998888") || !strings.Contains(out, `"path":"(unmatched)"`) || !strings.Contains(out, `"status":404`) {
		t.Fatalf("404 경로 마스킹 오류:\n%s", out)
	}
}

func TestRecoveryLogUsesRoutePattern(t *testing.T) {
	var buf bytes.Buffer
	gin.SetMode(gin.TestMode)
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	r := gin.New()
	r.Use(Recovery(logger))
	r.GET("/panic/:email", func(c *gin.Context) { panic("boom") })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/panic/x@example.com", nil))
	if w.Code != 500 || strings.Contains(buf.String(), "x@example.com") || !strings.Contains(buf.String(), "/panic/:email") {
		t.Fatalf("panic 로그 경로 오류: %d\n%s", w.Code, buf.String())
	}
}
