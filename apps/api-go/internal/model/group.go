package model

import "time"

// Group은 Python `app/models/group.py`의 Group(테이블 smap_group_t)와 1:1 대응한다.
// GroupResponse에 쓰이는 컬럼만 매핑한다(범위 최소화). mt_idx/sgt_*는 DB상 nullable이라
// 포인터로 두어 Python의 None ↔ JSON null 동작을 보존한다. sgt_idx만 non-null(PK).
type Group struct {
	SgtIdx   int        `gorm:"column:sgt_idx;primaryKey;autoIncrement"`
	MtIdx    *int       `gorm:"column:mt_idx"`
	SgtTitle *string    `gorm:"column:sgt_title"`
	SgtCode  *string    `gorm:"column:sgt_code"`
	SgtMemo  *string    `gorm:"column:sgt_memo"`
	SgtShow  *string    `gorm:"column:sgt_show"` // enum Y/N (DB는 name=value라 raw 문자열 그대로 사용)
	SgtWdate *time.Time `gorm:"column:sgt_wdate"`
	SgtUdate *time.Time `gorm:"column:sgt_udate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Group) TableName() string { return "smap_group_t" }
