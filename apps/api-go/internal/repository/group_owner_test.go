package repository

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

// 그룹장 판정 보정(구버전 호환): 현재 멤버이면서 (owner_chk='Y' 또는 그룹 생성자).
// 단 다른 현재 멤버가 owner_chk='Y'이면 생성자 기록만으로는 그룹장이 아니다(이중 그룹장 방지, 재가입 초기화와 충돌 방지).

// ownerRule은 groupOwnerSQL + currentMemberSQL 의 Go 기준 구현이다. 아래 표가 기대값을 고정하고,
// DryRun 테스트가 SQL이 같은 조건을 담는지 확인한다(운영 DB 없이 실행 결과를 비교할 수 없어 둘로 나눠 고정한다).
func ownerRule(state, ownerChk string, isCreator, otherOwner bool) bool {
	exit, discharge, show := "N", "N", "Y"
	switch state {
	case "left": // 자진 탈퇴
		exit, discharge, show = "Y", "N", "N"
	case "kicked": // 강퇴
		exit, discharge, show = "Y", "Y", "N"
	}
	if !IsCurrentMembershipRow(&exit, &discharge, &show) {
		return false
	}
	if ownerChk == "Y" {
		return true
	}
	return isCreator && !otherOwner
}

func TestGroupOwnerCombinationTable(t *testing.T) {
	type tc struct {
		state, ownerChk string
		creator, other  bool
		want            bool
	}
	cases := []tc{
		// 현재 멤버
		{"member", "Y", true, false, true},   // 정상 그룹장(생성자)
		{"member", "Y", false, false, true},  // 위임받은 그룹장
		{"member", "N", true, false, true},   // 구 데이터: owner_chk 없이 생성자 -> 그룹장 (보정)
		{"member", "N", false, false, false}, // 일반 멤버
		{"member", "N", true, true, false},   // 생성자 기록이 낡고 다른 표식 그룹장이 있음 -> 아님
		// 자진 탈퇴(나간 사람은 어떤 조합이든 불가)
		{"left", "Y", true, false, false},
		{"left", "Y", false, false, false},
		{"left", "N", true, false, false}, // 생성자라는 이유로 권한 부활 불가
		{"left", "N", false, false, false},
		// 강퇴
		{"kicked", "Y", true, false, false},
		{"kicked", "Y", false, false, false},
		{"kicked", "N", true, false, false},
		{"kicked", "N", false, false, false},
	}
	for _, c := range cases {
		name := fmt.Sprintf("%s/owner_chk=%s/creator=%v/otherOwner=%v", c.state, c.ownerChk, c.creator, c.other)
		if got := ownerRule(c.state, c.ownerChk, c.creator, c.other); got != c.want {
			t.Errorf("%s: want %v, got %v", name, c.want, got)
		}
	}
}

func TestGroupOwnerSQLCarriesRules(t *testing.T) {
	frag := groupOwnerSQL("gd")
	mustContainAll(t, frag,
		"gd.sgdt_owner_chk = 'Y'",                   // 표식 그룹장
		"SELECT sgo.mt_idx FROM smap_group_t sgo",   // 생성자 조회
		"sgo.sgt_idx = gd.sgt_idx", ") = gd.mt_idx", // 요청 행의 회원과 비교
		"NOT EXISTS", "og.sgdt_owner_chk = 'Y'", // 다른 표식 그룹장이 있으면 생성자 기록은 무효
		"og.sgdt_show = 'Y'", "og.sgdt_discharge = 'N'", "og.sgdt_exit = 'N'", "om.mt_status = 1")
}

func TestIsGroupOwnerQueryCreatorFallback(t *testing.T) {
	db, cap := policyDB(t)
	if _, err := NewGroupAuthz(db).IsGroupOwner(context.Background(), 1, 10); err != nil {
		t.Fatal(err)
	}
	// 그룹장 조건과 현재 멤버 조건이 AND로 함께 걸린다(나간·강퇴된 생성자는 현재 멤버 조건에서 탈락).
	mustContainAll(t, cap.sql, "gd.sgdt_owner_chk = 'Y' OR", "smap_group_t sgo", "NOT EXISTS",
		") AND gd.sgdt_show = 'Y' AND gd.sgdt_discharge = 'N' AND gd.sgdt_exit = 'N' AND m.mt_status = 1")
	if len(cap.vars) != 2 || cap.vars[0] != 10 || cap.vars[1] != 1 {
		t.Errorf("바인딩 [sgt, mt] 불일치: %v", cap.vars)
	}
}

func TestRoleInGroupOwnerUsesSameRule(t *testing.T) {
	db, cap := membershipDB(t)
	if _, err := NewMembership(db).RoleInGroup(context.Background(), 3, 10); err != nil && !strings.Contains(err.Error(), "dry run") {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "AS is_owner", "gd.sgdt_owner_chk = 'Y' OR", "smap_group_t sgo", "NOT EXISTS", "sgdt_leader_chk")
}

func TestCurrentUserGroupsOwnerUsesSameRule(t *testing.T) {
	db, cap := policyDB(t)
	_, _ = NewGroup(db).CurrentUserGroups(7)
	mustContainAll(t, cap.sql, "AS is_owner_calc", "smap_group_detail_t.sgdt_owner_chk = 'Y' OR", "smap_group_t sgo", "NOT EXISTS")
}

func TestWriteReposIsGroupOwnerDelegates(t *testing.T) {
	db, cap := policyDB(t)
	if _, err := NewGroup(db).IsGroupOwner(10, 1); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "smap_group_t sgo", "gd.sgdt_owner_chk = 'Y'")
	if _, err := NewGroupMember(db).IsGroupOwner(10, 1); err != nil {
		t.Fatal(err)
	}
	mustContainAll(t, cap.sql, "smap_group_t sgo", "gd.sgdt_owner_chk = 'Y'")
}
