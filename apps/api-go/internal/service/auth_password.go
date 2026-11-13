package service

import (
	"crypto/subtle"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// authVerifyStore는 SMS 인증 완료상태/코드(Redis interop). reset-password-by-phone 전용.
// Python sms.py의 _is_verified/_get_verification_code/_delete_verification_code/_clear_verified를
// Redis 키(sms:verified:{phone}, sms:code:{phone})로 위임한다. main에서 항상 주입(cache.SMSVerifyStore).
type authVerifyStore interface {
	IsVerified(phone string) bool
	GetCode(phone string) (string, bool)
	DeleteCode(phone string)
	ClearVerified(phone string)
}

// SetVerifyStore는 Phase C SMS 인증상태 저장소를 주입한다(NewAuth 시그니처 보존용).
func (s *AuthService) SetVerifyStore(v authVerifyStore) { s.verify = v }

const pwResetServerErrMsg = "요청 처리 중 오류가 발생했습니다."

// pwResetServerErr는 Python 라우터 try/except가 흡수하는 공통 실패 응답(200+success=false).
// reset-password-by-phone에서 SMS 미인증/코드불일치로 raise된 HTTPException(400)도 이 형태로 잡힌다.
func pwResetServerErr() dto.PwResetResponse {
	return dto.PwResetResponse{Success: false, Message: pwResetServerErrMsg}
}

// cleanPhone은 Python contact.replace('-', '').replace(' ', '')(하이픈+공백 제거).
func cleanPhone(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "-", ""), " ", "")
}

// ForgotPassword는 Python forgot_password를 이식한다(비번찾기, 토큰 발급+저장).
// ⚠️ 실제 SMS/이메일 발송은 sms/email 도메인 트랙 소관(미이식). Python은 발송 실패를 swallow하고
// user 존재 시 항상 success=true를 반환하므로(응답이 발송 결과와 무관), 토큰 저장+응답만으로 byte 동등이
// 보존된다. reset_url(https://nextstep.smap.site/r?t=<token>)은 발송 트랙 연결 시 사용한다.
func (s *AuthService) ForgotPassword(typ, contact string) dto.PwResetResponse {
	var user *model.Member
	var err error
	if typ == "phone" {
		user, err = s.members.GetByMtID(cleanPhone(contact))
	} else {
		user, err = s.members.GetByEmail(contact)
	}
	if err != nil {
		return pwResetServerErr()
	}
	if user == nil {
		return dto.PwResetResponse{Success: false, Message: "등록되지 않은 연락처입니다."}
	}

	shortToken := uuid.NewString()[:8]          // str(uuid.uuid4())[:8]
	tokenExpires := dbUTCNow().Add(time.Minute) // utcnow() + 1분(테스트용 하드코딩)
	if err := s.members.UpdateColumns(user.MtIdx, map[string]interface{}{
		"mt_reset_token": shortToken,
		"mt_token_edate": tokenExpires,
	}); err != nil {
		return pwResetServerErr()
	}

	// 발송 연결(sms/email 트랙): phone→SMS, email→이메일. 동기 호출하되 결과는 응답에 무관(Python swallow).
	// sender 미주입(nil)이면 발송 skip — 응답은 동일(Python이 발송 실패를 흡수하는 것과 byte 동등).
	if s.sender != nil {
		resetURL := "https://nextstep.smap.site/r?t=" + shortToken
		if typ == "phone" {
			s.sender.SendPasswordResetSMS(contact, resetURL)
		} else {
			s.sender.SendPasswordResetEmail(contact, resetURL)
		}
	}

	channel := "이메일"
	if typ == "phone" {
		channel = "SMS"
	}
	return dto.PwResetResponse{
		Success: true,
		Message: channel + "로 비밀번호 재설정 링크를 발송했습니다.",
		Data:    dto.ForgotPasswordData{Type: typ, Contact: contact, TokenExpires: "1분", Sent: true},
	}
}

// VerifyResetToken은 Python verify_reset_token을 이식한다(read-only). 길이는 rune 수로 센다.
func (s *AuthService) VerifyResetToken(token string) dto.PwResetResponse {
	if utf8.RuneCountInString(token) != 8 {
		return dto.PwResetResponse{Success: false, Message: "유효하지 않은 토큰입니다."}
	}
	user, err := s.members.GetByResetToken(token, dbUTCNow())
	if err != nil {
		return pwResetServerErr()
	}
	if user == nil {
		return dto.PwResetResponse{Success: false, Message: "토큰이 만료되었거나 유효하지 않습니다."}
	}
	return dto.PwResetResponse{
		Success: true,
		Message: "토큰이 유효합니다.",
		Data:    dto.VerifyResetTokenData{UserID: user.MtIdx, Type: "phone", Email: user.MtEmail, Phone: user.MtHp},
	}
}

