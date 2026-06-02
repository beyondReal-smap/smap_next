package service

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// locationLogRepo는 LocationLogService가 의존하는 데이터 접근 인터페이스.
type locationLogRepo interface {
	GetMemberLogs(mtIdx int, start, end *time.Time, limit, offset int) ([]model.MemberLocationLog, error)
	GetMemberLogsByExactDate(mtIdx int, start, end time.Time, limit, offset int) ([]model.MemberLocationLog, error)
	GetMembersWithLogsByDate(start, end time.Time) ([]int, error)
	DailySummary(mtIdx int, start, end time.Time, maxAcc, minSpeed float64) ([]model.LocationDailySummaryRow, error)
	MemberActivity(groupID int, dateStr string) ([]model.MemberActivityRow, error)
	DailyCounts(groupID int, startStr, endStr string, having bool) ([]model.LocationLogMemberBasic, []model.DailyCountRow, error)
	ScheduleCount(mtIdx int, dateStr string) (int, error)
	GpsDistanceAndTime(mtIdx int, dateStr string) (float64, float64, int, error)
	StayTimes(mtIdx int, date string, minSpeed, maxAccuracy float64, minDuration int) ([]model.StayTimeRow, error)
	MapMarkers(mtIdx int, date string, minSpeed, maxAccuracy float64) ([]model.MemberLocationLog, error)
	GetLogByID(mltIdx int) (*model.MemberLocationLog, error)
	CreateLog(l *model.MemberLocationLog, now time.Time) error
	UpdateLog(mltIdx int, fields map[string]interface{}) (int64, error)
	DeleteLog(mltIdx int) error
}

// todayLocal은 datetime.now().date()와 동등한 로컬 오늘 00:00.
func todayLocal() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// isWeekend는 Python date.weekday()>=5(토/일)과 동등.
func isWeekend(t time.Time) bool {
	return t.Weekday() == time.Saturday || t.Weekday() == time.Sunday
}

// LocationLogService는 Python `app/api/v1/endpoints/member_location_log.py`의 단순 read 핸들러를
// 이식한다(stay-times·summary·map-markers 등 복잡 쿼리는 후속).
type LocationLogService struct {
	repo locationLogRepo
}

func NewLocationLog(repo locationLogRepo) *LocationLogService {
	return &LocationLogService{repo: repo}
}

// parseYMD는 Python datetime.strptime(s, "%Y-%m-%d")와 동등(로컬, 잘못된 형식은 error→500).
func parseYMD(s string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", s, time.Local)
}

func floatToPyFloatPtr(f *float64) *dto.PyFloat {
	if f == nil {
		return nil
	}
	v := dto.PyFloat(*f)
	return &v
}

// floatToPyFloatPtrOrNil은 Python `float(x) if x else None`(nil 또는 0 → nil).
func floatToPyFloatPtrOrNil(f *float64) *dto.PyFloat {
	if f == nil || *f == 0 {
		return nil
	}
	v := dto.PyFloat(*f)
	return &v
}

func toLocationLogDict(l *model.MemberLocationLog) dto.LocationLogDict {
	return dto.LocationLogDict{
		MltIdx:          l.MltIdx,
		MtIdx:           l.MtIdx,
		MltLat:          floatToPyFloatPtrOrNil(l.MltLat),
		MltLong:         floatToPyFloatPtrOrNil(l.MltLong),
		MltAccuacy:      floatToPyFloatPtr(l.MltAccuacy),
		MltSpeed:        floatToPyFloatPtr(l.MltSpeed),
		MltBattery:      l.MltBattery,
		MltFineLocation: l.MltFineLocation,
		MltLocationChk:  l.MltLocationChk,
		MtHealthWork:    l.MtHealthWork,
		MltGpsTime:      pyISOPtr(l.MltGpsTime),
		MltWdate:        pyISOPtr(l.MltWdate),
		StayLat:         floatToPyFloatPtrOrNil(l.StayLat),
		StayLong:        floatToPyFloatPtrOrNil(l.StayLong),
	}
}

func toLocationLogDicts(items []model.MemberLocationLog) []dto.LocationLogDict {
	out := make([]dto.LocationLogDict, 0, len(items))
	for i := range items {
		out = append(out, toLocationLogDict(&items[i]))
	}
	return out
}

