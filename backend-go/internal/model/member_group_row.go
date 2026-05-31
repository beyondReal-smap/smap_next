package model

import "time"

// MemberGroupRow는 GET /members/group/{id}의 member_t JOIN smap_group_detail_t 결과
// 한 행을 담는 조회 프로젝션이다(테이블 모델 아님). Python
// `db.query(Member, GroupDetail).join(...)`의 (Member, GroupDetail) 튜플에 대응한다.
// mt_idx 모호성을 피하려고 SELECT에서 member_t.mt_idx만 고르고 group_detail.mt_idx는 제외한다.
type MemberGroupRow struct {
	MtIdx         int        `gorm:"column:mt_idx"`
	MtType        *int       `gorm:"column:mt_type"`
	MtLevel       *int       `gorm:"column:mt_level"`
	MtStatus      *int       `gorm:"column:mt_status"`
	MtID          *string    `gorm:"column:mt_id"`
	MtName        *string    `gorm:"column:mt_name"`
	MtNickname    *string    `gorm:"column:mt_nickname"`
	MtHp          *string    `gorm:"column:mt_hp"`
	MtEmail       *string    `gorm:"column:mt_email"`
	MtBirth       *time.Time `gorm:"column:mt_birth"`
	MtGender      *int       `gorm:"column:mt_gender"`
	MtFile1       *string    `gorm:"column:mt_file1"`
	MtLat         *float64   `gorm:"column:mt_lat"`
	MtLong        *float64   `gorm:"column:mt_long"`
	MtSido        *string    `gorm:"column:mt_sido"`
	MtGu          *string    `gorm:"column:mt_gu"`
	MtDong        *string    `gorm:"column:mt_dong"`
	MtOnboarding  *string    `gorm:"column:mt_onboarding"`
	MtPush1       *string    `gorm:"column:mt_push1"`
	MtPlanCheck   *string    `gorm:"column:mt_plan_check"`
	MtPlanDate    *time.Time `gorm:"column:mt_plan_date"`
	MtWeatherPop  *string    `gorm:"column:mt_weather_pop"`
	MtWeatherSky  *int       `gorm:"column:mt_weather_sky"`
	MtWeatherTmn  *int       `gorm:"column:mt_weather_tmn"`
	MtWeatherTmx  *int       `gorm:"column:mt_weather_tmx"`
	MtWeatherDate *time.Time `gorm:"column:mt_weather_date"`
	MtLdate       *time.Time `gorm:"column:mt_ldate"`
	MtAdate       *time.Time `gorm:"column:mt_adate"`
	SgdtIdx       int        `gorm:"column:sgdt_idx"`
	SgtIdx        *int       `gorm:"column:sgt_idx"`
	SgdtOwnerChk  *string    `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string    `gorm:"column:sgdt_leader_chk"`
	SgdtDischarge *string    `gorm:"column:sgdt_discharge"`
	SgdtGroupChk  *string    `gorm:"column:sgdt_group_chk"`
	SgdtExit      *string    `gorm:"column:sgdt_exit"`
	SgdtShow      *string    `gorm:"column:sgdt_show"`
	SgdtPushChk   *string    `gorm:"column:sgdt_push_chk"`
	SgdtWdate     *time.Time `gorm:"column:sgdt_wdate"`
	SgdtUdate     *time.Time `gorm:"column:sgdt_udate"`
	SgdtDdate     *time.Time `gorm:"column:sgdt_ddate"`
	SgdtXdate     *time.Time `gorm:"column:sgdt_xdate"`
	SgdtAdate     *time.Time `gorm:"column:sgdt_adate"`
}
