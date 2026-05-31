// cmd/worker는 backend-go asynq 워커 진입점(Phase 3 골격).
// 잡큐 Redis(db=1)에서 task를 소비해 internal/jobs 핸들러로 처리한다.
// 역할은 Python `app/jobs/*` 실행기와 동등하지만, 실제 잡 로직은 다음 트랙에서 채운다.
//
// graceful shutdown·slog 스타일은 cmd/api/main.go와 동일하게 맞춘다.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/db"
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

	// asynq 서버 — 잡큐 Redis(db=1) 연결. 핸들러는 internal/jobs.NewMux.
	srv := asynq.NewServer(jobs.RedisOpt(cfg), asynq.Config{
		// 동시성·큐 우선순위는 다음 트랙에서 튜닝한다. 골격은 기본값 사용.
		Logger: jobs.NewLogAdapter(logger),
	})
	mux := jobs.NewMux(jobs.NewHandlers(gdb, logger))

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

	if sqlDB, err := gdb.DB(); err == nil {
		_ = sqlDB.Close()
	}
	logger.Info("shutdown complete")
}
