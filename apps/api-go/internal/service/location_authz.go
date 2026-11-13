package service

import (
	"context"
	"errors"
)

// ErrForbidden은 요청자가 대상 위치 정보에 접근할 권한이 없음을 뜻한다(핸들러가 403으로 바꾼다).
var ErrForbidden = errors.New("location authz: forbidden")

// Viewer는 요청자 신원이다. Authenticated=false는 유효한 토큰이 없는 요청(LOCATION_AUTH_MODE=warn 통과분)이다.
// 이 경우 신원을 알 수 없어 소유권 판정을 할 수 없으므로 판정은 건너뛴다(잔여 위험은 보고서에 기록).
type Viewer struct {
	MtIdx         int
	Authenticated bool
}

// membershipChecker는 LocationAuthz가 쓰는 멤버십 판정 인터페이스다(구현: repository.MembershipRepository).
type membershipChecker interface {
	IsCurrentGroupMember(ctx context.Context, mtIdx, sgtIdx int) (bool, error)
	SharesCurrentGroup(ctx context.Context, a, b int) (bool, error)
	ManagesMemberInSharedGroup(ctx context.Context, requester, target int) (bool, error)
	CurrentGroupMemberIDs(ctx context.Context, sgtIdx int) ([]int, error)
	GroupDetailOwner(ctx context.Context, sgdtIdx int) (int, bool, error)
}

// LocationAuthz는 위치 정보 접근 규칙의 단일 구현이다. 핸들러는 판정을 여기에 위임한다.
type LocationAuthz struct {
	m membershipChecker
	// PlaceLeaderManage: 장소 변경을 방장·리더에게도 허용(LOCATION_PLACE_LEADER_MANAGE).
	placeLeaderManage bool
}

func NewLocationAuthz(m membershipChecker, placeLeaderManage bool) *LocationAuthz {
	return &LocationAuthz{m: m, placeLeaderManage: placeLeaderManage}
}

// CanViewMember: 본인이거나 대상과 같은 그룹의 현재 멤버여야 한다.
func (a *LocationAuthz) CanViewMember(ctx context.Context, v Viewer, target int) error {
	if !v.Authenticated || v.MtIdx == target {
		return nil
	}
	ok, err := a.m.SharesCurrentGroup(ctx, v.MtIdx, target)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

// CanViewGroup: 그룹의 현재 멤버여야 한다.
func (a *LocationAuthz) CanViewGroup(ctx context.Context, v Viewer, sgtIdx int) error {
	if !v.Authenticated {
		return nil
	}
	ok, err := a.m.IsCurrentGroupMember(ctx, v.MtIdx, sgtIdx)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

// CanViewGroupDetail: sgdt_idx 행의 회원 위치(장소)를 볼 수 있는지. 행이 없으면 (false, nil)로 알린다(빈 결과).
func (a *LocationAuthz) CanViewGroupDetail(ctx context.Context, v Viewer, sgdtIdx int) error {
	if !v.Authenticated {
		return nil
	}
	owner, found, err := a.m.GroupDetailOwner(ctx, sgdtIdx)
	if err != nil {
		return err
	}
	if !found {
		return nil // 존재하지 않는 행: 내줄 데이터가 없다.
	}
	return a.CanViewMember(ctx, v, owner)
}

// CanSelf: 본인만. 위치 덮어쓰기·업로드 등에 쓴다.
func (a *LocationAuthz) CanSelf(v Viewer, target int) error {
	if !v.Authenticated || v.MtIdx == target {
		return nil
	}
	return ErrForbidden
}

// CanManagePlace: 장소의 소유자(target)에 대한 생성·수정·삭제·알림 변경 권한.
// 소유자 본인은 항상 허용. LOCATION_PLACE_LEADER_MANAGE가 켜져 있으면 같은 그룹의 방장(리더는 방장 제외)도 허용.
func (a *LocationAuthz) CanManagePlace(ctx context.Context, v Viewer, owner int) error {
	if !v.Authenticated || v.MtIdx == owner {
		return nil
	}
	if !a.placeLeaderManage {
		return ErrForbidden
	}
	ok, err := a.m.ManagesMemberInSharedGroup(ctx, v.MtIdx, owner)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

// FilterGroupMembers는 ids 중 그룹의 현재 멤버만 남긴다(전체 회원 번호 노출 방지).
func (a *LocationAuthz) FilterGroupMembers(ctx context.Context, sgtIdx int, ids []int) ([]int, error) {
	members, err := a.m.CurrentGroupMemberIDs(ctx, sgtIdx)
	if err != nil {
		return nil, err
	}
	set := make(map[int]struct{}, len(members))
	for _, id := range members {
		set[id] = struct{}{}
	}
	out := make([]int, 0, len(ids))
	for _, id := range ids {
		if _, ok := set[id]; ok {
			out = append(out, id)
		}
	}
	return out, nil
}
