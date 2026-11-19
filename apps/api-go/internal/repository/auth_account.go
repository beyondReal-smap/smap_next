package repository

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// 가입·로그인·비밀번호 변경·탈퇴·FCM 해제(G4)용 회원 쿼리와 트랜잭션. 기존 컬럼만 사용한다(스키마 변경 없음).

var (
	// ErrRegisterConflict는 탈퇴하지 않은 회원이 같은 식별자(이메일/아이디/전화번호/소셜 ID)를 이미 쓰고 있다.
	ErrRegisterConflict = errors.New("identifier already registered")
	// ErrWithdrawNotFound는 탈퇴 대상이 없거나 이미 활성 상태가 아니다.
	ErrWithdrawNotFound = errors.New("member not found or not active")
)

// RegisterConflictError는 어떤 식별자가 충돌했는지 담는다(errors.Is(err, ErrRegisterConflict)).
type RegisterConflictError struct{ Field string } // "id" | "email" | "phone" | "social"

func (e *RegisterConflictError) Error() string   { return "identifier conflict: " + e.Field }
func (e *RegisterConflictError) Is(t error) bool { return t == ErrRegisterConflict }

// FindActiveByEmail은 mt_email(trim+소문자 비교)이 같고 탈퇴·정지·비노출이 아닌 회원을 최대 2명 반환한다
// (2명이면 계정을 특정할 수 없음을 알리는 용도).
func (r *MemberRepository) FindActiveByEmail(email string) ([]model.Member, error) {
	var rows []model.Member
	err := r.db.
		Where("LOWER(TRIM(mt_email)) = ?", strings.ToLower(strings.TrimSpace(email))).
		Where("(mt_level IS NULL OR mt_level != 1) AND (mt_status IS NULL OR mt_status != 2) AND (mt_show IS NULL OR mt_show != 'N')").
		// 활성(mt_status=1) 행을 앞에 둬, Limit(2) 에서 활성 행이 잘리지 않게 한다(로그인의 활성 우선 선택).
		Order("CASE WHEN mt_status = 1 THEN 0 ELSE 1 END").Order("mt_idx").Limit(2).Find(&rows).Error
	return rows, err
}

// SetPasswordRevokeRefresh는 비밀번호 해시 갱신과 그 회원의 활성 refresh token 전부 폐기를 한 트랜잭션으로 수행한다.
func (r *MemberRepository) SetPasswordRevokeRefresh(mtIdx int, hashed string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := dbNow()
		if err := tx.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).
			Updates(map[string]interface{}{"mt_pwd": hashed, "mt_udate": now}).Error; err != nil {
			return err
		}
		return tx.Model(&model.RefreshToken{}).
			Where("mt_idx = ? AND revoked_at IS NULL", mtIdx).
			Update("revoked_at", now).Error
	})
}

// ClearFCMTokenIfMatch는 회원 행을 잠그고, 저장된 mt_token_id가 token과 상수시간 비교로 같을 때만
// 토큰 3컬럼을 비운다. 일치해서 비웠으면 true, 불일치/미등록/회원 없음은 false(에러 아님).
func (r *MemberRepository) ClearFCMTokenIfMatch(mtIdx int, token string) (bool, error) {
	cleared := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var m model.Member
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("mt_idx", "mt_token_id").Where("mt_idx = ?", mtIdx).First(&m).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if m.MtTokenID == nil || *m.MtTokenID == "" ||
			subtle.ConstantTimeCompare([]byte(*m.MtTokenID), []byte(token)) != 1 {
			return nil
		}
		if err := tx.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).Updates(map[string]interface{}{
			"mt_token_id": nil, "mt_token_updated_at": nil, "mt_token_expiry_date": nil,
		}).Error; err != nil {
			return err
		}
		cleared = true
		return nil
	})
	return cleared, err
}

