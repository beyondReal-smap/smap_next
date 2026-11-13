package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// MemberCreateInput은 MemberCreate(검증·정규화 완료)를 담는다. mt_id는 하이픈 제거된 값, mt_pwd는 raw.
type MemberCreateInput struct {
	MtType, MtLevel, MtStatus           *int
	MtID, MtName, MtNickname, MtPwd     string // 필수
	MtHp, MtEmail                       *string
	MtBirth                             *time.Time
	MtGender                            *int
	MtShow, MtAgree1, MtAgree2, MtAgree3, MtAgree4, MtAgree5, MtPush1, MtOnboarding *string
	MtLat, MtLong                       *float64
}

// CreateUser는 Python users.create_user를 이식한다(Member(**MemberCreate.dict()) + commit + refresh).
// mt_pwd는 평문 저장(Python 충실 — bcrypt 아님), mt_wdate/ldate/udate는 미설정(NULL). ok=false→500.
func (s *UserService) CreateUser(in MemberCreateInput) (dto.UserResponse, bool) {
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

// UpdateUser는 Python users.update_user를 이식한다(exclude_unset setattr + commit + refresh). found=false→404.
func (s *UserService) UpdateUser(id int, present map[string]interface{}) (resp *dto.UserResponse, found, ok bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true
	}
	if err := s.repo.UpdateColumns(id, present); err != nil {
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

// DeleteUser는 Python users.delete_user를 이식한다(하드 삭제 후 삭제된 회원을 MemberResponse로 반환). found=false→404.
func (s *UserService) DeleteUser(id int) (resp *dto.UserResponse, found, ok bool) {
	cur, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if cur == nil {
		return nil, false, true
	}
	r, valid := toUserResponse(cur) // 삭제 전 스냅샷(Python은 db.delete 후 동일 객체 반환)
	if !valid {
		return nil, true, false
	}
	if err := s.repo.Delete(id); err != nil {
		return nil, true, false
	}
	return &r, true, true
}
