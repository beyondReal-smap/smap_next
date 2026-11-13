package jobs

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// errUnregistered / errOther는 무효화 분류기 오버라이드와 짝을 이루는 센티넬 에러다.
// 실제 *internal.FirebaseError는 내부 패키지라 테스트에서 만들 수 없어, silent_push.go의
// isUnregisteredErr/isSenderIDMismatchErr 함수 변수를 이 센티넬 기준으로 오버라이드한다.
var (
	errUnregistered = errors.New("test: unregistered")
	errOther        = errors.New("test: unavailable")
)

// withUnregisteredClassifier는 errUnregistered만 Unregistered로 분류하도록 패키지 분류기를
// 임시 교체하고, 복원 함수를 돌려준다(t.Cleanup으로 호출).
func withUnregisteredClassifier(t *testing.T) {
	t.Helper()
	origU, origS := isUnregisteredErr, isSenderIDMismatchErr
	isUnregisteredErr = func(err error) bool { return errors.Is(err, errUnregistered) }
	isSenderIDMismatchErr = func(err error) bool { return false }
	t.Cleanup(func() {
		isUnregisteredErr = origU
		isSenderIDMismatchErr = origS
	})
}

// --- silent 전용 fake -------------------------------------------------------

// fakeSilentSrc는 silentMemberLister fake다(두 토큰 쿼리를 캡처/응답).
type fakeSilentSrc struct {
	expiring      []model.Member
	all           []model.Member
	expiringErr   error
	allErr        error
	expiringCall  int
	allCall       int
	lastThreshold time.Time
}

func (f *fakeSilentSrc) GetTokenExpiringSoon(threshold time.Time) ([]model.Member, error) {
	f.expiringCall++
	f.lastThreshold = threshold
	return f.expiring, f.expiringErr
}

func (f *fakeSilentSrc) GetTokenList() ([]model.Member, error) {
	f.allCall++
	return f.all, f.allErr
}

// silentSender는 per-message 성공/에러를 인덱스별로 제어하는 fcm.Sender fake다.
// errByIndex[i]가 있으면 해당 메시지는 실패(success=false, Error=errByIndex[i]).
type silentSender struct {
	calls   int
	batches [][]fcm.Message
	// 누적 인덱스 → 에러. nil/미존재면 성공.
	errByIndex map[int]error
	seen       int // 지금까지 처리한 메시지 누적 수(인덱스 기준점)
}

func (s *silentSender) Send(ctx context.Context, msg fcm.Message) (string, error) { return "", nil }

func (s *silentSender) SendEach(ctx context.Context, msgs []fcm.Message) (*messaging.BatchResponse, error) {
	s.calls++
	cp := make([]fcm.Message, len(msgs))
	copy(cp, msgs)
	s.batches = append(s.batches, cp)

	resp := &messaging.BatchResponse{Responses: make([]*messaging.SendResponse, len(msgs))}
	for i := range msgs {
		globalIdx := s.seen + i
		if err, bad := s.errByIndex[globalIdx]; bad {
			resp.Responses[i] = &messaging.SendResponse{Success: false, Error: err}
			resp.FailureCount++
		} else {
			resp.Responses[i] = &messaging.SendResponse{Success: true}
			resp.SuccessCount++
		}
	}
	s.seen += len(msgs)
	return resp, nil
}

func (s *silentSender) allSent() []fcm.Message {
	var out []fcm.Message
	for _, b := range s.batches {
		out = append(out, b...)
	}
	return out
}

// newSilentHandlers는 silent 잡 seam이 주입된 Handlers를 만든다(DB 미사용).
// 로거는 기존 handler_daily_test.go의 noopWriter를 재사용한다(같은 패키지).
func newSilentHandlers(sender fcm.Sender, lock locker, src silentMemberLister) *Handlers {
	return &Handlers{
		log:       slog.New(slog.NewTextHandler(noopWriter{}, nil)),
		fcm:       sender,
		lock:      lock,
		silentSrc: src,
	}
}

// --- 테스트 ------------------------------------------------------------------

