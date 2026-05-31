package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type PushLogRepository struct {
	db *gorm.DB
}

func NewPushLog(db *gorm.DB) *PushLogRepository {
	return &PushLogRepository{db: db}
}

// List는 offset/limit 목록 ORDER BY plt_idx DESC(Python get_push_logs).
func (r *PushLogRepository) List(skip, limit int) ([]model.PushLog, error) {
	out := make([]model.PushLog, 0)
	err := r.db.Order("plt_idx desc").Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// GetByID는 plt_idx 단건(Python PushLog.find_by_idx). 없으면 (nil, nil).
func (r *PushLogRepository) GetByID(id int) (*model.PushLog, error) {
	var p model.PushLog
	err := r.db.Where("plt_idx = ?", id).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// FindByMember는 mt_idx + plt_show='Y' + plt_status=2 + plt_sdate>=(now-7d) ORDER BY plt_sdate DESC
// (Python get_member_push_logs, 최근 7일). recent/{id}도 동일.
func (r *PushLogRepository) FindByMember(mtIdx int) ([]model.PushLog, error) {
	sevenDaysAgo := time.Now().Add(-7 * 24 * time.Hour)
	out := make([]model.PushLog, 0)
	err := r.db.Where("mt_idx = ? AND plt_show = ? AND plt_status = ? AND plt_sdate >= ?",
		mtIdx, "Y", 2, sevenDaysAgo).
		Order("plt_sdate desc").Find(&out).Error
	return out, err
}

// FindBySchedule는 sst_idx + plt_show='Y'(Python PushLog.find_by_schedule).
func (r *PushLogRepository) FindBySchedule(sstIdx int) ([]model.PushLog, error) {
	out := make([]model.PushLog, 0)
	err := r.db.Where("sst_idx = ? AND plt_show = ?", sstIdx, "Y").Find(&out).Error
	return out, err
}

// FindUnread는 mt_idx + plt_read_chk='N' + plt_show='Y'(Python PushLog.find_unread).
func (r *PushLogRepository) FindUnread(mtIdx int) ([]model.PushLog, error) {
	out := make([]model.PushLog, 0)
	err := r.db.Where("mt_idx = ? AND plt_read_chk = ? AND plt_show = ?", mtIdx, "N", "Y").Find(&out).Error
	return out, err
}
