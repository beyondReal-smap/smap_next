package dto

import (
	"math"
	"strconv"
	"strings"
)

// PyFloat은 Python의 float JSON 직렬화(repr)와 동일하게 직렬화한다.
// Python json/repr 규칙: 1e-4 ≤ |x| < 1e16(및 0)는 위치표기(positional), 그 밖은 지수표기(scientific).
// Go의 'g'는 ~1e6부터 지수표기로 전환돼 큰 거리값 등에서 Python(예: "4152770.96")과 어긋났다 →
// 범위 판정 후 'f'(위치)/'e'(지수)를 선택하고, 위치표기에 소수점이 없으면 ".0"을 붙인다.
type PyFloat float64

func (f PyFloat) MarshalJSON() ([]byte, error) {
	x := float64(f)
	abs := math.Abs(x)
	var s string
	if x == 0 || (abs >= 1e-4 && abs < 1e16) {
		s = strconv.FormatFloat(x, 'f', -1, 64)
		if !strings.ContainsAny(s, ".eEnN") {
			s += ".0"
		}
	} else {
		s = strconv.FormatFloat(x, 'e', -1, 64)
	}
	return []byte(s), nil
}

// LocationLogDict는 Python MemberLocationLog.to_dict()와 키/순서·타입이 동일하다.
// mlt_lat/long/stay_lat/stay_long: DECIMAL → float(x) if x else None(0→null, PyFloat).
// mlt_accuacy/speed: FLOAT(32비트) → raw(0→"0.0", nil→null). DSN interpolateParams=true(텍스트
// 프로토콜)로 MySQL 문자열을 파싱하므로 값이 Python과 동일 → PyFloat(최단=repr)로 직렬화.
// mlt_gps_time/wdate: isoformat(T). mlt_fine_location/location_chk: enum "Y"/"N".
type LocationLogDict struct {
	MltIdx          int      `json:"mlt_idx"`
	MtIdx           int      `json:"mt_idx"`
	MltLat          *PyFloat `json:"mlt_lat"`
	MltLong         *PyFloat `json:"mlt_long"`
	MltAccuacy      *PyFloat `json:"mlt_accuacy"`
	MltSpeed        *PyFloat `json:"mlt_speed"`
	MltBattery      *int     `json:"mlt_battery"`
	MltFineLocation *string  `json:"mlt_fine_location"`
	MltLocationChk  *string  `json:"mlt_location_chk"`
	MtHealthWork    *int     `json:"mt_health_work"`
	MltGpsTime      *string  `json:"mlt_gps_time"`
	MltWdate        *string  `json:"mlt_wdate"`
	StayLat         *PyFloat `json:"stay_lat"`
	StayLong        *PyFloat `json:"stay_long"`
}

// LocationLogListResult는 GET /logs/member-location-logs/{mt_idx}의 {"result":"Y","data":[...]} 래퍼.
type LocationLogListResult struct {
	Result string            `json:"result"`
	Data   []LocationLogDict `json:"data"`
}