// WithdrawMember는 FastAPI members.withdraw_member와 같은 규약으로 탈퇴를 한 트랜잭션에서 처리한다.
//   - refresh token 전부 폐기, FCM 토큰 3컬럼 비움
//   - 소유 그룹(mt_idx 또는 그룹장 detail)은 비노출(sgt_show='N'), 본인 그룹 멤버십은 탈퇴(sgdt_show='N', sgdt_exit='Y'),
//     본인 장소는 비노출(slt_show='N'). 그룹장 승계는 하지 않는다(FastAPI와 같은 정책).
//   - mt_id_retire=기존 mt_id, mt_id=retired_{idx}_{uuid}, mt_email/mt_hp/소셜 ID는 NULL(재가입 가능)
//
// 대상이 없거나 활성이 아니면 ErrWithdrawNotFound.
func (r *MemberRepository) WithdrawMember(mtIdx, retireChk int, retireEtc *string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var m model.Member
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("mt_idx = ? AND mt_level >= ? AND mt_status = ? AND mt_show = ?", mtIdx, 2, 1, "Y").
			First(&m).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrWithdrawNotFound
		}
		if err != nil {
			return err
		}
		now := dbNow()

		owned := tx.Model(&model.GroupDetail{}).Select("sgt_idx").
			Where("mt_idx = ? AND sgdt_owner_chk = ? AND sgdt_show = ?", mtIdx, "Y", "Y")
		if err := tx.Model(&model.Group{}).Where("mt_idx = ? OR sgt_idx IN (?)", mtIdx, owned).
			Updates(map[string]interface{}{"sgt_show": "N", "sgt_udate": now}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.GroupDetail{}).Where("mt_idx = ?", mtIdx).
			Updates(map[string]interface{}{"sgdt_show": "N", "sgdt_exit": "Y", "sgdt_udate": now}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Location{}).Where("mt_idx = ?", mtIdx).
			Updates(map[string]interface{}{"slt_show": "N", "slt_udate": now}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.RefreshToken{}).Where("mt_idx = ? AND revoked_at IS NULL", mtIdx).
			Update("revoked_at", now).Error; err != nil {
			return err
		}
		oldID := ""
		if m.MtID != nil {
			oldID = *m.MtID
		}
		var etc interface{}
		if retireEtc != nil {
			etc = *retireEtc
		}
		return tx.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).Updates(map[string]interface{}{
			"mt_retire_level":      derefIntDefault(m.MtLevel),
			"mt_level":             1,
			"mt_show":              "N",
			"mt_retire_chk":        retireChk,
			"mt_retire_etc":        etc,
			"mt_rdate":             now,
			"mt_id_retire":         oldID,
			"mt_id":                retiredID(mtIdx),
			"mt_email":             nil,
			"mt_hp":                nil,
			"mt_google_id":         nil,
			"mt_apple_id":          nil,
			"mt_kakao_id":          nil,
			"mt_token_id":          nil,
			"mt_token_updated_at":  nil,
			"mt_token_expiry_date": nil,
			"mt_udate":             now,
		}).Error
	})
}

