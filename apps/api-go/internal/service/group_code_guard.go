package service

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
)

// GroupCodeGuard는 초대 코드를 다루는 호출(코드 조회, 코드 가입, 코드가 담긴 그룹 번호 가입)의 호출 한도다.
// 초대 코드는 한 번 알면 그룹의 위치 정보에 접근할 수 있는 열쇠라, 대입 공격을 회원 기준과 IP 기준으로 막는다.
// 한도는 호출 횟수 기준(고정 창)이다. 정상 가입 한 번은 조회 1 + 가입 1회라 기본 한도(회원 30/시간)에 한참 못 미친다.
//
// Redis를 쓸 수 없으면 "무제한 허용"이 아니라 503으로 실패한다(fail-closed, G8 통일 정책).
type GroupCodeGuard struct {
	store     securityStore
	perMember int
	perIP     int
	window    time.Duration
	logger    *slog.Logger
}

func NewGroupCodeGuard(store securityStore, perMember, perIP int, window time.Duration, logger *slog.Logger) *GroupCodeGuard {
	return &GroupCodeGuard{store: store, perMember: perMember, perIP: perIP, window: window, logger: logger}
}

func (g *GroupCodeGuard) log() *slog.Logger {
	if g.logger != nil {
		return g.logger
	}
	return slog.Default()
}

func groupCodeMemberKey(mtIdx int) string { return "group:code:member:" + strconv.Itoa(mtIdx) }
func groupCodeIPKey(ip string) string     { return "group:code:ip:" + ip }

// Check는 호출 1회를 기록하고 한도를 넘었으면 거부를 돌려준다. mtIdx<=0이면 회원 기준은 건너뛴다(무토큰 warn 통과분은 IP만).
// ip가 비어 있으면 IP 기준은 건너뛴다. nil이면 통과.
func (g *GroupCodeGuard) Check(ctx context.Context, mtIdx int, ip string) *AuthRejection {
	if g == nil || g.store == nil {
		slog.Error("group_code_guard_not_configured")
		return reject(503, "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.")
	}
	if mtIdx > 0 {
		if rej := g.hit(ctx, groupCodeMemberKey(mtIdx), g.perMember, "member"); rej != nil {
			return rej
		}
	}
	if ip != "" {
		if rej := g.hit(ctx, groupCodeIPKey(ip), g.perIP, "ip"); rej != nil {
			return rej
		}
	}
	return nil
}

func (g *GroupCodeGuard) hit(ctx context.Context, key string, limit int, scope string) *AuthRejection {
	n, err := g.store.IncrWithExpire(ctx, key, g.window)
	if err != nil {
		level := slog.LevelError
		if errors.Is(err, cache.ErrDisabled) {
			level = slog.LevelWarn
		}
		g.log().Log(ctx, level, "group_code_limit_store_unavailable", slog.String("scope", scope), slog.String("err", err.Error()))
		return reject(503, "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.")
	}
	if n <= int64(limit) {
		return nil
	}
	retry := int(g.window / time.Second)
	if ttl, terr := g.store.TTL(ctx, key); terr == nil && ttl > 0 {
		retry = int((ttl + time.Second - 1) / time.Second)
	}
	g.log().Warn("group_code_limited", slog.String("scope", scope))
	return &AuthRejection{Status: 429, Detail: "초대 코드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", RetryAfter: retry}
}

// NormalizeGroupCode는 코드 비교용 정규화(앞뒤 공백 제거 + 대문자). 앱은 입력을 대문자로 보낸다.
func NormalizeGroupCode(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }
