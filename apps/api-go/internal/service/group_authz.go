package service

import "context"

// groupAuthzRepo는 GroupAuthz가 쓰는 판정 쿼리다(구현: repository.GroupAuthzRepository).
// 현재 멤버 판정은 위치 보호(G6)와 같은 repository/membership.go의 함수다.
type groupAuthzRepo interface {
	IsCurrentGroupMember(ctx context.Context, mtIdx, sgtIdx int) (bool, error)
	IsGroupOwner(ctx context.Context, mtIdx, sgtIdx int) (bool, error)
}

// GroupAuthz는 그룹 도메인 인가 규칙의 단일 구현이다(18단계 LocationAuthz와 같은 구조).
// 핸들러(GroupGuard)가 이 판정을 호출하고, 응답 형식(403/401)은 핸들러가 맡는다.
//
// Viewer.Authenticated=false(유효 토큰 없음)는 신원을 알 수 없으므로 판정을 건너뛴다. 무토큰 요청을
// 통과시킬지는 ROUTE_AUTH_MODE(미들웨어)와 라우트별 "앱 미사용 → 항상 401" 규칙이 이미 정했다.
type GroupAuthz struct {
	repo groupAuthzRepo
}

func NewGroupAuthz(repo groupAuthzRepo) *GroupAuthz { return &GroupAuthz{repo: repo} }

// CanViewGroup: 그룹의 현재 멤버만(조회·통계·멤버 목록).
func (a *GroupAuthz) CanViewGroup(ctx context.Context, v Viewer, sgtIdx int) error {
	if !v.Authenticated {
		return nil
	}
	ok, err := a.repo.IsCurrentGroupMember(ctx, v.MtIdx, sgtIdx)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

// CanManageGroup: 그룹장만(수정·삭제·복구·소유자 변경·강퇴·리더 지정).
// 리더는 허용하지 않는다 — 앱 UI도 그룹장에게만 해당 버튼을 보인다(Android isOwner, iOS isCurrentUserOwner).
func (a *GroupAuthz) CanManageGroup(ctx context.Context, v Viewer, sgtIdx int) error {
	if !v.Authenticated {
		return nil
	}
	ok, err := a.repo.IsGroupOwner(ctx, v.MtIdx, sgtIdx)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

// RemovalKind는 멤버 제거 요청이 자진 탈퇴인지 강퇴인지다.
type RemovalKind int

const (
	RemovalLeave RemovalKind = iota // 요청자가 자기 자신을 제거
	RemovalKick                     // 그룹장이 다른 멤버를 제거
)

// AuthorizeRemoval: 본인 제거는 자진 탈퇴(앱의 "그룹 나가기"가 같은 DELETE를 쓴다), 타인 제거는 그룹장만.
// 무토큰(warn 통과)은 신원이 없어 본인 여부를 알 수 없으므로 강퇴로 취급해 상태값만 보수적으로 기록한다.
func (a *GroupAuthz) AuthorizeRemoval(ctx context.Context, v Viewer, sgtIdx, target int) (RemovalKind, error) {
	if v.Authenticated && v.MtIdx == target {
		return RemovalLeave, nil
	}
	if err := a.CanManageGroup(ctx, v, sgtIdx); err != nil {
		return RemovalKick, err
	}
	return RemovalKick, nil
}

// CanSelf: 본인만.
func (a *GroupAuthz) CanSelf(v Viewer, target int) error {
	if !v.Authenticated || v.MtIdx == target {
		return nil
	}
	return ErrForbidden
}
