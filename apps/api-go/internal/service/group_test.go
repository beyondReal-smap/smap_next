package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// fakeGroupRepo는 groupRepo 인터페이스를 메모리로 대체한다.
type fakeGroupRepo struct {
	one  *model.Group
	many []model.Group
	err  error

	// current-user / stats용 더블 값.
	curGroupCount    int64
	curDistinctCount int64
	curGroups        []repository.CurrentUserGroupRow
	curErr           error

	statsGroupMembers []model.GroupDetail
	statsMember       *model.Member
	statsWeekly       int64
	statsTotalLoc     int64
	statsWeeklyLoc    int64
	statsErr          error
}

func (f *fakeGroupRepo) GetByID(id int) (*model.Group, error) { return f.one, f.err }
func (f *fakeGroupRepo) FindByCode(code string) (*model.Group, error) {
	return f.one, f.err
}
func (f *fakeGroupRepo) ListHidden() ([]model.Group, error) { return f.many, f.err }
func (f *fakeGroupRepo) List(skip, limit int, showHidden bool) ([]model.Group, error) {
	return f.many, f.err
}
func (f *fakeGroupRepo) ListForMember(mtIdx, skip, limit int, showHidden bool) ([]model.Group, error) {
	return f.many, f.err
}
func (f *fakeGroupRepo) FindByMember(mtIdx int) ([]model.Group, error) {
	return f.many, f.err
}
func (f *fakeGroupRepo) CurrentUserGroupCount(mtIdx int) (int64, error) {
	return f.curGroupCount, f.curErr
}
func (f *fakeGroupRepo) CurrentUserDistinctMemberCount(mtIdx int) (int64, error) {
	return f.curDistinctCount, f.curErr
}
func (f *fakeGroupRepo) CurrentUserGroups(mtIdx int) ([]repository.CurrentUserGroupRow, error) {
	return f.curGroups, f.curErr
}
func (f *fakeGroupRepo) StatsGroupMembers(groupID int) ([]model.GroupDetail, error) {
	return f.statsGroupMembers, f.statsErr
}
func (f *fakeGroupRepo) StatsMember(memberID int) (*model.Member, error) {
	return f.statsMember, f.statsErr
}
func (f *fakeGroupRepo) StatsWeeklySchedules(memberID int, start, end time.Time) (int64, error) {
	return f.statsWeekly, f.statsErr
}
func (f *fakeGroupRepo) StatsTotalLocations(memberID int) (int64, error) {
	return f.statsTotalLoc, f.statsErr
}
func (f *fakeGroupRepo) StatsWeeklyLocations(memberID int, start, end time.Time) (int64, error) {
	return f.statsWeeklyLoc, f.statsErr
}

func pTimePtr(t time.Time) *time.Time { return &t }

func TestGetGroup(t *testing.T) {
	t.Run("정상 - 단건 변환", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: &model.Group{
			SgtIdx: 42, MtIdx: pInt(1186), SgtTitle: pStr("가족"),
			SgtCode: pStr("G12345"), SgtShow: pStr("Y"),
		}})
		res, err := svc.GetGroup(42)
		if err != nil || res == nil {
			t.Fatalf("res=%v err=%v", res, err)
		}
		if res.SgtIdx != 42 || res.MtIdx == nil || *res.MtIdx != 1186 ||
			res.SgtTitle == nil || *res.SgtTitle != "가족" || res.SgtShow == nil || *res.SgtShow != "Y" {
			t.Errorf("res=%+v", res)
		}
		// sgt_memo 미설정 → nil(→ null), sgt_wdate/udate nil → nil(→ null)
		if res.SgtMemo != nil || res.SgtWdate != nil || res.SgtUdate != nil {
			t.Errorf("nullable 필드는 nil이어야 함: %+v", res)
		}
	})

	t.Run("없음 → (nil, nil) 404 신호", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: nil})
		res, err := svc.GetGroup(99)
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{err: errors.New("db down")})
		if _, err := svc.GetGroup(1); err == nil {
			t.Error("expected error")
		}
	})
}

