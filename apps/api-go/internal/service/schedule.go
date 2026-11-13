package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// hasZeroDate는 MySQL '0000-00-00 00:00:00'(드라이버가 time.Time{}=IsZero로 변환)이 하나라도
// 있는지 검사한다. Python ScheduleResponse는 이를 datetime으로 파싱 못 해 ResponseValidationError
// →500(plain text)이 되므로, 하나라도 있으면 응답 전체를 500으로 처리한다(NULL=nil은 정상).
func hasZeroDate(times ...*time.Time) bool {
	for _, t := range times {
		if t != nil && t.IsZero() {
			return true
		}
	}
	return false
}

// scheduleRepo는 ScheduleService가 의존하는 데이터 접근 인터페이스.
type scheduleRepo interface {
	ListForMember(mtIdx, skip, limit int) ([]model.Schedule, error)
	GetByID(id int) (*model.Schedule, error)
	FindByMember(mtIdx int) ([]model.Schedule, error)
	FindGroupSchedules(groupID int, days *int) ([]model.Schedule, error)
	GetNowScheduleInMembers() ([]model.Schedule, error)
	GetNowScheduleOutMembers() ([]model.Schedule, error)
	GetNowSchedulePush() ([]model.Schedule, error)
	Create(s *model.Schedule) error
	UpdateFields(id int, fields map[string]interface{}) error
	Delete(id int) error
}

// ScheduleService는 Python `app/api/v1/endpoints/schedules.py`의 결정적 read 핸들러를 이식한다.
// (now/* 시간창·group List[dict]는 별도 작업으로 보류.)
type ScheduleService struct {
	repo  scheduleRepo
	authz *ScheduleAuthz
}

func NewSchedule(repo scheduleRepo) *ScheduleService {
	return &ScheduleService{repo: repo}
}

// SetAuthz는 일정 인가기를 주입한다. 주입되지 않으면 인가가 필요한 메서드는 오류를 낸다(조용히 허용하지 않는다).
func (s *ScheduleService) SetAuthz(a *ScheduleAuthz) { s.authz = a }

// errScheduleInternal은 응답 변환 실패(zero date 등)로 Python이 500을 내던 경우다.
var errScheduleInternal = errors.New("schedule: response conversion failed")

var errScheduleAuthzMissing = errors.New("schedule: authz not configured")

func (s *ScheduleService) needAuthz() error {
	if s.authz == nil {
		return errScheduleAuthzMissing
	}
	return nil
}

// isPersonal은 그룹에 속하지 않은 개인 일정(sgt_idx가 NULL 또는 0)인지 판정한다.
func isPersonal(sgt *int) bool { return sgt == nil || *sgt == 0 }

// toScheduleResponse는 ScheduleResponse로 변환한다. zero date가 있으면 ok=false(→ Python 500).
func toScheduleResponse(s *model.Schedule) (dto.ScheduleResponse, bool) {
	if hasZeroDate(s.SstSdate, s.SstEdate, s.SstAdate, s.SstScheduleAlarm, s.SstWdate, s.SstUdate, s.SstDdate) {
		return dto.ScheduleResponse{}, false
	}
	return dto.ScheduleResponse{
		SstPidx:             s.SstPidx,
		MtIdx:               s.MtIdx,
		SstTitle:            s.SstTitle,
		SstSdate:            pyISOPtr(s.SstSdate),
		SstEdate:            pyISOPtr(s.SstEdate),
		SstSedate:           s.SstSedate,
		SstAllDay:           s.SstAllDay,
		SstRepeatJSON:       s.SstRepeatJSON,
		SstRepeatJSONV:      s.SstRepeatJSONV,
		SgtIdx:              s.SgtIdx,
		SgdtIdx:             s.SgdtIdx,
		SgdtIdxT:            s.SgdtIdxT,
		SstAlram:            s.SstAlram,
		SstAlramT:           s.SstAlramT,
		SstAdate:            pyISOPtr(s.SstAdate),
		SltIdx:              s.SltIdx,
		SltIdxT:             s.SltIdxT,
		SstLocationTitle:    s.SstLocationTitle,
		SstLocationAdd:      s.SstLocationAdd,
		SstLocationLat:      pyDecimalStr(s.SstLocationLat),
		SstLocationLong:     pyDecimalStr(s.SstLocationLong),
		SstSupplies:         s.SstSupplies,
		SstMemo:             s.SstMemo,
		SstShow:             s.SstShow,
		SstLocationAlarm:    s.SstLocationAlarm,
		SstScheduleAlarmChk: s.SstScheduleAlarmChk,
		SstPickType:         s.SstPickType,
		SstPickResult:       s.SstPickResult,
		SstScheduleAlarm:    pyISOPtr(s.SstScheduleAlarm),
		SstUpdateChk:        s.SstUpdateChk,
		SstInChk:            s.SstInChk,
		SstScheduleChk:      s.SstScheduleChk,
		SstEntryCnt:         s.SstEntryCnt,
		SstExitCnt:          s.SstExitCnt,
		SstIdx:              s.SstIdx,
		SstWdate:            pyISOPtr(s.SstWdate),
		SstUdate:            pyISOPtr(s.SstUdate),
		SstDdate:            pyISOPtr(s.SstDdate),
		// MtScheduleIdx: 모델 미매핑 → nil(null)
	}, true
}

