package dto

// LocationCreateResponse는 POST /locations/ 커스텀 응답({success, message, slt_idx, data}).
type LocationCreateResponse struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	SltIdx  int                `json:"slt_idx"`
	Data    LocationCreateData `json:"data"`
}

// LocationCreateData는 create 응답의 data. slt_lat/long은 입력 float(Decimal 문자열 아님), slt_wdate=now isoformat(micros).
type LocationCreateData struct {
	SltIdx        int      `json:"slt_idx"`
	SltTitle      string   `json:"slt_title"`
	SltAdd        string   `json:"slt_add"`
	SltLat        *PyFloat `json:"slt_lat"`
	SltLong       *PyFloat `json:"slt_long"`
	SltShow       string   `json:"slt_show"`
	SltEnterAlarm string   `json:"slt_enter_alarm"`
	SltEnterChk   string   `json:"slt_enter_chk"`
	SltWdate      string   `json:"slt_wdate"`
}

// LocationNotifResponse는 PUT /{id}/notification 응답.
type LocationNotifResponse struct {
	Success       bool   `json:"success"`
	Message       string `json:"message"`
	SltIdx        int    `json:"slt_idx"`
	SltEnterAlarm string `json:"slt_enter_alarm"`
}

// LocationUpdateResponse는 PUT /{id} 응답(updated_fields=body 키 순서).
type LocationUpdateResponse struct {
	Success       bool     `json:"success"`
	Message       string   `json:"message"`
	UpdatedFields []string `json:"updated_fields"`
	SltIdx        int      `json:"slt_idx"`
}

// LocationMemberCreateResponse는 POST /members/{id}/locations 응답.
type LocationMemberCreateResponse struct {
	Success  bool                     `json:"success"`
	Message  string                   `json:"message"`
	MemberID int                      `json:"member_id"`
	SltIdx   int                      `json:"slt_idx"`
	Data     LocationMemberCreateData `json:"data"`
}

// LocationMemberCreateData는 member-create 응답 data(재조회, slt_lat/long=float(DB), slt_wdate=재조회 isoformat).
type LocationMemberCreateData struct {
	SltIdx        int      `json:"slt_idx"`
	InsertMtIdx   *int     `json:"insert_mt_idx"`
	MtIdx         *int     `json:"mt_idx"`
	SgtIdx        *int     `json:"sgt_idx"`
	SgdtIdx       *int     `json:"sgdt_idx"`
	SltTitle      *string  `json:"slt_title"`
	SltAdd        *string  `json:"slt_add"`
	SltLat        *PyFloat `json:"slt_lat"`
	SltLong       *PyFloat `json:"slt_long"`
	SltShow       *string  `json:"slt_show"`
	SltEnterAlarm *string  `json:"slt_enter_alarm"`
	SltEnterChk   *string  `json:"slt_enter_chk"`
	SltWdate      *string  `json:"slt_wdate"`
}
