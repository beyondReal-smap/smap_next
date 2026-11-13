package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 라우트 표 수준의 테스트: 인증 미들웨어(ua)·관리자 게이트(adm)가 의도한 라우트에만 붙었는지,
// /users/* 응답에서 비밀 필드가 빠졌는지, fcm_sendone 전체 발송이 관리자 전용인지 확인한다.
// 핸들러가 nil인 라우트는 "도달했다" = Recovery가 panic을 500으로 바꾼 것이므로 401/403이 아니면 도달한 것이다.

const testSecret = "server-test-secret-key"

func init() { gin.SetMode(gin.TestMode) }

func testCfg() *config.Config {
	return &config.Config{APIV1Str: "/api/v1", JWTSecretKey: testSecret, JWTAlgorithm: "HS256", HwgiUploadDir: "/nonexistent-hwgi", HwgiMaxUploadBytes: 1024}
}

func bearer(t *testing.T, uid int) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"mt_idx": uid, "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + s
}

// stubAdmin은 RequireAdmin 대역이다: uid 1만 관리자, 토큰 없음 401, 그 외 403.
// (실제 RequireAdmin은 gorm 저장소가 필요해 여기서는 "라우트에 붙었는가"만 검증한다.)
func stubAdmin(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), testSecret, "HS256")
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	if uid != 1 {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "관리자 권한이 필요합니다."})
		return
	}
	c.Set("user_id", uid)
	c.Next()
}

// --- fakes ---

type memberStates map[int]*model.MemberAccessState

func (m memberStates) GetAccessState(id int) (*model.MemberAccessState, error) { return m[id], nil }

func normalStates() memberStates {
	n := func(l, s int, show string) *model.MemberAccessState {
		return &model.MemberAccessState{MtLevel: &l, MtStatus: &s, MtShow: &show}
	}
	return memberStates{1: n(9, 1, "Y"), 2: n(2, 1, "Y"), 3: n(1, 1, "Y")}
}

const (
	secretHash  = "$2a$04$SECRETHASHVALUEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
	secretReset = "RESETTOK"
	secretFCM   = "FCMDEVICETOKEN-SECRET-VALUE"
)

func secretMember() *model.Member {
	s := func(v string) *string { return &v }
	i := func(v int) *int { return &v }
	return &model.Member{
		MtIdx: 77, MtID: s("01011112222"), MtName: s("이름"), MtNickname: s("닉"), MtEmail: s("a@b.c"),
		MtPwd: s(secretHash), MtResetToken: s(secretReset), MtTokenID: s(secretFCM),
		MtRememberToken: s("REMEMBER-SECRET"), MtLastReceiptToken: s("RECEIPT-SECRET"),
		MtGoogleID: s("GOOGLE-ID-SECRET"), MtKakaoID: s("KAKAO-ID-SECRET"), MtAppleID: s("APPLE-ID-SECRET"),
		MtLevel: i(2), MtStatus: i(1),
	}
}

type fakeUsers struct {
	mu    sync.Mutex
	calls int
}

func (f *fakeUsers) hit() { f.mu.Lock(); f.calls++; f.mu.Unlock() }
func (f *fakeUsers) List(int, int) ([]model.Member, error) {
	f.hit()
	return []model.Member{*secretMember()}, nil
}
func (f *fakeUsers) GetByID(int) (*model.Member, error)       { f.hit(); return secretMember(), nil }
func (f *fakeUsers) GetByEmail(string) (*model.Member, error) { f.hit(); return secretMember(), nil }
func (f *fakeUsers) GetByToken(string) (*model.Member, error) { f.hit(); return secretMember(), nil }
func (f *fakeUsers) RecentSignin(int) ([]model.Member, error) {
	f.hit()
	return []model.Member{*secretMember()}, nil
}
func (f *fakeUsers) NotJoinedCount() (int64, error)          { f.hit(); return 0, nil }
func (f *fakeUsers) GetByMtID(string) (*model.Member, error) { f.hit(); return secretMember(), nil }
func (f *fakeUsers) CreateUserMember(m *model.Member) (*model.Member, error) {
	f.hit()
	return m, nil
}
func (f *fakeUsers) UpdateColumns(int, map[string]interface{}) error { f.hit(); return nil }
func (f *fakeUsers) Delete(int) error                                { f.hit(); return nil }

type fakeSendMembers struct{ tokens int }

