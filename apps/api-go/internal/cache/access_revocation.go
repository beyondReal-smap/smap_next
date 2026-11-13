package cache

import (
	"context"
	"strconv"
	"time"
)

// AccessRevocation은 회원별 "이 시각 이전에 발급된 access token 무효" 기준 시각을 Redis에 보관한다.
// 키 auth:access_revoked_before:{mt_idx} = 기준 unix 초, TTL = access token 수명(그 뒤에는 구 토큰이 어차피 만료).
//
// 경계 규칙: iat >= 기준이면 유효, iat < 기준이거나 iat가 없으면 무효. 기준과 같은 초에 발급된 토큰은 유효하다
// (변경 직후 본인이 재로그인한 토큰을 살리기 위함. 같은 초 안에 변경 전 발급된 토큰이 있으면 1초 미만 창이 남는다).
// 기준이 없는 회원은 iat 없는 구 토큰도 계속 유효하다.
type AccessRevocation struct {
	store *Store
	ttl   time.Duration
	now   func() time.Time
}

func NewAccessRevocation(store *Store, ttl time.Duration) *AccessRevocation {
	return &AccessRevocation{store: store, ttl: ttl, now: time.Now}
}

func revocationKey(mtIdx int) string { return "auth:access_revoked_before:" + strconv.Itoa(mtIdx) }

// RevokeBefore는 기준 시각을 지금으로 기록한다. Redis 오류(비활성 포함)는 호출자에게 돌려준다.
func (r *AccessRevocation) RevokeBefore(ctx context.Context, mtIdx int) error {
	return r.store.SetEX(ctx, revocationKey(mtIdx), strconv.FormatInt(r.now().Unix(), 10), r.ttl)
}

// IsAccessRevoked는 auth.AccessRevocationChecker 구현이다.
func (r *AccessRevocation) IsAccessRevoked(ctx context.Context, mtIdx int, iat int64, hasIAT bool) (bool, error) {
	v, found, err := r.store.GetString(ctx, revocationKey(mtIdx))
	if err != nil {
		return false, err
	}
	if !found {
		return false, nil
	}
	base, perr := strconv.ParseInt(v, 10, 64)
	if perr != nil {
		return false, perr
	}
	return !hasIAT || iat < base, nil
}
