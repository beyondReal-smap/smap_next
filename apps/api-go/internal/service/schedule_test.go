package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeScheduleRepo struct {
	one  *model.Schedule
	many []model.Schedule
	err  error
}

func (f *fakeScheduleRepo) List(skip, limit int) ([]model.Schedule, error)   { return f.many, f.err }
func (f *fakeScheduleRepo) GetByID(id int) (*model.Schedule, error)          { return f.one, f.err }
func (f *fakeScheduleRepo) FindByMember(mtIdx int) ([]model.Schedule, error) { return f.many, f.err }
func (f *fakeScheduleRepo) FindGroupSchedules(g int, days *int) ([]model.Schedule, error) {
	return f.many, f.err
}
func (f *fakeScheduleRepo) Create(s *model.Schedule) error                           { return f.err }
func (f *fakeScheduleRepo) UpdateFields(id int, fields map[string]interface{}) error { return f.err }
func (f *fakeScheduleRepo) Delete(id int) error                                      { return f.err }
func (f *fakeScheduleRepo) GetNowScheduleInMembers() ([]model.Schedule, error) {
	return f.many, f.err
}
func (f *fakeScheduleRepo) GetNowScheduleOutMembers() ([]model.Schedule, error) {
	return f.many, f.err
}
func (f *fakeScheduleRepo) GetNowSchedulePush() ([]model.Schedule, error) {
	return f.many, f.err
}

