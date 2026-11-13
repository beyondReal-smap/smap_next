package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// gsmMemberRepo는 editor_name/대상회원 조회용(Member.find_by_idx 대응).
type gsmMemberRepo interface {
	GetByID(mtIdx int) (*model.Member, error)
}

// gsmFCMSender는 푸시 발송(*fcm.Client 만족). 미가용 시 Send가 ErrUnavailable을 반환한다.
type gsmFCMSender interface {
	Send(ctx context.Context, msg fcm.Message) (string, error)
}

// GroupScheduleManageService는 Python group_schedule_manage.py read/write 핸들러를 이식한다.
// Phase B(생성)부터 회원 조회·푸시 로그·FCM 발송 의존성이 추가된다.
type GroupScheduleManageService struct {
	repo    *repository.GroupScheduleManageRepository
	members gsmMemberRepo
	logs    pushLogWriter
	fcm     gsmFCMSender
}

func NewGroupScheduleManage(repo *repository.GroupScheduleManageRepository, members gsmMemberRepo, logs pushLogWriter, sender gsmFCMSender) *GroupScheduleManageService {
	return &GroupScheduleManageService{repo: repo, members: members, logs: logs, fcm: sender}
}

// gsmColumnNames는 BASE38 키 목록(test-all-columns의 column_names).
var gsmColumnNames = []string{
	"sst_idx", "sst_pidx", "mt_idx", "sst_title", "sst_sdate", "sst_edate", "sst_sedate",
	"sst_all_day", "sst_repeat_json", "sst_repeat_json_v", "sgt_idx", "sgdt_idx", "sgdt_idx_t",
	"sst_alram", "sst_alram_t", "sst_adate", "slt_idx", "slt_idx_t", "sst_location_title",
	"sst_location_add", "sst_location_lat", "sst_location_long", "sst_supplies", "sst_memo",
	"sst_show", "sst_location_alarm", "sst_schedule_alarm_chk", "sst_pick_type", "sst_pick_result",
	"sst_schedule_alarm", "sst_update_chk", "sst_wdate", "sst_udate", "sst_ddate", "sst_in_chk",
	"sst_schedule_chk", "sst_entry_cnt", "sst_exit_cnt",
}

// gsmDecPyFloat은 Python `float(x) if x else None`(Decimal 0/빈값 → None).
// decStrToPyFloat과 달리 0도 nil로 변환한다.
func gsmDecPyFloat(s *string) *dto.PyFloat {
	if s == nil || *s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(*s, 64)
	if err != nil || f == 0 {
		return nil
	}
	v := dto.PyFloat(f)
	return &v
}

// gsmISO/gsmStr은 MySQL zero date('0000-00-00 00:00:00')를 충실 재현한다.
// pymysql은 zero date를 datetime이 아닌 문자열로 반환 → str()/isoformat() 모두 "0000-00-00 00:00:00"(공백).
// Go 드라이버는 zero date를 time.Time{}(0001-01-01)로 주므로 IsZero()일 때 원본 zero 문자열을 돌려준다.
func gsmISO(t *time.Time) *string {
	if t == nil {
		return nil
	}
	if t.IsZero() {
		s := "0000-00-00 00:00:00"
		return &s
	}
	return pyISOPtr(t)
}

func gsmStr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	if t.IsZero() {
		s := "0000-00-00 00:00:00"
		return &s
	}
	return pyStrDatetimePtr(t)
}

// gsmStrInt은 Python str(x)(int→문자열, nil→"None").
func gsmStrInt(p *int) string {
	if p == nil {
		return "None"
	}
	return strconv.Itoa(*p)
}

// ptrEqStr은 *string == 값 비교.
func ptrEqStr(p *string, v string) bool {
	return p != nil && *p == v
}

// gsmBase는 model.Schedule → BASE38 변환. iso=true면 adate/schedule_alarm/wdate/udate/ddate를
// isoformat(T)로, false면 str(공백)로 변환한다. sdate/edate는 항상 str(공백).
func gsmBase(s *model.Schedule, iso bool) dto.GSMScheduleBase {
	var conv func(*time.Time) *string = gsmStr
	if iso {
		conv = gsmISO
	}
	return dto.GSMScheduleBase{
		SstIdx:              s.SstIdx,
		SstPidx:             s.SstPidx,
		MtIdx:               s.MtIdx,
		SstTitle:            s.SstTitle,
		SstSdate:            gsmStr(s.SstSdate),
		SstEdate:            gsmStr(s.SstEdate),
		SstSedate:           s.SstSedate,
		SstAllDay:           s.SstAllDay,
		SstRepeatJSON:       s.SstRepeatJSON,
		SstRepeatJSONV:      s.SstRepeatJSONV,
		SgtIdx:              s.SgtIdx,
		SgdtIdx:             s.SgdtIdx,
		SgdtIdxT:            s.SgdtIdxT,
		SstAlram:            s.SstAlram,
		SstAlramT:           s.SstAlramT,
		SstAdate:            conv(s.SstAdate),
		SltIdx:              s.SltIdx,
		SltIdxT:             s.SltIdxT,
		SstLocationTitle:    s.SstLocationTitle,
		SstLocationAdd:      s.SstLocationAdd,
		SstLocationLat:      gsmDecPyFloat(s.SstLocationLat),
		SstLocationLong:     gsmDecPyFloat(s.SstLocationLong),
		SstSupplies:         s.SstSupplies,
		SstMemo:             s.SstMemo,
		SstShow:             s.SstShow,
		SstLocationAlarm:    s.SstLocationAlarm,
		SstScheduleAlarmChk: s.SstScheduleAlarmChk,
		SstPickType:         s.SstPickType,
		SstPickResult:       s.SstPickResult,
		SstScheduleAlarm:    conv(s.SstScheduleAlarm),
		SstUpdateChk:        s.SstUpdateChk,
		SstWdate:            conv(s.SstWdate),
		SstUdate:            conv(s.SstUdate),
		SstDdate:            conv(s.SstDdate),
		SstInChk:            s.SstInChk,
		SstScheduleChk:      s.SstScheduleChk,
		SstEntryCnt:         s.SstEntryCnt,
		SstExitCnt:          s.SstExitCnt,
	}
}

// TestAllColumns는 GET /test-all-columns를 이식한다(전부 200: 성공/없음/에러).
func (s *GroupScheduleManageService) TestAllColumns(userID int) interface{} {
	sch, err := s.repo.TestSchedule(userID)
	if err != nil {
		return dto.GSMFailError{Success: false, Error: err.Error()}
	}
	if sch == nil {
		return dto.GSMFailMessage{Success: false, Message: "No schedule found"}
	}
	return dto.GSMTestColumnsResponse{
		Success:      true,
		Data:         gsmBase(sch, false),
		TotalColumns: 38,
		ColumnNames:  gsmColumnNames,
	}
}

