package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// G7 그룹·푸시·주문 권한 테스트. 실제 라우터 + 실제 미들웨어/가드/서비스를 쓰고 저장소만 메모리 fake로 대체한다.
// 세계관은 location_authz_test.go와 같다(그룹 10: 1 방장, 2 리더, 3 일반, 4 나간, 5 강퇴, 6 다른 그룹(20), 7 숨김, 8 아무 데도 없음).
// 가입 대상 회원 9는 아직 아무 그룹에도 없다. 관리자는 99(이 파일의 adminStub).

const (
	gJoiner  = 9
	gAdminID = 99
	otherGrp = 20
)

func adminStub(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), testSecret, "HS256")
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	if uid != gAdminID {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "관리자 권한이 필요합니다."})
		return
	}
	c.Set("user_id", uid)
	c.Next()
}

// --- 그룹 저장소 fake (groupRepo + groupWriteRepo + groupMemberWriteRepo) ---

type fakeGroupStore struct {
	mu     sync.Mutex
	groups map[int]*model.Group
	rows   []*model.GroupDetail
	nextGD int
	nextG  int
	// 기록
	kicked, left, rejoined []string
	transferred            []string
	created                []*model.Group
	chat                   recChat
}

func sPtr(v string) *string { return &v }

func newFakeGroupStore() *fakeGroupStore {
	f := &fakeGroupStore{groups: map[int]*model.Group{}, nextGD: 1000, nextG: 50}
	mk := func(id int, owner int, code string, show string) {
		o := owner
		f.groups[id] = &model.Group{SgtIdx: id, MtIdx: &o, SgtTitle: sPtr("g"), SgtCode: sPtr(code), SgtShow: sPtr(show)}
	}
	mk(groupID, gOwner, "ABCDEFGH23", "Y")
	mk(otherGrp, gOther, "ZZZZZZZZ22", "Y")
	for _, r := range world().rows {
		f.addRow(r)
	}
	return f
}

func (f *fakeGroupStore) addRow(r gdRow) {
	sg, mt := r.sgt, r.mt
	e, d, s, o, l := r.exit, r.discharge, r.show, r.owner, r.leader
	f.rows = append(f.rows, &model.GroupDetail{SgdtIdx: r.sgdt, SgtIdx: &sg, MtIdx: &mt,
		SgdtExit: &e, SgdtDischarge: &d, SgdtShow: &s, SgdtOwnerChk: &o, SgdtLeaderChk: &l})
}

func (f *fakeGroupStore) row(sgt, mt int) *model.GroupDetail {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt {
			return r
		}
	}
	return nil
}

func isCur(r *model.GroupDetail) bool {
	return repository.IsCurrentMembershipRow(r.SgdtExit, r.SgdtDischarge, r.SgdtShow)
}

func (f *fakeGroupStore) GetByID(id int) (*model.Group, error) {
	if g, ok := f.groups[id]; ok {
		c := *g
		return &c, nil
	}
	return nil, nil
}
func (f *fakeGroupStore) FindByCode(code string) (*model.Group, error) {
	for _, g := range f.groups {
		if g.SgtCode != nil && *g.SgtCode == code && *g.SgtShow == "Y" {
			c := *g
			return &c, nil
		}
	}
	return nil, nil
}
func (f *fakeGroupStore) List(skip, limit int, showHidden bool) ([]model.Group, error) {
	out := []model.Group{}
	for _, g := range f.groups {
		out = append(out, *g)
	}
	return out, nil
}
func (f *fakeGroupStore) ListForMember(mt, skip, limit int, showHidden bool) ([]model.Group, error) {
	out := []model.Group{}
	for id, g := range f.groups {
		if r := f.row(id, mt); r != nil && isCur(r) {
			out = append(out, *g)
		}
	}
	return out, nil
}
func (f *fakeGroupStore) ListHidden() ([]model.Group, error)                { return nil, nil }
func (f *fakeGroupStore) FindByMember(int) ([]model.Group, error)           { return nil, nil }
func (f *fakeGroupStore) CurrentUserGroupCount(int) (int64, error)          { return 0, nil }
func (f *fakeGroupStore) CurrentUserDistinctMemberCount(int) (int64, error) { return 0, nil }
func (f *fakeGroupStore) CurrentUserGroups(int) ([]repository.CurrentUserGroupRow, error) {
	return nil, nil
}
func (f *fakeGroupStore) StatsGroupMembers(int) ([]model.GroupDetail, error) { return nil, nil }
func (f *fakeGroupStore) StatsMember(int) (*model.Member, error)             { return nil, nil }
func (f *fakeGroupStore) StatsWeeklySchedules(int, time.Time, time.Time) (int64, error) {
	return 0, nil
}
func (f *fakeGroupStore) StatsTotalLocations(int) (int64, error) { return 0, nil }
func (f *fakeGroupStore) StatsWeeklyLocations(int, time.Time, time.Time) (int64, error) {
	return 0, nil
}

func (f *fakeGroupStore) MemberExists(int) (bool, error) { return true, nil }
func (f *fakeGroupStore) CodeExists(code string) (bool, error) {
	for _, g := range f.groups {
		if g.SgtCode != nil && *g.SgtCode == code {
			return true, nil
		}
	}
	return false, nil
}
func (f *fakeGroupStore) CreateGroup(g *model.Group) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextG++
	g.SgtIdx = f.nextG
	c := *g
	f.groups[g.SgtIdx] = &c
	f.created = append(f.created, &c)
	return nil
}
func (f *fakeGroupStore) CreateGroupDetail(gd *model.GroupDetail) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextGD++
	gd.SgdtIdx = f.nextGD
	c := *gd
	f.rows = append(f.rows, &c)
	return nil
}
func (f *fakeGroupStore) ReactivateMembership(gd *model.GroupDetail, now time.Time) error {
	for _, r := range f.rows {
		if r.SgdtIdx == gd.SgdtIdx {
			r.SgdtShow, r.SgdtExit = sPtr("Y"), sPtr("N")
		}
	}
	return nil
}
func (f *fakeGroupStore) SaveGroup(g *model.Group) error {
	c := *g
	f.groups[g.SgtIdx] = &c
	return nil
}
func (f *fakeGroupStore) FindMembershipAny(sgt, mt int) (*model.GroupDetail, error) {
	return f.row(sgt, mt), nil
}
func (f *fakeGroupStore) ReactivateMembershipNewMember(*model.GroupDetail, time.Time) error {
	return nil
}
func (f *fakeGroupStore) FindVisibleMembership(sgt, mt int) (*model.GroupDetail, error) {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt && *r.SgdtShow == "Y" {
			c := *r
			return &c, nil
		}
	}
	return nil, nil
}
func (f *fakeGroupStore) RemoveMembership(*model.GroupDetail, time.Time) error { return nil }
func (f *fakeGroupStore) FindMembershipRows(sgt, mt int) ([]model.GroupDetail, error) {
	out := []model.GroupDetail{}
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt {
			out = append(out, *r)
		}
	}
	return out, nil
}
func (f *fakeGroupStore) RejoinMembership(gd *model.GroupDetail, now time.Time) error {
	for _, r := range f.rows {
		if r.SgdtIdx == gd.SgdtIdx {
			r.SgdtShow, r.SgdtExit, r.SgdtDischarge = sPtr("Y"), sPtr("N"), sPtr("N")
			r.SgdtOwnerChk, r.SgdtLeaderChk = sPtr("N"), sPtr("N")
			f.rejoined = append(f.rejoined, fmt.Sprint(*r.SgtIdx, ":", *r.MtIdx))
		}
	}
	return nil
}
func (f *fakeGroupStore) KickMembership(sgt, mt int, now time.Time) error {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt {
			r.SgdtShow, r.SgdtExit, r.SgdtDischarge = sPtr("N"), sPtr("Y"), sPtr("Y")
		}
	}
	f.kicked = append(f.kicked, fmt.Sprint(sgt, ":", mt))
	return nil
}
func (f *fakeGroupStore) LeaveMembership(sgt, mt int, now time.Time) error {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt {
			r.SgdtShow, r.SgdtExit = sPtr("N"), sPtr("Y")
		}
	}
	f.left = append(f.left, fmt.Sprint(sgt, ":", mt))
	return nil
}
func (f *fakeGroupStore) FindCurrentMembership(sgt, mt int) (*model.GroupDetail, error) {
	if r := f.row(sgt, mt); r != nil && isCur(r) {
		c := *r
		return &c, nil
	}
	return nil, nil
}
func (f *fakeGroupStore) TransferOwnership(g *model.Group, newOwner int, now time.Time) error {
	f.transferred = append(f.transferred, fmt.Sprint(g.SgtIdx, ">", newOwner))
	for _, r := range f.rows {
		if *r.SgtIdx == g.SgtIdx {
			r.SgdtOwnerChk = sPtr("N")
			if *r.MtIdx == newOwner {
				r.SgdtOwnerChk = sPtr("Y")
			}
		}
	}
	return nil
}

