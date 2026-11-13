package service

import (
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// reset-password-by-phone의 직접 코드 비교는 /sms/verify-code와 같은 시도 카운터를 공유한다.
func phoneResetSvc(vs *fakeVerifyStore, st *fakeEmailStore) *AuthService {
	u := activeMember(27, "p@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": u}}
	svc := pwSvc(mem, vs)
	svc.SetSecurityStore(st)
	svc.SetSMSVerifyMaxAttempts(5)
	return svc
}

func TestResetByPhoneDirectCompareLimited(t *testing.T) {
	vs := &fakeVerifyStore{verified: map[string]bool{}, codes: map[string]string{"01011112222": "123456"}}
	svc := phoneResetSvc(vs, newFakeEmailStore())
	for i := 0; i < 5; i++ {
		if r := svc.ResetPasswordByPhone("01011112222", "000000", "Test1234!@"); r.Success {
			t.Fatalf("오답이 성공함")
		}
	}
	// 6번째는 정답이어도 코드가 폐기된다.
	if r := svc.ResetPasswordByPhone("01011112222", "123456", "Test1234!@"); r.Success {
		t.Fatalf("5회 초과 후 정답이 성공함")
	}
	if len(vs.deletedCode) != 1 {
		t.Fatalf("코드 폐기 누락: %+v", vs.deletedCode)
	}
}

func TestResetByPhoneDirectCompareRedisDownFailsClosed(t *testing.T) {
	vs := &fakeVerifyStore{verified: map[string]bool{}, codes: map[string]string{"01011112222": "123456"}}
	st := newFakeEmailStore()
	st.err = errors.New("redis down")
	if r := phoneResetSvc(vs, st).ResetPasswordByPhone("01011112222", "123456", "Test1234!@"); r.Success {
		t.Fatalf("카운터를 올릴 수 없으면 비교하지 않고 실패해야 함")
	}
}

func TestResetByPhoneVerifiedStateSkipsCounter(t *testing.T) {
	// 이미 verify-code를 통과한 상태(sms:verified)는 카운터 없이 진행(구버전 흐름 호환).
	vs := &fakeVerifyStore{verified: map[string]bool{"01011112222": true}}
	svc := phoneResetSvc(vs, newFakeEmailStore())
	if r := svc.ResetPasswordByPhone("01011112222", "", "Test1234!@"); !r.Success {
		t.Fatalf("인증 완료 상태 성공 오류: %+v", r)
	}
}
