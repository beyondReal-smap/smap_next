package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// fakeRegStore는 authRegisterStore 더블이다.
type fakeRegStore struct {
	specs []repository.RegisterSpec
	err   error
}

func (f *fakeRegStore) RegisterWithRefresh(spec repository.RegisterSpec) (*model.Member, string, error) {
	if f.err != nil {
		return nil, "", f.err
	}
	f.specs = append(f.specs, spec)
	m := *spec.Member
	m.MtIdx = 500 + len(f.specs)
	return &m, "raw-refresh", nil
}

type g4Env struct {
	svc   *AuthService
	reg   *fakeRegStore
	mem   *fakeAuthMemberRepo
	em    *emailHarness
	guard *fakeEmailStore
	vs    *fakeVerifyStore
	rev   *fakeRevoker
}

func newG4(policy AuthPolicy) *g4Env {
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{}, byEmail: map[string]*model.Member{}}
	e := &g4Env{mem: mem, reg: &fakeRegStore{}, em: newEmailHarness(), guard: newFakeEmailStore(), vs: &fakeVerifyStore{verified: map[string]bool{}}, rev: &fakeRevoker{}}
	e.svc = NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r1"}, testAuthConfig())
	e.svc.SetRegisterStore(e.reg)
	e.svc.SetEmailTokens(e.em.svc)
	e.svc.SetSecurityStore(e.guard)
	e.svc.SetVerifyStore(e.vs)
	e.svc.SetAccessRevoker(e.rev)
	if policy.LoginFailPerAccount == 0 {
		policy.LoginFailPerAccount, policy.LoginFailPerIP, policy.LoginFailWindow = 3, 100, time.Minute
	}
	e.svc.SetPolicy(policy)
	return e
}

var g4Meta = ClientMeta{UserAgent: "ua", IPHash: "h", ClientIP: "198.51.100.7"}

func sPtr(s string) *string { return &s }

func (e *g4Env) emailToken(t *testing.T, email string) string {
	t.Helper()
	return e.em.issueVerified(t, email, EmailPurposeRegister, 0)
}

func TestG4RegisterEmailTokenKeepsEmailIntact(t *testing.T) {
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	tok := e.emailToken(t, "A.b-c@Example.com")
	resp, rej := e.svc.Register(context.Background(), RegisterInput{
		MtID: "ignored", MtPwd: sPtr("Passw0rd!x"), MtName: "n", MtNickname: "nick", EmailVerificationToken: tok,
		MtEmail: sPtr("a.b-c@example.com"),
	}, g4Meta)
	if rej != nil || resp == nil || !resp.Success {
		t.Fatalf("가입 실패: %v", rej)
	}
	sp := e.reg.specs[0]
	if sp.ID != "a.b-c@example.com" || sp.Email != "a.b-c@example.com" {
		t.Errorf("이메일 ID가 하이픈 제거 등으로 변형됨: %q", sp.ID)
	}
	if *sp.Member.MtLevel != newMemberLevel || *sp.Member.MtType != newMemberType {
		t.Error("권한 필드는 서버가 정해야 함")
	}
	// 같은 토큰 재사용 불가
	_, rej = e.svc.Register(context.Background(), RegisterInput{MtPwd: sPtr("Passw0rd!x"), EmailVerificationToken: tok}, g4Meta)
	if rej == nil || rej.Status != 400 {
		t.Errorf("토큰 재사용은 400이어야 함: %+v", rej)
	}
}

func TestG4RegisterEmailBodyMismatchRejected(t *testing.T) {
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	tok := e.emailToken(t, "a@example.com")
	_, rej := e.svc.Register(context.Background(), RegisterInput{MtPwd: sPtr("Passw0rd!x"), EmailVerificationToken: tok, MtEmail: sPtr("b@example.com")}, g4Meta)
	if rej == nil || rej.Status != 400 || len(e.reg.specs) != 0 {
		t.Fatalf("본문 이메일 불일치는 400: %+v", rej)
	}
}

