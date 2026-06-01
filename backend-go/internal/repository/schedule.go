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

// GetNowSchedulePush는 Python Schedule.get_now_schedule_push(schedule.py:108)를 이식한다.
// "이번 1분 버킷"([현재 분 00초, 59초])에 알림 예정인 미발송 일정을 조회한다.
// 조건 4개 AND: sst_schedule_alarm BETWEEN [t1,t2] / sst_schedule_alarm_chk='Y' /
// sst_schedule_chk='N' / sst_show='Y'. schedule:30min 잡(일정 시작 30분 전 알림) 대상이다.
//
// ⚠️ 매칭 컬럼은 sst_sdate(일정 시작)가 아니라 sst_schedule_alarm(미리 적재된 알림 예정시각)이다.
// 시간창은 호출 시점의 now에서 계산하며, 서버 로컬 시각을 쓴다(Python datetime.now()와 동일).
func (r *ScheduleRepository) GetNowSchedulePush() ([]model.Schedule, error) {
	now := time.Now()
	t1 := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), 0, 0, now.Location())
	t2 := t1.Add(time.Minute - time.Second) // 현재 분의 59초

	out := make([]model.Schedule, 0)
	err := r.db.
		Where("sst_schedule_alarm BETWEEN ? AND ? AND sst_schedule_alarm_chk = ? "+
			"AND sst_schedule_chk = ? AND sst_show = ?",
			t1, t2, "Y", "N", "Y").
		Find(&out).Error
	return out, err
}

// ClaimSchedule은 일정 1건을 발송 대상으로 선점하는 조건부 UPDATE다(Go 전용 개선).
//   UPDATE smap_schedule_t SET sst_schedule_chk='Y' WHERE sst_idx=? AND sst_schedule_chk='N'
// 영향 행 수(RowsAffected)를 돌려준다. 1이면 이 호출이 선점에 성공(발송), 0이면 다른
// 워커/이전 틱이 이미 선점(중복 발송 방지로 skip)했음을 뜻한다.
//
// ★Python 충실 이식 주의: Python(push_jobs.py:106)은 "발송 후 루프 말미 단일 마킹+커밋"
// (낙관적/비선점)이라 발송-커밋 사이 크래시·분산 환경에서 중복(at-least-once)이 가능하다.
// 이 행별 선점 UPDATE는 Python에 없는 Go 신규 개선으로, 발송 전 원자적 선점으로 그 레이스
// 윈도우를 제거한다. 마킹 컬럼/값(sst_schedule_chk='Y')은 Python과 동일하다.
func (r *ScheduleRepository) ClaimSchedule(sstIdx int) (int64, error) {
	res := r.db.Model(&model.Schedule{}).
		Where("sst_idx = ? AND sst_schedule_chk = ?", sstIdx, "N").
		Update("sst_schedule_chk", "Y")
	return res.RowsAffected, res.Error
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
