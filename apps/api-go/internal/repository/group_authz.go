package repository

import (
	"context"

	"gorm.io/gorm"
)

// GroupAuthzRepository는 그룹 권한(G7) 판정 쿼리를 모은다. 멤버십 판정(IsCurrentGroupMember 등)은
// 위치 보호(G6)의 MembershipRepository를 그대로 재사용하고(임베드), 그룹장 판정만 더한다.
type GroupAuthzRepository struct {
	*MembershipRepository
}

func NewGroupAuthz(db *gorm.DB) *GroupAuthzRepository {
	return &GroupAuthzRepository{MembershipRepository: NewMembership(db)}
}

// IsGroupOwner는 mtIdx가 그룹 sgtIdx의 "현재 멤버"이면서 그룹장인지 쿼리 1회로 판정한다.
// 그룹장 = sgdt_owner_chk='Y' 또는 owner 표식이 없는 그룹의 생성자(groupOwnerSQL, 구버전 데이터 호환).
// 나간·강퇴·숨김 상태의 옛 그룹장/생성자 행은 인정하지 않는다(currentMemberSQL 조건).
func (r *GroupAuthzRepository) IsGroupOwner(ctx context.Context, mtIdx, sgtIdx int) (bool, error) {
	var rows []int
	err := r.db.WithContext(ctx).Raw(
		"SELECT 1 FROM smap_group_detail_t gd JOIN member_t m ON m.mt_idx = gd.mt_idx "+
			"WHERE gd.sgt_idx = ? AND gd.mt_idx = ? AND "+groupOwnerSQL("gd")+" AND "+currentMemberSQL("gd", "m")+" LIMIT 1",
		sgtIdx, mtIdx).Find(&rows).Error
	return len(rows) > 0, err
}
