package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 18단계 C-1/C-4 핸들러 계층 테스트.

const bcSecret = "bc-authz-test-secret"

func bcCfg() *config.Config {
	return &config.Config{JWTSecretKey: bcSecret, JWTAlgorithm: "HS256"}
}

func bcToken(t *testing.T, uid int, iat int64) string {
	t.Helper()
	claims := jwt.MapClaims{"mt_idx": uid, "mt_id": "u", "exp": time.Now().Add(time.Hour).Unix()}
	if iat > 0 {
		claims["iat"] = iat
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(bcSecret))
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + s
}

// allRevoked는 모든 조회를 "무효"로 판정하고 호출 횟수를 센다: 핸들러가 공통 검사를 거치는지 확인한다.
type allRevoked struct {
	mu    sync.Mutex
	calls int
}

func (a *allRevoked) IsAccessRevoked(context.Context, int, int64, bool) (bool, error) {
	a.mu.Lock()
	a.calls++
	a.mu.Unlock()
	return true, nil
}

func serve(h gin.HandlerFunc, method, route, target, authHeader, body string) *httptest.ResponseRecorder {
	r := gin.New()
	r.Handle(method, route, h)
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// 토큰을 직접 파싱하는 핸들러들이 무효 기준에 걸린 토큰을 "기존 인증 실패 분기와 똑같이"(서명 불량 토큰과 상태·본문 동일) 처리하고,
// 그 판정이 공통 검사(checker 호출)를 거쳤음을 확인한다. svc가 nil이라 인증 통과 시에는 핸들러가 panic하므로
// 인증 단계에서 끝난 응답만 비교된다.
func TestDirectParsingHandlersApplyRevocation(t *testing.T) {
	cfg := bcCfg()
	chk := &allRevoked{}

	user := &UserHandler{cfg: cfg}
	user.SetRevocation(chk)
	member := &MemberHandler{cfg: cfg}
	member.SetRevocation(chk)
	order := &OrderHandler{cfg: cfg}
	order.SetRevocation(chk)
	chat := &ChatHandler{cfg: cfg}
	chat.SetRevocation(chk)
	group := &GroupHandler{cfg: cfg}
	group.SetRevocation(chk)
	sms := &SMSHandler{cfg: cfg}
	sms.SetRevocation(chk)
	fcmTok := &MemberFCMTokenHandler{cfg: cfg}
	fcmTok.SetRevocation(chk)

	cases := []struct {
		name, method, route, target string
		h                           gin.HandlerFunc
	}{
		{"auth/me", "GET", "/auth/me", "/auth/me", user.Me},
		{"members/me", "GET", "/members/me", "/members/me", member.Me},
		{"members/consent/:id", "GET", "/members/consent/:member_id", "/members/consent/5", member.Consent},
		{"orders/summary", "GET", "/orders/summary/:member_id", "/orders/summary/5", order.Summary},
		{"orders/status", "PUT", "/orders/status/:order_id", "/orders/status/1?status=1", order.UpdateStatus},
		{"chats/rooms", "GET", "/chats/rooms", "/chats/rooms", chat.Rooms},
		{"groups/current-user", "GET", "/groups/current-user", "/groups/current-user", group.CurrentUser},
		{"groups/current-user/summary", "GET", "/groups/current-user/summary", "/groups/current-user/summary", group.CurrentUserSummary},
		{"sms requireUserID", "POST", "/x", "/x", func(c *gin.Context) {
			if _, ok := sms.requireUserID(c); ok {
				c.Status(http.StatusNoContent)
			}
		}},
		{"member-fcm-token requireUserID", "POST", "/x", "/x", func(c *gin.Context) {
			if _, ok := fcmTok.requireUserID(c); ok {
				c.Status(http.StatusNoContent)
			}
		}},
	}
	for _, tc := range cases {
		before := chk.calls
		revoked := serve(tc.h, tc.method, tc.route, tc.target, bcToken(t, 5, 100), "")
		if chk.calls == before {
			t.Errorf("%s: 공통 무효 기준 검사를 거치지 않음", tc.name)
		}
		noToken := serve(tc.h, tc.method, tc.route, tc.target, "Bearer garbage", "")
		if revoked.Code != noToken.Code || revoked.Body.String() != noToken.Body.String() {
			t.Errorf("%s: 무효 기준에 걸린 토큰은 서명·만료 실패 토큰과 같은 응답이어야 함: %d %q vs %d %q",
				tc.name, revoked.Code, revoked.Body.String(), noToken.Code, noToken.Body.String())
		}
		if revoked.Code == http.StatusNoContent || revoked.Code == http.StatusInternalServerError {
			t.Errorf("%s: 인증 단계를 통과하면 안 됨: %d", tc.name, revoked.Code)
		}
	}
}

// --- verify-password 한도 ---

type vpRepo struct{ user *model.Member }

func (r *vpRepo) GetByID(int) (*model.Member, error)        { return r.user, nil }
func (r *vpRepo) GetByIdxActive(int) (*model.Member, error) { return r.user, nil }
func (r *vpRepo) GetByEmail(string) (*model.Member, error)  { return nil, nil }
func (r *vpRepo) GetByPhoneOr(string) (*model.Member, error) {
	return nil, nil
}
func (r *vpRepo) CreateFromRegister(m *model.Member) (*model.Member, error) { return m, nil }
func (r *vpRepo) CreateUserMember(m *model.Member) (*model.Member, error)   { return m, nil }
func (r *vpRepo) UpdateColumns(int, map[string]interface{}) error           { return nil }
func (r *vpRepo) ExistsPhoneExcept(string, int) (bool, error)               { return false, nil }
func (r *vpRepo) ExistsEmailExcept(string, int) (bool, error)               { return false, nil }
func (r *vpRepo) ExistsNicknameExcept(string, int) (bool, error)            { return false, nil }
func (r *vpRepo) SetPasswordRevokeRefresh(int, string) error                { return nil }
func (r *vpRepo) WithdrawMember(int, int, *string) error                    { return nil }

type memStore struct {
	mu     sync.Mutex
	counts map[string]int64
	ttl    time.Duration
}

func (m *memStore) IncrWithExpire(_ context.Context, k string, ttl time.Duration) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.counts[k]++
	m.ttl = ttl
	return m.counts[k], nil
}
func (m *memStore) TTL(context.Context, string) (time.Duration, error) { return m.ttl, nil }
func (m *memStore) SetEX(context.Context, string, string, time.Duration) error {
	return nil
}
func (m *memStore) GetString(_ context.Context, k string) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.counts[k]
	return strconv.FormatInt(c, 10), ok, nil
}
func (m *memStore) DelKeys(_ context.Context, keys ...string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range keys {
		delete(m.counts, k)
	}
	return int64(len(keys)), nil
}