// group-members write repo
func (f *fakeGroupStore) FindGD(sgt, mt int, show string) (*model.GroupDetail, error) {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt && *r.SgdtShow == show {
			c := *r
			return &c, nil
		}
	}
	return nil, nil
}
func (f *fakeGroupStore) FindGDActive(sgt, mt int) (*model.GroupDetail, error) {
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt && *r.SgdtShow == "Y" && *r.SgdtExit == "N" {
			c := *r
			return &c, nil
		}
	}
	return nil, nil
}
func (f *fakeGroupStore) CreateGD(gd *model.GroupDetail) error { return nil }
func (f *fakeGroupStore) UpdateGD(id int, fields map[string]interface{}) error {
	for _, r := range f.rows {
		if r.SgdtIdx != id {
			continue
		}
		for k, v := range fields {
			val := fmt.Sprint(v)
			switch k {
			case "sgdt_show":
				r.SgdtShow = &val
			case "sgdt_exit":
				r.SgdtExit = &val
			case "sgdt_discharge":
				r.SgdtDischarge = &val
			case "sgdt_leader_chk":
				r.SgdtLeaderChk = &val
			}
		}
		if _, k := fields["sgdt_discharge"]; k {
			f.kicked = append(f.kicked, fmt.Sprint(*r.SgtIdx, ":", *r.MtIdx))
		} else if fields["sgdt_exit"] == "Y" {
			f.left = append(f.left, fmt.Sprint(*r.SgtIdx, ":", *r.MtIdx))
		}
	}
	return nil
}

// recChat는 그룹 채팅 동기화 호출을 기록한다(탈퇴·강퇴·삭제·재가입 연결 확인).
type recChat struct {
	mu          sync.Mutex
	deactMember []string // "sgt:mt"
	deactGroup  []int
	added       []string
}

func (c *recChat) CreateGroupChatRoom(int, *string, []int, time.Time) error { return nil }
func (c *recChat) AddMemberToGroupChat(sgt, mt int, _ time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.added = append(c.added, fmt.Sprint(sgt, ":", mt))
	return nil
}
func (c *recChat) DeactivateChatMembership(_ context.Context, sgt, mt int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.deactMember = append(c.deactMember, fmt.Sprint(sgt, ":", mt))
	return nil
}
func (c *recChat) DeactivateGroupChat(_ context.Context, sgt int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.deactGroup = append(c.deactGroup, sgt)
	return nil
}

// ownerEval은 repository.groupOwnerSQL + currentMemberSQL의 Go 평가기(fake용)다. 그룹장 = 현재 멤버이면서
// (owner_chk='Y' 또는 그룹 생성자이고 다른 현재 멤버 중 owner_chk='Y'가 없음).
func (f *fakeGroupStore) ownerEval(sgt, mt int) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	var me *model.GroupDetail
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt && isCur(r) {
			me = r
			break
		}
	}
	if me == nil {
		return false
	}
	if me.SgdtOwnerChk != nil && *me.SgdtOwnerChk == "Y" {
		return true
	}
	g := f.groups[sgt]
	if g == nil || g.MtIdx == nil || *g.MtIdx != mt {
		return false
	}
	for _, r := range f.rows {
		if *r.SgtIdx == sgt && isCur(r) && r.SgdtOwnerChk != nil && *r.SgdtOwnerChk == "Y" {
			return false
		}
	}
	return true
}

func (f *fakeGroupStore) IsGroupOwner(sgt, mt int) (bool, error) { return f.ownerEval(sgt, mt), nil }

// 그룹 인가 판정 fake: 멤버십은 world()와 같은 표, 그룹장은 현재 멤버이면서 owner 표식.
type groupAuthzFake struct{ f *fakeGroupStore }

func (g groupAuthzFake) IsCurrentGroupMember(_ context.Context, mt, sgt int) (bool, error) {
	for _, r := range g.f.rows {
		if *r.SgtIdx == sgt && *r.MtIdx == mt && isCur(r) {
			return true, nil
		}
	}
	return false, nil
}
func (g groupAuthzFake) IsGroupOwner(_ context.Context, mt, sgt int) (bool, error) {
	return g.f.ownerEval(sgt, mt), nil
}

// securityStore fake (초대 코드 한도)
type fakeCounter struct {
	mu   sync.Mutex
	n    map[string]int64
	fail bool
}

func (f *fakeCounter) IncrWithExpire(_ context.Context, k string, _ time.Duration) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail {
		return 0, cache.ErrDisabled
	}
	f.n[k]++
	return f.n[k], nil
}
func (f *fakeCounter) TTL(context.Context, string) (time.Duration, error) {
	return 30 * time.Second, nil
}
func (f *fakeCounter) SetEX(context.Context, string, string, time.Duration) error { return nil }
func (f *fakeCounter) GetString(context.Context, string) (string, bool, error)    { return "", false, nil }
func (f *fakeCounter) DelKeys(context.Context, ...string) (int64, error)          { return 0, nil }

// push fake
type fakePushLogs struct {
	mu      sync.Mutex
	logs    map[int]*model.PushLog
	deleted []int
	read    []int
	delAll  []int
	readAll []int
}