// TestScheduleResponseJSON은 /schedules/{id} 실측 바이트와 동일한지 검증한다.
func TestScheduleResponseJSON(t *testing.T) {
	svc := NewSchedule(&fakeScheduleRepo{one: &model.Schedule{
		SstIdx: 316284, MtIdx: pInt(2532), SstTitle: pStr("롯데월드 "),
		SstSdate:  pTimePtr(time.Date(2026, 2, 23, 7, 30, 0, 0, time.Local)),
		SstEdate:  pTimePtr(time.Date(2026, 2, 23, 9, 30, 0, 0, time.Local)),
		SstSedate: pStr("2026-02-23 07:30:00 ~ 2026-02-23 09:30:00"),
		SstAllDay: pStr("N"), SstRepeatJSON: pStr(""), SstRepeatJSONV: pStr(""),
		SgtIdx: pInt(111905), SgdtIdx: pInt(2239), SstAlram: pInt(0),
		SstLocationTitle: pStr(""), SstSupplies: pStr(""), SstMemo: pStr(""),
		SstShow: pStr("Y"), SstLocationAlarm: pInt(4), SstScheduleAlarmChk: pStr("N"),
		SstUpdateChk: pStr("3"), SstInChk: pStr("N"), SstScheduleChk: pStr("N"),
		SstEntryCnt: pInt(1), SstExitCnt: pInt(1),
		SstWdate: pTimePtr(time.Date(2026, 1, 22, 1, 25, 38, 0, time.Local)),
	}})
	res, found, ok := svc.GetSchedule(316284)
	if !found || !ok {
		t.Fatalf("found=%v ok=%v", found, ok)
	}
	b, _ := json.Marshal(res)
	want := `{"sst_pidx":null,"mt_idx":2532,"sst_title":"롯데월드 ","sst_sdate":"2026-02-23T07:30:00","sst_edate":"2026-02-23T09:30:00","sst_sedate":"2026-02-23 07:30:00 ~ 2026-02-23 09:30:00","sst_all_day":"N","sst_repeat_json":"","sst_repeat_json_v":"","sgt_idx":111905,"sgdt_idx":2239,"sgdt_idx_t":null,"sst_alram":0,"sst_alram_t":null,"sst_adate":null,"slt_idx":null,"slt_idx_t":null,"sst_location_title":"","sst_location_add":null,"sst_location_lat":null,"sst_location_long":null,"sst_supplies":"","sst_memo":"","sst_show":"Y","sst_location_alarm":4,"sst_schedule_alarm_chk":"N","sst_pick_type":null,"sst_pick_result":null,"sst_schedule_alarm":null,"sst_update_chk":"3","sst_in_chk":"N","sst_schedule_chk":"N","sst_entry_cnt":1,"sst_exit_cnt":1,"sst_idx":316284,"sst_wdate":"2026-01-22T01:25:38","sst_udate":null,"sst_ddate":null,"mt_schedule_idx":null}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestScheduleZeroDate500은 zero date('0000-00-00'→time.Time{})가 있으면 ok=false(→500)인지 검증한다.
func TestScheduleZeroDate500(t *testing.T) {
	zero := time.Time{} // 드라이버가 '0000-00-00 00:00:00'을 IsZero로 변환
	sc := &model.Schedule{SstIdx: 294315, MtIdx: pInt(1995), SstScheduleAlarm: &zero}
	svc := NewSchedule(&fakeScheduleRepo{one: sc})
	_, found, ok := svc.GetSchedule(294315)
	if !found || ok {
		t.Errorf("zero date는 found=true, ok=false(500) 기대: found=%v ok=%v", found, ok)
	}
	// 목록도 한 행이라도 zero date면 ok=false
	svc2 := NewSchedule(&fakeScheduleRepo{many: []model.Schedule{{SstIdx: 1}, *sc}})
	if _, lok := svc2.ListSchedules(0, 100); lok {
		t.Error("목록에 zero date 있으면 ok=false(500) 기대")
	}
}

// TestScheduleGroupItem은 /schedules/group의 변환(id=int, date=T, lat=float, zero date 처리)을 검증한다.
func TestScheduleGroupItem(t *testing.T) {
	svc := NewSchedule(&fakeScheduleRepo{many: []model.Schedule{{
		SstIdx: 305027, SstPidx: pInt(304662), MtIdx: pInt(1186), SstTitle: pStr("집"),
		SstSdate:         pTimePtr(time.Date(2026, 5, 30, 0, 5, 0, 0, time.Local)),
		SstAllDay:        pStr("N"),
		SgtIdx:           pInt(641),
		SstLocationLat:   pStr("37.51818880846492000"), // DECIMAL 문자열 → float
		SstLocationTitle: pStr("문래롯데캐슬아파트"),
	}}})
	res, _ := svc.GroupSchedules(641, nil)
	it := res[0]
	if it.ID != 305027 {
		t.Errorf("id는 int 305027 기대: %d", it.ID)
	}
	if it.MtScheduleIdx == nil || *it.MtScheduleIdx != 1186 {
		t.Errorf("mt_schedule_idx=mt_idx 기대: %v", it.MtScheduleIdx)
	}
	if it.Date == nil || *it.Date != "2026-05-30T00:05:00" {
		t.Errorf("date isoformat(T) 기대: %v", it.Date)
	}
	if it.SstLocationLat == nil || *it.SstLocationLat != 37.51818880846492 {
		t.Errorf("sst_location_lat float 기대: %v", it.SstLocationLat)
	}
	if it.Location == nil || *it.Location != "문래롯데캐슬아파트" {
		t.Errorf("location=sst_location_title 기대: %v", it.Location)
	}
}

// TestGroupDateStr은 zero date→"0000-00-00 00:00:00", 유효→isoformat(T), nil→nil을 검증한다.
func TestGroupDateStr(t *testing.T) {
	if groupDateStr(nil) != nil {
		t.Error("nil → nil")
	}
	zero := time.Time{}
	if got := groupDateStr(&zero); got == nil || *got != "0000-00-00 00:00:00" {
		t.Errorf("zero → '0000-00-00 00:00:00' 기대: %v", got)
	}
	v := time.Date(2026, 5, 30, 0, 5, 0, 0, time.Local)
	if got := groupDateStr(&v); got == nil || *got != "2026-05-30T00:05:00" {
		t.Errorf("유효 → isoformat(T) 기대: %v", got)
	}
}

// TestPyDecimalStr은 zero→"0E-14", 비-zero→원문 유지를 검증한다(Python str(Decimal) 재현).
func TestPyDecimalStr(t *testing.T) {
	cases := map[string]string{
		"0.00000000000000":   "0E-14",
		"37.52460739277500":  "37.52460739277500",
		"-5.00000000000000":  "-5.00000000000000",
		"126.87469742636608": "126.87469742636608",
	}
	for in, want := range cases {
		got := pyDecimalStr(&in)
		if got == nil || *got != want {
			t.Errorf("pyDecimalStr(%q) = %v, want %q", in, derefForTest(got), want)
		}
	}
	if pyDecimalStr(nil) != nil {
		t.Error("nil → nil 기대")
	}
}

func derefForTest(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
