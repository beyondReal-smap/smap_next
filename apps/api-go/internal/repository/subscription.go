package repository

import (
	"context"
	"errors"
	"time"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/bluemusk/smap_next_go/internal/model"
)

var (
	// ErrDuplicateKey는 유니크 키 위반(MySQL 1062)이다. 같은 거래를 두 요청이 동시에 처음 기록하려 할 때 난다.
	ErrDuplicateKey = errors.New("duplicate key")
	// ErrSubscriptionTableMissing은 subscription_transactions 테이블이 없다(MySQL 1146).
	ErrSubscriptionTableMissing = errors.New("subscription_transactions table missing")
	// ErrRetryableTx는 교착(1213)·잠금 대기 초과(1205)로 트랜잭션을 다시 시도하면 되는 경우다.
	ErrRetryableTx = errors.New("retryable transaction error")
	// ErrMemberNotFound는 회원 행이 없다.
	ErrMemberNotFound = errors.New("member not found")
)

const (
	mysqlDupEntry   = 1062
	mysqlNoSuchTbl  = 1146
	mysqlDeadlock   = 1213
	mysqlLockWaitTO = 1205
)

// classifySubscriptionErr는 MySQL 오류 번호를 이 패키지의 sentinel로 바꾼다. 알 수 없는 오류는 그대로 돌려준다.
func classifySubscriptionErr(err error) error {
	var me *mysql.MySQLError
	if errors.As(err, &me) {
		switch me.Number {
		case mysqlDupEntry:
			return ErrDuplicateKey
		case mysqlNoSuchTbl:
			return ErrSubscriptionTableMissing
		case mysqlDeadlock, mysqlLockWaitTO:
			return ErrRetryableTx
		}
	}
	return err
}

// dbWall은 실제 UTC 시각을 "UTC 벽시계 숫자를 Local 존으로 감싼 값"으로 바꾼다.
// DSN이 loc=Local이라 드라이버가 time.Time을 Local로 변환해 저장하므로, 이렇게 감싸야 DB에 UTC 벽시계가 그대로 들어간다
// (service.dbUTCNow와 같은 규칙; FastAPI는 naive UTC로 저장한다).
func dbWall(t time.Time) time.Time {
	u := t.UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), u.Hour(), u.Minute(), u.Second(), 0, time.Local)
}

// fromDBWall은 DB에서 읽은 값(Local 존으로 해석된 UTC 벽시계)을 실제 UTC 시각으로 되돌린다.
func fromDBWall(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, time.UTC)
}

// SubscriptionRepository는 구독 거래 기록과 회원 구독 표시 컬럼(mt_plan_date/mt_plan_check/mt_level)을 다룬다.
type SubscriptionRepository struct {
	db *gorm.DB
}

func NewSubscription(db *gorm.DB) *SubscriptionRepository { return &SubscriptionRepository{db: db} }

// SubscriptionTxOps는 회원 행을 잠근 트랜잭션 안에서 쓰는 작업이다(서비스 단위 테스트에서 가짜로 대체한다).
type SubscriptionTxOps interface {
	// ForMember는 같은 트랜잭션에서 다른 회원(이전 소유자 등)을 대상으로 하는 작업 집합을 돌려준다.
	ForMember(mtIdx int) SubscriptionTxOps
	// LockMember는 대상 회원 행을 FOR UPDATE 로 잠그고 읽는다. 회원이 없으면 ErrMemberNotFound.
	LockMember() (*model.SubscriptionMemberPlan, error)
	FindByHash(platform, hash string) (*model.SubscriptionTransaction, error)
	ListByMember() ([]model.SubscriptionTransaction, error)
	Insert(row *model.SubscriptionTransaction) error
	Save(row *model.SubscriptionTransaction) error
	UpdateMemberPlan(planDate time.Time, planCheck string, level *int) error
}

// SubscriptionTx는 SubscriptionTxOps 의 GORM 구현이다.
type SubscriptionTx struct {
	tx *gorm.DB
	mt int
}

func toDB(m *model.SubscriptionTransaction) *model.SubscriptionTransaction {
	c := *m
	c.ExpiresAt = dbWall(m.ExpiresAt)
	c.StoreUpdatedAt = dbWall(m.StoreUpdatedAt)
	c.UpdatedAt = dbWall(m.UpdatedAt)
	if m.LastNotificationAt != nil {
		t := dbWall(*m.LastNotificationAt)
		c.LastNotificationAt = &t
	}
	return &c
}

