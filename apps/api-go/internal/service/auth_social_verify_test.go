package service

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// memberEmailChecker는 fakeAuthMemberRepo.byEmail 기준으로 "탈퇴하지 않은 회원이 이 이메일을 쓰는가"를 답한다.
type memberEmailChecker struct{ mem *fakeAuthMemberRepo }

func (c memberEmailChecker) ExistsActiveByEmail(email string) (bool, error) {
	if c.mem.getErr != nil {
		return false, c.mem.getErr
	}
	m := c.mem.byEmail[email]
	return m != nil && derefInt(m.MtLevel) != 1, nil
}

type fakeSocialVerifier struct {
	configured map[auth.Provider]bool
	id         *auth.ProviderIdentity
	err        error
	calls      int
	lastToken  string
}

func (f *fakeSocialVerifier) Configured(p auth.Provider) bool { return f.configured[p] }
func (f *fakeSocialVerifier) Verify(_ context.Context, p auth.Provider, token string) (*auth.ProviderIdentity, error) {
	f.calls++
	f.lastToken = token
	if f.err != nil {
		return nil, f.err
	}
	id := *f.id
	id.Provider = p
	return &id, nil
}

func allSocialConfigured() map[auth.Provider]bool {
	return map[auth.Provider]bool{auth.ProviderGoogle: true, auth.ProviderApple: true, auth.ProviderKakao: true}
}

func socialVerifiedSvc(mem *fakeAuthMemberRepo, mode auth.SocialMode, v *fakeSocialVerifier, logs *bytes.Buffer) *AuthService {
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r"}, testAuthConfig())
	svc.SetSocial(&fakeAuthSocialRepo{})
	lg := slog.New(slog.NewJSONHandler(logs, nil))
	var vf socialVerifier
	if v != nil {
		vf = v
	}
	svc.SetSocialVerification(SocialVerification{Verifier: vf, Mode: mode, Emails: memberEmailChecker{mem}, Logger: lg})
	return svc
}

func socialStatusOf(t *testing.T, err error) int {
	t.Helper()
	var ve *SocialVerifyError
	if !errors.As(err, &ve) {
		t.Fatalf("SocialVerifyError가 아님: %v", err)
	}
	return ve.Status
}

