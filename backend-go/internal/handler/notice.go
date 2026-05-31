package handler

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type NoticeHandler struct {
	svc *service.NoticeService
}

func NewNotice(svc *service.NoticeService) *NoticeHandler {
	return &NoticeHandler{svc: svc}
}

// parseBool은 FastAPI(Pydantic v2)의 bool 쿼리 파싱 규칙을 따른다.
func parseBool(v string) (bool, bool) {
	switch strings.ToLower(v) {
	case "true", "1", "yes", "on", "y", "t":
		return true, true
	case "false", "0", "no", "off", "n", "f":
		return false, true
	}
	return false, false
}

// valErr는 FastAPI(Pydantic v2)의 422 detail 항목과 키 순서·구조가 동일하다
// (type, loc, msg, input, [ctx]). gin.H(map)은 json 직렬화 시 키가 알파벳순으로
// 정렬되어 FastAPI 삽입 순서와 어긋나므로, 바이트 동등을 위해 순서 고정 struct를 쓴다.
// ctx는 범위 위반(ge/le/min_length)에만 존재하므로 omitempty.
type valErr struct {
	Type  string         `json:"type"`
	Loc   []string       `json:"loc"`
	Msg   string         `json:"msg"`
	Input interface{}    `json:"input"`
	Ctx   map[string]any `json:"ctx,omitempty"`
}

// qErr는 query 파라미터 422 detail 항목을 만든다(loc=["query", key]).
func qErr(typ, loc, msg string, input interface{}) valErr {
	return valErr{Type: typ, Loc: []string{"query", loc}, Msg: msg, Input: input}
}

// pathIntErr는 path 정수 파라미터 검증 실패(int_parsing 422)를 응답한다.
// notice/weather/group 핸들러가 공유한다.
func pathIntErr(c *gin.Context, loc, input string) {
	writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
		Type: "int_parsing", Loc: []string{"path", loc}, Msg: msgIntParse, Input: input,
	}}})
}

const (
	msgIntParse  = "Input should be a valid integer, unable to parse string as an integer"
	msgBoolParse = "Input should be a valid boolean, unable to interpret input"
)

// coerceInt는 FastAPI(Pydantic v2)의 정수 쿼리 coercion을 따른다:
// 앞뒤 공백 strip, 정수값 소수 문자열("10.0") 허용, 지수/16진수("1e1","0x10")·
// 비정수 소수("10.5")·inf/nan은 거부한다.
func coerceInt(v string) (int, bool) {
	s := strings.TrimSpace(v)
	if s == "" {
		return 0, false
	}
	if n, err := strconv.Atoi(s); err == nil {
		return n, true
	}
	// 지수(e/E)·16진수(x/X)·hex float(p/P)·inf/nan 표기는 Pydantic이 int로 받지 않는다.
	if strings.ContainsAny(s, "eExXpPnNiI") {
		return 0, false
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil && f == math.Trunc(f) {
		return int(f), true
	}
	return 0, false
}

// parseIntQuery는 정수 쿼리를 파싱하고 ge/le 범위를 검증한다.
// 쿼리 키가 '미존재'면 def, '존재하지만 빈 값/잘못된 값'이면 422를 errs에 append한다
// (FastAPI는 ?key= 빈 값을 int_parsing 422로 거부하므로 c.GetQuery로 존재 여부를 구분).
func parseIntQuery(c *gin.Context, errs *[]valErr, key string, def int, hasMin bool, min int, hasMax bool, max int) int {
	v, exists := c.GetQuery(key)
	if !exists {
		return def
	}
	n, ok := coerceInt(v)
	if !ok {
		*errs = append(*errs, qErr("int_parsing", key, msgIntParse, v))
		return def
	}
	if hasMin && n < min {
		// FastAPI(Pydantic v2)는 범위 위반 시 ctx에 제약값을 포함한다.
		e := qErr("greater_than_equal", key, "Input should be greater than or equal to "+strconv.Itoa(min), v)
		e.Ctx = map[string]any{"ge": min}
		*errs = append(*errs, e)
		return def
	}
	if hasMax && n > max {
		e := qErr("less_than_equal", key, "Input should be less than or equal to "+strconv.Itoa(max), v)
		e.Ctx = map[string]any{"le": max}
		*errs = append(*errs, e)
		return def
	}
	return n
}

// parseBoolQuery는 bool 쿼리를 파싱한다. '미존재'면 def, '존재+빈값/잘못된 값'이면
// bool_parsing 422를 errs에 append(FastAPI ?key= 빈 값 거부와 동등).
func parseBoolQuery(c *gin.Context, errs *[]valErr, key string, def bool) bool {
	v, exists := c.GetQuery(key)
	if !exists {
		return def
	}
	b, ok := parseBool(v)
	if !ok {
		*errs = append(*errs, qErr("bool_parsing", key, msgBoolParse, v))
		return def
	}
	return b
}

// List는 GET /api/v1/notices/ — page(ge=1)/size(ge=1,le=100)/show_only.
func (h *NoticeHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	page := parseIntQuery(c, &errs, "page", 1, true, 1, false, 0)
	size := parseIntQuery(c, &errs, "size", 20, true, 1, true, 100)
	showOnly := parseBoolQuery(c, &errs, "show_only", true)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.ListNotices(page, size, showOnly)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Search는 GET /api/v1/notices/search — keyword(필수,min_length=1)/skip/limit/show_only.
func (h *NoticeHandler) Search(c *gin.Context) {
	errs := make([]valErr, 0)
	keyword, hasKw := c.GetQuery("keyword")
	if !hasKw {
		errs = append(errs, qErr("missing", "keyword", "Field required", nil))
	} else if len(keyword) < 1 {
		e := qErr("string_too_short", "keyword", "String should have at least 1 character", keyword)
		e.Ctx = map[string]any{"min_length": 1}
		errs = append(errs, e)
	}
	skip := parseIntQuery(c, &errs, "skip", 0, true, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 20, true, 1, true, 100)
	showOnly := parseBoolQuery(c, &errs, "show_only", true)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.SearchNotices(keyword, skip, limit, showOnly)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/notices/:id — increment_hit(default true). 없으면 404.
func (h *NoticeHandler) Get(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "notice_id", idStr)
		return
	}
	errs := make([]valErr, 0)
	incrementHit := parseBoolQuery(c, &errs, "increment_hit", true)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.GetNotice(id, incrementHit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "공지사항을 찾을 수 없습니다."})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
