package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// 그룹 권한(G7)이 쓰는 그룹/멤버십 쿼리. 기존 group.go의 메서드는 건드리지 않고 이 파일에 모은다.
//
// 상태값 규약(18단계 조합 표, 운영 데이터 기준):
//   - 자진 탈퇴  = (exit='Y', discharge='N', show='N')
//   - 강퇴       = (exit='Y', discharge='Y', show='N')   ← 이번 단계부터 기록
//   - 현재 멤버  = (exit='N', discharge='N', show='Y')
//
// discharge='Y' 행이 하나라도 있는 (그룹, 회원) 쌍은 재가입을 거부한다.

// ListForMember는 mtIdx가 현재 멤버인 그룹만 돌려준다(GET /groups/ 요청자 한정).
// showHidden=false면 sgt_show='Y'만. 정렬은 기존 List와 같이 DB 기본 순서, skip/limit은 필터 후 적용.
func (r *GroupRepository) ListForMember(mtIdx, skip, limit int, showHidden bool) ([]model.Group, error) {
	q := r.db.Model(&model.Group{}).
		Where("smap_group_t.sgt_idx IN (?)",
			r.db.Table("smap_group_detail_t gd").Select("gd.sgt_idx").
				Joins("JOIN member_t m ON m.mt_idx = gd.mt_idx").
				Where("gd.mt_idx = ? AND "+currentMemberSQL("gd", "m"), mtIdx))
	if !showHidden {
		q = q.Where("smap_group_t.sgt_show = ?", "Y")
	}
	out := make([]model.Group, 0)
	err := q.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// FindMembershipRows는 (그룹, 회원)의 모든 멤버십 행을 sgdt_idx 순으로 돌려준다(중복 행·재가입 이력 판정용).
func (r *GroupRepository) FindMembershipRows(sgtIdx, mtIdx int) ([]model.GroupDetail, error) {
	out := make([]model.GroupDetail, 0)
	err := r.db.Where("sgt_idx = ? AND mt_idx = ?", sgtIdx, mtIdx).Order("sgdt_idx ASC").Find(&out).Error
	return out, err
}

// RejoinMembership은 자진 탈퇴한 행을 되살린다. 권한은 초기화한다(리더·그룹장 표식 'N') — 나가기 전 권한이
// 재가입으로 되살아나지 않게 한다. discharge는 'N'(강퇴 이력이 있으면 서비스가 이 호출 전에 거부한다).
func (r *GroupRepository) RejoinMembership(gd *model.GroupDetail, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgdt_idx = ?", gd.SgdtIdx).
		Updates(map[string]interface{}{
			"sgdt_show": "Y", "sgdt_exit": "N", "sgdt_discharge": "N",
			"sgdt_owner_chk": "N", "sgdt_leader_chk": "N", "sgdt_udate": now,
		}).Error
}

// KickMembership은 강퇴를 기록한다(show='N', exit='Y', discharge='Y'). 같은 (그룹, 회원)의 모든 현재 행에 적용한다.
func (r *GroupRepository) KickMembership(sgtIdx, mtIdx int, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgt_idx = ? AND mt_idx = ?", sgtIdx, mtIdx).
		Updates(map[string]interface{}{
			"sgdt_show": "N", "sgdt_exit": "Y", "sgdt_discharge": "Y",
			"sgdt_owner_chk": "N", "sgdt_leader_chk": "N", "sgdt_udate": now,
		}).Error
}

// LeaveMembership은 자진 탈퇴를 기록한다(show='N', exit='Y', discharge 불변, 리더 표식 해제).
func (r *GroupRepository) LeaveMembership(sgtIdx, mtIdx int, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgt_idx = ? AND mt_idx = ?", sgtIdx, mtIdx).
		Updates(map[string]interface{}{
			"sgdt_show": "N", "sgdt_exit": "Y", "sgdt_leader_chk": "N", "sgdt_udate": now,
		}).Error
}

// FindCurrentMembership은 (그룹, 회원)의 현재 멤버 행 하나를 돌려준다. 없으면 (nil, nil).
func (r *GroupRepository) FindCurrentMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	var rows []model.GroupDetail
	err := r.db.Where("sgt_idx = ? AND mt_idx = ? AND sgdt_show = 'Y' AND sgdt_discharge = 'N' AND sgdt_exit = 'N'", sgtIdx, mtIdx).
		Order("sgdt_idx ASC").Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

// TransferOwnership은 그룹장을 newOwner에게 넘긴다. 한 트랜잭션에서
// 그룹 행(mt_idx), 기존 그룹장 행(owner 'N'), 새 그룹장 행(owner 'Y', leader 'N')을 함께 바꾼다
// (기존 구현은 smap_group_t.mt_idx만 바꿔 두 표식이 어긋났다).
func (r *GroupRepository) TransferOwnership(g *model.Group, newOwner int, now time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.GroupDetail{}).
			Where("sgt_idx = ? AND sgdt_owner_chk = ?", g.SgtIdx, "Y").
			Updates(map[string]interface{}{"sgdt_owner_chk": "N", "sgdt_udate": now}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.GroupDetail{}).
			Where("sgt_idx = ? AND mt_idx = ? AND sgdt_show = 'Y' AND sgdt_discharge = 'N' AND sgdt_exit = 'N'", g.SgtIdx, newOwner).
			Updates(map[string]interface{}{"sgdt_owner_chk": "Y", "sgdt_leader_chk": "N", "sgdt_udate": now}).Error; err != nil {
			return err
		}
		return tx.Model(&model.Group{}).Where("sgt_idx = ?", g.SgtIdx).
			Updates(map[string]interface{}{"mt_idx": newOwner, "sgt_udate": now}).Error
	})
}

// IsGroupOwner는 mtIdx가 그룹 sgtIdx의 현재 멤버이면서 그룹장(owner_chk 또는 생성자, groupOwnerSQL)인지 판정한다.
// 인가 판정(GroupAuthzRepository.IsGroupOwner)과 같은 쿼리를 재사용해 기준이 갈라지지 않게 한다.
func (r *GroupRepository) IsGroupOwner(sgtIdx, mtIdx int) (bool, error) {
	return NewGroupAuthz(r.db).IsGroupOwner(context.Background(), mtIdx, sgtIdx)
}