// OwnerGroupsAllSchedules는 GET /owner-groups/all-schedules를 이식한다(except→error로 500).
func (s *GroupScheduleManageService) OwnerGroupsAllSchedules(userID int, year, month *int) (*dto.GSMOwnerSchedulesResponse, error) {
	now := time.Now()
	finalYear := now.Year()
	if year != nil {
		finalYear = *year
	}
	finalMonth := int(now.Month())
	if month != nil {
		finalMonth = *month
	}
	var nextYear, nextMonth int
	if finalMonth == 12 {
		nextYear, nextMonth = finalYear+1, 1
	} else {
		nextYear, nextMonth = finalYear, finalMonth+1
	}
	startDate := fmt.Sprintf("%d-%02d-01", finalYear, finalMonth)
	endDate := fmt.Sprintf("%d-%02d-01", nextYear, nextMonth)

	// 사용자 최근 위치(Python float(x) if x else None → 0/None은 무시)
	loc := s.repo.UserLocation(userID)
	var userLatF, userLngF *float64
	if loc != nil {
		if isTruthyF(loc.MltLat) {
			userLatF = loc.MltLat
		}
		if isTruthyF(loc.MltLong) {
			userLngF = loc.MltLong
		}
	}

	// 그룹 목록
	groupRows, err := s.repo.OwnerGroups(userID)
	if err != nil {
		return nil, err
	}
	groups := make([]dto.GSMOwnerGroup, 0, len(groupRows))
	for _, g := range groupRows {
		groups = append(groups, dto.GSMOwnerGroup{
			SgtIdx: g.SgtIdx, SgtTitle: g.SgtTitle, SgdtIdx: g.SgdtIdx,
			SgdtOwnerChk: g.SgdtOwnerChk, SgdtLeaderChk: g.SgdtLeaderChk, MtIdx: g.MtIdx,
		})
	}

	// 스케줄(그룹 있을 때만)
	schedules := make([]dto.GSMOwnerSchedule, 0)
	if len(groupRows) > 0 {
		ids := make([]int, len(groupRows))
		for i, g := range groupRows {
			ids[i] = g.SgtIdx
		}
		rows, err := s.repo.OwnerSchedules(ids, userLatF, userLngF, startDate, endDate)
		if err != nil {
			return nil, err
		}
		for i := range rows {
			schedules = append(schedules, toOwnerSchedule(&rows[i]))
		}
	}

	var userLocation *dto.GSMUserLocation
	if userLatF != nil && userLngF != nil {
		userLocation = &dto.GSMUserLocation{
			Lat: floatToPyFloatPtrOrNil(userLatF),
			Lng: floatToPyFloatPtrOrNil(userLngF),
		}
	}

	return &dto.GSMOwnerSchedulesResponse{
		Success: true,
		Data: dto.GSMOwnerSchedulesData{
			Schedules:      schedules,
			OwnerGroups:    groups,
			TotalSchedules: len(schedules),
			QueryPeriod: dto.GSMQueryPeriod{
				Year: finalYear, Month: finalMonth, StartDate: startDate, EndDate: endDate,
			},
			DebugInfo: dto.GSMDebugInfo{
				OriginalYear: year, OriginalMonth: month,
				FinalYear: finalYear, FinalMonth: finalMonth,
				NextYear: nextYear, NextMonth: nextMonth,
				CalculatedStartDate: startDate, CalculatedEndDate: endDate,
			},
			UserLocation: userLocation,
			// 오너 전용 엔드포인트라 권한은 하드코딩(Python과 동일)
			UserPermission: dto.GSMUserPermission{CanManage: true, IsOwner: true, IsLeader: false},
		},
	}, nil
}

func toOwnerSchedule(row *repository.GSMOwnerScheduleRow) dto.GSMOwnerSchedule {
	var dist *dto.PyFloat
	if row.SchCalcDist != nil {
		v := dto.PyFloat(pyRound2(*row.SchCalcDist))
		dist = &v
	}
	return dto.GSMOwnerSchedule{
		GSMScheduleBase:  gsmBase(&row.Schedule, true),
		SchCalcDist:      dist,
		MemberName:       row.MemberName,
		MemberPhoto:      row.MemberPhoto,
		GroupTitle:       row.GroupTitle,
		TgtMtIdx:         row.TgtMtIdx,
		TgtSgdtOwnerChk:  row.TgtSgdtOwnerChk,
		TgtSgdtLeaderChk: row.TgtSgdtLeaderChk,
		TgtSgdtIdx:       row.TgtSgdtIdx,
		ID:               strconv.Itoa(row.SstIdx),
		Title:            row.SstTitle,
		Date:             gsmStr(row.SstSdate),
		Location:         row.SstLocationTitle,
		MemberID:         gsmStrInt(row.MtIdx),
	}
}

// GroupSchedules는 GET /group/{group_id}/schedules를 이식한다.
// found=false → 403, err != nil → 500.
func (s *GroupScheduleManageService) GroupSchedules(groupID int, startDate, endDate *string, days, memberID *int, userID int) (*dto.GSMGroupSchedulesResponse, bool, error) {
	// member_id는 Python `if member_id:` truthy 조건 — 0이면 WHERE에서 제외
	if memberID != nil && *memberID == 0 {
		memberID = nil
	}
	// days만 있으면 today~today+days 자동계산
	if days != nil && startDate == nil && endDate == nil {
		now := time.Now()
		y, m, d := now.Date()
		sd := fmt.Sprintf("%04d-%02d-%02d", y, int(m), d)
		ed := time.Date(y, m, d, 0, 0, 0, 0, now.Location()).AddDate(0, 0, *days).Format("2006-01-02")
		startDate, endDate = &sd, &ed
	}

	auth := s.repo.CheckGroupPermission(userID, groupID)
	if auth == nil {
		return nil, false, nil // 403
	}
	memberRows := s.repo.GetGroupMembers(groupID)
	members := make([]dto.GSMGroupMember, 0, len(memberRows))
	for _, m := range memberRows {
		members = append(members, dto.GSMGroupMember{
			MtIdx: m.MtIdx, MtName: m.MtName, MtFile1: m.MtFile1, SgtIdx: m.SgtIdx,
			SgdtIdx: m.SgdtIdx, SgdtOwnerChk: m.SgdtOwnerChk, SgdtLeaderChk: m.SgdtLeaderChk,
		})
	}

	rows, err := s.repo.GroupSchedules(groupID, startDate, endDate, memberID)
	if err != nil {
		return nil, true, err // 500
	}
	schedules := make([]dto.GSMGroupSchedule, 0, len(rows))
	for i := range rows {
		schedules = append(schedules, toGroupSchedule(&rows[i]))
	}

	return &dto.GSMGroupSchedulesResponse{
		Success: true,
		Data: dto.GSMGroupSchedulesData{
			Schedules:    schedules,
			GroupMembers: members,
			UserPermission: dto.GSMUserPermission{
				CanManage: ptrEqStr(auth.SgdtOwnerChk, "Y") || ptrEqStr(auth.SgdtLeaderChk, "Y"),
				IsOwner:   ptrEqStr(auth.SgdtOwnerChk, "Y"),
				IsLeader:  ptrEqStr(auth.SgdtLeaderChk, "Y"),
			},
		},
	}, true, nil
}

func toGroupSchedule(row *repository.GSMGroupScheduleRow) dto.GSMGroupSchedule {
	return dto.GSMGroupSchedule{
		GSMScheduleBase: gsmBase(&row.Schedule, true),
		MemberName:      row.MemberName,
		MemberPhoto:     row.MemberPhoto,
		ID:              strconv.Itoa(row.SstIdx),
		Title:           row.SstTitle,
		Date:            gsmStr(row.SstSdate),
		Location:        row.SstLocationTitle,
		MemberID:        gsmStrInt(row.MtIdx),
	}
}

