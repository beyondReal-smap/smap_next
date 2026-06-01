package jobs

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// --- geofence 전용 fake -----------------------------------------------------

// fakeGeofenceScheduleSrc는 geofenceScheduleSource fake다(조회 + entry/exit claim 제어).
// claimed 셋에 기록해 2회차부터 0을 돌려준다(중복 틱 멱등 모사).
type fakeGeofenceScheduleSrc struct {
	in          []model.Schedule
	out         []model.Schedule
	entryClaims map[int]int64 // 명시 affected 오버라이드(없으면 claimed 셋 기반)
	exitClaims  map[int]int64
	claimedE    map[int]struct{}
	claimedX    map[int]struct{}
	entryCalls  int
	exitCalls   int
}

func (f *fakeGeofenceScheduleSrc) GetNowScheduleInMembers() ([]model.Schedule, error) {
	return f.in, nil
}
func (f *fakeGeofenceScheduleSrc) GetNowScheduleOutMembers() ([]model.Schedule, error) {
	return f.out, nil
}
func (f *fakeGeofenceScheduleSrc) ClaimScheduleEntry(sstIdx int) (int64, error) {
	f.entryCalls++
	if f.entryClaims != nil {
		if v, ok := f.entryClaims[sstIdx]; ok {
			return v, nil
		}
	}
	if f.claimedE == nil {
		f.claimedE = make(map[int]struct{})
	}
	if _, dup := f.claimedE[sstIdx]; dup {
		return 0, nil
	}
	f.claimedE[sstIdx] = struct{}{}
	return 1, nil
}
func (f *fakeGeofenceScheduleSrc) ClaimScheduleExit(sstIdx int) (int64, error) {
	f.exitCalls++
	if f.exitClaims != nil {
		if v, ok := f.exitClaims[sstIdx]; ok {
			return v, nil
		}
	}
	if f.claimedX == nil {
		f.claimedX = make(map[int]struct{})
	}
	if _, dup := f.claimedX[sstIdx]; dup {
		return 0, nil
	}
	f.claimedX[sstIdx] = struct{}{}
	return 1, nil
}

// fakeGeofenceGroupDetailSrc는 sgdt_idx→GroupDetail 매핑을 응답한다.
type fakeGeofenceGroupDetailSrc struct {
	gd map[int]model.GroupDetail
}

func (f *fakeGeofenceGroupDetailSrc) FindByIDs(ids []int) (map[int]model.GroupDetail, error) {
	return f.gd, nil
}

// fakeGeofenceLocSrc는 회원 최신 위치 배치 조회 fake다.
type fakeGeofenceLocSrc struct {
	locs map[int]repository.RecentLocation
}

func (f *fakeGeofenceLocSrc) GetRecentLocationsBatch(ids []int) (map[int]repository.RecentLocation, error) {
	return f.locs, nil
}

// fakeGeofenceGroupRoleSrc는 owner/leader fan-out 대상 fake다.
type fakeGeofenceGroupRoleSrc struct {
	rolesBySgt map[int][]model.GroupRoleMember
	calls      int
}

func (f *fakeGeofenceGroupRoleSrc) GetGroupMembersWithRoles(sgtIdx int) ([]model.GroupRoleMember, error) {
	f.calls++
	return f.rolesBySgt[sgtIdx], nil
}

// fakeGeofenceMyLocationSrc는 내 장소 조회 + entry/exit claim fake다.
type fakeGeofenceMyLocationSrc struct {
	active     []model.Location
	activeIn   []model.Location
	entryAff   map[int]int64
	exitAff    map[int]int64
	claimedE   map[int]struct{}
	claimedX   map[int]struct{}
	entryCalls int
	exitCalls  int
}

