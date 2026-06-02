package model

import "time"

// RefreshToken은 Python `app/models/refresh_token.py`의 RefreshToken(테이블 refresh_tokens)과 1:1 대응한다.
// raw token은 저장하지 않고 SHA-256 해시만 저장. rotation 시 동일 chain_id 새 row 발급 + 기존 row revoked.
// reuse(이미 revoked된 token 재사용) 감지 시 해당 chain_id의 모든 활성 row를 revoke.
type RefreshToken struct {
	ID             int64      `gorm:"column:id;primaryKey;autoIncrement"`
	MtIdx          int        `gorm:"column:mt_idx"`
	TokenHash      string     `gorm:"column:token_hash"`
	ChainID        string     `gorm:"column:chain_id"`
	IssuedAt       time.Time  `gorm:"column:issued_at"`
	ExpiresAt      time.Time  `gorm:"column:expires_at"`
	RevokedAt      *time.Time `gorm:"column:revoked_at"`
	ReplacedByHash *string    `gorm:"column:replaced_by_hash"`
	UserAgent      *string    `gorm:"column:user_agent"`
	IPHash         *string    `gorm:"column:ip_hash"`
}

// TableName은 실제 테이블명을 고정한다.
func (RefreshToken) TableName() string { return "refresh_tokens" }
