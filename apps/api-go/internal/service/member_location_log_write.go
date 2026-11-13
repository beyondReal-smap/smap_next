package service

import (
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// DailySummaryByDate는 Python get_member_daily_location_summary(exact-date 로그에 거리/시간/걸음 계산).
// 범위 summary와 동일한 computeSummary 로직을 exact-date 로그에 적용한다.
func (s *LocationLogService) DailySummaryByDate(mtIdx int, date string) (dto.LocationSummaryData, error) {
	start, err := parseYMD(date)
	if err != nil {
		return dto.LocationSummaryData{}, err
	}
	end := start.AddDate(0, 0, 1)
	logs, err := s.repo.GetMemberLogsByExactDate(mtIdx, start, end, 10000, 0)
	if err != nil {
		return dto.LocationSummaryData{}, err
	}
	return computeSummary(logs), nil
}

// DailyPathByDate는 Python get_member_daily_location_path(exact-date points + summary).
// 범위 path와 달리 포인트에 gps_time(HH:MM:SS)이 추가된다.
func (s *LocationLogService) DailyPathByDate(mtIdx int, date string) (dto.DailyPathData, error) {
	start, err := parseYMD(date)
	if err != nil {
		return dto.DailyPathData{}, err
	}
	end := start.AddDate(0, 0, 1)
	logs, err := s.repo.GetMemberLogsByExactDate(mtIdx, start, end, 10000, 0)
	if err != nil {
		return dto.DailyPathData{}, err
	}
	points := make([]dto.DailyPathPoint, 0)
	for i := range logs {
		l := &logs[i]
		if !isTruthyF(l.MltLat) || !isTruthyF(l.MltLong) {
			continue
		}
		ts, hhmmss := "", ""
		if l.MltGpsTime != nil {
			ts = pyISO(*l.MltGpsTime)
			hhmmss = l.MltGpsTime.Format("15:04:05")
		}
		points = append(points, dto.DailyPathPoint{
			Lat: dto.PyFloat(*l.MltLat), Lng: dto.PyFloat(*l.MltLong), Timestamp: ts,
			Accuracy: floatToPyFloatPtr(l.MltAccuacy), Speed: floatToPyFloatPtr(l.MltSpeed),
			Battery: l.MltBattery, Steps: l.MtHealthWork, GpsTime: hhmmss,
		})
	}
	return dto.DailyPathData{Points: points, Summary: computeSummary(logs)}, nil
}

// LocationLogCreateInput은 MemberLocationLogCreate(검증 완료)를 담는다. mlt_gps_time/mt_idx 필수.
type LocationLogCreateInput struct {
	MtIdx           int
	MltLat, MltLong *float64
	MltAccuacy      *float64
	MltSpeed        *float64
	MltBattery      *int
	MltFineLocation *string
	MltLocationChk  *string
	MtHealthWork    *int
	MltGpsTime      time.Time
	StayLat         *float64
	StayLong        *float64
}

// CreateLog는 act create_location_log(단건)를 이식한다. 로그 INSERT + member 최신위치 갱신(부수효과).
func (s *LocationLogService) CreateLog(in LocationLogCreateInput) (dto.LocationLogDict, bool) {
	gt := in.MltGpsTime
	l := &model.MemberLocationLog{
		MtIdx: in.MtIdx, MltLat: in.MltLat, MltLong: in.MltLong, MltAccuacy: in.MltAccuacy,
		MltSpeed: in.MltSpeed, MltBattery: in.MltBattery, MltFineLocation: in.MltFineLocation,
		MltLocationChk: in.MltLocationChk, MtHealthWork: in.MtHealthWork, MltGpsTime: &gt,
		StayLat: in.StayLat, StayLong: in.StayLong,
	}
	if err := s.repo.CreateLog(l, time.Now()); err != nil {
		return dto.LocationLogDict{}, false
	}
	saved, err := s.repo.GetLogByID(l.MltIdx)
	if err != nil || saved == nil {
		return dto.LocationLogDict{}, false
	}
	return toLocationLogDict(saved), true
}

// logOwnerChange는 update 요청이 기록 소유자(mt_idx)를 바꾸려는지 판정한다. 같은 값으로의 "변경"은 허용(무시)한다.
// 해석할 수 없는 값도 소유자 변경 시도로 본다.
func logOwnerChange(present map[string]interface{}, cur int) (attempt bool) {
	v, has := present["mt_idx"]
	if !has {
		return false
	}
	switch t := v.(type) {
	case float64:
		return int(t) != cur
	case string:
		n, err := strconv.Atoi(t)
		return err != nil || n != cur
	}
	return true
}

// UpdateLog는 act update_location_log를 이식한다(exclude_unset). found=false→404.
// 요청자가 인증돼 있으면 기록 소유자만 수정할 수 있고(forbidden), 소유자(mt_idx) 변경은 인증 여부와 무관하게 금지한다.
func (s *LocationLogService) UpdateLog(v Viewer, mltIdx int, present map[string]interface{}) (resp *dto.LocationLogDict, found, ok, forbidden bool) {
	cur, err := s.repo.GetLogByID(mltIdx)
	if err != nil {
		return nil, false, false, false
	}
	if cur == nil {
		return nil, false, true, false
	}
	if v.Authenticated && cur.MtIdx != v.MtIdx {
		return nil, true, true, true
	}
	if logOwnerChange(present, cur.MtIdx) {
		return nil, true, true, true
	}
	delete(present, "mt_idx")
	if _, err := s.repo.UpdateLog(mltIdx, present); err != nil {
		return nil, true, false, false
	}
	saved, err := s.repo.GetLogByID(mltIdx)
	if err != nil || saved == nil {
		return nil, true, false, false
	}
	d := toLocationLogDict(saved)
	return &d, true, true, false
}

// DeleteLog는 act delete_location_log를 이식한다(하드 삭제). found=false→404.
// 요청자가 인증돼 있으면 기록 소유자만 삭제할 수 있다(forbidden).
func (s *LocationLogService) DeleteLog(v Viewer, mltIdx int) (found, ok, forbidden bool) {
	cur, err := s.repo.GetLogByID(mltIdx)
	if err != nil {
		return false, false, false
	}
	if cur == nil {
		return false, true, false
	}
	if v.Authenticated && cur.MtIdx != v.MtIdx {
		return true, true, true
	}
	if err := s.repo.DeleteLog(mltIdx); err != nil {
		return true, false, false
	}
	return true, true, false
}