// DebugSchedule은 GET /debug/schedule/{schedule_id}를 이식한다.
// 없으면 GSMFailMessage, except는 nil(Python None 반환)로 신호.
func (s *GroupScheduleManageService) DebugSchedule(scheduleID int) interface{} {
	sch, err := s.repo.DebugSchedule(scheduleID)
	if err != nil {
		return nil
	}
	if sch == nil {
		return dto.GSMFailMessage{Success: false, Message: "Schedule not found"}
	}
	// parent_id = sst_pidx if truthy else schedule_id
	parentID := scheduleID
	if sch.SstPidx != nil && *sch.SstPidx != 0 {
		parentID = *sch.SstPidx
	}
	relatedRows, err := s.repo.DebugRelated(scheduleID, parentID)
	if err != nil {
		return nil
	}
	related := make([]dto.GSMDebugRelated, 0, len(relatedRows))
	for _, r := range relatedRows {
		related = append(related, dto.GSMDebugRelated{
			SstIdx: r.SstIdx, SstPidx: r.SstPidx, SstTitle: r.SstTitle,
			SstSdate: gsmStr(r.SstSdate), SstRepeatJSON: r.SstRepeatJSON,
		})
	}
	return dto.GSMDebugResponse{
		Success: true,
		Data: dto.GSMDebugData{
			TargetSchedule: dto.GSMDebugTarget{
				SstIdx: sch.SstIdx, SstPidx: sch.SstPidx, MtIdx: sch.MtIdx, SstTitle: sch.SstTitle,
				SstSdate: gsmStr(sch.SstSdate), SstEdate: gsmStr(sch.SstEdate),
				SstRepeatJSON: sch.SstRepeatJSON, SstRepeatJSONV: sch.SstRepeatJSONV,
				SstShow: sch.SstShow, SstWdate: gsmStr(sch.SstWdate),
			},
			RelatedSchedules: related,
			TotalRelated:     len(related),
			ParentID:         parentID,
		},
	}
}

// === Phase B: POST 생성 + 반복 3년 + FCM 알림 ===

const gsmDTLayout = "2006-01-02 15:04:05"

// GSMCreateOutcome은 생성 핸들러의 분기(핸들러가 HTTP 상태/메시지로 변환).
type GSMCreateOutcome int

const (
	GSMCreateOK GSMCreateOutcome = iota
	GSMCreate403GroupDenied
	GSMCreate403ManageDenied
	GSMCreate400NoStartDate
	GSMCreate500
)

// gsmResolveEditor는 editorId+editorName이 둘 다 truthy면 body값을, 아니면 current_user_id +
// Member.mt_name 조회 결과를 (editorID, editorName)로 반환한다(POST/PUT 공유).
func (s *GroupScheduleManageService) gsmResolveEditor(body map[string]interface{}, userID int) (interface{}, interface{}) {
	if gsmPyTruthy(body["editorId"]) && gsmPyTruthy(body["editorName"]) {
		return body["editorId"], body["editorName"]
	}
	var editorName interface{} = "알 수 없음"
	if m, err := s.members.GetByID(userID); err == nil && m != nil {
		if m.MtName != nil {
			editorName = *m.MtName
		} else {
			editorName = nil // Python None → JSON null
		}
	}
	return userID, editorName
}

// gsmComputeAlarm은 alarm_chk=='Y' && pick_type && pick_result일 때 sdate 기준 알림 문자열을, 아니면 nil.
// POST/create_new/update_single이 공유(동일 계산식).
func gsmComputeAlarm(body map[string]interface{}, sdate string) interface{} {
	if !(gsmEqYRaw(body["sst_schedule_alarm_chk"]) && gsmPyTruthy(body["sst_pick_type"]) && gsmPyTruthy(body["sst_pick_result"])) {
		return nil
	}
	start, ok := gsmParseDT(strings.ReplaceAll(sdate, "T", " "))
	if !ok {
		return nil
	}
	pr, err := gsmPyInt(body["sst_pick_result"])
	if err != nil {
		return nil
	}
	switch gsmPyStr(body["sst_pick_type"]) {
	case "minute":
		return start.Add(-time.Duration(pr) * time.Minute).Format(gsmDTLayout)
	case "hour":
		return start.Add(-time.Duration(pr) * time.Hour).Format(gsmDTLayout)
	case "day":
		return start.Add(-time.Duration(pr) * 24 * time.Hour).Format(gsmDTLayout)
	}
	return nil
}

// gsmBuildScheduleParams는 권한/타겟 확정 이후의 INSERT 파라미터(sst_pidx 제외)를 만든다.
// POST create_group_schedule와 create_new_schedule(PUT Path4)가 공유한다.
// outcome=GSMCreateOK면 params 유효, 그 외(400 누락sdate / 500 비문자열)면 params는 무의미.
func gsmBuildScheduleParams(groupID, targetMemberID, targetSgdtIdx int, body map[string]interface{}) (map[string]interface{}, GSMCreateOutcome, string) {
	// title: get('sst_title','').strip() 빈값 → '제목 없음'
	titleRaw := body["sst_title"]
	titleStr, titleIsStr := titleRaw.(string)
	if titleRaw != nil && !titleIsStr {
		return nil, GSMCreate500, "object has no attribute 'strip'"
	}
	finalTitle := titleStr
	if strings.TrimSpace(titleStr) == "" {
		finalTitle = "제목 없음"
	}
	// sst_sdate 필수
	if !gsmPyTruthy(body["sst_sdate"]) {
		return nil, GSMCreate400NoStartDate, ""
	}
	sdate, ok := body["sst_sdate"].(string)
	if !ok {
		return nil, GSMCreate500, "argument is not iterable"
	}
	// sst_edate 기본=sdate(원본, 변환 전)
	var edate string
	if gsmPyTruthy(body["sst_edate"]) {
		es, ok := body["sst_edate"].(string)
		if !ok {
			return nil, GSMCreate500, "argument is not iterable"
		}
		edate = es
	} else {
		edate = sdate
	}
	// T→공백, ':' 없으면 시간 추가
	sdate = strings.ReplaceAll(sdate, "T", " ")
	edate = strings.ReplaceAll(edate, "T", " ")
	if !strings.Contains(sdate, ":") {
		sdate = sdate + " " + gsmPyStr(gsmGetOr(body, "sst_stime", "00:00:00"))
	}
	if !strings.Contains(edate, ":") {
		edate = edate + " " + gsmPyStr(gsmGetOr(body, "sst_etime", "23:59:59"))
	}
	// all_day=='Y'면 반복 제거
	allDay, _ := body["sst_all_day"].(string)
	repeatJSON, _ := body["sst_repeat_json"].(string)
	repeatJSONV, _ := body["sst_repeat_json_v"].(string)
	if allDay == "Y" {
		repeatJSON = ""
		repeatJSONV = ""
	}
	alarmVal := gsmComputeAlarm(body, sdate)
	// INSERT 파라미터(Python insert_params 그대로 — slt_idx_t=sst_location_add, sst_alram 기본 'N' 버그 포함)
	params := map[string]interface{}{
		"mt_idx":                 targetMemberID,
		"sst_title":              finalTitle,
		"sst_sdate":              sdate,
		"sst_edate":              edate,
		"sst_sedate":             sdate + " ~ " + edate,
		"sst_all_day":            gsmGetOr(body, "sst_all_day", "N"),
		"sgt_idx":                groupID,
		"sgdt_idx":               targetSgdtIdx,
		"sgdt_idx_t":             body["sgdt_idx_t"],
		"sst_location_title":     body["sst_location_title"],
		"sst_location_add":       body["sst_location_add"],
		"sst_location_lat":       body["sst_location_lat"],
		"sst_location_long":      body["sst_location_long"],
		"sst_location_alarm":     gsmGetOr(body, "sst_location_alarm", "4"),
		"sst_memo":               body["sst_memo"],
		"sst_supplies":           body["sst_supplies"],
		"sst_alram":              gsmGetOr(body, "sst_alram", "N"),
		"sst_alram_t":            body["sst_alram_t"],
		"sst_schedule_alarm_chk": gsmGetOr(body, "sst_schedule_alarm_chk", "N"),
		"sst_pick_type":          body["sst_pick_type"],
		"sst_pick_result":        body["sst_pick_result"],
		"sst_schedule_alarm":     alarmVal,
		"sst_repeat_json":        repeatJSON,
		"sst_repeat_json_v":      repeatJSONV,
		"slt_idx":                body["slt_idx"],
		"slt_idx_t":              body["sst_location_add"],
		"sst_update_chk":         gsmGetOr(body, "sst_update_chk", "3"),
		"sst_adate":              body["sst_adate"],
	}
	return params, GSMCreateOK, ""
}

