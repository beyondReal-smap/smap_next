package auth

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// 18단계 C-4: 토큰 직접 파싱 경로의 공통 무효 기준 검사(Parse*Checked).

// fakeRevocation은 cache.AccessRevocation과 같은 경계 규칙을 따른다: 기준이 없으면 유효,
// iat 없음 또는 iat < 기준이면 무효, iat >= 기준이면 유효. err가 있으면 조회 실패.
type fakeRevocation struct {
	base  map[int]int64
	err   error
	calls int
}

func (f *fakeRevocation) IsAccessRevoked(_ context.Context, mtIdx int, iat int64, hasIAT bool) (bool, error) {
	f.calls++
	if f.err != nil {
		return false, f.err
	}
	b, ok := f.base[mtIdx]
	if !ok {
		return false, nil
	}
	return !hasIAT || iat < b, nil
}

func revTok(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(time.Hour).Unix()
	}
	return makeToken(t, testSecret, jwt.SigningMethodHS256, claims)
}

func TestParseCheckedFunctionsApplyRevocationBase(t *testing.T) {
	const uid = 77
	const base = int64(2_000_000_000 - 100)
	oldTok := revTok(t, jwt.MapClaims{"mt_idx": uid, "mt_id": "u", "iat": base - 10}) // 변경 이전
	newTok := revTok(t, jwt.MapClaims{"mt_idx": uid, "mt_id": "u", "iat": base + 10}) // 변경 이후
	sameTok := revTok(t, jwt.MapClaims{"mt_idx": uid, "mt_id": "u", "iat": base})     // 같은 초(유효)
	noIAT := revTok(t, jwt.MapClaims{"mt_idx": uid, "mt_id": "u"})                    // 구 토큰(iat 없음)
	other := revTok(t, jwt.MapClaims{"mt_idx": 5, "mt_id": "o", "iat": base - 10})    // 기준 없는 다른 회원
	chk := &fakeRevocation{base: map[int]int64{uid: base}}

	type result struct {
		name string
		call func(tok string) bool // true = 인증 통과
	}
	fns := []result{
		{"ParseOptionalUserIDChecked", func(tok string) bool {
			_, ok := ParseOptionalUserIDChecked(chk, nil, "Bearer "+tok, testSecret, "HS256")
			return ok
		}},
		{"ParseChatUserIDChecked", func(tok string) bool {
			_, _, ok := ParseChatUserIDChecked(chk, nil, "Bearer "+tok, testSecret, "HS256")
			return ok
		}},
		{"ParseUserMtIDChecked", func(tok string) bool {
			_, ok := ParseUserMtIDChecked(chk, nil, "Bearer "+tok, testSecret, "HS256")
			return ok
		}},
		{"ParseWSTokenChecked", func(tok string) bool {
			_, ok := ParseWSTokenChecked(chk, nil, tok, testSecret, "HS256")
			return ok
		}},
	}
	cases := []struct {
		name string
		tok  string
		want bool
	}{
		{"iat 없는 구 토큰은 기준이 있으면 무효", noIAT, false},
		{"iat < 기준은 무효", oldTok, false},
		{"iat == 기준은 유효", sameTok, true},
		{"iat > 기준은 유효", newTok, true},
		{"기준 없는 회원은 영향 없음", other, true},
	}
	for _, f := range fns {
		for _, c := range cases {
			if got := f.call(c.tok); got != c.want {
				t.Errorf("%s / %s: got %v want %v", f.name, c.name, got, c.want)
			}
		}
	}
	// 무효 판정은 원래 Parse*의 인증 실패와 같은 반환값(0 또는 빈 값)이다.
	if uidGot, ok := ParseOptionalUserIDChecked(chk, nil, "Bearer "+oldTok, testSecret, "HS256"); ok || uidGot != 0 {
		t.Errorf("무효 시 (0,false): %d %v", uidGot, ok)
	}
	if _, msg, ok := ParseChatUserIDChecked(chk, nil, "Bearer "+oldTok, testSecret, "HS256"); ok || msg != "토큰 인증에 실패했습니다." {
		t.Errorf("채팅 무효 문구는 기존 실패 문구와 같아야 함: %q %v", msg, ok)
	}
}

func TestParseCheckedKeepsOriginalFailureBehavior(t *testing.T) {
	chk := &fakeRevocation{base: map[int]int64{}}
	if _, ok := ParseOptionalUserIDChecked(chk, nil, "", testSecret, "HS256"); ok {
		t.Error("무토큰은 그대로 실패")
	}
	if _, msg, ok := ParseChatUserIDChecked(chk, nil, "", testSecret, "HS256"); ok || msg != "인증이 필요합니다." {
		t.Errorf("채팅 무토큰 문구 유지: %q", msg)
	}
	if chk.calls != 0 {
		t.Errorf("이미 실패한 토큰은 Redis를 조회하지 않아야 함: %d", chk.calls)
	}
	// checker가 nil이면 기준을 보지 않는다(기존과 동일).
	tok := revTok(t, jwt.MapClaims{"mt_idx": 1, "mt_id": "u"})
	if uid, ok := ParseOptionalUserIDChecked(nil, nil, "Bearer "+tok, testSecret, "HS256"); !ok || uid != 1 {
		t.Error("checker nil이면 기존 동작")
	}
	if _, ok := ParseUserMtIDChecked(nil, nil, "Bearer "+tok, testSecret, "HS256"); !ok {
		t.Error("checker nil이면 기존 동작(Me)")
	}
}

func TestParseCheckedPassesWithWarningWhenRedisDown(t *testing.T) {
	lastRevocationWarn.Store(0) // 경고 스로틀 초기화
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	chk := &fakeRevocation{err: errors.New("redis down")}
	tok := revTok(t, jwt.MapClaims{"mt_idx": 9, "mt_id": "u", "iat": 1})
	if uid, ok := ParseOptionalUserIDChecked(chk, logger, "Bearer "+tok, testSecret, "HS256"); !ok || uid != 9 {
		t.Fatalf("Redis 장애 시 통과해야 함: %d %v", uid, ok)
	}
	if !strings.Contains(buf.String(), "access_revocation_check_failed_allowing") {
		t.Errorf("경고 로그가 없음: %s", buf.String())
	}
	if strings.Contains(buf.String(), tok) {
		t.Error("로그에 토큰이 들어가면 안 됨")
	}
}
