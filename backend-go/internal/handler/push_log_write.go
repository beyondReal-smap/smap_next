package handler

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// Create는 POST /push-logs/ — PushLogCreate(전 필드 Optional). API3_FCM_service/system_auto면 무DB 가짜 응답.
func (h *PushLogHandler) Create(c *gin.Context) {
	in, _, errs := parsePushLogBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, ok := h.svc.CreatePushLog(in)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Update는 PUT /push-logs/:push_log_id — exclude_unset(존재 컬럼만 UPDATE). 404 "Push log not found".
func (h *PushLogHandler) Update(c *gin.Context) {
	id, ok := pushLogPathID(c)
	if !ok {
		return
	}
	_, present, errs := parsePushLogBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, sok := h.svc.UpdatePushLog(id, present)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push log not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete는 DELETE /push-logs/:push_log_id — 하드 삭제. 404 "Push log not found".
func (h *PushLogHandler) Delete(c *gin.Context) {
	id, ok := pushLogPathID(c)
	if !ok {
		return
	}
	found, sok := h.svc.DeletePushLog(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push log not found"})
		return
	}
	writeJSON(c, http.StatusOK, okMessage{Success: true, Message: "Push log deleted successfully"})
}

// MarkRead는 PATCH /push-logs/:push_log_id/read — 읽음 처리. 404 "Push log not found".
func (h *PushLogHandler) MarkRead(c *gin.Context) {
	id, ok := pushLogPathID(c)
	if !ok {
		return
	}
	found, sok := h.svc.MarkPushLogRead(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push log not found"})
		return
	}
	writeJSON(c, http.StatusOK, okMessage{Success: true, Message: "Push log marked as read"})
}

// DeleteAll은 POST /push-logs/delete-all?mt_idx= — 회원 로그 일괄 소프트삭제.
func (h *PushLogHandler) DeleteAll(c *gin.Context) {
	var errs []valErr
	mtIdx := requiredQueryInt(c, "mt_idx", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.svc.DeleteAllPushLogs(mtIdx) {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, okMessage{Success: true, Message: "All push logs deleted successfully"})
}

// ReadAll은 POST /push-logs/read-all?mt_idx= — 회원 미읽음 일괄 읽음.
func (h *PushLogHandler) ReadAll(c *gin.Context) {
	var errs []valErr
	mtIdx := requiredQueryInt(c, "mt_idx", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.svc.ReadAllPushLogs(mtIdx) {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, okMessage{Success: true, Message: "All push logs marked as read"})
}

// okMessage는 {"success":bool,"message":str} 응답의 키 순서를 고정한다(Python dict 순서 = success 먼저).
// gin.H(map)는 Go가 키를 알파벳 정렬해 message가 먼저 나가므로 byte가 어긋난다 → 순서고정 struct 사용.
type okMessage struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func pushLogPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("push_log_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "push_log_id", idStr)
		return 0, false
	}
	return id, true
}

// parsePushLogBody는 PushLogBase(전 Optional)를 필드 순서대로 파싱한다.
// present 맵은 body에 존재한 컬럼만(값이 null이면 nil→UPDATE 시 NULL) — PUT exclude_unset용.
func parsePushLogBody(c *gin.Context) (in service.PushLogWriteInput, present map[string]interface{}, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present = map[string]interface{}{}
	// 순서: plt_type, mt_idx, sst_idx, plt_condition, plt_memo, plt_title, plt_content, plt_sdate, plt_status, plt_read_chk, plt_show, push_json
	in.PltType = bodyOptInt(body, "plt_type", present, &errs)
	in.MtIdx = bodyOptInt(body, "mt_idx", present, &errs)
	in.SstIdx = bodyOptInt(body, "sst_idx", present, &errs)
	in.PltCondition = bodyOptStr(body, "plt_condition", present, &errs)
	in.PltMemo = bodyOptStr(body, "plt_memo", present, &errs)
	in.PltTitle = bodyOptStr(body, "plt_title", present, &errs)
	in.PltContent = bodyOptStr(body, "plt_content", present, &errs)
	in.PltSdate = bodyOptDatetime(body, "plt_sdate", present, &errs)
	in.PltStatus = bodyOptInt(body, "plt_status", present, &errs)
	in.PltReadChk = bodyOptStr(body, "plt_read_chk", present, &errs)
	in.PltShow = bodyOptStr(body, "plt_show", present, &errs)
	in.PushJSON = bodyOptStr(body, "push_json", present, &errs)
	return in, present, errs
}

// bodyOptInt는 Optional int 필드를 파싱한다(미존재→nil·미기록, null→nil·present NULL, 숫자/숫자문자열 coerce, 그 외 422).
func bodyOptInt(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) *int {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	if raw == nil {
		present[key] = nil
		return nil
	}
	switch v := raw.(type) {
	case float64:
		if v == math.Trunc(v) {
			n := int(v)
			present[key] = n
			return &n
		}
		*errs = append(*errs, valErr{Type: "int_from_float", Loc: []string{"body", key}, Msg: "Input should be a valid integer, got a number with a fractional part", Input: raw})
	case string:
		if n, e := strconv.Atoi(v); e == nil {
			present[key] = n
			return &n
		}
		*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"body", key}, Msg: "Input should be a valid integer, unable to parse string as an integer", Input: v})
	default:
		*errs = append(*errs, valErr{Type: "int_type", Loc: []string{"body", key}, Msg: "Input should be a valid integer", Input: raw})
	}
	return nil
}

// bodyOptStr는 Optional 문자열 필드를 파싱한다(미존재→nil·미기록, null→nil·present NULL, 문자열 통과, 그 외 string_type 422).
func bodyOptStr(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) *string {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	if raw == nil {
		present[key] = nil
		return nil
	}
	if s, oks := raw.(string); oks {
		present[key] = s
		return &s
	}
	*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
	return nil
}

// bodyOptDatetime은 Optional datetime 필드를 파싱한다(ISO 문자열). 파싱 실패는 datetime_parsing 422.
func bodyOptDatetime(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) *time.Time {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	if raw == nil {
		present[key] = nil
		return nil
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "datetime_type", Loc: []string{"body", key}, Msg: "Input should be a valid datetime", Input: raw})
		return nil
	}
	for _, layout := range []string{"2006-01-02T15:04:05.999999", "2006-01-02T15:04:05", time.RFC3339, "2006-01-02 15:04:05"} {
		if t, e := time.ParseInLocation(layout, s, time.Local); e == nil {
			present[key] = t
			return &t
		}
	}
	*errs = append(*errs, valErr{Type: "datetime_from_date_parsing", Loc: []string{"body", key}, Msg: "Input should be a valid datetime or date, invalid character in year", Input: s})
	return nil
}

// requiredQueryInt는 필수 query 정수(Python def f(mt_idx: int))를 파싱한다. 미제공→missing(input:null), 비정수→int_parsing.
func requiredQueryInt(c *gin.Context, key string, errs *[]valErr) int {
	raw, has := c.GetQuery(key)
	if !has {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"query", key}, Msg: msgFieldRequired, Input: nil})
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"query", key}, Msg: "Input should be a valid integer, unable to parse string as an integer", Input: raw})
		return 0
	}
	return n
}