func (f *fakeGeofenceMyLocationSrc) GetAllActive() ([]model.Location, error) { return f.active, nil }
func (f *fakeGeofenceMyLocationSrc) GetAllActiveIn() ([]model.Location, error) {
	return f.activeIn, nil
}
func (f *fakeGeofenceMyLocationSrc) ClaimMyEntry(sltIdx int, now time.Time) (int64, error) {
	f.entryCalls++
	if f.entryAff != nil {
		if v, ok := f.entryAff[sltIdx]; ok {
			return v, nil
		}
	}
	if f.claimedE == nil {
		f.claimedE = make(map[int]struct{})
	}
	if _, dup := f.claimedE[sltIdx]; dup {
		return 0, nil
	}
	f.claimedE[sltIdx] = struct{}{}
	return 1, nil
}
func (f *fakeGeofenceMyLocationSrc) ClaimMyExit(sltIdx int, now time.Time) (int64, error) {
	f.exitCalls++
	if f.exitAff != nil {
		if v, ok := f.exitAff[sltIdx]; ok {
			return v, nil
		}
	}
	if f.claimedX == nil {
		f.claimedX = make(map[int]struct{})
	}
	if _, dup := f.claimedX[sltIdx]; dup {
		return 0, nil
	}
	f.claimedX[sltIdx] = struct{}{}
	return 1, nil
}

// fakeGeofenceMemberSrc는 회원 prefetch fake다.
type fakeGeofenceMemberSrc struct {
	members []model.Member
}

func (f *fakeGeofenceMemberSrc) FindByIDs(ids []int) ([]model.Member, error) {
	// 요청된 id에 해당하는 회원만 돌려준다(실 repository와 동등).
	want := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		want[id] = struct{}{}
	}
	out := make([]model.Member, 0)
	for i := range f.members {
		if _, ok := want[f.members[i].MtIdx]; ok {
			out = append(out, f.members[i])
		}
	}
	return out, nil
}

// --- 테스트 헬퍼 ------------------------------------------------------------

func fptr(v float64) *float64 { return &v }

// makeMemberNamed는 토큰/언어/닉네임이 채워진 Member를 만든다(geofence 발송 문구의 {name} 검증용).
func makeMemberNamed(idx int, token string, lang *string, nickname string) model.Member {
	m := makeMember(idx, token, lang)
	if nickname != "" {
		m.MtNickname = &nickname
	}
	return m
}

func newGeofenceHandlers(sender fcm.Sender, sch geofenceScheduleSource, gd geofenceGroupDetailSource,
	loc geofenceLocSource, role geofenceGroupRoleSource, my geofenceMyLocationSource,
	mem geofenceMemberSource, dst pushLogWriter) *Handlers {
	return &Handlers{
		log:                    slog.New(slog.NewTextHandler(noopWriter{}, nil)),
		fcm:                    sender,
		geofenceScheduleSrc:    sch,
		geofenceGroupDetailSrc: gd,
		geofenceLocSrc:         loc,
		geofenceGroupRoleSrc:   role,
		geofenceMyLocationSrc:  my,
		geofenceMemberSrc:      mem,
		pushLogDst:             dst,
	}
}

// makeGeoSchedule은 그룹 일정 1건을 만든다(좌표는 문자열, sgt/sgdt/mt 지정).
func makeGeoSchedule(sstIdx, sgtIdx, sgdtIdx, mtIdx int, lat, long string) model.Schedule {
	s := model.Schedule{SstIdx: sstIdx}
	s.SgtIdx = intptr(sgtIdx)
	s.SgdtIdx = intptr(sgdtIdx)
	s.MtIdx = intptr(mtIdx)
	s.SstLocationLat = strptr(lat)
	s.SstLocationLong = strptr(long)
	t := "회의장소"
	s.SstTitle = &t
	return s
}

func makeGD(sgdtIdx, mtIdx int) model.GroupDetail {
	return model.GroupDetail{SgdtIdx: sgdtIdx, MtIdx: intptr(mtIdx)}
}

func makeMyLoc(sltIdx, mtIdx int, lat, long, enterChk, title string, udate *time.Time) model.Location {
	l := model.Location{SltIdx: sltIdx, MtIdx: intptr(mtIdx)}
	l.SltLat = strptr(lat)
	l.SltLong = strptr(long)
	if enterChk != "" {
		l.SltEnterChk = strptr(enterChk)
	}
	if title != "" {
		l.SltTitle = strptr(title)
	}
	l.SltUdate = udate
	return l
}

// 좌표쌍: 서울시청 기준. 동일 좌표=거리 0(≤80 진입), 멀리 떨어진 좌표=수백 m(≥120 이탈).
const (
	latBase  = "37.5665000"
	longBase = "126.9780000"
	// 약 200m 북쪽(위도 +0.0018 ≈ 200m).
	latFar  = "37.5683000"
	longFar = "126.9780000"
)

