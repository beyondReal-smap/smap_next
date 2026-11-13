package dto

// GroupMemberItem은 Python get_group_members(GET /group-members/member/{group_id})의 수동 dict와
// 키/순서가 동일하다. mlt_lat/long/speed는 float(숫자, str 아님), mlt_battery는 int,
// mlt_gps_time은 str(datetime)=공백구분, mt_weather_date는 isoformat(T), mt_birth는 str(date).
type GroupMemberItem struct {
	SgdtIdx       int      `json:"sgdt_idx"`
	SgtIdx        *int     `json:"sgt_idx"`
	MtIdx         int      `json:"mt_idx"`
	SgdtOwnerChk  *string  `json:"sgdt_owner_chk"`
	SgdtLeaderChk *string  `json:"sgdt_leader_chk"`
	MtName        *string  `json:"mt_name"`
	MtNickname    *string  `json:"mt_nickname"`
	MtBirth       *string  `json:"mt_birth"`
	MtFile1       *string  `json:"mt_file1"`
	MtGender      *int     `json:"mt_gender"`
	MtStatus      *int     `json:"mt_status"`
	MtWeatherPop  *string  `json:"mt_weather_pop"`
	MtWeatherTmn  *int     `json:"mt_weather_tmn"`
	MtWeatherTmx  *int     `json:"mt_weather_tmx"`
	MtWeatherSky  *int     `json:"mt_weather_sky"`
	MtWeatherDate *string  `json:"mt_weather_date"`
	MltLat        *float64 `json:"mlt_lat"`
	MltLong       *float64 `json:"mlt_long"`
	MltSpeed      *PyFloat `json:"mlt_speed"`
	MltBattery    *int     `json:"mlt_battery"`
	MltGpsTime    *string  `json:"mlt_gps_time"`
	ID            string   `json:"id"`
	Name          *string  `json:"name"`
	Photo         *string  `json:"photo"`
	IsSelected    bool     `json:"isSelected"`
}
