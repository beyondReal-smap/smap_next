package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type LocationRepository struct {
	db *gorm.DB
}

func NewLocation(db *gorm.DB) *LocationRepository {
	return &LocationRepository{db: db}
}

// Create는 smap_location_t에 단건 INSERT한다(autoIncrement slt_idx는 GORM이 채운다).
func (r *LocationRepository) Create(l *model.Location) error {
	return r.db.Create(l).Error
}

// UpdateFields는 slt_idx 행의 지정 컬럼만 UPDATE하고 영향 행 수를 반환한다(notification/update의 rowcount 분기용).
func (r *LocationRepository) UpdateFields(id int, fields map[string]interface{}) (int64, error) {
	res := r.db.Model(&model.Location{}).Where("slt_idx = ?", id).Updates(fields)
	return res.RowsAffected, res.Error
}

// Delete는 slt_idx 행을 하드 삭제한다(Python delete_location의 db.delete).
func (r *LocationRepository) Delete(id int) error {
	return r.db.Where("slt_idx = ?", id).Delete(&model.Location{}).Error
}

// MemberExists는 member_t에 mt_idx가 존재하는지(Python member-create의 COUNT 검증).
func (r *LocationRepository) MemberExists(mtIdx int) (bool, error) {
	var n int64
	err := r.db.Table("member_t").Where("mt_idx = ?", mtIdx).Count(&n).Error
	return n > 0, err
}

// FirstGroupForMember는 회원의 첫 그룹(sgdt_idx, sgt_idx)을 반환한다(sgdt_show='Y' ORDER BY sgdt_idx LIMIT 1).
// 없으면 (nil, nil, nil).
func (r *LocationRepository) FirstGroupForMember(mtIdx int) (sgdtIdx, sgtIdx *int, err error) {
	var row struct {
		SgdtIdx *int `gorm:"column:sgdt_idx"`
		SgtIdx  *int `gorm:"column:sgt_idx"`
	}
	e := r.db.Raw("SELECT sgdt_idx, sgt_idx FROM smap_group_detail_t WHERE mt_idx = ? AND sgdt_show = 'Y' ORDER BY sgdt_idx LIMIT 1", mtIdx).Scan(&row).Error
	if e != nil {
		return nil, nil, e
	}
	return row.SgdtIdx, row.SgtIdx, nil
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

// GetAllActive는 Python Location.get_all_active(location.py:62)를 이식한다(내 장소 진입 후보).
//
//	WHERE slt_ddate IS NULL AND slt_enter_alarm='Y' AND slt_show='Y'
//
// ⚠️ Python은 이 SQL에 slt_enter_chk 필터를 걸지 않고, 잡 코드(location_alerts.py:366)에서
// slt_enter_chk != 'Y'(미진입)만 파이썬 레벨로 재필터한다. Go도 동등하게 코드 레벨에서 필터하므로
// 여기엔 추가하지 않는다(Python 충실 이식). 반환은 []model.Location. 파라미터 없는 정적 WHERE라
// 인젝션과 무관하다.
func (r *LocationRepository) GetAllActive() ([]model.Location, error) {
	out := make([]model.Location, 0)
	err := r.db.
		Where("slt_ddate IS NULL AND slt_enter_alarm = ? AND slt_show = ?", "Y", "Y").
		Find(&out).Error
	return out, err
}

// GetAllActiveIn은 Python Location.get_all_active_in(location.py:80)을 이식한다(내 장소 이탈 후보).
//
//	WHERE slt_ddate IS NULL AND slt_enter_alarm='Y' AND slt_enter_chk='Y' AND slt_show='Y'
//
// entry와 달리 slt_enter_chk='Y'(이미 진입 완료)가 SQL에 포함돼 진입한 장소만 이탈 후보로 가져온다.
func (r *LocationRepository) GetAllActiveIn() ([]model.Location, error) {
	out := make([]model.Location, 0)
	err := r.db.
		Where("slt_ddate IS NULL AND slt_enter_alarm = ? AND slt_enter_chk = ? AND slt_show = ?",
			"Y", "Y", "Y").
		Find(&out).Error
	return out, err
}

// ClaimMyEntry는 내 장소 진입 1건을 선점하는 조건부 UPDATE다(Go 전용 개선).
//
//	UPDATE smap_location_t SET slt_enter_chk='Y', slt_udate=now
//	WHERE slt_idx=? AND slt_enter_chk<>'Y'(또는 NULL)
//
// RowsAffected=1만 발송한다.
//
// ★Python 충실 이식 주의: Python(location_alerts.py:422-428)은 루프 내부에서 발송 후
// slt_enter_chk='Y'/slt_udate=now를 세팅하되 commit은 루프 전체 종료 후 단일 db.commit()이다.
// 따라서 배치 중 한 회원 발송 실패로 예외가 나면 db.rollback()되어 이미 발송된 모든 회원의
// 상태 전이가 통째로 소실 → 다음 30초 틱에 중복 재발송 위험이 있다(비원자성 약점).
// 이 행별 선점 UPDATE는 Python에 없는 Go 신규 개선으로, 발송 전 원자적 선점으로 그 레이스를 제거한다.
// 마킹 컬럼/값(slt_enter_chk='Y', slt_udate=now)은 Python과 동일하다.
func (r *LocationRepository) ClaimMyEntry(sltIdx int, now time.Time) (int64, error) {
	res := r.db.Model(&model.Location{}).
		Where("slt_idx = ? AND (slt_enter_chk <> ? OR slt_enter_chk IS NULL)", sltIdx, "Y").
		Updates(map[string]any{"slt_enter_chk": "Y", "slt_udate": now})
	return res.RowsAffected, res.Error
}

// ClaimMyExit은 내 장소 이탈 1건을 선점하는 조건부 UPDATE다(Go 전용 개선, entry와 대칭).
//
//	UPDATE ... SET slt_enter_chk='N', slt_udate=now WHERE slt_idx=? AND slt_enter_chk='Y'
//
// Python(location_alerts.py:502-505)의 발송 후 slt_enter_chk='N' 전이를 발송 전 선점으로 대체한다.
func (r *LocationRepository) ClaimMyExit(sltIdx int, now time.Time) (int64, error) {
	res := r.db.Model(&model.Location{}).
		Where("slt_idx = ? AND slt_enter_chk = ?", sltIdx, "Y").
		Updates(map[string]any{"slt_enter_chk": "N", "slt_udate": now})
	return res.RowsAffected, res.Error
}
