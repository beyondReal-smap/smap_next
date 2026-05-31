package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type OrderRepository struct {
	db *gorm.DB
}

func NewOrder(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

// GetByID는 ot_idx 단건(Python crud_order.get). 없으면 (nil, nil).
func (r *OrderRepository) GetByID(id int) (*model.Order, error) {
	var o model.Order
	err := r.db.Where("ot_idx = ?", id).First(&o).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// GetByCode는 ot_code 단건(Python crud_order.get_order_by_code). 없으면 (nil, nil).
func (r *OrderRepository) GetByCode(code string) (*model.Order, error) {
	var o model.Order
	err := r.db.Where("ot_code = ?", code).First(&o).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// FindByMember는 Python crud_order.get_orders_by_member의 필터/정렬/페이징을 재현한다.
//   - mt_idx = member_id
//   - status != nil → ot_status = status
//   - payType != "" → ot_pay_type = payType
//   - ot_show = 'Y' 고정
//   - ORDER BY ot_wdate DESC, OFFSET (page-1)*size, LIMIT size
//
// total은 페이징 전 전체 개수(count)다.
func (r *OrderRepository) FindByMember(memberID int, status *int, payType string, page, size int) ([]model.Order, int64, error) {
	q := r.db.Model(&model.Order{}).Where("mt_idx = ?", memberID)
	if status != nil {
		q = q.Where("ot_status = ?", *status)
	}
	if payType != "" {
		q = q.Where("ot_pay_type = ?", payType)
	}
	q = q.Where("ot_show = ?", "Y")

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	out := make([]model.Order, 0)
	err := q.Order("ot_wdate desc").Offset((page - 1) * size).Limit(size).Find(&out).Error
	if err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

// FindRecentByMember는 Python crud_order.get_recent_orders를 재현한다.
//   - mt_idx = member_id AND ot_show = 'Y'
//   - ORDER BY ot_wdate DESC, LIMIT limit
func (r *OrderRepository) FindRecentByMember(memberID, limit int) ([]model.Order, error) {
	out := make([]model.Order, 0)
	err := r.db.Where("mt_idx = ? AND ot_show = ?", memberID, "Y").
		Order("ot_wdate desc").Limit(limit).Find(&out).Error
	return out, err
}

// Summary는 Python crud_order.get_order_summary의 6쿼리를 단일 집계로 합친다(결과값 동일).
//   - 모집단: mt_idx = member_id AND ot_show = 'Y'
//   - total_orders          = COUNT(*)
//   - completed_orders      = COUNT(ot_status = 2)
//   - pending_orders        = COUNT(ot_status = 1)
//   - cancelled_orders      = COUNT(ot_status = 99)
//   - total_amount          = SUM(ot_price WHERE ot_status = 2)
//   - this_month_amount     = SUM(ot_price WHERE ot_status = 2 AND ot_pdate >= start_of_month)
//
// SUM이 NULL(해당 행 없음)이면 *float64는 nil로 들어온다 → 서비스에서 0.0 처리.
type OrderSummaryRow struct {
	TotalOrders     int64    `gorm:"column:total_orders"`
	CompletedOrders int64    `gorm:"column:completed_orders"`
	PendingOrders   int64    `gorm:"column:pending_orders"`
	CancelledOrders int64    `gorm:"column:cancelled_orders"`
	TotalAmount     *float64 `gorm:"column:total_amount"`
	ThisMonthAmount *float64 `gorm:"column:this_month_amount"`
}

func (r *OrderRepository) Summary(memberID int, startOfMonth string) (*OrderSummaryRow, error) {
	var row OrderSummaryRow
	err := r.db.Model(&model.Order{}).
		Where("mt_idx = ? AND ot_show = ?", memberID, "Y").
		Select(
			"COUNT(*) AS total_orders, "+
				"SUM(CASE WHEN ot_status = 2 THEN 1 ELSE 0 END) AS completed_orders, "+
				"SUM(CASE WHEN ot_status = 1 THEN 1 ELSE 0 END) AS pending_orders, "+
				"SUM(CASE WHEN ot_status = 99 THEN 1 ELSE 0 END) AS cancelled_orders, "+
				"SUM(CASE WHEN ot_status = 2 THEN ot_price ELSE NULL END) AS total_amount, "+
				"SUM(CASE WHEN ot_status = 2 AND ot_pdate >= ? THEN ot_price ELSE NULL END) AS this_month_amount",
			startOfMonth,
		).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}
