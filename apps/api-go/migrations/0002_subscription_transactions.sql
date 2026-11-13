-- 구독 거래 연결 및 최신 스토어 상태 저장 (SMAP 프리미엄 구독, 계약: .claude/plans/subscription_contract.md 2절).
--
-- FastAPI Alembic 마이그레이션 backend/alembic/versions/0002_subscription_transactions.py (revision 0002_subscriptions)
-- 와 같은 스키마다. 어느 쪽에서 만들어도 두 서버가 같은 테이블을 쓸 수 있다.
--   * 이 SQL을 먼저 적용했다면 Alembic은 `alembic stamp 0002_subscriptions` 로 표시만 하고 upgrade 하지 않는다.
--   * Alembic으로 먼저 만들었다면 이 SQL은 적용하지 않는다(CREATE TABLE이 "already exists"로 실패한다).
--
-- 시각 컬럼(DATETIME)은 모두 UTC 벽시계(naive UTC)로 저장한다(FastAPI와 동일).
-- store_id_hash = SHA-256(hex)(Apple originalTransactionId | Google purchaseToken). 원본 식별자는 저장하지 않는다.
-- (platform, store_id_hash) 유니크 제약이 "한 거래는 한 회원에게만"을 DB 수준에서 보장한다.
--
-- 이 파일은 작성만 했다. 운영 DB 적용은 대표님이 확인 후 수동으로 한다.
-- 되돌리기: DROP TABLE subscription_transactions;  (인덱스는 테이블과 함께 삭제된다)

CREATE TABLE subscription_transactions (
	id INTEGER NOT NULL AUTO_INCREMENT,
	mt_idx INTEGER NOT NULL,
	platform VARCHAR(16) NOT NULL,
	store_id_hash VARCHAR(64) NOT NULL,
	product_id VARCHAR(255) NOT NULL,
	plan VARCHAR(8) NOT NULL,
	expires_at DATETIME NOT NULL,
	status VARCHAR(32) NOT NULL,
	environment VARCHAR(16) NOT NULL,
	auto_renew BOOL,
	in_grace_period BOOL NOT NULL,
	store_updated_at DATETIME NOT NULL,
	last_notification_at DATETIME,
	updated_at DATETIME NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_subscription_store UNIQUE (platform, store_id_hash)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_subscription_transactions_mt_idx ON subscription_transactions (mt_idx);
