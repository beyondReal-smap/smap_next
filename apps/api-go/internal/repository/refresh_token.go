package repository

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// RefreshTokenRepository는 Python `app/crud/crud_refresh_token.py`를 1:1 이식한다.
// raw token은 저장하지 않고 SHA-256 해시만 저장하며, rotation은 chain_id 기준이다.
type RefreshTokenRepository struct {
	db         *gorm.DB
	tokenBytes int
	expireDays int
}

func NewRefreshToken(db *gorm.DB, tokenBytes, expireDays int) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db, tokenBytes: tokenBytes, expireDays: expireDays}
}

// dbNow는 Python `datetime.utcnow()`(naive UTC 벽시계)와 동일 값을 저장하기 위한 헬퍼.
// DSN loc=Local에서 드라이버가 변환하므로 UTC 벽시계 숫자를 Local 존으로 감싸 +9h 변환을 무력화한다.
// (refresh_tokens는 Go 내부 round-trip은 절대시각이 보존돼 만료 비교가 항상 옳지만, Python interop
// 시 expires_at 벽시계가 일치해야 하므로 저장 표기를 UTC로 맞춘다.)
func dbNow() time.Time {
	u := time.Now().UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), u.Hour(), u.Minute(), u.Second(), u.Nanosecond(), time.Local)
}

// hashRaw는 Python _hash: sha256 hex.
func hashRaw(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// genRaw는 Python secrets.token_urlsafe(n): n 바이트 난수 → base64url(패딩 제거).
func (r *RefreshTokenRepository) genRaw() (string, error) {
	b := make([]byte, r.tokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// trimUA는 Python `(user_agent or "")[:255] or None`: 빈 문자열이면 nil, 아니면 255자 절단.
func trimUA(ua string) *string {
	if len(ua) > 255 {
		ua = ua[:255]
	}
	if ua == "" {
		return nil
	}
	return &ua
}

// Issue는 Python issue: 새 refresh 토큰 발급 후 저장. (raw, chain_id) 반환.
// chainID가 ""이면 새 체인(uuid4), 주어지면 rotation 연장.
func (r *RefreshTokenRepository) Issue(mtIdx int, chainID, userAgent, ipHash string) (string, string, error) {
	return r.IssueTx(r.db, mtIdx, chainID, userAgent, ipHash)
}

// IssueTx는 Issue를 주어진 DB 핸들(트랜잭션 포함)에서 수행한다(가입 트랜잭션에서 회원 INSERT와 묶기 위함).
func (r *RefreshTokenRepository) IssueTx(db *gorm.DB, mtIdx int, chainID, userAgent, ipHash string) (string, string, error) {
	raw, err := r.genRaw()
	if err != nil {
		return "", "", err
	}
	now := dbNow()
	chain := chainID
	if chain == "" {
		chain = uuid.NewString()
	}
	var ip *string
	if ipHash != "" {
		ip = &ipHash
	}
	row := &model.RefreshToken{
		MtIdx:     mtIdx,
		TokenHash: hashRaw(raw),
		ChainID:   chain,
		IssuedAt:  now,
		ExpiresAt: now.Add(time.Duration(r.expireDays) * 24 * time.Hour),
		UserAgent: trimUA(userAgent),
		IPHash:    ip,
	}
	if err := db.Create(row).Error; err != nil {
		return "", "", err
	}
	return raw, chain, nil
}

// Rotate는 Python rotate: 기존 raw를 회전한다. 같은 토큰으로 동시에 두 요청이 와도 하나만 성공하도록
// 한 트랜잭션 안에서 기존 행을 SELECT ... FOR UPDATE로 잠근 뒤 판정한다(A-11).
//   - 성공: (new_raw, mt_idx, true, nil). (chain_id는 caller 미사용이라 생략)
//   - 실패(없음/만료/이미 사용됨): ("", 0, false, nil). reuse 감지 시 체인 전체 revoke(이 폐기는 커밋된다).
//   - DB 오류: ("", 0, false, err).
func (r *RefreshTokenRepository) Rotate(rawOld, userAgent, ipHash string) (string, int, bool, error) {
	oldHash := hashRaw(rawOld)
	var (
		rawNew string
		mtIdx  int
		ok     bool
	)
	txErr := r.db.Transaction(func(tx *gorm.DB) error {
		var old model.RefreshToken
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("token_hash = ?", oldHash).First(&old).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		now := dbNow()

		// REUSE DETECTION — 이미 revoked된 토큰 재사용 시 체인 전체 폐기.
		if old.RevokedAt != nil {
			return tx.Model(&model.RefreshToken{}).
				Where("chain_id = ? AND revoked_at IS NULL", old.ChainID).
				Update("revoked_at", now).Error
		}
		if old.ExpiresAt.Before(now) {
			return nil
		}

		gen, err := r.genRaw()
		if err != nil {
			return err
		}
		newHash := hashRaw(gen)
		var ip *string
		if ipHash != "" {
			ip = &ipHash
		}
		newRow := &model.RefreshToken{
			MtIdx:     old.MtIdx,
			TokenHash: newHash,
			ChainID:   old.ChainID,
			IssuedAt:  now,
			ExpiresAt: now.Add(time.Duration(r.expireDays) * 24 * time.Hour),
			UserAgent: trimUA(userAgent),
			IPHash:    ip,
		}
		if err := tx.Create(newRow).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.RefreshToken{}).
			Where("id = ?", old.ID).
			Updates(map[string]interface{}{"revoked_at": now, "replaced_by_hash": newHash}).Error; err != nil {
			return err
		}
		rawNew, mtIdx, ok = gen, old.MtIdx, true
		return nil
	})
	if txErr != nil {
		return "", 0, false, txErr
	}
	return rawNew, mtIdx, ok, nil
}

// RevokeByRaw는 Python revoke_by_raw: 로그아웃 시 특정 raw token revoke.
// 없거나 이미 revoked면 false. (에러는 best-effort: Python도 commit 외 예외 없음)
func (r *RefreshTokenRepository) RevokeByRaw(rawToken string) (bool, error) {
	h := hashRaw(rawToken)
	var row model.RefreshToken
	err := r.db.Where("token_hash = ?", h).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if row.RevokedAt != nil {
		return false, nil
	}
	now := dbNow()
	if err := r.db.Model(&model.RefreshToken{}).
		Where("id = ?", row.ID).
		Update("revoked_at", now).Error; err != nil {
		return false, err
	}
	return true, nil
}

// RevokeAllForMember는 Python revoke_all_for_member: 회원의 모든 활성 refresh token revoke. 폐기 수 반환.
func (r *RefreshTokenRepository) RevokeAllForMember(mtIdx int) (int64, error) {
	now := dbNow()
	res := r.db.Model(&model.RefreshToken{}).
		Where("mt_idx = ? AND revoked_at IS NULL", mtIdx).
		Update("revoked_at", now)
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}
