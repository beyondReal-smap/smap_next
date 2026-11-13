package server

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// G7b 일정 인가 테스트. 실제 라우터 + 실제 서비스/인가기를 쓰고 저장소만 메모리 fake로 대체한다.
// 세계관은 location_authz_test.go의 world()와 같다(그룹 10: 1 방장, 2 리더, 3 일반, 4 나감, 5 강퇴, 6 다른 그룹, 8 무소속).

// worldRoles는 fakeMembership(world)을 RoleInGroup으로 보여 주는 어댑터다.
type worldRoles struct{ w *fakeMembership }

func (a worldRoles) RoleInGroup(_ context.Context, mt, sgt int) (repository.GroupRole, error) {
	for _, r := range a.w.rows {
		if r.mt == mt && r.sgt == sgt && a.w.cur(r) {
			return repository.GroupRole{Found: true, SgdtIdx: r.sgdt, Owner: r.owner == "Y", Leader: r.leader == "Y"}, nil
		}
	}
	return repository.GroupRole{}, nil
}

type fakeSchedRepo struct {
	mu      sync.Mutex
	rows    map[int]*model.Schedule
	created []model.Schedule
	updated map[int]map[string]interface{}
	deleted []int
}

func sched(id, mt, sgt int) *model.Schedule {
	show := "Y"
	return &model.Schedule{SstIdx: id, MtIdx: &mt, SgtIdx: &sgt, SstShow: &show}
}

func newFakeSchedRepo() *fakeSchedRepo {
	return &fakeSchedRepo{updated: map[int]map[string]interface{}{}, rows: map[int]*model.Schedule{
		701: sched(701, gMember, groupID), // 일반 멤버가 쓴 그룹 10 일정
		702: sched(702, gOwner, groupID),  // 방장이 쓴 그룹 10 일정
		703: sched(703, gOther, 20),       // 다른 그룹 일정
	}}
}
func (f *fakeSchedRepo) ListForMember(mt, _, _ int) ([]model.Schedule, error) {
	out := []model.Schedule{}
	for _, r := range f.rows {
		out = append(out, *r)
	}
	return out, nil
}
func (f *fakeSchedRepo) GetByID(id int) (*model.Schedule, error) {
	if r, ok := f.rows[id]; ok {
		c := *r
		return &c, nil
	}
	return nil, nil
}
func (f *fakeSchedRepo) FindByMember(int) ([]model.Schedule, error) { return nil, nil }
func (f *fakeSchedRepo) FindGroupSchedules(g int, _ *int) ([]model.Schedule, error) {
	out := []model.Schedule{}
	for _, r := range f.rows {
		if *r.SgtIdx == g {
			out = append(out, *r)
		}
	}
	return out, nil
}
func (f *fakeSchedRepo) GetNowScheduleInMembers() ([]model.Schedule, error)  { return nil, nil }
func (f *fakeSchedRepo) GetNowScheduleOutMembers() ([]model.Schedule, error) { return nil, nil }
func (f *fakeSchedRepo) GetNowSchedulePush() ([]model.Schedule, error)       { return nil, nil }
func (f *fakeSchedRepo) Create(s *model.Schedule) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	s.SstIdx = 800 + len(f.created)
	now := time.Date(2026, 11, 13, 9, 0, 0, 0, time.UTC) // DB가 채우는 시각 필드(응답 변환에 필요)
	if s.SstWdate == nil {
		s.SstWdate = &now
	}
	if s.SstUdate == nil {
		s.SstUdate = &now
	}
	if s.SstSdate == nil {
		s.SstSdate = &now
	}
	if s.SstEdate == nil {
		s.SstEdate = &now
	}
	f.created = append(f.created, *s)
	c := *s
	f.rows[s.SstIdx] = &c
	return nil
}
func (f *fakeSchedRepo) UpdateFields(id int, fields map[string]interface{}) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updated[id] = fields
	return nil
}
func (f *fakeSchedRepo) Delete(id int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, id)
	return nil
}

// fakeGSM은 service의 gsmRepo(비공개 인터페이스)를 구조적으로 만족한다.
type fakeGSM struct {
	mu       sync.Mutex
	rows     map[int]*model.Schedule
	inserted []map[string]interface{}
	updated  []map[string]interface{}
	deleted  []string
}

