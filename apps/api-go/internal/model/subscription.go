package model

import "time"

// SubscriptionTransaction은 테이블 subscription_transactions(FastAPI Alembic 0002와 같은 스키마)의 한 행이다.
// 스토어 거래(Apple originalTransactionId / Google purchaseToken) 한 건의 최신 상태를 담는다.
// 시각 컬럼은 UTC 벽시계(naive UTC)로 저장한다. 이 구조체의 time.Time은 실제 시각(UTC)이며,
// DB와의 변환(Local로 감싸기/풀기)은 repository가 경계에서 한다.
type SubscriptionTransaction struct {
	ID int `gorm:"column:id;primaryKey;autoIncrement"`
	// MtIdx: 거래의 소유 회원. UnownedMtIdx(0)는 "아직 어느 회원에도 연결되지 않은 거래"(알림이 먼저 도착해 상태만 기록한 행,
	// 환불·회수 묘비 포함)다. 컬럼이 NOT NULL 이라 NULL 대신 0 을 쓴다(FastAPI 0002 스키마 그대로).
	MtIdx              int        `gorm:"column:mt_idx"`
	Platform           string     `gorm:"column:platform"` // "ios" | "android"
	StoreIDHash        string     `gorm:"column:store_id_hash"`
	ProductID          string     `gorm:"column:product_id"`
	Plan               string     `gorm:"column:plan"` // "month" | "year"
	ExpiresAt          time.Time  `gorm:"column:expires_at"`
	Status             string     `gorm:"column:status"`
	Environment        string     `gorm:"column:environment"`
	AutoRenew          *bool      `gorm:"column:auto_renew"`
	InGracePeriod      bool       `gorm:"column:in_grace_period"`
	StoreUpdatedAt     time.Time  `gorm:"column:store_updated_at"`
	LastNotificationAt *time.Time `gorm:"column:last_notification_at"`
	// autoUpdateTime:false — updated_at은 서비스가 UTC 벽시계로 직접 채운다(GORM 자동 갱신은 Local 시각이라 쓰지 않는다).
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime:false;autoCreateTime:false"`
}

// UnownedMtIdx는 소유 회원이 없는 거래 행(알림만 도착해 상태를 기록한 행)의 mt_idx 값이다. 실제 회원 번호는 1 이상이다.
const UnownedMtIdx = 0

// TableName은 실제 테이블명을 고정한다.
func (SubscriptionTransaction) TableName() string { return "subscription_transactions" }

// SubscriptionMemberPlan은 구독 판정에 필요한 member_t 컬럼만 담는 투영이다(전체 행을 읽지 않는다).
// MtPlanDate는 UTC 벽시계(naive UTC)로 저장된 값이며 repository가 실제 UTC 시각으로 바꿔서 돌려준다.
type SubscriptionMemberPlan struct {
	MtIdx       int        `gorm:"column:mt_idx;primaryKey"`
	MtLevel     *int       `gorm:"column:mt_level"`
	MtPlanDate  *time.Time `gorm:"column:mt_plan_date"`
	MtPlanCheck *string    `gorm:"column:mt_plan_check"`
	// 탈퇴·정지·비노출 판정용(model.IsBlockedMember). 소유자가 차단 상태면 거래 소유권 이전을 허용하는 데 쓴다.
	MtStatus *int    `gorm:"column:mt_status"`
	MtShow   *string `gorm:"column:mt_show"`
}

// TableName은 Member와 같은 테이블을 가리키게 한다.
func (SubscriptionMemberPlan) TableName() string { return "member_t" }
