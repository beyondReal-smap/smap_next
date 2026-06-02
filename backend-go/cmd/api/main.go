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

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/db"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/observability"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/server"
	"github.com/bluemusk/smap_next_go/internal/service"
	"github.com/bluemusk/smap_next_go/internal/ws"
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

	// Phase 5 — chat 리포지토리. chat REST/WS + groups write의 그룹채팅 동기화가 공유한다.
	chatRepo := repository.NewChat(gdb)

	// Phase 4 — groups read. 무인증 read + current-user(2종)/stats. current-user는 JWT 필수.
	// Phase 1 write(create/join 3종, JWT): GroupWriteService가 그룹채팅 동기화에 chatRepo를 사용.
	groupRepo := repository.NewGroup(gdb)
	groupSvc := service.NewGroup(groupRepo)
	groupWriteSvc := service.NewGroupWrite(groupRepo, chatRepo)
	groupH := handler.NewGroup(groupSvc, groupWriteSvc, cfg)

	// Phase 4 — group-details read 4종(무인증).
	groupDetailRepo := repository.NewGroupDetail(gdb)
	groupDetailSvc := service.NewGroupDetail(groupDetailRepo)
	groupDetailH := handler.NewGroupDetail(groupDetailSvc)

	// Phase 4 — members read. 무인증 6종 + me/consent(JWT). memberRepo 공유.
	memberSvc := service.NewMember(memberRepo)
	memberH := handler.NewMember(memberSvc, cfg)

	// Phase 4 — users read 7종(auth 도메인, 무인증) + auth/me(JWT). memberRepo 공유.
	userSvc := service.NewUser(memberRepo)
	userH := handler.NewUser(userSvc, cfg)

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
	gmRepo := repository.NewGroupMember(gdb)
	gmSvc := service.NewGroupMember(gmRepo)
	gmSvc.SetWriteRepo(gmRepo) // write(add/remove/role)용 repo 주입(동일 인스턴스)
	groupMemberH := handler.NewGroupMember(gmSvc)

	// group-schedule-manage(/schedule) — read 4종(Phase A) + 생성(Phase B).
	// FCM/회원/푸시로그 의존이 있어 fcmClient 생성 이후에 와이어링한다(아래 참조).

	// Phase 4 — logs(member_location_log) 단순 read 3종(무인증). to_dict(PyFloat).
	locationLogH := handler.NewLocationLog(service.NewLocationLog(repository.NewMemberLocationLog(gdb)))

	// Phase 4 — orders read 5종(무인증). 금액 Double→PyFloat, summary 단일 집계.
	orderH := handler.NewOrder(service.NewOrder(repository.NewOrder(gdb)), cfg)

	// auth write — Phase A(비밀번호 로그인 + 토큰 수명주기 5종). memberRepo 공유 + refresh_tokens 신규 repo.
	refreshRepo := repository.NewRefreshToken(gdb, cfg.RefreshTokenBytes, cfg.RefreshTokenExpireDays)
	authSvc := service.NewAuth(memberRepo, refreshRepo, service.AuthConfig{
		Secret:       cfg.JWTSecretKey,
		Algorithm:    cfg.JWTAlgorithm,
		AccessExpMin: cfg.AccessTokenExpireMinutes,
		BcryptCost:   cfg.PasswordBcryptCost,
		Policy: auth.PasswordPolicy{
			MinLength:      cfg.PasswordMinLength,
			RequireUpper:   cfg.PasswordRequireUpper,
			RequireLower:   cfg.PasswordRequireLower,
			RequireNumbers: cfg.PasswordRequireNumbers,
			RequireSpecial: cfg.PasswordRequireSpecial,
		},
	})
	// Phase B 소셜로그인 부가데이터(그룹·스케줄) repo 주입.
	authSvc.SetSocial(repository.NewAuthSocial(gdb))
	// Phase C SMS 인증상태(Redis sms:verified:/sms:code: interop) — reset-password-by-phone용.
	authSvc.SetVerifyStore(cache.NewSMSVerifyStore(cacheStore))

	// sms/email 발송 도메인 — Aligo SMS + Gmail/네이버웍스 이메일. forgot 발송 seam 연결.
	smsSvc := service.NewSMS(service.SMSConfig{
		UserID:   cfg.AligoUserID,
		Key:      cfg.AligoKey,
		Sender:   cfg.AligoSender,
		FixieURL: cfg.FixieURL,
	})
	emailSvc := service.NewEmail(service.EmailConfig{
		Sender:                 cfg.EmailSender,
		Password:               cfg.EmailPassword,
		NaverworksClientID:     cfg.NaverworksClientID,
		NaverworksClientSecret: cfg.NaverworksClientSecret,
		NaverworksDomain:       cfg.NaverworksDomain,
	})
	smsVerifySvc := service.NewSMSVerify(smsSvc, cache.NewSMSVerifyStore(cacheStore))
	smsH := handler.NewSMS(smsVerifySvc, smsSvc, cfg)
	// forgot-password 발송 연결(Phase C에서 미뤘던 seam).
	authSvc.SetResetSender(service.NewResetNotifier(smsSvc, emailSvc, logger))

	authH := handler.NewAuth(authSvc, cfg)

	// Phase 5 — chat REST 3종(JWT) + WS 실시간(native). chatSvc를 핸들러·WS가 공유(chatRepo 재사용).
	chatSvc := service.NewChat(chatRepo)
	chatH := handler.NewChat(chatSvc, cfg)
	// FCM(오프라인 푸시) — 자격증명 없으면 available=false(no-op). chat WS가 Sender로 사용.
	fcmClient := fcm.New(cfg, logger)
	chatHub := ws.NewHub()
	chatWS := ws.NewChatWS(chatHub, chatSvc, fcmClient, cfg, logger)

	// push 발송 Phase 1 — fcm_sendone 단건/전체발송. memberRepo·pushLogRepo·fcmClient 공유.
	fcmSendoneH := handler.NewFCMSendone(service.NewPushSend(memberRepo, pushLogRepo, fcmClient))
	// fcm-token — FCM 토큰 관리 3종(get_current_member 인증). memberRepo 공유.
	fcmTokenH := handler.NewFCMToken(service.NewFCMToken(memberRepo), cfg)
	// member-fcm-token — 회원 FCM 토큰 관리 12종. memberRepo 공유 + DEBUG test-ios-push용 fcmClient.
	memberFCMTokenH := handler.NewMemberFCMToken(service.NewMemberFCMToken(memberRepo), cfg, fcmClient)

	// group-schedule-manage 생성(Phase B) — memberRepo(editor/대상 조회)·pushLogRepo·fcmClient 공유.
	groupScheduleH := handler.NewGroupScheduleManage(
		service.NewGroupScheduleManage(repository.NewGroupScheduleManage(gdb), memberRepo, pushLogRepo, fcmClient),
	)

	httpHandler := server.New(cfg, logger, server.Deps{
		Health:         healthH,
		AppVersion:     appVersionH,
		Notice:         noticeH,
		Weather:        weatherH,
		Admin:          adminH,
		AdminAuth:      adminAuth,
		Group:          groupH,
		GroupDetail:    groupDetailH,
		Member:         memberH,
		User:           userH,
		Location:       locationH,
		Schedule:       scheduleH,
		PushLog:        pushLogH,
		PushFCM:        pushFCMH,
		GroupMember:    groupMemberH,
		GroupSchedule:  groupScheduleH,
		LocationLog:    locationLogH,
		Order:          orderH,
		SMS:            smsH,
		FCMSendone:     fcmSendoneH,
		FCMToken:       fcmTokenH,
		MemberFCMToken: memberFCMTokenH,
		Chat:           chatH,
		ChatWS:         chatWS,
		Auth:           authH,
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
