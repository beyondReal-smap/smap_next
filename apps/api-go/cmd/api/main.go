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

	// 캐시 저장소 — Redis nil 허용(미연결 시 모든 캐시 연산 no-op).
	cacheStore := cache.NewStore(rds)

	// Phase 2 — notices (read GET + admin write 5종). 캐시는 create/update/delete 시 notices:* 무효화용.
	noticeRepo := repository.NewNotice(gdb)
	noticeSvc := service.NewNotice(noticeRepo, cacheStore)
	noticeH := handler.NewNotice(noticeSvc)

	// Phase 2 — member 공유 리포지토리(weather 조회 + admin 인증 게이트).
	memberRepo := repository.NewMember(gdb)

	// Phase 2 — weather (member_t 날씨 컬럼 조회, /member는 ttl 180s 캐시).
	weatherSvc := service.NewWeather(memberRepo)
	weatherH := handler.NewWeather(weatherSvc, cfg, cacheStore)

	// Phase 2 — admin read 통계/그룹 (RequireAdmin 게이트 뒤).
	adminRepo := repository.NewAdmin(gdb)
	adminSvc := service.NewAdmin(adminRepo)
	adminH := handler.NewAdmin(adminSvc)

	// G1 — 일반 사용자 인증 미들웨어(ROUTE_AUTH_MODE off|warn|enforce). 회원 상태는 memberRepo로 조회한다.
	// 모드 값은 config.Load가 이미 검증했다(잘못된 값이면 여기까지 오지 못한다).
	routeMode, err := cfg.RouteAuthMode()
	if err != nil {
		logger.Error("route auth mode invalid", slog.String("err", err.Error()))
		os.Exit(1)
	}
	// 비밀번호 변경·재설정·탈퇴 후 구 access token 무효 기준(Redis, TTL=access 수명). 조회 실패는 통과 + 경고.
	accessRevocation := cache.NewAccessRevocation(cacheStore, time.Duration(cfg.AccessTokenExpireMinutes)*time.Minute)
	adminAuth := middleware.RequireAdminChecked(cfg, memberRepo, accessRevocation) // 관리자 게이트도 구 토큰 무효 기준 적용
	routeAuth, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Revocation:      accessRevocation,
		Mode:            routeMode,
		Secret:          cfg.JWTSecretKey,
		Algorithm:       cfg.JWTAlgorithm,
		StatusCacheTTL:  time.Duration(cfg.RouteAuthStatusCacheTTLSeconds) * time.Second,
		SummaryInterval: time.Duration(cfg.RouteAuthSummaryIntervalSeconds) * time.Second,
	}, memberRepo, logger)
	if err != nil {
		logger.Error("route auth init failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	logger.Info("route auth configured",
		slog.String("mode", string(routeMode)),
		slog.Int("status_cache_ttl_sec", cfg.RouteAuthStatusCacheTTLSeconds),
		slog.Int("summary_interval_sec", cfg.RouteAuthSummaryIntervalSeconds),
	)

	// G6 — 위치 라우트용 인증 미들웨어. 무토큰 처리만 LOCATION_AUTH_MODE로 따로 정한다(inherit이면 ROUTE_AUTH_MODE를 따름).
	// 별도 인스턴스라 계측 요약 로그에 scope=location으로 구분되어 찍힌다.
	locationMode, err := cfg.LocationAuthMode()
	if err != nil {
		logger.Error("location auth mode invalid", slog.String("err", err.Error()))
		os.Exit(1)
	}
	locationRouteMode := locationMode.EffectiveRouteMode(routeMode)
	locationAuth, err := middleware.NewRouteAuth(middleware.RouteAuthOptions{
		Revocation:      accessRevocation,
		Mode:            locationRouteMode,
		Secret:          cfg.JWTSecretKey,
		Algorithm:       cfg.JWTAlgorithm,
		StatusCacheTTL:  time.Duration(cfg.RouteAuthStatusCacheTTLSeconds) * time.Second,
		SummaryInterval: time.Duration(cfg.RouteAuthSummaryIntervalSeconds) * time.Second,
		Scope:           "location",
	}, memberRepo, logger)
	if err != nil {
		logger.Error("location auth init failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	locationGuard := handler.NewLocationGuard(
		service.NewLocationAuthz(repository.NewMembership(gdb), cfg.LocationPlaceLeaderManage),
		locationAuth, cfg.LocationWriteRequireToken)
	logger.Info("location auth configured",
		slog.String("location_auth_mode", string(locationMode)),
		slog.String("effective_unauthenticated_mode", string(locationRouteMode)),
		slog.Bool("write_require_token", cfg.LocationWriteRequireToken),
		slog.Bool("place_leader_manage", cfg.LocationPlaceLeaderManage),
	)
	if locationRouteMode != auth.RouteModeEnforce {
		logger.Warn("location routes accept requests without a token (warn): others' locations are readable without a token until LOCATION_AUTH_MODE/ROUTE_AUTH_MODE is enforce")
	}

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

	// members write 17종(register/login/비번/프로필/동의/탈퇴/CRUD/약관/파일). memberRepo 공유.
	// google-login은 auth.GoogleLogin 핸들러 재사용(동일 member_service.google_login). 비번정책=cfg.
	memberWriteSvc := service.NewMemberWrite(memberRepo, cfg.PasswordBcryptCost, auth.PasswordPolicy{
		MinLength:      cfg.PasswordMinLength,
		RequireUpper:   cfg.PasswordRequireUpper,
		RequireLower:   cfg.PasswordRequireLower,
		RequireNumbers: cfg.PasswordRequireNumbers,
		RequireSpecial: cfg.PasswordRequireSpecial,
	})
	memberWriteSvc.SetAccessRevoker(accessRevocation, logger)
	memberWriteH := handler.NewMemberWrite(memberWriteSvc, cfg)
	memberWriteH.SetRevocation(accessRevocation)
	// verify-password 실패 한도: 로그인과 같은 LOGIN_FAIL_LIMIT_PER_ACCOUNT / LOGIN_FAIL_WINDOW_SECONDS 재사용(키는 분리).
	memberWriteSvc.SetPasswordGuard(service.NewPasswordAttemptGuard(cacheStore, cfg.LoginFailLimitPerAccount,
		time.Duration(cfg.LoginFailWindowSeconds)*time.Second, logger))

	// Phase 4 — users read 7종(auth 도메인, 무인증) + auth/me(JWT). memberRepo 공유.
	userSvc := service.NewUser(memberRepo)
	userSvc.SetBcryptCost(cfg.PasswordBcryptCost) // /users/ 생성 시 비밀번호 해시(평문 저장 금지)
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
	locationLogH := handler.NewLocationLog(service.NewLocationLog(repository.NewMemberLocationLog(gdb)), cfg)

	// Phase 4 — orders read 5종(무인증). 금액 Double→PyFloat, summary 단일 집계.
	orderH := handler.NewOrder(service.NewOrder(repository.NewOrder(gdb)), cfg)

	// hwgi(한화 점검) 5종(무인증). raw SQL 3테이블 + 파일I/O(절대경로) + generate-report(항상 500).
	hwgiH := handler.NewHwgi(service.NewHwgi(gdb, cfg.PublicAPIBaseURL), cfg)

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
	// G5 소셜 로그인 공급자 토큰 검증(SOCIAL_TOKEN_VERIFICATION off|when_present|required).
	socialMode, err := cfg.SocialTokenVerification()
	if err != nil {
		logger.Error("social token verification mode invalid", slog.String("err", err.Error()))
		os.Exit(1)
	}
	providerVerifier, err := auth.NewProviderVerifier(auth.ProviderVerifierConfig{
		GoogleClientIDs: cfg.GoogleAllowedClientIDs(),
		AppleBundleIDs:  cfg.AppleAllowedBundleIDs(),
		KakaoAppID:      cfg.KakaoAllowedAppID,
	})
	if err != nil {
		logger.Error("social provider verifier init failed", slog.String("err", err.Error()))
		os.Exit(1)
	}
	authSvc.SetSocialVerification(service.SocialVerification{
		Verifier: providerVerifier, Mode: socialMode, Emails: memberRepo, Logger: logger,
	})
	logger.Info("social token verification configured",
		slog.String("mode", string(socialMode)),
		slog.Bool("google_configured", providerVerifier.Configured(auth.ProviderGoogle)),
		slog.Bool("apple_configured", providerVerifier.Configured(auth.ProviderApple)),
		slog.Bool("kakao_configured", providerVerifier.Configured(auth.ProviderKakao)),
	)
	if socialMode != auth.SocialModeOff {
		for _, p := range []auth.Provider{auth.ProviderGoogle, auth.ProviderApple, auth.ProviderKakao} {
			if !providerVerifier.Configured(p) {
				// 허용 목록이 없으면 해당 공급자의 검증은 503으로 실패한다(토큰이 있는 로그인 포함).
				logger.Warn("social provider allow-list is empty", slog.String("provider", string(p)), slog.String("mode", string(socialMode)))
			}
		}
	}
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
		SMTPServer:             cfg.EmailSMTPServer,
		SMTPPort:               cfg.EmailSMTPPort,
		NaverworksClientID:     cfg.NaverworksClientID,
		NaverworksClientSecret: cfg.NaverworksClientSecret,
		NaverworksDomain:       cfg.NaverworksDomain,
	})
	smsVerifySvc := service.NewSMSVerify(smsSvc, cache.NewSMSVerifyStore(cacheStore))
	smsH := handler.NewSMS(smsVerifySvc, smsSvc, cfg)
	// forgot-password 발송 연결(Phase C에서 미뤘던 seam).
	authSvc.SetResetSender(service.NewResetNotifier(smsSvc, emailSvc, logger))

	authH := handler.NewAuth(authSvc, cfg)
	authH.SetRevocation(accessRevocation)

	// G3 — 이메일 인증(발송·검증·토큰·재설정·등록/변경). Redis 원자 연산은 cacheStore(미연결 시 503),
	// 발송은 위 emailSvc(설정 없으면 503/502로 실패, 성공 위장 없음).
	if cfg.TrustedClientIPHeader == "" {
		logger.Warn("TRUSTED_CLIENT_IP_HEADER not set: 이메일 인증 IP 한도가 직접 접속 주소 기준으로 동작합니다(프록시 뒤에서는 모든 사용자가 합산됨)")
	}
	emailAuthSvc := service.NewEmailAuth(cacheStore, repository.NewEmailAuth(gdb), emailSvc, service.EmailAuthConfig{
		Secret:     cfg.JWTSecretKey,
		Algorithm:  cfg.JWTAlgorithm,
		BcryptCost: cfg.PasswordBcryptCost,
		Policy: auth.PasswordPolicy{
			MinLength:      cfg.PasswordMinLength,
			RequireUpper:   cfg.PasswordRequireUpper,
			RequireLower:   cfg.PasswordRequireLower,
			RequireNumbers: cfg.PasswordRequireNumbers,
			RequireSpecial: cfg.PasswordRequireSpecial,
		},
	}, logger)
	emailAuthSvc.SetAccessRevoker(accessRevocation)
	emailAuthH := handler.NewEmailAuth(emailAuthSvc, cfg, logger)

	// G4 — 가입(이메일 인증 토큰 소비·소셜 검증·구버전 호환)·로그인 실패 한도·비밀번호 변경 시 토큰 회수.
	authSvc.SetRegisterStore(repository.NewAuthRegister(gdb, refreshRepo))
	authSvc.SetEmailTokens(emailAuthSvc)
	authSvc.SetSecurityStore(cacheStore)
	authSvc.SetAccessRevoker(accessRevocation)
	authSvc.SetLogger(logger)
	authSvc.SetPolicy(service.AuthPolicy{
		AllowLegacyPhoneRegister:   cfg.AllowLegacyPhoneRegister,
		LegacyRegisterRequireSMS:   cfg.LegacyRegisterRequireSMSVerified,
		SocialRegisterRequireToken: cfg.SocialRegisterRequireToken,
		SocialRegisterRequireProof: cfg.SocialRegisterRequireLoginProof,
		LoginFailPerAccount:        cfg.LoginFailLimitPerAccount,
		LoginFailPerIP:             cfg.LoginFailLimitPerIP,
		LoginFailWindow:            time.Duration(cfg.LoginFailWindowSeconds) * time.Second,
	})
	logger.Info("auth policy configured",
		slog.Bool("allow_legacy_phone_register", cfg.AllowLegacyPhoneRegister),
		slog.Bool("legacy_register_require_sms_verified", cfg.LegacyRegisterRequireSMSVerified),
		slog.Bool("social_register_require_token", cfg.SocialRegisterRequireToken),
		slog.Bool("social_register_require_login_proof", cfg.SocialRegisterRequireLoginProof),
		slog.Int("login_fail_limit_per_account", cfg.LoginFailLimitPerAccount),
		slog.Int("login_fail_limit_per_ip", cfg.LoginFailLimitPerIP),
		slog.Int("login_fail_window_sec", cfg.LoginFailWindowSeconds),
	)
	if cfg.AllowLegacyPhoneRegister && !cfg.LegacyRegisterRequireSMSVerified {
		logger.Warn("legacy phone register is open without SMS verification state (LEGACY_REGISTER_REQUIRE_SMS_VERIFIED=false)")
	}
	if !cfg.SocialRegisterRequireToken && !cfg.SocialRegisterRequireLoginProof {
		logger.Warn("social register accepts provider ids without provider token (SOCIAL_REGISTER_REQUIRE_TOKEN=false)")
	}

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
	fcmTokenSvc := service.NewFCMToken(memberRepo)
	fcmTokenSvc.SetUnregisterRepo(memberRepo)
	fcmTokenH := handler.NewFCMToken(fcmTokenSvc, cfg)
	fcmTokenH.SetRevocation(accessRevocation)
	// member-fcm-token — 회원 FCM 토큰 관리 12종. memberRepo 공유 + DEBUG test-ios-push용 fcmClient.
	memberFCMTokenH := handler.NewMemberFCMToken(service.NewMemberFCMToken(memberRepo), cfg, fcmClient)
	// 토큰을 직접 파싱하는 핸들러·WebSocket에도 "비밀번호 변경 이전 토큰 무효" 기준을 적용한다(공통 auth.Parse*Checked).
	// (member_location_log*의 직접 파싱은 G6 담당 파일이라 여기서 주입하지 않는다.)
	for _, h := range []interface {
		SetRevocation(auth.AccessRevocationChecker)
	}{
		userH, memberH, weatherH, memberFCMTokenH, orderH, chatH, groupH, smsH, chatWS,
	} {
		h.SetRevocation(accessRevocation)
	}

	// group-schedule-manage 생성(Phase B) — memberRepo(editor/대상 조회)·pushLogRepo·fcmClient 공유.
	groupScheduleH := handler.NewGroupScheduleManage(
		service.NewGroupScheduleManage(repository.NewGroupScheduleManage(gdb), memberRepo, pushLogRepo, fcmClient),
	)

	memberH.SetGuard(locationGuard)
	memberWriteH.SetGuard(locationGuard)
	locationH.SetGuard(locationGuard)
	groupMemberH.SetGuard(locationGuard)
	locationLogH.SetGuard(locationGuard)

	httpHandler := server.New(cfg, logger, server.Deps{
		Health:         healthH,
		AppVersion:     appVersionH,
		Notice:         noticeH,
		Weather:        weatherH,
		Admin:          adminH,
		AdminAuth:      adminAuth,
		UserAuth:       routeAuth.Required(),
		UserAuthOpt:    routeAuth.Optional(),
		LocationAuth:   locationAuth.Required(),
		Group:          groupH,
		GroupDetail:    groupDetailH,
		Member:         memberH,
		MemberWrite:    memberWriteH,
		User:           userH,
		Location:       locationH,
		Schedule:       scheduleH,
		PushLog:        pushLogH,
		PushFCM:        pushFCMH,
		GroupMember:    groupMemberH,
		GroupSchedule:  groupScheduleH,
		LocationLog:    locationLogH,
		Order:          orderH,
		Hwgi:           hwgiH,
		SMS:            smsH,
		FCMSendone:     fcmSendoneH,
		FCMToken:       fcmTokenH,
		MemberFCMToken: memberFCMTokenH,
		Chat:           chatH,
		ChatWS:         chatWS,
		Auth:           authH,
		EmailAuth:      emailAuthH,
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

	// 인증 미들웨어의 warn 계측 요약 로그 루프. ctx 취소(종료 신호) 시 마지막 요약을 내보내고 끝난다.
	routeAuthDone := make(chan struct{})
	go func() {
		defer close(routeAuthDone)
		routeAuth.Run(ctx)
	}()
	locationAuthDone := make(chan struct{})
	go func() {
		defer close(locationAuthDone)
		locationAuth.Run(ctx)
	}()

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
	<-routeAuthDone
	<-locationAuthDone
	logger.Info("shutdown complete")
}
