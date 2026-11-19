package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// G6 위치 정보 보호 테스트. 실제 라우터(server.New) + 실제 미들웨어/가드/서비스를 쓰고 저장소만 메모리 fake로 대체한다.
//
// 세계관(그룹 10):
//   1 방장(owner), 2 리더(leader), 3 일반 멤버, 4 나간 멤버(exit=Y), 5 강퇴된 멤버(discharge=Y),
//   6 다른 그룹(20) 회원, 7 그룹 10에 행은 있으나 show=N(숨김), 8 아무 그룹에도 없음.

const (
	gOwner, gLeader, gMember, gExited, gKicked, gOther, gHidden, gNone = 1, 2, 3, 4, 5, 6, 7, 8
	groupID                                                            = 10
)

type gdRow struct {
	mt, sgt, sgdt         int
	exit, discharge, show string
	owner, leader         string
}

type fakeMembership struct {
	rows []gdRow
}

func (f *fakeMembership) cur(r gdRow) bool {
	e, d, s := r.exit, r.discharge, r.show
	return repository.IsCurrentMembershipRow(&e, &d, &s)
}

func (f *fakeMembership) IsCurrentGroupMember(_ context.Context, mt, sgt int) (bool, error) {
	for _, r := range f.rows {
		if r.mt == mt && r.sgt == sgt && f.cur(r) {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeMembership) SharesCurrentGroup(_ context.Context, a, b int) (bool, error) {
	if a == b {
		return true, nil
	}
	for _, ra := range f.rows {
		for _, rb := range f.rows {
			if ra.mt == a && rb.mt == b && ra.sgt == rb.sgt && f.cur(ra) && f.cur(rb) {
				return true, nil
			}
		}
	}
	return false, nil
}

func (f *fakeMembership) ManagesMemberInSharedGroup(_ context.Context, req, target int) (bool, error) {
	if req == target {
		return true, nil
	}
	for _, ra := range f.rows {
		for _, rb := range f.rows {
			if ra.mt == req && rb.mt == target && ra.sgt == rb.sgt && f.cur(ra) && f.cur(rb) &&
				(ra.owner == "Y" || (ra.leader == "Y" && rb.owner != "Y")) {
				return true, nil
			}
		}
	}
	return false, nil
}

func (f *fakeMembership) CurrentGroupMemberIDs(_ context.Context, sgt int) ([]int, error) {
	out := []int{}
	for _, r := range f.rows {
		if r.sgt == sgt && f.cur(r) {
			out = append(out, r.mt)
		}
	}
	return out, nil
}

func (f *fakeMembership) GroupDetailOwner(_ context.Context, sgdt int) (int, bool, error) {
	for _, r := range f.rows {
		if r.sgdt == sgdt {
			return r.mt, true, nil
		}
	}
	return 0, false, nil
}

func world() *fakeMembership {
	return &fakeMembership{rows: []gdRow{
		{mt: gOwner, sgt: groupID, sgdt: 101, exit: "N", discharge: "N", show: "Y", owner: "Y", leader: "N"},
		{mt: gLeader, sgt: groupID, sgdt: 102, exit: "N", discharge: "N", show: "Y", owner: "N", leader: "Y"},
		{mt: gMember, sgt: groupID, sgdt: 103, exit: "N", discharge: "N", show: "Y", owner: "N", leader: "N"},
		{mt: gExited, sgt: groupID, sgdt: 104, exit: "Y", discharge: "N", show: "N", owner: "N", leader: "N"},
		{mt: gKicked, sgt: groupID, sgdt: 105, exit: "N", discharge: "Y", show: "Y", owner: "N", leader: "N"},
		{mt: gOther, sgt: 20, sgdt: 106, exit: "N", discharge: "N", show: "Y", owner: "Y", leader: "N"},
		{mt: gHidden, sgt: groupID, sgdt: 107, exit: "N", discharge: "N", show: "N", owner: "N", leader: "N"},
	}}
}

// --- 저장소 fake ---

type fakeLogRepo struct {
	mu      sync.Mutex
	logs    map[int]*model.MemberLocationLog
	next    int
	created []model.MemberLocationLog
	updated map[int]map[string]interface{}
	deleted []int
	withLog []int
}

func newFakeLogRepo() *fakeLogRepo {
	return &fakeLogRepo{logs: map[int]*model.MemberLocationLog{}, next: 1000, updated: map[int]map[string]interface{}{},
		withLog: []int{1, 2, 3, 4, 5, 6, 99}}
}
func (f *fakeLogRepo) GetLogByID(id int) (*model.MemberLocationLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if l, ok := f.logs[id]; ok {
		c := *l
		return &c, nil
	}
	return nil, nil
}
func (f *fakeLogRepo) CreateLog(l *model.MemberLocationLog, _ time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.next++
	l.MltIdx = f.next
	c := *l
	f.logs[l.MltIdx] = &c
	f.created = append(f.created, c)
	return nil
}
func (f *fakeLogRepo) CreateLogsBatch(logs []*model.MemberLocationLog, now time.Time) error {
	for _, l := range logs {
		if err := f.CreateLog(l, now); err != nil {
			return err
		}
	}
	return nil
}
func (f *fakeLogRepo) GetLogsByIDs(mtIdx int, ids []int) ([]model.MemberLocationLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.MemberLocationLog, 0, len(ids))
	for _, id := range ids {
		if l, ok := f.logs[id]; ok && l.MtIdx == mtIdx {
			out = append(out, *l)
		}
	}
	return out, nil
}
func (f *fakeLogRepo) UpdateLog(id int, fields map[string]interface{}) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updated[id] = fields
	return 1, nil
}
func (f *fakeLogRepo) DeleteLog(id int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, id)
	delete(f.logs, id)
	return nil
}
func (f *fakeLogRepo) GetMemberLogs(int, *time.Time, *time.Time, int, int) ([]model.MemberLocationLog, error) {
	return nil, nil
}
func (f *fakeLogRepo) GetMemberLogsByExactDate(int, time.Time, time.Time, int, int) ([]model.MemberLocationLog, error) {
	return nil, nil
}
func (f *fakeLogRepo) GetMembersWithLogsByDate(time.Time, time.Time) ([]int, error) {
	return append([]int(nil), f.withLog...), nil
}
func (f *fakeLogRepo) DailySummary(int, time.Time, time.Time, float64, float64) ([]model.LocationDailySummaryRow, error) {
	return nil, nil
}
func (f *fakeLogRepo) MemberActivity(int, string) ([]model.MemberActivityRow, error) { return nil, nil }
func (f *fakeLogRepo) DailyCounts(int, string, string, bool) ([]model.LocationLogMemberBasic, []model.DailyCountRow, error) {
	return nil, nil, nil
}
func (f *fakeLogRepo) ScheduleCount(int, string) (int, error) { return 0, nil }
func (f *fakeLogRepo) GpsDistanceAndTime(int, string) (float64, float64, int, error) {
	return 0, 0, 0, nil
}
func (f *fakeLogRepo) StayTimes(int, string, float64, float64, int) ([]model.StayTimeRow, error) {
	return nil, nil
}
func (f *fakeLogRepo) MapMarkers(int, string, float64, float64) ([]model.MemberLocationLog, error) {
	return nil, nil
}

