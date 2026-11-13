package netutil

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func req(remote string, headers map[string]string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r.RemoteAddr = remote
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	return r
}

func TestClientIP(t *testing.T) {
	const hdr = "CF-Connecting-IP"
	cases := []struct {
		name    string
		remote  string
		header  string
		headers map[string]string
		want    string
	}{
		{"신뢰 헤더 설정 + loopback 접속 → 헤더 값", "127.0.0.1:5000", hdr, map[string]string{hdr: "203.0.113.7"}, "203.0.113.7"},
		{"사설 대역 접속 → 헤더 값", "10.1.2.3:5000", hdr, map[string]string{hdr: "203.0.113.7"}, "203.0.113.7"},
		{"172.16 대역도 사설", "172.20.0.5:1", hdr, map[string]string{hdr: "198.51.100.9"}, "198.51.100.9"},
		{"IPv6 loopback", "[::1]:5000", hdr, map[string]string{hdr: "2001:db8::1"}, "2001:db8::1"},
		{"IPv6 ULA", "[fd00::2]:5000", hdr, map[string]string{hdr: "203.0.113.7"}, "203.0.113.7"},
		{"헤더 미설정 → 직접 접속 주소(헤더 무시)", "127.0.0.1:5000", "", map[string]string{hdr: "203.0.113.7"}, "127.0.0.1"},
		{"외부 직접 접속자가 헤더 위조 → 직접 접속 주소", "198.51.100.20:4444", hdr, map[string]string{hdr: "203.0.113.7"}, "198.51.100.20"},
		{"외부 직접 접속자가 XFF 위조 + XFF 설정", "198.51.100.20:4444", "X-Forwarded-For", map[string]string{"X-Forwarded-For": "1.2.3.4"}, "198.51.100.20"},
		{"신뢰 접속이지만 헤더 없음 → 직접 접속 주소", "127.0.0.1:5000", hdr, nil, "127.0.0.1"},
		{"헤더가 IP 형식이 아님 → 직접 접속 주소", "127.0.0.1:5000", hdr, map[string]string{hdr: "not-an-ip"}, "127.0.0.1"},
		{"쉼표 목록은 마지막 항목(프록시가 붙인 값)", "127.0.0.1:5000", "X-Forwarded-For", map[string]string{"X-Forwarded-For": "9.9.9.9, 203.0.113.7"}, "203.0.113.7"},
		{"IPv4-mapped 정규화", "[::ffff:127.0.0.1]:5000", hdr, map[string]string{hdr: "::ffff:203.0.113.7"}, "203.0.113.7"},
		{"RemoteAddr 해석 불가 → unknown", "garbage", hdr, map[string]string{hdr: "203.0.113.7"}, UnknownIP},
		{"공인 주소 직접 접속 + 헤더 미설정", "203.0.113.50:1", "", nil, "203.0.113.50"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClientIP(req(tc.remote, tc.headers), tc.header); got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}
