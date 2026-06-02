package handler

import (
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// Create는 POST /users/ (무인증). MemberCreate(검증+mt_id 정규화+mt_email @검증). mt_pwd 평문 저장.
func (h *UserHandler) Create(c *gin.Context) {
	in, errs := parseMemberCreate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, ok := h.svc.CreateUser(in)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// UpdateUser는 PUT /users/:user_id (무인증). MemberUpdate(전 Optional, exclude_unset). 404 "User not found".
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id, ok := userPathID(c)
	if !ok {
		return
	}
	present, errs := parseMemberUpdate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, sok := h.svc.UpdateUser(id, present)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// DeleteUser는 DELETE /users/:user_id (무인증). 하드 삭제 후 삭제된 회원 반환. 404 "User not found".
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, ok := userPathID(c)
	if !ok {
		return
	}
	resp, found, sok := h.svc.DeleteUser(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

func userPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("user_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "user_id", idStr)
		return 0, false
	}
	return id, true
}

// parseMemberCreate는 MemberCreate를 Pydantic 필드 순서대로 검증한다.
// 순서: mt_type, mt_level, mt_status, mt_id, mt_name, mt_nickname, mt_hp, mt_email, mt_birth,
//       mt_gender, mt_show, mt_agree1..5, mt_push1, mt_lat, mt_long, mt_onboarding, mt_pwd.
func parseMemberCreate(c *gin.Context) (in service.MemberCreateInput, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	in.MtType = uIntDefault(body, "mt_type", 1, &errs)
	in.MtLevel = uIntDefault(body, "mt_level", 2, &errs)
	in.MtStatus = uIntDefault(body, "mt_status", 1, &errs)
	in.MtID = uMtID(body, &errs) // 필수 + 정규화 + 전화번호 검증
	in.MtName = uReqStr(body, "mt_name", &errs)
	in.MtNickname = uReqStr(body, "mt_nickname", &errs)
	in.MtHp = uOptStr(body, "mt_hp", &errs)
	in.MtEmail = uMtEmail(body, &errs) // optional + @ 검증
	in.MtBirth = uDate(body, "mt_birth", &errs)
	in.MtGender = uOptInt(body, "mt_gender", &errs)
	in.MtShow = uEnumDefault(body, "mt_show", "Y", &errs)
	in.MtAgree1 = uEnumDefault(body, "mt_agree1", "N", &errs)
	in.MtAgree2 = uEnumDefault(body, "mt_agree2", "N", &errs)
	in.MtAgree3 = uEnumDefault(body, "mt_agree3", "N", &errs)
	in.MtAgree4 = uEnumDefault(body, "mt_agree4", "N", &errs)
	in.MtAgree5 = uEnumDefault(body, "mt_agree5", "N", &errs)
	in.MtPush1 = uEnumDefault(body, "mt_push1", "N", &errs)
	in.MtLat = uFloat(body, "mt_lat", &errs)
	in.MtLong = uFloat(body, "mt_long", &errs)
	in.MtOnboarding = uEnumDefault(body, "mt_onboarding", "N", &errs)
	in.MtPwd = uReqStr(body, "mt_pwd", &errs)
	return in, errs
}

// parseMemberUpdate는 MemberUpdate(전 Optional, exclude_unset, validator 없음)를 검증해 present 맵을 만든다.
// 순서: mt_name, mt_nickname, mt_email, mt_birth, mt_gender, mt_lat, mt_long, mt_push1, mt_file1.
func parseMemberUpdate(c *gin.Context) (map[string]interface{}, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present := map[string]interface{}{}
	var errs []valErr
	uOptStrPresent(body, "mt_name", present, &errs)
	uOptStrPresent(body, "mt_nickname", present, &errs)
	uOptStrPresent(body, "mt_email", present, &errs) // update는 @검증 없음(MemberUpdate)
	uDatePresent(body, "mt_birth", present, &errs)
	uOptIntPresent(body, "mt_gender", present, &errs)
	uFloatPresent(body, "mt_lat", present, &errs)
	uFloatPresent(body, "mt_long", present, &errs)
	uEnumPresent(body, "mt_push1", present, &errs)
	uOptStrPresent(body, "mt_file1", present, &errs)
	return present, errs
}

// --- create용 헬퍼(값 반환) ---

func uReqStr(body map[string]interface{}, key string, errs *[]valErr) string {
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
	return s
}

func uOptStr(body map[string]interface{}, key string, errs *[]valErr) *string {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
		return nil
	}
	return &s
}

// uMtID는 mt_id validator를 이식한다: 필수 → 빈문자열이면 "전화번호는 필수입니다.", 하이픈 제거 후
// 숫자아님/10자미만이면 "올바른 전화번호 형식이 아닙니다."(value_error). 통과 시 정규화된 값.
func uMtID(body map[string]interface{}, errs *[]valErr) string {
	raw, ok := body["mt_id"]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", "mt_id"}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", "mt_id"}, Msg: msgStringType, Input: raw})
		return ""
	}
	if s == "" {
		*errs = append(*errs, valueErr("mt_id", "전화번호는 필수입니다.", s))
		return ""
	}
	clean := strings.ReplaceAll(s, "-", "")
	if !isAllDigitsU(clean) || len([]rune(clean)) < 10 {
		*errs = append(*errs, valueErr("mt_id", "올바른 전화번호 형식이 아닙니다.", s))
		return ""
	}
	return clean
}

