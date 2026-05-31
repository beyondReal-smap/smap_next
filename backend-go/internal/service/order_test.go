package service

import (
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// mockOrderRepo는 orderRepo 인터페이스를 구현하는 테스트용 mock이다.
type mockOrderRepo struct {
	getByID            func(id int) (*model.Order, error)
	getByCode          func(code string) (*model.Order, error)
	findByMember       func(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error)
	findRecentByMember func(memberID, limit int) ([]model.Order, error)
	summary            func(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error)
}

func (m *mockOrderRepo) GetByID(id int) (*model.Order, error) { return m.getByID(id) }
func (m *mockOrderRepo) GetByCode(code string) (*model.Order, error) {
	return m.getByCode(code)
}
func (m *mockOrderRepo) FindByMember(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error) {
	return m.findByMember(memberID, status, payType, page, size)
}
func (m *mockOrderRepo) FindRecentByMember(memberID, limit int) ([]model.Order, error) {
	return m.findRecentByMember(memberID, limit)
}
func (m *mockOrderRepo) Summary(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error) {
	return m.summary(memberID, startOfMonth)
}

func oPtrInt(v int) *int              { return &v }
func oPtrStr(v string) *string        { return &v }
func oPtrF64(v float64) *float64      { return &v }
func oPtrTime(t time.Time) *time.Time { return &t }

// GetOrder: 정상 단건은 (resp, found=true, ok=true).
func TestGetOrder_Found(t *testing.T) {
	repo := &mockOrderRepo{
		getByID: func(id int) (*model.Order, error) {
			return &model.Order{OtIdx: id, MtIdx: oPtrInt(100), OtPrice: oPtrF64(50000)}, nil
		},
	}
	svc := NewOrder(repo)
	res, ownerID, found, ok := svc.GetOrder(7)
	if !ok || !found {
		t.Fatalf("expected ok=found=true, got ok=%v found=%v", ok, found)
	}
	if ownerID == nil || *ownerID != 100 {
		t.Fatalf("expected ownerID=100, got %v", ownerID)
	}
	if res.MtIdx == nil || *res.MtIdx != 100 {
		t.Fatalf("expected res.MtIdx=100, got %v", res.MtIdx)
	}
	if res.OtIdx != 7 {
		t.Fatalf("expected ot_idx=7, got %d", res.OtIdx)
	}
	if res.OtPrice == nil || *res.OtPrice != dto.PyFloat(50000) {
		t.Fatalf("expected ot_price=50000, got %v", res.OtPrice)
	}
}

// GetOrder: 미발견은 found=false, ok=true(→404).
func TestGetOrder_NotFound(t *testing.T) {
	repo := &mockOrderRepo{
		getByID: func(id int) (*model.Order, error) { return nil, gorm.ErrRecordNotFound },
	}
	svc := NewOrder(repo)
	_, _, found, ok := svc.GetOrder(1)
	if !ok {
		t.Fatalf("expected ok=true, got false")
	}
	if found {
		t.Fatalf("expected found=false")
	}
}

// GetOrder: repo 에러는 ok=false(→500).
func TestGetOrder_RepoError(t *testing.T) {
	repo := &mockOrderRepo{
		getByID: func(id int) (*model.Order, error) { return nil, errors.New("db down") },
	}
	svc := NewOrder(repo)
	_, _, _, ok := svc.GetOrder(1)
	if ok {
		t.Fatalf("expected ok=false on repo error")
	}
}

// GetOrder: zero date(MySQL '0000-00-00')는 ok=false(→500, ResponseValidationError 재현).
// 단, zero-date여도 ownerID(order.mt_idx)는 반환되어야 소유권 검사(403)가 가능하다(Python 순서).
func TestGetOrder_ZeroDate(t *testing.T) {
	repo := &mockOrderRepo{
		getByID: func(id int) (*model.Order, error) {
			return &model.Order{OtIdx: id, MtIdx: oPtrInt(100), OtWdate: oPtrTime(time.Time{})}, nil
		},
	}
	svc := NewOrder(repo)
	_, ownerID, found, ok := svc.GetOrder(8)
	if ok {
		t.Fatalf("expected ok=false on zero date")
	}
	if !found {
		t.Fatalf("expected found=true (order exists, validation fails)")
	}
	if ownerID == nil {
		t.Fatalf("expected ownerID != nil even on zero date (소유권 검사 가능해야 함)")
	}
}

// GetOrderByCode: 미발견은 found=false, ok=true.
func TestGetOrderByCode_NotFound(t *testing.T) {
	repo := &mockOrderRepo{
		getByCode: func(code string) (*model.Order, error) { return nil, gorm.ErrRecordNotFound },
	}
	svc := NewOrder(repo)
	_, _, found, ok := svc.GetOrderByCode("X")
	if !ok || found {
		t.Fatalf("expected ok=true found=false, got ok=%v found=%v", ok, found)
	}
}

// MemberOrders: total_pages = ceil(total/size).
func TestMemberOrders_Paging(t *testing.T) {
	repo := &mockOrderRepo{
		findByMember: func(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error) {
			return []model.Order{{OtIdx: 1, OtShow: oPtrStr("Y")}}, 21, nil
		},
	}
	svc := NewOrder(repo)
	res, ok := svc.MemberOrders(7, nil, "", 1, 20)
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if res.Total != 21 || res.Page != 1 || res.Size != 20 {
		t.Fatalf("unexpected paging: total=%d page=%d size=%d", res.Total, res.Page, res.Size)
	}
	if res.TotalPages != 2 {
		t.Fatalf("expected total_pages=2 (ceil(21/20)), got %d", res.TotalPages)
	}
	if len(res.Orders) != 1 {
		t.Fatalf("expected 1 order, got %d", len(res.Orders))
	}
}

// MemberOrders: repo 에러는 ok=false.
func TestMemberOrders_RepoError(t *testing.T) {
	repo := &mockOrderRepo{
		findByMember: func(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error) {
			return nil, 0, errors.New("boom")
		},
	}
	svc := NewOrder(repo)
	if _, ok := svc.MemberOrders(7, nil, "", 1, 20); ok {
		t.Fatalf("expected ok=false")
	}
}

// RecentOrders: 빈 결과는 빈 배열(ok=true).
func TestRecentOrders_Empty(t *testing.T) {
	repo := &mockOrderRepo{
		findRecentByMember: func(memberID, limit int) ([]model.Order, error) {
			return []model.Order{}, nil
		},
	}
	svc := NewOrder(repo)
	res, ok := svc.RecentOrders(7, 5)
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if len(res) != 0 {
		t.Fatalf("expected empty slice, got %d", len(res))
	}
}

// OrderSummaryInfo: 완료 0건이면 average_amount=0.0, SUM NULL이면 0.0.
func TestOrderSummary_ZeroCompleted(t *testing.T) {
	repo := &mockOrderRepo{
		summary: func(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error) {
			return &repository.OrderSummaryRow{
				TotalOrders:     3,
				CompletedOrders: 0,
				PendingOrders:   2,
				CancelledOrders: 1,
				TotalAmount:     nil,
				ThisMonthAmount: nil,
			}, nil
		},
	}
	svc := NewOrder(repo)
	res, ok := svc.OrderSummaryInfo(7)
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if res.TotalOrders != 3 || res.PendingOrders != 2 || res.CancelledOrders != 1 {
		t.Fatalf("unexpected counts: %+v", res)
	}
	if res.TotalAmount != 0 || res.ThisMonthAmount != 0 || res.AverageAmount != 0 {
		t.Fatalf("expected all amounts 0.0, got %+v", res)
	}
}

// OrderSummaryInfo: average = total/completed.
func TestOrderSummary_Average(t *testing.T) {
	repo := &mockOrderRepo{
		summary: func(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error) {
			return &repository.OrderSummaryRow{
				TotalOrders:     5,
				CompletedOrders: 3,
				TotalAmount:     oPtrF64(50000),
				ThisMonthAmount: oPtrF64(20000),
			}, nil
		},
	}
	svc := NewOrder(repo)
	res, ok := svc.OrderSummaryInfo(7)
	if !ok {
		t.Fatalf("expected ok=true")
	}
	expectedAvg := dto.PyFloat(50000.0 / 3.0)
	if res.AverageAmount != expectedAvg {
		t.Fatalf("expected average=%v, got %v", expectedAvg, res.AverageAmount)
	}
	if res.TotalAmount != dto.PyFloat(50000) {
		t.Fatalf("expected total=50000, got %v", res.TotalAmount)
	}
}

// OrderSummaryInfo: repo 에러는 ok=false.
func TestOrderSummary_RepoError(t *testing.T) {
	repo := &mockOrderRepo{
		summary: func(memberID int, startOfMonth string) (*repository.OrderSummaryRow, error) {
			return nil, errors.New("x")
		},
	}
	svc := NewOrder(repo)
	if _, ok := svc.OrderSummaryInfo(7); ok {
		t.Fatalf("expected ok=false")
	}
}
