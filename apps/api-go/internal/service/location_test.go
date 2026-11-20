package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeLocationRepo struct {
	one  *model.Location
	many []model.Location
	err  error
}

func (f *fakeLocationRepo) List(skip, limit int) ([]model.Location, error)    { return f.many, f.err }
func (f *fakeLocationRepo) GetByID(id int) (*model.Location, error)           { return f.one, f.err }
func (f *fakeLocationRepo) FindByMember(mtIdx int) ([]model.Location, error)  { return f.many, f.err }
func (f *fakeLocationRepo) FindByGroupDetail(s int) ([]model.Location, error) { return f.many, f.err }
func (f *fakeLocationRepo) Create(l *model.Location) error                    { return f.err }
func (f *fakeLocationRepo) UpdateFields(id int, fields map[string]interface{}) (int64, error) {
	return 1, f.err
}
func (f *fakeLocationRepo) Delete(id int) error                  { return f.err }
func (f *fakeLocationRepo) MemberExists(mtIdx int) (bool, error) { return true, f.err }
func (f *fakeLocationRepo) FirstGroupForMember(mtIdx int) (*int, *int, error) {
	return nil, nil, f.err
}

// TestLocationResponseJSON은 /locations/{id} 실측 바이트와 동일한지 검증한다.
// 핵심: slt_lat/long은 Decimal→문자열("37.52460739277500"), 모델 미매핑 3필드는 항상 null.
func TestLocationResponseJSON(t *testing.T) {
	svc := NewLocation(&fakeLocationRepo{one: &model.Location{
		SltIdx: 1374, InsertMtIdx: pInt(2523), MtIdx: pInt(2523), SgdtIdx: pInt(2228),
		SltTitle: pStr("폴리길목"), SltAdd: pStr("서울 양천구 목동 406-30"),
		SltLat: pStr("37.52460739277500"), SltLong: pStr("126.87469742636608"),
		SltShow: pStr("Y"), SltEnterAlarm: pStr("Y"), SltEnterChk: pStr("N"),
		SltWdate: pTimePtr(time.Date(2026, 4, 6, 21, 38, 59, 0, time.Local)),
	}})
	res, _ := svc.GetLocation(1374)
	b, _ := json.Marshal(res)
	want := `{"insert_mt_idx":2523,"mt_idx":2523,"sgdt_idx":2228,"slt_title":"폴리길목","slt_add":"서울 양천구 목동 406-30","slt_lat":"37.52460739277500","slt_long":"126.87469742636608","slt_fine_location":null,"slt_location_chk":null,"slt_all_day":null,"slt_show":"Y","slt_enter_alarm":"Y","slt_enter_chk":"N","slt_idx":1374,"slt_wdate":"2026-04-06T21:38:59","slt_udate":null,"slt_ddate":null,"slt_icon":null}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

func TestLocationMyplaysAlwaysEmpty(t *testing.T) {
	// Python dict(row) 버그로 항상 [] — 입력과 무관
	svc := NewLocation(&fakeLocationRepo{many: []model.Location{{SltIdx: 1}, {SltIdx: 2}}})
	for _, got := range [][]byte{mustJSON(svc.InMyplays()), mustJSON(svc.OutMyplays())} {
		if string(got) != "[]" {
			t.Errorf("myplays는 항상 [] 기대: %s", got)
		}
	}
}

func TestLocationNotFoundAndErr(t *testing.T) {
	t.Run("없음 → (nil,nil)", func(t *testing.T) {
		svc := NewLocation(&fakeLocationRepo{one: nil})
		res, err := svc.GetLocation(99)
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})
	t.Run("빈 목록 → []", func(t *testing.T) {
		svc := NewLocation(&fakeLocationRepo{many: nil})
		res, _ := svc.MemberLocations(99)
		if string(mustJSON(res)) != "[]" {
			t.Error("빈 목록 [] 기대")
		}
	})
	t.Run("repo 에러 전파", func(t *testing.T) {
		svc := NewLocation(&fakeLocationRepo{err: errors.New("db down")})
		if _, err := svc.ListLocations(0, 100); err == nil {
			t.Error("expected error")
		}
	})
}

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
