package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// groupRepo는 GroupService가 의존하는 데이터 접근 인터페이스(단위 테스트에서 fake로 대체).
type groupRepo interface {
	GetByID(id int) (*model.Group, error)
	List(skip, limit int, showHidden bool) ([]model.Group, error)
	ListForMember(mtIdx, skip, limit int, showHidden bool) ([]model.Group, error)
	ListHidden() ([]model.Group, error)
	FindByMember(mtIdx int) ([]model.Group, error)
	FindByCode(code string) (*model.Group, error)
	CurrentUserGroupCount(mtIdx int) (int64, error)
	CurrentUserDistinctMemberCount(mtIdx int) (int64, error)
	CurrentUserGroups(mtIdx int) ([]repository.CurrentUserGroupRow, error)
	StatsGroupMembers(groupID int) ([]model.GroupDetail, error)
	StatsMember(memberID int) (*model.Member, error)
	StatsWeeklySchedules(memberID int, start, end time.Time) (int64, error)
	StatsTotalLocations(memberID int) (int64, error)
	StatsWeeklyLocations(memberID int, start, end time.Time) (int64, error)
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

// ListGroupsForMember는 mtIdx가 현재 멤버인 그룹만의 목록이다(GET /groups/ 요청자 한정 — 전체 그룹·초대 코드 덤프 차단).
func (s *GroupService) ListGroupsForMember(mtIdx, skip, limit int, showHidden bool) ([]dto.GroupResponse, error) {
	groups, err := s.repo.ListForMember(mtIdx, skip, limit, showHidden)
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

// CurrentUserGroupSummary는 Python get_current_user_group_summary 로직을 이식한다.
// group_count + distinct_member_count를 계산해 dto로 반환한다(0 폴백은 COUNT가 항상 정수라 자동).
func (s *GroupService) CurrentUserGroupSummary(mtIdx int) (*dto.CurrentUserGroupSummary, error) {
	groupCount, err := s.repo.CurrentUserGroupCount(mtIdx)
	if err != nil {
		return nil, err
	}
	memberCount, err := s.repo.CurrentUserDistinctMemberCount(mtIdx)
	if err != nil {
		return nil, err
	}
	return &dto.CurrentUserGroupSummary{
		GroupCount:   groupCount,
		TotalMembers: memberCount,
	}, nil
}

// strPtrOr는 Python `x or "default"`와 동등하다(nil 또는 빈 문자열이면 default).
func strPtrOr(s *string, def string) string {
	if s == nil || *s == "" {
		return def
	}
	return *s
}

// CurrentUserGroups는 Python get_current_user_groups(groups.py:104) 로직을 이식한다.
// 12키 매핑 + 폴백(sgt_title→"그룹 {id}", sgt_code/memo→"", sgt_show→"Y"),
// datetime 폴백(null이면 utcnow().isoformat()), 마지막에 sgt_title(폴백 적용값) 오름차순 안정정렬.
func (s *GroupService) CurrentUserGroups(mtIdx int) ([]dto.CurrentUserGroupItem, error) {
	rows, err := s.repo.CurrentUserGroups(mtIdx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.CurrentUserGroupItem, 0, len(rows))
	for i := range rows {
		g := rows[i].Group
		d := rows[i].Detail
		out = append(out, dto.CurrentUserGroupItem{
			SgtIdx:      g.SgtIdx,
			MtIdx:       g.MtIdx, // 그룹 소유자: 폴백 없음(DB null → null)
			SgtTitle:    strPtrOr(g.SgtTitle, fmt.Sprintf("그룹 %d", g.SgtIdx)),
			SgtCode:     strPtrOr(g.SgtCode, ""),
			SgtMemo:     strPtrOr(g.SgtMemo, ""),
			SgtShow:     strPtrOr(g.SgtShow, "Y"),
			SgtWdate:    pyISOUtcNow(g.SgtWdate),
			SgtUdate:    pyISOUtcNow(g.SgtUdate),
			MemberCount: rows[i].MemberCount,
			IsOwner:     rows[i].IsOwner || (d.SgdtOwnerChk != nil && *d.SgdtOwnerChk == "Y"), // 그룹장 판정(owner_chk 또는 구 데이터의 생성자)
			IsLeader:    d.SgdtLeaderChk != nil && *d.SgdtLeaderChk == "Y",
			JoinDate:    pyISOUtcNow(d.SgdtWdate),
		})
	}
	// Python result.sort(key=lambda x: x["sgt_title"]) — 폴백 적용된 sgt_title 문자열 오름차순(안정정렬).
	// Go 문자열 비교는 바이트(UTF-8) 단위라 Python 코드포인트 비교와 BMP 범위에서 동일 순서.
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].SgtTitle < out[j].SgtTitle
	})
	return out, nil
}

