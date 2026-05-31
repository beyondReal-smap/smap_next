package model

import "time"

// Member는 Python `app/models/member.py`의 Member(테이블 member_t)와 1:1 대응한다(전체 컬럼).
// weather/admin/members/users read 엔드포인트가 사용한다. nullable 컬럼은 포인터로 둔다.
// mt_lat/mt_long은 DECIMAL이라 float64로 스캔(드라이버 문자열→ParseFloat = Python float(Decimal)).
// ⚠️ users 도메인의 full-dump 엔드포인트(/users/email,/token,recent/signin)는 이 전체 컬럼을
// 노출한다(mt_pwd 등 시크릿 포함) — Python 동작 그대로 이식.
type Member struct {
	MtIdx              int        `gorm:"column:mt_idx;primaryKey;autoIncrement"`
	MtType             *int       `gorm:"column:mt_type"`
	MtLevel            *int       `gorm:"column:mt_level"`
	MtRecommendChk     *string    `gorm:"column:mt_recommend_chk"`
	MtLastReceiptToken *string    `gorm:"column:mt_last_receipt_token"`
	MtPlanDate         *time.Time `gorm:"column:mt_plan_date"`
	MtPlanCheck        *string    `gorm:"column:mt_plan_check"`
	MtOsCheck          *int       `gorm:"column:mt_os_check"`
	MtRecDate          *time.Time `gorm:"column:mt_rec_date"`
	MtStatus           *int       `gorm:"column:mt_status"`
	MtID               *string    `gorm:"column:mt_id"`
	MtIDRetire         *string    `gorm:"column:mt_id_retire"`
	MtPwd              *string    `gorm:"column:mt_pwd"`
	MtPwdCnt           *int       `gorm:"column:mt_pwd_cnt"`
	MtTokenID          *string    `gorm:"column:mt_token_id"`
	MtTokenUpdatedAt   *time.Time `gorm:"column:mt_token_updated_at"`
	MtTokenExpiryDate  *time.Time `gorm:"column:mt_token_expiry_date"`
	MtName             *string    `gorm:"column:mt_name"`
	MtNickname         *string    `gorm:"column:mt_nickname"`
	MtHp               *string    `gorm:"column:mt_hp"`
	MtEmail            *string    `gorm:"column:mt_email"`
	MtBirth            *time.Time `gorm:"column:mt_birth"` // DATE
	MtGender           *int       `gorm:"column:mt_gender"`
	MtFile1            *string    `gorm:"column:mt_file1"`
	MtShow             *string    `gorm:"column:mt_show"`
	MtAgree1           *string    `gorm:"column:mt_agree1"`
	MtAgree2           *string    `gorm:"column:mt_agree2"`
	MtAgree3           *string    `gorm:"column:mt_agree3"`
	MtAgree4           *string    `gorm:"column:mt_agree4"`
	MtAgree5           *string    `gorm:"column:mt_agree5"`
	MtPush1            *string    `gorm:"column:mt_push1"`
	MtLat              *float64   `gorm:"column:mt_lat"`  // DECIMAL(16,14)
	MtLong             *float64   `gorm:"column:mt_long"` // DECIMAL(17,14)
	MtSido             *string    `gorm:"column:mt_sido"`
	MtGu               *string    `gorm:"column:mt_gu"`
	MtDong             *string    `gorm:"column:mt_dong"`
	MtOnboarding       *string    `gorm:"column:mt_onboarding"`
	MtWeatherPop       *string    `gorm:"column:mt_weather_pop"`
	MtWeatherSky       *int       `gorm:"column:mt_weather_sky"`
	MtWeatherTmn       *int       `gorm:"column:mt_weather_tmn"`
	MtWeatherTmx       *int       `gorm:"column:mt_weather_tmx"`
	MtWeatherDate      *time.Time `gorm:"column:mt_weather_date"`
	MtWdate            *time.Time `gorm:"column:mt_wdate"`
	MtLdate            *time.Time `gorm:"column:mt_ldate"`
	MtLgdate           *time.Time `gorm:"column:mt_lgdate"`
	MtRetireChk        *int       `gorm:"column:mt_retire_chk"`
	MtRetireEtc        *string    `gorm:"column:mt_retire_etc"`
	MtRetireLevel      *int       `gorm:"column:mt_retire_level"`
	MtRdate            *time.Time `gorm:"column:mt_rdate"`
	MtAdate            *time.Time `gorm:"column:mt_adate"`
	MtUdate            *time.Time `gorm:"column:mt_udate"`
	MtUpdateDt         *time.Time `gorm:"column:mt_update_dt"`
	MtResetToken       *string    `gorm:"column:mt_reset_token"`
	MtTokenEdate       *time.Time `gorm:"column:mt_token_edate"`
	MtLang             *string    `gorm:"column:mt_lang"`
	MtMap              *string    `gorm:"column:mt_map"`
	MtRememberToken    *string    `gorm:"column:mt_remember_token"`
	MtTokenExpiry      *time.Time `gorm:"column:mt_token_expiry"`
	MtGoogleID         *string    `gorm:"column:mt_google_id"`
	MtKakaoID          *string    `gorm:"column:mt_kakao_id"`
	MtAppleID          *string    `gorm:"column:mt_apple_id"`
	MtDeviceID         *string    `gorm:"column:mt_device_id"`
	MtDeviceModel      *string    `gorm:"column:mt_device_model"`
	MtOsVersion        *string    `gorm:"column:mt_os_version"`
	MtAppVersion       *string    `gorm:"column:mt_app_version"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Member) TableName() string { return "member_t" }
