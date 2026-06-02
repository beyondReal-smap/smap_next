package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
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
			filepath.Join("..", "backend", ".env"),
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
	return &c, nil
}
