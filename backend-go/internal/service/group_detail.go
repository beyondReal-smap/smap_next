package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// groupDetailRepo는 GroupDetailService가 의존하는 데이터 접근 인터페이스(테스트 대체용).
type groupDetailRepo interface {
	List(skip, limit int) ([]model.GroupDetail, error)
	GetByID(id int) (*model.GroupDetail, error)
	FindByMember(mtIdx int) ([]model.GroupDetail, error)
	FindByGroup(sgtIdx int) ([]model.GroupDetail, error)
}

// GroupDetailService는 Python `app/api/v1/endpoints/group_details.py`의 read 핸들러
// (get_group_details/get_group_detail/get_member_group_details/get_group_member_details)를 이식한다.
type GroupDetailService struct {
	repo groupDetailRepo
}

func NewGroupDetail(repo groupDetailRepo) *GroupDetailService {
	return &GroupDetailService{repo: repo}
}

// pyISOFormat는 naive datetime의 isoformat(초 단위)과 동일하다("2006-01-02T15:04:05").
const pyISOFormat = "2006-01-02T15:04:05"

// (derefOr는 service/admin.go에 정의된 공유 헬퍼를 재사용한다.)

// isoOrEmpty는 datetime을 isoformat 문자열로, nil이면 ""로 반환한다(ddate/xdate/adate 규칙).
func isoOrEmpty(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(pyISOFormat)
}

// isoOrUtcNow는 datetime을 isoformat으로, nil이면 utcnow().isoformat()(마이크로초 포함)으로 반환한다
// (Python wdate/udate 폴백 규칙). 실데이터는 non-null이라 폴백 경로는 사실상 사용되지 않는다.
func isoOrUtcNow(t *time.Time) string {
	if t == nil {
		return time.Now().UTC().Format("2006-01-02T15:04:05.000000")
	}
	return t.Format(pyISOFormat)
}

// toGroupDetailResponse는 GroupDetailResponse(Pydantic 스키마-모델 불일치 포함)로 변환한다.
// 스키마 필드명이 모델 컬럼과 다른 7개(_chk 등)는 Python from_attributes처럼 nil(null)로 둔다.
func toGroupDetailResponse(gd *model.GroupDetail) dto.GroupDetailResponse {
	return dto.GroupDetailResponse{
		SgtIdx:        gd.SgtIdx,
		MtIdx:         gd.MtIdx,
		SgdtOwnerChk:  gd.SgdtOwnerChk,
		SgdtLeaderChk: gd.SgdtLeaderChk,
		// SgdtDischargeChk: 스키마 필드명(sgdt_discharge_chk) ≠ 모델(sgdt_discharge) → 항상 nil
		SgdtGroupChk: gd.SgdtGroupChk,
		// SgdtExitChk: sgdt_exit_chk ≠ sgdt_exit → 항상 nil
		SgdtPushChk: gd.SgdtPushChk,
		// SgdtInChk/ScheduleChk/ReadChk/EnterAlarm/EnterChk: 모델 미매핑 → 항상 nil
		SgdtIdx:   gd.SgdtIdx,
		SgdtWdate: toPyTimePtr(gd.SgdtWdate),
		SgdtUdate: toPyTimePtr(gd.SgdtUdate),
	}
}

func toGroupDetailResponses(items []model.GroupDetail) []dto.GroupDetailResponse {
	out := make([]dto.GroupDetailResponse, 0, len(items))
	for i := range items {
		out = append(out, toGroupDetailResponse(&items[i]))
	}
	return out
}

// toMemberItem은 get_member_group_details의 수동 dict로 변환한다(null→'N'/'Y' 폴백 포함).
func toMemberItem(gd *model.GroupDetail) dto.GroupDetailMemberItem {
	return dto.GroupDetailMemberItem{
		SgdtIdx:       gd.SgdtIdx,
		SgtIdx:        gd.SgtIdx,
		MtIdx:         gd.MtIdx,
		SgdtOwnerChk:  derefOr(gd.SgdtOwnerChk, "N"),
		SgdtLeaderChk: derefOr(gd.SgdtLeaderChk, "N"),
		SgdtDischarge: derefOr(gd.SgdtDischarge, "N"),
		SgdtGroupChk:  derefOr(gd.SgdtGroupChk, "Y"),
		SgdtExit:      derefOr(gd.SgdtExit, "N"),
		SgdtShow:      derefOr(gd.SgdtShow, "Y"),
		SgdtPushChk:   derefOr(gd.SgdtPushChk, "Y"),
		SgdtWdate:     isoOrUtcNow(gd.SgdtWdate),
		SgdtUdate:     isoOrUtcNow(gd.SgdtUdate),
		SgdtDdate:     isoOrEmpty(gd.SgdtDdate),
		SgdtXdate:     isoOrEmpty(gd.SgdtXdate),
		SgdtAdate:     isoOrEmpty(gd.SgdtAdate),
	}
}

// ListGroupDetails는 필터 없는 목록.
func (s *GroupDetailService) ListGroupDetails(skip, limit int) ([]dto.GroupDetailResponse, error) {
	items, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, err
	}
	return toGroupDetailResponses(items), nil
}

// GetGroupDetail은 단건 조회. 없으면 (nil, nil)로 404 신호.
func (s *GroupDetailService) GetGroupDetail(id int) (*dto.GroupDetailResponse, error) {
	gd, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if gd == nil {
		return nil, nil
	}
	r := toGroupDetailResponse(gd)
	return &r, nil
}

// MemberGroupDetails는 멤버의 그룹 상세 목록(수동 dict).
func (s *GroupDetailService) MemberGroupDetails(mtIdx int) ([]dto.GroupDetailMemberItem, error) {
	items, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.GroupDetailMemberItem, 0, len(items))
	for i := range items {
		out = append(out, toMemberItem(&items[i]))
	}
	return out, nil
}

// GroupMemberDetails는 그룹의 멤버 상세 목록(GroupDetailResponse).
func (s *GroupDetailService) GroupMemberDetails(sgtIdx int) ([]dto.GroupDetailResponse, error) {
	items, err := s.repo.FindByGroup(sgtIdx)
	if err != nil {
		return nil, err
	}
	return toGroupDetailResponses(items), nil
}
