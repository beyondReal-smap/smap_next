package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

func notifyApple(e *subEnv, v *store.Verified, typ string) (NotifyResult, error) {
	e.st.AppleN = func(string) (*store.Notification, error) {
		return &store.Notification{Verified: *v, Type: typ, NotificationID: "n-" + typ}, nil
	}
	return e.svc.HandleAppleNotification(context.Background(), "payload")
}

func unownedRow(t *testing.T, e *subEnv) model.SubscriptionTransaction {
	t.Helper()
	rows := e.repo.RowsOf(model.UnownedMtIdx)
	if len(rows) != 1 {
		t.Fatalf("소유자 없는 행 %d개", len(rows))
	}
	return rows[0]
}

// H-1(리뷰 PoC1): 연결 전에 도착한 REFUND 가 묘비로 남아, 환불 전에 서명된 오래된 JWS 로 verify 해도 거부된다.
func TestTombstoneRefundBeforeLinkRejectsStaleJWS(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(2, ip(2), nil, "N")
	exp := t0.AddDate(1, 0, 0)
	refund := appleV("otid-X", exp, store.StateRefunded)
	refund.LatestEventAt = t0.Add(-time.Hour)
	res, err := notifyApple(e, refund, "REFUND")
	if err != nil || !res.Applied || res.Reason != "recorded_unowned" {
		t.Fatalf("묘비 기록 실패: %+v %v", res, err)
	}
	if r := unownedRow(t, e); r.Status != string(store.StateRefunded) {
		t.Fatalf("묘비 상태 %s", r.Status)
	}
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("otid-X", exp, store.StateActive)
		v.LatestEventAt = t0.Add(-48 * time.Hour)
		return v, nil
	}
	if _, err := e.svc.Verify(context.Background(), 2, iosReq()); !errors.Is(err, ErrSubExpired) {
		t.Fatalf("묘비가 있는 거래는 거부돼야 함: %v", err)
	}
	if r := unownedRow(t, e); r.MtIdx != model.UnownedMtIdx || e.repo.RowCount() != 1 {
		t.Fatalf("묘비에 소유자가 생기면 안 됨: %+v", r)
	}
	if m := e.repo.Member(2); *m.MtLevel != 2 || (m.MtPlanDate != nil && m.MtPlanDate.After(t0)) {
		t.Fatalf("회원 혜택이 켜지면 안 됨: %+v", m)
	}
}

// 묘비는 더 최신인 증빙으로도 되살릴 수 없다(같은 시각 포함). 회수(REVOKE)와 Google voided 도 같다.
func TestTombstoneCannotBeResurrected(t *testing.T) {
	for _, st := range []store.State{store.StateRefunded, store.StateRevoked} {
		e := newSubEnv(false)
		e.repo.AddMember(2, ip(2), nil, "N")
		exp := t0.AddDate(0, 1, 0)
		tomb := appleV("otid-T", exp, st)
		if _, err := notifyApple(e, tomb, "REVOKE"); err != nil {
			t.Fatal(err)
		}
		for _, at := range []time.Time{t0, t0.Add(time.Hour)} { // 같은 시각, 더 최신
			e.st.Apple = func(string) (*store.Verified, error) {
				v := appleV("otid-T", exp, store.StateActive)
				v.LatestEventAt = at
				return v, nil
			}
			if _, err := e.svc.Verify(context.Background(), 2, iosReq()); !errors.Is(err, ErrSubExpired) {
				t.Fatalf("%s at=%v: %v", st, at, err)
			}
		}
		if len(e.repo.RowsOf(2)) != 0 {
			t.Fatalf("%s: 회원에 연결되면 안 됨", st)
		}
	}
	// Google: 이전 토큰 없이 도착한 SUBSCRIPTION_REVOKED 도 묘비
	e := newSubEnv(false)
	e.repo.AddMember(3, ip(2), nil, "N")
	gv := googleV("g-tok", t0.AddDate(0, 1, 0), store.StateRevoked)
	e.st.GoogleN = func(string, []byte) (*store.Notification, error) {
		return &store.Notification{Verified: *gv, Type: "SUBSCRIPTION_REVOKED"}, nil
	}
	if r, err := e.svc.HandleGoogleNotification(context.Background(), "", nil); err != nil || r.Reason != "recorded_unowned" {
		t.Fatalf("%+v %v", r, err)
	}
	e.st.Google = func(string, string) (*store.Verified, error) {
		return googleV("g-tok", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	if _, err := e.svc.Verify(context.Background(), 3, androidReq("g-tok")); !errors.Is(err, ErrSubExpired) {
		t.Fatalf("Google 묘비: %v", err)
	}
}

func androidReq(tok string) dto.SubscriptionVerifyRequest {
	return dto.SubscriptionVerifyRequest{Platform: "android", ProductID: "smap_premium", PurchaseToken: tok}
}

// 연결 전에 도착한 일반 상태(만료·해지)도 기록해 두고, verify 때 알림이 더 최신이면 알림 상태를 따른다(오래된 JWS 가 되살리지 못함).
func TestUnlinkedExpiredNotificationBeatsStaleJWS(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(2, ip(2), nil, "N")
	expired := appleV("otid-E", t0.Add(-time.Hour), store.StateExpired)
	expired.LatestEventAt = t0.Add(-time.Hour)
	if r, err := notifyApple(e, expired, "EXPIRED"); err != nil || r.Reason != "recorded_unowned" {
		t.Fatalf("%+v %v", r, err)
	}
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("otid-E", t0.AddDate(0, 1, 0), store.StateActive) // 만료 전에 서명된 오래된 JWS
		v.LatestEventAt = t0.Add(-30 * 24 * time.Hour)
		return v, nil
	}
	if _, err := e.svc.Verify(context.Background(), 2, iosReq()); !errors.Is(err, ErrSubExpired) {
		t.Fatalf("만료 알림이 더 최신이면 거부해야 함: %v", err)
	}
}

// 연결 전에 도착한 더 최신 갱신 알림: 오래된 증빙으로 verify 하면 소유권은 얻되 상태는 알림의 것(더 늦은 만료일)을 따른다.
func TestUnlinkedRenewalNotificationWinsOverOlderProof(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(2, ip(2), nil, "N")
	newer := appleV("otid-R", t0.AddDate(0, 2, 0), store.StateActive)
	newer.LatestEventAt = t0
	if _, err := notifyApple(e, newer, "DID_RENEW"); err != nil {
		t.Fatal(err)
	}
	e.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("otid-R", t0.AddDate(0, 1, 0), store.StateActive)
		v.LatestEventAt = t0.Add(-24 * time.Hour)
		return v, nil
	}
	st, err := e.svc.Verify(context.Background(), 2, iosReq())
	if err != nil || !st.IsPremium || *st.ExpiresAt != t0.AddDate(0, 2, 0).Format(time.RFC3339) {
		t.Fatalf("%+v %v", st, err)
	}
	if rows := e.repo.RowsOf(2); len(rows) != 1 || rows[0].MtIdx != 2 {
		t.Fatalf("소유권이 이전돼야 함: %+v", rows)
	}
}

