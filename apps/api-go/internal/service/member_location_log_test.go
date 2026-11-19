package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeLocationLogRepo struct {
	logs       []model.MemberLocationLog
	members    []int
	summary    []model.LocationDailySummaryRow
	activity   []model.MemberActivityRow
	dcMembers  []model.LocationLogMemberBasic
	dcCounts   []model.DailyCountRow
	stayTimes  []model.StayTimeRow
	mapMarkers []model.MemberLocationLog
	schedCount int
	gpsMeters  float64
	gpsMinutes float64
	gpsSteps   int
	err        error
}

func (f *fakeLocationLogRepo) GetLogByID(mltIdx int) (*model.MemberLocationLog, error) {
	return nil, f.err
}
func (f *fakeLocationLogRepo) CreateLog(l *model.MemberLocationLog, now time.Time) error {
	return f.err
}
func (f *fakeLocationLogRepo) CreateLogsBatch(logs []*model.MemberLocationLog, now time.Time) error {
	return f.err
}
func (f *fakeLocationLogRepo) GetLogsByIDs(mtIdx int, mltIdxs []int) ([]model.MemberLocationLog, error) {
	return nil, f.err
}
func (f *fakeLocationLogRepo) UpdateLog(mltIdx int, fields map[string]interface{}) (int64, error) {
	return 0, f.err
}
func (f *fakeLocationLogRepo) DeleteLog(mltIdx int) error { return f.err }
func (f *fakeLocationLogRepo) GetMemberLogs(mtIdx int, start, end *time.Time, limit, offset int) ([]model.MemberLocationLog, error) {
	return f.logs, f.err
}
func (f *fakeLocationLogRepo) GetMemberLogsByExactDate(mtIdx int, start, end time.Time, limit, offset int) ([]model.MemberLocationLog, error) {
	return f.logs, f.err
}
func (f *fakeLocationLogRepo) GetMembersWithLogsByDate(start, end time.Time) ([]int, error) {
	return f.members, f.err
}
func (f *fakeLocationLogRepo) DailySummary(mtIdx int, start, end time.Time, maxAcc, minSpeed float64) ([]model.LocationDailySummaryRow, error) {
	return f.summary, f.err
}
func (f *fakeLocationLogRepo) MemberActivity(groupID int, dateStr string) ([]model.MemberActivityRow, error) {
	return f.activity, f.err
}
func (f *fakeLocationLogRepo) DailyCounts(groupID int, startStr, endStr string, having bool) ([]model.LocationLogMemberBasic, []model.DailyCountRow, error) {
	return f.dcMembers, f.dcCounts, f.err
}
func (f *fakeLocationLogRepo) ScheduleCount(mtIdx int, dateStr string) (int, error) {
	return f.schedCount, f.err
}
func (f *fakeLocationLogRepo) GpsDistanceAndTime(mtIdx int, dateStr string) (float64, float64, int, error) {
	return f.gpsMeters, f.gpsMinutes, f.gpsSteps, f.err
}
func (f *fakeLocationLogRepo) StayTimes(mtIdx int, date string, minSpeed, maxAccuracy float64, minDuration int) ([]model.StayTimeRow, error) {
	return f.stayTimes, f.err
}
func (f *fakeLocationLogRepo) MapMarkers(mtIdx int, date string, minSpeed, maxAccuracy float64) ([]model.MemberLocationLog, error) {
	return f.mapMarkers, f.err
}

// TestDailySummaryFormat은 log_date="YYYY-MM-DD", start/end_time="YYYY-MM-DD HH:MM:SS"(공백, 초단위) 검증.
func TestDailySummaryFormat(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{summary: []model.LocationDailySummaryRow{{
		MltIdx:    189438,
		LogDate:   time.Date(2026, 1, 10, 0, 0, 0, 0, time.Local),
		StartTime: time.Date(2026, 1, 10, 0, 3, 46, 0, time.Local),
		EndTime:   time.Date(2026, 1, 10, 23, 58, 12, 0, time.Local),
	}}})
	res, _ := svc.DailySummary(1958, "2026-01-01", "2026-01-31", 50.0, 0.0)
	b, _ := json.Marshal(res)
	want := `[{"mlt_idx":189438,"log_date":"2026-01-10","start_time":"2026-01-10 00:03:46","end_time":"2026-01-10 23:58:12"}]`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestPyFloatMarshal은 Python float repr(정수값 ".0")을 검증한다.
func TestPyFloatMarshal(t *testing.T) {
	cases := map[float64]string{
		0.0: "0.0", 5.0: "5.0", 14.7265: "14.7265", 37.44335: "37.44335",
		126.71745: "126.71745", 0.5: "0.5", 100.0: "100.0",
	}
	for in, want := range cases {
		b, _ := json.Marshal(dto.PyFloat(in))
		if string(b) != want {
			t.Errorf("PyFloat(%v) = %s, want %s", in, b, want)
		}
	}
}

// TestLocationLogDictJSON은 to_dict 직렬화(daily 첫 행 실측)와 byte-동등인지 검증한다.
func TestLocationLogDictJSON(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{logs: []model.MemberLocationLog{{
		MltIdx: 189438, MtIdx: 1958,
		MltLat: pFloat(37.44335), MltLong: pFloat(126.71745),
		MltAccuacy: pFloat(14.7265), MltSpeed: pFloat(0.0), // 0.0 → "0.0"
		MltBattery: pInt(75), MltFineLocation: pStr("N"), MltLocationChk: pStr("N"),
		MtHealthWork: pIntZero(),
		MltGpsTime:   pTimePtr(time.Date(2026, 1, 10, 0, 3, 46, 0, time.Local)),
		MltWdate:     pTimePtr(time.Date(2026, 1, 10, 0, 3, 46, 0, time.Local)),
		// stay_lat/long nil → null
	}}})
	res, _ := svc.DailyLogs(1958, "2026-01-10", 1000, 0)
	b, _ := json.Marshal(res)
	want := `[{"mlt_idx":189438,"mt_idx":1958,"mlt_lat":37.44335,"mlt_long":126.71745,"mlt_accuacy":14.7265,"mlt_speed":0.0,"mlt_battery":75,"mlt_fine_location":"N","mlt_location_chk":"N","mt_health_work":0,"mlt_gps_time":"2026-01-10T00:03:46","mlt_wdate":"2026-01-10T00:03:46","stay_lat":null,"stay_long":null}]`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMemberActivity는 항목 변환(first/last_log_time isoformat T, is_active) + 날짜오류(badDate) 검증.
