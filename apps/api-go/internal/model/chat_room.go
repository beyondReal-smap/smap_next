package model

import "time"

// ChatRoom은 Python `app/models/chat_room.py`의 ChatRoom(테이블 smap_chat_room_t)과 대응한다.
// DB 스키마: scr_idx PK AUTO_INCREMENT, sgt_idx/scr_title은 nullable, 나머지는 NOT NULL.
// scr_type/scr_show는 enum이지만 문자열로 다룬다(Python str-enum 직렬화와 동일).
// scr_wdate/scr_udate는 NOT NULL DEFAULT current_timestamp(scr_udate는 ON UPDATE도 가짐).
type ChatRoom struct {
	ScrIdx   int       `gorm:"column:scr_idx;primaryKey;autoIncrement"`
	SgtIdx   *int      `gorm:"column:sgt_idx"`
	ScrType  string    `gorm:"column:scr_type"`  // 'group' | 'dm'
	ScrTitle *string   `gorm:"column:scr_title"`
	ScrShow  string    `gorm:"column:scr_show"`  // 'Y' | 'N'
	ScrWdate time.Time `gorm:"column:scr_wdate"`
	ScrUdate time.Time `gorm:"column:scr_udate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (ChatRoom) TableName() string { return "smap_chat_room_t" }
