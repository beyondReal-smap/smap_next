package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type LocationRepository struct {
	db *gorm.DB
}

func NewLocation(db *gorm.DB) *LocationRepository {
	return &LocationRepository{db: db}
}

// List는 필터 없는 offset/limit 목록(Python get_locations, slt_show 필터 없음). 정렬 없음.
func (r *LocationRepository) List(skip, limit int) ([]model.Location, error) {
	out := make([]model.Location, 0)
	err := r.db.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// GetByID는 slt_idx 단건(slt_show 필터 없음). 없으면 (nil, nil).
func (r *LocationRepository) GetByID(id int) (*model.Location, error) {
	var l model.Location
	err := r.db.Where("slt_idx = ?", id).First(&l).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// FindByMember는 mt_idx + slt_show='Y'(Python Location.find_by_member). other-members도 동일.
func (r *LocationRepository) FindByMember(mtIdx int) ([]model.Location, error) {
	out := make([]model.Location, 0)
	err := r.db.Where("mt_idx = ? AND slt_show = ?", mtIdx, "Y").Find(&out).Error
	return out, err
}

// FindByGroupDetail은 sgdt_idx + slt_show='Y'(Python Location.find_by_group_detail).
func (r *LocationRepository) FindByGroupDetail(sgdtIdx int) ([]model.Location, error) {
	out := make([]model.Location, 0)
	err := r.db.Where("sgdt_idx = ? AND slt_show = ?", sgdtIdx, "Y").Find(&out).Error
	return out, err
}

// (myplays in/out은 Python이 dict(row) 버그로 항상 []를 반환하므로 쿼리 메서드를 두지 않는다.
//  서비스가 빈 배열을 직접 응답한다.)
