package handler

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 혜택 강제 403 코드(계약 4절).
const (
	codePlaceLimit  = "PLACE_LIMIT_EXCEEDED"
	codeLogRetained = "LOG_RETENTION_EXCEEDED"
)

// BenefitGuard는 장소 생성·활동 기록 조회 핸들러에 "덧붙는" 혜택 강제 진입점이다. 18단계 위치 인가(LocationGuard)가 통과한 뒤에 호출한다.
// 모든 메서드는 nil 수신자에서 아무것도 하지 않고 통과시킨다(배선하지 않은 핸들러·기존 테스트의 동작 불변).
// 강제가 꺼져 있으면 service 가 막지 않고 계측만 하므로 기본 설정에서 기존 응답은 달라지지 않는다.
// 요청자 신원을 알 수 없으면(무토큰 통과분) 등급을 판정할 수 없어 건너뛴다.
type BenefitGuard struct {
	b *service.SubscriptionBenefits
}

func NewBenefitGuard(b *service.SubscriptionBenefits) *BenefitGuard { return &BenefitGuard{b: b} }

func (g *BenefitGuard) active() bool { return g != nil && g.b != nil }

func (g *BenefitGuard) fail(c *gin.Context, err error) {
	slog.Error("subscription benefit check failed", slog.String("route", c.FullPath()), slog.String("err", err.Error()))
	writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
}

func (g *BenefitGuard) retained(c *gin.Context, e *service.LogRetentionError) {
	who := "무료 회원"
	if e.Premium {
		who = "프리미엄 회원"
	}
	writeJSON(c, http.StatusForbidden, gin.H{"detail": dto.LogRetentionDetail{
		Code: codeLogRetained, Message: fmt.Sprintf("%s은 최근 %d일의 활동 기록만 볼 수 있어요.", who, e.Days), RetentionDays: e.Days,
	}})
}

// PlaceCreate: owner 명의 장소 생성이 무료 한도(기본 2개)에 걸리면 403 PLACE_LIMIT_EXCEEDED 를 쓰고 false.
func (g *BenefitGuard) PlaceCreate(c *gin.Context, owner int) bool {
	if !g.active() {
		return true
	}
	err := g.b.CheckPlaceCreate(c.Request.Context(), owner)
	if err == nil {
		return true
	}
	var pl *service.PlaceLimitError
	if errors.As(err, &pl) {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": dto.PlaceLimitDetail{
			Code: codePlaceLimit, Message: fmt.Sprintf("무료 회원은 내 장소를 %d개까지 등록할 수 있어요.", pl.Limit), Limit: pl.Limit,
		}})
		return false
	}
	g.fail(c, err)
	return false
}

// LogDate: 단일 날짜 조회가 요청자의 보존 기간 밖이면 403 LOG_RETENTION_EXCEEDED 를 쓰고 false.
func (g *BenefitGuard) LogDate(c *gin.Context, date string) bool {
	if !g.active() {
		return true
	}
	uid, ok := middleware.UserID(c)
	if !ok {
		return true
	}
	err := g.b.CheckLogDate(c.Request.Context(), uid, date)
	if err == nil {
		return true
	}
	var re *service.LogRetentionError
	if errors.As(err, &re) {
		g.retained(c, re)
		return false
	}
	g.fail(c, err)
	return false
}

// LogRange: 기간 조회의 시작일을 요청자 보존 기간으로 끌어올린 start/end 를 돌려준다. 실패하면 응답을 쓰고 ok=false.
func (g *BenefitGuard) LogRange(c *gin.Context, start, end string) (string, string, bool) {
	if !g.active() {
		return start, end, true
	}
	uid, ok := middleware.UserID(c)
	if !ok {
		return start, end, true
	}
	s, e, err := g.b.ClampLogRange(c.Request.Context(), uid, start, end)
	if err != nil {
		g.fail(c, err)
		return "", "", false
	}
	return s, e, true
}

// LogDays: "최근 N일" 조회의 N 을 요청자 보존 일수로 제한한 값을 돌려준다.
func (g *BenefitGuard) LogDays(c *gin.Context, days int) (int, bool) {
	if !g.active() {
		return days, true
	}
	uid, ok := middleware.UserID(c)
	if !ok {
		return days, true
	}
	n, err := g.b.ClampLogDays(c.Request.Context(), uid, days)
	if err != nil {
		g.fail(c, err)
		return 0, false
	}
	return n, true
}
