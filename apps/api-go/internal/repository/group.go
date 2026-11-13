package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type GroupRepository struct {
	db *gorm.DB
}

func NewGroup(db *gorm.DB) *GroupRepository {
	return &GroupRepository{db: db}
}

// GetByID는 sgt_idx로 단건 조회. sgt_show 필터 없음 — Python get_group(숨김 그룹도 반환)과 동등.
// 없으면 (nil, nil)로 404 신호.
func (r *GroupRepository) GetByID(id int) (*model.Group, error) {
	var g model.Group
	err := r.db.Where("sgt_idx = ?", id).First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// List는 그룹 목록. showHidden=false면 sgt_show='Y'만(Python get_groups와 동등).
// 정렬 없음 — Python도 ORDER BY 없이 DB 기본 순서를 그대로 쓴다.
func (r *GroupRepository) List(skip, limit int, showHidden bool) ([]model.Group, error) {
	q := r.db.Model(&model.Group{})
	if !showHidden {
		q = q.Where("sgt_show = ?", "Y")
	}
	out := make([]model.Group, 0)
	err := q.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// ListHidden은 숨김 그룹(sgt_show='N') 전체를 조회한다(Python get_hidden_groups와 동등). 정렬 없음.
func (r *GroupRepository) ListHidden() ([]model.Group, error) {
	out := make([]model.Group, 0)
	err := r.db.Where("sgt_show = ?", "N").Find(&out).Error
	return out, err
}

// FindByMember는 GroupDetail INNER JOIN으로 사용자가 속한(미탈퇴) 표시 그룹을 조회한다.
// Python Group.find_by_member와 동등: GroupDetail.sgdt_exit='N' AND Group.sgt_show='Y'.
// DISTINCT 없음 — 같은 그룹에 멤버십 행이 둘이면 Python처럼 중복 행을 그대로 반환한다.
// SELECT 절을 smap_group_t.*로 한정해 양 테이블 공통 컬럼(sgt_idx/mt_idx) 모호성을 피한다.
func (r *GroupRepository) FindByMember(mtIdx int) ([]model.Group, error) {
	out := make([]model.Group, 0)
	err := r.db.Model(&model.Group{}).
		Select("smap_group_t.*").
		Joins("JOIN smap_group_detail_t ON smap_group_detail_t.sgt_idx = smap_group_t.sgt_idx").
		Where("smap_group_detail_t.mt_idx = ? AND smap_group_detail_t.sgdt_exit = ? AND smap_group_t.sgt_show = ?",
			mtIdx, "N", "Y").
		Find(&out).Error
	return out, err
}

// FindByCode는 sgt_code + sgt_show='Y'로 단건 조회. Python Group.find_by_code와 동등.
// 없으면 (nil, nil).
func (r *GroupRepository) FindByCode(code string) (*model.Group, error) {
	var g model.Group
	err := r.db.Where("sgt_code = ? AND sgt_show = ?", code, "Y").First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// CurrentUserGroupCount는 Python get_current_user_group_summary의 group_count와 동등하다.
// 사용자가 속한(sgdt_show='Y' AND sgdt_exit='N') sgt_idx 서브쿼리를 만들고,
// 그 안에서 sgt_show='Y'인 smap_group_t 행 수를 센다.
func (r *GroupRepository) CurrentUserGroupCount(mtIdx int) (int64, error) {
	sub := r.db.Model(&model.GroupDetail{}).
		Select("sgt_idx").
		Where("mt_idx = ? AND sgdt_show = ? AND sgdt_exit = ?", mtIdx, "Y", "N")
	var count int64
	err := r.db.Model(&model.Group{}).
		Where("sgt_idx IN (?) AND sgt_show = ?", sub, "Y").
		Count(&count).Error
	return count, err
}

// CurrentUserDistinctMemberCount는 summary의 distinct_member_count와 동등하다.
// 동일 서브쿼리(사용자가 속한 그룹) 내에서 sgdt_show='Y' AND sgdt_exit='N'인
// DISTINCT mt_idx 수를 센다.
func (r *GroupRepository) CurrentUserDistinctMemberCount(mtIdx int) (int64, error) {
	sub := r.db.Model(&model.GroupDetail{}).
		Select("sgt_idx").
		Where("mt_idx = ? AND sgdt_show = ? AND sgdt_exit = ?", mtIdx, "Y", "N")
	var count int64
	err := r.db.Model(&model.GroupDetail{}).
		Where("sgt_idx IN (?) AND sgdt_show = ? AND sgdt_exit = ?", sub, "Y", "N").
		Distinct("mt_idx").
		Count(&count).Error
	return count, err
}

// CurrentUserGroupRow는 get_current_user_groups가 반환하는 한 (group, group_detail) 쌍이다.
// 멤버수는 별도 GROUP BY 쿼리(memberCounts)로 채워 N+1을 피한다.
type CurrentUserGroupRow struct {
	Group       model.Group
	Detail      model.GroupDetail
	MemberCount int64
}

// currentUserGroupPair는 한 SELECT로 group + group_detail 컬럼을 동시에 스캔하기 위한 평면 행이다.
// Python의 db.query(Group, GroupDetail)에 대응한다. owner/leader/join_date는 GroupDetail 쪽 값이다.
type currentUserGroupPair struct {
	model.Group
	SgdtOwnerChk  *string    `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string    `gorm:"column:sgdt_leader_chk"`
	SgdtWdate     *time.Time `gorm:"column:gd_sgdt_wdate"`
}

// CurrentUserGroups는 사용자가 속한 (group, group_detail) 쌍을 조회한다(정렬 없음 → 서비스에서 sgt_title 정렬).
// Python: db.query(Group, GroupDetail).join(...).filter(GroupDetail.mt_idx=user_id,
// sgdt_exit='N', Group.sgt_show='Y').all() — ⚠️sgdt_show 필터 없음(member_counts 쿼리에만 있음).
// member_counts는 group_ids 대상으로 GroupDetail JOIN Member ON mt_idx, sgdt_exit='N' AND
// sgdt_show='Y' AND sgdt_discharge='N' AND Member.mt_status=1, GROUP BY sgt_idx → COUNT(sgdt_idx).
func (r *GroupRepository) CurrentUserGroups(mtIdx int) ([]CurrentUserGroupRow, error) {
	pairs := make([]currentUserGroupPair, 0)
	err := r.db.Model(&model.Group{}).
		Select("smap_group_t.*, smap_group_detail_t.sgdt_owner_chk AS sgdt_owner_chk, "+
			"smap_group_detail_t.sgdt_leader_chk AS sgdt_leader_chk, "+
			"smap_group_detail_t.sgdt_wdate AS gd_sgdt_wdate").
		Joins("JOIN smap_group_detail_t ON smap_group_detail_t.sgt_idx = smap_group_t.sgt_idx").
		Where("smap_group_detail_t.mt_idx = ? AND smap_group_detail_t.sgdt_exit = ? AND smap_group_t.sgt_show = ?",
			mtIdx, "N", "Y").
		Scan(&pairs).Error
	if err != nil {
		return nil, err
	}

	// group_ids 수집 후 member_counts를 한 번의 GROUP BY로 일괄 조회(N+1 방지). Python과 동일 필터.
	groupIDs := make([]int, 0, len(pairs))
	for i := range pairs {
		groupIDs = append(groupIDs, pairs[i].SgtIdx)
	}
	memberCounts := map[int]int64{}
	if len(groupIDs) > 0 {
		type countRow struct {
			SgtIdx int   `gorm:"column:sgt_idx"`
			Cnt    int64 `gorm:"column:cnt"`
		}
		rows := make([]countRow, 0)
		err = r.db.Model(&model.GroupDetail{}).
			Select("smap_group_detail_t.sgt_idx AS sgt_idx, COUNT(smap_group_detail_t.sgdt_idx) AS cnt").
			Joins("JOIN member_t ON member_t.mt_idx = smap_group_detail_t.mt_idx").
			Where("smap_group_detail_t.sgt_idx IN ? AND smap_group_detail_t.sgdt_exit = ? AND "+
				"smap_group_detail_t.sgdt_show = ? AND smap_group_detail_t.sgdt_discharge = ? AND member_t.mt_status = ?",
				groupIDs, "N", "Y", "N", 1).
			Group("smap_group_detail_t.sgt_idx").
			Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for i := range rows {
			memberCounts[rows[i].SgtIdx] = rows[i].Cnt
		}
	}

	out := make([]CurrentUserGroupRow, 0, len(pairs))
	for i := range pairs {
		out = append(out, CurrentUserGroupRow{
			Group: pairs[i].Group,
			Detail: model.GroupDetail{
				SgdtOwnerChk:  pairs[i].SgdtOwnerChk,
				SgdtLeaderChk: pairs[i].SgdtLeaderChk,
				SgdtWdate:     pairs[i].SgdtWdate,
			},
			MemberCount: memberCounts[pairs[i].SgtIdx],
		})
	}
	return out, nil
}

// StatsGroupMembers는 stats의 group_members 전체 행과 동등하다.
// GroupDetail WHERE sgt_idx=group_id AND sgdt_exit='N' AND sgdt_show='Y' (정렬 없음, all() 순서).
// 서비스가 mt_idx 목록 추출과 owner/leader chk 집계(any(... for gm in group_members))에 모두 쓴다.
// mt_idx/owner_chk/leader_chk만 필요하므로 컬럼을 한정해 조회한다.
func (r *GroupRepository) StatsGroupMembers(groupID int) ([]model.GroupDetail, error) {
	rows := make([]model.GroupDetail, 0)
	err := r.db.Model(&model.GroupDetail{}).
		Select("mt_idx", "sgdt_owner_chk", "sgdt_leader_chk").
		Where("sgt_idx = ? AND sgdt_exit = ? AND sgdt_show = ?", groupID, "N", "Y").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// StatsMember는 멤버 단건(Member WHERE mt_idx=member_id). 없으면 (nil, nil) → Python continue.
func (r *GroupRepository) StatsMember(memberID int) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_idx = ?", memberID).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// StatsWeeklySchedules는 멤버의 주간 일정 수와 동등하다.
// COUNT(Schedule.sst_idx) WHERE mt_idx=member AND sst_show='Y' AND start<=sst_sdate<=end.
func (r *GroupRepository) StatsWeeklySchedules(memberID int, start, end time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&model.Schedule{}).
		Where("mt_idx = ? AND sst_show = ? AND sst_sdate >= ? AND sst_sdate <= ?", memberID, "Y", start, end).
		Count(&count).Error
	return count, err
}

// StatsTotalLocations는 멤버의 전체 위치(장소) 수와 동등하다(total_locations).
// COUNT(Location.slt_idx) WHERE mt_idx=member AND slt_show='Y' — ⚠️기간 필터 없음.
func (r *GroupRepository) StatsTotalLocations(memberID int) (int64, error) {
	var count int64
	err := r.db.Model(&model.Location{}).
		Where("mt_idx = ? AND slt_show = ?", memberID, "Y").
		Count(&count).Error
	return count, err
}

// StatsWeeklyLocations는 멤버의 주간 위치(장소) 수와 동등하다(weekly_locations).
// COUNT(Location.slt_idx) WHERE mt_idx=member AND slt_show='Y' AND start<=slt_wdate<=end.
func (r *GroupRepository) StatsWeeklyLocations(memberID int, start, end time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&model.Location{}).
		Where("mt_idx = ? AND slt_show = ? AND slt_wdate >= ? AND slt_wdate <= ?", memberID, "Y", start, end).
		Count(&count).Error
	return count, err
}

// --- write 메서드 (groups write 이식 Phase 1: create/join 3종) ---

// MemberExists는 Python join 핸들러의 db.query(Member).filter(Member.mt_idx==id).first() 존재확인과 동등하다.
// (mt_status 등 추가 필터 없음 — PK 존재 여부만 확인한다.)
func (r *GroupRepository) MemberExists(mtIdx int) (bool, error) {
	var count int64
	err := r.db.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).Count(&count).Error
	return count > 0, err
}

// CodeExists는 generate_sgt_code의 중복 확인(db.query(Group).filter(sgt_code==uid).first())과 동등하다.
// ⚠️ find_by_code(sgt_show='Y')와 달리 sgt_show 필터가 없다 — 숨김 그룹의 코드와도 충돌을 피한다.
func (r *GroupRepository) CodeExists(code string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Group{}).Where("sgt_code = ?", code).Count(&count).Error
	return count > 0, err
}

// CreateGroup은 smap_group_t에 INSERT하고 자동 증가된 sgt_idx를 g에 채운다
// (Python db.add(group)+commit+refresh). 실패 시 에러를 그대로 반환(핸들러가 미처리 500/plain).
func (r *GroupRepository) CreateGroup(g *model.Group) error {
	return r.db.Create(g).Error
}

// FindActiveMembership은 join 핸들러의 existing_membership 조회와 동등하다:
// GroupDetail WHERE sgt_idx=? AND mt_idx=? AND sgdt_exit='N' first(). 없으면 (nil, nil).
func (r *GroupRepository) FindActiveMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	var gd model.GroupDetail
	err := r.db.Where("sgt_idx = ? AND mt_idx = ? AND sgdt_exit = ?", sgtIdx, mtIdx, "N").First(&gd).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &gd, nil
}

// CreateGroupDetail은 smap_group_detail_t에 INSERT하고 자동 증가된 sgdt_idx를 gd에 채운다.
func (r *GroupRepository) CreateGroupDetail(gd *model.GroupDetail) error {
	return r.db.Create(gd).Error
}

// ReactivateMembership은 재가입 처리(sgdt_show='Y', sgdt_exit='N', sgdt_udate=now)와 동등하다.
// owner/leader/wdate는 보존(응답 data에 기존값 사용). map Update로 지정 컬럼만 갱신한다.
func (r *GroupRepository) ReactivateMembership(gd *model.GroupDetail, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgdt_idx = ?", gd.SgdtIdx).
		Updates(map[string]interface{}{"sgdt_show": "Y", "sgdt_exit": "N", "sgdt_udate": now}).Error
}

// --- write 메서드 (groups write 이식 Phase 2: update/restore/emergency/join-new/remove) ---

// SaveGroup은 그룹 행 전체를 갱신한다(Python update_group/restore_group의 commit+refresh).
// GORM Save는 모델이 매핑한 컬럼만 기록하므로(sgt_content 등 미매핑 컬럼 불변) Python의
// "변경 속성만 commit"과 DB 종단 상태가 동일하다(응답은 in-memory g로 빌드).
func (r *GroupRepository) SaveGroup(g *model.Group) error {
	return r.db.Save(g).Error
}

// FindMembershipAny는 join_new_member의 existing_membership 조회와 동등하다:
// GroupDetail WHERE sgt_idx=? AND mt_idx=? first(). ⚠️ join_group(FindActiveMembership)과 달리
// sgdt_exit 필터가 없다. 없으면 (nil, nil).
func (r *GroupRepository) FindMembershipAny(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	var gd model.GroupDetail
	err := r.db.Where("sgt_idx = ? AND mt_idx = ?", sgtIdx, mtIdx).First(&gd).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &gd, nil
}

// ReactivateMembershipNewMember는 join_new_member 재가입과 동등하다:
// sgdt_show='Y', sgdt_exit='N', sgdt_discharge='N', sgdt_udate=now.
// ⚠️ join_group 재가입(ReactivateMembership)과 달리 sgdt_discharge도 'N'으로 리셋한다.
func (r *GroupRepository) ReactivateMembershipNewMember(gd *model.GroupDetail, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgdt_idx = ?", gd.SgdtIdx).
		Updates(map[string]interface{}{"sgdt_show": "Y", "sgdt_exit": "N", "sgdt_discharge": "N", "sgdt_udate": now}).Error
}

// FindVisibleMembership은 remove_member의 group_detail 조회와 동등하다:
// GroupDetail WHERE sgt_idx=? AND mt_idx=member_id AND sgdt_show='Y' first(). 없으면 (nil, nil).
func (r *GroupRepository) FindVisibleMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	var gd model.GroupDetail
	err := r.db.Where("sgt_idx = ? AND mt_idx = ? AND sgdt_show = ?", sgtIdx, mtIdx, "Y").First(&gd).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &gd, nil
}

// RemoveMembership은 remove_member의 소프트 탈퇴와 동등하다(sgdt_show='N', sgdt_exit='Y', sgdt_udate=now).
// ⚠️ remove_data(body)의 sgdt_show/sgdt_exit는 Python에서 로깅만 되고 실제로는 무시되어 항상 'N'/'Y'로 고정.
func (r *GroupRepository) RemoveMembership(gd *model.GroupDetail, now time.Time) error {
	return r.db.Model(&model.GroupDetail{}).
		Where("sgdt_idx = ?", gd.SgdtIdx).
		Updates(map[string]interface{}{"sgdt_show": "N", "sgdt_exit": "Y", "sgdt_udate": now}).Error
}