// --- 그룹 entry 테스트 ------------------------------------------------------

// TestGeofenceEnter_DistanceBoundary는 ①진입 반경(≤80m) 통과 일정만 claim+발송 ②멀리 떨어진(>80m)
// 일정은 거리 미통과로 claim/발송 제외 ③owner/leader fan-out(액터 제외)을 검증한다.
func TestGeofenceEnter_DistanceBoundary(t *testing.T) {
	ko := "ko"
	// 일정 100: 위치주인 mt=10, 좌표 동일 → 거리 0 ≤80 → 발송. 일정 200: 위치주인 mt=20, 멀리 → skip.
	in := []model.Schedule{
		makeGeoSchedule(100, 7, 1000, 99, latBase, longBase), // 작성자 99 ≠ 위치주인 10
		makeGeoSchedule(200, 7, 2000, 99, latBase, longBase),
	}
	sch := &fakeGeofenceScheduleSrc{in: in}
	gd := &fakeGeofenceGroupDetailSrc{gd: map[int]model.GroupDetail{
		1000: makeGD(1000, 10),
		2000: makeGD(2000, 20),
	}}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5665), Long: fptr(126.9780)}, // 일정100 장소와 동일 → 0m
		20: {MtIdx: 20, Lat: fptr(37.6000), Long: fptr(127.0500)}, // 일정200 장소에서 수 km
	}}
	role := &fakeGeofenceGroupRoleSrc{rolesBySgt: map[int][]model.GroupRoleMember{
		7: {
			makeRole(10, "tok-actor", true, false, &ko),  // owner지만 액터(위치주인=10) → 제외
			makeRole(11, "tok-leader", false, true, &ko), // leader → 포함
		},
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{makeMemberNamed(10, "tok-actor", &ko, "철수")}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, sch, gd, loc, role, nil, mem, dst)

	task := asynq.NewTask(TypeGeofenceEnter, nil)
	if err := h.handleGeofenceEnter(context.Background(), task); err != nil {
		t.Fatalf("handleGeofenceEnter error: %v", err)
	}

	// claim은 거리 통과한 일정100만 시도(일정200은 거리 미통과로 claim 안 함).
	if sch.entryCalls != 1 {
		t.Errorf("entry claim calls = %d, want 1 (only distance-passing schedule)", sch.entryCalls)
	}
	// 발송: leader(11) 1건. owner(10)는 액터라 제외.
	sent := sender.allSentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent = %d, want 1 (leader only, actor excluded)", len(sent))
	}
	if sent[0].Token != "tok-leader" {
		t.Errorf("token = %q, want tok-leader", sent[0].Token)
	}
	// 메시지 {name} 치환(액터 이름 철수), {title}=회의장소.
	if sent[0].Title != "일정장소 도착알림 📍" {
		t.Errorf("title = %q", sent[0].Title)
	}
	if sent[0].Body != "철수님이 '회의장소' 장소에 도착했어요! 🎉" {
		t.Errorf("body = %q", sent[0].Body)
	}
	// push_log 1행, sst_idx=100, plt_condition=30초 - 장소알림.
	if len(dst.logs) != 1 || dst.logs[0].SstIdx == nil || *dst.logs[0].SstIdx != 100 {
		t.Fatalf("logs = %+v, want 1 with sst_idx=100", dst.logs)
	}
	if *dst.logs[0].PltCondition != geofenceEntryPltCondition {
		t.Errorf("plt_condition = %q", *dst.logs[0].PltCondition)
	}
	if dst.logs[0].PushJSON == nil || *dst.logs[0].PushJSON == "{}" {
		t.Errorf("push_json should carry lat/lng/distance, got %v", dst.logs[0].PushJSON)
	}
}

