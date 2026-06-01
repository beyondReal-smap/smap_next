package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// Handlers는 잡 핸들러가 의존하는 런타임 리소스를 묶는다.
//   - db    : 잡의 DB 접근(GORM)
//   - log   : 구조적 로깅
//   - cfg   : 외부 API 키 등 설정(weather:refresh가 KMAServiceKey 사용)
//   - fcm   : FCM 발송기(이번 무발송 단계엔 배선만, 발송 잡은 다음 단계)
//   - lock  : 멱등 분산락(*cache.Store, nil 허용 — 락 없이도 동작)
//   - kma   : 기상청 클라이언트(앱 수명주기 HTTP client 1개 공유)
type Handlers struct {
	db   *gorm.DB
	log  *slog.Logger
	cfg  *config.Config
	fcm  fcm.Sender
	lock locker
	kma  *service.KMAClient

	// 데이터 접근 seam(테스트 주입용). nil이면 런타임에 h.db 기반 실 repository로 폴백한다.
	// 운영 경로(NewHandlers)에서는 항상 nil이라 동작 변화가 없다. daily_push.go가 사용한다.
	memberSrc  memberLister  // nil → repository.NewMember(h.db)
	pushLogDst pushLogWriter // nil → repository.NewPushLog(h.db)

	// daily:silent 잡 전용 seam(테스트 주입용). nil이면 실 repository 폴백. silent_push.go가 사용한다.
	silentSrc silentMemberLister // nil → repository.NewMember(h.db) (토큰 목록 2종 조회)

	// schedule:30min 잡 전용 seam(테스트 주입용). nil이면 실 repository 폴백. schedule_push.go가 사용한다.
	scheduleSrc       scheduleSource       // nil → repository.NewSchedule(h.db) (조회 + claim UPDATE)
	scheduleMemberSrc scheduleMemberSource // nil → repository.NewMember(h.db) (소유자 prefetch)
	scheduleGroupSrc  scheduleGroupSource  // nil → repository.NewGroupMember(h.db) (그룹 fan-out)

	// push:reserved 잡 전용 seam(테스트 주입용). nil이면 실 repository 폴백. reserved_push.go가 사용한다.
	reservedSrc       reservedSource       // nil → repository.NewPushLog(h.db) (조회 + claim + 결과 전이 UPDATE)
	reservedMemberSrc reservedMemberSource // nil → repository.NewMember(h.db) (발송 대상 prefetch)

	// geofence 4종 잡 전용 seam(테스트 주입용). nil이면 실 repository 폴백. geofence_push.go가 사용한다.
	geofenceScheduleSrc    geofenceScheduleSource    // nil → repository.NewSchedule(h.db)        (그룹 일정 조회 + claim)
	geofenceGroupDetailSrc geofenceGroupDetailSource // nil → repository.NewGroupDetail(h.db)     (sgdt_idx→mt_idx 배치)
	geofenceLocSrc         geofenceLocSource         // nil → repository.NewMemberLocationLog(h.db)(최신 위치 배치)
	geofenceGroupRoleSrc   geofenceGroupRoleSource   // nil → repository.NewGroupMember(h.db)      (owner/leader fan-out)
	geofenceMyLocationSrc  geofenceMyLocationSource  // nil → repository.NewLocation(h.db)         (내 장소 조회 + claim)
	geofenceMemberSrc      geofenceMemberSource      // nil → repository.NewMember(h.db)           (회원 prefetch)

	// daily:weather(weather:alert) 잡 전용 seam(테스트 주입용). nil이면 실 repository 폴백. weather_push.go가 사용한다.
	weatherMemberSrc recentMemberLister // nil → repository.NewMember(h.db) (최근 1주일 접속자 조회)
	weatherSrc       weatherSource      // nil → repository.NewMember(h.db) (좌표 근처 캐시 날씨 조회)
}