func fromDB(m *model.SubscriptionTransaction) {
	m.ExpiresAt = fromDBWall(m.ExpiresAt)
	m.StoreUpdatedAt = fromDBWall(m.StoreUpdatedAt)
	m.UpdatedAt = fromDBWall(m.UpdatedAt)
	if m.LastNotificationAt != nil {
		t := fromDBWall(*m.LastNotificationAt)
		m.LastNotificationAt = &t
	}
}

func planFromDB(p *model.SubscriptionMemberPlan) {
	if p.MtPlanDate != nil {
		t := fromDBWall(*p.MtPlanDate)
		p.MtPlanDate = &t
	}
}

// WithMemberLock은 한 회원의 member_t 행을 FOR UPDATE로 잠근 트랜잭션에서 fn을 실행한다.
// 같은 회원의 동시 갱신을 직렬화한다. 회원이 없으면 ErrMemberNotFound.
func (r *SubscriptionRepository) WithMemberLock(ctx context.Context, mtIdx int, fn func(tx SubscriptionTxOps, member *model.SubscriptionMemberPlan) error) error {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ops := &SubscriptionTx{tx: tx, mt: mtIdx}
		m, err := ops.LockMember()
		if err != nil {
			return err
		}
		return fn(ops, m)
	})
	return classifySubscriptionErr(err)
}

// WithTx는 회원 행을 잠그지 않는 트랜잭션에서 fn을 실행한다(소유 회원이 없는 거래 행의 기록·갱신용).
// 같은 거래를 동시에 처음 기록하면 유니크 키 위반(ErrDuplicateKey)·교착(ErrRetryableTx)이 날 수 있으니 호출자가 다시 시도한다.
func (r *SubscriptionRepository) WithTx(ctx context.Context, fn func(tx SubscriptionTxOps) error) error {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&SubscriptionTx{tx: tx, mt: model.UnownedMtIdx})
	})
	return classifySubscriptionErr(err)
}

// ForMember는 같은 트랜잭션을 다른 회원 기준으로 쓰는 작업 집합이다.
func (t *SubscriptionTx) ForMember(mtIdx int) SubscriptionTxOps {
	return &SubscriptionTx{tx: t.tx, mt: mtIdx}
}

// LockMember는 이 작업 집합의 회원 행을 FOR UPDATE로 잠그고 읽는다.
func (t *SubscriptionTx) LockMember() (*model.SubscriptionMemberPlan, error) {
	var m model.SubscriptionMemberPlan
	if err := t.tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("mt_idx = ?", t.mt).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrMemberNotFound
		}
		return nil, classifySubscriptionErr(err)
	}
	planFromDB(&m)
	return &m, nil
}

var _ SubscriptionTxOps = (*SubscriptionTx)(nil)

// FindByHash는 (platform, store_id_hash) 행을 잠그고 읽는다. 없으면 (nil, nil).
func (t *SubscriptionTx) FindByHash(platform, hash string) (*model.SubscriptionTransaction, error) {
	var row model.SubscriptionTransaction
	err := t.tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("platform = ? AND store_id_hash = ?", platform, hash).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, classifySubscriptionErr(err)
	}
	fromDB(&row)
	return &row, nil
}

// ListByMember는 이 회원의 모든 거래 행이다(잠금 트랜잭션 안).
func (t *SubscriptionTx) ListByMember() ([]model.SubscriptionTransaction, error) {
	var rows []model.SubscriptionTransaction
	if err := t.tx.Where("mt_idx = ?", t.mt).Order("id").Find(&rows).Error; err != nil {
		return nil, classifySubscriptionErr(err)
	}
	for i := range rows {
		fromDB(&rows[i])
	}
	return rows, nil
}

// Insert는 새 거래 행을 만든다. 유니크 키 위반이면 ErrDuplicateKey.
func (t *SubscriptionTx) Insert(row *model.SubscriptionTransaction) error {
	c := toDB(row)
	if err := t.tx.Create(c).Error; err != nil {
		return classifySubscriptionErr(err)
	}
	row.ID = c.ID
	return nil
}

// Save는 기존 거래 행을 갱신한다.
func (t *SubscriptionTx) Save(row *model.SubscriptionTransaction) error {
	c := toDB(row)
	if err := t.tx.Save(c).Error; err != nil {
		return classifySubscriptionErr(err)
	}
	return nil
}

