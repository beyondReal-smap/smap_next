package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"

	"github.com/bluemusk/smap_next_go/internal/auth"
)

// Config는 backend-go 전체 런타임 설정을 담는다.
// Python(`app/core/config.py`)의 Settings 클래스와 동일한 환경변수를 공유한다.
type Config struct {
	ProjectName string `envconfig:"PROJECT_NAME" default:"SMAP API"`
	// Debug는 Python settings.DEBUG(기본 False). member-fcm-token의 DEBUG 전용 4종은 false면 404.
	Debug    bool   `envconfig:"DEBUG" default:"false"`
	Version  string `envconfig:"VERSION" default:"1.0.0"`
	APIV1Str string `envconfig:"API_V1_STR" default:"/api/v1"`

	HTTPHost string `envconfig:"GO_HTTP_HOST" default:"127.0.0.1"`
	HTTPPort int    `envconfig:"GO_HTTP_PORT" default:"9200"`

	MySQLHost     string `envconfig:"MYSQL_HOST" default:"127.0.0.1"`
	MySQLPort     int    `envconfig:"MYSQL_PORT" default:"3306"`
	MySQLUser     string `envconfig:"MYSQL_USER" required:"true"`
	MySQLPassword string `envconfig:"MYSQL_PASSWORD" required:"true"`
	MySQLDB       string `envconfig:"MYSQL_DB" default:"smap2_db"`
	MySQLCharset  string `envconfig:"MYSQL_CHARSET" default:"utf8mb4"`

	DBPoolSize    int `envconfig:"DB_POOL_SIZE" default:"20"`
	DBMaxOverflow int `envconfig:"DB_MAX_OVERFLOW" default:"30"`
	DBPoolTimeout int `envconfig:"DB_POOL_TIMEOUT" default:"60"`
	DBPoolRecycle int `envconfig:"DB_POOL_RECYCLE" default:"3600"`

	// Redis는 옵셔널. URL이 비어있으면 Redis 헬스체크는 비활성.
	// 캐시 전용(db=0). REDIS_URL 기본값 예시: redis://127.0.0.1:6379/0.
	RedisURL string `envconfig:"REDIS_URL" default:""`

	// asynq 잡큐 전용 Redis 설정(Phase 3). 캐시(db=0)와 키스페이스를 분리하기 위해
	// 잡큐는 db=1을 사용한다. 캐시용 RedisURL과 같은 호스트라도 DB 인덱스로 격리한다.
	// cmd/worker·cmd/scheduler가 asynq.RedisClientOpt{Addr, DB}를 구성할 때 참조한다.
	AsynqRedisAddr string `envconfig:"ASYNQ_REDIS_ADDR" default:"127.0.0.1:6379"`
	AsynqRedisDB   int    `envconfig:"ASYNQ_REDIS_DB" default:"1"`

	// 스케줄러 enqueue 가드(Phase 3). 기본 false면 cmd/scheduler가 기동되어도
	// 주기 작업을 실제로 등록/enqueue 하지 않는다(이중 실행 방지). Python 스케줄러에서
	// Go 스케줄러로 컷오버할 때만 true로 켠다.
	SchedulerEnabled bool `envconfig:"SCHEDULER_ENABLED" default:"false"`

	// JWT 검증은 admin 게이트/optional 인증에서 이미 사용 중이므로 시크릿은 필수다.
	// Python config.py의 `JWT_SECRET_KEY: str = Field(default=...)`(필수)와 동일하게
	// 미설정 시 fail-fast 하도록 required로 둔다(빈 시크릿 = HS256 키 []byte("")로 토큰 위조 가능).
	// auth/me(read_users_me)도 이 시크릿/알고리즘을 쓴다: Python settings.SECRET_KEY/ALGORITHM은
	// config.py에서 JWT_SECRET_KEY/JWT_ALGORITHM의 @property 별칭이라 별도 SECRET_KEY env가 없고
	// 값이 항상 동일하다. 따라서 별도 SecretKey/Algorithm 필드를 두지 않고 아래 둘만 사용한다.
	JWTSecretKey string `envconfig:"JWT_SECRET_KEY" required:"true"`
	JWTAlgorithm string `envconfig:"JWT_ALGORITHM" default:"HS256"`

	// --- auth 도메인(토큰 수명·비밀번호 정책) — Python settings와 동일 env/기본값 ---
	// access 토큰 TTL(분). Python ACCESS_TOKEN_EXPIRE_MINUTES=43200(30일).
	AccessTokenExpireMinutes int `envconfig:"ACCESS_TOKEN_EXPIRE_MINUTES" default:"43200"`
	// refresh 토큰 만료(일)·raw 바이트 수. Python REFRESH_TOKEN_EXPIRE_DAYS=30, REFRESH_TOKEN_BYTES=48.
	RefreshTokenExpireDays int `envconfig:"REFRESH_TOKEN_EXPIRE_DAYS" default:"30"`
	RefreshTokenBytes      int `envconfig:"REFRESH_TOKEN_BYTES" default:"48"`
	// 비밀번호 정책 — Python PASSWORD_* 동일.
	PasswordMinLength      int  `envconfig:"PASSWORD_MIN_LENGTH" default:"8"`
	PasswordBcryptCost     int  `envconfig:"PASSWORD_BCRYPT_COST" default:"12"`
	PasswordRequireUpper   bool `envconfig:"PASSWORD_REQUIRE_UPPERCASE" default:"true"`
	PasswordRequireLower   bool `envconfig:"PASSWORD_REQUIRE_LOWERCASE" default:"true"`
	PasswordRequireNumbers bool `envconfig:"PASSWORD_REQUIRE_NUMBERS" default:"true"`
	PasswordRequireSpecial bool `envconfig:"PASSWORD_REQUIRE_SPECIAL" default:"true"`

	// 클라이언트 최소 지원 버전 — Python settings.MIN_APP_VERSION_*과 동일 env/기본값.
	MinAppVersionAndroid string `envconfig:"MIN_APP_VERSION_ANDROID" default:"3.1.0"`
	MinAppVersionIOS     string `envconfig:"MIN_APP_VERSION_IOS" default:"3.1.0"`

	// hwgi(한화 점검) 공개 API base — 사진 URL 절대화(_absolutize_photo_url) prefix. Python settings.PUBLIC_API_BASE_URL.
	PublicAPIBaseURL string `envconfig:"PUBLIC_API_BASE_URL" default:""`
	// hwgi 점검 사진 저장 디렉토리. Python BACKEND_DIR/storage/uploads/hwgi(절대). /uploads는 Python
	// StaticFiles(backend/storage/uploads)가 서빙하므로 Go도 동일 절대경로에 써야 같은 URL로 서빙된다.
	HwgiUploadDir string `envconfig:"HWGI_UPLOAD_DIR" default:"/data/wwwroot/smap_next/backend/storage/uploads/hwgi"`
	// hwgi 사진 업로드 1건의 디코드 후 최대 크기(바이트). 초과하면 413. 기본 10MiB.
	HwgiMaxUploadBytes int `envconfig:"HWGI_MAX_UPLOAD_BYTES" default:"10485760"`

	// --- 일반 사용자 인증 미들웨어(G1) ---
	// ROUTE_AUTH_MODE: off | warn | enforce. 기본 warn(통과시키되 무토큰/무효 호출을 계측).
	// 잘못된 값은 Load에서 에러로 시작을 막는다(기본값으로 대체하지 않음).
	RouteAuthModeRaw string `envconfig:"ROUTE_AUTH_MODE" default:"warn"`
	// 회원 상태(탈퇴·정지·비노출) 조회 결과를 프로세스 내에 캐시하는 시간(초). 0이면 캐시 안 함.
	// 캐시를 쓰면 탈퇴·정지가 최대 이 시간만큼 늦게 반영된다.
	RouteAuthStatusCacheTTLSeconds int `envconfig:"ROUTE_AUTH_STATUS_CACHE_TTL_SECONDS" default:"30"`
	// warn 계측 카운터를 요약 로그로 내보내는 주기(초).
	RouteAuthSummaryIntervalSeconds int `envconfig:"ROUTE_AUTH_SUMMARY_INTERVAL_SECONDS" default:"60"`

	// --- 위치 정보 보호(G6) ---
	// LOCATION_AUTH_MODE: inherit | warn | enforce. 위치 라우트의 무토큰 요청 처리. inherit이면 ROUTE_AUTH_MODE를 따른다.
	// 토큰이 있는 요청에는 모드와 무관하게 항상 소유권·멤버십 검사(403)를 한다. 잘못된 값은 Load에서 에러.
	LocationAuthModeRaw string `envconfig:"LOCATION_AUTH_MODE" default:"inherit"`
	// 켜면 위치 업로드(create_location_log)에 유효한 토큰이 없을 때 401. 꺼져 있으면 기존대로 본문 mt_idx로 기록하되 계측한다.
	LocationWriteRequireToken bool `envconfig:"LOCATION_WRITE_REQUIRE_TOKEN" default:"false"`
	// 켜면(기본, 구버전 앱 호환) 내 장소 생성·수정·삭제·알림 변경을 소유자 외에 같은 그룹의 방장
	// (리더는 방장이 아닌 대상만)에게도 허용한다. 끄면 소유자 본인만. 구버전 앱이 방장·리더 대리 편집을 한다.
	LocationPlaceLeaderManage bool `envconfig:"LOCATION_PLACE_LEADER_MANAGE" default:"true"`
	// 일정 인가(G7). SCHEDULE_NONLEADER_TARGET_OTHERS=true(기본, 구버전 호환): 일반 멤버도 같은 그룹 현재 멤버를 대상으로
	// 일정을 만들 수 있다(구버전 Android 기본 대상이 그룹장). false면 타인 일정은 그룹장·리더만.
	// SCHEDULE_LEADER_MANAGE_OWNER=false(기본): 리더는 그룹장의 일정을 수정·삭제·대상 지정할 수 없다(앱 규칙).
	ScheduleNonleaderTargetOthers bool `envconfig:"SCHEDULE_NONLEADER_TARGET_OTHERS" default:"true"`
	ScheduleLeaderManageOwner     bool `envconfig:"SCHEDULE_LEADER_MANAGE_OWNER" default:"false"`
	// 채팅 소켓 수신 시점 멤버십 확인 캐시 수명(초). 허용 결과만 캐시. 0이면 매번 조회.
	ChatMembershipCacheTTLSeconds int `envconfig:"CHAT_MEMBERSHIP_CACHE_TTL_SECONDS" default:"10"`

	// --- 그룹 권한(G7) ---
	// 켜면 초대 코드 없는 그룹 가입(POST /groups/:id/join에 sgt_code 없음)을 403으로 거부한다. 기본 false:
	// 구버전 앱(Android 3.2.7, iOS 3.2.0)은 코드 조회 후 그룹 번호만으로 가입한다. 코드가 요청에 있으면 이 값과 무관하게 항상 검증한다.
	RequireGroupInviteCode bool `envconfig:"REQUIRE_GROUP_INVITE_CODE" default:"false"`
	// 초대 코드 조회(GET /groups/code/:code)·코드 가입·코드가 담긴 가입의 호출 한도: 회원당 / IP당, 고정 창(초). 초과 시 429, Redis 장애 시 503.
	GroupCodeLimitPerMember int `envconfig:"GROUP_CODE_LIMIT_PER_MEMBER" default:"30"`
	GroupCodeLimitPerIP     int `envconfig:"GROUP_CODE_LIMIT_PER_IP" default:"300"`
	GroupCodeWindowSeconds  int `envconfig:"GROUP_CODE_WINDOW_SECONDS" default:"3600"`

	// --- 소셜 로그인 공급자 토큰 검증(G5) ---
	// SOCIAL_TOKEN_VERIFICATION: off | when_present | required. 기본 when_present
	// (토큰이 있으면 검증·실패 시 거부, 없으면 기존 동작 + 경고 계측). 잘못된 값은 Load에서 에러.
	SocialTokenVerificationRaw string `envconfig:"SOCIAL_TOKEN_VERIFICATION" default:"when_present"`
	// 허용 목록(쉼표 구분). Google은 id_token의 aud(웹/iOS 클라이언트 ID), Apple은 identityToken의 aud(번들 ID),
	// Kakao는 앱 ID(숫자). 비어 있으면 해당 공급자 검증은 503(조용히 건너뛰지 않는다).
	GoogleAllowedClientIDsRaw string `envconfig:"GOOGLE_ALLOWED_CLIENT_IDS" default:""`
	AppleAllowedBundleIDsRaw  string `envconfig:"APPLE_ALLOWED_BUNDLE_IDS" default:""`
	KakaoAllowedAppID         string `envconfig:"KAKAO_ALLOWED_APP_ID" default:""`

	// TRUSTED_CLIENT_IP_HEADER: 한도(rate limit)용 클라이언트 IP를 읽을 신뢰 헤더 이름(예: CF-Connecting-IP).
	// 직접 접속 상대가 loopback/사설 대역일 때만 이 헤더를 믿는다. 비어 있으면 직접 접속 주소만 사용한다
	// (터널·프록시 뒤에서는 모든 사용자가 한 주소로 합산되므로 운영에서는 반드시 설정).
	TrustedClientIPHeader string `envconfig:"TRUSTED_CLIENT_IP_HEADER" default:""`

	// --- 남용 방지(G8) ---
	// SMS 인증번호 발송 한도: 번호당 / IP당, 고정 창(초). 초과 시 429. SMS는 건당 과금이라 Redis 장애 시에는 503이다.
	SMSSendLimitPerPhone int `envconfig:"SMS_SEND_LIMIT_PER_PHONE" default:"5"`
	SMSSendLimitPerIP    int `envconfig:"SMS_SEND_LIMIT_PER_IP" default:"20"`
	SMSSendWindowSeconds int `envconfig:"SMS_SEND_WINDOW_SECONDS" default:"3600"`
	// 인증번호 하나에 허용하는 검증 시도 횟수. 초과하면 코드를 폐기한다(재요청 필요).
	SMSVerifyMaxAttempts int `envconfig:"SMS_VERIFY_MAX_ATTEMPTS" default:"5"`
	// 가입 여부 확인(/members/check/*) IP당 한도, 고정 창(초). 초과 시 429. 종류(phone/email/nickname)별로 따로 센다.
	MemberCheckLimitPerIP    int `envconfig:"MEMBER_CHECK_LIMIT_PER_IP" default:"60"`
	MemberCheckWindowSeconds int `envconfig:"MEMBER_CHECK_WINDOW_SECONDS" default:"60"`

	// --- 가입·로그인 정책(G4) ---
	// 토큰(email_verification_token) 없는 구버전 호환 가입(전화번호/소셜 ID 평문)을 허용할지. 꺼지면 400 "본인인증이 필요합니다.".
	AllowLegacyPhoneRegister bool `envconfig:"ALLOW_LEGACY_PHONE_REGISTER" default:"true"`
	// 구버전 가입에서 서버에 SMS 인증 완료 상태(Redis)가 있어야 하는지. iOS 3.2.0은 서버 verify-code를 호출하지 않으므로 기본 false.
	LegacyRegisterRequireSMSVerified bool `envconfig:"LEGACY_REGISTER_REQUIRE_SMS_VERIFIED" default:"false"`
	// 소셜 가입에 공급자 토큰(social_provider+social_token)을 강제할지. 구버전은 가입에 토큰을 보내지 않으므로 기본 false.
	SocialRegisterRequireToken bool `envconfig:"SOCIAL_REGISTER_REQUIRE_TOKEN" default:"false"`
	// 토큰 없는 소셜 가입에 "공급자 토큰을 검증한 소셜 로그인(신규 사용자 판정) 증거(Redis 15분)"를 요구할지. 기본 false.
	SocialRegisterRequireLoginProof bool `envconfig:"SOCIAL_REGISTER_REQUIRE_LOGIN_PROOF" default:"false"`
	// 로그인 실패 한도: 계정(정규화 ID)당 / IP당, 고정 창(초). 초과 시 429.
	LoginFailLimitPerAccount int `envconfig:"LOGIN_FAIL_LIMIT_PER_ACCOUNT" default:"10"`
	LoginFailLimitPerIP      int `envconfig:"LOGIN_FAIL_LIMIT_PER_IP" default:"100"`
	LoginFailWindowSeconds   int `envconfig:"LOGIN_FAIL_WINDOW_SECONDS" default:"900"`

	// --- 프리미엄 구독(G10) ---
	// 혜택 강제 스위치. false(기본)면 무료 제한(내 장소 2개, 활동 기록 2일)을 적용하지 않고 "강제했다면 막혔을 요청" 수만 센다.
	// 스토어 상품 등록과 새 앱 배포가 끝난 뒤에 켠다. /subscriptions/me의 enforcement_enabled도 이 값이다.
	SubscriptionEnforcementEnabled bool `envconfig:"SUBSCRIPTION_ENFORCEMENT_ENABLED" default:"false"`
	// 샌드박스(테스트) 거래를 받을지. 기본 false(운영 보호). App Store 심사는 샌드박스 거래로 진행되므로 심사 기간에만 켠다.
	SubscriptionAllowSandbox bool `envconfig:"SUBSCRIPTION_ALLOW_SANDBOX" default:"false"`
	// 혜택 한도(계약 4절). 무료 장소 수 / 무료·프리미엄 활동 기록 조회 일수(오늘 포함).
	SubscriptionFreeMaxPlaces  int `envconfig:"SUBSCRIPTION_FREE_MAX_PLACES" default:"2"`
	SubscriptionFreeLogDays    int `envconfig:"SUBSCRIPTION_FREE_LOG_DAYS" default:"2"`
	SubscriptionPremiumLogDays int `envconfig:"SUBSCRIPTION_PREMIUM_LOG_DAYS" default:"14"`
	// 상품 → 플랜(month/year) 매핑(계약 1절 기본값). Apple은 상품 ID, Google은 기본 요금제(base plan) ID로 구분한다.
	SubscriptionAppleMonthProductID string `envconfig:"SUBSCRIPTION_APPLE_MONTH_PRODUCT_ID" default:"com.dmonster.smap.sub_month"`
	SubscriptionAppleYearProductID  string `envconfig:"SUBSCRIPTION_APPLE_YEAR_PRODUCT_ID" default:"com.dmonster.smap.sub_year"`
	SubscriptionGoogleMonthBasePlan string `envconfig:"SUBSCRIPTION_GOOGLE_MONTH_BASE_PLAN" default:"monthly"`
	SubscriptionGoogleYearBasePlan  string `envconfig:"SUBSCRIPTION_GOOGLE_YEAR_BASE_PLAN" default:"yearly"`
	// 만료된 프리미엄 회원의 mt_level(5→2) 보정 주기(초). 0(기본)이면 끈다 — 켜면 만료 상태로 남은 기존 유료 회원의 표시 등급이
	// 일괄로 2가 된다. 꺼져 있어도 구독 검증·알림·/subscriptions/me 때 해당 회원은 보정된다.
	SubscriptionLapseSyncIntervalSeconds int `envconfig:"SUBSCRIPTION_LAPSE_SYNC_INTERVAL_SECONDS" default:"0"`
	// 구매를 회원 계정에 묶는 토큰(M-1)의 HMAC 비밀. 비면 /subscriptions/me 가 account_token 을 내려주지 않고(앱은 토큰을 넣지 않음)
	// 증빙의 계정 토큰 대조도 하지 않는다. JWT_SECRET_KEY 에서 파생하지 않는다(키 용도 분리). 설정하면 32자 이상.
	SubscriptionAccountTokenSecret string `envconfig:"SUBSCRIPTION_ACCOUNT_TOKEN_SECRET" default:""`
	// /subscriptions/verify 호출 한도(L-1): 회원별·IP별, 고정 창. 정상 사용(구매 직후 + 앱 실행 시 확인)은 시간당 한 자릿수다.
	SubscriptionVerifyLimitPerMember int `envconfig:"SUBSCRIPTION_VERIFY_LIMIT_PER_MEMBER" default:"30"`
	SubscriptionVerifyLimitPerIP     int `envconfig:"SUBSCRIPTION_VERIFY_LIMIT_PER_IP" default:"300"`
	SubscriptionVerifyWindowSeconds  int `envconfig:"SUBSCRIPTION_VERIFY_WINDOW_SECONDS" default:"3600"`
	// 스토어 알림 두 경로의 IP당 분당 한도(L-1). 스토어가 보내는 정상 트래픽(재시도 포함)보다 한참 크게 둔다. 초과하면 429(스토어가 재시도).
	SubscriptionNotifyLimitPerIPPerMinute int `envconfig:"SUBSCRIPTION_NOTIFY_LIMIT_PER_IP_PER_MINUTE" default:"600"`
	// 스토어 검증 설정(internal/subscription/store.Config와 1:1). 값은 로그에 남기지 않는다. 비어 있으면 해당 스토어 경로는 503.
	AppleBundleID                  string `envconfig:"APPLE_BUNDLE_ID" default:""`
	AppleRootCAPath                string `envconfig:"APPLE_ROOT_CA_PATH" default:""`
	AppleRootCASHA256              string `envconfig:"APPLE_ROOT_CA_SHA256" default:""`
	GooglePlayPackageName          string `envconfig:"GOOGLE_PLAY_PACKAGE_NAME" default:""`
	GooglePlayProductIDsRaw        string `envconfig:"GOOGLE_PLAY_PRODUCT_IDS" default:""`
	GooglePlayServiceAccount       string `envconfig:"GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" default:""`
	GooglePlayServiceAccountInline string `envconfig:"GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64" default:""`
	GoogleRTDNAudience             string `envconfig:"GOOGLE_RTDN_AUDIENCE" default:""`
	GoogleRTDNServiceAccount       string `envconfig:"GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL" default:""`

	// 프로필 이미지 저장 디렉토리(members upload/delete-profile-image). Python은 cwd 기준 상대
	// public/images에 저장하나, 실제 /images 서빙은 Python FastAPI StaticFiles(BASE_DIR/public/images,
	// 절대경로)이다. Go cwd=backend-go라 상대경로를 쓰면 안 되고, Python과 동일한 절대경로에 써야
	// 같은 /images URL로 서빙된다. 기본값=Python BASE_DIR/public/images.
	ProfileImageDir string `envconfig:"PROFILE_IMAGE_DIR" default:"/data/wwwroot/smap_next/backend/public/images"`

	// --- Phase 3 배치 잡 설정 ---------------------------------------------
	// 기상청(KMA) 동네예보 서비스키. weather:refresh 잡의 fetch_kma_forecast가 사용한다.
	// required로 두지 않는다: Python처럼 미설정 시 잡이 로그+skip만 하도록(워커 부팅은 성공해야 함).
	// backend/.env에 KMA_SERVICE_KEY가 있으면 config.Load가 ../backend/.env를 읽어 자동 주입된다.
	KMAServiceKey string `envconfig:"KMA_SERVICE_KEY"`

	// OpenAI — 이번 단계(무발송)에선 미사용. 다음 FCM/AI 단계 대비 정의만. 결정: 정적 폴백만 쓰므로
	// 모델 기본값은 비용 낮은 gpt-4o-mini로 둔다.
	OpenAIAPIKey string `envconfig:"OPENAI_API_KEY"`
	OpenAIModel  string `envconfig:"OPENAI_MODEL" default:"gpt-4o-mini"`

	// Firebase 자격증명 — 이번 단계엔 fcm.New 초기화 입력으로만 쓰이고 실발송은 다음 단계.
	// 3단 폴백: JSON(인라인) → Path(파일) → 개별 env(ProjectID 등). Path 기본값은 backend/ 디렉토리의 SDK 파일.
	FirebaseCredentialsJSON string `envconfig:"FIREBASE_CREDENTIALS_JSON"`
	FirebaseCredentialsPath string `envconfig:"FIREBASE_CREDENTIALS_PATH" default:"com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"`
	FirebaseProjectID       string `envconfig:"FIREBASE_PROJECT_ID"`

	// iOS APNs topic(apns-topic 헤더)·안드로이드 알림 채널 — fcm.buildMessage 페이로드용. 다음 단계에서 사용.
	IOSBundleID         string `envconfig:"IOS_BUNDLE_ID"`
	FCMAndroidChannelID string `envconfig:"FCM_ANDROID_CHANNEL_ID" default:"com.dmonster.smap-Smap"`

	// --- SMS/이메일 발송 도메인 -----------------------------------------
	// Aligo SMS API 자격증명(Python settings.ALIGO_*). 미설정 시 발송은 실패 경로로 수렴(Python 동일).
	AligoUserID string `envconfig:"ALIGO_USER_ID" default:""`
	AligoKey    string `envconfig:"ALIGO_KEY" default:""`
	AligoSender string `envconfig:"ALIGO_SENDER" default:""`
	// Fixie 프록시(고정 IP). 설정 시 Aligo 호출을 프록시 경유(Python os.getenv('FIXIE_URL')).
	FixieURL string `envconfig:"FIXIE_URL" default:""`
	// Gmail SMTP 폴백 자격증명(Python settings.EMAIL_SENDER/PASSWORD). 미설정 시 SMTP 발송 실패.
	EmailSender   string `envconfig:"EMAIL_SENDER" default:""`
	EmailPassword string `envconfig:"EMAIL_PASSWORD" default:""`
	// SMTP 서버·포트(기본 Gmail 465). 네이버웍스 SMTP는 smtp.worksmobile.com:465. 465는 암묵적 TLS, 그 외는 STARTTLS.
	EmailSMTPServer string `envconfig:"EMAIL_SMTP_SERVER" default:"smtp.gmail.com"`
	EmailSMTPPort   int    `envconfig:"EMAIL_SMTP_PORT" default:"465"`
	// 네이버웍스 메일 API(우선 발송 경로). 미설정 시 Gmail SMTP로 폴백(Python os.getenv).
	NaverworksClientID     string `envconfig:"NAVERWORKS_CLIENT_ID" default:""`
	NaverworksClientSecret string `envconfig:"NAVERWORKS_CLIENT_SECRET" default:""`
	NaverworksDomain       string `envconfig:"NAVERWORKS_DOMAIN" default:""`

	// Python의 BACKEND_CORS_ORIGINS와 동일한 정책.
	// 콤마 분리 문자열 또는 환경변수 미설정 시 기본값 사용.
	corsOriginsRaw string `envconfig:"BACKEND_CORS_ORIGINS" default:""`
}