type fakePlaceRepo struct {
	mu      sync.Mutex
	places  map[int]*model.Location
	created []model.Location
	changes []string
}

func ip(v int) *int { return &v }

func newFakePlaceRepo() *fakePlaceRepo {
	title := "t"
	return &fakePlaceRepo{places: map[int]*model.Location{
		500: {SltIdx: 500, MtIdx: ip(gMember), SltTitle: &title},
		501: {SltIdx: 501, MtIdx: ip(gOwner), SltTitle: &title},
		502: {SltIdx: 502, MtIdx: ip(gLeader), SltTitle: &title},
	}}
}
func (f *fakePlaceRepo) List(int, int) ([]model.Location, error) { return nil, nil }
func (f *fakePlaceRepo) GetByID(id int) (*model.Location, error) {
	if p, ok := f.places[id]; ok {
		c := *p
		return &c, nil
	}
	return nil, nil
}
func (f *fakePlaceRepo) FindByMember(int) ([]model.Location, error)      { return nil, nil }
func (f *fakePlaceRepo) FindByGroupDetail(int) ([]model.Location, error) { return nil, nil }
func (f *fakePlaceRepo) Create(l *model.Location) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	l.SltIdx = 900 + len(f.created)
	f.created = append(f.created, *l)
	f.places[l.SltIdx] = l
	return nil
}
func (f *fakePlaceRepo) UpdateFields(id int, _ map[string]interface{}) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.changes = append(f.changes, fmt.Sprintf("update:%d", id))
	return 1, nil
}
func (f *fakePlaceRepo) Delete(id int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.changes = append(f.changes, fmt.Sprintf("delete:%d", id))
	return nil
}
func (f *fakePlaceRepo) MemberExists(int) (bool, error) { return true, nil }
func (f *fakePlaceRepo) FirstGroupForMember(int) (*int, *int, error) {
	return ip(103), ip(groupID), nil
}

type fakeGMRepo struct{}

func (fakeGMRepo) FindGroupMembers(int) ([]model.GroupMemberRow, error) {
	name := "n"
	return []model.GroupMemberRow{{SgdtIdx: 1, MtIdx: gOwner, MtName: &name}, {SgdtIdx: 2, MtIdx: gMember, MtName: &name}}, nil
}

type fakeMemberRepo struct{}

func s(v string) *string { return &v }

func fakeMemberRow(id int) *model.Member {
	return &model.Member{MtIdx: id, MtID: s("01000000000"), MtName: s("n"), MtNickname: s("nn"),
		MtHp: s("01000000000"), MtEmail: s("e@x.com")}
}
func (fakeMemberRepo) List(int, int) ([]model.Member, error) {
	return []model.Member{*fakeMemberRow(gMember)}, nil
}
func (fakeMemberRepo) GetByID(id int) (*model.Member, error)        { return fakeMemberRow(id), nil }
func (fakeMemberRepo) GetByIdxActive(id int) (*model.Member, error) { return fakeMemberRow(id), nil }
func (fakeMemberRepo) FindByGroup(int) ([]model.MemberGroupRow, error) {
	mk := func(id int) model.MemberGroupRow {
		return model.MemberGroupRow{MtIdx: id, MtID: s("01000000000"), MtHp: s("01000000000"), MtEmail: s("e@x.com")}
	}
	return []model.MemberGroupRow{mk(gOwner), mk(gMember)}, nil
}
func (fakeMemberRepo) ExistsByPhone(string) (bool, error)    { return false, nil }
func (fakeMemberRepo) ExistsByEmail(string) (bool, error)    { return false, nil }
func (fakeMemberRepo) ExistsByNickname(string) (bool, error) { return false, nil }

