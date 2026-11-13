package service

import (
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// authMemberRepo는 AuthService가 의존하는 회원 데이터 접근(좁은 인터페이스).
type authMemberRepo interface {
	GetByEmail(email string) (*model.Member, error)
	GetByMtID(mtID string) (*model.Member, error)
	GetByID(mtIdx int) (*model.Member, error)
	CreateMember(m *model.Member) (*model.Member, error)
	UpdateColumns(mtIdx int, fields map[string]interface{}) error
	// Phase B 소셜로그인/find-user 조회
	GetByKakaoID(kakaoID string) (*model.Member, error)
	GetByGoogleID(googleID string) (*model.Member, error)
	GetByAppleID(appleID string) (*model.Member, error)
	GetByPhoneOr(phone string) (*model.Member, error)
	// Phase C 비번재설정 토큰 조회(mt_reset_token + 미만료)
	GetByResetToken(token string, now time.Time) (*model.Member, error)
	// G4 로그인: 이메일이 같은 활성 회원(최대 2명). 비밀번호 변경: 해시 갱신 + refresh 전부 폐기(한 트랜잭션).
	FindActiveByEmail(email string) ([]model.Member, error)
	SetPasswordRevokeRefresh(mtIdx int, hashed string) error
}

// authRefreshRepo는 refresh 토큰 발급/회전/폐기(좁은 인터페이스).
type authRefreshRepo interface {
	Issue(mtIdx int, chainID, userAgent, ipHash string) (string, string, error)
	Rotate(rawOld, userAgent, ipHash string) (string, int, bool, error)
	RevokeByRaw(rawToken string) (bool, error)
}

// 신규 일반 회원의 서버 강제 값. 가입 경로(/auth/register, /members/register, POST /members/)는
// 요청 본문의 mt_type/mt_level/mt_status를 신뢰하지 않고 이 값으로 저장한다.
const (
	newMemberType   = 1 // 일반 가입
	newMemberLevel  = 2 // 일반(무료) 회원
	newMemberStatus = 1 // 정상
)

// AuthConfig는 service가 config 패키지에 직접 의존하지 않도록 필요한 설정만 담는다.
type AuthConfig struct {
	Secret       string
	Algorithm    string
	AccessExpMin int
	BcryptCost   int
	Policy       auth.PasswordPolicy
}

// AuthService는 Python `app/api/v1/endpoints/auth.py`의 비밀번호 로그인·토큰 수명주기 + 소셜로그인을 이식한다.
type AuthService struct {
	members authMemberRepo
	refresh authRefreshRepo
	social  authSocialRepo     // Phase B 부가데이터(그룹·스케줄). SetSocial로 주입.
	verify  authVerifyStore    // Phase C SMS 인증상태(Redis interop). SetVerifyStore로 주입.
	sender  resetSender        // sms/email 트랙: forgot 발송 seam. SetResetSender로 주입(nil이면 발송 skip).
	socialV SocialVerification // G5 소셜 공급자 토큰 검증(모드·검증기·이메일 조회). SetSocialVerification으로 주입.
	cfg     AuthConfig

	// G4
	reg      authRegisterStore // 가입 트랜잭션(SetRegisterStore)
	emailTok emailTokenService // 가입 이메일 인증 토큰 파싱·소비(SetEmailTokens)
	guard    securityStore     // 로그인 실패 한도·소셜 로그인 증거(Redis; SetSecurityStore)
	revoker  accessRevoker     // 비밀번호 변경 시 구 access token 무효 기준(SetAccessRevoker)
	policy   AuthPolicy
	logger   *slog.Logger
	dummyMu  sync.Once
	dummyPwd string
	identMu  [64]sync.Mutex // 같은 식별자의 동시 가입 직렬화(프로세스 내)
}

// resetSender는 forgot-password의 비번재설정 링크 발송(SMS/이메일) seam이다.
// 발송 결과는 응답에 무관(Python: await 후 실패 swallow) — 메서드는 결과를 반환하지 않는다.
type resetSender interface {
	SendPasswordResetSMS(phone, resetURL string)
	SendPasswordResetEmail(email, resetURL string)
}

func NewAuth(members authMemberRepo, refresh authRefreshRepo, cfg AuthConfig) *AuthService {
	return &AuthService{members: members, refresh: refresh, cfg: cfg}
}

// SetSocial은 Phase B 소셜 부가데이터 repo를 주입한다(NewAuth 시그니처 보존용).
func (s *AuthService) SetSocial(social authSocialRepo) { s.social = social }

// SetResetSender는 forgot-password 발송 어댑터를 주입한다(sms/email 트랙 배선).
func (s *AuthService) SetResetSender(sender resetSender) { s.sender = sender }

// accessExpiresInSeconds는 Python _access_expires_in_seconds: ACCESS_TOKEN_EXPIRE_MINUTES * 60.
func (s *AuthService) accessExpiresInSeconds() int { return s.cfg.AccessExpMin * 60 }

// issueAccessToken은 create_access_token({mt_idx, mt_id, mt_name}).
func (s *AuthService) issueAccessToken(m *model.Member) (string, error) {
	return auth.CreateAccessToken(m.MtIdx, derefStr(m.MtID), m.MtName, s.cfg.Secret, s.cfg.Algorithm, s.cfg.AccessExpMin)
}

// LoginInput은 LoginRequestHome.
type LoginInput struct {
	MtID        string
	MtPwd       string
	DeviceID    string
	DeviceModel string
	OsType      string
	OsVersion   string
	AppVersion  string
}

// Logout은 Python logout: refresh_token 있으면 revoke, 항상 고정 응답.
func (s *AuthService) Logout(refreshRaw string) dto.LogoutResponse {
	if refreshRaw != "" {
		_, _ = s.refresh.RevokeByRaw(refreshRaw) // best-effort (Python도 결과 미사용)
	}
	return dto.LogoutResponse{Success: true, Message: "로그아웃되었습니다."}
}

// RefreshOutcome은 /refresh 결과 분기.
type RefreshOutcome int

const (
	RefreshV2OK      RefreshOutcome = iota // v2 rotation 성공
	RefreshV2Invalid                       // refresh token 유효하지 않음 (401)
	RefreshUserGone                        // 사용자를 찾을 수 없음 (401)
	RefreshV1OK                            // v1 access 재발급 성공
	RefreshNoToken                         // 토큰 부재 (401)
	RefreshV1Invalid                       // v1 토큰 유효하지 않음 (mt_idx 없음, 401)
	RefreshV1Fail                          // v1 JWT 디코드 실패 (401)
	RefreshServerErr                       // DB 등 서버 오류
)

// RefreshV2는 body refresh_token으로 rotation. Python refresh의 v2 경로.
func (s *AuthService) RefreshV2(rawOld, userAgent, ipHash string) (RefreshOutcome, *dto.RefreshV2Response) {
	newRaw, mtIdx, ok, err := s.refresh.Rotate(rawOld, userAgent, ipHash)
	if err != nil {
		return RefreshServerErr, nil
	}
	if !ok {
		return RefreshV2Invalid, nil
	}
	user, err := s.members.GetByID(mtIdx)
	if err != nil {
		return RefreshServerErr, nil
	}
	if user == nil || user.IsBlocked() {
		// 탈퇴·정지·비노출 회원은 refresh로 access를 다시 받을 수 없다(없는 회원과 같은 401).
		return RefreshUserGone, nil
	}
	accessToken, err := s.issueAccessToken(user)
	if err != nil {
		return RefreshServerErr, nil
	}
	return RefreshV2OK, &dto.RefreshV2Response{
		Success:      true,
		Token:        accessToken,
		RefreshToken: newRaw,
		ExpiresIn:    s.accessExpiresInSeconds(),
		Message:      "토큰이 갱신되었습니다.",
	}
}

// RefreshV1은 Authorization Bearer access 토큰으로 access만 재발급. Python refresh의 v1 경로.
// mtIdx/mtID/mtName은 기존 토큰 claim에서 추출해 전달받는다(핸들러가 디코드).
func (s *AuthService) RefreshV1(mtIdx int, mtID string, mtName *string) (RefreshOutcome, *dto.RefreshV1Response) {
	// 탈퇴·정지·비노출 회원은 access를 연장할 수 없다. 회원 행이 없는 경우는 기존 동작(발급)을 유지한다.
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return RefreshServerErr, nil
	}
	if member != nil && member.IsBlocked() {
		return RefreshV1Fail, nil
	}
	token, err := auth.CreateAccessToken(mtIdx, mtID, mtName, s.cfg.Secret, s.cfg.Algorithm, s.cfg.AccessExpMin)
	if err != nil {
		return RefreshServerErr, nil
	}
	return RefreshV1OK, &dto.RefreshV1Response{
		Success: true,
		Token:   token,
		Message: "토큰이 갱신되었습니다.",
	}
}

