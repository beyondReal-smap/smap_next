-- Refresh token 저장소
-- raw token은 저장하지 않고 SHA-256 해시만 저장.
-- rotation은 chain_id로 묶이며, reuse detection 시 해당 체인 전체 revoke.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    mt_idx            INT          NOT NULL,
    token_hash        CHAR(64)     NOT NULL UNIQUE,
    chain_id          CHAR(36)     NOT NULL,
    issued_at         DATETIME     NOT NULL,
    expires_at        DATETIME     NOT NULL,
    revoked_at        DATETIME     NULL,
    replaced_by_hash  CHAR(64)     NULL,
    user_agent        VARCHAR(255) NULL,
    ip_hash           CHAR(64)     NULL,
    INDEX idx_refresh_mt_idx   (mt_idx),
    INDEX idx_refresh_chain    (chain_id),
    INDEX idx_refresh_expires  (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
