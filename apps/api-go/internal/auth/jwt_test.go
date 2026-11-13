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

// TestParseChatUserID는 chats.py get_current_user_id의 인증 분기를 검증한다.
// 핵심: (1) SECRET_KEY+mt_idx claim, **sub 폴백 없음**(ParseOptionalUserID와 다름),
// (2) 401 메시지 2분기("인증이 필요합니다."/"토큰 인증에 실패했습니다."),
// (3) Python의 "유효하지 않은 토큰입니다."는 dead라 절대 반환 안 됨.
func TestParseChatUserID(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	past := time.Now().Add(-time.Hour).Unix()

	const needAuth = "인증이 필요합니다."
	const authFailed = "토큰 인증에 실패했습니다."

	tests := []struct {
		name    string
		header  string
		wantID  int
		wantMsg string
		wantOK  bool
	}{
		{
			name:   "유효한 mt_idx",
			header: "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1186, "exp": future}),
			wantID: 1186, wantMsg: "", wantOK: true,
		},
		{name: "헤더 없음 → 인증 필요", header: "", wantMsg: needAuth},
		{
			name:    "Bearer 접두사 없음 → 인증 필요",
			header:  makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantMsg: needAuth,
		},
		{name: "Bearer 뒤 빈 토큰 → 인증 실패", header: "Bearer ", wantMsg: authFailed},
		{
			name:    "잘못된 서명 → 인증 실패",
			header:  "Bearer " + makeToken(t, "wrong-secret", jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantMsg: authFailed,
		},
		{
			name:    "만료된 토큰 → 인증 실패",
			header:  "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 1, "exp": past}),
			wantMsg: authFailed,
		},
		{
			name:    "alg=none confusion 차단 → 인증 실패",
			header:  "Bearer " + makeToken(t, testSecret, jwt.SigningMethodNone, jwt.MapClaims{"mt_idx": 1, "exp": future}),
			wantMsg: authFailed,
		},
		{
			name:    "mt_idx claim 부재 → 인증 실패",
			header:  "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"exp": future}),
			wantMsg: authFailed,
		},
		{
			name:    "sub만 있고 mt_idx 없음 → 인증 실패 (sub 폴백 없음, ParseOptionalUserID와 차이)",
			header:  "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"sub": "200", "exp": future}),
			wantMsg: authFailed,
		},
		{
			name:    "mt_idx=0(falsy) → 인증 실패 (sub 있어도 폴백 안 함)",
			header:  "Bearer " + makeToken(t, testSecret, jwt.SigningMethodHS256, jwt.MapClaims{"mt_idx": 0, "sub": "55", "exp": future}),
			wantMsg: authFailed,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotID, gotMsg, gotOK := ParseChatUserID(tc.header, testSecret, "HS256")
			if gotID != tc.wantID || gotMsg != tc.wantMsg || gotOK != tc.wantOK {
				t.Errorf("ParseChatUserID() = (%d, %q, %v), want (%d, %q, %v)",
					gotID, gotMsg, gotOK, tc.wantID, tc.wantMsg, tc.wantOK)
			}
		})
	}
}
