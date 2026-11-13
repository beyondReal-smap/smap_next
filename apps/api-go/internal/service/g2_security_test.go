package service

import (
	"strings"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// G2 즉시 차단 항목의 서비스 계층 테스트: 가입 권한 필드 주입 무시, 평문 비밀번호 저장 제거,
// 탈퇴·정지·비노출 회원의 로그인/refresh 거부.

func mustHash(t *testing.T, pwd string) *string {
	t.Helper()
	h, err := auth.HashPassword(pwd, 4)
	if err != nil {
		t.Fatal(err)
	}
	return &h
}

func intp(v int) *int { return &v }

// --- 가입 3경로: mt_level/mt_status/mt_type 주입 무시 ---

func TestAuthRegisterIgnoresInjectedPrivileges(t *testing.T) {
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{}, byEmail: map[string]*model.Member{}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, testAuthConfig())
	in := baseRegisterInput()
	in.MtType, in.MtLevel, in.MtStatus = 4, 9, 9 // 관리자 계정 주입 시도

	outcome, resp := svc.Register(in)
	if outcome != RegisterCreated || resp == nil {
		t.Fatalf("가입 자체는 성공해야 함: %v", outcome)
	}
	c := mem.created
	if c == nil || *c.MtLevel != 2 || *c.MtStatus != 1 || *c.MtType != 1 {
		t.Fatalf("서버가 일반 회원 값(level=2,status=1,type=1)으로 강제해야 함: level=%v status=%v type=%v", c.MtLevel, c.MtStatus, c.MtType)
	}
}

type fakeMemberWriteRepo struct {
	created     *model.Member
	userCreated *model.Member
}

func (f *fakeMemberWriteRepo) GetByID(int) (*model.Member, error)        { return nil, nil }
func (f *fakeMemberWriteRepo) GetByIdxActive(int) (*model.Member, error) { return nil, nil }
func (f *fakeMemberWriteRepo) GetByEmail(string) (*model.Member, error)  { return nil, nil }
func (f *fakeMemberWriteRepo) GetByPhoneOr(string) (*model.Member, error) {
	return nil, nil
}
func (f *fakeMemberWriteRepo) CreateFromRegister(m *model.Member) (*model.Member, error) {
	f.created = m
	m.MtIdx = 501
	return m, nil
}
func (f *fakeMemberWriteRepo) CreateUserMember(m *model.Member) (*model.Member, error) {
	f.userCreated = m
	m.MtIdx = 502
	return m, nil
}
func (f *fakeMemberWriteRepo) UpdateColumns(int, map[string]interface{}) error { return nil }
func (f *fakeMemberWriteRepo) ExistsPhoneExcept(string, int) (bool, error)     { return false, nil }
func (f *fakeMemberWriteRepo) ExistsEmailExcept(string, int) (bool, error)     { return false, nil }
func (f *fakeMemberWriteRepo) ExistsNicknameExcept(string, int) (bool, error)  { return false, nil }

func TestMembersRegisterIgnoresInjectedPrivileges(t *testing.T) {
	repo := &fakeMemberWriteRepo{}
	svc := NewMemberWrite(repo, 4, auth.PasswordPolicy{})
	res := svc.Register(MemberRegisterInput{
		MtType: intp(4), MtLevel: intp(9), MtStatus: intp(9),
		MtID: "01099998888", MtPwd: pStr("Test1234!@"), MtName: "신규", MtNickname: "신규닉",
		MtShow: "Y", MtOnboarding: "N",
	})
	if !res.Success {
		t.Fatalf("가입 성공해야 함: %s", res.Message)
	}
	c := repo.created
	if *c.MtLevel != 2 || *c.MtStatus != 1 || *c.MtType != 1 {
		t.Errorf("서버 강제값이어야 함: level=%d status=%d type=%d", *c.MtLevel, *c.MtStatus, *c.MtType)
	}
}

func TestMembersCreateHashesPasswordAndForcesPrivileges(t *testing.T) {
	repo := &fakeMemberWriteRepo{}
	svc := NewMemberWrite(repo, 4, auth.PasswordPolicy{})
	_, ok := svc.Create(MemberCreateInput{
		MtType: intp(4), MtLevel: intp(9), MtStatus: intp(9),
		MtID: "01099998888", MtName: "신규", MtNickname: "신규닉", MtPwd: "PlainPass1!",
	})
	if !ok {
		t.Fatal("생성 성공해야 함")
	}
	c := repo.userCreated
	if *c.MtLevel != 2 || *c.MtStatus != 1 || *c.MtType != 1 {
		t.Errorf("서버 강제값이어야 함: level=%d status=%d type=%d", *c.MtLevel, *c.MtStatus, *c.MtType)
	}
	if c.MtPwd == nil || *c.MtPwd == "PlainPass1!" || !strings.HasPrefix(*c.MtPwd, "$2") {
		t.Fatalf("평문이 아니라 bcrypt 해시로 저장해야 함: %v", c.MtPwd)
	}
	if !auth.VerifyPassword("PlainPass1!", *c.MtPwd) {
		t.Error("저장된 해시가 원문 비밀번호로 검증돼야 함")
	}
}

