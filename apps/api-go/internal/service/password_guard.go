package service

import (
	"context"
	"log/slog"
	"strconv"
	"time"
)

// PasswordAttemptGuard는 현재 비밀번호 확인(/members/verify-password) 실패 횟수를 제한한다.
// 로그인 실패 한도와 같은 설정(LOGIN_FAIL_LIMIT_PER_ACCOUNT, LOGIN_FAIL_WINDOW_SECONDS)을 쓰되
// 키는 분리한다(auth:verifypw:fail:acct:{mt_idx}) — 토큰 보유자가 비밀번호를 추측해도 로그인 카운터를
// 건드리지 못하고, 반대로 로그인 성공이 이 카운터를 지우지도 않는다.
// 기준은 요청 IP가 아니라 토큰의 회원(계정)이다.
type PasswordAttemptGuard struct {
	store  securityStore
	limit  int
	window time.Duration
	logger *slog.Logger
}

func NewPasswordAttemptGuard(store securityStore, limit int, window time.Duration, logger *slog.Logger) *PasswordAttemptGuard {
	return &PasswordAttemptGuard{store: store, limit: limit, window: window, logger: logger}
}

func (g *PasswordAttemptGuard) log() *slog.Logger {
	if g.logger != nil {
		return g.logger
	}
	return slog.Default()
}

func passwordFailKey(mtIdx int) string { return "auth:verifypw:fail:acct:" + strconv.Itoa(mtIdx) }

// Blocked는 한도 초과면 429 거부를 돌려준다. Redis 오류는 로그인과 같은 정책(허용 + 경고 로그).
func (g *PasswordAttemptGuard) Blocked(ctx context.Context, mtIdx int) *AuthRejection {
	if g == nil {
		return nil
	}
	return failLimitRejection(ctx, g.store, g.log(), passwordFailKey(mtIdx), g.limit, "비밀번호 확인")
}

// RecordFailure는 실패 1회를 기록한다(고정 창). Redis 오류는 경고 로그만 남긴다.
func (g *PasswordAttemptGuard) RecordFailure(ctx context.Context, mtIdx int) {
	if g == nil || g.store == nil {
		return
	}
	if _, err := g.store.IncrWithExpire(ctx, passwordFailKey(mtIdx), g.window); err != nil {
		g.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "incr"), slog.String("err", err.Error()))
	}
}

// Clear는 성공 시 카운터를 지운다.
func (g *PasswordAttemptGuard) Clear(ctx context.Context, mtIdx int) {
	if g == nil || g.store == nil {
		return
	}
	if _, err := g.store.DelKeys(ctx, passwordFailKey(mtIdx)); err != nil {
		g.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "del"), slog.String("err", err.Error()))
	}
}