func (f *fakeSendMembers) GetByID(id int) (*model.Member, error) {
	tok := "device-token-xxxxxxxxxxxxxxxx"
	return &model.Member{MtIdx: id, MtTokenID: &tok}, nil
}
func (f *fakeSendMembers) GetTokenList() ([]model.Member, error) {
	tok := "device-token-xxxxxxxxxxxxxxxx"
	out := make([]model.Member, f.tokens)
	for i := range out {
		out[i] = model.Member{MtIdx: i + 1, MtTokenID: &tok}
	}
	return out, nil
}

type fakeLogWriter struct{}

func (fakeLogWriter) Create(*model.PushLog) error { return nil }

type fakeSender struct {
	mu   sync.Mutex
	sent int
}

func (f *fakeSender) Send(context.Context, fcm.Message) (string, error) {
	f.mu.Lock()
	f.sent++
	f.mu.Unlock()
	return "msg-id", nil
}
func (f *fakeSender) Available() bool { return true }

type testEnv struct {
	router http.Handler
	users  *fakeUsers
	sender *fakeSender
	logs   *bytes.Buffer
}

func newEnv(t *testing.T, mode auth.RouteMode) *testEnv {
	t.Helper()
	cfg := testCfg()
	logs := &bytes.Buffer{}
	logger := slog.New(slog.NewJSONHandler(logs, nil))
	ra, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: mode, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute,
	}, normalStates(), logger)
	if err != nil {
		t.Fatal(err)
	}
	users := &fakeUsers{}
	userSvc := service.NewUser(users)
	userSvc.SetBcryptCost(4)
	sender := &fakeSender{}
	sendone := handler.NewFCMSendone(service.NewPushSend(&fakeSendMembers{tokens: 3}, fakeLogWriter{}, sender))
	sendone.SetAdminGate(stubAdmin)

	r := New(cfg, logger, Deps{
		AppVersion:  handler.NewAppVersion(service.NewAppVersion("3.1.0", "3.1.0")),
		User:        handler.NewUser(userSvc, cfg),
		FCMSendone:  sendone,
		AdminAuth:   stubAdmin,
		UserAuth:    ra.Required(),
		UserAuthOpt: ra.Optional(),
	})
	return &testEnv{router: r, users: users, sender: sender, logs: logs}
}

func (e *testEnv) do(method, path, authHeader, body string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rd)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

const v1 = "/api/v1"

// --- /users/*, /sms/send, /fcm_sendone 하위: 관리자 전용 ---

var adminOnlyRoutes = []struct{ method, path, body string }{
	{"GET", "/users/", ""},
	{"GET", "/users/77", ""},
	{"GET", "/users/email/a@b.c", ""},
	{"GET", "/users/token/sometoken", ""},
	{"GET", "/users/recent/signin/3h", ""},
	{"GET", "/users/recent/signin/24h", ""},
	{"GET", "/users/not-joined/11days", ""},
	{"POST", "/users/", `{"mt_id":"01099998888","mt_name":"n","mt_nickname":"n","mt_pwd":"x"}`},
	{"PUT", "/users/77", `{"mt_name":"zzz"}`},
	{"DELETE", "/users/77", ""},
	{"POST", "/sms/send", `{"phone_number":"01011112222","message":"hi"}`},
	{"POST", "/fcm_sendone/test", `{}`},
	{"POST", "/fcm_sendone/test-send/1", ``},
	{"POST", "/fcm_sendone/silent", `{"mt_idx":1}`},
	{"POST", "/fcm_sendone/silent-batch", ``},
	{"POST", "/fcm_sendone/background", `{}`},
}

func TestAdminOnlyRoutesRejectNonAdmin(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeOff, auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newEnv(t, mode)
		for _, rt := range adminOnlyRoutes {
			// 일반 회원(uid 2): 403, 토큰 없음: 401. 핸들러(저장소·발송)에는 도달하지 않는다.
			if w := e.do(rt.method, v1+rt.path, bearer(t, 2), rt.body); w.Code != http.StatusForbidden {
				t.Errorf("[%s] %s %s: 일반 회원은 403이어야 함: %d %s", mode, rt.method, rt.path, w.Code, w.Body.String())
			}
			if w := e.do(rt.method, v1+rt.path, "", rt.body); w.Code != http.StatusUnauthorized {
				t.Errorf("[%s] %s %s: 무토큰은 401이어야 함: %d", mode, rt.method, rt.path, w.Code)
			}
		}
		if e.users.calls != 0 || e.sender.sent != 0 {
			t.Errorf("[%s] 거부된 요청이 저장소/발송에 도달함: users=%d sent=%d", mode, e.users.calls, e.sender.sent)
		}
	}
}