// MemberLogs는 GET /logs/member-location-logs/{mt_idx}. startStr/endStr 빈 문자열이면 미적용
// (Python `if start_date:` truthy). 날짜 형식 오류는 error→500.
func (s *LocationLogService) MemberLogs(mtIdx int, startStr, endStr string, limit, offset int) ([]dto.LocationLogDict, error) {
	var start, end *time.Time
	if startStr != "" {
		t, err := parseYMD(startStr)
		if err != nil {
			return nil, err
		}
		start = &t
	}
	if endStr != "" {
		t, err := parseYMD(endStr)
		if err != nil {
			return nil, err
		}
		e := t.AddDate(0, 0, 1)
		end = &e
	}
	items, err := s.repo.GetMemberLogs(mtIdx, start, end, limit, offset)
	if err != nil {
		return nil, err
	}
	return toLocationLogDicts(items), nil
}

// DailyLogs는 GET /logs/member-location-logs/{mt_idx}/daily. date 필수([date 00:00:00, 23:59:59]).
func (s *LocationLogService) DailyLogs(mtIdx int, dateStr string, limit, offset int) ([]dto.LocationLogDict, error) {
	t, err := parseYMD(dateStr)
	if err != nil {
		return nil, err
	}
	start := t
	end := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	items, err := s.repo.GetMemberLogsByExactDate(mtIdx, start, end, limit, offset)
	if err != nil {
		return nil, err
	}
	return toLocationLogDicts(items), nil
}

// MembersWithLogs는 GET /logs/members-with-logs. date 범위 [date, date+1d)의 distinct mt_idx.
func (s *LocationLogService) MembersWithLogs(dateStr string) ([]int, error) {
	t, err := parseYMD(dateStr)
	if err != nil {
		return nil, err
	}
	return s.repo.GetMembersWithLogsByDate(t, t.AddDate(0, 0, 1))
}

// MemberActivity는 GET /logs/member-activity. badDate=true면 400(날짜 형식 오류).
// 멤버 0명이면 빈 슬라이스 반환(핸들러가 2키 응답). first/last_log_time=isoformat(T).
func (s *LocationLogService) MemberActivity(groupID int, dateStr string) ([]dto.MemberActivityItem, bool, error) {
	if _, err := parseYMD(dateStr); err != nil {
		return nil, true, nil
	}
	rows, err := s.repo.MemberActivity(groupID, dateStr)
	if err != nil {
		return nil, false, err
	}
	out := make([]dto.MemberActivityItem, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		out = append(out, dto.MemberActivityItem{
			MemberID:     r.MtIdx,
			MemberName:   r.MtName,
			MtNickname:   r.MtNickname,
			MemberPhoto:  r.MtFile1,
			MemberGender: r.MtGender,
			LogCount:     r.LogCount,
			FirstLogTime: pyISOPtr(r.FirstLogTime),
			LastLogTime:  pyISOPtr(r.LastLogTime),
			IsActive:     r.LogCount > 0,
		})
	}
	return out, false, nil
}

