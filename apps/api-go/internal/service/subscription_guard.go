package service

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
)

// SubscriptionVerifyGuard는 POST /subscriptions/verify 의 호출 한도(회원별 + IP별 고정 창)다.
// verify 한 번은 Apple/Google 서버 호출과 DB 트랜잭션을 일으키므로, 로그인한 계정 하나가 스토어 API 한도·DB를 소모하지 못하게 막는다.
//
// Redis를 쓸 수 없으면 무제한 허용이 아니라 503으로 실패한다(fail-closed, G8 통일 정책 — GroupCodeGuard·SMS 한도와 같다).
// 앱은 503을 받으면 다음 실행/재시도에 다시 검증하고, 검증은 멱등이라 결제 자체는 잃지 않는다.
type SubscriptionVerifyGuard struct {
	store     securityStore
	perMember int
	perIP     int
	window    time.Duration
	logger    *slog.Logger
}

func NewSubscriptionVerifyGuard(store securityStore, perMember, perIP int, window time.Duration, logger *slog.Logger) *SubscriptionVerifyGuard {
	return &SubscriptionVerifyGuard{store: store, perMember: perMember, perIP: perIP, window: window, logger: logger}
}

func (g *SubscriptionVerifyGuard) log() *slog.Logger {
	if g.logger != nil {
		return g.logger
	}
	return slog.Default()
}

// Check는 호출 1회를 기록하고 한도를 넘었으면 거부를 돌려준다. ip가 비어 있으면 IP 기준은 건너뛴다. nil이면 통과.
func (g *SubscriptionVerifyGuard) Check(ctx context.Context, mtIdx int, ip string) *AuthRejection {
	if g == nil || g.store == nil {
		slog.Error("subscription_verify_guard_not_configured")
		return reject(503, "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.")
	}
	if mtIdx > 0 {
		if rej := g.hit(ctx, "subscription:verify:member:"+strconv.Itoa(mtIdx), g.perMember, "member"); rej != nil {
			return rej
		}
	}
	if ip != "" {
		if rej := g.hit(ctx, "subscription:verify:ip:"+ip, g.perIP, "ip"); rej != nil {
			return rej
		}
	}
	return nil
}

func (g *SubscriptionVerifyGuard) hit(ctx context.Context, key string, limit int, scope string) *AuthRejection {
	n, err := g.store.IncrWithExpire(ctx, key, g.window)
	if err != nil {
		level := slog.LevelError
		if errors.Is(err, cache.ErrDisabled) {
			level = slog.LevelWarn
		}
		g.log().Log(ctx, level, "subscription_verify_limit_store_unavailable", slog.String("scope", scope), slog.String("err", err.Error()))
		return reject(503, "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.")
	}
	if n <= int64(limit) {
		return nil
	}
	retry := int(g.window / time.Second)
	if ttl, terr := g.store.TTL(ctx, key); terr == nil && ttl > 0 {
		retry = int((ttl + time.Second - 1) / time.Second)
	}
	g.log().Warn("subscription_verify_limited", slog.String("scope", scope))
	return &AuthRejection{Status: 429, Detail: "구독 확인 요청이 너무 많아요. 잠시 후 다시 시도해주세요.", RetryAfter: retry}
}
