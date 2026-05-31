package dto

// MemberCheckResponse는 /members/check/{phone,email,nickname} 공통 응답.
type MemberCheckResponse struct {
	Available bool   `json:"available"`
	Message   string `json:"message"`
}

// MemberListItem은 Python _member_to_dict(GET /members/, /?id=)와 키/순서가 동일하다.
// mt_type/level/status/gender는 `x or default`(0/None→default), 문자열은 `or ”`,
// mt_lat/long은 truthy면 float 아니면 null, 날짜는 isoformat 또는 null(safe_date).
type MemberListItem struct {
	MtIdx      int      `json:"mt_idx"`
	MtType     int      `json:"mt_type"`
	MtLevel    int      `json:"mt_level"`
	MtStatus   int      `json:"mt_status"`
	MtID       string   `json:"mt_id"`
	MtName     string   `json:"mt_name"`
	MtNickname string   `json:"mt_nickname"`
	MtHp       string   `json:"mt_hp"`
	MtEmail    string   `json:"mt_email"`
	MtBirth    *string  `json:"mt_birth"`
	MtGender   int      `json:"mt_gender"`
	MtFile1    string   `json:"mt_file1"`
	MtShow     string   `json:"mt_show"`
	MtAgree1   string   `json:"mt_agree1"`
	MtAgree2   string   `json:"mt_agree2"`
	MtAgree3   string   `json:"mt_agree3"`
	MtAgree4   string   `json:"mt_agree4"`
	MtAgree5   string   `json:"mt_agree5"`
	MtLat      *float64 `json:"mt_lat"`
	MtLong     *float64 `json:"mt_long"`
	MtWdate    *string  `json:"mt_wdate"`
	MtLdate    *string  `json:"mt_ldate"`
	MtUdate    *string  `json:"mt_udate"`
}

// MemberDetailResponse는 GET /members/{id}의 response_model=MemberResponse 필터링 결과와
// 키/순서가 동일하다. ⚠️ 핸들러 dict에 없는 필드는 MemberResponse 기본값으로 채워진다:
// mt_show 항상 "Y", mt_agree1~5 항상 "N", mt_udate 항상 null. mt_lat/long은 falsy면
// 기본값(37.5642/127.0016)이라 항상 float, mt_wdate/ldate는 utcnow 폴백이라 항상 string.
type MemberDetailResponse struct {
	MtType       int     `json:"mt_type"`
	MtLevel      int     `json:"mt_level"`
	MtStatus     int     `json:"mt_status"`
	MtID         string  `json:"mt_id"`
	MtName       string  `json:"mt_name"`
	MtNickname   string  `json:"mt_nickname"`
	MtHp         string  `json:"mt_hp"`
	MtEmail      string  `json:"mt_email"`
	MtBirth      *string `json:"mt_birth"`
	MtGender     int     `json:"mt_gender"`
	MtShow       string  `json:"mt_show"`
	MtAgree1     string  `json:"mt_agree1"`
	MtAgree2     string  `json:"mt_agree2"`
	MtAgree3     string  `json:"mt_agree3"`
	MtAgree4     string  `json:"mt_agree4"`
	MtAgree5     string  `json:"mt_agree5"`
	MtPush1      string  `json:"mt_push1"`
	MtLat        float64 `json:"mt_lat"`
	MtLong       float64 `json:"mt_long"`
	MtOnboarding string  `json:"mt_onboarding"`
	MtIdx        int     `json:"mt_idx"`
	MtFile1      string  `json:"mt_file1"`
	MtWdate      string  `json:"mt_wdate"`
	MtLdate      string  `json:"mt_ldate"`
	MtUdate      *string `json:"mt_udate"`
}