// DailyCounts는 GET /logs/daily-counts. end=오늘, start=오늘-(days-1). 멤버 0명이면 empty 반환.
// 멤버×days 매트릭스(end부터 하루씩 과거로). day_of_week=%a, formatted_date=%m.%d.
func (s *LocationLogService) DailyCounts(groupID, days int) (*dto.DailyCountsResult, *dto.DailyCountsEmpty, error) {
	end := todayLocal()
	start := end.AddDate(0, 0, -(days - 1))
	members, counts, err := s.repo.DailyCounts(groupID, start.Format("2006-01-02"), end.Format("2006-01-02"), false)
	if err != nil {
		return nil, nil, err
	}
	if len(members) == 0 {
		return nil, &dto.DailyCountsEmpty{DailyCounts: make([]dto.DailyCountEntry, 0), TotalDays: days}, nil
	}
	cd := make(map[int]map[string]int)
	for _, c := range counts {
		ds := c.LogDate.Format("2006-01-02")
		if cd[c.MemberIdx] == nil {
			cd[c.MemberIdx] = make(map[string]int)
		}
		cd[c.MemberIdx][ds] = c.Count
	}
	build := func(countFor func(string) int) []dto.DailyCountEntry {
		entries := make([]dto.DailyCountEntry, 0)
		cur := end
		for i := 0; i < days; i++ {
			ds := cur.Format("2006-01-02")
			entries = append(entries, dto.DailyCountEntry{
				Date: ds, Count: countFor(ds),
				FormattedDate: cur.Format("01.02"), DayOfWeek: cur.Format("Mon"),
				IsToday: cur.Equal(end), IsWeekend: isWeekend(cur),
			})
			cur = cur.AddDate(0, 0, -1)
		}
		return entries
	}
	mdcs := make([]dto.MemberDailyCounts, 0, len(members))
	for _, m := range members {
		mid := m.MtIdx
		mdcs = append(mdcs, dto.MemberDailyCounts{
			MemberID: mid, MemberName: m.MtName, MtNickname: m.MtNickname,
			MemberPhoto: m.MtFile1, MemberGender: m.MtGender,
			DailyCounts: build(func(ds string) int { return cd[mid][ds] }),
		})
	}
	total := build(func(ds string) int {
		sum := 0
		for _, m := range members {
			sum += cd[m.MtIdx][ds]
		}
		return sum
	})
	return &dto.DailyCountsResult{
		MemberDailyCounts: mdcs, TotalDailyCounts: total, TotalDays: days,
		StartDate: start.Format("2006-01-02"), EndDate: end.Format("2006-01-02"),
		GroupID: groupID, TotalMembers: len(members),
	}, nil, nil
}

// DailyCountsSimple는 GET /logs/daily-counts-simple. 멤버 0명이면 {"message":...}.
func (s *LocationLogService) DailyCountsSimple(groupID, days int) (*dto.DailyCountsSimpleResult, *dto.DailyCountsSimpleEmpty, error) {
	end := todayLocal()
	start := end.AddDate(0, 0, -(days - 1))
	members, counts, err := s.repo.DailyCounts(groupID, start.Format("2006-01-02"), end.Format("2006-01-02"), true)
	if err != nil {
		return nil, nil, err
	}
	if len(members) == 0 {
		return nil, &dto.DailyCountsSimpleEmpty{Message: fmt.Sprintf("그룹 %d에 멤버가 없습니다.", groupID)}, nil
	}
	sf := make([]string, 0, len(counts))
	for _, c := range counts {
		sf = append(sf, fmt.Sprintf("%d %s %d", c.MemberIdx, c.LogDate.Format("2006-01-02"), c.Count))
	}
	return &dto.DailyCountsSimpleResult{
		SimpleFormat: sf, TotalRecords: len(sf), GroupID: groupID,
		DateRange: start.Format("2006-01-02") + " ~ " + end.Format("2006-01-02"),
	}, nil, nil
}

// DailySummary는 GET /logs/member-location-logs/{mt_idx}/daily-summary. start_date/end_date 필수,
// [start 00:00:00, end 23:59:59]. log_date=YYYY-MM-DD, start/end_time=YYYY-MM-DD HH:MM:SS(strftime 초).
func (s *LocationLogService) DailySummary(mtIdx int, startStr, endStr string, maxAcc, minSpeed float64) ([]dto.LocationDailySummaryItem, error) {
	st, err := parseYMD(startStr)
	if err != nil {
		return nil, err
	}
	et, err := parseYMD(endStr)
	if err != nil {
		return nil, err
	}
	end := et.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	rows, err := s.repo.DailySummary(mtIdx, st, end, maxAcc, minSpeed)
	if err != nil {
		return nil, err
	}
	out := make([]dto.LocationDailySummaryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.LocationDailySummaryItem{
			MltIdx:    r.MltIdx,
			LogDate:   r.LogDate.Format("2006-01-02"),
			StartTime: r.StartTime.Format("2006-01-02 15:04:05"),
			EndTime:   r.EndTime.Format("2006-01-02 15:04:05"),
		})
	}
	return out, nil
}

// --- /summary, /path 공용 헬퍼 (Python crud의 Haversine·round·포맷터를 충실 이식) ---

// degToRad는 CPython math.radians와 동일하게 상수 (pi/180)을 먼저 폴딩한다.
// CPython: x * (Py_MATH_PI / 180.0). Go도 상수식이라 동일한 double로 폴딩 → 라디안 bit-동일.
const degToRad = math.Pi / 180.0

