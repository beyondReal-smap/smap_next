package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/subscription/fakes"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

var t0 = time.Date(2026, 11, 13, 3, 0, 0, 0, time.UTC)

type subEnv struct {
	repo *fakes.Repo
	st   *fakes.Store
	svc  *SubscriptionService
}

func newSubEnv(allowSandbox bool) *subEnv {
	repo := fakes.NewRepo()
	st := &fakes.Store{}
	svc := NewSubscription(repo, SubscriptionOptions{
		Verifier: st, Notifier: st, AllowSandbox: allowSandbox,
		Policy: SubscriptionPolicy{FreeMaxPlaces: 2, FreeLogDays: 2, PremiumLogDays: 14},
		Plans:  SubscriptionPlanMap{AppleMonthProductID: "m", AppleYearProductID: "y", GoogleMonthBasePlan: "monthly", GoogleYearBasePlan: "yearly"},
	})
	svc.SetClock(func() time.Time { return t0 })
	return &subEnv{repo, st, svc}
}

func appleV(key string, exp time.Time, state store.State) *store.Verified {
	return &store.Verified{Provider: store.ProviderApple, TransactionKey: key, ProductID: "y", Environment: store.EnvProduction,
		ExpiresAt: exp, State: state, LatestEventAt: t0, Acknowledged: true}
}

func googleV(key string, exp time.Time, state store.State) *store.Verified {
	return &store.Verified{Provider: store.ProviderGoogle, TransactionKey: key, ProductID: "smap_premium", BasePlanID: "monthly",
		Environment: store.EnvProduction, ExpiresAt: exp, State: state, LatestEventAt: t0, AutoRenew: true, AutoRenewKnown: true}
}

func iosReq() dto.SubscriptionVerifyRequest {
	return dto.SubscriptionVerifyRequest{Platform: "ios", SignedTransaction: "jws"}
}

func TestVerifyAppleSuccess(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	exp := t0.AddDate(1, 0, 0)
	e.st.Apple = func(string) (*store.Verified, error) { return appleV("otid-1", exp, store.StateActive), nil }
	got, err := e.svc.Verify(context.Background(), 1, iosReq())
	if err != nil {
		t.Fatal(err)
	}
	if !got.IsPremium || *got.Plan != "year" || *got.Platform != "ios" || got.AutoRenew != nil || got.Limits.MaxPlaces != nil || got.Limits.LogRetentionDays != 14 {
		t.Fatalf("status %+v", got)
	}
	if *got.ExpiresAt != "2027-11-13T03:00:00Z" {
		t.Fatal(*got.ExpiresAt)
	}
	m := e.repo.Member(1)
	if *m.MtLevel != 5 || *m.MtPlanCheck != "Y" || !m.MtPlanDate.Equal(exp) {
		t.Fatalf("member %+v", m)
	}
}