// TestHandleDailySilent_PayloadAndOrder는 ①Silent=true 페이로드/data 플래그 ②대상 우선순위
// 병합 순서(만료 임박 앞, 중복 제거) ③조회 임계값(now+30d)을 검증한다.
func TestHandleDailySilent_PayloadAndOrder(t *testing.T) {
	now := time.Now()
	exp := now.Add(10 * 24 * time.Hour) // 만료 임박(30일 이내)
	// 우선순위(만료 임박): mt_idx 1,2. all에는 1(중복) + 3(일반).
	priority := []model.Member{
		tokMember(1, "tok1", &exp, nil),
		tokMember(2, "tok2", &exp, nil),
	}
	all := []model.Member{
		tokMember(1, "tok1", &exp, nil), // 중복 — priority에서 이미 포함
		tokMember(3, "tok3", nil, nil),  // 일반
	}
	sender := &silentSender{}
	src := &fakeSilentSrc{expiring: priority, all: all}
	h := newSilentHandlers(sender, &fakeLocker{acquired: true}, src)

	task := asynq.NewTask(TypeDailySilent, nil)
	if err := h.handleDailySilent(context.Background(), task); err != nil {
		t.Fatalf("handleDailySilent error: %v", err)
	}

	// ① 두 쿼리 각 1회.
	if src.expiringCall != 1 || src.allCall != 1 {
		t.Errorf("query calls: expiring=%d all=%d, want 1/1", src.expiringCall, src.allCall)
	}
	// 임계값 ≈ now+30d.
	wantThresh := now.Add(silentExpiryWindow)
	if d := src.lastThreshold.Sub(wantThresh); d > time.Minute || d < -time.Minute {
		t.Errorf("expiry threshold off by %v, want ~now+30d", d)
	}

	// ② 발송 대상 순서: tok1, tok2(우선순위) → tok3(일반). 중복 tok1 제거.
	sent := sender.allSent()
	gotTokens := make([]string, 0, len(sent))
	for _, m := range sent {
		gotTokens = append(gotTokens, m.Token)
	}
	wantTokens := []string{"tok1", "tok2", "tok3"}
	if !slices.Equal(gotTokens, wantTokens) {
		t.Fatalf("token order = %v, want %v", gotTokens, wantTokens)
	}

	// ③ 모든 메시지 Silent=true + data 플래그 + reason 분기.
	for i, m := range sent {
		if !m.Silent {
			t.Errorf("message %d (%s): Silent=false, want true", i, m.Token)
		}
		if m.Title != "" || m.Body != "" {
			t.Errorf("message %d: silent must have empty title/body, got %q/%q", i, m.Title, m.Body)
		}
		if m.Data["silent_push"] != "true" || m.Data["token_refresh"] != "true" ||
			m.Data["background_wake"] != "true" || m.Data["force_token_update"] != "true" {
			t.Errorf("message %d: missing silent data flags: %v", i, m.Data)
		}
		if _, ok := m.Data["timestamp"]; !ok {
			t.Errorf("message %d: missing timestamp", i)
		}
	}
	// reason: 처음 2개(우선순위) priority_token_refresh, 3번째 scheduled_token_refresh.
	if sent[0].Data["reason"] != "priority_token_refresh" || sent[1].Data["reason"] != "priority_token_refresh" {
		t.Errorf("priority reasons wrong: %q %q", sent[0].Data["reason"], sent[1].Data["reason"])
	}
	if sent[2].Data["reason"] != "scheduled_token_refresh" {
		t.Errorf("scheduled reason wrong: %q", sent[2].Data["reason"])
	}
}

// TestHandleDailySilent_IdempotentSkip는 DailyGuard 미획득(2회차)에서 조회/발송을 하지 않음을 검증.
func TestHandleDailySilent_IdempotentSkip(t *testing.T) {
	exp := time.Now().Add(time.Hour)
	src := &fakeSilentSrc{
		expiring: []model.Member{tokMember(1, "t", &exp, nil)},
		all:      []model.Member{tokMember(1, "t", &exp, nil)},
	}
	sender := &silentSender{}
	h := newSilentHandlers(sender, &fakeLocker{acquired: false}, src)

	task := asynq.NewTask(TypeDailySilent, nil)
	if err := h.handleDailySilent(context.Background(), task); err != nil {
		t.Fatalf("skip path should not error: %v", err)
	}
	if src.expiringCall != 0 || src.allCall != 0 {
		t.Errorf("queries should not run on skip: expiring=%d all=%d", src.expiringCall, src.allCall)
	}
	if sender.calls != 0 {
		t.Errorf("SendEach should not run on skip, calls=%d", sender.calls)
	}
}

// TestShouldInvalidateToken_24hGuard는 24h 이내 갱신 토큰은 (무효화 후보에서) 거부, 24h 초과는
// 후보로 분류함을 검증한다. ★주의: '무효화 후보'는 관측·로그 분류일 뿐 실제 DB 토큰 삭제는
// 없다(Python _handle_token_invalidation의 DB write가 전부 주석이라 토큰 보존).
func TestShouldInvalidateToken_24hGuard(t *testing.T) {
	now := time.Now()

	// 23시간 전 갱신 → 24h 이내 → 후보 제외.
	recent := now.Add(-23 * time.Hour)
	mRecent := &model.Member{MtIdx: 1, MtTokenUpdatedAt: &recent}
	if shouldInvalidateToken(mRecent, now) {
		t.Errorf("24h 이내 갱신 토큰은 후보 제외해야 함")
	}

	// 25시간 전 갱신 + expiry 없음 → 후보.
	old := now.Add(-25 * time.Hour)
	mOld := &model.Member{MtIdx: 2, MtTokenUpdatedAt: &old}
	if !shouldInvalidateToken(mOld, now) {
		t.Errorf("24h 초과 + expiry 없음 토큰은 후보여야 함")
	}
}

