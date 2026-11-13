package middleware

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/netutil"
)

// IPLimitOptions는 IP당 고정 창 호출 한도 미들웨어 설정이다.
type IPLimitOptions struct {
	Name          string // 카운터 키 구분자(라우트 종류). 로그에도 쓴다(값 아님).
	Store         cache.CounterStore
	Limit         int
	Window        time.Duration
	TrustedHeader string // netutil.ClientIP에 전달하는 TRUSTED_CLIENT_IP_HEADER
	Logger        *slog.Logger
	Now           func() time.Time // 저장소 장애 경고 로그의 간격 제한용. nil이면 time.Now
}

const storeDownLogInterval = time.Minute

// IPLimit은 가입 여부 확인처럼 과금은 없지만 열거(enumeration)에 쓰일 수 있는 무인증 라우트의 IP당 한도다.
// 초과하면 429 + Retry-After + {"detail": "...남은 시간..."}(이메일 인증·로그인 한도와 같은 형식).
//
// Redis를 쓸 수 없을 때는 요청을 허용하고 경고 로그를 남긴다(분당 1회로 제한). 근거: 이 라우트들은 건당 비용이
// 없고 가입 화면의 가용성이 걸려 있으며, SMS 발송(건당 과금, 503)과 달리 Redis 장애가 곧 금전 손실로 이어지지 않는다.
// 장애 자체는 시작 시 경고와 /health로 드러난다.
func IPLimit(o IPLimitOptions) gin.HandlerFunc {
	now := o.Now
	if now == nil {
		now = time.Now
	}
	logger := o.Logger
	if logger == nil {
		logger = slog.Default()
	}
	var lastWarn atomic.Int64 // unix nano
	return func(c *gin.Context) {
		ip := netutil.ClientIP(c.Request, o.TrustedHeader)
		retry, err := cache.HitFixedWindow(c.Request.Context(), o.Store, "limit:ip:"+o.Name+":"+ip, int64(o.Limit), o.Window)
		if err != nil {
			t := now().UnixNano()
			if last := lastWarn.Load(); t-last >= int64(storeDownLogInterval) && lastWarn.CompareAndSwap(last, t) {
				logger.Warn("ip_limit_store_unavailable_allowing",
					slog.String("limit", o.Name), slog.Bool("redis_disabled", errors.Is(err, cache.ErrDisabled)), slog.String("err", err.Error()))
			}
			c.Next()
			return
		}
		if retry > 0 {
			c.Header("Retry-After", strconv.Itoa(retry))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"detail": fmt.Sprintf("요청 횟수를 초과했습니다. %d초 후 다시 시도해주세요.", retry),
			})
			return
		}
		c.Next()
	}
}
