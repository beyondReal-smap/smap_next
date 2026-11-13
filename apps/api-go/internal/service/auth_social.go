package service

import (
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// authSocialRepo는 소셜로그인/find-user 부가데이터(그룹·스케줄) 접근.
type authSocialRepo interface {
	GroupsForUser(mtIdx int) ([]model.SocialGroupRow, error)
	SchedulesOrForUser(mtIdx int, start, end string) ([]model.SocialScheduleRow, error)
	SchedulesExistsForUser(mtIdx int, start, end string) ([]model.SocialSchedulePhoneRow, error)
	MemberLatLongStr(mtIdx int) (*string, *string, error)
}

// socialAccessToken은 Python create_access_token_for_social: claim {mt_idx, exp}만(소셜 토큰).
func (s *AuthService) socialAccessToken(mtIdx int) (string, error) {
	return auth.CreateAccessTokenRaw(map[string]interface{}{"mt_idx": mtIdx}, s.cfg.Secret, s.cfg.Algorithm, s.cfg.AccessExpMin)
}

// scheduleWindow는 Python datetime.now()±7d(KST, 서버 로컬). 초 단위 문자열로 반환(BETWEEN 바운드).
func scheduleWindow() (string, string) {
	now := time.Now()
	const f = "2006-01-02 15:04:05"
	return now.Add(-7 * 24 * time.Hour).Format(f), now.Add(7 * 24 * time.Hour).Format(f)
}

// reread는 갱신 후 행을 재조회한다(SQLAlchemy expire_on_commit/refresh 등가). 실패 시 원본 유지.
func (s *AuthService) reread(m *model.Member) *model.Member {
	if fresh, err := s.members.GetByID(m.MtIdx); err == nil && fresh != nil {
		return fresh
	}
	return m
}

// ===========================================================================
// kakao-login
// ===========================================================================

// KakaoInput은 KakaoLoginRequest의 서비스 입력.
type KakaoInput struct {
	KakaoID      string
	Email        string
	ProfileImage string
	DeviceID     string
	DeviceModel  string
	OsType       string
	OsVersion    string
	AppVersion   string
}

func (s *AuthService) KakaoLogin(in KakaoInput, userAgent, ipHash string) dto.LoginHomeResponse {
	errResp := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "카카오 로그인 처리 중 오류가 발생했습니다."}
	}
	newUser := dto.LoginHomeResponse{
		Success: true, Message: "신규 사용자입니다. 회원가입을 진행해주세요.",
		Data: &dto.KakaoNewUserData{IsNewUser: true},
	}

	existing, err := s.members.GetByKakaoID(in.KakaoID)
	if err != nil {
		return errResp()
	}
	var user *model.Member
	linkFields := map[string]interface{}{}
	if existing != nil {
		if derefInt(existing.MtLevel) == 1 {
			return dto.LoginHomeResponse{Success: false, Message: "탈퇴한 계정입니다. 새로운 계정으로 가입해주세요."}
		}
		if derefInt(existing.MtStatus) != 1 || derefStr(existing.MtShow) != "Y" {
			return dto.LoginHomeResponse{Success: false, Message: "비활성화된 계정입니다. 고객센터에 문의해주세요."}
		}
		user = existing
	} else {
		if in.Email != "" {
			eu, err := s.members.GetByEmail(in.Email)
			if err != nil {
				return errResp()
			}
			if eu != nil {
				if derefInt(eu.MtLevel) == 1 {
					return dto.LoginHomeResponse{Success: false, Message: "탈퇴한 계정입니다. 새로운 계정으로 가입해주세요."}
				}
				// 기존 이메일 계정에 카카오 연결
				user = eu
				linkFields["mt_kakao_id"] = in.KakaoID
				linkFields["mt_type"] = 2
				if in.ProfileImage != "" {
					linkFields["mt_file1"] = in.ProfileImage
				}
			} else {
				return newUser
			}
		} else {
			return newUser
		}
	}

	// 로그인 처리: 시각/기기 갱신 + (연결 필드) → 재조회 → user_data.
	now := dbUTCNow()
	fields := map[string]interface{}{"mt_ldate": now, "mt_adate": now}
	for k, v := range linkFields {
		fields[k] = v
	}
	applyDeviceFields(fields, in.DeviceID, in.DeviceModel, in.OsType, in.OsVersion, in.AppVersion)
	if err := s.members.UpdateColumns(user.MtIdx, fields); err != nil {
		return errResp()
	}
	user = s.reread(user)

	accessToken, err := s.issueAccessToken(user)
	if err != nil {
		return errResp()
	}
	refreshRaw, _, err := s.refresh.Issue(user.MtIdx, "", userAgent, ipHash)
	if err != nil {
		return errResp()
	}
	return dto.LoginHomeResponse{
		Success: true, Message: "카카오 로그인 성공",
		Data: &dto.KakaoLoginData{
			User: buildKakaoUserData(user), Token: accessToken, RefreshToken: refreshRaw,
			ExpiresIn: s.accessExpiresInSeconds(), IsNewUser: false,
		},
	}
}

