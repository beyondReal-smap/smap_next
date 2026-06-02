package handler

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// MemberFCMTokenHandler는 Python app/api/v1/endpoints/member_fcm_token.py(/member-fcm-token, 12종)를 이식한다.
type MemberFCMTokenHandler struct {
	svc *service.MemberFCMTokenService
	cfg *config.Config
	fcm fcm.Sender // DEBUG test-ios-push 전용(DEBUG=false면 미사용)
}

func NewMemberFCMToken(svc *service.MemberFCMTokenService, cfg *config.Config, sender fcm.Sender) *MemberFCMTokenHandler {
	return &MemberFCMTokenHandler{svc: svc, cfg: cfg, fcm: sender}
}

// requireUserID는 Python deps.get_required_user_id: 미인증 시 401 "인증이 필요합니다." + WWW-Authenticate: Bearer.
func (h *MemberFCMTokenHandler) requireUserID(c *gin.Context) (int, bool) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return 0, false
	}
	return uid, true
}

// horizontalAuth는 Python _check_horizontal_authorization: 본인 아니면 관리자(mt_level=9)만 허용, 아니면 403.
func (h *MemberFCMTokenHandler) horizontalAuth(c *gin.Context, userID, target int) bool {
	if userID == target {
		return true
	}
	m, err := h.svc.GetByID(userID)
	if err == nil && m != nil && m.MtLevel != nil && *m.MtLevel == 9 {
		return true
	}
	writeJSON(c, http.StatusForbidden, gin.H{"detail": "다른 회원의 토큰에 접근할 수 없습니다."})
	return false
}

func (h *MemberFCMTokenHandler) writeResult(c *gin.Context, resp interface{}, e *service.FCMErr) {
	if e != nil {
		writeJSON(c, e.Status, gin.H{"detail": e.Detail})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Register는 POST /register(인증+수평인가).
func (h *MemberFCMTokenHandler) Register(c *gin.Context) {
	uid, ok := h.requireUserID(c)
	if !ok {
		return
	}
	in, errs := parseMemberFCMReq(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.horizontalAuth(c, uid, in.MtIdx) {
		return
	}
	resp, e := h.svc.Register(in.MtIdx, in.FcmToken)
	h.writeResult(c, resp, e)
}

// CheckAndUpdate는 POST /check-and-update(인증+수평인가).
func (h *MemberFCMTokenHandler) CheckAndUpdate(c *gin.Context) {
	uid, ok := h.requireUserID(c)
	if !ok {
		return
	}
	in, errs := parseMemberFCMReq(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.horizontalAuth(c, uid, in.MtIdx) {
		return
	}
	resp, e := h.svc.CheckAndUpdate(in.MtIdx, in.FcmToken)
	h.writeResult(c, resp, e)
}

// ValidateAndRefresh는 POST /validate-and-refresh(인증, 수평인가 없음).
func (h *MemberFCMTokenHandler) ValidateAndRefresh(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	in, errs := parseMemberFCMReq(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, e := h.svc.ValidateAndRefresh(in.MtIdx, in.FcmToken, in.ForceRefresh)
	h.writeResult(c, resp, e)
}

// BackgroundCheck는 POST /background-check(인증, 수평인가 없음).
func (h *MemberFCMTokenHandler) BackgroundCheck(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	in, errs := parseBackgroundCheckReq(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, e := h.svc.BackgroundCheck(in.MtIdx, in.FcmToken, in.CheckType, in.ForceRefresh)
	h.writeResult(c, resp, e)
}

// Status는 GET /status/{mt_idx}(인증+수평인가).
func (h *MemberFCMTokenHandler) Status(c *gin.Context) {
	uid, ok := h.requireUserID(c)
	if !ok {
		return
	}
	id, ok := memberFCMPathID(c)
	if !ok {
		return
	}
	if !h.horizontalAuth(c, uid, id) {
		return
	}
	resp, e := h.svc.StatusOf(id)
	h.writeResult(c, resp, e)
}

// CleanupExpiredTokens는 POST /cleanup-expired-tokens(무인증).
func (h *MemberFCMTokenHandler) CleanupExpiredTokens(c *gin.Context) {
	resp, e := h.svc.CleanupExpiredTokens()
	h.writeResult(c, resp, e)
}

// ResetInvalidTokens는 POST /reset-invalid-tokens(인증).
func (h *MemberFCMTokenHandler) ResetInvalidTokens(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	resp, e := h.svc.ResetInvalidTokens()
	h.writeResult(c, resp, e)
}

// NotifyTokenRefresh는 POST /notify-token-refresh?mt_idx=(인증).
func (h *MemberFCMTokenHandler) NotifyTokenRefresh(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	var errs []valErr
	mtIdx := requiredQueryInt(c, "mt_idx", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, e := h.svc.NotifyTokenRefresh(mtIdx)
	h.writeResult(c, resp, e)
}

// --- DEBUG 전용 4종: 인증 통과 후 DEBUG=false면 404 "Not Found"(Python settings.DEBUG 게이트) ---

// FullToken은 GET /full-token/{mt_idx}.
func (h *MemberFCMTokenHandler) FullToken(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	if !h.cfg.Debug {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Not Found"})
		return
	}
	id, ok := memberFCMPathID(c)
	if !ok {
		return
	}
	m, err := h.svc.GetByID(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "전체 FCM 토큰 조회 실패: db"})
		return
	}
	if m == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": memberNotFoundDetail(id)})
		return
	}
	if m.MtTokenID == nil || *m.MtTokenID == "" {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "FCM 토큰이 존재하지 않습니다."})
		return
	}
	writeJSON(c, http.StatusOK, gin.H{
		"success": true, "mt_idx": m.MtIdx, "full_token": *m.MtTokenID,
		"token_length":     len([]rune(*m.MtTokenID)),
		"token_updated_at": isoOrNil(m.MtTokenUpdatedAt), "token_expiry_date": isoOrNil(m.MtTokenExpiryDate),
		"warning": "⚠️ 이 엔드포인트는 테스트용입니다. 프로덕션에서는 사용하지 마세요.",
	})
}

// TestIOSPush는 POST /test-ios-push.
func (h *MemberFCMTokenHandler) TestIOSPush(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	if !h.cfg.Debug {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Not Found"})
		return
	}
	var body map[string]interface{}
	_ = c.ShouldBindJSON(&body)
	mtIdx := 0
	if v, ok := body["mt_idx"].(float64); ok {
		mtIdx = int(v)
	}
	testType, _ := body["test_type"].(string)
	if testType == "" {
		testType = "simple"
	}
	m, _ := h.svc.GetByID(mtIdx)
	if m == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": memberNotFoundDetail(mtIdx)})
		return
	}
	tok := ""
	if m.MtTokenID != nil {
		tok = *m.MtTokenID
	}
	if tok == "" {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "회원의 FCM 토큰을 찾을 수 없습니다."})
		return
	}
	if !containsColon(tok) {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "iOS FCM 토큰이 아닙니다."})
		return
	}
	title := "🧪 iOS 푸시 테스트 (" + testType + ")"
	content := "테스트 시간: " + time.Now().Format("15:04:05")
	resp, _ := h.fcm.Send(context.Background(), fcm.Message{Token: tok, Title: title, Body: content})
	writeJSON(c, http.StatusOK, gin.H{
		"success": true, "message": "iOS 푸시 테스트 완료 (" + testType + ")", "response": resp,
		"token_length": len([]rune(tok)), "token_preview": maskTokenH(tok),
		"test_time": isoNow(), "member_id": mtIdx,
	})
}