// uMtEmail은 mt_email validator: 값이 있고 '@' 없으면 "올바른 이메일 형식이 아닙니다."(value_error).
func uMtEmail(body map[string]interface{}, errs *[]valErr) *string {
	raw, ok := body["mt_email"]
	if !ok || raw == nil {
		return nil
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", "mt_email"}, Msg: msgStringType, Input: raw})
		return nil
	}
	if s != "" && !strings.Contains(s, "@") {
		*errs = append(*errs, valueErr("mt_email", "올바른 이메일 형식이 아닙니다.", s))
		return nil
	}
	return &s
}

func uIntDefault(body map[string]interface{}, key string, def int, errs *[]valErr) *int {
	raw, ok := body[key]
	if !ok {
		d := def
		return &d
	}
	if raw == nil {
		return nil
	}
	return uCoerceInt(raw, key, errs)
}

func uOptInt(body map[string]interface{}, key string, errs *[]valErr) *int {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	return uCoerceInt(raw, key, errs)
}

func uCoerceInt(raw interface{}, key string, errs *[]valErr) *int {
	switch v := raw.(type) {
	case float64:
		if v == math.Trunc(v) {
			n := int(v)
			return &n
		}
		*errs = append(*errs, valErr{Type: "int_from_float", Loc: []string{"body", key}, Msg: "Input should be a valid integer, got a number with a fractional part", Input: raw})
	case string:
		if n, e := strconv.Atoi(v); e == nil {
			return &n
		}
		*errs = append(*errs, valErr{Type: "int_parsing", Loc: []string{"body", key}, Msg: msgIntParse, Input: v})
	default:
		*errs = append(*errs, valErr{Type: "int_type", Loc: []string{"body", key}, Msg: "Input should be a valid integer", Input: raw})
	}
	return nil
}

func uEnumDefault(body map[string]interface{}, key, def string, errs *[]valErr) *string {
	raw, ok := body[key]
	if !ok {
		d := def
		return &d
	}
	if raw == nil {
		return nil
	}
	if s, oks := raw.(string); oks && ynEnumSet[s] {
		return &s
	}
	e := valErr{Type: "enum", Loc: []string{"body", key}, Msg: "Input should be 'Y' or 'N'", Input: raw}
	e.Ctx = map[string]any{"expected": "'Y' or 'N'"}
	*errs = append(*errs, e)
	return nil
}

func uFloat(body map[string]interface{}, key string, errs *[]valErr) *float64 {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	return uCoerceFloat(raw, key, errs)
}

func uCoerceFloat(raw interface{}, key string, errs *[]valErr) *float64 {
	switch v := raw.(type) {
	case float64:
		return &v
	case string:
		if f, e := strconv.ParseFloat(v, 64); e == nil {
			return &f
		}
		*errs = append(*errs, valErr{Type: "float_parsing", Loc: []string{"body", key}, Msg: "Input should be a valid number, unable to parse string as a number", Input: v})
	default:
		*errs = append(*errs, valErr{Type: "float_type", Loc: []string{"body", key}, Msg: "Input should be a valid number", Input: raw})
	}
	return nil
}

// uDate는 mt_birth(Optional[date]) "YYYY-MM-DD" 파싱. ⚠️ 비정상 날짜의 422 detail은 speedate별로 달라
// 완벽 byte-match는 보장 못 함(정상/생략은 동작). 길이<10이면 "input is too short" 변형을 재현.
func uDate(body map[string]interface{}, key string, errs *[]valErr) *time.Time {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "date_type", Loc: []string{"body", key}, Msg: "Input should be a valid date", Input: raw})
		return nil
	}
	if t, e := time.ParseInLocation("2006-01-02", s, time.Local); e == nil {
		return &t
	}
	de := valErr{Type: "date_from_datetime_parsing", Loc: []string{"body", key},
		Msg: "Input should be a valid date or datetime, input is too short", Input: s, Ctx: map[string]any{"error": "input is too short"}}
	*errs = append(*errs, de)
	return nil
}

// --- update용 헬퍼(present 맵 기록) ---

func uOptStrPresent(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	if s, oks := raw.(string); oks {
		present[key] = s
		return
	}
	*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
}

func uOptIntPresent(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	if v := uCoerceInt(raw, key, errs); v != nil {
		present[key] = *v
	}
}

func uFloatPresent(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	if v := uCoerceFloat(raw, key, errs); v != nil {
		present[key] = *v
	}
}

func uEnumPresent(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	if s, oks := raw.(string); oks && ynEnumSet[s] {
		present[key] = s
		return
	}
	e := valErr{Type: "enum", Loc: []string{"body", key}, Msg: "Input should be 'Y' or 'N'", Input: raw}
	e.Ctx = map[string]any{"expected": "'Y' or 'N'"}
	*errs = append(*errs, e)
}

func uDatePresent(body map[string]interface{}, key string, present map[string]interface{}, errs *[]valErr) {
	raw, ok := body[key]
	if !ok {
		return
	}
	if raw == nil {
		present[key] = nil
		return
	}
	if v := uDate(body, key, errs); v != nil {
		present[key] = *v
	}
}

// valueErr는 Pydantic field_validator ValueError(type=value_error, ctx.error={})를 재현한다.
func valueErr(key, msg string, input interface{}) valErr {
	return valErr{Type: "value_error", Loc: []string{"body", key}, Msg: "Value error, " + msg, Input: input, Ctx: map[string]any{"error": map[string]any{}}}
}

func isAllDigitsU(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