// ===========================================================================
// google-login
// ===========================================================================

// GoogleInput은 google_login 입력.
type GoogleInput struct {
	GoogleID  string
	Email     string
	Name      string
	GivenName string
	Image     string
}

// GoogleLogin은 /auth/google-login용(schemas.auth.GoogleLoginRequest, given_name 필드 있음) — 신규 정상.
func (s *AuthService) GoogleLogin(in GoogleInput) dto.LoginHomeResponse {
	return s.googleLogin(in, false)
}

// GoogleLoginNewAsError은 /members/google-login용(schemas.member.GoogleLoginRequest, given_name 없음).
// member_service.py:354의 google_data.given_name 접근이 AttributeError → 신규 사용자는 항상 오류.
func (s *AuthService) GoogleLoginNewAsError(in GoogleInput) dto.LoginHomeResponse {
	return s.googleLogin(in, true)
}

func (s *AuthService) googleLogin(in GoogleInput, newUserAsError bool) dto.LoginHomeResponse {
	errResp := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "Google 로그인 처리 중 오류가 발생했습니다."}
	}
	if in.GoogleID == "" && in.Email == "" {
		return dto.LoginHomeResponse{Success: false, Message: "Google ID 또는 이메일이 필요합니다."}
	}

	var existing *model.Member
	lookupMethod := "none"
	linkFields := map[string]interface{}{}

	if in.Email != "" {
		eu, err := s.members.GetByEmail(in.Email)
		if err != nil {
			return errResp()
		}
		if eu != nil {
			existing = eu
			lookupMethod = "email"
			if in.GoogleID != "" && existing.MtGoogleID == nil {
				linkFields["mt_google_id"] = in.GoogleID
				linkFields["mt_type"] = 4
			}
		}
	}
	if existing == nil && in.GoogleID != "" {
		gu, err := s.members.GetByGoogleID(in.GoogleID)
		if err != nil {
			return errResp()
		}
		if gu != nil {
			existing = gu
			lookupMethod = "google_id"
		}
	}

	if existing != nil {
		if !(derefInt(existing.MtStatus) == 1 && derefInt(existing.MtLevel) > 1) {
			return dto.LoginHomeResponse{Success: false, Message: "비활성화된 계정입니다. 고객센터에 문의해주세요."}
		}
		now := dbUTCNow()
		fields := map[string]interface{}{"mt_ldate": now, "mt_adate": now}
		for k, v := range linkFields {
			fields[k] = v
		}
		if in.Image != "" && derefStr(existing.MtFile1) == "" {
			fields["mt_file1"] = in.Image
		}
		if err := s.members.UpdateColumns(existing.MtIdx, fields); err != nil {
			return errResp()
		}
		existing = s.reread(existing)

		groups, schedules, gc, sc, hasData := s.additionalData(existing.MtIdx)
		userData := buildSocialUserData(existing)
		token, err := s.socialAccessToken(existing.MtIdx)
		if err != nil {
			return errResp()
		}
		refreshRaw, _, err := s.refresh.Issue(existing.MtIdx, "", "", "")
		if err != nil {
			return errResp()
		}
		return dto.LoginHomeResponse{
			Success: true, Message: "Google 로그인 성공",
			Data: &dto.SocialLoginData{
				Member: userData, User: userData, Token: token, RefreshToken: refreshRaw,
				ExpiresIn: s.accessExpiresInSeconds(), IsNewUser: false, IsNewUserCamel: false,
				LookupMethod: lookupMethod, Groups: groups, RecentSchedules: schedules,
				GroupCount: gc, ScheduleCount: sc, HasData: hasData,
			},
		}
	}

	// 신규 사용자(DB 미저장). ⚠️ /members는 newUserAsError=true: schemas.member.GoogleLoginRequest에
	// given_name 필드가 없어 member_service.py:354 접근이 AttributeError → "Google 로그인 처리 중 오류".
	// /auth는 schemas.auth.GoogleLoginRequest(given_name 있음)라 정상 신규 응답.
	if newUserAsError {
		return errResp()
	}
	temp := &dto.GoogleTempUser{
		MtID: "google_" + in.GoogleID, MtName: orStr(in.Name, in.GivenName), MtNickname: orStr(in.GivenName, in.Name),
		MtEmail: in.Email, MtGoogleID: in.GoogleID, MtType: 4, MtLevel: 2, MtFile1: in.Image,
	}
	return dto.LoginHomeResponse{
		Success: true, Message: "신규 사용자입니다. 회원가입이 필요합니다.",
		Data: &dto.SocialNewUserData{
			Member: temp, User: temp, IsNewUser: true, IsNewUserCamel: true, LookupMethod: "new_user",
			Groups: []dto.SocialGroupItem{}, RecentSchedules: []dto.SocialScheduleItem{},
			GroupCount: 0, ScheduleCount: 0, HasData: false, NeedsOnboarding: true,
		},
	}
}

