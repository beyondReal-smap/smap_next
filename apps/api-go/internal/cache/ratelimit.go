package cache

import (
	"context"
	"math"
	"time"
)

// CounterStore는 고정 창 한도 카운터에 필요한 Redis 연산이다(구현은 *Store). 테스트에서 가짜로 바꾼다.
type CounterStore interface {
	IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error)
	TTL(ctx context.Context, key string) (time.Duration, error)
}

// HitFixedWindow는 key 카운터를 1 올리고 한도(limit)를 넘었는지 판정한다.
// 한도 이내면 (0, nil), 초과면 (남은 창 시간(초, 최소 1), nil)을 돌려준다.
// Redis 비활성/통신 오류는 숨기지 않고 에러로 돌려준다 — 호출자가 503 또는 정책에 따른 처리를 한다.
func HitFixedWindow(ctx context.Context, s CounterStore, key string, limit int64, window time.Duration) (int, error) {
	n, err := s.IncrWithExpire(ctx, key, window)
	if err != nil {
		return 0, err
	}
	if n <= limit {
		return 0, nil
	}
	ttl, err := s.TTL(ctx, key)
	if err != nil {
		return 0, err
	}
	remaining := int(math.Ceil(ttl.Seconds()))
	if remaining < 1 {
		remaining = 1
	}
	return remaining, nil
}
