package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// CreateAccessToken은 Python `app/api/v1/endpoints/auth.py`의 create_access_token과 동등하다.
//
//	to_encode = {"mt_idx": ..., "mt_id": ..., "mt_name": ...}
//	to_encode["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
//	jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
//
// ⚠️ 토큰 문자열은 exp(utcnow 기반)·서명 때문에 매 호출 달라져 byte-동등이 불가하다.
// 컷오버 호환성의 본질은 "claim 구조(mt_idx int / mt_id / mt_name / exp) + HS256 + 동일 시크릿"
// 이며, 이 토큰을 Python python-jose가, Python 토큰을 본 패키지 Parse*가 상호 검증할 수 있다.
//
// mtName이 nil이면 Python `user.mt_name`(None)와 동일하게 claim 값으로 null을 넣는다.
func CreateAccessToken(mtIdx int, mtID string, mtName *string, secret, algorithm string, expMinutes int) (string, error) {
	claims := jwt.MapClaims{
		"mt_idx": mtIdx,
		"mt_id":  mtID,
		"iat":    time.Now().UTC().Unix(), // 비밀번호 변경 후 구 토큰 무효화 판정용(발급 시각, 초)
		"exp":    time.Now().UTC().Add(time.Duration(expMinutes) * time.Minute).Unix(),
	}
	// Python은 키를 항상 포함한다(None이면 null). mt_name nil → JSON null.
	if mtName != nil {
		claims["mt_name"] = *mtName
	} else {
		claims["mt_name"] = nil
	}

	method := jwt.GetSigningMethod(algorithm)
	if method == nil {
		method = jwt.SigningMethodHS256
	}
	token := jwt.NewWithClaims(method, claims)
	return token.SignedString([]byte(secret))
}

// CreateAccessTokenRaw는 임의 claim 맵으로 access 토큰을 발급한다(login-original의
// UserIdentity.model_dump() 같은 가변 claim 세트 지원). exp는 호출 측에서 넣지 않으며 여기서 부착한다.
func CreateAccessTokenRaw(data map[string]interface{}, secret, algorithm string, expMinutes int) (string, error) {
	claims := jwt.MapClaims{}
	for k, v := range data {
		claims[k] = v
	}
	claims["iat"] = time.Now().UTC().Unix()
	claims["exp"] = time.Now().UTC().Add(time.Duration(expMinutes) * time.Minute).Unix()

	method := jwt.GetSigningMethod(algorithm)
	if method == nil {
		method = jwt.SigningMethodHS256
	}
	token := jwt.NewWithClaims(method, claims)
	return token.SignedString([]byte(secret))
}