func (f *fakeGSM) GetGroupMembers(int) []repository.GSMMemberRow { return nil }
func (f *fakeGSM) TestSchedule(int) (*model.Schedule, error)     { return nil, nil }
func (f *fakeGSM) UserLocation(int) *repository.GSMUserLocRow    { return nil }
func (f *fakeGSM) OwnerGroups(int) ([]repository.GSMOwnerGroupRow, error) {
	return nil, nil
}
func (f *fakeGSM) OwnerSchedules([]int, *float64, *float64, string, string) ([]repository.GSMOwnerScheduleRow, error) {
	return nil, nil
}
func (f *fakeGSM) GroupSchedules(int, *string, *string, *int) ([]repository.GSMGroupScheduleRow, error) {
	return nil, nil
}
func (f *fakeGSM) BeginTx() (*sql.Tx, error) { return nil, fmt.Errorf("no tx in fake") }
func (f *fakeGSM) InsertSchedule(p map[string]interface{}) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.inserted = append(f.inserted, p)
	return int64(900 + len(f.inserted)), nil
}
func (f *fakeGSM) InsertScheduleFullTx(repository.SQLExecer, map[string]interface{}) (int64, error) {
	return 0, fmt.Errorf("no tx")
}
func (f *fakeGSM) InsertRecurring(map[string]interface{}) error { return nil }
func (f *fakeGSM) InsertRecurringTx(repository.SQLExecer, map[string]interface{}) error {
	return nil
}
func (f *fakeGSM) GetScheduleShownInGroup(id, g int) (*model.Schedule, error) {
	if r, ok := f.rows[id]; ok && *r.SgtIdx == g {
		c := *r
		return &c, nil
	}
	return nil, nil
}
func (f *fakeGSM) SoftDeleteFamilyTx(repository.SQLExecer, int, int) error { return nil }
func (f *fakeGSM) SoftDeleteSingleDdate(id, g int) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, fmt.Sprintf("single:%d:g%d", id, g))
	return 1, nil
}
func (f *fakeGSM) SoftDeleteAllDdate(id, g int) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, fmt.Sprintf("all:%d:g%d", id, g))
	return 1, nil
}
func (f *fakeGSM) SoftDeleteFutureDdate(id, g int, _ string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, fmt.Sprintf("future:%d:g%d", id, g))
	return 1, nil
}
func (f *fakeGSM) SelectFamilyTargets(int, int, *string) ([]repository.GSMTargetRow, error) {
	return nil, nil
}
func (f *fakeGSM) UpdateScheduleDynamic(id, g int, cols []string, vals []interface{}) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	m := map[string]interface{}{"_id": id, "_g": g}
	for i, c := range cols {
		m[c] = vals[i]
	}
	f.updated = append(f.updated, m)
	return nil
}
func (f *fakeGSM) DebugSchedule(int) (*model.Schedule, error) { return nil, nil }
func (f *fakeGSM) DebugRelated(int, int) ([]repository.GSMRelatedRow, error) {
	return nil, nil
}

type gsmMembers struct{}

func (gsmMembers) GetByID(id int) (*model.Member, error) { return fakeMemberRow(id), nil }

type gsmFCM struct{}

func (gsmFCM) Send(context.Context, fcm.Message) (string, error) { return "", fcm.ErrUnavailable }

type gsmLogs struct{}

func (gsmLogs) Create(*model.PushLog) error { return nil }

type schedEnv struct {
	router http.Handler
	sr     *fakeSchedRepo
	gr     *fakeGSM
	t      *testing.T
}

