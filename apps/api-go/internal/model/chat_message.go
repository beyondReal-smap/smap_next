package model

import "time"

// ChatMessage는 Python `app/models/chat_message.py`의 ChatMessage(테이블 smap_chat_msg_t)와 대응한다.
// DB 스키마: scmsg_idx PK AUTO_INCREMENT, scmsg_content는 TEXT NOT NULL, 전 컬럼 NOT NULL.
// scmsg_type은 enum('text','image','location','system'), scmsg_show는 'Y'/'N'.
type ChatMessage struct {
	ScmsgIdx     int       `gorm:"column:scmsg_idx;primaryKey;autoIncrement"`
	ScrIdx       int       `gorm:"column:scr_idx"`
	MtIdx        int       `gorm:"column:mt_idx"`
	ScmsgType    string    `gorm:"column:scmsg_type"` // text|image|location|system
	ScmsgContent string    `gorm:"column:scmsg_content"`
	ScmsgShow    string    `gorm:"column:scmsg_show"` // 'Y' | 'N'
	ScmsgWdate   time.Time `gorm:"column:scmsg_wdate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (ChatMessage) TableName() string { return "smap_chat_msg_t" }
