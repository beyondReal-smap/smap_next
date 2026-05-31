package dto

// PushLogResponse는 Python PushLogResponse(PushLogBase 상속)와 키/순서·타입이 동일하다.
// 날짜(plt_sdate/wdate/rdate)는 서비스에서 isoformat으로 채운다.
type PushLogResponse struct {
	PltType      *int    `json:"plt_type"`
	MtIdx        *int    `json:"mt_idx"`
	SstIdx       *int    `json:"sst_idx"`
	PltCondition *string `json:"plt_condition"`
	PltMemo      *string `json:"plt_memo"`
	PltTitle     *string `json:"plt_title"`
	PltContent   *string `json:"plt_content"`
	PltSdate     *string `json:"plt_sdate"`
	PltStatus    *int    `json:"plt_status"`
	PltReadChk   *string `json:"plt_read_chk"`
	PltShow      *string `json:"plt_show"`
	PushJSON     *string `json:"push_json"`
	PltIdx       int     `json:"plt_idx"`
	PltWdate     *string `json:"plt_wdate"`
	PltRdate     *string `json:"plt_rdate"`
}

// PushFCMResponse는 Python PushFCMResponse(PushFCMBase 상속)와 키/순서·타입이 동일하다.
type PushFCMResponse struct {
	PftCode      *string `json:"pft_code"`
	PftTitle     *string `json:"pft_title"`
	PftContent   *string `json:"pft_content"`
	PftSendType  *int    `json:"pft_send_type"`
	PftSendMtIdx *int    `json:"pft_send_mt_idx"`
	PftRdate     *string `json:"pft_rdate"`
	PftURL       *string `json:"pft_url"`
	PftStatus    *int    `json:"pft_status"`
	PftShow      *string `json:"pft_show"`
	PftSdate     *string `json:"pft_sdate"`
	PftEdate     *string `json:"pft_edate"`
	PftIdx       int     `json:"pft_idx"`
	PftWdate     *string `json:"pft_wdate"`
}
