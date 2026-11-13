-- 현재 member_t 테이블의 FCM 관련 컬럼 확인
DESCRIBE member_t;

-- 현재 FCM 토큰 관련 컬럼만 조회
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'smap2_db'
  AND TABLE_NAME = 'member_t'
  AND COLUMN_NAME LIKE '%token%';

-- 기존 FCM 토큰 데이터 확인
SELECT COUNT(*) as total_members,
       SUM(CASE WHEN mt_token_id IS NOT NULL AND mt_token_id != '' THEN 1 ELSE 0 END) as with_tokens,
       SUM(CASE WHEN mt_token_id IS NULL OR mt_token_id = '' THEN 1 ELSE 0 END) as without_tokens
FROM member_t
WHERE mt_level != 1 AND mt_status = 1;