// ===========================================================================
// apple-login
// ===========================================================================

// AppleInput은 apple_login 입력.
type AppleInput struct {
	UserIdentifier string
	Email          string
	UserName       string
}

func (s *AuthService) AppleLogin(in AppleInput) dto.LoginHomeResponse {
	errResp := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "Apple 로그인 처리 중 오류가 발생했습니다."}
	}

	existing, err := s.members.GetByAppleID(in.UserIdentifier)
	if err != nil {
		return errResp()
	}
	lookupMethod := "none"
	linkFields := map[string]interface{}{}
	if existing != nil {
		lookupMethod = "apple_id"
	} else if in.Email != "" {
		eu, err := s.members.GetByEmail(in.Email)
		if err != nil {
			return errResp()
		}
		if eu != nil {
			existing = eu
			lookupMethod = "email"
			// Apple ID 연결(무조건)
			linkFields["mt_apple_id"] = in.UserIdentifier
			linkFields["mt_type"] = 5
		}
	}

	if existing != nil {
		if !(derefInt(existing.MtStatus) == 1 && derefInt(existing.MtLevel) > 1) {
			return dto.LoginHomeResponse{Success: false, Message: "비활성화된 계정입니다. 고객센터에 문의해주세요."}
		}
		now := dbUTCNow()
		fields := map[string]interface{}{"mt_ldate": now, "mt_adate": now}
		for k, v := range linkFields {
			fields[k] = v
		}
		if err := s.members.UpdateColumns(existing.MtIdx, fields); err != nil {
			return errResp()
		}
		existing = s.reread(existing)

		groups, schedules, gc, sc, hasData := s.additionalData(existing.MtIdx)
		userData := buildSocialUserData(existing)
		userData.MtType = derefIntOr(existing.MtType, 5) // mt_type 기본 5로 덮음(Python user_data["mt_type"]=mt_type or 5)
		token, err := s.socialAccessToken(existing.MtIdx)
		if err != nil {
			return errResp()
		}
		refreshRaw, _, err := s.refresh.Issue(existing.MtIdx, "", "", "")
		if err != nil {
			return errResp()
		}
		return dto.LoginHomeResponse{
			Success: true, Message: "Apple 로그인 성공",
			Data: &dto.SocialLoginData{
				Member: userData, User: userData, Token: token, RefreshToken: refreshRaw,
				ExpiresIn: s.accessExpiresInSeconds(), IsNewUser: false, IsNewUserCamel: false,
				LookupMethod: lookupMethod, Groups: groups, RecentSchedules: schedules,
				GroupCount: gc, ScheduleCount: sc, HasData: hasData,
			},
		}
	}

	// 신규 사용자
	appleIDShort := in.UserIdentifier
	if len(appleIDShort) > 10 {
		appleIDShort = appleIDShort[:10]
	}
	temp := &dto.AppleTempUser{
		MtID: "apple_" + appleIDShort, MtName: in.UserName, MtNickname: in.UserName,
		MtEmail: in.Email, MtAppleID: in.UserIdentifier, MtType: 5,
	}
	return dto.LoginHomeResponse{
		Success: true, Message: "신규 사용자입니다. 회원가입이 필요합니다.",
		Data: &dto.SocialNewUserData{
			Member: temp, User: temp, IsNewUser: true, IsNewUserCamel: true, LookupMethod: "new_user",
			Groups: []dto.SocialGroupItem{}, RecentSchedules: []dto.SocialScheduleItem{},
			GroupCount: 0, ScheduleCount: 0, HasData: false, NeedsOnboarding: true,
		},
	}
}

