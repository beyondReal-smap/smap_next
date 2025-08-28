-- FCM 토큰 만료 관리 필드 롤백 스크립트
-- 실행일시: 2025-01-16

USE smap2_db;

-- 뷰 삭제
DROP VIEW IF EXISTS member_fcm_token_status;

-- 인덱스 삭제
DROP INDEX IF EXISTS idx_member_token_expiry ON member_t;
DROP INDEX IF EXISTS idx_member_token_updated ON member_t;

-- 추가된 컬럼 삭제
ALTER TABLE member_t
DROP COLUMN IF EXISTS mt_token_updated_at,
DROP COLUMN IF EXISTS mt_token_expiry_date;

COMMIT;

SELECT 'FCM 토큰 만료 관리 필드 롤백 완료' as result;
