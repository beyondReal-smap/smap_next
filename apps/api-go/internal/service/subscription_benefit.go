package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// 회원 등급(mt_level) 값. 5=프리미엄, 2=일반. 1(탈퇴)·9(관리자) 등 다른 값은 구독 동기화가 건드리지 않는다.
const (
	levelFree    = 2
	levelPremium = 5
	levelAdmin   = 9
)

// 혜택 강제 계측 종류(Prometheus 레이블, 로그 구분). 회원 번호·좌표는 담지 않는다.
const (
	WouldBlockPlaceLimit   = "place_limit"
	WouldBlockLogRetention = "log_retention"
)

// kst는 "최근 N일"의 날짜 기준이다(계약 4절: 서버 기준 KST 날짜). tzdata에 의존하지 않도록 고정 오프셋을 쓴다.
var kst = time.FixedZone("KST", 9*3600)

// IsPremium은 프리미엄 판정의 유일한 구현이다(계약 2절).
// 관리자(mt_level=9)는 항상 프리미엄이고, 그 외에는 mt_plan_date가 now보다 미래일 때만 프리미엄이다.
// mt_level=5는 판정 입력이 아니다(서버가 판정에 맞춰 동기화하는 표시값). planDate는 실제 UTC 시각이어야 한다.
func IsPremium(level *int, planDate *time.Time, now time.Time) bool {
	if level != nil && *level == levelAdmin {
		return true
	}
	return planDate != nil && planDate.After(now)
}

// SubscriptionPolicy는 혜택 한도와 강제 스위치다(설정에서 온다).
type SubscriptionPolicy struct {
	EnforcementEnabled bool
	FreeMaxPlaces      int
	FreeLogDays        int
	PremiumLogDays     int
}

// BenefitStore는 혜택 판정이 쓰는 저장소 기능이다(구현: repository.SubscriptionRepository).
type BenefitStore interface {
	MemberPlan(ctx context.Context, mtIdx int) (*model.SubscriptionMemberPlan, error)
	CountVisiblePlaces(ctx context.Context, mtIdx int) (int64, error)
}

// EnforcementMeter는 "강제했다면 막혔을 요청"을 세는 기록기다. kind만 받는다(식별자·좌표 금지).
type EnforcementMeter interface {
	WouldBlock(kind string)
}

// PlaceLimitError는 내 장소 생성이 무료 한도에 걸렸다(403 PLACE_LIMIT_EXCEEDED).
type PlaceLimitError struct{ Limit int }

func (e *PlaceLimitError) Error() string { return fmt.Sprintf("place limit exceeded (%d)", e.Limit) }

// LogRetentionError는 활동 기록 조회가 보존 기간 밖이다(403 LOG_RETENTION_EXCEEDED).
type LogRetentionError struct {
	Days    int
	Premium bool
}

func (e *LogRetentionError) Error() string {
	return fmt.Sprintf("log retention exceeded (%d days)", e.Days)
}

// SubscriptionBenefits는 혜택 판정과 강제의 한 곳이다. 강제가 꺼져 있으면 아무것도 막지 않고 계측만 한다.
type SubscriptionBenefits struct {
	store  BenefitStore
	policy SubscriptionPolicy
	meter  EnforcementMeter
	now    func() time.Time
	logger *slog.Logger
	// 계측 실패 로그가 폭주하지 않게 마지막 경고 시각(UnixNano)을 둔다.
	lastWarn atomic.Int64
}

func NewSubscriptionBenefits(store BenefitStore, policy SubscriptionPolicy, meter EnforcementMeter, logger *slog.Logger) *SubscriptionBenefits {
	if logger == nil {
		logger = slog.Default()
	}
	return &SubscriptionBenefits{store: store, policy: policy, meter: meter, now: time.Now, logger: logger}
}

// SetClock은 테스트용 시계 주입이다.
func (b *SubscriptionBenefits) SetClock(now func() time.Time) { b.now = now }

