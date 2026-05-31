package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// groupRepo는 GroupService가 의존하는 데이터 접근 인터페이스(단위 테스트에서 fake로 대체).
type groupRepo interface {
	GetByID(id int) (*model.Group, error)
	List(skip, limit int, showHidden bool) ([]model.Group, error)
	ListHidden() ([]model.Group, error)
	FindByMember(mtIdx int) ([]model.Group, error)
	FindByCode(code string) (*model.Group, error)
}

// GroupService는 Python `app/api/v1/endpoints/groups.py`의 read-only 핸들러
// (get_group/get_groups/get_member_groups/get_group_by_code) 로직을 이식한다.
type GroupService struct {
	repo groupRepo
}

func NewGroup(repo groupRepo) *GroupService {
	return &GroupService{repo: repo}
}

// toPyTimePtr는 nullable datetime(*time.Time)을 Python naive datetime 직렬화 포맷으로
// 변환한다. nil이면 nil(→ JSON null).
func toPyTimePtr(t *time.Time) *dto.PyTime {
	if t == nil {
		return nil
	}
	p := dto.PyTime(*t)
	return &p
}

func toGroupResponse(g *model.Group) dto.GroupResponse {
	return dto.GroupResponse{
		MtIdx:    g.MtIdx,
		SgtTitle: g.SgtTitle,
		SgtCode:  g.SgtCode,
		SgtMemo:  g.SgtMemo,
		SgtShow:  g.SgtShow,
		SgtIdx:   g.SgtIdx,
		SgtWdate: toPyTimePtr(g.SgtWdate),
		SgtUdate: toPyTimePtr(g.SgtUdate),
	}
}

func toGroupResponses(groups []model.Group) []dto.GroupResponse {
	out := make([]dto.GroupResponse, 0, len(groups))
	for i := range groups {
		out = append(out, toGroupResponse(&groups[i]))
	}
	return out
}

// GetGroup은 단건 조회(sgt_show 무관). 없으면 (nil, nil)로 404 신호.
func (s *GroupService) GetGroup(id int) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	r := toGroupResponse(g)
	return &r, nil
}

// ListGroups는 목록(List[GroupResponse]). showHidden=false면 sgt_show='Y'만.
func (s *GroupService) ListGroups(skip, limit int, showHidden bool) ([]dto.GroupResponse, error) {
	groups, err := s.repo.List(skip, limit, showHidden)
	if err != nil {
		return nil, err
	}
	return toGroupResponses(groups), nil
}

// HiddenGroups는 숨김 그룹 목록(List[GroupResponse]).
func (s *GroupService) HiddenGroups() ([]dto.GroupResponse, error) {
	groups, err := s.repo.ListHidden()
	if err != nil {
		return nil, err
	}
	return toGroupResponses(groups), nil
}

// MemberGroups는 멤버가 속한 그룹 목록(List[GroupResponse]).
func (s *GroupService) MemberGroups(mtIdx int) ([]dto.GroupResponse, error) {
	groups, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, err
	}
	return toGroupResponses(groups), nil
}

// GroupShow는 /groups/{id}/public용: 그룹 존재 여부와 sgt_show='Y' 여부를 반환한다.
// (Python public 핸들러: 없으면 404 "그룹을 찾을 수 없습니다.", sgt_show!='Y'면 404
// "존재하지 않는 그룹입니다.", 그 외엔 sgt_content 미매핑 AttributeError로 500.)
func (s *GroupService) GroupShow(id int) (found bool, shown bool, err error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return false, false, err
	}
	if g == nil {
		return false, false, nil
	}
	return true, g.SgtShow != nil && *g.SgtShow == "Y", nil
}

// GroupByCode는 코드로 단건 조회. 없으면 (nil, nil)로 404 신호.
func (s *GroupService) GroupByCode(code string) (*dto.GroupResponse, error) {
	g, err := s.repo.FindByCode(code)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	r := toGroupResponse(g)
	return &r, nil
}