type fakeMemberWriteRepo struct {
	mu      sync.Mutex
	updates []string
}

func (f *fakeMemberWriteRepo) GetByID(id int) (*model.Member, error) { return fakeMemberRow(id), nil }
func (f *fakeMemberWriteRepo) GetByIdxActive(id int) (*model.Member, error) {
	return fakeMemberRow(id), nil
}
func (f *fakeMemberWriteRepo) GetByEmail(string) (*model.Member, error)   { return nil, nil }
func (f *fakeMemberWriteRepo) GetByPhoneOr(string) (*model.Member, error) { return nil, nil }
func (f *fakeMemberWriteRepo) CreateFromRegister(m *model.Member) (*model.Member, error) {
	return m, nil
}
func (f *fakeMemberWriteRepo) CreateUserMember(m *model.Member) (*model.Member, error) { return m, nil }
func (f *fakeMemberWriteRepo) UpdateColumns(id int, _ map[string]interface{}) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updates = append(f.updates, fmt.Sprintf("member:%d", id))
	return nil
}
func (f *fakeMemberWriteRepo) ExistsPhoneExcept(string, int) (bool, error)    { return false, nil }
func (f *fakeMemberWriteRepo) ExistsEmailExcept(string, int) (bool, error)    { return false, nil }
func (f *fakeMemberWriteRepo) ExistsNicknameExcept(string, int) (bool, error) { return false, nil }
func (f *fakeMemberWriteRepo) SetPasswordRevokeRefresh(int, string) error     { return nil }
func (f *fakeMemberWriteRepo) WithdrawMember(int, int, *string) error         { return nil }

// 모든 회원이 정상 상태(차단 아님)인 상태 조회기.
type allNormal struct{}

func (allNormal) GetAccessState(int) (*model.MemberAccessState, error) {
	l, st, sh := 2, 1, "Y"
	return &model.MemberAccessState{MtLevel: &l, MtStatus: &st, MtShow: &sh}, nil
}

type lockedBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *lockedBuf) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}
func (l *lockedBuf) String() string { l.mu.Lock(); defer l.mu.Unlock(); return l.b.String() }

type locEnv struct {
	router  http.Handler
	logs    *fakeLogRepo
	places  *fakePlaceRepo
	members *fakeMemberWriteRepo
	buf     *lockedBuf
	t       *testing.T
	cancel  context.CancelFunc
	done    chan struct{}
}

type locOpts struct {
	route        auth.RouteMode
	loc          auth.LocationAuthMode
	writeToken   bool
	leaderManage bool
}

func defaultOpts() locOpts {
	return locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, leaderManage: true}
}

func newLocEnv(t *testing.T, o locOpts) *locEnv {
	t.Helper()
	cfg := testCfg()
	buf := &lockedBuf{}
	logger := slog.New(slog.NewJSONHandler(buf, nil))

	routeRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: o.route, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute,
	}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	effective := o.loc.EffectiveRouteMode(o.route)
	locRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: effective, Secret: testSecret, Algorithm: "HS256", SummaryInterval: 10 * time.Millisecond, Scope: "location",
	}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); locRA.Run(ctx) }()

	guard := handler.NewLocationGuard(service.NewLocationAuthz(world(), o.leaderManage), locRA, o.writeToken)

	logRepo := newFakeLogRepo()
	placeRepo := newFakePlaceRepo()
	mwRepo := &fakeMemberWriteRepo{}

	locLogH := handler.NewLocationLog(service.NewLocationLog(logRepo), cfg)
	locLogH.SetGuard(guard)
	locH := handler.NewLocation(service.NewLocation(placeRepo))
	locH.SetGuard(guard)
	gmH := handler.NewGroupMember(service.NewGroupMember(fakeGMRepo{}))
	gmH.SetGuard(guard)
	memberH := handler.NewMember(service.NewMember(fakeMemberRepo{}), cfg)
	memberH.SetGuard(guard)
	memberWH := handler.NewMemberWrite(service.NewMemberWrite(mwRepo, 4, auth.PasswordPolicy{}), cfg)
	memberWH.SetGuard(guard)

	r := New(cfg, logger, Deps{
		AdminAuth:    stubAdmin,
		UserAuth:     routeRA.Required(),
		UserAuthOpt:  routeRA.Optional(),
		LocationAuth: locRA.Required(),
		LocationLog:  locLogH,
		Location:     locH,
		GroupMember:  gmH,
		Member:       memberH,
		MemberWrite:  memberWH,
	})
	e := &locEnv{router: r, logs: logRepo, places: placeRepo, members: mwRepo, buf: buf, cancel: cancel, done: done, t: t}
	t.Cleanup(func() { cancel(); <-done })
	return e
}

