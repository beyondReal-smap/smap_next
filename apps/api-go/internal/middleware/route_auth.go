package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// ctxUserIDKey는 검증된 회원 번호를 gin 컨텍스트에 넣는 키다.
// RequireAdmin이 이미 같은 키("user_id", int)를 쓰므로 핸들러는 UserID 헬퍼 하나로 둘 다 읽는다.
const ctxUserIDKey = "user_id"

// UserID는 인증 미들웨어(RouteAuth.Required/Optional, RequireAdmin)가 컨텍스트에 넣은
// 검증된 회원 번호(mt_idx)를 꺼낸다. 미들웨어가 붙지 않았거나 토큰이 없으면 (0, false).
func UserID(c *gin.Context) (int, bool) {
	v, ok := c.Get(ctxUserIDKey)
	if !ok {
		return 0, false
	}
	uid, ok := v.(int)
	if !ok || uid <= 0 {
		return 0, false
	}
	return uid, true
}

// MemberStateReader는 인증 미들웨어가 회원 상태를 읽는 데 필요한 좁은 인터페이스다.
// (구현은 repository.MemberRepository. 미들웨어가 gorm에 직접 의존하지 않게 한다.)
// 회원이 없으면 (nil, nil).
type MemberStateReader interface {
	GetAccessState(mtIdx int) (*model.MemberAccessState, error)
}

// RouteAuthOptions는 RouteAuth 생성 옵션이다.
type RouteAuthOptions struct {
	Mode      auth.RouteMode
	Secret    string
	Algorithm string
	// StatusCacheTTL은 회원 상태 조회 결과의 프로세스 내 캐시 수명이다. 0이면 캐시하지 않는다.
	// 캐시를 쓰면 탈퇴·정지 반영이 최대 이 시간만큼 늦어진다.
	StatusCacheTTL time.Duration
	// SummaryInterval은 warn 계측 카운터를 요약 로그로 내보내는 주기다(0이면 요약 로그 비활성).
	SummaryInterval time.Duration
	// Revocation은 비밀번호 변경 후 구 access token 무효화 기준(nil이면 비교하지 않는다).
	// 조회 실패(Redis 장애)는 통과 + 경고 로그다.
	Revocation auth.AccessRevocationChecker
	// Scope는 요약 로그에 scope 필드로 찍는 이 인스턴스의 이름이다(예: "location"). 비면 필드를 생략한다.
	Scope string
	// Now는 캐시 만료 판정용 시계다. nil이면 time.Now(). 테스트에서 주입한다.
	Now func() time.Time
}

const (
	// 요약 한 번에 서로 다른 (라우트, 메서드, 클라이언트, 종류) 조합을 최대 이만큼만 센다.
	// UA가 제각각인 스캐너가 메모리를 키우는 것을 막는다. 초과분은 overflow로만 센다.
	maxSummaryKeys = 1000
	// 상태 캐시 최대 항목 수. 가득 차면 만료분을 먼저 치우고, 그래도 차 있으면 전부 비운다.
	maxStatusCacheEntries = 20000
)

// 계측 종류(kind)와 처리(action) 값.
const (
	kindNoToken      = "no_token"
	kindInvalidToken = "invalid_token"
	kindBlocked      = "blocked_member"
	kindUnknown      = "unknown_member"
	kindRevoked      = "revoked_token"

	actionAllowed  = "allowed"
	actionRejected = "rejected"
)

type summaryKey struct {
	route  string
	method string
	client string
	kind   string
	action string
}

type statusEntry struct {
	state   *model.MemberAccessState // nil이면 회원 없음
	expires time.Time
}

// RouteAuth는 일반 사용자 인증 미들웨어(ROUTE_AUTH_MODE off|warn|enforce)다.
//
//   - off:     아무 것도 하지 않는다.
//   - warn:    토큰이 없거나 무효여도 통과시키되 (라우트 패턴, 메서드, 앱 식별, 종류) 카운터만 올린다.
//   - enforce: 토큰이 없거나 무효면 401.
//
// warn/enforce 공통: 유효한 토큰이면 DB에서 회원 상태를 확인해 탈퇴(mt_level=1)·정지(mt_status=2)·
// 비노출(mt_show='N') 회원은 401로 거부한다(NULL은 통과). 통과하면 UserID로 꺼낼 수 있게 컨텍스트에 넣는다.
type RouteAuth struct {
	opts    RouteAuthOptions
	members MemberStateReader
	logger  *slog.Logger

	cacheMu sync.Mutex
	cache   map[int]statusEntry

	sumMu    sync.Mutex
	counters map[summaryKey]int
	overflow int
}

