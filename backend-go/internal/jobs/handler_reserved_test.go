package jobs

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- reserved 전용 fake -----------------------------------------------------

// fakeReservedSrc는 reservedSource fake다(조회 + claim + 결과 전이를 캡처/제어).
// claimAffected[pltIdx]가 있으면 그 값을, 없으면 claimed 셋 기반으로 1(첫 호출)/0(2회차)을
// 돌려준다(중복 틱 멱등 모사). marked는 MarkReservedSent로 영속화된 (status,sdate)를 기록한다.
type fakeReservedSrc struct {
	pushes        []model.PushLog
	queryCalls    int
	claimCalls    int
	markCalls     int
	claimAffected map[int]int64    // 명시적 affected 오버라이드(없으면 기본 동작)
	claimed       map[int]struct{} // 이미 선점된 plt_idx(2회차부터 0)
	marked        map[int]markRec  // plt_idx → 영속화된 결과
	queryErr      error
	claimErr      error
	markErr       error
}

type markRec struct {
	status int
	sdate  time.Time
}

func (f *fakeReservedSrc) GetReserved(now time.Time) ([]model.PushLog, error) {
	f.queryCalls++
	return f.pushes, f.queryErr
}

func (f *fakeReservedSrc) ClaimReserved(pltIdx int) (int64, error) {
	f.claimCalls++
	if f.claimErr != nil {
		return 0, f.claimErr
	}
	if f.claimAffected != nil {
		if v, ok := f.claimAffected[pltIdx]; ok {
			return v, nil
		}
	}
	if f.claimed == nil {
		f.claimed = make(map[int]struct{})
	}
	if _, dup := f.claimed[pltIdx]; dup {
		return 0, nil // 이미 선점됨 → affected=0
	}
	f.claimed[pltIdx] = struct{}{}
	return 1, nil
}

func (f *fakeReservedSrc) MarkReservedSent(pltIdx int, status int, now time.Time) error {
	f.markCalls++
	if f.markErr != nil {
		return f.markErr
	}
	if f.marked == nil {
		f.marked = make(map[int]markRec)
	}
	f.marked[pltIdx] = markRec{status: status, sdate: now}
	return nil
}

// fakeReservedMemberSrc는 reservedMemberSource fake다(발송 대상 prefetch). 호출 ids를 캡처한다.
type fakeReservedMemberSrc struct {
	members  []model.Member
	calls    int
	lastIDs  []int
	err      error
}

func (f *fakeReservedMemberSrc) FindByIDs(ids []int) ([]model.Member, error) {
	f.calls++
	f.lastIDs = ids
	return f.members, f.err
}

// fakeReservedSender는 단건 Send의 성공/실패를 제어하는 fcm.Sender fake다.
// 공유 fakeSender.Send는 항상 성공(nil)이라, 발송 실패(plt_status=4) 검증을 위해 별도 정의한다.
//   - sendErr 설정 시 모든 Send가 그 에러를 반환(발송 실패).
//   - failTokens[token]=true면 해당 토큰만 에러(부분 실패 시나리오).
// SendEach는 reserved 잡이 쓰지 않으나 인터페이스 충족용으로 둔다.
type fakeReservedSender struct {
	sent       []fcm.Message
	sendErr    error
	failTokens map[string]bool
}

func (f *fakeReservedSender) Send(ctx context.Context, msg fcm.Message) (string, error) {
	f.sent = append(f.sent, msg)
	if f.sendErr != nil {
		return "", f.sendErr
	}
	if f.failTokens != nil && f.failTokens[msg.Token] {
		return "", errors.New("send failed")
	}
	return "msg-id", nil
}

func (f *fakeReservedSender) SendEach(ctx context.Context, msgs []fcm.Message) (*messaging.BatchResponse, error) {
	return &messaging.BatchResponse{}, nil
}

// --- 테스트 헬퍼 ------------------------------------------------------------

// makeReserved는 발송 검증에 필요한 최소 필드만 채운 예약 PushLog를 만든다.
func makeReserved(pltIdx int, mtIdx *int, title, content string) model.PushLog {
	p := model.PushLog{PltIdx: pltIdx, MtIdx: mtIdx}
	if title != "" {
		p.PltTitle = &title
	}
	if content != "" {
		p.PltContent = &content
	}
	return p
}

// newReservedHandlers는 reserved 잡 seam이 주입된 Handlers를 만든다(DB 미사용).
func newReservedHandlers(sender fcm.Sender, src reservedSource, msrc reservedMemberSource) *Handlers {
	return &Handlers{
		log:               slog.New(slog.NewTextHandler(noopWriter{}, nil)),
		fcm:               sender,
		reservedSrc:       src,
		reservedMemberSrc: msrc,
	}
}