// UpdateLogs는 GET /update-logs/{mt_idx}. ⚠️ Python은 docker logs grep(환경 도구) — Go는 fallback 로그만 반환.
func (h *MemberFCMTokenHandler) UpdateLogs(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	if !h.cfg.Debug {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Not Found"})
		return
	}
	id, ok := memberFCMPathID(c)
	if !ok {
		return
	}
	logs := []string{
		"최근 로그 검색 결과 없음 (회원 ID: " + strconv.Itoa(id) + ")",
		"토큰 업데이트 시 실시간 로그가 콘솔에 출력됩니다:",
		"   [TOKEN UPDATE] 토큰 업데이트 시작",
		"   [TOKEN UPDATE] 엔드포인트: /register 또는 /check-and-update",
		"   [TOKEN UPDATE] 클라이언트 IP, User-Agent",
		"   [TOKEN UPDATE] 토큰 업데이트 완료",
	}
	writeJSON(c, http.StatusOK, gin.H{
		"success": true, "mt_idx": id, "log_count": len(logs), "logs": logs,
		"search_time": isoNow(), "note": "토큰 업데이트 시 실시간으로 서버 콘솔에 상세 로그가 출력됩니다.",
	})
}

// TriggerUpdate는 POST /trigger-update/{mt_idx}.
func (h *MemberFCMTokenHandler) TriggerUpdate(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	if !h.cfg.Debug {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Not Found"})
		return
	}
	id, ok := memberFCMPathID(c)
	if !ok {
		return
	}
	m, _ := h.svc.GetByID(id)
	if m == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": memberNotFoundDetail(id)})
		return
	}
	if m.MtTokenID == nil || *m.MtTokenID == "" {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "회원의 FCM 토큰을 찾을 수 없습니다."})
		return
	}
	// 기존 토큰+"_TEST_TRIGGER"로 register 호출 후 원복(로그 트리거용).
	_, _ = h.svc.Register(id, *m.MtTokenID+"_TEST_TRIGGER")
	_ = h.svc.RestoreToken(id, *m.MtTokenID)
	writeJSON(c, http.StatusOK, gin.H{
		"success": true, "message": "토큰 업데이트 로그 트리거 완료", "mt_idx": id,
		"trigger_time": isoNow(), "note": "서버 콘솔에서 🔄 [TOKEN UPDATE] 로그를 확인하세요",
	})
}