func TestVerifyIdempotentAndPlatformInference(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.st.Google = func(p, k string) (*store.Verified, error) {
		return googleV("tok", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	req := dto.SubscriptionVerifyRequest{ProductID: "smap_premium", PurchaseToken: "tok"} // platform 누락
	a, err := e.svc.Verify(context.Background(), 1, req)
	if err != nil {
		t.Fatal(err)
	}
	b, err := e.svc.Verify(context.Background(), 1, req)
	if err != nil || *a.ExpiresAt != *b.ExpiresAt || e.repo.RowCount() != 1 {
		t.Fatalf("not idempotent %v rows=%d", err, e.repo.RowCount())
	}
	if *b.Platform != "android" || *b.Plan != "month" || *b.AutoRenew != true {
		t.Fatalf("%+v", b)
	}
}

func TestGoogleAckAfterCommit(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.st.Google = func(p, k string) (*store.Verified, error) {
		return googleV("tok", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	e.st.Ack = func(string, string) error { return store.ErrStoreUnavailable }
	_, err := e.svc.Verify(context.Background(), 1, dto.SubscriptionVerifyRequest{Platform: "android", ProductID: "smap_premium", PurchaseToken: "tok"})
	if !errors.Is(err, ErrSubStoreDown) {
		t.Fatalf("ack 실패는 502여야 함: %v", err)
	}
	if e.repo.RowCount() != 1 || *e.repo.Member(1).MtLevel != 5 {
		t.Fatal("커밋 후 승인이므로 반영은 남아야 함")
	}
	e.st.Ack = nil // 재시도 성공
	if _, err := e.svc.Verify(context.Background(), 1, dto.SubscriptionVerifyRequest{Platform: "android", ProductID: "smap_premium", PurchaseToken: "tok"}); err != nil {
		t.Fatal(err)
	}
	if len(e.st.AckCalls) != 2 {
		t.Fatalf("ack calls %d", len(e.st.AckCalls))
	}
}

func TestOwnedByOtherAndRace(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.repo.AddMember(2, ip(2), nil, "N")
	e.st.Apple = func(string) (*store.Verified, error) {
		return appleV("otid", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Verify(context.Background(), 2, iosReq()); !errors.Is(err, ErrSubOwnedByOther) {
		t.Fatalf("409 여야 함: %v", err)
	}
	if len(e.repo.RowsOf(2)) != 0 || e.repo.Member(2).MtPlanDate != nil {
		t.Fatal("거부된 회원에게 반영되면 안 됨")
	}

	// 동시 삽입 경쟁: 내 Insert 직전에 다른 요청이 같은 거래를 먼저 커밋 -> 유니크 위반 -> 재조회.
	for _, tc := range []struct {
		name  string
		owner int
		want  error
	}{{"같은 회원이면 멱등", 3, nil}, {"다른 회원이면 409", 1, ErrSubOwnedByOther}} {
		e := newSubEnv(false)
		e.repo.AddMember(1, ip(2), nil, "N")
		e.repo.AddMember(3, ip(2), nil, "N")
		e.st.Apple = func(string) (*store.Verified, error) {
			return appleV("race", t0.AddDate(0, 1, 0), store.StateActive), nil
		}
		fired := false
		e.repo.InsertHook = func(r *fakes.Repo, row *model.SubscriptionTransaction) error {
			if fired {
				return nil
			}
			fired = true
			c := *row
			c.MtIdx = tc.owner
			r.AddRowLocked(c)
			return repository.ErrDuplicateKey
		}
		_, err := e.svc.Verify(context.Background(), 3, iosReq())
		if !errors.Is(err, tc.want) && !(tc.want == nil && err == nil) {
			t.Fatalf("%s: %v", tc.name, err)
		}
	}

	// 계속 경쟁이면 재시도 초과로 503.
	e2 := newSubEnv(false)
	e2.repo.AddMember(1, ip(2), nil, "N")
	e2.st.Apple = func(string) (*store.Verified, error) { return appleV("x", t0.AddDate(0, 1, 0), store.StateActive), nil }
	e2.repo.InsertHook = func(*fakes.Repo, *model.SubscriptionTransaction) error { return repository.ErrDuplicateKey }
	if _, err := e2.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubBusy) {
		t.Fatal(err)
	}
}

func TestVerifyErrorMapping(t *testing.T) {
	cases := []struct {
		in   error
		want error
	}{
		{store.ErrInvalidProof, ErrSubInvalidProof}, {store.ErrNotFound, ErrSubInvalidProof}, {store.ErrExpired, ErrSubExpired},
		{store.ErrSandboxNotAllowed, ErrSubSandboxRejected}, {store.ErrNotConfigured, ErrSubNotConfigured},
		{store.ErrStoreUnavailable, ErrSubStoreDown}, {errors.New("boom"), ErrSubStoreDown},
	}
	for _, c := range cases {
		e := newSubEnv(false)
		e.repo.AddMember(1, ip(2), nil, "N")
		e.st.Apple = func(string) (*store.Verified, error) { return nil, c.in }
		if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, c.want) {
			t.Errorf("%v -> %v want %v", c.in, err, c.want)
		}
	}
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	// 다른 상품
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("k", t0.AddDate(0, 1, 0), store.StateActive)
		v.ProductID = "other"
		return v, nil
	}
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubInvalidProof) {
		t.Fatal(err)
	}
	// 가짜가 샌드박스를 통과시켜도 서비스가 한 번 더 막는다
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("k", t0.AddDate(0, 1, 0), store.StateActive)
		v.Environment = store.EnvSandbox
		return v, nil
	}
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubSandboxRejected) || e.repo.RowCount() != 0 {
		t.Fatal(err)
	}
	// 허용하면 통과
	e3 := newSubEnv(true)
	e3.repo.AddMember(1, ip(2), nil, "N")
	e3.st.Apple = e.st.Apple
	if _, err := e3.svc.Verify(context.Background(), 1, iosReq()); err != nil {
		t.Fatal(err)
	}
	// 요청 형식 / 검증기 없음
	if _, err := e.svc.Verify(context.Background(), 1, dto.SubscriptionVerifyRequest{Platform: "web"}); !errors.Is(err, ErrSubBadRequest) {
		t.Fatal(err)
	}
	nv := NewSubscription(e.repo, SubscriptionOptions{})
	if _, err := nv.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubNotConfigured) {
		t.Fatal(err)
	}
	if _, err := nv.HandleAppleNotification(context.Background(), "x"); !errors.Is(err, ErrSubNotConfigured) {
		t.Fatal(err)
	}
}

