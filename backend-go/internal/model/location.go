package model

import "time"

// Location은 Python `app/models/location.py`의 Location(테이블 smap_location_t)와 대응한다.
// ⚠️ slt_lat/slt_long은 DECIMAL인데 Pydantic이 Decimal→JSON 문자열("37.52460739277500",
// trailing zero 보존)로 직렬화하므로 Go에서도 *string으로 읽어 원문 그대로 출력한다.
type Location struct {
	SltIdx        int        `gorm:"column:slt_idx;primaryKey;autoIncrement"`
	InsertMtIdx   *int       `gorm:"column:insert_mt_idx"`
	MtIdx         *int       `gorm:"column:mt_idx"`
	SgtIdx        *int       `gorm:"column:sgt_idx"`
	SgdtIdx       *int       `gorm:"column:sgdt_idx"`
	SltTitle      *string    `gorm:"column:slt_title"`
	SltAdd        *string    `gorm:"column:slt_add"`
	SltLat        *string    `gorm:"column:slt_lat"`  // DECIMAL(16,14) → 문자열
	SltLong       *string    `gorm:"column:slt_long"` // DECIMAL(17,14) → 문자열
	SltShow       *string    `gorm:"column:slt_show"`
	SltEnterAlarm *string    `gorm:"column:slt_enter_alarm"`
	SltEnterChk   *string    `gorm:"column:slt_enter_chk"`
	SltWdate      *time.Time `gorm:"column:slt_wdate"`
	SltUdate      *time.Time `gorm:"column:slt_udate"`
	SltDdate      *time.Time `gorm:"column:slt_ddate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Location) TableName() string { return "smap_location_t" }
