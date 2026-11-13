package service

import (
	"context"
	"errors"
	"log/slog"

	"github.com/bluemusk/smap_next_go/internal/repository"
)

// 일정 인가 오류. 핸들러가 403으로 바꾼다(그 외 오류는 500).
var (
	// ErrScheduleNotMember: 요청자가 그 그룹의 현재 멤버가 아니다(나간·강퇴·숨김·다른 그룹 포함).
	ErrScheduleNotMember = errors.New("schedule authz: not a current group member")
	// ErrScheduleManageDenied: 작성자 본인도 아니고 그 그룹의 그룹장·리더(권한 있는 쪽)도 아니다.
	ErrScheduleManageDenied = errors.New("schedule authz: manage permission required")
	// ErrScheduleTargetInvalid: 일정 대상 회원이 그 그룹의 현재 멤버가 아니거나 sgdt_idx가 대상의 것이 아니다.
	ErrScheduleTargetInvalid = errors.New("schedule authz: target must be a current group member")
	// ErrScheduleOwnerChange: 개인 일정의 소유자·그룹을 바꾸려 했다.
	ErrScheduleOwnerChange = errors.New("schedule authz: cannot change schedule owner")
)

// ScheduleTarget은 확정된 일정 대상(소유 회원과 그 그룹 안의 sgdt_idx)이다.
type ScheduleTarget struct {
	MtIdx   int
	SgdtIdx int
}

// scheduleMembership은 ScheduleAuthz가 쓰는 멤버십 조회다(구현: repository.MembershipRepository).
type scheduleMembership interface {
	RoleInGroup(ctx context.Context, mtIdx, sgtIdx int) (repository.GroupRole, error)
}

// ScheduleAuthz는 일정 인가 규칙의 단일 구현이다(`/schedules/*`와 `/schedule/group/*`가 같은 규칙을 쓴다).
//
//	조회: 그 그룹의 현재 멤버
//	생성: 본인 일정 = 그 그룹 현재 멤버면 누구나 / 타인 일정 = 요청자가 그룹장·리더이고 대상이 현재 멤버
//	수정·삭제: 작성자 본인, 또는 그 그룹의 그룹장·리더
//
// 리더는 그룹장의 일정을 관리할 수 없다(앱 canManageSchedule 규칙). SCHEDULE_LEADER_MANAGE_OWNER=true면 허용한다.
type ScheduleAuthz struct {
	m                 scheduleMembership
	leaderManageOwner bool
	// nonLeaderTargetOthers: 생성 시 일반 멤버도 같은 그룹 현재 멤버를 대상으로 지정 가능(구버전 앱 호환, 계측).
	nonLeaderTargetOthers bool
}

func NewScheduleAuthz(m scheduleMembership, leaderManageOwner, nonLeaderTargetOthers bool) *ScheduleAuthz {
	return &ScheduleAuthz{m: m, leaderManageOwner: leaderManageOwner, nonLeaderTargetOthers: nonLeaderTargetOthers}
}

// Role은 요청자의 그룹 내 역할을 돌려준다. 현재 멤버가 아니면 Found=false(오류 아님).
func (a *ScheduleAuthz) Role(ctx context.Context, uid, sgtIdx int) (repository.GroupRole, error) {
	return a.m.RoleInGroup(ctx, uid, sgtIdx)
}

// RequireMember는 요청자가 그 그룹의 현재 멤버가 아니면 ErrScheduleNotMember를 돌려준다.
func (a *ScheduleAuthz) RequireMember(ctx context.Context, uid, sgtIdx int) (repository.GroupRole, error) {
	role, err := a.m.RoleInGroup(ctx, uid, sgtIdx)
	if err != nil {
		return role, err
	}
	if !role.Found {
		return role, ErrScheduleNotMember
	}
	return role, nil
}

// CanModify는 요청자(actor, 역할 role)가 작성자 authorMt의 일정을 수정·삭제할 수 있는지 판정한다.
// authorMt가 nil이면 작성자를 알 수 없는 일정이라 관리 권한자만 허용한다.
func (a *ScheduleAuthz) CanModify(ctx context.Context, actor, sgtIdx int, role repository.GroupRole, authorMt *int) error {
	if authorMt != nil && *authorMt == actor {
		return nil
	}
	if !role.CanManage() {
		return ErrScheduleManageDenied
	}
	if role.Owner || a.leaderManageOwner || authorMt == nil {
		return nil
	}
	// 리더: 그룹장의 일정은 관리할 수 없다. 작성자가 이미 그룹을 나간 경우는 그룹장이 아니므로 허용한다.
	author, err := a.m.RoleInGroup(ctx, *authorMt, sgtIdx)
	if err != nil {
		return err
	}
	if author.Found && author.Owner {
		return ErrScheduleManageDenied
	}
	return nil
}

// ResolveTarget은 일정 생성·대상 변경에서 대상을 확정한다.
// target이 nil/0이거나 요청자 본인이면 본인(관리 권한 불필요). 타인이면 요청자가 그룹장·리더이고(리더는 그룹장 제외)
// 대상이 그 그룹의 현재 멤버여야 한다. sgdt가 주어지면 대상의 sgdt_idx와 같아야 한다.
func (a *ScheduleAuthz) ResolveTarget(ctx context.Context, actor, sgtIdx int, actorRole repository.GroupRole, target, sgdt *int) (ScheduleTarget, error) {
	return a.resolveTarget(ctx, actor, sgtIdx, actorRole, target, sgdt, false)
}

// ResolveCreateTarget은 생성용이다. SCHEDULE_NONLEADER_TARGET_OTHERS=true면 일반 멤버도 그 그룹의 현재 멤버를 대상으로
// 지정할 수 있고(구버전 호환, 사용 시 역할만 담은 계측 로그), 그룹과 무관한 대상은 항상 거부한다.
func (a *ScheduleAuthz) ResolveCreateTarget(ctx context.Context, actor, sgtIdx int, actorRole repository.GroupRole, target, sgdt *int) (ScheduleTarget, error) {
	return a.resolveTarget(ctx, actor, sgtIdx, actorRole, target, sgdt, a.nonLeaderTargetOthers)
}

func (a *ScheduleAuthz) resolveTarget(ctx context.Context, actor, sgtIdx int, actorRole repository.GroupRole, target, sgdt *int, legacyOthers bool) (ScheduleTarget, error) {
	if !actorRole.Found {
		return ScheduleTarget{}, ErrScheduleNotMember
	}
	t := ScheduleTarget{MtIdx: actor, SgdtIdx: actorRole.SgdtIdx}
	if target != nil && *target != 0 && *target != actor {
		legacy := legacyOthers && !actorRole.CanManage()
		if !actorRole.CanManage() && !legacy {
			return ScheduleTarget{}, ErrScheduleManageDenied
		}
		tr, err := a.m.RoleInGroup(ctx, *target, sgtIdx)
		if err != nil {
			return ScheduleTarget{}, err
		}
		if !tr.Found {
			return ScheduleTarget{}, ErrScheduleTargetInvalid
		}
		if legacy {
			slog.Info("schedule_nonleader_target_others", slog.String("actor_role", "member"), slog.Bool("target_is_owner", tr.Owner))
		} else if !actorRole.Owner && !a.leaderManageOwner && tr.Owner {
			return ScheduleTarget{}, ErrScheduleManageDenied
		}
		t = ScheduleTarget{MtIdx: *target, SgdtIdx: tr.SgdtIdx}
	}
	if sgdt != nil && *sgdt != 0 && *sgdt != t.SgdtIdx {
		return ScheduleTarget{}, ErrScheduleTargetInvalid
	}
	return t, nil
}