func (e *locEnv) do(method, path string, uid int, body string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, rd)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if uid > 0 {
		req.Header.Set("Authorization", bearer(e.t, uid))
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

var _ = gin.TestMode

// --- 조회 ---

type readCase struct {
	name, method, path, body string
	target                   int // 대상 회원(0이면 그룹 단위)
}

func memberReadCases(target int) []readCase {
	id := fmt.Sprint(target)
	b := func(act, extra string) string {
		return fmt.Sprintf(`{"act":%q,"mt_idx":%s%s}`, act, id, extra)
	}
	return []readCase{
		{"logs list", "GET", "/logs/member-location-logs/" + id, "", target},
		{"logs daily", "GET", "/logs/member-location-logs/" + id + "/daily?date=2026-11-01", "", target},
		{"logs daily-summary", "GET", "/logs/member-location-logs/" + id + "/daily-summary?start_date=2026-11-01&end_date=2026-11-02", "", target},
		{"logs summary", "GET", "/logs/member-location-logs/" + id + "/summary?date=2026-11-01", "", target},
		{"logs path", "GET", "/logs/member-location-logs/" + id + "/path", "", target},
		{"logs stay-times", "GET", "/logs/member-location-logs/" + id + "/stay-times?date=2026-11-01", "", target},
		{"logs map-markers", "GET", "/logs/member-location-logs/" + id + "/map-markers?date=2026-11-01", "", target},
		{"act get_location_logs", "POST", "/logs/member-location-logs", b("get_location_logs", ""), target},
		{"act get_location_summary", "POST", "/logs/member-location-logs", b("get_location_summary", ""), target},
		{"act get_location_path", "POST", "/logs/member-location-logs", b("get_location_path", ""), target},
		{"act get_daily_location_logs", "POST", "/logs/member-location-logs", b("get_daily_location_logs", `,"date":"2026-11-01"`), target},
		{"act get_daily_location_summary", "POST", "/logs/member-location-logs", b("get_daily_location_summary", `,"date":"2026-11-01"`), target},
		{"act get_daily_location_path", "POST", "/logs/member-location-logs", b("get_daily_location_path", `,"date":"2026-11-01"`), target},
		{"act get_daily_summary_by_range", "POST", "/logs/member-location-logs", b("get_daily_summary_by_range", `,"start_date":"2026-11-01","end_date":"2026-11-02"`), target},
		{"act get_stay_times", "POST", "/logs/member-location-logs", b("get_stay_times", `,"date":"2026-11-01"`), target},
		{"act get_map_markers", "POST", "/logs/member-location-logs", b("get_map_markers", `,"date":"2026-11-01"`), target},
		{"act get_location_log_summary", "POST", "/logs/member-location-logs", b("get_location_log_summary", `,"date":"2026-11-01"`), target},
		{"locations member", "GET", "/locations/member/" + id, "", target},
		{"locations other-members", "GET", "/locations/other-members/" + id, "", target},
		{"members detail", "GET", "/members/" + id, "", target},
		{"members list ?id", "GET", "/members/?id=" + id, "", target},
	}
}

func groupReadCases(g int) []readCase {
	id := fmt.Sprint(g)
	return []readCase{
		{"group-members", "GET", "/group-members/member/" + id, "", g},
		{"members/group", "GET", "/members/group/" + id, "", g},
		{"logs member-activity", "GET", "/logs/member-activity?group_id=" + id + "&date=2026-11-01", "", g},
		{"logs daily-counts", "GET", "/logs/daily-counts?group_id=" + id, "", g},
		{"logs daily-counts-simple", "GET", "/logs/daily-counts-simple?group_id=" + id, "", g},
		{"logs members-with-logs", "GET", "/logs/members-with-logs?group_id=" + id + "&date=2026-11-01", "", g},
		{"act get_members_with_logs", "POST", "/logs/member-location-logs", `{"act":"get_members_with_logs","date":"2026-11-01","group_id":` + id + `}`, g},
		{"locations group-detail", "GET", "/locations/group-detail/103", "", g}, // sgdt 103 = 일반 멤버(3)의 그룹 10 행
	}
}

func TestLocationReadsByRole(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce} {
		for _, loc := range []auth.LocationAuthMode{auth.LocationAuthInherit, auth.LocationAuthWarn, auth.LocationAuthEnforce} {
			e := newLocEnv(t, locOpts{route: mode, loc: loc, leaderManage: true})
			// 토큰이 있는 요청은 모드와 무관하게 항상 같은 결과.
			roles := []struct {
				name string
				uid  int
				ok   bool
			}{
				{"본인", gMember, true}, {"방장", gOwner, true}, {"리더", gLeader, true},
				{"나간 멤버", gExited, false}, {"강퇴된 멤버", gKicked, false}, {"숨김 멤버", gHidden, false},
				{"다른 그룹", gOther, false}, {"그룹 없음", gNone, false},
			}
			cases := append(memberReadCases(gMember), groupReadCases(groupID)...)
			for _, rc := range cases {
				for _, role := range roles {
					want := http.StatusOK
					if !role.ok {
						want = http.StatusForbidden
					}
					// 그룹 단위 조회는 "본인"도 멤버여야 하므로 같은 표(3은 멤버)로 충분하다.
					w := e.do(rc.method, rc.path, role.uid, rc.body)
					if w.Code != want {
						t.Errorf("[route=%s loc=%s] %s / %s: got %d want %d body=%s", mode, loc, rc.name, role.name, w.Code, want, w.Body.String())
					}
				}
			}
		}
	}
}