func newSchedEnv(t *testing.T, mode auth.RouteMode, nonLeaderOthers, leaderOwner bool) *schedEnv {
	t.Helper()
	cfg := testCfg()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	routeRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: mode, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute,
	}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	// 일정 라우트는 ROUTE_AUTH_MODE와 무관하게 enforce(main.go와 동일).
	schedRA, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: auth.RouteModeEnforce, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute, Scope: "schedule",
	}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	az := service.NewScheduleAuthz(worldRoles{world()}, leaderOwner, nonLeaderOthers)
	sr := newFakeSchedRepo()
	svc := service.NewSchedule(sr)
	svc.SetAuthz(az)
	gr := &fakeGSM{rows: sr.rows}
	gsvc := service.NewGroupScheduleManage(gr, gsmMembers{}, gsmLogs{}, gsmFCM{})
	gsvc.SetAuthz(az)
	r := New(cfg, logger, Deps{
		AdminAuth:     stubAdmin,
		UserAuth:      routeRA.Required(),
		UserAuthOpt:   routeRA.Optional(),
		ScheduleAuth:  schedRA.Required(),
		Schedule:      handler.NewSchedule(svc),
		GroupSchedule: handler.NewGroupScheduleManage(gsvc),
	})
	return &schedEnv{router: r, sr: sr, gr: gr, t: t}
}

