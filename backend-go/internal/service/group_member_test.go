package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeGroupMemberRepo struct {
	rows []model.GroupMemberRow
	err  error
}

func (f *fakeGroupMemberRepo) FindGroupMembers(groupID int) ([]model.GroupMemberRow, error) {
	return f.rows, f.err
}

// TestGroupMemberFallbackJSON은 위치로그 없는 멤버(member_t fallback) 실측 바이트를 검증한다.
func TestGroupMemberFallbackJSON(t *testing.T) {
	svc := NewGroupMember(&fakeGroupMemberRepo{rows: []model.GroupMemberRow{{
		SgdtIdx: 1698, SgtIdx: pInt(1096), MtIdx: 1948,
		SgdtOwnerChk: pStr("Y"), SgdtLeaderChk: pStr("N"),
		MtName: pStr("대수"), MtNickname: pStr("캐슬남자"),
		MtBirth:  pTimePtr(time.Date(1979, 3, 27, 0, 0, 0, 0, time.Local)),
		MtGender: pInt(1), MtStatus: pInt(1), MtWeatherPop: pStr("0%"),
		MtWeatherTmn: pInt(26), MtWeatherTmx: pInt(28), MtWeatherSky: pInt(1),
		MtWeatherDate: pTimePtr(time.Date(2026, 5, 30, 12, 32, 46, 0, time.Local)),
		MltLat:        pFloat(37.5666805), MltLong: pFloat(126.9784147), // fallback(member_t)
	}}})
	res, _ := svc.GroupMembers(1096)
	b, _ := json.Marshal(res)
	want := `[{"sgdt_idx":1698,"sgt_idx":1096,"mt_idx":1948,"sgdt_owner_chk":"Y","sgdt_leader_chk":"N","mt_name":"대수","mt_nickname":"캐슬남자","mt_birth":"1979-03-27","mt_file1":null,"mt_gender":1,"mt_status":1,"mt_weather_pop":"0%","mt_weather_tmn":26,"mt_weather_tmx":28,"mt_weather_sky":1,"mt_weather_date":"2026-05-30T12:32:46","mlt_lat":37.5666805,"mlt_long":126.9784147,"mlt_speed":null,"mlt_battery":null,"mlt_gps_time":null,"id":"1948","name":"대수","photo":null,"isSelected":false}]`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestGroupMemberGpsJSON은 위치로그 있는 멤버(gps_time 공백포맷, battery int)를 검증한다.
func TestGroupMemberGpsJSON(t *testing.T) {
	svc := NewGroupMember(&fakeGroupMemberRepo{rows: []model.GroupMemberRow{{
		SgdtIdx: 1, MtIdx: 100, SgdtOwnerChk: pStr("N"), SgdtLeaderChk: pStr("N"),
		MtName: pStr("홍"), MtStatus: pInt(1),
		MltLat: pFloat(37.47679248487769), MltLong: pFloat(127.10786576865341),
		MltBattery: pInt(100),
		MltGpsTime: pTimePtr(time.Date(2026, 5, 30, 22, 34, 6, 0, time.Local)),
	}}})
	res, _ := svc.GroupMembers(1)
	it := res[0]
	if it.MltGpsTime == nil || *it.MltGpsTime != "2026-05-30 22:34:06" { // str(datetime) 공백
		t.Errorf("mlt_gps_time 공백포맷 기대: %v", it.MltGpsTime)
	}
	if it.MltBattery == nil || *it.MltBattery != 100 {
		t.Errorf("mlt_battery=100 기대: %v", it.MltBattery)
	}
	if it.MltLat == nil || *it.MltLat != 37.47679248487769 {
		t.Errorf("mlt_lat float 기대: %v", it.MltLat)
	}
}

// TestIntPtrOrNil은 int(x) if x else None(0/nil→nil) 폴백을 검증한다.
func TestIntPtrOrNil(t *testing.T) {
	zero := 0
	if intPtrOrNil(&zero) != nil {
		t.Error("0 → nil 기대")
	}
	if intPtrOrNil(nil) != nil {
		t.Error("nil → nil 기대")
	}
	v := 100
	if got := intPtrOrNil(&v); got == nil || *got != 100 {
		t.Errorf("100 → 100 기대: %v", got)
	}
}

func TestGroupMemberEmptyAndErr(t *testing.T) {
	t.Run("빈 결과 → []", func(t *testing.T) {
		svc := NewGroupMember(&fakeGroupMemberRepo{rows: nil})
		res, _ := svc.GroupMembers(99)
		if b, _ := json.Marshal(res); string(b) != "[]" {
			t.Errorf("빈 목록 []: %s", b)
		}
	})
}
