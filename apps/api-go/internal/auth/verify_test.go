package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifyAccessToken(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	past := time.Now().Add(-time.Hour).Unix()
	good := func(c jwt.MapClaims) string {
		return "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, c)
	}

	tests := []struct {
		name      string
		header    string
		secret    string
		wantID    int
		wantState TokenState
	}{
		{"헤더 없음", "", testSecret, 0, TokenAbsent},
		{"Bearer 아님(Basic)", "Basic abc", testSecret, 0, TokenAbsent},
		{"소문자 bearer는 없음으로 본다", "bearer abc", testSecret, 0, TokenAbsent},
		{"Bearer 뒤 빈 토큰", "Bearer ", testSecret, 0, TokenInvalid},
		{"쓰레기 토큰", "Bearer not-a-jwt", testSecret, 0, TokenInvalid},
		{"유효(mt_idx)", good(jwt.MapClaims{"mt_idx": 1186, "exp": future}), testSecret, 1186, TokenValid},
		{"유효(sub 폴백)", good(jwt.MapClaims{"sub": "42", "exp": future}), testSecret, 42, TokenValid},
		{"만료", good(jwt.MapClaims{"mt_idx": 1, "exp": past}), testSecret, 0, TokenInvalid},
		{"다른 시크릿으로 서명", "Bearer " + makeToken(t, "other-secret", jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": future}), testSecret, 0, TokenInvalid},
		{"alg none", "Bearer " + makeToken(t, "", jwt.SigningMethodNone, jwt.MapClaims{"mt_idx": 1, "exp": future}), testSecret, 0, TokenInvalid},
		{"type 클레임 있는 토큰(이메일 인증 등)", good(jwt.MapClaims{"mt_idx": 1, "type": "email_verification", "exp": future}), testSecret, 0, TokenInvalid},
		{"type이 access여도 거부", good(jwt.MapClaims{"mt_idx": 1, "type": "access", "exp": future}), testSecret, 0, TokenInvalid},
		{"회원 번호 없음", good(jwt.MapClaims{"mt_id": "x", "exp": future}), testSecret, 0, TokenInvalid},
		{"회원 번호 음수", good(jwt.MapClaims{"mt_idx": -5, "exp": future}), testSecret, 0, TokenInvalid},
		{"빈 시크릿", good(jwt.MapClaims{"mt_idx": 1, "exp": future}), "", 0, TokenInvalid},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, st := VerifyAccessToken(tt.header, tt.secret, "HS256")
			if st != tt.wantState || id != tt.wantID {
				t.Errorf("got (%d, %s), want (%d, %s)", id, st, tt.wantID, tt.wantState)
			}
		})
	}
}

func TestParseRouteMode(t *testing.T) {
	for _, ok := range []string{"off", "warn", "enforce", " WARN ", "Enforce"} {
		if _, err := ParseRouteMode(ok); err != nil {
			t.Errorf("%q 는 허용돼야 함: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "on", "enforced", "true", "warning", "0"} {
		if _, err := ParseRouteMode(bad); err == nil {
			t.Errorf("%q 는 에러여야 함(기본값으로 대체 금지)", bad)
		}
	}
}