// LoginOriginalOutcome은 /login-original 결과 분기.
type LoginOriginalOutcome int

const (
	LoginOrigOK LoginOriginalOutcome = iota
	LoginOrigUnauthorized
	LoginOrigServerErr
)

// LoginOriginal은 Python login_for_access_token_custom(레거시). mt_hp(하이픈 제거)+mt_pass.
func (s *AuthService) LoginOriginal(mtHp, mtPass string) (LoginOriginalOutcome, *dto.LoginOriginalResponse) {
	user, err := s.members.GetByMtID(strings.ReplaceAll(mtHp, "-", ""))
	if err != nil {
		return LoginOrigServerErr, nil
	}
	if user == nil {
		return LoginOrigUnauthorized, nil
	}
	pwd := derefStr(user.MtPwd)
	if pwd == "" || !auth.VerifyPassword(mtPass, pwd) {
		return LoginOrigUnauthorized, nil
	}
	if user.IsBlocked() {
		return LoginOrigUnauthorized, nil // 탈퇴·정지·비노출 회원 거부(비밀번호 오류와 같은 응답)
	}

	// create_user_identity_from_member → UserIdentity(mt_idx, mt_id, mt_name, mt_level)
	identity := dto.UserIdentity{
		MtIdx:   user.MtIdx,
		MtID:    derefStr(user.MtID),
		MtName:  derefStr(user.MtName),
		MtLevel: derefInt(user.MtLevel),
	}
	// access_token = create_access_token(user_identity.model_dump())  → claim {mt_idx,mt_id,mt_name,mt_level}
	accessToken, err := auth.CreateAccessTokenRaw(map[string]interface{}{
		"mt_idx":   identity.MtIdx,
		"mt_id":    identity.MtID,
		"mt_name":  identity.MtName,
		"mt_level": identity.MtLevel,
	}, s.cfg.Secret, s.cfg.Algorithm, s.cfg.AccessExpMin)
	if err != nil {
		return LoginOrigServerErr, nil
	}

	// mt_ldate = utcnow; commit (FCM 토큰은 갱신 안 함)
	now := dbUTCNow()
	if err := s.members.UpdateColumns(user.MtIdx, map[string]interface{}{"mt_ldate": now}); err != nil {
		return LoginOrigServerErr, nil
	}

	return LoginOrigOK, &dto.LoginOriginalResponse{AccessToken: accessToken, User: identity}
}

