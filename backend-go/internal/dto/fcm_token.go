package dto

// FCMTokenResponse는 Python app/core/response.create_response(레거시) 포맷이다(fcm-token 도메인).
// ⚠️ fcm_sendone의 create_response({success,title,message,data})와 다르다 — 여기는 {resultCode,resultMsg,resultData}.
// resultData는 성공 시 dict(아래 struct), Python 실패경로는 문자열을 넘겨 ResponseValidationError(500)를 유발한다.
type FCMTokenResponse struct {
	ResultCode int         `json:"resultCode"`
	ResultMsg  string      `json:"resultMsg"`
	ResultData interface{} `json:"resultData"`
}

// FCMTokenStatusData는 /fcm-token/status의 resultData.
type FCMTokenStatusData struct {
	MtIdx        int     `json:"mt_idx"`
	HasToken     bool    `json:"has_token"`
	TokenPreview *string `json:"token_preview"`
}

// FCMTokenUpdateData는 /fcm-token/update의 resultData.
type FCMTokenUpdateData struct {
	MtIdx          int  `json:"mt_idx"`
	TokenUpdated   bool `json:"token_updated"`
	TokenChanged   bool `json:"token_changed"`
	SilentPushSent bool `json:"silent_push_sent"`
}