// 관리자 응답에도 비밀 필드(해시, 재설정 토큰, FCM 토큰, 소셜 ID 등)는 키도 값도 없어야 한다.
func TestUsersResponsesHaveNoSecrets(t *testing.T) {
	e := newEnv(t, auth.RouteModeWarn)
	secretKeys := []string{"mt_pwd", "mt_reset_token", "mt_token_id", "mt_remember_token",
		"mt_last_receipt_token", "mt_google_id", "mt_kakao_id", "mt_apple_id"}
	secretVals := []string{secretHash, secretReset, secretFCM, "REMEMBER-SECRET", "RECEIPT-SECRET",
		"GOOGLE-ID-SECRET", "KAKAO-ID-SECRET", "APPLE-ID-SECRET"}
	for _, rt := range adminOnlyRoutes {
		if !strings.HasPrefix(rt.path, "/users") {
			continue
		}
		w := e.do(rt.method, v1+rt.path, bearer(t, 1), rt.body)
		if w.Code != http.StatusOK {
			t.Errorf("관리자 %s %s: 200 기대, got %d %s", rt.method, rt.path, w.Code, w.Body.String())
			continue
		}
		body := w.Body.String()
		for _, k := range secretKeys {
			if strings.Contains(body, `"`+k+`"`) {
				t.Errorf("%s %s 응답에 비밀 필드 키 %s 가 있음", rt.method, rt.path, k)
			}
		}
		for _, v := range secretVals {
			if strings.Contains(body, v) {
				t.Errorf("%s %s 응답에 비밀 값 %q 가 있음", rt.method, rt.path, v)
			}
		}
	}
	// 정상 필드는 그대로 내려간다(형식 유지).
	w := e.do("GET", v1+"/users/email/a@b.c", bearer(t, 1), "")
	var m map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if m["mt_email"] != "a@b.c" || m["mt_idx"] != float64(77) {
		t.Errorf("비밀이 아닌 필드는 유지돼야 함: %v", m["mt_email"])
	}
}

// --- fcm_sendone 루트: 특정 회원 대상은 기존대로, 전체 발송(mt_idx=0)은 관리자만 ---

func TestFCMSendoneBroadcastAdminOnly(t *testing.T) {
	const payload = `{"plt_type":"1","sst_idx":"0","plt_condition":"c","plt_memo":"m","mt_idx":%d,"plt_title":"t","plt_content":"c"}`
	body := func(idx string) string { return strings.Replace(payload, "%d", idx, 1) }

	e := newEnv(t, auth.RouteModeWarn)
	if w := e.do("POST", v1+"/fcm_sendone/", bearer(t, 2), body("0")); w.Code != http.StatusForbidden || e.sender.sent != 0 {
		t.Errorf("일반 회원의 전체 발송은 403이고 발송 0건이어야 함: %d sent=%d", w.Code, e.sender.sent)
	}
	if w := e.do("POST", v1+"/fcm_sendone/", "", body("0")); w.Code != http.StatusUnauthorized || e.sender.sent != 0 {
		t.Errorf("무토큰 전체 발송은 401(warn 모드 통과 후 관리자 게이트)이어야 함: %d", w.Code)
	}
	// 특정 회원 대상 발송은 기존 호출처(웹 일정 알림)가 깨지지 않게 일반 회원도 가능.
	if w := e.do("POST", v1+"/fcm_sendone/", bearer(t, 2), body("5")); w.Code != http.StatusOK || e.sender.sent != 1 {
		t.Errorf("일반 회원의 단건 발송은 기존대로 동작해야 함: %d sent=%d %s", w.Code, e.sender.sent, w.Body.String())
	}
	// 관리자는 전체 발송 가능(토큰 보유 3명).
	before := e.sender.sent
	if w := e.do("POST", v1+"/fcm_sendone/", bearer(t, 1), body("0")); w.Code != http.StatusOK || e.sender.sent-before != 3 {
		t.Errorf("관리자 전체 발송: %d sent=%d %s", w.Code, e.sender.sent-before, w.Body.String())
	}
	// 검증 실패(422)는 게이트보다 먼저: 기존 응답 형식 유지.
	if w := e.do("POST", v1+"/fcm_sendone/", bearer(t, 2), `{"mt_idx":0}`); w.Code != http.StatusUnprocessableEntity {
		t.Errorf("검증 실패는 기존대로 422: %d", w.Code)
	}
}

