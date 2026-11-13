package model

import "time"

// GroupMemberRow는 GET /group-members/member/{group_id}의 3단계 쿼리(기본정보 JOIN + 최신위치
// self-join + member_t fallback)를 조합한 한 행이다(테이블 모델 아님). 위치는 로그 우선,
// 없으면 member_t.mt_lat/long fallback(speed/battery/gps_time은 nil).
type GroupMemberRow struct {
	SgdtIdx       int
	SgtIdx        *int
	MtIdx         int
	SgdtOwnerChk  *string
	SgdtLeaderChk *string
	MtName        *string
	MtNickname    *string
	MtBirth       *time.Time
	MtFile1       *string
	MtGender      *int
	MtStatus      *int
	MtWeatherPop  *string
	MtWeatherTmn  *int
	MtWeatherTmx  *int
	MtWeatherSky  *int
	MtWeatherDate *time.Time
	MltLat        *float64
	MltLong       *float64
	MltSpeed      *float64
	MltBattery    *int
	MltGpsTime    *time.Time
}