// Enforced는 혜택 강제가 켜져 있는지다.
func (b *SubscriptionBenefits) Enforced() bool { return b.policy.EnforcementEnabled }

func (b *SubscriptionBenefits) record(kind string) {
	if b.meter != nil {
		b.meter.WouldBlock(kind)
	}
}

// IsPremium은 회원이 지금 프리미엄인지 판정한다. 회원이 없으면 repository.ErrMemberNotFound.
func (b *SubscriptionBenefits) IsPremium(ctx context.Context, mtIdx int) (bool, error) {
	m, err := b.store.MemberPlan(ctx, mtIdx)
	if err != nil {
		return false, err
	}
	return IsPremium(m.MtLevel, m.MtPlanDate, b.now()), nil
}

// observeFailure는 강제가 꺼진 상태에서 계측용 조회가 실패했을 때 요청을 막지 않고 경고만 남긴다(분당 1회).
// 강제가 꺼진 동안은 기존 동작이 우선이다. 켜진 상태의 실패는 호출자에게 오류로 돌려준다.
func (b *SubscriptionBenefits) observeFailure(what string, err error) {
	now := b.now().UnixNano()
	last := b.lastWarn.Load()
	if now-last < int64(time.Minute) || !b.lastWarn.CompareAndSwap(last, now) {
		return
	}
	b.logger.Warn("subscription_benefit_observe_failed", slog.String("what", what), slog.String("err", err.Error()))
}

// CheckPlaceCreate는 owner 명의로 내 장소를 하나 더 만들어도 되는지 판정한다.
// 강제 꺼짐: 항상 nil, 단 막혔을 요청이면 계측. 켜짐: 무료 회원이 한도 이상이면 *PlaceLimitError.
// 이미 한도를 넘게 가진 무료 회원도 "추가"만 막힌다(기존 장소의 조회·수정·삭제는 이 함수가 관여하지 않는다).
// 회원 행이 없으면 판정할 수 없어 통과시킨다(기존 동작; 인가는 18단계 가드의 몫).
func (b *SubscriptionBenefits) CheckPlaceCreate(ctx context.Context, owner int) error {
	enforced := b.policy.EnforcementEnabled
	m, err := b.store.MemberPlan(ctx, owner)
	if errors.Is(err, repository.ErrMemberNotFound) {
		return nil
	}
	if err != nil {
		if enforced {
			return err
		}
		b.observeFailure("place_member", err)
		return nil
	}
	if IsPremium(m.MtLevel, m.MtPlanDate, b.now()) {
		return nil
	}
	n, err := b.store.CountVisiblePlaces(ctx, owner)
	if err != nil {
		if enforced {
			return err
		}
		b.observeFailure("place_count", err)
		return nil
	}
	if n < int64(b.policy.FreeMaxPlaces) {
		return nil
	}
	if !enforced {
		b.record(WouldBlockPlaceLimit)
		return nil
	}
	return &PlaceLimitError{Limit: b.policy.FreeMaxPlaces}
}

// logWindow는 요청자 등급에 따른 조회 가능 첫 날짜(KST 날짜, 시각은 00:00 UTC로 정규화)와 일수다.
func (b *SubscriptionBenefits) firstDate(days int) time.Time {
	t := b.now().In(kst)
	today := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	return today.AddDate(0, 0, -(days - 1))
}

const ymd = "2006-01-02"

// tier는 요청자 등급에 맞는 보존 일수와 프리미엄 여부다. 회원이 없으면 found=false.
func (b *SubscriptionBenefits) tier(ctx context.Context, requester int) (days int, premium, found bool, err error) {
	m, err := b.store.MemberPlan(ctx, requester)
	if errors.Is(err, repository.ErrMemberNotFound) {
		return 0, false, false, nil
	}
	if err != nil {
		return 0, false, false, err
	}
	if IsPremium(m.MtLevel, m.MtPlanDate, b.now()) {
		return b.policy.PremiumLogDays, true, true, nil
	}
	return b.policy.FreeLogDays, false, true, nil
}