func (f *fakePushLogs) List(int, int) ([]model.PushLog, error) { return nil, nil }
func (f *fakePushLogs) GetByID(id int) (*model.PushLog, error) {
	if l, ok := f.logs[id]; ok {
		c := *l
		return &c, nil
	}
	return nil, nil
}
func (f *fakePushLogs) FindByMember(mt int) ([]model.PushLog, error) {
	out := []model.PushLog{}
	for _, l := range f.logs {
		if *l.MtIdx == mt {
			out = append(out, *l)
		}
	}
	return out, nil
}
func (f *fakePushLogs) FindBySchedule(int) ([]model.PushLog, error) {
	out := []model.PushLog{}
	for _, l := range f.logs {
		out = append(out, *l)
	}
	return out, nil
}
func (f *fakePushLogs) FindUnread(int) ([]model.PushLog, error)        { return nil, nil }
func (f *fakePushLogs) Create(*model.PushLog) error                    { return nil }
func (f *fakePushLogs) UpdateFields(int, map[string]interface{}) error { return nil }
func (f *fakePushLogs) Delete(id int) error {
	f.deleted = append(f.deleted, id)
	return nil
}
func (f *fakePushLogs) MarkReadByID(id int, _ time.Time) error {
	f.read = append(f.read, id)
	return nil
}
func (f *fakePushLogs) SoftDeleteAllForMember(mt int, _ time.Time) error {
	f.delAll = append(f.delAll, mt)
	return nil
}
func (f *fakePushLogs) MarkReadAllForMember(mt int, _ time.Time) error {
	f.readAll = append(f.readAll, mt)
	return nil
}

type fakePushFCMs struct {
	msgs    map[int]*model.PushFCM
	deleted []int
}

func (f *fakePushFCMs) List(int, int) ([]model.PushFCM, error) { return nil, nil }
func (f *fakePushFCMs) GetByID(id int) (*model.PushFCM, error) {
	if m, ok := f.msgs[id]; ok {
		c := *m
		return &c, nil
	}
	return nil, nil
}
func (f *fakePushFCMs) FindByMember(int) ([]model.PushFCM, error) { return nil, nil }
func (f *fakePushFCMs) FindByCode(string) ([]model.PushFCM, error) {
	out := []model.PushFCM{}
	for _, m := range f.msgs {
		out = append(out, *m)
	}
	return out, nil
}
func (f *fakePushFCMs) FindPending(int, *float64) ([]model.PushFCM, error) { return nil, nil }
func (f *fakePushFCMs) Create(*model.PushFCM) error                        { return nil }
func (f *fakePushFCMs) UpdateFields(int, map[string]interface{}) error     { return nil }
func (f *fakePushFCMs) Delete(id int) error {
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeOrders struct{ cancelled []int }

func (fakeOrders) GetByID(id int) (*model.Order, error) {
	st := 1
	mt := gMember
	return &model.Order{OtIdx: id, MtIdx: &mt, OtStatus: &st}, nil
}
func (fakeOrders) GetByCode(string) (*model.Order, error) { return nil, nil }
func (fakeOrders) FindByMember(int, *int, string, int, int) ([]model.Order, int64, error) {
	return nil, 0, nil
}
func (fakeOrders) FindRecentByMember(int, int) ([]model.Order, error)       { return nil, nil }
func (fakeOrders) Summary(int, string) (*repository.OrderSummaryRow, error) { return nil, nil }
func (f *fakeOrders) UpdateFields(id int, _ map[string]interface{}) error {
	f.cancelled = append(f.cancelled, id)
	return nil
}

type fakeFCMMembers struct{}

func (fakeFCMMembers) GetByID(id int) (*model.Member, error) {
	lvl := 2
	return &model.Member{MtIdx: id, MtLevel: &lvl}, nil
}
func (fakeFCMMembers) UpdateColumns(int, map[string]interface{}) error    { return nil }
func (fakeFCMMembers) CountExpiredTokens(time.Time) (int64, int64, error) { return 0, 0, nil }
func (fakeFCMMembers) CountMembersWithToken() (int64, error)              { return 0, nil }

type grpEnv struct {
	router  http.Handler
	store   *fakeGroupStore
	logs    *fakePushLogs
	fcms    *fakePushFCMs
	orders  *fakeOrders
	counter *fakeCounter
	cfg     interface{}
	t       *testing.T
	cancel  context.CancelFunc
}

type grpOpts struct {
	route       auth.RouteMode
	requireCode bool
	limitMember int
	limitIP     int
}

func newGrpEnv(t *testing.T, o grpOpts) *grpEnv {
	t.Helper()
	cfg := testCfg()
	cfg.RequireGroupInviteCode = o.requireCode
	buf := &lockedBuf{}
	logger := slog.New(slog.NewJSONHandler(buf, nil))
	ra, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Mode: o.route, Secret: testSecret, Algorithm: "HS256", SummaryInterval: time.Minute,
	}, allNormal{}, logger)
	if err != nil {
		t.Fatal(err)
	}
	store := newFakeGroupStore()
	counter := &fakeCounter{n: map[string]int64{}}
	if o.limitMember == 0 {
		o.limitMember = 1000
	}
	if o.limitIP == 0 {
		o.limitIP = 1000
	}
	gg := handler.NewGroupGuard(service.NewGroupAuthz(groupAuthzFake{store}), ra)
	sg := handler.NewSelfGuard(ra)

	groupH := handler.NewGroup(service.NewGroup(store), service.NewGroupWrite(store, &store.chat), cfg)
	groupH.SetGuard(gg)
	groupH.SetCodeGuard(service.NewGroupCodeGuard(counter, o.limitMember, o.limitIP, time.Hour, logger))
	gmSvc := service.NewGroupMember(g7GMRepo{})
	gmSvc.SetWriteRepo(store)
	gmSvc.SetChat(&store.chat)
	gmH := handler.NewGroupMember(gmSvc)
	gmH.SetGroupGuard(gg)

	logs := &fakePushLogs{logs: map[int]*model.PushLog{
		1: {PltIdx: 1, MtIdx: ip(gMember)},
		2: {PltIdx: 2, MtIdx: ip(gOwner)},
	}}
	fcms := &fakePushFCMs{msgs: map[int]*model.PushFCM{
		1: {PftIdx: 1, PftSendMtIdx: ip(gMember)},
		2: {PftIdx: 2, PftSendMtIdx: ip(gOwner)},
	}}
	plH := handler.NewPushLog(service.NewPushLog(logs))
	plH.SetGuard(sg)
	pfH := handler.NewPushFCM(service.NewPushFCM(fcms))
	pfH.SetGuard(sg)
	orders := &fakeOrders{}
	orderH := handler.NewOrder(service.NewOrder(orders), cfg)
	weatherH := handler.NewWeather(service.NewWeather(fakeFCMMembers{}), cfg, cache.NewStore(nil))
	weatherH.SetGuard(sg)
	mfH := handler.NewMemberFCMToken(service.NewMemberFCMToken(fakeFCMMembers{}), cfg, nil)

	r := New(cfg, logger, Deps{
		AdminAuth: adminStub, UserAuth: ra.Required(), UserAuthOpt: ra.Optional(),
		Group: groupH, GroupMember: gmH, PushLog: plH, PushFCM: pfH, Order: orderH, Weather: weatherH,
		MemberFCMToken: mfH,
	})
	return &grpEnv{router: r, store: store, logs: logs, fcms: fcms, orders: orders, counter: counter, t: t}
}

func (e *grpEnv) do(method, path string, uid int, body string) *httptest.ResponseRecorder {
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
	req.RemoteAddr = "10.1.2.3:5555"
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

func wantCode(t *testing.T, label string, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("%s: got %d want %d body=%s", label, w.Code, want, w.Body.String())
	}
}

var modes = []auth.RouteMode{auth.RouteModeWarn, auth.RouteModeEnforce}

// --- 그룹 조회: 현재 멤버만 ---