// ResetPassword는 Python reset_password를 이식한다(토큰 검증 → 비번 갱신 → 토큰 무효화).
// 검증 순서: 토큰 길이 → 토큰 조회 → 비번 길이 → 비번 강도(라이브로 순서 확인 완료).
func (s *AuthService) ResetPassword(token, newPassword string) dto.PwResetResponse {
	if utf8.RuneCountInString(token) != 8 {
		return dto.PwResetResponse{Success: false, Message: "유효하지 않은 토큰입니다."}
	}
	user, err := s.members.GetByResetToken(token, dbUTCNow())
	if err != nil {
		return pwResetServerErr()
	}
	if user == nil {
		return dto.PwResetResponse{Success: false, Message: "토큰이 만료되었거나 유효하지 않습니다."}
	}
	if ok, msg := auth.ValidateResetPassword(newPassword); !ok {
		return dto.PwResetResponse{Success: false, Message: msg}
	}
	if !s.updatePassword(user.MtIdx, newPassword) {
		return dto.PwResetResponse{Success: false, Message: "비밀번호 변경에 실패했습니다."}
	}
	// 사용 후 토큰 무효화(보안). GORM Updates(map)는 nil 값을 NULL로 설정한다.
	if err := s.members.UpdateColumns(user.MtIdx, map[string]interface{}{
		"mt_reset_token": nil, "mt_token_edate": nil,
	}); err != nil {
		return pwResetServerErr()
	}
	return dto.PwResetResponse{
		Success: true,
		Message: "비밀번호가 성공적으로 변경되었습니다.",
		Data:    dto.ResetPasswordData{UserID: user.MtIdx, Email: user.MtEmail, UpdatedAt: pyISO(time.Now().UTC())},
	}
}

// ResetPasswordByPhone은 Python reset_password_by_phone을 이식한다(SMS 인증 후 네이티브 앱용).
// ⚠️ Python은 미인증/코드불일치 시 HTTPException(400)을 raise하지만 같은 함수의 except Exception에
// 잡혀 200+"요청 처리 중 오류가 발생했습니다."로 변환된다(라이브 검증 완료) → pwResetServerErr().
func (s *AuthService) ResetPasswordByPhone(phone, verificationCode, newPassword string) dto.PwResetResponse {
	clean := cleanPhone(phone)

	// _is_verified 우선. 미인증이면 인증코드 직접 검증(상수시간 비교).
	if !s.verify.IsVerified(clean) {
		code, ok := s.verify.GetCode(clean)
		if !ok { // stored_code 없음 → HTTPException(400) → except 흡수
			return pwResetServerErr()
		}
		if subtle.ConstantTimeCompare([]byte(verificationCode), []byte(code)) != 1 {
			return pwResetServerErr()
		}
		s.verify.DeleteCode(clean)
	}

	user, err := s.members.GetByMtID(clean)
	if err != nil {
		return pwResetServerErr()
	}
	if user == nil {
		return dto.PwResetResponse{Success: false, Message: "등록되지 않은 전화번호입니다."}
	}
	if ok, msg := auth.ValidateResetPassword(newPassword); !ok {
		return dto.PwResetResponse{Success: false, Message: msg}
	}
	if !s.updatePassword(user.MtIdx, newPassword) {
		return dto.PwResetResponse{Success: false, Message: "비밀번호 변경에 실패했습니다."}
	}
	s.verify.ClearVerified(clean) // 인증 완료상태 정리(재사용 방지)
	return dto.PwResetResponse{
		Success: true,
		Message: "비밀번호가 성공적으로 변경되었습니다.",
		Data:    dto.ResetPasswordByPhoneData{UserID: user.MtIdx, UpdatedAt: pyISO(time.Now().UTC())},
	}
}

// updatePassword는 Python crud_auth.update_user_password를 이식한다.
// bcrypt.gensalt() 기본 cost(=12, PASSWORD_BCRYPT_COST와 동일값)로 해시 후 mt_pwd/mt_udate UPDATE.
// 해시 실패/DB 오류 시 false(Python의 except→False). 호출 측이 이미 user를 로드했으므로
// "user 없음→False" 경로는 실질적으로 발생하지 않는다.
func (s *AuthService) updatePassword(mtIdx int, newPassword string) bool {
	hashed, err := auth.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return false
	}
	return s.members.UpdateColumns(mtIdx, map[string]interface{}{
		"mt_pwd": hashed, "mt_udate": dbUTCNow(),
	}) == nil
}
