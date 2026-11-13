-- =====================================================
-- Google 로그인 지원을 위한 member_t 테이블 마이그레이션
-- =====================================================
-- 작성일: 2025-06-08
-- 목적: Google OAuth 로그인 기능 추가
-- 주의: 실행 전 반드시 데이터베이스 백업 수행!

-- =====================================================
-- 1. 현재 테이블 상태 확인
-- =====================================================
SHOW CREATE TABLE member_t;
DESCRIBE member_t;

-- =====================================================
-- 2. Google 관련 컬럼 추가
-- =====================================================

-- 2-1. Google 계정 ID 컬럼 추가
ALTER TABLE member_t 
ADD COLUMN mt_google_id VARCHAR(255) NULL 
COMMENT 'Google 계정 고유 ID (Google OAuth sub 값)';

-- 2-2. 소셜 로그인 제공자 정보 (선택사항 - 향후 확장용)
-- ALTER TABLE member_t 
-- ADD COLUMN mt_social_provider ENUM('google', 'kakao', 'apple', 'naver') NULL 
-- COMMENT '소셜 로그인 제공자';

-- 2-3. 소셜 로그인 연결 일시 (선택사항)
-- ALTER TABLE member_t 
-- ADD COLUMN mt_social_linked_date DATETIME NULL 
-- COMMENT '소셜 계정 연결 일시';

-- =====================================================
-- 3. 인덱스 및 제약조건 추가
-- =====================================================

-- 3-1. Google ID 인덱스 (검색 성능 향상)
CREATE INDEX idx_member_google_id ON member_t(mt_google_id);

-- 3-2. Google ID 유니크 제약조건 (중복 방지)
ALTER TABLE member_t 
ADD CONSTRAINT uk_member_google_id UNIQUE (mt_google_id);

-- 3-3. mt_type과 Google ID 복합 인덱스 (Google 사용자 빠른 조회)
CREATE INDEX idx_member_type_google ON member_t(mt_type, mt_google_id);

-- =====================================================
-- 4. 기존 데이터 업데이트 (필요한 경우)
-- =====================================================

-- 4-1. 기존 Google 사용자가 있다면 mt_type 업데이트
-- UPDATE member_t 
-- SET mt_type = 4 
-- WHERE mt_email LIKE '%@gmail.com' 
-- AND mt_type = 1 
-- AND mt_google_id IS NOT NULL;

-- =====================================================
-- 5. 데이터 검증 쿼리
-- =====================================================

-- 5-1. 전체 회원 수 확인
SELECT COUNT(*) as total_members FROM member_t;

-- 5-2. 로그인 타입별 회원 수
SELECT 
    mt_type,
    CASE 
        WHEN mt_type = 1 THEN '일반'
        WHEN mt_type = 2 THEN '카카오'
        WHEN mt_type = 3 THEN '애플'
        WHEN mt_type = 4 THEN '구글'
        ELSE '기타'
    END as login_type_name,
    COUNT(*) as count
FROM member_t 
GROUP BY mt_type 
ORDER BY mt_type;

-- 5-3. Google 로그인 사용자 확인
SELECT 
    mt_idx, 
    mt_name, 
    mt_email, 
    mt_google_id, 
    mt_type, 
    mt_wdate,
    mt_ldate
FROM member_t 
WHERE mt_google_id IS NOT NULL
ORDER BY mt_wdate DESC;

-- 5-4. 이메일 중복 확인 (Google 계정 연결 시 중요)
SELECT 
    mt_email, 
    COUNT(*) as count,
    GROUP_CONCAT(mt_idx) as member_ids,
    GROUP_CONCAT(mt_type) as login_types
FROM member_t 
WHERE mt_email IS NOT NULL 
GROUP BY mt_email 
HAVING COUNT(*) > 1;

-- =====================================================
-- 6. 성능 확인 쿼리
-- =====================================================

-- 6-1. Google ID로 사용자 조회 성능 테스트
EXPLAIN SELECT * FROM member_t WHERE mt_google_id = 'test_google_id';

-- 6-2. 로그인 타입별 조회 성능 테스트
EXPLAIN SELECT * FROM member_t WHERE mt_type = 4;

-- =====================================================
-- 7. 롤백 스크립트 (문제 발생 시 사용)
-- =====================================================

/*
-- 인덱스 및 제약조건 제거
DROP INDEX idx_member_type_google ON member_t;
ALTER TABLE member_t DROP CONSTRAINT uk_member_google_id;
DROP INDEX idx_member_google_id ON member_t;

-- 컬럼 제거
ALTER TABLE member_t DROP COLUMN mt_google_id;
-- ALTER TABLE member_t DROP COLUMN mt_social_provider;
-- ALTER TABLE member_t DROP COLUMN mt_social_linked_date;

-- 데이터 복원 (필요한 경우)
-- UPDATE member_t SET mt_type = 1 WHERE mt_type = 4;
*/

-- =====================================================
-- 8. 마이그레이션 완료 확인
-- =====================================================

-- 8-1. 테이블 구조 최종 확인
SHOW CREATE TABLE member_t;

-- 8-2. 인덱스 확인
SHOW INDEX FROM member_t;

-- 8-3. 제약조건 확인
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_NAME = 'member_t' 
AND TABLE_SCHEMA = DATABASE();

-- =====================================================
-- 마이그레이션 완료!
-- ===================================================== 