// MySQLDSN은 go-sql-driver/mysql 형식 DSN을 반환한다.
// Python의 SQLALCHEMY_DATABASE_URI와 동일한 접속 정보를 사용한다.
func (c *Config) MySQLDSN() string {
	// interpolateParams=true: 파라미터를 클라이언트에서 안전하게 보간해 평문 쿼리(텍스트 프로토콜)로
	// 실행한다. Python(pymysql)도 텍스트 프로토콜이라, MySQL FLOAT(32비트) 컬럼을 서버가 포맷한
	// 문자열로 받아 동일하게 파싱한다. 이진 프로토콜(prepared)은 float32를 부정확하게 확장(예
	// 0.412501 → 0.4125005)해 byte-동등을 깨므로 반드시 텍스트 프로토콜을 사용해야 한다.
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=true&loc=Local&interpolateParams=true",
		c.MySQLUser, c.MySQLPassword, c.MySQLHost, c.MySQLPort, c.MySQLDB, c.MySQLCharset,
	)
}

// CORSOrigins는 Python의 BACKEND_CORS_ORIGINS 기본값과 동일한 origin 목록을 반환한다.
// 환경변수로 override 시 콤마 분리.
func (c *Config) CORSOrigins() []string {
	defaults := []string{
		"http://localhost:3000",
		"http://localhost:8000",
		"https://nextstep.smap.site",
		"https://smap.co.kr",
		"https://hwgi-cstmer.vercel.app",
		"http://api3.smap.site:3000",
		"https://api3.smap.site:3000",
		"http://127.0.0.1:3000",
	}
	if c.corsOriginsRaw == "" {
		return defaults
	}
	parts := strings.Split(c.corsOriginsRaw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return defaults
	}
	return out
}

