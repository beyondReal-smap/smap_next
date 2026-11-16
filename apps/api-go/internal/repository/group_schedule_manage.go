package repository

import (
	"database/sql"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// sqlExecer는 *sql.DB(pool)과 *sql.Tx(트랜잭션)가 모두 만족하는 실행 인터페이스.
// PUT Path4는 단일 트랜잭션이 필요하므로 쓰기 메서드를 pool/tx 양쪽에서 재사용한다.
type SQLExecer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

// sqlExecer는 SQLExecer의 이전 이름이다(저장소 내부 시그니처 호환).
type sqlExecer = SQLExecer

// GroupScheduleManageRepository는 Python group_schedule_manage.py의 raw SQL을 이식한다.
type GroupScheduleManageRepository struct {
	db *gorm.DB
}

func NewGroupScheduleManage(db *gorm.DB) *GroupScheduleManageRepository {
	return &GroupScheduleManageRepository{db: db}
}

// === 결과 struct ===

// GSMMemberRow는 get_group_members 결과(mt_file1은 COALESCE ”).
type GSMMemberRow struct {
	MtIdx         int     `gorm:"column:mt_idx"`
	MtName        *string `gorm:"column:mt_name"`
	MtFile1       string  `gorm:"column:mt_file1"`
	SgtIdx        *int    `gorm:"column:sgt_idx"`
	SgdtIdx       int     `gorm:"column:sgdt_idx"`
	SgdtOwnerChk  *string `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string `gorm:"column:sgdt_leader_chk"`
}

// GSMUserLocRow는 사용자 최근 위치.
type GSMUserLocRow struct {
	MltLat  *float64 `gorm:"column:mlt_lat"`
	MltLong *float64 `gorm:"column:mlt_long"`
}

// GSMOwnerGroupRow는 owner_groups 쿼리 결과.
type GSMOwnerGroupRow struct {
	SgtIdx        int     `gorm:"column:sgt_idx"`
	SgtTitle      *string `gorm:"column:sgt_title"`
	SgdtIdx       int     `gorm:"column:sgdt_idx"`
	SgdtOwnerChk  *string `gorm:"column:sgdt_owner_chk"`
	SgdtLeaderChk *string `gorm:"column:sgdt_leader_chk"`
	MtIdx         *int    `gorm:"column:mt_idx"`
}

// GSMGroupScheduleRow는 group-schedules 결과(sst.* + member 메타).
type GSMGroupScheduleRow struct {
	model.Schedule
	MemberName  *string `gorm:"column:member_name"`
	MemberPhoto *string `gorm:"column:member_photo"`
}

// GSMOwnerScheduleRow는 owner-schedules 결과(sst.* + 거리/타겟/그룹 메타).
type GSMOwnerScheduleRow struct {
	model.Schedule
	SchCalcDist      *float64 `gorm:"column:sch_calc_dist"`
	MemberName       *string  `gorm:"column:member_name"`
	MemberPhoto      *string  `gorm:"column:member_photo"`
	GroupTitle       *string  `gorm:"column:group_title"`
	TgtMtIdx         *int     `gorm:"column:tgt_mt_idx"`
	TgtSgdtOwnerChk  *string  `gorm:"column:tgt_sgdt_owner_chk"`
	TgtSgdtLeaderChk *string  `gorm:"column:tgt_sgdt_leader_chk"`
	TgtSgdtIdx       *int     `gorm:"column:tgt_sgdt_idx"`
}

// GSMRelatedRow는 debug related_schedules 결과(5필드).
type GSMRelatedRow struct {
	SstIdx        int        `gorm:"column:sst_idx"`
	SstPidx       *int       `gorm:"column:sst_pidx"`
	SstTitle      *string    `gorm:"column:sst_title"`
	SstSdate      *time.Time `gorm:"column:sst_sdate"`
	SstRepeatJSON *string    `gorm:"column:sst_repeat_json"`
}

// === 쿼리 메서드 ===

// GetGroupMembers는 Python get_group_members를 이식한다(except→빈 슬라이스).
func (r *GroupScheduleManageRepository) GetGroupMembers(groupID int) []GSMMemberRow {
	var rows []GSMMemberRow
	err := r.db.Raw(`
		SELECT mt.mt_idx, mt.mt_name, COALESCE(mt.mt_file1, '') as mt_file1,
		       sgdt.sgt_idx, sgdt.sgdt_idx, sgdt.sgdt_owner_chk, sgdt.sgdt_leader_chk
		FROM smap_group_detail_t sgdt
		JOIN member_t mt ON sgdt.mt_idx = mt.mt_idx
		WHERE sgdt.sgt_idx = ? AND sgdt.sgdt_discharge = 'N'
		  AND sgdt.sgdt_exit = 'N' AND sgdt.sgdt_show = 'Y'
		ORDER BY CASE sgdt.sgdt_owner_chk WHEN 'Y' THEN 1 ELSE 2 END,
		         CASE sgdt.sgdt_leader_chk WHEN 'Y' THEN 1 ELSE 2 END,
		         mt.mt_name`, groupID).Scan(&rows).Error
	if err != nil {
		return []GSMMemberRow{}
	}
	return rows
}

// TestSchedule은 test-all-columns의 단일 스케줄 조회(없으면 nil,nil).
func (r *GroupScheduleManageRepository) TestSchedule(userID int) (*model.Schedule, error) {
	var rows []model.Schedule
	err := r.db.Raw(`SELECT sst.* FROM smap_schedule_t sst
		WHERE sst.mt_idx = ? AND sst.sst_show = 'Y' LIMIT 1`, userID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// UserLocation은 사용자 최근 위치(없으면 nil).
func (r *GroupScheduleManageRepository) UserLocation(userID int) *GSMUserLocRow {
	var rows []GSMUserLocRow
	err := r.db.Raw(`SELECT mlt_lat, mlt_long FROM member_location_log_t
		WHERE mt_idx = ? ORDER BY mlt_idx DESC LIMIT 1`, userID).Scan(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil
	}
	return &rows[0]
}

// OwnerGroups는 요청자가 현재 멤버로 속한 그룹 목록(sgt_show='Y' + 공통 멤버십 조건 — 나간·강퇴·숨김 행 제외, S-4).
func (r *GroupScheduleManageRepository) OwnerGroups(userID int) ([]GSMOwnerGroupRow, error) {
	var rows []GSMOwnerGroupRow
	err := r.db.Raw(`
		SELECT sg.sgt_idx, sg.sgt_title, sgd.sgdt_idx, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk, sgd.mt_idx
		FROM smap_group_t sg
		JOIN smap_group_detail_t sgd ON sg.sgt_idx = sgd.sgt_idx
		JOIN member_t m ON m.mt_idx = sgd.mt_idx
		WHERE sgd.mt_idx = ? AND sg.sgt_show = 'Y' AND `+currentMemberSQL("sgd", "m"), userID).Scan(&rows).Error
	return rows, err
}

// OwnerSchedules는 owner 그룹들의 월별 스케줄 + Haversine 거리(user 위치 있을 때만).
func (r *GroupScheduleManageRepository) OwnerSchedules(groupIDs []int, userLat, userLng *float64, startDate, endDate string) ([]GSMOwnerScheduleRow, error) {
	var distanceCalc string
	args := make([]interface{}, 0, 5)
	if userLat != nil && userLng != nil {
		distanceCalc = `CASE
			WHEN sst.sst_location_lat IS NOT NULL AND sst.sst_location_long IS NOT NULL THEN
				6371 * acos(
					cos(radians(?)) * cos(radians(sst.sst_location_lat)) *
					cos(radians(sst.sst_location_long) - radians(?)) +
					sin(radians(?)) * sin(radians(sst.sst_location_lat))
				)
			ELSE NULL
		END AS sch_calc_dist,`
		args = append(args, *userLat, *userLng, *userLat)
	} else {
		distanceCalc = "NULL AS sch_calc_dist,"
	}
	query := fmt.Sprintf(`
		SELECT sst.*, %s
			m.mt_name as member_name, m.mt_file1 as member_photo, sg.sgt_title as group_title,
			sgd_target.mt_idx as tgt_mt_idx, sgd_target.sgdt_owner_chk as tgt_sgdt_owner_chk,
			sgd_target.sgdt_leader_chk as tgt_sgdt_leader_chk, sgd_target.sgdt_idx as tgt_sgdt_idx
		FROM smap_schedule_t sst
		JOIN member_t m ON sst.mt_idx = m.mt_idx
		JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
		LEFT JOIN smap_group_detail_t sgd_target ON sst.sgdt_idx = sgd_target.sgdt_idx
		WHERE sst.sgt_idx IN (%s) AND sst.sst_show = 'Y'
		  AND sst.sst_sdate >= ? AND sst.sst_sdate < ?
		ORDER BY sst.sst_sdate LIMIT 100`, distanceCalc, intsCSV(groupIDs))
	args = append(args, startDate, endDate)
	var rows []GSMOwnerScheduleRow
	err := r.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// GroupSchedules는 group-schedules의 동적 WHERE 조회(start/end/member_id 옵션).
func (r *GroupScheduleManageRepository) GroupSchedules(groupID int, startDate, endDate *string, memberID *int) ([]GSMGroupScheduleRow, error) {
	where := "s.sgt_idx = ? AND s.sst_show = 'Y'"
	args := []interface{}{groupID}
	if startDate != nil {
		where += " AND s.sst_sdate >= ?"
		args = append(args, *startDate)
	}
	if endDate != nil {
		where += " AND s.sst_sdate < ?"
		args = append(args, *endDate)
	}
	if memberID != nil {
		where += " AND s.mt_idx = ?"
		args = append(args, *memberID)
	}
	query := fmt.Sprintf(`
		SELECT s.*, m.mt_name as member_name, m.mt_file1 as member_photo
		FROM smap_schedule_t s
		JOIN member_t m ON s.mt_idx = m.mt_idx
		WHERE %s
		ORDER BY s.sst_sdate ASC LIMIT 1000`, where)
	var rows []GSMGroupScheduleRow
	err := r.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// gsmInsertCols는 메인 INSERT 컬럼 순서(Python create_group_schedule INSERT, 30컬럼).
// sst_show='Y', sst_wdate=NOW()는 리터럴이므로 바인딩 대상에서 제외한다.
var gsmInsertCols = []string{
	"mt_idx", "sst_title", "sst_sdate", "sst_edate", "sst_sedate", "sst_all_day",
	"sgt_idx", "sgdt_idx", "sgdt_idx_t",
	"sst_location_title", "sst_location_add", "sst_location_lat", "sst_location_long",
	"sst_location_alarm",
	"sst_memo", "sst_supplies",
	"sst_alram", "sst_alram_t", "sst_schedule_alarm_chk",
	"sst_pick_type", "sst_pick_result", "sst_schedule_alarm",
	"sst_repeat_json", "sst_repeat_json_v",
	"slt_idx", "slt_idx_t", "sst_update_chk",
	"sst_adate",
}

// gsmRecurringCols는 반복 INSERT 컬럼 순서(메인 + 맨 앞 sst_pidx, 31컬럼).
var gsmRecurringCols = append([]string{"sst_pidx"}, gsmInsertCols...)

// === 공유 INSERT/UPDATE SQL(pool/tx 공용) ===

const gsmInsertSQL = `INSERT INTO smap_schedule_t (
	mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
	sgt_idx, sgdt_idx, sgdt_idx_t,
	sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
	sst_location_alarm,
	sst_memo, sst_supplies,
	sst_alram, sst_alram_t, sst_schedule_alarm_chk,
	sst_pick_type, sst_pick_result, sst_schedule_alarm,
	sst_repeat_json, sst_repeat_json_v,
	slt_idx, slt_idx_t, sst_update_chk,
	sst_show, sst_wdate, sst_adate
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', NOW(), ?)`

const gsmInsertFullSQL = `INSERT INTO smap_schedule_t (
	mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
	sgt_idx, sgdt_idx, sgdt_idx_t,
	sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
	sst_location_alarm,
	sst_memo, sst_supplies,
	sst_alram, sst_alram_t, sst_schedule_alarm_chk,
	sst_pick_type, sst_pick_result, sst_schedule_alarm,
	sst_repeat_json, sst_repeat_json_v,
	slt_idx, slt_idx_t, sst_update_chk,
	sst_pidx, sst_show, sst_wdate, sst_adate
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', NOW(), ?)`

const gsmRecurringSQL = `INSERT INTO smap_schedule_t (
	sst_pidx, mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
	sgt_idx, sgdt_idx, sgdt_idx_t,
	sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
	sst_location_alarm,
	sst_memo, sst_supplies,
	sst_alram, sst_alram_t, sst_schedule_alarm_chk,
	sst_pick_type, sst_pick_result, sst_schedule_alarm,
	sst_repeat_json, sst_repeat_json_v,
	slt_idx, slt_idx_t, sst_update_chk,
	sst_show, sst_wdate, sst_adate
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', NOW(), ?)`

const gsmSoftDeleteSQL = `UPDATE smap_schedule_t SET sst_show='N', sst_udate=NOW()
	WHERE (sst_pidx = ? OR sst_idx = ?) AND sgt_idx = ? AND sst_show = 'Y'`

// gsmInsertArgs/gsmInsertFullArgs/gsmRecurringArgs는 SQL 컬럼순으로 바인딩 인자를 구성한다.
func gsmInsertArgs(p map[string]interface{}) []interface{} {
	args := make([]interface{}, len(gsmInsertCols))
	for i, c := range gsmInsertCols {
		args[i] = p[c]
	}
	return args
}

func gsmInsertFullArgs(p map[string]interface{}) []interface{} {
	args := make([]interface{}, 0, len(gsmInsertCols)+1)
	for _, c := range gsmInsertCols[:len(gsmInsertCols)-1] { // sst_adate 직전까지(=27컬럼)
		args = append(args, p[c])
	}
	return append(args, p["sst_pidx"], p["sst_adate"]) // sst_pidx, sst_adate 순
}

func gsmRecurringArgs(p map[string]interface{}) []interface{} {
	args := make([]interface{}, len(gsmRecurringCols))
	for i, c := range gsmRecurringCols {
		args[i] = p[c]
	}
	return args
}

// gsmCheckRecurringKeys는 SQLAlchemy named bind의 "키 부재 시 raise"를 재현한다.
// recurring_params(=base.copy + 5개 덮어쓰기)에 INSERT 바인드 키가 부재하면 에러.
// POST(params는 전 키 보유)는 통과, PUT Path4(body가 base라 일부 키 부재 가능)는 에러→500.
func gsmCheckRecurringKeys(p map[string]interface{}) error {
	for _, k := range gsmRecurringCols {
		if _, ok := p[k]; !ok {
			return fmt.Errorf("bind parameter %q required (missing from body)", k)
		}
	}
	return nil
}

// BeginTx는 pool에서 *sql.Tx를 연다(PUT Path4 단일 트랜잭션용).
func (r *GroupScheduleManageRepository) BeginTx() (*sql.Tx, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, err
	}
	return sqlDB.Begin()
}

// InsertSchedule은 Python create_group_schedule의 raw INSERT를 이식한다(named→positional, pool 실행).
// sst_alram 이 요청에 없을 때의 기본값은 서비스(gsmCreateAlram)에서 0 으로 채운다(이전 'N' 은 1366 → 500).
func (r *GroupScheduleManageRepository) InsertSchedule(p map[string]interface{}) (int64, error) {
	ex, err := r.db.DB()
	if err != nil {
		return 0, err
	}
	return gsmExecID(ex, gsmInsertSQL, gsmInsertArgs(p))
}

// InsertScheduleFull은 create_new_schedule(PUT Path4)의 INSERT(sst_pidx 포함 31컬럼, pool 실행).
func (r *GroupScheduleManageRepository) InsertScheduleFull(p map[string]interface{}) (int64, error) {
	ex, err := r.db.DB()
	if err != nil {
		return 0, err
	}
	return gsmExecID(ex, gsmInsertFullSQL, gsmInsertFullArgs(p))
}

// InsertScheduleFullTx는 InsertScheduleFull의 트랜잭션 실행 변형(Path4 원자성).
func (r *GroupScheduleManageRepository) InsertScheduleFullTx(ex sqlExecer, p map[string]interface{}) (int64, error) {
	return gsmExecID(ex, gsmInsertFullSQL, gsmInsertFullArgs(p))
}

// InsertRecurring은 create_recurring_schedules의 반복 INSERT(sst_pidx 포함 31컬럼, pool 실행).
func (r *GroupScheduleManageRepository) InsertRecurring(p map[string]interface{}) error {
	if err := gsmCheckRecurringKeys(p); err != nil {
		return err
	}
	ex, err := r.db.DB()
	if err != nil {
		return err
	}
	_, err = ex.Exec(gsmRecurringSQL, gsmRecurringArgs(p)...)
	return err
}

// InsertRecurringTx는 InsertRecurring의 트랜잭션 실행 변형(Path4 원자성).
func (r *GroupScheduleManageRepository) InsertRecurringTx(ex sqlExecer, p map[string]interface{}) error {
	if err := gsmCheckRecurringKeys(p); err != nil {
		return err
	}
	_, err := ex.Exec(gsmRecurringSQL, gsmRecurringArgs(p)...)
	return err
}

// gsmExecID는 INSERT 실행 후 lastInsertId 반환(pool/tx 공용).
func gsmExecID(ex sqlExecer, q string, args []interface{}) (int64, error) {
	res, err := ex.Exec(q, args...)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// GetScheduleShownInGroup은 그 그룹(sgt_idx)의 sst_show='Y'인 단일 스케줄을 조회한다(PUT/DELETE 기존행 조회).
// 경로의 group_id와 일정의 sgt_idx가 다르면 없는 것으로 본다(다른 그룹 일정 수정·삭제 차단, S-1/S-2). 없으면 (nil,nil).
func (r *GroupScheduleManageRepository) GetScheduleShownInGroup(scheduleID, groupID int) (*model.Schedule, error) {
	var rows []model.Schedule
	err := r.db.Raw(`SELECT * FROM smap_schedule_t WHERE sst_idx = ? AND sgt_idx = ? AND sst_show = 'Y'`,
		scheduleID, groupID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// SoftDeleteFamilyTx는 패밀리(sst_pidx=parent OR sst_idx=parent)를 그 그룹 안에서만 sst_show='N'으로 소프트 삭제(트랜잭션 실행).
func (r *GroupScheduleManageRepository) SoftDeleteFamilyTx(ex sqlExecer, parentID, groupID int) error {
	_, err := ex.Exec(gsmSoftDeleteSQL, parentID, parentID, groupID)
	return err
}

// SoftDeleteSingleDdate는 DELETE 'this'/비반복(단일 행 sst_show='N', sst_ddate=NOW()). rowcount 반환.
// 그 그룹(sgt_idx)의 행만 건드린다. 호출 전 sst_show='Y' 확인됨.
func (r *GroupScheduleManageRepository) SoftDeleteSingleDdate(scheduleID, groupID int) (int64, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return 0, err
	}
	res, err := sqlDB.Exec(`UPDATE smap_schedule_t SET sst_show='N', sst_ddate=NOW() WHERE sst_idx = ? AND sgt_idx = ?`,
		scheduleID, groupID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SoftDeleteAllDdate는 DELETE 'all'(패밀리 sst_pidx=parent OR sst_idx=parent, 그 그룹, show='Y'). rowcount 반환.
func (r *GroupScheduleManageRepository) SoftDeleteAllDdate(parentID, groupID int) (int64, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return 0, err
	}
	res, err := sqlDB.Exec(`UPDATE smap_schedule_t SET sst_show='N', sst_ddate=NOW()
		WHERE (sst_pidx = ? OR sst_idx = ?) AND sgt_idx = ? AND sst_show = 'Y'`, parentID, parentID, groupID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SoftDeleteFutureDdate는 DELETE 'future'(패밀리 + sst_sdate>=current, 그 그룹, show='Y'). rowcount 반환.
func (r *GroupScheduleManageRepository) SoftDeleteFutureDdate(parentID, groupID int, since string) (int64, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return 0, err
	}
	res, err := sqlDB.Exec(`UPDATE smap_schedule_t SET sst_show='N', sst_ddate=NOW()
		WHERE (sst_pidx = ? OR sst_idx = ?) AND sgt_idx = ? AND sst_sdate >= ? AND sst_show = 'Y'`,
		parentID, parentID, groupID, since)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// GSMTargetRow는 일괄 수정 대상(sst_idx + sst_sdate).
type GSMTargetRow struct {
	SstIdx   int        `gorm:"column:sst_idx"`
	SstSdate *time.Time `gorm:"column:sst_sdate"`
}

// SelectFamilyTargets는 일괄 수정 대상 조회(그 그룹의 패밀리만). since!=nil이면 sst_sdate>=since(future 옵션).
func (r *GroupScheduleManageRepository) SelectFamilyTargets(parentID, groupID int, since *string) ([]GSMTargetRow, error) {
	var rows []GSMTargetRow
	if since != nil {
		err := r.db.Raw(`SELECT sst_idx, sst_sdate FROM smap_schedule_t
			WHERE (sst_pidx = ? OR sst_idx = ?) AND sgt_idx = ? AND sst_sdate >= ? AND sst_show = 'Y'`,
			parentID, parentID, groupID, *since).Scan(&rows).Error
		return rows, err
	}
	err := r.db.Raw(`SELECT sst_idx, sst_sdate FROM smap_schedule_t
		WHERE (sst_pidx = ? OR sst_idx = ?) AND sgt_idx = ? AND sst_show = 'Y'`, parentID, parentID, groupID).Scan(&rows).Error
	return rows, err
}

// UpdateScheduleDynamic은 update_single_schedule의 동적 UPDATE를 이식한다.
// cols/vals는 non-None 필드만(서비스가 Python all_fields 병합순서대로 구성), 항상 sst_udate=NOW() 추가. 그 그룹의 행만 갱신한다.
func (r *GroupScheduleManageRepository) UpdateScheduleDynamic(scheduleID, groupID int, cols []string, vals []interface{}) error {
	sqlDB, err := r.db.DB()
	if err != nil {
		return err
	}
	setParts := make([]string, 0, len(cols)+1)
	for _, c := range cols {
		setParts = append(setParts, c+" = ?")
	}
	setParts = append(setParts, "sst_udate = NOW()")
	args := make([]interface{}, 0, len(vals)+1)
	args = append(args, vals...)
	args = append(args, scheduleID, groupID)
	q := fmt.Sprintf("UPDATE smap_schedule_t SET %s WHERE sst_idx = ? AND sgt_idx = ?", joinComma(setParts))
	_, err = sqlDB.Exec(q, args...)
	return err
}

// joinComma는 ", " 조인(strings 임포트 회피용 소형 헬퍼).
func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}

// DebugSchedule은 debug의 단일 스케줄 조회(show 무관, 없으면 nil,nil).
func (r *GroupScheduleManageRepository) DebugSchedule(scheduleID int) (*model.Schedule, error) {
	var rows []model.Schedule
	err := r.db.Raw(`SELECT * FROM smap_schedule_t WHERE sst_idx = ?`, scheduleID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// DebugRelated는 debug의 관련 반복 일정 조회.
func (r *GroupScheduleManageRepository) DebugRelated(scheduleID, parentID int) ([]GSMRelatedRow, error) {
	var rows []GSMRelatedRow
	err := r.db.Raw(`
		SELECT sst_idx, sst_pidx, sst_title, sst_sdate, sst_repeat_json
		FROM smap_schedule_t
		WHERE (sst_pidx = ? OR sst_idx = ? OR (sst_pidx = ? AND ? IS NOT NULL))
		  AND sst_show = 'Y'
		ORDER BY sst_sdate`, scheduleID, scheduleID, parentID, parentID).Scan(&rows).Error
	return rows, err
}
