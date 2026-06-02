package dto

// group-schedule-manage(/schedule) read 응답 DTO.
// Python dict 삽입 순서를 그대로 보존하기 위해 모든 응답을 순서고정 struct로 정의한다.
// datetime 필드는 *string으로 받고, 변환 방식(str 공백 vs isoformat T)은 service가 결정한다.

// GSMScheduleBase는 BASE38 키순서(test-all-columns/group/owner 공통 머리).
type GSMScheduleBase struct {
	SstIdx              int      `json:"sst_idx"`
	SstPidx             *int     `json:"sst_pidx"`
	MtIdx               *int     `json:"mt_idx"`
	SstTitle            *string  `json:"sst_title"`
	SstSdate            *string  `json:"sst_sdate"`
	SstEdate            *string  `json:"sst_edate"`
	SstSedate           *string  `json:"sst_sedate"`
	SstAllDay           *string  `json:"sst_all_day"`
	SstRepeatJSON       *string  `json:"sst_repeat_json"`
	SstRepeatJSONV      *string  `json:"sst_repeat_json_v"`
	SgtIdx              *int     `json:"sgt_idx"`
	SgdtIdx             *int     `json:"sgdt_idx"`
	SgdtIdxT            *string  `json:"sgdt_idx_t"`
	SstAlram            *int     `json:"sst_alram"`
	SstAlramT           *string  `json:"sst_alram_t"`
	SstAdate            *string  `json:"sst_adate"`
	SltIdx              *int     `json:"slt_idx"`
	SltIdxT             *string  `json:"slt_idx_t"`
	SstLocationTitle    *string  `json:"sst_location_title"`
	SstLocationAdd      *string  `json:"sst_location_add"`
	SstLocationLat      *PyFloat `json:"sst_location_lat"`
	SstLocationLong     *PyFloat `json:"sst_location_long"`
	SstSupplies         *string  `json:"sst_supplies"`
	SstMemo             *string  `json:"sst_memo"`
	SstShow             *string  `json:"sst_show"`
	SstLocationAlarm    *int     `json:"sst_location_alarm"`
	SstScheduleAlarmChk *string  `json:"sst_schedule_alarm_chk"`
	SstPickType         *string  `json:"sst_pick_type"`
	SstPickResult       *int     `json:"sst_pick_result"`
	SstScheduleAlarm    *string  `json:"sst_schedule_alarm"`
	SstUpdateChk        *string  `json:"sst_update_chk"`
	SstWdate            *string  `json:"sst_wdate"`
	SstUdate            *string  `json:"sst_udate"`
	SstDdate            *string  `json:"sst_ddate"`
	SstInChk            *string  `json:"sst_in_chk"`
	SstScheduleChk      *string  `json:"sst_schedule_chk"`
	SstEntryCnt         *int     `json:"sst_entry_cnt"`
	SstExitCnt          *int     `json:"sst_exit_cnt"`
}

// === test-all-columns ===

// GSMTestColumnsResponse는 GET /test-all-columns 성공 응답.
type GSMTestColumnsResponse struct {
	Success      bool            `json:"success"`
	Data         GSMScheduleBase `json:"data"`
	TotalColumns int             `json:"total_columns"`
	ColumnNames  []string        `json:"column_names"`
}

// GSMFailMessage는 {success:false, message:...}(없음 분기). 키순서 보존.
type GSMFailMessage struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// GSMFailError는 {success:false, error:...}(except 분기). 키순서 보존.
type GSMFailError struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

// === group/{group_id}/schedules ===

// GSMGroupSchedule은 group-schedules의 schedule 항목(BASE38 + member/프론트호환 꼬리).
type GSMGroupSchedule struct {
	GSMScheduleBase
	MemberName  *string `json:"member_name"`
	MemberPhoto *string `json:"member_photo"`
	ID          string  `json:"id"`
	Title       *string `json:"title"`
	Date        *string `json:"date"`
	Location    *string `json:"location"`
	MemberID    string  `json:"memberId"`
}