// 모드 × 토큰 유무 × 검증 결과 표.
func TestVerifySocialTokenModes(t *testing.T) {
	ok := &auth.ProviderIdentity{Subject: "sub-1"}
	type tc struct {
		name       string
		mode       auth.SocialMode
		token      string
		configured bool
		verr       error
		wantID     bool
		wantStatus int // 0 = 에러 없음
		wantCalls  int
		wantWarn   bool
	}
	cases := []tc{
		{"off/토큰 없음", auth.SocialModeOff, "", true, nil, false, 0, 0, false},
		{"off/토큰 있음(무시)", auth.SocialModeOff, "tok", true, nil, false, 0, 0, false},
		{"off/설정 비어 있어도", auth.SocialModeOff, "tok", false, nil, false, 0, 0, false},

		{"when_present/토큰 없음 -> 기존 동작+경고", auth.SocialModeWhenPresent, "", true, nil, false, 0, 0, true},
		{"when_present/토큰 없음/설정 비어 있음 -> 기존 동작+경고", auth.SocialModeWhenPresent, "", false, nil, false, 0, 0, true},
		{"when_present/토큰 있음/정상", auth.SocialModeWhenPresent, "tok", true, nil, true, 0, 1, false},
		{"when_present/토큰 있음/무효 -> 401", auth.SocialModeWhenPresent, "tok", true, auth.ErrProviderTokenInvalid, false, 401, 1, false},
		{"when_present/토큰 있음/설정 비어 있음 -> 503", auth.SocialModeWhenPresent, "tok", false, auth.ErrProviderNotConfigured, false, 503, 1, false},
		{"when_present/토큰 있음/공급자 장애 -> 502", auth.SocialModeWhenPresent, "tok", true, auth.ErrProviderUnavailable, false, 502, 1, false},
		{"when_present/공백 토큰은 없음으로", auth.SocialModeWhenPresent, "   ", true, nil, false, 0, 0, true},

		{"required/토큰 없음 -> 401", auth.SocialModeRequired, "", true, nil, false, 401, 0, false},
		{"required/설정 비어 있음+토큰 없음 -> 503", auth.SocialModeRequired, "", false, nil, false, 503, 0, false},
		{"required/설정 비어 있음+토큰 있음 -> 503", auth.SocialModeRequired, "tok", false, auth.ErrProviderNotConfigured, false, 503, 0, false},
		{"required/토큰 있음/정상", auth.SocialModeRequired, "tok", true, nil, true, 0, 1, false},
		{"required/토큰 있음/무효 -> 401", auth.SocialModeRequired, "tok", true, auth.ErrProviderTokenInvalid, false, 401, 1, false},

		{"배선 누락(모드 빈 값) -> 503", "", "tok", true, nil, false, 503, 0, false},
	}
	for _, c := range cases {
		for _, p := range []auth.Provider{auth.ProviderGoogle, auth.ProviderApple, auth.ProviderKakao} {
			t.Run(c.name+"/"+string(p), func(t *testing.T) {
				v := &fakeSocialVerifier{configured: map[auth.Provider]bool{p: c.configured}, id: ok, err: c.verr}
				var logs bytes.Buffer
				svc := socialVerifiedSvc(&fakeAuthMemberRepo{}, c.mode, v, &logs)
				id, err := svc.VerifySocialToken(context.Background(), p, c.token, "SMAP-Android/3.2.7 (Pixel 7; Android 14)")
				if c.wantStatus != 0 {
					if got := socialStatusOf(t, err); got != c.wantStatus {
						t.Fatalf("상태 %d, want %d", got, c.wantStatus)
					}
					if id != nil {
						t.Fatal("에러 시 신원이 없어야 함")
					}
				} else if err != nil {
					t.Fatalf("에러 없어야 함: %v", err)
				}
				if (id != nil) != c.wantID {
					t.Fatalf("신원 유무 불일치: %+v", id)
				}
				if v.calls != c.wantCalls {
					t.Fatalf("검증 호출 %d회, want %d", v.calls, c.wantCalls)
				}
				warned := strings.Contains(logs.String(), "social login without provider token")
				if warned != c.wantWarn {
					t.Fatalf("경고 로그 %v, want %v: %s", warned, c.wantWarn, logs.String())
				}
				if warned {
					out := logs.String()
					if !strings.Contains(out, string(p)) || !strings.Contains(out, "SMAP-Android/3.2.7") {
						t.Fatalf("경고 로그에 공급자·앱 식별이 있어야 함: %s", out)
					}
					if strings.Contains(out, "Pixel") || strings.Contains(out, "Android 14") {
						t.Fatalf("UA의 기기 정보는 남기면 안 됨: %s", out)
					}
				}
			})
		}
	}
}

func TestVerifySocialTokenMissingVerifierFailsClosed(t *testing.T) {
	var logs bytes.Buffer
	svc := socialVerifiedSvc(&fakeAuthMemberRepo{}, auth.SocialModeWhenPresent, nil, &logs)
	_, err := svc.VerifySocialToken(context.Background(), auth.ProviderGoogle, "tok", "")
	if got := socialStatusOf(t, err); got != http.StatusServiceUnavailable {
		t.Fatalf("검증기 누락은 503이어야 함: %d", got)
	}
}

func TestVerifyErrorsDoNotLeakToken(t *testing.T) {
	const secret = "super-secret-token-value"
	v := &fakeSocialVerifier{configured: allSocialConfigured(), err: auth.ErrProviderTokenInvalid}
	var logs bytes.Buffer
	svc := socialVerifiedSvc(&fakeAuthMemberRepo{}, auth.SocialModeWhenPresent, v, &logs)
	_, err := svc.VerifySocialToken(context.Background(), auth.ProviderKakao, secret, "ua")
	if err == nil || strings.Contains(err.Error(), secret) || strings.Contains(logs.String(), secret) {
		t.Fatalf("토큰이 에러/로그에 노출됨: %v / %s", err, logs.String())
	}
}