// NewHandlers는 핸들러 묶음을 생성한다. log가 nil이면 slog.Default를 쓴다.
// fcm/lock은 nil 허용(무발송/락 미사용 환경). cfg는 필수(KMA 키 등 접근).
func NewHandlers(db *gorm.DB, cfg *config.Config, fcmSender fcm.Sender, store *cache.Store, log *slog.Logger) *Handlers {
	if log == nil {
		log = slog.Default()
	}
	var lk locker
	if store != nil {
		lk = store
	}
	return &Handlers{
		db:   db,
		log:  log,
		cfg:  cfg,
		fcm:  fcmSender,
		lock: lk,
		kma:  service.NewKMAClient(cfg.KMAServiceKey, log),
	}
}

// NewMux는 12개 task type을 핸들러에 매핑한 asynq.ServeMux를 반환한다.
// 12개 잡 전부 실로직 포팅 완료(weather:alert가 마지막 누락잡이었고 이제 weather_push.go에 있다).
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

// --- 실로직 핸들러 위치 안내 -------------------------------------------------

// handleGeofenceEnter/Exit/MyEnter/MyExit 실로직은 geofence_push.go에 있다.
// handleSchedule30Min 실로직은 schedule_push.go에 있다.
// handleReservedPush 실로직은 reserved_push.go에 있다.
// handleDailySilent 실로직은 silent_push.go에 있다.
// handleDailyAppInduce / handleDailyBattery 실로직은 daily_push.go에 있다.
// handleWeatherAlert 실로직은 weather_push.go에 있다(마지막 누락잡 포팅 완료).

// --- 실로직 핸들러 -----------------------------------------------------------

// handleLocationSync는 Python `run_update_user_locations_every_20_minutes`를 이식한다.
// member_location_log_t의 회원별 최신 로그(MAX(mlt_idx))를 member_t.mt_lat/mt_long에 덮어쓴다.
// 단일 원자적 UPDATE JOIN이라 동일 입력=동일 결과로 자연 멱등이다. FCM 무관.
func (h *Handlers) handleLocationSync(ctx context.Context, t *asynq.Task) error {
	// 멱등 락(20분 주기보다 짧은 TTL). 락 미획득(다른 인스턴스 실행 중)이면 skip.
	ok, err := TryLock(ctx, h.lock, "job:location:sync", 15*time.Minute)
	if err != nil {
		// Redis 통신 실패 — 락 상태 불명. fail-safe로 skip(에러를 삼키지 않고 로그+nil로 재시도 회피).
		h.log.Warn("location:sync lock error, skipping", slog.String("err", err.Error()))
		return nil
	}
	if !ok {
		h.log.Info("location:sync skipped (lock held by another instance)")
		return nil
	}

	// Python 원본의 raw SQL 전문(바인딩 파라미터 없음). 회원별 MAX(mlt_idx)=최신 위치를 member_t에 반영.
	const sql = `UPDATE member_t m
JOIN (
    SELECT mll.mt_idx, mll.mlt_lat, mll.mlt_long
    FROM member_location_log_t mll
    INNER JOIN (
        SELECT mt_idx, MAX(mlt_idx) AS max_idx
        FROM member_location_log_t
        GROUP BY mt_idx
    ) latest ON mll.mlt_idx = latest.max_idx AND mll.mt_idx = latest.mt_idx
) loc ON m.mt_idx = loc.mt_idx
SET m.mt_lat = loc.mlt_lat, m.mt_long = loc.mlt_long
WHERE m.mt_status = 1 AND m.mt_level > 1`

	res := h.db.WithContext(ctx).Exec(sql)
	if res.Error != nil {
		// 외부(DB) 장애 — 에러를 올려 asynq가 재시도하도록 한다.
		h.log.Error("location:sync update failed", slog.String("err", res.Error.Error()))
		return res.Error
	}

	h.log.Info("location:sync completed", slog.Int64("rows_affected", res.RowsAffected))
	return nil
}