// LocationDailySummaryItem은 /daily-summary 한 항목(strftime: log_date "YYYY-MM-DD",
// start/end_time "YYYY-MM-DD HH:MM:SS" 초단위).
type LocationDailySummaryItem struct {
	MltIdx    int    `json:"mlt_idx"`
	LogDate   string `json:"log_date"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

// LocationDailySummaryResult는 /daily-summary의 {"result":"Y","data":[...],"total_days":N} 래퍼.
type LocationDailySummaryResult struct {
	Result    string                     `json:"result"`
	Data      []LocationDailySummaryItem `json:"data"`
	TotalDays int                        `json:"total_days"`
}

// MemberActivityItem은 /member-activity 멤버 항목. first/last_log_time=isoformat(T).
type MemberActivityItem struct {
	MemberID     int     `json:"member_id"`
	MemberName   *string `json:"member_name"`
	MtNickname   *string `json:"mt_nickname"`
	MemberPhoto  *string `json:"member_photo"`
	MemberGender *int    `json:"member_gender"`
	LogCount     int     `json:"log_count"`
	FirstLogTime *string `json:"first_log_time"`
	LastLogTime  *string `json:"last_log_time"`
	IsActive     bool    `json:"is_active"`
}

// MemberActivityResult는 멤버 존재 시 5키 응답.
type MemberActivityResult struct {
	MemberActivities []MemberActivityItem `json:"member_activities"`
	Date             string               `json:"date"`
	GroupID          int                  `json:"group_id"`
	TotalMembers     int                  `json:"total_members"`
	ActiveMembers    int                  `json:"active_members"`
}

// MemberActivityEmpty는 그룹 멤버가 없을 때 2키 응답({"member_activities":[],"date":...}).
type MemberActivityEmpty struct {
	MemberActivities []MemberActivityItem `json:"member_activities"`
	Date             string               `json:"date"`
}

// DailyCountEntry는 /daily-counts의 하루 항목. formatted_date=%m.%d, day_of_week=%a(영문).
type DailyCountEntry struct {
	Date          string `json:"date"`
	Count         int    `json:"count"`
	FormattedDate string `json:"formatted_date"`
	DayOfWeek     string `json:"day_of_week"`
	IsToday       bool   `json:"is_today"`
	IsWeekend     bool   `json:"is_weekend"`
}

// MemberDailyCounts는 /daily-counts의 멤버별 항목.
type MemberDailyCounts struct {
	MemberID     int               `json:"member_id"`
	MemberName   *string           `json:"member_name"`
	MtNickname   *string           `json:"mt_nickname"`
	MemberPhoto  *string           `json:"member_photo"`
	MemberGender *int              `json:"member_gender"`
	DailyCounts  []DailyCountEntry `json:"daily_counts"`
}

// DailyCountsResult는 /daily-counts 멤버 존재 시 7키 응답.
type DailyCountsResult struct {
	MemberDailyCounts []MemberDailyCounts `json:"member_daily_counts"`
	TotalDailyCounts  []DailyCountEntry   `json:"total_daily_counts"`
	TotalDays         int                 `json:"total_days"`
	StartDate         string              `json:"start_date"`
	EndDate           string              `json:"end_date"`
	GroupID           int                 `json:"group_id"`
	TotalMembers      int                 `json:"total_members"`
}

// DailyCountsEmpty는 멤버 0명일 때 {"daily_counts":[],"total_days":days}.
type DailyCountsEmpty struct {
	DailyCounts []DailyCountEntry `json:"daily_counts"`
	TotalDays   int               `json:"total_days"`
}

// DailyCountsSimpleResult는 /daily-counts-simple 멤버 존재 시 응답.
type DailyCountsSimpleResult struct {
	SimpleFormat []string `json:"simple_format"`
	TotalRecords int      `json:"total_records"`
	GroupID      int      `json:"group_id"`
	DateRange    string   `json:"date_range"`
}

// DailyCountsSimpleEmpty는 멤버 0명일 때 {"message":...}.
type DailyCountsSimpleEmpty struct {
	Message string `json:"message"`
}

// LocationSummaryData는 LocationSummaryResponse(schemas)와 키/순서·타입 동일.
// total_distance/average_speed: round(x,2) float → PyFloat(정수값 ".0"). /summary[B]·/path 공용.
type LocationSummaryData struct {
	TotalDistance      PyFloat `json:"total_distance"`
	TotalTime          string  `json:"total_time"`
	StepCount          int     `json:"step_count"`
	AverageSpeed       PyFloat `json:"average_speed"`
	BatteryConsumption int     `json:"battery_consumption"`
}

// LocationSummaryResult는 /summary date 없는 분기 {"result":"Y","data":{...}}(message 없음).
type LocationSummaryResult struct {
	Result string              `json:"result"`
	Data   LocationSummaryData `json:"data"`
}

// LocationLogSummaryData는 LocationLogSummary(schemas, PHP 로직)와 키/순서 동일(전부 문자열/정수).
type LocationLogSummaryData struct {
	ScheduleCount string `json:"schedule_count"`
	Distance      string `json:"distance"`
	Duration      string `json:"duration"`
	Steps         int    `json:"steps"`
}

// LocationLogSummaryResult는 /summary date 분기 {"result":"Y","data":{...},"message":...}.
type LocationLogSummaryResult struct {
	Result  string                 `json:"result"`
	Data    LocationLogSummaryData `json:"data"`
	Message string                 `json:"message"`
}

// LocationPathPoint는 /path points의 한 점(crud dict 삽입 순서 고정).
// lat/lng: float(Decimal)이라 항상 존재(좌표 truthy 필터). accuracy/speed: raw float(0→"0.0", nil→null).
// battery/steps: raw int(nil→null). timestamp: isoformat(T).
type LocationPathPoint struct {
	Lat       PyFloat  `json:"lat"`
	Lng       PyFloat  `json:"lng"`
	Timestamp string   `json:"timestamp"`
	Accuracy  *PyFloat `json:"accuracy"`
	Speed     *PyFloat `json:"speed"`
	Battery   *int     `json:"battery"`
	Steps     *int     `json:"steps"`
}

// LocationPathData는 LocationPathResponse.model_dump()(points, summary 순).
type LocationPathData struct {
	Points  []LocationPathPoint `json:"points"`
	Summary LocationSummaryData `json:"summary"`
}

// LocationPathResult는 /path {"result":"Y","data":{points,summary}}.
type LocationPathResult struct {
	Result string           `json:"result"`
	Data   LocationPathData `json:"data"`
}

// DailyPathPoint는 get_member_daily_location_path의 포인트(범위 path와 달리 gps_time HH:MM:SS 포함).
type DailyPathPoint struct {
	Lat       PyFloat  `json:"lat"`
	Lng       PyFloat  `json:"lng"`
	Timestamp string   `json:"timestamp"`
	Accuracy  *PyFloat `json:"accuracy"`
	Speed     *PyFloat `json:"speed"`
	Battery   *int     `json:"battery"`
	Steps     *int     `json:"steps"`
	GpsTime   string   `json:"gps_time"`
}

// DailyPathData는 get_member_daily_location_path 반환(points, summary).
type DailyPathData struct {
	Points  []DailyPathPoint    `json:"points"`
	Summary LocationSummaryData `json:"summary"`
}

// StayTimeItem은 /stay-times의 한 행(crud dict 삽입 순서). start/end_time: strftime 공백.
// duration/distance: float(x) if x else 0.0(항상 number). start_lat/long: float(x) if x else None.
type StayTimeItem struct {
	Label     string   `json:"label"`
	Grp       int64    `json:"grp"`
	StartTime *string  `json:"start_time"`
	EndTime   *string  `json:"end_time"`
	Duration  PyFloat  `json:"duration"`
	Distance  PyFloat  `json:"distance"`
	StartLat  *PyFloat `json:"start_lat"`
	StartLong *PyFloat `json:"start_long"`
}

// StayTimesResult는 /stay-times {"result":"Y","data":[...],"total_stays":N}.
type StayTimesResult struct {
	Result     string         `json:"result"`
	Data       []StayTimeItem `json:"data"`
	TotalStays int            `json:"total_stays"`
}

// MapMarkerItem은 /map-markers의 한 마커(crud dict 14필드 삽입 순서).
// gps_time/wdate: strftime 공백(nil→null). speed: float(x) if x else 0.0(항상 number).
// lat/long/accuacy/stay_*: float(x) if x else None. health_work: int(0 폴백). battery: int(nil→null).
type MapMarkerItem struct {
	MltIdx          int      `json:"mlt_idx"`
	MtIdx           int      `json:"mt_idx"`
	MltGpsTime      *string  `json:"mlt_gps_time"`
	MltSpeed        PyFloat  `json:"mlt_speed"`
	MltLat          *PyFloat `json:"mlt_lat"`
	MltLong         *PyFloat `json:"mlt_long"`
	MltAccuacy      *PyFloat `json:"mlt_accuacy"`
	MtHealthWork    int      `json:"mt_health_work"`
	MltBattery      *int     `json:"mlt_battery"`
	MltFineLocation *string  `json:"mlt_fine_location"`
	MltLocationChk  *string  `json:"mlt_location_chk"`
	MltWdate        *string  `json:"mlt_wdate"`
	StayLat         *PyFloat `json:"stay_lat"`
	StayLong        *PyFloat `json:"stay_long"`
}

// MapMarkersResult는 /map-markers {"result":"Y","data":[...],"total_markers":N}.
type MapMarkersResult struct {
	Result       string          `json:"result"`
	Data         []MapMarkerItem `json:"data"`
	TotalMarkers int             `json:"total_markers"`
}
