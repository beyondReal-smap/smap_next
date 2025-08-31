from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PaymentType(str, Enum):
    NEW_SIGNUP = "1"  # 신규가입
    APP_PAYMENT = "2"  # 앱결제
    COUPON = "3"  # 쿠폰
    REFERRAL = "4"  # 추천인

class OrderStatus(int, Enum):
    PAYMENT_PENDING = 1  # 결제대기
    PAYMENT_COMPLETED = 2  # 결제완료
    CANCELLED = 99  # 취소

class OrderBase(BaseModel):
    ot_code: Optional[str] = None
    ot_ori_code: Optional[str] = None
    mt_idx: Optional[int] = None
    mt_id: Optional[str] = None
    ot_title: Optional[str] = None
    ot_pay_type: Optional[str] = None
    ot_sdate: Optional[datetime] = None
    ot_edate: Optional[datetime] = None
    ot_status: Optional[int] = None
    ot_sprice: Optional[float] = None
    ot_use_coupon: Optional[float] = None
    ot_coupon_idx: Optional[int] = None
    ot_price: Optional[float] = None
    ot_price_b: Optional[float] = None
    ot_pay_bank: Optional[str] = None
    ot_rsp_imp_uid: Optional[str] = None
    ct_cancel_amount: Optional[float] = None
    ct_cancel_reson: Optional[str] = None
    ct_refund_holder: Optional[str] = None
    ct_refund_bank: Optional[str] = None
    ct_refund_account: Optional[str] = None
    ot_wdate: Optional[datetime] = None
    ot_pdate: Optional[datetime] = None
    ot_cdate: Optional[datetime] = None
    ot_ccdate: Optional[datetime] = None
    ot_refund_info: Optional[str] = None
    ot_show: Optional[str] = None
    ot_memo: Optional[str] = None
    ot_udate: Optional[datetime] = None
    ot_cash_name: Optional[str] = None
    ot_cash_hp: Optional[str] = None
    ot_cash_chk: Optional[str] = None
    vbank_date: Optional[datetime] = None

class OrderCreate(OrderBase):
    pass

class OrderUpdate(OrderBase):
    pass

class OrderResponse(OrderBase):
    ot_idx: int
    
    class Config:
        from_attributes = True

class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    size: int
    total_pages: int

class OrderSummary(BaseModel):
    total_orders: int
    total_amount: float
    completed_orders: int
    pending_orders: int
    cancelled_orders: int
    this_month_amount: float
    average_amount: float

class OrderFilter(BaseModel):
    status: Optional[int] = None
    pay_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    size: int = 20 