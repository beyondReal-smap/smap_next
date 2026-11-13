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
// deps의 ParseOptionalUserID와 다른 점은 claim뿐이다: mt_id(전화/로그인 ID, 문자열).
// 시크릿은 동일하다 — Python settings.SECRET_KEY/ALGORITHM은 JWT_SECRET_KEY/JWT_ALGORITHM의
// @property 별칭이므로 호출부는 JWTSecretKey/JWTAlgorithm을 넘긴다.
// 검증 성공 + mt_id 존재 시 (mt_id, true), 그 외(헤더 부재·형식 오류·서명/만료 실패·mt_id 누락)는
// ("", false)로 신호한다. Python: payload.get("mt_id"); None이면 credentials_exception(401).
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

// ParseChatUserID는 Python `chats.py get_current_user_id`와 동등하다.
// orders(ParseOptionalUserID)·auth-me(ParseUserMtID)와 또 다른 JWT 경로:
// SECRET_KEY/ALGORITHM(값은 JWTSecretKey와 동일) + mt_idx claim(정수, truthy 판정),
// **sub 폴백 없음**.
//
// 반환 (mtIdx, errMsg, ok). 실패 시 errMsg로 401 detail을 구분한다:
//   - 헤더 부재/"Bearer " 미접두 → "인증이 필요합니다."
//   - 그 외(빈 토큰·서명/만료 실패·mt_idx falsy) → "토큰 인증에 실패했습니다."
//
// ※Python의 세 번째 메시지 "유효하지 않은 토큰입니다."는 `if not mt_idx: raise`가
//   같은 try 블록 안이라 바로 아래 `except Exception`이 가로채 덮어쓰므로 절대 도달
//   불가(dead code). 따라서 위 2분기만 재현한다.
func ParseChatUserID(authHeader, secret, algorithm string) (int, string, bool) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return 0, "인증이 필요합니다.", false
	}
	const authFailed = "토큰 인증에 실패했습니다."
	// 빈 시크릿이면 HS256 키 위조를 차단(ParseOptionalUserID와 동일한 이중 안전장치).
	if secret == "" {
		return 0, authFailed, false
	}
	// Python: token = authorization.split(" ")[1].
	// "Bearer " 접두가 보장되므로 분리 결과 [1]은 항상 존재한다("Bearer "만 있으면 "").
	token := strings.Split(authHeader, " ")[1]

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return 0, authFailed, false
	}

	// Python: mt_idx = payload.get("mt_idx"); if not mt_idx → 인증 실패.
	// truthy 판정은 ParseOptionalUserID와 동일한 mtIdxClaim 재사용(sub 폴백만 없음).
	id, ok := mtIdxClaim(claims["mt_idx"])
	if !ok {
		return 0, authFailed, false
	}
	return id, "", true
}

// ParseWSToken은 Python `chat_ws.get_mt_idx_from_token`과 동등하다.
// WebSocket 핸드셰이크는 auth.token에서 "Bearer "를 제거한 raw 토큰을 디코드한다
// (REST의 "Bearer " 접두 검사 없음). SECRET_KEY(=JWTSecretKey) + mt_idx claim, sub 폴백 없음.
// 실패(빈 시크릿/빈 토큰/서명·만료 실패/mt_idx falsy)는 모두 (0, false)로 신호해 연결을 거부한다
// (Python connect 핸들러가 False를 반환해 거부하는 것과 동일).
func ParseWSToken(tokenStr, secret, algorithm string) (int, bool) {
	if secret == "" || tokenStr == "" {
		return 0, false
	}
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return 0, false
	}
	return mtIdxClaim(claims["mt_idx"])
}

// AccessClaims는 /refresh v1(access만 재발급) 경로가 필요로 하는 claim 묶음.
type AccessClaims struct {
	MtIdx    int     // mt_idx(truthy) 우선, 없으면 sub. 둘 다 없으면 HasMtIdx=false.
	HasMtIdx bool    // Python `mt_idx = payload.get("mt_idx") or payload.get("sub")`가 None이 아닌지.
	MtID     string  // payload.get("mt_id"); 문자열이 아니면 "".
	MtName   *string // payload.get("mt_name"); 문자열이면 그 값, 아니면 nil.
}

// DecodeAccessClaims는 Python refresh v1의 `jwt.decode(...)` + claim 추출과 동등하다.
// 서명·만료를 검증한다(golang-jwt v5 기본 exp 검증). 검증 실패면 (_, false)=JWTError 등가.
// 성공이면 (claims, true); claims.HasMtIdx로 "토큰이 유효하지 않습니다."(mt_idx 부재) 분기를 구분한다.
func DecodeAccessClaims(tokenStr, secret, algorithm string) (AccessClaims, bool) {
	var out AccessClaims
	if secret == "" || tokenStr == "" {
		return out, false
	}
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return out, false
	}
	// Python: payload.get("mt_idx") or payload.get("sub")
	if id, ok := mtIdxClaim(claims["mt_idx"]); ok {
		out.MtIdx, out.HasMtIdx = id, true
	} else if id, ok := subClaim(claims["sub"]); ok {
		out.MtIdx, out.HasMtIdx = id, true
	}
	if v, ok := claims["mt_id"].(string); ok {
		out.MtID = v
	}
	if v, ok := claims["mt_name"].(string); ok {
		mn := v
		out.MtName = &mn
	}
	return out, true
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
