package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

// 구독 서비스 오류. 핸들러가 HTTP 상태로 바꾼다(검증 실패 400 / 소유 충돌 409 / 스토어 장애 502 / 설정·테이블 없음 503).
var (
	ErrSubInvalidProof    = errors.New("subscription: invalid proof")       // 400 위조·번들/상품 불일치·알 수 없는 증빙
	ErrSubExpired         = errors.New("subscription: expired")             // 400 만료·환불·보류된 거래
	ErrSubSandboxRejected = errors.New("subscription: sandbox rejected")    // 400 샌드박스 거래가 허용되지 않음
	ErrSubOwnedByOther    = errors.New("subscription: owned by other")      // 409 다른 회원에 연결된 거래
	ErrSubStoreDown       = errors.New("subscription: store unavailable")   // 502 스토어 장애
	ErrSubNotConfigured   = errors.New("subscription: not configured")      // 503 서버 설정 누락
	ErrSubTableMissing    = errors.New("subscription: table missing")       // 503 subscription_transactions 없음
	ErrSubUnauthorized    = errors.New("subscription: unauthorized sender") // 401 알림 발신자 검증 실패
	ErrSubBusy            = errors.New("subscription: busy")                // 503 경쟁 재시도 초과(앱이 다시 시도)
	ErrSubBadRequest      = errors.New("subscription: bad request")         // 400 요청 형식 오류
)

// 거래 상태 문자열(subscription_transactions.status). store.State 값과 같다.
const (
	platformIOS     = "ios"
	platformAndroid = "android"
	planMonth       = "month"
	planYear        = "year"
)

// SubscriptionPlanMap은 상품 → 플랜(month/year) 매핑이다.
type SubscriptionPlanMap struct {
	AppleMonthProductID string
	AppleYearProductID  string
	GoogleMonthBasePlan string
	GoogleYearBasePlan  string
}

// subscriptionRepo는 구독 서비스가 쓰는 저장소 기능이다(구현: repository.SubscriptionRepository).
type subscriptionRepo interface {
	BenefitStore
	WithMemberLock(ctx context.Context, mtIdx int, fn func(tx repository.SubscriptionTxOps, member *model.SubscriptionMemberPlan) error) error
	WithTx(ctx context.Context, fn func(tx repository.SubscriptionTxOps) error) error
	FindByHash(ctx context.Context, platform, hash string) (*model.SubscriptionTransaction, error)
	ListByMember(ctx context.Context, mtIdx int) ([]model.SubscriptionTransaction, error)
	SyncMemberLevel(ctx context.Context, mtIdx, want int) (bool, error)
	ExpireLapsed(ctx context.Context, now time.Time) (int64, error)
}

// SubscriptionService는 구독 검증·알림 반영·상태 조회다. 스토어 호출은 store.Verifier / NotificationVerifier 로만 한다.
type SubscriptionService struct {
	repo     subscriptionRepo
	verifier store.Verifier
	notifier store.NotificationVerifier
	policy   SubscriptionPolicy
	plans    SubscriptionPlanMap
	allowSB  bool
	acctKey  []byte // 계정 토큰 HMAC 비밀(비면 account_token 기능 꺼짐)
	now      func() time.Time
	logger   *slog.Logger
	lastWarn atomic.Int64 // 테이블 없음 경고 로그 스팸 방지(분당 1회)
}

// SubscriptionOptions는 서비스 생성 입력이다. Verifier/Notifier 가 nil 이면 해당 경로는 항상 503(설정 없음)이다.
type SubscriptionOptions struct {
	Verifier     store.Verifier
	Notifier     store.NotificationVerifier
	Policy       SubscriptionPolicy
	Plans        SubscriptionPlanMap
	AllowSandbox bool
	// AccountTokenSecret: 회원별 계정 토큰(HMAC) 비밀. 비면 /subscriptions/me 가 account_token 을 내려주지 않고 증빙 대조도 하지 않는다.
	AccountTokenSecret string
	Logger             *slog.Logger
}