func TestFCMSendoneBroadcastFailsClosedWithoutGate(t *testing.T) {
	h := handler.NewFCMSendone(service.NewPushSend(&fakeSendMembers{tokens: 3}, fakeLogWriter{}, &fakeSender{}))
	r := gin.New()
	r.POST("/x", h.Send)
	req := httptest.NewRequest("POST", "/x", strings.NewReader(`{"plt_type":"1","sst_idx":"0","plt_condition":"c","plt_memo":"m","mt_idx":0,"plt_title":"t","plt_content":"c"}`))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("게이트 미주입이면 전체 발송은 거부해야 함: %d", w.Code)
	}
}

// --- 인증 미들웨어 부착 범위 ---

// 사용자 인증(ua)이 붙은 대표 라우트. enforce에서 무토큰이면 401, warn에서는 핸들러까지 도달(401 아님).
var attachedRoutes = []struct{ method, path string }{
	{"GET", "/logs/member-location-logs/1/daily-summary"},
	{"POST", "/logs/member-location-logs"},
	{"GET", "/logs/members-with-logs"},
	{"GET", "/group-members/member/1"},
	{"POST", "/group-members/add"},
	{"GET", "/group-details/"},
	{"PUT", "/group-details/1/role"},
	{"GET", "/groups/"},
	{"GET", "/groups/1"},
	{"GET", "/groups/current-user"},
	{"POST", "/groups/join"},
	{"PUT", "/groups/1"},
	{"PUT", "/groups/1/members/2/remove"},
	{"POST", "/groups/1/join-new-member"},
	{"GET", "/locations/"},
	{"GET", "/locations/member/1"},
	{"POST", "/locations/"},
	{"DELETE", "/locations/1"},
	{"GET", "/schedules/"},
	{"POST", "/schedules/"},
	{"GET", "/schedule/group/1/schedules"},
	{"POST", "/schedule/group/1/schedules"},
	{"GET", "/push-logs/"},
	{"POST", "/push-logs/delete-all"},
	{"GET", "/push-fcms/"},
	{"GET", "/members/"},
	{"GET", "/members/5"},
	{"GET", "/members/group/1"},
	{"PUT", "/members/5"},
	{"PATCH", "/members/5/location"},
	{"GET", "/weather/member/5"},
	{"PUT", "/weather/member/5"},
	{"POST", "/fcm_sendone/"},
}

// 공개로 남겨야 하는 라우트(로그인·가입·SMS·비밀번호 찾기·버전·공지·소셜·refresh·hwgi 등)와
// 핸들러가 자체 JWT 처리를 하는 라우트. 어떤 모드에서도 미들웨어가 401을 내면 안 된다.
var publicRoutes = []struct{ method, path string }{
	{"GET", "/app/version-check"},
	{"GET", "/notices/"},
	{"GET", "/notices/search"},
	{"GET", "/notices/1"},
	{"POST", "/auth/login"},
	{"POST", "/auth/login-original"},
	{"POST", "/auth/register"},
	{"POST", "/auth/refresh"},
	{"POST", "/auth/logout"},
	{"POST", "/auth/kakao-login"},
	{"POST", "/auth/google-login"},
	{"POST", "/auth/apple-login"},
	{"POST", "/auth/find-user-by-email"},
	{"POST", "/auth/find-user-by-phone"},
	{"POST", "/auth/forgot-password"},
	{"POST", "/auth/verify-reset-token"},
	{"POST", "/auth/reset-password"},
	{"POST", "/auth/reset-password-by-phone"},
	{"GET", "/auth/me"},
	{"POST", "/sms/send-verification-code"},
	{"POST", "/sms/verify-code"},
	{"GET", "/members/check/phone/01011112222"},
	{"GET", "/members/check/email/a@b.c"},
	{"GET", "/members/check/nickname/x"},
	{"GET", "/members/terms"},
	{"POST", "/members/register"},
	{"POST", "/members/login"},
	{"POST", "/members/google-login"},
	{"POST", "/members/"},
	{"GET", "/groups/1/public"},
	{"GET", "/groups/code/ABC"},
	{"GET", "/hwgi/all-data"},
	{"POST", "/hwgi/bulk-save"},
	{"POST", "/hwgi/upload-photo"},
	{"DELETE", "/hwgi/delete-photo/1"},
	{"GET", "/orders/summary/1"},
	{"GET", "/chats/rooms"},
	{"POST", "/fcm-token/update"},
	{"POST", "/member-fcm-token/register"},
	{"POST", "/member-fcm-token/validate-and-refresh"},
	{"POST", "/member-fcm-token/background-check"},
}

