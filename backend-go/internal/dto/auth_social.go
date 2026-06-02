package dto

// Phase B 소셜로그인/find-user DTO. 응답 wrapper는 LoginHomeResponse({success,message,data}) 재사용.
// ⚠️ 엔드포인트마다 user_data 필드 집합·순서·기본값이 다르므로(아래) 별도 구조체로 둔다.

// --- kakao-login ---

// KakaoUserData는 kakao-login 성공 user(30필드, auth.py:575 순서. login 29필드 + mt_kakao_id[mt_file1 뒤]).
type KakaoUserData struct {
	MtIdx         int     `json:"mt_idx"`
	MtType        int     `json:"mt_type"` // or 2
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
	MtKakaoID     string  `json:"mt_kakao_id"` // or ""
	MtLat         PyFloat `json:"mt_lat"`
	MtLong        PyFloat `json:"mt_long"`
	MtSido        string  `json:"mt_sido"`
	MtGu          string  `json:"mt_gu"`
	MtDong        string  `json:"mt_dong"`
	MtOnboarding  string  `json:"mt_onboarding"` // or 'Y'
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

// KakaoLoginData는 kakao-login 성공 data: {user, token, refresh_token, expires_in, isNewUser}.
type KakaoLoginData struct {
	User         *KakaoUserData `json:"user"`
	Token        string         `json:"token"`
	RefreshToken string         `json:"refresh_token"`
	ExpiresIn    int            `json:"expires_in"`
	IsNewUser    bool           `json:"isNewUser"`
}

// KakaoNewUserData는 신규 사용자 data: {is_new_user, user:null, token:null}.
type KakaoNewUserData struct {
	IsNewUser bool        `json:"is_new_user"`
	User      interface{} `json:"user"`  // 항상 null
	Token     interface{} `json:"token"` // 항상 null
}

// --- google/apple-login (_build_user_data) ---

// SocialBuildUserData는 _build_user_data(30필드, member_service.py:623. login 29 + mt_google_id[끝]).
// ⚠️ mt_type 기본 4, mt_onboarding 기본 'N', mt_google_id는 raw(*string, null 가능).
type SocialBuildUserData struct {
	MtIdx         int     `json:"mt_idx"`
	MtType        int     `json:"mt_type"` // or 4 (apple은 호출 후 or 5로 덮음)
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
	MtOnboarding  string  `json:"mt_onboarding"` // or 'N'
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
	MtGoogleID    *string `json:"mt_google_id"` // raw
}

// SocialGroupItem은 부가데이터 그룹 1건(8키 고정 순서).
type SocialGroupItem struct {
	SgtIdx        int         `json:"sgt_idx"`
	SgtTitle      *string     `json:"sgt_title"`
	SgtFile1      interface{} `json:"sgt_file1"` // 항상 null
	SgdtOwnerChk  *string     `json:"sgdt_owner_chk"`
	SgdtLeaderChk *string     `json:"sgdt_leader_chk"`
	MemberCount   int64       `json:"member_count"`
	IsOwner       bool        `json:"is_owner"`
	IsLeader      bool        `json:"is_leader"`
}

// SocialScheduleItem은 find-email·google/apple 스케줄 1건(6키).
type SocialScheduleItem struct {
	SstIdx           int     `json:"sst_idx"`
	SstTitle         *string `json:"sst_title"`
	SstSdate         *string `json:"sst_sdate"`
	SstLocationTitle *string `json:"sst_location_title"`
	SgtIdx           *int    `json:"sgt_idx"`
	GroupTitle       *string `json:"group_title"`
}

// SocialLoginData는 google/apple 기존 사용자 data(13키, member==user).
type SocialLoginData struct {
	Member          *SocialBuildUserData `json:"member"`
	User            *SocialBuildUserData `json:"user"`
	Token           string               `json:"token"`
	RefreshToken    string               `json:"refresh_token"`
	ExpiresIn       int                  `json:"expires_in"`
	IsNewUser       bool                 `json:"is_new_user"`
	IsNewUserCamel  bool                 `json:"isNewUser"`
	LookupMethod    string               `json:"lookup_method"`
	Groups          []SocialGroupItem    `json:"groups"`
	RecentSchedules []SocialScheduleItem `json:"recent_schedules"`
	GroupCount      int                  `json:"group_count"`
	ScheduleCount   int                  `json:"schedule_count"`
	HasData         bool                 `json:"has_data"`
}

// SocialNewUserData는 google/apple 신규 사용자 data(12키, token=null, member==user=temp).
type SocialNewUserData struct {
	Member          interface{}          `json:"member"`
	User            interface{}          `json:"user"`
	Token           interface{}          `json:"token"` // 항상 null
	IsNewUser       bool                 `json:"is_new_user"`
	IsNewUserCamel  bool                 `json:"isNewUser"`
	LookupMethod    string               `json:"lookup_method"`
	Groups          []SocialGroupItem    `json:"groups"`
	RecentSchedules []SocialScheduleItem `json:"recent_schedules"`
	GroupCount      int                  `json:"group_count"`
	ScheduleCount   int                  `json:"schedule_count"`
	HasData         bool                 `json:"has_data"`
	NeedsOnboarding bool                 `json:"needs_onboarding"`
}

// GoogleTempUser는 google 신규 temp_user_data(9키, mt_idx=null).
type GoogleTempUser struct {
	MtIdx      *int   `json:"mt_idx"` // 항상 null
	MtID       string `json:"mt_id"`
	MtName     string `json:"mt_name"`
	MtNickname string `json:"mt_nickname"`
	MtEmail    string `json:"mt_email"`
	MtGoogleID string `json:"mt_google_id"`
	MtType     int    `json:"mt_type"`
	MtLevel    int    `json:"mt_level"`
	MtFile1    string `json:"mt_file1"`
}

// AppleTempUser는 apple 신규 temp_user_data(7키, mt_idx=null).
type AppleTempUser struct {
	MtIdx      *int   `json:"mt_idx"` // 항상 null
	MtID       string `json:"mt_id"`
	MtName     string `json:"mt_name"`
	MtNickname string `json:"mt_nickname"`
	MtEmail    string `json:"mt_email"`
	MtAppleID  string `json:"mt_apple_id"`
	MtType     int    `json:"mt_type"`
}

// --- find-user-by-email ---

// FindEmailUserData는 find-email user(29필드, mt_wdate 없음·mt_google_id[끝, raw]).
type FindEmailUserData struct {
	MtIdx         int     `json:"mt_idx"`
	MtType        int     `json:"mt_type"` // or 1
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
	MtOnboarding  string  `json:"mt_onboarding"` // or 'Y'
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
	MtGoogleID    *string `json:"mt_google_id"` // raw
}

// FindUserData는 find-user 성공 data(10키). user는 email/phone에 따라 다른 구조체(interface{}).
type FindUserData struct {
	Found           bool        `json:"found"`
	IsNewUser       bool        `json:"is_new_user"`
	User            interface{} `json:"user"`
	Groups          interface{} `json:"groups"`           // []SocialGroupItem
	RecentSchedules interface{} `json:"recent_schedules"` // []SocialScheduleItem 또는 []FindPhoneScheduleItem
	GroupCount      int         `json:"group_count"`
	ScheduleCount   int         `json:"schedule_count"`
	HasData         bool        `json:"has_data"`
	LookupMethod    string      `json:"lookup_method"`
	NeedsOnboarding bool        `json:"needs_onboarding"`
}

// FindNewUserData는 미발견 data: {found:false, is_new_user:true}.
type FindNewUserData struct {
	Found     bool `json:"found"`
	IsNewUser bool `json:"is_new_user"`
}

// FindWithdrawnEmailData는 탈퇴(email) data: {found, is_withdrawn, user:{mt_idx,mt_email,mt_level}}.
type FindWithdrawnEmailData struct {
	Found       bool                     `json:"found"`
	IsWithdrawn bool                     `json:"is_withdrawn"`
	User        FindWithdrawnEmailUser   `json:"user"`
}
type FindWithdrawnEmailUser struct {
	MtIdx   int     `json:"mt_idx"`
	MtEmail *string `json:"mt_email"`
	MtLevel *int    `json:"mt_level"`
}

// FindWithdrawnPhoneData는 탈퇴(phone) data: {found, is_withdrawn, user:{mt_idx,mt_hp,mt_level}}.
type FindWithdrawnPhoneData struct {
	Found       bool                   `json:"found"`
	IsWithdrawn bool                   `json:"is_withdrawn"`
	User        FindWithdrawnPhoneUser `json:"user"`
}
type FindWithdrawnPhoneUser struct {
	MtIdx   int     `json:"mt_idx"`
	MtHp    *string `json:"mt_hp"`
	MtLevel *int    `json:"mt_level"`
}

// --- find-user-by-phone (raw jsonable_encoder, 16필드) ---

// FindPhoneUserData는 find-phone user(16필드, RAW). jsonable_encoder: Decimal→float, datetime→isoformat.
type FindPhoneUserData struct {
	MtIdx        int      `json:"mt_idx"`
	MtID         *string  `json:"mt_id"`
	MtName       *string  `json:"mt_name"`
	MtNickname   *string  `json:"mt_nickname"`
	MtHp         *string  `json:"mt_hp"`
	MtEmail      *string  `json:"mt_email"`
	MtBirth      *string  `json:"mt_birth"` // date isoformat "YYYY-MM-DD"
	MtGender     *int     `json:"mt_gender"`
	MtType       *int     `json:"mt_type"`
	MtLevel      *int     `json:"mt_level"`
	MtFile1      *string `json:"mt_file1"`
	MtLat        *string `json:"mt_lat"`  // raw Decimal → Pydantic 문자열
	MtLong       *string `json:"mt_long"` // raw Decimal → Pydantic 문자열
	MtOnboarding *string `json:"mt_onboarding"`
	MtLdate      *string  `json:"mt_ldate"` // datetime isoformat
	MtWdate      *string  `json:"mt_wdate"`
}

// FindPhoneScheduleItem은 find-phone 스케줄 1건(11키, dict 삽입순서).
type FindPhoneScheduleItem struct {
	SstIdx           int      `json:"sst_idx"`
	SstTitle         *string  `json:"sst_title"`
	SstSdate         *string  `json:"sst_sdate"`
	SstEdate         *string  `json:"sst_edate"`
	SstLocationTitle *string `json:"sst_location_title"`
	SstLocationAdd   *string `json:"sst_location_add"`
	SstLocationLat   *string `json:"sst_location_lat"`
	SstLocationLong  *string `json:"sst_location_long"`
	SstMemo          *string `json:"sst_memo"`
	SgtIdx           *int    `json:"sgt_idx"`
	GroupTitle       *string `json:"group_title"`
}
