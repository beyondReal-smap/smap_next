package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type GroupDetailRepository struct {
	db *gorm.DB
}

func NewGroupDetail(db *gorm.DB) *GroupDetailRepository {
	return &GroupDetailRepository{db: db}
}

// List는 필터 없이 offset/limit 목록(Python get_group_details와 동등). 정렬 없음(DB 기본 PK 순서).
func (r *GroupDetailRepository) List(skip, limit int) ([]model.GroupDetail, error) {
	out := make([]model.GroupDetail, 0)
	err := r.db.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// GetByID는 sgdt_idx 단건 조회. 없으면 (nil, nil)로 404 신호.
func (r *GroupDetailRepository) GetByID(id int) (*model.GroupDetail, error) {
	var gd model.GroupDetail
	err := r.db.Where("sgdt_idx = ?", id).First(&gd).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &gd, nil
}

// FindByMember는 mt_idx + show='Y' + exit='N' + discharge='N' 필터(Python get_member_group_details).
func (r *GroupDetailRepository) FindByMember(mtIdx int) ([]model.GroupDetail, error) {
	out := make([]model.GroupDetail, 0)
	err := r.db.Where(
		"mt_idx = ? AND sgdt_show = ? AND sgdt_exit = ? AND sgdt_discharge = ?",
		mtIdx, "Y", "N", "N",
	).Find(&out).Error
	return out, err
}

// FindByGroup은 sgt_idx + show='Y' + exit='N' + discharge='N' 필터(Python get_group_member_details).
func (r *GroupDetailRepository) FindByGroup(sgtIdx int) ([]model.GroupDetail, error) {
	out := make([]model.GroupDetail, 0)
	err := r.db.Where(
		"sgt_idx = ? AND sgdt_show = ? AND sgdt_exit = ? AND sgdt_discharge = ?",
		sgtIdx, "Y", "N", "N",
	).Find(&out).Error
	return out, err
}

// FindByIDs는 sgdt_idx 목록으로 GroupDetail을 배치 조회한다(500개 청크).
// Python geofence 잡(location_alerts.py:237)의 gd_map 사전로드와 동등:
//
//	db.query(GroupDetail).filter(GroupDetail.sgdt_idx.in_(chunk))  (show/exit/discharge 필터 없음)
//
// 반환은 {sgdt_idx: GroupDetail}. geofence 그룹 entry/exit 잡이 sgdt_idx→mt_idx 해석에 사용한다.
func (r *GroupDetailRepository) FindByIDs(sgdtIdxList []int) (map[int]model.GroupDetail, error) {
	out := make(map[int]model.GroupDetail)
	if len(sgdtIdxList) == 0 {
		return out, nil
	}
	const chunkSize = 500
	for i := 0; i < len(sgdtIdxList); i += chunkSize {
		end := i + chunkSize
		if end > len(sgdtIdxList) {
			end = len(sgdtIdxList)
		}
		var rows []model.GroupDetail
		if err := r.db.Where("sgdt_idx IN ?", sgdtIdxList[i:end]).Find(&rows).Error; err != nil {
			return nil, err
		}
		for j := range rows {
			out[rows[j].SgdtIdx] = rows[j]
		}
	}
	return out, nil
}
