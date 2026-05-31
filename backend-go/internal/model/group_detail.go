package model

import "time"

// GroupDetail은 Python `app/models/group_detail.py`의 GroupDetail(테이블 smap_group_detail_t)와
// 1:1 대응한다. read 엔드포인트가 사용하는 컬럼만 매핑한다. sgdt_idx(PK) 외 전부 nullable이라
// 포인터로 둔다. enum(Y/N/D) 컬럼은 DB가 name=value라 raw 문자열을 그대로 쓴다.
type GroupDetail struct {
	SgdtIdx       int        `gorm:"column:sgdt_idx;primaryKey;autoIncrement"`
	SgtIdx        *int       `gorm:"column:sgt_idx"`
	MtIdx         *int       `gorm:"column:mt_idx"`
	SgdtOwnerChk  *string    `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string    `gorm:"column:sgdt_leader_chk"`
	SgdtDischarge *string    `gorm:"column:sgdt_discharge"`
	SgdtGroupChk  *string    `gorm:"column:sgdt_group_chk"`
	SgdtExit      *string    `gorm:"column:sgdt_exit"`
	SgdtShow      *string    `gorm:"column:sgdt_show"`
	SgdtPushChk   *string    `gorm:"column:sgdt_push_chk"`
	SgdtWdate     *time.Time `gorm:"column:sgdt_wdate"`
	SgdtUdate     *time.Time `gorm:"column:sgdt_udate"`
	SgdtDdate     *time.Time `gorm:"column:sgdt_ddate"`
	SgdtXdate     *time.Time `gorm:"column:sgdt_xdate"`
	SgdtAdate     *time.Time `gorm:"column:sgdt_adate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (GroupDetail) TableName() string { return "smap_group_detail_t" }