// GSMGroupMember는 get_group_members 항목(mt_file1은 COALESCE ” → 항상 문자열).
type GSMGroupMember struct {
	MtIdx         int     `json:"mt_idx"`
	MtName        *string `json:"mt_name"`
	MtFile1       string  `json:"mt_file1"`
	SgtIdx        *int    `json:"sgt_idx"`
	SgdtIdx       int     `json:"sgdt_idx"`
	SgdtOwnerChk  *string `json:"sgdt_owner_chk"`
	SgdtLeaderChk *string `json:"sgdt_leader_chk"`
}

// GSMUserPermission은 group-schedules의 userPermission.
type GSMUserPermission struct {
	CanManage bool `json:"canManage"`
	IsOwner   bool `json:"isOwner"`
	IsLeader  bool `json:"isLeader"`
}

// GSMGroupSchedulesData / Response.
type GSMGroupSchedulesData struct {
	Schedules      []GSMGroupSchedule `json:"schedules"`
	GroupMembers   []GSMGroupMember   `json:"groupMembers"`
	UserPermission GSMUserPermission  `json:"userPermission"`
}

type GSMGroupSchedulesResponse struct {
	Success bool                  `json:"success"`
	Data    GSMGroupSchedulesData `json:"data"`
}

// === owner-groups/all-schedules ===

// GSMOwnerSchedule은 owner-groups의 schedule 항목(BASE38 + 거리/타겟/그룹/프론트 꼬리).
type GSMOwnerSchedule struct {
	GSMScheduleBase
	SchCalcDist      *PyFloat `json:"sch_calc_dist"`
	MemberName       *string  `json:"member_name"`
	MemberPhoto      *string  `json:"member_photo"`
	GroupTitle       *string  `json:"group_title"`
	TgtMtIdx         *int     `json:"tgt_mt_idx"`
	TgtSgdtOwnerChk  *string  `json:"tgt_sgdt_owner_chk"`
	TgtSgdtLeaderChk *string  `json:"tgt_sgdt_leader_chk"`
	TgtSgdtIdx       *int     `json:"tgt_sgdt_idx"`
	ID               string   `json:"id"`
	Title            *string  `json:"title"`
	Date             *string  `json:"date"`
	Location         *string  `json:"location"`
	MemberID         string   `json:"memberId"`
}

// GSMOwnerGroup은 owner_groups 쿼리 항목.
type GSMOwnerGroup struct {
	SgtIdx        int     `json:"sgt_idx"`
	SgtTitle      *string `json:"sgt_title"`
	SgdtIdx       int     `json:"sgdt_idx"`
	SgdtOwnerChk  *string `json:"sgdt_owner_chk"`
	SgdtLeaderChk *string `json:"sgdt_leader_chk"`
	MtIdx         *int    `json:"mt_idx"`
}