// --- 파서/헬퍼 ---

func memberFCMPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return 0, false
	}
	return id, true
}

type memberFCMReqInput struct {
	MtIdx        int
	FcmToken     string
	ForceRefresh bool
}

// parseMemberFCMReq는 MemberFCMTokenRequest{mt_idx gt0, fcm_token min20/max500, force_refresh}.
func parseMemberFCMReq(c *gin.Context) (memberFCMReqInput, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var in memberFCMReqInput
	var errs []valErr
	in.MtIdx = parseGtZeroInt(body, "mt_idx", &errs)
	in.FcmToken = parseLenStr(body, "fcm_token", 20, 500, &errs)
	in.ForceRefresh = optBoolDefault(body, "force_refresh", false, &errs)
	return in, errs
}

type bgCheckInput struct {
	MtIdx        int
	FcmToken     string
	CheckType    string
	ForceRefresh bool
}

// parseBackgroundCheckReq는 BackgroundTokenCheckRequest{mt_idx, fcm_token, check_type="background", force_refresh}.
func parseBackgroundCheckReq(c *gin.Context) (bgCheckInput, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var in bgCheckInput
	var errs []valErr
	in.MtIdx = requiredIntField(body, "mt_idx", &errs)
	in.FcmToken = requiredStringField(body, "fcm_token", &errs)
	ct := optStringField(body, "check_type", &errs)
	in.CheckType = "background"
	if ct != nil {
		in.CheckType = *ct
	}
	in.ForceRefresh = optBoolDefault(body, "force_refresh", false, &errs)
	return in, errs
}

// parseGtZeroInt는 필수 int(gt=0). 미제공→missing, 비정수→int_parsing, <=0→greater_than ctx{gt:0}.
func parseGtZeroInt(body map[string]interface{}, key string, errs *[]valErr) int {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return 0
	}
	var n int
	switch v := raw.(type) {
	case float64:
		if v != math.Trunc(v) {
			*errs = append(*errs, valErr{Type: "int_from_float", Loc: []string{"body", key}, Msg: "Input should be a valid integer, got a number with a fractional part", Input: raw})
			return 0
		}
		n = int(v)
	case string:
		p, e := strconv.Atoi(v)
		if e != nil {
			*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"body", key}, Msg: "Input should be a valid integer, unable to parse string as an integer", Input: v})
			return 0
		}
		n = p
	default:
		*errs = append(*errs, valErr{Type: "int_type", Loc: []string{"body", key}, Msg: "Input should be a valid integer", Input: raw})
		return 0
	}
	if n <= 0 {
		*errs = append(*errs, valErr{Type: "greater_than", Loc: []string{"body", key}, Msg: "Input should be greater than 0", Input: n, Ctx: map[string]any{"gt": 0}})
		return 0
	}
	return n
}

// parseLenStr는 필수 문자열(min/max 길이). 미제공→missing, 비문자열→string_type, 길이 위반→string_too_short/long.
func parseLenStr(body map[string]interface{}, key string, min, max int, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
		return ""
	}
	n := len([]rune(s))
	if n < min {
		*errs = append(*errs, valErr{Type: "string_too_short", Loc: []string{"body", key}, Msg: "String should have at least " + strconv.Itoa(min) + " characters", Input: s, Ctx: map[string]any{"min_length": min}})
		return ""
	}
	if n > max {
		*errs = append(*errs, valErr{Type: "string_too_long", Loc: []string{"body", key}, Msg: "String should have at most " + strconv.Itoa(max) + " characters", Input: s, Ctx: map[string]any{"max_length": max}})
		return ""
	}
	return s
}

func memberNotFoundDetail(id int) string {
	return "회원 ID " + strconv.Itoa(id) + "을 찾을 수 없습니다. 앱을 재시작하여 최신 회원 정보를 동기화해주세요."
}

func containsColon(s string) bool {
	for _, r := range s {
		if r == ':' {
			return true
		}
	}
	return false
}

// isoFormat은 Python datetime.isoformat()(마이크로초 0이면 초까지)와 동등하다(DEBUG 응답용).
func isoFormat(t time.Time) string {
	if t.Nanosecond() == 0 {
		return t.Format("2006-01-02T15:04:05")
	}
	return t.Format("2006-01-02T15:04:05.000000")
}

func isoNow() string { return isoFormat(time.Now()) }

func isoOrNil(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return isoFormat(*t)
}

// maskTokenH는 핸들러용 토큰 마스킹(DEBUG test-ios-push). service.maskToken과 동일 규칙.
func maskTokenH(token string) string {
	r := []rune(token)
	if len(r) < 16 {
		return "***"
	}
	return string(r[:8]) + "..." + string(r[len(r)-4:])
}
