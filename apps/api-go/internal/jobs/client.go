package jobs

import (
	"context"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/config"
)

// RedisOpt는 잡큐 전용 Redis 접속 옵션을 config에서 구성한다.
// 캐시(db=0)와 키스페이스를 분리하기 위해 잡큐는 cfg.AsynqRedisDB(기본 1)를 쓴다.
// worker·scheduler·client 진입점이 이 헬퍼를 공유해 접속 설정 중복을 막는다.
func RedisOpt(cfg *config.Config) asynq.RedisClientOpt {
	return asynq.RedisClientOpt{
		Addr: cfg.AsynqRedisAddr,
		DB:   cfg.AsynqRedisDB,
	}
}

// Client는 asynq.Client를 감싼 enqueue 래퍼(골격)다.
// 다음 트랙에서 도메인별 Enqueue 헬퍼(EnqueueGeofenceEnter 등)를 메서드로 추가한다.
type Client struct {
	inner *asynq.Client
}

// NewClient는 잡큐 Redis(db=1)에 연결하는 enqueue 클라이언트를 만든다.
func NewClient(cfg *config.Config) *Client {
	return &Client{inner: asynq.NewClient(RedisOpt(cfg))}
}

// Enqueue는 task를 잡큐에 넣는다(골격 헬퍼).
func (c *Client) Enqueue(ctx context.Context, task *asynq.Task, opts ...asynq.Option) (*asynq.TaskInfo, error) {
	return c.inner.EnqueueContext(ctx, task, opts...)
}

// Close는 내부 asynq 클라이언트의 Redis 연결을 닫는다.
func (c *Client) Close() error {
	return c.inner.Close()
}
