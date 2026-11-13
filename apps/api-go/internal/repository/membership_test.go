package repository

import (
	"context"
	"strings"
	"testing"

	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func sp(s string) *string { return &s }

// 운영 DB에 실제로 있는 (exit, discharge, show) 7개 조합(서버 확인 보고서 2절)의 판정을 고정한다.
// 기대값은 앱 화면의 멤버 목록(FindGroupMembers/FindByGroup: show='Y' AND discharge='N' AND exit='N')과 같다.
func TestCurrentMembershipCombos(t *testing.T) {
	cases := []struct {
		exit, discharge, show string
		rows                  int // 운영 행 수(참고)
		want                  bool
	}{
		{"N", "N", "Y", 1876, true},
		{"N", "N", "N", 167, false}, // 숨김(show=N): 목록에서 빠진다
		{"Y", "N", "N", 32, false},  // 나감
		{"N", "Y", "Y", 20, false},  // 강퇴(show=Y여도 목록에서 빠진다)
		{"Y", "N", "Y", 6, false},   // 나감(show=Y여도 빠진다)
		{"N", "Y", "N", 5, false},
		{"Y", "Y", "N", 1, false},
	}
	for _, c := range cases {
		if got := IsCurrentMembershipRow(sp(c.exit), sp(c.discharge), sp(c.show)); got != c.want {
			t.Errorf("(exit=%s,discharge=%s,show=%s): got %v want %v", c.exit, c.discharge, c.show, got, c.want)
		}
	}
	// NULL은 SQL '=' 비교에 걸리지 않으므로 멤버가 아니다(목록 쿼리와 동일).
	if IsCurrentMembershipRow(nil, sp("N"), sp("Y")) || IsCurrentMembershipRow(sp("N"), nil, sp("Y")) || IsCurrentMembershipRow(sp("N"), sp("N"), nil) {
		t.Error("NULL 값은 멤버로 인정하면 안 됨")
	}
	// ENUM('Y','N') 컬럼의 대소문자 비교는 DB 콜레이션을 따른다 — 동일하게 대소문자 무시.
	if !IsCurrentMembershipRow(sp("n"), sp("n"), sp("y")) {
		t.Error("대소문자 무시 비교가 아님")
	}
}

type captured struct {
	sql  string
	vars []interface{}
}

// membershipDB는 실행하지 않고 GORM이 만든 SQL·바인딩만 잡는 DryRun DB다(sqlite/sqlmock 의존성 추가 금지).
func membershipDB(t *testing.T) (*gorm.DB, *captured) {
	t.Helper()
	db, err := gorm.Open(gormmysql.New(gormmysql.Config{
		DSN: "user:pass@tcp(127.0.0.1:1)/none?parseTime=true", SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	cap := &captured{}
	record := func(tx *gorm.DB) {
		cap.sql = tx.Statement.SQL.String()
		cap.vars = append([]interface{}(nil), tx.Statement.Vars...)
	}
	for _, reg := range []func() error{
		func() error { return db.Callback().Query().After("gorm:query").Register("cap_q", record) },
		func() error { return db.Callback().Row().After("gorm:row").Register("cap_r", record) },
	} {
		if err := reg(); err != nil {
			t.Fatal(err)
		}
	}
	return db, cap
}

func mustContainAll(t *testing.T, sql string, want ...string) {
	t.Helper()
	for _, w := range want {
		if !strings.Contains(sql, w) {
			t.Errorf("SQL에 %q 가 없음: %s", w, sql)
		}
	}
}

func TestMembershipQueries(t *testing.T) {
	db, cap := membershipDB(t)
	r := NewMembership(db)
	ctx := context.Background()

	if _, err := r.IsCurrentGroupMember(ctx, 3, 10); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "smap_group_detail_t gd", "gd.sgt_idx = ?", "gd.mt_idx = ?",
		"gd.sgdt_show = 'Y'", "gd.sgdt_discharge = 'N'", "gd.sgdt_exit = 'N'", "m.mt_status = 1")
	if len(cap.vars) != 2 || cap.vars[0] != 10 || cap.vars[1] != 3 {
		t.Errorf("바인딩 [sgt, mt] 불일치: %v", cap.vars)
	}

	cap.sql = ""
	if ok, err := r.SharesCurrentGroup(ctx, 7, 7); err != nil || !ok || cap.sql != "" {
		t.Errorf("a==b는 쿼리 없이 true여야 함: ok=%v err=%v sql=%q", ok, err, cap.sql)
	}
	if _, err := r.SharesCurrentGroup(ctx, 3, 4); err != nil {
		t.Fatal(err)
	}
	// 쿼리 1회, 양쪽 모두 같은 현재 멤버 조건, 같은 그룹 조인.
	mustContainAll(t, cap.sql, "ga.sgt_idx", "gb.sgt_idx = ga.sgt_idx",
		"ga.sgdt_show = 'Y'", "ga.sgdt_discharge = 'N'", "ga.sgdt_exit = 'N'", "ma.mt_status = 1",
		"gb.sgdt_show = 'Y'", "gb.sgdt_discharge = 'N'", "gb.sgdt_exit = 'N'", "mb.mt_status = 1", "LIMIT 1")
	if len(cap.vars) != 2 || cap.vars[0] != 3 || cap.vars[1] != 4 {
		t.Errorf("바인딩 [a, b] 불일치: %v", cap.vars)
	}

	if _, err := r.ManagesMemberInSharedGroup(ctx, 1, 3); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "ga.sgdt_owner_chk = 'Y'", "ga.sgdt_leader_chk = 'Y'", "gb.sgdt_owner_chk <> 'Y'",
		"ga.sgdt_exit = 'N'", "gb.sgdt_discharge = 'N'")
	if strings.Count(cap.sql, "(") != strings.Count(cap.sql, ")") {
		t.Errorf("괄호가 맞지 않음: %s", cap.sql)
	}
	if ok, _ := r.ManagesMemberInSharedGroup(ctx, 5, 5); !ok {
		t.Error("본인은 항상 관리 가능")
	}

	if _, err := r.CurrentGroupMemberIDs(ctx, 10); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "gd.sgdt_show = 'Y'", "gd.sgdt_discharge = 'N'", "gd.sgdt_exit = 'N'")
}

// 멤버십 SQL이 앱 멤버 목록 쿼리와 같은 조건을 쓰는지(조건 표에서 파생되므로 목록과 어긋나면 이 테스트가 깨진다).
func TestMembershipMatchesListQueryConditions(t *testing.T) {
	db, cap := membershipDB(t)
	_, _ = NewGroupMember(db).FindGroupMembers(10)
	list := cap.sql
	for _, c := range currentMemberConds {
		if !strings.Contains(list, "sgd."+c.col+" = '"+c.val+"'") {
			t.Errorf("지도 목록 쿼리에 %s='%s' 조건이 없음(멤버십 기준과 어긋남): %s", c.col, c.val, list)
		}
	}
	if !strings.Contains(list, "m.mt_status = 1") {
		t.Errorf("지도 목록 쿼리의 mt_status=1 조건이 사라짐: %s", list)
	}
}