// CreateGroupSchedule은 POST /group/{group_id}/schedules를 이식한다.
// 반환 string은 500일 때 "Internal server error: " 뒤에 붙일 메시지(드라이버별 상이 — status만 충실).
func (s *GroupScheduleManageService) CreateGroupSchedule(groupID int, body map[string]interface{}, userID int) (*dto.GSMCreateResponse, GSMCreateOutcome, string) {
	editorID, editorName := s.gsmResolveEditor(body, userID)

	auth := s.repo.CheckGroupPermission(userID, groupID)
	if auth == nil {
		return nil, GSMCreate403GroupDenied, ""
	}

	targetMemberID := userID
	targetSgdtIdx := auth.SgdtIdx
	if gsmPyTruthy(body["targetMemberId"]) {
		tid, err := gsmPyInt(body["targetMemberId"])
		if err != nil {
			return nil, GSMCreate500, err.Error()
		}
		targetMemberID = tid
		if !(gsmEqY(auth.SgdtOwnerChk) || gsmEqY(auth.SgdtLeaderChk)) {
			return nil, GSMCreate403ManageDenied, ""
		}
		if ta := s.repo.CheckGroupPermission(targetMemberID, groupID); ta != nil {
			targetSgdtIdx = ta.SgdtIdx
		}
	}

	params, outcome, msg := gsmBuildScheduleParams(groupID, targetMemberID, targetSgdtIdx, body)
	if outcome != GSMCreateOK {
		return nil, outcome, msg
	}

	newID, err := s.repo.InsertSchedule(params)
	if err != nil {
		return nil, GSMCreate500, err.Error()
	}

	// 반복 일정(Python try/except — 실패해도 메인 유지)
	repeatJSON, _ := params["sst_repeat_json"].(string)
	repeatJSONV, _ := params["sst_repeat_json_v"].(string)
	if repeatJSON != "" && strings.TrimSpace(repeatJSON) != "" {
		_, _ = s.createRecurring(newID, params, repeatJSON, repeatJSONV, s.repo.InsertRecurring)
	}

	// FCM 알림(Python try/except — 실패해도 생성 유지). 대표님 결정: 버그 수정판(실발송 1건).
	finalTitle, _ := params["sst_title"].(string)
	s.sendScheduleNotification("create", newID, finalTitle, targetMemberID, editorID, editorName)

	return &dto.GSMCreateResponse{
		Success: true,
		Data: dto.GSMCreateData{
			SstIdx:         newID,
			Message:        "Schedule created successfully",
			TargetMemberID: targetMemberID,
			EditorID:       editorID,
			EditorName:     editorName,
		},
	}, GSMCreateOK, ""
}

// errGSMStartDate는 create_new_schedule의 누락 sdate(HTTPException 400) 신호. PUT이 400으로 매핑한다.
var errGSMStartDate = errors.New("Start date is required")

// GSMUpdateOutcome은 PUT 핸들러 분기.
type GSMUpdateOutcome int

const (
	GSMUpdateOK GSMUpdateOutcome = iota
	GSMUpdate403GroupDenied
	GSMUpdate403EditDenied
	GSMUpdate404
	GSMUpdate400NoStartDate
	GSMUpdate500
)

// UpdateGroupSchedule은 PUT /group/{group_id}/schedules/{schedule_id}를 이식한다(반복옵션 this/all/future).
// 500 응답 메시지는 항상 "Internal server error"(POST와 달리 접미사 없음).
func (s *GroupScheduleManageService) UpdateGroupSchedule(groupID, scheduleID int, body map[string]interface{}, userID int) (*dto.GSMUpdateResponse, GSMUpdateOutcome) {
	editorID, editorName := s.gsmResolveEditor(body, userID)

	auth := s.repo.CheckGroupPermission(userID, groupID)
	if auth == nil {
		return nil, GSMUpdate403GroupDenied
	}

	existing, err := s.repo.GetScheduleShown(scheduleID)
	if err != nil {
		return nil, GSMUpdate500
	}
	if existing == nil {
		return nil, GSMUpdate404
	}

	// can_edit: 본인 스케줄이거나 owner/leader
	canEdit := (existing.MtIdx != nil && *existing.MtIdx == userID) ||
		gsmEqY(auth.SgdtOwnerChk) || gsmEqY(auth.SgdtLeaderChk)
	if !canEdit {
		return nil, GSMUpdate403EditDenied
	}

	editOptionRaw := gsmGetOr(body, "editOption", "this")
	isRepeat := (existing.SstRepeatJSON != nil && strings.TrimSpace(*existing.SstRepeatJSON) != "") ||
		(existing.SstPidx != nil && *existing.SstPidx > 0)

	updatedCount := 0
	if (isRepeat || gsmPyTruthy(body["sst_repeat_json"])) && !gsmStrEq(editOptionRaw, "this") {
		parentID := scheduleID
		if existing.SstPidx != nil && *existing.SstPidx > 0 {
			parentID = *existing.SstPidx
		}
		oldRepeat := ""
		if existing.SstRepeatJSON != nil {
			oldRepeat = *existing.SstRepeatJSON
		}
		newRepeatRaw := gsmGetOr(body, "sst_repeat_json", "")
		if gsmReprNeq(oldRepeat, newRepeatRaw) && gsmStrEq(editOptionRaw, "all") {
			// Path 4: 반복패턴 변경 → 패밀리 soft-delete + 새 부모 + 반복 재생성.
			// Python은 단일 세션(create_recurring의 commit/rollback)으로 원자적이므로 트랜잭션으로 감싼다.
			// create_recurring의 bind 누락(불완전 body) 또는 INSERT 실패 시 전체 rollback → 구 패밀리 보존.
			count, outc := s.updateRepeatPatternTx(parentID, groupID, userID, body, newRepeatRaw)
			if outc != GSMUpdateOK {
				return nil, outc
			}
			updatedCount = count
		} else {
			// Path 2/3: 내용만 변경 — 패밀리 일괄 UPDATE(future면 sst_sdate>=현재행)
			var since *string
			if !gsmStrEq(editOptionRaw, "all") && existing.SstSdate != nil { // future
				sd := existing.SstSdate.Format(gsmDTLayout)
				since = &sd
			}
			targets, err := s.repo.SelectFamilyTargets(parentID, since)
			if err != nil {
				return nil, GSMUpdate500
			}
			for _, t := range targets {
				targetData := gsmCopyMap(body)
				gsmApplyDateKeeping(targetData, body, t.SstSdate)
				if uerr := s.updateSingleSchedule(t.SstIdx, targetData); uerr != nil {
					return nil, GSMUpdate500
				}
				updatedCount++
			}
		}
	} else {
		// 일반/this 단일 수정
		if uerr := s.updateSingleSchedule(scheduleID, body); uerr != nil {
			return nil, GSMUpdate500
		}
		updatedCount = 1
	}

	// FCM 알림(action='update', target=기존행 mt_idx). 버그 수정판(대표님 결정).
	title := gsmUpdateTitleStr(body, existing.SstTitle)
	targetMemberID := 0
	if existing.MtIdx != nil {
		targetMemberID = *existing.MtIdx
	}
	s.sendScheduleNotification("update", int64(scheduleID), title, targetMemberID, editorID, editorName)

	return &dto.GSMUpdateResponse{
		Success: true,
		Data: dto.GSMUpdateData{
			Message:      fmt.Sprintf("Successfully updated %d schedule(s)", updatedCount),
			UpdatedCount: updatedCount,
			EditOption:   editOptionRaw,
			EditorID:     editorID,
			EditorName:   editorName,
		},
	}, GSMUpdateOK
}

