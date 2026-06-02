package dto

// PwResetResponse는 Phase C 비번재설정 4종의 공통 응답 shape이다.
// Python ForgotPasswordResponse/VerifyResetTokenResponse/ResetPasswordResponse는 클래스만 다를 뿐
// 필드 구성({success, message, data: Optional[dict]=None})이 동일하다. data는 omitempty 없이 항상
// 직렬화되어 값이 없을 때 "data":null로 나간다(Python 기본 직렬화와 동일 — 라이브 검증 완료).
type PwResetResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// ForgotPasswordData는 forgot-password 성공 data: {type, contact, token_expires:"1분", sent:true}.
// contact는 정규화 전 원본(요청 그대로), token_expires는 하드코딩 문자열 "1분".
type ForgotPasswordData struct {
	Type         string `json:"type"`
	Contact      string `json:"contact"`
	TokenExpires string `json:"token_expires"`
	Sent         bool   `json:"sent"`
}

// VerifyResetTokenData는 verify-reset-token 성공 data: {user_id, type:"phone"(하드코딩), email, phone}.
// email/phone은 mt_email/mt_hp가 null일 수 있어 포인터(→ JSON null).
type VerifyResetTokenData struct {
	UserID int     `json:"user_id"`
	Type   string  `json:"type"`
	Email  *string `json:"email"`
	Phone  *string `json:"phone"`
}

// ResetPasswordData는 reset-password 성공 data: {user_id, email, updated_at}.
type ResetPasswordData struct {
	UserID    int     `json:"user_id"`
	Email     *string `json:"email"`
	UpdatedAt string  `json:"updated_at"`
}

// ResetPasswordByPhoneData는 reset-password-by-phone 성공 data: {user_id, updated_at}.
type ResetPasswordByPhoneData struct {
	UserID    int    `json:"user_id"`
	UpdatedAt string `json:"updated_at"`
}
