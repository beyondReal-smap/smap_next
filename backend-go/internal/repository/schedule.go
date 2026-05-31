package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type ScheduleRepository struct {
	db *gorm.DB
}

func NewSchedule(db *gorm.DB) *ScheduleRepository {
	return &ScheduleRepository{db: db}
}

// List는 필터 없는 offset/limit 목록(Python get_schedules, sst_show 필터 없음). 정렬 없음.
func (r *ScheduleRepository) List(skip, limit int) ([]model.Schedule, error) {
	out := make([]model.Schedule, 0)
	err := r.db.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// GetByID는 sst_idx 단건(Python Schedule.find_by_idx). 없으면 (nil, nil).
func (r *ScheduleRepository) GetByID(id int) (*model.Schedule, error) {
	var s model.Schedule
	err := r.db.Where("sst_idx = ?", id).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// FindByMember는 mt_idx + sst_show='Y' ORDER BY sst_sdate(Python Schedule.find_by_member).
func (r *ScheduleRepository) FindByMember(mtIdx int) ([]model.Schedule, error) {
	out := make([]model.Schedule, 0)
	err := r.db.Where("mt_idx = ? AND sst_show = ?", mtIdx, "Y").
		Order("sst_sdate").Find(&out).Error
	return out, err
}

// FindGroupSchedules는 Python get_group_schedules를 이식한다: GroupDetail 멤버 서브쿼리 +
// OR(sgt_idx=group OR mt_idx IN members) + 날짜창 + ORDER BY sst_sdate.
// days=nil→[오늘, 오늘+14d), days>0→[오늘, 오늘+days), days<=0→날짜필터 없음. 오늘=로컬 00:00.
func (r *ScheduleRepository) FindGroupSchedules(groupID int, days *int) ([]model.Schedule, error) {
	sub := r.db.Model(&model.GroupDetail{}).Select("mt_idx").
		Where("sgt_idx = ? AND sgdt_show = ? AND sgdt_exit = ? AND sgdt_discharge = ?",
			groupID, "Y", "N", "N")
	q := r.db.Model(&model.Schedule{}).Where("sgt_idx = ? OR mt_idx IN (?)", groupID, sub)

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if days == nil {
		q = q.Where("sst_sdate >= ? AND sst_sdate < ?", today, today.AddDate(0, 0, 14))
	} else if *days > 0 {
		q = q.Where("sst_sdate >= ? AND sst_sdate < ?", today, today.AddDate(0, 0, *days))
	}

	out := make([]model.Schedule, 0)
	err := q.Order("sst_sdate").Find(&out).Error
	return out, err
}
