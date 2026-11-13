package middleware

import (
	"bytes"
	"context"
	"errors"
	"fmt"
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
	"github.com/bluemusk/smap_next_go/internal/model"
)

const raTestSecret = "route-auth-test-secret"

func init() { gin.SetMode(gin.TestMode) }

// fakeStates는 회원 상태 조회기 fake다. calls로 DB 조회 횟수를 센다.
type fakeStates struct {
	mu     sync.Mutex
	states map[int]*model.MemberAccessState
	err    error
	calls  int
}

func (f *fakeStates) GetAccessState(mtIdx int) (*model.MemberAccessState, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return f.states[mtIdx], nil
}

func ip(v int) *int       { return &v }
func sp(v string) *string { return &v }

// 회원 번호 → 상태. 1:정상 2:탈퇴 3:정지 4:비노출 5:NULL(오래된 회원) 6:level 9 관리자 (7번은 없음)
func newFakeStates() *fakeStates {
	return &fakeStates{states: map[int]*model.MemberAccessState{
		1: {MtLevel: ip(2), MtStatus: ip(1), MtShow: sp("Y")},
		2: {MtLevel: ip(1), MtStatus: ip(1), MtShow: sp("Y")},
		3: {MtLevel: ip(2), MtStatus: ip(2), MtShow: sp("Y")},
		4: {MtLevel: ip(2), MtStatus: ip(1), MtShow: sp("N")},
		5: {MtLevel: nil, MtStatus: nil, MtShow: nil},
		6: {MtLevel: ip(9), MtStatus: ip(1), MtShow: sp("Y")},
	}}
}

func raToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(time.Hour).Unix()
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(raTestSecret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

type raEnv struct {
	ra      *RouteAuth
	states  *fakeStates
	logs    *bytes.Buffer
	now     time.Time
	nowMu   sync.Mutex
	router  *gin.Engine
	reached int
}

func newRAEnv(t *testing.T, mode auth.RouteMode, ttl time.Duration) *raEnv {
	t.Helper()
	e := &raEnv{states: newFakeStates(), logs: &bytes.Buffer{}, now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	logger := slog.New(slog.NewJSONHandler(e.logs, nil))
	ra, err := NewRouteAuth(RouteAuthOptions{
		Mode: mode, Secret: raTestSecret, Algorithm: "HS256",
		StatusCacheTTL: ttl, SummaryInterval: time.Minute,
		Now: func() time.Time { e.nowMu.Lock(); defer e.nowMu.Unlock(); return e.now },
	}, e.states, logger)
	if err != nil {
		t.Fatal(err)
	}
	e.ra = ra
	r := gin.New()
	handler := func(c *gin.Context) {
		e.reached++
		uid, ok := UserID(c)
		c.JSON(http.StatusOK, gin.H{"uid": uid, "has_uid": ok})
	}
	r.GET("/api/v1/logs/member-location-logs/:mt_idx/daily-summary", ra.Required(), handler)
	r.GET("/api/v1/weather/current", ra.Optional(), handler)
	e.router = r
	return e
}

func (e *raEnv) advance(d time.Duration) { e.nowMu.Lock(); e.now = e.now.Add(d); e.nowMu.Unlock() }

func (e *raEnv) do(path, authHeader, ua string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

const raPath = "/api/v1/logs/member-location-logs/123/daily-summary?start_date=2026-01-01"

// TestRouteAuthMatrix는 3모드 x 토큰 상황의 최종 상태코드와 핸들러 도달 여부를 검증한다.
func TestRouteAuthMatrix(t *testing.T) {
	bearer := func(claims jwt.MapClaims) func(*testing.T) string {
		return func(t *testing.T) string { return "Bearer " + raToken(t, claims) }
	}
	const (
		pass   = http.StatusOK
		reject = http.StatusUnauthorized
	)
	cases := []struct {
		name   string
		header func(*testing.T) string
		off    int
		warn   int
		enf    int
	}{
		{"토큰 없음", func(*testing.T) string { return "" }, pass, pass, reject},
		{"무효 토큰(쓰레기)", func(*testing.T) string { return "Bearer garbage" }, pass, pass, reject},
		{"무효 토큰(만료)", bearer(jwt.MapClaims{"mt_idx": 1, "exp": time.Now().Add(-time.Hour).Unix()}), pass, pass, reject},
		{"유효 토큰 + 정상 회원", bearer(jwt.MapClaims{"mt_idx": 1}), pass, pass, pass},
		{"유효 토큰 + NULL 상태 회원", bearer(jwt.MapClaims{"mt_idx": 5}), pass, pass, pass},
		{"유효 토큰 + 관리자 회원", bearer(jwt.MapClaims{"mt_idx": 6}), pass, pass, pass},
		{"유효 토큰 + 탈퇴 회원(level=1)", bearer(jwt.MapClaims{"mt_idx": 2}), pass, reject, reject},
		{"유효 토큰 + 정지 회원(status=2)", bearer(jwt.MapClaims{"mt_idx": 3}), pass, reject, reject},
		{"유효 토큰 + 비노출 회원(show=N)", bearer(jwt.MapClaims{"mt_idx": 4}), pass, reject, reject},
		{"유효 토큰 + 회원 행 없음", bearer(jwt.MapClaims{"mt_idx": 7}), pass, pass, reject},
		{"type 클레임 있는 토큰", bearer(jwt.MapClaims{"mt_idx": 1, "type": "email_verification"}), pass, pass, reject},
	}
	for _, tt := range cases {
		for _, m := range []struct {
			mode auth.RouteMode
			want int
		}{{auth.RouteModeOff, tt.off}, {auth.RouteModeWarn, tt.warn}, {auth.RouteModeEnforce, tt.enf}} {
			t.Run(fmt.Sprintf("%s/%s", m.mode, tt.name), func(t *testing.T) {
				e := newRAEnv(t, m.mode, 0)
				w := e.do(raPath, tt.header(t), "okhttp/4.12.0")
				if w.Code != m.want {
					t.Fatalf("상태코드 got %d want %d (body=%s)", w.Code, m.want, w.Body.String())
				}
				if (w.Code == http.StatusOK) != (e.reached == 1) {
					t.Errorf("핸들러 도달 여부 불일치: code=%d reached=%d", w.Code, e.reached)
				}
				if w.Code == http.StatusUnauthorized {
					if w.Header().Get("WWW-Authenticate") != "Bearer" || !strings.Contains(w.Body.String(), "인증이 필요합니다.") {
						t.Errorf("401 응답 형식이 RequireAdmin과 달라짐: %v %s", w.Header(), w.Body.String())
					}
				}
			})
		}
	}
}

func TestRouteAuthOffNeverTouchesDB(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeOff, 0)
	e.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 2}), "")
	e.do(raPath, "", "")
	if e.states.calls != 0 {
		t.Errorf("off 모드는 DB를 조회하면 안 됨: %d회", e.states.calls)
	}
}

func TestRouteAuthSetsUserIDInContext(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newRAEnv(t, mode, 0)
		w := e.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 1}), "")
		if !strings.Contains(w.Body.String(), `"uid":1`) || !strings.Contains(w.Body.String(), `"has_uid":true`) {
			t.Errorf("%s: 컨텍스트 uid 주입 실패: %s", mode, w.Body.String())
		}
	}
	// 토큰 없이 통과한 warn 요청에는 uid가 없다.
	e := newRAEnv(t, auth.RouteModeWarn, 0)
	w := e.do(raPath, "", "")
	if !strings.Contains(w.Body.String(), `"has_uid":false`) {
		t.Errorf("무토큰 통과 요청에 uid가 있으면 안 됨: %s", w.Body.String())
	}
}

