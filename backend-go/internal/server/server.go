package server

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/handler"
	"github.com/bluemusk/smap_next_go/internal/middleware"
)

// Deps는 핸들러에 주입되는 외부 의존성.
type Deps struct {
	Health      *handler.HealthHandler
	AppVersion  *handler.AppVersionHandler
	Notice      *handler.NoticeHandler
	Weather     *handler.WeatherHandler
	Admin       *handler.AdminHandler
	Group       *handler.GroupHandler
	GroupDetail *handler.GroupDetailHandler
	Member      *handler.MemberHandler
	User        *handler.UserHandler
	Location    *handler.LocationHandler
	Schedule    *handler.ScheduleHandler
	PushLog     *handler.PushLogHandler
	PushFCM     *handler.PushFCMHandler
	GroupMember *handler.GroupMemberHandler
	LocationLog *handler.LocationLogHandler
	Order       *handler.OrderHandler
	// AdminAuth는 /admin 그룹에 적용되는 RequireAdmin 미들웨어(JWT + mt_level=9).
	AdminAuth gin.HandlerFunc
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

	// Phase 2 — read-only 핫패스 이전. 경로는 Python `api_router`(prefix /app) +
	// main.py의 API_V1_STR(/api/v1) 합성과 동일.
	v1 := r.Group(cfg.APIV1Str)
	{
		v1.GET("/app/version-check", deps.AppVersion.VersionCheck)

		// notices — read-only GET만 Go가 소유(POST/PUT/DELETE admin은 Phase 4 JWT 이후).
		// /search(정적)는 /:id(파라미터)보다 우선 매칭된다.
		v1.GET("/notices/", deps.Notice.List)
		v1.GET("/notices/search", deps.Notice.Search)
		v1.GET("/notices/:id", deps.Notice.Get)

		// weather — GET만 이전. /member/:id는 무인증+캐시, /current는 optional JWT.
		// PUT /member/:id(write)는 Phase 4.
		v1.GET("/weather/current", deps.Weather.Current)
		v1.GET("/weather/member/:member_id", deps.Weather.Member)

		// groups — read. 정적 세그먼트(/hidden,/current-user*,/member,/code)가 파라미터(/:group_id)보다
		// 우선 매칭된다. /current-user·/current-user/summary는 JWT 필수(get_required_user_id).
		// /:group_id/stats는 무인증. write·/join 등은 후반 Phase.
		v1.GET("/groups/hidden", deps.Group.Hidden)
		v1.GET("/groups/current-user/summary", deps.Group.CurrentUserSummary)
		v1.GET("/groups/current-user", deps.Group.CurrentUser)
		v1.GET("/groups/:group_id", deps.Group.Get)
		v1.GET("/groups/:group_id/public", deps.Group.Public)
		v1.GET("/groups/:group_id/stats", deps.Group.Stats)
		v1.GET("/groups/", deps.Group.List)
		v1.GET("/groups/member/:member_id", deps.Group.Member)
		v1.GET("/groups/code/:code", deps.Group.ByCode)

		// group-details — read 4종(전부 무인증). 정적(/member,/group)이 /:group_detail_id보다 우선.
		// write·role·remove·delete는 후반 Phase.
		v1.GET("/group-details/", deps.GroupDetail.List)
		v1.GET("/group-details/:group_detail_id", deps.GroupDetail.Get)
		v1.GET("/group-details/member/:member_id", deps.GroupDetail.Member)
		v1.GET("/group-details/group/:group_id", deps.GroupDetail.Group)

		// members — read. 정적(/check/*,/me,/consent,/group)이 /:member_id보다 우선.
		// /members/me(JWT)는 미인증도 200+result:N로 흡수. /members/consent/:member_id는 JWT.
		// /members/terms는 Python에서 /{member_id}에 가려져 422(dead) → Go도 미등록으로 동일 재현.
		v1.GET("/members/check/phone/:phone", deps.Member.CheckPhone)
		v1.GET("/members/check/email/:email", deps.Member.CheckEmail)
		v1.GET("/members/check/nickname/:nickname", deps.Member.CheckNickname)
		v1.GET("/members/me", deps.Member.Me)
		v1.GET("/members/consent/:member_id", deps.Member.Consent)
		v1.GET("/members/", deps.Member.List)
		v1.GET("/members/:member_id", deps.Member.Get)
		v1.GET("/members/group/:group_id", deps.Member.Group)

		// users — read 7종(전부 무인증, auth 도메인). ⚠️ Python 동작 그대로 이식:
		// /users/·/{id}는 MemberResponse라 mt_name/nickname null 멤버에서 500(plain text);
		// /email·/token·recent/signin은 response_model 없이 전체 컬럼(시크릿 포함) 덤프;
		// not-joined는 행이 있으면 500. write(POST/PUT/DELETE)는 후반 Phase.
		v1.GET("/users/", deps.User.List)
		v1.GET("/users/:user_id", deps.User.Get)
		v1.GET("/users/email/:email", deps.User.ByEmail)
		v1.GET("/users/token/:token", deps.User.ByToken)
		v1.GET("/users/recent/signin/3h", deps.User.RecentSignin3h)
		v1.GET("/users/recent/signin/24h", deps.User.RecentSignin24h)
		v1.GET("/users/not-joined/11days", deps.User.NotJoined)

		// auth/me — JWT(SECRET_KEY/ALGORITHM, claim mt_id). UserHandler에 Me 추가.
		// 토큰 부재 401 "Not authenticated", 검증실패/회원없음 401 "Could not validate credentials".
		v1.GET("/auth/me", deps.User.Me)

		// locations — read 7종(전부 무인증). slt_lat/long은 Decimal→문자열. 정적(/member,
		// /group-detail,/other-members,/myplays)이 /:location_id보다 우선. write는 후반 Phase.
		v1.GET("/locations/", deps.Location.List)
		v1.GET("/locations/:location_id", deps.Location.Get)
		v1.GET("/locations/member/:member_id", deps.Location.Member)
		v1.GET("/locations/group-detail/:group_detail_id", deps.Location.GroupDetail)
		v1.GET("/locations/other-members/:member_id", deps.Location.OtherMembers)
		v1.GET("/locations/myplays/in", deps.Location.MyplaysIn)
		v1.GET("/locations/myplays/out", deps.Location.MyplaysOut)

		// schedules — 결정적 read 3종(무인증). sst_location_lat/long Decimal→문자열.
		// /before-30min은 Python에서 /:schedule_id에 가려져 422(미등록으로 동일). now/*(시간창)·
		// group(List[dict] day-window)은 별도 작업 보류 → 게이트웨이가 Python으로 라우팅.
		v1.GET("/schedules/", deps.Schedule.List)
		v1.GET("/schedules/:schedule_id", deps.Schedule.Get)
		v1.GET("/schedules/member/:member_id", deps.Schedule.Member)
		v1.GET("/schedules/group/:group_id", deps.Schedule.Group)

		// push-logs — read 6종(무인증). datetime zero date 시 Python처럼 500(plain).
		// /member/:id/unread가 /member/:id보다 더 구체적 경로로 공존.
		v1.GET("/push-logs/", deps.PushLog.List)
		v1.GET("/push-logs/:push_log_id", deps.PushLog.Get)
		v1.GET("/push-logs/member/:member_id", deps.PushLog.Member)
		v1.GET("/push-logs/member/:member_id/unread", deps.PushLog.Unread)
		v1.GET("/push-logs/recent/:member_id", deps.PushLog.Recent)
		v1.GET("/push-logs/schedule/:schedule_id", deps.PushLog.Schedule)

		// push-fcms — read 5종(무인증). /now는 Python에서 /:push_fcm_id에 가려져 422(미등록 동일).
		v1.GET("/push-fcms/", deps.PushFCM.List)
		v1.GET("/push-fcms/:push_fcm_id", deps.PushFCM.Get)
		v1.GET("/push-fcms/member/:member_id", deps.PushFCM.Member)
		v1.GET("/push-fcms/code/:code", deps.PushFCM.Code)
		v1.GET("/push-fcms/pending/:mt_idx", deps.PushFCM.Pending)

		// group-members — read 1종(무인증). 3단계 쿼리(기본정보+최신위치 self-join+fallback).
		// write(add/remove/role)는 후반 Phase.
		v1.GET("/group-members/member/:group_id", deps.GroupMember.Member)

		// logs(member_location_log) — read(무인증). to_dict 직렬화(mlt_speed 등 PyFloat).
		// summary/path: 메모리 Haversine+round(banker's). stay-times/map-markers: raw CTE/GROUP BY를
		// MariaDB에 그대로 위임(libm 차이 회피). path의 line 602 중복 라우트는 dead라 미등록.
		v1.GET("/logs/members-with-logs", deps.LocationLog.MembersWithLogs)
		v1.GET("/logs/member-activity", deps.LocationLog.MemberActivity)
		v1.GET("/logs/daily-counts", deps.LocationLog.DailyCounts)
		v1.GET("/logs/daily-counts-simple", deps.LocationLog.DailyCountsSimple)
		v1.GET("/logs/member-location-logs/:mt_idx", deps.LocationLog.MemberLogs)
		v1.GET("/logs/member-location-logs/:mt_idx/daily", deps.LocationLog.DailyLogs)
		v1.GET("/logs/member-location-logs/:mt_idx/daily-summary", deps.LocationLog.DailySummary)
		v1.GET("/logs/member-location-logs/:mt_idx/summary", deps.LocationLog.Summary)
		v1.GET("/logs/member-location-logs/:mt_idx/path", deps.LocationLog.Path)
		v1.GET("/logs/member-location-logs/:mt_idx/stay-times", deps.LocationLog.StayTimes)
		v1.GET("/logs/member-location-logs/:mt_idx/map-markers", deps.LocationLog.MapMarkers)

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
