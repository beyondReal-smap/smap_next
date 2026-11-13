package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
)

const (
	smsCodeTTL     = 180 * time.Second // 인증번호 유효시간(3분, Python과 동일)
	smsVerifiedTTL = 300 * time.Second // 인증 완료 상태 유지시간(5분, Python과 동일)

	smsRateMsg        = "요청 횟수를 초과했습니다. %s 후 다시 시도해주세요."
	smsUnavailableMsg = "일시적으로 인증번호를 처리할 수 없습니다. 잠시 후 다시 시도해주세요."
	smsAttemptsMsg    = "인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요."
)

// smsStore는 SMS 인증 상태·한도의 Redis 연산이다(구현은 *cache.Store). 모든 메서드는 에러를 숨기지 않는다.
type smsStore interface {
	cache.CounterStore
	SetEX(ctx context.Context, key, val string, ttl time.Duration) error
	GetString(ctx context.Context, key string) (string, bool, error)
	DelKeys(ctx context.Context, keys ...string) (int64, error)
}

// smsSender는 SMS 발송 의존(SMSService 구현).
type smsSender interface {
	SendSMS(phone, message, subject string) SMSResult
}

// SMSLimits는 SMS 인증 남용 방지 설정이다.
type SMSLimits struct {
	PerPhone    int           // 번호당 발송 한도(창당)
	PerIP       int           // IP당 발송 한도(창당)
	Window      time.Duration // 발송 한도 창
	MaxAttempts int           // 인증번호 하나에 허용하는 검증 시도 횟수. 초과하면 코드를 폐기한다.
}

// SMSVerifyService는 Python sms.py의 인증번호 발송/검증 오케스트레이션을 이식한다.
// 한도·코드·완료 상태는 모두 Redis이며, Redis를 쓸 수 없으면 무제한 허용하지 않고 503으로 실패한다(SMS는 건당 과금).
type SMSVerifyService struct {
	sms    smsSender
	store  smsStore
	limits SMSLimits
	logger *slog.Logger
}

func NewSMSVerify(sms smsSender, store smsStore, limits SMSLimits, logger *slog.Logger) *SMSVerifyService {
	if logger == nil {
		logger = slog.Default()
	}
	return &SMSVerifyService{sms: sms, store: store, limits: limits, logger: logger}
}

// VerificationResult는 send-verification-code/verify-code 응답({success, error})과 HTTP 상태다.
// Status가 0이면 200이다. 429/503일 때만 다른 값이며 RetryAfter(초)는 429에서만 채워진다.
type VerificationResult struct {
	Success    bool
	Error      *string
	Status     int
	RetryAfter int
}

// SMSAttemptsKey는 인증번호 검증 시도 카운터 키다. reset-password-by-phone의 직접 코드 비교도 같은 카운터를 쓴다.
func SMSAttemptsKey(phone string) string { return "sms:verify_attempts:" + phone }

// SendVerificationCode는 Python send_verification_code를 이식한다.
// IP 한도 → 번호 한도 → 6자리 코드(CSPRNG) → SMS 발송 → 성공 시 Redis 저장(3분). 발송 실패 시 그 메시지 반환.
// 한도 카운터는 발송 전에 증가시킨다(발송 실패도 한도에 포함 — 과금/남용 방어 우선).
func (s *SMSVerifyService) SendVerificationCode(ctx context.Context, phoneNumber, ip string) VerificationResult {
	clean := cleanPhone(phoneNumber)
	for _, k := range []struct {
		key   string
		limit int
	}{
		{"sms:rate_ip:" + ip, s.limits.PerIP},
		{"sms:rate:" + clean, s.limits.PerPhone},
	} {
		retry, err := cache.HitFixedWindow(ctx, s.store, k.key, int64(k.limit), s.limits.Window)
		if err != nil {
			return s.unavailable("send_limit", err)
		}
		if retry > 0 {
			return rateLimited(retry)
		}
	}
	code := genCode6()
	message := fmt.Sprintf("[SMAP] 인증번호는 %s입니다. 3분 이내에 입력해주세요.", code)
	result := s.sms.SendSMS(phoneNumber, message, "SMAP 인증번호")
	if !result.Success {
		return verErr(result.Message)
	}
	// 새 코드 저장과 함께 이전 시도 카운터를 비운다. 저장 실패는 발송이 이미 일어났으므로 503으로 알린다.
	if err := s.store.SetEX(ctx, cache.SMSCodeKey(clean), code, smsCodeTTL); err != nil {
		return s.unavailable("store_code", err) // 응답엔 코드 미포함(서버에만 저장)
	}
	if _, err := s.store.DelKeys(ctx, SMSAttemptsKey(clean)); err != nil {
		return s.unavailable("reset_attempts", err)
	}
	return VerificationResult{Success: true}
}