// 선택 인증은 모드와 관계없이 토큰이 없어도 통과하고, 유효 토큰이면 uid를 넣고, 차단 회원은 401.
func TestRouteAuthOptional(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newRAEnv(t, mode, 0)
		if w := e.do("/api/v1/weather/current", "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"has_uid":false`) {
			t.Errorf("%s 무토큰: %d %s", mode, w.Code, w.Body.String())
		}
		if w := e.do("/api/v1/weather/current", "Bearer garbage", ""); w.Code != 200 {
			t.Errorf("%s 무효 토큰도 통과해야 함: %d", mode, w.Code)
		}
		if w := e.do("/api/v1/weather/current", "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 1}), ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"uid":1`) {
			t.Errorf("%s 유효 토큰: %d %s", mode, w.Code, w.Body.String())
		}
		if w := e.do("/api/v1/weather/current", "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 2}), ""); w.Code != 401 {
			t.Errorf("%s 탈퇴 회원 토큰은 401이어야 함: %d", mode, w.Code)
		}
		// 선택 인증의 무토큰/무효는 계측 대상이 아니다(정상 사용).
		e.ra.flushSummary(time.Minute)
		if strings.Contains(e.logs.String(), `"kind":"no_token"`) || strings.Contains(e.logs.String(), `"kind":"invalid_token"`) {
			t.Errorf("%s 선택 인증은 무토큰을 계측하면 안 됨: %s", mode, e.logs.String())
		}
	}
}

func TestRouteAuthDBErrorIsNotHidden(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newRAEnv(t, mode, 0)
		e.states.err = errors.New("connection refused")
		w := e.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 1}), "")
		if w.Code != http.StatusInternalServerError || e.reached != 0 {
			t.Errorf("%s: 상태 조회 실패는 500(통과 금지): %d reached=%d", mode, w.Code, e.reached)
		}
		if !strings.Contains(e.logs.String(), "route_auth_member_lookup_failed") {
			t.Errorf("%s: 원인 로그가 없음", mode)
		}
		// 토큰이 없는 warn 요청은 DB를 쓰지 않으므로 DB 장애와 무관하게 통과한다.
		if w := e.do(raPath, "", ""); mode == auth.RouteModeWarn && w.Code != 200 {
			t.Errorf("warn 무토큰은 DB 장애와 무관하게 통과해야 함: %d", w.Code)
		}
	}
}

// 상태 캐시: TTL 안에서는 DB를 다시 조회하지 않고, TTL이 지나면 다시 조회해 탈퇴를 반영한다.
func TestRouteAuthStatusCache(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, 30*time.Second)
	hdr := "Bearer " + raToken(t, jwt.MapClaims{"mt_idx": 1})

	for i := 0; i < 5; i++ {
		if w := e.do(raPath, hdr, ""); w.Code != 200 {
			t.Fatalf("정상 회원 통과 실패: %d", w.Code)
		}
	}
	if e.states.calls != 1 {
		t.Fatalf("TTL 안에서는 DB 1회만 조회해야 함: %d", e.states.calls)
	}

	// 회원이 탈퇴 처리됨 — TTL 안에서는 아직 반영되지 않는다(알려진 지연).
	e.states.mu.Lock()
	e.states.states[1] = &model.MemberAccessState{MtLevel: ip(1), MtStatus: ip(1), MtShow: sp("Y")}
	e.states.mu.Unlock()
	e.advance(29 * time.Second)
	if w := e.do(raPath, hdr, ""); w.Code != 200 {
		t.Errorf("TTL 안에서는 캐시된 정상 상태가 쓰여야 함: %d", w.Code)
	}
	// TTL 경과 후에는 재조회해 즉시 401.
	e.advance(2 * time.Second)
	if w := e.do(raPath, hdr, ""); w.Code != 401 {
		t.Errorf("TTL 경과 후 탈퇴가 반영돼야 함: %d", w.Code)
	}
	if e.states.calls != 2 {
		t.Errorf("DB 조회 총 2회 기대: %d", e.states.calls)
	}
	// 조회 오류는 캐시되지 않는다.
	e2 := newRAEnv(t, auth.RouteModeWarn, 30*time.Second)
	e2.states.err = errors.New("boom")
	e2.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 1}), "")
	e2.states.err = nil
	if w := e2.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 1}), ""); w.Code != 200 {
		t.Errorf("오류 직후 복구되면 통과해야 함(오류를 캐시하면 안 됨): %d", w.Code)
	}
}

