package server

import (
	"net/http"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/auth"
)

// 18단계 B·C: 레거시 웹 전용 경로(find-user-by-*, 링크 재설정 3종)와 하드 삭제 DELETE /members/:id는 관리자 전용이다.
// 앱이 쓰는 인증번호 방식 경로는 공개로 남는다. Deps의 해당 핸들러가 nil이라 "관리자로 통과" = Recovery의 500(핸들러 도달).
var closedLegacyRoutes = []struct{ method, path, body string }{
	{"POST", "/auth/find-user-by-email", `{"email":"a@b.c"}`},
	{"POST", "/auth/find-user-by-phone", `{"phone":"01011112222"}`},
	{"POST", "/auth/forgot-password", `{"email":"a@b.c"}`},
	{"POST", "/auth/verify-reset-token", `{"token":"x"}`},
	{"POST", "/auth/reset-password", `{"token":"x","new_password":"y"}`},
	{"DELETE", "/members/5", ""},
}

func TestClosedLegacyRoutesAdminOnly(t *testing.T) {
	for _, mode := range []auth.RouteMode{auth.RouteModeOff, auth.RouteModeWarn, auth.RouteModeEnforce} {
		e := newEnv(t, mode)
		for _, rt := range closedLegacyRoutes {
			if w := e.do(rt.method, v1+rt.path, bearer(t, 2), rt.body); w.Code != http.StatusForbidden {
				t.Errorf("[%s] %s %s: 일반 회원 403 기대, got %d", mode, rt.method, rt.path, w.Code)
			}
			if w := e.do(rt.method, v1+rt.path, "", rt.body); w.Code != http.StatusUnauthorized {
				t.Errorf("[%s] %s %s: 무토큰 401 기대, got %d", mode, rt.method, rt.path, w.Code)
			}
			if w := e.do(rt.method, v1+rt.path, "Bearer garbage", rt.body); w.Code != http.StatusUnauthorized {
				t.Errorf("[%s] %s %s: 무효 토큰 401 기대, got %d", mode, rt.method, rt.path, w.Code)
			}
			// 관리자는 게이트를 통과해 핸들러에 도달한다(이 환경에서는 핸들러가 nil이라 Recovery 500).
			if w := e.do(rt.method, v1+rt.path, bearer(t, 1), rt.body); w.Code == http.StatusUnauthorized || w.Code == http.StatusForbidden {
				t.Errorf("[%s] %s %s: 관리자는 통과해야 함: %d", mode, rt.method, rt.path, w.Code)
			}
		}
	}
}

// 앱이 쓰는 인증번호 방식 재설정·SMS 경로는 계속 공개다(관리자 게이트 없음).
func TestCodeBasedResetRoutesStayPublic(t *testing.T) {
	e := newEnv(t, auth.RouteModeEnforce)
	for _, rt := range []struct{ method, path string }{
		{"POST", "/auth/reset-password-by-phone"},
		{"POST", "/sms/send-verification-code"},
		{"POST", "/sms/verify-code"},
	} {
		if w := e.do(rt.method, v1+rt.path, "", ""); w.Code == http.StatusUnauthorized || w.Code == http.StatusForbidden {
			t.Errorf("%s %s 는 공개여야 함: %d", rt.method, rt.path, w.Code)
		}
	}
}
