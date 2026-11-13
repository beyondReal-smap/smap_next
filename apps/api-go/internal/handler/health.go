package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/db"
	"github.com/bluemusk/smap_next_go/internal/observability"
)

type HealthHandler struct {
	cfg     *config.Config
	gdb     *gorm.DB
	redis   *redis.Client
	metrics http.Handler
}

func NewHealth(cfg *config.Config, gdb *gorm.DB, rds *redis.Client, reg *prometheus.Registry) *HealthHandler {
	return &HealthHandler{
		cfg:     cfg,
		gdb:     gdb,
		redis:   rds,
		metrics: observability.Handler(reg),
	}
}

// Liveness는 Python `/health` 와 동일한 응답 스키마를 반환한다.
func (h *HealthHandler) Liveness(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": float64(time.Now().UnixNano()) / 1e9,
		"version":   h.cfg.Version,
		"project":   h.cfg.ProjectName,
		"runtime":   "go",
	})
}

// DBPool은 Python `/health/db-pool` 응답 스키마를 그대로 따라간다.
// 단, GORM/database/sql은 overflow를 별도로 추적하지 않으므로 0 고정.
func (h *HealthHandler) DBPool(c *gin.Context) {
	stats, err := db.Stats(h.gdb)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "error",
			"error":     err.Error(),
			"timestamp": float64(time.Now().UnixNano()) / 1e9,
		})
		return
	}
	status := "healthy"
	if stats.PoolSize > 0 {
		ratio := float64(stats.InUseConnections) / float64(stats.PoolSize)
		switch {
		case ratio > 0.9:
			status = "critical"
		case ratio > 0.8:
			status = "warning"
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"status":      status,
		"timestamp":   float64(time.Now().UnixNano()) / 1e9,
		"pool_status": stats,
		"pool_config": gin.H{
			"pool_size":    h.cfg.DBPoolSize,
			"max_overflow": h.cfg.DBMaxOverflow,
			"pool_timeout": h.cfg.DBPoolTimeout,
			"pool_recycle": h.cfg.DBPoolRecycle,
		},
		"runtime": "go",
	})
}

// Redis는 옵셔널. 비활성 상태면 200 + status=skipped.
func (h *HealthHandler) Redis(c *gin.Context) {
	if h.redis == nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "skipped",
			"reason": "REDIS_URL not configured",
		})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()
	if err := h.redis.Ping(ctx).Err(); err != nil {
		if errors.Is(err, cache.ErrDisabled) {
			c.JSON(http.StatusOK, gin.H{"status": "skipped"})
			return
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

// Metrics는 Prometheus 텍스트 포맷을 반환한다.
func (h *HealthHandler) Metrics(c *gin.Context) {
	h.metrics.ServeHTTP(c.Writer, c.Request)
}
