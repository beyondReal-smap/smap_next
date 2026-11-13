package auth

import "testing"

func TestParseLocationAuthMode(t *testing.T) {
	for in, want := range map[string]LocationAuthMode{
		"inherit": LocationAuthInherit, " WARN ": LocationAuthWarn, "Enforce": LocationAuthEnforce,
	} {
		if got, err := ParseLocationAuthMode(in); err != nil || got != want {
			t.Errorf("%q: %v %v", in, got, err)
		}
	}
	for _, bad := range []string{"", "off", "enforced", "on"} {
		if _, err := ParseLocationAuthMode(bad); err == nil {
			t.Errorf("%q 는 에러여야 함", bad)
		}
	}
}

func TestEffectiveRouteMode(t *testing.T) {
	cases := []struct {
		loc   LocationAuthMode
		route RouteMode
		want  RouteMode
	}{
		{LocationAuthInherit, RouteModeWarn, RouteModeWarn},
		{LocationAuthInherit, RouteModeEnforce, RouteModeEnforce},
		{LocationAuthInherit, RouteModeOff, RouteModeWarn}, // 토큰 신원 확인은 off에서도 한다
		{LocationAuthWarn, RouteModeEnforce, RouteModeWarn},
		{LocationAuthEnforce, RouteModeWarn, RouteModeEnforce},
		{LocationAuthEnforce, RouteModeOff, RouteModeEnforce},
	}
	for _, c := range cases {
		if got := c.loc.EffectiveRouteMode(c.route); got != c.want {
			t.Errorf("%s/%s: %s want %s", c.loc, c.route, got, c.want)
		}
	}
}