func TestExpiredTransaction(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.st.Apple = func(string) (*store.Verified, error) {
		return appleV("old", t0.Add(-time.Hour), store.StateExpired), nil
	}
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubExpired) || e.repo.RowCount() != 0 {
		t.Fatalf("%v rows=%d", err, e.repo.RowCount())
	}
	// 이미 연결된 거래가 만료로 바뀌면 기록 후 거부 + 등급 하향
	e.st.Apple = func(string) (*store.Verified, error) { return appleV("k", t0.AddDate(0, 1, 0), store.StateActive), nil }
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); err != nil {
		t.Fatal(err)
	}
	later := appleV("k", t0.Add(-time.Minute), store.StateExpired)
	later.LatestEventAt = t0.Add(time.Hour)
	e.st.Apple = func(string) (*store.Verified, error) { return later, nil }
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubExpired) {
		t.Fatal(err)
	}
	if *e.repo.Member(1).MtLevel != 2 {
		t.Fatal("만료 후 등급 2")
	}
}

func TestLegacyExpiryKept(t *testing.T) {
	legacy := t0.AddDate(0, 6, 0)
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(5), &legacy, "Y")
	e.st.Apple = func(string) (*store.Verified, error) { return appleV("k", t0.AddDate(0, 1, 0), store.StateActive), nil }
	got, err := e.svc.Verify(context.Background(), 1, iosReq())
	if err != nil {
		t.Fatal(err)
	}
	if !e.repo.Member(1).MtPlanDate.Equal(legacy) || *got.Platform != "legacy" {
		t.Fatalf("기존 만료일이 유지돼야 함: %+v", got)
	}
	// 더 긴 새 구독은 기존을 넘어선다
	e.st.Apple = func(string) (*store.Verified, error) {
		return appleV("k2", t0.AddDate(1, 0, 0), store.StateActive), nil
	}
	got, _ = e.svc.Verify(context.Background(), 1, iosReq())
	if *got.Platform != "ios" {
		t.Fatalf("%+v", got)
	}
	// 만료된 기존 유료 회원(13단계 21명 유형): 새 구독 전에는 비프리미엄
	past := t0.AddDate(-1, 0, 0)
	e.repo.AddMember(2, ip(5), &past, "Y")
	st, _ := e.svc.Status(context.Background(), 2)
	if st.IsPremium || st.Limits.MaxPlaces == nil || *st.Limits.MaxPlaces != 2 || st.Limits.LogRetentionDays != 2 {
		t.Fatalf("%+v", st)
	}
	if *e.repo.Member(2).MtLevel != 2 {
		t.Fatal("조회 시 표시 등급 보정")
	}
}

func TestIsPremium(t *testing.T) {
	fut, past := t0.Add(time.Hour), t0.Add(-time.Hour)
	cases := []struct {
		l    *int
		d    *time.Time
		want bool
	}{{ip(2), &fut, true}, {ip(5), &past, false}, {ip(5), nil, false}, {ip(9), nil, true}, {nil, &fut, true}, {ip(2), &t0, false}}
	for i, c := range cases {
		if IsPremium(c.l, c.d, t0) != c.want {
			t.Errorf("case %d", i)
		}
	}
}