func TestGroupReadsByRole(t *testing.T) {
	roles := []struct {
		name string
		uid  int
		ok   bool
	}{
		{"그룹장", gOwner, true}, {"리더", gLeader, true}, {"일반", gMember, true},
		{"나간", gExited, false}, {"강퇴", gKicked, false}, {"숨김", gHidden, false},
		{"다른 그룹", gOther, false}, {"그룹 없음", gNone, false},
	}
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		for _, p := range []string{"/groups/10", "/groups/10/stats"} {
			for _, r := range roles {
				want := 200
				if !r.ok {
					want = 403
				}
				wantCode(t, fmt.Sprintf("[%s] GET %s %s", m, p, r.name), e.do("GET", p, r.uid, ""), want)
			}
		}
		// 다른 그룹 멤버의 멤버 목록 호출도 막힌다(group-members는 G6 가드, 여기서는 그룹 상세만).
	}
}

func TestGroupListOnlyMineAndTokenless(t *testing.T) {
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		// 무토큰은 모드와 무관하게 401(앱 미사용 경로).
		wantCode(t, fmt.Sprintf("[%s] 무토큰 GET /groups/", m), e.do("GET", "/groups/", 0, ""), 401)
		wantCode(t, fmt.Sprintf("[%s] 무토큰 GET /groups/10", m), e.do("GET", "/groups/10", 0, ""), 401)
		wantCode(t, fmt.Sprintf("[%s] 무토큰 GET /groups/member/3", m), e.do("GET", "/groups/member/3", 0, ""), 401)
		// 소속 그룹만.
		w := e.do("GET", "/groups/", gMember, "")
		wantCode(t, "GET /groups/ 일반", w, 200)
		var got []dto.GroupResponse
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if len(got) != 1 || got[0].SgtIdx != groupID {
			t.Errorf("[%s] 소속 그룹만 와야 함: %+v", m, got)
		}
		w = e.do("GET", "/groups/", gNone, "")
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if w.Code != 200 || len(got) != 0 {
			t.Errorf("[%s] 소속 없음 → 빈 목록: %d %s", m, w.Code, w.Body.String())
		}
		// 남의 소속 그룹 조회는 403.
		wantCode(t, "GET /groups/member/3 by 4", e.do("GET", "/groups/member/3", gExited, ""), 403)
		wantCode(t, "GET /groups/member/3 self", e.do("GET", "/groups/member/3", gMember, ""), 200)
	}
}

// 독립 검토 N-1 재현: 전체 그룹의 초대 코드를 무인증으로 긁던 경로가 닫혔다.
func TestN1CodeDumpClosed(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	w := e.do("GET", "/groups/?limit=10000", 0, "")
	wantCode(t, "무인증 덤프", w, 401)
	if strings.Contains(w.Body.String(), "ABCDEFGH23") {
		t.Error("초대 코드가 노출됨")
	}
	w = e.do("GET", "/groups/?limit=10000", gOther, "")
	if strings.Contains(w.Body.String(), "ABCDEFGH23") {
		t.Error("다른 그룹 회원에게 그룹 10의 코드가 노출됨")
	}
	wantCode(t, "hidden 일반 회원", e.do("GET", "/groups/hidden", gMember, ""), 403)
	wantCode(t, "hidden 무토큰", e.do("GET", "/groups/hidden", 0, ""), 401)
}

// --- 그룹 쓰기: 그룹장만 ---

func TestGroupWritesOwnerOnly(t *testing.T) {
	type wc struct {
		name, method, path, body string
		selfOK                   int // 대상 본인이 요청하면 자진 탈퇴라 허용(0이면 해당 없음)
	}
	cases := []wc{
		{"수정", "PUT", "/groups/10", `{"sgt_title":"새이름","sgt_memo":"m"}`, 0},
		{"삭제(sgt_show=N)", "PUT", "/groups/10", `{"sgt_show":"N"}`, 0},
		{"복구", "PUT", "/groups/10/restore", "", 0},
		{"제거 API 강퇴", "PUT", "/groups/10/members/3/remove", `{}`, gMember},
		{"리더 지정", "PUT", "/group-members/10/role", `{"mt_idx":3,"is_leader":true}`, 0},
		{"강퇴 DELETE", "DELETE", "/group-members/10/member/3", "", gMember},
	}
	for _, m := range modes {
		for _, c := range cases {
			for _, role := range []struct {
				name string
				uid  int
				want int
			}{
				{"그룹장", gOwner, 200}, {"리더", gLeader, 403}, {"일반", gMember, 403}, {"나간", gExited, 403},
				{"강퇴", gKicked, 403}, {"다른 그룹", gOther, 403}, {"그룹 없음", gNone, 403},
			} {
				e := newGrpEnv(t, grpOpts{route: m}) // 매 케이스 새 상태
				want := role.want
				if c.selfOK != 0 && role.uid == c.selfOK {
					want = 200 // 본인 제거 = 자진 탈퇴
				}
				wantCode(t, fmt.Sprintf("[%s] %s / %s", m, c.name, role.name), e.do(c.method, c.path, role.uid, c.body), want)
			}
		}
	}
}

// A-1 변형·무토큰: 인증 없이 남의 그룹을 지우던 경로.
func TestGroupWritesTokenless(t *testing.T) {
	// 앱 사용 경로(수정/삭제/역할/강퇴 DELETE)는 모드를 따른다. 앱 미사용(복구, PUT .../remove)은 항상 401.
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		used := 200
		if m == auth.RouteModeEnforce {
			used = 401
		}
		wantCode(t, fmt.Sprintf("[%s] 무토큰 PUT /groups/10", m), e.do("PUT", "/groups/10", 0, `{"sgt_show":"N"}`), used)
		wantCode(t, fmt.Sprintf("[%s] 무토큰 restore", m), e.do("PUT", "/groups/10/restore", 0, ""), 401)
		wantCode(t, fmt.Sprintf("[%s] 무토큰 members/remove", m), e.do("PUT", "/groups/10/members/3/remove", 0, `{}`), 401)
		// 관리자 전용 경로는 무토큰 401, 일반 회원 403.
		for _, p := range [][2]string{
			{"POST", "/groups/emergency-restore"}, {"POST", "/groups/10/join-new-member"},
			{"POST", "/group-members/add?group_id=10&member_id=9"}, {"DELETE", "/group-members/remove?group_id=10&member_id=3"},
			{"GET", "/group-details/"}, {"PUT", "/group-details/101"}, {"DELETE", "/group-details/101"},
		} {
			wantCode(t, fmt.Sprintf("[%s] 무토큰 %s %s", m, p[0], p[1]), e.do(p[0], p[1], 0, `{}`), 401)
			wantCode(t, fmt.Sprintf("[%s] 일반 %s %s", m, p[0], p[1]), e.do(p[0], p[1], gMember, `{}`), 403)
		}
	}
}

