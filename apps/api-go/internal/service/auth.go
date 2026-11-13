package service

import (
	mathrand "math/rand"
	"strings"
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
	social  authSocialRepo  // Phase B 부가데이터(그룹·스케줄). SetSocial로 주입.
	verify  authVerifyStore // Phase C SMS 인증상태(Redis interop). SetVerifyStore로 주입.
	sender  resetSender     // sms/email 트랙: forgot 발송 seam. SetResetSender로 주입(nil이면 발송 skip).
	cfg     AuthConfig
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

// LoginHome은 Python login_for_home_page를 이식한다. 모든 예외를 흡수해 항상 200 동등 응답을 반환한다.
// (FastAPI 핸들러의 try/except가 success:false로 흡수 → 본 함수는 항상 (resp, nil))
func (s *AuthService) LoginHome(in LoginInput, userAgent, ipHash string) dto.LoginHomeResponse {
	fail := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "아이디 또는 비밀번호가 올바르지 않습니다."}
	}
	serverErr := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "서버 오류가 발생했습니다."}
	}

	// 이메일(@) 또는 전화번호(하이픈 제거)로 조회.
	var user *model.Member
	var err error
	if strings.Contains(in.MtID, "@") {
		user, err = s.members.GetByEmail(in.MtID)
	} else {
		user, err = s.members.GetByMtID(strings.ReplaceAll(in.MtID, "-", ""))
	}
	if err != nil {
		return serverErr()
	}
	if user == nil {
		return fail()
	}

	// 비밀번호 검증. mt_pwd 없으면(소셜) 실패.
	pwd := derefStr(user.MtPwd)
	if pwd == "" || !auth.VerifyPassword(in.MtPwd, pwd) {
		return fail()
	}
	// 탈퇴(mt_level=1)·정지(mt_status=2)·비노출(mt_show='N') 회원은 로그인 거부. NULL은 통과(기존 회원 잠금 방지).
	// 계정 존재·상태 노출을 막으려고 비밀번호 검증 뒤에, 비밀번호 오류와 같은 응답으로 거부한다.
	if user.IsBlocked() {
		return fail()
	}

	accessToken, err := s.issueAccessToken(user)
	if err != nil {
		return serverErr()
	}

	now := dbUTCNow()
	fields := map[string]interface{}{"mt_ldate": now, "mt_adate": now}
	if in.DeviceID != "" {
		fields["mt_device_id"] = in.DeviceID
	}
	if in.DeviceModel != "" {
		fields["mt_device_model"] = in.DeviceModel
	}
	if in.OsType != "" {
		v := 0
		if strings.ToLower(in.OsType) == "ios" {
			v = 1
		}
		fields["mt_os_check"] = v
	}
	if in.OsVersion != "" {
		fields["mt_os_version"] = in.OsVersion
	}
	if in.AppVersion != "" {
		fields["mt_app_version"] = in.AppVersion
	}
	if err := s.members.UpdateColumns(user.MtIdx, fields); err != nil {
		return serverErr()
	}
	// SQLAlchemy expire_on_commit 등가: commit 후 user_data를 만들 때 속성이 DB에서 재조회된다.
	// 갱신 행을 재조회해 응답이 컬럼 정밀도(mt_ldate/mt_adate 등)를 그대로 반영하게 한다.
	if fresh, ferr := s.members.GetByID(user.MtIdx); ferr == nil && fresh != nil {
		user = fresh
	} else {
		user.MtLdate, user.MtAdate = &now, &now // 안전 폴백(정상 흐름에선 도달 안 함)
	}

	refreshRaw, _, err := s.refresh.Issue(user.MtIdx, "", userAgent, ipHash)
	if err != nil {
		return serverErr()
	}

	return dto.LoginHomeResponse{
		Success: true,
		Message: "로그인 성공",
		Data: &dto.LoginHomeData{
			Token:        accessToken,
			RefreshToken: refreshRaw,
			ExpiresIn:    s.accessExpiresInSeconds(),
			User:         buildLoginUserData(user),
		},
	}
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
	RefreshV2OK       RefreshOutcome = iota // v2 rotation 성공
	RefreshV2Invalid                        // refresh token 유효하지 않음 (401)
	RefreshUserGone                         // 사용자를 찾을 수 없음 (401)
	RefreshV1OK                             // v1 access 재발급 성공
	RefreshNoToken                          // 토큰 부재 (401)
	RefreshV1Invalid                        // v1 토큰 유효하지 않음 (mt_idx 없음, 401)
	RefreshV1Fail                           // v1 JWT 디코드 실패 (401)
	RefreshServerErr                        // DB 등 서버 오류
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

// RegisterInput은 RegisterRequest(create_user가 사용하는 필드).
type RegisterInput struct {
	MtType    int
	MtLevel   int
	MtStatus  int
	MtID      string
	MtPwd     *string
	MtName    string
	MtNickname string
	MtEmail   *string
	MtBirth   *string
	MtGender  *int
	MtFile1   *string
	MtAgree1  bool
	MtAgree2  bool
	MtAgree3  bool
	MtAgree4  bool
	MtAgree5  bool
	MtTokenID *string
	MtLat     *float64
	MtLong    *float64
	MtGoogleID *string
	MtKakaoID  *string
	MtAppleID  *string
}

// RegisterOutcome은 /register 결과 분기.
type RegisterOutcome int

