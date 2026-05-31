package model

import "time"

// PushLog는 Python `app/models/push_log.py`의 PushLog(테이블 push_log_t)와 대응한다.
type PushLog struct {
	PltIdx       int        `gorm:"column:plt_idx;primaryKey;autoIncrement"`
	PltType      *int       `gorm:"column:plt_type"`
	MtIdx        *int       `gorm:"column:mt_idx"`
	SstIdx       *int       `gorm:"column:sst_idx"`
	PltCondition *string    `gorm:"column:plt_condition"`
	PltMemo      *string    `gorm:"column:plt_memo"`
	PltTitle     *string    `gorm:"column:plt_title"`
	PltContent   *string    `gorm:"column:plt_content"`
	PltSdate     *time.Time `gorm:"column:plt_sdate"`
	PltStatus    *int       `gorm:"column:plt_status"`
	PltReadChk   *string    `gorm:"column:plt_read_chk"`
	PltShow      *string    `gorm:"column:plt_show"`
	PushJSON     *string    `gorm:"column:push_json"`
	PltWdate     *time.Time `gorm:"column:plt_wdate"`
	PltRdate     *time.Time `gorm:"column:plt_rdate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (PushLog) TableName() string { return "push_log_t" }