func TestGroupByCode(t *testing.T) {
	t.Run("정상", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: &model.Group{SgtIdx: 7, SgtCode: pStr("G54321"), SgtShow: pStr("Y")}})
		res, err := svc.GroupByCode("G54321")
		if err != nil || res == nil || res.SgtIdx != 7 {
			t.Fatalf("res=%v err=%v", res, err)
		}
	})

	t.Run("없음 → (nil, nil)", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: nil})
		res, err := svc.GroupByCode("NOPE")
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})
}

func TestListAndMemberGroups(t *testing.T) {
	groups := []model.Group{
		{SgtIdx: 1, SgtTitle: pStr("A"), SgtShow: pStr("Y")},
		{SgtIdx: 2, SgtTitle: pStr("B"), SgtShow: pStr("Y")},
	}

	t.Run("ListGroups - 변환 + 순서 보존", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: groups})
		res, err := svc.ListGroups(0, 10000, false)
		if err != nil || len(res) != 2 || res[0].SgtIdx != 1 || res[1].SgtIdx != 2 {
			t.Fatalf("res=%+v err=%v", res, err)
		}
	})

	t.Run("MemberGroups - 변환", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: groups})
		res, err := svc.MemberGroups(1186)
		if err != nil || len(res) != 2 {
			t.Fatalf("res=%+v err=%v", res, err)
		}
	})

	t.Run("빈 결과 → 빈 슬라이스(→ JSON [])", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: nil})
		res, err := svc.ListGroups(0, 10000, false)
		if err != nil || res == nil || len(res) != 0 {
			t.Fatalf("빈 슬라이스여야 함: res=%v err=%v", res, err)
		}
		b, _ := json.Marshal(res)
		if string(b) != "[]" {
			t.Errorf("빈 목록은 [] 직렬화여야 함: %s", b)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{err: errors.New("db down")})
		if _, err := svc.MemberGroups(1); err == nil {
			t.Error("expected error")
		}
	})
}