// VerifyCode는 Python verify_code를 이식한다(상수시간 비교 → 성공 시 코드삭제 + 인증완료 마킹 5분).
// 시도 카운터를 비교 전에 올려 MaxAttempts를 넘기면 코드를 폐기한다(재요청 필요).
func (s *SMSVerifyService) VerifyCode(ctx context.Context, phoneNumber, code string) VerificationResult {
	clean := cleanPhone(phoneNumber)
	stored, ok, err := s.store.GetString(ctx, cache.SMSCodeKey(clean))
	if err != nil {
		return s.unavailable("get_code", err)
	}
	if !ok || stored == "" {
		return verErr("인증번호를 먼저 요청해주세요.")
	}
	n, err := s.store.IncrWithExpire(ctx, SMSAttemptsKey(clean), smsCodeTTL)
	if err != nil {
		return s.unavailable("attempt_incr", err)
	}
	if n > int64(s.limits.MaxAttempts) {
		if _, err := s.store.DelKeys(ctx, cache.SMSCodeKey(clean), SMSAttemptsKey(clean)); err != nil {
			return s.unavailable("discard_code", err)
		}
		return verErr(smsAttemptsMsg)
	}
	if subtle.ConstantTimeCompare([]byte(code), []byte(stored)) != 1 {
		return verErr("인증번호가 일치하지 않습니다.")
	}
	if _, err := s.store.DelKeys(ctx, cache.SMSCodeKey(clean), SMSAttemptsKey(clean)); err != nil {
		return s.unavailable("delete_code", err)
	}
	if err := s.store.SetEX(ctx, cache.SMSVerifiedKey(clean), "1", smsVerifiedTTL); err != nil { // reset-password 등 후속 플로우 연계
		return s.unavailable("mark_verified", err)
	}
	return VerificationResult{Success: true}
}

// unavailable은 Redis 오류를 503으로 바꾼다. 원인(err)은 로그에만 남기고 응답에는 노출하지 않는다.
func (s *SMSVerifyService) unavailable(op string, err error) VerificationResult {
	s.logger.Error("sms_store_unavailable", slog.String("op", op), slog.Bool("redis_disabled", errors.Is(err, cache.ErrDisabled)), slog.String("err", err.Error()))
	msg := smsUnavailableMsg
	return VerificationResult{Success: false, Error: &msg, Status: http.StatusServiceUnavailable}
}

func rateLimited(retryAfter int) VerificationResult {
	msg := fmt.Sprintf(smsRateMsg, humanWait(retryAfter))
	return VerificationResult{Success: false, Error: &msg, Status: http.StatusTooManyRequests, RetryAfter: retryAfter}
}

// humanWait는 남은 초를 "N초"/"약 N분"으로 표현한다(로그인 한도 문구와 같은 분 올림).
func humanWait(secs int) string {
	if secs < 60 {
		return strconv.Itoa(secs) + "초"
	}
	return fmt.Sprintf("약 %d분", int(math.Ceil(float64(secs)/60)))
}

func verErr(msg string) VerificationResult {
	return VerificationResult{Success: false, Error: &msg}
}

// genCode6은 Python `str(secrets.randbelow(900000) + 100000)`: 6자리 100000~999999(CSPRNG).
func genCode6() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		// crypto/rand 실패는 시스템 수준 장애(사실상 도달 불가). 안전값으로 처리.
		return "100000"
	}
	return strconv.Itoa(int(n.Int64()) + 100000)
}