func TestOwnerTransferAndCodeChange(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	// 그룹장 변경: 새 그룹장이 현재 멤버가 아니면 400, 멤버면 두 표식을 함께 바꾼다.
	wantCode(t, "나간 멤버에게 위임", e.do("PUT", "/groups/10", gOwner, `{"mt_idx":4}`), 400)
	wantCode(t, "다른 그룹 회원에게 위임", e.do("PUT", "/groups/10", gOwner, `{"mt_idx":6}`), 400)
	wantCode(t, "리더에게 위임", e.do("PUT", "/groups/10", gOwner, `{"mt_idx":2}`), 200)
	if len(e.store.transferred) != 1 || e.store.transferred[0] != "10>2" {
		t.Errorf("위임 기록: %v", e.store.transferred)
	}
	// 옛 그룹장은 더 이상 그룹장이 아니다.
	wantCode(t, "옛 그룹장 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 403)
	wantCode(t, "새 그룹장 수정", e.do("PUT", "/groups/10", gLeader, `{"sgt_title":"x"}`), 200)
	// 코드 변경은 형식을 지켜야 한다(짧은 코드로 추측 가능하게 만드는 것 금지).
	wantCode(t, "짧은 코드", e.do("PUT", "/groups/10", gLeader, `{"sgt_code":"G123"}`), 400)
	wantCode(t, "다른 그룹 코드와 충돌", e.do("PUT", "/groups/10", gLeader, `{"sgt_code":"ZZZZZZZZ22"}`), 400)
	wantCode(t, "같은 코드 재전송(무변경)", e.do("PUT", "/groups/10", gLeader, `{"sgt_code":"ABCDEFGH23","sgt_title":"y"}`), 200)
	wantCode(t, "정상 새 코드", e.do("PUT", "/groups/10", gLeader, `{"sgt_code":"abcdefgh99"}`), 200)
	if got := *e.store.groups[10].SgtCode; got != "ABCDEFGH99" {
		t.Errorf("코드는 대문자로 저장: %s", got)
	}
}

// --- 가입 ---

// 앱이 실제로 보내는 가입 요청 형태.
func TestJoinAppShapes(t *testing.T) {
	for _, m := range modes {
		// Android 그룹 탭: POST /groups/join {mt_idx, sgt_code}
		e := newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "Android 코드 가입", e.do("POST", "/groups/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_code":"ABCDEFGH23"}`, gJoiner)), 200)
		if r := e.store.row(10, gJoiner); r == nil || !isCur(r) {
			t.Errorf("가입 후 현재 멤버여야 함")
		}
		// Android 홈 모달·구버전: POST /groups/10/join {mt_idx, sgt_idx} (코드 없음)
		e = newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "Android/iOS 코드 없는 가입", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gJoiner)), 200)
		// 현재 앱: 코드 포함 {mt_idx, sgt_idx, sgt_code}
		e = newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "현재 앱 코드 포함", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"sgt_code":"ABCDEFGH23"}`, gJoiner)), 200)
		// 코드가 null이어도 코드 없음으로 취급
		e = newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "sgt_code null", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"sgt_code":null}`, gJoiner)), 200)
	}
}

// 독립 검토 A-1 재현: 타인 명의 가입, 틀린 코드, 코드 필수 설정.
func TestJoinA1(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "타인 명의(번호 8을 9가 가입시킴)", e.do("POST", "/groups/10/join", gJoiner, `{"mt_idx":8,"sgt_idx":10}`), 403)
	if e.store.row(10, gNone) != nil {
		t.Error("타인 명의 가입이 기록됨")
	}
	wantCode(t, "타인 명의 코드 가입", e.do("POST", "/groups/join", gJoiner, `{"mt_idx":8,"sgt_code":"ABCDEFGH23"}`), 403)
	wantCode(t, "틀린 코드(그룹 번호 가입)", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"sgt_code":"WRONGCODE2"}`, gJoiner)), 403)
	wantCode(t, "무토큰 가입", e.do("POST", "/groups/10/join", 0, `{"mt_idx":9,"sgt_idx":10}`), 401)
	wantCode(t, "무토큰 코드 가입", e.do("POST", "/groups/join", 0, `{"mt_idx":9,"sgt_code":"ABCDEFGH23"}`), 401)
	wantCode(t, "join-new-member 일반 회원", e.do("POST", "/groups/10/join-new-member", gJoiner, `{"mt_idx":9,"sgt_idx":10}`), 403)

	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn, requireCode: true})
	wantCode(t, "REQUIRE: 코드 없는 가입", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gJoiner)), 403)
	wantCode(t, "REQUIRE: 코드 있는 가입", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"sgt_code":"abcdefgh23"}`, gJoiner)), 200)
}

// 독립 검토 A-5 재현: 강퇴 재가입 거부, 자진 탈퇴 후 재가입은 허용하되 리더 권한 초기화.
func TestJoinA5(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	// 강퇴(discharge='Y') 행
	wantCode(t, "강퇴된 회원 재가입(번호)", e.do("POST", "/groups/10/join", gKicked, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gKicked)), 403)
	wantCode(t, "강퇴된 회원 재가입(코드)", e.do("POST", "/groups/join", gKicked, fmt.Sprintf(`{"mt_idx":%d,"sgt_code":"ABCDEFGH23"}`, gKicked)), 403)
	if r := e.store.row(10, gKicked); isCur(r) {
		t.Error("강퇴된 회원이 되살아남")
	}
	// 리더가 자진 탈퇴 → 재가입 시 리더 권한 없음
	wantCode(t, "리더 자진 탈퇴", e.do("DELETE", "/group-members/10/member/2", gLeader, ""), 200)
	if len(e.store.left) != 1 || len(e.store.kicked) != 0 {
		t.Errorf("자진 탈퇴는 discharge를 기록하면 안 됨: left=%v kicked=%v", e.store.left, e.store.kicked)
	}
	wantCode(t, "리더 재가입", e.do("POST", "/groups/10/join", gLeader, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gLeader)), 200)
	r := e.store.row(10, gLeader)
	if !isCur(r) || *r.SgdtLeaderChk != "N" || *r.SgdtOwnerChk != "N" {
		t.Errorf("재가입 후 현재 멤버, 권한 초기화여야 함: %+v", r)
	}
	// 이미 나간 멤버(4)도 재가입 가능(자진 탈퇴 행: exit=Y, discharge=N)
	wantCode(t, "나간 멤버 재가입", e.do("POST", "/groups/10/join", gExited, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gExited)), 200)
	// 이미 멤버
	wantCode(t, "이미 멤버", e.do("POST", "/groups/10/join", gMember, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gMember)), 400)
}

func TestKickLeaveOwner(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	// 그룹장이 일반 멤버를 강퇴 → discharge 기록, 재가입 거부
	wantCode(t, "그룹장 강퇴", e.do("DELETE", "/group-members/10/member/3", gOwner, ""), 200)
	if len(e.store.kicked) != 1 {
		t.Errorf("강퇴는 discharge='Y'를 기록해야 함: %v", e.store.kicked)
	}
	wantCode(t, "강퇴자 재가입", e.do("POST", "/groups/10/join", gMember, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gMember)), 403)
	// 리더·일반의 타인 제거는 403
	wantCode(t, "리더가 강퇴 시도", e.do("DELETE", "/group-members/10/member/3", gLeader, ""), 403)
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "일반이 타인 강퇴 시도", e.do("DELETE", "/group-members/10/member/2", gMember, ""), 403)
	// 그룹장은 승계 없이 탈퇴 불가(400), 위임 후에는 가능
	wantCode(t, "그룹장 탈퇴", e.do("DELETE", "/group-members/10/member/1", gOwner, ""), 400)
	wantCode(t, "그룹장 제거 시도(PUT remove)", e.do("PUT", "/groups/10/members/1/remove", gOwner, `{}`), 400)
	wantCode(t, "위임", e.do("PUT", "/groups/10", gOwner, `{"mt_idx":2}`), 200)
	wantCode(t, "옛 그룹장 탈퇴", e.do("DELETE", "/group-members/10/member/1", gOwner, ""), 200)
	// PUT .../remove 도 같은 규칙(그룹장의 강퇴는 discharge 기록)
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "PUT remove 강퇴", e.do("PUT", "/groups/10/members/3/remove", gOwner, `{}`), 200)
	if len(e.store.kicked) != 1 {
		t.Errorf("PUT remove 강퇴도 discharge 기록: %v", e.store.kicked)
	}
	wantCode(t, "PUT remove 본인 탈퇴", e.do("PUT", "/groups/10/members/2/remove", gLeader, `{}`), 200)
	if len(e.store.left) != 1 {
		t.Errorf("본인 제거는 자진 탈퇴: %v", e.store.left)
	}
}

// 리더 지정 해제도 그룹장만, 일반 회원이 자기를 리더로 올리는 시도는 403.
func TestSelfPromoteDenied(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "자기 승격", e.do("PUT", "/group-members/10/role", gMember, `{"mt_idx":3,"is_leader":true}`), 403)
	if *e.store.row(10, gMember).SgdtLeaderChk != "N" {
		t.Error("승격이 적용됨")
	}
}

// --- 초대 코드 호출 한도 ---

func TestCodeLimits(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn, limitMember: 3, limitIP: 1000})
	for i := 1; i <= 3; i++ {
		wantCode(t, fmt.Sprintf("조회 %d", i), e.do("GET", "/groups/code/ABCDEFGH23", gJoiner, ""), 200)
	}
	w := e.do("GET", "/groups/code/ABCDEFGH23", gJoiner, "")
	wantCode(t, "회원 한도 초과", w, 429)
	if w.Header().Get("Retry-After") == "" {
		t.Error("Retry-After 누락")
	}
	// 코드 가입도 같은 한도를 쓴다.
	wantCode(t, "코드 가입 한도", e.do("POST", "/groups/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_code":"ABCDEFGH23"}`, gJoiner)), 429)
	// 다른 회원은 영향 없음
	wantCode(t, "다른 회원", e.do("GET", "/groups/code/ABCDEFGH23", gMember, ""), 200)
	// IP 한도(회원이 달라도 같은 IP)
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn, limitMember: 1000, limitIP: 2})
	wantCode(t, "IP 1", e.do("GET", "/groups/code/ABCDEFGH23", gJoiner, ""), 200)
	wantCode(t, "IP 2", e.do("GET", "/groups/code/ABCDEFGH23", gMember, ""), 200)
	wantCode(t, "IP 초과", e.do("GET", "/groups/code/ABCDEFGH23", gOwner, ""), 429)
	// 코드 없는 번호 가입은 한도에 걸리지 않는다(구버전 앱).
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn, limitMember: 1, limitIP: 1})
	wantCode(t, "코드 없는 가입 1", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gJoiner)), 200)
	// Redis 장애는 503.
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	e.counter.fail = true
	wantCode(t, "Redis 장애 조회", e.do("GET", "/groups/code/ABCDEFGH23", gJoiner, ""), 503)
	wantCode(t, "Redis 장애 코드 가입", e.do("POST", "/groups/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_code":"ABCDEFGH23"}`, gJoiner)), 503)
	wantCode(t, "Redis 장애 + 코드 포함 번호 가입", e.do("POST", "/groups/10/join", gJoiner, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10,"sgt_code":"ABCDEFGH23"}`, gJoiner)), 503)
	// 무토큰 조회: enforce면 401
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeEnforce})
	wantCode(t, "enforce 무토큰 코드 조회", e.do("GET", "/groups/code/ABCDEFGH23", 0, ""), 401)
}

