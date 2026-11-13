package dto

// OrderResponse는 Python `app/schemas/order.py`의 OrderResponse(OrderBase 상속)와
// 키 순서·타입이 동일하다. OrderBase의 30개 필드를 선언 순서대로 두고, 자식 필드인
// ot_idx를 마지막에 배치한다(Pydantic 상속 직렬화 순서 재현).
//
// 금액 컬럼(ot_sprice/ot_use_coupon/ot_price/ot_price_b/ct_cancel_amount)은 Python에서
// Double→float(Optional[float])이므로 *PyFloat(정수값에 ".0" 부가하는 Python repr)로 직렬화한다.
// 날짜는 서비스에서 pyISOPtr로 ISO8601 문자열을 채운다(nil→null).
type OrderResponse struct {
	OtCode          *string  `json:"ot_code"`
	OtOriCode       *string  `json:"ot_ori_code"`
	MtIdx           *int     `json:"mt_idx"`
	MtID            *string  `json:"mt_id"`
	OtTitle         *string  `json:"ot_title"`
	OtPayType       *string  `json:"ot_pay_type"`
	OtSdate         *string  `json:"ot_sdate"`
	OtEdate         *string  `json:"ot_edate"`
	OtStatus        *int     `json:"ot_status"`
	OtSprice        *PyFloat `json:"ot_sprice"`
	OtUseCoupon     *PyFloat `json:"ot_use_coupon"`
	OtCouponIdx     *int     `json:"ot_coupon_idx"`
	OtPrice         *PyFloat `json:"ot_price"`
	OtPriceB        *PyFloat `json:"ot_price_b"`
	OtPayBank       *string  `json:"ot_pay_bank"`
	OtRspImpUID     *string  `json:"ot_rsp_imp_uid"`
	CtCancelAmount  *PyFloat `json:"ct_cancel_amount"`
	CtCancelReson   *string  `json:"ct_cancel_reson"`
	CtRefundHolder  *string  `json:"ct_refund_holder"`
	CtRefundBank    *string  `json:"ct_refund_bank"`
	CtRefundAccount *string  `json:"ct_refund_account"`
	OtWdate         *string  `json:"ot_wdate"`
	OtPdate         *string  `json:"ot_pdate"`
	OtCdate         *string  `json:"ot_cdate"`
	OtCcdate        *string  `json:"ot_ccdate"`
	OtRefundInfo    *string  `json:"ot_refund_info"`
	OtShow          *string  `json:"ot_show"`
	OtMemo          *string  `json:"ot_memo"`
	OtUdate         *string  `json:"ot_udate"`
	OtCashName      *string  `json:"ot_cash_name"`
	OtCashHp        *string  `json:"ot_cash_hp"`
	OtCashChk       *string  `json:"ot_cash_chk"`
	VbankDate       *string  `json:"vbank_date"`
	OtIdx           int      `json:"ot_idx"`
}

// OrderListResponse는 Python OrderListResponse와 키 순서가 동일하다.
type OrderListResponse struct {
	Orders     []OrderResponse `json:"orders"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Size       int             `json:"size"`
	TotalPages int             `json:"total_pages"`
}

// OrderSummary는 Python OrderSummary와 키 순서·타입이 동일하다.
// 금액 3종(total_amount/this_month_amount/average_amount)은 필수(non-null) float이므로
// PyFloat(포인터 아님)을 사용한다.
type OrderSummary struct {
	TotalOrders     int     `json:"total_orders"`
	TotalAmount     PyFloat `json:"total_amount"`
	CompletedOrders int     `json:"completed_orders"`
	PendingOrders   int     `json:"pending_orders"`
	CancelledOrders int     `json:"cancelled_orders"`
	ThisMonthAmount PyFloat `json:"this_month_amount"`
	AverageAmount   PyFloat `json:"average_amount"`
}
