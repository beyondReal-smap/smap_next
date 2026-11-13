package jobs

import (
	"context"
	"log/slog"
	"testing"

	"firebase.google.com/go/v4/messaging"
	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- 테스트용 fake ----------------------------------------------------------

// fakeSender는 SendEach 호출을 캡처하는 fcm.Sender 구현이다.
// allSuccess=true면 모든 메시지를 성공으로, false면 모두 실패로 응답한다.
type fakeSender struct {
	calls      int             // SendEach 호출 횟수
	batches    [][]fcm.Message // 배치별 수신 메시지(인덱스 정렬 검증용)
	allSuccess bool
}

func (f *fakeSender) Send(ctx context.Context, msg fcm.Message) (string, error) {
	return "", nil
}

func (f *fakeSender) SendEach(ctx context.Context, msgs []fcm.Message) (*messaging.BatchResponse, error) {
	f.calls++
	cp := make([]fcm.Message, len(msgs))
	copy(cp, msgs)
	f.batches = append(f.batches, cp)

	resp := &messaging.BatchResponse{
		Responses: make([]*messaging.SendResponse, len(msgs)),
	}
	for i := range msgs {
		ok := f.allSuccess
		resp.Responses[i] = &messaging.SendResponse{Success: ok}
		if ok {
			resp.SuccessCount++
		} else {
			resp.FailureCount++
		}
	}
	return resp, nil
}

// allSentMessages는 모든 배치를 평탄화해 누적 메시지를 돌려준다.
func (f *fakeSender) allSentMessages() []fcm.Message {
	var out []fcm.Message
	for _, b := range f.batches {
		out = append(out, b...)
	}
	return out
}

// fakeMemberSrc는 memberLister fake다.
type fakeMemberSrc struct {
	members []model.Member
	err     error
	calls   int
}

func (f *fakeMemberSrc) GetAllActive() ([]model.Member, error) {
	f.calls++
	return f.members, f.err
}

// fakePushLogDst는 pushLogWriter fake다(CreateBatch 캡처).
type fakePushLogDst struct {
	calls int
	logs  []model.PushLog
	err   error
}

func (f *fakePushLogDst) CreateBatch(logs []model.PushLog) error {
	f.calls++
	f.logs = append(f.logs, logs...)
	return f.err
}

// --- 테스트 헬퍼 ------------------------------------------------------------

func strptr(s string) *string { return &s }

func makeMember(idx int, token string, lang *string) model.Member {
	m := model.Member{MtIdx: idx, MtLang: lang}
	if token != "" {
		m.MtTokenID = &token
	}
	return m
}

// newTestHandlers는 seam이 주입된 Handlers를 만든다(DB 미사용).
func newTestHandlers(sender fcm.Sender, lock locker, src memberLister, dst pushLogWriter) *Handlers {
	return &Handlers{
		log:        slog.New(slog.NewTextHandler(noopWriter{}, nil)),
		fcm:        sender,
		lock:       lock,
		memberSrc:  src,
		pushLogDst: dst,
	}
}

type noopWriter struct{}

func (noopWriter) Write(p []byte) (int, error) { return len(p), nil }

// --- 테스트 ------------------------------------------------------------------

// TestHandleDailyAppInduce_HappyPath는 토큰 보유 회원에게 메시지를 빌드/발송하고
// push_log를 적재하는 정상 경로를 검증한다(언어별 문구 선택 포함).
func TestHandleDailyAppInduce_HappyPath(t *testing.T) {
	en := "en"
	ko := "ko"
	members := []model.Member{
		makeMember(1, "tok-ko", &ko),  // 한국어
		makeMember(2, "tok-en", &en),  // 영어
		makeMember(3, "", &ko),        // 토큰 없음 → 발송 제외, 실패 로그
		makeMember(4, "tok-nil", nil), // lang nil → ko 기본
	}
	sender := &fakeSender{allSuccess: true}
	src := &fakeMemberSrc{members: members}
	dst := &fakePushLogDst{}
	lock := &fakeLocker{acquired: true}
	h := newTestHandlers(sender, lock, src, dst)

	task := asynq.NewTask(TypeDailyAppInduce, nil)
	if err := h.handleDailyAppInduce(context.Background(), task); err != nil {
		t.Fatalf("handleDailyAppInduce error: %v", err)
	}

	// ① 회원 조회 1회.
	if src.calls != 1 {
		t.Errorf("GetAllActive calls = %d, want 1", src.calls)
	}

	// ② SendEach 호출 + 토큰 보유 회원 수(3명)만큼 메시지 빌드.
	if sender.calls != 1 {
		t.Errorf("SendEach calls = %d, want 1", sender.calls)
	}
	sent := sender.allSentMessages()
	if len(sent) != 3 {
		t.Fatalf("sent messages = %d, want 3 (token holders)", len(sent))
	}

	// 언어별 문구 검증.
	byToken := map[string]fcm.Message{}
	for _, m := range sent {
		byToken[m.Token] = m
		if !m.TimeSensitive || m.Silent {
			t.Errorf("message %q: TimeSensitive=%v Silent=%v, want true/false", m.Token, m.TimeSensitive, m.Silent)
		}
	}
	if byToken["tok-ko"].Title != appInduceMessage.titleKO {
		t.Errorf("ko title = %q, want %q", byToken["tok-ko"].Title, appInduceMessage.titleKO)
	}
	if byToken["tok-en"].Title != appInduceMessage.titleEN {
		t.Errorf("en title = %q, want %q", byToken["tok-en"].Title, appInduceMessage.titleEN)
	}
	if byToken["tok-nil"].Title != appInduceMessage.titleKO {
		t.Errorf("nil-lang title = %q, want ko default %q", byToken["tok-nil"].Title, appInduceMessage.titleKO)
	}

	// ③ push_log Create 호출 + 행 수 = 전체 회원(4) (토큰 3 + 빈토큰 1).
	if dst.calls != 1 {
		t.Errorf("CreateBatch calls = %d, want 1", dst.calls)
	}
	if len(dst.logs) != 4 {
		t.Fatalf("push_log rows = %d, want 4", len(dst.logs))
	}

	// 상태 매핑: 토큰 보유(성공)=2, 빈 토큰=4. plt_type=2, read_chk=N, show=Y, sst_idx=nil.
	var status2, status4 int
	for _, l := range dst.logs {
		if l.PltType == nil || *l.PltType != 2 {
			t.Errorf("plt_type = %v, want 2", l.PltType)
		}
		if l.SstIdx != nil {
			t.Errorf("sst_idx = %v, want nil", *l.SstIdx)
		}
		if l.PltReadChk == nil || *l.PltReadChk != "N" {
			t.Errorf("plt_read_chk = %v, want N", l.PltReadChk)
		}
		if l.PltShow == nil || *l.PltShow != "Y" {
			t.Errorf("plt_show = %v, want Y", l.PltShow)
		}
		if l.PltCondition == nil || *l.PltCondition != "일일 - 앱실행알림" {
			t.Errorf("plt_condition = %v", l.PltCondition)
		}
		if l.PushJSON == nil || *l.PushJSON != "{}" {
			t.Errorf("push_json = %v, want {}", l.PushJSON)
		}
		switch {
		case l.PltStatus != nil && *l.PltStatus == 2:
			status2++
		case l.PltStatus != nil && *l.PltStatus == 4:
			status4++
		default:
			t.Errorf("unexpected plt_status = %v", l.PltStatus)
		}
	}
	if status2 != 3 || status4 != 1 {
		t.Errorf("status counts: success(2)=%d fail(4)=%d, want 3/1", status2, status4)
	}
}

// TestHandleDailyBattery_StaticMessage는 배터리 잡이 배터리 정적 문구를 쓰고
// plt_condition이 배터리 알림인지 검증한다(필터 없이 전체 발송 = Python 동등).
func TestHandleDailyBattery_StaticMessage(t *testing.T) {
	ko := "ko"
	members := []model.Member{
		makeMember(10, "btok-1", &ko),
		makeMember(11, "btok-2", &ko),
	}
	sender := &fakeSender{allSuccess: true}
	src := &fakeMemberSrc{members: members}
	dst := &fakePushLogDst{}
	h := newTestHandlers(sender, &fakeLocker{acquired: true}, src, dst)

	task := asynq.NewTask(TypeDailyBattery, nil)
	if err := h.handleDailyBattery(context.Background(), task); err != nil {
		t.Fatalf("handleDailyBattery error: %v", err)
	}

	sent := sender.allSentMessages()
	if len(sent) != 2 {
		t.Fatalf("sent = %d, want 2", len(sent))
	}
	if sent[0].Title != batteryMessage.titleKO {
		t.Errorf("battery title = %q, want %q", sent[0].Title, batteryMessage.titleKO)
	}
	for _, l := range dst.logs {
		if l.PltCondition == nil || *l.PltCondition != "일일 - 배터리알림" {
			t.Errorf("plt_condition = %v, want 배터리알림", l.PltCondition)
		}
		if l.PltMemo == nil || *l.PltMemo != "저녁 9시 배터리 부족 알림" {
			t.Errorf("plt_memo = %v", l.PltMemo)
		}
	}
}

// TestHandleDailyAppInduce_IdempotentSkip는 DailyGuard 2회차(락 미획득)에서
// 회원 조회/발송/로그 적재를 전혀 하지 않고 skip하는지 검증한다.
func TestHandleDailyAppInduce_IdempotentSkip(t *testing.T) {
	sender := &fakeSender{allSuccess: true}
	src := &fakeMemberSrc{members: []model.Member{makeMember(1, "t", nil)}}
	dst := &fakePushLogDst{}
	// acquired=false → 이미 오늘 실행됨(2회차) 시뮬레이션.
	h := newTestHandlers(sender, &fakeLocker{acquired: false}, src, dst)

	task := asynq.NewTask(TypeDailyAppInduce, nil)
	if err := h.handleDailyAppInduce(context.Background(), task); err != nil {
		t.Fatalf("skip path should not error: %v", err)
	}

	if src.calls != 0 {
		t.Errorf("GetAllActive should not be called on skip, calls=%d", src.calls)
	}
	if sender.calls != 0 {
		t.Errorf("SendEach should not be called on skip, calls=%d", sender.calls)
	}
	if dst.calls != 0 {
		t.Errorf("CreateBatch should not be called on skip, calls=%d", dst.calls)
	}
}

// TestHandleDailyAppInduce_SendFailureStatus4는 발송 실패 시 push_log plt_status=4를 검증한다.
func TestHandleDailyAppInduce_SendFailureStatus4(t *testing.T) {
	sender := &fakeSender{allSuccess: false} // 모든 발송 실패
	src := &fakeMemberSrc{members: []model.Member{makeMember(1, "tok", nil)}}
	dst := &fakePushLogDst{}
	h := newTestHandlers(sender, &fakeLocker{acquired: true}, src, dst)

	task := asynq.NewTask(TypeDailyAppInduce, nil)
	if err := h.handleDailyAppInduce(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(dst.logs) != 1 {
		t.Fatalf("logs = %d, want 1", len(dst.logs))
	}
	if dst.logs[0].PltStatus == nil || *dst.logs[0].PltStatus != 4 {
		t.Errorf("plt_status = %v, want 4 (send failed)", dst.logs[0].PltStatus)
	}
}

// TestSendDailyBatches_Chunking는 fcmBatchSize 초과 시 다중 SendEach 청크 분할을 검증한다.
func TestSendDailyBatches_Chunking(t *testing.T) {
	total := fcmBatchSize + 5 // 505 → 2 배치(500 + 5)
	members := make([]model.Member, 0, total)
	for i := 0; i < total; i++ {
		members = append(members, makeMember(i+1, "tok", nil))
	}
	sender := &fakeSender{allSuccess: true}
	src := &fakeMemberSrc{members: members}
	dst := &fakePushLogDst{}
	h := newTestHandlers(sender, &fakeLocker{acquired: true}, src, dst)

	task := asynq.NewTask(TypeDailyAppInduce, nil)
	if err := h.handleDailyAppInduce(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}
	if sender.calls != 2 {
		t.Errorf("SendEach calls = %d, want 2 (chunked)", sender.calls)
	}
	if len(sender.batches[0]) != fcmBatchSize || len(sender.batches[1]) != 5 {
		t.Errorf("batch sizes = %d/%d, want %d/5", len(sender.batches[0]), len(sender.batches[1]), fcmBatchSize)
	}
	if len(dst.logs) != total {
		t.Errorf("logs = %d, want %d", len(dst.logs), total)
	}
}

// TestNormalizeLang는 언어 정규화(Python jobs/base.py normalize_lang)와 동등성을 검증한다.
func TestNormalizeLang(t *testing.T) {
	cases := []struct {
		in   *string
		want string
	}{
		{nil, "ko"},
		{strptr(""), "ko"},
		{strptr("ko"), "ko"},
		{strptr("KO"), "ko"},
		{strptr("en"), "en"},
		{strptr("EN"), "en"},
		{strptr("en-US"), "en"},
		{strptr(" en "), "en"},
		{strptr("english"), "en"},
		{strptr("ja"), "ko"},
	}
	for _, c := range cases {
		got := normalizeLang(c.in)
		if got != c.want {
			in := "<nil>"
			if c.in != nil {
				in = *c.in
			}
			t.Errorf("normalizeLang(%q) = %q, want %q", in, got, c.want)
		}
	}
}