var codeRe = regexp.MustCompile(`^[A-Z0-9]{10}$`)

func TestCreateGroupCodeCSPRNG(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	seen := map[string]bool{}
	for i := 0; i < 20; i++ {
		w := e.do("POST", "/groups/", gMember, `{"sgt_title":"새 그룹","sgt_memo":"","sgt_show":"Y"}`)
		wantCode(t, "생성", w, 200)
		var g dto.GroupResponse
		_ = json.Unmarshal(w.Body.Bytes(), &g)
		if g.SgtCode == nil || !codeRe.MatchString(*g.SgtCode) {
			t.Fatalf("코드는 대문자/숫자 10자여야 함: %v", g.SgtCode)
		}
		if seen[*g.SgtCode] {
			t.Fatal("코드 중복")
		}
		seen[*g.SgtCode] = true
	}
	wantCode(t, "무토큰 생성", e.do("POST", "/groups/", 0, `{"sgt_title":"x"}`), 401)
}

// --- 푸시 ---

func TestPushLogs(t *testing.T) {
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		// 앱 사용 경로: 본인 것만(토큰이 있으면 모드 무관).
		wantCode(t, "본인 목록", e.do("GET", "/push-logs/member/3", gMember, ""), 200)
		wantCode(t, "타인 목록", e.do("GET", "/push-logs/member/3", gOwner, ""), 403)
		wantCode(t, "타인 목록(그룹장도)", e.do("GET", "/push-logs/member/2", gOwner, ""), 403)
		wantCode(t, "본인 읽음", e.do("PATCH", "/push-logs/1/read", gMember, ""), 200)
		wantCode(t, "타인 로그 읽음", e.do("PATCH", "/push-logs/2/read", gMember, ""), 403)
		wantCode(t, "본인 삭제", e.do("DELETE", "/push-logs/1", gMember, ""), 200)
		wantCode(t, "타인 로그 삭제", e.do("DELETE", "/push-logs/2", gMember, ""), 403)
		wantCode(t, "없는 로그 삭제", e.do("DELETE", "/push-logs/99", gMember, ""), 404)
		wantCode(t, "read-all 본인", e.do("POST", "/push-logs/read-all?mt_idx=3", gMember, ""), 200)
		wantCode(t, "read-all 타인", e.do("POST", "/push-logs/read-all?mt_idx=1", gMember, ""), 403)
		wantCode(t, "delete-all 타인", e.do("POST", "/push-logs/delete-all?mt_idx=1", gMember, ""), 403)
		if len(e.logs.deleted) != 1 || len(e.logs.delAll) != 0 || len(e.logs.readAll) != 1 {
			t.Errorf("[%s] 거부된 요청이 저장소를 건드림: del=%v delAll=%v readAll=%v", m, e.logs.deleted, e.logs.delAll, e.logs.readAll)
		}
		// 앱 미사용 읽기: 본인 것만, 무토큰은 항상 401.
		wantCode(t, "단건 본인", e.do("GET", "/push-logs/1", gMember, ""), 200)
		wantCode(t, "단건 타인", e.do("GET", "/push-logs/2", gMember, ""), 403)
		wantCode(t, "단건 무토큰", e.do("GET", "/push-logs/1", 0, ""), 401)
		wantCode(t, "recent 무토큰", e.do("GET", "/push-logs/recent/3", 0, ""), 401)
		wantCode(t, "unread 타인", e.do("GET", "/push-logs/member/1/unread", gMember, ""), 403)
		w := e.do("GET", "/push-logs/schedule/5", gMember, "")
		wantCode(t, "schedule 본인분만", w, 200)
		var ls []dto.PushLogResponse
		_ = json.Unmarshal(w.Body.Bytes(), &ls)
		if len(ls) != 1 || *ls[0].MtIdx != gMember {
			t.Errorf("schedule은 본인 로그만: %+v", ls)
		}
		// 관리자 전용: 전체 조회·생성·수정.
		for _, p := range [][2]string{{"GET", "/push-logs/"}, {"POST", "/push-logs/"}, {"PUT", "/push-logs/1"},
			{"GET", "/push-fcms/"}, {"POST", "/push-fcms/"}, {"PUT", "/push-fcms/1"}} {
			wantCode(t, fmt.Sprintf("[%s] 일반 %s %s", m, p[0], p[1]), e.do(p[0], p[1], gMember, `{}`), 403)
			wantCode(t, fmt.Sprintf("[%s] 무토큰 %s %s", m, p[0], p[1]), e.do(p[0], p[1], 0, `{}`), 401)
		}
		wantCode(t, "관리자 전체 조회", e.do("GET", "/push-logs/", gAdminID, ""), 200)
	}
	// 무토큰: 앱 사용 경로(member)는 모드를 따른다.
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "warn 무토큰 member", e.do("GET", "/push-logs/member/3", 0, ""), 200)
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeEnforce})
	wantCode(t, "enforce 무토큰 member", e.do("GET", "/push-logs/member/3", 0, ""), 401)
}

