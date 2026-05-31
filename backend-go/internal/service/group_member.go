package service

import (
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// groupMemberRepo는 GroupMemberService가 의존하는 데이터 접근 인터페이스.
type groupMemberRepo interface {
	FindGroupMembers(groupID int) ([]model.GroupMemberRow, error)
}

// GroupMemberService는 Python `app/api/v1/endpoints/group_members.py`의 read 핸들러를 이식한다.
type GroupMemberService struct {
	repo groupMemberRepo
}

func NewGroupMember(repo groupMemberRepo) *GroupMemberService {
	return &GroupMemberService{repo: repo}
}

// intPtrOrNil은 Python `int(x) if x else None`(nil 또는 0이면 nil).
func intPtrOrNil(i *int) *int {
	if i == nil || *i == 0 {
		return nil
	}
	return i
}

// pyStrDatetimePtr은 Python str(datetime)(공백 구분, 마이크로초 0이면 생략)을 재현한다.
func pyStrDatetimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	var s string
	if t.Nanosecond() == 0 {
		s = t.Format("2006-01-02 15:04:05")
	} else {
		s = t.Format("2006-01-02 15:04:05.000000")
	}
	return &s
}

func toGroupMemberItem(r *model.GroupMemberRow) dto.GroupMemberItem {
	return dto.GroupMemberItem{
		SgdtIdx:       r.SgdtIdx,
		SgtIdx:        r.SgtIdx,
		MtIdx:         r.MtIdx,
		SgdtOwnerChk:  r.SgdtOwnerChk,
		SgdtLeaderChk: r.SgdtLeaderChk,
		MtName:        r.MtName,
		MtNickname:    r.MtNickname,
		MtBirth:       dateISOPtr(r.MtBirth), // str(date) == "YYYY-MM-DD"
		MtFile1:       r.MtFile1,
		MtGender:      r.MtGender,
		MtStatus:      r.MtStatus,
		MtWeatherPop:  r.MtWeatherPop,
		MtWeatherTmn:  r.MtWeatherTmn,
		MtWeatherTmx:  r.MtWeatherTmx,
		MtWeatherSky:  r.MtWeatherSky,
		MtWeatherDate: pyISOPtr(r.MtWeatherDate), // jsonable_encoder isoformat(T)
		MltLat:        floatPtrOrNil(r.MltLat),   // float(x) if x else None (DECIMAL → 정확)
		MltLong:       floatPtrOrNil(r.MltLong),
		MltSpeed:      floatToPyFloatPtrOrNil(r.MltSpeed), // FLOAT(32비트), 텍스트 프로토콜→PyFloat
		MltBattery:    intPtrOrNil(r.MltBattery),          // int(x) if x else None
		MltGpsTime:    pyStrDatetimePtr(r.MltGpsTime),
		ID:            strconv.Itoa(r.MtIdx),
		Name:          r.MtName,
		Photo:         r.MtFile1,
		IsSelected:    false,
	}
}

// GroupMembers는 그룹 멤버 목록(기본정보+최신위치). repo 에러는 전파(핸들러가 500).
func (s *GroupMemberService) GroupMembers(groupID int) ([]dto.GroupMemberItem, error) {
	rows, err := s.repo.FindGroupMembers(groupID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.GroupMemberItem, 0, len(rows))
	for i := range rows {
		out = append(out, toGroupMemberItem(&rows[i]))
	}
	return out, nil
}
