package dto

// GroupResponse는 Python GroupResponse(GroupBase 상속)와 키/순서·타입이 동일하다.
// Pydantic v2 직렬화 순서는 부모(GroupBase) 필드 먼저, 그 다음 자식(GroupResponse) 필드다
// (실측: mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show, sgt_idx, sgt_wdate, sgt_udate).
// sgt_show는 str-enum이라 "Y"/"N" 문자열로 직렬화되고, nullable 필드는 None ↔ null.
// sgt_wdate/sgt_udate는 naive datetime이므로 PyTime 포맷("2006-01-02T15:04:05")을 쓴다.
type GroupResponse struct {
	MtIdx    *int    `json:"mt_idx"`
	SgtTitle *string `json:"sgt_title"`
	SgtCode  *string `json:"sgt_code"`
	SgtMemo  *string `json:"sgt_memo"`
	SgtShow  *string `json:"sgt_show"`
	SgtIdx   int     `json:"sgt_idx"`
	SgtWdate *PyTime `json:"sgt_wdate"`
	SgtUdate *PyTime `json:"sgt_udate"`
}
