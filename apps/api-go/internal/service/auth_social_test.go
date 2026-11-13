package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeAuthSocialRepo struct {
	groups []model.SocialGroupRow
}

func (f *fakeAuthSocialRepo) GroupsForUser(mtIdx int) ([]model.SocialGroupRow, error) {
	return f.groups, nil
}
func (f *fakeAuthSocialRepo) SchedulesOrForUser(mtIdx int, s, e string) ([]model.SocialScheduleRow, error) {
	return nil, nil
}
func (f *fakeAuthSocialRepo) SchedulesExistsForUser(mtIdx int, s, e string) ([]model.SocialSchedulePhoneRow, error) {
	return nil, nil
}
func (f *fakeAuthSocialRepo) MemberLatLongStr(mtIdx int) (*string, *string, error) {
	return nil, nil, nil
}

func socialSvc(mem *fakeAuthMemberRepo) *AuthService {
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r"}, testAuthConfig())
	svc.SetSocial(&fakeAuthSocialRepo{})
	// 이메일 중복 조회는 mem.byEmail 기준(탈퇴 제외). 검증 모드는 off(서비스 단위 테스트는 검증 결과를 주입하지 않는다).
	svc.SetSocialVerification(SocialVerification{Mode: auth.SocialModeOff, Emails: memberEmailChecker{mem}})
	return svc
}

func activeMember(idx int, email string) *model.Member {
	name := "소셜"
	return &model.Member{MtIdx: idx, MtID: pStr("01000000000"), MtName: &name, MtStatus: pInt(1), MtLevel: pInt(2), MtShow: pStr("Y"), MtEmail: pStr(email)}
}

// --- kakao ---

func TestKakaoNewUserNoEmail(t *testing.T) {
	mem := &fakeAuthMemberRepo{byKakao: map[string]*model.Member{}, byEmail: map[string]*model.Member{}}
	resp := socialSvc(mem).KakaoLogin(KakaoInput{KakaoID: "k1"}, "", "")
	if !resp.Success || resp.Message != "신규 사용자입니다. 회원가입을 진행해주세요." {
		t.Fatalf("kakao 신규(이메일無) 오류: %+v", resp)
	}
	if _, ok := resp.Data.(*dto.KakaoNewUserData); !ok {
		t.Fatalf("data 타입: %T", resp.Data)
	}
}

func TestKakaoWithdrawn(t *testing.T) {
	u := activeMember(10, "a@x.com")
	u.MtLevel = pInt(1)
	mem := &fakeAuthMemberRepo{byKakao: map[string]*model.Member{"k1": u}}
	resp := socialSvc(mem).KakaoLogin(KakaoInput{KakaoID: "k1"}, "", "")
	if resp.Success || resp.Message != "탈퇴한 계정입니다. 새로운 계정으로 가입해주세요." {
		t.Fatalf("kakao 탈퇴 분기 오류: %+v", resp)
	}
}

func TestKakaoInactive(t *testing.T) {
	u := activeMember(10, "a@x.com")
	u.MtStatus = pInt(2)
	mem := &fakeAuthMemberRepo{byKakao: map[string]*model.Member{"k1": u}}
	resp := socialSvc(mem).KakaoLogin(KakaoInput{KakaoID: "k1"}, "", "")
	if resp.Success || resp.Message != "비활성화된 계정입니다. 고객센터에 문의해주세요." {
		t.Fatalf("kakao 비활성 분기 오류: %+v", resp)
	}
}

func TestKakaoExistingSuccess(t *testing.T) {
	u := activeMember(10, "a@x.com")
	mem := &fakeAuthMemberRepo{byKakao: map[string]*model.Member{"k1": u}, byID: map[int]*model.Member{10: u}}
	resp := socialSvc(mem).KakaoLogin(KakaoInput{KakaoID: "k1"}, "", "")
	if !resp.Success || resp.Message != "카카오 로그인 성공" {
		t.Fatalf("kakao 성공 분기 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.KakaoLoginData)
	if !ok || d.User == nil || d.IsNewUser != false {
		t.Fatalf("kakao data 오류: %T %+v", resp.Data, resp.Data)
	}
}

// --- google ---

func TestGoogleNoIDNoEmail(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}}
	resp := socialSvc(mem).GoogleLogin(GoogleInput{})
	if resp.Success || resp.Message != "Google ID 또는 이메일이 필요합니다." {
		t.Fatalf("google 필수 누락 분기 오류: %+v", resp)
	}
}

