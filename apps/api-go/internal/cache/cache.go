package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// Store는 Python `app/core/cache.py`의 캐시 헬퍼(cache_get/set/delete/delete_pattern)를
// 이식한다. client가 nil이면(REDIS_URL 미설정 등) 모든 연산은 no-op이며 조회는 항상
// miss로 동작한다 — Python에서 Redis 연결 실패 시 캐싱이 조용히 비활성화되는 것과
// 동일한 계약이다.
type Store struct {
	client *redis.Client
}

// NewStore는 Redis 클라이언트(nil 허용)를 감싸는 캐시 저장소를 만든다.
func NewStore(client *redis.Client) *Store {
	return &Store{client: client}
}

// Enabled는 캐시가 활성(Redis 연결 존재) 상태인지 반환한다.
func (s *Store) Enabled() bool {
	return s != nil && s.client != nil
}

// GetRaw는 키의 원본 JSON 바이트를 반환한다. miss/에러/비활성이면 (nil, false).
// Python cache_get은 json.loads 후 dict를 돌려주지만, Go 핸들러는 저장된 JSON을
// 그대로 응답으로 흘려보내므로(역직렬화·재직렬화 불필요) 원본 바이트를 반환한다.
// 이렇게 하면 Python이 저장한 값이든 Go가 저장한 값이든 동일 키로 상호 재사용된다.
func (s *Store) GetRaw(ctx context.Context, key string) ([]byte, bool) {
	if !s.Enabled() {
		return nil, false
	}
	b, err := s.client.Get(ctx, key).Bytes()
	if err != nil {
		// redis.Nil(미스) 및 일시적 오류 모두 조용히 miss 처리 — Python과 동일.
		return nil, false
	}
	return b, true
}

// SetRaw는 키에 JSON 바이트를 ttl과 함께 저장한다. 비활성/에러는 무시한다.
func (s *Store) SetRaw(ctx context.Context, key string, val []byte, ttl time.Duration) {
	if !s.Enabled() {
		return
	}
	_ = s.client.Set(ctx, key, val, ttl).Err()
}

// Delete는 단일 키를 삭제한다. Python cache_delete와 동등.
func (s *Store) Delete(ctx context.Context, key string) {
	if !s.Enabled() {
		return
	}
	_ = s.client.Del(ctx, key).Err()
}

// DeletePattern은 패턴 매칭 키를 모두 삭제한다. Python cache_delete_pattern과 동등
// (KEYS 사용 — 대규모에서는 SCAN이 권장되나 동작 동등성을 위해 동일 구현을 유지한다).
func (s *Store) DeletePattern(ctx context.Context, pattern string) {
	if !s.Enabled() {
		return
	}
	keys, err := s.client.Keys(ctx, pattern).Result()
	if err != nil || len(keys) == 0 {
		return
	}
	_ = s.client.Del(ctx, keys...).Err()
}

// TryLock은 Redis SET key val NX EX ttl 기반 분산락을 시도한다.
// 반환 (acquired, err):
//   - acquired=true  : 락 획득(키가 없었음). 호출자는 잡을 실행한다.
//   - acquired=false : 다른 인스턴스가 이미 보유(키 존재). 잡 skip.
//
// 계약(중요): 캐시가 비활성(Redis 미연결)이면 (true, nil)을 반환한다 — Redis 없이도 잡이 동작해야 하기
// 때문이다(Phase 3 무발송 단계 + SCHEDULER_ENABLED=false라 이중 실행 위험이 낮음). Redis 통신 자체가
// 실패하면 (false, err)로 명시적 에러를 올려 호출자가 fail-safe(skip)하도록 한다 — 락 실패를 성공으로
// 흡수하지 않는다.
func (s *Store) TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	if !s.Enabled() {
		return true, nil
	}
	ok, err := s.client.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		return false, err
	}
	return ok, nil
}
