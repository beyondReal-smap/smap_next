package repository

import (
	"context"
	"testing"
	"time"

	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// G7 쿼리 조건은 GORM DryRun으로 검증한다(실행 없이 SQL·바인딩만 잡는다).
func policyDB(t *testing.T) (*gorm.DB, *captured) {
	t.Helper()
	db, err := gorm.Open(gormmysql.New(gormmysql.Config{
		DSN: "user:pass@tcp(127.0.0.1:1)/none?parseTime=true", SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, SkipDefaultTransaction: true, DisableAutomaticPing: true, Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	cap := &captured{}
	record := func(tx *gorm.DB) {
		cap.sql = tx.Statement.SQL.String()
		cap.vars = append([]interface{}(nil), tx.Statement.Vars...)
	}
	if err := db.Callback().Query().After("gorm:query").Register("cap_q", record); err != nil {
		t.Fatal(err)
	}
	if err := db.Callback().Row().After("gorm:row").Register("cap_r", record); err != nil {
		t.Fatal(err)
	}
	if err := db.Callback().Update().After("gorm:update").Register("cap_u", record); err != nil {
		t.Fatal(err)
	}
	return db, cap
}

func TestIsGroupOwnerQuery(t *testing.T) {
	db, cap := policyDB(t)
	if _, err := NewGroupAuthz(db).IsGroupOwner(context.Background(), 1, 10); err != nil {
		t.Fatal(err)
	}
	// 그룹장 표식 + 현재 멤버 조건(나간·강퇴·숨김 옛 그룹장 행은 인정하지 않는다).
	mustContainAll(t, cap.sql, "gd.sgt_idx = ?", "gd.mt_idx = ?", "gd.sgdt_owner_chk = 'Y'",
		"gd.sgdt_show = 'Y'", "gd.sgdt_discharge = 'N'", "gd.sgdt_exit = 'N'", "m.mt_status = 1", "LIMIT 1")
	if len(cap.vars) != 2 || cap.vars[0] != 10 || cap.vars[1] != 1 {
		t.Errorf("바인딩 [sgt, mt] 불일치: %v", cap.vars)
	}
}

func TestListForMemberQuery(t *testing.T) {
	db, cap := policyDB(t)
	if _, err := NewGroup(db).ListForMember(7, 0, 50, false); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "smap_group_t", "sgt_idx IN (SELECT gd.sgt_idx", "gd.mt_idx = ?",
		"gd.sgdt_show = 'Y'", "gd.sgdt_discharge = 'N'", "gd.sgdt_exit = 'N'", "m.mt_status = 1", "sgt_show = ?", "LIMIT")
	if cap.vars[0] != 7 {
		t.Errorf("첫 바인딩은 요청자(7)여야 함: %v", cap.vars)
	}
	// showHidden=true면 sgt_show 조건이 빠지되 멤버 조건은 유지된다.
	if _, err := NewGroup(db).ListForMember(7, 0, 50, true); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "gd.mt_idx = ?")
	if contains(cap.sql, "smap_group_t.sgt_show") {
		t.Errorf("showHidden=true인데 sgt_show 조건이 남음: %s", cap.sql)
	}
}

func contains(s, sub string) bool {
	return len(sub) > 0 && len(s) >= len(sub) && (func() bool { return indexOf(s, sub) >= 0 })()
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestKickAndLeaveStateValues(t *testing.T) {
	db, cap := policyDB(t)
	r := NewGroup(db)
	now := time.Now()
	if err := r.KickMembership(10, 3, now); err != nil {
		t.Fatal(err)
	}
	// 강퇴 = (exit=Y, discharge=Y, show=N) + 권한 표식 해제
	mustContainAll(t, cap.sql, "UPDATE `smap_group_detail_t` SET", "`sgdt_discharge`=?", "`sgdt_exit`=?", "`sgdt_show`=?", "sgt_idx = ? AND mt_idx = ?")
	hasY := 0
	for _, v := range cap.vars {
		if v == "Y" {
			hasY++
		}
	}
	if hasY != 2 { // discharge, exit
		t.Errorf("강퇴는 discharge='Y', exit='Y'를 기록해야 함: %v", cap.vars)
	}
	if err := r.LeaveMembership(10, 3, now); err != nil {
		t.Fatal(err)
	}
	if contains(cap.sql, "sgdt_discharge") {
		t.Errorf("자진 탈퇴는 discharge를 건드리면 안 됨: %s", cap.sql)
	}
	if err := r.RejoinMembership(&model.GroupDetail{SgdtIdx: 5}, now); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "`sgdt_leader_chk`=?", "`sgdt_owner_chk`=?", "`sgdt_discharge`=?", "sgdt_idx = ?")
}

func TestFindMembershipRowsAndCurrent(t *testing.T) {
	db, cap := policyDB(t)
	r := NewGroup(db)
	if _, err := r.FindMembershipRows(10, 3); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sgt_idx = ? AND mt_idx = ?", "ORDER BY sgdt_idx ASC")
	if _, err := r.FindCurrentMembership(10, 3); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sgdt_show = 'Y'", "sgdt_discharge = 'N'", "sgdt_exit = 'N'")
}