// 무토큰 요청: ROUTE_AUTH_MODE × LOCATION_AUTH_MODE.
func TestLocationTokenlessModes(t *testing.T) {
	cases := []struct {
		route auth.RouteMode
		loc   auth.LocationAuthMode
		want  int
	}{
		{auth.RouteModeWarn, auth.LocationAuthInherit, 200},
		{auth.RouteModeWarn, auth.LocationAuthWarn, 200},
		{auth.RouteModeWarn, auth.LocationAuthEnforce, 401},
		{auth.RouteModeEnforce, auth.LocationAuthInherit, 401},
		{auth.RouteModeEnforce, auth.LocationAuthWarn, 200}, // 위치 라우트만 warn으로 유지
		{auth.RouteModeEnforce, auth.LocationAuthEnforce, 401},
		{auth.RouteModeOff, auth.LocationAuthInherit, 200}, // off는 위치 라우트에서 warn으로 취급
		{auth.RouteModeOff, auth.LocationAuthEnforce, 401},
	}
	for _, c := range cases {
		e := newLocEnv(t, locOpts{route: c.route, loc: c.loc})
		for _, rc := range []readCase{
			{"logs list", "GET", "/logs/member-location-logs/3", "", 3},
			{"act", "POST", "/logs/member-location-logs", `{"act":"get_location_logs","mt_idx":3}`, 3},
			{"group-members", "GET", "/group-members/member/10", "", 10},
			{"locations", "GET", "/locations/member/3", "", 3},
		} {
			if w := e.do(rc.method, rc.path, 0, rc.body); w.Code != c.want {
				t.Errorf("[route=%s loc=%s] 무토큰 %s: got %d want %d", c.route, c.loc, rc.name, w.Code, c.want)
			}
		}
		// 이 라우트들은 ROUTE_AUTH_MODE만 따르는 다른 라우트(예: push-logs)와 독립이다.
	}
}

// 만료/위조 토큰은 무토큰과 같게 모드를 따른다(유효 토큰만 신원으로 인정).
func TestLocationInvalidTokenFollowsMode(t *testing.T) {
	e := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthEnforce})
	req := httptest.NewRequest("GET", "/api/v1/logs/member-location-logs/3", nil)
	req.Header.Set("Authorization", "Bearer not-a-token")
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatalf("위조 토큰 enforce: %d", w.Code)
	}
}

// --- 그룹 멤버 목록 응답 내용 ---

func TestGroupMemberListForbiddenBodyIsEmptyOfData(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	w := e.do("GET", "/group-members/member/10", gOther, "")
	if w.Code != 403 || strings.Contains(w.Body.String(), "mt_idx") {
		t.Fatalf("403 본문에 데이터가 섞임: %d %s", w.Code, w.Body.String())
	}
}

// --- 개인정보 비우기 ---

func TestMembersGroupRedactsOthersContact(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	w := e.do("GET", "/members/group/10", gOwner, "")
	if w.Code != 200 {
		t.Fatalf("code %d", w.Code)
	}
	var items []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatal(err)
	}
	for _, it := range items {
		self := int(it["mt_idx"].(float64)) == gOwner
		for _, k := range []string{"mt_id", "mt_hp", "mt_email"} {
			v, has := it[k]
			if !has {
				t.Errorf("키 %s 가 사라짐(앱 디코딩 보호를 위해 유지해야 함)", k)
			}
			if self && v == "" {
				t.Errorf("본인 응답의 %s 가 비워짐", k)
			}
			if !self && v != "" {
				t.Errorf("타인 응답의 %s 가 비워지지 않음: %v", k, v)
			}
		}
	}
	// 무토큰(warn 통과)은 본인을 알 수 없으므로 전부 비운다.
	w = e.do("GET", "/members/3", 0, "")
	var one map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &one)
	if one["mt_hp"] != "" || one["mt_email"] != "" || one["mt_id"] != "" {
		t.Errorf("무토큰 응답에 연락처가 남음: %s", w.Body.String())
	}
	// 본인 상세는 그대로.
	w = e.do("GET", "/members/3", gMember, "")
	_ = json.Unmarshal(w.Body.Bytes(), &one)
	if one["mt_hp"] == "" || one["mt_email"] == "" {
		t.Errorf("본인 상세가 비워짐: %s", w.Body.String())
	}
}

func TestBulkDumpsClosedForTokenHolders(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	for _, p := range []string{"/locations/", "/members/"} {
		if w := e.do("GET", p, gOwner, ""); w.Code != 403 {
			t.Errorf("%s 토큰 보유: %d", p, w.Code)
		}
	}
	// warn 통과(무토큰)는 잔여 위험으로 남는다는 사실을 고정한다.
	if w := e.do("GET", "/locations/", 0, ""); w.Code != 200 {
		t.Errorf("무토큰 warn: %d", w.Code)
	}
}

func TestMembersWithLogsFilteredToGroup(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	w := e.do("GET", "/logs/members-with-logs?group_id=10&date=2026-11-01", gMember, "")
	var ids []int
	_ = json.Unmarshal(w.Body.Bytes(), &ids)
	for _, id := range ids {
		if id == 99 || id == gOther || id == gExited || id == gKicked {
			t.Errorf("그룹 멤버가 아닌 회원 번호가 노출: %v", ids)
		}
	}
	if len(ids) != 3 {
		t.Errorf("그룹 현재 멤버(1,2,3)만 남아야 함: %v", ids)
	}
	// act 방식에서 그룹 지정 없이 토큰만 있으면 403(전체 덤프 방지).
	w = e.do("POST", "/logs/member-location-logs", gMember, `{"act":"get_members_with_logs","date":"2026-11-01"}`)
	if w.Code != 403 {
		t.Errorf("그룹 미지정 act: %d", w.Code)
	}
}

