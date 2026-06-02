package service

import (
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// userRepo는 UserService가 의존하는 데이터 접근 인터페이스.
type userRepo interface {
	List(skip, limit int) ([]model.Member, error)
	GetByID(mtIdx int) (*model.Member, error)
	GetByEmail(email string) (*model.Member, error)
	GetByToken(token string) (*model.Member, error)
	RecentSignin(hoursAgo int) ([]model.Member, error)
	NotJoinedCount() (int64, error)
	GetByMtID(mtID string) (*model.Member, error)
	CreateUserMember(m *model.Member) (*model.Member, error)
	UpdateColumns(mtIdx int, fields map[string]interface{}) error
	Delete(mtIdx int) error
}

// UserService는 Python `app/api/v1/endpoints/users.py`의 read 핸들러를 이식한다.
type UserService struct {
	repo userRepo
}

func NewUser(repo userRepo) *UserService {
	return &UserService{repo: repo}
}

// toUserResponse는 ORM→MemberResponse 직렬화. mt_id/name/nickname이 nil이면 Python에서
// ResponseValidationError(500)이므로 (zero, false)를 반환한다.
func toUserResponse(m *model.Member) (dto.UserResponse, bool) {
	if m.MtID == nil || m.MtName == nil || m.MtNickname == nil {
		return dto.UserResponse{}, false
	}
	return dto.UserResponse{
		MtType:       m.MtType,
		MtLevel:      m.MtLevel,
		MtStatus:     m.MtStatus,
		MtID:         *m.MtID,
		MtName:       *m.MtName,
		MtNickname:   *m.MtNickname,
		MtHp:         m.MtHp,
		MtEmail:      m.MtEmail,
		MtBirth:      dateISOPtr(m.MtBirth),
		MtGender:     m.MtGender,
		MtShow:       m.MtShow,
		MtAgree1:     m.MtAgree1,
		MtAgree2:     m.MtAgree2,
		MtAgree3:     m.MtAgree3,
		MtAgree4:     m.MtAgree4,
		MtAgree5:     m.MtAgree5,
		MtPush1:      m.MtPush1,
		MtLat:        m.MtLat,
		MtLong:       m.MtLong,
		MtOnboarding: m.MtOnboarding,
		MtIdx:        m.MtIdx,
		MtFile1:      m.MtFile1,
		MtWdate:      pyISOPtr(m.MtWdate),
		MtLdate:      pyISOPtr(m.MtLdate),
		MtUdate:      pyISOPtr(m.MtUdate),
	}, true
}

// toUserFullDump은 ORM 전체 컬럼 덤프(jsonable_encoder 동등). 날짜는 isoformat, 나머지 raw.
func toUserFullDump(m *model.Member) dto.UserFullDump {
	return dto.UserFullDump{
		MtID:               m.MtID,
		MtNickname:         m.MtNickname,
		MtAgree1:           m.MtAgree1,
		MtGu:               m.MtGu,
		MtWdate:            pyISOPtr(m.MtWdate),
		MtUdate:            pyISOPtr(m.MtUdate),
		MtTokenExpiry:      pyISOPtr(m.MtTokenExpiry),
		MtType:             m.MtType,
		MtRecommendChk:     m.MtRecommendChk,
		MtIDRetire:         m.MtIDRetire,
		MtHp:               m.MtHp,
		MtAgree2:           m.MtAgree2,
		MtDong:             m.MtDong,
		MtLdate:            pyISOPtr(m.MtLdate),
		MtUpdateDt:         pyISOPtr(m.MtUpdateDt),
		MtGoogleID:         m.MtGoogleID,
		MtLastReceiptToken: m.MtLastReceiptToken,
		MtPwd:              m.MtPwd,
		MtEmail:            m.MtEmail,
		MtAgree3:           m.MtAgree3,
		MtOnboarding:       m.MtOnboarding,
		MtLgdate:           pyISOPtr(m.MtLgdate),
		MtResetToken:       m.MtResetToken,
		MtKakaoID:          m.MtKakaoID,
		MtPlanDate:         pyISOPtr(m.MtPlanDate),
		MtPwdCnt:           m.MtPwdCnt,
		MtBirth:            dateISOPtr(m.MtBirth),
		MtAgree4:           m.MtAgree4,
		MtWeatherPop:       m.MtWeatherPop,
		MtRetireChk:        m.MtRetireChk,
		MtTokenEdate:       pyISOPtr(m.MtTokenEdate),
		MtAppleID:          m.MtAppleID,
		MtPlanCheck:        m.MtPlanCheck,
		MtTokenID:          m.MtTokenID,
		MtGender:           m.MtGender,
		MtAgree5:           m.MtAgree5,
		MtWeatherSky:       m.MtWeatherSky,
		MtRetireEtc:        m.MtRetireEtc,
		MtLang:             m.MtLang,
		MtDeviceID:         m.MtDeviceID,
		MtOsCheck:          m.MtOsCheck,
		MtTokenUpdatedAt:   pyISOPtr(m.MtTokenUpdatedAt),
		MtFile1:            m.MtFile1,
		MtPush1:            m.MtPush1,
		MtWeatherTmn:       m.MtWeatherTmn,
		MtRetireLevel:      m.MtRetireLevel,
		MtMap:              m.MtMap,
		MtDeviceModel:      m.MtDeviceModel,
		MtRecDate:          pyISOPtr(m.MtRecDate),
		MtTokenExpiryDate:  pyISOPtr(m.MtTokenExpiryDate),
		MtShow:             m.MtShow,
		MtLat:              m.MtLat,
		MtWeatherTmx:       m.MtWeatherTmx,
		MtRdate:            pyISOPtr(m.MtRdate),
		MtRememberToken:    m.MtRememberToken,
		MtOsVersion:        m.MtOsVersion,
		MtName:             m.MtName,
		MtLevel:            m.MtLevel,
		MtIdx:              m.MtIdx,
		MtStatus:           m.MtStatus,
		MtLong:             m.MtLong,
		MtSido:             m.MtSido,
		MtWeatherDate:      pyISOPtr(m.MtWeatherDate),
		MtAdate:            pyISOPtr(m.MtAdate),
		MtAppVersion:       m.MtAppVersion,
	}
}

// ListUsers는 GET /users/. ok=false면 500(레포 에러 또는 필수필드 null로 ResponseValidationError).
func (s *UserService) ListUsers(skip, limit int) ([]dto.UserResponse, bool) {
	members, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, false
	}
	out := make([]dto.UserResponse, 0, len(members))
	for i := range members {
		u, valid := toUserResponse(&members[i])
		if !valid {
			return nil, false
		}
		out = append(out, u)
	}
	return out, true
}

