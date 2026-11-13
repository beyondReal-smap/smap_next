package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// memberReadRepo는 MemberService(read)가 의존하는 데이터 접근 인터페이스.
type memberReadRepo interface {
	List(skip, limit int) ([]model.Member, error)
	GetByID(mtIdx int) (*model.Member, error)
	GetByIdxActive(idx int) (*model.Member, error)
	FindByGroup(groupID int) ([]model.MemberGroupRow, error)
	ExistsByPhone(phone string) (bool, error)
	ExistsByEmail(email string) (bool, error)
	ExistsByNickname(nickname string) (bool, error)
}

// MemberService는 Python `app/api/v1/endpoints/members.py`의 read 핸들러를 이식한다.
type MemberService struct {
	repo memberReadRepo
}

func NewMember(repo memberReadRepo) *MemberService {
	return &MemberService{repo: repo}
}

// --- 직렬화 헬퍼 (Python 동작 모방) ---

// pyISO는 Python datetime.isoformat()과 동일하다: 마이크로초가 0이면 초까지만,
// 아니면 ".%06d"(6자리). member_t는 mt_ldate 등에 마이크로초가 존재할 수 있다.
func pyISO(t time.Time) string {
	if t.Nanosecond() == 0 {
		return t.Format(pyISOFormat)
	}
	return t.Format("2006-01-02T15:04:05.000000")
}

// pyISOPtr는 datetime → isoformat 문자열, nil이면 nil(→ JSON null). (safe_date)
func pyISOPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := pyISO(*t)
	return &s
}

// dateISOPtr는 date(시간 없음) → "YYYY-MM-DD", nil이면 nil. (mt_birth)
func dateISOPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

// pyISOEmpty는 datetime → isoformat, nil이면 ""(빈 문자열). (mt_plan_date 등)
func pyISOEmpty(t *time.Time) string {
	if t == nil {
		return ""
	}
	return pyISO(*t)
}

// pyISOUtcNow는 datetime → isoformat, nil이면 utcnow().isoformat()(비결정적, 실데이터 미발생).
func pyISOUtcNow(t *time.Time) string {
	if t == nil {
		return pyISO(time.Now().UTC())
	}
	return pyISO(*t)
}

// derefIntOr는 Python `x or default`(nil 또는 0이면 default).
func derefIntOr(i *int, def int) int {
	if i == nil || *i == 0 {
		return def
	}
	return *i
}

// floatOr는 Python `float(x) if x else default`(nil 또는 0이면 default).
func floatOr(f *float64, def float64) float64 {
	if f == nil || *f == 0 {
		return def
	}
	return *f
}

// floatPtrOrNil은 Python `float(x) if x else None`(nil 또는 0이면 nil→null).
func floatPtrOrNil(f *float64) *float64 {
	if f == nil || *f == 0 {
		return nil
	}
	return f
}

// --- 변환 ---

func toMemberListItem(m *model.Member) dto.MemberListItem {
	return dto.MemberListItem{
		MtIdx:      m.MtIdx,
		MtType:     derefIntOr(m.MtType, 1),
		MtLevel:    derefIntOr(m.MtLevel, 2),
		MtStatus:   derefIntOr(m.MtStatus, 1),
		MtID:       derefOr(m.MtID, ""),
		MtName:     derefOr(m.MtName, ""),
		MtNickname: derefOr(m.MtNickname, ""),
		MtHp:       derefOr(m.MtHp, ""),
		MtEmail:    derefOr(m.MtEmail, ""),
		MtBirth:    dateISOPtr(m.MtBirth),
		MtGender:   derefIntOr(m.MtGender, 1),
		MtFile1:    derefOr(m.MtFile1, ""),
		MtShow:     derefOr(m.MtShow, "Y"),
		MtAgree1:   derefOr(m.MtAgree1, "N"),
		MtAgree2:   derefOr(m.MtAgree2, "N"),
		MtAgree3:   derefOr(m.MtAgree3, "N"),
		MtAgree4:   derefOr(m.MtAgree4, "N"),
		MtAgree5:   derefOr(m.MtAgree5, "N"),
		MtLat:      floatPtrOrNil(m.MtLat),
		MtLong:     floatPtrOrNil(m.MtLong),
		MtWdate:    pyISOPtr(m.MtWdate),
		MtLdate:    pyISOPtr(m.MtLdate),
		MtUdate:    pyISOPtr(m.MtUdate),
	}
}

// toMemberDetail은 /members/{id}의 MemberResponse 필터링 결과를 재현한다.
// 핸들러 dict에 없는 mt_show/agree1~5/mt_udate는 MemberResponse 기본값(Y/N/null).
func toMemberDetail(m *model.Member) dto.MemberDetailResponse {
	return dto.MemberDetailResponse{
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
		MtWdate:      pyISOUtcNow(m.MtWdate),
		MtLdate:      pyISOUtcNow(m.MtLdate),
		MtUdate:      nil,
	}
}

