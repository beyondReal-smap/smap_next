// Package model은 GORM ORM 모델을 담는다 (Python SQLAlchemy 모델과 1:1).
package model

import "time"

// Notice는 Python `app/models/notice.py`의 Notice(테이블 notice_t)와 동일하다.
// nt_title/nt_content/nt_file1/mt_idx는 DB상 nullable이라 포인터로 둔다.
type Notice struct {
	NtIdx     int       `gorm:"column:nt_idx;primaryKey;autoIncrement"`
	MtIdx     *int      `gorm:"column:mt_idx"`
	NtTitle   *string   `gorm:"column:nt_title"`
	NtFile1   *string   `gorm:"column:nt_file1"`
	NtContent *string   `gorm:"column:nt_content"`
	NtShow    string    `gorm:"column:nt_show"` // enum Y/N
	NtHit     int       `gorm:"column:nt_hit"`
	NtWdate   time.Time `gorm:"column:nt_wdate"`
	NtUwdate  time.Time `gorm:"column:nt_uwdate"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Notice) TableName() string { return "notice_t" }
