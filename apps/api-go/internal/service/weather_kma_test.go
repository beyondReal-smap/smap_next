package service

import (
	"testing"
	"time"
)

// timeAt은 임의의 날짜에 시:분을 박은 time.Time을 만든다(base_time 경계 테스트용).
func timeAt(h, m int) time.Time {
	return time.Date(2026, 6, 1, h, m, 0, 0, time.Local)
}

// TestLatLongToGrid는 Python latlong_to_grid와 동일 격자값을 내는지 검증한다.
// 기준값은 기상청 동네예보 표준 격자(서울 시청 37.5665,126.9780 → nx=60,ny=127).
func TestLatLongToGrid(t *testing.T) {
	cases := []struct {
		name             string
		lat, lon         float64
		wantNX, wantNY   int
	}{
		{"seoul", 37.5665, 126.9780, 60, 127},
		{"busan", 35.1796, 129.0756, 98, 76},
		{"jeju", 33.4996, 126.5312, 53, 38},
		{"incheon", 37.4563, 126.7052, 55, 124},
		{"daejeon", 36.3504, 127.3845, 67, 100},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			g := LatLongToGrid(c.lat, c.lon)
			if g.NX != c.wantNX || g.NY != c.wantNY {
				t.Errorf("LatLongToGrid(%v,%v) = (%d,%d), want (%d,%d)",
					c.lat, c.lon, g.NX, g.NY, c.wantNX, c.wantNY)
			}
		})
	}
}

// TestKMABaseDateTime은 base_time 경계 규칙(Python _get_kma_base_datetime)을 검증한다.
func TestKMABaseDateTime(t *testing.T) {
	mk := func(h, m int) string {
		_, bt := kmaBaseDateTime(timeAt(h, m))
		return bt
	}
	cases := []struct {
		h, m int
		want string
	}{
		{0, 30, "2300"},  // <215 → 전일 2300
		{2, 0, "2300"},   // 200 < 215
		{2, 30, "0200"},  // 230 < 515
		{5, 0, "0200"},   // 500 < 515
		{6, 0, "0500"},   // 600 < 815
		{9, 0, "0800"},   // 900 < 1115
		{12, 0, "1100"},  // 1200 < 1415
		{15, 0, "1400"},  // 1500 < 1715
		{18, 0, "1700"},  // 1800 < 2015
		{21, 0, "2000"},  // 2100 < 2315
		{23, 30, "2300"}, // else
	}
	for _, c := range cases {
		if got := mk(c.h, c.m); got != c.want {
			t.Errorf("baseTime at %02d:%02d = %s, want %s", c.h, c.m, got, c.want)
		}
	}
}

// TestParseKMAForecast는 정상 응답 파싱과 클램프/문자열 포맷을 검증한다.
func TestParseKMAForecast(t *testing.T) {
	raw := []byte(`{"response":{"header":{"resultCode":"00","resultMsg":"OK"},"body":{"items":{"item":[
		{"category":"TMX","fcstDate":"20260601","fcstTime":"1500","fcstValue":"27.0","nx":60,"ny":127},
		{"category":"TMN","fcstDate":"20260601","fcstTime":"0600","fcstValue":"15.0","nx":60,"ny":127},
		{"category":"SKY","fcstDate":"20260601","fcstTime":"1200","fcstValue":"3","nx":60,"ny":127},
		{"category":"POP","fcstDate":"20260601","fcstTime":"1200","fcstValue":"60","nx":60,"ny":127},
		{"category":"PCP","fcstDate":"20260601","fcstTime":"1200","fcstValue":"강수없음","nx":60,"ny":127}
	]}}}}`)
	fc, err := parseKMAForecast(raw, "20260601")
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if fc == nil {
		t.Fatal("forecast nil")
	}
	if fc.Tmx == nil || *fc.Tmx != 27 {
		t.Errorf("Tmx = %v, want 27", fc.Tmx)
	}
	if fc.Tmn == nil || *fc.Tmn != 15 {
		t.Errorf("Tmn = %v, want 15", fc.Tmn)
	}
	if fc.Sky == nil || *fc.Sky != 3 {
		t.Errorf("Sky = %v, want 3", fc.Sky)
	}
	if fc.Pop == nil || *fc.Pop != "60%" {
		t.Errorf("Pop = %v, want 60%%", fc.Pop)
	}
}

// TestParseKMAForecast_BadResultCode는 resultCode!=00이면 에러를 반환하는지 검증한다.
func TestParseKMAForecast_BadResultCode(t *testing.T) {
	raw := []byte(`{"response":{"header":{"resultCode":"03","resultMsg":"NODATA"},"body":{"items":{"item":[]}}}}`)
	if _, err := parseKMAForecast(raw, "20260601"); err == nil {
		t.Error("expected error for resultCode=03, got nil")
	}
}

// TestValidTemp는 -80~60 범위 밖 온도를 거르는지 검증한다.
func TestValidTemp(t *testing.T) {
	if _, ok := validTemp(25.4); !ok {
		t.Error("25.4 should be valid")
	}
	if _, ok := validTemp(-90); ok {
		t.Error("-90 should be invalid")
	}
	if _, ok := validTemp(70); ok {
		t.Error("70 should be invalid")
	}
}