func notif(v *store.Verified, id string) *store.Notification {
	return &store.Notification{Verified: *v, Type: "X", NotificationID: id}
}

func TestNotificationsOrderingAndRefund(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.st.Apple = func(string) (*store.Verified, error) { return appleV("k", t0.AddDate(0, 1, 0), store.StateActive), nil }
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); err != nil {
		t.Fatal(err)
	}
	renew := appleV("k", t0.AddDate(0, 2, 0), store.StateActive)
	renew.LatestEventAt = t0.Add(2 * time.Hour)
	older := appleV("k", t0.AddDate(0, 1, 0), store.StateActive)
	older.LatestEventAt = t0.Add(time.Hour)
	send := func(v *store.Verified) NotifyResult {
		e.st.AppleN = func(string) (*store.Notification, error) { return notif(v, "n"), nil }
		r, err := e.svc.HandleAppleNotification(context.Background(), "p")
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	send(renew)
	send(older) // 역순 도착: 무시
	send(renew) // 중복: 멱등
	if !e.repo.Member(1).MtPlanDate.Equal(t0.AddDate(0, 2, 0)) || e.repo.RowCount() != 1 {
		t.Fatalf("역순/중복 처리 오류 %v", e.repo.Member(1).MtPlanDate)
	}
	refund := appleV("k", t0.AddDate(0, 2, 0), store.StateRefunded)
	refund.LatestEventAt = t0.Add(3 * time.Hour)
	send(refund)
	m := e.repo.Member(1)
	if *m.MtLevel != 2 || m.MtPlanDate.After(t0) || *m.MtPlanCheck != "N" {
		t.Fatalf("환불 반영 %+v", m)
	}
	// 같은 시각에 늦게 온 활성 알림이 환불을 되살리지 못한다
	same := appleV("k", t0.AddDate(0, 2, 0), store.StateActive)
	same.LatestEventAt = refund.LatestEventAt
	send(same)
	if *e.repo.Member(1).MtLevel != 2 {
		t.Fatal("환불 되살아남")
	}
}

func TestNotificationVariants(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	ctx := context.Background()
	// 서명/발신자 실패
	e.st.AppleN = func(string) (*store.Notification, error) { return nil, store.ErrInvalidProof }
	if _, err := e.svc.HandleAppleNotification(ctx, "p"); !errors.Is(err, ErrSubInvalidProof) {
		t.Fatal(err)
	}
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) { return nil, store.ErrUnauthorized }
	if _, err := e.svc.HandleGoogleNotification(ctx, "", nil); !errors.Is(err, ErrSubUnauthorized) {
		t.Fatal(err)
	}
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) { return nil, store.ErrStoreUnavailable }
	if _, err := e.svc.HandleGoogleNotification(ctx, "", nil); !errors.Is(err, ErrSubStoreDown) {
		t.Fatal(err)
	}
	// 테스트/무시/미연결(미연결 거래는 소유자 없는 행으로 기록된다 — H-1)
	e.st.AppleN = func(string) (*store.Notification, error) { return &store.Notification{IsTest: true, Ignore: true}, nil }
	if r, err := e.svc.HandleAppleNotification(ctx, "p"); err != nil || r.Applied {
		t.Fatal(err)
	}
	e.st.AppleN = func(string) (*store.Notification, error) {
		return notif(appleV("nobody", t0.AddDate(0, 1, 0), store.StateActive), "n"), nil
	}
	if r, err := e.svc.HandleAppleNotification(ctx, "p"); err != nil || r.Reason != "recorded_unowned" || e.repo.RowCount() != 1 {
		t.Fatalf("%v %+v", err, r)
	}
	// Google 재가입: 이전 토큰이 연결된 회원에게 새 토큰을 이어 붙인다
	e.st.Google = func(string, string) (*store.Verified, error) {
		return googleV("old-token", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	e.st.Ack = nil
	if _, err := e.svc.Verify(ctx, 1, dto.SubscriptionVerifyRequest{Platform: "android", ProductID: "smap_premium", PurchaseToken: "old-token"}); err != nil {
		t.Fatal(err)
	}
	nv := googleV("new-token", t0.AddDate(0, 3, 0), store.StateActive)
	nv.LinkedTransactionKey = "old-token"
	nv.LatestEventAt = t0.Add(time.Hour)
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) { return notif(nv, "m"), nil }
	if r, err := e.svc.HandleGoogleNotification(ctx, "Bearer x", []byte("{}")); err != nil || !r.Applied {
		t.Fatalf("%v %+v", err, r)
	}
	if len(e.repo.RowsOf(1)) != 2 || !e.repo.Member(1).MtPlanDate.Equal(t0.AddDate(0, 3, 0)) {
		t.Fatal("linked 이어붙임 실패")
	}
}