func TestVerifyPasswordHandlerRateLimit(t *testing.T) {
	hash, err := auth.HashPassword("Correct1!pw", 4)
	if err != nil {
		t.Fatal(err)
	}
	svc := service.NewMemberWrite(&vpRepo{user: &model.Member{MtIdx: 7, MtPwd: &hash}}, 4, auth.PasswordPolicy{})
	store := &memStore{counts: map[string]int64{}}
	svc.SetPasswordGuard(service.NewPasswordAttemptGuard(store, 2, 15*time.Minute, nil))
	h := NewMemberWrite(svc, bcCfg())
	call := func(pw string) *httptest.ResponseRecorder {
		return serve(h.VerifyPassword, "POST", "/members/verify-password", "/members/verify-password",
			bcToken(t, 7, time.Now().Unix()), `{"currentPassword":"`+pw+`"}`)
	}

	// 실패 응답은 기존 200 래핑 그대로.
	for i := 0; i < 2; i++ {
		w := call("wrong")
		var res map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &res)
		if w.Code != http.StatusOK || res["result"] != "N" || res["success"] != false {
			t.Fatalf("한도 전 실패는 기존 200 래핑: %d %s", w.Code, w.Body.String())
		}
	}
	// 한도 초과: 429 + Retry-After + 로그인과 같은 {"detail": ...}, 올바른 비밀번호여도 거부.
	w := call("Correct1!pw")
	if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") != "900" {
		t.Fatalf("429 + Retry-After 기대: %d %q", w.Code, w.Header().Get("Retry-After"))
	}
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if !strings.Contains(body["detail"], "15분 후 다시 시도해주세요") {
		t.Errorf("남은 시간 문구: %q", body["detail"])
	}
}

func TestVerifyPasswordHandlerSuccessResponseUnchangedAndClearsCounter(t *testing.T) {
	hash, _ := auth.HashPassword("Correct1!pw", 4)
	svc := service.NewMemberWrite(&vpRepo{user: &model.Member{MtIdx: 7, MtPwd: &hash}}, 4, auth.PasswordPolicy{})
	store := &memStore{counts: map[string]int64{}}
	svc.SetPasswordGuard(service.NewPasswordAttemptGuard(store, 3, 15*time.Minute, nil))
	h := NewMemberWrite(svc, bcCfg())
	post := func(pw string) *httptest.ResponseRecorder {
		return serve(h.VerifyPassword, "POST", "/members/verify-password", "/members/verify-password",
			bcToken(t, 7, time.Now().Unix()), `{"currentPassword":"`+pw+`"}`)
	}
	post("wrong")
	w := post("Correct1!pw")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"result":"Y"`) || !strings.Contains(w.Body.String(), "비밀번호가 확인되었습니다.") {
		t.Errorf("성공 응답 형식 유지: %d %s", w.Code, w.Body.String())
	}
	if len(store.counts) != 0 {
		t.Errorf("성공 시 카운터 삭제: %v", store.counts)
	}
	// 미인증은 기존 200 "인증이 필요합니다."
	w = serve(h.VerifyPassword, "POST", "/members/verify-password", "/members/verify-password", "", `{"currentPassword":"x"}`)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "인증이 필요합니다.") {
		t.Errorf("미인증 응답 유지: %d %s", w.Code, w.Body.String())
	}
}
