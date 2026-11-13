package server

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/ws"
)

// Deps는 핸들러에 주입되는 외부 의존성.
type Deps struct {
	Health         *handler.HealthHandler
	AppVersion     *handler.AppVersionHandler
	Notice         *handler.NoticeHandler
	Weather        *handler.WeatherHandler
	Admin          *handler.AdminHandler
	Group          *handler.GroupHandler
	GroupDetail    *handler.GroupDetailHandler
	Member         *handler.MemberHandler
	MemberWrite    *handler.MemberWriteHandler
	User           *handler.UserHandler
	Location       *handler.LocationHandler
	Schedule       *handler.ScheduleHandler
	PushLog        *handler.PushLogHandler
	PushFCM        *handler.PushFCMHandler
	GroupMember    *handler.GroupMemberHandler
	GroupSchedule  *handler.GroupScheduleManageHandler
	LocationLog    *handler.LocationLogHandler
	Order          *handler.OrderHandler
	Hwgi           *handler.HwgiHandler
	SMS            *handler.SMSHandler
	FCMSendone     *handler.FCMSendoneHandler
	FCMToken       *handler.FCMTokenHandler
	MemberFCMToken *handler.MemberFCMTokenHandler
	Chat           *handler.ChatHandler
	ChatWS         *ws.ChatWS
	Auth           *handler.AuthHandler
	// EmailAuth는 이메일 인증 4종(/auth/email/*, /auth/reset-password-by-email). 라우트는 공개이고
	// 로그인이 필요한 경우는 핸들러가 직접 Bearer 토큰을 검증한다.
	EmailAuth *handler.EmailAuthHandler
	// AdminAuth는 /admin 그룹에 적용되는 RequireAdmin 미들웨어(JWT + mt_level=9).
	AdminAuth gin.HandlerFunc
	// UserAuth는 일반 사용자 인증 미들웨어(ROUTE_AUTH_MODE off|warn|enforce)다. nil이면 붙이지 않는다.
	UserAuth gin.HandlerFunc
	// UserAuthOpt은 선택 인증 변형(토큰이 없어도 통과, 있으면 검증·상태 확인)이다. nil이면 붙이지 않는다.
	UserAuthOpt gin.HandlerFunc
	// LocationAuth는 위치 라우트용 인증 미들웨어(LOCATION_AUTH_MODE로 무토큰 처리 결정)다. nil이면 UserAuth를 쓴다.
	LocationAuth gin.HandlerFunc
}

