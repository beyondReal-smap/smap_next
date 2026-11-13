package cache

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

// 이 파일의 메서드는 한도 카운터·일회용 토큰·인증 코드처럼 "실패를 흡수하면 안 되는" 용도다.
// GetRaw/SetRaw처럼 에러를 삼키지 않고 호출자에게 돌려준다. Redis가 비활성이면 ErrDisabled를 반환하며,
// 호출자는 이를 "무제한 허용"이 아니라 503으로 처리해야 한다.

// incrWithExpire는 INCR과 최초 증가 시 EXPIRE를 한 번에 실행한다(원자적).
// 키가 어떤 이유로 TTL 없이 남아 있으면(-1) 다시 만료를 건다 — 영구 차단/영구 누적 방지.
var incrWithExpire = redis.NewScript(`
local c = redis.call('INCR', KEYS[1])
if c == 1 or redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`)

func (s *Store) strict() (*redis.Client, error) {
	if !s.Enabled() {
		return nil, ErrDisabled
	}
	return s.client, nil
}

// IncrWithExpire는 키를 1 증가시키고 증가 후 값을 반환한다. 최초 증가 시 ttl 만료를 같은 Lua 안에서 설정한다.
func (s *Store) IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	c, err := s.strict()
	if err != nil {
		return 0, err
	}
	secs := int64(ttl / time.Second)
	if secs < 1 {
		secs = 1
	}
	return incrWithExpire.Run(ctx, c, []string{key}, secs).Int64()
}

// TTL은 키의 남은 수명을 반환한다. 키가 없거나 만료가 없으면 0.
func (s *Store) TTL(ctx context.Context, key string) (time.Duration, error) {
	c, err := s.strict()
	if err != nil {
		return 0, err
	}
	d, err := c.TTL(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if d < 0 {
		return 0, nil
	}
	return d, nil
}

// SetEX는 값을 ttl과 함께 저장한다(덮어쓰기). 에러를 반환한다.
func (s *Store) SetEX(ctx context.Context, key, val string, ttl time.Duration) error {
	c, err := s.strict()
	if err != nil {
		return err
	}
	return c.Set(ctx, key, val, ttl).Err()
}

// SetNXEX는 키가 없을 때만 저장한다(SET NX EX). 저장했으면 true, 이미 있으면 false.
func (s *Store) SetNXEX(ctx context.Context, key, val string, ttl time.Duration) (bool, error) {
	c, err := s.strict()
	if err != nil {
		return false, err
	}
	return c.SetNX(ctx, key, val, ttl).Result()
}

// GetString은 값을 반환한다. 키가 없으면 ("", false, nil), 통신 오류는 에러로 반환한다.
func (s *Store) GetString(ctx context.Context, key string) (string, bool, error) {
	c, err := s.strict()
	if err != nil {
		return "", false, err
	}
	v, err := c.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return v, true, nil
}

// DelKeys는 키들을 삭제하고 실제로 삭제된 개수를 반환한다.
func (s *Store) DelKeys(ctx context.Context, keys ...string) (int64, error) {
	c, err := s.strict()
	if err != nil {
		return 0, err
	}
	return c.Del(ctx, keys...).Result()
}