// Load는 .env(있으면) 로드 후 환경변수에서 Config를 빌드한다.
// envPath가 빈 문자열이면 ../backend/.env (Python과 동일 파일) → ./.env 순으로 탐색한다.
func Load(envPath string) (*Config, error) {
	if envPath == "" {
		candidates := []string{
			filepath.Join("..", "api", ".env"),     // 모노레포 구조: apps/api-go → apps/api
			filepath.Join("..", "backend", ".env"), // 구 구조 호환
			".env",
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				envPath = p
				break
			}
		}
	}
	if envPath != "" {
		// .env 부재해도 환경변수만으로 동작 가능해야 하므로 에러는 무시.
		_ = godotenv.Load(envPath)
	}

	var c Config
	if err := envconfig.Process("", &c); err != nil {
		return nil, fmt.Errorf("config load: %w", err)
	}
	// envconfig가 unexported 필드를 채울 수 없으므로 수동 보강.
	c.corsOriginsRaw = os.Getenv("BACKEND_CORS_ORIGINS")
	if err := c.validateRouteAuth(); err != nil {
		return nil, err
	}
	if _, err := auth.ParseLocationAuthMode(c.LocationAuthModeRaw); err != nil {
		return nil, fmt.Errorf("config load: %w", err)
	}
	if err := c.validateSocial(); err != nil {
		return nil, err
	}
	if err := c.validateAuthPolicy(); err != nil {
		return nil, err
	}
	if err := c.validateAbuse(); err != nil {
		return nil, err
	}
	if err := c.validateGroupPolicy(); err != nil {
		return nil, err
	}
	if err := c.validateSubscription(); err != nil {
		return nil, err
	}
	return &c, nil
}