// handleWeatherRefresh는 Python `run_refresh_weather_data`를 이식한다.
// (1) 대상 회원(mt_level>1, mt_status=1, 좌표 NOT NULL) 조회 → 한반도 바운딩박스 필터 →
// 격자(nx,ny)별 그룹핑(KMA 호출 중복 제거). (2) 격자별 KMA fetch/parse → 정수 클램프 →
// member_t UPDATE(격자 회원 IN). FCM 무관. 동일 base_date/base_time 재실행 시 같은 값
// 덮어쓰기라 자연 멱등.
func (h *Handlers) handleWeatherRefresh(ctx context.Context, t *asynq.Task) error {
	if h.cfg.KMAServiceKey == "" {
		// Python과 동등: 키 없으면 발송 불가 — 로그 후 성공 종료(워커 재시도 무의미).
		h.log.Warn("weather:refresh skipped: KMA_SERVICE_KEY not set")
		return nil
	}

	// 일일 1회 멱등 가드(같은 날 재실행 차단). 락 인프라 없으면 통과.
	today := time.Now().Format("20060102")
	ok, err := DailyGuard(ctx, h.lock, "weather:refresh", today)
	if err != nil {
		h.log.Warn("weather:refresh lock error, skipping", slog.String("err", err.Error()))
		return nil
	}
	if !ok {
		h.log.Info("weather:refresh skipped (already ran today)")
		return nil
	}

	// (1) 대상 회원 조회 + 격자 그룹핑.
	type memberRow struct {
		MtIdx  int     `gorm:"column:mt_idx"`
		MtLat  float64 `gorm:"column:mt_lat"`
		MtLong float64 `gorm:"column:mt_long"`
	}
	var rows []memberRow
	q := h.db.WithContext(ctx).
		Table("member_t").
		Select("mt_idx, mt_lat, mt_long").
		Where("mt_level > 1 AND mt_status = 1 AND mt_lat IS NOT NULL AND mt_long IS NOT NULL")
	if err := q.Scan(&rows).Error; err != nil {
		h.log.Error("weather:refresh member query failed", slog.String("err", err.Error()))
		return err
	}

	// 격자별 회원 mt_idx 누적(한반도 바운딩박스 밖이면 skip).
	gridMembers := map[service.Grid][]int{}
	for _, r := range rows {
		lat, lon := r.MtLat, r.MtLong
		if lat < 33.0 || lat > 39.0 || lon < 124.0 || lon > 132.0 {
			continue
		}
		grid := service.LatLongToGrid(lat, lon)
		gridMembers[grid] = append(gridMembers[grid], r.MtIdx)
	}

	if len(gridMembers) == 0 {
		h.log.Info("weather:refresh: no eligible members")
		return nil
	}

	// (2) 격자별 KMA fetch/parse → 클램프 → UPDATE.
	targetDate := time.Now().Format("20060102")
	now := time.Now()
	var updatedGrids, failedGrids, updatedMembers int

	for grid, ids := range gridMembers {
		forecast, ferr := h.kma.FetchForecast(ctx, grid.NX, grid.NY, targetDate)
		if ferr != nil || forecast == nil {
			failedGrids++
			h.log.Warn("weather:refresh: forecast unavailable",
				slog.Int("nx", grid.NX), slog.Int("ny", grid.NY))
			continue
		}

		// 정수 클램프(Python과 동일 범위).
		updates := map[string]any{
			"mt_weather_date": now,
		}
		if forecast.Tmx != nil {
			v := clampInt(*forecast.Tmx, -128, 127)
			updates["mt_weather_tmx"] = v
		}
		if forecast.Tmn != nil {
			v := clampInt(*forecast.Tmn, -128, 127)
			updates["mt_weather_tmn"] = v
		}
		if forecast.Sky != nil {
			v := clampInt(*forecast.Sky, 0, 127)
			updates["mt_weather_sky"] = v
		}
		if forecast.Pop != nil {
			updates["mt_weather_pop"] = *forecast.Pop // 문자열 그대로(예 "60%")
		}

		res := h.db.WithContext(ctx).
			Table("member_t").
			Where("mt_idx IN ?", ids).
			Updates(updates)
		if res.Error != nil {
			failedGrids++
			h.log.Warn("weather:refresh: grid update failed",
				slog.Int("nx", grid.NX), slog.Int("ny", grid.NY),
				slog.String("err", res.Error.Error()))
			continue
		}
		updatedGrids++
		updatedMembers += len(ids)
	}

	h.log.Info("weather:refresh completed",
		slog.Int("grids_total", len(gridMembers)),
		slog.Int("grids_updated", updatedGrids),
		slog.Int("grids_failed", failedGrids),
		slog.Int("members_updated", updatedMembers))
	return nil
}

// clampInt는 v를 [lo, hi]로 클램프한다.
func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
