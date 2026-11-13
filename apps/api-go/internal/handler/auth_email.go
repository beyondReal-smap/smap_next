package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/netutil"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// EmailAuthHandler는 이메일 인증 4종 엔드포인트다:
// POST /auth/email/send-code, /auth/email/verify-code, /auth/email/change, /auth/reset-password-by-email.
// 라우트는 모두 공개로 등록하고, 로그인이 필요한 경우(purpose=change_email, /email/change)는
// 핸들러가 Bearer access 토큰을 직접 검증한다. ROUTE_AUTH_MODE(warn 등)와 무관하게 항상 강제된다.
type EmailAuthHandler struct {
	svc                *service.EmailAuthService
	cfg                *config.Config
	trustedClientIPHdr string
	logger             *slog.Logger
}

func NewEmailAuth(svc *service.EmailAuthService, cfg *config.Config, logger *slog.Logger) *EmailAuthHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &EmailAuthHandler{svc: svc, cfg: cfg, trustedClientIPHdr: cfg.TrustedClientIPHeader, logger: logger}
}

// writeEmailErr는 서비스 에러를 {"detail": ...} 응답으로 옮긴다. 알 수 없는 에러는 500(내용 비노출).
func (h *EmailAuthHandler) writeEmailErr(c *gin.Context, err error) {
	var ee *service.EmailAuthError
	if !errors.As(err, &ee) {
		h.logger.Error("email_auth_unexpected_error", slog.String("err", err.Error()))
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if ee.Status == http.StatusUnauthorized {
		c.Header("WWW-Authenticate", "Bearer")
	}
	if ee.Status == http.StatusTooManyRequests && ee.RetryAfter > 0 {
		c.Header("Retry-After", strconv.Itoa(ee.RetryAfter))
	}
	writeJSON(c, ee.Status, gin.H{"detail": ee.Detail})
}

// bearerUserID는 Authorization의 access 토큰에서 회원 번호를 꺼낸다. 없거나 무효면 (0, false).
func (h *EmailAuthHandler) bearerUserID(c *gin.Context) (int, bool) {
	uid, state := auth.VerifyAccessToken(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	return uid, state == auth.TokenValid
}

func unauthorized(c *gin.Context) {
	c.Header("WWW-Authenticate", "Bearer")
	writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
}

// parseEmailField는 email 필드를 정규화(trim+소문자)·검증한다(FastAPI EmailStr). 오류는 errs에 모은다.
func parseEmailField(body map[string]interface{}, errs *[]valErr) string {
	before := len(*errs)
	raw := requiredStringField(body, "email", errs)
	if len(*errs) > before {
		return ""
	}
	e, ok := service.NormalizeEmail(raw)
	if !ok {
		*errs = append(*errs, valErr{Type: "value_error", Loc: []string{"body", "email"},
			Msg: "value is not a valid email address", Input: raw})
		return ""
	}
	return e
}

// parseEmailPurpose는 {email, purpose}를 검증한다(FastAPI EmailRequest). 오류는 422.
func parseEmailPurpose(body map[string]interface{}, errs *[]valErr) (email, purpose string) {
	email = parseEmailField(body, errs)
	before := len(*errs)
	raw := requiredStringField(body, "purpose", errs)
	if len(*errs) > before {
		return email, ""
	}
	if !service.ValidEmailPurpose(raw) {
		*errs = append(*errs, valErr{Type: "literal_error", Loc: []string{"body", "purpose"},
			Msg: "Input should be 'register', 'reset_password' or 'change_email'", Input: raw})
		return email, ""
	}
	return email, raw
}

func readBody(c *gin.Context) map[string]interface{} {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil || body == nil {
		return map[string]interface{}{}
	}
	return body
}

// SendCode는 POST /auth/email/send-code. 응답 {"success": true}.
func (h *EmailAuthHandler) SendCode(c *gin.Context) {
	body := readBody(c)
	var errs []valErr
	email, purpose := parseEmailPurpose(body, &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid := 0
	if purpose == service.EmailPurposeChangeEmail {
		var ok bool
		if uid, ok = h.bearerUserID(c); !ok {
			unauthorized(c)
			return
		}
	}
	ip := netutil.ClientIP(c.Request, h.trustedClientIPHdr)
	if err := h.svc.SendCode(c.Request.Context(), email, purpose, ip, uid); err != nil {
		h.writeEmailErr(c, err)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true})
}

// VerifyCode는 POST /auth/email/verify-code. 응답 {"success": true, "verification_token": "..."}.
func (h *EmailAuthHandler) VerifyCode(c *gin.Context) {
	body := readBody(c)
	var errs []valErr
	email, purpose := parseEmailPurpose(body, &errs)
	code := requiredStringField(body, "code", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid := 0
	if purpose == service.EmailPurposeChangeEmail {
		var ok bool
		if uid, ok = h.bearerUserID(c); !ok {
			unauthorized(c)
			return
		}
	}
	token, err := h.svc.VerifyCode(c.Request.Context(), email, purpose, code, uid)
	if err != nil {
		h.writeEmailErr(c, err)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true, "verification_token": token})
}

// ChangeEmail은 POST /auth/email/change(로그인 필요). 응답 {"success": true}.
func (h *EmailAuthHandler) ChangeEmail(c *gin.Context) {
	body := readBody(c)
	var errs []valErr
	email := parseEmailField(body, &errs)
	token := requiredStringField(body, "verification_token", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.bearerUserID(c)
	if !ok {
		unauthorized(c)
		return
	}
	if err := h.svc.ChangeEmail(c.Request.Context(), uid, email, token); err != nil {
		h.writeEmailErr(c, err)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true})
}

// ResetPasswordByEmail은 POST /auth/reset-password-by-email. 응답 {"success": true}.
func (h *EmailAuthHandler) ResetPasswordByEmail(c *gin.Context) {
	body := readBody(c)
	var errs []valErr
	email := parseEmailField(body, &errs)
	token := requiredStringField(body, "verification_token", &errs)
	newPassword := requiredStringField(body, "new_password", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if err := h.svc.ResetPasswordByEmail(c.Request.Context(), email, token, newPassword); err != nil {
		h.writeEmailErr(c, err)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true})
}
