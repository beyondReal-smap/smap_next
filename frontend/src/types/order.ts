export interface Order {
  ot_idx: number;
  ot_code?: string;
  ot_ori_code?: string;
  mt_idx?: number;
  mt_id?: string;
  ot_title?: string;
  ot_pay_type?: string;
  ot_sdate?: string;
  ot_edate?: string;
  ot_status?: number;
  ot_sprice?: number;
  ot_use_coupon?: number;
  ot_coupon_idx?: number;
  ot_price?: number;
  ot_price_b?: number;
  ot_pay_bank?: string;
  ot_rsp_imp_uid?: string;
  ct_cancel_amount?: number;
  ct_cancel_reson?: string;
  ct_refund_holder?: string;
  ct_refund_bank?: string;
  ct_refund_account?: string;
  ot_wdate?: string;
  ot_pdate?: string;
  ot_cdate?: string;
  ot_ccdate?: string;
  ot_refund_info?: string;
  ot_show?: string;
  ot_memo?: string;
  ot_udate?: string;
  ot_cash_name?: string;
  ot_cash_hp?: string;
  ot_cash_chk?: string;
  vbank_date?: string;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface OrderSummary {
  total_orders: number;
  total_amount: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  this_month_amount: number;
  average_amount: number;
}

export interface OrderFilter {
  status?: number;
  pay_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

// 결제 방법 타입
export enum PaymentType {
  NEW_SIGNUP = '1',  // 신규가입
  APP_PAYMENT = '2', // 앱결제
  COUPON = '3',      // 쿠폰
  REFERRAL = '4'     // 추천인
}

// 주문 상태 타입
export enum OrderStatus {
  PAYMENT_PENDING = 1,   // 결제대기
  PAYMENT_COMPLETED = 2, // 결제완료
  CANCELLED = 99         // 취소
}

// 결제 방법 라벨
export const PaymentTypeLabels = {
  [PaymentType.NEW_SIGNUP]: '신규가입',
  [PaymentType.APP_PAYMENT]: '앱결제',
  [PaymentType.COUPON]: '쿠폰',
  [PaymentType.REFERRAL]: '추천인'
};

// 주문 상태 라벨
export const OrderStatusLabels = {
  [OrderStatus.PAYMENT_PENDING]: '결제대기',
  [OrderStatus.PAYMENT_COMPLETED]: '결제완료',
  [OrderStatus.CANCELLED]: '취소'
}; 