package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/netutil"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// AuthHandler는 Python `app/api/v1/endpoints/auth.py`의 비밀번호 로그인·토큰 수명주기 핸들러.
type AuthHandler struct {
	svc *service.AuthService
	cfg *config.Config
	// revocation은 비밀번호 변경 이전에 발급된 access token을 /auth/refresh v1에서도 거부하기 위한 기준 조회기(nil 가능).
	revocation auth.AccessRevocationChecker
}

// SetRevocation은 구 access token 무효 기준 조회기를 주입한다.
func (h *AuthHandler) SetRevocation(r auth.AccessRevocationChecker) { h.revocation = r }

// writeAuthRejection은 {"detail": ...} 거부 응답을 쓴다(429면 Retry-After 포함).
func writeAuthRejection(c *gin.Context, rej *service.AuthRejection) {
	if rej.Status == http.StatusTooManyRequests && rej.RetryAfter > 0 {
		c.Header("Retry-After", strconv.Itoa(rej.RetryAfter))
	}
	writeJSON(c, rej.Status, gin.H{"detail": rej.Detail})
}

func (h *AuthHandler) clientMeta(c *gin.Context) service.ClientMeta {
	return service.ClientMeta{
		UserAgent: c.GetHeader("User-Agent"),
		IPHash:    clientIPHash(c),
		ClientIP:  netutil.ClientIP(c.Request, h.cfg.TrustedClientIPHeader),
	}
}

func NewAuth(svc *service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{svc: svc, cfg: cfg}
}

// clientIPHash는 Python _client_ip_hash: client IP sha256 hex(응답 미노출, refresh 메타데이터용).
func clientIPHash(c *gin.Context) string {
	ip := c.ClientIP()
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(sum[:])
}

// Login은 POST /auth/login (login_for_home_page). 항상 200(성공/실패 모두 success 플래그).
func (h *AuthHandler) Login(c *gin.Context) {
	in, errs := parseLoginHomeBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, rej := h.svc.Login(c.Request.Context(), in, h.clientMeta(c))
	if rej != nil {
		writeAuthRejection(c, rej)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Logout은 POST /auth/logout. body refresh_token 있으면 revoke, 항상 고정 200.
func (h *AuthHandler) Logout(c *gin.Context) {
	var body map[string]interface{}
	_ = c.ShouldBindJSON(&body)
	raw := ""
	if body != nil {
		if v, ok := body["refresh_token"].(string); ok {
			raw = v
		}
	}
	writeJSON(c, http.StatusOK, h.svc.Logout(raw))
}

// Refresh는 POST /auth/refresh. v2(body refresh_token rotation) 우선, 없으면 v1(Bearer access 재발급).
func (h *AuthHandler) Refresh(c *gin.Context) {
	var body map[string]interface{}
	_ = c.ShouldBindJSON(&body)

	// ── v2 경로: body.refresh_token이 비어있지 않은 문자열일 때만.
	rawRefresh := ""
	if body != nil {
		if v, ok := body["refresh_token"].(string); ok {
			rawRefresh = v
		}
	}
	if rawRefresh != "" {
		outcome, resp := h.svc.RefreshV2(rawRefresh, c.GetHeader("User-Agent"), clientIPHash(c))
		switch outcome {
		case service.RefreshV2OK:
			writeJSON(c, http.StatusOK, resp)
		case service.RefreshV2Invalid:
			writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "Refresh token이 유효하지 않습니다."})
		case service.RefreshUserGone:
			writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "사용자를 찾을 수 없습니다."})
		default:
			plainServerError(c)
		}
		return
	}

	// ── v1 경로(하위 호환): Authorization: Bearer <access_token>.
	authHeader := c.GetHeader("Authorization")
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰이 필요합니다."})
		return
	}
	access := strings.TrimSpace(authHeader[7:])
	claims, ok := auth.DecodeAccessClaims(access, h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	// 비밀번호 변경 이전에 발급된 access token으로는 새 토큰을 받을 수 없다(없는 토큰/무효 토큰과 같은 401).
	if ok && claims.HasMtIdx && auth.AccessRevoked(h.revocation, nil, auth.AccessIdentity{MtIdx: claims.MtIdx, IAT: claims.IAT, HasIAT: claims.HasIAT}) {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰 갱신에 실패했습니다."})
		return
	}
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰 갱신에 실패했습니다."})
		return
	}
	if !claims.HasMtIdx {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰이 유효하지 않습니다."})
		return
	}
	outcome, resp := h.svc.RefreshV1(claims.MtIdx, claims.MtID, claims.MtName)
	if outcome == service.RefreshV1Fail {
		// 탈퇴·정지·비노출 회원: 기존 v1 실패 응답 형식과 동일한 401.
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "토큰 갱신에 실패했습니다."})
		return
	}
	if outcome != service.RefreshV1OK {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// LoginOriginal은 POST /auth/login-original (레거시). 401 시 WWW-Authenticate: Bearer.
func (h *AuthHandler) LoginOriginal(c *gin.Context) {
	mtHp, mtPass, errs := parseLoginOriginalBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	outcome, resp := h.svc.LoginOriginal(mtHp, mtPass)
	switch outcome {
	case service.LoginOrigOK:
		writeJSON(c, http.StatusOK, resp)
	case service.LoginOrigUnauthorized:
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "아이디 또는 비밀번호를 잘못 입력했습니다."})
	default:
		plainServerError(c)
	}
}