func toMemberGroupItem(r *model.MemberGroupRow) dto.MemberGroupItem {
	return dto.MemberGroupItem{
		MtIdx:         r.MtIdx,
		MtType:        derefIntOr(r.MtType, 1),
		MtLevel:       derefIntOr(r.MtLevel, 2),
		MtStatus:      derefIntOr(r.MtStatus, 1),
		MtID:          derefOr(r.MtID, ""),
		MtName:        derefOr(r.MtName, ""),
		MtNickname:    derefOr(r.MtNickname, ""),
		MtHp:          derefOr(r.MtHp, ""),
		MtEmail:       derefOr(r.MtEmail, ""),
		MtBirth:       dateISOPtr(r.MtBirth),
		MtGender:      derefIntOr(r.MtGender, 1),
		MtFile1:       derefOr(r.MtFile1, ""),
		MtLat:         floatOr(r.MtLat, 37.5642),
		MtLong:        floatOr(r.MtLong, 127.0016),
		MtSido:        derefOr(r.MtSido, ""),
		MtGu:          derefOr(r.MtGu, ""),
		MtDong:        derefOr(r.MtDong, ""),
		MtOnboarding:  derefOr(r.MtOnboarding, "Y"),
		MtPush1:       derefOr(r.MtPush1, "Y"),
		MtPlanCheck:   derefOr(r.MtPlanCheck, "N"),
		MtPlanDate:    pyISOEmpty(r.MtPlanDate),
		MtWeatherPop:  derefOr(r.MtWeatherPop, ""),
		MtWeatherSky:  derefIntOr(r.MtWeatherSky, 8),
		MtWeatherTmn:  derefIntOr(r.MtWeatherTmn, 18),
		MtWeatherTmx:  derefIntOr(r.MtWeatherTmx, 25),
		MtWeatherDate: pyISOUtcNow(r.MtWeatherDate),
		MtLdate:       pyISOUtcNow(r.MtLdate),
		MtAdate:       pyISOUtcNow(r.MtAdate),
		SgdtIdx:       r.SgdtIdx,
		SgtIdx:        r.SgtIdx,
		SgdtOwnerChk:  derefOr(r.SgdtOwnerChk, "N"),
		SgdtLeaderChk: derefOr(r.SgdtLeaderChk, "N"),
		SgdtDischarge: derefOr(r.SgdtDischarge, "N"),
		SgdtGroupChk:  derefOr(r.SgdtGroupChk, "Y"),
		SgdtExit:      derefOr(r.SgdtExit, "N"),
		SgdtShow:      derefOr(r.SgdtShow, "Y"),
		SgdtPushChk:   derefOr(r.SgdtPushChk, "Y"),
		SgdtWdate:     pyISOUtcNow(r.SgdtWdate),
		SgdtUdate:     pyISOUtcNow(r.SgdtUdate),
		SgdtDdate:     pyISOEmpty(r.SgdtDdate),
		SgdtXdate:     pyISOEmpty(r.SgdtXdate),
		SgdtAdate:     pyISOEmpty(r.SgdtAdate),
	}
}

// --- 서비스 메서드 ---

// ListMembers는 전체 목록(List[_member_to_dict]).
func (s *MemberService) ListMembers(skip, limit int) ([]dto.MemberListItem, error) {
	members, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, err
	}
	out := make([]dto.MemberListItem, 0, len(members))
	for i := range members {
		out = append(out, toMemberListItem(&members[i]))
	}
	return out, nil
}

// MemberForList는 ?id= 단건 필터 결과(없으면 빈 목록, 있으면 1건 목록).
func (s *MemberService) MemberForList(id int) ([]dto.MemberListItem, error) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return []dto.MemberListItem{}, nil
	}
	return []dto.MemberListItem{toMemberListItem(m)}, nil
}

// GetMemberDetail은 /members/{id}(MemberResponse). 없으면 (nil, nil)로 404 신호.
func (s *MemberService) GetMemberDetail(id int) (*dto.MemberDetailResponse, error) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, nil
	}
	r := toMemberDetail(m)
	return &r, nil
}

// GroupMembers는 /members/group/{id}(Member+GroupDetail 수동 dict 목록).
func (s *MemberService) GroupMembers(groupID int) ([]dto.MemberGroupItem, error) {
	rows, err := s.repo.FindByGroup(groupID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.MemberGroupItem, 0, len(rows))
	for i := range rows {
		out = append(out, toMemberGroupItem(&rows[i]))
	}
	return out, nil
}

