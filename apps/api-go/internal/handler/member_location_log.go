package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type LocationLogHandler struct {
	svc *service.LocationLogService
	cfg *config.Config
	// guard는 위치 정보 인가(본인/같은 그룹 멤버/소유자) 진입점이다. nil이면 모든 요청이 500(fail-closed).
	guard *LocationGuard
}

func NewLocationLog(svc *service.LocationLogService, cfg *config.Config) *LocationLogHandler {
	return &LocationLogHandler{svc: svc, cfg: cfg}
}

// SetGuard는 위치 인가 가드를 주입한다.
func (h *LocationLogHandler) SetGuard(g *LocationGuard) { h.guard = g }

// MemberLogs는 GET /api/v1/logs/member-location-logs/:mt_idx — {"result":"Y","data":[...]}.
// start_date/end_date(optional, 빈문자열=미적용), limit(100)/offset(0). 에러는 500 {"detail":str(e)}.
func (h *LocationLogHandler) MemberLogs(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	errs := make([]valErr, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	offset := parseIntQuery(c, &errs, "offset", 0, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.MemberLogs(id, c.Query("start_date"), c.Query("end_date"), limit, offset)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.LocationLogListResult{Result: "Y", Data: res})
}

// DailyLogs는 GET /api/v1/logs/member-location-logs/:mt_idx/daily — raw 배열. date 필수.
func (h *LocationLogHandler) DailyLogs(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	errs := make([]valErr, 0)
	date, hasDate := c.GetQuery("date")
	if !hasDate {
		errs = append(errs, qErr("missing", "date", "Field required", nil))
	}
	limit := parseIntQuery(c, &errs, "limit", 1000, false, 0, false, 0)
	offset := parseIntQuery(c, &errs, "offset", 0, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.DailyLogs(id, date, limit, offset)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// parseFloatQueryDef는 float 쿼리를 파싱하고 값을 반환한다. 미존재면 def, 파싱 실패면 422.
func parseFloatQueryDef(c *gin.Context, errs *[]valErr, key string, def float64) float64 {
	v, exists := c.GetQuery(key)
	if !exists {
		return def
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		*errs = append(*errs, qErr("float_parsing", key,
			"Input should be a valid number, unable to parse string as a number", v))
		return def
	}
	return f
}

// DailySummary는 GET /api/v1/logs/member-location-logs/:mt_idx/daily-summary.
// start_date/end_date 필수, max_accuracy(50.0)/min_speed(0.0). {"result":"Y","data":[...],"total_days":N}.
func (h *LocationLogHandler) DailySummary(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	errs := make([]valErr, 0)
	start, hasStart := c.GetQuery("start_date")
	if !hasStart {
		errs = append(errs, qErr("missing", "start_date", "Field required", nil))
	}
	end, hasEnd := c.GetQuery("end_date")
	if !hasEnd {
		errs = append(errs, qErr("missing", "end_date", "Field required", nil))
	}
	maxAcc := parseFloatQueryDef(c, &errs, "max_accuracy", 50.0)
	minSpeed := parseFloatQueryDef(c, &errs, "min_speed", 0.0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.DailySummary(id, start, end, maxAcc, minSpeed)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.LocationDailySummaryResult{Result: "Y", Data: res, TotalDays: len(res)})
}

// MemberActivity는 GET /api/v1/logs/member-activity — group_id(필수)·date(필수).
// 날짜 형식 오류→400, 멤버 0명→{"member_activities":[],"date":...}, 그 외→5키.
func (h *LocationLogHandler) MemberActivity(c *gin.Context) {
	errs := make([]valErr, 0)
	groupID := 0
	if v, ok := c.GetQuery("group_id"); !ok {
		errs = append(errs, qErr("missing", "group_id", "Field required", nil))
	} else if n, valid := coerceInt(v); !valid {
		errs = append(errs, qErr("int_parsing", "group_id", msgIntParse, v))
	} else {
		groupID = n
	}
	date, hasDate := c.GetQuery("date")
	if !hasDate {
		errs = append(errs, qErr("missing", "date", "Field required", nil))
	}
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.guard.ViewGroup(c, groupID) {
		return
	}

	items, badDate, err := h.svc.MemberActivity(groupID, date)
	if badDate {
		writeJSON(c, http.StatusBadRequest,
			gin.H{"detail": "잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용해주세요."})
		return
	}
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "멤버 활동 조회 중 오류가 발생했습니다: " + err.Error()})
		return
	}
	if len(items) == 0 {
		writeJSON(c, http.StatusOK, dto.MemberActivityEmpty{MemberActivities: items, Date: date})
		return
	}
	active := 0
	for i := range items {
		if items[i].IsActive {
			active++
		}
	}
	writeJSON(c, http.StatusOK, dto.MemberActivityResult{
		MemberActivities: items, Date: date, GroupID: groupID,
		TotalMembers: len(items), ActiveMembers: active,
	})
}

