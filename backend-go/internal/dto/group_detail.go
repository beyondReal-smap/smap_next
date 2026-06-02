package dto

// GroupDetailResponse는 Python GroupDetailResponse(GroupDetailBase 상속)와 키/순서·타입이 동일하다.
// ⚠️ 스키마-모델 불일치(Python 운영 동작 그대로 이식): GroupDetailBase가 선언한
// sgdt_discharge_chk/sgdt_exit_chk/sgdt_in_chk/sgdt_schedule_chk/sgdt_read_chk/
// sgdt_enter_alarm/sgdt_enter_chk 7개는 ORM 모델(smap_group_detail_t)에 대응 컬럼이 없어
// from_attributes가 기본값 None을 채운다 → 항상 null로 직렬화된다(여기서도 nil 포인터로 남겨 둠).
// 반대로 모델의 sgdt_discharge/sgdt_exit/sgdt_show/sgdt_ddate 등은 이 응답에 포함되지 않는다.
// Pydantic v2 순서: 부모(Base) 필드 먼저 → 자식(sgdt_idx/wdate/udate).
type GroupDetailResponse struct {
	SgtIdx           *int    `json:"sgt_idx"`
	MtIdx            *int    `json:"mt_idx"`
	SgdtOwnerChk     *string `json:"sgdt_owner_chk"`
	SgdtLeaderChk    *string `json:"sgdt_leader_chk"`
	SgdtDischargeChk *string `json:"sgdt_discharge_chk"` // 모델 미매핑 → 항상 null
	SgdtGroupChk     *string `json:"sgdt_group_chk"`
	SgdtExitChk      *string `json:"sgdt_exit_chk"` // 모델 미매핑 → 항상 null
	SgdtPushChk      *string `json:"sgdt_push_chk"`
	SgdtInChk        *string `json:"sgdt_in_chk"`       // 모델 미매핑 → 항상 null
	SgdtScheduleChk  *string `json:"sgdt_schedule_chk"` // 모델 미매핑 → 항상 null
	SgdtReadChk      *string `json:"sgdt_read_chk"`     // 모델 미매핑 → 항상 null
	SgdtEnterAlarm   *string `json:"sgdt_enter_alarm"`  // 모델 미매핑 → 항상 null
	SgdtEnterChk     *string `json:"sgdt_enter_chk"`    // 모델 미매핑 → 항상 null
	SgdtIdx          int     `json:"sgdt_idx"`
	SgdtWdate        *PyTime `json:"sgdt_wdate"`
	SgdtUdate        *PyTime `json:"sgdt_udate"`
}

// GroupDetailMemberItem은 Python get_member_group_details의 수동 dict(List[dict])와 키/순서가
// 동일하다. GroupDetailResponse와 달리 실제 모델 컬럼(sgdt_discharge/exit/show)을 쓰고
// null→'N'/'Y' 폴백, 날짜는 isoformat 또는 ”(ddate/xdate/adate) / utcnow(wdate/udate)로 채운다.
type GroupDetailMemberItem struct {
	SgdtIdx       int    `json:"sgdt_idx"`
	SgtIdx        *int   `json:"sgt_idx"`
	MtIdx         *int   `json:"mt_idx"`
	SgdtOwnerChk  string `json:"sgdt_owner_chk"`
	SgdtLeaderChk string `json:"sgdt_leader_chk"`
	SgdtDischarge string `json:"sgdt_discharge"`
	SgdtGroupChk  string `json:"sgdt_group_chk"`
	SgdtExit      string `json:"sgdt_exit"`
	SgdtShow      string `json:"sgdt_show"`
	SgdtPushChk   string `json:"sgdt_push_chk"`
	SgdtWdate     string `json:"sgdt_wdate"`
	SgdtUdate     string `json:"sgdt_udate"`
	SgdtDdate     string `json:"sgdt_ddate"`
	SgdtXdate     string `json:"sgdt_xdate"`
	SgdtAdate     string `json:"sgdt_adate"`
}

// GroupDetailWriteResponse는 role/remove의 {success, message, data} 응답(키 순서 고정).
type GroupDetailWriteResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// GroupDetailRoleData는 PUT /{id}/role의 data: {sgdt_idx, sgdt_leader_chk, sgdt_udate(isoformat)}.
type GroupDetailRoleData struct {
	SgdtIdx       int     `json:"sgdt_idx"`
	SgdtLeaderChk *string `json:"sgdt_leader_chk"`
	SgdtUdate     string  `json:"sgdt_udate"`
}

// GroupDetailRemoveData는 PUT /{id}/remove의 data: {sgdt_idx, sgdt_show, sgdt_exit, sgdt_udate(isoformat)}.
type GroupDetailRemoveData struct {
	SgdtIdx   int     `json:"sgdt_idx"`
	SgdtShow  *string `json:"sgdt_show"`
	SgdtExit  *string `json:"sgdt_exit"`
	SgdtUdate string  `json:"sgdt_udate"`
}
