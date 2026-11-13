package dto

// members write 응답 DTO. Python `app/api/v1/endpoints/members.py`의 write 핸들러를 이식한다.
// 응답 포맷 3종 혼재: (1)표준 {success,message,data}(register/login/consent/terms),
// (2)비표준 {result,message,success}(verify/change-password·update-profile/contact·withdraw, 인증실패도 200),
// (3)단순/혼합(create=MemberResponse(UserResponse 재사용), delete={success,message}, 파일I/O).

// MemberRegisterData는 POST /members/register 성공 시 data dict(6키 고정 순서).
type MemberRegisterData struct {
	MtIdx      int     `json:"mt_idx"`
	MtID       string  `json:"mt_id"`
	MtName     string  `json:"mt_name"`
	MtNickname string  `json:"mt_nickname"`
	MtEmail    *string `json:"mt_email"`
	MtWdate    *string `json:"mt_wdate"`
}

// RegisterResponse는 Python RegisterResponse(success, message, data: Optional[dict]=None).
type RegisterResponse struct {
	Success bool                `json:"success"`
	Message string              `json:"message"`
	Data    *MemberRegisterData `json:"data"`
}

// MemberLoginData는 POST /members/login 성공 시 data dict({"user": user_data}).
type MemberLoginData struct {
	User *LoginUserData `json:"user"`
}

// MemberLoginResponse는 Python MemberLoginResponse(success, message, data: Optional[dict]=None).
// ⚠️ /auth/login과 달리 토큰 미발급 — data는 {"user": user_data}만.
type MemberLoginResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Data    *MemberLoginData `json:"data"`
}

// MemberResultMsg는 {result, message, success} 비표준 래핑(verify/change-password·update-profile/contact·withdraw).
// 키 순서: result, message, success. 인증/검증/서버오류 전부 HTTP 200.
type MemberResultMsg struct {
	Result  string `json:"result"`
	Message string `json:"message"`
	Success bool   `json:"success"`
}

// MemberSimpleSuccess는 {success, message}(DELETE /{id}, delete-profile-image).
type MemberSimpleSuccess struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// MemberConsentUpdateResponse는 Python ConsentUpdateResponse(success, message, data).
// ⚠️ 라우터가 field/value도 넘기나 스키마에 없어 무시됨 → 직렬화 결과는 data:null.
type MemberConsentUpdateResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// MemberTermInfo는 정상화된 약관 1건(TermInfo 스키마 필드명: last_updated/is_required/db_field).
type MemberTermInfo struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
	LastUpdated string `json:"last_updated"`
	IsRequired  bool   `json:"is_required"`
	DBField     string `json:"db_field"`
}

// MemberTermsListResponse는 Python TermsListResponse(success, message, data: list[TermInfo]).
type MemberTermsListResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Data    []MemberTermInfo `json:"data"`
}

// UploadProfileData는 upload-profile-image 성공 data dict(file_path, file_name, file_size).
type UploadProfileData struct {
	FilePath string `json:"file_path"`
	FileName string `json:"file_name"`
	FileSize int    `json:"file_size"`
}

// UploadProfileResponse는 upload-profile-image 성공 응답.
type UploadProfileResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    UploadProfileData `json:"data"`
}

// MemberPutResponse는 PUT /members/{id} 응답이다. response_model=MemberResponse로 dict를 필터링하는데
// 핸들러 dict에 mt_wdate/mt_udate/mt_show/mt_agree1~5 키가 없어 MemberResponse 기본값이 채워진다:
// mt_show="Y", mt_agree1~5="N", mt_wdate=null, mt_udate=null. (GET /{id}는 mt_wdate가 dict에 있어 string.)
// 키/순서는 MemberDetailResponse와 동일하나 mt_wdate가 *string(null)인 점만 다르다.
type MemberPutResponse struct {
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
	MtWdate      *string `json:"mt_wdate"`
	MtLdate      string  `json:"mt_ldate"`
	MtUdate      *string `json:"mt_udate"`
}
