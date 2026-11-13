package service

import (
	"context"
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/repository"
)

type roleMap map[int]repository.GroupRole

func (r roleMap) RoleInGroup(_ context.Context, mt, _ int) (repository.GroupRole, error) {
	return r[mt], nil
}

func authzWorld() roleMap {
	return roleMap{
		1: {Found: true, SgdtIdx: 101, Owner: true},
		2: {Found: true, SgdtIdx: 102, Leader: true},
		3: {Found: true, SgdtIdx: 103},
		9: {Found: true, SgdtIdx: 109}, // 일반 멤버(작성자 이탈 케이스용 아님)
	}
}

func ip(v int) *int { return &v }

func TestResolveTargetRules(t *testing.T) {
	ctx := context.Background()
	w := authzWorld()
	strict := NewScheduleAuthz(w, false, false)
	legacy := NewScheduleAuthz(w, false, true)
	leaderOwner := NewScheduleAuthz(w, true, false)

	cases := []struct {
		name   string
		a      *ScheduleAuthz
		actor  int
		target *int
		want   error
		wantMt int
	}{
		{"일반 멤버 본인(대상 없음)", strict, 3, nil, nil, 3},
		{"일반 멤버 본인(iOS targetMemberId=본인)", strict, 3, ip(3), nil, 3},
		{"일반 멤버 타인(원안)", strict, 3, ip(1), ErrScheduleManageDenied, 0},
		{"일반 멤버 타인(구버전 호환 플래그)", legacy, 3, ip(1), nil, 1},
		{"일반 멤버 비멤버 대상(플래그여도 거부)", legacy, 3, ip(8), ErrScheduleTargetInvalid, 0},
		{"그룹장 → 일반 멤버", strict, 1, ip(3), nil, 3},
		{"그룹장 → 비멤버", strict, 1, ip(8), ErrScheduleTargetInvalid, 0},
		{"리더 → 일반 멤버", strict, 2, ip(3), nil, 3},
		{"리더 → 그룹장(원안: 거부)", strict, 2, ip(1), ErrScheduleManageDenied, 0},
		{"리더 → 그룹장(SCHEDULE_LEADER_MANAGE_OWNER)", leaderOwner, 2, ip(1), nil, 1},
		{"비멤버 요청자", strict, 8, nil, ErrScheduleNotMember, 0},
	}
	for _, c := range cases {
		role, _ := c.a.Role(ctx, c.actor, 10)
		got, err := c.a.ResolveCreateTarget(ctx, c.actor, 10, role, c.target, nil)
		if !errors.Is(err, c.want) {
			t.Errorf("%s: err=%v want %v", c.name, err, c.want)
			continue
		}
		if err == nil && got.MtIdx != c.wantMt {
			t.Errorf("%s: target=%d want %d", c.name, got.MtIdx, c.wantMt)
		}
	}
	// sgdt_idx가 대상의 것이 아니면 거부
	role, _ := strict.Role(ctx, 1, 10)
	if _, err := strict.ResolveTarget(ctx, 1, 10, role, ip(3), ip(999)); !errors.Is(err, ErrScheduleTargetInvalid) {
		t.Errorf("다른 sgdt_idx는 거부: %v", err)
	}
	if _, err := strict.ResolveTarget(ctx, 1, 10, role, ip(3), ip(103)); err != nil {
		t.Errorf("대상의 sgdt_idx는 허용: %v", err)
	}
}

func TestCanModify(t *testing.T) {
	ctx := context.Background()
	a := NewScheduleAuthz(authzWorld(), false, false)
	for _, c := range []struct {
		name   string
		actor  int
		author *int
		want   error
	}{
		{"작성자 본인(일반)", 3, ip(3), nil},
		{"일반 멤버가 남의 일정", 3, ip(9), ErrScheduleManageDenied},
		{"그룹장이 남의 일정", 1, ip(3), nil},
		{"리더가 일반 멤버 일정", 2, ip(3), nil},
		{"리더가 그룹장 일정", 2, ip(1), ErrScheduleManageDenied},
		{"리더가 이미 나간 작성자의 일정", 2, ip(77), nil},
		{"일반 멤버가 이미 나간 작성자의 일정", 3, ip(77), ErrScheduleManageDenied},
	} {
		role, _ := a.Role(ctx, c.actor, 10)
		if err := a.CanModify(ctx, c.actor, 10, role, c.author); !errors.Is(err, c.want) {
			t.Errorf("%s: err=%v want %v", c.name, err, c.want)
		}
	}
}
