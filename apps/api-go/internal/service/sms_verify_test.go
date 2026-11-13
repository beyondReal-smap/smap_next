package service

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
)

type fakeSMSSender struct {
	result   SMSResult
	lastMsg  string
	lastSubj string
	calls    int
}

func (f *fakeSMSSender) SendSMS(phone, message, subject string) SMSResult {
	f.calls++
	f.lastMsg = message
	f.lastSubj = subject
	return f.result
}

var testSMSLimits = SMSLimits{PerPhone: 5, PerIP: 20, Window: time.Hour, MaxAttempts: 5}

func newSMSSvc(sender *fakeSMSSender, store *fakeEmailStore) *SMSVerifyService {
	return NewSMSVerify(sender, store, testSMSLimits, slog.New(slog.NewTextHandler(discardWriter{}, nil)))
}

type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }

func okSender() *fakeSMSSender { return &fakeSMSSender{result: SMSResult{Success: true}} }

func TestSendVerificationCodeSuccess(t *testing.T) {
	sender, store := okSender(), newFakeEmailStore()
	r := newSMSSvc(sender, store).SendVerificationCode(context.Background(), "010-1111-2222", "1.1.1.1")
	if !r.Success || r.Error != nil || r.Status != 0 {
		t.Fatalf("성공 오류: %+v", r)
	}
	code := store.vals[cache.SMSCodeKey("01011112222")]
	if len(code) != 6 || store.ttls[cache.SMSCodeKey("01011112222")] != 180*time.Second {
		t.Fatalf("코드 저장(6자리, 3분) 오류: %q", code)
	}
	if !strings.Contains(sender.lastMsg, code) || sender.lastSubj != "SMAP 인증번호" {
		t.Fatalf("발송 메시지/제목 오류")
	}
}

func TestSendVerificationCodePhoneLimit429(t *testing.T) {
	sender, store := okSender(), newFakeEmailStore()
	svc := newSMSSvc(sender, store)
	for i := 0; i < 5; i++ {
		// IP를 바꿔 번호 한도만 검증한다.
		if r := svc.SendVerificationCode(context.Background(), "01011112222", "9.9.9."+string(rune('0'+i))); !r.Success {
			t.Fatalf("%d번째 발송이 막힘: %+v", i+1, r)
		}
	}
	store.ttls["sms:rate:01011112222"] = 90 * time.Second // 남은 창 시간
	r := svc.SendVerificationCode(context.Background(), "010-1111-2222", "9.9.9.9")
	if r.Success || r.Status != http.StatusTooManyRequests || r.RetryAfter != 90 {
		t.Fatalf("번호 한도 429 오류: %+v", r)
	}
	if r.Error == nil || !strings.Contains(*r.Error, "약 2분") {
		t.Fatalf("남은 시간 문구 오류: %v", r.Error)
	}
	if sender.calls != 5 {
		t.Fatalf("한도 초과 시 발송하면 안 됨: calls=%d", sender.calls)
	}
}

func TestSendVerificationCodeIPLimit429(t *testing.T) {
	sender, store := okSender(), newFakeEmailStore()
	svc := newSMSSvc(sender, store)
	for i := 0; i < 20; i++ {
		phone := "0101111" + string(rune('0'+i/10)) + string(rune('0'+i%10)) + "00"
		if r := svc.SendVerificationCode(context.Background(), phone, "7.7.7.7"); !r.Success {
			t.Fatalf("%d번째 발송이 막힘: %+v", i+1, r)
		}
	}
	store.ttls["sms:rate_ip:7.7.7.7"] = 30 * time.Second
	r := svc.SendVerificationCode(context.Background(), "01099998888", "7.7.7.7")
	if r.Status != http.StatusTooManyRequests || r.RetryAfter != 30 || r.Error == nil || !strings.Contains(*r.Error, "30초") {
		t.Fatalf("IP 한도 429 오류: %+v", r)
	}
	if sender.calls != 20 {
		t.Fatalf("IP 한도 초과 시 발송하면 안 됨: calls=%d", sender.calls)
	}
	// 다른 IP는 영향 없음
	if r := svc.SendVerificationCode(context.Background(), "01099998888", "8.8.8.8"); !r.Success {
		t.Fatalf("다른 IP가 막힘: %+v", r)
	}
}

func TestSendVerificationCodeRedisDown503(t *testing.T) {
	sender, store := okSender(), newFakeEmailStore()
	store.err = errors.New("redis down")
	r := newSMSSvc(sender, store).SendVerificationCode(context.Background(), "01011112222", "1.1.1.1")
	if r.Success || r.Status != http.StatusServiceUnavailable || r.Error == nil {
		t.Fatalf("Redis 장애 503 오류: %+v", r)
	}
	if strings.Contains(*r.Error, "redis") {
		t.Fatalf("원인이 응답에 노출됨: %q", *r.Error)
	}
	if sender.calls != 0 {
		t.Fatalf("Redis 장애 시 SMS 발송하면 안 됨(과금)")
	}
}

func TestSendVerificationCodeRedisDisabled503(t *testing.T) {
	sender := okSender()
	svc := NewSMSVerify(sender, cache.NewStore(nil), testSMSLimits, nil) // REDIS_URL 미설정 Store
	r := svc.SendVerificationCode(context.Background(), "01011112222", "1.1.1.1")
	if r.Status != http.StatusServiceUnavailable || sender.calls != 0 {
		t.Fatalf("Redis 비활성 503 오류: %+v calls=%d", r, sender.calls)
	}
}