// updateSingleSchedule은 update_single_schedule(부분 UPDATE)를 이식한다.
// 누락 sdate → 에러(Python ValueError → PUT 500). UPDATE는 non-None 필드만 + sst_udate=NOW().
// ⚠️ sst_location_alarm 기본값 'N'(POST는 '4') + sst_alram 'N' → tinyint(1) 1366 → 둘 다 정수 미제공 시 500.
func (s *GroupScheduleManageService) updateSingleSchedule(scheduleID int, body map[string]interface{}) error {
	titleRaw := body["sst_title"]
	titleStr, isStr := titleRaw.(string)
	if titleRaw != nil && !isStr {
		return fmt.Errorf("object has no attribute 'strip'")
	}
	finalTitle := titleStr
	if strings.TrimSpace(titleStr) == "" {
		finalTitle = "제목 없음"
	}
	if !gsmPyTruthy(body["sst_sdate"]) {
		return errors.New("Start date is required") // ValueError → PUT 500
	}
	sdate, ok := body["sst_sdate"].(string)
	if !ok {
		return fmt.Errorf("argument is not iterable")
	}
	var edate string
	if gsmPyTruthy(body["sst_edate"]) {
		es, ok := body["sst_edate"].(string)
		if !ok {
			return fmt.Errorf("argument is not iterable")
		}
		edate = es
	} else {
		edate = sdate
	}
	sdate = strings.ReplaceAll(sdate, "T", " ")
	edate = strings.ReplaceAll(edate, "T", " ")
	if !strings.Contains(sdate, ":") {
		sdate = sdate + " " + gsmPyStr(gsmGetOr(body, "sst_stime", "00:00:00"))
	}
	if !strings.Contains(edate, ":") {
		edate = edate + " " + gsmPyStr(gsmGetOr(body, "sst_etime", "23:59:59"))
	}
	allDay, _ := body["sst_all_day"].(string)
	repeatJSON, _ := body["sst_repeat_json"].(string)
	repeatJSONV, _ := body["sst_repeat_json_v"].(string)
	if allDay == "Y" {
		repeatJSON = ""
		repeatJSONV = ""
	}
	alarmVal := gsmComputeAlarm(body, sdate)

	// Python all_fields 병합순서(basic→location→alarm→repeat→other→member), value is not None만 SET에 포함.
	type kv struct {
		k string
		v interface{}
	}
	fields := []kv{
		{"sst_title", finalTitle},
		{"sst_sdate", sdate},
		{"sst_edate", edate},
		{"sst_sedate", sdate + " ~ " + edate},
		{"sst_all_day", gsmGetOr(body, "sst_all_day", "N")},
		{"sst_location_title", body["sst_location_title"]},
		{"sst_location_add", body["sst_location_add"]},
		{"sst_location_lat", body["sst_location_lat"]},
		{"sst_location_long", body["sst_location_long"]},
		{"sst_location_alarm", gsmGetOr(body, "sst_location_alarm", "N")}, // ⚠️ POST는 '4', UPDATE는 'N'
		{"sst_alram", gsmGetOr(body, "sst_alram", "N")},
		{"sst_alram_t", body["sst_alram_t"]},
		{"sst_schedule_alarm_chk", gsmGetOr(body, "sst_schedule_alarm_chk", "N")},
		{"sst_pick_type", body["sst_pick_type"]},
		{"sst_pick_result", body["sst_pick_result"]},
		{"sst_schedule_alarm", alarmVal},
		{"sst_repeat_json", repeatJSON},
		{"sst_repeat_json_v", repeatJSONV},
		{"sst_memo", body["sst_memo"]},
		{"sst_supplies", body["sst_supplies"]},
		{"slt_idx", body["slt_idx"]},
		{"slt_idx_t", body["sst_location_add"]},
		{"sst_update_chk", gsmGetOr(body, "sst_update_chk", "3")},
		{"sst_adate", body["sst_adate"]},
	}
	if gsmPyTruthy(body["targetMemberId"]) {
		fields = append(fields, kv{"mt_idx", body["targetMemberId"]})
	}
	if gsmPyTruthy(body["sgdt_idx"]) {
		fields = append(fields, kv{"sgdt_idx", body["sgdt_idx"]})
	}
	cols := make([]string, 0, len(fields))
	vals := make([]interface{}, 0, len(fields))
	for _, f := range fields {
		if f.v != nil { // Python: if value is not None
			cols = append(cols, f.k)
			vals = append(vals, f.v)
		}
	}
	return s.repo.UpdateScheduleDynamic(scheduleID, cols, vals)
}

