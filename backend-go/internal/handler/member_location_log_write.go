package handler

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// --- 순서 고정 응답 struct(기존 dto에 없는 act 전용) ---

type mllMembersWithLogsResult struct {
	Result string             `json:"result"`
	Data   mllMemberIDsWrap   `json:"data"`
}
type mllMemberIDsWrap struct {
	MemberIDs []int `json:"member_ids"`
}
type mllDailyPathResult struct {
	Result string             `json:"result"`
	Data   dto.DailyPathData  `json:"data"`
}
type mllSingleLogResult struct {
	Result string             `json:"result"`
	Data   dto.LocationLogDict `json:"data"`
}
type mllDeleteResult struct {
	Result string         `json:"result"`
	Data   mllDeletedWrap `json:"data"`
}
type mllDeletedWrap struct {
	DeletedID int `json:"deleted_id"`
}
type mllBatchResult struct {
	Result       string                `json:"result"`
	CreatedCount int                   `json:"created_count"`
	Errors       []mllBatchErr         `json:"errors"`
	Data         []dto.LocationLogDict `json:"data"`
}
type mllBatchErr struct {
	Index int    `json:"index"`
	Error string `json:"error"`
}

// MemberLocationLogsPost는 POST /logs/member-location-logs — body.act 기반 14종 RPC 디스패처.
func (h *LocationLogHandler) MemberLocationLogsPost(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil || body == nil {
		body = map[string]interface{}{}
	}
	act, _ := body["act"].(string)
	if act == "" {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "'act' parameter is required"})
		return
	}

	switch act {
	case "get_location_logs":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		logs, err := h.svc.MemberLogs(mt, mllStr(body, "start_date"), mllStr(body, "end_date"), mllIntDef(body, "limit", 100), mllIntDef(body, "offset", 0))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationLogListResult{Result: "Y", Data: logs})

	case "get_location_summary":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		sum, err := h.svc.SummaryByRange(mt, mllStr(body, "start_date"), mllStr(body, "end_date"))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationSummaryResult{Result: "Y", Data: sum})

	case "get_location_path":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		p, err := h.svc.Path(mt, mllStr(body, "start_date"), mllStr(body, "end_date"))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationPathResult{Result: "Y", Data: p})

	case "create_location_log":
		h.actCreateLog(c, body)

	case "update_location_log":
		h.actUpdateLog(c, body)

	case "delete_location_log":
		mt, ok := mllReqIntKey(c, body, "mlt_idx")
		if !ok {
			return
		}
		found, sok := h.svc.DeleteLog(mt)
		if !sok || !found {
			// Python: 404 raise가 act except에 흡수돼 500-wrap. str(e)="404: Location log not found".
			writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "404: Location log not found"})
			return
		}
		writeJSON(c, http.StatusOK, mllDeleteResult{Result: "Y", Data: mllDeletedWrap{DeletedID: mt}})

	case "get_members_with_logs":
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		ids, err := h.svc.MembersWithLogs(date)
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, mllMembersWithLogsResult{Result: "Y", Data: mllMemberIDsWrap{MemberIDs: ids}})

	case "get_daily_location_logs":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		logs, err := h.svc.DailyLogs(mt, date, mllIntDef(body, "limit", 1000), mllIntDef(body, "offset", 0))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationLogListResult{Result: "Y", Data: logs})

	case "get_daily_location_summary":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		sum, err := h.svc.DailySummaryByDate(mt, date)
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationSummaryResult{Result: "Y", Data: sum})

	case "get_daily_location_path":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		p, err := h.svc.DailyPathByDate(mt, date)
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, mllDailyPathResult{Result: "Y", Data: p})

	case "get_daily_summary_by_range", "get_daily_summary":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		start, ok := mllReqStr(c, body, "start_date", "start_date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		end, ok := mllReqStr(c, body, "end_date", "end_date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		data, err := h.svc.DailySummary(mt, start, end, mllFloatDef(body, "max_accuracy", 50.0), mllFloatDef(body, "min_speed", 0.0))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.LocationDailySummaryResult{Result: "Y", Data: data, TotalDays: len(data)})

	case "get_stay_times":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		data, err := h.svc.StayTimes(mt, date, mllFloatDef(body, "min_speed", 1.0), mllFloatDef(body, "max_accuracy", 50.0), mllIntDef(body, "min_duration", 5))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.StayTimesResult{Result: "Y", Data: data, TotalStays: len(data)})

	case "get_map_markers":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		data, err := h.svc.MapMarkers(mt, date, mllFloatDef(body, "min_speed", 1.0), mllFloatDef(body, "max_accuracy", 50.0))
		if err != nil {
			mll500(c, err)
			return
		}
		writeJSON(c, http.StatusOK, dto.MapMarkersResult{Result: "Y", Data: data, TotalMarkers: len(data)})

	case "get_location_log_summary":
		mt, ok := mllReqInt(c, body, "mt_idx")
		if !ok {
			return
		}
		date, ok := mllReqStr(c, body, "date", "date is required (YYYY-MM-DD format)")
		if !ok {
			return
		}
		sum := h.svc.SummaryByDate(mt, date)
		writeJSON(c, http.StatusOK, dto.LocationLogSummaryResult{Result: "Y", Data: sum, Message: "위치 로그 요약 정보 조회 성공"})

	default:
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Invalid act value: " + act})
	}
}