// --- 업로드 ---

// 앱이 실제로 보내는 본문(Android CreateLocationLogRequest / iOS LocationUploader.sendSingle).
const androidUpload = `{"act":"create_location_log","mt_idx":"%d","mlt_lat":37.1,"mlt_long":127.1,"mlt_accuracy":10.0,"mlt_speed":0.0,"mlt_altitude":0.0,` +
	`"mlt_timestamp":"2026-11-13 09:00:00","mlt_battery":"80","mlt_fine_location":"N","mlt_location_chk":"N","mt_health_work":"0","source":"android-app"}`
const iosUpload = `{"act":"create_location_log","mt_idx":"%d","mlt_lat":37.1,"mlt_long":127.1,"mlt_accuracy":10.0,"mlt_speed":0.0,"mlt_altitude":0.0,` +
	`"mlt_timestamp":"2026-11-13 09:00:00","mlt_battery":"80","mlt_fine_location":"N","mlt_location_chk":"N","mt_health_work":"0","source":"ios-app"}`

func TestUploadBodyMtIdxMustMatchToken(t *testing.T) {
	for _, tpl := range []string{androidUpload, iosUpload} {
		e := newLocEnv(t, defaultOpts())
		// 일치
		if w := e.do("POST", "/logs/member-location-logs", gMember, fmt.Sprintf(tpl, gMember)); w.Code != 200 {
			t.Fatalf("일치 업로드: %d %s", w.Code, w.Body.String())
		}
		// 불일치: 403이고 아무것도 기록되지 않는다.
		if w := e.do("POST", "/logs/member-location-logs", gMember, fmt.Sprintf(tpl, gOwner)); w.Code != 403 {
			t.Fatalf("불일치 업로드: %d", w.Code)
		}
		// 본문 mt_idx 없음: 토큰 회원으로 기록.
		noID := strings.Replace(fmt.Sprintf(tpl, 0), `"mt_idx":"0",`, "", 1)
		if w := e.do("POST", "/logs/member-location-logs", gMember, noID); w.Code != 200 {
			t.Fatalf("본문 mt_idx 없음: %d", w.Code)
		}
		if len(e.logs.created) != 2 {
			t.Fatalf("기록 건수 %d (불일치 요청이 기록됨?)", len(e.logs.created))
		}
		for _, l := range e.logs.created {
			if l.MtIdx != gMember {
				t.Errorf("토큰 회원이 아닌 명의로 기록됨: %d", l.MtIdx)
			}
		}
	}
}

func TestUploadBatchMismatchIs403(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	body := `{"act":"create_location_log","mt_idx":3,"mlt_gps_data":[{"mlt_lat":1,"mlt_long":2,"mlt_gps_time":"2026-11-13T09:00:00"},{"mt_idx":1,"mlt_lat":1,"mlt_long":2,"mlt_gps_time":"2026-11-13T09:00:00"}]}`
	if w := e.do("POST", "/logs/member-location-logs", gMember, body); w.Code != 403 {
		t.Fatalf("배치 중 타인 명의: %d", w.Code)
	}
	// 403으로 거부된 배치는 앞쪽 정상 항목도 기록하지 않는다.
	if len(e.logs.created) != 0 {
		t.Fatalf("거부된 배치가 일부 기록됨: %+v", e.logs.created)
	}
}

func TestUploadWithoutTokenFlag(t *testing.T) {
	// 플래그 꺼짐: 기존대로 본문 mt_idx로 기록 + 계측.
	e := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, writeToken: false})
	if w := e.do("POST", "/logs/member-location-logs", 0, fmt.Sprintf(androidUpload, gMember)); w.Code != 200 {
		t.Fatalf("플래그 off 무토큰: %d", w.Code)
	}
	if len(e.logs.created) != 1 || e.logs.created[0].MtIdx != gMember {
		t.Fatalf("기존 동작(본문 mt_idx 기록) 불일치: %+v", e.logs.created)
	}
	// 본문 mt_idx도 없으면 기존대로 401.
	if w := e.do("POST", "/logs/member-location-logs", 0, `{"act":"create_location_log","mlt_lat":1,"mlt_long":2,"mlt_gps_time":"2026-11-13T09:00:00"}`); w.Code != 401 {
		t.Fatalf("토큰도 mt_idx도 없음: %d", w.Code)
	}
	time.Sleep(50 * time.Millisecond)
	logs := e.buf.String()
	if !strings.Contains(logs, `"scope":"location"`) || !strings.Contains(logs, "location_write_no_token") {
		t.Errorf("위치 업로드 무토큰 계측 로그가 없음: %s", logs)
	}
	for _, secret := range []string{"37.1", "127.1", "Bearer", "mt_idx"} {
		if strings.Contains(logs, secret) {
			t.Errorf("계측 로그에 민감 값(%s)이 포함됨", secret)
		}
	}

	// 플래그 켜짐: 무토큰(만료 토큰 포함) 401 + 기록 없음, 유효 토큰은 정상.
	e = newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, writeToken: true})
	if w := e.do("POST", "/logs/member-location-logs", 0, fmt.Sprintf(iosUpload, gMember)); w.Code != 401 {
		t.Fatalf("플래그 on 무토큰: %d", w.Code)
	}
	if len(e.logs.created) != 0 {
		t.Fatal("플래그 on인데 기록됨")
	}
	if w := e.do("POST", "/logs/member-location-logs", gMember, fmt.Sprintf(iosUpload, gMember)); w.Code != 200 {
		t.Fatalf("플래그 on 유효 토큰: %d", w.Code)
	}
}

