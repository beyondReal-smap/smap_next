package jobs

import (
	"context"
	"log/slog"
	"testing"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- schedule 전용 fake -----------------------------------------------------

// fakeScheduleSrc는 scheduleSource fake다(조회 + claim UPDATE를 캡처/제어).
// claimAffected[sstIdx]가 있으면 그 값을, 없으면 기본 1(선점 성공)을 돌려준다.
// 이미 claim된 sst_idx는 claimed 셋에 기록해 2회차 호출 시 0을 돌려준다(중복 틱 멱등 모사).
type fakeScheduleSrc struct {
	schedules     []model.Schedule
	queryCalls    int
	claimCalls    int
	claimAffected map[int]int64    // 명시적 affected 오버라이드(없으면 기본 동작)
	claimed       map[int]struct{} // 이미 선점된 sst_idx(2회차부터 0)
	queryErr      error
	claimErr      error
}

func (f *fakeScheduleSrc) GetNowSchedulePush() ([]model.Schedule, error) {
	f.queryCalls++
	return f.schedules, f.queryErr
}

func (f *fakeScheduleSrc) ClaimSchedule(sstIdx int) (int64, error) {
	f.claimCalls++
	if f.claimErr != nil {
		return 0, f.claimErr
	}
	if f.claimAffected != nil {
		if v, ok := f.claimAffected[sstIdx]; ok {
			return v, nil
		}
	}
	if f.claimed == nil {
		f.claimed = make(map[int]struct{})
	}
	if _, dup := f.claimed[sstIdx]; dup {
		return 0, nil // 이미 선점됨 → affected=0
	}
	f.claimed[sstIdx] = struct{}{}
	return 1, nil
}

// fakeScheduleMemberSrc는 scheduleMemberSource fake다(소유자 prefetch).
type fakeScheduleMemberSrc struct {
	members []model.Member
	calls   int
	err     error
}

func (f *fakeScheduleMemberSrc) FindByIDs(ids []int) ([]model.Member, error) {
	f.calls++
	return f.members, f.err
}

// fakeScheduleGroupSrc는 scheduleGroupSource fake다(그룹 fan-out 대상).
// rolesBySgt[sgt_idx]로 그룹별 역할 멤버를 응답한다.
type fakeScheduleGroupSrc struct {
	rolesBySgt map[int][]model.GroupRoleMember
	calls      int
	err        error
}

func (f *fakeScheduleGroupSrc) GetGroupMembersWithRoles(sgtIdx int) ([]model.GroupRoleMember, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return f.rolesBySgt[sgtIdx], nil
}

// --- 테스트 헬퍼 ------------------------------------------------------------

func intptr(v int) *int { return &v }

// makeSchedule은 발송 검증에 필요한 최소 필드만 채운 Schedule을 만든다.
func makeSchedule(sstIdx int, mtIdx *int, title string, sgtIdx *int) model.Schedule {
	s := model.Schedule{SstIdx: sstIdx, MtIdx: mtIdx, SgtIdx: sgtIdx}
	if title != "" {
		s.SstTitle = &title
	}
	return s
}

func makeRole(mtIdx int, token string, owner, leader bool, lang *string) model.GroupRoleMember {
	r := model.GroupRoleMember{MtIdx: mtIdx, MtLang: lang}
	if token != "" {
		r.MtTokenID = &token
	}
	if owner {
		y := "Y"
		r.SgdtOwnerChk = &y
	}
	if leader {
		y := "Y"
		r.SgdtLeaderChk = &y
	}
	return r
}

// newScheduleHandlers는 schedule 잡 seam이 주입된 Handlers를 만든다(DB 미사용).
func newScheduleHandlers(sender fcm.Sender, src scheduleSource, msrc scheduleMemberSource,
	gsrc scheduleGroupSource, dst pushLogWriter) *Handlers {
	return &Handlers{
		log:               slog.New(slog.NewTextHandler(noopWriter{}, nil)),
		fcm:               sender,
		scheduleSrc:       src,
		scheduleMemberSrc: msrc,
		scheduleGroupSrc:  gsrc,
		pushLogDst:        dst,
	}
}

// --- 테스트 ------------------------------------------------------------------

// TestHandleSchedule30Min_ClaimAffectedOnly는 ①claim affected=1인 일정만 발송 ②affected=0
// 일정은 발송/로그 제외 ③메시지 본문에 일정명 치환을 검증한다.
func TestHandleSchedule30Min_ClaimAffectedOnly(t *testing.T) {
	ko := "ko"
	schedules := []model.Schedule{
		makeSchedule(100, intptr(1), "회의", nil), // 소유자 1, claim=1 → 발송
		makeSchedule(200, intptr(2), "점심", nil), // 소유자 2, claim=0 → skip
	}
	src := &fakeScheduleSrc{
		schedules:     schedules,
		claimAffected: map[int]int64{100: 1, 200: 0},
	}
	msrc := &fakeScheduleMemberSrc{members: []model.Member{
		makeMember(1, "tok-1", &ko),
		makeMember(2, "tok-2", &ko),
	}}
	gsrc := &fakeScheduleGroupSrc{}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newScheduleHandlers(sender, src, msrc, gsrc, dst)

	task := asynq.NewTask(TypeSchedule30Min, nil)
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("handleSchedule30Min error: %v", err)
	}

	// claim은 두 일정 모두 시도(소유자 검증 통과 후).
	if src.claimCalls != 2 {
		t.Errorf("claim calls = %d, want 2", src.claimCalls)
	}
	// affected=1인 sst_idx=100만 발송(소유자 1명).
	sent := sender.allSentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent = %d, want 1 (only claimed schedule)", len(sent))
	}
	if sent[0].Token != "tok-1" {
		t.Errorf("token = %q, want tok-1", sent[0].Token)
	}
	// 메시지 본문 일정명 치환 검증.
	if sent[0].Title != "일정 시작 알림 ⏰" {
		t.Errorf("title = %q", sent[0].Title)
	}
	if sent[0].Body != "'회의' 일정이 30분 후에 시작해요!" {
		t.Errorf("body = %q, want title substituted", sent[0].Body)
	}
	// push_log 1행, sst_idx=100.
	if len(dst.logs) != 1 {
		t.Fatalf("logs = %d, want 1", len(dst.logs))
	}
	if dst.logs[0].SstIdx == nil || *dst.logs[0].SstIdx != 100 {
		t.Errorf("sst_idx = %v, want 100", dst.logs[0].SstIdx)
	}
	if dst.logs[0].PltCondition == nil || *dst.logs[0].PltCondition != schedulePltCondition {
		t.Errorf("plt_condition = %v", dst.logs[0].PltCondition)
	}
	if dst.logs[0].PltStatus == nil || *dst.logs[0].PltStatus != 2 {
		t.Errorf("plt_status = %v, want 2", dst.logs[0].PltStatus)
	}
}

