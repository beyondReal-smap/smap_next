package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// fakeVerifyStore는 authVerifyStore(SMS 인증상태)의 인메모리 테스트 더블.
type fakeVerifyStore struct {
	verified        map[string]bool
	codes           map[string]string
	deletedCode     []string
	clearedVerified []string
}

func (f *fakeVerifyStore) IsVerified(phone string) bool { return f.verified[phone] }
func (f *fakeVerifyStore) GetCode(phone string) (string, bool) {
	c, ok := f.codes[phone]
	return c, ok && c != "" // Python falsy 처리: 빈 코드는 없음으로 간주
}
func (f *fakeVerifyStore) DeleteCode(phone string) { f.deletedCode = append(f.deletedCode, phone) }
func (f *fakeVerifyStore) ClearVerified(phone string) {
	f.clearedVerified = append(f.clearedVerified, phone)
}

func pwSvc(mem *fakeAuthMemberRepo, vs *fakeVerifyStore) *AuthService {
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, testAuthConfig())
	svc.SetVerifyStore(vs)
	return svc
}

// --- forgot-password ---

func TestForgotPasswordPhoneStoresToken(t *testing.T) {
	u := activeMember(20, "a@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01012345678": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ForgotPassword("phone", "010-1234-5678")
	if !resp.Success || resp.Message != "SMS로 비밀번호 재설정 링크를 발송했습니다." {
		t.Fatalf("forgot phone 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(dto.ForgotPasswordData)
	if !ok || d.Type != "phone" || d.Contact != "010-1234-5678" || d.TokenExpires != "1분" || !d.Sent {
		t.Fatalf("forgot data 오류: %T %+v", resp.Data, resp.Data)
	}
	// 토큰이 8자로 저장됐는지(UpdateColumns 캡처).
	tok, ok := mem.lastFields["mt_reset_token"].(string)
	if !ok || len(tok) != 8 {
		t.Fatalf("mt_reset_token 저장 오류: %v", mem.lastFields)
	}
	if _, ok := mem.lastFields["mt_token_edate"]; !ok {
		t.Fatalf("mt_token_edate 미저장: %v", mem.lastFields)
	}
}

func TestForgotPasswordEmailChannel(t *testing.T) {
	u := activeMember(21, "e@x.com")
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"e@x.com": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ForgotPassword("email", "e@x.com")
	if !resp.Success || resp.Message != "이메일로 비밀번호 재설정 링크를 발송했습니다." {
		t.Fatalf("forgot email 성공 오류: %+v", resp)
	}
}

func TestForgotPasswordNotFound(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ForgotPassword("email", "none@x.com")
	if resp.Success || resp.Message != "등록되지 않은 연락처입니다." || resp.Data != nil {
		t.Fatalf("forgot 미발견 오류: %+v", resp)
	}
}

// --- verify-reset-token ---

func TestVerifyResetTokenBadLength(t *testing.T) {
	resp := pwSvc(&fakeAuthMemberRepo{}, &fakeVerifyStore{}).VerifyResetToken("abc")
	if resp.Success || resp.Message != "유효하지 않은 토큰입니다." {
		t.Fatalf("verify 길이 오류: %+v", resp)
	}
}

func TestVerifyResetTokenNotFound(t *testing.T) {
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{}}
	resp := pwSvc(mem, &fakeVerifyStore{}).VerifyResetToken("12345678")
	if resp.Success || resp.Message != "토큰이 만료되었거나 유효하지 않습니다." {
		t.Fatalf("verify 미발견 오류: %+v", resp)
	}
}

func TestVerifyResetTokenFound(t *testing.T) {
	u := activeMember(22, "v@x.com")
	u.MtHp = pStr("01099998888")
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{"abcd1234": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).VerifyResetToken("abcd1234")
	if !resp.Success || resp.Message != "토큰이 유효합니다." {
		t.Fatalf("verify 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(dto.VerifyResetTokenData)
	if !ok || d.UserID != 22 || d.Type != "phone" || d.Email == nil || *d.Email != "v@x.com" || d.Phone == nil || *d.Phone != "01099998888" {
		t.Fatalf("verify data 오류: %T %+v", resp.Data, resp.Data)
	}
}

// --- reset-password ---

func TestResetPasswordBadLength(t *testing.T) {
	resp := pwSvc(&fakeAuthMemberRepo{}, &fakeVerifyStore{}).ResetPassword("abc", "Test1234!@")
	if resp.Success || resp.Message != "유효하지 않은 토큰입니다." {
		t.Fatalf("reset 길이 오류: %+v", resp)
	}
}

func TestResetPasswordTokenNotFound(t *testing.T) {
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ResetPassword("12345678", "Test1234!@")
	if resp.Success || resp.Message != "토큰이 만료되었거나 유효하지 않습니다." {
		t.Fatalf("reset 미발견 오류: %+v", resp)
	}
}

func TestResetPasswordWeakShort(t *testing.T) {
	u := activeMember(23, "r@x.com")
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{"abcd1234": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ResetPassword("abcd1234", "ab1!")
	if resp.Success || resp.Message != "비밀번호는 8자 이상이어야 합니다." {
		t.Fatalf("reset 짧은비번 오류: %+v", resp)
	}
}

func TestResetPasswordWeakNoSpecial(t *testing.T) {
	u := activeMember(24, "r@x.com")
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{"abcd1234": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ResetPassword("abcd1234", "abcd1234")
	if resp.Success || resp.Message != "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다." {
		t.Fatalf("reset 약한비번 오류: %+v", resp)
	}
}

func TestResetPasswordSuccess(t *testing.T) {
	u := activeMember(25, "r@x.com")
	mem := &fakeAuthMemberRepo{byReset: map[string]*model.Member{"abcd1234": u}}
	resp := pwSvc(mem, &fakeVerifyStore{}).ResetPassword("abcd1234", "Test1234!@")
	if !resp.Success || resp.Message != "비밀번호가 성공적으로 변경되었습니다." {
		t.Fatalf("reset 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(dto.ResetPasswordData)
	if !ok || d.UserID != 25 || d.Email == nil || *d.Email != "r@x.com" || d.UpdatedAt == "" {
		t.Fatalf("reset data 오류: %T %+v", resp.Data, resp.Data)
	}
	// 마지막 UpdateColumns가 토큰 무효화(nil)였는지.
	if v, ok := mem.lastFields["mt_reset_token"]; !ok || v != nil {
		t.Fatalf("토큰 무효화 누락: %v", mem.lastFields)
	}
}

// --- reset-password-by-phone ---

func TestResetByPhoneVerifiedSuccess(t *testing.T) {
	u := activeMember(26, "p@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": u}}
	vs := &fakeVerifyStore{verified: map[string]bool{"01011112222": true}}
	resp := pwSvc(mem, vs).ResetPasswordByPhone("010-1111-2222", "", "Test1234!@")
	if !resp.Success || resp.Message != "비밀번호가 성공적으로 변경되었습니다." {
		t.Fatalf("by-phone 인증완료 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(dto.ResetPasswordByPhoneData)
	if !ok || d.UserID != 26 || d.UpdatedAt == "" {
		t.Fatalf("by-phone data 오류: %T %+v", resp.Data, resp.Data)
	}
	if len(vs.clearedVerified) != 1 {
		t.Fatalf("인증상태 정리 누락: %+v", vs.clearedVerified)
	}
}

func TestResetByPhoneCodeMatchSuccess(t *testing.T) {
	u := activeMember(27, "p@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": u}}
	vs := &fakeVerifyStore{verified: map[string]bool{}, codes: map[string]string{"01011112222": "123456"}}
	resp := pwSvc(mem, vs).ResetPasswordByPhone("01011112222", "123456", "Test1234!@")
	if !resp.Success {
		t.Fatalf("by-phone 코드일치 성공 오류: %+v", resp)
	}
	if len(vs.deletedCode) != 1 {
		t.Fatalf("코드 삭제 누락: %+v", vs.deletedCode)
	}
}

func TestResetByPhoneNoCode(t *testing.T) {
	mem := &fakeAuthMemberRepo{}
	vs := &fakeVerifyStore{verified: map[string]bool{}, codes: map[string]string{}}
	resp := pwSvc(mem, vs).ResetPasswordByPhone("01011112222", "", "Test1234!@")
	if resp.Success || resp.Message != pwResetServerErrMsg {
		t.Fatalf("by-phone 코드없음(HTTPException 흡수) 오류: %+v", resp)
	}
}

func TestResetByPhoneCodeMismatch(t *testing.T) {
	mem := &fakeAuthMemberRepo{}
	vs := &fakeVerifyStore{verified: map[string]bool{}, codes: map[string]string{"01011112222": "123456"}}
	resp := pwSvc(mem, vs).ResetPasswordByPhone("01011112222", "999999", "Test1234!@")
	if resp.Success || resp.Message != pwResetServerErrMsg {
		t.Fatalf("by-phone 코드불일치(HTTPException 흡수) 오류: %+v", resp)
	}
}

func TestResetByPhoneUserNotFound(t *testing.T) {
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{}}
	vs := &fakeVerifyStore{verified: map[string]bool{"01011112222": true}}
	resp := pwSvc(mem, vs).ResetPasswordByPhone("01011112222", "", "Test1234!@")
	if resp.Success || resp.Message != "등록되지 않은 전화번호입니다." {
		t.Fatalf("by-phone 미발견 오류: %+v", resp)
	}
}
