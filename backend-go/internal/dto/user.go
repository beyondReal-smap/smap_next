package dto

// UserResponse는 GET /users/ 와 /users/{id}의 response_model=MemberResponse 직렬화와 동일하다.
// /members/{id}와 달리 ORM 값을 그대로 읽으므로(딕셔너리 폴백 없음) nullable 필드는 raw null이다.
// mt_id/mt_name/mt_nickname은 MemberResponse 필수(str) — null이면 Python이 500이므로
// 이 DTO로 직렬화되는 시점엔 항상 non-null(핸들러가 사전 검사 후 500 처리). 필드 순서는
// MemberBase→MemberResponse(실측: /users/2584).
type UserResponse struct {
	MtType       *int     `json:"mt_type"`
	MtLevel      *int     `json:"mt_level"`
	MtStatus     *int     `json:"mt_status"`
	MtID         string   `json:"mt_id"`
	MtName       string   `json:"mt_name"`
	MtNickname   string   `json:"mt_nickname"`
	MtHp         *string  `json:"mt_hp"`
	MtEmail      *string  `json:"mt_email"`
	MtBirth      *string  `json:"mt_birth"`
	MtGender     *int     `json:"mt_gender"`
	MtShow       *string  `json:"mt_show"`
	MtAgree1     *string  `json:"mt_agree1"`
	MtAgree2     *string  `json:"mt_agree2"`
	MtAgree3     *string  `json:"mt_agree3"`
	MtAgree4     *string  `json:"mt_agree4"`
	MtAgree5     *string  `json:"mt_agree5"`
	MtPush1      *string  `json:"mt_push1"`
	MtLat        *float64 `json:"mt_lat"`
	MtLong       *float64 `json:"mt_long"`
	MtOnboarding *string  `json:"mt_onboarding"`
	MtIdx        int      `json:"mt_idx"`
	MtFile1      *string  `json:"mt_file1"`
	MtWdate      *string  `json:"mt_wdate"`
	MtLdate      *string  `json:"mt_ldate"`
	MtUdate      *string  `json:"mt_udate"`
}

// UserFullDump은 response_model이 없는 users 엔드포인트(/users/email, /token, recent/signin)가
// ORM Member를 jsonable_encoder로 덤프한 결과와 동일하다. ⚠️ 전체 컬럼(mt_pwd·mt_reset_token·
// mt_token_id·mt_remember_token 등 시크릿 포함)을 노출하며, 키 순서는 SQLAlchemy `vars(member)`
// (__dict__) 순서다(현재 코드 기준 실측 — 모델 컬럼 변경 시 깨질 수 있는 취약 의존). 날짜는
// 서비스에서 isoformat 문자열로 변환해 채운다.
type UserFullDump struct {
	MtID               *string  `json:"mt_id"`
	MtNickname         *string  `json:"mt_nickname"`
	MtAgree1           *string  `json:"mt_agree1"`
	MtGu               *string  `json:"mt_gu"`
	MtWdate            *string  `json:"mt_wdate"`
	MtUdate            *string  `json:"mt_udate"`
	MtTokenExpiry      *string  `json:"mt_token_expiry"`
	MtType             *int     `json:"mt_type"`
	MtRecommendChk     *string  `json:"mt_recommend_chk"`
	MtIDRetire         *string  `json:"mt_id_retire"`
	MtHp               *string  `json:"mt_hp"`
	MtAgree2           *string  `json:"mt_agree2"`
	MtDong             *string  `json:"mt_dong"`
	MtLdate            *string  `json:"mt_ldate"`
	MtUpdateDt         *string  `json:"mt_update_dt"`
	MtGoogleID         *string  `json:"mt_google_id"`
	MtLastReceiptToken *string  `json:"mt_last_receipt_token"`
	MtPwd              *string  `json:"mt_pwd"`
	MtEmail            *string  `json:"mt_email"`
	MtAgree3           *string  `json:"mt_agree3"`
	MtOnboarding       *string  `json:"mt_onboarding"`
	MtLgdate           *string  `json:"mt_lgdate"`
	MtResetToken       *string  `json:"mt_reset_token"`
	MtKakaoID          *string  `json:"mt_kakao_id"`
	MtPlanDate         *string  `json:"mt_plan_date"`
	MtPwdCnt           *int     `json:"mt_pwd_cnt"`
	MtBirth            *string  `json:"mt_birth"`
	MtAgree4           *string  `json:"mt_agree4"`
	MtWeatherPop       *string  `json:"mt_weather_pop"`
	MtRetireChk        *int     `json:"mt_retire_chk"`
	MtTokenEdate       *string  `json:"mt_token_edate"`
	MtAppleID          *string  `json:"mt_apple_id"`
	MtPlanCheck        *string  `json:"mt_plan_check"`
	MtTokenID          *string  `json:"mt_token_id"`
	MtGender           *int     `json:"mt_gender"`
	MtAgree5           *string  `json:"mt_agree5"`
	MtWeatherSky       *int     `json:"mt_weather_sky"`
	MtRetireEtc        *string  `json:"mt_retire_etc"`
	MtLang             *string  `json:"mt_lang"`
	MtDeviceID         *string  `json:"mt_device_id"`
	MtOsCheck          *int     `json:"mt_os_check"`
	MtTokenUpdatedAt   *string  `json:"mt_token_updated_at"`
	MtFile1            *string  `json:"mt_file1"`
	MtPush1            *string  `json:"mt_push1"`
	MtWeatherTmn       *int     `json:"mt_weather_tmn"`
	MtRetireLevel      *int     `json:"mt_retire_level"`
	MtMap              *string  `json:"mt_map"`
	MtDeviceModel      *string  `json:"mt_device_model"`
	MtRecDate          *string  `json:"mt_rec_date"`
	MtTokenExpiryDate  *string  `json:"mt_token_expiry_date"`
	MtShow             *string  `json:"mt_show"`
	MtLat              *float64 `json:"mt_lat"`
	MtWeatherTmx       *int     `json:"mt_weather_tmx"`
	MtRdate            *string  `json:"mt_rdate"`
	MtRememberToken    *string  `json:"mt_remember_token"`
	MtOsVersion        *string  `json:"mt_os_version"`
	MtName             *string  `json:"mt_name"`
	MtLevel            *int     `json:"mt_level"`
	MtIdx              int      `json:"mt_idx"`
	MtStatus           *int     `json:"mt_status"`
	MtLong             *float64 `json:"mt_long"`
	MtSido             *string  `json:"mt_sido"`
	MtWeatherDate      *string  `json:"mt_weather_date"`
	MtAdate            *string  `json:"mt_adate"`
	MtAppVersion       *string  `json:"mt_app_version"`
}

// UsersWrap은 recent/signin·not-joined의 {"users":[...]} 래퍼.
type UsersWrap struct {
	Users []UserFullDump `json:"users"`
}

// UserIdentity는 Python UserIdentity(schemas/auth.py)와 키/순서·타입이 동일하다.
// auth/me(read_users_me)가 create_user_identity_from_member로 반환한다.
// 키 순서: mt_idx, mt_id, mt_name, mt_level. 전부 스칼라(int/str/str/int).
type UserIdentity struct {
	MtIdx   int    `json:"mt_idx"`
	MtID    string `json:"mt_id"`
	MtName  string `json:"mt_name"`
	MtLevel int    `json:"mt_level"`
}