// updateRepeatPatternTx는 PUT Path4(반복패턴 변경)를 단일 트랜잭션으로 수행한다.
// 패밀리 soft-delete → 새 부모(create_new_schedule) → 반복 재생성(create_recurring) 중 하나라도 실패하면
// 전체 rollback(구 패밀리 'Y' 보존)하여 Python의 세션 commit/rollback 원자성을 충실 재현한다.
// 반환: (updated_count, outcome). outcome!=GSMUpdateOK면 핸들러가 상태로 변환(누락 sdate→400, 그 외→500).
func (s *GroupScheduleManageService) updateRepeatPatternTx(parentID, groupID, userID int, body map[string]interface{}, newRepeatRaw interface{}) (int, GSMUpdateOutcome) {
	tx, err := s.repo.BeginTx()
	if err != nil {
		return 0, GSMUpdate500
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if err := s.repo.SoftDeleteFamilyTx(tx, parentID); err != nil {
		return 0, GSMUpdate500
	}
	newParentID, cerr := s.createNewScheduleTx(tx, groupID, userID, body)
	if cerr != nil {
		if errors.Is(cerr, errGSMStartDate) {
			return 0, GSMUpdate400NoStartDate
		}
		return 0, GSMUpdate500
	}
	newRepeat, _ := newRepeatRaw.(string)
	created, rerr := s.createRecurring(newParentID, body, newRepeat, gsmGetStr(body, "sst_repeat_json_v"),
		func(m map[string]interface{}) error { return s.repo.InsertRecurringTx(tx, m) })
	if rerr != nil {
		return 0, GSMUpdate500
	}
	if err := tx.Commit(); err != nil {
		return 0, GSMUpdate500
	}
	committed = true
	return created + 1, GSMUpdateOK
}

// createNewScheduleTx는 create_new_schedule(PUT Path4 새 부모 생성)을 트랜잭션 ex로 이식한다.
// Python처럼 body를 변형(title/edate 기본값)해 후속 create_recurring(body)가 동일 값을 읽게 한다.
// 누락 sdate → errGSMStartDate(400), 그 외 실패 → 일반 error(500).
func (s *GroupScheduleManageService) createNewScheduleTx(tx *sql.Tx, groupID, userID int, body map[string]interface{}) (int64, error) {
	auth := s.repo.CheckGroupPermission(userID, groupID)
	if auth == nil {
		return 0, fmt.Errorf("Group access denied for user %d in group %d", userID, groupID)
	}
	targetMemberID := userID
	targetSgdtIdx := auth.SgdtIdx
	if gsmPyTruthy(body["targetMemberId"]) {
		tid, err := gsmPyInt(body["targetMemberId"])
		if err != nil {
			return 0, err
		}
		targetMemberID = tid
		if !(gsmEqY(auth.SgdtOwnerChk) || gsmEqY(auth.SgdtLeaderChk)) {
			return 0, fmt.Errorf("Only group owners or leaders can create schedules for other members")
		}
		if ta := s.repo.CheckGroupPermission(targetMemberID, groupID); ta != nil {
			targetSgdtIdx = ta.SgdtIdx
		}
	}
	// create_recurring가 body를 base로 읽으므로 Python schedule_data 변형 재현(title/edate 기본값).
	if ts, ok := body["sst_title"].(string); (ok && strings.TrimSpace(ts) == "") || body["sst_title"] == nil {
		body["sst_title"] = "제목 없음"
	}
	if gsmPyTruthy(body["sst_sdate"]) && !gsmPyTruthy(body["sst_edate"]) {
		body["sst_edate"] = body["sst_sdate"]
	}
	params, outcome, _ := gsmBuildScheduleParams(groupID, targetMemberID, targetSgdtIdx, body)
	if outcome == GSMCreate400NoStartDate {
		return 0, errGSMStartDate
	}
	if outcome != GSMCreateOK {
		return 0, fmt.Errorf("build schedule params failed")
	}
	params["sst_pidx"] = body["sst_pidx"]
	return s.repo.InsertScheduleFullTx(tx, params)
}

// GSMDeleteOutcome은 DELETE 핸들러 분기.
type GSMDeleteOutcome int

const (
	GSMDeleteOK GSMDeleteOutcome = iota
	GSMDelete403GroupDenied
	GSMDelete403DeleteDenied
	GSMDelete404
	GSMDelete500
)

// DeleteGroupSchedule은 DELETE /group/{group_id}/schedules/{schedule_id}를 이식한다(this/all/future).
// body는 Optional(nil 가능). soft-delete(sst_show='N', sst_ddate=NOW()). 500 메시지는 "Internal server error".
func (s *GroupScheduleManageService) DeleteGroupSchedule(groupID, scheduleID int, body map[string]interface{}, userID int) (*dto.GSMDeleteResponse, GSMDeleteOutcome) {
	// editor 추출(body nil이면 nil 읽기 → current_user). gsmResolveEditor가 nil body 안전 처리.
	editorID, editorName := s.gsmResolveEditor(body, userID)

	auth := s.repo.CheckGroupPermission(userID, groupID)
	if auth == nil {
		return nil, GSMDelete403GroupDenied
	}
	existing, err := s.repo.GetScheduleShown(scheduleID)
	if err != nil {
		return nil, GSMDelete500
	}
	if existing == nil {
		return nil, GSMDelete404
	}
	canDelete := (existing.MtIdx != nil && *existing.MtIdx == userID) ||
		gsmEqY(auth.SgdtOwnerChk) || gsmEqY(auth.SgdtLeaderChk)
	if !canDelete {
		return nil, GSMDelete403DeleteDenied
	}

	// delete_option: 'this' 기본. body에 deleteOption 키가 있으면(값이 null이어도) 그 값(Python `in` 검사).
	var deleteOptionRaw interface{} = "this"
	if body != nil {
		if v, ok := body["deleteOption"]; ok {
			deleteOptionRaw = v
		}
	}

	isRepeat := (existing.SstRepeatJSON != nil && strings.TrimSpace(*existing.SstRepeatJSON) != "") ||
		(existing.SstPidx != nil && *existing.SstPidx > 0)

	var deletedCount int64
	if isRepeat && !gsmStrEq(deleteOptionRaw, "this") {
		parentID := scheduleID
		if existing.SstPidx != nil && *existing.SstPidx > 0 {
			parentID = *existing.SstPidx
		}
		if gsmStrEq(deleteOptionRaw, "all") {
			n, derr := s.repo.SoftDeleteAllDdate(parentID)
			if derr != nil {
				return nil, GSMDelete500
			}
			deletedCount = n
		} else if gsmStrEq(deleteOptionRaw, "future") {
			since := ""
			if existing.SstSdate != nil {
				since = existing.SstSdate.Format(gsmDTLayout)
			}
			n, derr := s.repo.SoftDeleteFutureDdate(parentID, since)
			if derr != nil {
				return nil, GSMDelete500
			}
			deletedCount = n
		}
		// 그 외 옵션(예: 'xyz')은 all/future 어디에도 안 걸려 deletedCount=0(Python 동일).
	} else {
		n, derr := s.repo.SoftDeleteSingleDdate(scheduleID)
		if derr != nil {
			return nil, GSMDelete500
		}
		deletedCount = n
	}

	// FCM(action='delete', title=기존행 sst_title, target=기존행 mt_idx). 버그 수정판(대표님 결정).
	title := "None"
	if existing.SstTitle != nil {
		title = *existing.SstTitle
	}
	targetMemberID := 0
	if existing.MtIdx != nil {
		targetMemberID = *existing.MtIdx
	}
	s.sendScheduleNotification("delete", int64(scheduleID), title, targetMemberID, editorID, editorName)

	return &dto.GSMDeleteResponse{
		Success: true,
		Data: dto.GSMDeleteData{
			Message:      fmt.Sprintf("Successfully deleted %d schedule(s)", deletedCount),
			DeletedCount: deletedCount,
			DeleteOption: deleteOptionRaw,
			EditorID:     editorID,
			EditorName:   editorName,
		},
	}, GSMDeleteOK
}

// gsmStrEq는 Python `v == s`(문자열 비교, 타입 불일치는 False).
func gsmStrEq(v interface{}, s string) bool {
	x, ok := v.(string)
	return ok && x == s
}

// gsmReprNeq는 Python `oldStr != newRaw`(old는 항상 str). newRaw가 비문자열/nil이면 항상 不一致(True).
func gsmReprNeq(oldStr string, newRaw interface{}) bool {
	if ns, ok := newRaw.(string); ok {
		return oldStr != ns
	}
	return true
}

// gsmGetStr는 body[key]가 문자열이면 그 값, 아니면 ""(반복 v 텍스트용).
func gsmGetStr(body map[string]interface{}, key string) string {
	if s, ok := body[key].(string); ok {
		return s
	}
	return ""
}

// gsmUpdateTitleStr는 Python get('sst_title', existing)을 str()로 환산(알림 f-string용, Go PushLog에만 영향).
func gsmUpdateTitleStr(body map[string]interface{}, existingTitle *string) string {
	if v, ok := body["sst_title"]; ok {
		return gsmPyStr(v)
	}
	if existingTitle == nil {
		return "None"
	}
	return *existingTitle
}

// gsmApplyDateKeeping은 PUT 일괄수정의 "기존 날짜 유지 + 새 시간만 반영"을 이식한다(try/except → 실패 시 무변경).
func gsmApplyDateKeeping(targetData, body map[string]interface{}, oldSdate *time.Time) {
	if !gsmPyTruthy(body["sst_sdate"]) {
		return
	}
	bs, ok := body["sst_sdate"].(string)
	if !ok || oldSdate == nil {
		return
	}
	newTime, ok := gsmParseDT(strings.ReplaceAll(bs, "T", " "))
	if !ok {
		return
	}
	od := *oldSdate
	targetSdate := time.Date(od.Year(), od.Month(), od.Day(),
		newTime.Hour(), newTime.Minute(), newTime.Second(), 0, od.Location())
	targetData["sst_sdate"] = targetSdate.Format(gsmDTLayout)
	if be, ok := body["sst_edate"].(string); ok && gsmPyTruthy(body["sst_edate"]) {
		if newE, ok := gsmParseDT(strings.ReplaceAll(be, "T", " ")); ok {
			targetData["sst_edate"] = targetSdate.Add(newE.Sub(newTime)).Format(gsmDTLayout)
		}
	}
}

// createRecurring은 create_recurring_schedules(반복 3년)를 이식한다. 실패는 error로 반환하나
// 호출부가 swallow(메인 일정 유지)한다.
// createRecurring은 반복 자식 생성 날짜 알고리즘을 수행하고 각 행을 insert 콜백으로 적재한다.
// POST는 pool(s.repo.InsertRecurring), PUT Path4는 트랜잭션(InsertRecurringTx)을 주입한다.
func (s *GroupScheduleManageService) createRecurring(parentID int64, base map[string]interface{}, repeatJSON, repeatJSONV string, insert func(map[string]interface{}) error) (int, error) {
	config := map[string]interface{}{}
	if repeatJSON != "" {
		dec := json.NewDecoder(strings.NewReader(repeatJSON))
		dec.UseNumber()
		if err := dec.Decode(&config); err != nil {
			return 0, fmt.Errorf("repeat_json decode: %w", err)
		}
	}
	r1raw := config["r1"]
	if !gsmPyTruthy(r1raw) {
		return 0, nil
	}
	r1s, _ := r1raw.(string)
	r2raw := config["r2"]

	bsdate, _ := base["sst_sdate"].(string)
	bedate, _ := base["sst_edate"].(string)
	baseStart, ok1 := gsmParseDT(strings.ReplaceAll(bsdate, "T", " "))
	baseEnd, ok2 := gsmParseDT(strings.ReplaceAll(bedate, "T", " "))
	if !ok1 || !ok2 {
		return 0, fmt.Errorf("invalid base datetime")
	}
	endDate := baseStart.Add(time.Duration(365*3) * 24 * time.Hour)
	created := 0

	// 분기1: 매주 다중 요일(r1=="3" && r2에 콤마)
	if r1s == "3" && gsmPyTruthy(r2raw) && strings.Contains(gsmPyStr(r2raw), ",") {
		var pyWeekdays []int
		for _, part := range strings.Split(gsmPyStr(r2raw), ",") {
			p := strings.TrimSpace(part)
			if !gsmIsAllDigits(p) {
				continue
			}
			wd, _ := strconv.Atoi(p)
			if wd == 7 {
				pyWeekdays = append(pyWeekdays, 6)
			} else {
				pyWeekdays = append(pyWeekdays, wd-1)
			}
		}
		sort.Ints(pyWeekdays)
		baseWeekday := gsmWeekday(baseStart)
		currentWeekStart := baseStart.Add(-time.Duration(baseWeekday) * 24 * time.Hour)
		weekOffset := 0
		for currentWeekStart.Add(time.Duration(weekOffset) * 7 * 24 * time.Hour).Before(endDate) {
			weekMonday := currentWeekStart.Add(time.Duration(weekOffset) * 7 * 24 * time.Hour)
			for _, pw := range pyWeekdays {
				scheduleDate := weekMonday.Add(time.Duration(pw) * 24 * time.Hour)
				if weekOffset == 0 && !scheduleDate.After(baseStart) { // schedule_date <= base_start → skip
					continue
				}
				if !scheduleDate.Before(endDate) { // >= end_date → break
					break
				}
				scheduleStart := time.Date(scheduleDate.Year(), scheduleDate.Month(), scheduleDate.Day(),
					baseStart.Hour(), baseStart.Minute(), baseStart.Second(), 0, scheduleDate.Location())
				scheduleEnd := scheduleStart.Add(baseEnd.Sub(baseStart))
				rp := gsmCopyMap(base)
				rp["sst_pidx"] = parentID
				rp["sst_sdate"] = scheduleStart.Format(gsmDTLayout)
				rp["sst_edate"] = scheduleEnd.Format(gsmDTLayout)
				rp["sst_sedate"] = scheduleStart.Format(gsmDTLayout) + " ~ " + scheduleEnd.Format(gsmDTLayout)
				rp["sst_schedule_alarm"] = gsmRecurringAlarmFromPick(base, scheduleStart)
				if err := insert(rp); err != nil {
					return created, err
				}
				created++
				if created >= 500 {
					break
				}
			}
			if created >= 500 {
				break
			}
			weekOffset++
		}
		return created, nil
	}

	// 분기2: 단일/기타(r1=2매일/3매주단일/4매월/5매년, 그외→0)
	var mode int
	switch r1s {
	case "2":
		mode = 2
	case "3":
		mode = 3
	case "4":
		mode = 4
	case "5":
		mode = 5
	default:
		return 0, nil
	}
	current := baseStart
	for current.Before(endDate) {
		// 먼저 증가(첫 반복=다음 주기)
		switch mode {
		case 2:
			current = current.Add(24 * time.Hour)
		case 3:
			current = current.Add(7 * 24 * time.Hour)
			if gsmPyTruthy(r2raw) && gsmIsAllDigits(gsmPyStr(r2raw)) {
				tw, _ := strconv.Atoi(gsmPyStr(r2raw))
				pw := tw - 1
				if tw == 7 {
					pw = 6
				}
				cw := gsmWeekday(current)
				if cw != pw {
					add := ((pw-cw)%7 + 7) % 7
					if add == 0 {
						add = 7
					}
					current = current.Add(time.Duration(add) * 24 * time.Hour)
				}
			}
		case 4:
			current = gsmAddMonth(current)
		case 5:
			current = current.Add(365 * 24 * time.Hour)
		}
		if !current.Before(endDate) {
			break
		}
		nextEnd := current.Add(baseEnd.Sub(baseStart))
		// 알림: 먼저 base sst_schedule_alarm(문자열) 기반, 없으면 pick 재계산
		var alarmVal interface{} = nil
		if sa, ok := base["sst_schedule_alarm"].(string); ok && sa != "" {
			if baseAlarm, err := time.Parse(gsmDTLayout, sa); err == nil {
				alarmDur := baseStart.Sub(baseAlarm)
				alarmVal = current.Add(-alarmDur).Format(gsmDTLayout)
			}
		}
		if alarmVal == nil && gsmEqYRaw(base["sst_schedule_alarm_chk"]) {
			alarmVal = gsmRecurringAlarmFromPick(base, current)
		}
		rp := gsmCopyMap(base)
		rp["sst_pidx"] = parentID
		rp["sst_sdate"] = current.Format(gsmDTLayout)
		rp["sst_edate"] = nextEnd.Format(gsmDTLayout)
		rp["sst_sedate"] = current.Format(gsmDTLayout) + " ~ " + nextEnd.Format(gsmDTLayout)
		rp["sst_schedule_alarm"] = alarmVal
		if err := insert(rp); err != nil {
			return created, err
		}
		created++
		if created >= 500 {
			break
		}
	}
	return created, nil
}

// sendScheduleNotification은 send_schedule_notification의 "버그 수정판"이다(대표님 결정).
// 원본은 target_member 미정의 NameError로 항상 no-op이나, 여기서는 의도대로 대상 회원을 조회해
// FCM 발송 + push_log 1건을 기록한다. ⚠️ 이로써 Python(0건) 대비 PushLog가 1건 증가한다(DB divergence).
func (s *GroupScheduleManageService) sendScheduleNotification(action string, scheduleID int64, title string, targetMemberID int, editorID, editorName interface{}) {
	if !gsmPyTruthy(editorID) {
		return
	}
	en := editorName
	if !gsmPyTruthy(en) {
		if eid, err := gsmPyInt(editorID); err == nil {
			en = interface{}("알 수 없음")
			if m, e := s.members.GetByID(eid); e == nil && m != nil {
				if m.MtName != nil {
					en = *m.MtName
				} else {
					en = nil
				}
			}
		}
	}
	enStr := gsmPyStr(en) // None → "None"(Python f-string 동등)

	self := gsmIntEq(editorID, targetMemberID)
	var msgTitle, content, condition, memo string
	switch action {
	case "create":
		msgTitle = "🆕 새 일정이 생성되었습니다"
		condition = "일정 생성 알림"
		memo = "다른 멤버가 회원의 일정을 생성했을 때 전송"
		if self {
			content = fmt.Sprintf("회원님의 일정 \"%s\"이(가) 생성되었습니다.", title)
		} else {
			content = fmt.Sprintf("%s님이 일정 \"%s\"을(를) 생성했습니다.", enStr, title)
		}
	case "update":
		msgTitle = "✏️ 일정이 수정되었습니다"
		condition = "일정 수정 알림"
		memo = "다른 멤버가 회원의 일정을 수정했을 때 전송"
		if self {
			content = fmt.Sprintf("회원님의 일정 \"%s\"이(가) 수정되었습니다.", title)
		} else {
			content = fmt.Sprintf("%s님이 일정 \"%s\"을(를) 수정했습니다.", enStr, title)
		}
	case "delete":
		msgTitle = "🗑️ 일정이 삭제되었습니다"
		condition = "일정 삭제 알림"
		memo = "다른 멤버가 회원의 일정을 삭제했을 때 전송"
		if self {
			content = fmt.Sprintf("회원님의 일정 \"%s\"이(가) 삭제되었습니다.", title)
		} else {
			content = fmt.Sprintf("%s님이 일정 \"%s\"을(를) 삭제했습니다.", enStr, title)
		}
	default:
		return
	}

	// 버그 수정판: 대상 회원 조회 → 토큰 확인 → FCM → push_log
	target, err := s.members.GetByID(targetMemberID)
	if err != nil || target == nil {
		return
	}
	rawToken := derefStr(target.MtTokenID)
	if strings.TrimSpace(rawToken) == "" {
		return // Python: 토큰 없으면 FCM/로그 생략(return True)
	}
	status := 2 // 2: 성공, 3: 실패
	if _, sendErr := s.fcm.Send(context.Background(), buildPushMessage(rawToken, msgTitle, content)); sendErr != nil {
		status = 3
	}
	pltType := 2
	now := time.Now()
	sstIdx := int(scheduleID)
	readChk := "N"
	show := "Y"
	_ = s.logs.Create(&model.PushLog{
		PltType:      &pltType,
		MtIdx:        &targetMemberID,
		SstIdx:       &sstIdx,
		PltCondition: &condition,
		PltMemo:      &memo,
		PltTitle:     &msgTitle,
		PltContent:   &content,
		PltSdate:     &now,
		PltStatus:    &status,
		PltReadChk:   &readChk,
		PltShow:      &show,
		PltWdate:     &now,
	})
}

// === Python 호환 헬퍼 ===

// gsmGetOr는 Python dict.get(key, default)(키 부재 시에만 default; 존재-null은 nil).
func gsmGetOr(m map[string]interface{}, key string, def interface{}) interface{} {
	if v, ok := m[key]; ok {
		return v
	}
	return def
}

// gsmEqY는 *string == "Y".
func gsmEqY(p *string) bool { return p != nil && *p == "Y" }

// gsmEqYRaw는 interface{} 값이 문자열 "Y"인지(Python `x == 'Y'`, 타입 불일치는 False).
func gsmEqYRaw(v interface{}) bool {
	s, ok := v.(string)
	return ok && s == "Y"
}

// gsmPyTruthy는 Python 진릿값. UseNumber 디코딩 전제(JSON 숫자→json.Number, 문자열→string).
func gsmPyTruthy(v interface{}) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case json.Number:
		f, err := x.Float64()
		return err == nil && f != 0
	case int:
		return x != 0
	case int64:
		return x != 0
	case float64:
		return x != 0
	default:
		return true
	}
}

