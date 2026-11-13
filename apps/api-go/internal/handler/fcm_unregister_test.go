package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type unregRepo struct {
	cleared []int
	match   string
}

func (u *unregRepo) ClearFCMTokenIfMatch(idx int, tok string) (bool, error) {
	if tok == u.match {
		u.cleared = append(u.cleared, idx)
		return true, nil
	}
	return false, nil
}

type revokeAll struct{}

func (revokeAll) IsAccessRevoked(context.Context, int, int64, bool) (bool, error) { return true, nil }

func newUnregEnv(t *testing.T, rev auth.AccessRevocationChecker) (*gin.Engine, *unregRepo) {
	t.Helper()
	lvl := 2
	repo := &fcmAuthzRepo{members: map[int]*model.Member{5: {MtIdx: 5, MtLevel: &lvl}, 6: {MtIdx: 6, MtLevel: func() *int { v := 1; return &v }()}}}
	svc := service.NewFCMToken(repo)
	ur := &unregRepo{match: "good-token"}
	svc.SetUnregisterRepo(ur)
	h := NewFCMToken(svc, &config.Config{JWTSecretKey: fcmTestSecret, JWTAlgorithm: "HS256"})
	h.SetRevocation(rev)
	r := gin.New()
	r.POST("/fcm-token/unregister", h.Unregister)
	return r, ur
}

func doUnreg(r *gin.Engine, hdr, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/fcm-token/unregister", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if hdr != "" {
		req.Header.Set("Authorization", hdr)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestFCMUnregister(t *testing.T) {
	r, ur := newUnregEnv(t, nil)
	if w := doUnreg(r, "", `{"fcm_token":"good-token"}`); w.Code != 401 {
		t.Errorf("무토큰 401: %d", w.Code)
	}
	if w := doUnreg(r, fcmAuthzToken(t, 6), `{"fcm_token":"good-token"}`); w.Code != 401 {
		t.Errorf("탈퇴 회원 401: %d", w.Code)
	}
	if w := doUnreg(r, fcmAuthzToken(t, 5), `{}`); w.Code != 422 {
		t.Errorf("본문 누락 422: %d", w.Code)
	}
	if w := doUnreg(r, fcmAuthzToken(t, 5), `{"fcm_token":"`+strings.Repeat("a", 4097)+`"}`); w.Code != 422 {
		t.Errorf("길이 초과 422: %d", w.Code)
	}
	w := doUnreg(r, fcmAuthzToken(t, 5), `{"fcm_token":"other"}`)
	if w.Code != 200 || w.Body.String() != `{"success":true}` || len(ur.cleared) != 0 {
		t.Errorf("불일치도 200 success: %d %s", w.Code, w.Body.String())
	}
	w = doUnreg(r, fcmAuthzToken(t, 5), `{"fcm_token":"good-token"}`)
	if w.Code != 200 || len(ur.cleared) != 1 || ur.cleared[0] != 5 {
		t.Errorf("일치 시 해제: %d %v", w.Code, ur.cleared)
	}
	if strings.Contains(w.Body.String(), "good-token") {
		t.Error("응답에 토큰 노출 금지")
	}
}

func TestFCMUnregisterRevokedTokenRejected(t *testing.T) {
	r, ur := newUnregEnv(t, revokeAll{})
	if w := doUnreg(r, fcmAuthzToken(t, 5), `{"fcm_token":"good-token"}`); w.Code != 401 || len(ur.cleared) != 0 {
		t.Errorf("무효 기준 이전 토큰 401: %d", w.Code)
	}
}