// actCreateLog는 create_location_log act(토큰/body mt_idx, 동의, 배치/단건).
func (h *LocationLogHandler) actCreateLog(c *gin.Context, body map[string]interface{}) {
	tokenMt, tokOK := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	bodyMt, bodyHas := mllAnyInt(body["mt_idx"])
	if !tokOK && !bodyHas {
		// 토큰 에러 + body mt_idx 없음 → 401. (no-header 메시지로 대표 — 토큰 검증 실패 상세는 엣지)
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "Authorization 헤더가 필요합니다 (Bearer 토큰)."})
		return
	}
	finalMt := bodyMt
	if tokOK {
		finalMt = tokenMt
	}
	if finalMt == 0 {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "mt_idx가 필요합니다 (토큰 또는 body)"})
		return
	}
	// 동의: location_consent가 'N'(대문자)이면 차단.
	if cs, ok := body["location_consent"]; ok {
		if mllUpper(cs) == "N" {
			writeJSON(c, http.StatusForbidden, gin.H{"detail": "위치 정보 수집 동의가 필요합니다."})
			return
		}
	}
	// 배치: mlt_gps_data 배열
	if arr, ok := body["mlt_gps_data"].([]interface{}); ok && len(arr) > 0 {
		created := make([]dto.LocationLogDict, 0)
		errs := make([]mllBatchErr, 0)
		for idx, it := range arr {
			item, _ := it.(map[string]interface{})
			in, perr := mllItemToInput(finalMt, item)
			if perr != "" {
				errs = append(errs, mllBatchErr{Index: idx, Error: perr})
				continue
			}
			d, sok := h.svc.CreateLog(in)
			if !sok {
				errs = append(errs, mllBatchErr{Index: idx, Error: "create failed"})
				continue
			}
			created = append(created, d)
		}
		res := "Y"
		if len(created) == 0 {
			res = "N"
		}
		data := created
		if len(data) > 10 {
			data = data[:10]
		}
		writeJSON(c, http.StatusOK, mllBatchResult{Result: res, CreatedCount: len(created), Errors: errs, Data: data})
		return
	}
	// 단건
	in, perr := mllBodyToInput(finalMt, body)
	if perr != "" {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Error creating location log: " + perr})
		return
	}
	d, sok := h.svc.CreateLog(in)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Error creating location log: db error"})
		return
	}
	writeJSON(c, http.StatusOK, mllSingleLogResult{Result: "Y", Data: d})
}

func (h *LocationLogHandler) actUpdateLog(c *gin.Context, body map[string]interface{}) {
	mt, ok := mllAnyInt(body["mlt_idx"])
	if !ok || mt == 0 {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "400: mlt_idx is required"})
		return
	}
	present := map[string]interface{}{}
	for k, v := range body {
		if k == "act" || k == "mlt_idx" {
			continue
		}
		present[k] = v // MemberLocationLogUpdate 매핑은 단순 setattr — 검증 최소(컬럼 키만 사용됨)
	}
	resp, found, sok := h.svc.UpdateLog(mt, mllFilterLogCols(present))
	if !sok || !found {
		// update act는 except HTTPException 없이 except Exception만 → 404 raise가 500 "404: ..."로 wrap.
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "404: Location log not found"})
		return
	}
	writeJSON(c, http.StatusOK, mllSingleLogResult{Result: "Y", Data: *resp})
}

// --- 헬퍼 ---

func mll500(c *gin.Context, err error) {
	writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
}

// mllReqInt는 body의 mt_idx(truthy int) 검증. 없으면 act 내부 raise(400)가 except에 흡수돼 500 "400: ...".
func mllReqInt(c *gin.Context, body map[string]interface{}, key string) (int, bool) {
	return mllReqIntKey(c, body, key)
}
func mllReqIntKey(c *gin.Context, body map[string]interface{}, key string) (int, bool) {
	v, ok := mllAnyInt(body[key])
	if !ok || v == 0 {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "400: " + key + " is required"})
		return 0, false
	}
	return v, true
}
func mllReqStr(c *gin.Context, body map[string]interface{}, key, msg string) (string, bool) {
	s := mllStr(body, key)
	if s == "" {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "400: " + msg})
		return "", false
	}
	return s, true
}
func mllStr(body map[string]interface{}, key string) string {
	if s, ok := body[key].(string); ok {
		return s
	}
	return ""
}
func mllAnyInt(v interface{}) (int, bool) {
	switch t := v.(type) {
	case float64:
		return int(t), true
	case string:
		if n, e := strconv.Atoi(t); e == nil {
			return n, true
		}
	}
	return 0, false
}
func mllIntDef(body map[string]interface{}, key string, def int) int {
	if v, ok := mllAnyInt(body[key]); ok {
		return v
	}
	return def
}
func mllFloatDef(body map[string]interface{}, key string, def float64) float64 {
	switch t := body[key].(type) {
	case float64:
		return t
	case string:
		if f, e := strconv.ParseFloat(t, 64); e == nil {
			return f
		}
	}
	return def
}
func mllUpper(v interface{}) string {
	s, _ := v.(string)
	out := []rune(s)
	for i, r := range out {
		if r >= 'a' && r <= 'z' {
			out[i] = r - 32
		}
	}
	return string(out)
}