// --- 신원 적용 / 이메일 자동 연결 금지 ---

func socialVictim() *model.Member {
	u := activeMember(500, "victim@x.com")
	u.MtGoogleID = nil
	return u
}

func TestGoogleVerifiedEmailCollisionDoesNotLink(t *testing.T) {
	vic := socialVictim()
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"victim@x.com": vic}, byGoogle: map[string]*model.Member{}, byID: map[int]*model.Member{500: vic}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "attacker-sub", Email: "Victim@X.com", EmailVerified: true, Name: "공격자"}}
	var logs bytes.Buffer
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &logs)

	resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{GoogleID: "whatever", Email: "other@x.com"}, "idtok", false, "ua")
	if err != nil {
		t.Fatal(err)
	}
	if resp.Success || resp.Message != "이미 이 이메일로 가입된 계정이 있어요. 이메일과 비밀번호로 로그인해 주세요." || resp.Data != nil {
		t.Fatalf("이메일 겹침 안내 오류: %+v", resp)
	}
	if mem.lastFields != nil {
		t.Fatalf("기존 계정에 아무 것도 쓰면 안 됨(자동 연결 금지): %+v", mem.lastFields)
	}
	// 요청 본문의 이메일이 아니라 검증된 이메일이 쓰였는지: other@x.com이 아니라 victim 이메일로 판정했다.
}

func TestGoogleUnverifiedEmailIsDropped(t *testing.T) {
	vic := socialVictim()
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"victim@x.com": vic}, byGoogle: map[string]*model.Member{}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "s-new", Email: "victim@x.com", EmailVerified: false}}
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})
	resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{Email: "victim@x.com"}, "idtok", false, "ua")
	if err != nil {
		t.Fatal(err)
	}
	d, ok := resp.Data.(*dto.SocialNewUserData)
	if !resp.Success || !ok || !d.IsNewUser {
		t.Fatalf("미인증 이메일은 버려지고 신규 사용자 흐름이어야 함: %+v", resp)
	}
	if tu := d.Member.(*dto.GoogleTempUser); tu.MtEmail != "" || tu.MtGoogleID != "s-new" {
		t.Fatalf("temp user 값: %+v", tu)
	}
}

func TestGoogleVerifiedIDOverridesClientID(t *testing.T) {
	mine := activeMember(1, "me@x.com")
	other := activeMember(2, "other@x.com")
	mem := &fakeAuthMemberRepo{
		byEmail:  map[string]*model.Member{},
		byGoogle: map[string]*model.Member{"claimed-by-client": other, "real-sub": mine},
		byID:     map[int]*model.Member{1: mine, 2: other},
	}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "real-sub"}}
	var logs bytes.Buffer
	svc := socialVerifiedSvc(mem, auth.SocialModeWhenPresent, v, &logs)
	resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{GoogleID: "claimed-by-client", Email: "other@x.com"}, "idtok", false, "ua")
	if err != nil {
		t.Fatal(err)
	}
	d, ok := resp.Data.(*dto.SocialLoginData)
	if !resp.Success || !ok || d.User.MtIdx != 1 || d.LookupMethod != "google_id" {
		t.Fatalf("검증된 sub 계정으로 로그인해야 함: %+v", resp)
	}
	if !strings.Contains(logs.String(), "differs from verified id") || strings.Contains(logs.String(), "claimed-by-client") {
		t.Fatalf("불일치 계측(값 미포함) 필요: %s", logs.String())
	}
}

func TestGoogleLegacyTokenlessNeverLogsInByEmail(t *testing.T) {
	vic := socialVictim()
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"victim@x.com": vic}, byGoogle: map[string]*model.Member{}, byID: map[int]*model.Member{500: vic}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "x"}}
	svc := socialVerifiedSvc(mem, auth.SocialModeWhenPresent, v, &bytes.Buffer{})
	resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{GoogleID: "g-attacker", Email: "victim@x.com"}, "", false, "ua")
	if err != nil {
		t.Fatal(err)
	}
	if resp.Success || resp.Data != nil {
		t.Fatalf("토큰 없는 요청이 이메일만으로 로그인되면 안 됨: %+v", resp)
	}
	if mem.lastFields != nil {
		t.Fatalf("연결 쓰기 금지: %+v", mem.lastFields)
	}
}