// GroupStats는 Python get_group_stats(groups.py:587) 로직을 이식한다. 그룹 존재 확인 후 호출.
// group_members 전체 행에서 member_ids를 뽑고(owner/leader chk 집계에도 사용), 멤버별로
// 주간 일정수·전체 위치수(total_locations)·주간 위치수(weekly_locations)를 모아 member_stats를 만든다.
// start/end는 핸들러가 datetime.now() 기준 7일 창으로 주입(시각 의존 → stats_period에 그대로 박힘).
// 멤버 단건 조회 실패(없음)는 Python `if not member: continue`로 건너뛴다(member_count 비포함).
func (s *GroupService) GroupStats(groupID int, groupTitle *string, start, end time.Time) (*dto.GroupStatsResponse, error) {
	groupMembers, err := s.repo.StatsGroupMembers(groupID)
	if err != nil {
		return nil, err
	}

	// member_ids = [gm.mt_idx for gm in group_members]. nil도 그대로 들어가지만 후속 Member 조회 실패→continue.
	memberIDs := make([]*int, 0, len(groupMembers))
	for i := range groupMembers {
		memberIDs = append(memberIDs, groupMembers[i].MtIdx)
	}

	// member_ids가 비면 early return(6키, stats_period 없음). Python과 동일.
	if len(memberIDs) == 0 {
		return &dto.GroupStatsResponse{
			GroupID:         groupID,
			GroupTitle:      groupTitle,
			MemberCount:     0,
			WeeklySchedules: 0,
			TotalLocations:  0,
			MemberStats:     []dto.GroupMemberStat{},
		}, nil
	}

	memberStats := make([]dto.GroupMemberStat, 0, len(memberIDs))
	var totalWeekly int64
	var totalLocations int64

	for _, mid := range memberIDs {
		if mid == nil {
			// Python: Member.mt_idx == None 매칭 실패 → if not member: continue.
			continue
		}
		memberID := *mid
		member, err := s.repo.StatsMember(memberID)
		if err != nil {
			return nil, err
		}
		if member == nil {
			continue
		}

		weekly, err := s.repo.StatsWeeklySchedules(memberID, start, end)
		if err != nil {
			return nil, err
		}
		memberLocations, err := s.repo.StatsTotalLocations(memberID)
		if err != nil {
			return nil, err
		}
		weeklyLocations, err := s.repo.StatsWeeklyLocations(memberID, start, end)
		if err != nil {
			return nil, err
		}

		// is_owner/is_leader = any(gm.sgdt_*_chk=='Y' for gm in group_members if gm.mt_idx==member_id).
		isOwner := false
		isLeader := false
		for i := range groupMembers {
			gm := groupMembers[i]
			if gm.MtIdx != nil && *gm.MtIdx == memberID {
				if gm.SgdtOwnerChk != nil && *gm.SgdtOwnerChk == "Y" {
					isOwner = true
				}
				if gm.SgdtLeaderChk != nil && *gm.SgdtLeaderChk == "Y" {
					isLeader = true
				}
			}
		}

		mtName := strPtrOr(member.MtName, fmt.Sprintf("멤버 %d", memberID))
		// mt_nickname = member.mt_nickname or member.mt_name or f"멤버 {id}".
		mtNickname := strPtrOr(member.MtNickname, strPtrOr(member.MtName, fmt.Sprintf("멤버 %d", memberID)))

		memberStats = append(memberStats, dto.GroupMemberStat{
			MtIdx:           memberID,
			MtName:          mtName,
			MtNickname:      mtNickname,
			WeeklySchedules: weekly,
			TotalLocations:  memberLocations,
			WeeklyLocations: weeklyLocations,
			IsOwner:         isOwner,
			IsLeader:        isLeader,
		})
		totalWeekly += weekly
		totalLocations += memberLocations
	}

	// 7키 결과: member_count=len(member_stats)(조회 실패분 제외), stats_period(now 기준 isoformat).
	return &dto.GroupStatsResponse{
		GroupID:         groupID,
		GroupTitle:      groupTitle,
		MemberCount:     len(memberStats),
		WeeklySchedules: totalWeekly,
		TotalLocations:  totalLocations,
		StatsPeriod: &dto.StatsPeriod{
			StartDate: pyISO(start),
			EndDate:   pyISO(end),
			Days:      7,
		},
		MemberStats: memberStats,
	}, nil
}
