package service

import (
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeMemberFCMRepo struct {
	byID       map[int]*model.Member
	lastFields map[string]interface{}
	expTotal   int64
	expPush1   int64
	tokenCount int64
}

func (f *fakeMemberFCMRepo) GetByID(idx int) (*model.Member, error) { return f.byID[idx], nil }
func (f *fakeMemberFCMRepo) UpdateColumns(idx int, fields map[string]interface{}) error {
	f.lastFields = fields
	return nil
}
func (f *fakeMemberFCMRepo) CountExpiredTokens(now time.Time) (int64, int64, error) {
	return f.expTotal, f.expPush1, nil
}
func (f *fakeMemberFCMRepo) CountMembersWithToken() (int64, error) { return f.tokenCount, nil }

func TestMaskToken(t *testing.T) {
	if maskToken("abcdefghijklmnop") != "abcdefgh...mnop" { // 16자: [:8]+...+[-4:]
		t.Fatalf("mask 16자: %q", maskToken("abcdefghijklmnop"))
	}
	if maskToken("short") != "***" {
		t.Fatalf("mask 짧음: %q", maskToken("short"))
	}
}

func TestValidateFCMTokenFormat(t *testing.T) {
	if validateFCMTokenFormat("null") || validateFCMTokenFormat("short") || validateFCMTokenFormat("") {
		t.Fatal("null/short/empty는 false여야")
	}
	valid := "fz6CAxDq4UVBmoaEdMtIHZ_abcdefghijklmnopqrstuvwxyz" // 20자 이상, alnum/_
	if !validateFCMTokenFormat(valid) {
		t.Fatalf("정상 토큰이 false: %q", valid)
	}
	if validateFCMTokenFormat("has space invalid token xxxxxxxxxxxx") {
		t.Fatal("공백 포함은 false여야")
	}
}

func TestValidateIOSToken(t *testing.T) {
	// 콜론 필수 + len 100-200.
	short := "a:b"
	if validateIOSToken(short) {
		t.Fatal("짧은 토큰 false")
	}
	long := "projectid12345:" + repeatStr("a", 120)
	if !validateIOSToken(long) {
		t.Fatalf("정상 iOS 토큰 true 기대: len=%d", len(long))
	}
	noColon := repeatStr("a", 150)
	if validateIOSToken(noColon) {
		t.Fatal("콜론 없으면 false")
	}
}

func repeatStr(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}

func TestRegisterNotFoundAndStatus(t *testing.T) {
	svc := NewMemberFCMToken(&fakeMemberFCMRepo{byID: map[int]*model.Member{}})
	_, e := svc.Register(999, repeatStr("a", 120))
	if e == nil || e.Status != 404 {
		t.Fatalf("register not-found 404 기대: %+v", e)
	}
	_, e2 := svc.StatusOf(999)
	if e2 == nil || e2.Status != 404 {
		t.Fatalf("status not-found 404 기대: %+v", e2)
	}
}

func TestRegisterWithdrawnAndInactive(t *testing.T) {
	withdrawn := &model.Member{MtIdx: 10, MtLevel: pInt(1), MtStatus: pInt(1)}
	svc := NewMemberFCMToken(&fakeMemberFCMRepo{byID: map[int]*model.Member{10: withdrawn}})
	_, e := svc.Register(10, repeatStr("a", 120))
	if e == nil || e.Status != 400 || e.Detail != "탈퇴한 회원은 FCM 토큰을 등록할 수 없습니다." {
		t.Fatalf("탈퇴 400 기대: %+v", e)
	}
	inactive := &model.Member{MtIdx: 11, MtLevel: pInt(2), MtStatus: pInt(2)}
	svc2 := NewMemberFCMToken(&fakeMemberFCMRepo{byID: map[int]*model.Member{11: inactive}})
	_, e2 := svc2.Register(11, repeatStr("a", 120))
	if e2 == nil || e2.Detail != "정상 상태가 아닌 회원은 FCM 토큰을 등록할 수 없습니다." {
		t.Fatalf("비정상 400 기대: %+v", e2)
	}
}

func TestRegisterNewTokenSuccess(t *testing.T) {
	m := &model.Member{MtIdx: 20, MtLevel: pInt(2), MtStatus: pInt(1), MtTokenID: nil}
	repo := &fakeMemberFCMRepo{byID: map[int]*model.Member{20: m}}
	resp, e := NewMemberFCMToken(repo).Register(20, repeatStr("a", 120))
	if e != nil || resp.Message != "FCM 토큰이 성공적으로 등록/업데이트되었습니다." {
		t.Fatalf("신규토큰 성공 기대: %+v %+v", resp, e)
	}
	if repo.lastFields["mt_token_updated_at"] == nil || repo.lastFields["mt_token_expiry_date"] == nil {
		t.Fatalf("신규토큰은 updated_at/expiry 설정: %v", repo.lastFields)
	}
}

func TestCleanupAndReset(t *testing.T) {
	repo := &fakeMemberFCMRepo{expTotal: 5, expPush1: 3, tokenCount: 100}
	svc := NewMemberFCMToken(repo)
	r1, _ := svc.CleanupExpiredTokens()
	if r1.Message != "만료된 FCM 토큰 정리 완료 (정리: 5개, 알림: 3명)" || r1.MtIdx != 0 {
		t.Fatalf("cleanup 메시지 오류: %+v", r1)
	}
	r2, _ := svc.ResetInvalidTokens()
	if r2.Message != "잘못된 FCM 토큰 정리 완료 (정리: 0개, 확인: 100개)" {
		t.Fatalf("reset 메시지 오류: %+v", r2)
	}
}