// GSMQueryPeriod / GSMDebugInfo / GSMUserLocation.
type GSMQueryPeriod struct {
	Year      int    `json:"year"`
	Month     int    `json:"month"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

// GSMDebugInfo의 originalYear/Month는 요청 파라미터(미제공 시 null).
type GSMDebugInfo struct {
	OriginalYear        *int   `json:"originalYear"`
	OriginalMonth       *int   `json:"originalMonth"`
	FinalYear           int    `json:"finalYear"`
	FinalMonth          int    `json:"finalMonth"`
	NextYear            int    `json:"nextYear"`
	NextMonth           int    `json:"nextMonth"`
	CalculatedStartDate string `json:"calculatedStartDate"`
	CalculatedEndDate   string `json:"calculatedEndDate"`
}

type GSMUserLocation struct {
	Lat *PyFloat `json:"lat"`
	Lng *PyFloat `json:"lng"`
}

// GSMOwnerSchedulesData / Response. UserLocation은 lat/lng 둘 다 있을 때만(아니면 null).
type GSMOwnerSchedulesData struct {
	Schedules      []GSMOwnerSchedule `json:"schedules"`
	OwnerGroups    []GSMOwnerGroup    `json:"ownerGroups"`
	TotalSchedules int                `json:"totalSchedules"`
	QueryPeriod    GSMQueryPeriod     `json:"queryPeriod"`
	DebugInfo      GSMDebugInfo       `json:"debugInfo"`
	UserLocation   *GSMUserLocation   `json:"userLocation"`
	UserPermission GSMUserPermission  `json:"userPermission"`
}

type GSMOwnerSchedulesResponse struct {
	Success bool                  `json:"success"`
	Data    GSMOwnerSchedulesData `json:"data"`
}

// === POST group/{group_id}/schedules (생성) ===

// GSMCreateData는 생성 성공 응답의 data. editor_id/editor_name은 Python이 body 값(JSON 타입)을
// 그대로 직렬화하거나 current_user_id(int)/조회된 mt_name(*string)을 담으므로 interface{}로 보존한다.
type GSMCreateData struct {
	SstIdx         int64       `json:"sst_idx"`
	Message        string      `json:"message"`
	TargetMemberID int         `json:"target_member_id"`
	EditorID       interface{} `json:"editor_id"`
	EditorName     interface{} `json:"editor_name"`
}

// GSMCreateResponse는 POST 성공 응답({success:true, data:{...}}). 키순서 보존.
type GSMCreateResponse struct {
	Success bool          `json:"success"`
	Data    GSMCreateData `json:"data"`
}

// === PUT group/{group_id}/schedules/{schedule_id} (반복옵션 수정) ===

// GSMUpdateData는 수정 성공 응답의 data. edit_option/editor_id/editor_name은 body 값(JSON 타입)을 보존.
type GSMUpdateData struct {
	Message      string      `json:"message"`
	UpdatedCount int         `json:"updated_count"`
	EditOption   interface{} `json:"edit_option"`
	EditorID     interface{} `json:"editor_id"`
	EditorName   interface{} `json:"editor_name"`
}

// GSMUpdateResponse는 PUT 성공 응답({success:true, data:{...}}). 키순서 보존.
type GSMUpdateResponse struct {
	Success bool          `json:"success"`
	Data    GSMUpdateData `json:"data"`
}

// === DELETE group/{group_id}/schedules/{schedule_id} (반복옵션 삭제) ===

// GSMDeleteData는 삭제 성공 응답의 data. delete_option/editor_id/editor_name은 body 값(JSON 타입)을 보존.
type GSMDeleteData struct {
	Message      string      `json:"message"`
	DeletedCount int64       `json:"deleted_count"`
	DeleteOption interface{} `json:"delete_option"`
	EditorID     interface{} `json:"editor_id"`
	EditorName   interface{} `json:"editor_name"`
}

// GSMDeleteResponse는 DELETE 성공 응답({success:true, data:{...}}). 키순서 보존.
type GSMDeleteResponse struct {
	Success bool          `json:"success"`
	Data    GSMDeleteData `json:"data"`
}

// === debug/schedule/{schedule_id} ===

// GSMDebugTarget은 target_schedule(10필드, datetime=str 공백).
type GSMDebugTarget struct {
	SstIdx         int     `json:"sst_idx"`
	SstPidx        *int    `json:"sst_pidx"`
	MtIdx          *int    `json:"mt_idx"`
	SstTitle       *string `json:"sst_title"`
	SstSdate       *string `json:"sst_sdate"`
	SstEdate       *string `json:"sst_edate"`
	SstRepeatJSON  *string `json:"sst_repeat_json"`
	SstRepeatJSONV *string `json:"sst_repeat_json_v"`
	SstShow        *string `json:"sst_show"`
	SstWdate       *string `json:"sst_wdate"`
}

// GSMDebugRelated는 related_schedules 항목(5필드).
type GSMDebugRelated struct {
	SstIdx        int     `json:"sst_idx"`
	SstPidx       *int    `json:"sst_pidx"`
	SstTitle      *string `json:"sst_title"`
	SstSdate      *string `json:"sst_sdate"`
	SstRepeatJSON *string `json:"sst_repeat_json"`
}

type GSMDebugData struct {
	TargetSchedule   GSMDebugTarget    `json:"target_schedule"`
	RelatedSchedules []GSMDebugRelated `json:"related_schedules"`
	TotalRelated     int               `json:"total_related"`
	ParentID         int               `json:"parent_id"`
}

type GSMDebugResponse struct {
	Success bool         `json:"success"`
	Data    GSMDebugData `json:"data"`
}