// --- 테스트 ------------------------------------------------------------------

// TestHandleReservedPush_ClaimAffectedOnly는 ①claim affected=1인 행만 발송 ②affected=0 행은
// 발송/전이 제외 ③발송 성공 시 plt_status=2 + plt_sdate=now 전이를 검증한다.
func TestHandleReservedPush_ClaimAffectedOnly(t *testing.T) {
	pushes := []model.PushLog{
		makeReserved(100, intptr(1), "제목A", "본문A"), // claim=1 → 발송
		makeReserved(200, intptr(2), "제목B", "본문B"), // claim=0 → skip(다른 워커 선점)
	}
	src := &fakeReservedSrc{
		pushes:        pushes,
		claimAffected: map[int]int64{100: 1, 200: 0},
	}
	msrc := &fakeReservedMemberSrc{members: []model.Member{
		makeMember(1, "tok-1", nil),
		makeMember(2, "tok-2", nil),
	}}
	sender := &fakeReservedSender{}
	h := newReservedHandlers(sender, src, msrc)

	task := asynq.NewTask(TypeReservedPush, nil)
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("handleReservedPush error: %v", err)
	}

	// claim은 두 행 모두 시도(member 검증 통과 후).
	if src.claimCalls != 2 {
		t.Errorf("claim calls = %d, want 2", src.claimCalls)
	}
	// affected=1인 plt_idx=100만 발송.
	if len(sender.sent) != 1 {
		t.Fatalf("sent = %d, want 1 (only claimed push)", len(sender.sent))
	}
	if sender.sent[0].Token != "tok-1" {
		t.Errorf("token = %q, want tok-1", sender.sent[0].Token)
	}
	// 메시지는 저장된 plt_title/plt_content 그대로(새 렌더링 없음).
	if sender.sent[0].Title != "제목A" || sender.sent[0].Body != "본문A" {
		t.Errorf("message = %q/%q, want 제목A/본문A (static)", sender.sent[0].Title, sender.sent[0].Body)
	}
	// 발송 성공 → plt_status=2 영속화. plt_idx=100만 전이(200은 claim 실패로 미전이).
	if src.markCalls != 1 {
		t.Errorf("mark calls = %d, want 1", src.markCalls)
	}
	rec, ok := src.marked[100]
	if !ok {
		t.Fatalf("plt_idx=100 not marked")
	}
	if rec.status != 2 {
		t.Errorf("plt_status = %d, want 2 (success)", rec.status)
	}
	if rec.sdate.IsZero() {
		t.Errorf("plt_sdate not set")
	}
	if _, dup := src.marked[200]; dup {
		t.Errorf("plt_idx=200 should not be marked (claim lost)")
	}
}

// TestHandleReservedPush_SkipNoMember는 member가 없으면 claim도 발송도 전이도 안 하고 skip되는지
// 검증한다(Python: if not member: continue, plt_status=1 유지).
func TestHandleReservedPush_SkipNoMember(t *testing.T) {
	pushes := []model.PushLog{
		makeReserved(100, intptr(1), "t", "c"), // member 1 존재 → 발송
		makeReserved(200, intptr(9), "t", "c"), // member 9 없음 → skip
		makeReserved(300, nil, "t", "c"),       // mt_idx nil → skip
	}
	src := &fakeReservedSrc{pushes: pushes}
	msrc := &fakeReservedMemberSrc{members: []model.Member{
		makeMember(1, "tok-1", nil), // 9는 없음
	}}
	sender := &fakeReservedSender{}
	h := newReservedHandlers(sender, src, msrc)

	task := asynq.NewTask(TypeReservedPush, nil)
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}

	// member 있는 plt_idx=100만 claim/발송/전이.
	if src.claimCalls != 1 {
		t.Errorf("claim calls = %d, want 1 (only push with member)", src.claimCalls)
	}
	if len(sender.sent) != 1 || sender.sent[0].Token != "tok-1" {
		t.Errorf("sent = %v, want 1 to tok-1", sender.sent)
	}
	if src.markCalls != 1 {
		t.Errorf("mark calls = %d, want 1", src.markCalls)
	}
	// member 없는 행(200,300)은 전이 안 함(plt_status=1 유지 → 다음 틱 재시도).
	if _, ok := src.marked[200]; ok {
		t.Errorf("plt_idx=200 (no member) should not be marked")
	}
	if _, ok := src.marked[300]; ok {
		t.Errorf("plt_idx=300 (nil mt_idx) should not be marked")
	}
	// prefetch ids는 nil mt_idx 제외(1,9만).
	if len(msrc.lastIDs) != 2 {
		t.Errorf("prefetch ids = %v, want 2 (1,9; nil excluded)", msrc.lastIDs)
	}
}