func TestSendVerificationCodeSendFail(t *testing.T) {
	sender := &fakeSMSSender{result: SMSResult{Success: false, Message: "발신번호 오류"}}
	store := newFakeEmailStore()
	r := newSMSSvc(sender, store).SendVerificationCode(context.Background(), "01011112222", "1.1.1.1")
	if r.Success || r.Error == nil || *r.Error != "발신번호 오류" || r.Status != 0 {
		t.Fatalf("발송 실패 메시지 전달 오류: %+v", r)
	}
	if _, ok := store.vals[cache.SMSCodeKey("01011112222")]; ok {
		t.Fatalf("발송 실패 시 코드 저장하면 안 됨")
	}
}

func TestSendVerificationCodeResetsAttempts(t *testing.T) {
	store := newFakeEmailStore()
	store.counts[SMSAttemptsKey("01011112222")] = 4
	newSMSSvc(okSender(), store).SendVerificationCode(context.Background(), "01011112222", "1.1.1.1")
	if _, ok := store.counts[SMSAttemptsKey("01011112222")]; ok {
		t.Fatalf("새 코드 발송 시 이전 시도 카운터를 비워야 함")
	}
}

func TestVerifyCodeNoCode(t *testing.T) {
	r := newSMSSvc(okSender(), newFakeEmailStore()).VerifyCode(context.Background(), "01011112222", "123456")
	if r.Success || *r.Error != "인증번호를 먼저 요청해주세요." || r.Status != 0 {
		t.Fatalf("코드없음 오류: %+v", r)
	}
}

func TestVerifyCodeMismatch(t *testing.T) {
	store := newFakeEmailStore()
	store.vals[cache.SMSCodeKey("01011112222")] = "654321"
	r := newSMSSvc(okSender(), store).VerifyCode(context.Background(), "01011112222", "123456")
	if r.Success || *r.Error != "인증번호가 일치하지 않습니다." || r.Status != 0 {
		t.Fatalf("불일치 오류: %+v", r)
	}
}

func TestVerifyCodeMatch(t *testing.T) {
	store := newFakeEmailStore()
	store.vals[cache.SMSCodeKey("01011112222")] = "654321"
	r := newSMSSvc(okSender(), store).VerifyCode(context.Background(), "010-1111-2222", "654321")
	if !r.Success || r.Error != nil || r.Status != 0 {
		t.Fatalf("일치 성공 오류: %+v", r)
	}
	if _, ok := store.vals[cache.SMSCodeKey("01011112222")]; ok {
		t.Fatalf("성공 후 코드 삭제 누락")
	}
	// reset-password-by-phone이 읽는 인증 완료 상태(5분 TTL, 값 "1")를 유지해야 한다.
	if store.vals[cache.SMSVerifiedKey("01011112222")] != "1" || store.ttls[cache.SMSVerifiedKey("01011112222")] != 300*time.Second {
		t.Fatalf("인증 완료 상태 저장 오류")
	}
}

func TestVerifyCodeDiscardedAfterMaxAttempts(t *testing.T) {
	store := newFakeEmailStore()
	store.vals[cache.SMSCodeKey("01011112222")] = "654321"
	svc := newSMSSvc(okSender(), store)
	for i := 0; i < 5; i++ {
		if r := svc.VerifyCode(context.Background(), "01011112222", "000000"); r.Success || *r.Error != "인증번호가 일치하지 않습니다." {
			t.Fatalf("%d번째 시도 오류: %+v", i+1, r)
		}
	}
	// 6번째는 올바른 코드여도 이미 폐기 대상이다.
	r := svc.VerifyCode(context.Background(), "01011112222", "654321")
	if r.Success || r.Error == nil || *r.Error != smsAttemptsMsg {
		t.Fatalf("5회 초과 폐기 오류: %+v", r)
	}
	if _, ok := store.vals[cache.SMSCodeKey("01011112222")]; ok {
		t.Fatalf("코드가 폐기되지 않음")
	}
	if _, ok := store.vals[cache.SMSVerifiedKey("01011112222")]; ok {
		t.Fatalf("폐기 후 인증 완료가 기록되면 안 됨")
	}
	// 폐기 후에는 재요청 안내
	if r := svc.VerifyCode(context.Background(), "01011112222", "654321"); *r.Error != "인증번호를 먼저 요청해주세요." {
		t.Fatalf("폐기 후 안내 오류: %+v", r)
	}
}

func TestVerifyCodeFifthAttemptStillAllowed(t *testing.T) {
	store := newFakeEmailStore()
	store.vals[cache.SMSCodeKey("01011112222")] = "654321"
	svc := newSMSSvc(okSender(), store)
	for i := 0; i < 4; i++ {
		svc.VerifyCode(context.Background(), "01011112222", "000000")
	}
	if r := svc.VerifyCode(context.Background(), "01011112222", "654321"); !r.Success {
		t.Fatalf("5번째 시도의 정답은 허용되어야 함: %+v", r)
	}
}

func TestVerifyCodeRedisDown503(t *testing.T) {
	store := newFakeEmailStore()
	store.err = errors.New("redis down")
	r := newSMSSvc(okSender(), store).VerifyCode(context.Background(), "01011112222", "123456")
	if r.Success || r.Status != http.StatusServiceUnavailable {
		t.Fatalf("검증 Redis 장애 503 오류: %+v", r)
	}
}
