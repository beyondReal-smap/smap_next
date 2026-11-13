package model

import "time"

// Schedule은 Python `app/models/schedule.py`의 Schedule(테이블 smap_schedule_t)와 대응한다.
// ⚠️ sst_location_lat/long은 DECIMAL → Pydantic Decimal→JSON 문자열이므로 *string으로 읽는다.
type Schedule struct {
	SstIdx              int        `gorm:"column:sst_idx;primaryKey;autoIncrement"`
	SstPidx             *int       `gorm:"column:sst_pidx"`
	MtIdx               *int       `gorm:"column:mt_idx"`
	SstTitle            *string    `gorm:"column:sst_title"`
	SstSdate            *time.Time `gorm:"column:sst_sdate"`
	SstEdate            *time.Time `gorm:"column:sst_edate"`
	SstSedate           *string    `gorm:"column:sst_sedate"`
	SstAllDay           *string    `gorm:"column:sst_all_day"`
	SstRepeatJSON       *string    `gorm:"column:sst_repeat_json"`
	SstRepeatJSONV      *string    `gorm:"column:sst_repeat_json_v"`
	SgtIdx              *int       `gorm:"column:sgt_idx"`
	SgdtIdx             *int       `gorm:"column:sgdt_idx"`
	SgdtIdxT            *string    `gorm:"column:sgdt_idx_t"`
	SstAlram            *int       `gorm:"column:sst_alram"`
	SstAlramT           *string    `gorm:"column:sst_alram_t"`
	SstAdate            *time.Time `gorm:"column:sst_adate"`
	SltIdx              *int       `gorm:"column:slt_idx"`
	SltIdxT             *string    `gorm:"column:slt_idx_t"`
	SstLocationTitle    *string    `gorm:"column:sst_location_title"`
	SstLocationAdd      *string    `gorm:"column:sst_location_add"`
	SstLocationLat      *string    `gorm:"column:sst_location_lat"`  // DECIMAL → 문자열
	SstLocationLong     *string    `gorm:"column:sst_location_long"` // DECIMAL → 문자열
	SstSupplies         *string    `gorm:"column:sst_supplies"`
	SstMemo             *string    `gorm:"column:sst_memo"`
	SstShow             *string    `gorm:"column:sst_show"`
	SstLocationAlarm    *int       `gorm:"column:sst_location_alarm"`
	SstScheduleAlarmChk *string    `gorm:"column:sst_schedule_alarm_chk"`
	SstPickType         *string    `gorm:"column:sst_pick_type"`
	SstPickResult       *int       `gorm:"column:sst_pick_result"`
	SstScheduleAlarm    *time.Time `gorm:"column:sst_schedule_alarm"`
	SstUpdateChk        *string    `gorm:"column:sst_update_chk"`
	SstWdate            *time.Time `gorm:"column:sst_wdate"`
	SstUdate            *time.Time `gorm:"column:sst_udate"`
	SstDdate            *time.Time `gorm:"column:sst_ddate"`
	SstInChk            *string    `gorm:"column:sst_in_chk"`
	SstScheduleChk      *string    `gorm:"column:sst_schedule_chk"`
	SstEntryCnt         *int       `gorm:"column:sst_entry_cnt"`
	SstExitCnt          *int       `gorm:"column:sst_exit_cnt"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Schedule) TableName() string { return "smap_schedule_t" }