func TestTableMissing(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(1, ip(2), nil, "N")
	e.repo.TableMissing = true
	e.st.Apple = func(string) (*store.Verified, error) { return appleV("k", t0.AddDate(0, 1, 0), store.StateActive), nil }
	if _, err := e.svc.Verify(context.Background(), 1, iosReq()); !errors.Is(err, ErrSubTableMissing) {
		t.Fatal(err)
	}
	if _, err := e.svc.Status(context.Background(), 1); !errors.Is(err, ErrSubTableMissing) {
		t.Fatal(err)
	}
	e.st.AppleN = func(string) (*store.Notification, error) {
		return notif(appleV("k", t0.AddDate(0, 1, 0), store.StateActive), "n"), nil
	}
	if _, err := e.svc.HandleAppleNotification(context.Background(), "p"); !errors.Is(err, ErrSubTableMissing) {
		t.Fatal(err)
	}
}

func TestStatusShapes(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(9, ip(9), nil, "N")
	st, _ := e.svc.Status(context.Background(), 9)
	if !st.IsPremium || st.ExpiresAt != nil || st.Platform != nil {
		t.Fatalf("%+v", st)
	}
	e.repo.AddMember(1, ip(2), nil, "N")
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("g", t0.AddDate(0, 0, 3), store.StateGrace)
		return v, nil
	}
	got, err := e.svc.Verify(context.Background(), 1, iosReq())
	if err != nil || !got.InGracePeriod {
		t.Fatalf("%v %+v", err, got)
	}
}

func TestExpireLapsed(t *testing.T) {
	e := newSubEnv(false)
	past, fut := t0.Add(-time.Hour), t0.Add(time.Hour)
	e.repo.AddMember(1, ip(5), &past, "Y")
	e.repo.AddMember(2, ip(5), &fut, "Y")
	n, _ := e.svc.ExpireLapsed(context.Background())
	if n != 1 || *e.repo.Member(1).MtLevel != 2 || *e.repo.Member(2).MtLevel != 5 {
		t.Fatal(n)
	}
}

type countMeter struct{ n map[string]int }

func (c *countMeter) WouldBlock(k string) { c.n[k]++ }

func newBenefits(enforce bool) (*SubscriptionBenefits, *fakes.Repo, *countMeter) {
	r := fakes.NewRepo()
	m := &countMeter{n: map[string]int{}}
	b := NewSubscriptionBenefits(r, SubscriptionPolicy{EnforcementEnabled: enforce, FreeMaxPlaces: 2, FreeLogDays: 2, PremiumLogDays: 14}, m, nil)
	b.SetClock(func() time.Time { return t0 }) // KST 2026-11-13 12:00
	return b, r, m
}

