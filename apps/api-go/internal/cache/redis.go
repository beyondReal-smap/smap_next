package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/bluemusk/smap_next_go/internal/config"
)

// ErrDisabled는 REDIS_URL 미설정 등으로 Redis가 비활성 상태일 때 반환된다.
var ErrDisabled = errors.New("redis disabled")

// Open은 REDIS_URL이 있을 때만 클라이언트를 만들어 반환한다.
// 없으면 (nil, ErrDisabled) — 호출자는 헬스체크에서 skipped로 보고한다.
func Open(cfg *config.Config) (*redis.Client, error) {
	if cfg.RedisURL == "" {
		return nil, ErrDisabled
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return client, nil
}