// Register는 POST /auth/register. 201 성공, 409 중복, 422/400 검증, 500 생성 실패.
func (h *AuthHandler) Register(c *gin.Context) {
	in, status, ok := parseRegisterBody(c)
	if !ok {
		if status == http.StatusBadRequest {
			writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Invalid request body"})
		} else {
			writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": "요청 데이터 형식이 올바르지 않습니다."})
		}
		return
	}
	resp, rej := h.svc.Register(c.Request.Context(), in, h.clientMeta(c))
	if rej != nil {
		writeAuthRejection(c, rej)
		return
	}
	writeJSON(c, http.StatusCreated, resp)
}

// --- body 파서 ---

// requiredStringField는 필수 문자열 필드를 검증한다. 미제공→missing, 문자열 아님→string_type.
func requiredStringField(body map[string]interface{}, key string, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	if s, okv := coerceJSONString(raw); okv {
		return s
	}
	*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
	return ""
}

// parseLoginHomeBody는 LoginRequestHome을 파싱한다. Pydantic 필드 순서대로 422를 수집한다:
// mt_id, mt_pwd, fcm_token, device_id, device_model, os_type, os_version, app_version.
func parseLoginHomeBody(c *gin.Context) (in service.LoginInput, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	in.MtID = requiredStringField(body, "mt_id", &errs)
	in.MtPwd = requiredStringField(body, "mt_pwd", &errs)
	// 옵션 문자열들 — 타입 오류만 422(순서 유지). fcm_token은 서비스 미사용이라 값 버림.
	_ = derefOpt(optStringField(body, "fcm_token", &errs))
	in.DeviceID = derefOpt(optStringField(body, "device_id", &errs))
	in.DeviceModel = derefOpt(optStringField(body, "device_model", &errs))
	in.OsType = derefOpt(optStringField(body, "os_type", &errs))
	in.OsVersion = derefOpt(optStringField(body, "os_version", &errs))
	in.AppVersion = derefOpt(optStringField(body, "app_version", &errs))
	return in, errs
}

// parseLoginOriginalBody는 LoginRequest{mt_hp:str, mt_pass:str, fcm_token:Optional[str]}.
func parseLoginOriginalBody(c *gin.Context) (mtHp, mtPass string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	mtHp = requiredStringField(body, "mt_hp", &errs)
	mtPass = requiredStringField(body, "mt_pass", &errs)
	_ = derefOpt(optStringField(body, "fcm_token", &errs))
	return mtHp, mtPass, errs
}