// TestHandleSchedule30Min_SkipNoOwner는 소유자 없음/토큰 없음 일정이 claim도 발송도 안 되고
// skip되는지 검증한다(Python: continue, 마킹 안 함 → claim 미호출).
func TestHandleSchedule30Min_SkipNoOwner(t *testing.T) {
	ko := "ko"
	schedules := []model.Schedule{
		makeSchedule(100, intptr(1), "회의", nil), // 소유자 토큰 없음 → skip
		makeSchedule(200, nil, "익명", nil),        // mt_idx nil → skip
	}
	src := &fakeScheduleSrc{schedules: schedules}
	msrc := &fakeScheduleMemberSrc{members: []model.Member{
		makeMember(1, "", &ko), // 토큰 없음
	}}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newScheduleHandlers(sender, src, msrc, &fakeScheduleGroupSrc{}, dst)

	task := asynq.NewTask(TypeSchedule30Min, nil)
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}

	if src.claimCalls != 0 {
		t.Errorf("claim should not be called when owner invalid, calls=%d", src.claimCalls)
	}
	if sender.calls != 0 {
		t.Errorf("SendEach should not be called, calls=%d", sender.calls)
	}
	if len(dst.logs) != 0 {
		t.Errorf("logs = %d, want 0", len(dst.logs))
	}
}

