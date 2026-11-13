package service

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
)

// socialVerifier는 공급자 토큰 검증 seam이다(auth.ProviderVerifier가 구현, 테스트는 가짜 주입).
type socialVerifier interface {
	Configured(p auth.Provider) bool
	Verify(ctx context.Context, p auth.Provider, token string) (*auth.ProviderIdentity, error)
}

// socialEmailChecker는 "활성(탈퇴 아님) 회원 중 이 이메일을 쓰는 계정이 있는가" 조회 seam이다.
type socialEmailChecker interface {
	ExistsActiveByEmail(email string) (bool, error)
}

// SocialVerification은 소셜 로그인 검증 배선이다.
type SocialVerification struct {
	Verifier socialVerifier
	Mode     auth.SocialMode
	Emails   socialEmailChecker
	Logger   *slog.Logger
}

// SetSocialVerification은 소셜 로그인 검증을 주입한다. Mode가 비어 있으면(배선 누락) 소셜 로그인은
// 검증을 건너뛰지 않고 503으로 실패한다.
func (s *AuthService) SetSocialVerification(v SocialVerification) { s.socialV = v }

// msgSocialEmailTaken은 공급자 이메일이 기존 활성 계정의 이메일과 같을 때의 안내(FastAPI B-5와 동일 문구).
const msgSocialEmailTaken = "이미 이 이메일로 가입된 계정이 있어요. 이메일과 비밀번호로 로그인해 주세요."

// SocialVerifyError는 공급자 토큰 검증 실패를 HTTP 상태와 함께 전달한다.
type SocialVerifyError struct {
	Status int    // 401 / 502 / 503
	Detail string // 응답 detail(한국어, 토큰·ID 미포함)
	Err    error
}

func (e *SocialVerifyError) Error() string { return e.Detail }
func (e *SocialVerifyError) Unwrap() error { return e.Err }

func newSocialVerifyError(err error) *SocialVerifyError {
	switch {
	case errors.Is(err, auth.ErrProviderNotConfigured):
		return &SocialVerifyError{Status: http.StatusServiceUnavailable, Detail: "소셜 로그인 설정이 필요합니다.", Err: err}
	case errors.Is(err, auth.ErrProviderUnavailable):
		return &SocialVerifyError{Status: http.StatusBadGateway, Detail: "소셜 인증 서비스를 사용할 수 없습니다.", Err: err}
	default:
		return &SocialVerifyError{Status: http.StatusUnauthorized, Detail: "소셜 인증 토큰이 유효하지 않습니다.", Err: err}
	}
}

func (s *AuthService) socialLogger() *slog.Logger {
	if s.socialV.Logger != nil {
		return s.socialV.Logger
	}
	return slog.Default()
}

// VerifySocialToken은 소셜 로그인 요청의 공급자 토큰을 모드에 따라 검증한다. G4 가입(/auth/register의
// social_provider/social_token)은 모드와 무관하게 토큰이 필수이므로 auth.ProviderVerifier.Verify를 직접
// 호출한다(이 함수는 "로그인" 전용).
//
//	off                    -> (nil, nil)  검증 안 함
//	when_present, 토큰 없음 -> (nil, nil)  경고 계측 로그(공급자·앱 식별만)
//	when_present, 토큰 있음 -> 검증(실패 시 *SocialVerifyError)
//	required, 토큰 없음     -> 401 / 설정 비어 있음 -> 503(토큰 유무와 무관)
//
// (nil, nil)은 "검증된 신원 없음"이다. 호출자는 이때 클라이언트가 보낸 값을 신뢰 근거로 쓰지 않는다.
func (s *AuthService) VerifySocialToken(ctx context.Context, p auth.Provider, token, userAgent string) (*auth.ProviderIdentity, error) {
	token = strings.TrimSpace(token)
	switch s.socialV.Mode {
	case auth.SocialModeOff:
		return nil, nil
	case auth.SocialModeWhenPresent, auth.SocialModeRequired:
	default:
		// 배선 누락: 조용히 통과시키지 않는다.
		s.socialLogger().Error("social verification not wired", slog.String("provider", string(p)))
		return nil, newSocialVerifyError(auth.ErrProviderNotConfigured)
	}
	if s.socialV.Verifier == nil {
		s.socialLogger().Error("social verifier missing", slog.String("provider", string(p)))
		return nil, newSocialVerifyError(auth.ErrProviderNotConfigured)
	}
	if s.socialV.Mode == auth.SocialModeRequired {
		if !s.socialV.Verifier.Configured(p) {
			return nil, newSocialVerifyError(auth.ErrProviderNotConfigured)
		}
		if token == "" {
			return nil, newSocialVerifyError(auth.ErrProviderTokenInvalid)
		}
	}
	if token == "" { // when_present
		s.socialLogger().Warn("social login without provider token",
			slog.String("provider", string(p)), slog.String("app", appIdentity(userAgent)))
		return nil, nil
	}
	id, err := s.socialV.Verifier.Verify(ctx, p, token)
	if err != nil {
		e := newSocialVerifyError(err)
		s.socialLogger().Warn("social token rejected",
			slog.String("provider", string(p)), slog.Int("status", e.Status), slog.String("app", appIdentity(userAgent)))
		return nil, e
	}
	return id, nil
}

