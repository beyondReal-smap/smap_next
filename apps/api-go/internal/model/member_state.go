package model

// MemberAccessState는 요청 인증 시 필요한 회원 상태 컬럼 3개만 담는 읽기 전용 투영이다.
// (전체 Member 행을 매 요청 읽지 않기 위함. 테이블은 member_t 그대로.)
type MemberAccessState struct {
	MtLevel  *int    `gorm:"column:mt_level"`
	MtStatus *int    `gorm:"column:mt_status"`
	MtShow   *string `gorm:"column:mt_show"`
}

// TableName은 Member와 같은 테이블을 가리키게 한다.
func (MemberAccessState) TableName() string { return "member_t" }

// IsBlockedMember는 로그인/토큰 사용을 막아야 하는 회원인지 판정한다.
// FastAPI `is_active_member`와 같은 규칙: 명시적 차단 값만 거부하고 NULL은 통과시킨다
// (오래된 회원 잠금 방지). 탈퇴 mt_level==1, 정지 mt_status==2, 비노출 mt_show=='N'.
func IsBlockedMember(level, status *int, show *string) bool {
	if level != nil && *level == 1 {
		return true
	}
	if status != nil && *status == 2 {
		return true
	}
	if show != nil && *show == "N" {
		return true
	}
	return false
}

// IsBlocked는 IsBlockedMember의 Member 편의 메서드다.
func (m *Member) IsBlocked() bool { return IsBlockedMember(m.MtLevel, m.MtStatus, m.MtShow) }

// IsBlocked는 IsBlockedMember의 MemberAccessState 편의 메서드다.
func (s *MemberAccessState) IsBlocked() bool { return IsBlockedMember(s.MtLevel, s.MtStatus, s.MtShow) }
