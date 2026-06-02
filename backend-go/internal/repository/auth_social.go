package repository

import (
	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// AuthSocialRepository는 소셜로그인/find-user의 부가데이터(그룹·스케줄) raw SQL을 담당한다.
// Python auth.py·member_service._get_user_additional_data의 text() 쿼리를 그대로 위임한다.
type AuthSocialRepository struct {
	db *gorm.DB
}

func NewAuthSocial(db *gorm.DB) *AuthSocialRepository {
	return &AuthSocialRepository{db: db}
}

// groupsSQL은 find-email/find-phone/additional-data가 공유하는 동일 쿼리(LIMIT 10).
const groupsSQL = `
SELECT sg.sgt_idx, sg.sgt_title, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk,
       COUNT(DISTINCT sgd2.mt_idx) AS member_count
FROM smap_group_detail_t sgd
JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
LEFT JOIN smap_group_detail_t sgd2 ON sg.sgt_idx = sgd2.sgt_idx
    AND sgd2.sgdt_discharge = 'N' AND sgd2.sgdt_exit = 'N' AND sgd2.sgdt_show = 'Y'
WHERE sgd.mt_idx = ? AND sgd.sgdt_discharge = 'N' AND sgd.sgdt_exit = 'N'
    AND sgd.sgdt_show = 'Y' AND sg.sgt_show = 'Y'
GROUP BY sg.sgt_idx, sg.sgt_title, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk
ORDER BY sgd.sgdt_owner_chk DESC, sgd.sgdt_leader_chk DESC
LIMIT 10`

// GroupsForUser는 사용자가 속한 그룹 목록(공유 쿼리).
func (r *AuthSocialRepository) GroupsForUser(mtIdx int) ([]model.SocialGroupRow, error) {
	out := make([]model.SocialGroupRow, 0)
	err := r.db.Raw(groupsSQL, mtIdx).Scan(&out).Error
	return out, err
}

// schedulesOrSQL은 find-email·google/apple 변형(OR mt_idx, 6컬럼).
const schedulesOrSQL = `
SELECT sst.sst_idx, sst.sst_title, sst.sst_sdate, sst.sst_location_title,
       sst.sgt_idx, sg.sgt_title AS group_title
FROM smap_schedule_t sst
LEFT JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
WHERE (sst.mt_idx = ? OR sst.sgt_idx IN (
    SELECT DISTINCT sgd.sgt_idx FROM smap_group_detail_t sgd
    WHERE sgd.mt_idx = ? AND sgd.sgdt_discharge = 'N' AND sgd.sgdt_exit = 'N' AND sgd.sgdt_show = 'Y'
))
AND sst.sst_show = 'Y' AND sst.sst_sdate BETWEEN ? AND ?
ORDER BY sst.sst_sdate ASC
LIMIT 20`

// SchedulesOrForUser는 find-email·google/apple의 스케줄 목록(7일창, OR mt_idx).
func (r *AuthSocialRepository) SchedulesOrForUser(mtIdx int, start, end string) ([]model.SocialScheduleRow, error) {
	out := make([]model.SocialScheduleRow, 0)
	err := r.db.Raw(schedulesOrSQL, mtIdx, mtIdx, start, end).Scan(&out).Error
	return out, err
}

// schedulesExistsSQL은 find-phone 변형(EXISTS, 11컬럼).
const schedulesExistsSQL = `
SELECT sst.sst_idx, sst.sst_title, sst.sst_sdate, sst.sst_edate, sst.sst_memo,
       sst.sgt_idx, sst.sst_location_title, sst.sst_location_add,
       sst.sst_location_lat, sst.sst_location_long, sg.sgt_title AS group_title
FROM smap_schedule_t sst
LEFT JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
WHERE sst.sst_show = 'Y' AND sst.sst_sdate BETWEEN ? AND ?
    AND EXISTS (
        SELECT 1 FROM smap_group_detail_t sgd
        WHERE sgd.sgt_idx = sst.sgt_idx AND sgd.mt_idx = ?
            AND sgd.sgdt_discharge = 'N' AND sgd.sgdt_exit = 'N' AND sgd.sgdt_show = 'Y'
    )
ORDER BY sst.sst_sdate ASC
LIMIT 20`

// SchedulesExistsForUser는 find-phone의 스케줄 목록(7일창, EXISTS).
func (r *AuthSocialRepository) SchedulesExistsForUser(mtIdx int, start, end string) ([]model.SocialSchedulePhoneRow, error) {
	out := make([]model.SocialSchedulePhoneRow, 0)
	err := r.db.Raw(schedulesExistsSQL, start, end, mtIdx).Scan(&out).Error
	return out, err
}

// MemberLatLongStr는 find-phone user_data의 mt_lat/mt_long을 raw DECIMAL 문자열로 읽는다
// (Member 모델은 float64라 정밀도/문자열 표기를 잃음 → Pydantic Decimal→문자열 직렬화를 맞추기 위함).
func (r *AuthSocialRepository) MemberLatLongStr(mtIdx int) (*string, *string, error) {
	var row struct {
		Lat  *string `gorm:"column:mt_lat"`
		Long *string `gorm:"column:mt_long"`
	}
	err := r.db.Raw("SELECT mt_lat, mt_long FROM member_t WHERE mt_idx = ?", mtIdx).Scan(&row).Error
	return row.Lat, row.Long, err
}
