package service

import (
	"log/slog"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// 이 파일은 service_test(외부 테스트 패키지)의 핸들러 레벨 소셜 로그인 테스트가 가짜 저장소로 구성된
// AuthService를 얻기 위한 테스트 전용 export다(export_test.go 패턴). 프로덕션 빌드에는 포함되지 않는다.

// SocialTestWorld는 가짜 회원 저장소와 그 위의 AuthService다.
type SocialTestWorld struct {
	Svc *AuthService
	mem *fakeAuthMemberRepo
}

// NewSocialTestWorld는 비어 있는 회원 저장소로 AuthService를 만든다. verifier는 *auth.ProviderVerifier 등
// socialVerifier 구현이며 nil이면 검증기 없음이다.
func NewSocialTestWorld(verifier socialVerifier, mode auth.SocialMode, logger *slog.Logger) *SocialTestWorld {
	mem := &fakeAuthMemberRepo{
		byEmail: map[string]*model.Member{}, byMtID: map[string]*model.Member{}, byID: map[int]*model.Member{},
		byKakao: map[string]*model.Member{}, byGoogle: map[string]*model.Member{}, byApple: map[string]*model.Member{},
	}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "refresh-raw"}, testAuthConfig())
	svc.SetSocial(&fakeAuthSocialRepo{})
	svc.SetSocialVerification(SocialVerification{Verifier: verifier, Mode: mode, Emails: memberEmailChecker{mem}, Logger: logger})
	return &SocialTestWorld{Svc: svc, mem: mem}
}

// AddMember는 회원을 등록한다. level 1은 탈퇴, status 2는 정지. 빈 소셜 ID는 연결 없음.
func (w *SocialTestWorld) AddMember(idx int, email string, level, status int, kakao, google, apple string) {
	m := activeMember(idx, email)
	m.MtLevel, m.MtStatus = pInt(level), pInt(status)
	w.mem.byID[idx] = m
	if email != "" {
		w.mem.byEmail[strings.ToLower(email)] = m
	}
	if kakao != "" {
		m.MtKakaoID = pStr(kakao)
		w.mem.byKakao[kakao] = m
	}
	if google != "" {
		m.MtGoogleID = pStr(google)
		w.mem.byGoogle[google] = m
	}
	if apple != "" {
		m.MtAppleID = pStr(apple)
		w.mem.byApple[apple] = m
	}
}

// Wrote는 로그인/연결 처리로 회원 행에 쓰기가 있었는지 알려 준다(자동 연결·로그인 감지용).
func (w *SocialTestWorld) Wrote() bool { return w.mem.lastFields != nil }
