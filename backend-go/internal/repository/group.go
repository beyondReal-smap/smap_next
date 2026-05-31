package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type GroupRepository struct {
	db *gorm.DB
}

func NewGroup(db *gorm.DB) *GroupRepository {
	return &GroupRepository{db: db}
}

// GetByID는 sgt_idx로 단건 조회. sgt_show 필터 없음 — Python get_group(숨김 그룹도 반환)과 동등.
// 없으면 (nil, nil)로 404 신호.
func (r *GroupRepository) GetByID(id int) (*model.Group, error) {
	var g model.Group
	err := r.db.Where("sgt_idx = ?", id).First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// List는 그룹 목록. showHidden=false면 sgt_show='Y'만(Python get_groups와 동등).
// 정렬 없음 — Python도 ORDER BY 없이 DB 기본 순서를 그대로 쓴다.
func (r *GroupRepository) List(skip, limit int, showHidden bool) ([]model.Group, error) {
	q := r.db.Model(&model.Group{})
	if !showHidden {
		q = q.Where("sgt_show = ?", "Y")
	}
	out := make([]model.Group, 0)
	err := q.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// ListHidden은 숨김 그룹(sgt_show='N') 전체를 조회한다(Python get_hidden_groups와 동등). 정렬 없음.
func (r *GroupRepository) ListHidden() ([]model.Group, error) {
	out := make([]model.Group, 0)
	err := r.db.Where("sgt_show = ?", "N").Find(&out).Error
	return out, err
}

// FindByMember는 GroupDetail INNER JOIN으로 사용자가 속한(미탈퇴) 표시 그룹을 조회한다.
// Python Group.find_by_member와 동등: GroupDetail.sgdt_exit='N' AND Group.sgt_show='Y'.
// DISTINCT 없음 — 같은 그룹에 멤버십 행이 둘이면 Python처럼 중복 행을 그대로 반환한다.
// SELECT 절을 smap_group_t.*로 한정해 양 테이블 공통 컬럼(sgt_idx/mt_idx) 모호성을 피한다.
func (r *GroupRepository) FindByMember(mtIdx int) ([]model.Group, error) {
	out := make([]model.Group, 0)
	err := r.db.Model(&model.Group{}).
		Select("smap_group_t.*").
		Joins("JOIN smap_group_detail_t ON smap_group_detail_t.sgt_idx = smap_group_t.sgt_idx").
		Where("smap_group_detail_t.mt_idx = ? AND smap_group_detail_t.sgdt_exit = ? AND smap_group_t.sgt_show = ?",
			mtIdx, "N", "Y").
		Find(&out).Error
	return out, err
}

// FindByCode는 sgt_code + sgt_show='Y'로 단건 조회. Python Group.find_by_code와 동등.
// 없으면 (nil, nil).
func (r *GroupRepository) FindByCode(code string) (*model.Group, error) {
	var g model.Group
	err := r.db.Where("sgt_code = ? AND sgt_show = ?", code, "Y").First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}