// ===========================================================================
// find-user-by-email / find-user-by-phone
// ===========================================================================

func (s *AuthService) FindUserByEmail(email string, googleID string) dto.LoginHomeResponse {
	errResp := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "서버 오류가 발생했습니다."}
	}
	user, err := s.members.GetByEmail(email)
	if err != nil {
		return errResp()
	}
	if user == nil {
		return dto.LoginHomeResponse{Success: false, Message: "사용자를 찾을 수 없습니다.",
			Data: &dto.FindNewUserData{Found: false, IsNewUser: true}}
	}
	if derefInt(user.MtLevel) == 1 {
		return dto.LoginHomeResponse{Success: false, Message: "탈퇴한 계정입니다.",
			Data: &dto.FindWithdrawnEmailData{Found: true, IsWithdrawn: true,
				User: dto.FindWithdrawnEmailUser{MtIdx: user.MtIdx, MtEmail: user.MtEmail, MtLevel: user.MtLevel}}}
	}
	if googleID != "" && user.MtGoogleID == nil {
		if err := s.members.UpdateColumns(user.MtIdx, map[string]interface{}{
			"mt_google_id": googleID, "mt_type": 4, "mt_ldate": dbUTCNow(),
		}); err != nil {
			return errResp()
		}
		user = s.reread(user)
	}
	groups := s.buildGroups(user.MtIdx)
	start, end := scheduleWindow()
	schedRows, _ := s.social.SchedulesOrForUser(user.MtIdx, start, end)
	schedules := buildSocialSchedules(schedRows)
	gc, sc := len(groups), len(schedules)
	return dto.LoginHomeResponse{
		Success: true, Message: "사용자 데이터 조회 성공",
		Data: &dto.FindUserData{
			Found: true, IsNewUser: false, User: buildFindEmailUserData(user),
			Groups: groups, RecentSchedules: schedules, GroupCount: gc, ScheduleCount: sc,
			HasData: gc > 0 || sc > 0, LookupMethod: "email", NeedsOnboarding: derefStr(user.MtOnboarding) == "N",
		},
	}
}

