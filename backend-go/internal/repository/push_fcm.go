package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type PushFCMRepository struct {
	db *gorm.DB
}

func NewPushFCM(db *gorm.DB) *PushFCMRepository {
	return &PushFCMRepository{db: db}
}

// List는 offset/limit 목록(Python get_push_fcms, 정렬 없음).
func (r *PushFCMRepository) List(skip, limit int) ([]model.PushFCM, error) {
	out := make([]model.PushFCM, 0)
	err := r.db.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// GetByID는 pft_idx 단건(Python PushFCM.find_by_idx). 없으면 (nil, nil).
func (r *PushFCMRepository) GetByID(id int) (*model.PushFCM, error) {
	var p model.PushFCM
	err := r.db.Where("pft_idx = ?", id).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// FindByMember는 pft_send_mt_idx + pft_show='Y'(Python PushFCM.find_by_member).
func (r *PushFCMRepository) FindByMember(mtIdx int) ([]model.PushFCM, error) {
	out := make([]model.PushFCM, 0)
	err := r.db.Where("pft_send_mt_idx = ? AND pft_show = ?", mtIdx, "Y").Find(&out).Error
	return out, err
}

// FindByCode는 pft_code + pft_show='Y'(Python PushFCM.find_by_code).
func (r *PushFCMRepository) FindByCode(code string) ([]model.PushFCM, error) {
	out := make([]model.PushFCM, 0)
	err := r.db.Where("pft_code = ? AND pft_show = ?", code, "Y").Find(&out).Error
	return out, err
}

// FindPending은 pft_send_mt_idx + pft_show='Y' + pft_status=1 + [since 이후] + pft_rdate>=now()
// ORDER BY pft_rdate ASC(Python find_pending_messages_for_member). now()는 로컬 시각(시간창).
func (r *PushFCMRepository) FindPending(mtIdx int, since *float64) ([]model.PushFCM, error) {
	q := r.db.Where("pft_send_mt_idx = ? AND pft_show = ? AND pft_status = ?", mtIdx, "Y", 1)
	if since != nil {
		sec := int64(*since)
		nsec := int64((*since - float64(sec)) * 1e9)
		q = q.Where("pft_rdate >= ?", time.Unix(sec, nsec))
	}
	q = q.Where("pft_rdate >= ?", time.Now())
	out := make([]model.PushFCM, 0)
	err := q.Order("pft_rdate asc").Find(&out).Error
	return out, err
}