func TestPushFCMs(t *testing.T) {
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "본인 메시지", e.do("GET", "/push-fcms/1", gMember, ""), 200)
		wantCode(t, "타인 메시지", e.do("GET", "/push-fcms/2", gMember, ""), 403)
		wantCode(t, "무토큰 메시지", e.do("GET", "/push-fcms/1", 0, ""), 401)
		wantCode(t, "타인 member", e.do("GET", "/push-fcms/member/1", gMember, ""), 403)
		wantCode(t, "무토큰 member", e.do("GET", "/push-fcms/member/3", 0, ""), 401)
		wantCode(t, "타인 pending", e.do("GET", "/push-fcms/pending/1", gMember, ""), 403)
		wantCode(t, "타인 삭제", e.do("DELETE", "/push-fcms/2", gMember, ""), 403)
		wantCode(t, "본인 삭제", e.do("DELETE", "/push-fcms/1", gMember, ""), 200)
		wantCode(t, "무토큰 삭제", e.do("DELETE", "/push-fcms/1", 0, ""), 401)
		wantCode(t, "타인 delivered", e.do("POST", "/push-fcms/mark-delivered/2", gMember, ""), 403)
		w := e.do("GET", "/push-fcms/code/X", gMember, "")
		var ms []dto.PushFCMResponse
		_ = json.Unmarshal(w.Body.Bytes(), &ms)
		if w.Code != 200 || len(ms) != 1 {
			t.Errorf("code는 본인 수신분만: %d %s", w.Code, w.Body.String())
		}
		if len(e.fcms.deleted) != 1 {
			t.Errorf("거부된 삭제가 저장소를 건드림: %v", e.fcms.deleted)
		}
	}
}

// --- 주문 · 날씨 · FCM 토큰 ---

func TestOrdersAdminOnly(t *testing.T) {
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		for _, p := range [][2]string{{"PUT", "/orders/status/5?status=2"}, {"POST", "/orders/cancel/5?cancel_reason=x"}} {
			wantCode(t, fmt.Sprintf("[%s] 무토큰 %s", m, p[1]), e.do(p[0], p[1], 0, ""), 401)
			// 주문 소유자(3)여도 일반 회원은 403 — 상태 변경·취소는 관리자 전용.
			wantCode(t, fmt.Sprintf("[%s] 소유자 %s", m, p[1]), e.do(p[0], p[1], gMember, ""), 403)
			wantCode(t, fmt.Sprintf("[%s] 타인 %s", m, p[1]), e.do(p[0], p[1], gOther, ""), 403)
		}
		if len(e.orders.cancelled) != 0 {
			t.Errorf("거부된 요청이 주문을 바꿈: %v", e.orders.cancelled)
		}
		// 관리자는 소유자가 아니어도 취소할 수 있다(게이트 통과 확인: 직렬화 버그 재현 500은 기존 동작).
		w := e.do("POST", "/orders/cancel/5?cancel_reason=x", gAdminID, "")
		if w.Code == 401 || w.Code == 403 {
			t.Errorf("관리자 취소가 막힘: %d", w.Code)
		}
		if len(e.orders.cancelled) != 1 {
			t.Errorf("관리자 취소가 적용되지 않음: %v", e.orders.cancelled)
		}
	}
}

func TestWeatherSelfOnly(t *testing.T) {
	for _, m := range modes {
		e := newGrpEnv(t, grpOpts{route: m})
		wantCode(t, "무토큰 GET", e.do("GET", "/weather/member/3", 0, ""), 401)
		wantCode(t, "무토큰 PUT", e.do("PUT", "/weather/member/3", 0, `{}`), 401)
		wantCode(t, "타인 GET", e.do("GET", "/weather/member/3", gOwner, ""), 403)
		wantCode(t, "타인 PUT", e.do("PUT", "/weather/member/3", gOwner, `{"mt_weather_sky":"1"}`), 403)
	}
}

func TestMemberFCMTokenRemainingRoutes(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "notify 무토큰", e.do("POST", "/member-fcm-token/notify-token-refresh?mt_idx=3", 0, ""), 401)
	wantCode(t, "notify 타인", e.do("POST", "/member-fcm-token/notify-token-refresh?mt_idx=3", gOwner, ""), 403)
	wantCode(t, "notify 본인", e.do("POST", "/member-fcm-token/notify-token-refresh?mt_idx=3", gMember, ""), 200)
	wantCode(t, "cleanup 무토큰", e.do("POST", "/member-fcm-token/cleanup-expired-tokens", 0, ""), 401)
	wantCode(t, "cleanup 일반", e.do("POST", "/member-fcm-token/cleanup-expired-tokens", gMember, ""), 403)
	wantCode(t, "reset 일반", e.do("POST", "/member-fcm-token/reset-invalid-tokens", gMember, ""), 403)
}

type g7GMRepo struct{}

func (g7GMRepo) FindGroupMembers(int) ([]model.GroupMemberRow, error) { return nil, nil }

// --- 보정 1: 채팅 멤버십 비활성화 연결 ---

