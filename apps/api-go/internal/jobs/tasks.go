// Package jobs는 backend-go의 asynq 백그라운드 잡 레지스트리(Phase 3)다.
//
// task type 상수 + 12종 잡 핸들러(FCM 발송·위치 동기화·날씨 갱신 등) 실로직 + 클라이언트 래퍼를 제공한다.
// Python `app/jobs/*` + `app/core/scheduler.py`의 12개 작업과 1:1 대응한다.
package jobs

// Task type 상수 — asynq Task의 typename으로 사용한다.
// 콜론(:) 구분 네임스페이스로 도메인을 나눈다(geofence/schedule/push/location/daily/weather).
//
// Python 스케줄러(app/core/scheduler.py)의 12개 job_name과 매핑:
//
//	[30초 주기 · geofence 4종]
//	  geofence:enter        ← location_entry_alert_schedule
//	  geofence:exit         ← location_exit_alert_schedule
//	  geofence:my_enter     ← my_location_entry_alert_schedule
//	  geofence:my_exit      ← my_location_exit_alert_schedule
//	[1분 주기 · 2종]
//	  schedule:30min        ← schedule_notification (30분 전 일정 알림)
//	  push:reserved         ← send_reserved_push_notifications (예약 푸시)
//	[20분 주기 · 1종]
//	  location:sync         ← update_user_locations_every_20_minutes
//	[일일 cron · 5종]
//	  daily:silent          ← send_silent_push_to_all_users          (03:00)
//	  daily:app_induce      ← trigger_app_execution_at_7_30pm        (19:30)
//	  daily:battery         ← notify_low_battery_at_9pm              (21:00)
//	  weather:refresh       ← refresh_weather_data                  (06:30)
//	  weather:alert         ← send_daily_weather_notifications       (07:00)
const (
	// geofence 4종(30초 주기) — 지오펜스 진입/이탈 알림.
	TypeGeofenceEnter   = "geofence:enter"
	TypeGeofenceExit    = "geofence:exit"
	TypeGeofenceMyEnter = "geofence:my_enter"
	TypeGeofenceMyExit  = "geofence:my_exit"

	// 1분 주기 2종 — 일정 알림 / 예약 푸시.
	TypeSchedule30Min  = "schedule:30min"
	TypeReservedPush   = "push:reserved"

	// 20분 주기 1종 — 회원 위치 동기화.
	TypeLocationSync = "location:sync"

	// 일일 cron 5종 — silent/앱유도/배터리/날씨갱신/날씨알림.
	TypeDailySilent    = "daily:silent"
	TypeDailyAppInduce = "daily:app_induce"
	TypeDailyBattery   = "daily:battery"
	TypeWeatherRefresh = "weather:refresh"
	TypeWeatherAlert   = "weather:alert"
)

// AllTaskTypes는 핸들러 등록·스케줄러 cron 매핑의 단일 출처(single source of truth)다.
// 골격 단계에서는 순회 검증/문서화 용도로만 쓰인다.
var AllTaskTypes = []string{
	TypeGeofenceEnter,
	TypeGeofenceExit,
	TypeGeofenceMyEnter,
	TypeGeofenceMyExit,
	TypeSchedule30Min,
	TypeReservedPush,
	TypeLocationSync,
	TypeDailySilent,
	TypeDailyAppInduce,
	TypeDailyBattery,
	TypeWeatherRefresh,
	TypeWeatherAlert,
}