func TestG4RegisterConflictRestoresTokenLease(t *testing.T) {
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	tok := e.emailToken(t, "a@example.com")
	e.reg.err = &repository.RegisterConflictError{Field: "email"}
	_, rej := e.svc.Register(context.Background(), RegisterInput{MtPwd: sPtr("Passw0rd!x"), EmailVerificationToken: tok}, g4Meta)
	if rej == nil || rej.Status != http.StatusConflict {
		t.Fatalf("중복은 409: %+v", rej)
	}
	e.reg.err = nil
	if _, rej = e.svc.Register(context.Background(), RegisterInput{MtPwd: sPtr("Passw0rd!x"), EmailVerificationToken: tok}, g4Meta); rej != nil {
		t.Errorf("실패 후 같은 토큰으로 재시도 가능해야 함: %+v", rej)
	}
}

func TestG4RegisterWeakPasswordAndBadBirth400(t *testing.T) {
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	_, rej := e.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("abc")}, g4Meta)
	if rej == nil || rej.Status != 400 {
		t.Errorf("약한 비밀번호 400: %+v", rej)
	}
	_, rej = e.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("Passw0rd!x"), MtBirth: sPtr("2020-13-45")}, g4Meta)
	if rej == nil || rej.Status != 400 {
		t.Errorf("생년월일 오류 400: %+v", rej)
	}
}

func TestG4LegacyRegister(t *testing.T) {
	// 허용 + 전화번호: 이메일은 저장하지 않는다.
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	resp, rej := e.svc.Register(context.Background(), RegisterInput{MtID: "010-1234-5678", MtPwd: sPtr("Passw0rd!x"), MtEmail: sPtr("victim@example.com")}, g4Meta)
	if rej != nil || !resp.Success {
		t.Fatalf("%+v", rej)
	}
	if sp := e.reg.specs[0]; sp.Phone != "01012345678" || sp.Email != "" || sp.Member.MtEmail != nil {
		t.Errorf("검증되지 않은 이메일 저장 금지: %+v", sp)
	}
	// 이메일 형태 ID는 토큰 없이 불가
	if _, rej = e.svc.Register(context.Background(), RegisterInput{MtID: "victim@example.com", MtPwd: sPtr("Passw0rd!x")}, g4Meta); rej == nil || rej.Status != 400 {
		t.Errorf("이메일 ID 무토큰 가입 거부: %+v", rej)
	}
	// 플래그 off
	off := newG4(AuthPolicy{AllowLegacyPhoneRegister: false})
	if _, rej = off.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("Passw0rd!x")}, g4Meta); rej == nil || rej.Status != 400 {
		t.Errorf("ALLOW_LEGACY_PHONE_REGISTER=false 거부: %+v", rej)
	}
	// SMS 인증 요구 + 성공 시 verified 해제
	req := newG4(AuthPolicy{AllowLegacyPhoneRegister: true, LegacyRegisterRequireSMS: true})
	if _, rej = req.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("Passw0rd!x")}, g4Meta); rej == nil {
		t.Error("SMS 미인증 거부")
	}
	req.vs.verified["01012345678"] = true
	if _, rej = req.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("Passw0rd!x")}, g4Meta); rej != nil {
		t.Errorf("SMS 인증 후 성공: %+v", rej)
	}
	if len(req.vs.clearedVerified) != 1 {
		t.Error("가입 성공 후 verified 상태 소거")
	}
}

func TestG4SocialRegisterPolicies(t *testing.T) {
	in := RegisterInput{MtID: "kakao_123", MtPwd: sPtr("Passw0rd!x"), MtKakaoID: sPtr("123")}
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true, SocialRegisterRequireToken: true})
	if _, rej := e.svc.Register(context.Background(), in, g4Meta); rej == nil || rej.Status != 400 {
		t.Errorf("토큰 강제 시 ID만 가입 거부: %+v", rej)
	}
	p := newG4(AuthPolicy{AllowLegacyPhoneRegister: true, SocialRegisterRequireProof: true})
	if _, rej := p.svc.Register(context.Background(), in, g4Meta); rej == nil || rej.Status != 400 {
		t.Errorf("증거 없으면 거부: %+v", rej)
	}
	p.svc.recordSocialLoginProof(auth.ProviderKakao, "123")
	if _, rej := p.svc.Register(context.Background(), in, g4Meta); rej != nil {
		t.Errorf("증거 있으면 허용: %+v", rej)
	}
	if _, rej := p.svc.Register(context.Background(), in, g4Meta); rej == nil {
		t.Error("증거는 일회용이어야 함")
	}
	// 기본(플래그 off): 허용
	d := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	if _, rej := d.svc.Register(context.Background(), in, g4Meta); rej != nil {
		t.Errorf("기본 정책은 구버전 호환 허용: %+v", rej)
	}
}