func TestRouteAuthCacheSizeIsBounded(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, time.Hour)
	for i := 0; i < maxStatusCacheEntries+10; i++ {
		e.ra.cache[100000+i] = statusEntry{expires: e.now.Add(time.Hour)}
	}
	if _, err := e.ra.memberState(1); err != nil {
		t.Fatal(err)
	}
	if len(e.ra.cache) > maxStatusCacheEntries {
		t.Errorf("캐시가 상한을 넘으면 안 됨: %d", len(e.ra.cache))
	}
}

// warn 계측: 라우트 패턴만 남고(실제 ID·토큰·쿼리 값 없음), 무토큰/무효 구분과 앱 식별이 들어간다.
func TestRouteAuthWarnSummaryContent(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, 0)
	secretTok := raToken(t, jwt.MapClaims{"mt_idx": 1, "exp": time.Now().Add(-time.Hour).Unix()})
	for i := 0; i < 3; i++ {
		e.do(raPath, "", "okhttp/4.12.0")
	}
	e.do(raPath, "Bearer "+secretTok, "smap/3.1.0 CFNetwork/1494 Darwin/23.4.0 (iPhone14,2)")
	e.do(raPath, "Bearer "+raToken(t, jwt.MapClaims{"mt_idx": 2}), "okhttp/4.12.0") // 탈퇴 회원 → blocked

	if e.logs.Len() != 0 {
		t.Fatalf("요청마다 로그를 남기면 안 됨(요약 전): %s", e.logs.String())
	}
	e.ra.flushSummary(time.Minute)
	out := e.logs.String()

	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) != 3 {
		t.Fatalf("요약은 서로 다른 조합 수(3줄)만큼이어야 함: %d줄\n%s", len(lines), out)
	}
	for _, want := range []string{
		`"msg":"route_auth_summary"`, `"mode":"warn"`,
		`"route":"/api/v1/logs/member-location-logs/:mt_idx/daily-summary"`,
		`"method":"GET"`, `"client":"okhttp/4.12.0"`, `"client":"smap/3.1.0"`,
		`"kind":"no_token"`, `"kind":"invalid_token"`, `"kind":"blocked_member"`,
		`"action":"allowed"`, `"action":"rejected"`, `"count":3`, `"window_sec":60`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("요약에 %s 가 없음:\n%s", want, out)
		}
	}
	for _, forbidden := range []string{"123", "start_date", "2026-01-01", secretTok, "Bearer", "CFNetwork", "iPhone", "mt_idx\":1"} {
		if strings.Contains(out, forbidden) {
			t.Errorf("요약 로그에 남으면 안 되는 값 %q 가 있음:\n%s", forbidden, out)
		}
	}
	// 비운 뒤에는 더 내보내지 않는다.
	e.logs.Reset()
	e.ra.flushSummary(time.Minute)
	if e.logs.Len() != 0 {
		t.Errorf("flush 후 재요약은 비어야 함: %s", e.logs.String())
	}
}

func TestRouteAuthSummaryKeyCap(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, 0)
	for i := 0; i < maxSummaryKeys+25; i++ {
		e.do(raPath, "", fmt.Sprintf("scanner%d/1.0", i))
	}
	e.ra.flushSummary(time.Minute)
	lines := strings.Split(strings.TrimSpace(e.logs.String()), "\n")
	if len(lines) != maxSummaryKeys+1 { // 키 상한 + overflow 1줄
		t.Fatalf("요약 줄 수 %d, 기대 %d", len(lines), maxSummaryKeys+1)
	}
	if !strings.Contains(lines[len(lines)-1], `"msg":"route_auth_summary_overflow"`) || !strings.Contains(lines[len(lines)-1], `"dropped_events":25`) {
		t.Errorf("overflow 요약이 없음: %s", lines[len(lines)-1])
	}
}

func TestRouteAuthEnforceRecordsRejections(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeEnforce, 0)
	e.do(raPath, "", "okhttp/4.12.0")
	e.ra.flushSummary(time.Minute)
	if !strings.Contains(e.logs.String(), `"action":"rejected"`) || !strings.Contains(e.logs.String(), `"mode":"enforce"`) {
		t.Errorf("enforce 거부도 요약에 남아야 함: %s", e.logs.String())
	}
}

