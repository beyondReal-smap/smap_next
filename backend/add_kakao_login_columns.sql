-- 카카오 로그인을 위한 member_t 테이블 컬럼 추가 DDL
-- 실행 전 반드시 데이터베이스 백업을 수행하세요!

USE smap2_db;

-- 1. 카카오 계정 ID 컬럼 추가
ALTER TABLE member_t 
ADD COLUMN mt_kakao_id VARCHAR(255) NULL 
COMMENT '카카오 계정 고유 ID' AFTER mt_google_id;

-- 2. 카카오 ID에 대한 인덱스 추가 (검색 성능 향상)
CREATE INDEX idx_member_kakao_id ON member_t(mt_kakao_id);

-- 3. 카카오 ID 유니크 제약조건 추가 (중복 방지)
ALTER TABLE member_t 
ADD CONSTRAINT uk_member_kakao_id UNIQUE (mt_kakao_id);

-- 4. 기존 데이터 확인 쿼리 (실행 후 확인용)
-- SELECT COUNT(*) as total_members FROM member_t;
-- SELECT COUNT(*) as kakao_members FROM member_t WHERE mt_kakao_id IS NOT NULL;
-- SELECT mt_type, COUNT(*) as count FROM member_t GROUP BY mt_type;

-- 5. 카카오 로그인 사용자 조회 쿼리 (테스트용)
-- SELECT mt_idx, mt_name, mt_email, mt_kakao_id, mt_type, mt_wdate 
-- FROM member_t 
-- WHERE mt_type = 2 AND mt_kakao_id IS NOT NULL;

-- 6. 롤백용 DDL (문제 발생 시 사용)
-- ALTER TABLE member_t DROP CONSTRAINT uk_member_kakao_id;
-- DROP INDEX idx_member_kakao_id ON member_t;
-- ALTER TABLE member_t DROP COLUMN mt_kakao_id;

-- 변경사항 확인
DESCRIBE member_t;

-- 추가된 컬럼 확인
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'smap2_db' 
AND TABLE_NAME = 'member_t' 
AND COLUMN_NAME = 'mt_kakao_id';

-- 인덱스 확인
SHOW INDEX FROM member_t WHERE Column_name = 'mt_kakao_id'; 