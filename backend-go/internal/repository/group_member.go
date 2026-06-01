package repository

import (
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type GroupMemberRepository struct {
	db *gorm.DB
}

func NewGroupMember(db *gorm.DB) *GroupMemberRepository {
	return &GroupMemberRepository{db: db}
}

// 스캔용 내부 구조체.
type gmBasic struct {
	SgdtIdx       int        `gorm:"column:sgdt_idx"`
	SgtIdx        *int       `gorm:"column:sgt_idx"`
	MtIdx         int        `gorm:"column:mt_idx"`
	SgdtOwnerChk  *string    `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string    `gorm:"column:sgdt_leader_chk"`
	MtName        *string    `gorm:"column:mt_name"`
	MtNickname    *string    `gorm:"column:mt_nickname"`
	MtBirth       *time.Time `gorm:"column:mt_birth"`
	MtFile1       *string    `gorm:"column:mt_file1"`
	MtGender      *int       `gorm:"column:mt_gender"`
	MtStatus      *int       `gorm:"column:mt_status"`
	MtWeatherPop  *string    `gorm:"column:mt_weather_pop"`
	MtWeatherTmn  *int       `gorm:"column:mt_weather_tmn"`
	MtWeatherTmx  *int       `gorm:"column:mt_weather_tmx"`
	MtWeatherSky  *int       `gorm:"column:mt_weather_sky"`
	MtWeatherDate *time.Time `gorm:"column:mt_weather_date"`
}

type gmLoc struct {
	MtIdx      int        `gorm:"column:mt_idx"`
	MltLat     *float64   `gorm:"column:mlt_lat"`
	MltLong    *float64   `gorm:"column:mlt_long"`
	MltSpeed   *float64   `gorm:"column:mlt_speed"`
	MltBattery *int       `gorm:"column:mlt_battery"`
	MltGpsTime *time.Time `gorm:"column:mlt_gps_time"`
}

type gmFallback struct {
	MtIdx  int      `gorm:"column:mt_idx"`
	MtLat  *float64 `gorm:"column:mt_lat"`
	MtLong *float64 `gorm:"column:mt_long"`
}

func intsCSV(ids []int) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = strconv.Itoa(id)
	}
	return strings.Join(parts, ", ")
}

// GetGroupMembersWithRoles는 Python GroupDetail.get_group_members_with_roles(group_detail.py:50)의
// 단일 raw SQL을 그대로 이식한다(member_t JOIN, sgt_idx + show/discharge/exit 필터).
// ⚠️ Python과 동일하게 mt_status 필터는 없다(FindGroupMembers와의 차이점). 토큰/언어/이름 메타를
// 함께 조회해 schedule:30min 그룹 fan-out 대상 산정에 쓴다. 역할 분류(owner/leader/members)는
// 호출자가 sgdt_owner_chk/sgdt_leader_chk로 수행한다(Python dict 분기 동등).
func (r *GroupMemberRepository) GetGroupMembersWithRoles(sgtIdx int) ([]model.GroupRoleMember, error) {
	out := make([]model.GroupRoleMember, 0)
	err := r.db.Raw(`
		SELECT gdt.sgdt_idx, gdt.mt_idx, gdt.sgdt_owner_chk, gdt.sgdt_leader_chk,
		       mt.mt_lang, mt.mt_token_id, mt.mt_nickname, mt.mt_name
		FROM smap_group_detail_t gdt
		JOIN member_t mt ON gdt.mt_idx = mt.mt_idx
		WHERE gdt.sgt_idx = ?
		  AND gdt.sgdt_discharge = 'N'
		  AND gdt.sgdt_exit = 'N'
		  AND gdt.sgdt_show = 'Y'`, sgtIdx).Scan(&out).Error
	return out, err
}

// FindGroupMembers는 Python get_group_members의 3단계 쿼리를 그대로 이식한다:
// ①기본정보(JOIN, owner/leader/name 정렬) ②최신위치(self-join + MAX(mlt_gps_time))
// ③위치 없는 멤버는 member_t.mt_lat/long fallback. IN 절은 정수만 결합(인젝션 안전).
func (r *GroupMemberRepository) FindGroupMembers(groupID int) ([]model.GroupMemberRow, error) {
	var basics []gmBasic
	err := r.db.Raw(`
		SELECT sgd.sgdt_idx, sgd.sgt_idx, sgd.mt_idx, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk,
		       m.mt_name, m.mt_nickname, m.mt_birth, m.mt_file1, m.mt_gender, m.mt_status,
		       m.mt_weather_pop, m.mt_weather_tmn, m.mt_weather_tmx, m.mt_weather_sky, m.mt_weather_date
		FROM smap_group_detail_t sgd
		JOIN member_t m ON sgd.mt_idx = m.mt_idx
		WHERE sgd.sgt_idx = ? AND sgd.sgdt_show = 'Y' AND sgd.sgdt_discharge = 'N'
		      AND sgd.sgdt_exit = 'N' AND m.mt_status = 1
		ORDER BY CASE sgd.sgdt_owner_chk WHEN 'Y' THEN 1 ELSE 2 END,
		         CASE sgd.sgdt_leader_chk WHEN 'Y' THEN 1 ELSE 2 END,
		         m.mt_name`, groupID).Scan(&basics).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.GroupMemberRow, 0, len(basics))
	if len(basics) == 0 {
		return out, nil
	}

	ids := make([]int, len(basics))
	for i, b := range basics {
		ids[i] = b.MtIdx
	}

	// 2단계: 최신 위치 로그
	locMap := make(map[int]gmLoc)
	var locs []gmLoc
	if err := r.db.Raw(`
		SELECT DISTINCT mll1.mt_idx, mll1.mlt_lat, mll1.mlt_long, mll1.mlt_speed,
		       mll1.mlt_battery, mll1.mlt_gps_time
		FROM member_location_log_t mll1
		INNER JOIN (
			SELECT mt_idx, MAX(mlt_gps_time) as max_time
			FROM member_location_log_t
			WHERE mt_idx IN (` + intsCSV(ids) + `) AND mlt_gps_time IS NOT NULL
			GROUP BY mt_idx
		) mll2 ON mll1.mt_idx = mll2.mt_idx AND mll1.mlt_gps_time = mll2.max_time`).
		Scan(&locs).Error; err != nil {
		return nil, err
	}
	for _, l := range locs {
		locMap[l.MtIdx] = l // 동일 timestamp 중복 시 마지막 행(Python dict 갱신과 동일)
	}

	// 3단계: 위치 로그 없는 멤버는 member_t fallback
	missing := make([]int, 0)
	for _, id := range ids {
		if _, ok := locMap[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		var fbs []gmFallback
		if err := r.db.Raw(`
			SELECT mt_idx, mt_lat, mt_long FROM member_t
			WHERE mt_idx IN (` + intsCSV(missing) + `) AND mt_lat IS NOT NULL AND mt_long IS NOT NULL`).
			Scan(&fbs).Error; err != nil {
			return nil, err
		}
		for _, fb := range fbs {
			locMap[fb.MtIdx] = gmLoc{MtIdx: fb.MtIdx, MltLat: fb.MtLat, MltLong: fb.MtLong}
		}
	}

	// 4단계: 조합
	for _, b := range basics {
		loc := locMap[b.MtIdx] // 없으면 zero value(전부 nil)
		out = append(out, model.GroupMemberRow{
			SgdtIdx: b.SgdtIdx, SgtIdx: b.SgtIdx, MtIdx: b.MtIdx,
			SgdtOwnerChk: b.SgdtOwnerChk, SgdtLeaderChk: b.SgdtLeaderChk,
			MtName: b.MtName, MtNickname: b.MtNickname, MtBirth: b.MtBirth,
			MtFile1: b.MtFile1, MtGender: b.MtGender, MtStatus: b.MtStatus,
			MtWeatherPop: b.MtWeatherPop, MtWeatherTmn: b.MtWeatherTmn,
			MtWeatherTmx: b.MtWeatherTmx, MtWeatherSky: b.MtWeatherSky, MtWeatherDate: b.MtWeatherDate,
			MltLat: loc.MltLat, MltLong: loc.MltLong, MltSpeed: loc.MltSpeed,
			MltBattery: loc.MltBattery, MltGpsTime: loc.MltGpsTime,
		})
	}
	return out, nil
}
