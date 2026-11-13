-- FCM 토큰 만료 관리 필드 추가
-- 실행일시: 2025-01-16

USE smap_db;

-- member_t 테이블에 FCM 토큰 만료 관련 필드 추가
ALTER TABLE member_t
ADD COLUMN mt_token_updated_at DATETIME NULL COMMENT 'FCM 토큰 마지막 업데이트 일시',
ADD COLUMN mt_token_expiry_date DATETIME NULL COMMENT 'FCM 토큰 예상 만료일 (7일 후)';

-- 기존 FCM 토큰이 있는 사용자들의 만료일 설정 (업데이트 일시를 현재 시간으로 가정)
UPDATE member_t
SET mt_token_updated_at = NOW(),
    mt_token_expiry_date = DATE_ADD(NOW(), INTERVAL 7 DAY)
WHERE mt_token_id IS NOT NULL
  AND mt_token_id != ''
  AND (mt_token_updated_at IS NULL OR mt_token_expiry_date IS NULL);

-- 인덱스 추가로 조회 성능 향상
CREATE INDEX idx_member_token_expiry ON member_t(mt_token_expiry_date);
CREATE INDEX idx_member_token_updated ON member_t(mt_token_updated_at);

-- FCM 토큰 만료 확인을 위한 뷰 생성
CREATE OR REPLACE VIEW member_fcm_token_status AS
SELECT
    mt_idx,
    mt_id,
    mt_token_id,
    mt_token_updated_at,
    mt_token_expiry_date,
    CASE
        WHEN mt_token_id IS NULL OR mt_token_id = '' THEN 'NO_TOKEN'
        WHEN mt_token_expiry_date < NOW() THEN 'EXPIRED'
        WHEN mt_token_expiry_date < DATE_ADD(NOW(), INTERVAL 1 DAY) THEN 'NEAR_EXPIRY'
        ELSE 'VALID'
    END AS token_status,
    CASE
        WHEN mt_token_expiry_date IS NOT NULL THEN
            TIMESTAMPDIFF(HOUR, NOW(), mt_token_expiry_date)
        ELSE NULL
    END AS hours_until_expiry,
    mt_udate,
    mt_ldate
FROM member_t
WHERE mt_level != 1  -- 탈퇴회원 제외
  AND mt_status = 1; -- 정상 상태만

-- FCM 토큰 만료 알림 대상 조회 쿼리
-- 1일 이내 만료 예정인 토큰들
SELECT
    mt_idx,
    mt_token_id,
    mt_token_expiry_date,
    TIMESTAMPDIFF(HOUR, NOW(), mt_token_expiry_date) as hours_left
FROM member_t
WHERE mt_token_expiry_date < DATE_ADD(NOW(), INTERVAL 1 DAY)
  AND mt_token_expiry_date > NOW()
  AND mt_token_id IS NOT NULL
  AND mt_token_id != ''
  AND mt_level != 1
  AND mt_status = 1;

-- 3일 이상 업데이트되지 않은 토큰들
SELECT
    mt_idx,
    mt_token_id,
    mt_token_updated_at,
    TIMESTAMPDIFF(DAY, mt_token_updated_at, NOW()) as days_since_update
FROM member_t
WHERE mt_token_updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
  AND mt_token_id IS NOT NULL
  AND mt_token_id != ''
  AND mt_level != 1
  AND mt_status = 1;

COMMIT;

-- 실행 결과 확인
SELECT
    COUNT(*) as total_members,
    SUM(CASE WHEN mt_token_id IS NOT NULL AND mt_token_id != '' THEN 1 ELSE 0 END) as with_tokens,
    SUM(CASE WHEN mt_token_expiry_date < NOW() THEN 1 ELSE 0 END) as expired_tokens,
    SUM(CASE WHEN mt_token_expiry_date < DATE_ADD(NOW(), INTERVAL 1 DAY) AND mt_token_expiry_date > NOW() THEN 1 ELSE 0 END) as near_expiry_tokens
FROM member_t;