func TestGoogleEmailOnlyLegacyDoesNotFindAccount(t *testing.T) {
	// google_id 없이 이메일만 보내도(구버전 형태) 이메일로 계정을 찾아 로그인시키지 않는다.
	other := activeMember(7, "free@x.com")
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"free@x.com": other}, byGoogle: map[string]*model.Member{}, byID: map[int]*model.Member{7: other}}
	svc := socialVerifiedSvc(mem, auth.SocialModeOff, nil, &bytes.Buffer{})
	resp := svc.GoogleLogin(GoogleInput{Email: "free@x.com"})
	if resp.Success {
		t.Fatalf("로그인되면 안 됨: %+v", resp)
	}
}

func TestGoogleWithdrawnEmailDoesNotBlockNewSignup(t *testing.T) {
	gone := socialVictim()
	gone.MtLevel = pInt(1)
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"victim@x.com": gone}, byGoogle: map[string]*model.Member{}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "s2", Email: "victim@x.com", EmailVerified: true}}
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})
	resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{}, "idtok", false, "ua")
	if err != nil || !resp.Success {
		t.Fatalf("탈퇴 회원의 이메일은 겹침으로 보지 않음: %+v %v", resp, err)
	}
}

func TestGoogleWithdrawnAndInactiveAccountsRejected(t *testing.T) {
	for name, mut := range map[string]func(*model.Member){
		"탈퇴": func(m *model.Member) { m.MtLevel = pInt(1) },
		"정지": func(m *model.Member) { m.MtStatus = pInt(2) },
	} {
		u := activeMember(9, "g@x.com")
		mut(u)
		mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{"gs": u}, byID: map[int]*model.Member{9: u}}
		v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "gs"}}
		svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})
		resp, err := svc.GoogleLoginVerified(context.Background(), GoogleInput{}, "idtok", false, "ua")
		if err != nil || resp.Success || resp.Message != "비활성화된 계정입니다. 고객센터에 문의해주세요." || resp.Data != nil {
			t.Fatalf("%s 계정은 거부: %+v %v", name, resp, err)
		}
	}
}

func TestEmailCheckerFailureSurfacesAsError(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}, getErr: errors.New("db down")}
	svc := socialSvc(mem)
	// getErr로 GetByGoogleID도 실패하므로 먼저 id 조회 에러 경로를 확인
	resp := svc.GoogleLogin(GoogleInput{GoogleID: "g", Email: "a@x.com"})
	if resp.Success || resp.Message != "Google 로그인 처리 중 오류가 발생했습니다." {
		t.Fatalf("DB 오류는 숨기지 않고 오류 응답: %+v", resp)
	}
}

func TestEmailCheckerNotWiredIsError(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r"}, testAuthConfig())
	svc.SetSocial(&fakeAuthSocialRepo{})
	resp := svc.GoogleLogin(GoogleInput{GoogleID: "g", Email: "a@x.com"})
	if resp.Success {
		t.Fatalf("이메일 조회기 배선 누락은 성공으로 위장하면 안 됨: %+v", resp)
	}
}

