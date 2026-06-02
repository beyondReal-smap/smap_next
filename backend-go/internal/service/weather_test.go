package service

import (
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeMemberRepo struct {
	member *model.Member
	err    error
}

func (f *fakeMemberRepo) GetByID(mtIdx int) (*model.Member, error) {
	return f.member, f.err
}

// UpdateColumns는 memberGetter 인터페이스 충족용 stub(GET 테스트는 미사용).
func (f *fakeMemberRepo) UpdateColumns(mtIdx int, fields map[string]interface{}) error {
	return f.err
}

func pInt(i int) *int       { return &i }
func pStr(s string) *string { return &s }

func TestGetMember(t *testing.T) {
	t.Run("정상 - 날씨 채워진 회원", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{
			MtIdx: 5, MtName: pStr("홍길동"),
			MtWeatherSky: pInt(3), MtWeatherTmx: pInt(25), MtWeatherTmn: pInt(18),
			MtWeatherPop: pStr("40%"), MtSido: pStr("서울"), MtGu: pStr("강남구"),
		}})
		resp, found, err := svc.GetMember(5)
		if err != nil || !found {
			t.Fatalf("found=%v err=%v", found, err)
		}
		if resp.Sky != "3" || resp.Pop != "40%" || resp.Location != "서울 강남구" {
			t.Errorf("resp=%+v", resp)
		}
		if resp.TempMax == nil || *resp.TempMax != 25 || resp.TempMin == nil || *resp.TempMin != 18 {
			t.Errorf("temp_max/min mismatch: %+v", resp)
		}
	})

	t.Run("회원 없음 → not found", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: nil})
		_, found, err := svc.GetMember(99)
		if err != nil || found {
			t.Errorf("found=%v err=%v", found, err)
		}
	})

	t.Run("sky nil→default, sido/gu 없음→정보 없음, pop 없음→0, date 없음→nil", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{MtIdx: 7}})
		resp, found, _ := svc.GetMember(7)
		if !found || resp.Sky != "default" || resp.Location != "정보 없음" || resp.Pop != "0" {
			t.Errorf("resp=%+v", resp)
		}
		if resp.UpdatedAt != nil {
			t.Errorf("updated_at should be nil, got %v", *resp.UpdatedAt)
		}
		// temp_max/min은 nil 그대로(Python None)
		if resp.TempMax != nil || resp.TempMin != nil {
			t.Errorf("temp should be nil: %+v", resp)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{err: errors.New("db down")})
		_, _, err := svc.GetMember(1)
		if err == nil {
			t.Error("expected error")
		}
	})
}

func TestGetCurrent(t *testing.T) {
	t.Run("인증 사용자 + 날씨 있음 → 사용자 데이터", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{
			MtIdx: 5, MtWeatherSky: pInt(1), MtWeatherTmx: pInt(30), MtWeatherTmn: pInt(20),
			MtWeatherPop: pStr("10%"), MtSido: pStr("부산"), MtGu: pStr("해운대구"),
		}})
		resp, err := svc.GetCurrent(5, true)
		if err != nil || !resp.Success {
			t.Fatalf("err=%v success=%v", err, resp.Success)
		}
		if resp.Data.Sky != "1" || *resp.Data.TempMax != 30 || *resp.Data.TempMin != 20 ||
			resp.Data.Pop != "10%" || resp.Data.Location != "부산 해운대구" {
			t.Errorf("data=%+v", resp.Data)
		}
	})

	t.Run("tmn=0 → tmx-5 (falsy or)", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{
			MtWeatherSky: pInt(1), MtWeatherTmx: pInt(25), MtWeatherTmn: pInt(0),
		}})
		resp, _ := svc.GetCurrent(1, true)
		if *resp.Data.TempMin != 20 {
			t.Errorf("temp_min=%d want 20", *resp.Data.TempMin)
		}
	})

	t.Run("tmn nil→tmx-5, pop 없음→20, sido 없음→현재 위치", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{
			MtWeatherSky: pInt(4), MtWeatherTmx: pInt(15),
		}})
		resp, _ := svc.GetCurrent(1, true)
		if *resp.Data.TempMin != 10 || resp.Data.Pop != "20" || resp.Data.Location != "현재 위치" {
			t.Errorf("data=%+v", resp.Data)
		}
	})

	t.Run("날씨 없는 회원 → 기본 데이터", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{member: &model.Member{MtIdx: 5}})
		resp, _ := svc.GetCurrent(5, true)
		if resp.Data.Sky != "8" || *resp.Data.TempMax != 25 || *resp.Data.TempMin != 18 || resp.Data.Pop != "20" {
			t.Errorf("data=%+v", resp.Data)
		}
	})

	t.Run("비인증 → 기본 데이터(repo 미호출)", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{err: errors.New("should not be called")})
		resp, err := svc.GetCurrent(0, false)
		if err != nil || resp.Data.Sky != "8" {
			t.Errorf("err=%v data=%+v", err, resp.Data)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewWeather(&fakeMemberRepo{err: errors.New("db down")})
		_, err := svc.GetCurrent(1, true)
		if err == nil {
			t.Error("expected error")
		}
	})
}

func TestCurrentError(t *testing.T) {
	svc := NewWeather(&fakeMemberRepo{})
	resp := svc.CurrentError()
	if resp.Success || resp.Message != "날씨 정보를 가져올 수 없습니다." {
		t.Errorf("resp=%+v", resp)
	}
	if resp.Data.Sky != "default" || resp.Data.Pop != "0" || resp.Data.Location != "정보 없음" {
		t.Errorf("data=%+v", resp.Data)
	}
	if resp.Data.TempMax != nil || resp.Data.TempMin != nil {
		t.Error("temp_max/min should be nil")
	}
}
