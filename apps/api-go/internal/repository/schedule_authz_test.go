package repository

import (
	"context"
	"strings"
	"testing"
)

// S-3: 그룹 일정 조회는 그 그룹의 삭제되지 않은 일정만이다(회원 번호 OR 조건으로 다른 그룹 일정이 새지 않는다).
func TestFindGroupSchedulesGroupOnly(t *testing.T) {
	db, cap := membershipDB(t)
	if _, err := NewSchedule(db).FindGroupSchedules(10, nil); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sgt_idx = ?", "sst_show = ?")
	if strings.Contains(cap.sql, " OR ") {
		t.Errorf("그룹 일정 조회에 OR 조건이 있으면 안 됨: %s", cap.sql)
	}
}

// 전체 목록은 요청자 본인 일정 + 요청자가 현재 멤버인 그룹의 일정만이다(공통 멤버십 조건 사용).
func TestListForMemberScopedToRequester(t *testing.T) {
	db, cap := membershipDB(t)
	if _, err := NewSchedule(db).ListForMember(3, 0, 100); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sst_show", "mt_idx = ?", "sgt_idx IN", "sgdt_show", "sgdt_discharge", "sgdt_exit", "mt_status")
}

// S-4: 소유 그룹 조회는 현재 멤버 조건과 삭제되지 않은 그룹 조건을 건다.
func TestOwnerGroupsCurrentMemberOnly(t *testing.T) {
	db, cap := membershipDB(t)
	// Scan은 DryRun에서 "dry run mode unsupported"를 돌려주지만 SQL은 잡힌다.
	if _, err := NewGroupScheduleManage(db).OwnerGroups(1); err != nil && !strings.Contains(err.Error(), "dry run") {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sgdt_show", "sgdt_discharge", "sgdt_exit", "mt_status", "sg.sgt_show")
}

// 역할 조회는 현재 멤버 조건과 삭제되지 않은 그룹 조건을 건다(나간·강퇴·숨김·삭제 그룹은 Found=false).
func TestRoleInGroupQuery(t *testing.T) {
	db, cap := membershipDB(t)
	if _, err := NewMembership(db).RoleInGroup(context.Background(), 3, 10); err != nil && !strings.Contains(err.Error(), "dry run") {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "sgdt_show", "sgdt_discharge", "sgdt_exit", "mt_status", "sgt_show")
}

// S-1: 반복 일정 일괄 쓰기 SQL은 모두 그룹 조건(sgt_idx = ?)을 가진다.
func TestGSMWriteSQLCarriesGroupCondition(t *testing.T) {
	if !strings.Contains(gsmSoftDeleteSQL, "sgt_idx = ?") {
		t.Errorf("soft delete SQL에 그룹 조건 없음: %s", gsmSoftDeleteSQL)
	}
}

// C-1/C-2: 채팅 멤버십 조회는 공통 멤버십 조건을 쓰고, DM은 같은 그룹의 현재 멤버끼리만 통과한다.
func TestChatMembershipQueries(t *testing.T) {
	db, cap := membershipDB(t)
	r := NewChat(db)
	if _, err := r.ShareActiveGroup(1, 2); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "ga.sgdt_show", "gb.sgdt_show", "gb.sgdt_exit", "ma.mt_status", "mb.mt_status", "sgt_show")
	if ok, _ := r.ShareActiveGroup(5, 5); ok {
		t.Error("자기 자신과의 DM은 허용되지 않음")
	}
	if _, err := r.groupMemberCurrent(10, 3); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "gd.sgt_idx = ?", "gd.sgdt_discharge", "gd.sgdt_exit", "m.mt_status", "sg.sgt_show")
}
