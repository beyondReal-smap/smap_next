package handler

import "github.com/bluemusk/smap_next_go/internal/auth"

// revocable은 토큰을 직접 파싱하는 핸들러에 "비밀번호 변경 이전 토큰 무효" 기준 조회기를 주입하는 공통 조각이다.
// 핸들러는 이를 임베드하고, 토큰 파싱을 auth.Parse*Checked(h.revocation, nil, ...)로 한다.
// 조회기가 nil이면 기준을 보지 않는다(테스트 등). Redis 장애 시 통과 + 경고 로그는 auth.AccessRevoked 정책.
type revocable struct{ revocation auth.AccessRevocationChecker }

// SetRevocation은 구 access token 무효 기준 조회기를 주입한다.
func (r *revocable) SetRevocation(c auth.AccessRevocationChecker) { r.revocation = c }