func NewSubscription(repo subscriptionRepo, opt SubscriptionOptions) *SubscriptionService {
	lg := opt.Logger
	if lg == nil {
		lg = slog.Default()
	}
	return &SubscriptionService{repo: repo, verifier: opt.Verifier, notifier: opt.Notifier, policy: opt.Policy,
		plans: opt.Plans, allowSB: opt.AllowSandbox, acctKey: []byte(opt.AccountTokenSecret), now: time.Now, logger: lg}
}

// SetClock은 테스트용 시계 주입이다.
func (s *SubscriptionService) SetClock(now func() time.Time) { s.now = now }

// AccountToken은 회원에 묶는 계정 토큰이다: HMAC-SHA256(비밀, 회원번호)의 앞 16바이트를 UUID(v4 형식 비트) 문자열로 만든다.
// 서버 비밀 없이는 만들 수 없어 다른 회원이 추측해 넣을 수 없고, Apple appAccountToken(UUID 필수)·Google obfuscatedExternalAccountId 둘 다에 쓸 수 있다.
// 비밀이 없으면 빈 문자열.
func (s *SubscriptionService) AccountToken(mtIdx int) string {
	if len(s.acctKey) == 0 || mtIdx <= 0 {
		return ""
	}
	m := hmac.New(sha256.New, s.acctKey)
	m.Write([]byte("smap-subscription-account-token:v1:" + strconv.Itoa(mtIdx)))
	b := m.Sum(nil)[:16]
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func storeHash(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

func platformOf(p store.Provider) string {
	if p == store.ProviderApple {
		return platformIOS
	}
	return platformAndroid
}

// entitled는 거래 행이 now 시점에 프리미엄 권한을 주는지다: 이용 가능한 상태이고 만료 전.
func entitled(row *model.SubscriptionTransaction, now time.Time) bool {
	switch store.State(row.Status) {
	case store.StateActive, store.StateCanceled, store.StateGrace:
		return row.ExpiresAt.After(now)
	}
	return false
}

func entitledState(st store.State) bool {
	return st == store.StateActive || st == store.StateCanceled || st == store.StateGrace
}

// mapStoreErr는 스토어 계층 오류를 서비스 오류로 바꾼다. 알 수 없는 오류도 숨기지 않고 스토어 장애(502)로 올린다.
func (s *SubscriptionService) mapStoreErr(err error, where string) error {
	switch {
	case errors.Is(err, store.ErrInvalidProof), errors.Is(err, store.ErrNotFound):
		return ErrSubInvalidProof
	case errors.Is(err, store.ErrExpired):
		return ErrSubExpired
	case errors.Is(err, store.ErrSandboxNotAllowed):
		return ErrSubSandboxRejected
	case errors.Is(err, store.ErrUnauthorized):
		return ErrSubUnauthorized
	case errors.Is(err, store.ErrNotConfigured):
		s.logger.Error("subscription_store_not_configured", slog.String("where", where), slog.String("err", err.Error()))
		return ErrSubNotConfigured
	case errors.Is(err, store.ErrStoreUnavailable):
		s.logger.Warn("subscription_store_unavailable", slog.String("where", where))
		return ErrSubStoreDown
	default:
		s.logger.Error("subscription_store_unexpected_error", slog.String("where", where), slog.String("err", err.Error()))
		return ErrSubStoreDown
	}
}

// mapDBErr는 저장소 오류를 서비스 오류로 바꾼다. 테이블 없음은 명확한 로그(분당 1회)와 함께 ErrSubTableMissing.
func (s *SubscriptionService) mapDBErr(err error, where string) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, repository.ErrSubscriptionTableMissing) {
		now := s.now().UnixNano()
		last := s.lastWarn.Load()
		if now-last >= int64(time.Minute) && s.lastWarn.CompareAndSwap(last, now) {
			s.logger.Error("subscription_table_missing", slog.String("where", where),
				slog.String("msg", "subscription_transactions 테이블이 없어 구독 경로를 처리할 수 없음. migrations/0002_subscription_transactions.sql 적용 필요"))
		}
		return ErrSubTableMissing
	}
	return err
}