// TestGroupResponseJSON은 Python GroupResponse.model_dump_json()의 실측 출력과
// 키 순서·타입·null·datetime 포맷이 바이트 동등한지 검증한다.
func TestGroupResponseJSON(t *testing.T) {
	svc := NewGroup(&fakeGroupRepo{one: &model.Group{
		SgtIdx: 42, MtIdx: pInt(1186), SgtTitle: pStr("가족"),
		SgtCode: pStr("G12345"), SgtMemo: nil, SgtShow: pStr("Y"),
		SgtWdate: pTimePtr(time.Date(2025, 6, 14, 10, 30, 14, 0, time.Local)),
		SgtUdate: nil,
	}})
	res, _ := svc.GetGroup(42)
	b, err := json.Marshal(res)
	if err != nil {
		t.Fatalf("marshal err=%v", err)
	}
	// Python 실측: GroupResponse(...).model_dump_json()
	want := `{"mt_idx":1186,"sgt_title":"가족","sgt_code":"G12345","sgt_memo":null,"sgt_show":"Y","sgt_idx":42,"sgt_wdate":"2025-06-14T10:30:14","sgt_udate":null}`
	if string(b) != want {
		t.Errorf("JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

func TestCurrentUserGroupSummary(t *testing.T) {
	svc := NewGroup(&fakeGroupRepo{curGroupCount: 3, curDistinctCount: 7})
	res, err := svc.CurrentUserGroupSummary(42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.GroupCount != 3 || res.TotalMembers != 7 {
		t.Fatalf("expected {3,7}, got %+v", res)
	}
	// 키 순서 group_count, total_members 검증.
	b, _ := json.Marshal(res)
	if string(b) != `{"group_count":3,"total_members":7}` {
		t.Errorf("summary JSON 불일치: %s", b)
	}
}

func TestCurrentUserGroupSummaryError(t *testing.T) {
	svc := NewGroup(&fakeGroupRepo{curErr: errors.New("db down")})
	if _, err := svc.CurrentUserGroupSummary(1); err == nil {
		t.Fatalf("expected error")
	}
}

func TestCurrentUserGroups(t *testing.T) {
	wdate := time.Date(2024, 5, 1, 9, 30, 0, 0, time.Local)
	udate := time.Date(2024, 6, 2, 10, 0, 0, 0, time.Local)
	jdate := time.Date(2024, 5, 1, 9, 31, 0, 0, time.Local)
	rows := []repository.CurrentUserGroupRow{
		{
			Group: model.Group{
				SgtIdx: 10, MtIdx: pInt(1186), SgtTitle: pStr("G1"), SgtCode: pStr("C1"),
				SgtMemo: pStr("메모"), SgtShow: pStr("Y"), SgtWdate: &wdate, SgtUdate: &udate,
			},
			Detail:      model.GroupDetail{SgdtOwnerChk: pStr("Y"), SgdtLeaderChk: pStr("N"), SgdtWdate: &jdate},
			MemberCount: 4,
		},
	}
	svc := NewGroup(&fakeGroupRepo{curGroups: rows})
	res, err := svc.CurrentUserGroups(42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 1 {
		t.Fatalf("expected 1 item, got %d", len(res))
	}
	it := res[0]
	if it.SgtIdx != 10 || it.MemberCount != 4 || it.MtIdx == nil || *it.MtIdx != 1186 {
		t.Fatalf("unexpected item: %+v", it)
	}
	if !it.IsOwner || it.IsLeader {
		t.Fatalf("owner/leader chk 불일치: %+v", it)
	}
	// 키 순서 12키: sgt_idx, mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show, sgt_wdate,
	// sgt_udate, member_count, is_owner, is_leader, join_date.
	b, _ := json.Marshal(it)
	want := `{"sgt_idx":10,"mt_idx":1186,"sgt_title":"G1","sgt_code":"C1","sgt_memo":"메모","sgt_show":"Y","sgt_wdate":"2024-05-01T09:30:00","sgt_udate":"2024-06-02T10:00:00","member_count":4,"is_owner":true,"is_leader":false,"join_date":"2024-05-01T09:31:00"}`
	if string(b) != want {
		t.Errorf("item JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestCurrentUserGroupsFallbackAndSort은 폴백(sgt_title→"그룹 {id}", code/memo→"", show→"Y")과
// sgt_title 오름차순 정렬을 검증한다. mt_idx는 폴백 없이 null 유지.
func TestCurrentUserGroupsFallbackAndSort(t *testing.T) {
	w := time.Date(2024, 1, 1, 0, 0, 0, 0, time.Local)
	rows := []repository.CurrentUserGroupRow{
		// 제목 있음("나중") → 정렬 후 두 번째.
		{Group: model.Group{SgtIdx: 1, SgtTitle: pStr("나중"), SgtCode: pStr("C1"), SgtShow: pStr("Y"), SgtWdate: &w, SgtUdate: &w}, Detail: model.GroupDetail{SgdtWdate: &w}, MemberCount: 1},
		// 제목 null → 폴백 "그룹 2"(코드포인트상 '그'>'나' 아님: 'ㄱ' < 'ㄴ'이라 "그룹 2"가 먼저).
		{Group: model.Group{SgtIdx: 2, SgtTitle: nil, SgtCode: nil, SgtMemo: nil, SgtShow: nil, SgtWdate: &w, SgtUdate: &w}, Detail: model.GroupDetail{SgdtWdate: &w}, MemberCount: 0},
	}
	svc := NewGroup(&fakeGroupRepo{curGroups: rows})
	res, err := svc.CurrentUserGroups(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 2 {
		t.Fatalf("expected 2 items, got %d", len(res))
	}
	// "그룹 2"(폴백)가 "나중"보다 코드포인트상 앞('ㄱ' U+AC00대 < 'ㄴ').
	if res[0].SgtTitle != "그룹 2" || res[1].SgtTitle != "나중" {
		t.Fatalf("정렬 불일치: [0]=%q [1]=%q", res[0].SgtTitle, res[1].SgtTitle)
	}
	// 폴백 그룹: code/memo→"", show→"Y", mt_idx→null.
	g := res[0]
	if g.SgtCode != "" || g.SgtMemo != "" || g.SgtShow != "Y" || g.MtIdx != nil {
		t.Fatalf("폴백 불일치: %+v", g)
	}
}

func TestGroupStatsEmptyMembers(t *testing.T) {
	title := "가족"
	svc := NewGroup(&fakeGroupRepo{statsGroupMembers: []model.GroupDetail{}})
	res, err := svc.GroupStats(100, &title, time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 멤버 없음 → 6키, 모두 0/빈배열, stats_period 없음(omitempty). member_stats는 빈 슬라이스(→ []).
	b, _ := json.Marshal(res)
	want := `{"group_id":100,"group_title":"가족","member_count":0,"weekly_schedules":0,"total_locations":0,"member_stats":[]}`
	if string(b) != want {
		t.Errorf("empty stats JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

func TestGroupStatsWithMember(t *testing.T) {
	title := "가족"
	mid := 1186
	member := &model.Member{MtIdx: 1186, MtName: pStr("홍길동"), MtNickname: pStr("길동이")}
	groupMembers := []model.GroupDetail{
		{MtIdx: &mid, SgdtOwnerChk: pStr("Y"), SgdtLeaderChk: pStr("N")},
	}
	svc := NewGroup(&fakeGroupRepo{
		statsGroupMembers: groupMembers,
		statsMember:       member,
		statsWeekly:       3,
		statsTotalLoc:     12,
		statsWeeklyLoc:    5,
	})
	// 고정 start/end로 stats_period isoformat 결정성 확보.
	start := time.Date(2026, 5, 23, 6, 16, 30, 0, time.Local)
	end := time.Date(2026, 5, 30, 6, 16, 30, 0, time.Local)
	res, err := svc.GroupStats(100, &title, start, end)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.MemberCount != 1 || res.WeeklySchedules != 3 || res.TotalLocations != 12 || len(res.MemberStats) != 1 {
		t.Fatalf("unexpected aggregate: %+v", res)
	}
	// 7키 + stats_period + 8키 member_stat 구조 검증.
	b, _ := json.Marshal(res)
	want := `{"group_id":100,"group_title":"가족","member_count":1,"weekly_schedules":3,"total_locations":12,"stats_period":{"start_date":"2026-05-23T06:16:30","end_date":"2026-05-30T06:16:30","days":7},"member_stats":[{"mt_idx":1186,"mt_name":"홍길동","mt_nickname":"길동이","weekly_schedules":3,"total_locations":12,"weekly_locations":5,"is_owner":true,"is_leader":false}]}`
	if string(b) != want {
		t.Errorf("stats JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestGroupStatsNicknameFallback은 mt_nickname → mt_name → "멤버 {id}" 폴백 사슬을 검증한다.
func TestGroupStatsNicknameFallback(t *testing.T) {
	title := "g"
	mid := 7
	// nickname nil, name nil → 둘 다 "멤버 7".
	member := &model.Member{MtIdx: 7, MtName: nil, MtNickname: nil}
	svc := NewGroup(&fakeGroupRepo{
		statsGroupMembers: []model.GroupDetail{{MtIdx: &mid}},
		statsMember:       member,
	})
	res, err := svc.GroupStats(1, &title, time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.MemberStats) != 1 {
		t.Fatalf("expected 1 member_stat, got %d", len(res.MemberStats))
	}
	ms := res.MemberStats[0]
	if ms.MtName != "멤버 7" || ms.MtNickname != "멤버 7" {
		t.Fatalf("폴백 불일치: name=%q nickname=%q", ms.MtName, ms.MtNickname)
	}
}

// TestGroupStatsSkipMissingMember는 Member 조회 실패(continue)분이 member_count/member_stats에서
// 제외되는지 검증한다(member_count=len(member_stats)).
func TestGroupStatsSkipMissingMember(t *testing.T) {
	title := "g"
	mid := 99
	// statsMember=nil → Member 없음 → continue.
	svc := NewGroup(&fakeGroupRepo{
		statsGroupMembers: []model.GroupDetail{{MtIdx: &mid}},
		statsMember:       nil,
	})
	res, err := svc.GroupStats(1, &title, time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// member_ids는 1개지만 조회 실패로 member_stats=0 → member_count=0.
	if res.MemberCount != 0 || len(res.MemberStats) != 0 {
		t.Fatalf("continue 분 제외 실패: count=%d stats=%d", res.MemberCount, len(res.MemberStats))
	}
}

func TestGroupStatsError(t *testing.T) {
	title := "x"
	svc := NewGroup(&fakeGroupRepo{statsErr: errors.New("db down")})
	if _, err := svc.GroupStats(1, &title, time.Now(), time.Now()); err == nil {
		t.Fatalf("expected error")
	}
}
