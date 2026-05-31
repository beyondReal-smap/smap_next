package model

import "time"

// Order는 Python `app/models/order.py`의 Order(테이블 order_t)와 대응한다.
// PK(ot_idx)는 non-pointer int, 나머지 컬럼은 전부 포인터(NULL 구분).
// 금액 컬럼은 Python에서 SQLAlchemy Double → float이므로 *float64로 매핑한다(DECIMAL 아님).
type Order struct {
	OtIdx           int        `gorm:"column:ot_idx;primaryKey;autoIncrement"`
	OtCode          *string    `gorm:"column:ot_code"`
	OtOriCode       *string    `gorm:"column:ot_ori_code"`
	MtIdx           *int       `gorm:"column:mt_idx"`
	MtID            *string    `gorm:"column:mt_id"`
	OtTitle         *string    `gorm:"column:ot_title"`
	OtPayType       *string    `gorm:"column:ot_pay_type"`
	OtSdate         *time.Time `gorm:"column:ot_sdate"`
	OtEdate         *time.Time `gorm:"column:ot_edate"`
	OtStatus        *int       `gorm:"column:ot_status"`
	OtSprice        *float64   `gorm:"column:ot_sprice"`
	OtUseCoupon     *float64   `gorm:"column:ot_use_coupon"`
	OtCouponIdx     *int       `gorm:"column:ot_coupon_idx"`
	OtPrice         *float64   `gorm:"column:ot_price"`
	OtPriceB        *float64   `gorm:"column:ot_price_b"`
	OtPayBank       *string    `gorm:"column:ot_pay_bank"`
	OtRspImpUID     *string    `gorm:"column:ot_rsp_imp_uid"`
	CtCancelAmount  *float64   `gorm:"column:ct_cancel_amount"`
	CtCancelReson   *string    `gorm:"column:ct_cancel_reson"`
	CtRefundHolder  *string    `gorm:"column:ct_refund_holder"`
	CtRefundBank    *string    `gorm:"column:ct_refund_bank"`
	CtRefundAccount *string    `gorm:"column:ct_refund_account"`
	OtWdate         *time.Time `gorm:"column:ot_wdate"`
	OtPdate         *time.Time `gorm:"column:ot_pdate"`
	OtCdate         *time.Time `gorm:"column:ot_cdate"`
	OtCcdate        *time.Time `gorm:"column:ot_ccdate"`
	OtRefundInfo    *string    `gorm:"column:ot_refund_info"`
	OtShow          *string    `gorm:"column:ot_show"`
	OtMemo          *string    `gorm:"column:ot_memo"`
	OtUdate         *time.Time `gorm:"column:ot_udate"`
	OtCashName      *string    `gorm:"column:ot_cash_name"`
	OtCashHp        *string    `gorm:"column:ot_cash_hp"`
	OtCashChk       *string    `gorm:"column:ot_cash_chk"`
	VbankDate       *time.Time `gorm:"column:vbank_date"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (Order) TableName() string { return "order_t" }
