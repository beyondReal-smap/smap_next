package repository

import "github.com/bluemusk/smap_next_go/internal/model"

// ExistsActiveByEmail은 탈퇴하지 않은(mt_level NULL 또는 1이 아님) 회원 중 이 이메일을 쓰는 계정이
// 있는지 확인한다. 소셜 로그인에서 공급자 이메일이 기존 계정과 겹치는지 판단할 때 쓴다
// (FastAPI member_service의 lower(trim(mt_email)) 비교와 같은 규칙). email은 호출 쪽에서 소문자로 정규화한다.
func (r *MemberRepository) ExistsActiveByEmail(email string) (bool, error) {
	var n int64
	err := r.db.Model(&model.Member{}).
		Where("LOWER(TRIM(mt_email)) = ? AND (mt_level IS NULL OR mt_level <> 1)", email).
		Limit(1).Count(&n).Error
	return n > 0, err
}