// NewRouteAuth는 RouteAuth를 만든다. 잘못된 모드·빈 시크릿은 에러로 알린다(기본값으로 숨기지 않는다).
func NewRouteAuth(opts RouteAuthOptions, members MemberStateReader, logger *slog.Logger) (*RouteAuth, error) {
	switch opts.Mode {
	case auth.RouteModeOff, auth.RouteModeWarn, auth.RouteModeEnforce:
	default:
		return nil, fmt.Errorf("route auth: 알 수 없는 모드 %q", opts.Mode)
	}
	if opts.Mode != auth.RouteModeOff {
		if opts.Secret == "" {
			return nil, fmt.Errorf("route auth: JWT 시크릿이 비어 있습니다")
		}
		if members == nil {
			return nil, fmt.Errorf("route auth: 회원 상태 조회기가 필요합니다")
		}
	}
	if opts.StatusCacheTTL < 0 || opts.SummaryInterval < 0 {
		return nil, fmt.Errorf("route auth: TTL/요약 주기는 음수일 수 없습니다")
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &RouteAuth{
		opts:     opts,
		members:  members,
		logger:   logger,
		cache:    make(map[int]statusEntry),
		counters: make(map[summaryKey]int),
	}, nil
}

// Mode는 현재 모드를 반환한다.
func (r *RouteAuth) Mode() auth.RouteMode { return r.opts.Mode }

// Required는 인증이 필요한 라우트 그룹에 붙이는 미들웨어다(모드에 따라 warn/enforce).
func (r *RouteAuth) Required() gin.HandlerFunc { return r.handler(false) }

// Optional은 선택 인증 변형이다: 토큰이 없거나 무효여도 모드와 상관없이 통과시킨다.
// 유효한 토큰이면 회원 상태를 확인하고(탈퇴·정지·비노출 → 401) 통과 시 컨텍스트에 회원 번호를 넣는다.
func (r *RouteAuth) Optional() gin.HandlerFunc { return r.handler(true) }

func (r *RouteAuth) handler(optional bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if r.opts.Mode == auth.RouteModeOff {
			c.Next()
			return
		}
		enforce := r.opts.Mode == auth.RouteModeEnforce && !optional

		ident, state := auth.VerifyAccessTokenIdentity(c.GetHeader("Authorization"), r.opts.Secret, r.opts.Algorithm)
		uid := ident.MtIdx
		switch state {
		case auth.TokenAbsent, auth.TokenInvalid:
			kind := kindNoToken
			if state == auth.TokenInvalid {
				kind = kindInvalidToken
			}
			if enforce {
				r.record(c, kind, actionRejected)
				abortUnauthorized(c)
				return
			}
			if !optional {
				// 선택 인증에서 토큰이 없는 것은 정상이라 계측하지 않는다.
				r.record(c, kind, actionAllowed)
			}
			c.Next()
			return
		}

		// 비밀번호 변경 이전에 발급된 토큰은 모드와 무관하게(탈퇴·정지와 같이) 거부한다.
		if auth.AccessRevoked(r.opts.Revocation, r.logger, ident) {
			r.record(c, kindRevoked, actionRejected)
			abortUnauthorized(c)
			return
		}

		member, err := r.memberState(uid)
		if err != nil {
			// 상태를 확인하지 못했는데 통과시키면 탈퇴·정지 회원이 그대로 지나간다. 원인을 숨기지 않고 500.
			r.logger.Error("route_auth_member_lookup_failed",
				slog.String("route", routeLabel(c)), slog.String("err", err.Error()))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
			return
		}
		if member == nil {
			// 서명은 맞지만 회원이 없는 토큰(하드 삭제된 회원). 무효 토큰과 같게 다룬다.
			if enforce {
				r.record(c, kindUnknown, actionRejected)
				abortUnauthorized(c)
				return
			}
			if !optional {
				r.record(c, kindUnknown, actionAllowed)
			}
			c.Next()
			return
		}
		if member.IsBlocked() {
			r.record(c, kindBlocked, actionRejected)
			abortUnauthorized(c)
			return
		}

		c.Set(ctxUserIDKey, uid)
		c.Next()
	}
}

// abortUnauthorized는 RequireAdmin/FastAPI get_required_user_id와 같은 401 응답이다.
func abortUnauthorized(c *gin.Context) {
	c.Header("WWW-Authenticate", "Bearer")
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
}

// memberState는 캐시를 거쳐 회원 상태를 조회한다. 회원이 없으면 (nil, nil).
func (r *RouteAuth) memberState(uid int) (*model.MemberAccessState, error) {
	ttl := r.opts.StatusCacheTTL
	if ttl <= 0 {
		return r.members.GetAccessState(uid)
	}
	now := r.opts.Now()

	r.cacheMu.Lock()
	if e, ok := r.cache[uid]; ok && now.Before(e.expires) {
		r.cacheMu.Unlock()
		return e.state, nil
	}
	r.cacheMu.Unlock()

	// 락을 잡은 채 DB를 호출하지 않는다. 같은 회원의 동시 miss는 각자 조회하지만 결과는 동일하다.
	state, err := r.members.GetAccessState(uid)
	if err != nil {
		return nil, err
	}

	r.cacheMu.Lock()
	if len(r.cache) >= maxStatusCacheEntries {
		for k, e := range r.cache {
			if !now.Before(e.expires) {
				delete(r.cache, k)
			}
		}
		if len(r.cache) >= maxStatusCacheEntries {
			r.cache = make(map[int]statusEntry)
		}
	}
	r.cache[uid] = statusEntry{state: state, expires: now.Add(ttl)}
	r.cacheMu.Unlock()
	return state, nil
}