func TestUsersCreateHashesPassword(t *testing.T) {
	repo := &fakeUserRepo{one: member2584()}
	var saved *model.Member
	capture := &capturingUserRepo{fakeUserRepo: repo, onCreate: func(m *model.Member) { saved = m }}
	svc := NewUser(capture)
	svc.SetBcryptCost(4)
	_, ok := svc.CreateUser(MemberCreateInput{
		MtType: intp(1), MtLevel: intp(9), MtStatus: intp(1),
		MtID: "01099998888", MtName: "관리자생성", MtNickname: "n", MtPwd: "PlainPass1!",
	})
	if !ok || saved == nil {
		t.Fatal("관리자 생성은 성공해야 함")
	}
	if saved.MtPwd == nil || *saved.MtPwd == "PlainPass1!" || !auth.VerifyPassword("PlainPass1!", *saved.MtPwd) {
		t.Fatalf("해시 저장이어야 함: %v", saved.MtPwd)
	}
	if *saved.MtLevel != 9 {
		t.Errorf("관리자 전용 라우트는 요청 level을 그대로 쓴다: %d", *saved.MtLevel)
	}

	// cost 미주입이면 평문 저장으로 빠지지 않고 실패한다.
	saved = nil
	noCost := NewUser(capture)
	if _, ok := noCost.CreateUser(MemberCreateInput{MtID: "01099998888", MtName: "x", MtNickname: "x", MtPwd: "PlainPass1!"}); ok || saved != nil {
		t.Error("cost 미설정이면 실패해야 함(평문 저장 금지)")
	}
}

type capturingUserRepo struct {
	*fakeUserRepo
	onCreate func(*model.Member)
}

func (c *capturingUserRepo) CreateUserMember(m *model.Member) (*model.Member, error) {
	c.onCreate(m)
	return member2584(), nil
}

// --- 로그인 / refresh: 탈퇴·정지·비노출 거부 ---

func memberWithState(t *testing.T, idx int, level, status *int, show *string) *model.Member {
	t.Helper()
	id, name := "01011112222", "회원"
	return &model.Member{
		MtIdx: idx, MtID: &id, MtName: &name, MtNickname: &name,
		MtPwd: mustHash(t, "Right1234!@"), MtLevel: level, MtStatus: status, MtShow: show,
	}
}

func TestLoginHomeRejectsBlockedMembers(t *testing.T) {
	str := func(s string) *string { return &s }
	cases := []struct {
		name   string
		level  *int
		status *int
		show   *string
		wantOK bool
	}{
		{"정상", intp(2), intp(1), str("Y"), true},
		{"NULL 상태(오래된 회원)는 통과", nil, nil, nil, true},
		{"탈퇴 level=1", intp(1), intp(1), str("Y"), false},
		{"정지 status=2", intp(2), intp(2), str("Y"), false},
		{"비노출 show=N", intp(2), intp(1), str("N"), false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			m := memberWithState(t, 7, tt.level, tt.status, tt.show)
			mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": m}, byID: map[int]*model.Member{7: m}}
			svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "refresh-raw"}, testAuthConfig())

			resp := svc.LoginHome(LoginInput{MtID: "010-1111-2222", MtPwd: "Right1234!@"}, "ua", "ip")
			if resp.Success != tt.wantOK {
				t.Fatalf("success=%v want %v (%s)", resp.Success, tt.wantOK, resp.Message)
			}
			if !tt.wantOK {
				// 기존 로그인 실패 응답과 같은 형식/문구(상태 노출 금지), 토큰 미발급, 로그인 시각 미갱신.
				if resp.Message != "아이디 또는 비밀번호가 올바르지 않습니다." || resp.Data != nil {
					t.Errorf("기존 실패 응답 형식이어야 함: %+v", resp)
				}
				if mem.lastFields != nil {
					t.Errorf("거부된 로그인은 회원 행을 갱신하면 안 됨: %v", mem.lastFields)
				}
			}
		})
	}
	// 틀린 비밀번호와 응답이 구분되지 않는다.
	m := memberWithState(t, 7, intp(1), intp(1), nil)
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": m}, byID: map[int]*model.Member{7: m}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, testAuthConfig())
	wrong := svc.LoginHome(LoginInput{MtID: "01011112222", MtPwd: "Wrong1234!@"}, "", "")
	blocked := svc.LoginHome(LoginInput{MtID: "01011112222", MtPwd: "Right1234!@"}, "", "")
	if wrong.Message != blocked.Message || wrong.Success != blocked.Success {
		t.Errorf("탈퇴 회원 거부 응답이 비밀번호 오류와 달라 상태가 노출됨: %+v vs %+v", wrong, blocked)
	}
}

