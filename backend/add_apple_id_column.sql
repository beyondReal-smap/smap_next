-- Apple 로그인을 위한 mt_apple_id 컬럼 추가
-- 실행 환경: MySQL/MariaDB
-- 작성일: 2025-12-23

-- 1. mt_apple_id 컬럼 추가
ALTER TABLE member_t 
ADD COLUMN mt_apple_id VARCHAR(255) NULL 
COMMENT 'Apple 계정 ID' AFTER mt_kakao_id;

-- 2. 인덱스 생성 (Apple ID로 조회 최적화)
CREATE INDEX idx_member_apple_id ON member_t(mt_apple_id);

-- 3. UNIQUE 제약조건 추가 (선택사항 - 하나의 Apple ID는 하나의 계정에만 연결)
-- ALTER TABLE member_t 
-- ADD CONSTRAINT uk_member_apple_id UNIQUE (mt_apple_id);

-- 확인 쿼리
-- DESCRIBE member_t;
-- SELECT COUNT(*) as apple_members FROM member_t WHERE mt_apple_id IS NOT NULL;

-- 롤백 (필요시)
-- ALTER TABLE member_t DROP COLUMN mt_apple_id;
