package handler

import (
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// FCMSendoneHandler는 Python app/api/v1/endpoints/fcm_sendone.py의 발송 핸들러.
type FCMSendoneHandler struct {
	svc *service.PushSendService
}

func NewFCMSendone(svc *service.PushSendService) *FCMSendoneHandler {
	return &FCMSendoneHandler{svc: svc}
}

// Send는 POST /fcm_sendone/ (무인증). FCMSendRequest 검증 → 항상 200(success는 문자열 "true"/"false").
// mt_idx==0이면 전체발송. 검증 실패만 422.
func (h *FCMSendoneHandler) Send(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	// Pydantic 필드 순서대로 수집: plt_type, sst_idx, plt_condition, plt_memo, mt_idx, plt_title, plt_content.
	var in service.FCMSendInput
	in.PltType = requiredStringField(body, "plt_type", &errs)
	in.SstIdx = requiredStringField(body, "sst_idx", &errs)
	in.PltCondition = requiredStringField(body, "plt_condition", &errs)
	in.PltMemo = requiredStringField(body, "plt_memo", &errs)
	in.MtIdx = requiredIntField(body, "mt_idx", &errs)
	in.PltTitle = requiredStringField(body, "plt_title", &errs)
	in.PltContent = requiredStringField(body, "plt_content", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.SendOne(in))
}

// Test는 POST /fcm_sendone/test (무인증). FCMSendRequest 검증 후 실발송 없이 args를 data에 반향.
func (h *FCMSendoneHandler) Test(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	var echo dto.FCMTestEchoData
	echo.PltType = requiredStringField(body, "plt_type", &errs)
	echo.SstIdx = requiredStringField(body, "sst_idx", &errs)
	echo.PltCondition = requiredStringField(body, "plt_condition", &errs)
	echo.PltMemo = requiredStringField(body, "plt_memo", &errs)
	echo.MtIdx = requiredIntField(body, "mt_idx", &errs)
	echo.PltTitle = requiredStringField(body, "plt_title", &errs)
	echo.PltContent = requiredStringField(body, "plt_content", &errs)
	echo.UserAgent = optStringField(body, "user_agent", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.TestEcho(echo))
}

// TestSend는 POST /fcm_sendone/test-send/{mt_idx} (무인증). path 정수 mt_idx로 테스트 푸시 실발송.
func (h *FCMSendoneHandler) TestSend(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	writeJSON(c, http.StatusOK, h.svc.TestSendToUser(id))
}

// Silent는 POST /fcm_sendone/silent (무인증). SilentPushRequest{mt_idx 필수, reason/priority 옵션}.
func (h *FCMSendoneHandler) Silent(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	mtIdx := requiredIntField(body, "mt_idx", &errs)
	reason := derefOpt(optStringField(body, "reason", &errs))
	_ = derefOpt(optStringField(body, "priority", &errs)) // 검증만(서비스는 항상 high 사용)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if reason == "" {
		reason = "token_refresh" // Python 기본값
	}
	writeJSON(c, http.StatusOK, h.svc.SendSilent(mtIdx, reason))
}

// SilentBatch는 POST /fcm_sendone/silent-batch (무인증, 무body). 전체 토큰 보유자 Silent 발송.
func (h *FCMSendoneHandler) SilentBatch(c *gin.Context) {
	writeJSON(c, http.StatusOK, h.svc.SendSilentBatch())
}

// Background는 POST /fcm_sendone/background (무인증). BackgroundPushRequest(코어 7 필수 + 옵션).
func (h *FCMSendoneHandler) Background(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	var core service.FCMSendInput
	core.PltType = requiredStringField(body, "plt_type", &errs)
	core.SstIdx = requiredStringField(body, "sst_idx", &errs)
	core.PltCondition = requiredStringField(body, "plt_condition", &errs)
	core.PltMemo = requiredStringField(body, "plt_memo", &errs)
	core.MtIdx = requiredIntField(body, "mt_idx", &errs)
	core.PltTitle = requiredStringField(body, "plt_title", &errs)
	core.PltContent = requiredStringField(body, "plt_content", &errs)
	// 옵션 필드: content_available(bool=True), priority(str), show_notification(bool), event_url/schedule_id(str).
	contentAvailable := optBoolDefault(body, "content_available", true, &errs)
	_ = optBoolDefault(body, "show_notification", false, &errs)
	_ = derefOpt(optStringField(body, "priority", &errs))
	eventURL := derefOpt(optStringField(body, "event_url", &errs))
	scheduleID := derefOpt(optStringField(body, "schedule_id", &errs))
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.SendBackground(service.BackgroundInput{
		FCMSendInput:     core,
		ContentAvailable: contentAvailable,
		EventURL:         eventURL,
		ScheduleID:       scheduleID,
	}))
}

// optBoolDefault는 옵션 bool 필드를 읽는다(미제공→기본값, bool 아님→bool_type 422).
func optBoolDefault(body map[string]interface{}, key string, def bool, errs *[]valErr) bool {
	raw, ok := body[key]
	if !ok || raw == nil {
		return def
	}
	if b, okb := raw.(bool); okb {
		return b
	}
	*errs = append(*errs, valErr{Type: "bool_type", Loc: []string{"body", key}, Msg: "Input should be a valid boolean", Input: raw})
	return def
}

// requiredIntField는 Pydantic v2 int 필드(lax)를 근사한다.
//   - 미제공 → missing
//   - JSON 정수 → 값; 소수부 있는 number → int_from_float
//   - 숫자 문자열("123") → coerce; 비숫자 문자열("abc") → int_parsing(input=문자열)
//   - 그 외(bool/null) → int_type
func requiredIntField(body map[string]interface{}, key string, errs *[]valErr) int {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return 0
	}
	switch v := raw.(type) {
	case float64:
		if v == math.Trunc(v) {
			return int(v)
		}
		*errs = append(*errs, valErr{Type: "int_from_float", Loc: []string{"body", key},
			Msg: "Input should be a valid integer, got a number with a fractional part", Input: raw})
		return 0
	case string:
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
		*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"body", key},
			Msg: "Input should be a valid integer, unable to parse string as an integer", Input: v})
		return 0
	default:
		*errs = append(*errs, valErr{Type: "int_type", Loc: []string{"body", key},
			Msg: "Input should be a valid integer", Input: raw})
		return 0
	}
}
