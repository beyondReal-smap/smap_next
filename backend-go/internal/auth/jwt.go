// Package auth는 JWT 토큰 검증을 담당한다.
// Python `app/api/deps.py`의 인증 의존성과 토큰 호환을 100% 유지한다
// (HS256 + JWT_SECRET_KEY 공유, claim mt_idx 우선 / sub 폴백).
//
// 본 패키지는 토큰 "검증"만 담당하며, 발급/로그인/refresh 회전은 Phase 4 범위다.
package auth

import (
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// ParseOptionalUserID는 Python `get_current_user_id`와 동등하다.
// "Bearer <token>" 헤더에서 HS256 JWT를 검증하고 사용자 ID(mt_idx 우선, 없으면 sub)를
// 반환한다. 헤더 부재·형식 오류·서명/만료 실패는 모두 (0, false)로 흡수한다(선택적 인증).
func ParseOptionalUserID(authHeader, secret, algorithm string) (int, bool) {
	// 빈 시크릿이면 즉시 거부. config가 required로 막지만, 이중 안전장치로
	// HS256 키 []byte("")에 의한 토큰 위조 가능성을 차단한다.
	if secret == "" {
		return 0, false
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return 0, false
	}
	// Python `authorization.split(" ", 1)[1]`은 토큰을 strip하지 않는다.
	// TrimSpace를 빼서 'Bearer  <token>'(이중 공백) 같은 malformed 헤더를
	// Python과 동일하게(선행 공백 → 디코드 실패) 거부한다.
	tokenStr := authHeader[len("Bearer "):]
	if tokenStr == "" {
		return 0, false
	}

	claims := jwt.MapClaims{}
	// 허용 알고리즘을 설정값(HS256)으로 고정해 alg confusion(none/RS256 등) 공격을 차단한다.
	// golang-jwt v5는 exp(만료) 검증을 기본 수행한다.
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return 0, false
	}

	// Python: payload.get("mt_idx") or payload.get("sub")
	// mt_idx가 truthy면 사용, 아니면 sub로 폴백.
	if id, ok := mtIdxClaim(claims["mt_idx"]); ok {
		return id, true
	}
	if id, ok := subClaim(claims["sub"]); ok {
		return id, true
	}
	return 0, false
}

// ParseUserMtID는 Python `read_users_me`(auth/me)의 토큰 디코드와 동등하다.
// deps의 ParseOptionalUserID와 달리 (1) secret/algorithm이 SECRET_KEY/ALGORITHM이고
// (2) claim이 mt_id(전화/로그인 ID, 문자열)다. 검증 성공 + mt_id 존재 시 (mt_id, true),
// 그 외(헤더 부재·형식 오류·서명/만료 실패·mt_id 누락)는 ("", false)로 신호한다.
// Python: payload.get("mt_id"); None이면 credentials_exception(401).
func ParseUserMtID(authHeader, secret, algorithm string) (string, bool) {
	if secret == "" {
		return "", false
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", false
	}
	tokenStr := authHeader[len("Bearer "):]
	if tokenStr == "" {
		return "", false
	}

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return "", false
	}

	// Python: mt_id: str = payload.get("mt_id"); if mt_id is None → 401.
	// 문자열이 아니거나 빈 문자열이면 후속 get_user_by_phone에서 매칭 실패하므로
	// Python None 처리와 동일하게 거부한다(빈 mt_id로 전체 회원 조회 방지).
	raw, ok := claims["mt_id"]
	if !ok || raw == nil {
		return "", false
	}
	s, ok := raw.(string)
	if !ok || s == "" {
		return "", false
	}
	return s, true
}

// mtIdxClaim은 Python truthiness(`payload.get("mt_idx") or ...`)를 따른다.
// 숫자 0은 falsy(→폴백), 비어있지 않은 문자열은 truthy(정수면 "0"도 사용).
func mtIdxClaim(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		if n != 0 {
			return int(n), true
		}
	case int:
		if n != 0 {
			return n, true
		}
	case int64:
		if n != 0 {
			return int(n), true
		}
	case string:
		s := strings.TrimSpace(n)
		if s == "" {
			return 0, false
		}
		// 비어있지 않은 문자열은 Python에서 truthy. 정수로 해석되면 그 값("0" 포함) 사용.
		if iv, err := strconv.Atoi(s); err == nil {
			return iv, true
		}
	}
	return 0, false
}

// subClaim은 python-jose의 verify_sub(기본 True)와 동등하다.
// sub는 문자열이 아니면 거부(JWTClaimsError). 숫자형 sub를 받지 않는다.
func subClaim(v interface{}) (int, bool) {
	s, ok := v.(string)
	if !ok {
		return 0, false
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	if iv, err := strconv.Atoi(s); err == nil && iv != 0 {
		return iv, true
	}
	return 0, false
}