// gsmPyStr는 Python str(v). nil→"None"(반복 분기 str(r2)/알림 f-string과 동등).
func gsmPyStr(v interface{}) string {
	switch x := v.(type) {
	case nil:
		return "None"
	case string:
		return x
	case json.Number:
		return string(x)
	case bool:
		if x {
			return "True"
		}
		return "False"
	default:
		return fmt.Sprintf("%v", x)
	}
}

// gsmPyInt는 Python int(v). json.Number(JSON 숫자)는 float 경유 truncate, string은 엄격 파싱.
func gsmPyInt(v interface{}) (int, error) {
	switch x := v.(type) {
	case json.Number:
		f, err := x.Float64()
		if err != nil {
			return 0, fmt.Errorf("invalid literal for int(): '%s'", string(x))
		}
		return int(f), nil
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(x))
		if err != nil {
			return 0, fmt.Errorf("invalid literal for int() with base 10: '%s'", x)
		}
		return n, nil
	case int:
		return x, nil
	case int64:
		return int(x), nil
	case float64:
		return int(x), nil
	case bool:
		if x {
			return 1, nil
		}
		return 0, nil
	default:
		return 0, fmt.Errorf("int() argument must be a number or string")
	}
}

// gsmIntEq는 Python `v == target`(정수 비교). 문자열 등 타입 불일치는 False.
func gsmIntEq(v interface{}, target int) bool {
	switch x := v.(type) {
	case int:
		return x == target
	case int64:
		return int(x) == target
	case json.Number:
		f, err := x.Float64()
		return err == nil && f == float64(target)
	case float64:
		return x == float64(target)
	default:
		return false
	}
}

