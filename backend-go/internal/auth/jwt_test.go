package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-key-for-unit-tests"

func makeToken(t *testing.T, secret string, method jwt.SigningMethod, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(method, claims)
	var key interface{} = []byte(secret)
	if method == jwt.SigningMethodNone {
		key = jwt.UnsafeAllowNoneSignatureType
	}
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func TestParseOptionalUserID(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	past := time.Now().Add(-time.Hour).Unix()

	tests := []struct {
		name   string
		header string
		wantID int
		wantOK bool
	}{
		{
			name:   "유효한 mt_idx",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1186, "exp": future}),
			wantID: 1186, wantOK: true,
		},
		{
			name:   "숫자 sub는 거부 (python-jose verify_sub: sub는 문자열만)",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"sub": 42, "exp": future}),
			wantID: 0, wantOK: false,
		},
		{
			name:   "mt_idx가 sub보다 우선",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 100, "sub": "200", "exp": future}),
			wantID: 100, wantOK: true,
		},
		{
			name:   "mt_idx=0(falsy)이면 문자열 sub로 폴백",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 0, "sub": "55", "exp": future}),
			wantID: 55, wantOK: true,
		},
		{
			name:   "문자열 sub 파싱",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"sub": "777", "exp": future}),
			wantID: 777, wantOK: true,
		},
		{
			name:   "문자열 mt_idx \"0\"은 truthy → 0 사용 (Python or 의미)",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": "0", "sub": "55", "exp": future}),
			wantID: 0, wantOK: true,
		},
		{name: "헤더 없음", header: "", wantID: 0, wantOK: false},
		{
			name:   "Bearer 접두사 없음",
			header: makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantID: 0, wantOK: false,
		},
		{name: "Bearer 뒤 빈 토큰", header: "Bearer ", wantID: 0, wantOK: false},
		{
			name:   "잘못된 서명 시크릿",
			header: "Bearer " + makeToken(t, "wrong-secret", jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantID: 0, wantOK: false,
		},
		{
			name:   "만료된 토큰",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": past}),
			wantID: 0, wantOK: false,
		},
		{
			name:   "alg=none confusion 차단",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodNone, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantID: 0, wantOK: false,
		},
		{
			name:   "claim 없음 (mt_idx/sub 모두 부재)",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"exp": future}),
			wantID: 0, wantOK: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotID, gotOK := ParseOptionalUserID(tc.header, testSecret, "HS256")
			if gotID != tc.wantID || gotOK != tc.wantOK {
				t.Errorf("ParseOptionalUserID() = (%d, %v), want (%d, %v)", gotID, gotOK, tc.wantID, tc.wantOK)
			}
		})
	}
}

// TestParseOptionalUserID_EmptySecret은 빈 시크릿에서 유효해 보이는 토큰도
// 거부되는지 검증한다(빈 키 []byte("")로 서명된 위조 토큰 차단).
func TestParseOptionalUserID_EmptySecret(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	// 빈 시크릿으로 서명한(위조) 토큰
	forged := "Bearer " + makeToken(t, "", jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 9, "exp": future})
	if id, ok := ParseOptionalUserID(forged, "", "HS256"); ok || id != 0 {
		t.Errorf("빈 시크릿에서 토큰이 수용됨: id=%d ok=%v (거부되어야 함)", id, ok)
	}
}

// TestParseUserMtID는 auth/me(read_users_me)의 mt_id 클레임 디코드 경로를 검증한다.
// SECRET_KEY/ALGORITHM 기반, claim=mt_id(문자열). mt_idx/sub와는 무관.
func TestParseUserMtID(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	past := time.Now().Add(-time.Hour).Unix()

	tests := []struct {
		name     string
		header   string
		secret   string
		wantMtID string
		wantOK   bool
	}{
		{
			name:     "유효한 mt_id 문자열",
			header:   "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_id": "01012345678", "exp": future}),
			secret:   testSecret, wantMtID: "01012345678", wantOK: true,
		},
		{
			name:     "mt_id 누락 → 거부",
			header:   "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"sub": "1186", "exp": future}),
			secret:   testSecret, wantMtID: "", wantOK: false,
		},
		{
			name:     "mt_id 빈 문자열 → 거부(전체 회원 조회 방지)",
			header:   "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_id": "", "exp": future}),
			secret:   testSecret, wantMtID: "", wantOK: false,
		},
		{
			name:     "숫자 mt_id → 거부(문자열만 허용)",
			header:   "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_id": 1186, "exp": future}),
			secret:   testSecret, wantMtID: "", wantOK: false,
		},
		{
			name:     "만료 토큰 → 거부",
			header:   "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_id": "x", "exp": past}),
			secret:   testSecret, wantMtID: "", wantOK: false,
		},
		{
			name:     "잘못된 시크릿 → 거부",
			header:   "Bearer " + makeToken(t, "wrong", jwt.SigningMethodHS256, jwt.MapClaims{"mt_id": "x", "exp": future}),
			secret:   testSecret, wantMtID: "", wantOK: false,
		},
		{name: "헤더 없음", header: "", secret: testSecret, wantMtID: "", wantOK: false},
		{name: "Bearer 뒤 빈 토큰", header: "Bearer ", secret: testSecret, wantMtID: "", wantOK: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotID, gotOK := ParseUserMtID(tc.header, tc.secret, "HS256")
			if gotID != tc.wantMtID || gotOK != tc.wantOK {
				t.Errorf("ParseUserMtID() = (%q, %v), want (%q, %v)", gotID, gotOK, tc.wantMtID, tc.wantOK)
			}
		})
	}
}