func TestChatDeactivationWiring(t *testing.T) {
	// 강퇴(DELETE, PUT remove) → 대상 회원 채팅 비활성화
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "DELETE 강퇴", e.do("DELETE", "/group-members/10/member/3", gOwner, ""), 200)
	wantCode(t, "PUT remove 강퇴", e.do("PUT", "/groups/10/members/2/remove", gOwner, `{}`), 200)
	if got := fmt.Sprint(e.store.chat.deactMember); got != "[10:3 10:2]" {
		t.Errorf("강퇴 두 경로 모두 채팅 비활성화 기대, got %s", got)
	}
	// 자진 탈퇴(DELETE, PUT remove)
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "DELETE 자진 탈퇴", e.do("DELETE", "/group-members/10/member/3", gMember, ""), 200)
	wantCode(t, "PUT remove 자진 탈퇴", e.do("PUT", "/groups/10/members/2/remove", gLeader, `{}`), 200)
	if got := fmt.Sprint(e.store.chat.deactMember); got != "[10:3 10:2]" {
		t.Errorf("자진 탈퇴 두 경로 모두 채팅 비활성화 기대, got %s", got)
	}
	// 거부된 요청(403/400)은 채팅을 건드리지 않는다
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "일반이 타인 강퇴 시도", e.do("DELETE", "/group-members/10/member/2", gMember, ""), 403)
	wantCode(t, "그룹장 탈퇴 거부", e.do("DELETE", "/group-members/10/member/1", gOwner, ""), 400)
	if len(e.store.chat.deactMember) != 0 || len(e.store.chat.deactGroup) != 0 {
		t.Errorf("거부된 요청이 채팅을 비활성화함: %v %v", e.store.chat.deactMember, e.store.chat.deactGroup)
	}
	// 그룹 삭제(PUT sgt_show=N) → 그룹 전체 채팅 비활성화. 일반 수정은 호출 안 함.
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "제목 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"new"}`), 200)
	if len(e.store.chat.deactGroup) != 0 {
		t.Errorf("일반 수정은 채팅을 건드리면 안 됨")
	}
	wantCode(t, "삭제(PUT sgt_show=N)", e.do("PUT", "/groups/10", gOwner, `{"sgt_show":"N"}`), 200)
	if fmt.Sprint(e.store.chat.deactGroup) != "[10]" {
		t.Errorf("그룹 삭제 시 DeactivateGroupChat(10) 기대, got %v", e.store.chat.deactGroup)
	}
	wantCode(t, "일반 멤버의 삭제 시도", newGrpEnv(t, grpOpts{route: auth.RouteModeWarn}).do("PUT", "/groups/10", gMember, `{"sgt_show":"N"}`), 403)
}

// 자진 탈퇴 후 재가입하면 채팅 참가를 되살린다. 강퇴는 재가입이 거부되어 되살리지 않는다.
func TestChatRestoredOnRejoin(t *testing.T) {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "탈퇴", e.do("DELETE", "/group-members/10/member/3", gMember, ""), 200)
	wantCode(t, "재가입", e.do("POST", "/groups/10/join", gMember, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gMember)), 200)
	if fmt.Sprint(e.store.chat.added) != "[10:3]" {
		t.Errorf("재가입 시 AddMemberToGroupChat(10,3) 기대, got %v", e.store.chat.added)
	}
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	wantCode(t, "강퇴", e.do("DELETE", "/group-members/10/member/3", gOwner, ""), 200)
	wantCode(t, "강퇴자 재가입 거부", e.do("POST", "/groups/10/join", gMember, fmt.Sprintf(`{"mt_idx":%d,"sgt_idx":10}`, gMember)), 403)
	if len(e.store.chat.added) != 0 {
		t.Errorf("강퇴자는 채팅이 되살아나면 안 됨: %v", e.store.chat.added)
	}
}

// --- 보정 2: owner_chk 없이 생성자(groups.mt_idx)로만 그룹장인 구 데이터 ---

func legacyOwnerEnv(t *testing.T) *grpEnv {
	e := newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	e.store.row(groupID, gOwner).SgdtOwnerChk = sPtr("N") // 그룹 10의 생성자(1)는 groups.mt_idx만 남음
	return e
}

func TestLegacyCreatorIsOwner(t *testing.T) {
	// 생성자(현재 멤버, owner_chk=N, 다른 owner 없음) → 수정·삭제·복구·리더 지정·강퇴 모두 허용
	e := legacyOwnerEnv(t)
	wantCode(t, "생성자 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 200)
	wantCode(t, "생성자 리더 지정", e.do("PUT", "/group-members/10/role", gOwner, `{"mt_idx":3,"is_leader":true}`), 200)
	wantCode(t, "생성자 강퇴", e.do("DELETE", "/group-members/10/member/3", gOwner, ""), 200)
	wantCode(t, "생성자 삭제", e.do("PUT", "/groups/10", gOwner, `{"sgt_show":"N"}`), 200)
	wantCode(t, "생성자 복구", e.do("PUT", "/groups/10/restore", gOwner, ""), 200)
	// 승계 없이 탈퇴는 불가(그룹장과 동일 규칙, 두 경로)
	wantCode(t, "생성자 탈퇴(DELETE)", e.do("DELETE", "/group-members/10/member/1", gOwner, ""), 400)
	wantCode(t, "생성자 탈퇴(PUT remove)", e.do("PUT", "/groups/10/members/1/remove", gOwner, `{}`), 400)
	// 그룹장 위임은 생성자도 가능, 위임 후 옛 생성자는 그룹장이 아니다(groups.mt_idx 갱신)
	wantCode(t, "생성자 위임", e.do("PUT", "/groups/10", gOwner, `{"mt_idx":2}`), 200)
	wantCode(t, "위임 후 옛 생성자 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"y"}`), 403)
	wantCode(t, "새 그룹장 수정", e.do("PUT", "/groups/10", gLeader, `{"sgt_title":"y"}`), 200)
}

func TestLegacyCreatorBoundaries(t *testing.T) {
	// 일반 멤버·리더(생성자 아님, owner_chk=N)는 여전히 403
	e := legacyOwnerEnv(t)
	wantCode(t, "리더 수정", e.do("PUT", "/groups/10", gLeader, `{"sgt_title":"x"}`), 403)
	wantCode(t, "일반 수정", e.do("PUT", "/groups/10", gMember, `{"sgt_title":"x"}`), 403)
	// 나간 생성자는 권한 부활 불가
	e = legacyOwnerEnv(t)
	r := e.store.row(groupID, gOwner)
	r.SgdtExit, r.SgdtShow = sPtr("Y"), sPtr("N")
	wantCode(t, "나간 생성자 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 403)
	wantCode(t, "나간 생성자 삭제", e.do("PUT", "/groups/10", gOwner, `{"sgt_show":"N"}`), 403)
	// 강퇴된 생성자도 불가
	e = legacyOwnerEnv(t)
	r = e.store.row(groupID, gOwner)
	r.SgdtExit, r.SgdtDischarge, r.SgdtShow = sPtr("Y"), sPtr("Y"), sPtr("N")
	wantCode(t, "강퇴된 생성자 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 403)
	// 다른 현재 멤버가 owner_chk=Y면(생성자 기록이 낡음) 생성자는 그룹장이 아니다 — 이중 그룹장 방지
	e = legacyOwnerEnv(t)
	e.store.row(groupID, gMember).SgdtOwnerChk = sPtr("Y")
	wantCode(t, "다른 owner 존재 시 생성자 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 403)
	wantCode(t, "표식 그룹장 수정", e.do("PUT", "/groups/10", gMember, `{"sgt_title":"x"}`), 200)
	// 생성자 기록이 일반 멤버(3)이고 표식 그룹장(1)이 따로 있으면 표식 그룹장만 그룹장이다
	e = newGrpEnv(t, grpOpts{route: auth.RouteModeWarn})
	e.store.groups[groupID].MtIdx = ip(gMember) // 생성자 기록은 일반 멤버(3), 표식 그룹장은 1
	wantCode(t, "표식 그룹장 우선(생성자 3은 불가)", e.do("PUT", "/groups/10", gMember, `{"sgt_title":"x"}`), 403)
	wantCode(t, "표식 그룹장 수정", e.do("PUT", "/groups/10", gOwner, `{"sgt_title":"x"}`), 200)
}
