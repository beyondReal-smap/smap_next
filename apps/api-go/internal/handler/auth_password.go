package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Phase C — 비밀번호 재설정 4종(전부 무인증). Python은 모든 예외를 try/except로 흡수해
// 검증 실패를 제외하면 항상 200+success 플래그를 반환한다(서비스가 200 동등 응답을 만든다).

// ForgotPassword는 POST /auth/forgot-password. ForgotPasswordRequest{type, contact 필수}.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	typ, contact, errs := parseForgotBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.ForgotPassword(typ, contact))
}

// VerifyResetToken은 POST /auth/verify-reset-token. VerifyResetTokenRequest{token 필수}.
func (h *AuthHandler) VerifyResetToken(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	token := requiredStringField(body, "token", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.VerifyResetToken(token))
}

// ResetPassword는 POST /auth/reset-password. ResetPasswordRequest{token, new_password 필수}.
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	token := requiredStringField(body, "token", &errs)
	newPassword := requiredStringField(body, "new_password", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.ResetPassword(token, newPassword))
}

// ResetPasswordByPhone은 POST /auth/reset-password-by-phone.
// ResetPasswordByPhoneRequest{phone, new_password 필수, verification_code Optional[str]=""}.
func (h *AuthHandler) ResetPasswordByPhone(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	phone := requiredStringField(body, "phone", &errs)
	newPassword := requiredStringField(body, "new_password", &errs)
	code := derefOpt(optStringField(body, "verification_code", &errs))
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.ResetPasswordByPhone(phone, code, newPassword))
}

// parseForgotBody는 ForgotPasswordRequest(type·contact 필수)를 Pydantic 필드 순서대로 검증한다.
func parseForgotBody(c *gin.Context) (typ, contact string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	typ = requiredStringField(body, "type", &errs)
	contact = requiredStringField(body, "contact", &errs)
	return typ, contact, errs
}
