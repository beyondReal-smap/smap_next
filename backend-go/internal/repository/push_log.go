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

// UpdateFields는 plt_idx 행의 지정 컬럼만 UPDATE한다(Python update_push_log의 exclude_unset setattr 등가).
func (r *PushLogRepository) UpdateFields(id int, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.PushLog{}).Where("plt_idx = ?", id).Updates(fields).Error
}

// Delete는 plt_idx 행을 하드 삭제한다(Python delete_push_log의 db.delete — 소프트삭제 아님).
func (r *PushLogRepository) Delete(id int) error {
	return r.db.Where("plt_idx = ?", id).Delete(&model.PushLog{}).Error
}

// MarkReadByID는 plt_read_chk='Y', plt_rdate=now로 읽음 처리(Python mark_push_log_as_read).
func (r *PushLogRepository) MarkReadByID(id int, now time.Time) error {
	return r.db.Model(&model.PushLog{}).Where("plt_idx = ?", id).
		Updates(map[string]interface{}{"plt_read_chk": "Y", "plt_rdate": now}).Error
}

// SoftDeleteAllForMember는 회원의 노출 로그를 plt_show='N'으로 일괄 소프트삭제(Python delete_all_push_logs).
func (r *PushLogRepository) SoftDeleteAllForMember(mtIdx int, now time.Time) error {
	return r.db.Model(&model.PushLog{}).
		Where("mt_idx = ? AND plt_show = ?", mtIdx, "Y").
		Updates(map[string]interface{}{"plt_show": "N", "plt_rdate": now}).Error
}

// MarkReadAllForMember는 회원의 미읽음 노출 로그를 일괄 읽음 처리(Python read_all_push_logs).
func (r *PushLogRepository) MarkReadAllForMember(mtIdx int, now time.Time) error {
	return r.db.Model(&model.PushLog{}).
		Where("mt_idx = ? AND plt_read_chk = ? AND plt_show = ?", mtIdx, "N", "Y").
		Updates(map[string]interface{}{"plt_read_chk": "Y", "plt_rdate": now}).Error
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

// GetReserved는 Python PushLog.get_reserved_pushes(push_log.py:54)를 이식한다.
// 발송 시간이 도래한 미발송 예약 푸시를 조회한다(정렬 없음, .all() 동등).
//
//	조건 3개 AND: plt_status=1 AND plt_sdate<=now AND plt_show='Y'.
//
// now는 잡 진입 시 1회 캡처한 시각을 호출자가 전달한다(Python datetime.now() 1회 캡처 동등).
// plt_status/plt_sdate는 nullable 포인터 컬럼이나, 비교는 값 바인딩이라 NULL 행은 자연 제외된다.
// reserved 잡 전용 신규 메서드다(기존 read 메서드에 동등물이 없었음).
func (r *PushLogRepository) GetReserved(now time.Time) ([]model.PushLog, error) {
	out := make([]model.PushLog, 0)
	err := r.db.
		Where("plt_status = ? AND plt_sdate <= ? AND plt_show = ?", 1, now, "Y").
		Find(&out).Error
	return out, err
}

// ClaimReserved는 예약 푸시 1행을 발송 대상으로 선점하는 조건부 UPDATE다(★Go 전용 신규 개선).
//
//	UPDATE push_log_t SET plt_status=3 WHERE plt_idx=? AND plt_status=1
//
// 영향 행 수(RowsAffected)를 돌려준다. 1이면 이 호출이 선점에 성공(발송 권한 획득), 0이면 다른
// 워커/이전 틱/asynq 재시도가 이미 선점(중복 발송 방지로 skip)했음을 뜻한다.
//
// ★Python 미인지 신규 상태값 plt_status=3(sending) 주의:
// Python run_send_reserved_push_notifications(push_jobs.py:23)는 조회(plt_status=1)→발송→
// 상태전이(2/4) 사이에 락/행 선점이 전무해, 멀티워커·asynq 재시도가 같은 plt_status=1 행을
// 동시 조회→양쪽 발송(at-least-once 중복)할 수 있다. 이 행별 선점 UPDATE는 발송 전 원자적
// 선점으로 그 레이스 윈도우를 제거한다.
//   - get_reserved_pushes 필터는 plt_status==1만 보므로(=1 등호), status=3 행은 Python·Go
//     혼재(컷오버 과도기)에도 재선택되지 않아 중복 안전하다. FindByMember(plt_status=2 알림
//     목록)에도 잡히지 않는다.
//   - ⚠️롤백/장애 복구: status=3 도중 크래시 시 행이 3에 고착(영구 미발송)된다. 컷오버 롤백 시
//     "UPDATE push_log_t SET plt_status=1 WHERE plt_status=3 [AND plt_sdate 오래된 것]"
//     정리 쿼리로 1로 되돌려 재시도 가능케 해야 한다(운영 메모리 기록 필요).
func (r *PushLogRepository) ClaimReserved(pltIdx int) (int64, error) {
	res := r.db.Model(&model.PushLog{}).
		Where("plt_idx = ? AND plt_status = ?", pltIdx, 1).
		Update("plt_status", 3)
	return res.RowsAffected, res.Error
}

// MarkReservedSent는 선점(claim)·발송을 마친 예약 푸시 행의 결과를 영속화한다.
// Python push_jobs.py:53-54의 상태 전이와 동등하되, 이미 존재하는 행을 UPDATE한다(신규 INSERT 아님).
//
//	UPDATE push_log_t SET plt_status=?(2 성공/4 실패), plt_sdate=now WHERE plt_idx=?
//
// now는 잡 진입 시 캡처한 동일 시각(Python now 재사용 동등). plt_rdate를 비롯한 다른 컬럼은
// 절대 건드리지 않는다(Python도 plt_status/plt_sdate 2개만 변경).
func (r *PushLogRepository) MarkReservedSent(pltIdx int, status int, now time.Time) error {
	return r.db.Model(&model.PushLog{}).
		Where("plt_idx = ?", pltIdx).
		Updates(map[string]any{"plt_status": status, "plt_sdate": now}).Error
}