// --- 수정/삭제 ---

func TestUpdateDeleteOwnerOnly(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	mk := func() {
		e.logs.logs[100] = &model.MemberLocationLog{MltIdx: 100, MtIdx: gMember}
	}
	mk()
	upd := func(uid int, extra string) int {
		return e.do("POST", "/logs/member-location-logs", uid, `{"act":"update_location_log","mlt_idx":100,"mlt_battery":50`+extra+`}`).Code
	}
	del := func(uid int) int {
		return e.do("POST", "/logs/member-location-logs", uid, `{"act":"delete_location_log","mlt_idx":100}`).Code
	}
	if c := upd(0, ""); c != 401 {
		t.Errorf("무토큰 수정: %d", c)
	}
	if c := del(0); c != 401 {
		t.Errorf("무토큰 삭제: %d", c)
	}
	for _, uid := range []int{gOwner, gLeader, gOther, gKicked} {
		if c := upd(uid, ""); c != 403 {
			t.Errorf("비소유자 %d 수정: %d", uid, c)
		}
		if c := del(uid); c != 403 {
			t.Errorf("비소유자 %d 삭제: %d", uid, c)
		}
	}
	if len(e.logs.updated) != 0 || len(e.logs.deleted) != 0 {
		t.Fatal("거부된 요청이 저장소를 변경함")
	}
	// 소유자 변경 시도는 소유자 본인도 금지(숫자/문자열 모두).
	for _, v := range []string{`,"mt_idx":1`, `,"mt_idx":"1"`, `,"mt_idx":"x"`} {
		if c := upd(gMember, v); c != 403 {
			t.Errorf("소유자 변경 %s: %d", v, c)
		}
	}
	if len(e.logs.updated) != 0 {
		t.Fatal("소유자 변경이 저장소에 도달함")
	}
	if c := upd(gMember, ""); c != 200 {
		t.Errorf("소유자 수정: %d", c)
	}
	if c := upd(gMember, `,"mt_idx":3`); c != 200 { // 같은 값은 무시
		t.Errorf("같은 소유자 지정: %d", c)
	}
	if _, has := e.logs.updated[100]["mt_idx"]; has {
		t.Error("mt_idx 가 UPDATE 컬럼에 포함됨")
	}
	if c := del(gMember); c != 200 {
		t.Errorf("소유자 삭제: %d", c)
	}
	// 없는 기록은 기존 형식(500 "404: ...")을 유지한다.
	if w := e.do("POST", "/logs/member-location-logs", gMember, `{"act":"delete_location_log","mlt_idx":4040}`); w.Code != 500 || !strings.Contains(w.Body.String(), "404: Location log not found") {
		t.Errorf("없는 기록 응답 형식 변경: %d %s", w.Code, w.Body.String())
	}
}

// --- 회원 위치 덮어쓰기 ---

func TestMemberLocationOverwriteSelfOnly(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newLocEnv(t, locOpts{route: mode, loc: auth.LocationAuthInherit})
		for _, rc := range []struct{ method, path, body string }{
			{"PATCH", "/members/3/location?lat=37.1&lng=127.1", ""},
			{"PUT", "/members/3", `{"mt_lat":37.1}`},
		} {
			if w := e.do(rc.method, rc.path, 0, rc.body); w.Code != 401 {
				t.Errorf("[%s] 무토큰 %s %s: %d", mode, rc.method, rc.path, w.Code)
			}
			for _, uid := range []int{gOwner, gLeader, gOther} {
				if w := e.do(rc.method, rc.path, uid, rc.body); w.Code != 403 {
					t.Errorf("[%s] 타인 %d %s: %d", mode, uid, rc.method, w.Code)
				}
			}
			if len(e.members.updates) != 0 {
				t.Fatalf("거부된 요청이 저장소를 변경함: %v", e.members.updates)
			}
			if w := e.do(rc.method, rc.path, gMember, rc.body); w.Code != 200 {
				t.Errorf("[%s] 본인 %s: %d %s", mode, rc.method, w.Code, w.Body.String())
			}
			e.members.updates = nil
		}
	}
}

// --- 내 장소 ---

