// cmd/api는 backend-go HTTP 진입점.
// 역할은 Python `app_v2/main.py`(스케줄러 비활성 워커)와 동등.
// asynq worker / cron 트리거는 별도 진입점(cmd/worker, cmd/scheduler, Phase 3에서 추가).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/db"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/observability"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/server"
	"github.com/bluemusk/smap_next_go/internal/service"
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
		slog.String("addr", fmt.Sprintf("%s:%d", cfg.HTTPHost, cfg.HTTPPort)),
	)

	gdb, err := db.Open(cfg)
	if err != nil {
		logger.Error("mysql open failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("mysql connected", slog.String("host", cfg.MySQLHost), slog.String("db", cfg.MySQLDB))

	rds, err := cache.Open(cfg)
	switch {
	case errors.Is(err, cache.ErrDisabled):
		logger.Info("redis disabled (REDIS_URL not set)")
		rds = nil
	case err != nil:
		// Redis는 옵셔널이므로 실패해도 부팅은 계속. 헬스 엔드포인트가 상태를 노출.
		logger.Warn("redis open failed", slog.String("err", err.Error()))
		rds = nil
	default:
		logger.Info("redis connected")
	}

	reg := observability.NewRegistry()
	healthH := handler.NewHealth(cfg, gdb, rds, reg)

	// Phase 2 — app_version (DB·외부의존 없는 순수 버전 비교).
	appVersionSvc := service.NewAppVersion(cfg.MinAppVersionAndroid, cfg.MinAppVersionIOS)
	appVersionH := handler.NewAppVersion(appVersionSvc)

	// Phase 2 — notices (read-only GET, GORM repository 패턴).
	noticeRepo := repository.NewNotice(gdb)
	noticeSvc := service.NewNotice(noticeRepo)
	noticeH := handler.NewNotice(noticeSvc)

	// 캐시 저장소 — Redis nil 허용(미연결 시 모든 캐시 연산 no-op).
	cacheStore := cache.NewStore(rds)

	// Phase 2 — member 공유 리포지토리(weather 조회 + admin 인증 게이트).
	memberRepo := repository.NewMember(gdb)

	// Phase 2 — weather (member_t 날씨 컬럼 조회, /member는 ttl 180s 캐시).
	weatherSvc := service.NewWeather(memberRepo)
	weatherH := handler.NewWeather(weatherSvc, cfg, cacheStore)

	// Phase 2 — admin read 통계/그룹 (RequireAdmin 게이트 뒤).
	adminRepo := repository.NewAdmin(gdb)
	adminSvc := service.NewAdmin(adminRepo)
	adminH := handler.NewAdmin(adminSvc)
	adminAuth := middleware.RequireAdmin(cfg, memberRepo)

	// Phase 4 — groups read(무인증, GORM repository 패턴).
	groupRepo := repository.NewGroup(gdb)
	groupSvc := service.NewGroup(groupRepo)
	groupH := handler.NewGroup(groupSvc)

	// Phase 4 — group-details read 4종(무인증).
	groupDetailRepo := repository.NewGroupDetail(gdb)
	groupDetailSvc := service.NewGroupDetail(groupDetailRepo)
	groupDetailH := handler.NewGroupDetail(groupDetailSvc)

	// Phase 4 — members 무인증 read 6종(check 3 + 목록 + 단건 + 그룹멤버). memberRepo 공유.
	memberSvc := service.NewMember(memberRepo)
	memberH := handler.NewMember(memberSvc)

	// Phase 4 — users read 7종(auth 도메인, 무인증). memberRepo 공유.
	userSvc := service.NewUser(memberRepo)
	userH := handler.NewUser(userSvc)

	// Phase 4 — locations read 7종(무인증). slt_lat/long Decimal→문자열.
	locationRepo := repository.NewLocation(gdb)
	locationSvc := service.NewLocation(locationRepo)
	locationH := handler.NewLocation(locationSvc)

	// Phase 4 — schedules 결정적 read 3종(무인증). sst_location_lat/long Decimal→문자열.
	scheduleRepo := repository.NewSchedule(gdb)
	scheduleSvc := service.NewSchedule(scheduleRepo)
	scheduleH := handler.NewSchedule(scheduleSvc)

	// Phase 4 — push-logs(6) + push-fcms(5) read(무인증). zero date 시 500(plain).
	pushLogRepo := repository.NewPushLog(gdb)
	pushLogH := handler.NewPushLog(service.NewPushLog(pushLogRepo))
	pushFCMRepo := repository.NewPushFCM(gdb)
	pushFCMH := handler.NewPushFCM(service.NewPushFCM(pushFCMRepo))

	// Phase 4 — group-members read 1종(무인증, 3단계 쿼리: 기본정보+최신위치+fallback).
	groupMemberH := handler.NewGroupMember(service.NewGroupMember(repository.NewGroupMember(gdb)))

	// Phase 4 — logs(member_location_log) 단순 read 3종(무인증). to_dict(PyFloat).
	locationLogH := handler.NewLocationLog(service.NewLocationLog(repository.NewMemberLocationLog(gdb)))

	// Phase 4 — orders read 5종(무인증). 금액 Double→PyFloat, summary 단일 집계.
	orderH := handler.NewOrder(service.NewOrder(repository.NewOrder(gdb)), cfg)

	httpHandler := server.New(cfg, logger, server.Deps{
		Health:      healthH,
		AppVersion:  appVersionH,
		Notice:      noticeH,
		Weather:     weatherH,
		Admin:       adminH,
		AdminAuth:   adminAuth,
		Group:       groupH,
		GroupDetail: groupDetailH,
		Member:      memberH,
		User:        userH,
		Location:    locationH,
		Schedule:    scheduleH,
		PushLog:     pushLogH,
		PushFCM:     pushFCMH,
		GroupMember: groupMemberH,
		LocationLog: locationLogH,
		Order:       orderH,
	})

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.HTTPHost, cfg.HTTPPort),
		Handler:           httpHandler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// graceful shutdown — SIGTERM/SIGINT 수신 시 진행 중 요청 완료 후 종료.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("http server listening", slog.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server error", slog.String("err", err.Error()))
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("http shutdown error", slog.String("err", err.Error()))
	}

	if sqlDB, err := gdb.DB(); err == nil {
		_ = sqlDB.Close()
	}
	if rds != nil {
		_ = rds.Close()
	}
	logger.Info("shutdown complete")
}