// DailyCounts는 GET /api/v1/logs/daily-counts — group_id(필수)·days(14). 멤버 0명→2키, 있으면 7키.
func (h *LocationLogHandler) DailyCounts(c *gin.Context) {
	errs := make([]valErr, 0)
	groupID := 0
	if v, ok := c.GetQuery("group_id"); !ok {
		errs = append(errs, qErr("missing", "group_id", "Field required", nil))
	} else if n, valid := coerceInt(v); !valid {
		errs = append(errs, qErr("int_parsing", "group_id", msgIntParse, v))
	} else {
		groupID = n
	}
	days := parseIntQuery(c, &errs, "days", 14, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.guard.ViewGroup(c, groupID) {
		return
	}
	res, empty, err := h.svc.DailyCounts(groupID, days)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "일별 위치 기록 카운트 조회 중 오류가 발생했습니다: " + err.Error()})
		return
	}
	if empty != nil {
		writeJSON(c, http.StatusOK, empty)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// DailyCountsSimple는 GET /api/v1/logs/daily-counts-simple — 멤버 0명→{"message":...}, 있으면 4키.
func (h *LocationLogHandler) DailyCountsSimple(c *gin.Context) {
	errs := make([]valErr, 0)
	groupID := 0
	if v, ok := c.GetQuery("group_id"); !ok {
		errs = append(errs, qErr("missing", "group_id", "Field required", nil))
	} else if n, valid := coerceInt(v); !valid {
		errs = append(errs, qErr("int_parsing", "group_id", msgIntParse, v))
	} else {
		groupID = n
	}
	days := parseIntQuery(c, &errs, "days", 14, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.guard.ViewGroup(c, groupID) {
		return
	}
	res, empty, err := h.svc.DailyCountsSimple(groupID, days)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "간단 일별 카운트 조회 중 오류가 발생했습니다: " + err.Error()})
		return
	}
	if empty != nil {
		writeJSON(c, http.StatusOK, empty)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Summary는 GET /api/v1/logs/member-location-logs/:mt_idx/summary. date 있으면 PHP 로직(문자열 포맷
// 요약 + message), 없으면 기간 ORM 요약(message 없음). date 분기는 항상 200(헬퍼 예외 0 흡수),
// 기간 분기는 잘못된 날짜→500.
func (h *LocationLogHandler) Summary(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	if date := c.Query("date"); date != "" {
		data := h.svc.SummaryByDate(id, date)
		writeJSON(c, http.StatusOK, dto.LocationLogSummaryResult{
			Result: "Y", Data: data, Message: "위치 로그 요약 조회 성공",
		})
		return
	}
	data, err := h.svc.SummaryByRange(id, c.Query("start_date"), c.Query("end_date"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.LocationSummaryResult{Result: "Y", Data: data})
}

// Path는 GET /api/v1/logs/member-location-logs/:mt_idx/path. start_date/end_date(optional).
// {"result":"Y","data":{points,summary}}. 잘못된 날짜→500.
func (h *LocationLogHandler) Path(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	data, err := h.svc.Path(id, c.Query("start_date"), c.Query("end_date"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.LocationPathResult{Result: "Y", Data: data})
}

// StayTimes는 GET /api/v1/logs/member-location-logs/:mt_idx/stay-times. date 필수(→422),
// min_speed(1.0)/max_accuracy(50.0)/min_duration(5). {"result":"Y","data":[...],"total_stays":N}.
func (h *LocationLogHandler) StayTimes(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	errs := make([]valErr, 0)
	date, hasDate := c.GetQuery("date")
	if !hasDate {
		errs = append(errs, qErr("missing", "date", "Field required", nil))
	}
	minSpeed := parseFloatQueryDef(c, &errs, "min_speed", 1.0)
	maxAcc := parseFloatQueryDef(c, &errs, "max_accuracy", 50.0)
	minDuration := parseIntQuery(c, &errs, "min_duration", 5, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.StayTimes(id, date, minSpeed, maxAcc, minDuration)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.StayTimesResult{Result: "Y", Data: res, TotalStays: len(res)})
}

// MapMarkers는 GET /api/v1/logs/member-location-logs/:mt_idx/map-markers. date 필수(→422),
// min_speed(1.0)/max_accuracy(50.0). {"result":"Y","data":[...],"total_markers":N}(200건 초과 샘플링).
func (h *LocationLogHandler) MapMarkers(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	errs := make([]valErr, 0)
	date, hasDate := c.GetQuery("date")
	if !hasDate {
		errs = append(errs, qErr("missing", "date", "Field required", nil))
	}
	minSpeed := parseFloatQueryDef(c, &errs, "min_speed", 1.0)
	maxAcc := parseFloatQueryDef(c, &errs, "max_accuracy", 50.0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.MapMarkers(id, date, minSpeed, maxAcc)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.MapMarkersResult{Result: "Y", Data: res, TotalMarkers: len(res)})
}

// MembersWithLogs는 GET /api/v1/logs/members-with-logs — [int]. group_id(필수,미사용)·date(필수).
func (h *LocationLogHandler) MembersWithLogs(c *gin.Context) {
	errs := make([]valErr, 0)
	groupID := 0
	if gid, ok := c.GetQuery("group_id"); !ok {
		errs = append(errs, qErr("missing", "group_id", "Field required", nil))
	} else if n, valid := coerceInt(gid); !valid {
		errs = append(errs, qErr("int_parsing", "group_id", msgIntParse, gid))
	} else {
		groupID = n
	}
	date, hasDate := c.GetQuery("date")
	if !hasDate {
		errs = append(errs, qErr("missing", "date", "Field required", nil))
	}
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !h.guard.ViewGroup(c, groupID) {
		return
	}
	res, err := h.svc.MembersWithLogs(date)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	// 전 회원 번호가 아니라 그 그룹 멤버의 번호만 내보낸다(토큰이 있을 때).
	res, ok := h.guard.FilterGroupMembers(c, groupID, res)
	if !ok {
		return
	}
	writeJSON(c, http.StatusOK, res)
}
