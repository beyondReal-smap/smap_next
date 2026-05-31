package service

import (
	"reflect"
	"testing"
)

// parseVersion이 Python _parse_version과 동등한지 검증.
func TestParseVersion(t *testing.T) {
	cases := []struct {
		in   string
		want []int
	}{
		{"3.0.8", []int{3, 0, 8}},
		{"3.1.0", []int{3, 1, 0}},
		{"", []int{0}}, // ""→[""]→0
		{"3", []int{3}},
		{"3.0.8-beta", []int{3, 0, 8}}, // "8-beta"→digits"8"→8
		{"v3", []int{3}},               // "v3"→digits"3"→3
		{"3..8", []int{3, 0, 8}},       // 빈 chunk→0
		{"abc", []int{0}},              // 숫자 없음→0
		{" 3 . 1 ", []int{3, 1}},       // 공백 트림
	}
	for _, c := range cases {
		got := parseVersion(c.in)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("parseVersion(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

// isLower가 Python 튜플 비교(<)와 동등한지 검증. 길이 불일치 케이스가 핵심.
func TestIsLower(t *testing.T) {
	cases := []struct {
		cur, min string
		want     bool
	}{
		{"3.0.8", "3.1.0", true},  // (3,0,8)<(3,1,0)
		{"3.1.0", "3.1.0", false}, // 동일
		{"3.1", "3.1.0", true},    // (3,1)<(3,1,0) — 짧은 쪽이 작음
		{"3.1.1", "3.1", false},   // (3,1,1)>(3,1)
		{"4.0.0", "3.1.0", false}, // 상위
		{"2.9.9", "3.1.0", true},
		{"", "3.1.0", true},  // (0)<(3,1,0)
		{"3.1.0", "", false}, // (3,1,0)>(0)
	}
	for _, c := range cases {
		if got := isLower(c.cur, c.min); got != c.want {
			t.Errorf("isLower(%q,%q) = %v, want %v", c.cur, c.min, got, c.want)
		}
	}
}

// VersionCheck의 platform 분기와 응답 필드 검증.
func TestVersionCheck(t *testing.T) {
	s := NewAppVersion("3.1.0", "3.2.0") // android=3.1.0, ios=3.2.0

	// iOS 분기
	r := s.VersionCheck("iOS", "3.1.5")
	if r.Platform != "ios" || r.MinSupportedVersion != "3.2.0" {
		t.Errorf("iOS 분기 실패: %+v", r)
	}
	if !r.UpdateRequired || !r.ForceUpdate { // 3.1.5 < 3.2.0
		t.Errorf("iOS update_required 기대 true: %+v", r)
	}

	// android 분기 (ios 아니면 전부 android)
	r = s.VersionCheck("ANDROID", "3.5.0")
	if r.Platform != "android" || r.MinSupportedVersion != "3.1.0" {
		t.Errorf("android 분기 실패: %+v", r)
	}
	if r.UpdateRequired { // 3.5.0 >= 3.1.0
		t.Errorf("android update_required 기대 false: %+v", r)
	}

	// 알 수 없는 플랫폼 → android 취급
	r = s.VersionCheck("windows", "1.0.0")
	if r.Platform != "windows" || r.MinSupportedVersion != "3.1.0" {
		t.Errorf("미지 플랫폼은 android 최소버전 적용해야: %+v", r)
	}
	if !r.UpdateRequired {
		t.Errorf("1.0.0 < 3.1.0 이므로 update_required true: %+v", r)
	}
}
