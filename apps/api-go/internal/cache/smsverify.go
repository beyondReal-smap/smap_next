package cache

import (
	"context"
	"time"
)

// SMSVerifyStore는 Python sms.py의 SMS 인증코드/완료상태 헬퍼를 Redis 키로 이식한다.
// 동일 Redis(db0)·동일 키 포맷을 공유하므로 Python /sms/send-verification-code·/sms/verify-code가
// 기록한 상태를 Go reset-password-by-phone이 그대로 읽는다(interop).
//   - sms:verified:{phone} : verify-code 성공 시 "1"(5분 TTL) — _is_verified/_clear_verified
//   - sms:code:{phone}     : 인증코드(3분 TTL)             — _get_verification_code/_delete_verification_code
//
// Redis 미연결(Store.client=nil)이면 모든 조회는 miss, 삭제는 no-op — Python이 Redis 불가 시
// 모듈 인메모리 fallback으로 떨어지는 것과 동등한 degraded 동작(멀티 인스턴스에선 어차피 Redis 필수).
type SMSVerifyStore struct {
	store *Store
}

// NewSMSVerifyStore는 캐시 Store를 감싸 SMS 인증상태 접근자를 만든다.
func NewSMSVerifyStore(store *Store) *SMSVerifyStore {
	return &SMSVerifyStore{store: store}
}

// IsVerified는 Python _is_verified: sms:verified:{phone} 값이 존재(truthy)하면 true.
func (s *SMSVerifyStore) IsVerified(phone string) bool {
	b, ok := s.store.GetRaw(context.Background(), "sms:verified:"+phone)
	return ok && len(b) > 0
}

// GetCode는 Python _get_verification_code: sms:code:{phone} 값. 없거나 빈 값이면 (_, false)
// (Python `return code if code else None`의 falsy 처리와 동일).
func (s *SMSVerifyStore) GetCode(phone string) (string, bool) {
	b, ok := s.store.GetRaw(context.Background(), "sms:code:"+phone)
	if !ok || len(b) == 0 {
		return "", false
	}
	return string(b), true
}

// DeleteCode는 Python _delete_verification_code: sms:code:{phone} 삭제.
func (s *SMSVerifyStore) DeleteCode(phone string) {
	s.store.Delete(context.Background(), "sms:code:"+phone)
}

// ClearVerified는 Python _clear_verified: sms:verified:{phone} 삭제(재사용 방지).
func (s *SMSVerifyStore) ClearVerified(phone string) {
	s.store.Delete(context.Background(), "sms:verified:"+phone)
}

// StoreCode는 Python _store_verification_code: sms:code:{phone} 저장(3분 TTL).
// Redis 비활성 시 no-op(인메모리 fallback 미이식 — 대표님 결정, 멀티 인스턴스는 Redis 필수).
func (s *SMSVerifyStore) StoreCode(phone, code string) {
	s.store.SetRaw(context.Background(), "sms:code:"+phone, []byte(code), 180*time.Second)
}

// MarkVerified는 Python _mark_verified: sms:verified:{phone}="1" 저장(5분 TTL).
func (s *SMSVerifyStore) MarkVerified(phone string) {
	s.store.SetRaw(context.Background(), "sms:verified:"+phone, []byte("1"), 300*time.Second)
}

// CheckRateLimit는 Python _check_rate_limit: sms:rate:{phone} incr, 첫 호출에 1시간 TTL, count<=5면 허용.
// ⚠️ Redis 비활성/오류 시 true(허용) — Python "허용 처리"와 동일(레이트리밋 실패를 차단으로 흡수하지 않음).
func (s *SMSVerifyStore) CheckRateLimit(phone string) bool {
	if !s.store.Enabled() {
		return true
	}
	ctx := context.Background()
	key := "sms:rate:" + phone
	count, err := s.store.client.Incr(ctx, key).Result()
	if err != nil {
		return true
	}
	if count == 1 {
		_ = s.store.client.Expire(ctx, key, 3600*time.Second).Err()
	}
	return count <= 5
}
