package model

import "time"

// ChatMember는 Python `app/models/chat_member.py`의 ChatMember(테이블 smap_chat_member_t)와 대응한다.
// DB 스키마: scm_idx PK AUTO_INCREMENT, (scr_idx, mt_idx) UNIQUE, 전 컬럼 NOT NULL.
// scm_last_read_idx는 마지막 읽은 메시지 ID(DEFAULT 0), scm_show는 'Y'/'N' enum.
type ChatMember struct {
	ScmIdx         int       `gorm:"column:scm_idx;primaryKey;autoIncrement"`
	ScrIdx         int       `gorm:"column:scr_idx"`
	MtIdx          int       `gorm:"column:mt_idx"`
	ScmLastReadIdx int       `gorm:"column:scm_last_read_idx"`
	ScmShow        string    `gorm:"column:scm_show"` // 'Y' | 'N'
	ScmWdate       time.Time `gorm:"column:scm_wdate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (ChatMember) TableName() string { return "smap_chat_member_t" }
