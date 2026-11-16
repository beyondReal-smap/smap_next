package service

import "testing"

// 알림 없음으로 만든 일정(키 없음)은 0 — 'N' 이면 tinyint 칸에 1366 오류가 났다.
func TestGsmCreateAlramDefaultsToZero(t *testing.T) {
	if got := gsmCreateAlram(map[string]interface{}{}); got != 0 {
		t.Fatalf("키 없음: got %#v, want 0", got)
	}
}

func TestGsmCreateAlramKeepsValue(t *testing.T) {
	if got := gsmCreateAlram(map[string]interface{}{"sst_alram": float64(10)}); got != float64(10) {
		t.Fatalf("값 있음: got %#v, want 10", got)
	}
}