func radians(d float64) float64 { return d * degToRad }

// haversineKm는 Python calculate_distance(R=6371km)를 항·연산 순서까지 동일하게 이식한다.
// 좌표 중 하나라도 0이면 0.0(Python `if not all([...])`). sin/cos/atan2는 libm 구현차로 ≤1ULP
// 차이가 날 수 있으나 km 2자리 반올림에서 대부분 흡수된다.
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	if lat1 == 0 || lon1 == 0 || lat2 == 0 || lon2 == 0 {
		return 0.0
	}
	const R = 6371.0
	dlat := radians(lat2 - lat1)
	dlon := radians(lon2 - lon1)
	a := math.Sin(dlat/2)*math.Sin(dlat/2) +
		math.Cos(radians(lat1))*math.Cos(radians(lat2))*math.Sin(dlon/2)*math.Sin(dlon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// pyRound2는 Python round(x, 2)(round-half-to-even)를 재현한다. Go strconv는 정확한 float64 값을
// 기준으로 짝수반올림하므로 'f' prec=2 포맷 후 재파싱하면 Python round과 동일한 값이 된다.
func pyRound2(x float64) float64 {
	v, _ := strconv.ParseFloat(strconv.FormatFloat(x, 'f', 2, 64), 64)
	return v
}

// isTruthyF는 Python float truthiness(None/0.0 → falsy).
func isTruthyF(f *float64) bool { return f != nil && *f != 0 }

// floatOrZeroPy는 Python `float(x) if x else 0.0`(nil/0 → 0.0).
func floatOrZeroPy(f *float64) dto.PyFloat {
	if f == nil || *f == 0 {
		return dto.PyFloat(0)
	}
	return dto.PyFloat(*f)
}

// pySpacePtr은 Python strftime('%Y-%m-%d %H:%M:%S')(항상 초단위, 마이크로초 절단). nil → nil.
func pySpacePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02 15:04:05")
	return &s
}

// formatThousands는 Python f"{n:,}"(천단위 콤마).
func formatThousands(n int) string {
	s := strconv.Itoa(n)
	neg := strings.HasPrefix(s, "-")
	if neg {
		s = s[1:]
	}
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteByte(s[i])
	}
	if neg {
		return "-" + b.String()
	}
	return b.String()
}

// formatDistanceKm는 Python format_distance_km(meters<1000→"{int}m", else "{km:.1f}km").
func formatDistanceKm(meters float64) string {
	if meters < 1000 {
		return fmt.Sprintf("%dm", int(meters))
	}
	return fmt.Sprintf("%.1fkm", meters/1000)
}

// formatDurationHm는 Python format_duration_hm(minutes<60→"{int}분", else "{h}시간 {m}분").
// hours=int(min//60), mins=int(min%60) — min은 float(SUM/60).
func formatDurationHm(minutes float64) string {
	if minutes < 60 {
		return fmt.Sprintf("%d분", int(minutes))
	}
	hours := int(minutes / 60)
	mins := int(math.Mod(minutes, 60))
	return fmt.Sprintf("%d시간 %d분", hours, mins)
}

// formatDuration은 Python format_duration(int분, <=0→"0분", 시간만/분만 분기). format_duration_hm과 달리
// mins==0이면 "{h}시간"만 출력한다.
func formatDuration(minutes int) string {
	if minutes <= 0 {
		return "0분"
	}
	hours := minutes / 60
	mins := minutes % 60
	if hours > 0 && mins > 0 {
		return fmt.Sprintf("%d시간 %d분", hours, mins)
	}
	if hours > 0 {
		return fmt.Sprintf("%d시간", hours)
	}
	return fmt.Sprintf("%d분", mins)
}

// dateWindow는 Python get_member_location_logs의 날짜창(start>=, end<+1일). 빈 문자열이면 미적용,
// 잘못된 형식은 error(→500). (MemberLogs와 동일 규칙)
func (s *LocationLogService) dateWindow(startStr, endStr string) (*time.Time, *time.Time, error) {
	var start, end *time.Time
	if startStr != "" {
		t, err := parseYMD(startStr)
		if err != nil {
			return nil, nil, err
		}
		start = &t
	}
	if endStr != "" {
		t, err := parseYMD(endStr)
		if err != nil {
			return nil, nil, err
		}
		e := t.AddDate(0, 0, 1)
		end = &e
	}
	return start, end, nil
}