// resolvePlan은 검증된 거래의 상품(Apple) / 기본 요금제(Google)를 month/year 로 바꾼다. 모르는 상품이면 ErrSubInvalidProof.
func (s *SubscriptionService) resolvePlan(v *store.Verified) (string, error) {
	switch v.Provider {
	case store.ProviderApple:
		switch v.ProductID {
		case s.plans.AppleMonthProductID:
			return planMonth, nil
		case s.plans.AppleYearProductID:
			return planYear, nil
		}
	case store.ProviderGoogle:
		switch v.BasePlanID {
		case s.plans.GoogleMonthBasePlan:
			return planMonth, nil
		case s.plans.GoogleYearBasePlan:
			return planYear, nil
		}
	}
	return "", ErrSubInvalidProof
}

func truncSec(t time.Time) time.Time { return t.UTC().Truncate(time.Second) }

// Status는 회원의 현재 구독 상태(계약 3.1)다. 조회 시 mt_level 표시값이 판정과 어긋나 있으면 맞춘다.
func (s *SubscriptionService) Status(ctx context.Context, mtIdx int) (*dto.SubscriptionStatus, error) {
	member, err := s.repo.MemberPlan(ctx, mtIdx)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ListByMember(ctx, mtIdx)
	if err != nil {
		return nil, s.mapDBErr(err, "status")
	}
	st := s.buildStatus(ctx, member, rows)
	st.AccountToken = s.AccountToken(mtIdx)
	return st, nil
}

func (s *SubscriptionService) buildStatus(ctx context.Context, member *model.SubscriptionMemberPlan, rows []model.SubscriptionTransaction) *dto.SubscriptionStatus {
	now := s.now()
	premium := IsPremium(member.MtLevel, member.MtPlanDate, now)
	s.healLevel(ctx, member, premium)

	st := &dto.SubscriptionStatus{
		IsPremium:          premium,
		InGracePeriod:      false,
		EnforcementEnabled: s.policy.EnforcementEnabled,
		Limits:             dto.SubscriptionLimits{LogRetentionDays: s.policy.FreeLogDays},
	}
	if premium {
		st.Limits.LogRetentionDays = s.policy.PremiumLogDays
	} else {
		n := s.policy.FreeMaxPlaces
		st.Limits.MaxPlaces = &n
	}
	if !premium || member.MtPlanDate == nil || !member.MtPlanDate.After(now) {
		return st // 관리자처럼 만료일 없이(또는 지난 만료일로) 프리미엄인 경우 만료일·플랫폼은 null
	}
	exp := truncSec(*member.MtPlanDate)
	iso := exp.Format("2006-01-02T15:04:05Z")
	st.ExpiresAt = &iso
	// 현재 만료일을 만든 거래(권한이 있는 거래 중 만료일이 같은 것)가 있으면 플랫폼·플랜·자동 갱신을 그 거래에서 가져온다.
	var match *model.SubscriptionTransaction
	for i := range rows {
		if entitled(&rows[i], now) && truncSec(rows[i].ExpiresAt).Equal(exp) {
			if match == nil || rows[i].ID > match.ID {
				match = &rows[i]
			}
		}
	}
	if match == nil {
		legacy := "legacy"
		st.Platform = &legacy
		return st
	}
	plat, plan := match.Platform, match.Plan
	st.Platform, st.Plan = &plat, &plan
	st.AutoRenew = match.AutoRenew
	st.InGracePeriod = store.State(match.Status) == store.StateGrace
	return st
}

// healLevel은 mt_level 표시값을 판정에 맞춘다(5↔2). 실패해도 조회는 막지 않고 경고만 남긴다(표시값 보정일 뿐이다).
func (s *SubscriptionService) healLevel(ctx context.Context, member *model.SubscriptionMemberPlan, premium bool) {
	if member.MtLevel == nil {
		return
	}
	lv := *member.MtLevel
	want := 0
	switch {
	case lv == levelPremium && !premium:
		want = levelFree
	case lv == levelFree && premium:
		want = levelPremium
	}
	if want == 0 {
		return
	}
	if _, err := s.repo.SyncMemberLevel(ctx, member.MtIdx, want); err != nil {
		s.logger.Warn("subscription_level_sync_failed", slog.String("err", err.Error()))
	}
}