// registerBody는 RegisterRequest 디코딩용(필수/옵션을 포인터로 구분). json.Unmarshal 타입 강제가
// Pydantic str/int/bool 거부 경계를 근사한다(⚠️Pydantic lax 강제="123"→int, 1→bool 등은 미반영).
type registerBody struct {
	MtType     *int     `json:"mt_type"`
	MtLevel    *int     `json:"mt_level"`
	MtStatus   *int     `json:"mt_status"`
	MtID       *string  `json:"mt_id"`
	MtPwd      *string  `json:"mt_pwd"`
	MtName     *string  `json:"mt_name"`
	MtNickname *string  `json:"mt_nickname"`
	MtEmail    *string  `json:"mt_email"`
	MtBirth    *string  `json:"mt_birth"`
	MtGender   *int     `json:"mt_gender"`
	MtFile1    *string  `json:"mt_file1"`
	MtAgree1   *bool    `json:"mt_agree1"`
	MtAgree2   *bool    `json:"mt_agree2"`
	MtAgree3   *bool    `json:"mt_agree3"`
	MtAgree4   *bool    `json:"mt_agree4"`
	MtAgree5   *bool    `json:"mt_agree5"`
	MtTokenID  *string  `json:"mt_token_id"`
	MtLat      *float64 `json:"mt_lat"`
	MtLong     *float64 `json:"mt_long"`
	MtGoogleID *string  `json:"mt_google_id"`
	MtKakaoID  *string  `json:"mt_kakao_id"`
	MtAppleID  *string  `json:"mt_apple_id"`
	MtHp       *string  `json:"mt_hp"`

	EmailVerificationToken *string `json:"email_verification_token"`
	SocialProvider         *string `json:"social_provider"`
	SocialToken            *string `json:"social_token"`
}

// parseRegisterBody는 Python register_user의 수동 파싱을 이식한다.
//   - 비-JSON(또는 빈 body) → (_, 400, false): "Invalid request body".
//   - 유효 JSON이지만 객체 아님/타입 불일치/필수 누락 → (_, 422, false): plain 422.
//   - 성공 → (in, 0, true).
func parseRegisterBody(c *gin.Context) (service.RegisterInput, int, bool) {
	raw, err := c.GetRawData()
	if err != nil {
		return service.RegisterInput{}, http.StatusBadRequest, false
	}
	// request.json() 등가: 유효 JSON인지 먼저 확인(빈/깨진 JSON → 400).
	var probe interface{}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return service.RegisterInput{}, http.StatusBadRequest, false
	}
	// RegisterRequest(**body) 등가: 객체가 아니거나 타입 불일치면 422.
	var b registerBody
	if err := json.Unmarshal(raw, &b); err != nil {
		return service.RegisterInput{}, http.StatusUnprocessableEntity, false
	}
	// 필수 필드(str/bool) 존재 검증.
	if b.MtID == nil || b.MtName == nil || b.MtNickname == nil ||
		b.MtAgree1 == nil || b.MtAgree2 == nil || b.MtAgree3 == nil {
		return service.RegisterInput{}, http.StatusUnprocessableEntity, false
	}

	in := service.RegisterInput{
		MtType:     derefOrInt(b.MtType, 1),
		MtLevel:    derefOrInt(b.MtLevel, 2),
		MtStatus:   derefOrInt(b.MtStatus, 1),
		MtID:       *b.MtID,
		MtPwd:      b.MtPwd,
		MtName:     *b.MtName,
		MtNickname: *b.MtNickname,
		MtEmail:    b.MtEmail,
		MtBirth:    b.MtBirth,
		MtGender:   b.MtGender,
		MtFile1:    b.MtFile1,
		MtAgree1:   *b.MtAgree1,
		MtAgree2:   *b.MtAgree2,
		MtAgree3:   *b.MtAgree3,
		MtAgree4:   derefOrBool(b.MtAgree4, false),
		MtAgree5:   derefOrBool(b.MtAgree5, false),
		MtTokenID:  b.MtTokenID,
		MtLat:      b.MtLat,
		MtLong:     b.MtLong,
		MtGoogleID: b.MtGoogleID,
		MtKakaoID:  b.MtKakaoID,
		MtAppleID:  b.MtAppleID,
		MtHp:       b.MtHp,

		EmailVerificationToken: derefOpt(b.EmailVerificationToken),
		SocialProvider:         derefOpt(b.SocialProvider),
		SocialToken:            derefOpt(b.SocialToken),
	}
	return in, 0, true
}

func derefOpt(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func derefOrInt(p *int, def int) int {
	if p == nil {
		return def
	}
	return *p
}

func derefOrBool(p *bool, def bool) bool {
	if p == nil {
		return def
	}
	return *p
}