// UpdateMemberPlan은 회원의 구독 표시 컬럼을 갱신한다. level이 nil이면 mt_level은 건드리지 않는다.
func (t *SubscriptionTx) UpdateMemberPlan(planDate time.Time, planCheck string, level *int) error {
	if t.mt <= 0 {
		return errors.New("subscription: 소유 회원이 없는 작업 집합에는 회원 컬럼을 쓸 수 없음")
	}
	fields := map[string]interface{}{"mt_plan_date": dbWall(planDate), "mt_plan_check": planCheck}
	if level != nil {
		fields["mt_level"] = *level
	}
	if err := t.tx.Model(&model.SubscriptionMemberPlan{}).Where("mt_idx = ?", t.mt).Updates(fields).Error; err != nil {
		return classifySubscriptionErr(err)
	}
	return nil
}

// FindByHash는 잠금 없이 읽는다(중복 키 위반 뒤 소유자 확인용). 없으면 (nil, nil).
func (r *SubscriptionRepository) FindByHash(ctx context.Context, platform, hash string) (*model.SubscriptionTransaction, error) {
	var row model.SubscriptionTransaction
	err := r.db.WithContext(ctx).Where("platform = ? AND store_id_hash = ?", platform, hash).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, classifySubscriptionErr(err)
	}
	fromDB(&row)
	return &row, nil
}

// ListByMember는 잠금 없이 회원의 거래 행을 읽는다(상태 조회용).
func (r *SubscriptionRepository) ListByMember(ctx context.Context, mtIdx int) ([]model.SubscriptionTransaction, error) {
	var rows []model.SubscriptionTransaction
	if err := r.db.WithContext(ctx).Where("mt_idx = ?", mtIdx).Order("id").Find(&rows).Error; err != nil {
		return nil, classifySubscriptionErr(err)
	}
	for i := range rows {
		fromDB(&rows[i])
	}
	return rows, nil
}

// MemberPlan은 회원의 구독 표시 컬럼을 읽는다. 없으면 ErrMemberNotFound.
func (r *SubscriptionRepository) MemberPlan(ctx context.Context, mtIdx int) (*model.SubscriptionMemberPlan, error) {
	var m model.SubscriptionMemberPlan
	err := r.db.WithContext(ctx).Where("mt_idx = ?", mtIdx).Take(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	planFromDB(&m)
	return &m, nil
}

// SyncMemberLevel은 회원의 mt_level을 want(2 또는 5)로 맞춘다. 현재 값이 2 또는 5일 때만 바꾼다(탈퇴 1·관리자 9 등은 건드리지 않는다).
// plan_check는 want가 2일 때 'N'으로 맞춘다. 바뀐 행이 있으면 true.
func (r *SubscriptionRepository) SyncMemberLevel(ctx context.Context, mtIdx, want int) (bool, error) {
	fields := map[string]interface{}{"mt_level": want}
	if want == 2 {
		fields["mt_plan_check"] = "N"
	}
	res := r.db.WithContext(ctx).Model(&model.SubscriptionMemberPlan{}).
		Where("mt_idx = ? AND mt_level IN (2, 5) AND mt_level <> ?", mtIdx, want).Updates(fields)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// ExpireLapsed는 구독이 만료된 mt_level=5 회원을 2로 되돌린다(알림 누락 보정). 바뀐 행 수를 돌려준다.
func (r *SubscriptionRepository) ExpireLapsed(ctx context.Context, now time.Time) (int64, error) {
	res := r.db.WithContext(ctx).Model(&model.SubscriptionMemberPlan{}).
		Where("mt_level = 5 AND mt_plan_date IS NOT NULL AND mt_plan_date <= ?", dbWall(now)).
		Updates(map[string]interface{}{"mt_level": 2, "mt_plan_check": "N"})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

// CountVisiblePlaces는 회원의 내 장소 수(slt_show='Y')다. 무료 한도 판정에 쓴다.
func (r *SubscriptionRepository) CountVisiblePlaces(ctx context.Context, mtIdx int) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.Location{}).Where("mt_idx = ? AND slt_show = 'Y'", mtIdx).Count(&n).Error
	return n, err
}

// TableExists는 subscription_transactions 테이블 존재 여부다(시작 점검용).
func (r *SubscriptionRepository) TableExists(ctx context.Context) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Raw(
		"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'subscription_transactions'").Scan(&n).Error
	return n > 0, err
}
