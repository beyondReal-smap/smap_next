package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/config"
)

// 18단계 C-4: 관리자 게이트(RequireAdminChecked)도 비밀번호 변경 이전 토큰을 401로 거부한다.
// 회원 저장소가 nil이므로, 무효 판정이 저장소 조회 전에 끝나지 않으면 panic으로 드러난다.
type adminRevoked struct{ calls int }

func (a *adminRevoked) IsAccessRevoked(context.Context, int, int64, bool) (bool, error) {
	a.calls++
	return true, nil
}

func TestRequireAdminCheckedRejectsRevokedToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{JWTSecretKey: "admin-rev-secret", JWTAlgorithm: "HS256"}
	chk := &adminRevoked{}
	r := gin.New()
	r.GET("/x", RequireAdminChecked(cfg, nil, chk), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"mt_idx": 1, "iat": time.Now().Add(-time.Hour).Unix(), "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(cfg.JWTSecretKey))
	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized || chk.calls != 1 {
		t.Errorf("무효 기준에 걸린 관리자 토큰은 401(저장소 조회 전): code=%d calls=%d", w.Code, chk.calls)
	}
}
