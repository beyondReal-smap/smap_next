package jobs

import (
	"context"
	"log/slog"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"
)

// Handlers는 잡 핸들러가 의존하는 런타임 리소스를 묶는다.
// 골격 단계에서는 DB만 보유한다(잡이 DB 접근). 다음 트랙에서 FCM 클라이언트
// (firebase.google.com/go/v4)·서비스 레이어 등을 필드로 추가한다.
type Handlers struct {
	db  *gorm.DB
	log *slog.Logger
}

// NewHandlers는 핸들러 묶음을 생성한다. log가 nil이면 slog.Default를 쓴다.
func NewHandlers(db *gorm.DB, log *slog.Logger) *Handlers {
	if log == nil {
		log = slog.Default()
	}
	return &Handlers{db: db, log: log}
}

// NewMux는 12개 task type을 stub 핸들러에 매핑한 asynq.ServeMux를 반환한다.
// 실제 잡 로직은 다음 트랙에서 각 handleX 본문에 채운다.
func NewMux(h *Handlers) *asynq.ServeMux {
	mux := asynq.NewServeMux()

	// geofence 4종(30초 주기).
	mux.HandleFunc(TypeGeofenceEnter, h.handleGeofenceEnter)
	mux.HandleFunc(TypeGeofenceExit, h.handleGeofenceExit)
	mux.HandleFunc(TypeGeofenceMyEnter, h.handleGeofenceMyEnter)
	mux.HandleFunc(TypeGeofenceMyExit, h.handleGeofenceMyExit)

	// 1분 주기 2종.
	mux.HandleFunc(TypeSchedule30Min, h.handleSchedule30Min)
	mux.HandleFunc(TypeReservedPush, h.handleReservedPush)

	// 20분 주기 1종.
	mux.HandleFunc(TypeLocationSync, h.handleLocationSync)

	// 일일 cron 5종.
	mux.HandleFunc(TypeDailySilent, h.handleDailySilent)
	mux.HandleFunc(TypeDailyAppInduce, h.handleDailyAppInduce)
	mux.HandleFunc(TypeDailyBattery, h.handleDailyBattery)
	mux.HandleFunc(TypeWeatherRefresh, h.handleWeatherRefresh)
	mux.HandleFunc(TypeWeatherAlert, h.handleWeatherAlert)

	return mux
}

// --- stub 핸들러 ------------------------------------------------------------
// 모두 골격이다. 다음 트랙에서 Python `app/jobs/*`의 로직을 포팅한다.
// nil을 반환해야 asynq가 성공 처리하므로, 현재는 로그만 남기고 nil 반환한다.

func (h *Handlers) handleGeofenceEnter(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: location_entry_alert_schedule 포팅
}

func (h *Handlers) handleGeofenceExit(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: location_exit_alert_schedule 포팅
}

func (h *Handlers) handleGeofenceMyEnter(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: my_location_entry_alert_schedule 포팅
}

func (h *Handlers) handleGeofenceMyExit(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: my_location_exit_alert_schedule 포팅
}

func (h *Handlers) handleSchedule30Min(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: schedule_notification 포팅
}

func (h *Handlers) handleReservedPush(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: send_reserved_push_notifications 포팅
}

func (h *Handlers) handleLocationSync(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: update_user_locations_every_20_minutes 포팅
}

func (h *Handlers) handleDailySilent(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: send_silent_push_to_all_users 포팅
}

func (h *Handlers) handleDailyAppInduce(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: trigger_app_execution_at_7_30pm 포팅
}

func (h *Handlers) handleDailyBattery(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: notify_low_battery_at_9pm 포팅
}

func (h *Handlers) handleWeatherRefresh(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: refresh_weather_data 포팅
}

func (h *Handlers) handleWeatherAlert(ctx context.Context, t *asynq.Task) error {
	h.log.Info("TODO: job not implemented", slog.String("type", t.Type()))
	return nil // TODO: send_daily_weather_notifications 포팅
}