// RouteAuthMode는 검증된 ROUTE_AUTH_MODE를 반환한다. Load가 값을 검증하므로 정상 경로에선 에러가 없다.
func (c *Config) RouteAuthMode() (auth.RouteMode, error) {
	return auth.ParseRouteMode(c.RouteAuthModeRaw)
}

// LocationAuthMode는 검증된 LOCATION_AUTH_MODE를 반환한다.
func (c *Config) LocationAuthMode() (auth.LocationAuthMode, error) {
	return auth.ParseLocationAuthMode(c.LocationAuthModeRaw)
}

// validateRouteAuth는 인증 미들웨어 설정을 시작 시 검증한다(잘못된 값은 명확히 실패).
func (c *Config) validateRouteAuth() error {
	if _, err := auth.ParseRouteMode(c.RouteAuthModeRaw); err != nil {
		return fmt.Errorf("config load: %w", err)
	}
	if c.RouteAuthStatusCacheTTLSeconds < 0 || c.RouteAuthStatusCacheTTLSeconds > 300 {
		return fmt.Errorf("config load: ROUTE_AUTH_STATUS_CACHE_TTL_SECONDS는 0~300이어야 합니다: %d", c.RouteAuthStatusCacheTTLSeconds)
	}
	if c.RouteAuthSummaryIntervalSeconds < 5 || c.RouteAuthSummaryIntervalSeconds > 3600 {
		return fmt.Errorf("config load: ROUTE_AUTH_SUMMARY_INTERVAL_SECONDS는 5~3600이어야 합니다: %d", c.RouteAuthSummaryIntervalSeconds)
	}
	if c.HwgiMaxUploadBytes < 1 {
		return fmt.Errorf("config load: HWGI_MAX_UPLOAD_BYTES는 1 이상이어야 합니다: %d", c.HwgiMaxUploadBytes)
	}
	return nil
}