func TestAppleVerifiedFlows(t *testing.T) {
	vic := socialVictim()
	mine := activeMember(3, "ap@x.com")
	mem := &fakeAuthMemberRepo{
		byEmail: map[string]*model.Member{"victim@x.com": vic},
		byApple: map[string]*model.Member{"apple-real": mine},
		byID:    map[int]*model.Member{3: mine, 500: vic},
	}
	// 1) 기존 Apple 계정: 클라이언트의 userIdentifier/email이 달라도 검증된 sub로 로그인
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "apple-real", Email: "victim@x.com", EmailVerified: true}}
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})
	resp, err := svc.AppleLoginVerified(context.Background(), AppleInput{UserIdentifier: "spoof", Email: "victim@x.com"}, "idt", "ua")
	if err != nil {
		t.Fatal(err)
	}
	if d, ok := resp.Data.(*dto.SocialLoginData); !resp.Success || !ok || d.User.MtIdx != 3 || d.LookupMethod != "apple_id" {
		t.Fatalf("Apple 기존 로그인: %+v", resp)
	}
	// 2) 신규 sub + 이메일이 기존 활성 계정과 겹침 -> 안내, 연결 없음
	mem.lastFields = nil
	v.id = &auth.ProviderIdentity{Subject: "apple-new", Email: "victim@x.com", EmailVerified: true}
	resp, err = svc.AppleLoginVerified(context.Background(), AppleInput{UserIdentifier: "apple-new"}, "idt", "ua")
	if err != nil || resp.Success || resp.Message != msgSocialEmailTaken || mem.lastFields != nil {
		t.Fatalf("Apple 이메일 겹침: %+v %v %+v", resp, err, mem.lastFields)
	}
	// 3) 신규 sub, 겹침 없음 -> 신규 사용자 흐름(is_new_user), userName은 요청 값 유지
	v.id = &auth.ProviderIdentity{Subject: "apple-new2", Email: "fresh@x.com", EmailVerified: true}
	resp, err = svc.AppleLoginVerified(context.Background(), AppleInput{UserIdentifier: "spoof", UserName: "애플유저"}, "idt", "ua")
	d, ok := resp.Data.(*dto.SocialNewUserData)
	if err != nil || !resp.Success || !ok || !d.IsNewUser {
		t.Fatalf("Apple 신규: %+v %v", resp, err)
	}
	if tu := d.Member.(*dto.AppleTempUser); tu.MtAppleID != "apple-new2" || tu.MtName != "애플유저" || tu.MtEmail != "fresh@x.com" {
		t.Fatalf("Apple temp user: %+v", tu)
	}
}

func TestAppleWithdrawnRejected(t *testing.T) {
	u := activeMember(4, "w@x.com")
	u.MtLevel = pInt(1)
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byApple: map[string]*model.Member{"ap": u}, byID: map[int]*model.Member{4: u}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "ap"}}
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})
	resp, err := svc.AppleLoginVerified(context.Background(), AppleInput{}, "idt", "ua")
	if err != nil || resp.Success || resp.Data != nil {
		t.Fatalf("탈퇴 회원 거부: %+v %v", resp, err)
	}
}

func TestKakaoVerifiedFlows(t *testing.T) {
	vic := socialVictim()
	mine := activeMember(21, "k@x.com")
	mem := &fakeAuthMemberRepo{
		byEmail: map[string]*model.Member{"victim@x.com": vic},
		byKakao: map[string]*model.Member{"777": mine},
		byID:    map[int]*model.Member{21: mine, 500: vic},
	}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "777"}}
	svc := socialVerifiedSvc(mem, auth.SocialModeRequired, v, &bytes.Buffer{})

	// 클라이언트가 보낸 kakao_id(타인)·email(피해자)은 무시되고 검증된 ID(777)로 로그인
	resp, err := svc.KakaoLoginVerified(context.Background(), KakaoInput{KakaoID: "someone-else", Email: "victim@x.com"}, "kt", "ua", "")
	if err != nil {
		t.Fatal(err)
	}
	d, ok := resp.Data.(*dto.KakaoLoginData)
	if !resp.Success || !ok || d.User.MtIdx != 21 {
		t.Fatalf("검증된 ID로 로그인: %+v", resp)
	}
	if v.lastToken != "kt" {
		t.Fatal("access_token이 검증기로 전달되어야 함")
	}

	// 검증된 신규 ID: 이메일을 믿지 않으므로 신규 사용자 흐름, 연결/쓰기 없음
	mem.lastFields = nil
	v.id = &auth.ProviderIdentity{Subject: "888"}
	resp, err = svc.KakaoLoginVerified(context.Background(), KakaoInput{KakaoID: "1", Email: "victim@x.com"}, "kt", "ua", "")
	nd, ok := resp.Data.(*dto.KakaoNewUserData)
	if err != nil || !resp.Success || !ok || !nd.IsNewUser || mem.lastFields != nil {
		t.Fatalf("카카오 신규: %+v %v", resp, err)
	}
}