// toScheduleResponses는 변환 목록을 만든다. zero date 행이 있으면 ok=false(→ 500).
func toScheduleResponses(items []model.Schedule) ([]dto.ScheduleResponse, bool) {
	out := make([]dto.ScheduleResponse, 0, len(items))
	for i := range items {
		r, ok := toScheduleResponse(&items[i])
		if !ok {
			return nil, false
		}
		out = append(out, r)
	}
	return out, true
}

// ListSchedules는 요청자와 관련된 일정 목록(본인 일정 + 본인이 현재 멤버인 그룹의 일정, 삭제 제외).
// ok=false면 500(레포 에러 또는 zero date → ResponseValidationError).
func (s *ScheduleService) ListSchedules(actor, skip, limit int) ([]dto.ScheduleResponse, bool) {
	items, err := s.repo.ListForMember(actor, skip, limit)
	if err != nil {
		return nil, false
	}
	return toScheduleResponses(items)
}

// GetSchedule은 단건. ok=false→500, found=false→404, 그 외 200.
func (s *ScheduleService) GetSchedule(id int) (resp *dto.ScheduleResponse, found bool, ok bool) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if sc == nil {
		return nil, false, true
	}
	r, valid := toScheduleResponse(sc)
	if !valid {
		return nil, true, false
	}
	return &r, true, true
}

// MemberSchedules는 회원의 일정 목록(sst_show='Y' ORDER BY sst_sdate). ok=false면 500.
func (s *ScheduleService) MemberSchedules(mtIdx int) ([]dto.ScheduleResponse, bool) {
	items, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, false
	}
	return toScheduleResponses(items)
}

// NowScheduleInMembers는 GET /schedules/now/in-members(진입 알림 대상). 시간창 필터 매칭 행을
// ScheduleResponse로 반환. zero date(sst_schedule_alarm 등)가 있으면 ok=false→500(Python ResponseValidationError).
func (s *ScheduleService) NowScheduleInMembers() ([]dto.ScheduleResponse, bool) {
	items, err := s.repo.GetNowScheduleInMembers()
	if err != nil {
		return nil, false
	}
	return toScheduleResponses(items)
}

// NowScheduleOutMembers는 GET /schedules/now/out-members(이탈 알림 대상).
func (s *ScheduleService) NowScheduleOutMembers() ([]dto.ScheduleResponse, bool) {
	items, err := s.repo.GetNowScheduleOutMembers()
	if err != nil {
		return nil, false
	}
	return toScheduleResponses(items)
}

// NowSchedulePush는 GET /schedules/now/push(현재 분 발송 대상).
func (s *ScheduleService) NowSchedulePush() ([]dto.ScheduleResponse, bool) {
	items, err := s.repo.GetNowSchedulePush()
	if err != nil {
		return nil, false
	}
	return toScheduleResponses(items)
}

// groupDateStr은 /schedules/group의 날짜 규칙: 유효 datetime→isoformat(T), zero date(MySQL
// '0000-00-00'→time.Time{})→Python이 str()한 "0000-00-00 00:00:00", nil→null.
func groupDateStr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	if t.IsZero() {
		s := "0000-00-00 00:00:00"
		return &s
	}
	s := pyISO(*t)
	return &s
}

// decimalStrToFloatPtr은 Python `float(Decimal) if x else None`을 재현한다(DECIMAL 문자열→float,
// 0은 null). ScheduleResponse는 Decimal→문자열이지만 group dict는 float(숫자)다.
func decimalStrToFloatPtr(s *string) *float64 {
	if s == nil {
		return nil
	}
	f, err := strconv.ParseFloat(*s, 64)
	if err != nil || f == 0 {
		return nil
	}
	return &f
}