// Verify는 앱이 보낸 구매 증빙을 스토어에 직접 확인해 계정에 반영한다(계약 3.2).
func (s *SubscriptionService) Verify(ctx context.Context, mtIdx int, req dto.SubscriptionVerifyRequest) (*dto.SubscriptionStatus, error) {
	platform := strings.ToLower(strings.TrimSpace(req.Platform))
	if platform == "" {
		switch {
		case req.SignedTransaction != "" && req.PurchaseToken == "":
			platform = platformIOS
		case req.PurchaseToken != "" && req.SignedTransaction == "":
			platform = platformAndroid
		}
	}
	var (
		v   *store.Verified
		err error
	)
	switch platform {
	case platformIOS:
		if strings.TrimSpace(req.SignedTransaction) == "" {
			return nil, ErrSubBadRequest
		}
		if s.verifier == nil {
			return nil, s.mapStoreErr(store.ErrNotConfigured, "verify_apple")
		}
		v, err = s.verifier.VerifyApple(ctx, req.SignedTransaction)
	case platformAndroid:
		if strings.TrimSpace(req.PurchaseToken) == "" {
			return nil, ErrSubBadRequest
		}
		if s.verifier == nil {
			return nil, s.mapStoreErr(store.ErrNotConfigured, "verify_google")
		}
		v, err = s.verifier.VerifyGoogle(ctx, strings.TrimSpace(req.ProductID), req.PurchaseToken)
	default:
		return nil, ErrSubBadRequest
	}
	if err != nil {
		return nil, s.mapStoreErr(err, "verify_"+platform)
	}
	if v == nil || v.TransactionKey == "" {
		return nil, ErrSubInvalidProof
	}
	if v.Environment == store.EnvSandbox && !s.allowSB {
		return nil, ErrSubSandboxRejected // 스토어 계층이 이미 거르지만, 가짜·오설정에도 운영에 샌드박스 권한이 들어가지 않게 한 번 더 막는다
	}
	if _, err := s.resolvePlan(v); err != nil {
		return nil, err
	}

	// M-1: 증빙에 계정 토큰이 들어 있으면 요청 회원용으로 서버가 만든 값과 같아야 한다(다른 계정용으로 산 구매를 가져와 쓰지 못하게).
	// 현재 앱은 토큰을 넣지 않으므로(빈 값) 기존 흐름은 영향이 없다. 서버 비밀이 없으면 대조할 기준이 없어 건너뛴다.
	if v.AppAccountToken != "" {
		if want := s.AccountToken(mtIdx); want != "" && !strings.EqualFold(strings.TrimSpace(v.AppAccountToken), want) {
			s.logger.Warn("subscription_account_token_mismatch", slog.String("platform", platform))
			return nil, ErrSubOwnedByOther
		}
	}

	outcome, err := s.apply(ctx, mtIdx, v, applyOptions{})
	if err != nil {
		return nil, err
	}
	if outcome.rejected {
		return nil, ErrSubExpired
	}
	// Google은 계정 반영(커밋)이 끝난 뒤에 구매를 승인한다. 승인에 실패하면 502로 알려 앱이 재시도하게 한다(재검증은 멱등).
	if v.Provider == store.ProviderGoogle && !v.Acknowledged && entitledState(v.State) {
		if err := s.verifier.AcknowledgeGoogle(ctx, v.ProductID, v.TransactionKey); err != nil {
			return nil, s.mapStoreErr(err, "acknowledge_google")
		}
	}
	return s.Status(ctx, mtIdx)
}

