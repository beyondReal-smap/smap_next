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

// Create는 push_log_t에 단건 INSERT한다(Python push_service.push_log_add와 동등).
// 잡 핸들러가 FCM 발송 결과별 로그를 적재할 때 사용한다. autoIncrement plt_idx는 GORM이 채운다.
func (r *PushLogRepository) Create(p *model.PushLog) error {
	return r.db.Create(p).Error
}

// CreateBatch는 push_log_t에 다건 INSERT한다(회원 루프 1건씩 add 후 일괄 저장과 동등).
// 빈 슬라이스면 no-op(GORM이 빈 슬라이스에 에러를 내지 않도록 가드).
func (r *PushLogRepository) CreateBatch(logs []model.PushLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.Create(&logs).Error
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