func TestPlacesManageMatrix(t *testing.T) {
	// 장소 500=일반 멤버(3) 소유, 501=방장(1) 소유, 502=리더(2) 소유.
	type tc struct {
		name  string
		place int
		uid   int
		on    bool // 플래그 on에서 허용
		off   bool // 플래그 off에서 허용
	}
	cases := []tc{
		{"소유자(일반)", 500, gMember, true, true},
		{"방장이 일반 멤버 장소", 500, gOwner, true, false},
		{"리더가 일반 멤버 장소", 500, gLeader, true, false},
		{"일반 멤버가 방장 장소", 501, gMember, false, false},
		{"리더가 방장 장소", 501, gLeader, false, false},
		{"방장 본인 장소", 501, gOwner, true, true},
		{"방장이 리더 장소", 502, gOwner, true, false},
		{"일반 멤버가 리더 장소", 502, gMember, false, false},
		{"나간 멤버", 500, gExited, false, false},
		{"강퇴된 멤버", 500, gKicked, false, false},
		{"다른 그룹 방장", 500, gOther, false, false},
		{"그룹 없는 회원", 500, gNone, false, false},
	}
	for _, flag := range []bool{true, false} {
		for _, c := range cases {
			want := c.off
			if flag {
				want = c.on
			}
			for _, op := range []struct{ name, method, path, body string }{
				{"update", "PUT", "/locations/%d", `{"slt_title":"x"}`},
				{"delete", "DELETE", "/locations/%d", ""},
				{"notification", "PUT", "/locations/%d/notification", `{"slt_enter_alarm":"N"}`},
			} {
				e := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, leaderManage: flag})
				w := e.do(op.method, fmt.Sprintf(op.path, c.place), c.uid, op.body)
				got := w.Code == 200
				if got != want {
					t.Errorf("[leader_manage=%v] %s %s: got %d want allowed=%v", flag, c.name, op.name, w.Code, want)
				}
				if !want && w.Code != 403 {
					t.Errorf("[leader_manage=%v] %s %s: 거부는 403이어야 함: %d", flag, c.name, op.name, w.Code)
				}
				if !want && len(e.places.changes) != 0 {
					t.Errorf("[leader_manage=%v] %s %s: 거부됐는데 저장소가 변경됨", flag, c.name, op.name)
				}
			}
		}
	}
}

func TestPlacesCreate(t *testing.T) {
	// 생성: 본문 mt_idx(대상) 기준 같은 규칙. Android는 POST /locations 본문 mt_idx, iOS는 /locations/members/{id}/locations.
	for _, flag := range []bool{true, false} {
		for _, c := range []struct {
			name   string
			uid    int
			target int
			on     bool
			off    bool
		}{
			{"본인", gMember, gMember, true, true},
			{"방장이 멤버 명의", gOwner, gMember, true, false},
			{"리더가 멤버 명의", gLeader, gMember, true, false},
			{"리더가 방장 명의", gLeader, gOwner, false, false},
			{"일반 멤버가 타인 명의", gMember, gLeader, false, false},
			{"무관한 회원", gOther, gMember, false, false},
			{"나간 멤버", gExited, gMember, false, false},
		} {
			want := c.off
			if flag {
				want = c.on
			}
			e := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, leaderManage: flag})
			body := fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"slt_title":"집","slt_add":"주소","slt_lat":37.1,"slt_long":127.1,"slt_enter_alarm":"Y"}`, c.target)
			w := e.do("POST", "/locations/", c.uid, body)
			w2 := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthInherit, leaderManage: flag}).
				do("POST", fmt.Sprintf("/locations/members/%d/locations", c.target), c.uid, `{"slt_title":"집","slt_add":"주소","slt_lat":37.1,"slt_long":127.1}`)
			for _, got := range []*httptest.ResponseRecorder{w, w2} {
				if (got.Code == 200) != want {
					t.Errorf("[leader_manage=%v] %s: %s -> %d", flag, c.name, got.Header().Get("Content-Type"), got.Code)
				}
				if !want && got.Code != 403 {
					t.Errorf("[leader_manage=%v] %s: 거부는 403이어야 함: %d", flag, c.name, got.Code)
				}
			}
		}
	}
	// 토큰이 있고 본문 mt_idx가 없으면 본인 명의(기존의 282 기본값을 쓰지 않는다).
	e := newLocEnv(t, defaultOpts())
	if w := e.do("POST", "/locations/", gMember, `{"slt_title":"집","slt_add":"주소"}`); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if got := *e.places.created[0].MtIdx; got != gMember {
		t.Errorf("본문 mt_idx 없음: 본인이 아닌 명의 %d", got)
	}
}

func TestPlacesReadByGroup(t *testing.T) {
	e := newLocEnv(t, defaultOpts())
	if w := e.do("GET", "/locations/500", gOwner, ""); w.Code != 200 {
		t.Errorf("같은 그룹 장소 단건: %d", w.Code)
	}
	if w := e.do("GET", "/locations/500", gOther, ""); w.Code != 403 {
		t.Errorf("다른 그룹 장소 단건: %d", w.Code)
	}
	if w := e.do("GET", "/locations/9999", gOther, ""); w.Code != 404 {
		t.Errorf("없는 장소는 기존대로 404: %d", w.Code)
	}
}

// 라우트 표: 위치 라우트가 la 그룹(LocationAuth)에 붙었는지.
func TestLocationRoutesUseLocationAuth(t *testing.T) {
	e := newLocEnv(t, locOpts{route: auth.RouteModeWarn, loc: auth.LocationAuthEnforce})
	for _, p := range []struct{ method, path string }{
		{"GET", "/locations/"}, {"GET", "/locations/1"}, {"POST", "/locations/"}, {"PUT", "/locations/1"}, {"DELETE", "/locations/1"},
		{"GET", "/logs/daily-counts?group_id=1"}, {"POST", "/logs/member-location-logs"},
		{"GET", "/group-members/member/1"}, {"GET", "/members/group/1"}, {"GET", "/members/1"},
		{"PATCH", "/members/1/location?lat=1&lng=1"}, {"PUT", "/members/1"},
	} {
		if w := e.do(p.method, p.path, 0, ""); w.Code != 401 {
			t.Errorf("%s %s: LOCATION_AUTH_MODE=enforce에서 무토큰이 401이 아님: %d", p.method, p.path, w.Code)
		}
	}
}
