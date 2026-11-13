package dto

// ScheduleResponse는 Python ScheduleResponse(ScheduleBase 상속)와 키/순서·타입이 동일하다.
// sst_location_lat/long은 Decimal→문자열. mt_schedule_idx는 모델 미매핑 → 항상 null.
// 날짜(sst_sdate/edate/adate/schedule_alarm/wdate/udate/ddate)는 서비스에서 isoformat으로 채운다.
type ScheduleResponse struct {
	SstPidx             *int    `json:"sst_pidx"`
	MtIdx               *int    `json:"mt_idx"`
	SstTitle            *string `json:"sst_title"`
	SstSdate            *string `json:"sst_sdate"`
	SstEdate            *string `json:"sst_edate"`
	SstSedate           *string `json:"sst_sedate"`
	SstAllDay           *string `json:"sst_all_day"`
	SstRepeatJSON       *string `json:"sst_repeat_json"`
	SstRepeatJSONV      *string `json:"sst_repeat_json_v"`
	SgtIdx              *int    `json:"sgt_idx"`
	SgdtIdx             *int    `json:"sgdt_idx"`
	SgdtIdxT            *string `json:"sgdt_idx_t"`
	SstAlram            *int    `json:"sst_alram"`
	SstAlramT           *string `json:"sst_alram_t"`
	SstAdate            *string `json:"sst_adate"`
	SltIdx              *int    `json:"slt_idx"`
	SltIdxT             *string `json:"slt_idx_t"`
	SstLocationTitle    *string `json:"sst_location_title"`
	SstLocationAdd      *string `json:"sst_location_add"`
	SstLocationLat      *string `json:"sst_location_lat"`
	SstLocationLong     *string `json:"sst_location_long"`
	SstSupplies         *string `json:"sst_supplies"`
	SstMemo             *string `json:"sst_memo"`
	SstShow             *string `json:"sst_show"`
	SstLocationAlarm    *int    `json:"sst_location_alarm"`
	SstScheduleAlarmChk *string `json:"sst_schedule_alarm_chk"`
	SstPickType         *string `json:"sst_pick_type"`
	SstPickResult       *int    `json:"sst_pick_result"`
	SstScheduleAlarm    *string `json:"sst_schedule_alarm"`
	SstUpdateChk        *string `json:"sst_update_chk"`
	SstInChk            *string `json:"sst_in_chk"`
	SstScheduleChk      *string `json:"sst_schedule_chk"`
	SstEntryCnt         *int    `json:"sst_entry_cnt"`
	SstExitCnt          *int    `json:"sst_exit_cnt"`
	SstIdx              int     `json:"sst_idx"`
	SstWdate            *string `json:"sst_wdate"`
	SstUdate            *string `json:"sst_udate"`
	SstDdate            *string `json:"sst_ddate"`
	MtScheduleIdx       *int    `json:"mt_schedule_idx"` // 모델 미매핑 → 항상 null
}

// ScheduleGroupItem은 GET /schedules/group/{id}의 수동 dict와 키/순서가 동일하다.
// ScheduleResponse와 다름: id=int(sst_idx), mt_schedule_idx=mt_idx, title/location/date 별칭,
// sst_location_lat/long은 float(숫자), 날짜는 isoformat(T)/zero는 "0000-00-00 00:00:00"/null.
type ScheduleGroupItem struct {
	ID                  int      `json:"id"`
	SstPidx             *int     `json:"sst_pidx"`
	MtScheduleIdx       *int     `json:"mt_schedule_idx"`
	Title               *string  `json:"title"`
	Date                *string  `json:"date"`
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
	Location            *string  `json:"location"`
	SstLocationAdd      *string  `json:"sst_location_add"`
	SstLocationLat      *float64 `json:"sst_location_lat"`
	SstLocationLong     *float64 `json:"sst_location_long"`
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