func (s *AuthService) FindUserByPhone(phone string, googleID string) dto.LoginHomeResponse {
	errResp := func() dto.LoginHomeResponse {
		return dto.LoginHomeResponse{Success: false, Message: "서버 오류가 발생했습니다."}
	}
	user, err := s.members.GetByPhoneOr(phone)
	if err != nil {
		return errResp()
	}
	if user == nil {
		return dto.LoginHomeResponse{Success: false, Message: "사용자를 찾을 수 없습니다.",
			Data: &dto.FindNewUserData{Found: false, IsNewUser: true}}
	}
	if derefInt(user.MtLevel) == 1 {
		return dto.LoginHomeResponse{Success: false, Message: "탈퇴한 계정입니다.",
			Data: &dto.FindWithdrawnPhoneData{Found: true, IsWithdrawn: true,
				User: dto.FindWithdrawnPhoneUser{MtIdx: user.MtIdx, MtHp: user.MtHp, MtLevel: user.MtLevel}}}
	}
	if googleID != "" && user.MtGoogleID == nil {
		if err := s.members.UpdateColumns(user.MtIdx, map[string]interface{}{
			"mt_google_id": googleID, "mt_type": 4, "mt_ldate": dbUTCNow(),
		}); err != nil {
			return errResp()
		}
		user = s.reread(user)
	}
	groups := s.buildGroups(user.MtIdx)
	start, end := scheduleWindow()
	schedRows, _ := s.social.SchedulesExistsForUser(user.MtIdx, start, end)
	schedules := buildFindPhoneSchedules(schedRows)
	gc, sc := len(groups), len(schedules)
	// mt_lat/mt_long은 raw Decimal 문자열로 별도 조회(Pydantic Decimal→문자열 직렬화 일치용).
	latStr, longStr, _ := s.social.MemberLatLongStr(user.MtIdx)
	return dto.LoginHomeResponse{
		Success: true, Message: "사용자 데이터 조회 성공",
		Data: &dto.FindUserData{
			Found: true, IsNewUser: false, User: buildFindPhoneUserData(user, latStr, longStr),
			Groups: groups, RecentSchedules: schedules, GroupCount: gc, ScheduleCount: sc,
			HasData: gc > 0 || sc > 0, LookupMethod: "phone", NeedsOnboarding: derefStr(user.MtOnboarding) == "N",
		},
	}
}

// additionalData는 _get_user_additional_data(그룹+스케줄[OR변형]). 오류 시 빈 결과(Python except).
func (s *AuthService) additionalData(mtIdx int) ([]dto.SocialGroupItem, []dto.SocialScheduleItem, int, int, bool) {
	groupRows, gerr := s.social.GroupsForUser(mtIdx)
	if gerr != nil {
		return []dto.SocialGroupItem{}, []dto.SocialScheduleItem{}, 0, 0, false
	}
	start, end := scheduleWindow()
	schedRows, serr := s.social.SchedulesOrForUser(mtIdx, start, end)
	if serr != nil {
		return []dto.SocialGroupItem{}, []dto.SocialScheduleItem{}, 0, 0, false
	}
	groups := buildSocialGroups(groupRows)
	schedules := buildSocialSchedules(schedRows)
	gc, sc := len(groups), len(schedules)
	return groups, schedules, gc, sc, gc > 0 || sc > 0
}

// buildGroups는 find-user의 그룹 목록(부가데이터와 동일 쿼리).
func (s *AuthService) buildGroups(mtIdx int) []dto.SocialGroupItem {
	rows, _ := s.social.GroupsForUser(mtIdx)
	return buildSocialGroups(rows)
}

// ===========================================================================
// builders
// ===========================================================================

