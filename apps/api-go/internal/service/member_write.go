package service

import (
	"math/rand"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// memberWriteRepo는 MemberWriteService가 의존하는 데이터 접근 인터페이스(members write 17종).
type memberWriteRepo interface {
	GetByID(mtIdx int) (*model.Member, error)
	GetByIdxActive(idx int) (*model.Member, error)
	GetByEmail(email string) (*model.Member, error)
	GetByPhoneOr(phone string) (*model.Member, error)
	CreateFromRegister(m *model.Member) (*model.Member, error)
	CreateUserMember(m *model.Member) (*model.Member, error)
	UpdateColumns(mtIdx int, fields map[string]interface{}) error
	ExistsPhoneExcept(cleanPhone string, exceptIdx int) (bool, error)
	ExistsEmailExcept(email string, exceptIdx int) (bool, error)
	ExistsNicknameExcept(nickname string, exceptIdx int) (bool, error)
}

// MemberWriteService는 Python `app/api/v1/endpoints/members.py`의 write 핸들러를 이식한다.
// (register/login은 member_service, 비번/프로필/연락처는 crud_auth, 동의는 crud_member 로직.)
type MemberWriteService struct {
	repo   memberWriteRepo
	cost   int
	policy auth.PasswordPolicy
}

func NewMemberWrite(repo memberWriteRepo, cost int, policy auth.PasswordPolicy) *MemberWriteService {
	return &MemberWriteService{repo: repo, cost: cost, policy: policy}
}

// randomAvatar는 Python crud_member.get_random_avatar(random.randint(1,7))와 동등하다.
func randomAvatar() string {
	n := rand.Intn(7) + 1 // 1..7
	return "/images/avatar" + itoa(n) + ".png"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [4]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

func ynBool(b bool) string {
	if b {
		return "Y"
	}
	return "N"
}

// ===========================================================================
// 인증 위임 (register/login). google-login은 auth.GoogleLogin 핸들러 재사용.
// ===========================================================================

// RegisterInput은 RegisterRequest(검증 완료, validator 없음). mt_id는 raw(하이픈 미제거), 서비스에서 정규화.
type MemberRegisterInput struct {
	MtType, MtLevel, MtStatus        *int
	MtID                             string
	MtPwd                            *string
	MtName, MtNickname               string
	MtEmail                          *string
	MtBirth                          *string // YYYY-MM-DD raw
	MtGender                         *int
	MtFile1                          *string
	MtShow, MtOnboarding             string // RegisterRequest str 기본 "Y"/"N"
	MtAgree1, MtAgree2, MtAgree3     bool
	MtAgree4, MtAgree5               bool
	MtTokenID                        *string
	MtPush1                          bool
	MtLat, MtLong                    *float64
	MtGoogleID, MtKakaoID, MtAppleID *string
}

// Register는 Python member_service.register_member를 이식한다(전화/이메일 중복 → create_from_register).
func (s *MemberWriteService) Register(in MemberRegisterInput) dto.RegisterResponse {
	fail := func(msg string) dto.RegisterResponse { return dto.RegisterResponse{Success: false, Message: msg} }

	// 1. 전화번호 중복(get_by_phone: 하이픈 제거, mt_id OR mt_hp)
	existing, err := s.repo.GetByPhoneOr(in.MtID)
	if err != nil {
		return fail("회원가입 처리 중 오류가 발생했습니다.")
	}
	if existing != nil {
		return fail("이미 가입된 전화번호입니다.")
	}
	// 2. 이메일 중복(있는 경우만)
	if in.MtEmail != nil && *in.MtEmail != "" {
		eu, err := s.repo.GetByEmail(*in.MtEmail)
		if err != nil {
			return fail("회원가입 처리 중 오류가 발생했습니다.")
		}
		if eu != nil {
			return fail("이미 가입된 이메일입니다.")
		}
	}
	// 3. 회원 생성
	m, err := s.buildRegisterMember(in)
	if err != nil {
		return fail("회원가입 처리 중 오류가 발생했습니다.")
	}
	saved, err := s.repo.CreateFromRegister(m)
	if err != nil || saved == nil {
		return fail("회원가입 처리 중 오류가 발생했습니다.")
	}
	// 4. 응답 data(6키)
	return dto.RegisterResponse{
		Success: true,
		Message: "회원가입이 완료되었습니다.",
		Data: &dto.MemberRegisterData{
			MtIdx:      saved.MtIdx,
			MtID:       derefStrOr(saved.MtID, ""),
			MtName:     derefStrOr(saved.MtName, ""),
			MtNickname: derefStrOr(saved.MtNickname, ""),
			MtEmail:    saved.MtEmail,
			MtWdate:    pyISOPtr(saved.MtWdate),
		},
	}
}

func (s *MemberWriteService) buildRegisterMember(in MemberRegisterInput) (*model.Member, error) {
	clean := strings.ReplaceAll(in.MtID, "-", "")

	// 비밀번호 해싱(있으면, 정책검증 없음 = crud_member.hash_password)
	var pwd *string
	if in.MtPwd != nil && *in.MtPwd != "" {
		h, err := auth.HashPassword(*in.MtPwd, s.cost)
		if err != nil {
			return nil, err
		}
		pwd = &h
	}
	// 생년월일(strptime 실패 시 nil)
	var birth *time.Time
	if in.MtBirth != nil && *in.MtBirth != "" {
		if t, err := time.Parse("2006-01-02", *in.MtBirth); err == nil {
			birth = &t
		}
	}
	// 프로필 이미지(mt_file1 있으면 그대로, 없으면 랜덤 아바타)
	var file1 string
	if in.MtFile1 != nil && *in.MtFile1 != "" {
		file1 = *in.MtFile1
	} else {
		file1 = randomAvatar()
	}
	// mt_hp = clean(단 @ 포함이면 nil)
	var hp *string
	if !strings.Contains(clean, "@") {
		hp = &clean
	}
	now := dbUTCNow()
	a1, a2, a3 := ynBool(in.MtAgree1), ynBool(in.MtAgree2), ynBool(in.MtAgree3)
	a4, a5 := ynBool(in.MtAgree4), ynBool(in.MtAgree5)
	push1 := ynBool(in.MtPush1)
	show, onboarding := in.MtShow, in.MtOnboarding

	return &model.Member{
		MtType: in.MtType, MtLevel: in.MtLevel, MtStatus: in.MtStatus,
		MtID: &clean, MtPwd: pwd, MtName: &in.MtName, MtNickname: &in.MtNickname,
		MtHp: hp, MtEmail: in.MtEmail, MtBirth: birth, MtGender: in.MtGender,
		MtFile1: &file1, MtShow: &show,
		MtAgree1: &a1, MtAgree2: &a2, MtAgree3: &a3, MtAgree4: &a4, MtAgree5: &a5,
		MtPush1: &push1, MtLat: in.MtLat, MtLong: in.MtLong, MtOnboarding: &onboarding,
		MtWdate: &now, MtAdate: &now,
		MtGoogleID: in.MtGoogleID, MtKakaoID: in.MtKakaoID, MtAppleID: in.MtAppleID, MtTokenID: in.MtTokenID,
	}, nil
}

// Login은 Python member_service.login_member를 이식한다(authenticate → is_active → update_login_time).
// ⚠️ /auth/login과 달리 토큰 미발급 — data={"user": user_data(buildLoginUserData)}.
func (s *MemberWriteService) Login(mtID, mtPwd string) dto.MemberLoginResponse {
	// authenticate: get_by_phone_or_email(@면 email, 아니면 phone) → verify_password
	var user *model.Member
	var err error
	if strings.Contains(mtID, "@") {
		user, err = s.repo.GetByEmail(mtID)
	} else {
		user, err = s.repo.GetByPhoneOr(mtID)
	}
	if err != nil {
		return dto.MemberLoginResponse{Success: false, Message: "로그인 처리 중 오류가 발생했습니다."}
	}
	if user == nil || !auth.VerifyPassword(mtPwd, derefStrOr(user.MtPwd, "")) {
		return dto.MemberLoginResponse{Success: false, Message: "아이디 또는 비밀번호가 올바르지 않습니다."}
	}
	// is_active: mt_status==1 AND mt_level>1
	if !(derefIntUser(user.MtStatus) == 1 && derefIntUser(user.MtLevel) > 1) {
		return dto.MemberLoginResponse{Success: false, Message: "비활성화된 계정입니다. 고객센터에 문의해주세요."}
	}
	// update_login_time: mt_ldate=mt_adate=utcnow
	now := dbUTCNow()
	if err := s.repo.UpdateColumns(user.MtIdx, map[string]interface{}{"mt_ldate": now, "mt_adate": now}); err != nil {
		return dto.MemberLoginResponse{Success: false, Message: "로그인 처리 중 오류가 발생했습니다."}
	}
	user.MtLdate = &now
	user.MtAdate = &now
	return dto.MemberLoginResponse{
		Success: true,
		Message: "로그인 성공",
		Data:    &dto.MemberLoginData{User: buildLoginUserData(user)},
	}
}

// ===========================================================================
// 비밀번호 (verify/change). 인증/검증/오류 전부 핸들러에서 200 래핑.
// ===========================================================================

// FindActive는 get_user_by_idx(활성 필터)로 존재 여부를 반환한다(change-password/withdraw의 "사용자를 찾을 수 없습니다" 분기용).
func (s *MemberWriteService) FindActive(uid int) (bool, error) {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil {
		return false, err
	}
	return u != nil, nil
}

// VerifyPassword는 Python crud_auth.verify_user_password를 이식한다(get_user_by_idx None/mt_pwd 없음→false).
func (s *MemberWriteService) VerifyPassword(uid int, currentPwd string) bool {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil || u == nil {
		return false
	}
	if u.MtPwd == nil || *u.MtPwd == "" {
		return false
	}
	return auth.VerifyPassword(currentPwd, *u.MtPwd)
}

// ChangePassword는 Python crud_auth.change_user_password를 이식한다(정책검증+bcrypt → mt_pwd/mt_udate).
// 정책위반(get_hashed_password ValueError)은 내부 except로 흡수되어 false(스키마 validator가 선차단해 사실상 미도달).
func (s *MemberWriteService) ChangePassword(uid int, newPwd string) bool {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil || u == nil {
		return false
	}
	h, err := auth.HashPasswordWithPolicy(newPwd, s.cost, s.policy)
	if err != nil {
		return false
	}
	now := dbUTCNow()
	if err := s.repo.UpdateColumns(uid, map[string]interface{}{"mt_pwd": h, "mt_udate": now}); err != nil {
		return false
	}
	return true
}

// ===========================================================================
// 프로필/연락처 (update-profile/contact). 중복체크 후 UpdateColumns.
// ===========================================================================

func (s *MemberWriteService) CheckNicknameDup(uid int, nickname string) (bool, error) {
	return s.repo.ExistsNicknameExcept(nickname, uid)
}

// UpdateProfile은 Python crud_auth.update_user_profile를 이식한다(get_user_by_idx None→false).
// mt_name/mt_nickname/mt_gender는 항상 set, mt_birth는 truthy일 때만(파싱 실패는 무시).
func (s *MemberWriteService) UpdateProfile(uid int, name, nickname string, birth *string, gender *int) bool {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil || u == nil {
		return false
	}
	fields := map[string]interface{}{
		"mt_name":     name,
		"mt_nickname": nickname,
	}
	if birth != nil && *birth != "" {
		if t, err := time.Parse("2006-01-02", *birth); err == nil {
			fields["mt_birth"] = t
		}
		// 파싱 실패 시 무시(Python: 로그만, 기존 값 유지)
	}
	if gender != nil {
		fields["mt_gender"] = *gender
	} else {
		fields["mt_gender"] = nil
	}
	fields["mt_udate"] = dbUTCNow()
	return s.repo.UpdateColumns(uid, fields) == nil
}

func (s *MemberWriteService) CheckPhoneDup(uid int, phone string) (bool, error) {
	clean := strings.ReplaceAll(phone, "-", "")
	return s.repo.ExistsPhoneExcept(clean, uid)
}

func (s *MemberWriteService) CheckEmailDup(uid int, email string) (bool, error) {
	return s.repo.ExistsEmailExcept(email, uid)
}

// UpdateContact은 Python crud_auth.update_user_contact를 이식한다(get_user_by_idx None→false).
// mt_hp는 하이픈 제거 후 저장, mt_email 그대로, mt_udate 갱신.
func (s *MemberWriteService) UpdateContact(uid int, hp, email string) bool {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil || u == nil {
		return false
	}
	clean := strings.ReplaceAll(hp, "-", "")
	fields := map[string]interface{}{
		"mt_hp":    clean,
		"mt_email": email,
		"mt_udate": dbUTCNow(),
	}
	return s.repo.UpdateColumns(uid, fields) == nil
}

// ===========================================================================
// 동의/탈퇴 (consent/consent-all/withdraw).
// ===========================================================================

// Consent는 Python crud_member.update_consent를 이식한다(get(필터없음) None→false, setattr+udate).
// field는 핸들러에서 mt_agree1~5로 화이트리스트 검증됨, value는 "Y"/"N".
func (s *MemberWriteService) Consent(uid int, field, value string) (bool, error) {
	u, err := s.repo.GetByID(uid)
	if err != nil {
		return false, err
	}
	if u == nil {
		return false, nil
	}
	fields := map[string]interface{}{field: value, "mt_udate": dbUTCNow()}
	if err := s.repo.UpdateColumns(uid, fields); err != nil {
		return false, err
	}
	return true, nil
}

// ConsentAll은 Python crud_member.update_all_consent를 이식한다(get None→false, 5필드+udate).
func (s *MemberWriteService) ConsentAll(uid int, a1, a2, a3, a4, a5 string) (bool, error) {
	u, err := s.repo.GetByID(uid)
	if err != nil {
		return false, err
	}
	if u == nil {
		return false, nil
	}
	fields := map[string]interface{}{
		"mt_agree1": a1, "mt_agree2": a2, "mt_agree3": a3, "mt_agree4": a4, "mt_agree5": a5,
		"mt_udate": dbUTCNow(),
	}
	if err := s.repo.UpdateColumns(uid, fields); err != nil {
		return false, err
	}
	return true, nil
}

// Withdraw는 Python members.withdraw_member 라우터 로직을 이식한다(get_user_by_idx → 6컬럼 UPDATE).
// 반환: "notfound"(사용자 없음), "already"(mt_level==1, dead), "ok", "error".
func (s *MemberWriteService) Withdraw(uid, retireChk int, retireEtc *string) string {
	u, err := s.repo.GetByIdxActive(uid)
	if err != nil {
		return "error"
	}
	if u == nil {
		return "notfound"
	}
	if derefIntUser(u.MtLevel) == 1 {
		return "already" // get_user_by_idx 필터가 level<2 제외 → dead 분기
	}
	now := dbUTCNow()
	fields := map[string]interface{}{
		"mt_retire_level": derefIntUser(u.MtLevel),
		"mt_level":        1,
		"mt_retire_chk":   retireChk,
		"mt_retire_etc":   nilOrStr(retireEtc),
		"mt_rdate":        now,
		"mt_id_retire":    derefStrOr(u.MtID, ""),
		"mt_udate":        now,
	}
	if err := s.repo.UpdateColumns(uid, fields); err != nil {
		return "error"
	}
	return "ok"
}

func nilOrStr(p *string) interface{} {
	if p == nil {
		return nil
	}
	return *p
}

// ===========================================================================
// CRUD (create/put/delete/location).
// ===========================================================================

// Create는 Python members.create_member(POST /)를 이식한다. MemberCreate(평문 mt_pwd) → MemberResponse.
// users.create_user와 동일 컬럼(CreateUserMember)·동일 응답(toUserResponse). ok=false→500.
func (s *MemberWriteService) Create(in MemberCreateInput) (dto.UserResponse, bool) {
	m := &model.Member{
		MtType: in.MtType, MtLevel: in.MtLevel, MtStatus: in.MtStatus,
		MtID: &in.MtID, MtName: &in.MtName, MtNickname: &in.MtNickname, MtPwd: &in.MtPwd,
		MtHp: in.MtHp, MtEmail: in.MtEmail, MtBirth: in.MtBirth, MtGender: in.MtGender,
		MtShow: in.MtShow, MtAgree1: in.MtAgree1, MtAgree2: in.MtAgree2, MtAgree3: in.MtAgree3,
		MtAgree4: in.MtAgree4, MtAgree5: in.MtAgree5, MtPush1: in.MtPush1, MtOnboarding: in.MtOnboarding,
		MtLat: in.MtLat, MtLong: in.MtLong,
	}
	saved, err := s.repo.CreateUserMember(m)
	if err != nil || saved == nil {
		return dto.UserResponse{}, false
	}
	return toUserResponse(saved)
}

// UpdateMember는 Python members.update_member(PUT /{id})를 이식한다(exclude_unset setattr, mt_udate 미갱신).
// 반환: found, ok. 응답은 MemberPutResponse(dict 수동 구성, mt_wdate/udate=null).
func (s *MemberWriteService) UpdateMember(id int, present map[string]interface{}) (*dto.MemberPutResponse, bool, bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true // 404
	}
	if len(present) > 0 {
		if err := s.repo.UpdateColumns(id, present); err != nil {
			return nil, true, false
		}
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	r := toMemberPut(saved)
	return &r, true, true
}

// toMemberPut은 PUT /{id} 응답을 MemberResponse 필터 규칙으로 구성한다(mt_wdate/udate=null, show=Y, agree=N).
func toMemberPut(m *model.Member) dto.MemberPutResponse {
	return dto.MemberPutResponse{
		MtType:       derefIntOr(m.MtType, 1),
		MtLevel:      derefIntOr(m.MtLevel, 2),
		MtStatus:     derefIntOr(m.MtStatus, 1),
		MtID:         derefOr(m.MtID, ""),
		MtName:       derefOr(m.MtName, ""),
		MtNickname:   derefOr(m.MtNickname, ""),
		MtHp:         derefOr(m.MtHp, ""),
		MtEmail:      derefOr(m.MtEmail, ""),
		MtBirth:      dateISOPtr(m.MtBirth),
		MtGender:     derefIntOr(m.MtGender, 1),
		MtShow:       "Y",
		MtAgree1:     "N",
		MtAgree2:     "N",
		MtAgree3:     "N",
		MtAgree4:     "N",
		MtAgree5:     "N",
		MtPush1:      derefOr(m.MtPush1, "Y"),
		MtLat:        floatOr(m.MtLat, 37.5642),
		MtLong:       floatOr(m.MtLong, 127.0016),
		MtOnboarding: derefOr(m.MtOnboarding, "Y"),
		MtIdx:        m.MtIdx,
		MtFile1:      derefOr(m.MtFile1, ""),
		MtWdate:      nil,
		MtLdate:      pyISOUtcNow(m.MtLdate),
		MtUdate:      nil,
	}
}

// DeleteMember는 Python members.delete_member(DELETE /{id})를 이식한다(소프트 삭제 mt_status=0).
// 반환: found. (Python: mt_status=0만 변경, mt_udate 미갱신.)
func (s *MemberWriteService) DeleteMember(id int) (bool, error) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return false, err
	}
	if cur == nil {
		return false, nil
	}
	if err := s.repo.UpdateColumns(id, map[string]interface{}{"mt_status": 0}); err != nil {
		return true, err
	}
	return true, nil
}