// TestGeofenceEnter_GPSFilter는 부정확(accuracy>50)/오래된(gps_time<now-5분) GPS는 거리 판정 전에
// skip되어 claim/발송이 없음을 검증한다.
func TestGeofenceEnter_GPSFilter(t *testing.T) {
	old := time.Now().Add(-10 * time.Minute)
	in := []model.Schedule{
		makeGeoSchedule(100, 7, 1000, 99, latBase, longBase), // 부정확 GPS
		makeGeoSchedule(200, 7, 2000, 99, latBase, longBase), // 오래된 GPS
	}
	sch := &fakeGeofenceScheduleSrc{in: in}
	gd := &fakeGeofenceGroupDetailSrc{gd: map[int]model.GroupDetail{
		1000: makeGD(1000, 10),
		2000: makeGD(2000, 20),
	}}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5665), Long: fptr(126.9780), Accuracy: fptr(99.0)}, // 부정확 → skip
		20: {MtIdx: 20, Lat: fptr(37.5665), Long: fptr(126.9780), GpsTime: &old},        // 오래됨 → skip
	}}
	role := &fakeGeofenceGroupRoleSrc{}
	mem := &fakeGeofenceMemberSrc{}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, sch, gd, loc, role, nil, mem, dst)

	if err := h.handleGeofenceEnter(context.Background(), asynq.NewTask(TypeGeofenceEnter, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	if sch.entryCalls != 0 {
		t.Errorf("claim should not be called for filtered GPS, calls=%d", sch.entryCalls)
	}
	if sender.calls != 0 {
		t.Errorf("no send expected, calls=%d", sender.calls)
	}
	if len(dst.logs) != 0 {
		t.Errorf("logs = %d, want 0", len(dst.logs))
	}
}

// TestGeofenceEnter_DuplicateTickIdempotent는 같은 진입 일정에 2회 틱 실행 시 1회차만 claim=1로
// 발송, 2회차는 claim=0으로 발송 0건임을 검증한다(claim 선점 멱등).
func TestGeofenceEnter_DuplicateTickIdempotent(t *testing.T) {
	ko := "ko"
	in := []model.Schedule{makeGeoSchedule(100, 7, 1000, 99, latBase, longBase)}
	sch := &fakeGeofenceScheduleSrc{in: in}
	gd := &fakeGeofenceGroupDetailSrc{gd: map[int]model.GroupDetail{1000: makeGD(1000, 10)}}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5665), Long: fptr(126.9780)},
	}}
	role := &fakeGeofenceGroupRoleSrc{rolesBySgt: map[int][]model.GroupRoleMember{
		7: {makeRole(11, "tok-leader", false, true, &ko)},
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{makeMemberNamed(10, "t", &ko, "철수")}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, sch, gd, loc, role, nil, mem, dst)

	task := asynq.NewTask(TypeGeofenceEnter, nil)
	if err := h.handleGeofenceEnter(context.Background(), task); err != nil {
		t.Fatalf("tick1: %v", err)
	}
	if len(sender.allSentMessages()) != 1 {
		t.Fatalf("tick1 sent = %d, want 1", len(sender.allSentMessages()))
	}
	if err := h.handleGeofenceEnter(context.Background(), task); err != nil {
		t.Fatalf("tick2: %v", err)
	}
	if len(sender.allSentMessages()) != 1 {
		t.Errorf("after tick2 cumulative sent = %d, want 1 (claim=0 idempotent)", len(sender.allSentMessages()))
	}
	if len(dst.logs) != 1 {
		t.Errorf("cumulative logs = %d, want 1", len(dst.logs))
	}
}

// --- 그룹 exit 테스트 -------------------------------------------------------