func (e *schedEnv) do(method, path string, uid int, body string) *httptest.ResponseRecorder {
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

const gsmCreateBody = `{"sst_title":"t","sst_sdate":"2026-11-20 10:00:00","sst_edate":"2026-11-20 11:00:00"}`

func gsmBodyWith(extra string) string {
	return `{"sst_title":"t","sst_sdate":"2026-11-20 10:00:00","sst_edate":"2026-11-20 11:00:00",` + extra + `}`
}

// 모든 모드에서 같아야 한다(일정 라우트는 모드 무관 enforce).
var schedModes = []auth.RouteMode{auth.RouteModeOff, auth.RouteModeWarn, auth.RouteModeEnforce}

func TestScheduleNoTokenIs401InEveryMode(t *testing.T) {
	for _, m := range schedModes {
		e := newSchedEnv(t, m, true, false)
		for _, rt := range []struct{ method, path, body string }{
			{"GET", "/schedules/", ""},
			{"GET", "/schedules/701", ""},
			{"GET", "/schedules/group/10", ""},
			{"GET", "/schedules/member/3", ""},
			{"POST", "/schedules/", `{"sgt_idx":10,"mt_idx":3,"sst_title":"t"}`},
			{"PUT", "/schedules/701", `{"sst_title":"x"}`},
			{"DELETE", "/schedules/701", ""},
			{"GET", "/schedule/group/10/schedules", ""},
			{"GET", "/schedule/owner-groups/all-schedules?current_user_id=1", ""},
			{"POST", "/schedule/group/10/schedules", gsmCreateBody},
			{"PUT", "/schedule/group/10/schedules/701?current_user_id=3", `{"sst_title":"x"}`},
			{"DELETE", "/schedule/group/10/schedules/701?current_user_id=3", ""},
		} {
			if w := e.do(rt.method, rt.path, 0, rt.body); w.Code != 401 {
				t.Errorf("[%v] %s %s 무토큰: 401 기대, got %d", m, rt.method, rt.path, w.Code)
			}
		}
	}
}

// 관리자 전용 라우트(디버그·전체 컬럼·now/*)는 일반 회원 토큰으로 열리지 않는다.
func TestScheduleDebugRoutesAdminOnly(t *testing.T) {
	e := newSchedEnv(t, auth.RouteModeWarn, true, false)
	for _, p := range []string{"/schedule/test-all-columns", "/schedule/debug/schedule/701", "/schedules/now/push"} {
		if w := e.do("GET", p, gMember, ""); w.Code == 200 {
			t.Errorf("%s: 일반 회원 토큰으로 열림", p)
		}
	}
}

func TestGSMCreateRoleMatrix(t *testing.T) {
	type tc struct {
		name  string
		actor int
		body  string
		want  int
	}
	cases := []tc{
		{"방장 본인", gOwner, gsmCreateBody, 200},
		{"리더 본인", gLeader, gsmCreateBody, 200},
		{"일반 본인", gMember, gsmCreateBody, 200},
		{"iOS: 일반이 targetMemberId=본인(B-1)", gMember, gsmBodyWith(`"targetMemberId":3`), 200},
		{"iOS: targetMemberId=0", gMember, gsmBodyWith(`"targetMemberId":0`), 200},
		{"나간 멤버", gExited, gsmCreateBody, 403},
		{"강퇴 멤버", gKicked, gsmCreateBody, 403},
		{"숨김 멤버", gHidden, gsmCreateBody, 403},
		{"다른 그룹 회원", gOther, gsmCreateBody, 403},
		{"무소속", gNone, gsmCreateBody, 403},
		{"방장이 일반 멤버 대상", gOwner, gsmBodyWith(`"targetMemberId":3`), 200},
		{"리더가 일반 멤버 대상", gLeader, gsmBodyWith(`"targetMemberId":3`), 200},
		{"리더가 방장 대상(원안: 거부)", gLeader, gsmBodyWith(`"targetMemberId":1`), 403},
		{"방장이 나간 멤버 대상", gOwner, gsmBodyWith(`"targetMemberId":4`), 403},
		{"방장이 다른 그룹 회원 대상(S-2)", gOwner, gsmBodyWith(`"targetMemberId":6`), 403},
		{"방장이 무소속 대상", gOwner, gsmBodyWith(`"targetMemberId":8`), 403},
	}
	for _, m := range schedModes {
		for _, c := range cases {
			e := newSchedEnv(t, m, false, false)
			w := e.do("POST", "/schedule/group/10/schedules", c.actor, c.body)
			if w.Code != c.want {
				t.Errorf("[%v] %s: %d 기대, got %d %s", m, c.name, c.want, w.Code, w.Body.String())
			}
		}
	}
}

// 구버전 Android는 대상 기본값이 그룹장이라 일반 멤버가 타인 대상으로 보낸다. 호환 플래그가 켜져 있으면 허용하되
// 그룹과 무관한 대상은 여전히 거부한다.
func TestGSMCreateLegacyNonLeaderTarget(t *testing.T) {
	on := newSchedEnv(t, auth.RouteModeWarn, true, false)
	if w := on.do("POST", "/schedule/group/10/schedules", gMember, gsmBodyWith(`"targetMemberId":1`)); w.Code != 200 {
		t.Errorf("플래그 on: 일반 멤버의 그룹장 대상 200 기대, got %d", w.Code)
	}
	for _, bad := range []int{4, 5, 6, 8} {
		if w := on.do("POST", "/schedule/group/10/schedules", gMember, gsmBodyWith(fmt.Sprintf(`"targetMemberId":%d`, bad))); w.Code != 403 {
			t.Errorf("플래그 on: 무관한 대상 %d는 403 기대, got %d", bad, w.Code)
		}
	}
	off := newSchedEnv(t, auth.RouteModeWarn, false, false)
	if w := off.do("POST", "/schedule/group/10/schedules", gMember, gsmBodyWith(`"targetMemberId":1`)); w.Code != 403 {
		t.Errorf("플래그 off: 403 기대, got %d", w.Code)
	}
}

func TestGSMCreateLeaderManageOwnerFlag(t *testing.T) {
	e := newSchedEnv(t, auth.RouteModeWarn, false, true)
	if w := e.do("POST", "/schedule/group/10/schedules", gLeader, gsmBodyWith(`"targetMemberId":1`)); w.Code != 200 {
		t.Errorf("SCHEDULE_LEADER_MANAGE_OWNER=true: 200 기대, got %d", w.Code)
	}
}

// 토큰의 회원이 신원이다: current_user_id 쿼리는 무시된다(방장 번호를 넣어도 일반 멤버 권한).
func TestGSMIgnoresCurrentUserIDQuery(t *testing.T) {
	e := newSchedEnv(t, auth.RouteModeWarn, false, false)
	if w := e.do("DELETE", "/schedule/group/10/schedules/702?current_user_id=1", gMember, ""); w.Code != 403 {
		t.Errorf("current_user_id=방장 위장: 403 기대, got %d", w.Code)
	}
	if len(e.gr.deleted) != 0 {
		t.Errorf("삭제가 실행됨: %v", e.gr.deleted)
	}
}

func TestGSMUpdateDeleteMatrix(t *testing.T) {
	type tc struct {
		name   string
		actor  int
		sid    int
		gid    int
		method string
		want   int
	}
	cases := []tc{
		{"작성자 본인 삭제", gMember, 701, 10, "DELETE", 200},
		{"일반이 남의 일정 삭제(S-2)", gMember, 702, 10, "DELETE", 403},
		{"방장이 남의 일정 삭제", gOwner, 701, 10, "DELETE", 200},
		{"리더가 일반 일정 삭제", gLeader, 701, 10, "DELETE", 200},
		{"리더가 방장 일정 삭제(원안: 거부)", gLeader, 702, 10, "DELETE", 403},
		{"나간 멤버 삭제", gExited, 701, 10, "DELETE", 403},
		{"강퇴 멤버 삭제", gKicked, 701, 10, "DELETE", 403},
		{"다른 그룹 방장이 경로 그룹만 바꿔 삭제(S-1)", gOther, 701, 20, "DELETE", 404},
		{"방장이 다른 그룹 일정 번호로 삭제(S-1)", gOwner, 703, 10, "DELETE", 404},
		{"작성자 본인 수정", gMember, 701, 10, "PUT", 200},
		{"일반이 남의 일정 수정", gMember, 702, 10, "PUT", 403},
		{"리더가 방장 일정 수정", gLeader, 702, 10, "PUT", 403},
		{"방장이 일반 일정 수정", gOwner, 701, 10, "PUT", 200},
		{"방장이 다른 그룹 일정 번호로 수정(S-1)", gOwner, 703, 10, "PUT", 404},
		{"나간 멤버 수정", gExited, 701, 10, "PUT", 403},
	}
	for _, m := range schedModes {
		for _, c := range cases {
			e := newSchedEnv(t, m, false, false)
			path := fmt.Sprintf("/schedule/group/%d/schedules/%d", c.gid, c.sid)
			body := ""
			if c.method == "PUT" {
				body = `{"sst_title":"new","sst_sdate":"2026-11-20 10:00:00","sst_edate":"2026-11-20 11:00:00"}`
			}
			if w := e.do(c.method, path, c.actor, body); w.Code != c.want {
				t.Errorf("[%v] %s: %d 기대, got %d %s", m, c.name, c.want, w.Code, w.Body.String())
			}
		}
	}
}

// S-1: 본문의 sst_pidx와 소유자·그룹 필드는 UPDATE에 쓰이지 않는다. 쓰기는 항상 경로 그룹 조건과 함께 나간다.
func TestGSMUpdateDropsInjectedFields(t *testing.T) {
	e := newSchedEnv(t, auth.RouteModeWarn, false, false)
	w := e.do("PUT", "/schedule/group/10/schedules/701", gOwner, `{"sst_title":"n","sst_sdate":"2026-11-20 10:00:00","sst_edate":"2026-11-20 11:00:00","sst_pidx":703,"sgt_idx":20}`)
	if w.Code != 200 {
		t.Fatalf("수정 200 기대, got %d %s", w.Code, w.Body.String())
	}
	if len(e.gr.updated) != 1 {
		t.Fatalf("UPDATE 1회 기대: %v", e.gr.updated)
	}
	u := e.gr.updated[0]
	if u["_g"] != 10 {
		t.Errorf("그룹 조건이 경로 그룹이어야 함: %v", u["_g"])
	}
	if _, ok := u["sst_pidx"]; ok {
		t.Error("sst_pidx가 UPDATE에 포함됨")
	}
}

// 일반 멤버가 타인(방장)을 대상으로 일정 소유자를 바꿔 치려는 수정은 거부된다.
func TestGSMUpdateTargetChange(t *testing.T) {
	e := newSchedEnv(t, auth.RouteModeWarn, false, false)
	if w := e.do("PUT", "/schedule/group/10/schedules/701", gMember, `{"targetMemberId":1}`); w.Code != 403 {
		t.Errorf("일반 멤버의 소유자 변경: 403 기대, got %d", w.Code)
	}
	if w := e.do("PUT", "/schedule/group/10/schedules/701", gOwner, `{"targetMemberId":6}`); w.Code != 403 {
		t.Errorf("방장이 다른 그룹 회원으로 변경: 403 기대, got %d", w.Code)
	}
}

func TestSchedulesLegacyRoutes(t *testing.T) {
	for _, m := range schedModes {
		// 그룹 조회: 현재 멤버만
		for actor, want := range map[int]int{gOwner: 200, gLeader: 200, gMember: 200, gExited: 403, gKicked: 403, gOther: 403, gNone: 403} {
			e := newSchedEnv(t, m, false, false)
			if w := e.do("GET", "/schedules/group/10", actor, ""); w.Code != want {
				t.Errorf("[%v] GET /schedules/group/10 actor=%d: %d 기대, got %d", m, actor, want, w.Code)
			}
		}
		e := newSchedEnv(t, m, false, false)
		// 단건 조회: 해당 그룹의 현재 멤버만
		if w := e.do("GET", "/schedules/702", gMember, ""); w.Code != 200 {
			t.Errorf("[%v] 같은 그룹 멤버 단건 200 기대, got %d", m, w.Code)
		}
		if w := e.do("GET", "/schedules/703", gMember, ""); w.Code != 403 {
			t.Errorf("[%v] 다른 그룹 일정 단건 403 기대, got %d", m, w.Code)
		}
		// 삭제(S-2): 일반 멤버는 남의 일정 불가, 본인 일정은 가능
		if w := e.do("DELETE", "/schedules/702", gMember, ""); w.Code != 403 {
			t.Errorf("[%v] S-2 남의 일정 삭제 403 기대, got %d", m, w.Code)
		}
		if w := e.do("DELETE", "/schedules/701", gMember, ""); w.Code != 200 {
			t.Errorf("[%v] 본인 일정 삭제 200 기대, got %d", m, w.Code)
		}
		if w := e.do("PUT", "/schedules/702", gMember, `{"sst_title":"x"}`); w.Code != 403 {
			t.Errorf("[%v] 남의 일정 수정 403 기대, got %d", m, w.Code)
		}
		// 목록은 토큰이 있으면 200(요청자 관련 일정만 — 쿼리 조건은 repository DryRun 테스트에서 확인)
		if w := e.do("GET", "/schedules/", gMember, ""); w.Code != 200 {
			t.Errorf("[%v] 목록 200 기대, got %d", m, w.Code)
		}
		// 타인 일정 조회(member/:id)는 본인만
		if w := e.do("GET", "/schedules/member/3", gMember, ""); w.Code != 200 {
			t.Errorf("[%v] 본인 member 조회 200 기대, got %d", m, w.Code)
		}
		if w := e.do("GET", "/schedules/member/1", gMember, ""); w.Code != 403 {
			t.Errorf("[%v] 타인 member 조회 403 기대, got %d", m, w.Code)
		}
	}
}

// 안드로이드 앱의 POST /schedules 본문(mt_idx=본인, sgt_idx)과 타인 대상·무관 그룹 대상.
func TestSchedulesCreateAndroidShape(t *testing.T) {
	for _, m := range schedModes {
		mk := func(mt, sgt int) string {
			return fmt.Sprintf(`{"sgt_idx":%d,"mt_idx":%d,"sst_title":"t","sst_sdate":"2026-11-20 10:00:00","sst_edate":"2026-11-20 11:00:00","sst_pidx":703}`, sgt, mt)
		}
		for _, c := range []struct {
			name         string
			actor, mt, g int
			want         int
		}{
			{"일반 멤버 본인", gMember, 3, 10, 200},
			{"방장이 일반 멤버 대상", gOwner, 3, 10, 200},
			{"일반 멤버가 타인 대상(원안)", gMember, 1, 10, 403},
			{"나간 멤버", gExited, 4, 10, 403},
			{"다른 그룹 회원이 그룹 10 일정", gOther, 6, 10, 403},
			{"방장이 다른 그룹 회원 대상", gOwner, 6, 10, 403},
		} {
			e := newSchedEnv(t, m, false, false)
			w := e.do("POST", "/schedules/", c.actor, mk(c.mt, c.g))
			if w.Code != c.want {
				t.Errorf("[%v] %s: %d 기대, got %d %s", m, c.name, c.want, w.Code, w.Body.String())
			}
			if c.want == 200 && len(e.sr.created) == 1 && e.sr.created[0].SstPidx != nil {
				t.Errorf("[%v] %s: 클라이언트 sst_pidx가 저장됨", m, c.name)
			}
		}
	}
}