// MemberGroupItem은 GET /members/group/{id}의 수동 dict(Member+GroupDetail)와 키/순서가
// 동일하다. mt_lat/long은 falsy면 기본값(37.5642/127.0016). 날짜 규칙: mt_birth=isoformat/null,
// mt_plan_date=isoformat/”(빈문자열), mt_weather_date/ldate/adate=isoformat/utcnow,
// sgdt_wdate/udate=isoformat/utcnow, sgdt_ddate/xdate/adate=isoformat/”.
type MemberGroupItem struct {
	MtIdx         int     `json:"mt_idx"`
	MtType        int     `json:"mt_type"`
	MtLevel       int     `json:"mt_level"`
	MtStatus      int     `json:"mt_status"`
	MtID          string  `json:"mt_id"`
	MtName        string  `json:"mt_name"`
	MtNickname    string  `json:"mt_nickname"`
	MtHp          string  `json:"mt_hp"`
	MtEmail       string  `json:"mt_email"`
	MtBirth       *string `json:"mt_birth"`
	MtGender      int     `json:"mt_gender"`
	MtFile1       string  `json:"mt_file1"`
	MtLat         float64 `json:"mt_lat"`
	MtLong        float64 `json:"mt_long"`
	MtSido        string  `json:"mt_sido"`
	MtGu          string  `json:"mt_gu"`
	MtDong        string  `json:"mt_dong"`
	MtOnboarding  string  `json:"mt_onboarding"`
	MtPush1       string  `json:"mt_push1"`
	MtPlanCheck   string  `json:"mt_plan_check"`
	MtPlanDate    string  `json:"mt_plan_date"`
	MtWeatherPop  string  `json:"mt_weather_pop"`
	MtWeatherSky  int     `json:"mt_weather_sky"`
	MtWeatherTmn  int     `json:"mt_weather_tmn"`
	MtWeatherTmx  int     `json:"mt_weather_tmx"`
	MtWeatherDate string  `json:"mt_weather_date"`
	MtLdate       string  `json:"mt_ldate"`
	MtAdate       string  `json:"mt_adate"`
	SgdtIdx       int     `json:"sgdt_idx"`
	SgtIdx        *int    `json:"sgt_idx"`
	SgdtOwnerChk  string  `json:"sgdt_owner_chk"`
	SgdtLeaderChk string  `json:"sgdt_leader_chk"`
	SgdtDischarge string  `json:"sgdt_discharge"`
	SgdtGroupChk  string  `json:"sgdt_group_chk"`
	SgdtExit      string  `json:"sgdt_exit"`
	SgdtShow      string  `json:"sgdt_show"`
	SgdtPushChk   string  `json:"sgdt_push_chk"`
	SgdtWdate     string  `json:"sgdt_wdate"`
	SgdtUdate     string  `json:"sgdt_udate"`
	SgdtDdate     string  `json:"sgdt_ddate"`
	SgdtXdate     string  `json:"sgdt_xdate"`
	SgdtAdate     string  `json:"sgdt_adate"`
}

// ProfileMeData는 GET /members/me 성공 응답의 data dict(12키, 순서 고정)와 동일하다.
// Python members.py get_user_profile: response_model 없이 raw dict 반환이라 `or ""` 폴백이
// 전혀 없다 → mt_id/mt_name/mt_nickname/mt_hp/mt_email/mt_file1/mt_gender/mt_type/mt_level은
// DB 값 그대로(null 가능). mt_birth는 strftime('%Y-%m-%d')(*string), mt_wdate는 isoformat()(*string).
type ProfileMeData struct {
	MtIdx      int     `json:"mt_idx"`
	MtID       *string `json:"mt_id"`
	MtName     *string `json:"mt_name"`
	MtNickname *string `json:"mt_nickname"`
	MtHp       *string `json:"mt_hp"`
	MtEmail    *string `json:"mt_email"`
	MtBirth    *string `json:"mt_birth"`
	MtGender   *int    `json:"mt_gender"`
	MtType     *int    `json:"mt_type"`
	MtLevel    *int    `json:"mt_level"`
	MtFile1    *string `json:"mt_file1"`
	MtWdate    *string `json:"mt_wdate"`
}

// ProfileMeResponse는 GET /members/me 성공 응답(키 순서 result, data, message, success)이다.
// gin.H는 map이라 키 순서가 비결정이므로 ordered struct로 직렬화한다.
type ProfileMeResponse struct {
	Result  string        `json:"result"`
	Data    ProfileMeData `json:"data"`
	Message string        `json:"message"`
	Success bool          `json:"success"`
}

// ProfileMeFail은 GET /members/me 실패(미인증/미발견/서버오류) 응답이다.
// Python: {"result":"N","message":"...","success":false} — 3키, 순서 result/message/success.
type ProfileMeFail struct {
	Result  string `json:"result"`
	Message string `json:"message"`
	Success bool   `json:"success"`
}

// ConsentInfo는 Python ConsentInfo(schemas/member.py)와 동일하다.
// mt_agree1~5(YNEnum: "Y"/"N"). 선언 순서 = 직렬화 키 순서.
type ConsentInfo struct {
	MtAgree1 string `json:"mt_agree1"`
	MtAgree2 string `json:"mt_agree2"`
	MtAgree3 string `json:"mt_agree3"`
	MtAgree4 string `json:"mt_agree4"`
	MtAgree5 string `json:"mt_agree5"`
}

// ConsentResponse는 Python ConsentResponse(schemas/member.py)와 동일하다.
// 키 순서: success, message, data.
type ConsentResponse struct {
	Success bool         `json:"success"`
	Message string       `json:"message"`
	Data    *ConsentInfo `json:"data"`
}
