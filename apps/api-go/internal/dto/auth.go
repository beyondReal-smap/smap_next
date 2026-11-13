package dto

// auth 도메인 응답 DTO. Python `app/api/v1/endpoints/auth.py`의 응답 구조(키 순서·타입)를 그대로 따른다.
// ⚠️ token/refresh_token/mt_ldate/mt_adate 등은 비결정적(JWT exp·난수·utcnow)이라 byte-동등이
// 불가하며, 검증은 휘발 필드 정규화 + claim 비교 + 기능 검증으로 한다.

// LoginHomeResponse는 Pydantic LoginResponseHome(success, message, data: Optional[dict]=None).
// data는 실패 시 null(키는 항상 포함 — FastAPI는 exclude_none 미적용).
type LoginHomeResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// LoginHomeData는 /login 성공 data: {token, refresh_token, expires_in, user}.
type LoginHomeData struct {
	Token        string         `json:"token"`
	RefreshToken string         `json:"refresh_token"`
	ExpiresIn    int            `json:"expires_in"`
	User         *LoginUserData `json:"user"`
}

// RegisterData는 /register 성공 data: {token, refresh_token, expires_in, user}.
// refresh_token·expires_in은 15단계에서 추가됐다(구버전 앱은 모르는 필드를 무시한다. token 키가 맨 앞이어야
// Android 구버전의 정규식 파서가 같은 값을 잡는다).
type RegisterData struct {
	Token        string            `json:"token"`
	RefreshToken string            `json:"refresh_token"`
	ExpiresIn    int               `json:"expires_in"`
	User         *RegisterUserData `json:"user"`
}

// LoginUserData는 /login 응답의 user(29필드, auth.py line 160-190 순서 그대로).
// mt_birth만 nullable(*string), 나머지는 `or` 폴백으로 항상 값 존재.
type LoginUserData struct {
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
	MtLat         PyFloat `json:"mt_lat"`
	MtLong        PyFloat `json:"mt_long"`
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
	MtWdate       string  `json:"mt_wdate"`
	MtLdate       string  `json:"mt_ldate"`
	MtAdate       string  `json:"mt_adate"`
}

// RegisterUserData는 /register 응답의 user(28필드). ⚠️ login과 달리 mt_push1 누락(auth.py 419 충실 이식).
type RegisterUserData struct {
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
	MtLat         PyFloat `json:"mt_lat"`
	MtLong        PyFloat `json:"mt_long"`
	MtSido        string  `json:"mt_sido"`
	MtGu          string  `json:"mt_gu"`
	MtDong        string  `json:"mt_dong"`
	MtOnboarding  string  `json:"mt_onboarding"`
	MtPlanCheck   string  `json:"mt_plan_check"`
	MtPlanDate    string  `json:"mt_plan_date"`
	MtWeatherPop  string  `json:"mt_weather_pop"`
	MtWeatherSky  int     `json:"mt_weather_sky"`
	MtWeatherTmn  int     `json:"mt_weather_tmn"`
	MtWeatherTmx  int     `json:"mt_weather_tmx"`
	MtWeatherDate string  `json:"mt_weather_date"`
	MtWdate       string  `json:"mt_wdate"`
	MtLdate       string  `json:"mt_ldate"`
	MtAdate       string  `json:"mt_adate"`
}

// RefreshV2Response는 /refresh v2(rotation): {success, token, refresh_token, expires_in, message}.
type RefreshV2Response struct {
	Success      bool   `json:"success"`
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Message      string `json:"message"`
}

// RefreshV1Response는 /refresh v1(access만 재발급): {success, token, message}.
type RefreshV1Response struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	Message string `json:"message"`
}

// LogoutResponse는 /logout 고정 응답: {success, message}.
type LogoutResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// LoginOriginalResponse는 Pydantic LoginResponse: {access_token, user: UserIdentity}.
type LoginOriginalResponse struct {
	AccessToken string       `json:"access_token"`
	User        UserIdentity `json:"user"`
}
