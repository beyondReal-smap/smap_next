package repository

import (
	"context"
	"strings"

	"gorm.io/gorm"
)

// 현재 그룹 멤버 판정 — 위치 보호(G6)와 이후 그룹·일정·채팅 단계가 공유하는 단 하나의 기준이다.
//
// 기준은 앱 화면의 멤버 목록(FindGroupMembers: GET /group-members/member/:gid, FindByGroup:
// GET /members/group/:gid)이 쓰는 조건과 같다:
//
//	sgdt_show='Y' AND sgdt_discharge='N' AND sgdt_exit='N'   (두 목록 공통)
//	member_t.mt_status = 1                                   (지도 목록 FindGroupMembers만 추가)
//
// 지금 앱 화면에 멤버로 보이는 사람이 판정에서 탈락하면 지도가 비므로, 지도 목록의 조건을 그대로 따른다.
// NULL 값은 '='에 걸리지 않으므로(SQL 의미) 멤버로 인정하지 않는다 — 목록 쿼리와 동일하다.
// 이 표에서 SQL(currentMemberSQL)과 Go 평가기(IsCurrentMembershipRow)를 모두 만들어 둘이 어긋나지 않게 한다.
var currentMemberConds = [...]struct{ col, val string }{
	{"sgdt_show", "Y"},
	{"sgdt_discharge", "N"},
	{"sgdt_exit", "N"},
}

// IsCurrentMembershipRow는 smap_group_detail_t 한 행의 (exit, discharge, show)가 "현재 멤버"인지 판정한다.
// currentMemberSQL과 같은 표를 쓴다. 값 비교는 ENUM('Y','N') 컬럼 기준이며 대소문자는 구분하지 않는다
// (MySQL 기본 콜레이션 동작). nil(NULL)은 멤버가 아니다.
func IsCurrentMembershipRow(exit, discharge, show *string) bool {
	vals := map[string]*string{"sgdt_exit": exit, "sgdt_discharge": discharge, "sgdt_show": show}
	for _, c := range currentMemberConds {
		v := vals[c.col]
		if v == nil || !strings.EqualFold(*v, c.val) {
			return false
		}
	}
	return true
}

// currentMemberSQL은 별칭 gd(smap_group_detail_t)·m(member_t)에 대한 "현재 멤버" 조건 SQL 조각이다.
func currentMemberSQL(gd, m string) string {
	parts := make([]string, 0, len(currentMemberConds)+1)
	for _, c := range currentMemberConds {
		parts = append(parts, gd+"."+c.col+" = '"+c.val+"'")
	}
	parts = append(parts, m+".mt_status = 1")
	return strings.Join(parts, " AND ")
}

// MembershipRepository는 그룹 멤버십 판정 쿼리를 한 곳에 모은다.
type MembershipRepository struct {
	db *gorm.DB
}

func NewMembership(db *gorm.DB) *MembershipRepository {
	return &MembershipRepository{db: db}
}

// IsCurrentGroupMember는 mtIdx가 그룹 sgtIdx의 현재 멤버인지 쿼리 1회로 판정한다.
func (r *MembershipRepository) IsCurrentGroupMember(ctx context.Context, mtIdx, sgtIdx int) (bool, error) {
	var rows []int
	err := r.db.WithContext(ctx).Raw(
		"SELECT 1 FROM smap_group_detail_t gd JOIN member_t m ON m.mt_idx = gd.mt_idx "+
			"WHERE gd.sgt_idx = ? AND gd.mt_idx = ? AND "+currentMemberSQL("gd", "m")+" LIMIT 1",
		sgtIdx, mtIdx).Find(&rows).Error
	return len(rows) > 0, err
}

// SharesCurrentGroup은 두 회원이 함께 현재 멤버인 그룹이 하나라도 있는지 쿼리 1회로 판정한다.
// a == b이면 쿼리 없이 true(본인).
func (r *MembershipRepository) SharesCurrentGroup(ctx context.Context, a, b int) (bool, error) {
	if a == b {
		return true, nil
	}
	var rows []int
	err := r.db.WithContext(ctx).Raw(
		"SELECT 1 FROM smap_group_detail_t ga JOIN smap_group_detail_t gb ON gb.sgt_idx = ga.sgt_idx "+
			"JOIN member_t ma ON ma.mt_idx = ga.mt_idx JOIN member_t mb ON mb.mt_idx = gb.mt_idx "+
			"WHERE ga.mt_idx = ? AND gb.mt_idx = ? AND "+currentMemberSQL("ga", "ma")+" AND "+currentMemberSQL("gb", "mb")+" LIMIT 1",
		a, b).Find(&rows).Error
	return len(rows) > 0, err
}

// ManagesMemberInSharedGroup은 requester가 target의 장소를 대리 관리할 수 있는지 판정한다(쿼리 1회).
// 앱(Android MyPlaceViewModel canManageLocation, iOS 동일)의 규칙과 같다: 둘이 함께 현재 멤버인 그룹에서
// requester가 방장(sgdt_owner_chk='Y')이면 누구든, 리더(sgdt_leader_chk='Y')이면 방장이 아닌 대상만.
func (r *MembershipRepository) ManagesMemberInSharedGroup(ctx context.Context, requester, target int) (bool, error) {
	if requester == target {
		return true, nil
	}
	var rows []int
	err := r.db.WithContext(ctx).Raw(
		"SELECT 1 FROM smap_group_detail_t ga JOIN smap_group_detail_t gb ON gb.sgt_idx = ga.sgt_idx "+
			"JOIN member_t ma ON ma.mt_idx = ga.mt_idx JOIN member_t mb ON mb.mt_idx = gb.mt_idx "+
			"WHERE ga.mt_idx = ? AND gb.mt_idx = ? AND "+currentMemberSQL("ga", "ma")+" AND "+currentMemberSQL("gb", "mb")+
			" AND (ga.sgdt_owner_chk = 'Y' OR (ga.sgdt_leader_chk = 'Y' AND (gb.sgdt_owner_chk IS NULL OR gb.sgdt_owner_chk <> 'Y'))) LIMIT 1",
		requester, target).Find(&rows).Error
	return len(rows) > 0, err
}

// CurrentGroupMemberIDs는 그룹 sgtIdx의 현재 멤버 mt_idx 목록이다(응답 필터링용).
func (r *MembershipRepository) CurrentGroupMemberIDs(ctx context.Context, sgtIdx int) ([]int, error) {
	ids := make([]int, 0)
	err := r.db.WithContext(ctx).Raw(
		"SELECT gd.mt_idx FROM smap_group_detail_t gd JOIN member_t m ON m.mt_idx = gd.mt_idx "+
			"WHERE gd.sgt_idx = ? AND "+currentMemberSQL("gd", "m"), sgtIdx).Find(&ids).Error
	return ids, err
}

// GroupDetailOwner는 smap_group_detail_t.sgdt_idx 행의 회원 번호를 돌려준다. 행이 없으면 (0, false, nil).
func (r *MembershipRepository) GroupDetailOwner(ctx context.Context, sgdtIdx int) (int, bool, error) {
	var rows []int
	if err := r.db.WithContext(ctx).Raw(
		"SELECT mt_idx FROM smap_group_detail_t WHERE sgdt_idx = ? LIMIT 1", sgdtIdx).Find(&rows).Error; err != nil {
		return 0, false, err
	}
	if len(rows) == 0 {
		return 0, false, nil
	}
	return rows[0], true, nil
}