func TestKakaoLegacyTokenlessEmailCollisionNoLink(t *testing.T) {
	vic := socialVictim()
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"victim@x.com": vic}, byKakao: map[string]*model.Member{}, byID: map[int]*model.Member{500: vic}}
	v := &fakeSocialVerifier{configured: allSocialConfigured(), id: &auth.ProviderIdentity{Subject: "x"}}
	svc := socialVerifiedSvc(mem, auth.SocialModeWhenPresent, v, &bytes.Buffer{})
	resp, err := svc.KakaoLoginVerified(context.Background(), KakaoInput{KakaoID: "k-attacker", Email: "victim@x.com"}, "", "ua", "")
	if err != nil || resp.Success || resp.Message != msgSocialEmailTaken || mem.lastFields != nil {
		t.Fatalf("토큰 없는 카카오 이메일 겹침: %+v %v %+v", resp, err, mem.lastFields)
	}
}

func TestKakaoVerifyFailureBlocksLogin(t *testing.T) {
	u := activeMember(31, "k2@x.com")
	mem := &fakeAuthMemberRepo{byKakao: map[string]*model.Member{"1": u}, byID: map[int]*model.Member{31: u}}
	for name, c := range map[string]struct {
		err    error
		status int
	}{"위조": {auth.ErrProviderTokenInvalid, 401}, "장애": {auth.ErrProviderUnavailable, 502}, "설정": {auth.ErrProviderNotConfigured, 503}} {
		v := &fakeSocialVerifier{configured: allSocialConfigured(), err: c.err}
		svc := socialVerifiedSvc(mem, auth.SocialModeWhenPresent, v, &bytes.Buffer{})
		_, err := svc.KakaoLoginVerified(context.Background(), KakaoInput{KakaoID: "1"}, "tok", "ua", "")
		if got := socialStatusOf(t, err); got != c.status {
			t.Fatalf("%s: %d want %d", name, got, c.status)
		}
		if mem.lastFields != nil {
			t.Fatalf("%s: 검증 실패 시 로그인 처리(쓰기)가 일어나면 안 됨", name)
		}
	}
}

func TestFindUserDoesNotLinkGoogleID(t *testing.T) {
	u := activeMember(41, "f@x.com")
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"f@x.com": u}, byMtID: map[string]*model.Member{"01000000000": u}}
	svc := socialSvc(mem)
	svc.FindUserByEmail("f@x.com", "attacker-google-id")
	svc.FindUserByPhone("01000000000", "attacker-google-id")
	if mem.lastFields != nil {
		t.Fatalf("find-user가 클라이언트 google_id를 계정에 연결하면 안 됨: %+v", mem.lastFields)
	}
}

type failingEmailChecker struct{}

func (failingEmailChecker) ExistsActiveByEmail(string) (bool, error) { return false, errors.New("db down") }

func TestEmailCheckerErrorIsNotSwallowed(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}, byApple: map[string]*model.Member{}, byKakao: map[string]*model.Member{}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r"}, testAuthConfig())
	svc.SetSocial(&fakeAuthSocialRepo{})
	svc.SetSocialVerification(SocialVerification{Mode: auth.SocialModeOff, Emails: failingEmailChecker{}})
	if r := svc.GoogleLogin(GoogleInput{GoogleID: "g", Email: "a@x.com"}); r.Success || r.Message != "Google 로그인 처리 중 오류가 발생했습니다." {
		t.Fatalf("google: %+v", r)
	}
	if r := svc.AppleLogin(AppleInput{UserIdentifier: "a", Email: "a@x.com"}); r.Success || r.Message != "Apple 로그인 처리 중 오류가 발생했습니다." {
		t.Fatalf("apple: %+v", r)
	}
	if r := svc.KakaoLogin(KakaoInput{KakaoID: "k", Email: "a@x.com"}, "", ""); r.Success || r.Message != "카카오 로그인 처리 중 오류가 발생했습니다." {
		t.Fatalf("kakao: %+v", r)
	}
}