// mllItemToInput은 배치 항목을 LocationLogCreateInput으로 변환(필드명 매핑). mlt_gps_time 없으면 에러.
func mllItemToInput(mtIdx int, item map[string]interface{}) (service.LocationLogCreateInput, string) {
	if item == nil {
		return service.LocationLogCreateInput{}, "invalid item"
	}
	in := service.LocationLogCreateInput{MtIdx: mtIdx}
	in.MltLat = mllFloatPtr(item["mlt_lat"])
	in.MltLong = mllFloatPtr(item["mlt_long"])
	in.MltAccuacy = mllFloatPtr(mllFirst(item["mlt_accuracy"], item["mlt_accuacy"]))
	in.MltSpeed = mllFloatPtr(item["mlt_speed"])
	in.MltBattery = mllIntPtr(item["mlt_battery"])
	in.MtHealthWork = mllIntPtr(item["mt_health_work"])
	in.MltFineLocation = mllEnumDefaultPtr(item["mlt_fine_location"], "Y")
	in.MltLocationChk = mllEnumDefaultPtr(item["mlt_location_chk"], "Y")
	gt, ok := mllParseDT(mllFirst(item["mlt_timestamp"], item["mlt_gps_time"]))
	if !ok {
		return service.LocationLogCreateInput{}, "mlt_gps_time is required"
	}
	in.MltGpsTime = gt
	return in, ""
}

// mllBodyToInput은 단건 body를 LocationLogCreateInput으로 변환(필드명 매핑 포함).
func mllBodyToInput(mtIdx int, body map[string]interface{}) (service.LocationLogCreateInput, string) {
	in := service.LocationLogCreateInput{MtIdx: mtIdx}
	in.MltLat = mllFloatPtr(body["mlt_lat"])
	in.MltLong = mllFloatPtr(body["mlt_long"])
	in.MltAccuacy = mllFloatPtr(mllFirst(body["mlt_accuracy"], body["mlt_accuacy"]))
	in.MltSpeed = mllFloatPtr(body["mlt_speed"])
	in.MltBattery = mllIntPtr(body["mlt_battery"])
	in.MtHealthWork = mllIntPtr(body["mt_health_work"])
	in.MltFineLocation = mllEnumDefaultPtr(body["mlt_fine_location"], "Y")
	in.MltLocationChk = mllEnumDefaultPtr(body["mlt_location_chk"], "Y")
	in.StayLat = mllFloatPtr(body["stay_lat"])
	in.StayLong = mllFloatPtr(body["stay_long"])
	gt, ok := mllParseDT(mllFirst(body["mlt_timestamp"], body["mlt_gps_time"]))
	if !ok {
		return service.LocationLogCreateInput{}, "mlt_gps_time is required"
	}
	in.MltGpsTime = gt
	return in, ""
}

func mllFirst(a, b interface{}) interface{} {
	if a != nil {
		return a
	}
	return b
}
func mllFloatPtr(v interface{}) *float64 {
	switch t := v.(type) {
	case float64:
		return &t
	case string:
		if f, e := strconv.ParseFloat(t, 64); e == nil {
			return &f
		}
	}
	return nil
}
func mllIntPtr(v interface{}) *int {
	switch t := v.(type) {
	case float64:
		if t == math.Trunc(t) {
			n := int(t)
			return &n
		}
	case string:
		if n, e := strconv.Atoi(t); e == nil {
			return &n
		}
	}
	return nil
}
func mllEnumDefaultPtr(v interface{}, def string) *string {
	if s, ok := v.(string); ok && s != "" {
		return &s
	}
	d := def
	return &d
}
func mllParseDT(v interface{}) (time.Time, bool) {
	s, ok := v.(string)
	if !ok || s == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{"2006-01-02T15:04:05.999999", "2006-01-02T15:04:05", time.RFC3339, "2006-01-02 15:04:05"} {
		if t, e := time.ParseInLocation(layout, s, time.Local); e == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// mllFilterLogCols는 update의 present에서 member_location_log 컬럼만 남긴다(setattr 대상).
func mllFilterLogCols(present map[string]interface{}) map[string]interface{} {
	allow := map[string]bool{
		"mlt_lat": true, "mlt_long": true, "mlt_accuacy": true, "mlt_speed": true,
		"mlt_battery": true, "mlt_fine_location": true, "mlt_location_chk": true,
		"mt_health_work": true, "mlt_gps_time": true, "stay_lat": true, "stay_long": true, "mt_idx": true,
	}
	out := map[string]interface{}{}
	for k, v := range present {
		if !allow[k] {
			continue
		}
		if k == "mlt_gps_time" {
			if t, ok := mllParseDT(v); ok {
				out[k] = t
			}
			continue
		}
		out[k] = v
	}
	return out
}

var _ = json.Marshal