// CheckLogDate는 단일 날짜 조회(date)가 요청자의 보존 기간 안인지 확인한다(요청자 등급 기준).
// 형식이 잘못된 날짜는 판정하지 않고 통과시킨다(기존 조회 로직이 형식 오류를 처리한다).
// 강제 꺼짐이면 항상 nil(막혔을 요청만 계측).
func (b *SubscriptionBenefits) CheckLogDate(ctx context.Context, requester int, date string) error {
	d, err := time.Parse(ymd, date)
	if err != nil {
		return nil
	}
	freeFirst, premFirst := b.firstDate(b.policy.FreeLogDays), b.firstDate(b.policy.PremiumLogDays)
	if !d.Before(freeFirst) {
		return nil // 무료 보존 기간 안: 누구에게나 허용(등급 조회 불필요)
	}
	days, premium, found, terr := b.tier(ctx, requester)
	if terr != nil {
		if b.policy.EnforcementEnabled {
			return terr
		}
		b.observeFailure("log_tier", terr)
		return nil
	}
	if !found {
		return nil
	}
	first := freeFirst
	if premium {
		first = premFirst
	}
	if !d.Before(first) {
		return nil
	}
	if !b.policy.EnforcementEnabled {
		b.record(WouldBlockLogRetention)
		return nil
	}
	return &LogRetentionError{Days: days, Premium: premium}
}

// ClampLogRange는 기간 조회(start~end)를 요청자의 보존 기간으로 제한한다. 시작일이 비었거나 기간 밖이면 시작일을 첫 날짜로
// 끌어올린다(끝일이 기간 밖이면 빈 범위가 된다). 반환값은 조회에 쓸 start/end 문자열이다.
// 강제 꺼짐: 입력을 그대로 돌려주고, 시작일이 명시적으로 무료 보존 기간 밖이면 막혔을 요청으로 계측한다.
// 형식이 잘못된 날짜는 판정하지 않고 그대로 통과시킨다.
func (b *SubscriptionBenefits) ClampLogRange(ctx context.Context, requester int, start, end string) (string, string, error) {
	var sd time.Time
	if start != "" {
		var err error
		if sd, err = time.Parse(ymd, start); err != nil {
			return start, end, nil
		}
	}
	if end != "" {
		if _, err := time.Parse(ymd, end); err != nil {
			return start, end, nil
		}
	}
	if !b.policy.EnforcementEnabled {
		// 계측만: 시작일이 명시적으로 무료 보존 기간 밖일 때.
		if start != "" && sd.Before(b.firstDate(b.policy.FreeLogDays)) {
			if days, _, found, err := b.tier(ctx, requester); err != nil {
				b.observeFailure("log_tier", err)
			} else if found && sd.Before(b.firstDate(days)) {
				b.record(WouldBlockLogRetention)
			}
		}
		return start, end, nil
	}
	days, _, found, err := b.tier(ctx, requester)
	if err != nil {
		return "", "", err
	}
	if !found {
		return start, end, nil
	}
	first := b.firstDate(days)
	if start == "" || sd.Before(first) {
		start = first.Format(ymd)
	}
	return start, end, nil
}

// ClampLogDays는 "최근 days일" 조회(daily-counts)의 일수를 요청자 보존 일수로 제한한다.
// 강제 꺼짐: days 그대로, 보존 일수를 넘으면 계측.
func (b *SubscriptionBenefits) ClampLogDays(ctx context.Context, requester, days int) (int, error) {
	if days <= b.policy.FreeLogDays {
		return days, nil // 무료 보존 기간 안: 등급 조회 불필요
	}
	allowed, _, found, err := b.tier(ctx, requester)
	if err != nil {
		if b.policy.EnforcementEnabled {
			return 0, err
		}
		b.observeFailure("log_tier", err)
		return days, nil
	}
	if !found || days <= allowed {
		return days, nil
	}
	if !b.policy.EnforcementEnabled {
		b.record(WouldBlockLogRetention)
		return days, nil
	}
	return allowed, nil
}