func TestGoogleNewUser(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}}
	resp := socialSvc(mem).GoogleLogin(GoogleInput{GoogleID: "g1", Email: "new@x.com", Name: "신규"})
	if !resp.Success || resp.Message != "신규 사용자입니다. 회원가입이 필요합니다." {
		t.Fatalf("google 신규 분기 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.SocialNewUserData)
	if !ok || d.LookupMethod != "new_user" || !d.NeedsOnboarding {
		t.Fatalf("google 신규 data 오류: %T %+v", resp.Data, resp.Data)
	}
}

func TestGoogleExistingByGoogleID(t *testing.T) {
	u := activeMember(11, "g@x.com")
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"g@x.com": u}, byGoogle: map[string]*model.Member{"g1": u}, byID: map[int]*model.Member{11: u}}
	resp := socialSvc(mem).GoogleLogin(GoogleInput{Email: "g@x.com", GoogleID: "g1"})
	if !resp.Success || resp.Message != "Google 로그인 성공" {
		t.Fatalf("google 기존 분기 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.SocialLoginData)
	if !ok || d.LookupMethod != "google_id" || d.Member == nil {
		t.Fatalf("google 기존 data 오류: %T %+v", resp.Data, resp.Data)
	}
}

// --- apple ---

func TestAppleNewUser(t *testing.T) {
	mem := &fakeAuthMemberRepo{byApple: map[string]*model.Member{}, byEmail: map[string]*model.Member{}}
	resp := socialSvc(mem).AppleLogin(AppleInput{UserIdentifier: "apple-xyz-123456789", UserName: "애플"})
	if !resp.Success || resp.Message != "신규 사용자입니다. 회원가입이 필요합니다." {
		t.Fatalf("apple 신규 분기 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.SocialNewUserData)
	if !ok {
		t.Fatalf("apple data 타입: %T", resp.Data)
	}
	at, ok := d.Member.(*dto.AppleTempUser)
	if !ok || at.MtID != "apple_apple-xyz-" { // userIdentifier[:10]="apple-xyz-"
		t.Fatalf("apple temp mt_id 오류: %+v", d.Member)
	}
}

// --- find-user ---

func TestFindEmailNotFound(t *testing.T) {
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{}}
	resp := socialSvc(mem).FindUserByEmail("none@x.com", "")
	if resp.Success || resp.Message != "사용자를 찾을 수 없습니다." {
		t.Fatalf("find-email 미발견 오류: %+v", resp)
	}
	if _, ok := resp.Data.(*dto.FindNewUserData); !ok {
		t.Fatalf("data 타입: %T", resp.Data)
	}
}

func TestFindEmailWithdrawn(t *testing.T) {
	u := activeMember(12, "w@x.com")
	u.MtLevel = pInt(1)
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"w@x.com": u}}
	resp := socialSvc(mem).FindUserByEmail("w@x.com", "")
	if resp.Success || resp.Message != "탈퇴한 계정입니다." {
		t.Fatalf("find-email 탈퇴 오류: %+v", resp)
	}
}

func TestFindEmailFound(t *testing.T) {
	u := activeMember(13, "f@x.com")
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"f@x.com": u}}
	resp := socialSvc(mem).FindUserByEmail("f@x.com", "")
	if !resp.Success || resp.Message != "사용자 데이터 조회 성공" {
		t.Fatalf("find-email 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.FindUserData)
	if !ok || d.LookupMethod != "email" || !d.Found {
		t.Fatalf("find-email data 오류: %T %+v", resp.Data, resp.Data)
	}
}

func TestFindPhoneFound(t *testing.T) {
	u := activeMember(14, "p@x.com")
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01012341234": u}}
	resp := socialSvc(mem).FindUserByPhone("010-1234-1234", "")
	if !resp.Success || resp.Message != "사용자 데이터 조회 성공" {
		t.Fatalf("find-phone 성공 오류: %+v", resp)
	}
	d, ok := resp.Data.(*dto.FindUserData)
	if !ok || d.LookupMethod != "phone" {
		t.Fatalf("find-phone data 오류: %T %+v", resp.Data, resp.Data)
	}
	if _, ok := d.User.(*dto.FindPhoneUserData); !ok {
		t.Fatalf("find-phone user 타입: %T", d.User)
	}
}
