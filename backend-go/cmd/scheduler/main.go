// cmd/scheduler는 backend-go asynq 주기 스케줄러 진입점(Phase 3 골격).
// 12개 작업의 cron 스케줄을 등록해 잡큐(db=1)에 task를 enqueue 한다.
// 역할은 Python `app/core/scheduler.py`(APScheduler)와 동등하다.
//
// ⚠️ 이중 실행 가드: 기본값(SCHEDULER_ENABLED=false)에서는 스케줄을 등록만 하고
// 실제 enqueue 루프(Scheduler.Start/Run)를 돌리지 않는다(dry 모드). Python 스케줄러와
// Go 스케줄러가 동시에 enqueue 하면 알림이 이중 발송되므로, 컷오버 전까지는 막아야 한다.
//
// 컷오버 순서(0초 겹침 금지):
//  1. Go worker + scheduler 배포(이때 scheduler는 기본 dry — enqueue 안 함)
//  2. Python 스케줄러 정지: backend/.env SCHEDULER_ENABLED=false → Python 재기동
//  3. Go 스케줄러 활성화: SCHEDULER_ENABLED=true → cmd/scheduler 재기동
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
	"github.com/bluemusk/smap_next_go/internal/jobs"
)

// scheduleEntry는 task type과 cron 스펙(robfig/cron 형식)의 매핑이다.
// Python app/core/scheduler.py의 trigger와 1:1 대응한다.
type scheduleEntry struct {
	taskType string
	cronSpec string
	note     string
}

// schedule은 12개 작업의 주기를 정의한다.
// asynq Scheduler는 robfig/cron v3 스펙을 쓴다. "@every Ns" 매크로로 초/분 주기를,
// "M H * * *" 5필드로 일일 cron을 표현한다(타임존은 SchedulerOpts.Location 기준).
var schedule = []scheduleEntry{
	// geofence 4종 — 30초 주기.
	{jobs.TypeGeofenceEnter, "@every 30s", "location_entry_alert_schedule"},
	{jobs.TypeGeofenceExit, "@every 30s", "location_exit_alert_schedule"},
	{jobs.TypeGeofenceMyEnter, "@every 30s", "my_location_entry_alert_schedule"},
	{jobs.TypeGeofenceMyExit, "@every 30s", "my_location_exit_alert_schedule"},

	// 1분 주기 2종.
	{jobs.TypeSchedule30Min, "@every 1m", "schedule_notification(30분 전 일정 알림)"},
	{jobs.TypeReservedPush, "@every 1m", "send_reserved_push_notifications"},

	// 20분 주기 1종.
	{jobs.TypeLocationSync, "@every 20m", "update_user_locations_every_20_minutes"},

	// 일일 cron 5종 (분 시 * * *).
	{jobs.TypeDailySilent, "0 3 * * *", "send_silent_push_to_all_users (03:00)"},
	{jobs.TypeWeatherRefresh, "30 6 * * *", "refresh_weather_data (06:30)"},
	{jobs.TypeWeatherAlert, "0 7 * * *", "send_daily_weather_notifications (07:00)"},
	{jobs.TypeDailyAppInduce, "30 19 * * *", "trigger_app_execution_at_7_30pm (19:30)"},
	{jobs.TypeDailyBattery, "0 21 * * *", "notify_low_battery_at_9pm (21:00)"},
}

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
		slog.Bool("scheduler_enabled", cfg.SchedulerEnabled),
	)

	// SCHEDULER_ENABLED=false(기본)면 등록 내용만 로깅하고 종료한다.
	// Scheduler.Start를 호출하지 않으므로 Redis에 어떤 쓰기(enqueue)도 발생하지 않는다.
	if !cfg.SchedulerEnabled {
		logger.Warn("scheduler dry mode (SCHEDULER_ENABLED=false) — registrations are logged only, no enqueue")
		for _, e := range schedule {
			logger.Info("scheduled job (dry)",
				slog.String("type", e.taskType),
				slog.String("cron", e.cronSpec),
				slog.String("note", e.note),
			)
		}
		logger.Info("scheduler exiting (dry mode)")
		return
	}

	// 활성 모드 — 잡큐 Redis(db=1)에 cron 등록 후 enqueue 루프를 돈다.
	sch := asynq.NewScheduler(jobs.RedisOpt(cfg), &asynq.SchedulerOpts{
		// Location은 다음 트랙에서 KST 등으로 확정한다. 골격은 기본(UTC).
		Logger: jobs.NewLogAdapter(logger),
	})

	for _, e := range schedule {
		task := asynq.NewTask(e.taskType, nil)
		entryID, err := sch.Register(e.cronSpec, task)
		if err != nil {
			logger.Error("scheduler register failed",
				slog.String("type", e.taskType),
				slog.String("cron", e.cronSpec),
				slog.String("err", err.Error()),
			)
			os.Exit(1)
		}
		logger.Info("scheduled job registered",
			slog.String("entry_id", entryID),
			slog.String("type", e.taskType),
			slog.String("cron", e.cronSpec),
			slog.String("note", e.note),
		)
	}

	// graceful shutdown — SIGINT/SIGTERM 수신 시 스케줄러를 멈춘다.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := sch.Start(); err != nil {
		logger.Error("scheduler start failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("scheduler started (enqueue active)")

	<-ctx.Done()
	logger.Info("shutdown signal received")
	sch.Shutdown()
	logger.Info("shutdown complete")
}
