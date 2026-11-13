package model

import "time"

// PushFCM는 Python `app/models/push_fcm.py`의 PushFCM(테이블 push_fcm_t)와 대응한다.
type PushFCM struct {
	PftIdx       int        `gorm:"column:pft_idx;primaryKey;autoIncrement"`
	PftCode      *string    `gorm:"column:pft_code"`
	PftTitle     *string    `gorm:"column:pft_title"`
	PftContent   *string    `gorm:"column:pft_content"`
	PftSendType  *int       `gorm:"column:pft_send_type"`
	PftSendMtIdx *int       `gorm:"column:pft_send_mt_idx"`
	PftRdate     *time.Time `gorm:"column:pft_rdate"`
	PftURL       *string    `gorm:"column:pft_url"`
	PftStatus    *int       `gorm:"column:pft_status"`
	PftShow      *string    `gorm:"column:pft_show"`
	PftSdate     *time.Time `gorm:"column:pft_sdate"`
	PftEdate     *time.Time `gorm:"column:pft_edate"`
	PftWdate     *time.Time `gorm:"column:pft_wdate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (PushFCM) TableName() string { return "push_fcm_t" }
