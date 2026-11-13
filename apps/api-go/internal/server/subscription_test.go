package server

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/service"
	"github.com/bluemusk/smap_next_go/internal/subscription/fakes"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

// 구독 라우트 테스트: 실제 라우터·미들웨어·가드·서비스에 저장소와 스토어 검증기만 메모리 가짜를 쓴다.

type subHTTP struct {
	router http.Handler
	repo   *fakes.Repo
	st     *fakes.Store
	places *fakePlaceRepo
	t      *testing.T
}

type wouldBlockCount struct{ n map[string]int }

func (w *wouldBlockCount) WouldBlock(k string) { w.n[k]++ }

func newSubHTTP(t *testing.T, enforce bool, withStore bool) (*subHTTP, *wouldBlockCount) {
	t.Helper()
	cfg := testCfg()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	// ROUTE_AUTH_MODE=warn 이어도 구독 me/verify 는 enforce 고정이어야 한다.
	routeRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{Mode: auth.RouteModeWarn, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	subRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{Mode: auth.RouteModeEnforce, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute, Scope: "subscription"}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	guard := handler.NewLocationGuard(service.NewLocationAuthz(world(), true), routeRA, false)

	repo := fakes.NewRepo()
	st := &fakes.Store{}
	now := time.Now().UTC()
	repo.AddMember(gMember, ptr(2), nil, "N")
	repo.AddMember(gOwner, ptr(2), nil, "N")
	prem := now.Add(24 * time.Hour)
	repo.AddMember(gLeader, ptr(5), &prem, "Y")
	policy := service.SubscriptionPolicy{EnforcementEnabled: enforce, FreeMaxPlaces: 2, FreeLogDays: 2, PremiumLogDays: 14}
	meter := &wouldBlockCount{n: map[string]int{}}
	benefits := handler.NewBenefitGuard(service.NewSubscriptionBenefits(repo, policy, meter, logger))
	opt := service.SubscriptionOptions{Policy: policy, Logger: logger,
		Plans: service.SubscriptionPlanMap{AppleMonthProductID: "m", AppleYearProductID: "y", GoogleMonthBasePlan: "monthly", GoogleYearBasePlan: "yearly"}}
	if withStore {
		opt.Verifier, opt.Notifier = st, st
	}
	subH := handler.NewSubscription(service.NewSubscription(repo, opt))

	placeRepo := newFakePlaceRepo()
	locH := handler.NewLocation(service.NewLocation(placeRepo))
	locH.SetGuard(guard)
	locH.SetBenefits(benefits)
	logH := handler.NewLocationLog(service.NewLocationLog(newFakeLogRepo()), cfg)
	logH.SetGuard(guard)
	logH.SetBenefits(benefits)

	r := New(cfg, logger, Deps{AdminAuth: stubAdmin, UserAuth: routeRA.Required(), UserAuthOpt: routeRA.Optional(), LocationAuth: routeRA.Required(),
		Location: locH, LocationLog: logH, Subscription: subH, SubscriptionAuth: subRA.Required()})
	return &subHTTP{r, repo, st, placeRepo, t}, meter
}

func ptr(v int) *int { return &v }

func (e *subHTTP) do(method, path string, uid int, body string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, rd)
	req.Header.Set("Content-Type", "application/json")
	if uid > 0 {
		req.Header.Set("Authorization", bearer(e.t, uid))
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

func okVerified(key string, p store.Provider) *store.Verified {
	v := &store.Verified{Provider: p, TransactionKey: key, ProductID: "y", Environment: store.EnvProduction,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour), State: store.StateActive, LatestEventAt: time.Now(), Acknowledged: true}
	if p == store.ProviderGoogle {
		v.ProductID, v.BasePlanID = "smap_premium", "yearly"
	}
	return v
}

func TestSubscriptionRoutesRequireTokenRegardlessOfMode(t *testing.T) {
	e, _ := newSubHTTP(t, false, true)
	for _, c := range [][2]string{{"GET", "/subscriptions/me"}, {"POST", "/subscriptions/verify"}} {
		if w := e.do(c[0], c[1], 0, `{"platform":"ios","signed_transaction":"x"}`); w.Code != 401 {
			t.Errorf("%s %s 무토큰 %d", c[0], c[1], w.Code)
		}
	}
}

func TestSubscriptionVerifyAppRequests(t *testing.T) {
	e, _ := newSubHTTP(t, false, true)
	e.st.Apple = func(j string) (*store.Verified, error) {
		if j != "eyJ.jws.sig" {
			t.Errorf("JWS가 그대로 전달돼야 함")
		}
		return okVerified("otid", store.ProviderApple), nil
	}
	e.st.Google = func(p, k string) (*store.Verified, error) {
		if p != "smap_premium" || k != "purchase-token" {
			t.Errorf("Android 인자 %s %s", p, k)
		}
		return okVerified("purchase-token", store.ProviderGoogle), nil
	}
	// iOS 앱 본문
	w := e.do("POST", "/subscriptions/verify", gMember, `{"platform":"ios","signed_transaction":"eyJ.jws.sig"}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"is_premium":true`) || !strings.Contains(w.Body.String(), `"platform":"ios"`) ||
		!strings.Contains(w.Body.String(), `"max_places":null`) || !strings.Contains(w.Body.String(), `"enforcement_enabled":false`) {
		t.Fatalf("iOS %d %s", w.Code, w.Body.String())
	}
	// Android 앱 본문(다른 회원)
	w = e.do("POST", "/subscriptions/verify", gOwner, `{"platform":"android","product_id":"smap_premium","purchase_token":"purchase-token"}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"platform":"android"`) || !strings.Contains(w.Body.String(), `"plan":"year"`) {
		t.Fatalf("Android %d %s", w.Code, w.Body.String())
	}
	// 다른 회원이 같은 iOS 거래 -> 409 + 계약 문구
	w = e.do("POST", "/subscriptions/verify", gOwner, `{"platform":"ios","signed_transaction":"eyJ.jws.sig"}`)
	if w.Code != 409 || !strings.Contains(w.Body.String(), "이 구매는 다른 계정에 연결되어 있어요.") {
		t.Fatalf("409 %d %s", w.Code, w.Body.String())
	}
	// me
	w = e.do("GET", "/subscriptions/me", gMember, "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"plan":"year"`) {
		t.Fatalf("me %d %s", w.Code, w.Body.String())
	}
	// 형식 오류 400
	if w = e.do("POST", "/subscriptions/verify", gMember, `{"platform":"ios"}`); w.Code != 400 {
		t.Fatalf("%d", w.Code)
	}
	// 스토어 오류 매핑
	for _, c := range []struct {
		err  error
		want int
	}{{store.ErrInvalidProof, 400}, {store.ErrExpired, 400}, {store.ErrStoreUnavailable, 502}, {store.ErrNotConfigured, 503}} {
		e.st.Apple = func(string) (*store.Verified, error) { return nil, c.err }
		if w = e.do("POST", "/subscriptions/verify", gLeader, `{"platform":"ios","signed_transaction":"z"}`); w.Code != c.want {
			t.Errorf("%v -> %d", c.err, w.Code)
		}
	}
}

func TestSubscriptionNotConfiguredAndTableMissing(t *testing.T) {
	e, _ := newSubHTTP(t, false, false) // 검증기 없음
	if w := e.do("POST", "/subscriptions/verify", gMember, `{"platform":"ios","signed_transaction":"x"}`); w.Code != 503 {
		t.Fatalf("설정 없음 %d", w.Code)
	}
	if w := e.do("POST", "/subscriptions/apple/notifications", 0, `{"signedPayload":"x"}`); w.Code != 503 {
		t.Fatalf("알림 설정 없음 %d", w.Code)
	}
	e2, _ := newSubHTTP(t, false, true)
	e2.repo.TableMissing = true
	e2.st.Apple = func(string) (*store.Verified, error) { return okVerified("k", store.ProviderApple), nil }
	if w := e2.do("POST", "/subscriptions/verify", gMember, `{"platform":"ios","signed_transaction":"x"}`); w.Code != 503 {
		t.Fatalf("테이블 없음 verify %d", w.Code)
	}
	if w := e2.do("GET", "/subscriptions/me", gMember, ""); w.Code != 503 {
		t.Fatalf("테이블 없음 me %d", w.Code)
	}
	// 구독 외 기능은 정상
	if w := e2.do("GET", "/logs/member-location-logs/3/daily?date="+time.Now().Format("2006-01-02"), gMember, ""); w.Code != 200 {
		t.Fatalf("구독 외 기능 %d", w.Code)
	}
}

func TestSubscriptionNotificationRoutes(t *testing.T) {
	e, _ := newSubHTTP(t, false, true)
	// 인증 헤더 없이도 도달하고, 서명 검증 실패는 400/401
	e.st.AppleN = func(string) (*store.Notification, error) { return nil, store.ErrInvalidProof }
	if w := e.do("POST", "/subscriptions/apple/notifications", 0, `{"signedPayload":"bad"}`); w.Code != 400 {
		t.Fatalf("%d", w.Code)
	}
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) { return nil, store.ErrUnauthorized }
	if w := e.do("POST", "/subscriptions/google/notifications", 0, `{"message":{"data":"e30="}}`); w.Code != 401 {
		t.Fatalf("%d", w.Code)
	}
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) { return nil, store.ErrStoreUnavailable }
	if w := e.do("POST", "/subscriptions/google/notifications", 0, `{"message":{"data":"e30="}}`); w.Code != 503 {
		t.Fatalf("스토어 장애는 재시도 유도 5xx: %d", w.Code)
	}
	e.st.AppleN = func(string) (*store.Notification, error) { return &store.Notification{IsTest: true, Ignore: true}, nil }
	if w := e.do("POST", "/subscriptions/apple/notifications", 0, `{"signedPayload":"t"}`); w.Code != 200 {
		t.Fatalf("%d", w.Code)
	}
}

