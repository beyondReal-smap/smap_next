// Package repository는 GORM 기반 데이터 접근 계층 (service → repository → DB).
package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type NoticeRepository struct {
	db *gorm.DB
}

func NewNotice(db *gorm.DB) *NoticeRepository {
	return &NoticeRepository{db: db}
}

// Create는 새 공지를 INSERT한다(Python crud.create_notice). nt_hit/wdate/uwdate는 서비스가 설정.
func (r *NoticeRepository) Create(n *model.Notice) error {
	return r.db.Create(n).Error
}

// UpdateFields는 nt_idx 행의 지정 컬럼만 UPDATE한다(update/hide/show 공용). RowsAffected 반환.
func (r *NoticeRepository) UpdateFields(id int, fields map[string]interface{}) (int64, error) {
	res := r.db.Model(&model.Notice{}).Where("nt_idx = ?", id).Updates(fields)
	return res.RowsAffected, res.Error
}

// Delete는 nt_idx 행을 하드 삭제한다(Python crud.delete_notice).
func (r *NoticeRepository) Delete(id int) error {
	return r.db.Where("nt_idx = ?", id).Delete(&model.Notice{}).Error
}

// GetByID는 nt_idx로 단건 조회. 없으면 (nil, nil) — Python crud.get_notice와 동등.
func (r *NoticeRepository) GetByID(id int) (*model.Notice, error) {
	var n model.Notice
	err := r.db.Where("nt_idx = ?", id).First(&n).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// IncrementHitAndGet은 nt_hit를 원자적으로 +1 후 갱신 행을 반환.
// Python crud.get_notice_and_increment_hit은 (nt_hit or 0)+1을 읽고-증가(비원자적)하지만,
// 결과는 동일하며 동시성에서 더 안전하도록 COALESCE 원자 UPDATE로 이식.
// 대상이 없으면 (nil, nil).
func (r *NoticeRepository) IncrementHitAndGet(id int) (*model.Notice, error) {
	res := r.db.Model(&model.Notice{}).
		Where("nt_idx = ?", id).
		UpdateColumn("nt_hit", gorm.Expr("COALESCE(nt_hit, 0) + 1"))
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return r.GetByID(id)
}

// List는 nt_wdate desc 정렬 목록. show_only면 nt_show='Y'만.
func (r *NoticeRepository) List(skip, limit int, showOnly bool) ([]model.Notice, error) {
	q := r.db.Model(&model.Notice{})
	if showOnly {
		q = q.Where("nt_show = ?", "Y")
	}
	out := make([]model.Notice, 0)
	err := q.Order("nt_wdate desc").Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// Count는 목록 총 개수. show_only면 nt_show='Y'만.
func (r *NoticeRepository) Count(showOnly bool) (int64, error) {
	q := r.db.Model(&model.Notice{})
	if showOnly {
		q = q.Where("nt_show = ?", "Y")
	}
	var c int64
	err := q.Count(&c).Error
	return c, err
}

// Search는 제목/내용 LIKE '%keyword%'. Python nt_title.contains|nt_content.contains와 동등
// (와일드카드 이스케이프 없이 동일 동작 유지).
func (r *NoticeRepository) Search(keyword string, skip, limit int, showOnly bool) ([]model.Notice, error) {
	q := r.db.Model(&model.Notice{})
	if showOnly {
		q = q.Where("nt_show = ?", "Y")
	}
	like := "%" + keyword + "%"
	q = q.Where("nt_title LIKE ? OR nt_content LIKE ?", like, like)
	out := make([]model.Notice, 0)
	err := q.Order("nt_wdate desc").Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}
