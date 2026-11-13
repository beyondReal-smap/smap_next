package handler

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

const fcmTestSecret = "fcm-authz-test-secret"

type fcmAuthzRepo struct {
	members map[int]*model.Member
	updates int
}

func (f *fcmAuthzRepo) GetByID(id int) (*model.Member, error) { return f.members[id], nil }
func (f *fcmAuthzRepo) UpdateColumns(int, map[string]interface{}) error {
	f.updates++
	return nil
}
func (f *fcmAuthzRepo) CountExpiredTokens(time.Time) (int64, int64, error) { return 0, 0, nil }
func (f *fcmAuthzRepo) CountMembersWithToken() (int64, error)              { return 0, nil }

func fcmAuthzToken(t *testing.T, uid int) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": uid, "exp": time.Now().Add(time.Hour).Unix()}).
		SignedString([]byte(fcmTestSecret))
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + s
}

// validate-and-refresh / background-check: 토큰 본인과 요청 대상(mt_idx)이 다르면 403.
func TestMemberFCMTokenTargetMustMatchToken(t *testing.T) {
	lvl := func(v int) *int { return &v }
	tok := "tokentokentokentokentokentoken"
	repo := &fcmAuthzRepo{members: map[int]*model.Member{
		5: {MtIdx: 5, MtLevel: lvl(2), MtTokenID: &tok},
		6: {MtIdx: 6, MtLevel: lvl(2), MtTokenID: &tok},
		9: {MtIdx: 9, MtLevel: lvl(9)}, // 관리자
	}}
	h := NewMemberFCMToken(service.NewMemberFCMToken(repo), &config.Config{JWTSecretKey: fcmTestSecret, JWTAlgorithm: "HS256"}, nil)
	r := gin.New()
	r.POST("/validate-and-refresh", h.ValidateAndRefresh)
	r.POST("/background-check", h.BackgroundCheck)

	do := func(path, hdr string, target int) *httptest.ResponseRecorder {
		body := `{"mt_idx":` + strconv.Itoa(target) + `,"fcm_token":"` + strings.Repeat("a", 30) + `"}`
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if hdr != "" {
			req.Header.Set("Authorization", hdr)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	for _, path := range []string{"/validate-and-refresh", "/background-check"} {
		// 타인(6)의 토큰을 5번 회원 토큰으로 바꾸려는 시도 → 403, 어떤 갱신도 일어나지 않는다.
		before := repo.updates
		if w := do(path, fcmAuthzToken(t, 5), 6); w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "다른 회원의 토큰에 접근할 수 없습니다.") {
			t.Errorf("%s: 타인 대상은 403: %d %s", path, w.Code, w.Body.String())
		}
		if repo.updates != before {
			t.Errorf("%s: 거부된 요청이 DB를 갱신함", path)
		}
		// 본인 대상은 기존대로 서비스까지 간다(403/401이 아니다).
		if w := do(path, fcmAuthzToken(t, 5), 5); w.Code == http.StatusForbidden || w.Code == http.StatusUnauthorized {
			t.Errorf("%s: 본인 대상은 통과: %d %s", path, w.Code, w.Body.String())
		}
		// 관리자는 다른 회원 대상 허용.
		if w := do(path, fcmAuthzToken(t, 9), 6); w.Code == http.StatusForbidden || w.Code == http.StatusUnauthorized {
			t.Errorf("%s: 관리자는 허용: %d", path, w.Code)
		}
		// 토큰 없음/무효는 기존대로 401(이 핸들러는 원래 토큰을 요구한다).
		if w := do(path, "", 5); w.Code != http.StatusUnauthorized {
			t.Errorf("%s: 무토큰 401 유지: %d", path, w.Code)
		}
		if w := do(path, "Bearer garbage", 5); w.Code != http.StatusUnauthorized {
			t.Errorf("%s: 무효 토큰 401 유지: %d", path, w.Code)
		}
	}
}
