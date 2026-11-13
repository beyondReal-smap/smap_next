package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/netutil"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// SMSHandler는 Python app/api/v1/endpoints/sms.py의 인증번호/일반 SMS 발송 핸들러.
type SMSHandler struct {
	revocable // 비밀번호 변경 이전 토큰 무효 기준(SetRevocation)
	verify    *service.SMSVerifyService
	sms       *service.SMSService
	cfg       *config.Config
}

func NewSMS(verify *service.SMSVerifyService, sms *service.SMSService, cfg *config.Config) *SMSHandler {
	return &SMSHandler{verify: verify, sms: sms, cfg: cfg}
}

// requireUserID는 Python deps.get_required_user_id: 토큰 없으면 401 "인증이 필요합니다." + WWW-Authenticate: Bearer.
func (h *SMSHandler) requireUserID(c *gin.Context) (int, bool) {
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return 0, false
	}
	return uid, true
}

// SendVerificationCode는 POST /sms/send-verification-code (무인증). VerificationCodeRequest{phone_number 필수}.
func (h *SMSHandler) SendVerificationCode(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	phone := requiredStringField(body, "phone_number", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	r := h.verify.SendVerificationCode(c.Request.Context(), phone, netutil.ClientIP(c.Request, h.cfg.TrustedClientIPHeader))
	writeVerificationResult(c, r)
}

// VerifyCode는 POST /sms/verify-code (무인증). VerifyCodeRequest{phone_number, code 필수}.
func (h *SMSHandler) VerifyCode(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	phone := requiredStringField(body, "phone_number", &errs)
	code := requiredStringField(body, "code", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	r := h.verify.VerifyCode(c.Request.Context(), phone, code)
	writeVerificationResult(c, r)
}

// writeVerificationResult는 {success, error} 응답을 쓴다. 한도 초과(429, Retry-After 포함)·저장소 장애(503)는
// 같은 본문에 FastAPI/이메일 인증과 같은 detail 키를 더한다. 구버전 Android는 비정상 상태에서도 본문의
// "error" 값을 정규식으로 읽어 보여 주고(발송은 상태만 보고 일반 문구), iOS는 상태 코드만 본다.
func writeVerificationResult(c *gin.Context, r service.VerificationResult) {
	if r.Status == 0 || r.Status == http.StatusOK {
		writeJSON(c, http.StatusOK, dto.SMSVerificationResponse{Success: r.Success, Error: r.Error})
		return
	}
	if r.Status == http.StatusTooManyRequests && r.RetryAfter > 0 {
		c.Header("Retry-After", strconv.Itoa(r.RetryAfter))
	}
	writeJSON(c, r.Status, gin.H{"success": false, "error": r.Error, "detail": r.Error})
}

// Send는 POST /sms/send (인증 필수). SMSRequest{phone_number, message 필수, subject 기본 "SMAP"}.
// 인증이 body 검증보다 우선(FastAPI sub-dependency 먼저 풀려 short-circuit → 무인증 시 401).
func (h *SMSHandler) Send(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	phone := requiredStringField(body, "phone_number", &errs)
	message := requiredStringField(body, "message", &errs)
	subjectPtr := optStringField(body, "subject", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	subject := "SMAP"
	if subjectPtr != nil {
		subject = *subjectPtr
	}
	r := h.sms.SendSMS(phone, message, subject)
	writeJSON(c, http.StatusOK, dto.SMSSendResponse{Success: r.Success, Message: r.Message, MsgID: r.MsgID})
}