// SetProfileImage는 upload-profile-image의 DB 갱신(mt_file1=fileURL)을 수행한다. found=false→404.
func (s *MemberWriteService) SetProfileImage(uid int, fileURL string) (bool, error) {
	cur, err := s.repo.GetByID(uid)
	if err != nil {
		return false, err
	}
	if cur == nil {
		return false, nil
	}
	if err := s.repo.UpdateColumns(uid, map[string]interface{}{"mt_file1": fileURL}); err != nil {
		return true, err
	}
	return true, nil
}

// ClearProfileImage는 delete-profile-image의 DB 갱신(mt_file1=NULL)을 수행하고 기존 경로를 반환한다.
// found=false→404. oldFile은 핸들러가 디스크 파일을 삭제하는 데 쓴다.
func (s *MemberWriteService) ClearProfileImage(uid int) (found bool, oldFile *string, err error) {
	cur, err := s.repo.GetByID(uid)
	if err != nil {
		return false, nil, err
	}
	if cur == nil {
		return false, nil, nil
	}
	old := cur.MtFile1
	if err := s.repo.UpdateColumns(uid, map[string]interface{}{"mt_file1": nil}); err != nil {
		return true, old, err
	}
	return true, old, nil
}

// UpdateLocation은 Python members.update_member_location(PATCH /{id}/location)을 이식한다.
// Python은 str(lat/lng)로 저장하나 DECIMAL 컬럼이라 값은 동일 — Go는 float64 저장. 응답=ORM(MemberResponse).
func (s *MemberWriteService) UpdateLocation(id int, lat, lng float64) (*dto.UserResponse, bool, bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true // 404
	}
	if err := s.repo.UpdateColumns(id, map[string]interface{}{"mt_lat": lat, "mt_long": lng}); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	r, valid := toUserResponse(saved)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}