// gsmParseDT는 Python datetime.fromisoformat 근사(공백 구분, 마이크로초/초/분/날짜만 허용). UTC.
func gsmParseDT(s string) (time.Time, bool) {
	for _, layout := range []string{
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// gsmWeekday는 Python weekday()(월=0..일=6).
func gsmWeekday(t time.Time) int { return (int(t.Weekday()) + 6) % 7 }

// gsmAddMonth는 Python current_date.replace(month+1)(월말 overflow→day=28) 이식.
func gsmAddMonth(t time.Time) time.Time {
	y, m := t.Year(), int(t.Month())
	ny, nm := y, m+1
	if m == 12 {
		ny, nm = y+1, 1
	}
	cand := time.Date(ny, time.Month(nm), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, t.Location())
	if int(cand.Month()) != nm {
		cand = time.Date(ny, time.Month(nm), 28, t.Hour(), t.Minute(), t.Second(), 0, t.Location())
	}
	return cand
}

// gsmIsAllDigits는 Python str.isdigit() 근사(비어있지 않고 전부 0-9).
func gsmIsAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// gsmRecurringAlarmFromPick는 base의 alarm_chk=='Y' + pick_type/pick_result로 ref 기준 알림시각 문자열을 만든다.
// 조건 미충족/파싱 실패 시 nil(Python alarm_time=None).
func gsmRecurringAlarmFromPick(base map[string]interface{}, ref time.Time) interface{} {
	if !gsmEqYRaw(base["sst_schedule_alarm_chk"]) {
		return nil
	}
	if !gsmPyTruthy(base["sst_pick_type"]) || !gsmPyTruthy(base["sst_pick_result"]) {
		return nil
	}
	pr, err := gsmPyInt(base["sst_pick_result"])
	if err != nil {
		return nil
	}
	switch gsmPyStr(base["sst_pick_type"]) {
	case "minute":
		return ref.Add(-time.Duration(pr) * time.Minute).Format(gsmDTLayout)
	case "hour":
		return ref.Add(-time.Duration(pr) * time.Hour).Format(gsmDTLayout)
	case "day":
		return ref.Add(-time.Duration(pr) * 24 * time.Hour).Format(gsmDTLayout)
	}
	return nil
}

// gsmCopyMap은 base_params.copy()(얕은 복사).
func gsmCopyMap(m map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