// 소유자 없는 행에 같은 알림이 반복돼도 멱등이고, 이후 연결된 거래의 알림은 소유자 쪽으로 반영된다.
func TestUnlinkedNotificationIdempotentThenOwned(t *testing.T) {
	e := newSubEnv(false)
	e.repo.AddMember(2, ip(2), nil, "N")
	v := appleV("otid-I", t0.AddDate(0, 1, 0), store.StateActive)
	for i := 0; i < 3; i++ {
		if _, err := notifyApple(e, v, "SUBSCRIBED"); err != nil {
			t.Fatal(err)
		}
	}
	if e.repo.RowCount() != 1 {
		t.Fatalf("rows %d", e.repo.RowCount())
	}
	e.st.Apple = func(string) (*store.Verified, error) { return v, nil }
	if _, err := e.svc.Verify(context.Background(), 2, iosReq()); err != nil {
		t.Fatal(err)
	}
	cancelled := appleV("otid-I", v.ExpiresAt, store.StateRefunded)
	cancelled.LatestEventAt = t0.Add(time.Hour)
	if r, err := notifyApple(e, cancelled, "REFUND"); err != nil || r.Reason != "applied" {
		t.Fatalf("%+v %v", r, err)
	}
	if m := e.repo.Member(2); *m.MtLevel != 2 {
		t.Fatalf("환불 후 프리미엄 해제: %+v", m)
	}
}

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func newTokenEnv() *subEnv {
	e := newSubEnv(false)
	e.svc.acctKey = []byte(strings.Repeat("k", 32))
	return e
}

// M-1: 계정 토큰은 서버 비밀로 만든 UUID 이고, 회원마다 다르며, 비밀이 없으면 만들지 않는다.
func TestAccountTokenDerivation(t *testing.T) {
	e := newTokenEnv()
	a, b := e.svc.AccountToken(1), e.svc.AccountToken(2)
	if !uuidRe.MatchString(a) || a == b || a != e.svc.AccountToken(1) {
		t.Fatalf("%s %s", a, b)
	}
	other := newSubEnv(false)
	other.svc.acctKey = []byte(strings.Repeat("z", 32))
	if other.svc.AccountToken(1) == a {
		t.Fatal("비밀이 다르면 값도 달라야 함")
	}
	if got := newSubEnv(false).svc.AccountToken(1); got != "" {
		t.Fatalf("비밀 없으면 빈 값이어야 함: %q", got)
	}
	e.repo.AddMember(1, ip(2), nil, "N")
	if st, err := e.svc.Status(context.Background(), 1); err != nil || st.AccountToken != a {
		t.Fatalf("%+v %v", st, err)
	}
}

