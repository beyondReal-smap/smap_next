package handler

import "testing"

// slt_icon 입력 규칙 — null·빈 값은 "고르지 않음", 영문 소문자 키만 저장, 그 밖은 400.
func TestLocIcon(t *testing.T) {
	cases := []struct {
		name     string
		body     map[string]interface{}
		wantIcon string // "" = nil
		wantHas  bool
		wantOK   bool
	}{
		{"키 없음", map[string]interface{}{}, "", false, true},
		{"null", map[string]interface{}{"slt_icon": nil}, "", true, true},
		{"빈 문자열", map[string]interface{}{"slt_icon": ""}, "", true, true},
		{"정상", map[string]interface{}{"slt_icon": "home"}, "home", true, true},
		{"밑줄", map[string]interface{}{"slt_icon": "bus_stop"}, "bus_stop", true, true},
		{"대문자", map[string]interface{}{"slt_icon": "Home"}, "", true, false},
		{"숫자 타입", map[string]interface{}{"slt_icon": 3.0}, "", true, false},
		{"너무 김", map[string]interface{}{"slt_icon": "abcdefghijklmnopqrstu"}, "", true, false},
		{"주입 시도", map[string]interface{}{"slt_icon": "home;drop"}, "", true, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			icon, has, ok := locIcon(c.body)
			got := ""
			if icon != nil {
				got = *icon
			}
			if got != c.wantIcon || has != c.wantHas || ok != c.wantOK {
				t.Errorf("got (%q,%v,%v) want (%q,%v,%v)", got, has, ok, c.wantIcon, c.wantHas, c.wantOK)
			}
		})
	}
}