func TestLoginOriginalRejectsBlockedMember(t *testing.T) {
	m := memberWithState(t, 7, intp(1), intp(1), nil)
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01011112222": m}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, testAuthConfig())
	if out, _ := svc.LoginOriginal("010-1111-2222", "Right1234!@"); out != LoginOrigUnauthorized {
		t.Errorf("탈퇴 회원 login-original은 401이어야 함: %v", out)
	}
	ok := memberWithState(t, 8, intp(2), intp(1), nil)
	mem.byMtID["01011112222"] = ok
	if out, _ := svc.LoginOriginal("010-1111-2222", "Right1234!@"); out != LoginOrigOK {
		t.Errorf("정상 회원은 통과해야 함: %v", out)
	}
}

func TestRefreshRejectsBlockedMembers(t *testing.T) {
	blocked := memberWithState(t, 7, intp(1), intp(1), nil)
	suspended := memberWithState(t, 8, intp(2), intp(2), nil)
	hidden := memberWithState(t, 9, intp(2), intp(1), pStr("N"))
	normal := memberWithState(t, 10, intp(2), intp(1), pStr("Y"))
	legacy := memberWithState(t, 11, nil, nil, nil)
	mem := &fakeAuthMemberRepo{byID: map[int]*model.Member{7: blocked, 8: suspended, 9: hidden, 10: normal, 11: legacy}}

	for _, idx := range []int{7, 8, 9} {
		svc := NewAuth(mem, &fakeAuthRefreshRepo{rotateRaw: "new", rotateIdx: idx, rotateOK: true}, testAuthConfig())
		if out, resp := svc.RefreshV2("old", "ua", "ip"); out != RefreshUserGone || resp != nil {
			t.Errorf("v2 refresh: 회원 %d 거부 기대, got %v", idx, out)
		}
		if out, resp := svc.RefreshV1(idx, "01011112222", nil); out != RefreshV1Fail || resp != nil {
			t.Errorf("v1 refresh: 회원 %d 거부 기대, got %v", idx, out)
		}
	}
	for _, idx := range []int{10, 11} {
		svc := NewAuth(mem, &fakeAuthRefreshRepo{rotateRaw: "new", rotateIdx: idx, rotateOK: true}, testAuthConfig())
		if out, resp := svc.RefreshV2("old", "ua", "ip"); out != RefreshV2OK || resp == nil || resp.Token == "" {
			t.Errorf("v2 refresh: 회원 %d 통과 기대, got %v", idx, out)
		}
		if out, resp := svc.RefreshV1(idx, "01011112222", nil); out != RefreshV1OK || resp == nil {
			t.Errorf("v1 refresh: 회원 %d 통과 기대, got %v", idx, out)
		}
	}
	// v1: 회원 행이 없는 토큰은 기존 동작(발급)을 유지한다.
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, testAuthConfig())
	if out, _ := svc.RefreshV1(999, "x", nil); out != RefreshV1OK {
		t.Errorf("행 없는 v1 토큰은 기존 동작 유지: %v", out)
	}
}

func TestMembersLoginRejectsHiddenMember(t *testing.T) {
	m := memberWithState(t, 7, intp(2), intp(1), pStr("N"))
	repo := &loginMemberRepo{fakeMemberWriteRepo: &fakeMemberWriteRepo{}, m: m}
	svc := NewMemberWrite(repo, 4, auth.PasswordPolicy{})
	res := svc.Login("01011112222", "Right1234!@")
	if res.Success {
		t.Error("mt_show='N' 회원은 /members/login에서도 거부돼야 함")
	}
	m.MtShow = pStr("Y")
	if res := svc.Login("01011112222", "Right1234!@"); !res.Success {
		t.Errorf("정상 회원은 통과: %s", res.Message)
	}
}

type loginMemberRepo struct {
	*fakeMemberWriteRepo
	m *model.Member
}

func (l *loginMemberRepo) GetByPhoneOr(string) (*model.Member, error) { return l.m, nil }
