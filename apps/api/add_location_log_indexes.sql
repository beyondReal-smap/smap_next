-- member_location_log_t 성능 개선 인덱스
-- 이 인덱스는 다음 쿼리들의 전체 테이블 스캔을 인덱스 스캔으로 전환합니다:
--   - 배터리 알림: ROW_NUMBER() OVER (PARTITION BY mt_idx ORDER BY mlt_wdate DESC)
--   - 일일 로그: COUNT(*) GROUP BY mt_idx
--   - 위치 동기화: MAX(mlt_idx) GROUP BY mt_idx
--   - 최근 위치 조회: get_recent_locations_batch
--
-- 실행 전 주의: 대용량 테이블이므로 서비스 저부하 시간에 실행 권장
-- 예상 소요 시간: 테이블 크기에 따라 수 초 ~ 수 분

-- 복합 인덱스: (mt_idx, mlt_idx DESC) — 회원별 최신 레코드 빠른 조회
ALTER TABLE member_location_log_t
ADD INDEX idx_mll_mt_idx_mlt_idx (mt_idx, mlt_idx DESC);

-- 복합 인덱스: (mt_idx, mlt_wdate DESC) — 회원별 시간순 조회 (배터리 알림용)
ALTER TABLE member_location_log_t
ADD INDEX idx_mll_mt_idx_mlt_wdate (mt_idx, mlt_wdate DESC);

-- 확인 쿼리
SHOW INDEX FROM member_location_log_t;
