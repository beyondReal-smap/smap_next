package dto

// SMSVerificationResponse는 /sms/send-verification-code·/sms/verify-code 응답이다.
// Python VerificationCodeResponse/VerifyCodeResponse(success: bool, error: str|None=None) —
// error는 omitempty 없이 항상 직렬화되어 값이 없으면 "error":null로 나간다.
type SMSVerificationResponse struct {
	Success bool    `json:"success"`
	Error   *string `json:"error"`
}

// SMSSendResponse는 /sms/send 응답이다.
// Python SMSResponse(success, message, msg_id: str|None) — msg_id는 항상 "msg_id" 키(null 허용).
type SMSSendResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	MsgID   *string `json:"msg_id"`
}
