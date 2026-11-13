package auth

import (
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// TokenState는 VerifyAccessToken의 판정 결과다.
type TokenState int

const (
	// TokenAbsent: Authorization 헤더가 없거나 Bearer 형식이 아니다(토큰 없음).
	TokenAbsent TokenState = iota
	// TokenInvalid: Bearer 토큰은 있으나 서명·만료·claim 검증에 실패했다.
	TokenInvalid
	// TokenValid: 서명·만료·claim 모두 통과했다.
	TokenValid
)

// String은 로그/테스트용 안정적인 문자열을 반환한다.
func (s TokenState) String() string {
	switch s {
	case TokenAbsent:
		return "absent"
	case TokenInvalid:
		return "invalid"
	case TokenValid:
		return "valid"
	default:
		return "unknown"
	}
}

// VerifyAccessToken은 일반 사용자 인증 미들웨어용 access 토큰 검증이다.
// FastAPI `deps.get_current_user_id`와 같은 규칙을 따르되, "없음"과 "무효"를 구분해 돌려준다
// (warn 모드가 무토큰 호출과 무효 토큰 호출을 따로 계측하기 위함).
//
//   - 헤더가 "Bearer " 로 시작하지 않으면 TokenAbsent.
//   - 서명·만료 검증 실패, 사용자 번호(mt_idx 우선/sub 폴백) 부재·0 이하 → TokenInvalid.
//   - `type` claim이 하나라도 있으면 TokenInvalid: 이메일 인증 토큰 등 access가 아닌 토큰은
//     로그인 토큰으로 통용되면 안 된다(FastAPI `'type' in payload` 거부와 동일).
//
// 허용 알고리즘은 설정값으로 고정한다(alg confusion 방지). 빈 시크릿은 항상 TokenInvalid.
func VerifyAccessToken(authHeader, secret, algorithm string) (int, TokenState) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return 0, TokenAbsent
	}
	tokenStr := authHeader[len("Bearer "):]
	if tokenStr == "" || secret == "" {
		return 0, TokenInvalid
	}

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{algorithm}))
	if err != nil {
		return 0, TokenInvalid
	}
	if _, hasType := claims["type"]; hasType {
		return 0, TokenInvalid
	}

	if id, ok := mtIdxClaim(claims["mt_idx"]); ok && id > 0 {
		return id, TokenValid
	}
	if id, ok := subClaim(claims["sub"]); ok && id > 0 {
		return id, TokenValid
	}
	return 0, TokenInvalid
}