// routeLabel은 라우트 패턴(예: /api/v1/logs/member-location-logs/:mt_idx/daily-summary)을 돌려준다.
// 실제 경로·쿼리 값은 쓰지 않는다.
func routeLabel(c *gin.Context) string {
	if p := c.FullPath(); p != "" {
		return p
	}
	return "unmatched"
}

// clientLabel은 User-Agent에서 앱 식별 부분(첫 product 토큰, 예: "okhttp/4.12.0")만 남긴다.
// 기기·OS 상세는 버린다. 길이를 제한하고 제어문자는 걸러 로그 인젝션을 막는다.
func clientLabel(ua string) string {
	ua = strings.TrimSpace(ua)
	if ua == "" {
		return "none"
	}
	if i := strings.IndexAny(ua, " ("); i >= 0 {
		ua = ua[:i]
	}
	var b strings.Builder
	for _, ch := range ua {
		if b.Len() >= 40 {
			break
		}
		switch {
		case ch >= 'a' && ch <= 'z', ch >= 'A' && ch <= 'Z', ch >= '0' && ch <= '9',
			ch == '.', ch == '-', ch == '_', ch == '/', ch == '+':
			b.WriteRune(ch)
		default:
			b.WriteRune('?')
		}
	}
	if b.Len() == 0 {
		return "none"
	}
	return b.String()
}

// RecordEvent는 핸들러가 판단한 추가 계측(예: 위치 업로드 무토큰 통과)을 같은 카운터에 올린다.
// kind·action은 호출 측 상수이며 토큰·회원 번호·좌표를 넘기면 안 된다.
func (r *RouteAuth) RecordEvent(c *gin.Context, kind, action string) { r.record(c, kind, action) }

// record는 계측 카운터를 올린다. 토큰·회원 번호·쿼리 값은 어디에도 남기지 않는다.
func (r *RouteAuth) record(c *gin.Context, kind, action string) {
	k := summaryKey{
		route:  routeLabel(c),
		method: c.Request.Method,
		client: clientLabel(c.GetHeader("User-Agent")),
		kind:   kind,
		action: action,
	}
	r.sumMu.Lock()
	defer r.sumMu.Unlock()
	if _, exists := r.counters[k]; !exists && len(r.counters) >= maxSummaryKeys {
		r.overflow++
		return
	}
	r.counters[k]++
}

// flushSummary는 누적 카운터를 요약 로그로 내보내고 비운다.
// 조합마다 한 줄씩(count 내림차순) 남기므로 요청 수가 아니라 서로 다른 조합 수만큼만 출력된다.
func (r *RouteAuth) flushSummary(window time.Duration) {
	r.sumMu.Lock()
	counters, overflow := r.counters, r.overflow
	r.counters, r.overflow = make(map[summaryKey]int), 0
	r.sumMu.Unlock()

	if len(counters) == 0 && overflow == 0 {
		return
	}
	type row struct {
		k summaryKey
		n int
	}
	rows := make([]row, 0, len(counters))
	for k, n := range counters {
		rows = append(rows, row{k, n})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].n != rows[j].n {
			return rows[i].n > rows[j].n
		}
		if rows[i].k.route != rows[j].k.route {
			return rows[i].k.route < rows[j].k.route
		}
		return rows[i].k.method < rows[j].k.method
	})
	for _, rw := range rows {
		scope := r.opts.Scope
		if scope == "" {
			scope = "default"
		}
		r.logger.Warn("route_auth_summary",
			slog.String("scope", scope),
			slog.String("mode", string(r.opts.Mode)),
			slog.String("route", rw.k.route),
			slog.String("method", rw.k.method),
			slog.String("client", rw.k.client),
			slog.String("kind", rw.k.kind),
			slog.String("action", rw.k.action),
			slog.Int("count", rw.n),
			slog.Int("window_sec", int(window/time.Second)),
		)
	}
	if overflow > 0 {
		r.logger.Warn("route_auth_summary_overflow",
			slog.String("mode", string(r.opts.Mode)),
			slog.Int("dropped_events", overflow),
			slog.Int("window_sec", int(window/time.Second)),
		)
	}
}

// Run은 SummaryInterval마다 요약 로그를 내보내는 루프다. ctx가 취소되면 마지막으로 한 번 더
// 내보내고 반환한다(남은 카운터 유실 방지). off 모드이거나 주기가 0이면 즉시 반환한다.
// 호출 측은 `go ra.Run(ctx)` 후 종료 시 반환을 기다려 고루틴 누수를 막는다.
func (r *RouteAuth) Run(ctx context.Context) {
	if r.opts.Mode == auth.RouteModeOff || r.opts.SummaryInterval <= 0 {
		return
	}
	ticker := time.NewTicker(r.opts.SummaryInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			r.flushSummary(r.opts.SummaryInterval)
		case <-ctx.Done():
			r.flushSummary(r.opts.SummaryInterval)
			return
		}
	}
}