// --- user_data 빌더 (login/register 응답) ---

func buildLoginUserData(m *model.Member) *dto.LoginUserData {
	return &dto.LoginUserData{
		MtIdx:         m.MtIdx,
		MtType:        derefIntOr(m.MtType, 1),
		MtLevel:       derefIntOr(m.MtLevel, 2),
		MtStatus:      derefIntOr(m.MtStatus, 1),
		MtID:          derefStrOr(m.MtID, ""),
		MtName:        derefStrOr(m.MtName, ""),
		MtNickname:    derefStrOr(m.MtNickname, ""),
		MtHp:          derefStrOr(m.MtHp, ""),
		MtEmail:       derefStrOr(m.MtEmail, ""),
		MtBirth:       dateISOPtr(m.MtBirth),
		MtGender:      derefIntOr(m.MtGender, 1),
		MtFile1:       derefStrOr(m.MtFile1, ""),
		MtLat:         dto.PyFloat(derefFloatOr(m.MtLat, 37.5642)),
		MtLong:        dto.PyFloat(derefFloatOr(m.MtLong, 127.0016)),
		MtSido:        derefStrOr(m.MtSido, ""),
		MtGu:          derefStrOr(m.MtGu, ""),
		MtDong:        derefStrOr(m.MtDong, ""),
		MtOnboarding:  derefStrOr(m.MtOnboarding, "Y"),
		MtPush1:       derefStrOr(m.MtPush1, "Y"),
		MtPlanCheck:   derefStrOr(m.MtPlanCheck, "N"),
		MtPlanDate:    pyISOEmpty(m.MtPlanDate),
		MtWeatherPop:  derefStrOr(m.MtWeatherPop, ""),
		MtWeatherSky:  derefIntOr(m.MtWeatherSky, 8),
		MtWeatherTmn:  derefIntOr(m.MtWeatherTmn, 18),
		MtWeatherTmx:  derefIntOr(m.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(m.MtWeatherDate),
		MtWdate:       pyISOUtcNow(m.MtWdate),
		MtLdate:       pyISOUtcNow(m.MtLdate),
		MtAdate:       pyISOUtcNow(m.MtAdate),
	}
}

func buildRegisterUserData(m *model.Member) *dto.RegisterUserData {
	return &dto.RegisterUserData{
		MtIdx:         m.MtIdx,
		MtType:        derefIntOr(m.MtType, 1),
		MtLevel:       derefIntOr(m.MtLevel, 2),
		MtStatus:      derefIntOr(m.MtStatus, 1),
		MtID:          derefStrOr(m.MtID, ""),
		MtName:        derefStrOr(m.MtName, ""),
		MtNickname:    derefStrOr(m.MtNickname, ""),
		MtHp:          derefStrOr(m.MtHp, ""),
		MtEmail:       derefStrOr(m.MtEmail, ""),
		MtBirth:       dateISOPtr(m.MtBirth),
		MtGender:      derefIntOr(m.MtGender, 1),
		MtFile1:       derefStrOr(m.MtFile1, ""),
		MtLat:         dto.PyFloat(derefFloatOr(m.MtLat, 37.5642)),
		MtLong:        dto.PyFloat(derefFloatOr(m.MtLong, 127.0016)),
		MtSido:        derefStrOr(m.MtSido, ""),
		MtGu:          derefStrOr(m.MtGu, ""),
		MtDong:        derefStrOr(m.MtDong, ""),
		MtOnboarding:  derefStrOr(m.MtOnboarding, "Y"),
		MtPlanCheck:   derefStrOr(m.MtPlanCheck, "N"),
		MtPlanDate:    pyISOEmpty(m.MtPlanDate),
		MtWeatherPop:  derefStrOr(m.MtWeatherPop, ""),
		MtWeatherSky:  derefIntOr(m.MtWeatherSky, 8),
		MtWeatherTmn:  derefIntOr(m.MtWeatherTmn, 18),
		MtWeatherTmx:  derefIntOr(m.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(m.MtWeatherDate),
		MtWdate:       pyISOUtcNow(m.MtWdate),
		MtLdate:       pyISOUtcNow(m.MtLdate),
		MtAdate:       pyISOUtcNow(m.MtAdate),
	}
}

// --- 소형 헬퍼 ---

// derefStrOr는 Python `x or default`: nil 또는 빈 문자열이면 default.
func derefStrOr(p *string, def string) string {
	if p == nil || *p == "" {
		return def
	}
	return *p
}

// derefFloatOr는 Python `float(x) if x else default`: nil 또는 0이면 default.
func derefFloatOr(p *float64, def float64) float64 {
	if p == nil || *p == 0 {
		return def
	}
	return *p
}

// derefInt는 *int → int(nil이면 0). UserIdentity.mt_level 등 raw 변환용.
func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func itoaSmall(n int) string { return string(rune('0' + n)) }