// computeSummary는 Python get_location_summary(line 136)의 메모리 계산(인접 Haversine 누적·시간·걸음·
// 평균속도·배터리)을 이식한다. 걸음=Σ(x or 0), 배터리=max(0, (logs[0] or 100)-(logs[-1] or 100)).
func computeSummary(logs []model.MemberLocationLog) dto.LocationSummaryData {
	if len(logs) == 0 {
		return dto.LocationSummaryData{TotalDistance: dto.PyFloat(0), TotalTime: "0분", StepCount: 0, AverageSpeed: dto.PyFloat(0), BatteryConsumption: 0}
	}
	totalDistance := 0.0
	for i := 1; i < len(logs); i++ {
		prev, curr := &logs[i-1], &logs[i]
		if isTruthyF(prev.MltLat) && isTruthyF(prev.MltLong) && isTruthyF(curr.MltLat) && isTruthyF(curr.MltLong) {
			totalDistance += haversineKm(*prev.MltLat, *prev.MltLong, *curr.MltLat, *curr.MltLong)
		}
	}
	totalTime := 0
	if len(logs) > 1 {
		startT, endT := logs[0].MltGpsTime, logs[len(logs)-1].MltGpsTime
		if startT != nil && endT != nil {
			totalTime = int(endT.Sub(*startT).Seconds() / 60)
		}
	}
	totalSteps := 0
	for i := range logs {
		if logs[i].MtHealthWork != nil {
			totalSteps += *logs[i].MtHealthWork
		}
	}
	averageSpeed := 0.0
	if totalTime > 0 {
		averageSpeed = (totalDistance / float64(totalTime)) * 60
	}
	battery := derefIntOr(logs[0].MltBattery, 100) - derefIntOr(logs[len(logs)-1].MltBattery, 100)
	if battery < 0 {
		battery = 0
	}
	return dto.LocationSummaryData{
		TotalDistance:      dto.PyFloat(pyRound2(totalDistance)),
		TotalTime:          formatDuration(totalTime),
		StepCount:          totalSteps,
		AverageSpeed:       dto.PyFloat(pyRound2(averageSpeed)),
		BatteryConsumption: battery,
	}
}

// SummaryByDate는 GET /summary의 date 분기(Python get_location_log_summary). 헬퍼 내부 예외는
// 0으로 흡수(Python except→return 0). 항상 200(절대 500 아님).
func (s *LocationLogService) SummaryByDate(mtIdx int, date string) dto.LocationLogSummaryData {
	scheduleCount, err := s.repo.ScheduleCount(mtIdx, date)
	if err != nil {
		scheduleCount = 0
	}
	meters, minutes, steps, err := s.repo.GpsDistanceAndTime(mtIdx, date)
	if err != nil {
		meters, minutes, steps = 0, 0, 0
	}
	return dto.LocationLogSummaryData{
		ScheduleCount: formatThousands(scheduleCount),
		Distance:      formatDistanceKm(meters),
		Duration:      formatDurationHm(minutes),
		Steps:         steps,
	}
}

// SummaryByRange는 GET /summary의 date 없는 분기(Python get_location_summary). 잘못된 날짜→error(500).
func (s *LocationLogService) SummaryByRange(mtIdx int, startStr, endStr string) (dto.LocationSummaryData, error) {
	start, end, err := s.dateWindow(startStr, endStr)
	if err != nil {
		return dto.LocationSummaryData{}, err
	}
	logs, err := s.repo.GetMemberLogs(mtIdx, start, end, 10000, 0)
	if err != nil {
		return dto.LocationSummaryData{}, err
	}
	return computeSummary(logs), nil
}