func TestRouteAuthAttachment(t *testing.T) {
	// enforce: 부착 라우트는 무토큰 401, 공개 라우트는 401이 아니다(핸들러가 nil이라 panic→500이면 도달한 것).
	e := newEnv(t, auth.RouteModeEnforce)
	for _, rt := range attachedRoutes {
		if w := e.do(rt.method, v1+rt.path, "", ""); w.Code != http.StatusUnauthorized {
			t.Errorf("[enforce] %s %s: 무토큰 401 기대, got %d", rt.method, rt.path, w.Code)
		}
		if w := e.do(rt.method, v1+rt.path, "Bearer garbage", ""); w.Code != http.StatusUnauthorized {
			t.Errorf("[enforce] %s %s: 무효 토큰 401 기대, got %d", rt.method, rt.path, w.Code)
		}
		if w := e.do(rt.method, v1+rt.path, bearer(t, 3), ""); w.Code != http.StatusUnauthorized {
			t.Errorf("[enforce] %s %s: 탈퇴 회원 토큰 401 기대, got %d", rt.method, rt.path, w.Code)
		}
	}
	for _, rt := range publicRoutes {
		if w := e.do(rt.method, v1+rt.path, "", ""); w.Code == http.StatusUnauthorized && !selfJWT(rt.path) {
			t.Errorf("[enforce] 공개 라우트 %s %s 를 미들웨어가 막음: 401", rt.method, rt.path)
		}
	}

	// warn: 무토큰/무효 토큰이어도 어떤 부착 라우트든 미들웨어가 막지 않는다(핸들러 도달).
	w := newEnv(t, auth.RouteModeWarn)
	for _, rt := range attachedRoutes {
		for _, hdr := range []string{"", "Bearer garbage", bearer(t, 2)} {
			if r := w.do(rt.method, v1+rt.path, hdr, ""); r.Code == http.StatusUnauthorized || r.Code == http.StatusForbidden {
				if strings.HasPrefix(rt.path, "/fcm_sendone") {
					continue // 전체 발송 게이트는 핸들러 소관
				}
				t.Errorf("[warn] %s %s hdr=%.12q: 미들웨어가 요청을 막음: %d", rt.method, rt.path, hdr, r.Code)
			}
		}
		// 탈퇴 회원의 유효 토큰은 warn에서도 401.
		if r := w.do(rt.method, v1+rt.path, bearer(t, 3), ""); r.Code != http.StatusUnauthorized {
			t.Errorf("[warn] %s %s: 탈퇴 회원 토큰은 401이어야 함: %d", rt.method, rt.path, r.Code)
		}
	}
	// off: 모든 라우트가 기존 동작(401 없음). 탈퇴 회원 토큰도 미들웨어가 건드리지 않는다.
	o := newEnv(t, auth.RouteModeOff)
	for _, rt := range attachedRoutes {
		if r := o.do(rt.method, v1+rt.path, bearer(t, 3), ""); r.Code == http.StatusUnauthorized && !strings.HasPrefix(rt.path, "/fcm_sendone") {
			t.Errorf("[off] %s %s: off 모드는 미들웨어가 아무것도 하지 않아야 함", rt.method, rt.path)
		}
	}
}

// 핸들러가 스스로 401을 내는 공개 계열(auth/me, auth/refresh 등)은 미들웨어 무관하게 401일 수 있다.
func selfJWT(path string) bool {
	return path == "/auth/me" || path == "/auth/refresh" || strings.HasPrefix(path, "/member-fcm-token/") || path == "/fcm-token/update" ||
		strings.HasPrefix(path, "/chats/") || strings.HasPrefix(path, "/orders/")
}

// 공개 라우트는 ROUTE_AUTH_MODE=enforce에서도 무토큰으로 정상 응답한다(대표: 버전 확인).
func TestPublicRouteWorksWithoutTokenInEnforce(t *testing.T) {
	e := newEnv(t, auth.RouteModeEnforce)
	if w := e.do("GET", v1+"/app/version-check?platform=android&version=3.1.0", "", ""); w.Code == http.StatusUnauthorized || w.Code >= 500 {
		t.Errorf("version-check는 공개: %d %s", w.Code, w.Body.String())
	}
}

// 선택 인증(uo)이 붙은 weather/current: 토큰 없이도 모든 모드에서 통과, 탈퇴 회원 토큰만 401.
func TestOptionalRouteWeatherCurrent(t *testing.T) {
	e := newEnv(t, auth.RouteModeEnforce)
	if w := e.do("GET", v1+"/weather/current", "", ""); w.Code == http.StatusUnauthorized {
		t.Error("선택 인증은 enforce에서도 무토큰 통과")
	}
	if w := e.do("GET", v1+"/weather/current", bearer(t, 3), ""); w.Code != http.StatusUnauthorized {
		t.Errorf("탈퇴 회원 토큰은 401: %d", w.Code)
	}
}
