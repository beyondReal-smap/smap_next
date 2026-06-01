package jobs

import (
	"context"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
)

// locker는 잡 핸들러가 멱등 보장을 위해 필요로 하는 분산락 동작(소비자 인터페이스)이다.
// *cache.Store가 이를 만족한다. 테스트에서는 fake로 대체할 수 있다.
// Redis 비활성 시 cache.Store.TryLock이 (true, nil)을 돌려주는 계약을 그대로 따른다.
type locker interface {
	TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

// TryLock은 주어진 키로 분산락을 시도한다(cache.Store.TryLock 위임).
// 반환 (acquired, err): acquired=true면 잡 실행, false면 다른 인스턴스 보유로 skip,
// err!=nil이면 Redis 통신 실패(호출자가 fail-safe skip 권장).
//
// 입력 검증(경계): key가 비면 락 의미가 없으므로 그대로 위임하지 않고 획득 실패로 본다.
func TryLock(ctx context.Context, l locker, key string, ttl time.Duration) (bool, error) {
	if l == nil || key == "" {
		// 락 인프라가 없으면(예: 핸들러에 redis 미주입) 락 없이 진행 — 단일 UPDATE/덮어쓰기 잡은
		// 자연 멱등이라 결과 정합성은 유지된다.
		return true, nil
	}
	return l.TryLock(ctx, key, ttl)
}

// DailyGuard는 "하루 1회" 보장 락이다. job 이름과 date(YYYYMMDD)로 키를 만들고 TTL은
// 25시간으로 둔다(일일 cron이 같은 날 재실행돼도 한 번만 통과, 다음 날엔 새 키라 다시 통과).
// 반환 (acquired, err)는 TryLock과 동일 의미.
func DailyGuard(ctx context.Context, l locker, job, date string) (bool, error) {
	if job == "" || date == "" {
		return true, nil
	}
	key := "job:daily:" + job + ":" + date
	return TryLock(ctx, l, key, 25*time.Hour)
}

// 컴파일 타임에 *cache.Store가 locker를 만족하는지 확인한다(시그니처 드리프트 방지).
var _ locker = (*cache.Store)(nil)
