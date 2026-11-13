package service

import (
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"math/big"
	"strconv"
)

// smsVerifyStore는 SMSVerifyService가 의존하는 Redis 인증상태 저장소(cache.SMSVerifyStore 구현).
type smsVerifyStore interface {
	CheckRateLimit(phone string) bool
	StoreCode(phone, code string)
	GetCode(phone string) (string, bool)
	DeleteCode(phone string)
	MarkVerified(phone string)
}

// smsSender는 SMS 발송 의존(SMSService 구현).
type smsSender interface {
	SendSMS(phone, message, subject string) SMSResult
}

// SMSVerifyService는 Python sms.py의 인증번호 발송/검증 오케스트레이션을 이식한다.
type SMSVerifyService struct {
	sms   smsSender
	store smsVerifyStore
}

func NewSMSVerify(sms smsSender, store smsVerifyStore) *SMSVerifyService {
	return &SMSVerifyService{sms: sms, store: store}
}

// VerificationResult는 send-verification-code/verify-code 응답({success, error}).
type VerificationResult struct {
	Success bool
	Error   *string
}

// SendVerificationCode는 Python send_verification_code를 이식한다.
// 레이트리밋 → 6자리 코드(CSPRNG) → SMS 발송 → 성공 시 Redis 저장(3분). 발송 실패 시 그 메시지 반환.
func (s *SMSVerifyService) SendVerificationCode(phoneNumber string) VerificationResult {
	clean := cleanPhone(phoneNumber)
	if !s.store.CheckRateLimit(clean) {
		return verErr("너무 많은 요청입니다. 잠시 후 다시 시도해주세요.")
	}
	code := genCode6()
	message := fmt.Sprintf("[SMAP] 인증번호는 %s입니다. 3분 이내에 입력해주세요.", code)
	result := s.sms.SendSMS(phoneNumber, message, "SMAP 인증번호")
	if result.Success {
		s.store.StoreCode(clean, code) // 응답엔 코드 미포함(서버에만 저장)
		return VerificationResult{Success: true}
	}
	return verErr(result.Message)
}

// VerifyCode는 Python verify_code를 이식한다(상수시간 비교 → 성공 시 코드삭제 + 인증완료 마킹 5분).
func (s *SMSVerifyService) VerifyCode(phoneNumber, code string) VerificationResult {
	clean := cleanPhone(phoneNumber)
	stored, ok := s.store.GetCode(clean)
	if !ok {
		return verErr("인증번호를 먼저 요청해주세요.")
	}
	if subtle.ConstantTimeCompare([]byte(code), []byte(stored)) != 1 {
		return verErr("인증번호가 일치하지 않습니다.")
	}
	s.store.DeleteCode(clean)
	s.store.MarkVerified(clean) // reset-password 등 후속 플로우 연계
	return VerificationResult{Success: true}
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