func TestMemberActivity(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{activity: []model.MemberActivityRow{
		{MtIdx: 1948, MtName: pStr("대수"), MtNickname: pStr("캐슬남자"), MtGender: pInt(1),
			LogCount: 120, FirstLogTime: pTimePtr(time.Date(2026, 1, 10, 0, 3, 46, 0, time.Local)),
			LastLogTime: pTimePtr(time.Date(2026, 1, 10, 23, 58, 12, 0, time.Local))},
		{MtIdx: 1952, MtName: pStr("이나경"), LogCount: 0}, // 로그 없음 → is_active=false, 시각 null
	}})
	items, badDate, err := svc.MemberActivity(641, "2026-01-10")
	if badDate || err != nil {
		t.Fatalf("badDate=%v err=%v", badDate, err)
	}
	b, _ := json.Marshal(items)
	want := `[{"member_id":1948,"member_name":"대수","mt_nickname":"캐슬남자","member_photo":null,"member_gender":1,"log_count":120,"first_log_time":"2026-01-10T00:03:46","last_log_time":"2026-01-10T23:58:12","is_active":true},{"member_id":1952,"member_name":"이나경","mt_nickname":null,"member_photo":null,"member_gender":null,"log_count":0,"first_log_time":null,"last_log_time":null,"is_active":false}]`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
	// 잘못된 날짜 → badDate
	if _, bad, _ := svc.MemberActivity(641, "2026-99-99"); !bad {
		t.Error("잘못된 날짜는 badDate=true 기대")
	}
}

// TestDailyCountsSimpleFormat은 "mid date count" 문자열 + 빈그룹 message를 검증한다.
func TestDailyCountsSimpleFormat(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{
		dcMembers: []model.LocationLogMemberBasic{{MtIdx: 1948}},
		dcCounts: []model.DailyCountRow{
			{MemberIdx: 1948, LogDate: time.Date(2026, 1, 10, 0, 0, 0, 0, time.Local), Count: 120},
			{MemberIdx: 1948, LogDate: time.Date(2026, 1, 9, 0, 0, 0, 0, time.Local), Count: 88},
		},
	})
	res, empty, _ := svc.DailyCountsSimple(641, 14)
	if empty != nil || res == nil {
		t.Fatal("멤버 있음 기대")
	}
	if len(res.SimpleFormat) != 2 || res.SimpleFormat[0] != "1948 2026-01-10 120" || res.SimpleFormat[1] != "1948 2026-01-09 88" {
		t.Errorf("simple_format 불일치: %v", res.SimpleFormat)
	}
	if res.TotalRecords != 2 || res.GroupID != 641 {
		t.Errorf("%+v", res)
	}
	// 빈 그룹 → message
	svc2 := NewLocationLog(&fakeLocationLogRepo{dcMembers: nil})
	_, empty2, _ := svc2.DailyCountsSimple(999999, 14)
	if empty2 == nil || empty2.Message != "그룹 999999에 멤버가 없습니다." {
		t.Errorf("빈그룹 message 기대: %+v", empty2)
	}
}

// TestDailyCountsMatrix는 멤버×days 매트릭스 구조(days 항목, formatted_date %m.%d, is_weekend)를 검증한다.
func TestDailyCountsMatrix(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{
		dcMembers: []model.LocationLogMemberBasic{{MtIdx: 1948, MtName: pStr("대수")}},
	})
	res, empty, _ := svc.DailyCounts(641, 7)
	if empty != nil || res == nil {
		t.Fatal("멤버 있음 기대")
	}
	if len(res.MemberDailyCounts) != 1 || len(res.MemberDailyCounts[0].DailyCounts) != 7 {
		t.Errorf("멤버 1명·7일 기대: %d명 %d일", len(res.MemberDailyCounts), len(res.MemberDailyCounts[0].DailyCounts))
	}
	if len(res.TotalDailyCounts) != 7 || res.TotalDays != 7 || res.GroupID != 641 {
		t.Errorf("%+v", res)
	}
	// 첫 항목은 오늘(is_today=true), formatted_date는 MM.DD 형식
	first := res.MemberDailyCounts[0].DailyCounts[0]
	if !first.IsToday || len(first.FormattedDate) != 5 || first.FormattedDate[2] != '.' {
		t.Errorf("첫 항목 is_today/formatted_date 불일치: %+v", first)
	}
}

// TestLocationLogDateError는 잘못된 날짜 형식이 error(→500)인지 검증한다.
func TestLocationLogDateError(t *testing.T) {
	svc := NewLocationLog(&fakeLocationLogRepo{})
	if _, err := svc.DailyLogs(1, "", 1000, 0); err == nil {
		t.Error("빈 날짜는 error 기대")
	}
	if _, err := svc.DailyLogs(1, "2026-13-99", 1000, 0); err == nil {
		t.Error("잘못된 날짜는 error 기대")
	}
}

func pIntZero() *int { z := 0; return &z }
