package service

import (
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// LocationCreateInput은 핸들러가 dict body를 파싱·기본값·절단·float변환 후 전달하는 정제 입력.
type LocationCreateInput struct {
	MtIdx         int
	SltTitle      string
	SltAdd        string
	SltLat        float64
	SltLong       float64
	SltShow       string
	SltEnterAlarm string
	SltEnterChk   string
	SltIcon       *string // nil이면 NULL(앱이 이름으로 짐작)
}

// CreateLocation은 Python create_location을 이식한다. slt_wdate=now isoformat(micros), slt_lat/long=입력 float.
func (s *LocationService) CreateLocation(in LocationCreateInput) (*dto.LocationCreateResponse, bool) {
	now := time.Now()
	lat := strconv.FormatFloat(in.SltLat, 'f', -1, 64)
	long := strconv.FormatFloat(in.SltLong, 'f', -1, 64)
	m := &model.Location{
		MtIdx: &in.MtIdx, SltTitle: &in.SltTitle, SltAdd: &in.SltAdd,
		SltLat: &lat, SltLong: &long, SltShow: &in.SltShow,
		SltEnterAlarm: &in.SltEnterAlarm, SltEnterChk: &in.SltEnterChk, SltWdate: &now, SltIcon: in.SltIcon,
	}
	if err := s.repo.Create(m); err != nil {
		return nil, false
	}
	latF := dto.PyFloat(in.SltLat)
	longF := dto.PyFloat(in.SltLong)
	return &dto.LocationCreateResponse{
		Success: true, Message: "Location created successfully", SltIdx: m.SltIdx,
		Data: dto.LocationCreateData{
			SltIdx: m.SltIdx, SltTitle: in.SltTitle, SltAdd: in.SltAdd, SltLat: &latF, SltLong: &longF,
			SltShow: in.SltShow, SltEnterAlarm: in.SltEnterAlarm, SltEnterChk: in.SltEnterChk,
			SltWdate: pyISO(now), SltIcon: in.SltIcon,
		},
	}, true
}

// UpdateNotification은 Python update_location_notification을 이식한다. 일치한 행이 없으면 found=false(→404).
func (s *LocationService) UpdateNotification(id int, alarm string) (resp *dto.LocationNotifResponse, found, ok bool) {
	n, err := s.repo.UpdateFields(id, map[string]interface{}{"slt_enter_alarm": alarm, "slt_udate": time.Now()})
	if err != nil {
		return nil, false, false
	}
	if n == 0 {
		return nil, false, true
	}
	return &dto.LocationNotifResponse{Success: true, Message: "Notification setting updated successfully", SltIdx: id, SltEnterAlarm: alarm}, true, true
}

// UpdateLocation은 Python update_location을 이식한다. fields=DB 갱신 컬럼, keys=updated_fields(body 키 순서).
// 일치한 행이 없으면 found=false → 핸들러가 404.
func (s *LocationService) UpdateLocation(id int, fields map[string]interface{}, keys []string) (resp *dto.LocationUpdateResponse, found, ok bool) {
	fields["slt_udate"] = time.Now() // 항상 추가(Python)
	n, err := s.repo.UpdateFields(id, fields)
	if err != nil {
		return nil, false, false
	}
	if n == 0 {
		return nil, false, true
	}
	return &dto.LocationUpdateResponse{Success: true, Message: "Location updated successfully", UpdatedFields: keys, SltIdx: id}, true, true
}

// DeleteLocation은 Python delete_location을 이식한다(하드삭제, 삭제된 모델을 LocationResponse로 반환). found=false→404.
func (s *LocationService) DeleteLocation(id int) (resp *dto.LocationResponse, found, ok bool) {
	loc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if loc == nil {
		return nil, false, true
	}
	if err := s.repo.Delete(id); err != nil {
		return nil, true, false
	}
	r := toLocationResponse(loc)
	return &r, true, true
}

// MemberLocationInput은 member-create의 정제 입력.
type MemberLocationInput struct {
	MemberID      int
	SltTitle      string
	SltAdd        string
	SltLat        float64
	SltLong       float64
	SltShow       string
	SltEnterAlarm string
	SltEnterChk   string
	SltIcon       *string // nil이면 NULL(앱이 이름으로 짐작)
	SgdtIdxBody   int     // 그룹 없을 때 폴백(body 또는 641)
	SgtIdxBody    int
}

// MemberCreateLocation은 Python create_member_location을 이식한다(member존재→그룹조회→INSERT→재조회).
// found=false→404 "Member {id} not found", ok=false→500.
func (s *LocationService) MemberCreateLocation(in MemberLocationInput) (resp *dto.LocationMemberCreateResponse, memberFound, ok bool) {
	exists, err := s.repo.MemberExists(in.MemberID)
	if err != nil {
		return nil, false, false
	}
	if !exists {
		return nil, false, true
	}
	// 그룹 조회(첫 그룹). 없으면 body/641 폴백.
	sgdtIdx, sgtIdx, err := s.repo.FirstGroupForMember(in.MemberID)
	if err != nil {
		return nil, true, false
	}
	var sgdt, sgt int
	if sgdtIdx != nil && sgtIdx != nil {
		sgdt, sgt = *sgdtIdx, *sgtIdx
	} else {
		sgdt, sgt = in.SgdtIdxBody, in.SgtIdxBody
	}
	now := time.Now()
	lat := strconv.FormatFloat(in.SltLat, 'f', -1, 64)
	long := strconv.FormatFloat(in.SltLong, 'f', -1, 64)
	m := &model.Location{
		InsertMtIdx: &in.MemberID, MtIdx: &in.MemberID, SgtIdx: &sgt, SgdtIdx: &sgdt,
		SltTitle: &in.SltTitle, SltAdd: &in.SltAdd, SltLat: &lat, SltLong: &long,
		SltShow: &in.SltShow, SltEnterAlarm: &in.SltEnterAlarm, SltEnterChk: &in.SltEnterChk, SltWdate: &now,
		SltIcon: in.SltIcon,
	}
	if err := s.repo.Create(m); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(m.SltIdx)
	if err != nil || saved == nil {
		return nil, true, false
	}
	return &dto.LocationMemberCreateResponse{
		Success: true, Message: "Location created successfully for member " + strconv.Itoa(in.MemberID),
		MemberID: in.MemberID, SltIdx: saved.SltIdx,
		Data: dto.LocationMemberCreateData{
			SltIdx: saved.SltIdx, InsertMtIdx: saved.InsertMtIdx, MtIdx: saved.MtIdx,
			SgtIdx: saved.SgtIdx, SgdtIdx: saved.SgdtIdx, SltTitle: saved.SltTitle, SltAdd: saved.SltAdd,
			SltLat: decStrToPyFloat(saved.SltLat), SltLong: decStrToPyFloat(saved.SltLong),
			SltShow: saved.SltShow, SltEnterAlarm: saved.SltEnterAlarm, SltEnterChk: saved.SltEnterChk,
			SltWdate: pyISOPtr(saved.SltWdate), SltIcon: saved.SltIcon,
		},
	}, true, true
}

// decStrToPyFloat은 DECIMAL 문자열을 float(PyFloat)로 변환한다(Python float(decimal) if x else None).
func decStrToPyFloat(s *string) *dto.PyFloat {
	if s == nil || *s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(*s, 64)
	if err != nil {
		return nil
	}
	v := dto.PyFloat(f)
	return &v
}
