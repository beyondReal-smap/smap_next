package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// Create는 POST /locations/ (무인증, dict body). 필수 slt_title/slt_add(400), 기본값(mt_idx=282·좌표 37.5665/126.978),
// 절단(slt_title[:100]/slt_add[:200]), 커스텀 응답. DB오류 시 500 "Location creation failed: ...".
func (h *LocationHandler) Create(c *gin.Context) {
	body := bindBodyMap(c)
	title, ok := locReqStr(body, "slt_title")
	if !ok {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Missing or empty required field: slt_title"})
		return
	}
	add, ok := locReqStr(body, "slt_add")
	if !ok {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Missing or empty required field: slt_add"})
		return
	}
	lat, long := locCoords(body)
	mtIdx := locIntDefault(body, "mt_idx", 282)
	if viewer := h.guard.Viewer(c); viewer.Authenticated {
		// 토큰이 있으면 본인 명의가 기본이고, 다른 회원 명의는 같은 그룹 방장/리더 권한이 있을 때만(LOCATION_PLACE_LEADER_MANAGE).
		mtIdx = viewer.MtIdx
		if raw, has := body["mt_idx"]; has {
			n, ok := mllAnyInt(raw)
			if !ok {
				writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Invalid field: mt_idx"})
				return
			}
			mtIdx = n
		}
	}
	if !h.guard.ManagePlace(c, mtIdx) {
		return
	}
	in := service.LocationCreateInput{
		MtIdx:    mtIdx,
		SltTitle: truncRunes(toStr(title), 100),
		SltAdd:   truncRunes(toStr(add), 200),
		SltLat:   lat, SltLong: long,
		SltShow:       locStrDefault(body, "slt_show", "Y"),
		SltEnterAlarm: locStrDefault(body, "slt_enter_alarm", "Y"),
		SltEnterChk:   locStrDefault(body, "slt_enter_chk", "N"),
	}
	resp, sok := h.svc.CreateLocation(in)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Location creation failed: db error"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Notification은 PUT /locations/:location_id/notification. slt_enter_alarm 필수(400)·Y/N(400). 없는 장소 → 404.
func (h *LocationHandler) Notification(c *gin.Context) {
	id, ok := locationPathID(c)
	if !ok {
		return
	}
	if !h.manageExisting(c, id) {
		return
	}
	body := bindBodyMap(c)
	raw, has := body["slt_enter_alarm"]
	if !has {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "slt_enter_alarm field is required"})
		return
	}
	alarm, _ := raw.(string)
	if alarm != "Y" && alarm != "N" {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "slt_enter_alarm must be 'Y' or 'N'"})
		return
	}
	resp, found, sok := h.svc.UpdateNotification(id, alarm)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Update failed: db error"})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Location not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Update는 PUT /locations/:location_id (dict body). 인식 필드만 UPDATE(절단 slt_title[:50]/slt_add[:100]),
// updated_fields=body 키 순서. 없는 장소는 404(Python은 500으로 감쌌지만, 앱이 서버 오류로 오인하지 않게 바로잡음).
func (h *LocationHandler) Update(c *gin.Context) {
	id, ok := locationPathID(c)
	if !ok {
		return
	}
	if !h.manageExisting(c, id) {
		return
	}
	raw := bindBodyRaw(c)
	var body map[string]interface{}
	if json.Unmarshal(raw, &body) != nil {
		body = map[string]interface{}{}
	}
	keys := jsonKeyOrder(raw)
	fields := map[string]interface{}{}
	if v, has := body["slt_title"]; has {
		fields["slt_title"] = truncRunes(strTrimSpace(toStr(v)), 50)
	}
	if v, has := body["slt_add"]; has {
		fields["slt_add"] = truncRunes(strTrimSpace(toStr(v)), 100)
	}
	if v, has := body["slt_lat"]; has {
		f, ferr := anyToFloat(v)
		if ferr != nil {
			writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Update failed: invalid slt_lat"})
			return
		}
		fields["slt_lat"] = f
	}
	if v, has := body["slt_long"]; has {
		f, ferr := anyToFloat(v)
		if ferr != nil {
			writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Update failed: invalid slt_long"})
			return
		}
		fields["slt_long"] = f
	}
	if v, has := body["slt_enter_alarm"]; has {
		fields["slt_enter_alarm"] = v
	}
	if v, has := body["slt_show"]; has {
		fields["slt_show"] = v
	}
	resp, found, sok := h.svc.UpdateLocation(id, fields, keys)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Update failed: db error"})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Location not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete는 DELETE /locations/:location_id (response_model=LocationResponse, 삭제된 모델 반환). 404 "Location not found".
func (h *LocationHandler) Delete(c *gin.Context) {
	id, ok := locationPathID(c)
	if !ok {
		return
	}
	if !h.manageExisting(c, id) {
		return
	}
	resp, found, sok := h.svc.DeleteLocation(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Location not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// MemberCreate는 POST /locations/members/:member_id/locations. member존재(404)·필수(400)·그룹조회·INSERT.
func (h *LocationHandler) MemberCreate(c *gin.Context) {
	mid, ok := memberLocPathID(c)
	if !ok {
		return
	}
	if !h.guard.ManagePlace(c, mid) {
		return
	}
	body := bindBodyMap(c)
	if !locStrTruthy(body, "slt_title") {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Location title (slt_title) is required"})
		return
	}
	if !locStrTruthy(body, "slt_add") {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "Location address (slt_add) is required"})
		return
	}
	lat, long := locCoords(body)
	in := service.MemberLocationInput{
		MemberID: mid,
		SltTitle: truncRunes(strTrimSpace(toStr(body["slt_title"])), 50),
		SltAdd:   truncRunes(strTrimSpace(toStr(body["slt_add"])), 100),
		SltLat:   lat, SltLong: long,
		SltShow:       locStrDefault(body, "slt_show", "Y"),
		SltEnterAlarm: locStrDefault(body, "slt_enter_alarm", "Y"),
		SltEnterChk:   locStrDefault(body, "slt_enter_chk", "N"),
		SgdtIdxBody:   locIntDefault(body, "sgdt_idx", 641),
		SgtIdxBody:    locIntDefault(body, "sgt_idx", 641),
	}
	resp, memberFound, sok := h.svc.MemberCreateLocation(in)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Location creation failed for member " + strconv.Itoa(mid) + ": db error"})
		return
	}
	if !memberFound {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member " + strconv.Itoa(mid) + " not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// --- 파서/헬퍼 ---

func locationPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("location_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "location_id", idStr)
		return 0, false
	}
	return id, true
}

func memberLocPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return 0, false
	}
	return id, true
}