// appIdentity는 User-Agent에서 앱 식별 부분(첫 토큰, 최대 40자)만 남긴다(기기 모델·OS 등은 버린다).
func appIdentity(ua string) string {
	ua = strings.TrimSpace(ua)
	if ua == "" {
		return "unknown"
	}
	if i := strings.IndexAny(ua, " ("); i > 0 {
		ua = ua[:i]
	}
	if len(ua) > 40 {
		ua = ua[:40]
	}
	return ua
}

// noteIDMismatch는 클라이언트가 보낸 ID가 검증값과 다를 때 계측만 남긴다(검증값이 우선한다. 값은 기록하지 않음).
func (s *AuthService) noteIDMismatch(p auth.Provider, clientID, verifiedID string) {
	if clientID != "" && clientID != verifiedID {
		s.socialLogger().Warn("social client id differs from verified id", slog.String("provider", string(p)))
	}
}

// emailTaken은 정규화한 이메일을 쓰는 활성 회원이 있는지 조회한다. 조회 실패는 에러로 돌려준다.
func (s *AuthService) emailTaken(email string) (bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false, nil
	}
	if s.socialV.Emails == nil {
		return false, errors.New("social email checker not wired")
	}
	return s.socialV.Emails.ExistsActiveByEmail(email)
}

// KakaoLoginVerified는 카카오 access_token을 검증한 뒤 KakaoLogin을 호출한다.
// 검증되면 kakao_id는 토큰으로 확인한 ID로 덮어쓰고(FastAPI와 동일) 클라이언트 email/profile_image는 버린다.
func (s *AuthService) KakaoLoginVerified(ctx context.Context, in KakaoInput, accessToken, userAgent, ipHash string) (dto.LoginHomeResponse, error) {
	id, err := s.VerifySocialToken(ctx, auth.ProviderKakao, accessToken, userAgent)
	if err != nil {
		return dto.LoginHomeResponse{}, err
	}
	if id != nil {
		s.noteIDMismatch(auth.ProviderKakao, in.KakaoID, id.Subject)
		in.KakaoID = id.Subject
		in.Email = ""
		in.ProfileImage = ""
	}
	resp := s.KakaoLogin(in, userAgent, ipHash)
	s.noteNewSocialUser(id, auth.ProviderKakao, resp)
	return resp, nil
}

// GoogleLoginVerified는 Google id_token을 검증한 뒤 GoogleLogin(또는 /members용 변형)을 호출한다.
// 검증되면 google_id=sub, email=검증된 이메일(email_verified=true일 때만, 아니면 빈 값)로 덮어쓴다.
// name/given_name/image는 토큰 claim이 있으면 그것을, 없으면 요청 값을 표시용으로 유지한다.
func (s *AuthService) GoogleLoginVerified(ctx context.Context, in GoogleInput, idToken string, strictMembersRoute bool, userAgent string) (dto.LoginHomeResponse, error) {
	id, err := s.VerifySocialToken(ctx, auth.ProviderGoogle, idToken, userAgent)
	if err != nil {
		return dto.LoginHomeResponse{}, err
	}
	if id != nil {
		s.noteIDMismatch(auth.ProviderGoogle, in.GoogleID, id.Subject)
		in.GoogleID = id.Subject
		in.Email = ""
		if id.EmailVerified {
			in.Email = id.Email
		}
		in.Name = orStr(id.Name, in.Name)
		in.GivenName = orStr(id.GivenName, in.GivenName)
		in.Image = orStr(id.Picture, in.Image)
	}
	resp := s.googleLogin(in, strictMembersRoute)
	s.noteNewSocialUser(id, auth.ProviderGoogle, resp)
	return resp, nil
}

// AppleLoginVerified는 Apple identityToken을 검증한 뒤 AppleLogin을 호출한다.
// 검증되면 userIdentifier=sub, email=검증된 이메일(email_verified일 때만)로 덮어쓴다.
// userName은 Apple이 토큰에 담지 않으므로 요청 값을 표시용으로 유지한다.
func (s *AuthService) AppleLoginVerified(ctx context.Context, in AppleInput, identityToken, userAgent string) (dto.LoginHomeResponse, error) {
	id, err := s.VerifySocialToken(ctx, auth.ProviderApple, identityToken, userAgent)
	if err != nil {
		return dto.LoginHomeResponse{}, err
	}
	if id != nil {
		s.noteIDMismatch(auth.ProviderApple, in.UserIdentifier, id.Subject)
		in.UserIdentifier = id.Subject
		in.Email = ""
		if id.EmailVerified {
			in.Email = id.Email
		}
	}
	resp := s.AppleLogin(in)
	s.noteNewSocialUser(id, auth.ProviderApple, resp)
	return resp, nil
}

// noteNewSocialUser는 공급자 토큰을 검증한 로그인에서 신규 사용자 응답이 나갔을 때 그 공급자 ID를 가입 증거로 남긴다.
func (s *AuthService) noteNewSocialUser(id *auth.ProviderIdentity, p auth.Provider, resp dto.LoginHomeResponse) {
	if id == nil || !resp.Success {
		return
	}
	switch resp.Data.(type) {
	case *dto.KakaoNewUserData, *dto.SocialNewUserData:
		s.recordSocialLoginProof(p, id.Subject)
	}
}