// TestHandleSchedule30Min_GroupFanout은 그룹 일정에서 소유자 + 그룹 멤버 fan-out 대상 수와
// 소유자 본인 중복 제외 / 토큰 없는 멤버 제외를 검증한다.
func TestHandleSchedule30Min_GroupFanout(t *testing.T) {
	ko := "ko"
	en := "en"
	sgt := 7
	schedules := []model.Schedule{
		makeSchedule(100, intptr(1), "팀미팅", &sgt), // 그룹 일정, 소유자 1
	}
	src := &fakeScheduleSrc{schedules: schedules}
	msrc := &fakeScheduleMemberSrc{members: []model.Member{
		makeMember(1, "tok-owner", &ko),
	}}
	// 그룹 역할: owner(mt_idx=1, 일정 소유자 본인 → 제외), leader(2, 토큰 O), member(3, 토큰 O),
	// member(4, 토큰 X → 제외).
	gsrc := &fakeScheduleGroupSrc{rolesBySgt: map[int][]model.GroupRoleMember{
		7: {
			makeRole(1, "tok-grp-owner", true, false, &ko), // 일정 소유자와 동일 mt_idx → 제외
			makeRole(2, "tok-leader", false, true, &en),    // 리더 → 포함(en)
			makeRole(3, "tok-m3", false, false, &ko),       // 멤버 → 포함
			makeRole(4, "", false, false, &ko),             // 토큰 없음 → 제외
		},
	}}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newScheduleHandlers(sender, src, msrc, gsrc, dst)

	task := asynq.NewTask(TypeSchedule30Min, nil)
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}

	// 발송 대상: 소유자(1) + 리더(2) + 멤버(3) = 3건. owner-role(1) 중복 제외, member(4) 토큰 없음 제외.
	sent := sender.allSentMessages()
	if len(sent) != 3 {
		t.Fatalf("sent = %d, want 3 (owner + leader + member)", len(sent))
	}
	byToken := map[string]fcm.Message{}
	for _, m := range sent {
		byToken[m.Token] = m
	}
	if _, ok := byToken["tok-owner"]; !ok {
		t.Errorf("owner not sent")
	}
	if _, ok := byToken["tok-leader"]; !ok {
		t.Errorf("leader not sent")
	}
	if _, ok := byToken["tok-m3"]; !ok {
		t.Errorf("member 3 not sent")
	}
	if _, ok := byToken["tok-grp-owner"]; ok {
		t.Errorf("schedule owner duplicate (mt_idx=1) should be excluded")
	}
	// 리더는 en 언어 → 영어 문구.
	if byToken["tok-leader"].Body != "Schedule '팀미팅' starts in 30 minutes!" {
		t.Errorf("leader (en) body = %q", byToken["tok-leader"].Body)
	}
	// push_log 3행, 모두 sst_idx=100.
	if len(dst.logs) != 3 {
		t.Fatalf("logs = %d, want 3", len(dst.logs))
	}
	for _, l := range dst.logs {
		if l.SstIdx == nil || *l.SstIdx != 100 {
			t.Errorf("sst_idx = %v, want 100", l.SstIdx)
		}
	}
}

// TestHandleSchedule30Min_DuplicateTickIdempotent는 동일 일정에 대해 2회 틱 실행 시
// 1회차는 claim affected=1로 발송, 2회차는 affected=0으로 발송 0건임을 검증한다(중복 틱 멱등).
func TestHandleSchedule30Min_DuplicateTickIdempotent(t *testing.T) {
	ko := "ko"
	schedules := []model.Schedule{
		makeSchedule(100, intptr(1), "회의", nil),
	}
	// claimed 셋 기반(명시 오버라이드 없음): 첫 claim=1, 두 번째 호출 시 같은 sst_idx → 0.
	src := &fakeScheduleSrc{schedules: schedules}
	msrc := &fakeScheduleMemberSrc{members: []model.Member{makeMember(1, "tok-1", &ko)}}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newScheduleHandlers(sender, src, msrc, &fakeScheduleGroupSrc{}, dst)

	task := asynq.NewTask(TypeSchedule30Min, nil)

	// 1회차: 발송 1건.
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("tick1 error: %v", err)
	}
	if len(sender.allSentMessages()) != 1 {
		t.Fatalf("tick1 sent = %d, want 1", len(sender.allSentMessages()))
	}

	// 2회차: 같은 일정이 다시 조회돼도 claim=0 → 발송 0건(누적 발송 여전히 1).
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("tick2 error: %v", err)
	}
	if len(sender.allSentMessages()) != 1 {
		t.Errorf("after tick2 cumulative sent = %d, want 1 (idempotent claim=0)", len(sender.allSentMessages()))
	}
	// 2회차 push_log 추가 없음(누적 1행).
	if len(dst.logs) != 1 {
		t.Errorf("cumulative logs = %d, want 1", len(dst.logs))
	}
}

// TestHandleSchedule30Min_NoSchedules는 빈 결과 시 claim/발송/로그 없이 종료를 검증한다.
func TestHandleSchedule30Min_NoSchedules(t *testing.T) {
	src := &fakeScheduleSrc{schedules: nil}
	msrc := &fakeScheduleMemberSrc{}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newScheduleHandlers(sender, src, msrc, &fakeScheduleGroupSrc{}, dst)

	task := asynq.NewTask(TypeSchedule30Min, nil)
	if err := h.handleSchedule30Min(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}
	if src.claimCalls != 0 || sender.calls != 0 || dst.calls != 0 {
		t.Errorf("no-op expected: claim=%d send=%d log=%d", src.claimCalls, sender.calls, dst.calls)
	}
}