// Path는 GET /path(Python get_location_path, line 563 버전). points(좌표 truthy만) + summary.
// accuracy/speed는 raw float(0→"0.0", nil→null). lat/lng는 float(Decimal)이라 항상 존재.
func (s *LocationLogService) Path(mtIdx int, startStr, endStr string) (dto.LocationPathData, error) {
	start, end, err := s.dateWindow(startStr, endStr)
	if err != nil {
		return dto.LocationPathData{}, err
	}
	logs, err := s.repo.GetMemberLogs(mtIdx, start, end, 10000, 0)
	if err != nil {
		return dto.LocationPathData{}, err
	}
	points := make([]dto.LocationPathPoint, 0)
	for i := range logs {
		l := &logs[i]
		if !isTruthyF(l.MltLat) || !isTruthyF(l.MltLong) {
			continue
		}
		ts := ""
		if l.MltGpsTime != nil {
			ts = pyISO(*l.MltGpsTime)
		}
		points = append(points, dto.LocationPathPoint{
			Lat:       dto.PyFloat(*l.MltLat),
			Lng:       dto.PyFloat(*l.MltLong),
			Timestamp: ts,
			Accuracy:  floatToPyFloatPtr(l.MltAccuacy),
			Speed:     floatToPyFloatPtr(l.MltSpeed),
			Battery:   l.MltBattery,
			Steps:     l.MtHealthWork,
		})
	}
	return dto.LocationPathData{Points: points, Summary: computeSummary(logs)}, nil
}

// StayTimes는 GET /stay-times(Python get_member_stay_times). raw CTE를 MariaDB에 위임하고 행만 포맷.
// start/end_time=strftime 공백, duration/distance=float(x) if x else 0.0, start_lat/long=float if x else None.
func (s *LocationLogService) StayTimes(mtIdx int, date string, minSpeed, maxAccuracy float64, minDuration int) ([]dto.StayTimeItem, error) {
	rows, err := s.repo.StayTimes(mtIdx, date, minSpeed, maxAccuracy, minDuration)
	if err != nil {
		return nil, err
	}
	out := make([]dto.StayTimeItem, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		out = append(out, dto.StayTimeItem{
			Label:     r.Label,
			Grp:       r.Grp,
			StartTime: pySpacePtr(r.StartTime),
			EndTime:   pySpacePtr(r.EndTime),
			Duration:  floatOrZeroPy(r.Duration),
			Distance:  floatOrZeroPy(r.Distance),
			StartLat:  floatToPyFloatPtrOrNil(r.StartLat),
			StartLong: floatToPyFloatPtrOrNil(r.StartLong),
		})
	}
	return out, nil
}

// MapMarkers는 GET /map-markers(Python get_member_map_markers). raw SQL 위임 후 200건 초과 시
// every-Nth 균일 샘플링(Python과 동일한 i*step 정수절단). speed=float(x) if x else 0.0,
// lat/long/accuacy/stay_*=float if x else None, health_work=int(0 폴백), battery=int if x else None.
func (s *LocationLogService) MapMarkers(mtIdx int, date string, minSpeed, maxAccuracy float64) ([]dto.MapMarkerItem, error) {
	rows, err := s.repo.MapMarkers(mtIdx, date, minSpeed, maxAccuracy)
	if err != nil {
		return nil, err
	}
	items := make([]dto.MapMarkerItem, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		items = append(items, dto.MapMarkerItem{
			MltIdx:          r.MltIdx,
			MtIdx:           r.MtIdx,
			MltGpsTime:      pySpacePtr(r.MltGpsTime),
			MltSpeed:        floatOrZeroPy(r.MltSpeed),
			MltLat:          floatToPyFloatPtrOrNil(r.MltLat),
			MltLong:         floatToPyFloatPtrOrNil(r.MltLong),
			MltAccuacy:      floatToPyFloatPtrOrNil(r.MltAccuacy),
			MtHealthWork:    derefIntOr(r.MtHealthWork, 0),
			MltBattery:      intPtrOrNil(r.MltBattery),
			MltFineLocation: r.MltFineLocation,
			MltLocationChk:  r.MltLocationChk,
			MltWdate:        pySpacePtr(r.MltWdate),
			StayLat:         floatToPyFloatPtrOrNil(r.StayLat),
			StayLong:        floatToPyFloatPtrOrNil(r.StayLong),
		})
	}
	const maxMarkers = 200
	if len(items) > maxMarkers {
		total := len(items)
		step := float64(total) / float64(maxMarkers)
		sampled := make([]dto.MapMarkerItem, 0, maxMarkers)
		for i := 0; i < maxMarkers; i++ {
			idx := int(float64(i) * step)
			if idx < total {
				sampled = append(sampled, items[idx])
			}
		}
		return sampled, nil
	}
	return items, nil
}