// TestGeofenceExit_DistanceBoundary는 이탈 반경(≥120m) 통과 일정만 claim+발송임을 검증한다.
func TestGeofenceExit_DistanceBoundary(t *testing.T) {
	ko := "ko"
	out := []model.Schedule{
		makeGeoSchedule(100, 7, 1000, 99, latBase, longBase), // 위치주인 10 멀리(≥120) → 발송
		makeGeoSchedule(200, 7, 2000, 99, latBase, longBase), // 위치주인 20 가까이(<120) → skip
	}
	sch := &fakeGeofenceScheduleSrc{out: out}
	gd := &fakeGeofenceGroupDetailSrc{gd: map[int]model.GroupDetail{
		1000: makeGD(1000, 10),
		2000: makeGD(2000, 20),
	}}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5683), Long: fptr(126.9780)}, // ~200m → ≥120 발송
		20: {MtIdx: 20, Lat: fptr(37.5665), Long: fptr(126.9780)}, // 0m → <120 skip
	}}
	role := &fakeGeofenceGroupRoleSrc{rolesBySgt: map[int][]model.GroupRoleMember{
		7: {makeRole(11, "tok-leader", false, true, &ko)},
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{makeMemberNamed(10, "t", &ko, "철수")}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, sch, gd, loc, role, nil, mem, dst)

	if err := h.handleGeofenceExit(context.Background(), asynq.NewTask(TypeGeofenceExit, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	if sch.exitCalls != 1 {
		t.Errorf("exit claim calls = %d, want 1", sch.exitCalls)
	}
	sent := sender.allSentMessages()
	if len(sent) != 1 || sent[0].Token != "tok-leader" {
		t.Fatalf("sent = %v, want 1 leader", sent)
	}
	if sent[0].Body != "철수님이 '회의장소' 장소에서 출발했어요!" {
		t.Errorf("exit body = %q", sent[0].Body)
	}
}

// --- 내 장소 entry 테스트 ---------------------------------------------------

// TestGeofenceMyEnter_SelfOnly는 내 장소 진입 시 ①본인에게만 발송(fan-out 없음) ②미진입 후보만 처리
// ③거리 ≤80 통과 + claim ④slt_idx가 push_log sst_idx 컬럼에 들어감을 검증한다.
func TestGeofenceMyEnter_SelfOnly(t *testing.T) {
	ko := "ko"
	active := []model.Location{
		makeMyLoc(500, 10, latBase, longBase, "N", "우리집", nil), // 미진입 + 가까움 → 발송
		makeMyLoc(600, 20, latBase, longBase, "Y", "회사", nil),  // 이미 진입(Y) → entry 후보 제외
		makeMyLoc(700, 30, latFar, longFar, "N", "먼곳", nil),    // 미진입이나 멀어서 거리 미통과
	}
	my := &fakeGeofenceMyLocationSrc{active: active}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5665), Long: fptr(126.9780)},
		20: {MtIdx: 20, Lat: fptr(37.5665), Long: fptr(126.9780)},
		30: {MtIdx: 30, Lat: fptr(37.5665), Long: fptr(126.9780)}, // slt 700은 latFar라 멀다
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{
		makeMemberNamed(10, "tok-10", &ko, "영희"),
		makeMemberNamed(30, "tok-30", &ko, "민수"),
	}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, nil, nil, loc, nil, my, mem, dst)

	if err := h.handleGeofenceMyEnter(context.Background(), asynq.NewTask(TypeGeofenceMyEnter, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	// claim은 거리 통과한 slt 500만(600은 Y라 후보 제외, 700은 거리 미통과).
	if my.entryCalls != 1 {
		t.Errorf("my entry claim calls = %d, want 1", my.entryCalls)
	}
	sent := sender.allSentMessages()
	if len(sent) != 1 || sent[0].Token != "tok-10" {
		t.Fatalf("sent = %v, want 1 self (tok-10)", sent)
	}
	if sent[0].Body != "영희님이 내장소 '우리집'에 방문했어요! 🎉" {
		t.Errorf("my entry body = %q", sent[0].Body)
	}
	// push_log: sst_idx 컬럼에 slt_idx(500) 재활용.
	if len(dst.logs) != 1 || dst.logs[0].SstIdx == nil || *dst.logs[0].SstIdx != 500 {
		t.Fatalf("logs = %+v, want sst_idx(=slt_idx)=500", dst.logs)
	}
	if *dst.logs[0].PltCondition != myEntryPltCondition {
		t.Errorf("plt_condition = %q", *dst.logs[0].PltCondition)
	}
}

// TestGeofenceMyEnter_Cooldown은 slt_udate가 3분 이내면 쿨다운으로 skip, 3분 초과면 통과를 검증한다.
func TestGeofenceMyEnter_Cooldown(t *testing.T) {
	ko := "ko"
	recent := time.Now().Add(-1 * time.Minute) // 쿨다운 내 → skip
	old := time.Now().Add(-5 * time.Minute)    // 쿨다운 경과 → 통과
	active := []model.Location{
		makeMyLoc(500, 10, latBase, longBase, "N", "집", &recent),
		makeMyLoc(600, 20, latBase, longBase, "N", "집2", &old),
	}
	my := &fakeGeofenceMyLocationSrc{active: active}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5665), Long: fptr(126.9780)},
		20: {MtIdx: 20, Lat: fptr(37.5665), Long: fptr(126.9780)},
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{
		makeMemberNamed(10, "tok-10", &ko, "A"),
		makeMemberNamed(20, "tok-20", &ko, "B"),
	}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, nil, nil, loc, nil, my, mem, dst)

	if err := h.handleGeofenceMyEnter(context.Background(), asynq.NewTask(TypeGeofenceMyEnter, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	// slt 500은 쿨다운 내라 skip, slt 600만 발송.
	sent := sender.allSentMessages()
	if len(sent) != 1 || sent[0].Token != "tok-20" {
		t.Fatalf("sent = %v, want 1 (slt 600 only, cooldown skips 500)", sent)
	}
	if my.entryCalls != 1 {
		t.Errorf("claim calls = %d, want 1", my.entryCalls)
	}
}

// --- 내 장소 exit 테스트 ----------------------------------------------------

// TestGeofenceMyExit_DistanceBoundary는 이탈 반경(≥120m) 통과 시 본인에게만 발송 + claim을 검증한다.
func TestGeofenceMyExit_DistanceBoundary(t *testing.T) {
	ko := "ko"
	// exit 후보는 get_all_active_in(이미 진입 'Y')만. 거리 ≥120 통과해야 발송.
	activeIn := []model.Location{
		makeMyLoc(500, 10, latBase, longBase, "Y", "집", nil),  // 멀리 → 발송
		makeMyLoc(600, 20, latBase, longBase, "Y", "회사", nil), // 가까이 → skip
	}
	my := &fakeGeofenceMyLocationSrc{activeIn: activeIn}
	loc := &fakeGeofenceLocSrc{locs: map[int]repository.RecentLocation{
		10: {MtIdx: 10, Lat: fptr(37.5683), Long: fptr(126.9780)}, // ~200m → 발송
		20: {MtIdx: 20, Lat: fptr(37.5665), Long: fptr(126.9780)}, // 0m → skip
	}}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{
		makeMemberNamed(10, "tok-10", &ko, "영희"),
		makeMemberNamed(20, "tok-20", &ko, "철수"),
	}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, nil, nil, loc, nil, my, mem, dst)

	if err := h.handleGeofenceMyExit(context.Background(), asynq.NewTask(TypeGeofenceMyExit, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	if my.exitCalls != 1 {
		t.Errorf("my exit claim calls = %d, want 1", my.exitCalls)
	}
	sent := sender.allSentMessages()
	if len(sent) != 1 || sent[0].Token != "tok-10" {
		t.Fatalf("sent = %v, want 1 self (tok-10)", sent)
	}
	if sent[0].Body != "영희님이 내장소 '집'에서 이탈했어요!" {
		t.Errorf("my exit body = %q", sent[0].Body)
	}
}

// TestGeofenceMyEnter_NoCandidates는 후보 없음(모두 이미 'Y')일 때 no-op을 검증한다.
func TestGeofenceMyEnter_NoCandidates(t *testing.T) {
	ko := "ko"
	active := []model.Location{
		makeMyLoc(500, 10, latBase, longBase, "Y", "집", nil), // 모두 진입 완료 → entry 후보 0
	}
	my := &fakeGeofenceMyLocationSrc{active: active}
	loc := &fakeGeofenceLocSrc{}
	mem := &fakeGeofenceMemberSrc{members: []model.Member{makeMemberNamed(10, "t", &ko, "A")}}
	dst := &fakePushLogDst{}
	sender := &fakeSender{allSuccess: true}
	h := newGeofenceHandlers(sender, nil, nil, loc, nil, my, mem, dst)

	if err := h.handleGeofenceMyEnter(context.Background(), asynq.NewTask(TypeGeofenceMyEnter, nil)); err != nil {
		t.Fatalf("error: %v", err)
	}
	if my.entryCalls != 0 || sender.calls != 0 || dst.calls != 0 {
		t.Errorf("no-op expected: claim=%d send=%d log=%d", my.entryCalls, sender.calls, dst.calls)
	}
}
