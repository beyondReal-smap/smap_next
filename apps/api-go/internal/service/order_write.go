package service

import "time"

// CancelOutcome는 cancel_order 분기 결과를 핸들러에 전달한다.
type CancelOutcome int

const (
	CancelNotFound  CancelOutcome = iota // 404 주문을 찾을 수 없습니다
	CancelForbidden                      // 403 접근 권한이 없습니다
	CancelAlready                        // 400 이미 취소된 주문입니다
	CancelDone                           // DB 취소 완료 → 핸들러는 500 plain(직렬화 버그 재현)
	CancelDBErr                          // DB 오류 → 500
)

// UpdateStatus는 Python update_order_status를 이식한다(소유자 체크 없음).
// ⚠️ 성공 시 Python은 {"message",...,"order":<SQLAlchemy 모델>}을 response_model 없이 반환해
// jsonable_encoder가 모델 직렬화에 실패 → 500 plain. 그래서 found=true(DB 갱신 완료) 시 핸들러는 500을 낸다.
// 반환: found=false→404, dbErr!=nil→500, found=true→(갱신 후) 핸들러 500.
func (s *OrderService) UpdateStatus(orderID, status int) (found bool, dbErr error) {
	o, err := s.repo.GetByID(orderID)
	if err != nil {
		return false, err
	}
	if o == nil {
		return false, nil
	}
	// update_date 미전달 → ot_pdate/ot_ccdate 미설정, ot_status + ot_udate(datetime.now()=KST)만.
	if err := s.repo.UpdateFields(orderID, map[string]interface{}{"ot_status": status, "ot_udate": time.Now()}); err != nil {
		return true, err
	}
	return true, nil
}

// Cancel은 Python cancel_order 엔드포인트를 이식한다(소유자 체크 + 이미취소 검사).
// ⚠️ 성공(CancelDone)도 Python은 모델 직렬화 실패로 500 plain → 핸들러가 500을 낸다(DB는 커밋됨).
func (s *OrderService) Cancel(orderID, uid int, reason string, amount *float64, refund *string) CancelOutcome {
	return s.cancel(orderID, uid, true, reason, amount, refund)
}

// CancelAsAdmin은 관리자의 주문 취소다(G7: 상태 변경·취소는 관리자 전용 라우트). 소유자 검사를 건너뛴다.
func (s *OrderService) CancelAsAdmin(orderID int, reason string, amount *float64, refund *string) CancelOutcome {
	return s.cancel(orderID, 0, false, reason, amount, refund)
}

func (s *OrderService) cancel(orderID, uid int, ownerOnly bool, reason string, amount *float64, refund *string) CancelOutcome {
	o, err := s.repo.GetByID(orderID)
	if err != nil {
		return CancelDBErr
	}
	if o == nil {
		return CancelNotFound
	}
	if ownerOnly && (o.MtIdx == nil || *o.MtIdx != uid) {
		return CancelForbidden
	}
	if o.OtStatus != nil && *o.OtStatus == 99 {
		return CancelAlready
	}
	now := time.Now()
	fields := map[string]interface{}{
		"ot_status":       99,
		"ct_cancel_reson": reason,
		"ot_ccdate":       now,
		"ot_udate":        now,
	}
	if amount != nil { // Python: if cancel_amount(truthy) — None/0 제외. 여기선 제공 시 설정.
		fields["ct_cancel_amount"] = *amount
	}
	if refund != nil && *refund != "" {
		fields["ot_refund_info"] = *refund
	}
	if err := s.repo.UpdateFields(orderID, fields); err != nil {
		return CancelDBErr
	}
	return CancelDone
}