func bindBodyMap(c *gin.Context) map[string]interface{} {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil || body == nil {
		body = map[string]interface{}{}
	}
	return body
}

func bindBodyRaw(c *gin.Context) []byte {
	b, err := c.GetRawData()
	if err != nil {
		return []byte("{}")
	}
	return b
}

// jsonKeyOrder는 최상위 JSON 객체의 키를 등장 순서대로 반환한다(Python list(dict.keys()) 재현).
func jsonKeyOrder(raw []byte) []string {
	dec := json.NewDecoder(bytes.NewReader(raw))
	t, err := dec.Token()
	if err != nil {
		return nil
	}
	if d, ok := t.(json.Delim); !ok || d != '{' {
		return nil
	}
	var keys []string
	depth := 0
	for dec.More() {
		kt, err := dec.Token()
		if err != nil {
			break
		}
		if depth == 0 {
			if k, ok := kt.(string); ok {
				keys = append(keys, k)
			}
		}
		// 값 스킵(중첩 구조 포함).
		vt, err := dec.Token()
		if err != nil {
			break
		}
		if d, ok := vt.(json.Delim); ok && (d == '{' || d == '[') {
			depth++
			for depth > 0 {
				dt, err := dec.Token()
				if err != nil {
					return keys
				}
				if dd, ok := dt.(json.Delim); ok {
					if dd == '{' || dd == '[' {
						depth++
					} else {
						depth--
					}
				}
			}
		}
	}
	return keys
}

// locReqStr는 Python `if field not in data or not data[field]`(존재+truthy) 검증. ok=false면 400.
func locReqStr(body map[string]interface{}, key string) (interface{}, bool) {
	v, has := body[key]
	if !has || isFalsy(v) {
		return nil, false
	}
	return v, true
}

// locStrTruthy는 member-create의 `not data.get('slt_title') or not .strip()` 검증(존재+strip 후 비어있지 않음).
func locStrTruthy(body map[string]interface{}, key string) bool {
	v, has := body[key]
	if !has || isFalsy(v) {
		return false
	}
	if s, ok := v.(string); ok {
		return strTrimSpace(s) != ""
	}
	return true
}

func isFalsy(v interface{}) bool {
	switch t := v.(type) {
	case nil:
		return true
	case string:
		return t == ""
	case bool:
		return !t
	case float64:
		return t == 0
	}
	return false
}

func locStrDefault(body map[string]interface{}, key, def string) string {
	if v, ok := body[key].(string); ok {
		return v
	}
	return def
}

func locIntDefault(body map[string]interface{}, key string, def int) int {
	if v, ok := body[key].(float64); ok {
		return int(v)
	}
	return def
}

// locCoords는 slt_lat/slt_long을 파싱한다(기본 37.5665/126.978). 둘 중 하나라도 float 변환 실패면 둘 다 기본값(Python except).
func locCoords(body map[string]interface{}) (float64, float64) {
	lat, latOK := coordVal(body, "slt_lat")
	long, longOK := coordVal(body, "slt_long")
	if latOK && longOK {
		return lat, long
	}
	return 37.5665, 126.9780
}

// coordVal은 키가 없으면 (기본 미적용, true)로 처리하지 않고, 존재 시에만 변환을 시도한다.
// 미존재→get(default) 후 float(default)=성공이므로 (default, true). 존재→변환 성공/실패.
func coordVal(body map[string]interface{}, key string) (float64, bool) {
	v, has := body[key]
	if !has {
		if key == "slt_lat" {
			return 37.5665, true
		}
		return 126.9780, true
	}
	return anyToFloatOK(v)
}

func anyToFloatOK(v interface{}) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case string:
		f, err := strconv.ParseFloat(t, 64)
		return f, err == nil
	}
	return 0, false
}

func anyToFloat(v interface{}) (float64, error) {
	f, ok := anyToFloatOK(v)
	if !ok {
		return 0, strconv.ErrSyntax
	}
	return f, nil
}

func toStr(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		if t {
			return "True"
		}
		return "False"
	}
	return ""
}

func truncRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func strTrimSpace(s string) string {
	// Python str.strip(): 앞뒤 공백 제거.
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