func TestPlaceLimit(t *testing.T) {
	ctx := context.Background()
	for _, enforce := range []bool{false, true} {
		b, r, m := newBenefits(enforce)
		fut := t0.Add(time.Hour)
		r.AddMember(1, ip(2), nil, "N")
		r.AddMember(2, ip(5), &fut, "Y")
		r.Places[1], r.Places[2] = 2, 50
		err := b.CheckPlaceCreate(ctx, 1)
		var pl *PlaceLimitError
		if enforce && (!errors.As(err, &pl) || pl.Limit != 2) {
			t.Fatalf("켜짐: 3번째 장소는 막혀야 함 %v", err)
		}
		if !enforce && (err != nil || m.n[WouldBlockPlaceLimit] != 1) {
			t.Fatalf("꺼짐: 통과 + 계측 1 %v %v", err, m.n)
		}
		if b.CheckPlaceCreate(ctx, 2) != nil {
			t.Fatal("프리미엄 무제한")
		}
		r.Places[1] = 1
		if b.CheckPlaceCreate(ctx, 1) != nil {
			t.Fatal("2번째는 허용")
		}
		if b.CheckPlaceCreate(ctx, 404) != nil {
			t.Fatal("회원 없음은 통과")
		}
	}
	// 켜짐 + 이미 5개 가진 무료 회원: 추가만 막힘(조회·수정·삭제는 이 판정을 거치지 않음)
	b, r, _ := newBenefits(true)
	r.AddMember(1, ip(2), nil, "N")
	r.Places[1] = 5
	if b.CheckPlaceCreate(context.Background(), 1) == nil {
		t.Fatal("추가는 막힘")
	}
	// DB 오류: 켜짐은 오류, 꺼짐은 통과
	r.MemberReadErr = errors.New("db")
	if b.CheckPlaceCreate(context.Background(), 1) == nil {
		t.Fatal("켜짐 DB 오류는 표면화")
	}
	b2, r2, _ := newBenefits(false)
	r2.MemberReadErr = errors.New("db")
	if b2.CheckPlaceCreate(context.Background(), 1) != nil {
		t.Fatal("꺼짐은 기존 동작 우선")
	}
}

func TestLogRetention(t *testing.T) {
	ctx := context.Background()
	for _, enforce := range []bool{false, true} {
		b, r, m := newBenefits(enforce)
		fut := t0.Add(time.Hour)
		r.AddMember(1, ip(2), nil, "N")
		r.AddMember(2, ip(5), &fut, "Y")
		// 오늘 KST = 2026-11-13. 무료 첫 날 11-12, 프리미엄 첫 날 10-31.
		if b.CheckLogDate(ctx, 1, "2026-11-12") != nil || b.CheckLogDate(ctx, 1, "2026-11-13") != nil {
			t.Fatal("무료 2일 안은 허용")
		}
		err := b.CheckLogDate(ctx, 1, "2026-11-10") // 3일 전
		var le *LogRetentionError
		if enforce && (!errors.As(err, &le) || le.Days != 2 || le.Premium) {
			t.Fatalf("켜짐 3일 전 거부 %v", err)
		}
		if !enforce && (err != nil || m.n[WouldBlockLogRetention] != 1) {
			t.Fatalf("꺼짐 통과+계측 %v %v", err, m.n)
		}
		if b.CheckLogDate(ctx, 2, "2026-11-10") != nil || b.CheckLogDate(ctx, 2, "2026-10-31") != nil {
			t.Fatal("프리미엄 14일 허용")
		}
		err = b.CheckLogDate(ctx, 2, "2026-10-30")
		if enforce && (!errors.As(err, &le) || le.Days != 14 || !le.Premium) {
			t.Fatalf("프리미엄 15일 전 거부 %v", err)
		}
		if b.CheckLogDate(ctx, 1, "garbage") != nil {
			t.Fatal("형식 오류는 기존 로직에 맡김")
		}
		s, e, err := b.ClampLogRange(ctx, 1, "2026-11-01", "2026-11-13")
		if err != nil {
			t.Fatal(err)
		}
		if enforce && (s != "2026-11-12" || e != "2026-11-13") || !enforce && s != "2026-11-01" {
			t.Fatalf("범위 %s~%s", s, e)
		}
		s, _, _ = b.ClampLogRange(ctx, 1, "", "")
		if enforce && s != "2026-11-12" || !enforce && s != "" {
			t.Fatalf("빈 시작일 %q", s)
		}
		n, _ := b.ClampLogDays(ctx, 1, 14)
		if enforce && n != 2 || !enforce && n != 14 {
			t.Fatalf("days %d", n)
		}
		if n, _ := b.ClampLogDays(ctx, 2, 14); n != 14 {
			t.Fatal("프리미엄 14")
		}
	}
}
