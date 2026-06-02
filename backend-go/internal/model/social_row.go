package model

import "time"

// SocialGroupRow는 find-user/소셜로그인 부가데이터의 그룹 조회 결과(groups_query, LIMIT 10).
type SocialGroupRow struct {
	SgtIdx        int     `gorm:"column:sgt_idx"`
	SgtTitle      *string `gorm:"column:sgt_title"`
	SgdtOwnerChk  *string `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string `gorm:"column:sgdt_leader_chk"`
	MemberCount   int64   `gorm:"column:member_count"`
}

// SocialScheduleRow는 find-user-by-email·google/apple 부가데이터의 스케줄 결과(6컬럼, OR mt_idx 쿼리).
type SocialScheduleRow struct {
	SstIdx           int        `gorm:"column:sst_idx"`
	SstTitle         *string    `gorm:"column:sst_title"`
	SstSdate         *time.Time `gorm:"column:sst_sdate"`
	SstLocationTitle *string    `gorm:"column:sst_location_title"`
	SgtIdx           *int       `gorm:"column:sgt_idx"`
	GroupTitle       *string    `gorm:"column:group_title"`
}

// SocialSchedulePhoneRow는 find-user-by-phone 스케줄 결과(11컬럼, EXISTS 쿼리).
// ⚠️ sst_location_lat/long은 raw Decimal → Pydantic이 문자열로 직렬화(locations 도메인과 동일)하므로
// *string으로 읽는다(텍스트 프로토콜로 MySQL이 포맷한 DECIMAL 문자열 그대로).
type SocialSchedulePhoneRow struct {
	SstIdx           int        `gorm:"column:sst_idx"`
	SstTitle         *string    `gorm:"column:sst_title"`
	SstSdate         *time.Time `gorm:"column:sst_sdate"`
	SstEdate         *time.Time `gorm:"column:sst_edate"`
	SstMemo          *string    `gorm:"column:sst_memo"`
	SgtIdx           *int       `gorm:"column:sgt_idx"`
	SstLocationTitle *string    `gorm:"column:sst_location_title"`
	SstLocationAdd   *string    `gorm:"column:sst_location_add"`
	SstLocationLat   *string    `gorm:"column:sst_location_lat"`
	SstLocationLong  *string    `gorm:"column:sst_location_long"`
	GroupTitle       *string    `gorm:"column:group_title"`
}