// TestHandleReservedPush_SendFailTransition은 발송 실패 시 plt_status=4로 전이되는지 검증한다
// (Python: push_result.get("result") False → plt_status=4). 토큰 없음/Send 에러 둘 다 실패.
func TestHandleReservedPush_SendFailTransition(t *testing.T) {
	pushes := []model.PushLog{
		makeReserved(100, intptr(1), "t", "c"), // 토큰 없음 → 발송 실패
		makeReserved(200, intptr(2), "t", "c"), // Send 에러 → 발송 실패
		makeReserved(300, intptr(3), "t", "c"), // 정상 발송 → 성공
	}
	src := &fakeReservedSrc{pushes: pushes}
	msrc := &fakeReservedMemberSrc{members: []model.Member{
		makeMember(1, "", nil),      // 토큰 없음
		makeMember(2, "tok-2", nil), // Send 에러 대상
		makeMember(3, "tok-3", nil), // 성공
	}}
	sender := &fakeReservedSender{failTokens: map[string]bool{"tok-2": true}}
	h := newReservedHandlers(sender, src, msrc)

	task := asynq.NewTask(TypeReservedPush, nil)
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}

	// 세 행 모두 member 존재 → claim 3회, 전이 3회.
	if src.claimCalls != 3 || src.markCalls != 3 {
		t.Errorf("claim=%d mark=%d, want 3/3", src.claimCalls, src.markCalls)
	}
	// 토큰 없음(100): 발송 시도 안 함, plt_status=4.
	if src.marked[100].status != 4 {
		t.Errorf("plt_idx=100 (no token) status = %d, want 4", src.marked[100].status)
	}
	// Send 에러(200): plt_status=4.
	if src.marked[200].status != 4 {
		t.Errorf("plt_idx=200 (send err) status = %d, want 4", src.marked[200].status)
	}
	// 정상(300): plt_status=2.
	if src.marked[300].status != 2 {
		t.Errorf("plt_idx=300 (ok) status = %d, want 2", src.marked[300].status)
	}
	// 토큰 없는 100은 Send 미호출 → 실제 Send는 tok-2, tok-3 2건만.
	if len(sender.sent) != 2 {
		t.Errorf("Send called = %d, want 2 (empty token skipped)", len(sender.sent))
	}
}

// TestHandleReservedPush_DuplicateTickIdempotent는 동일 예약 행에 대해 2회 틱 실행 시 1회차는
// claim affected=1로 발송, 2회차는 affected=0으로 발송 0건임을 검증한다(★claim 중복 방지).
func TestHandleReservedPush_DuplicateTickIdempotent(t *testing.T) {
	pushes := []model.PushLog{
		makeReserved(100, intptr(1), "t", "c"),
	}
	// claimed 셋 기반(명시 오버라이드 없음): 첫 claim=1, 두 번째 호출 시 같은 plt_idx → 0.
	src := &fakeReservedSrc{pushes: pushes}
	msrc := &fakeReservedMemberSrc{members: []model.Member{makeMember(1, "tok-1", nil)}}
	sender := &fakeReservedSender{}
	h := newReservedHandlers(sender, src, msrc)

	task := asynq.NewTask(TypeReservedPush, nil)

	// 1회차: 발송 1건.
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("tick1 error: %v", err)
	}
	if len(sender.sent) != 1 {
		t.Fatalf("tick1 sent = %d, want 1", len(sender.sent))
	}

	// 2회차: 같은 행이 다시 조회돼도 claim=0 → 발송 0건(누적 발송 여전히 1).
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("tick2 error: %v", err)
	}
	if len(sender.sent) != 1 {
		t.Errorf("after tick2 cumulative sent = %d, want 1 (idempotent claim=0)", len(sender.sent))
	}
	// 2회차 전이 추가 없음(누적 1행).
	if src.markCalls != 1 {
		t.Errorf("cumulative mark calls = %d, want 1", src.markCalls)
	}
}

// TestHandleReservedPush_NoPushes는 빈 결과 시 claim/발송/전이 없이 종료를 검증한다.
func TestHandleReservedPush_NoPushes(t *testing.T) {
	src := &fakeReservedSrc{pushes: nil}
	msrc := &fakeReservedMemberSrc{}
	sender := &fakeReservedSender{}
	h := newReservedHandlers(sender, src, msrc)

	task := asynq.NewTask(TypeReservedPush, nil)
	if err := h.handleReservedPush(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}
	if src.claimCalls != 0 || len(sender.sent) != 0 || src.markCalls != 0 {
		t.Errorf("no-op expected: claim=%d send=%d mark=%d", src.claimCalls, len(sender.sent), len(sender.sent))
	}
}