type applyOptions struct {
	// notified: 스토어 알림 경로. 만료·환불 같은 비권한 상태도 그대로 기록한다(verify 는 기존 거래에 한해 기록 후 거부).
	notified bool
}

type applyOutcome struct {
	// rejected: verify 에서 거래가 이미 권한이 없는 상태(만료·환불·보류)라 400 으로 거부해야 한다.
	rejected bool
}

const applyMaxAttempts = 3

// errRowClaimed는 소유자 없는 거래 행을 기록하려는 사이 다른 회원이 그 행을 차지했음을 뜻한다(알림 경로가 소유자를 다시 찾아 재시도).
var errRowClaimed = errors.New("subscription: row claimed meanwhile")

// apply는 검증된 거래를 회원에 연결하고 최신 상태를 반영한다(멱등). 한 회원 행을 잠근 트랜잭션에서 실행한다.
// 처음 기록하는 거래를 두 요청이 동시에 넣으면 유니크 키 위반이 나는데, 그때는 트랜잭션을 다시 실행해
// 이번에는 이미 있는 행을 보고 판정한다(같은 회원이면 멱등 갱신, 다른 회원이면 409).
func (s *SubscriptionService) apply(ctx context.Context, mtIdx int, v *store.Verified, opt applyOptions) (applyOutcome, error) {
	var out applyOutcome
	var err error
	for attempt := 0; attempt < applyMaxAttempts; attempt++ {
		out = applyOutcome{}
		err = s.repo.WithMemberLock(ctx, mtIdx, func(tx repository.SubscriptionTxOps, member *model.SubscriptionMemberPlan) error {
			return s.applyLocked(tx, member, mtIdx, v, opt, &out)
		})
		if err == nil {
			return out, nil
		}
		if errors.Is(err, repository.ErrDuplicateKey) || errors.Is(err, repository.ErrRetryableTx) {
			continue
		}
		break
	}
	return out, s.classifyApplyErr(err)
}

func (s *SubscriptionService) classifyApplyErr(err error) error {
	switch {
	case errors.Is(err, ErrSubOwnedByOther):
		return ErrSubOwnedByOther
	case errors.Is(err, repository.ErrDuplicateKey), errors.Is(err, repository.ErrRetryableTx):
		s.logger.Warn("subscription_apply_contention", slog.Int("attempts", applyMaxAttempts))
		return ErrSubBusy
	case errors.Is(err, repository.ErrMemberNotFound):
		return err
	}
	return s.mapDBErr(err, "apply")
}