// GetUser는 GET /users/{id}. ok=false→500, found=false→404, 그 외 200.
func (s *UserService) GetUser(id int) (resp *dto.UserResponse, found bool, ok bool) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if m == nil {
		return nil, false, true
	}
	u, valid := toUserResponse(m)
	if !valid {
		return nil, true, false
	}
	return &u, true, true
}

// GetUserByEmail은 GET /users/email/{email}(full dump). 없으면 found=false(404), 에러는 전파.
func (s *UserService) GetUserByEmail(email string) (*dto.UserFullDump, bool, error) {
	m, err := s.repo.GetByEmail(email)
	if err != nil {
		return nil, false, err
	}
	if m == nil {
		return nil, false, nil
	}
	d := toUserFullDump(m)
	return &d, true, nil
}

// GetUserByToken은 GET /users/token/{token}(full dump).
func (s *UserService) GetUserByToken(token string) (*dto.UserFullDump, bool, error) {
	m, err := s.repo.GetByToken(token)
	if err != nil {
		return nil, false, err
	}
	if m == nil {
		return nil, false, nil
	}
	d := toUserFullDump(m)
	return &d, true, nil
}

// RecentSignin은 GET /users/recent/signin/{3h,24h} → {"users":[full dump,...]}.
func (s *UserService) RecentSignin(hoursAgo int) ([]dto.UserFullDump, error) {
	members, err := s.repo.RecentSignin(hoursAgo)
	if err != nil {
		return nil, err
	}
	out := make([]dto.UserFullDump, 0, len(members))
	for i := range members {
		out = append(out, toUserFullDump(&members[i]))
	}
	return out, nil
}

// NotJoinedCount는 GET /users/not-joined/11days의 매칭 행 수. 핸들러가 0→{"users":[]},
// >0→500(jsonable_encoder가 raw Row 직렬화 실패)으로 동작을 재현한다.
func (s *UserService) NotJoinedCount() (int64, error) {
	return s.repo.NotJoinedCount()
}

// UserIdentity는 GET /auth/me 로직을 이식한다(Python read_users_me).
// mt_id(전화/로그인 ID)로 회원을 조회(필터 없음)하고 UserIdentity 4필드로 매핑한다.
// found=false면 핸들러가 401 credentials_exception을 낸다.
// create_user_identity_from_member는 mt_id/mt_name을 그대로 매핑하나, DB상 이 컬럼들은
// 실데이터에서 채워져 있어 본 경로에서는 사실상 non-null — derefStrUser로 안전 변환.
func (s *UserService) UserIdentity(mtID string) (*dto.UserIdentity, bool, error) {
	m, err := s.repo.GetByMtID(mtID)
	if err != nil {
		return nil, false, err
	}
	if m == nil {
		return nil, false, nil
	}
	return &dto.UserIdentity{
		MtIdx:   m.MtIdx,
		MtID:    derefStrUser(m.MtID),
		MtName:  derefStrUser(m.MtName),
		MtLevel: derefIntUser(m.MtLevel),
	}, true, nil
}

// derefStrUser는 *string을 string으로(nil이면 ""). UserIdentity.mt_id/mt_name용.
func derefStrUser(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// derefIntUser는 *int을 int으로(nil이면 0). UserIdentity.mt_level용.
func derefIntUser(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}
