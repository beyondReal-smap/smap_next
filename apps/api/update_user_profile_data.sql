-- 사용자 jin (mt_idx = 1186)의 프로필 정보 업데이트
-- 생년월일과 성별 정보 추가

UPDATE member_t 
SET 
    mt_birth = '1990-05-15',
    mt_gender = 1,
    mt_udate = NOW()
WHERE mt_idx = 1186;

-- 업데이트 결과 확인
SELECT 
    mt_idx,
    mt_id,
    mt_name,
    mt_nickname,
    mt_birth,
    mt_gender,
    mt_hp,
    mt_email,
    mt_type,
    mt_level
FROM member_t 
WHERE mt_idx = 1186; 