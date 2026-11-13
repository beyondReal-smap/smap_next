package auth

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"
)

// AccessRevocationChecker는 "이 회원의 이 시각 이전 access token은 무효" 기준을 조회한다.
// 구현은 cache.AccessRevocation(Redis). 기준이 없으면 (false, nil), 조회 실패는 에러로 돌려준다.
type AccessRevocationChecker interface {
	IsAccessRevoked(ctx context.Context, mtIdx int, iat int64, hasIAT bool) (bool, error)
}

const revocationCheckTimeout = 300 * time.Millisecond

var lastRevocationWarn atomic.Int64

// AccessRevoked는 미들웨어와 핸들러가 공유하는 판정 함수다.
// 정책: Redis 조회가 실패하면 "통과 + 경고 로그"(장애 때 로그인된 전 사용자가 튕기는 것을 막는다).
// 경고는 프로세스당 10초에 한 번만 남긴다(요청마다 로그가 쏟아지는 것 방지). checker가 nil이면 판정하지 않는다.
func AccessRevoked(checker AccessRevocationChecker, logger *slog.Logger, id AccessIdentity) bool {
	if checker == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), revocationCheckTimeout)
	defer cancel()
	revoked, err := checker.IsAccessRevoked(ctx, id.MtIdx, id.IAT, id.HasIAT)
	if err != nil {
		now := time.Now().Unix()
		if last := lastRevocationWarn.Load(); now-last >= 10 && lastRevocationWarn.CompareAndSwap(last, now) {
			if logger == nil {
				logger = slog.Default()
			}
			logger.Warn("access_revocation_check_failed_allowing", slog.String("err", err.Error()))
		}
		return false
	}
	return revoked
}
