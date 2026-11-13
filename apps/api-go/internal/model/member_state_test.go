package model

import "testing"

func TestIsBlockedMember(t *testing.T) {
	i := func(v int) *int { return &v }
	s := func(v string) *string { return &v }
	cases := []struct {
		name   string
		level  *int
		status *int
		show   *string
		want   bool
	}{
		{"정상", i(2), i(1), s("Y"), false},
		{"유료 회원", i(5), i(1), s("Y"), false},
		{"관리자", i(9), i(1), s("Y"), false},
		{"휴면(3)은 차단 대상이 아님", i(3), i(1), s("Y"), false},
		{"탈퇴 level=1", i(1), i(1), s("Y"), true},
		{"정지 status=2", i(2), i(2), s("Y"), true},
		{"비노출 show=N", i(2), i(1), s("N"), true},
		{"status=0은 차단 대상이 아님(명시 값만 차단)", i(2), i(0), s("Y"), false},
		{"전부 NULL(오래된 회원)", nil, nil, nil, false},
		{"level만 NULL", nil, i(1), s("Y"), false},
		{"NULL + 탈퇴 신호 하나", nil, i(2), nil, true},
	}
	for _, c := range cases {
		if got := IsBlockedMember(c.level, c.status, c.show); got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
		m := &Member{MtLevel: c.level, MtStatus: c.status, MtShow: c.show}
		if m.IsBlocked() != c.want {
			t.Errorf("%s: Member.IsBlocked 불일치", c.name)
		}
		st := &MemberAccessState{MtLevel: c.level, MtStatus: c.status, MtShow: c.show}
		if st.IsBlocked() != c.want {
			t.Errorf("%s: MemberAccessState.IsBlocked 불일치", c.name)
		}
	}
}
