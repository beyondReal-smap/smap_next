package observability

import (
	"log/slog"
	"sync/atomic"

	"github.com/prometheus/client_golang/prometheus"
)

// EnforcementMeter는 혜택 강제가 꺼진 동안 "강제했다면 막혔을 요청" 수를 센다(service.EnforcementMeter 구현).
// 레이블은 종류(place_limit | log_retention)뿐이다. 회원 번호·좌표·날짜는 담지 않는다.
type EnforcementMeter struct {
	counter *prometheus.CounterVec
	logger  *slog.Logger
	seen    atomic.Int64
}

// NewEnforcementMeter는 카운터를 레지스트리에 등록한다. 로그는 폭주를 막으려고 처음과 이후 100건마다 한 줄만 남긴다.
func NewEnforcementMeter(reg prometheus.Registerer, logger *slog.Logger) *EnforcementMeter {
	c := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "smap_subscription_would_block_total",
		Help: "SUBSCRIPTION_ENFORCEMENT_ENABLED=false 상태에서 강제했다면 403이었을 요청 수(kind별).",
	}, []string{"kind"})
	reg.MustRegister(c)
	return &EnforcementMeter{counter: c, logger: logger}
}

// WouldBlock은 막혔을 요청 한 건을 센다.
func (m *EnforcementMeter) WouldBlock(kind string) {
	m.counter.WithLabelValues(kind).Inc()
	if n := m.seen.Add(1); n == 1 || n%100 == 0 {
		m.logger.Info("subscription_would_block", slog.String("kind", kind), slog.Int64("total", n))
	}
}
