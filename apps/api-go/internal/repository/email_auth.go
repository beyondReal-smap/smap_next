package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// 이메일 인증(G3) 전용 회원 조회·변경. member_t의 기존 컬럼만 사용한다(스키마 변경 없음).

var (
	// ErrEmailTaken은 다른 (탈퇴하지 않은) 회원이 이미 해당 이메일을 mt_email 또는 mt_id로 쓰고 있다.
	ErrEmailTaken = errors.New("email already used by another member")
	// ErrMemberInactive는 대상 회원이 없거나 탈퇴·정지·비노출 상태다.
	ErrMemberInactive = errors.New("member not active")
)

// EmailAuthRepository는 이메일 인증이 필요로 하는 회원 쿼리와 트랜잭션을 제공한다.
type EmailAuthRepository struct {
	db *gorm.DB
}

func NewEmailAuth(db *gorm.DB) *EmailAuthRepository { return &EmailAuthRepository{db: db} }

const notWithdrawnCond = "(mt_level IS NULL OR mt_level != 1)"

// FindByEmail은 mt_email(trim+소문자 비교)이 같은, 탈퇴하지 않은 회원을 모두 반환한다.
// 정지·비노출 여부는 호출자가 model.Member.IsBlocked로 판정한다(FastAPI와 같은 2단 구조).
func (r *EmailAuthRepository) FindByEmail(email string) ([]model.Member, error) {
	var rows []model.Member
	err := r.db.Where("LOWER(TRIM(mt_email)) = ? AND "+notWithdrawnCond, email).Find(&rows).Error
	return rows, err
}

// IdentifierTaken은 exceptIdx가 아닌 탈퇴하지 않은 회원이 email을 mt_email 또는 mt_id로 쓰는지 반환한다.
// exceptIdx=0이면 모든 회원이 대상이다(mt_idx는 항상 1 이상).
func (r *EmailAuthRepository) IdentifierTaken(email string, exceptIdx int) (bool, error) {
	var n int64
	err := r.identifierQuery(r.db, email, exceptIdx).Count(&n).Error
	return n > 0, err
}

func (r *EmailAuthRepository) identifierQuery(tx *gorm.DB, email string, exceptIdx int) *gorm.DB {
	return tx.Model(&model.Member{}).
		Where("mt_idx != ? AND "+notWithdrawnCond+" AND (LOWER(TRIM(mt_email)) = ? OR LOWER(TRIM(mt_id)) = ?)",
			exceptIdx, email, email)
}

// GetByID는 회원을 mt_idx로 조회한다. 없으면 (nil, nil).
func (r *EmailAuthRepository) GetByID(mtIdx int) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_idx = ?", mtIdx).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ResetPassword는 비밀번호 해시 갱신과 그 회원의 활성 refresh token 전부 폐기를 한 트랜잭션으로 수행한다.
func (r *EmailAuthRepository) ResetPassword(mtIdx int, hashed string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).
			Updates(map[string]interface{}{"mt_pwd": hashed, "mt_udate": dbNow()})
		if res.Error != nil {
			return res.Error
		}
		return tx.Model(&model.RefreshToken{}).
			Where("mt_idx = ? AND revoked_at IS NULL", mtIdx).
			Update("revoked_at", dbNow()).Error
	})
}

// ChangeEmail은 다른 회원의 사용 여부를 잠금 읽기로 재확인한 뒤 mt_email만 갱신한다(mt_id·mt_idx 불변).
// 대상이 없거나 비활성이면 ErrMemberInactive, 다른 회원이 쓰는 이메일이면 ErrEmailTaken.
func (r *EmailAuthRepository) ChangeEmail(mtIdx int, email string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var others []model.Member
		if err := r.identifierQuery(tx, email, mtIdx).Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("mt_idx").Find(&others).Error; err != nil {
			return err
		}
		if len(others) > 0 {
			return ErrEmailTaken
		}
		var m model.Member
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("mt_idx = ?", mtIdx).First(&m).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrMemberInactive
		}
		if err != nil {
			return err
		}
		if m.IsBlocked() {
			return ErrMemberInactive
		}
		return tx.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).Update("mt_email", email).Error
	})
}
