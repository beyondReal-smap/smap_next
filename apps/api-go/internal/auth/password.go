package auth

import (
	"strconv"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

// PasswordPolicy는 Python settings.PASSWORD_* 정책을 담는다(서비스가 config에서 구성).
type PasswordPolicy struct {
	MinLength      int
	RequireUpper   bool
	RequireLower   bool
	RequireNumbers bool
	RequireSpecial bool
}

// 특수문자 집합 — Python regex `[!@#$%^&*(),.?":{}|<>]`와 동일.
const passwordSpecialChars = "!@#$%^&*(),.?\":{}|<>"

// VerifyPassword는 Python crud_auth.verify_password와 동등하다.
//   - 해시가 비어 있으면(소셜 계정 등) False.
//   - bcrypt.checkpw 실패/예외는 False로 흡수.
//
// ⚠️ Go x/crypto/bcrypt는 PHP 레거시 `$2y$` 프리픽스를 거부하므로 `$2b$`로 정규화한다.
// 두 프리픽스는 동일 알고리즘이며(2y는 PHP 시절 표기), Python bcrypt는 둘 다 네이티브 처리한다.
func VerifyPassword(plain, hashed string) bool {
	if hashed == "" {
		return false
	}
	h := hashed
	if strings.HasPrefix(h, "$2y$") {
		h = "$2b$" + h[len("$2y$"):]
	}
	return bcrypt.CompareHashAndPassword([]byte(h), []byte(plain)) == nil
}

// ValidatePasswordPolicy는 Python crud_auth.validate_password_policy와 동등하다.
// (통과 여부, 위반 메시지 목록) 반환. 메시지 문자열은 Python과 동일.
func ValidatePasswordPolicy(password string, p PasswordPolicy) (bool, []string) {
	var errs []string
	if len(password) < p.MinLength {
		errs = append(errs, "비밀번호는 최소 "+strconv.Itoa(p.MinLength)+"자 이상이어야 합니다.")
	}
	if p.RequireUpper && !strings.ContainsFunc(password, isUpperASCII) {
		errs = append(errs, "비밀번호에 대문자가 포함되어야 합니다.")
	}
	if p.RequireLower && !strings.ContainsFunc(password, isLowerASCII) {
		errs = append(errs, "비밀번호에 소문자가 포함되어야 합니다.")
	}
	if p.RequireNumbers && !strings.ContainsFunc(password, isDigitASCII) {
		errs = append(errs, "비밀번호에 숫자가 포함되어야 합니다.")
	}
	if p.RequireSpecial && !strings.ContainsAny(password, passwordSpecialChars) {
		errs = append(errs, "비밀번호에 특수문자가 포함되어야 합니다.")
	}
	return len(errs) == 0, errs
}

// ValidateResetPassword는 reset_password/reset_password_by_phone 라우터의 인라인 비번 검증을 이식한다.
// ⚠️ register의 PasswordPolicy(대/소문자 분리 요구)와 별개다. Python 라우터는 인라인 정규식으로
//   - len<8                                   → "비밀번호는 8자 이상이어야 합니다."
//   - [a-zA-Z] AND \d AND [!@#$%^&*(),.?":{}|<>] → 모두 없으면 "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
// 길이는 문자(rune) 수로 센다(Python len). 숫자는 ASCII 0-9로 판정한다(코드베이스 isDigitASCII 일관 —
// Python \d의 유니코드 숫자 매칭과 미세 차이가 있으나 실 비번에선 비관찰).
func ValidateResetPassword(password string) (ok bool, message string) {
	if utf8.RuneCountInString(password) < 8 {
		return false, "비밀번호는 8자 이상이어야 합니다."
	}
	hasLetter := strings.ContainsFunc(password, func(r rune) bool { return isUpperASCII(r) || isLowerASCII(r) })
	hasNumber := strings.ContainsFunc(password, isDigitASCII)
	hasSpecial := strings.ContainsAny(password, passwordSpecialChars)
	if !(hasLetter && hasNumber && hasSpecial) {
		return false, "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
	}
	return true, ""
}

// HashPasswordWithPolicy는 Python crud_auth.get_hashed_password와 동등하다.
// 정책 위반 시 Python ValueError에 대응하는 에러를 반환(register에서 500으로 흡수됨).
func HashPasswordWithPolicy(password string, cost int, p PasswordPolicy) (string, error) {
	if ok, errs := ValidatePasswordPolicy(password, p); !ok {
		return "", &PolicyError{Errors: errs}
	}
	return HashPassword(password, cost)
}

// HashPassword는 Python `bcrypt.hashpw(pw, bcrypt.gensalt(rounds=cost))`와 동등하다(정책 미검증).
// reset_password 경로(update_user_password)가 이 형태를 쓴다. ⚠️ Go는 `$2a$`, Python은 `$2b$`
// 프리픽스를 생성하나, 해시는 응답에 노출되지 않고 양쪽 모두 검증 가능하므로 기능 동등하다.
func HashPassword(password string, cost int) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// PolicyError는 비밀번호 정책 위반(Python ValueError "비밀번호 정책 위반: ...").
type PolicyError struct {
	Errors []string
}

func (e *PolicyError) Error() string {
	return "비밀번호 정책 위반: " + strings.Join(e.Errors, ", ")
}

func isUpperASCII(r rune) bool { return r >= 'A' && r <= 'Z' }
func isLowerASCII(r rune) bool { return r >= 'a' && r <= 'z' }
func isDigitASCII(r rune) bool { return r >= '0' && r <= '9' }
