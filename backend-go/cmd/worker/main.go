// cmd/worker는 backend-go asynq 워커 진입점(Phase 3).
// 잡큐 Redis(db=1)에서 task를 소비해 internal/jobs 핸들러로 처리한다.
// 역할은 Python `app/jobs/*` 실행기와 동등하다. 이번 단계에서 location:sync /
// weather:refresh가 실로직이고, 나머지(FCM 발송 잡 등)는 다음 단계에서 채운다.
//
// graceful shutdown·slog 스타일은 cmd/api/main.go와 동일하게 맞춘다.
package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/db"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/jobs"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load("")
	if err != nil {
		logger.Error("config load failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("config loaded",
		slog.String("project", cfg.ProjectName),
		slog.String("version", cfg.Version),
		slog.String("asynq_addr", cfg.AsynqRedisAddr),
		slog.Int("asynq_db", cfg.AsynqRedisDB),
	)

	// 잡이 DB에 접근하므로 cmd/api와 동일하게 GORM 연결을 연다.
	gdb, err := db.Open(cfg)
	if err != nil {
		logger.Error("mysql open failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("mysql connected", slog.String("host", cfg.MySQLHost), slog.String("db", cfg.MySQLDB))

	// 캐시(멱등 락)용 Redis(db=0). REDIS_URL 미설정이면 cache.ErrDisabled로 비활성 →
	// NewStore(nil)이 no-op 스토어를 만들고 TryLock은 항상 true(락 없이 진행). 잡큐 Redis(db=1)와
	// 분리된 키스페이스다.
	var store *cache.Store
	redisClient, rerr := cache.Open(cfg)
	if rerr != nil {
		if !errors.Is(rerr, cache.ErrDisabled) {
			logger.Warn("redis open failed, idempotency locks disabled", slog.String("err", rerr.Error()))
		}
		store = cache.NewStore(nil)
	} else {
		store = cache.NewStore(redisClient)
		logger.Info("redis connected for idempotency locks")
	}

	// FCM 발송기 — 이번 단계엔 배선만(무발송). 자격증명 없으면 fail-soft로 available=false.
	fcmSender := fcm.New(cfg, logger)
	logger.Info("fcm sender ready", slog.Bool("available", fcmSender.Available()))

	// asynq 서버 — 잡큐 Redis(db=1) 연결. 핸들러는 internal/jobs.NewMux.
	srv := asynq.NewServer(jobs.RedisOpt(cfg), asynq.Config{
		// 동시성·큐 우선순위는 다음 트랙에서 튜닝한다. 골격은 기본값 사용.
		Logger: jobs.NewLogAdapter(logger),
	})
	mux := jobs.NewMux(jobs.NewHandlers(gdb, cfg, fcmSender, store, logger))

	// graceful shutdown — SIGINT/SIGTERM 수신 시 진행 중 잡 완료 후 종료.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := srv.Start(mux); err != nil {
		logger.Error("asynq worker start failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("asynq worker started",
		slog.String("asynq_addr", cfg.AsynqRedisAddr),
		slog.Int("asynq_db", cfg.AsynqRedisDB),
	)

	<-ctx.Done()
	logger.Info("shutdown signal received")

	// Shutdown은 진행 중 잡을 마칠 때까지 블록한 뒤 워커를 정지한다.
	srv.Shutdown()

	if redisClient != nil {
		_ = redisClient.Close()
	}
	if sqlDB, err := gdb.DB(); err == nil {
		_ = sqlDB.Close()
	}
	logger.Info("shutdown complete")
}
