package repository

import (
	"time"

	"gorm.io/gorm"
)

type AdminRepository struct {
	db *gorm.DB
}

func NewAdmin(db *gorm.DB) *AdminRepository {
	return &AdminRepository{db: db}
}

// AdminStats는 /admin/stats의 3개 집계값.
type AdminStats struct {
	TotalMembers int64
	TotalGroups  int64
	TodaySignups int64
}

// Stats는 활성 회원 수(mt_level>=2), 전체 그룹 수, 오늘 가입자 수를 조회한다.
// Python admin_stats.get_admin_stats의 3개 쿼리와 동등하다.
// today_signups의 기준일은 Python `date.today()`(서버 로컬)과 일치하도록 CURDATE()를 쓴다.
func (r *AdminRepository) Stats() (AdminStats, error) {
	var s AdminStats
	if err := r.db.Raw(
		"SELECT COUNT(mt_idx) FROM member_t WHERE mt_level >= 2",
	).Scan(&s.TotalMembers).Error; err != nil {
		return s, err
	}
	if err := r.db.Raw(
		"SELECT COUNT(sgt_idx) FROM smap_group_t",
	).Scan(&s.TotalGroups).Error; err != nil {
		return s, err
	}
	if err := r.db.Raw(
		"SELECT COUNT(mt_idx) FROM member_t WHERE mt_level >= 2 AND DATE(mt_wdate) = CURDATE()",
	).Scan(&s.TodaySignups).Error; err != nil {
		return s, err
	}
	return s, nil
}

// AdminGroupRow는 /admin/groups 메인 쿼리의 한 행. nullable 컬럼은 포인터로 둔다.
type AdminGroupRow struct {
	SgtIdx        int        `gorm:"column:sgt_idx"`
	SgtTitle      *string    `gorm:"column:sgt_title"`
	SgtMemo       *string    `gorm:"column:sgt_memo"`
	SgtCode       *string    `gorm:"column:sgt_code"`
	SgtShow       *string    `gorm:"column:sgt_show"`
	MtIdx         *int       `gorm:"column:mt_idx"`
	MtName        *string    `gorm:"column:mt_name"`
	MtNickname    *string    `gorm:"column:mt_nickname"`
	MemberCount   int64      `gorm:"column:member_count"`
	ScheduleCount int64      `gorm:"column:schedule_count"`
	LocationCount int64      `gorm:"column:location_count"`
	SgtWdate      *time.Time `gorm:"column:sgt_wdate"`
	SgtUdate      *time.Time `gorm:"column:sgt_udate"`
}

// adminGroupsBaseSQL은 Python admin_stats.get_admin_groups의 서브쿼리 집계 4종을
// 그대로 이식한 SQL이다. 활성 멤버(sgdt_exit='N', sgdt_show='Y') 기준의 멤버/일정/장소
// 수를 COALESCE(...,0)으로 합성한다. Python 쿼리에 ORDER BY가 없으므로 여기서도 두지 않는다.
const adminGroupsBaseSQL = `
SELECT
  g.sgt_idx                      AS sgt_idx,
  g.sgt_title                    AS sgt_title,
  g.sgt_memo                     AS sgt_memo,
  g.sgt_code                     AS sgt_code,
  g.sgt_show                     AS sgt_show,
  g.mt_idx                       AS mt_idx,
  m.mt_name                      AS mt_name,
  m.mt_nickname                  AS mt_nickname,
  COALESCE(mc.member_count, 0)   AS member_count,
  COALESCE(sc.schedule_count, 0) AS schedule_count,
  COALESCE(lc.location_count, 0) AS location_count,
  g.sgt_wdate                    AS sgt_wdate,
  g.sgt_udate                    AS sgt_udate
FROM smap_group_t g
LEFT JOIN member_t m ON m.mt_idx = g.mt_idx
LEFT JOIN (
  SELECT sgt_idx, COUNT(sgdt_idx) AS member_count
  FROM smap_group_detail_t
  WHERE sgdt_exit = 'N' AND sgdt_show = 'Y'
  GROUP BY sgt_idx
) mc ON mc.sgt_idx = g.sgt_idx
LEFT JOIN (
  SELECT am.sgt_idx AS sgt_idx, COUNT(s.sst_idx) AS schedule_count
  FROM (SELECT sgt_idx, mt_idx FROM smap_group_detail_t WHERE sgdt_exit = 'N' AND sgdt_show = 'Y') am
  JOIN smap_schedule_t s ON s.mt_idx = am.mt_idx
  WHERE s.sst_show = 'Y'
  GROUP BY am.sgt_idx
) sc ON sc.sgt_idx = g.sgt_idx
LEFT JOIN (
  SELECT am.sgt_idx AS sgt_idx, COUNT(l.slt_idx) AS location_count
  FROM (SELECT sgt_idx, mt_idx FROM smap_group_detail_t WHERE sgdt_exit = 'N' AND sgdt_show = 'Y') am
  JOIN smap_location_t l ON l.mt_idx = am.mt_idx
  WHERE l.slt_show = 'Y'
  GROUP BY am.sgt_idx
) lc ON lc.sgt_idx = g.sgt_idx`

// Groups는 관리자용 그룹 목록을 offset/limit 페이지네이션으로 조회한다.
// showHidden=false면 sgt_show='Y'만(Python `if not show_hidden` 분기와 동등).
func (r *AdminRepository) Groups(offset, limit int, showHidden bool) ([]AdminGroupRow, error) {
	sql := adminGroupsBaseSQL
	// showHidden은 bool이라 SQL 텍스트 인젝션 위험이 없다. 페이지네이션은 파라미터 바인딩.
	if !showHidden {
		sql += "\nWHERE g.sgt_show = 'Y'"
	}
	sql += "\nLIMIT ? OFFSET ?"

	rows := make([]AdminGroupRow, 0)
	if err := r.db.Raw(sql, limit, offset).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}