func derefIntDefault(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func retiredID(mtIdx int) string {
	return fmt.Sprintf("retired_%d_%s", mtIdx, strings.ReplaceAll(uuid.NewString(), "-", ""))
}

// RegisterSpec은 가입 트랜잭션 입력이다. 빈 문자열인 식별자는 검사·해제하지 않는다.
type RegisterSpec struct {
	Member *model.Member
	// 중복 검사·탈퇴 회원 식별자 해제 대상(소문자/정규화 완료 값).
	ID        string // mt_id (이메일 또는 전화번호 또는 social prefix id)
	Email     string // mt_email
	Phone     string // mt_hp (숫자 전화번호일 때만)
	SocialCol string // mt_google_id | mt_apple_id | mt_kakao_id
	SocialVal string
	UserAgent string
	IPHash    string
}

var socialColumns = map[string]bool{"mt_google_id": true, "mt_apple_id": true, "mt_kakao_id": true}

// AuthRegisterRepository는 가입을 한 트랜잭션(탈퇴 식별자 해제 → 중복 검사 → INSERT → refresh 발급)으로 처리한다.
type AuthRegisterRepository struct {
	db      *gorm.DB
	refresh *RefreshTokenRepository
}

func NewAuthRegister(db *gorm.DB, refresh *RefreshTokenRepository) *AuthRegisterRepository {
	return &AuthRegisterRepository{db: db, refresh: refresh}
}

// RegisterWithRefresh는 회원을 만들고 refresh token(raw)을 발급한다. 충돌은 *RegisterConflictError.
func (r *AuthRegisterRepository) RegisterWithRefresh(spec RegisterSpec) (*model.Member, string, error) {
	if spec.SocialCol != "" && !socialColumns[spec.SocialCol] {
		return nil, "", fmt.Errorf("unsupported social column")
	}
	var (
		created *model.Member
		raw     string
	)
	err := r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 탈퇴 회원이 점유한 식별자 해제(옛 탈퇴 규약은 mt_id/mt_email을 그대로 남겼다).
		if err := releaseRetired(tx, "mt_id", spec.ID); err != nil {
			return err
		}
		if err := releaseRetired(tx, "mt_email", spec.Email); err != nil {
			return err
		}
		if spec.Phone != "" {
			if err := releaseRetired(tx, "mt_hp", spec.Phone); err != nil {
				return err
			}
		}
		if spec.SocialCol != "" {
			if err := releaseRetired(tx, spec.SocialCol, spec.SocialVal); err != nil {
				return err
			}
		}
		// 2. 탈퇴하지 않은 회원(정지 포함)과의 중복 검사.
		if spec.ID != "" || spec.Email != "" {
			var n int64
			q := tx.Model(&model.Member{}).Where(notWithdrawnCond)
			cond, args := "", []interface{}{}
			add := func(c string, a ...interface{}) {
				if cond != "" {
					cond += " OR "
				}
				cond += c
				args = append(args, a...)
			}
			if spec.ID != "" {
				add("LOWER(TRIM(mt_id)) = ?", strings.ToLower(spec.ID))
				if spec.Email == "" {
					// 이메일 가입이 아니어도 mt_id가 다른 회원의 mt_email과 같으면 안 된다.
					add("LOWER(TRIM(mt_email)) = ?", strings.ToLower(spec.ID))
				}
			}
			if spec.Email != "" {
				add("LOWER(TRIM(mt_email)) = ?", spec.Email)
				add("LOWER(TRIM(mt_id)) = ?", spec.Email)
			}
			if err := q.Where("("+cond+")", args...).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				field := "id"
				if spec.Email != "" {
					field = "email"
				}
				return &RegisterConflictError{Field: field}
			}
		}
		if spec.Phone != "" {
			var n int64
			if err := tx.Model(&model.Member{}).Where(notWithdrawnCond).Where("mt_hp = ?", spec.Phone).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				return &RegisterConflictError{Field: "phone"}
			}
		}
		if spec.SocialCol != "" {
			var n int64
			if err := tx.Model(&model.Member{}).Where(notWithdrawnCond).Where(spec.SocialCol+" = ?", spec.SocialVal).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				return &RegisterConflictError{Field: "social"}
			}
		}
		// 3. INSERT
		if err := tx.Select(registerInsertColumns).Create(spec.Member).Error; err != nil {
			return err
		}
		var m model.Member
		if err := tx.Where("mt_idx = ?", spec.Member.MtIdx).First(&m).Error; err != nil {
			return err
		}
		created = &m
		// 4. refresh 발급(같은 트랜잭션: 실패하면 회원도 만들어지지 않는다)
		rt, _, err := r.refresh.IssueTx(tx, m.MtIdx, "", spec.UserAgent, spec.IPHash)
		if err != nil {
			return err
		}
		raw = rt
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	return created, raw, nil
}

// releaseRetired는 탈퇴(mt_level=1) 회원이 점유한 식별자를 해제한다(FastAPI _release_retired_identity와 같은 규약).
func releaseRetired(tx *gorm.DB, col, value string) error {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return nil
	}
	var rows []model.Member
	if err := tx.Select("mt_idx", "mt_id").
		Where("mt_level = ? AND LOWER(TRIM("+col+")) = ?", 1, value).Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		oldID := ""
		if row.MtID != nil {
			oldID = *row.MtID
		}
		if err := tx.Model(&model.Member{}).Where("mt_idx = ? AND mt_level = ?", row.MtIdx, 1).Updates(map[string]interface{}{
			"mt_id_retire": oldID, "mt_id": retiredID(row.MtIdx),
			"mt_email": nil, "mt_hp": nil, "mt_google_id": nil, "mt_apple_id": nil, "mt_kakao_id": nil,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}