func TestG4LoginEmailFallbackLimitAndAmbiguity(t *testing.T) {
	e := newG4(AuthPolicy{})
	hash, _ := auth.HashPassword("Passw0rd!x", 4)
	lvl, st, show := 2, 1, "Y"
	u := model.Member{MtIdx: 9, MtPwd: &hash, MtLevel: &lvl, MtStatus: &st, MtShow: &show}
	e.mem.dupEmail = map[string][]model.Member{"a@example.com": {u}}
	e.mem.byID = map[int]*model.Member{9: &u}
	resp, rej := e.svc.Login(context.Background(), LoginInput{MtID: "A@Example.com", MtPwd: "Passw0rd!x"}, g4Meta)
	if rej != nil || !resp.Success {
		t.Fatalf("이메일 로그인 폴백 실패: %+v %+v", resp, rej)
	}
	// 중복 이메일 2명 -> 400
	e.mem.dupEmail["a@example.com"] = []model.Member{u, u}
	if _, rej = e.svc.Login(context.Background(), LoginInput{MtID: "a@example.com", MtPwd: "Passw0rd!x"}, g4Meta); rej == nil || rej.Status != 400 {
		t.Errorf("중복 이메일 400: %+v", rej)
	}
	// 실패 한도(계정 3회) -> 429 + RetryAfter
	for i := 0; i < 3; i++ {
		r, _ := e.svc.Login(context.Background(), LoginInput{MtID: "nobody", MtPwd: "x"}, g4Meta)
		if r.Success {
			t.Fatal("존재하지 않는 계정 성공 불가")
		}
	}
	_, rej = e.svc.Login(context.Background(), LoginInput{MtID: "nobody", MtPwd: "x"}, g4Meta)
	if rej == nil || rej.Status != 429 || rej.RetryAfter <= 0 {
		t.Errorf("한도 초과 429: %+v", rej)
	}
}

func TestG4LoginLimiterStoreDownAllowsWithWarning(t *testing.T) {
	e := newG4(AuthPolicy{})
	e.guard.err = errors.New("redis down")
	r, rej := e.svc.Login(context.Background(), LoginInput{MtID: "nobody", MtPwd: "x"}, g4Meta)
	if rej != nil || r.Success {
		t.Errorf("Redis 장애 시 한도는 통과(로그인 가용성), 인증은 정상 실패: %+v %+v", r, rej)
	}
}

func TestG4PasswordResetRevokesAndFailsFastOnRevokerError(t *testing.T) {
	u := activeMember(20, "a@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{}}
	svc := pwSvc(mem, &fakeVerifyStore{})
	if !svc.updatePassword(u.MtIdx, "Passw0rd!x") || len(mem.pwSets) != 1 {
		t.Fatal("비밀번호 갱신 + refresh 폐기 호출")
	}
	rv := &fakeRevoker{err: errors.New("redis down")}
	svc.SetAccessRevoker(rv)
	if svc.updatePassword(u.MtIdx, "Passw0rd!x") || len(mem.pwSets) != 1 {
		t.Error("기준 기록 실패 시 비밀번호를 바꾸면 안 됨")
	}
	svc.SetAccessRevoker(nil)
	if svc.updatePassword(u.MtIdx, "Passw0rd!x") {
		t.Error("revoker 미주입은 실패해야 함")
	}
}

func TestG4RegisterResponseIsCompactWithRefreshKeys(t *testing.T) {
	e := newG4(AuthPolicy{AllowLegacyPhoneRegister: true})
	resp, rej := e.svc.Register(context.Background(), RegisterInput{MtID: "01012345678", MtPwd: sPtr("Passw0rd!x")}, g4Meta)
	if rej != nil {
		t.Fatal(rej)
	}
	d := resp.Data.(interface{})
	_ = d
	if !strings.Contains(resp.Message, "회원가입") {
		t.Error(resp.Message)
	}
}
