// Package netutil은 HTTP 요청의 클라이언트 IP 판정처럼 여러 계층이 공유하는 네트워크 유틸을 담는다.
package netutil

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// UnknownIP는 직접 접속 주소를 해석할 수 없을 때 돌려주는 값이다.
// 한도 계산에서는 모든 해석 불가 요청이 한 버킷에 모이므로 더 엄격한 쪽으로 동작한다.
const UnknownIP = "unknown"

// ClientIP는 한도(rate limit) 계산에 쓰는 클라이언트 IP를 반환한다.
//
// 규칙(FastAPI email_auth._client_ip와 동일):
//   - 직접 접속 상대(r.RemoteAddr)가 loopback 또는 사설 대역(10/8, 172.16/12, 192.168/16, fc00::/7)이고
//     trustedHeader가 설정돼 있을 때만 그 헤더 값을 쓴다. 쉼표로 구분돼 있으면 마지막 항목
//     (가장 가까운 신뢰 프록시가 붙인 값)을 쓴다. 값이 유효한 IP 형식이 아니면 직접 접속 주소를 쓴다.
//   - 그 외(공인 IP에서 직접 접속, 헤더 미설정)는 항상 직접 접속 주소다. 외부에서 직접 붙은 요청이
//     헤더를 위조해도 무시된다.
//
// gin의 c.ClientIP()(X-Forwarded-For 신뢰)와 무관하게 동작하므로 gin 신뢰 프록시 설정을 바꾸지 않아도 된다.
func ClientIP(r *http.Request, trustedHeader string) string {
	peer, ok := peerAddr(r.RemoteAddr)
	if !ok {
		return UnknownIP
	}
	header := strings.TrimSpace(trustedHeader)
	if header == "" || !isTrustedProxyPeer(peer) {
		return peer.String()
	}
	value := r.Header.Get(header)
	if i := strings.LastIndex(value, ","); i >= 0 {
		value = value[i+1:]
	}
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil {
		return peer.String()
	}
	return addr.Unmap().String()
}

func peerAddr(remote string) (netip.Addr, bool) {
	host := remote
	if h, _, err := net.SplitHostPort(remote); err == nil {
		host = h
	}
	// IPv6 zone(fe80::1%en0) 제거
	if i := strings.IndexByte(host, '%'); i >= 0 {
		host = host[:i]
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

// isTrustedProxyPeer는 직접 접속 상대가 같은 호스트/사설망(터널·리버스 프록시 위치)인지 판정한다.
// netip.Addr.IsPrivate는 10/8, 172.16/12, 192.168/16, fc00::/7을 포함한다.
func isTrustedProxyPeer(a netip.Addr) bool {
	return a.IsLoopback() || a.IsPrivate()
}
