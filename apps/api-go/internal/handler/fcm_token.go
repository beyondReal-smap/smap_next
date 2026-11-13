package handler

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// FCMTokenHandler는 Python app/api/v1/endpoints/fcm_token.py(/fcm-token)를 이식한다(전부 get_current_member 인증).
type FCMTokenHandler struct {
	svc *service.FCMTokenService
	cfg *config.Config
}

func NewFCMToken(svc *service.FCMTokenService, cfg *config.Config) *FCMTokenHandler {
	return &FCMTokenHandler{svc: svc, cfg: cfg}
}

// currentMember는 Python crud_auth.get_current_member를 이식한다(4-분기 401).
func (h *FCMTokenHandler) currentMember(c *gin.Context) (*model.Member, bool) {
	authHeader := c.GetHeader("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return nil, false
	}
	token := strings.SplitN(authHeader, " ", 2)[1] // Python authorization.split(" ")[1]
	claims, ok := auth.DecodeAccessClaims(token, h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰 검증에 실패했습니다."})
		return nil, false
	}
	if !claims.HasMtIdx {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "유효하지 않은 토큰입니다."})
		return nil, false
	}
	m, err := h.svc.GetMember(claims.MtIdx)
	if err != nil {
		plainServerError(c)
		return nil, false
	}
	if m == nil {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "사용자를 찾을 수 없습니다."})
		return nil, false
	}
	return m, true
}

// Status는 GET /fcm-token/status.
func (h *FCMTokenHandler) Status(c *gin.Context) {
	m, ok := h.currentMember(c)
	if !ok {
		return
	}
	writeJSON(c, http.StatusOK, h.svc.Status(m))
}

// Update는 POST /fcm-token/update. FCMTokenUpdateRequest{fcm_token: str, min 100/max 255}.
func (h *FCMTokenHandler) Update(c *gin.Context) {
	m, ok := h.currentMember(c)
	if !ok {
		return
	}
	token, errs := parseFCMTokenUpdate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, sok := h.svc.Update(m, token)
	if !sok {
		// Python: DB오류 시 resultData=str(e) → ResponseValidationError → 500 plain "Internal Server Error".
		internalServerErrorPlain(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// NotifyTokenChange는 POST /fcm-token/notify-token-change.
// ⚠️ Python은 firebase_service NameError(또는 토큰없음) → create_response(FAILURE, msg, str) → resultData가
//
//	문자열이라 FCMTokenResponse(resultData:Optional[dict]) 검증 실패 → **항상 500 plain "Internal Server Error"**.
func (h *FCMTokenHandler) NotifyTokenChange(c *gin.Context) {
	if _, ok := h.currentMember(c); !ok {
		return
	}
	internalServerErrorPlain(c)
}

// parseFCMTokenUpdate는 FCMTokenUpdateRequest(fcm_token 필수, 길이 100~255)를 검증한다.
func parseFCMTokenUpdate(c *gin.Context) (string, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	raw, ok := body["fcm_token"]
	if !ok {
		errs = append(errs, valErr{Type: "missing", Loc: []string{"body", "fcm_token"}, Msg: msgFieldRequired, Input: body})
		return "", errs
	}
	s, oks := raw.(string)
	if !oks {
		errs = append(errs, valErr{Type: "string_type", Loc: []string{"body", "fcm_token"}, Msg: msgStringType, Input: raw})
		return "", errs
	}
	n := utf8.RuneCountInString(s)
	if n < 100 {
		errs = append(errs, valErr{Type: "string_too_short", Loc: []string{"body", "fcm_token"},
			Msg: "String should have at least 100 characters", Input: s, Ctx: map[string]any{"min_length": 100}})
		return "", errs
	}
	if n > 255 {
		errs = append(errs, valErr{Type: "string_too_long", Loc: []string{"body", "fcm_token"},
			Msg: "String should have at most 255 characters", Input: s, Ctx: map[string]any{"max_length": 255}})
		return "", errs
	}
	return s, errs
}