func today(offset int) string {
	return time.Now().In(time.FixedZone("KST", 9*3600)).AddDate(0, 0, -offset).Format("2006-01-02")
}

func TestEnforcementPlacesAndLogs(t *testing.T) {
	for _, enforce := range []bool{false, true} {
		e, meter := newSubHTTP(t, enforce, true)
		place := `{"slt_title":"집","slt_add":"서울","slt_lat":37.5,"slt_long":127.0}`
		e.repo.Places[gMember] = 2 // 이미 2개
		w := e.do("POST", "/locations/", gMember, place)
		if enforce {
			if w.Code != 403 || !strings.Contains(w.Body.String(), `"code":"PLACE_LIMIT_EXCEEDED"`) || !strings.Contains(w.Body.String(), `"limit":2`) ||
				!strings.Contains(w.Body.String(), "무료 회원은 내 장소를 2개까지 등록할 수 있어요.") {
				t.Fatalf("켜짐 %d %s", w.Code, w.Body.String())
			}
		} else if w.Code != 200 || meter.n["place_limit"] != 1 {
			t.Fatalf("꺼짐 %d meter=%v", w.Code, meter.n)
		}
		// 이미 5개 가진 무료 회원: 수정·삭제·조회는 허용
		e.repo.Places[gMember] = 5
		if w = e.do("PUT", "/locations/1/notification", gMember, `{"slt_enter_alarm":"N"}`); w.Code == 403 {
			t.Fatalf("수정은 허용돼야 함 %d", w.Code)
		}
		if w = e.do("GET", "/locations/member/3", gMember, ""); w.Code != 200 {
			t.Fatalf("조회 %d", w.Code)
		}
		// 프리미엄(2번 리더)은 무제한
		e.repo.Places[gLeader] = 50
		if w = e.do("POST", "/locations/", gLeader, place); w.Code == 403 {
			t.Fatalf("프리미엄 %d", w.Code)
		}
		// 3일 전 로그 조회
		w = e.do("GET", "/logs/member-location-logs/3/daily?date="+today(3), gMember, "")
		if enforce {
			if w.Code != 403 || !strings.Contains(w.Body.String(), `"code":"LOG_RETENTION_EXCEEDED"`) || !strings.Contains(w.Body.String(), `"retention_days":2`) {
				t.Fatalf("켜짐 로그 %d %s", w.Code, w.Body.String())
			}
		} else if w.Code != 200 || meter.n["log_retention"] != 1 {
			t.Fatalf("꺼짐 로그 %d %v", w.Code, meter.n)
		}
		if w = e.do("GET", "/logs/member-location-logs/3/daily?date="+today(1), gMember, ""); w.Code != 200 {
			t.Fatalf("어제는 허용 %d", w.Code)
		}
		// POST act 방식
		act := fmt.Sprintf(`{"act":"get_daily_location_logs","mt_idx":3,"date":%q}`, today(3))
		w = e.do("POST", "/logs/member-location-logs", gMember, act)
		if enforce && w.Code != 403 || !enforce && w.Code != 200 {
			t.Fatalf("act %v %d", enforce, w.Code)
		}
		// 위치 로그 수집(create)은 영향 없음
		w = e.do("POST", "/logs/member-location-logs", gMember, `{"act":"create_location_log","mt_idx":3,"mlt_lat":37.5,"mlt_long":127.0}`)
		if w.Code == 403 {
			t.Fatalf("수집은 제한 없음 %d", w.Code)
		}
		// 프리미엄은 3일 전 허용
		if w = e.do("GET", "/logs/member-location-logs/2/daily?date="+today(3), gLeader, ""); w.Code == 403 && enforce {
			// 리더(2)는 자기 로그 -> 허용이어야 함
			t.Fatalf("프리미엄 3일 전 %d %s", w.Code, w.Body.String())
		}
	}
	_ = context.Background()
}