func TestRunFlushesOnCancel(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, 0)
	e.do(raPath, "", "okhttp/4.12.0")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.ra.Run(ctx); close(done) }()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run이 ctx 취소 후 종료하지 않음(고루틴 누수)")
	}
	if !strings.Contains(e.logs.String(), "route_auth_summary") {
		t.Errorf("종료 시 남은 카운터를 내보내야 함: %s", e.logs.String())
	}
	// off 모드는 즉시 반환.
	off := newRAEnv(t, auth.RouteModeOff, 0)
	d2 := make(chan struct{})
	go func() { off.ra.Run(context.Background()); close(d2) }()
	select {
	case <-d2:
	case <-time.After(time.Second):
		t.Fatal("off 모드 Run은 즉시 반환해야 함")
	}
}

func TestRunPeriodicFlush(t *testing.T) {
	e := newRAEnv(t, auth.RouteModeWarn, 0)
	e.ra.opts.SummaryInterval = 20 * time.Millisecond
	e.do(raPath, "", "okhttp/4.12.0")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.ra.Run(ctx); close(done) }()
	deadline := time.After(2 * time.Second)
	for {
		e.ra.sumMu.Lock()
		empty := len(e.ra.counters) == 0
		e.ra.sumMu.Unlock()
		if empty {
			break
		}
		select {
		case <-deadline:
			t.Fatal("주기 요약이 동작하지 않음")
		case <-time.After(5 * time.Millisecond):
		}
	}
	cancel()
	<-done
}

func TestNewRouteAuthValidation(t *testing.T) {
	st := newFakeStates()
	if _, err := NewRouteAuth(RouteAuthOptions{Mode: "bogus", Secret: "s", Algorithm: "HS256"}, st, nil); err == nil {
		t.Error("알 수 없는 모드는 에러여야 함")
	}
	if _, err := NewRouteAuth(RouteAuthOptions{Mode: auth.RouteModeWarn, Algorithm: "HS256"}, st, nil); err == nil {
		t.Error("warn/enforce에서 빈 시크릿은 에러여야 함")
	}
	if _, err := NewRouteAuth(RouteAuthOptions{Mode: auth.RouteModeWarn, Secret: "s", Algorithm: "HS256"}, nil, nil); err == nil {
		t.Error("조회기가 없으면 에러여야 함")
	}
	if _, err := NewRouteAuth(RouteAuthOptions{Mode: auth.RouteModeWarn, Secret: "s", Algorithm: "HS256", StatusCacheTTL: -1}, st, nil); err == nil {
		t.Error("음수 TTL은 에러여야 함")
	}
	if _, err := NewRouteAuth(RouteAuthOptions{Mode: auth.RouteModeOff}, nil, nil); err != nil {
		t.Errorf("off 모드는 시크릿/조회기 없이도 만들 수 있어야 함: %v", err)
	}
}

func TestClientLabel(t *testing.T) {
	cases := map[string]string{
		"":                                 "none",
		"okhttp/4.12.0":                    "okhttp/4.12.0",
		"smap/3.1.0 CFNetwork/1 Darwin/23": "smap/3.1.0",
		"Mozilla/5.0 (iPhone; CPU)":        "Mozilla/5.0",
		"evil\nINJECT{}":                   "evil?INJECT??",
		strings.Repeat("a", 100):           strings.Repeat("a", 40),
	}
	for in, want := range cases {
		if got := clientLabel(in); got != want {
			t.Errorf("clientLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestUserIDHelperIgnoresForeignValues(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if _, ok := UserID(c); ok {
		t.Error("미설정이면 false")
	}
	c.Set(ctxUserIDKey, "7")
	if _, ok := UserID(c); ok {
		t.Error("int가 아닌 값은 false")
	}
	c.Set(ctxUserIDKey, 0)
	if _, ok := UserID(c); ok {
		t.Error("0은 false")
	}
	c.Set(ctxUserIDKey, 7)
	if uid, ok := UserID(c); !ok || uid != 7 {
		t.Errorf("정상 값: %d %v", uid, ok)
	}
}