// New는 gin 엔진을 구성한다. 라우트는 Python `app/main.py` + `app/api/v1/api.py` 와
// 동일한 경로 규칙을 따른다.
func New(cfg *config.Config, logger *slog.Logger, deps Deps) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.Recovery(logger))
	r.Use(middleware.AccessLog(logger))
	r.Use(middleware.CORS(cfg.CORSOrigins()))

	// 루트 — Python `/` 응답 스키마와 동일.
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message":        "SMAP API (Go) 서버가 정상적으로 실행 중입니다.",
			"version":        cfg.Version,
			"docs":           "/docs",
			"redoc":          "/redoc",
			"openapi":        "/openapi.json",
			"health":         "/health",
			"db_pool_health": "/health/db-pool",
			"runtime":        "go",
		})
	})

	// 헬스체크/메트릭 — Phase 1에서 노출하는 유일한 비즈니스 라우트.
	r.GET("/health", deps.Health.Liveness)
	r.GET("/health/db-pool", deps.Health.DBPool)
	r.GET("/health/redis", deps.Health.Redis)
	r.GET("/metrics", deps.Health.Metrics)

	// Phase 5 — chat 실시간 WebSocket(native). Python app.mount("/ws", socketio)의 /ws 대체.
	// 핸드셰이크 ?token=Bearer<jwt>, 프레임 {event,data} JSON. v1(/api/v1) 밖 루트 경로.
	r.GET("/ws", deps.ChatWS.Handle)

	// Phase 2 — read-only 핫패스 이전. 경로는 Python `api_router`(prefix /app) +
	// main.py의 API_V1_STR(/api/v1) 합성과 동일.
	v1 := r.Group(cfg.APIV1Str)
	{
		// ua: 일반 사용자 인증 미들웨어(ROUTE_AUTH_MODE)가 붙는 그룹. 경로는 v1과 같고(접두사 ""),
		// 미들웨어만 추가된다. 핸들러가 직접 하는 토큰 파싱·소유권 검사는 건드리지 않는다(G6·G7 소관).
		// 로그인·가입·SMS·비밀번호 찾기·버전·공지·/ws 등 공개 라우트와 핸들러가 자체 JWT 처리를 하는
		// members/orders/chats/fcm-token 계열은 붙이지 않았다.
		ua := v1.Group("")
		if deps.UserAuth != nil {
			ua.Use(deps.UserAuth)
		}
		// la: 위치 라우트 그룹(/logs/*, /locations/*, /group-members/member/:gid, /members/ 조회, 회원 위치 덮어쓰기).
		// 무토큰 처리만 LOCATION_AUTH_MODE로 따로 정하고, 토큰이 있는 요청의 소유권·멤버십 검사(403)는 핸들러가 한다.
		la := v1.Group("")
		if deps.LocationAuth != nil {
			la.Use(deps.LocationAuth)
		} else if deps.UserAuth != nil {
			la.Use(deps.UserAuth)
		}
		// uo: 선택 인증 변형(토큰이 없어도 통과).
		uo := v1.Group("")
		if deps.UserAuthOpt != nil {
			uo.Use(deps.UserAuthOpt)
		}
		// adm: 관리자 전용 라우트(RequireAdmin: JWT + mt_level=9). /users/*, /fcm_sendone 전부, /sms/send, find-user-by-*, 링크 재설정 3종, DELETE /members/:id.
		adm := v1.Group("")
		adm.Use(deps.AdminAuth)

		v1.GET("/app/version-check", deps.AppVersion.VersionCheck)

		// notices — read GET 3종(무인증) + admin write 5종(RequireAdmin: JWT+mt_level=9).
		// create/update/delete는 cache_delete_pattern("notices:*"), hide/show는 미무효화(Python 충실).
		// /search(정적)는 /:id(파라미터)보다 우선 매칭된다.
		v1.GET("/notices/", deps.Notice.List)
		v1.GET("/notices/search", deps.Notice.Search)
		v1.GET("/notices/:id", deps.Notice.Get)
		v1.POST("/notices/", deps.AdminAuth, deps.Notice.Create)
		v1.PUT("/notices/:id", deps.AdminAuth, deps.Notice.Update)
		v1.DELETE("/notices/:id", deps.AdminAuth, deps.Notice.Delete)
		v1.PATCH("/notices/:id/hide", deps.AdminAuth, deps.Notice.Hide)
		v1.PATCH("/notices/:id/show", deps.AdminAuth, deps.Notice.Show)

		// weather — GET만 이전. /member/:id는 무인증+캐시, /current는 optional JWT.
		// PUT /member/:id(write)는 Phase 4.
		uo.GET("/weather/current", deps.Weather.Current)
		ua.GET("/weather/member/:member_id", deps.Weather.Member)
		ua.PUT("/weather/member/:member_id", deps.Weather.UpdateMember)

		// groups — read. 정적 세그먼트(/hidden,/current-user*,/member,/code)가 파라미터(/:group_id)보다
		// 우선 매칭된다. /current-user·/current-user/summary는 JWT 필수(get_required_user_id).
		// /:group_id/stats는 무인증.
		ua.GET("/groups/hidden", deps.Group.Hidden)
		ua.GET("/groups/current-user/summary", deps.Group.CurrentUserSummary)
		ua.GET("/groups/current-user", deps.Group.CurrentUser)
		ua.GET("/groups/:group_id", deps.Group.Get)
		v1.GET("/groups/:group_id/public", deps.Group.Public)
		ua.GET("/groups/:group_id/stats", deps.Group.Stats)
		ua.GET("/groups/", deps.Group.List)
		ua.GET("/groups/member/:member_id", deps.Group.Member)
		v1.GET("/groups/code/:code", deps.Group.ByCode)
		// groups — write Phase 1(전부 JWT 필수: get_required_user_id). 정적 /join이 /:group_id/join과
		// 별도 트리(세그먼트 수 다름)라 충돌 없음. create_group은 그룹장 등록+채팅방 생성을 동반.
		ua.POST("/groups/join", deps.Group.JoinByCode)
		ua.POST("/groups/", deps.Group.Create)
		ua.POST("/groups/:group_id/join", deps.Group.Join)
		// groups — write Phase 2(전부 무인증). 정적 /emergency-restore가 /:group_id와 같은 레벨이지만
		// Gin은 정적>파라미터 우선이라 공존 가능(GET의 /member·/code 정적과 동일 패턴). update의 sgt_show='N'은
		// 소프트 삭제. remove는 body값 무시(항상 N/Y). join-new-member는 채팅 동기화 없음.
		ua.POST("/groups/emergency-restore", deps.Group.EmergencyRestore)
		ua.POST("/groups/:group_id/join-new-member", deps.Group.JoinNewMember)
		ua.PUT("/groups/:group_id", deps.Group.Update)
		ua.PUT("/groups/:group_id/restore", deps.Group.Restore)
		ua.PUT("/groups/:group_id/members/:member_id/remove", deps.Group.RemoveMember)

		// group-details — read 4종(전부 무인증). 정적(/member,/group)이 /:group_detail_id보다 우선.
		// write·role·remove·delete는 후반 Phase.
		ua.GET("/group-details/", deps.GroupDetail.List)
		ua.GET("/group-details/:group_detail_id", deps.GroupDetail.Get)
		ua.GET("/group-details/member/:member_id", deps.GroupDetail.Member)
		ua.GET("/group-details/group/:group_id", deps.GroupDetail.Group)
		// group-details write 5종(무인증). ⚠️create는 스키마-모델 필드 불일치로 항상 500(Python TypeError 버그).
		// update는 모델 매핑 컬럼만 영속. role/remove는 utcnow()+소프트삭제. delete는 소프트삭제(exit=Y/show=N).
		ua.POST("/group-details/", deps.GroupDetail.Create)
		ua.PUT("/group-details/:group_detail_id", deps.GroupDetail.Update)
		ua.PUT("/group-details/:group_detail_id/role", deps.GroupDetail.UpdateRole)
		ua.PUT("/group-details/:group_detail_id/remove", deps.GroupDetail.RemoveMember)
		ua.DELETE("/group-details/:group_detail_id", deps.GroupDetail.Delete)

		// members — read. 정적(/check/*,/me,/consent,/group)이 /:member_id보다 우선.
		// /members/me(JWT)는 미인증도 200+result:N로 흡수. /members/consent/:member_id는 JWT.
		v1.GET("/members/check/phone/:phone", deps.Member.CheckPhone)
		v1.GET("/members/check/email/:email", deps.Member.CheckEmail)
		v1.GET("/members/check/nickname/:nickname", deps.Member.CheckNickname)
		v1.GET("/members/me", deps.Member.Me)
		v1.GET("/members/consent/:member_id", deps.Member.Consent)
		// ⚠️ /members/terms는 정상화 결정으로 약관 5종 200 반환(Python은 /{member_id}에 가려져 422였음).
		// Gin은 정적>파라미터 우선이라 /:member_id보다 먼저 매칭된다.
		v1.GET("/members/terms", deps.MemberWrite.Terms)
		la.GET("/members/", deps.Member.List)
		la.GET("/members/:member_id", deps.Member.Get)
		la.GET("/members/group/:group_id", deps.Member.Group)

		// members — write 17종(register/login/비번/프로필/동의/탈퇴/CRUD/파일). 정적이 /:member_id보다 우선.
		// google-login은 auth.GoogleLogin 재사용(동일 member_service.google_login). 비번/프로필/연락처/탈퇴는
		// {result,message,success} 비표준 래핑(인증실패도 200). consent/consent-all은 미인증 401(차이).
		v1.POST("/members/verify-password", deps.MemberWrite.VerifyPassword)
		v1.POST("/members/change-password", deps.MemberWrite.ChangePassword)
		v1.POST("/members/register", deps.MemberWrite.Register)
		v1.POST("/members/login", deps.MemberWrite.Login)
		v1.POST("/members/google-login", deps.Auth.GoogleLoginStrict)
		v1.POST("/members/update-profile", deps.MemberWrite.UpdateProfile)
		v1.POST("/members/update-contact", deps.MemberWrite.UpdateContact)
		v1.POST("/members/withdraw", deps.MemberWrite.Withdraw)
		v1.POST("/members/consent", deps.MemberWrite.Consent)
		v1.POST("/members/consent/all", deps.MemberWrite.ConsentAll)
		v1.POST("/members/upload-profile-image", deps.MemberWrite.UploadProfileImage)
		v1.DELETE("/members/delete-profile-image", deps.MemberWrite.DeleteProfileImage)
		v1.POST("/members/", deps.MemberWrite.Create)
		la.PUT("/members/:member_id", deps.MemberWrite.Update)
		// 하드 삭제(15단계 탈퇴 정리를 거치지 않는다). Android/iOS(현재·스토어 버전)·apps/web·apps/mcp 모두 호출하지 않아
		// 관리자 전용으로 닫는다. 앱의 탈퇴는 POST /members/withdraw.
		adm.DELETE("/members/:member_id", deps.MemberWrite.Delete)
		la.PATCH("/members/:member_id/location", deps.MemberWrite.UpdateLocation)

		// users — read 7종(관리자 전용: adm, auth 도메인). ⚠️ Python 동작 그대로 이식(단 비밀 필드는 제거):
		// /users/·/{id}는 MemberResponse라 mt_name/nickname null 멤버에서 500(plain text);
		// /email·/token·recent/signin은 response_model 없이 전체 컬럼 덤프(단 mt_pwd·mt_reset_token·mt_token_id 등 비밀은 제거);
		// not-joined는 행이 있으면 500. write(POST/PUT/DELETE)는 후반 Phase.
		adm.GET("/users/", deps.User.List)
		adm.GET("/users/:user_id", deps.User.Get)
		adm.GET("/users/email/:email", deps.User.ByEmail)
		adm.GET("/users/token/:token", deps.User.ByToken)
		adm.GET("/users/recent/signin/3h", deps.User.RecentSignin3h)
		adm.GET("/users/recent/signin/24h", deps.User.RecentSignin24h)
		adm.GET("/users/not-joined/11days", deps.User.NotJoined)
		// users write 3종(관리자 전용): create(MemberCreate, mt_id 정규화·mt_pwd는 bcrypt 해시 저장)·
		// update(exclude_unset)·delete(하드 삭제 후 삭제 회원 반환).
		adm.POST("/users/", deps.User.Create)
		adm.PUT("/users/:user_id", deps.User.UpdateUser)
		adm.DELETE("/users/:user_id", deps.User.DeleteUser)

		// auth/me — JWT(SECRET_KEY/ALGORITHM, claim mt_id). UserHandler에 Me 추가.
		// 토큰 부재 401 "Not authenticated", 검증실패/회원없음 401 "Could not validate credentials".
		v1.GET("/auth/me", deps.User.Me)

		// auth write — Phase A(비밀번호 로그인 + 토큰 수명주기 5종). 전부 무인증 진입(토큰 발급 경로).
		// /login·/register는 항상 200/201+success(예외 흡수), /refresh·/login-original은 401 분기.
		v1.POST("/auth/login", deps.Auth.Login)
		v1.POST("/auth/logout", deps.Auth.Logout)
		v1.POST("/auth/refresh", deps.Auth.Refresh)
		v1.POST("/auth/login-original", deps.Auth.LoginOriginal)
		v1.POST("/auth/register", deps.Auth.Register)

		// auth Phase B — 소셜 로그인 5종(무인증, OAuth 토큰검증은 클라). 전부 200+success(예외 흡수).
		// google-login은 수동 파싱(Pydantic 우회). kakao/apple/find-user는 구조화 422.
		v1.POST("/auth/kakao-login", deps.Auth.KakaoLogin)
		v1.POST("/auth/google-login", deps.Auth.GoogleLogin)
		v1.POST("/auth/apple-login", deps.Auth.AppleLogin)
		// find-user-by-*: 계정 존재 조회(사용자 열거). 레거시 웹 전용이라 관리자 전용으로 닫았다.
		adm.POST("/auth/find-user-by-email", deps.Auth.FindUserByEmail)
		adm.POST("/auth/find-user-by-phone", deps.Auth.FindUserByPhone)

		// auth Phase C — 비밀번호 재설정 4종(무인증). 전부 200+success(검증 실패 422 제외).
		// 실제 SMS/이메일 발송은 sms/email 도메인 트랙 소관(forgot은 토큰 저장+응답만, 발송과 무관).
		// reset-password-by-phone은 Redis(sms:verified:/sms:code:) interop로 SMS 인증상태를 읽는다.
		// 링크(토큰) 기반 재설정 3종(forgot-password, verify-reset-token, reset-password)은 레거시 웹 전용이고
		// 앱·apps/web·apps/mcp는 호출하지 않는다(8자리 토큰·시도 제한 없음). 관리자 전용으로 닫았다.
		// 앱이 쓰는 인증번호 방식(reset-password-by-phone, /auth/email/*, reset-password-by-email)은 공개 유지.
		adm.POST("/auth/forgot-password", deps.Auth.ForgotPassword)
		adm.POST("/auth/verify-reset-token", deps.Auth.VerifyResetToken)
		adm.POST("/auth/reset-password", deps.Auth.ResetPassword)
		v1.POST("/auth/reset-password-by-phone", deps.Auth.ResetPasswordByPhone)

		// auth 이메일 인증(G3) — 공개 라우트. change_email 흐름(send-code/verify-code의 purpose=change_email,
		// /email/change)은 핸들러가 Bearer access 토큰을 직접 검증한다(ROUTE_AUTH_MODE와 무관하게 강제).
		if deps.EmailAuth != nil {
			v1.POST("/auth/email/send-code", deps.EmailAuth.SendCode)
			v1.POST("/auth/email/verify-code", deps.EmailAuth.VerifyCode)
			v1.POST("/auth/email/change", deps.EmailAuth.ChangeEmail)
			v1.POST("/auth/reset-password-by-email", deps.EmailAuth.ResetPasswordByEmail)
		}

		// locations — read 7종(전부 무인증). slt_lat/long은 Decimal→문자열. 정적(/member,
		// /group-detail,/other-members,/myplays)이 /:location_id보다 우선. write는 후반 Phase.
		la.GET("/locations/", deps.Location.List)
		la.GET("/locations/:location_id", deps.Location.Get)
		la.GET("/locations/member/:member_id", deps.Location.Member)
		la.GET("/locations/group-detail/:group_detail_id", deps.Location.GroupDetail)
		la.GET("/locations/other-members/:member_id", deps.Location.OtherMembers)
		la.GET("/locations/myplays/in", deps.Location.MyplaysIn)
		la.GET("/locations/myplays/out", deps.Location.MyplaysOut)
		// locations write 5종(무인증, raw SQL). create는 기본값(mt_idx=282·좌표 37.5665)·절단·커스텀응답(slt_lat float).
		// notification은 Y/N 검증·rowcount 404. ⚠️update의 404는 except 흡수로 500-wrap. delete는 LocationResponse 반환.
		// member-create는 member존재 404 + 그룹조회. 정적 /members/.../locations + 파라미터 공존.
		la.POST("/locations/", deps.Location.Create)
		la.PUT("/locations/:location_id/notification", deps.Location.Notification)
		la.PUT("/locations/:location_id", deps.Location.Update)
		la.DELETE("/locations/:location_id", deps.Location.Delete)
		la.POST("/locations/members/:member_id/locations", deps.Location.MemberCreate)

		// schedules — 결정적 read 3종(무인증). sst_location_lat/long Decimal→문자열.
		// /before-30min은 Python에서 /:schedule_id에 가려져 422(미등록으로 동일).
		// now/in-members·out-members·push(시간창, zero date 행 있으면 500=Python ResponseValidationError 재현) 이식.
		ua.GET("/schedules/", deps.Schedule.List)
		ua.GET("/schedules/now/in-members", deps.Schedule.NowInMembers)
		ua.GET("/schedules/now/out-members", deps.Schedule.NowOutMembers)
		ua.GET("/schedules/now/push", deps.Schedule.NowPush)
		ua.GET("/schedules/:schedule_id", deps.Schedule.Get)
		ua.GET("/schedules/member/:member_id", deps.Schedule.Member)
		ua.GET("/schedules/group/:group_id", deps.Schedule.Group)
		// schedules write 3종(무인증). create는 ScheduleCreate 전 필드 모델 매핑(group_details와 달리 성공형 INSERT).
		// update는 exclude_unset. delete는 하드 삭제. sst_location_lat/long은 Decimal→문자열.
		ua.POST("/schedules/", deps.Schedule.Create)
		ua.PUT("/schedules/:schedule_id", deps.Schedule.Update)
		ua.DELETE("/schedules/:schedule_id", deps.Schedule.Delete)

		// push-logs — read 6종(무인증). datetime zero date 시 Python처럼 500(plain).
		// /member/:id/unread가 /member/:id보다 더 구체적 경로로 공존.
		ua.GET("/push-logs/", deps.PushLog.List)
		ua.GET("/push-logs/:push_log_id", deps.PushLog.Get)
		ua.GET("/push-logs/member/:member_id", deps.PushLog.Member)
		ua.GET("/push-logs/member/:member_id/unread", deps.PushLog.Unread)
		ua.GET("/push-logs/recent/:member_id", deps.PushLog.Recent)
		ua.GET("/push-logs/schedule/:schedule_id", deps.PushLog.Schedule)
		// push-logs write(무인증): create(API3_FCM_service/system_auto면 무DB 가짜응답)·update(exclude_unset)·
		// delete(하드)·patch read·delete-all/read-all(query mt_idx). 정적 delete-all/read-all + 파라미터 공존.
		ua.POST("/push-logs/", deps.PushLog.Create)
		ua.POST("/push-logs/delete-all", deps.PushLog.DeleteAll)
		ua.POST("/push-logs/read-all", deps.PushLog.ReadAll)
		ua.PUT("/push-logs/:push_log_id", deps.PushLog.Update)
		ua.DELETE("/push-logs/:push_log_id", deps.PushLog.Delete)
		ua.PATCH("/push-logs/:push_log_id/read", deps.PushLog.MarkRead)

		// push-fcms — read 5종(무인증). /now는 Python에서 /:push_fcm_id에 가려져 422(미등록 동일).
		ua.GET("/push-fcms/", deps.PushFCM.List)
		ua.GET("/push-fcms/:push_fcm_id", deps.PushFCM.Get)
		ua.GET("/push-fcms/member/:member_id", deps.PushFCM.Member)
		ua.GET("/push-fcms/code/:code", deps.PushFCM.Code)
		ua.GET("/push-fcms/pending/:mt_idx", deps.PushFCM.Pending)
		// push-fcms write(무인증): mark-delivered(no-op)·create·update(exclude_unset)·delete(하드).
		ua.POST("/push-fcms/mark-delivered/:push_fcm_id", deps.PushFCM.MarkDelivered)
		ua.POST("/push-fcms/", deps.PushFCM.Create)
		ua.PUT("/push-fcms/:push_fcm_id", deps.PushFCM.Update)
		ua.DELETE("/push-fcms/:push_fcm_id", deps.PushFCM.Delete)

		// group-members — read 1종(무인증). 3단계 쿼리(기본정보+최신위치 self-join+fallback).
		la.GET("/group-members/member/:group_id", deps.GroupMember.Member)
		// group-members write(무인증): add/remove(query param)·remove-path·role.
		// role의 is_leader는 bool→Y/N, 그 외 str(x).upper()→MySQL ENUM 위반 시 500.
		ua.POST("/group-members/add", deps.GroupMember.Add)
		ua.DELETE("/group-members/remove", deps.GroupMember.Remove)
		ua.DELETE("/group-members/:group_id/member/:member_id", deps.GroupMember.RemovePath)
		ua.PUT("/group-members/:group_id/role", deps.GroupMember.UpdateRole)

		// group-schedule-manage(/schedule) — read 4종(무인증). 권한(check_group_permission)·
		// 그룹멤버·Haversine SQL 거리계산·동적 WHERE. datetime은 엔드포인트별 str(공백)/isoformat(T) 혼재.
		ua.GET("/schedule/test-all-columns", deps.GroupSchedule.TestAllColumns)
		ua.GET("/schedule/owner-groups/all-schedules", deps.GroupSchedule.OwnerGroupsAllSchedules)
		ua.GET("/schedule/group/:group_id/schedules", deps.GroupSchedule.GroupSchedules)
		ua.GET("/schedule/debug/schedule/:schedule_id", deps.GroupSchedule.DebugSchedule)
		// Phase B — 그룹 스케줄 생성(Dict[str,Any] raw INSERT + 반복 3년 + FCM 알림).
		ua.POST("/schedule/group/:group_id/schedules", deps.GroupSchedule.CreateGroupSchedule)
		// Phase C — 그룹 스케줄 수정(반복옵션 this/all/future + FCM 알림).
		ua.PUT("/schedule/group/:group_id/schedules/:schedule_id", deps.GroupSchedule.UpdateGroupSchedule)
		// Phase D — 그룹 스케줄 삭제(반복옵션 this/all/future soft-delete + FCM 알림).
		ua.DELETE("/schedule/group/:group_id/schedules/:schedule_id", deps.GroupSchedule.DeleteGroupSchedule)

		// logs(member_location_log) — read(무인증). to_dict 직렬화(mlt_speed 등 PyFloat).
		// summary/path: 메모리 Haversine+round(banker's). stay-times/map-markers: raw CTE/GROUP BY를
		// MariaDB에 그대로 위임(libm 차이 회피). path의 line 602 중복 라우트는 dead라 미등록.
		// POST /logs/member-location-logs — body.act 기반 14종 RPC 디스패처(읽기 11 + 쓰기 3 create/update/delete).
		la.POST("/logs/member-location-logs", deps.LocationLog.MemberLocationLogsPost)
		la.GET("/logs/members-with-logs", deps.LocationLog.MembersWithLogs)
		la.GET("/logs/member-activity", deps.LocationLog.MemberActivity)
		la.GET("/logs/daily-counts", deps.LocationLog.DailyCounts)
		la.GET("/logs/daily-counts-simple", deps.LocationLog.DailyCountsSimple)
		la.GET("/logs/member-location-logs/:mt_idx", deps.LocationLog.MemberLogs)
		la.GET("/logs/member-location-logs/:mt_idx/daily", deps.LocationLog.DailyLogs)
		la.GET("/logs/member-location-logs/:mt_idx/daily-summary", deps.LocationLog.DailySummary)
		la.GET("/logs/member-location-logs/:mt_idx/summary", deps.LocationLog.Summary)
		la.GET("/logs/member-location-logs/:mt_idx/path", deps.LocationLog.Path)
		la.GET("/logs/member-location-logs/:mt_idx/stay-times", deps.LocationLog.StayTimes)
		la.GET("/logs/member-location-logs/:mt_idx/map-markers", deps.LocationLog.MapMarkers)

		// orders — read 5종(무인증). 금액 Double→PyFloat, 날짜 ISO8601, summary 단일 집계.
		// 정적 세그먼트(summary/detail/code/recent)를 catch-all /:member_id보다 먼저 등록해
		// gin radix tree에서 우선 매칭시킨다(Python은 /{member_id}가 detail/code/recent를
		// 가리는 shadowing 버그가 있으나, Go는 정적 우선 등록으로 정상 동작 — v2 인벤토리 방침).
		// 단건 404 detail은 한국어 "주문을 찾을 수 없습니다". write(PUT status/POST cancel)는 후반 Phase.
		v1.GET("/orders/summary/:member_id", deps.Order.Summary)
		v1.GET("/orders/detail/:order_id", deps.Order.Detail)
		v1.GET("/orders/code/:order_code", deps.Order.ByCode)
		v1.GET("/orders/recent/:member_id", deps.Order.Recent)
		v1.GET("/orders/:member_id", deps.Order.MemberOrders)
		// orders write 2종. ⚠️ 성공 시에도 Python이 raw 모델을 response_model 없이 반환→직렬화 실패→500 plain
		// (DB는 갱신/취소 커밋됨). status update는 소유자 체크 없음(P1), cancel은 소유자(403)+이미취소(400). 401="인증이 필요합니다".
		v1.PUT("/orders/status/:order_id", deps.Order.UpdateStatus)
		v1.POST("/orders/cancel/:order_id", deps.Order.Cancel)

		// sms/email 발송 도메인 — 인증번호 발송/검증(무인증) + 일반 SMS(인증 필수).
		// send-verification-code/verify-code는 Redis(sms:code:/sms:verified:/sms:rate:) 사용 →
		// Phase C reset-password-by-phone과 interop. Aligo form-data + Fixie 프록시(옵션) 실발송.
		v1.POST("/sms/send-verification-code", deps.SMS.SendVerificationCode)
		v1.POST("/sms/verify-code", deps.SMS.VerifyCode)
		adm.POST("/sms/send", deps.SMS.Send)

		// hwgi(한화 디지털화상창구 점검) 5종(무인증). all-data(3테이블 동적dict)·bulk-save(upsert)·
		// upload-photo(base64 파일저장 절대경로)·delete-photo/{id}(파일+DB)·generate-report(검증422+항상500).
		v1.GET("/hwgi/all-data", deps.Hwgi.AllData)
		v1.POST("/hwgi/bulk-save", deps.Hwgi.BulkSave)
		v1.POST("/hwgi/upload-photo", deps.Hwgi.UploadPhoto)
		v1.DELETE("/hwgi/delete-photo/:photo_id", deps.Hwgi.DeletePhoto)
		v1.POST("/hwgi/generate-report", deps.Hwgi.GenerateReport)

		// push 발송 — fcm_sendone 단건/전체발송. success는 문자열 "true"/"false".
		// 루트(/fcm_sendone/) 포함 fcm_sendone 전부 관리자 전용(adm). 레거시 웹이 유일한 사용처였고 폐기가 확정됐다.
		// mt_idx==0이면 전체발송(N+1). 토큰 무효화는 no-op(Python DB변경부 주석처리). 폴백 미이식.
		adm.POST("/fcm_sendone/", deps.FCMSendone.Send)
		// Phase 2 변형 5종: test(무발송 echo)·test-send(path int)·silent·silent-batch(무body)·background(전 분기 push_log).
		adm.POST("/fcm_sendone/test", deps.FCMSendone.Test)
		adm.POST("/fcm_sendone/test-send/:mt_idx", deps.FCMSendone.TestSend)
		adm.POST("/fcm_sendone/silent", deps.FCMSendone.Silent)
		adm.POST("/fcm_sendone/silent-batch", deps.FCMSendone.SilentBatch)
		adm.POST("/fcm_sendone/background", deps.FCMSendone.Background)

		// fcm-token — FCM 토큰 관리 3종(전부 get_current_member 인증). ⚠️ Python firebase_service 미import:
		// /update silent push는 no-op, /notify-token-change는 항상 500 plain "Internal Server Error".
		// (fcm_silent_push는 api.py 미등록=dead code → 미이식)
		// unregister(G4): 로그아웃·탈퇴 직전 호출. 사용자 인증 미들웨어(ua) + 핸들러 자체 Bearer 검증(모드 무관 401).
		ua.POST("/fcm-token/unregister", deps.FCMToken.Unregister)
		v1.POST("/fcm-token/update", deps.FCMToken.Update)
		v1.GET("/fcm-token/status", deps.FCMToken.Status)
		v1.POST("/fcm-token/notify-token-change", deps.FCMToken.NotifyTokenChange)

		// member-fcm-token — 회원 FCM 토큰 관리 12종. 대부분 get_required_user_id(401), register/status/
		// check-and-update는 수평인가(403). cleanup-expired-tokens만 무인증. DEBUG 4종(test-ios-push/
		// full-token/update-logs/trigger-update)은 DEBUG=false면 인증 통과 후 404 "Not Found".
		v1.POST("/member-fcm-token/register", deps.MemberFCMToken.Register)
		v1.GET("/member-fcm-token/status/:mt_idx", deps.MemberFCMToken.Status)
		v1.POST("/member-fcm-token/check-and-update", deps.MemberFCMToken.CheckAndUpdate)
		v1.POST("/member-fcm-token/validate-and-refresh", deps.MemberFCMToken.ValidateAndRefresh)
		v1.POST("/member-fcm-token/background-check", deps.MemberFCMToken.BackgroundCheck)
		v1.POST("/member-fcm-token/cleanup-expired-tokens", deps.MemberFCMToken.CleanupExpiredTokens)
		v1.POST("/member-fcm-token/reset-invalid-tokens", deps.MemberFCMToken.ResetInvalidTokens)
		v1.POST("/member-fcm-token/notify-token-refresh", deps.MemberFCMToken.NotifyTokenRefresh)
		v1.POST("/member-fcm-token/test-ios-push", deps.MemberFCMToken.TestIOSPush)
		v1.GET("/member-fcm-token/full-token/:mt_idx", deps.MemberFCMToken.FullToken)
		v1.GET("/member-fcm-token/update-logs/:mt_idx", deps.MemberFCMToken.UpdateLogs)
		v1.POST("/member-fcm-token/trigger-update/:mt_idx", deps.MemberFCMToken.TriggerUpdate)

		// chats — REST 3종(JWT: SECRET_KEY+mt_idx claim). 정적 /rooms/dm(POST)와
		// 파라미터 /rooms/:scr_idx/messages(GET)는 경로 깊이·메서드가 달라 radix tree 충돌 없음.
		v1.GET("/chats/rooms", deps.Chat.Rooms)
		v1.POST("/chats/rooms/dm", deps.Chat.CreateDM)
		v1.GET("/chats/rooms/:scr_idx/messages", deps.Chat.Messages)

		// admin — read 통계/그룹. RequireAdmin(JWT + mt_level=9) 게이트 적용.
		admin := v1.Group("/admin")
		admin.Use(deps.AdminAuth)
		{
			admin.GET("/stats", deps.Admin.Stats)
			admin.GET("/groups", deps.Admin.Groups)
		}
	}

	return r
}
