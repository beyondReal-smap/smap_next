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
	Version     string `envconfig:"VERSION" default:"1.0.0"`
	APIV1Str    string `envconfig:"API_V1_STR" default:"/api/v1"`

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
	RedisURL string `envconfig:"REDIS_URL" default:""`

	// JWT 검증은 admin 게이트/optional 인증에서 이미 사용 중이므로 시크릿은 필수다.
	// Python config.py의 `JWT_SECRET_KEY: str = Field(default=...)`(필수)와 동일하게
	// 미설정 시 fail-fast 하도록 required로 둔다(빈 시크릿 = HS256 키 []byte("")로 토큰 위조 가능).
	JWTSecretKey string `envconfig:"JWT_SECRET_KEY" required:"true"`
	JWTAlgorithm string `envconfig:"JWT_ALGORITHM" default:"HS256"`

	// 클라이언트 최소 지원 버전 — Python settings.MIN_APP_VERSION_*과 동일 env/기본값.
	MinAppVersionAndroid string `envconfig:"MIN_APP_VERSION_ANDROID" default:"3.1.0"`
	MinAppVersionIOS     string `envconfig:"MIN_APP_VERSION_IOS" default:"3.1.0"`

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