// M-1(리뷰 PoC2/3): 증빙의 계정 토큰이 요청 회원과 다르면 거부, 같으면(대소문자 무관) 통과, 없으면 기존 흐름.
func TestVerifyAccountTokenMismatch(t *testing.T) {
	e := newTokenEnv()
	e.repo.AddMember(1, ip(2), nil, "N")
	e.repo.AddMember(9, ip(2), nil, "N")
	proof := func(token string) {
		e.st.Apple = func(string) (*store.Verified, error) {
			v := appleV("otid-A", t0.AddDate(0, 1, 0), store.StateActive)
			v.AppAccountToken = token
			return v, nil
		}
	}
	// 1번 회원용으로 만든 토큰이 박힌 증빙을 9번 회원이 가져와 verify
	proof(e.svc.AccountToken(1))
	if _, err := e.svc.Verify(context.Background(), 9, iosReq()); !errors.Is(err, ErrSubOwnedByOther) {
		t.Fatalf("다른 회원의 토큰: %v", err)
	}
	if e.repo.RowCount() != 0 {
		t.Fatal("거부된 증빙은 아무것도 남기면 안 됨")
	}
	proof(strings.ToUpper(e.svc.AccountToken(1)))
	if st, err := e.svc.Verify(context.Background(), 1, iosReq()); err != nil || !st.IsPremium {
		t.Fatalf("본인 토큰: %+v %v", st, err)
	}
	// 토큰이 없는 증빙(현재 앱)은 영향 없음
	e2 := newTokenEnv()
	e2.repo.AddMember(5, ip(2), nil, "N")
	e2.st.Apple = func(string) (*store.Verified, error) {
		return appleV("otid-B", t0.AddDate(0, 1, 0), store.StateActive), nil
	}
	if _, err := e2.svc.Verify(context.Background(), 5, iosReq()); err != nil {
		t.Fatal(err)
	}
	// 서버 비밀이 없으면 대조하지 않는다
	e3 := newSubEnv(false)
	e3.repo.AddMember(5, ip(2), nil, "N")
	e3.st.Apple = func(string) (*store.Verified, error) {
		v := appleV("otid-C", t0.AddDate(0, 1, 0), store.StateActive)
		v.AppAccountToken = "11111111-2222-4333-8444-555555555555"
		return v, nil
	}
	if _, err := e3.svc.Verify(context.Background(), 5, iosReq()); err != nil {
		t.Fatal(err)
	}
}

// M-1: 소유자가 탈퇴·정지·비노출이면 새 요청 회원이 거래를 이어받고, 이전 소유자의 혜택 컬럼은 회수된다. 정상 소유자면 409.
func TestOwnershipTransferFromBlockedOwner(t *testing.T) {
	setup := func() *subEnv {
		e := newSubEnv(false)
		e.repo.AddMember(1, ip(2), nil, "N")
		e.repo.AddMember(2, ip(2), nil, "N")
		e.st.Apple = func(string) (*store.Verified, error) {
			return appleV("otid-O", t0.AddDate(0, 1, 0), store.StateActive), nil
		}
		if _, err := e.svc.Verify(context.Background(), 1, iosReq()); err != nil {
			t.Fatal(err)
		}
		return e
	}
	e := setup()
	if _, err := e.svc.Verify(context.Background(), 2, iosReq()); !errors.Is(err, ErrSubOwnedByOther) {
		t.Fatalf("정상 소유자: %v", err)
	}
	for name, block := range map[string]func(m *model.SubscriptionMemberPlan){
		"탈퇴":  func(m *model.SubscriptionMemberPlan) { v := 1; m.MtLevel = &v },
		"정지":  func(m *model.SubscriptionMemberPlan) { v := 2; m.MtStatus = &v },
		"비노출": func(m *model.SubscriptionMemberPlan) { v := "N"; m.MtShow = &v },
	} {
		e := setup()
		block(e.repo.Members[1])
		st, err := e.svc.Verify(context.Background(), 2, iosReq())
		if err != nil || !st.IsPremium {
			t.Fatalf("%s: %+v %v", name, st, err)
		}
		if len(e.repo.RowsOf(2)) != 1 || len(e.repo.RowsOf(1)) != 0 {
			t.Fatalf("%s: 거래가 옮겨가야 함", name)
		}
		old := e.repo.Member(1)
		if old.MtPlanDate == nil || old.MtPlanDate.After(t0) || (old.MtPlanCheck != nil && *old.MtPlanCheck != "N") {
			t.Fatalf("%s: 이전 소유자 혜택이 남음: %+v", name, old)
		}
	}
}
