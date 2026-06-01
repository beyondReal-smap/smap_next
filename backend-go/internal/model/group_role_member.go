package model

// GroupRoleMember는 Python GroupDetail.get_group_members_with_roles(group_detail.py:50)의
// 단일 raw SQL 한 행이다(테이블 모델 아님). schedule:30min 그룹 fan-out 대상 산정에 쓰며,
// 발송에 필요한 토큰/언어/이름 메타만 담는다.
//
// ⚠️ Python 원본 쿼리는 mt_status 필터가 없다(활성 여부 무관). 그룹 fan-out은 owner/leader/
// members를 owner_chk/leader_chk로 분류만 하고 전부 대상에 합친다.
type GroupRoleMember struct {
	SgdtIdx       int     `gorm:"column:sgdt_idx"`
	MtIdx         int     `gorm:"column:mt_idx"`
	SgdtOwnerChk  *string `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string `gorm:"column:sgdt_leader_chk"`
	MtLang        *string `gorm:"column:mt_lang"`
	MtTokenID     *string `gorm:"column:mt_token_id"`
	MtNickname    *string `gorm:"column:mt_nickname"`
	MtName        *string `gorm:"column:mt_name"`
}