const (
	RegisterCreated      RegisterOutcome = iota // 201
	RegisterPhoneExists                         // 409 "이미 등록된 전화번호입니다."
	RegisterEmailExists                         // 409 "이미 등록된 이메일입니다."
	RegisterServerErr                           // 500 "사용자 생성 중 오류가 발생했습니다."
)

// Register는 Python register_user + crud_auth.create_user를 이식한다.
func (s *AuthService) Register(in RegisterInput) (RegisterOutcome, *dto.LoginHomeResponse) {
	// 전화번호 중복 확인 (mt_id 하이픈 제거)
	existing, err := s.members.GetByMtID(strings.ReplaceAll(in.MtID, "-", ""))
	if err != nil {
		return RegisterServerErr, nil
	}
	if existing != nil {
		return RegisterPhoneExists, nil
	}
	// 이메일 중복 확인 (mt_email and mt_email.strip())
	if in.MtEmail != nil && strings.TrimSpace(*in.MtEmail) != "" {
		existingEmail, err := s.members.GetByEmail(*in.MtEmail)
		if err != nil {
			return RegisterServerErr, nil
		}
		if existingEmail != nil {
			return RegisterEmailExists, nil
		}
	}

	// crud_auth.create_user — 이후 모든 오류는 register의 try/except가 500으로 흡수.
	created, err := s.createUser(in)
	if err != nil {
		return RegisterServerErr, nil
	}
	accessToken, err := s.issueAccessToken(created)
	if err != nil {
		return RegisterServerErr, nil
	}

	resp := &dto.LoginHomeResponse{
		Success: true,
		Message: "회원가입 성공",
		Data: &dto.RegisterData{
			Token: accessToken,
			User:  buildRegisterUserData(created),
		},
	}
	return RegisterCreated, resp
}

// createUser는 Python crud_auth.create_user. 비밀번호 정책 위반/생년월일 파싱 오류는 error 반환(→500).
func (s *AuthService) createUser(in RegisterInput) (*model.Member, error) {
	var hashed *string
	if in.MtPwd != nil && *in.MtPwd != "" {
		h, err := auth.HashPasswordWithPolicy(*in.MtPwd, s.cfg.BcryptCost, s.cfg.Policy)
		if err != nil {
			return nil, err
		}
		hashed = &h
	}

	cleanID := strings.ReplaceAll(in.MtID, "-", "")
	mtHp := ""
	if isAllDigits(cleanID) {
		mtHp = cleanID
	}

	// 프로필 이미지: 없거나 50자 초과면 랜덤 아바타(/images/avatar{1-7}.png).
	profileImage := ""
	if in.MtFile1 != nil {
		profileImage = *in.MtFile1
	}
	if profileImage == "" || len(profileImage) > 50 {
		profileImage = "/images/avatar" + itoaSmall(mathrand.Intn(7)+1) + ".png"
	}

	now := dbUTCNow()
	yn := func(b bool) *string {
		v := "N"
		if b {
			v = "Y"
		}
		return &v
	}
	show := "Y"
	// 권한·상태 값은 요청 본문(in.MtType/MtLevel/MtStatus)을 무시하고 서버가 일반 회원 값으로 정한다.
	// 무인증 가입에서 mt_level=9 등을 주입해 관리자 계정을 만드는 것을 막기 위함이다
	// (FastAPI 일반 가입과 동일: mt_type=1, mt_level=2, mt_status=1).
	mtType := newMemberType
	mtLevel := newMemberLevel
	mtStatus := newMemberStatus

	// mt_birth: strptime('%Y-%m-%d') → 실패 시 ValueError(→500).
	var birth *time.Time
	if in.MtBirth != nil && *in.MtBirth != "" {
		t, perr := time.Parse("2006-01-02", *in.MtBirth)
		if perr != nil {
			return nil, perr
		}
		birth = &t
	}

	// mt_lat/mt_long: getattr(...) or 기본값(서울시청). INSERT에 기본값이 저장된다.
	lat := 37.5642
	if in.MtLat != nil && *in.MtLat != 0 {
		lat = *in.MtLat
	}
	long := 127.0016
	if in.MtLong != nil && *in.MtLong != 0 {
		long = *in.MtLong
	}

	m := &model.Member{
		MtID:       &cleanID,
		MtPwd:      hashed,
		MtName:     &in.MtName,
		MtEmail:    in.MtEmail,
		MtNickname: &in.MtNickname,
		MtHp:       &mtHp,
		MtType:     &mtType,
		MtLevel:    &mtLevel,
		MtStatus:   &mtStatus,
		MtShow:     &show,
		MtWdate:    &now,
		MtLdate:    &now,
		MtAgree1:   yn(in.MtAgree1),
		MtAgree2:   yn(in.MtAgree2),
		MtAgree3:   yn(in.MtAgree3),
		MtAgree4:   yn(in.MtAgree4),
		MtAgree5:   yn(in.MtAgree5),
		MtGoogleID: in.MtGoogleID,
		MtKakaoID:  in.MtKakaoID,
		MtAppleID:  in.MtAppleID,
		MtBirth:    birth,
		MtGender:   in.MtGender,
		MtFile1:    &profileImage,
		MtLat:      &lat,
		MtLong:     &long,
		MtTokenID:  in.MtTokenID,
	}
	return s.members.CreateMember(m)
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