// CheckPhone은 전화번호 가용 여부 + 메시지. available = 미존재.
func (s *MemberService) CheckPhone(phone string) (dto.MemberCheckResponse, error) {
	exists, err := s.repo.ExistsByPhone(phone)
	if err != nil {
		return dto.MemberCheckResponse{}, err
	}
	if exists {
		return dto.MemberCheckResponse{Available: false, Message: "이미 가입된 전화번호입니다."}, nil
	}
	return dto.MemberCheckResponse{Available: true, Message: "사용 가능한 전화번호입니다."}, nil
}

// CheckEmail은 이메일 가용 여부 + 메시지.
func (s *MemberService) CheckEmail(email string) (dto.MemberCheckResponse, error) {
	exists, err := s.repo.ExistsByEmail(email)
	if err != nil {
		return dto.MemberCheckResponse{}, err
	}
	if exists {
		return dto.MemberCheckResponse{Available: false, Message: "이미 가입된 이메일입니다."}, nil
	}
	return dto.MemberCheckResponse{Available: true, Message: "사용 가능한 이메일입니다."}, nil
}

// CheckNickname은 닉네임 가용 여부 + 메시지.
func (s *MemberService) CheckNickname(nickname string) (dto.MemberCheckResponse, error) {
	exists, err := s.repo.ExistsByNickname(nickname)
	if err != nil {
		return dto.MemberCheckResponse{}, err
	}
	if exists {
		return dto.MemberCheckResponse{Available: false, Message: "이미 사용 중인 닉네임입니다."}, nil
	}
	return dto.MemberCheckResponse{Available: true, Message: "사용 가능한 닉네임입니다."}, nil
}

// pyDateStrPtr는 nullable DATE(*time.Time)을 Python strftime('%Y-%m-%d') 문자열로 변환.
// nil이면 nil(→ JSON null). isoformat()이 아니라 date 포맷 전용(members/me의 mt_birth용).
// (dateISOPtr와 동일 포맷이나 mt_birth 의미를 명확히 하기 위해 별칭으로 둔다.)
func pyDateStrPtr(t *time.Time) *string {
	return dateISOPtr(t)
}

// MyProfile은 GET /members/me 로직을 이식한다(Python get_user_profile).
// 활성 필터(get_user_by_idx)로 조회 후 data dict(12키)로 매핑한다.
// found=false면 핸들러가 "사용자를 찾을 수 없습니다." 흡수 응답을 낸다.
// mt_birth: strftime('%Y-%m-%d'), mt_wdate: isoformat() — 둘 다 *string(null 가능), 폴백 없음.
func (s *MemberService) MyProfile(idx int) (*dto.ProfileMeData, bool, error) {
	m, err := s.repo.GetByIdxActive(idx)
	if err != nil {
		return nil, false, err
	}
	if m == nil {
		return nil, false, nil
	}
	data := dto.ProfileMeData{
		MtIdx:      m.MtIdx,
		MtID:       m.MtID,
		MtName:     m.MtName,
		MtNickname: m.MtNickname,
		MtHp:       m.MtHp,
		MtEmail:    m.MtEmail,
		MtBirth:    pyDateStrPtr(m.MtBirth),
		MtGender:   m.MtGender,
		MtType:     m.MtType,
		MtLevel:    m.MtLevel,
		MtFile1:    m.MtFile1,
		MtWdate:    pyISOPtr(m.MtWdate),
	}
	return &data, true, nil
}

// ConsentInfo는 GET /members/consent/{member_id} 로직을 이식한다(Python get_consent_info).
// crud_member.get_consent_info는 member_t를 mt_idx로 조회(필터 없음)해 mt_agree1~5 반환.
// ConsentInfo(YNEnum)는 값이 nil이거나 "Y"/"N"이 아니면 ValidationError → 500.
// 반환: found=false면 404, valid=false면 500(YNEnum 검증 실패 모사), 정상이면 info.
func (s *MemberService) ConsentInfo(idx int) (info *dto.ConsentInfo, found bool, valid bool, err error) {
	m, err := s.repo.GetByID(idx)
	if err != nil {
		return nil, false, false, err
	}
	if m == nil {
		return nil, false, false, nil
	}
	agrees := []*string{m.MtAgree1, m.MtAgree2, m.MtAgree3, m.MtAgree4, m.MtAgree5}
	for _, a := range agrees {
		if a == nil || (*a != "Y" && *a != "N") {
			// Pydantic YNEnum 검증 실패 → ConsentResponse 생성 단계에서 예외 → 500.
			return nil, true, false, nil
		}
	}
	return &dto.ConsentInfo{
		MtAgree1: *m.MtAgree1,
		MtAgree2: *m.MtAgree2,
		MtAgree3: *m.MtAgree3,
		MtAgree4: *m.MtAgree4,
		MtAgree5: *m.MtAgree5,
	}, true, true, nil
}