func buildKakaoUserData(m *model.Member) *dto.KakaoUserData {
	return &dto.KakaoUserData{
		MtIdx: m.MtIdx, MtType: derefIntOr(m.MtType, 2), MtLevel: derefIntOr(m.MtLevel, 2),
		MtStatus: derefIntOr(m.MtStatus, 1), MtID: derefStrOr(m.MtID, ""), MtName: derefStrOr(m.MtName, ""),
		MtNickname: derefStrOr(m.MtNickname, ""), MtHp: derefStrOr(m.MtHp, ""), MtEmail: derefStrOr(m.MtEmail, ""),
		MtBirth: dateISOPtr(m.MtBirth), MtGender: derefIntOr(m.MtGender, 1), MtFile1: derefStrOr(m.MtFile1, ""),
		MtKakaoID: derefStrOr(m.MtKakaoID, ""),
		MtLat:     dto.PyFloat(derefFloatOr(m.MtLat, 37.5642)), MtLong: dto.PyFloat(derefFloatOr(m.MtLong, 127.0016)),
		MtSido: derefStrOr(m.MtSido, ""), MtGu: derefStrOr(m.MtGu, ""), MtDong: derefStrOr(m.MtDong, ""),
		MtOnboarding: derefStrOr(m.MtOnboarding, "Y"), MtPush1: derefStrOr(m.MtPush1, "Y"),
		MtPlanCheck: derefStrOr(m.MtPlanCheck, "N"), MtPlanDate: pyISOEmpty(m.MtPlanDate),
		MtWeatherPop: derefStrOr(m.MtWeatherPop, ""), MtWeatherSky: derefIntOr(m.MtWeatherSky, 8),
		MtWeatherTmn: derefIntOr(m.MtWeatherTmn, 18), MtWeatherTmx: derefIntOr(m.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(m.MtWeatherDate), MtWdate: pyISOUtcNow(m.MtWdate),
		MtLdate: pyISOUtcNow(m.MtLdate), MtAdate: pyISOUtcNow(m.MtAdate),
	}
}

func buildSocialUserData(m *model.Member) *dto.SocialBuildUserData {
	return &dto.SocialBuildUserData{
		MtIdx: m.MtIdx, MtType: derefIntOr(m.MtType, 4), MtLevel: derefIntOr(m.MtLevel, 2),
		MtStatus: derefIntOr(m.MtStatus, 1), MtID: derefStrOr(m.MtID, ""), MtName: derefStrOr(m.MtName, ""),
		MtNickname: derefStrOr(m.MtNickname, ""), MtHp: derefStrOr(m.MtHp, ""), MtEmail: derefStrOr(m.MtEmail, ""),
		MtBirth: dateISOPtr(m.MtBirth), MtGender: derefIntOr(m.MtGender, 1), MtFile1: derefStrOr(m.MtFile1, ""),
		MtLat: dto.PyFloat(derefFloatOr(m.MtLat, 37.5642)), MtLong: dto.PyFloat(derefFloatOr(m.MtLong, 127.0016)),
		MtSido: derefStrOr(m.MtSido, ""), MtGu: derefStrOr(m.MtGu, ""), MtDong: derefStrOr(m.MtDong, ""),
		MtOnboarding: derefStrOr(m.MtOnboarding, "N"), MtPush1: derefStrOr(m.MtPush1, "Y"),
		MtPlanCheck: derefStrOr(m.MtPlanCheck, "N"), MtPlanDate: pyISOEmpty(m.MtPlanDate),
		MtWeatherPop: derefStrOr(m.MtWeatherPop, ""), MtWeatherSky: derefIntOr(m.MtWeatherSky, 8),
		MtWeatherTmn: derefIntOr(m.MtWeatherTmn, 18), MtWeatherTmx: derefIntOr(m.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(m.MtWeatherDate), MtWdate: pyISOUtcNow(m.MtWdate),
		MtLdate: pyISOUtcNow(m.MtLdate), MtAdate: pyISOUtcNow(m.MtAdate), MtGoogleID: m.MtGoogleID,
	}
}

func buildFindEmailUserData(m *model.Member) *dto.FindEmailUserData {
	return &dto.FindEmailUserData{
		MtIdx: m.MtIdx, MtType: derefIntOr(m.MtType, 1), MtLevel: derefIntOr(m.MtLevel, 2),
		MtStatus: derefIntOr(m.MtStatus, 1), MtID: derefStrOr(m.MtID, ""), MtName: derefStrOr(m.MtName, ""),
		MtNickname: derefStrOr(m.MtNickname, ""), MtHp: derefStrOr(m.MtHp, ""), MtEmail: derefStrOr(m.MtEmail, ""),
		MtBirth: dateISOPtr(m.MtBirth), MtGender: derefIntOr(m.MtGender, 1), MtFile1: derefStrOr(m.MtFile1, ""),
		MtLat: dto.PyFloat(derefFloatOr(m.MtLat, 37.5642)), MtLong: dto.PyFloat(derefFloatOr(m.MtLong, 127.0016)),
		MtSido: derefStrOr(m.MtSido, ""), MtGu: derefStrOr(m.MtGu, ""), MtDong: derefStrOr(m.MtDong, ""),
		MtOnboarding: derefStrOr(m.MtOnboarding, "Y"), MtPush1: derefStrOr(m.MtPush1, "Y"),
		MtPlanCheck: derefStrOr(m.MtPlanCheck, "N"), MtPlanDate: pyISOEmpty(m.MtPlanDate),
		MtWeatherPop: derefStrOr(m.MtWeatherPop, ""), MtWeatherSky: derefIntOr(m.MtWeatherSky, 8),
		MtWeatherTmn: derefIntOr(m.MtWeatherTmn, 18), MtWeatherTmx: derefIntOr(m.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(m.MtWeatherDate), MtLdate: pyISOUtcNow(m.MtLdate),
		MtAdate: pyISOUtcNow(m.MtAdate), MtGoogleID: m.MtGoogleID,
	}
}

// buildFindPhoneUserData는 RAW 값: None→null, Decimal→문자열(latStr/longStr), datetime→isoformat.
func buildFindPhoneUserData(m *model.Member, latStr, longStr *string) *dto.FindPhoneUserData {
	return &dto.FindPhoneUserData{
		MtIdx: m.MtIdx, MtID: m.MtID, MtName: m.MtName, MtNickname: m.MtNickname, MtHp: m.MtHp,
		MtEmail: m.MtEmail, MtBirth: dateISOPtr(m.MtBirth), MtGender: m.MtGender, MtType: m.MtType,
		MtLevel: m.MtLevel, MtFile1: m.MtFile1, MtLat: pyDecimalStr(latStr), MtLong: pyDecimalStr(longStr),
		MtOnboarding: m.MtOnboarding, MtLdate: pyISOPtr(m.MtLdate), MtWdate: pyISOPtr(m.MtWdate),
	}
}

func buildSocialGroups(rows []model.SocialGroupRow) []dto.SocialGroupItem {
	out := make([]dto.SocialGroupItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.SocialGroupItem{
			SgtIdx: r.SgtIdx, SgtTitle: r.SgtTitle, SgdtOwnerChk: r.SgdtOwnerChk, SgdtLeaderChk: r.SgdtLeaderChk,
			MemberCount: r.MemberCount, IsOwner: derefStr(r.SgdtOwnerChk) == "Y", IsLeader: derefStr(r.SgdtLeaderChk) == "Y",
		})
	}
	return out
}

func buildSocialSchedules(rows []model.SocialScheduleRow) []dto.SocialScheduleItem {
	out := make([]dto.SocialScheduleItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.SocialScheduleItem{
			SstIdx: r.SstIdx, SstTitle: r.SstTitle, SstSdate: pyISOPtr(r.SstSdate),
			SstLocationTitle: r.SstLocationTitle, SgtIdx: r.SgtIdx, GroupTitle: r.GroupTitle,
		})
	}
	return out
}

func buildFindPhoneSchedules(rows []model.SocialSchedulePhoneRow) []dto.FindPhoneScheduleItem {
	out := make([]dto.FindPhoneScheduleItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, dto.FindPhoneScheduleItem{
			SstIdx: r.SstIdx, SstTitle: r.SstTitle, SstSdate: pyISOPtr(r.SstSdate), SstEdate: pyISOPtr(r.SstEdate),
			SstLocationTitle: r.SstLocationTitle, SstLocationAdd: r.SstLocationAdd,
			SstLocationLat: pyDecimalStr(r.SstLocationLat), SstLocationLong: pyDecimalStr(r.SstLocationLong),
			SstMemo: r.SstMemo, SgtIdx: r.SgtIdx, GroupTitle: r.GroupTitle,
		})
	}
	return out
}

// applyDeviceFields는 login/kakao 공통 기기정보 갱신(제공된 것만).
func applyDeviceFields(fields map[string]interface{}, deviceID, deviceModel, osType, osVersion, appVersion string) {
	if deviceID != "" {
		fields["mt_device_id"] = deviceID
	}
	if deviceModel != "" {
		fields["mt_device_model"] = deviceModel
	}
	if osType != "" {
		v := 0
		if strings.ToLower(osType) == "ios" {
			v = 1
		}
		fields["mt_os_check"] = v
	}
	if osVersion != "" {
		fields["mt_os_version"] = osVersion
	}
	if appVersion != "" {
		fields["mt_app_version"] = appVersion
	}
}

// orStr은 Python `a or b`(a 비면 b).
func orStr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
