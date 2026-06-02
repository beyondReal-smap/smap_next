package service

import (
	"errors"
	"math"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// orderRepo는 OrderService가 의존하는 데이터 접근 인터페이스(테스트 mock 용이).
type orderRepo interface {
	GetByID(id int) (*model.Order, error)
	GetByCode(code string) (*model.Order, error)
	FindByMember(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error)
	FindRecentByMember(memberID, limit int) ([]model.Order, error)
	Summary(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error)
	UpdateFields(id int, fields map[string]interface{}) error
}

// OrderService는 Python `app/api/v1/endpoints/orders.py`의 read 핸들러를 이식한다.
type OrderService struct {
	repo orderRepo
}

func NewOrder(repo orderRepo) *OrderService {
	return &OrderService{repo: repo}
}

// orderFloatPtr는 *float64를 *dto.PyFloat로 변환한다(nil→nil).
// Python Optional[float] 응답을 Python float repr(정수값에 ".0")로 직렬화하기 위함.
func orderFloatPtr(f *float64) *dto.PyFloat {
	if f == nil {
		return nil
	}
	v := dto.PyFloat(*f)
	return &v
}

// toOrderResponse는 model.Order → dto.OrderResponse 변환.
// zero date(MySQL '0000-00-00')가 하나라도 있으면 ok=false(→ Python ResponseValidationError 500).
func toOrderResponse(o *model.Order) (dto.OrderResponse, bool) {
	if hasZeroDate(
		o.OtSdate, o.OtEdate, o.OtWdate, o.OtPdate,
		o.OtCdate, o.OtCcdate, o.OtUdate, o.VbankDate,
	) {
		return dto.OrderResponse{}, false
	}
	return dto.OrderResponse{
		OtCode:          o.OtCode,
		OtOriCode:       o.OtOriCode,
		MtIdx:           o.MtIdx,
		MtID:            o.MtID,
		OtTitle:         o.OtTitle,
		OtPayType:       o.OtPayType,
		OtSdate:         pyISOPtr(o.OtSdate),
		OtEdate:         pyISOPtr(o.OtEdate),
		OtStatus:        o.OtStatus,
		OtSprice:        orderFloatPtr(o.OtSprice),
		OtUseCoupon:     orderFloatPtr(o.OtUseCoupon),
		OtCouponIdx:     o.OtCouponIdx,
		OtPrice:         orderFloatPtr(o.OtPrice),
		OtPriceB:        orderFloatPtr(o.OtPriceB),
		OtPayBank:       o.OtPayBank,
		OtRspImpUID:     o.OtRspImpUID,
		CtCancelAmount:  orderFloatPtr(o.CtCancelAmount),
		CtCancelReson:   o.CtCancelReson,
		CtRefundHolder:  o.CtRefundHolder,
		CtRefundBank:    o.CtRefundBank,
		CtRefundAccount: o.CtRefundAccount,
		OtWdate:         pyISOPtr(o.OtWdate),
		OtPdate:         pyISOPtr(o.OtPdate),
		OtCdate:         pyISOPtr(o.OtCdate),
		OtCcdate:        pyISOPtr(o.OtCcdate),
		OtRefundInfo:    o.OtRefundInfo,
		OtShow:          o.OtShow,
		OtMemo:          o.OtMemo,
		OtUdate:         pyISOPtr(o.OtUdate),
		OtCashName:      o.OtCashName,
		OtCashHp:        o.OtCashHp,
		OtCashChk:       o.OtCashChk,
		VbankDate:       pyISOPtr(o.VbankDate),
		OtIdx:           o.OtIdx,
	}, true
}

func toOrderResponses(items []model.Order) ([]dto.OrderResponse, bool) {
	out := make([]dto.OrderResponse, 0, len(items))
	for i := range items {
		r, ok := toOrderResponse(&items[i])
		if !ok {
			return nil, false
		}
		out = append(out, r)
	}
	return out, true
}

// GetOrder는 ot_idx로 단건 조회한다(Python get_order_detail의 CRUD 부분).
// 반환: res(직렬화 결과, zero-date면 nil), ownerID(소유권 비교용 order.mt_idx), found(레코드 존재), ok(직렬화/조회 성공).
// Python 순서(404→403→500 직렬화) 재현을 위해 ownerID를 직렬화 실패와 무관하게 반환한다.
func (s *OrderService) GetOrder(id int) (*dto.OrderResponse, *int, bool, bool) {
	order, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, true
		}
		return nil, nil, false, false
	}
	// repo는 미발견 시 (nil, nil)을 반환한다(Python crud_order.get → None과 동등).
	// nil 가드가 없으면 toOrderResponse가 nil 포인터를 역참조해 500이 되어 Python의 404와 어긋난다.
	if order == nil {
		return nil, nil, false, true
	}
	res, ok := toOrderResponse(order)
	if !ok {
		return nil, order.MtIdx, true, false
	}
	return &res, order.MtIdx, true, true
}