func toScheduleGroupItem(s *model.Schedule) dto.ScheduleGroupItem {
	return dto.ScheduleGroupItem{
		ID:                  s.SstIdx,
		SstPidx:             s.SstPidx,
		MtScheduleIdx:       s.MtIdx,
		Title:               s.SstTitle,
		Date:                groupDateStr(s.SstSdate),
		SstEdate:            groupDateStr(s.SstEdate),
		SstSedate:           s.SstSedate,
		SstAllDay:           s.SstAllDay,
		SstRepeatJSON:       s.SstRepeatJSON,
		SstRepeatJSONV:      s.SstRepeatJSONV,
		SgtIdx:              s.SgtIdx,
		SgdtIdx:             s.SgdtIdx,
		SgdtIdxT:            s.SgdtIdxT,
		SstAlram:            s.SstAlram,
		SstAlramT:           s.SstAlramT,
		SstAdate:            groupDateStr(s.SstAdate),
		SltIdx:              s.SltIdx,
		SltIdxT:             s.SltIdxT,
		Location:            s.SstLocationTitle,
		SstLocationAdd:      s.SstLocationAdd,
		SstLocationLat:      decimalStrToFloatPtr(s.SstLocationLat),
		SstLocationLong:     decimalStrToFloatPtr(s.SstLocationLong),
		SstSupplies:         s.SstSupplies,
		SstMemo:             s.SstMemo,
		SstShow:             s.SstShow,
		SstLocationAlarm:    s.SstLocationAlarm,
		SstScheduleAlarmChk: s.SstScheduleAlarmChk,
		SstPickType:         s.SstPickType,
		SstPickResult:       s.SstPickResult,
		SstScheduleAlarm:    groupDateStr(s.SstScheduleAlarm),
		SstUpdateChk:        s.SstUpdateChk,
		SstWdate:            groupDateStr(s.SstWdate),
		SstUdate:            groupDateStr(s.SstUdate),
		SstDdate:            groupDateStr(s.SstDdate),
		SstInChk:            s.SstInChk,
		SstScheduleChk:      s.SstScheduleChk,
		SstEntryCnt:         s.SstEntryCnt,
		SstExitCnt:          s.SstExitCnt,
	}
}

// GroupSchedules는 그룹 일정 목록(수동 dict). repo 에러는 전파(핸들러가 500).
func (s *ScheduleService) GroupSchedules(groupID int, days *int) ([]dto.ScheduleGroupItem, error) {
	items, err := s.repo.FindGroupSchedules(groupID, days)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ScheduleGroupItem, 0, len(items))
	for i := range items {
		out = append(out, toScheduleGroupItem(&items[i]))
	}
	return out, nil
}

// GetScheduleFor는 단건 조회에 인가를 더한다: 그룹 일정은 그 그룹의 현재 멤버만, 개인 일정은 작성자만.
// found=false→404. 권한이 없으면 ErrScheduleNotMember/ErrScheduleManageDenied, 변환 실패는 errScheduleInternal.
func (s *ScheduleService) GetScheduleFor(ctx context.Context, actor, id int) (*dto.ScheduleResponse, bool, error) {
	if err := s.needAuthz(); err != nil {
		return nil, false, err
	}
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, err
	}
	if sc == nil {
		return nil, false, nil
	}
	if isPersonal(sc.SgtIdx) {
		if sc.MtIdx == nil || *sc.MtIdx != actor {
			return nil, true, ErrScheduleManageDenied
		}
	} else if _, err := s.authz.RequireMember(ctx, actor, *sc.SgtIdx); err != nil {
		return nil, true, err
	}
	r, ok := toScheduleResponse(sc)
	if !ok {
		return nil, true, errScheduleInternal
	}
	return &r, true, nil
}

// GroupSchedulesFor는 그룹 일정 조회에 인가를 더한다: 요청자가 그 그룹의 현재 멤버여야 한다.
func (s *ScheduleService) GroupSchedulesFor(ctx context.Context, actor, groupID int, days *int) ([]dto.ScheduleGroupItem, error) {
	if err := s.needAuthz(); err != nil {
		return nil, err
	}
	if _, err := s.authz.RequireMember(ctx, actor, groupID); err != nil {
		return nil, err
	}
	return s.GroupSchedules(groupID, days)
}