// ownerTransferable은 이미 다른 회원에게 연결된 거래를 요청 회원이 이어받을 수 있는지 판정한다.
// 소유 회원이 탈퇴(mt_level=1)·정지(mt_status=2)·비노출(mt_show='N')이거나 회원 행이 사라졌으면 true(13단계 차단 기준과 같다).
// 소유자 행을 잠가 읽는다(요청 회원 잠금 뒤에 잡으므로 순서는 항상 요청자 → 이전 소유자).
func ownerTransferable(tx repository.SubscriptionTxOps, owner int) (*model.SubscriptionMemberPlan, bool, error) {
	om, err := tx.ForMember(owner).LockMember()
	if errors.Is(err, repository.ErrMemberNotFound) {
		return nil, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	return om, model.IsBlockedMember(om.MtLevel, om.MtStatus, om.MtShow), nil
}

// normalizedExpiry는 권한이 없는 상태(환불·취소·만료·보류)면 만료 시각을 현재로 당긴다(즉시 권한 종료).
func normalizedExpiry(v *store.Verified, now time.Time) time.Time {
	expires := truncSec(v.ExpiresAt)
	if !entitledState(v.State) && expires.After(now) {
		return truncSec(now)
	}
	return expires
}

// newRowFrom은 검증된 거래로 새 거래 행을 만든다(mtIdx 가 UnownedMtIdx 면 소유자 없는 행).
func newRowFrom(mtIdx int, platform, hash, plan string, v *store.Verified, expires, eventAt, now time.Time, notified bool) *model.SubscriptionTransaction {
	var ar *bool
	if v.AutoRenewKnown {
		b := v.AutoRenew
		ar = &b
	} else if !entitledState(v.State) {
		b := false
		ar = &b
	}
	row := &model.SubscriptionTransaction{
		MtIdx: mtIdx, Platform: platform, StoreIDHash: hash, ProductID: v.ProductID, Plan: plan,
		ExpiresAt: expires, Status: string(v.State), Environment: v.Environment, AutoRenew: ar,
		InGracePeriod: v.State == store.StateGrace, StoreUpdatedAt: eventAt, UpdatedAt: truncSec(now),
	}
	if notified {
		t := truncSec(now)
		row.LastNotificationAt = &t
	}
	return row
}

// refreshRow는 기존 거래 행에 더 최신인 스토어 상태를 반영한다. 오래된 증빙·알림(stale)이거나, 같은 시각에 환불·회수를
// 되살리려는 경우는 건드리지 않는다. 행을 바꿨으면 true.
func refreshRow(row *model.SubscriptionTransaction, v *store.Verified, plan string, expires, eventAt, now time.Time, notified bool) bool {
	stale := eventAt.Before(truncSec(row.StoreUpdatedAt))
	// 같은 시각이면 이미 기록된 환불·회수를 늦게 도착한 권한 있는 상태가 되살리지 못하게 한다.
	sameTimeResurrect := eventAt.Equal(truncSec(row.StoreUpdatedAt)) && entitledState(v.State) &&
		(store.State(row.Status) == store.StateRefunded || store.State(row.Status) == store.StateRevoked)
	if stale || sameTimeResurrect {
		return false
	}
	prevExpiry := row.ExpiresAt
	row.ProductID, row.Plan, row.Environment = v.ProductID, plan, v.Environment
	row.ExpiresAt, row.Status, row.InGracePeriod = expires, string(v.State), v.State == store.StateGrace
	switch {
	case v.AutoRenewKnown:
		b := v.AutoRenew
		row.AutoRenew = &b
	case !entitledState(v.State):
		b := false
		row.AutoRenew = &b
	case expires.After(truncSec(prevExpiry)):
		row.AutoRenew = nil // 갱신됨: 이전 주기의 해지 표시는 더 이상 유효하지 않고 새 값은 알 수 없다
	case row.AutoRenew != nil && !*row.AutoRenew && store.State(row.Status) == store.StateActive:
		row.Status = string(store.StateCanceled) // 이전에 해지 예약을 알았다면 활성이어도 해지 예약 상태를 유지
	}
	row.StoreUpdatedAt = eventAt
	row.UpdatedAt = truncSec(now)
	if notified {
		t := truncSec(now)
		row.LastNotificationAt = &t
	}
	return true
}

func (s *SubscriptionService) applyLocked(tx repository.SubscriptionTxOps, member *model.SubscriptionMemberPlan, mtIdx int,
	v *store.Verified, opt applyOptions, out *applyOutcome) error {
	now := s.now().UTC()
	platform := platformOf(v.Provider)
	hash := storeHash(v.TransactionKey)
	plan, err := s.resolvePlan(v)
	if err != nil {
		return err
	}

	row, err := tx.FindByHash(platform, hash)
	if err != nil {
		return err
	}

	eventAt := truncSec(v.LatestEventAt)
	if v.LatestEventAt.IsZero() {
		eventAt = truncSec(now)
	}

	// --- 소유권 판정 ---
	// transferFrom: 이전 소유자(차단·탈퇴 회원)로부터 이어받는 경우. claimUnowned: 알림이 먼저 기록해 둔 소유자 없는 행을 차지하는 경우.
	var transferFrom *model.SubscriptionMemberPlan
	transferring, claimUnowned := false, false
	oldOwner := 0
	switch {
	case row == nil || row.MtIdx == mtIdx:
	case row.MtIdx == model.UnownedMtIdx:
		if opt.notified {
			return errRowClaimed // 알림 경로는 소유자가 있는 쪽으로만 흘러야 한다(호출자가 다시 판단)
		}
		claimUnowned = true
	default: // 다른 회원 소유
		if opt.notified {
			return ErrSubOwnedByOther
		}
		om, ok, err := ownerTransferable(tx, row.MtIdx)
		if err != nil {
			return err
		}
		if !ok {
			return ErrSubOwnedByOther
		}
		transferring, transferFrom, oldOwner = true, om, row.MtIdx
	}
	if v.LinkedTransactionKey != "" {
		linked, err := tx.FindByHash(platform, storeHash(v.LinkedTransactionKey))
		if err != nil {
			return err
		}
		if linked != nil && linked.MtIdx != mtIdx && linked.MtIdx != model.UnownedMtIdx {
			if _, ok, err := ownerTransferable(tx, linked.MtIdx); err != nil {
				return err
			} else if !ok {
				return ErrSubOwnedByOther
			}
		}
	}

	// --- verify 경로의 거부 판정 ---
	// 권한이 없는 상태(만료·환불·보류)인 새 거래·남의 거래·소유자 없는 거래는 기록하지 않고 거부한다.
	// 이미 이 회원에 연결된 거래는 상태를 기록한 뒤 거부한다.
	if !opt.notified && !entitledState(v.State) {
		out.rejected = true
		if row == nil || row.MtIdx != mtIdx {
			return nil
		}
	}
	if claimUnowned || transferring {
		// 환불·회수로 기록된 거래(묘비)는 어떤 증빙으로도 소유자를 만들지 않는다. 알림이 증빙보다 최신인데
		// 이미 권한이 없는 상태여도(만료·보류 등) 차지하지 않고 거부한다 — 오래된 JWS 가 해지·만료된 거래를 되살리지 못하게 한다.
		st := store.State(row.Status)
		if st == store.StateRefunded || st == store.StateRevoked {
			out.rejected = true
			return nil
		}
		if eventAt.Before(truncSec(row.StoreUpdatedAt)) && !entitled(row, now) {
			out.rejected = true
			return nil
		}
	}

	prior, err := tx.ListByMember()
	if err != nil {
		return err
	}
	priorDates := make(map[time.Time]bool, len(prior))
	for i := range prior {
		priorDates[truncSec(prior[i].ExpiresAt)] = true
	}

	expires := normalizedExpiry(v, now)

	if row == nil {
		row = newRowFrom(mtIdx, platform, hash, plan, v, expires, eventAt, now, opt.notified)
		if err := tx.Insert(row); err != nil {
			return err
		}
		prior = append(prior, *row)
	} else {
		prevExpiry := row.ExpiresAt
		if claimUnowned || transferring {
			row.MtIdx = mtIdx
		}
		changed := refreshRow(row, v, plan, expires, eventAt, now, opt.notified)
		if !changed && (claimUnowned || transferring) {
			row.UpdatedAt = truncSec(now)
		}
		if changed || claimUnowned || transferring {
			if err := tx.Save(row); err != nil {
				return err
			}
		}
		found := false
		for i := range prior {
			if prior[i].ID == row.ID {
				prior[i] = *row
				found = true
			}
		}
		if !found {
			prior = append(prior, *row)
		}
		if transferring {
			if err := s.releaseFromPreviousOwner(tx, oldOwner, transferFrom, prevExpiry, now); err != nil {
				return err
			}
		}
	}

	return s.syncMember(tx, member, prior, priorDates, now)
}

// releaseFromPreviousOwner는 거래를 새 회원에게 넘긴 뒤 이전 소유자의 구독 표시 컬럼(mt_plan_date/mt_plan_check/mt_level)을
// 그의 남은 거래만으로 다시 계산한다. 넘긴 거래의 만료일을 "거래로 만든 값"으로 보고(priorDates 에 포함) 기존 이용권(legacy)으로
// 오인해 남겨 두지 않는다 — 그러지 않으면 이전 소유자(예: 정지 후 복구될 회원)가 같은 구독의 혜택을 계속 갖는다.
// 이전 소유자의 회원 행이 사라졌으면(nil) 할 일이 없다.
func (s *SubscriptionService) releaseFromPreviousOwner(tx repository.SubscriptionTxOps, oldOwner int, oldMember *model.SubscriptionMemberPlan,
	movedExpiry time.Time, now time.Time) error {
	if oldMember == nil {
		return nil
	}
	ot := tx.ForMember(oldOwner)
	rows, err := ot.ListByMember() // 이미 새 소유자로 저장된 행은 빠져 있다
	if err != nil {
		return err
	}
	dates := map[time.Time]bool{truncSec(movedExpiry): true}
	for i := range rows {
		dates[truncSec(rows[i].ExpiresAt)] = true
	}
	// 이전 소유자의 만료일 컬럼이 넘긴 거래에서 온 값이면 비운다(남은 거래가 없을 때 syncMember 가 기존 값을 그대로 유지해 혜택이 남는 것을 막는다).
	om := *oldMember
	if om.MtPlanDate != nil && truncSec(*om.MtPlanDate).Equal(truncSec(movedExpiry)) {
		om.MtPlanDate = nil
	}
	return s.syncMember(ot, &om, rows, dates, now)
}

// syncMember는 회원의 구독 표시 컬럼(mt_plan_date/mt_plan_check/mt_level)을 거래 행들로부터 다시 계산해 반영한다(계약 2·3.5).
// 기존(거래 테이블 도입 전) 만료일은 거래로 만든 값이 아니면 그대로 유지한다: 새 구독이 더 짧아도 기존 이용권을 줄이지 않는다.
func (s *SubscriptionService) syncMember(tx repository.SubscriptionTxOps, member *model.SubscriptionMemberPlan,
	rows []model.SubscriptionTransaction, priorDates map[time.Time]bool, now time.Time) error {
	var best *model.SubscriptionTransaction
	var latestEnd time.Time
	for i := range rows {
		if entitled(&rows[i], now) && (best == nil || rows[i].ExpiresAt.After(best.ExpiresAt) ||
			(rows[i].ExpiresAt.Equal(best.ExpiresAt) && rows[i].ID > best.ID)) {
			best = &rows[i]
		}
		if rows[i].ExpiresAt.After(latestEnd) {
			latestEnd = rows[i].ExpiresAt
		}
	}
	var legacy *time.Time
	if member.MtPlanDate != nil && member.MtPlanDate.After(now) && !priorDates[truncSec(*member.MtPlanDate)] {
		t := truncSec(*member.MtPlanDate)
		legacy = &t
	}

	var planDate time.Time
	planCheck := "N"
	switch {
	case best != nil && (legacy == nil || !legacy.After(best.ExpiresAt)):
		planDate = best.ExpiresAt
		if best.AutoRenew == nil || *best.AutoRenew {
			planCheck = "Y"
		}
	case legacy != nil:
		planDate = *legacy
		if member.MtPlanCheck != nil {
			planCheck = *member.MtPlanCheck // 기존 이용권이 이긴 경우 자동 갱신 표시는 건드리지 않는다
		}
	default:
		planDate = latestEnd // 권한 있는 거래 없음: 마지막 거래의 종료 시각(환불이면 현재)
		if planDate.IsZero() && member.MtPlanDate != nil {
			planDate = *member.MtPlanDate
		}
	}
	if planDate.IsZero() {
		planDate = truncSec(now)
	}
	var level *int
	if member.MtLevel != nil && (*member.MtLevel == levelFree || *member.MtLevel == levelPremium) {
		want := levelFree
		if planDate.After(now) {
			want = levelPremium
		}
		level = &want
	}
	return tx.UpdateMemberPlan(planDate, planCheck, level)
}

// ExpireLapsed는 구독이 만료된 mt_level=5 회원을 2로 되돌린다(알림 누락 보정). 바뀐 회원 수를 돌려준다.
func (s *SubscriptionService) ExpireLapsed(ctx context.Context) (int64, error) {
	return s.repo.ExpireLapsed(ctx, s.now())
}