// GetOrderByCode는 ot_code로 단건 조회한다(Python get_order_by_code의 CRUD 부분).
// 반환 의미와 순서(404→403→500 직렬화)는 GetOrder과 동일하다.
func (s *OrderService) GetOrderByCode(code string) (*dto.OrderResponse, *int, bool, bool) {
	order, err := s.repo.GetByCode(code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, true
		}
		return nil, nil, false, false
	}
	// repo는 미발견 시 (nil, nil)을 반환한다(Python crud_order.get_order_by_code → None과 동등).
	// nil 가드가 없으면 toOrderResponse가 nil 포인터를 역참조해 500이 되어 Python의 404와 어긋난다.
	if order == nil {
		return nil, nil, false, true
	}
	res, ok := toOrderResponse(order)
	if !ok {
		return nil, order.MtIdx, true, false
	}
	return &res, order.MtIdx, true, true
}

// MemberOrders는 회원 주문 목록(Python get_orders_by_member).
// total_pages = ceil(total/size)는 핸들러 계산을 그대로 재현한다.
func (s *OrderService) MemberOrders(memberID int, status *int, payType string, page, size int) (*dto.OrderListResponse, bool) {
	items, total, err := s.repo.FindByMember(memberID, status, payType, page, size)
	if err != nil {
		return nil, false
	}
	orders, ok := toOrderResponses(items)
	if !ok {
		return nil, false
	}
	totalPages := int(math.Ceil(float64(total) / float64(size)))
	return &dto.OrderListResponse{
		Orders:     orders,
		Total:      int(total),
		Page:       page,
		Size:       size,
		TotalPages: totalPages,
	}, true
}

// RecentOrders는 최근 주문 목록(Python get_recent_orders). 빈 배열 허용(404 없음).
func (s *OrderService) RecentOrders(memberID, limit int) ([]dto.OrderResponse, bool) {
	items, err := s.repo.FindRecentByMember(memberID, limit)
	if err != nil {
		return nil, false
	}
	return toOrderResponses(items)
}

// OrderSummaryInfo는 회원 주문 요약(Python get_order_summary).
// total_amount/this_month_amount는 SUM(NULL→0.0), average_amount는
// total_amount/completed_orders(완료 0건이면 0.0)다.
func (s *OrderService) OrderSummaryInfo(memberID int) (*dto.OrderSummary, bool) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	row, err := s.repo.Summary(memberID, startOfMonth.Format("2006-01-02 15:04:05"))
	if err != nil {
		return nil, false
	}

	totalAmount := 0.0
	if row.TotalAmount != nil {
		totalAmount = *row.TotalAmount
	}
	thisMonthAmount := 0.0
	if row.ThisMonthAmount != nil {
		thisMonthAmount = *row.ThisMonthAmount
	}
	averageAmount := 0.0
	if row.CompletedOrders > 0 {
		averageAmount = totalAmount / float64(row.CompletedOrders)
	}

	return &dto.OrderSummary{
		TotalOrders:     int(row.TotalOrders),
		TotalAmount:     dto.PyFloat(totalAmount),
		CompletedOrders: int(row.CompletedOrders),
		PendingOrders:   int(row.PendingOrders),
		CancelledOrders: int(row.CancelledOrders),
		ThisMonthAmount: dto.PyFloat(thisMonthAmount),
		AverageAmount:   dto.PyFloat(averageAmount),
	}, true
}
