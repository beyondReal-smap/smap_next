package ws

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

// 18단계 C-4: WebSocket 핸드셰이크도 비밀번호 변경 이전 토큰을 거부한다(Upgrade 전에 401).
type wsRevoked struct{ calls int }

func (r *wsRevoked) IsAccessRevoked(context.Context, int, int64, bool) (bool, error) {
	r.calls++
	return true, nil
}

func TestWSHandshakeRejectsRevokedToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{JWTSecretKey: wsSecret, JWTAlgorithm: "HS256"}
	chk := &wsRevoked{}
	cws := NewChatWS(NewHub(), &fakeSvc{}, &fakeFCM{}, cfg, nil)
	cws.SetRevocation(chk)
	r := gin.New()
	r.GET("/ws", cws.Handle)

	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"mt_idx": 5, "iat": time.Now().Add(-time.Hour).Unix(), "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(wsSecret))
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/ws?token="+tok, nil))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("무효 기준에 걸린 토큰은 401: %d", w.Code)
	}
	if chk.calls != 1 {
		t.Errorf("공통 검사를 거쳐야 함: calls=%d", chk.calls)
	}
}