// TestShouldInvalidateToken_ExpiryGuard는 만료 미도래(30일+ 남음) 토큰은 후보 제외, 만료 도래(혹은
// 임박, 30일 이내) 토큰은 후보임을 검증한다.
func TestShouldInvalidateToken_ExpiryGuard(t *testing.T) {
	now := time.Now()

	// 갱신 메타 없음 + 만료 60일 후(>30일) → 후보 제외.
	farExpiry := now.Add(60 * 24 * time.Hour)
	mFar := &model.Member{MtIdx: 1, MtTokenExpiryDate: &farExpiry}
	if shouldInvalidateToken(mFar, now) {
		t.Errorf("만료 30일+ 남은 토큰은 후보 제외해야 함")
	}

	// 갱신 메타 없음 + 이미 만료(어제) → 후보.
	expired := now.Add(-24 * time.Hour)
	mExpired := &model.Member{MtIdx: 2, MtTokenExpiryDate: &expired}
	if !shouldInvalidateToken(mExpired, now) {
		t.Errorf("이미 만료된 토큰은 후보여야 함")
	}

	// 24h 초과 갱신 + 만료 임박(10일, <30일) → 후보.
	old := now.Add(-25 * time.Hour)
	soon := now.Add(10 * 24 * time.Hour)
	mSoon := &model.Member{MtIdx: 3, MtTokenUpdatedAt: &old, MtTokenExpiryDate: &soon}
	if !shouldInvalidateToken(mSoon, now) {
		t.Errorf("만료 임박(<30일) + 24h 초과 갱신 토큰은 후보여야 함")
	}
}

// TestHandleDailySilent_TokensPreserved는 ★Python 충실 이식의 핵심 안전속성을 검증한다:
// Unregistered 응답을 받아도(가드 통과 여부 무관) Go는 DB 토큰을 절대 비우지 않는다
// (관측 로그만). 잡은 에러 없이 완료되어야 한다.
func TestHandleDailySilent_TokensPreserved(t *testing.T) {
	withUnregisteredClassifier(t)
	now := time.Now()
	old := now.Add(-48 * time.Hour)   // 24h 초과(가드 통과 = 후보)
	recent := now.Add(-1 * time.Hour) // 24h 이내(후보 제외)

	exp := now.Add(5 * 24 * time.Hour)
	priority := []model.Member{
		tokMember(10, "tokA", &exp, &old),
		tokMember(11, "tokB", &exp, &recent),
	}
	src := &fakeSilentSrc{expiring: priority, all: priority}

	// 두 메시지 모두 Unregistered 실패.
	sender := &silentSender{errByIndex: map[int]error{
		0: errUnregistered,
		1: errUnregistered,
	}}
	h := newSilentHandlers(sender, &fakeLocker{acquired: true}, src)

	task := asynq.NewTask(TypeDailySilent, nil)
	if err := h.handleDailySilent(context.Background(), task); err != nil {
		t.Fatalf("handleDailySilent error: %v", err)
	}
	// DB 변경 경로(tokenInvalidator) 자체가 제거됐으므로, 검증의 핵심은
	// "잡이 토큰을 비우지 않고 정상 완료"다. Handlers에 무효화 seam이 없음을 컴파일이 보장한다.
	// 두 토큰(tokA, tokB) 모두 발송 시도됐는지만 확인(관측만, 보존).
	if sender.calls == 0 {
		t.Errorf("SendEach should have been called for token holders")
	}
}

// TestHandleDailySilent_NonTokenErrorOk는 Unregistered/SenderIDMismatch가 아닌 일반 실패에서도
// 잡이 에러 없이 완료됨을 검증한다(토큰 보존은 모든 경우 동일).
func TestHandleDailySilent_NonTokenErrorOk(t *testing.T) {
	withUnregisteredClassifier(t)
	now := time.Now()
	old := now.Add(-48 * time.Hour)
	exp := now.Add(5 * 24 * time.Hour)
	priority := []model.Member{tokMember(20, "tokX", &exp, &old)}
	src := &fakeSilentSrc{expiring: priority, all: priority}

	sender := &silentSender{errByIndex: map[int]error{
		0: errOther,
	}}
	h := newSilentHandlers(sender, &fakeLocker{acquired: true}, src)

	task := asynq.NewTask(TypeDailySilent, nil)
	if err := h.handleDailySilent(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}
}

// tokMember는 토큰/만료/갱신 메타를 가진 회원을 만든다(silent 테스트 전용).
func tokMember(idx int, token string, expiry, updated *time.Time) model.Member {
	m := model.Member{MtIdx: idx}
	if token != "" {
		m.MtTokenID = &token
	}
	m.MtTokenExpiryDate = expiry
	m.MtTokenUpdatedAt = updated
	return m
}
