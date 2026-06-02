package dto

// FCMSendResponse는 Python fcm_sendone.create_response / FCMSendResponse와 동등하다.
// ⚠️ success는 boolean이 아니라 **문자열 "true"/"false"**(비표준 계약, 충실 보존).
// data는 omitempty 없이 항상 직렬화되어 값이 없으면 "data":null로 나간다.
type FCMSendResponse struct {
	Success string      `json:"success"`
	Title   string      `json:"title"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// FCMTestEchoData는 /fcm_sendone/test가 data에 그대로 반향하는 FCMSendRequest dict이다.
// ⚠️ Go map은 JSON 직렬화 시 키를 알파벳 정렬하므로, Pydantic 필드 정의 순서를 보존하려면 struct를 쓴다.
// mt_idx는 int(coerce 후), user_agent는 Optional[str]=None → 미제공 시 null.
type FCMTestEchoData struct {
	PltType      string  `json:"plt_type"`
	SstIdx       string  `json:"sst_idx"`
	PltCondition string  `json:"plt_condition"`
	PltMemo      string  `json:"plt_memo"`
	MtIdx        int     `json:"mt_idx"`
	PltTitle     string  `json:"plt_title"`
	PltContent   string  `json:"plt_content"`
	UserAgent    *string `json:"user_agent"`
}
