package repository

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type MemberLocationLogRepository struct {
	db *gorm.DB
}

func NewMemberLocationLog(db *gorm.DB) *MemberLocationLogRepository {
	return &MemberLocationLogRepository{db: db}
}

// recentLocationWindow는 GetRecentLocationsBatch가 "최신 위치"를 찾는 gps_time 범위다.
// 호출측(지오펜스)은 5분(gpsStaleThreshold)보다 오래된 좌표를 버리고 결과 부재와 동일하게 skip하므로
// 판정 결과는 같다. 예외 하나: 24시간보다 오래된 캐시 배치가 신선한 행보다 늦게 적재되면, 기존은
// MAX(mlt_idx)=옛 좌표로 skip했지만 이제 창 안의 신선한 좌표로 판정한다(실제 최신 위치 기준이라 의도된 동작).
// 이 창이 없으면 전 파티션을 스캔한다(A/B 7회 중앙값 50ms → 3.5ms, 읽은 행 19.7만 → 754).
const recentLocationWindow = 24 * time.Hour

// nextDayYMD는 "YYYY-MM-DD"의 다음 날을 같은 형식으로 반환한다(반열린 구간 상한용).
func nextDayYMD(ymd string) (string, error) {
	d, err := time.ParseInLocation("2006-01-02", ymd, time.Local)
	if err != nil {
		return "", fmt.Errorf("invalid date %q: %w", ymd, err)
	}
	return d.AddDate(0, 0, 1).Format("2006-01-02"), nil
}

// GetLogByID는 mlt_idx 단건 조회. 없으면 (nil,nil).
func (r *MemberLocationLogRepository) GetLogByID(mltIdx int) (*model.MemberLocationLog, error) {
	var l model.MemberLocationLog
	err := r.db.Where("mlt_idx = ?", mltIdx).First(&l).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// CreateLog는 Python crud.create_location_log를 이식한다: 로그 INSERT + (mlt_lat/long이 nil 아니면)
// member_t.mt_lat/mt_long/mt_udate 최신위치 갱신(부수효과). 둘을 단일 트랜잭션으로 묶는다(Python 단일 commit).
func (r *MemberLocationLogRepository) CreateLog(l *model.MemberLocationLog, now time.Time) error {
	fillWdate(l, now)
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(l).Error; err != nil {
			return err
		}
		if l.MltLat != nil && l.MltLong != nil {
			return updateMemberLatestLocation(tx, l, now)
		}
		return nil
	})
}

// CreateLogsBatch는 배치 저장(mlt_gps_data)을 단일 트랜잭션 + 다중행 INSERT로 처리한다.
// 건별 CreateLog를 N번 부르면 N개 트랜잭션·2N개 쿼리가 나간다.
// member_t 최신위치는 건별 처리 시의 최종 상태(배열 순서상 마지막으로 lat/long이 있는 항목)를 1회 UPDATE로 재현한다.
// 실패 시 전체 롤백되므로, 호출측은 건별 경로로 재시도해 부분 성공 동작을 유지해야 한다.
// gorm mysql 드라이버는 MariaDB 10.5+에서 INSERT ... RETURNING으로 받은 mlt_idx를 슬라이스 순서대로 채운다.
func (r *MemberLocationLogRepository) CreateLogsBatch(logs []*model.MemberLocationLog, now time.Time) error {
	if len(logs) == 0 {
		return nil
	}
	var lastWithLoc *model.MemberLocationLog
	for _, l := range logs {
		fillWdate(l, now)
		if l.MltLat != nil && l.MltLong != nil {
			lastWithLoc = l
		}
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.CreateInBatches(logs, 500).Error; err != nil {
			return err
		}
		if lastWithLoc != nil {
			return updateMemberLatestLocation(tx, lastWithLoc, now)
		}
		return nil
	})
}

// GetLogsByIDs는 한 회원의 여러 mlt_idx를 1쿼리로 조회한다(단건·배치 응답의 DB 저장값 재조회용).
// minTime/maxTime을 함께 넘기면 RANGE(to_days(mlt_gps_time)) 파티션 프루닝이 동작해
// 25개 전 파티션 대신 해당 1~2개 파티션만 읽는다.
func (r *MemberLocationLogRepository) GetLogsByIDs(mtIdx int, mltIdxs []int, minTime, maxTime *time.Time) ([]model.MemberLocationLog, error) {
	out := make([]model.MemberLocationLog, 0, len(mltIdxs))
	if len(mltIdxs) == 0 {
		return out, nil
	}
	q := r.db.Where("mt_idx = ? AND mlt_idx IN ?", mtIdx, mltIdxs)
	if minTime != nil {
		q = q.Where("mlt_gps_time >= ?", *minTime)
	}
	if maxTime != nil {
		q = q.Where("mlt_gps_time <= ?", *maxTime)
	}
	err := q.Find(&out).Error
	return out, err
}

// fillWdate는 mlt_wdate(등록일시)가 비어 있으면 now로 채운다.
// Python 모델의 default=func.now()와 같은 의미. Go 이관 후 이 값이 NULL로 저장돼
// 걸음수 조회(mlt_wdate 필터)와 일일 로그 집계가 0건이 되는 회귀가 있었다.
func fillWdate(l *model.MemberLocationLog, now time.Time) {
	if l.MltWdate == nil {
		t := now
		l.MltWdate = &t
	}
}

// updateMemberLatestLocation은 member_t 최신위치를 갱신한다.
// member 존재 시에만 갱신(Python: member 있으면 갱신, 없으면 경고만).
func updateMemberLatestLocation(tx *gorm.DB, l *model.MemberLocationLog, now time.Time) error {
	return tx.Model(&model.Member{}).Where("mt_idx = ?", l.MtIdx).
		Updates(map[string]interface{}{"mt_lat": *l.MltLat, "mt_long": *l.MltLong, "mt_udate": now}).Error
}

// UpdateLog는 mlt_idx 행의 지정 컬럼만 UPDATE한다(update_location_log exclude_unset). RowsAffected 반환.
func (r *MemberLocationLogRepository) UpdateLog(mltIdx int, fields map[string]interface{}) (int64, error) {
	res := r.db.Model(&model.MemberLocationLog{}).Where("mlt_idx = ?", mltIdx).Updates(fields)
	return res.RowsAffected, res.Error
}

// DeleteLog는 mlt_idx 행을 하드 삭제한다(delete_location_log).
func (r *MemberLocationLogRepository) DeleteLog(mltIdx int) error {
	return r.db.Where("mlt_idx = ?", mltIdx).Delete(&model.MemberLocationLog{}).Error
}

// RecentLocation은 회원별 최신 위치 1행(get_recent_locations_batch 한 행)이다.
// Python member_location_log.py:78-84의 dict({lat, long, accuracy, gps_time})와 1:1 대응한다.
//   - Lat/Long: DECIMAL → Python은 float(...) if ... else 0(없으면 0 폴백)이라 *float64 nil→0 처리.
//   - Accuracy: Python float(mlt_accuacy) if mlt_accuacy else None(없으면 None).
//   - GpsTime : mlt_gps_time(없으면 nil).
type RecentLocation struct {
	MtIdx    int        `gorm:"column:mt_idx"`
	Lat      *float64   `gorm:"column:mlt_lat"`
	Long     *float64   `gorm:"column:mlt_long"`
	Accuracy *float64   `gorm:"column:mlt_accuacy"` // 오타 컬럼명(원본 그대로)
	GpsTime  *time.Time `gorm:"column:mlt_gps_time"`
}

// GetRecentLocationsBatch는 Python MemberLocationLog.get_recent_locations_batch(member_location_log.py:55)를
// 이식한다. 회원별 MAX(mlt_idx)=최신 로그를 서브쿼리로 뽑아 본 테이블과 조인한다(500개 청크).
// 반환은 {mt_idx: RecentLocation}. Python의 lat/long 0 폴백·accuracy None 폴백은 RecentLocation
// 포인터 필드(nil)로 그대로 보존하고, 거리/필터 단계에서 Python과 동일하게 해석한다.
func (r *MemberLocationLogRepository) GetRecentLocationsBatch(mtIdxList []int) (map[int]RecentLocation, error) {
	out := make(map[int]RecentLocation)
	if len(mtIdxList) == 0 {
		return out, nil
	}
	const chunkSize = 500
	since := time.Now().Add(-recentLocationWindow)
	for i := 0; i < len(mtIdxList); i += chunkSize {
		end := i + chunkSize
		if end > len(mtIdxList) {
			end = len(mtIdxList)
		}
		chunk := mtIdxList[i:end]

		// 서브쿼리: 각 회원별 최신 mlt_idx(최근 recentLocationWindow 내).
		sub := r.db.Model(&model.MemberLocationLog{}).
			Select("mt_idx, MAX(mlt_idx) AS max_idx").
			Where("mt_idx IN ? AND mlt_gps_time >= ?", chunk, since).
			Group("mt_idx")

		// 바깥 조인에도 같은 gps_time 하한을 둬야 PK 조회가 최근 파티션으로 프루닝된다.
		var rows []RecentLocation
		err := r.db.Model(&model.MemberLocationLog{}).
			Select("member_location_log_t.mt_idx, member_location_log_t.mlt_lat, "+
				"member_location_log_t.mlt_long, member_location_log_t.mlt_accuacy, "+
				"member_location_log_t.mlt_gps_time").
			Joins("JOIN (?) AS latest ON member_location_log_t.mlt_idx = latest.max_idx "+
				"AND member_location_log_t.mt_idx = latest.mt_idx", sub).
			Where("member_location_log_t.mlt_gps_time >= ?", since).
			Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			out[row.MtIdx] = row
		}
	}
	return out, nil
}

// GetMemberLogs는 mt_idx + (start>=)/(end<) 날짜창 + ORDER BY mlt_gps_time ASC + offset/limit
// (Python crud.get_member_location_logs). start/end는 nil이면 미적용(end는 +1일 적용된 값).
func (r *MemberLocationLogRepository) GetMemberLogs(mtIdx int, start, end *time.Time, limit, offset int) ([]model.MemberLocationLog, error) {
	q := r.db.Where("mt_idx = ?", mtIdx)
	if start != nil {
		q = q.Where("mlt_gps_time >= ?", *start)
	}
	if end != nil {
		q = q.Where("mlt_gps_time < ?", *end)
	}
	out := make([]model.MemberLocationLog, 0)
	err := q.Order("mlt_gps_time asc").Offset(offset).Limit(limit).Find(&out).Error
	return out, err
}

// GetMemberLogsByExactDate는 mt_idx + [start, end] BETWEEN(<=) + ORDER ASC + offset/limit
// (Python crud.get_member_location_logs_by_exact_date, [date 00:00:00, date 23:59:59]).
func (r *MemberLocationLogRepository) GetMemberLogsByExactDate(mtIdx int, start, end time.Time, limit, offset int) ([]model.MemberLocationLog, error) {
	out := make([]model.MemberLocationLog, 0)
	err := r.db.Where("mt_idx = ? AND mlt_gps_time >= ? AND mlt_gps_time <= ?", mtIdx, start, end).
		Order("mlt_gps_time asc").Offset(offset).Limit(limit).Find(&out).Error
	return out, err
}

// DailySummary는 날짜별 GROUP BY 집계(Python crud.get_member_location_logs_daily_summary):
// WHERE mt_idx + accuacy<max + speed>=min + lat>0 + long>0 + gps_time IN [start,end],
// GROUP BY DATE(gps_time), SELECT MIN(mlt_idx)/DATE/MIN/MAX(gps_time), ORDER BY DATE ASC.
func (r *MemberLocationLogRepository) DailySummary(mtIdx int, start, end time.Time, maxAcc, minSpeed float64) ([]model.LocationDailySummaryRow, error) {
	out := make([]model.LocationDailySummaryRow, 0)
	err := r.db.Model(&model.MemberLocationLog{}).
		Select("MIN(mlt_idx) as mlt_idx, CAST(mlt_gps_time AS DATE) as log_date, "+
			"MIN(mlt_gps_time) as start_time, MAX(mlt_gps_time) as end_time").
		Where("mt_idx = ? AND mlt_accuacy < ? AND mlt_speed >= ? AND mlt_lat > 0 AND mlt_long > 0 "+
			"AND mlt_gps_time >= ? AND mlt_gps_time <= ?", mtIdx, maxAcc, minSpeed, start, end).
		Group("CAST(mlt_gps_time AS DATE)").
		Order("CAST(mlt_gps_time AS DATE) asc").
		Scan(&out).Error
	return out, err
}

// DailyCounts는 daily-counts(-simple)용: 그룹멤버(Member JOIN GroupDetail) + 멤버별·날짜별
// COUNT(DISTINCT mlt_idx) (DATE(gps_time) BETWEEN start AND end, ORDER BY mt_idx, log_date DESC).
// having=true면 HAVING COUNT>0 추가(simple, 실질 no-op). 멤버 0명이면 counts 미조회.
func (r *MemberLocationLogRepository) DailyCounts(groupID int, startStr, endStr string, having bool) ([]model.LocationLogMemberBasic, []model.DailyCountRow, error) {
	var members []model.LocationLogMemberBasic
	err := r.db.Table("member_t m").
		Select("m.mt_idx, m.mt_name, m.mt_nickname, m.mt_file1, m.mt_gender").
		Joins("JOIN smap_group_detail_t gd ON m.mt_idx = gd.mt_idx").
		Where("gd.sgt_idx = ? AND gd.sgdt_exit = ? AND gd.sgdt_discharge = ? AND gd.sgdt_show = ?",
			groupID, "N", "N", "Y").
		Scan(&members).Error
	if err != nil {
		return nil, nil, err
	}
	if len(members) == 0 {
		return members, nil, nil
	}
	ids := make([]int, len(members))
	for i, m := range members {
		ids[i] = m.MtIdx
	}
	havingClause := ""
	if having {
		havingClause = "HAVING COUNT(DISTINCT mlt_idx) > 0 "
	}
	endExclusive, err := nextDayYMD(endStr)
	if err != nil {
		return nil, nil, err
	}
	counts := make([]model.DailyCountRow, 0)
	// DATE(mlt_gps_time) BETWEEN start AND end 와 동치인 반열린 구간 [start, end+1일).
	// 컬럼을 함수로 감싸지 않아야 RANGE(to_days(mlt_gps_time)) 파티션 프루닝이 동작한다.
	err = r.db.Raw(`SELECT mt_idx as member_idx, DATE(mlt_gps_time) as log_date, COUNT(DISTINCT mlt_idx) as count
		FROM member_location_log_t WHERE mt_idx IN (`+intsCSV(ids)+`)
		AND mlt_gps_time >= ? AND mlt_gps_time < ?
		GROUP BY mt_idx, DATE(mlt_gps_time) `+havingClause+`ORDER BY mt_idx, log_date DESC`,
		startStr, endExclusive).Scan(&counts).Error
	if err != nil {
		return nil, nil, err
	}
	return members, counts, nil
}

// MemberActivity는 Python get_member_activity_by_date(그룹멤버 JOIN + COUNT + MIN/MAX)를 이식한다.
// COUNT와 MIN/MAX는 1쿼리로 합치고 dateStr(YYYY-MM-DD)의 [date, date+1일) 범위로 비교한다. 멤버 0명이면 빈 슬라이스.
func (r *MemberLocationLogRepository) MemberActivity(groupID int, dateStr string) ([]model.MemberActivityRow, error) {
	type basicRow struct {
		MtIdx      int     `gorm:"column:mt_idx"`
		MtName     *string `gorm:"column:mt_name"`
		MtNickname *string `gorm:"column:mt_nickname"`
		MtFile1    *string `gorm:"column:mt_file1"`
		MtGender   *int    `gorm:"column:mt_gender"`
	}
	var basics []basicRow
	err := r.db.Table("member_t m").
		Select("m.mt_idx, m.mt_name, m.mt_nickname, m.mt_file1, m.mt_gender").
		Joins("JOIN smap_group_detail_t gd ON m.mt_idx = gd.mt_idx").
		Where("gd.sgt_idx = ? AND gd.sgdt_exit = ? AND gd.sgdt_discharge = ? AND gd.sgdt_show = ?",
			groupID, "N", "N", "Y").
		Scan(&basics).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.MemberActivityRow, 0, len(basics))
	if len(basics) == 0 {
		return out, nil
	}

	ids := make([]int, len(basics))
	for i, b := range basics {
		ids[i] = b.MtIdx
	}
	nextDay, err := nextDayYMD(dateStr)
	if err != nil {
		return nil, err
	}

	// Python은 COUNT와 MIN/MAX를 같은 WHERE로 2번 조회했다. 결과가 동일하므로 1쿼리로 합치고,
	// DATE(mlt_gps_time) = ? 대신 반열린 구간 [date, date+1일)로 파티션 프루닝을 살린다.
	type aggRow struct {
		MtIdx        int        `gorm:"column:mt_idx"`
		LogCount     int        `gorm:"column:log_count"`
		FirstLogTime *time.Time `gorm:"column:first_log_time"`
		LastLogTime  *time.Time `gorm:"column:last_log_time"`
	}
	var aggs []aggRow
	if err := r.db.Raw(`SELECT mt_idx, COUNT(*) as log_count,
		MIN(mlt_gps_time) as first_log_time, MAX(mlt_gps_time) as last_log_time
		FROM member_location_log_t WHERE mt_idx IN (`+intsCSV(ids)+`)
		AND mlt_gps_time >= ? AND mlt_gps_time < ? GROUP BY mt_idx`, dateStr, nextDay).
		Scan(&aggs).Error; err != nil {
		return nil, err
	}
	aggMap := make(map[int]aggRow, len(aggs))
	for _, a := range aggs {
		aggMap[a.MtIdx] = a
	}

	for _, b := range basics {
		a := aggMap[b.MtIdx] // 로그 없는 멤버는 zero value(0건, nil 시각) — 기존 동작과 동일
		out = append(out, model.MemberActivityRow{
			MtIdx: b.MtIdx, MtName: b.MtName, MtNickname: b.MtNickname,
			MtFile1: b.MtFile1, MtGender: b.MtGender,
			LogCount: a.LogCount, FirstLogTime: a.FirstLogTime, LastLogTime: a.LastLogTime,
		})
	}
	return out, nil
}

// GetMembersWithLogsByDate는 [start, end) 범위에 로그가 있는 distinct mt_idx
// (Python crud.get_members_with_logs_by_date, group_id는 미사용). 정렬 없음.
func (r *MemberLocationLogRepository) GetMembersWithLogsByDate(start, end time.Time) ([]int, error) {
	out := make([]int, 0)
	err := r.db.Model(&model.MemberLocationLog{}).
		Where("mlt_gps_time >= ? AND mlt_gps_time < ?", start, end).
		Distinct().Pluck("mt_idx", &out).Error
	return out, err
}

// --- /summary date 분기 헬퍼 (Python crud.get_schedule_count / get_gps_distance_and_time) ---

// personalScheduleSQL: 개인 일정 COUNT. 파라미터 순서 mt_idx, date_end, date_start.
const personalScheduleSQL = `SELECT COUNT(DISTINCT sst_idx) as count
		FROM smap_schedule_t
		WHERE mt_idx = ?
		AND sgt_idx IS NULL
		AND (sgdt_idx IS NULL OR sgdt_idx = 0)
		AND (sst_sdate <= ? AND sst_edate >= ?)
		AND sst_show = 'Y'
		AND sst_title IS NOT NULL AND sst_title != ''`

// groupConcatSQL: 멤버의 그룹상세 GROUP_CONCAT. 파라미터 mt_idx.
const groupConcatSQL = `SELECT GROUP_CONCAT(sgt_idx) as gc_sgt_idx, GROUP_CONCAT(sgdt_idx) as gc_sgdt_idx
		FROM smap_group_detail_t
		WHERE mt_idx = ?
		AND sgdt_discharge = 'N'
		AND sgdt_exit = 'N'`

// groupScheduleSQLFmt: 그룹 일정 COUNT. gc_sgdt_idx(콤마 문자열)를 IN절에 직접 삽입(Python .format()
// 과 동일, 파라미터 바인딩 아님 — 내부 정수 컬럼이라 안전). 파라미터 순서 date_end, date_start.
const groupScheduleSQLFmt = `SELECT COUNT(DISTINCT sst_idx) as count
		FROM smap_schedule_t
		WHERE sgdt_idx IN (%s)
		AND (sst_sdate <= ? AND sst_edate >= ?)
		AND sst_show = 'Y'
		AND sst_title IS NOT NULL AND sst_title != ''`

// ScheduleCount는 개인 일정 + 그룹 일정 개수(Python get_schedule_count). 내부 예외는 호출측(service)이
// 0으로 흡수한다(Python except→return 0과 동일). gc_sgdt_idx가 falsy면 그룹 쿼리 미실행.
func (r *MemberLocationLogRepository) ScheduleCount(mtIdx int, dateStr string) (int, error) {
	dateStart := dateStr + " 00:00:00"
	dateEnd := dateStr + " 23:59:59"

	var personal struct {
		Count int `gorm:"column:count"`
	}
	if err := r.db.Raw(personalScheduleSQL, mtIdx, dateEnd, dateStart).Scan(&personal).Error; err != nil {
		return 0, err
	}

	var gc struct {
		GcSgtIdx  *string `gorm:"column:gc_sgt_idx"`
		GcSgdtIdx *string `gorm:"column:gc_sgdt_idx"`
	}
	if err := r.db.Raw(groupConcatSQL, mtIdx).Scan(&gc).Error; err != nil {
		return 0, err
	}

	groupCount := 0
	if gc.GcSgdtIdx != nil && *gc.GcSgdtIdx != "" {
		var grp struct {
			Count int `gorm:"column:count"`
		}
		q := fmt.Sprintf(groupScheduleSQLFmt, *gc.GcSgdtIdx)
		if err := r.db.Raw(q, dateEnd, dateStart).Scan(&grp).Error; err != nil {
			return 0, err
		}
		groupCount = grp.Count
	}
	return personal.Count + groupCount, nil
}

// gpsDistanceSQL: 일일 이동 거리/시간 집계 CTE(LAG 단일 패스). 파라미터 순서
// mt_idx, date_start, date_end, max_accuracy, min_speed(CASE), min_speed(BETWEEN), max_speed.
// 기존 RankedLogs 자기조인 대신 LAG() 단일 패스를 사용하고, 동일 좌표 부동소수점 오차에 의한
// ACOS 도메인 초과(GREATEST/LEAST 클램핑)와 동일 초 중복 로그의 0나눗셈(time_diff_seconds > 0)을 방지한다.
const gpsDistanceSQL = `WITH Diffs AS (
			SELECT
				mlt_lat AS lat2,
				mlt_long AS long2,
				LAG(mlt_lat) OVER (ORDER BY mlt_gps_time ASC, mlt_idx ASC) AS lat1,
				LAG(mlt_long) OVER (ORDER BY mlt_gps_time ASC, mlt_idx ASC) AS long1,
				TIMESTAMPDIFF(SECOND, LAG(mlt_gps_time) OVER (ORDER BY mlt_gps_time ASC, mlt_idx ASC), mlt_gps_time) AS time_diff_seconds
			FROM member_location_log_t
			WHERE mt_idx = ? AND mlt_gps_time BETWEEN ? AND ?
				AND mlt_speed > 0 AND mlt_accuacy < ?
		)
		SELECT
			SUM(CASE
				WHEN rslt.time_diff_seconds > 10
				AND ROUND((rslt.distance_meters / rslt.time_diff_seconds) * 3600 / 1000, 1) < ?
				AND rslt.time_diff_seconds > rslt.distance_meters / 0.6
				THEN rslt.distance_meters / 0.6
				ELSE time_diff_seconds
			END) / 60 AS moving_minute,
			SUM(rslt.distance_meters) AS moving_meters
		FROM (
			SELECT
				time_diff_seconds,
				ROUND(6371000 * ACOS(GREATEST(-1, LEAST(1,
					COS(RADIANS(lat2)) * COS(RADIANS(lat1)) * COS(RADIANS(long1) - RADIANS(long2)) +
					SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))
				))), 1) AS distance_meters
			FROM Diffs
			WHERE lat1 IS NOT NULL AND time_diff_seconds > 0
		) rslt
		WHERE ROUND((rslt.distance_meters / rslt.time_diff_seconds) * 3600 / 1000, 1) BETWEEN ? AND ?`

// gpsStepsSQL: 해당 날짜 마지막 걸음수. 파라미터 mt_idx, date_start, date_end.
// Python 원본은 mlt_wdate(등록일시)로 필터했으나, Go 이관(2026-06-02) 이후 INSERT가 mlt_wdate를
// 채우지 않아 그 이후 날짜는 항상 0건(걸음수 0)이었다. 정렬 키와 같은 mlt_gps_time으로 필터해
// 과거 데이터도 조회되게 하고 파티션 프루닝 + idx_covering 역스캔을 탄다.
const gpsStepsSQL = `SELECT mt_health_work
		FROM member_location_log_t
		WHERE mt_idx = ? AND mlt_gps_time BETWEEN ? AND ?
		ORDER BY mlt_gps_time DESC LIMIT 1`

// GpsDistanceAndTime은 (이동 미터, 이동 분, 걸음수)를 반환(Python get_gps_distance_and_time).
// max_accuracy=100.0, min_speed=2.0, max_speed=55.0 하드코딩. 내부 예외는 호출측이 0,0,0으로 흡수.
func (r *MemberLocationLogRepository) GpsDistanceAndTime(mtIdx int, dateStr string) (float64, float64, int, error) {
	dateStart := dateStr + " 00:00:00"
	dateEnd := dateStr + " 23:59:59"
	const maxAccuracy, minSpeed, maxSpeed = 100.0, 2.0, 55.0

	var agg struct {
		MovingMinute *float64 `gorm:"column:moving_minute"`
		MovingMeters *float64 `gorm:"column:moving_meters"`
	}
	if err := r.db.Raw(gpsDistanceSQL, mtIdx, dateStart, dateEnd, maxAccuracy, minSpeed, minSpeed, maxSpeed).
		Scan(&agg).Error; err != nil {
		return 0, 0, 0, err
	}

	var stepRows []struct {
		MtHealthWork *int `gorm:"column:mt_health_work"`
	}
	if err := r.db.Raw(gpsStepsSQL, mtIdx, dateStart, dateEnd).Scan(&stepRows).Error; err != nil {
		return 0, 0, 0, err
	}

	meters := 0.0
	if agg.MovingMeters != nil {
		meters = *agg.MovingMeters
	}
	minutes := 0.0
	if agg.MovingMinute != nil {
		minutes = *agg.MovingMinute
	}
	steps := 0
	if len(stepRows) > 0 && stepRows[0].MtHealthWork != nil {
		steps = *stepRows[0].MtHealthWork
	}
	return meters, minutes, steps, nil
}

// --- /stay-times, /map-markers (raw SQL을 MariaDB에 그대로 위임) ---

// stayTimesSQL: 6단계 CTE(체류시간 분석). 파라미터 순서
// min_speed(CASE), mt_idx, max_accuracy, start_datetime, end_datetime, min_duration.
const stayTimesSQL = `WITH labeled_data AS (
			SELECT mlt_idx, mt_idx, mlt_gps_time, mlt_speed, mlt_lat, mlt_long,
				CASE WHEN mlt_speed < ? THEN 'stay' ELSE 'move' END AS label
			FROM member_location_log_t
			WHERE mt_idx = ? AND mlt_accuacy < ? AND mlt_gps_time BETWEEN ? AND ?
			ORDER BY mlt_gps_time
		),
		labeled_data_with_lag AS (
			SELECT *,
				LAG(label) OVER (ORDER BY mlt_gps_time) AS prev_label,
				LAG(mlt_lat) OVER (ORDER BY mlt_gps_time) AS prev_lat,
				LAG(mlt_long) OVER (ORDER BY mlt_gps_time) AS prev_long
			FROM labeled_data
		),
		labeled_data_with_grp AS (
			SELECT *,
				SUM(CASE WHEN label <> COALESCE(prev_label, label) THEN 1 ELSE 0 END) OVER (ORDER BY mlt_gps_time) AS grp
			FROM labeled_data_with_lag
		),
		labeled_data_with_grp_status AS (
			SELECT *,
				CASE
					WHEN ROW_NUMBER() OVER (PARTITION BY grp ORDER BY mlt_gps_time) = 1 THEN 'S'
					WHEN ROW_NUMBER() OVER (PARTITION BY grp ORDER BY mlt_gps_time DESC) = 1 THEN 'E'
					WHEN mlt_gps_time = (SELECT MAX(mlt_gps_time) FROM labeled_data_with_grp) THEN 'E'
					ELSE NULL
				END AS grp_status
			FROM labeled_data_with_grp
		),
		filtered_data AS (
			SELECT * FROM labeled_data_with_grp_status
			WHERE grp IN (
				SELECT grp FROM labeled_data_with_grp_status
				GROUP BY grp
				HAVING COUNT(CASE WHEN grp_status = 'S' THEN 1 END) = 1
					AND COUNT(CASE WHEN grp_status = 'E' THEN 1 END) >= 1
			)
		),
		result_data AS (
			SELECT label, grp,
				MIN(CASE WHEN grp_status = 'S' THEN mlt_gps_time END) AS start_time,
				MAX(CASE WHEN grp_status = 'E' THEN mlt_gps_time END) AS end_time,
				TIMESTAMPDIFF(SECOND,
					MIN(CASE WHEN grp_status = 'S' THEN mlt_gps_time END),
					MAX(CASE WHEN grp_status = 'E' THEN mlt_gps_time END)
				) / 60 AS duration,
				SUM(CASE WHEN prev_lat IS NOT NULL AND prev_long IS NOT NULL
					THEN (6371 * ACOS(GREATEST(-1, LEAST(1,
						COS(RADIANS(mlt_lat)) * COS(RADIANS(prev_lat)) *
						COS(RADIANS(prev_long) - RADIANS(mlt_long)) +
						SIN(RADIANS(mlt_lat)) * SIN(RADIANS(prev_lat))
					))))
					ELSE 0 END) AS distance,
				MAX(CASE WHEN grp_status = 'S' THEN mlt_lat END) AS start_lat,
				MAX(CASE WHEN grp_status = 'S' THEN mlt_long END) AS start_long
			FROM filtered_data
			GROUP BY label, grp
		)
		SELECT label, grp, start_time, end_time, duration, distance, start_lat, start_long
		FROM result_data
		WHERE duration >= ? AND label = 'stay'
		ORDER BY start_time`

// StayTimes는 체류시간 분석 결과 행 목록을 반환한다(Python crud.get_member_stay_times).
func (r *MemberLocationLogRepository) StayTimes(mtIdx int, date string, minSpeed, maxAccuracy float64, minDuration int) ([]model.StayTimeRow, error) {
	startDatetime := date + " 00:00:00"
	endDatetime := date + " 23:59:59"
	out := make([]model.StayTimeRow, 0)
	err := r.db.Raw(stayTimesSQL, minSpeed, mtIdx, maxAccuracy, startDatetime, endDatetime, minDuration).
		Scan(&out).Error
	return out, err
}

// mapMarkersSQL: 지도 마커용 SELECT * + GROUP BY CASE + HAVING COUNT%10=1. 파라미터 순서
// mt_idx, max_accuracy, min_speed, start_datetime, end_datetime, min_speed, max_accuracy.
// SELECT * + 비집계 GROUP BY는 ONLY_FULL_GROUP_BY 비활성 의존 — Python과 동일 SQL을 그대로 위임해야
// 같은 대표행 선택 동작이 재현된다(ORM 재작성 금지).
const mapMarkersSQL = `SELECT *
		FROM member_location_log_t
		WHERE mt_idx = ?
			AND mlt_accuacy < ?
			AND mlt_speed >= ?
			AND (mlt_lat > 0 AND mlt_long > 0)
			AND mlt_gps_time BETWEEN ? AND ?
		GROUP BY
			CASE
				WHEN (mlt_speed >= ? AND mlt_accuacy < ?) THEN mlt_gps_time
				ELSE mt_health_work
			END
		HAVING COUNT(*) % 10 = 1
		ORDER BY mlt_gps_time ASC`

// MapMarkers는 GROUP BY/HAVING 적용된 마커 행 전부를 반환한다(샘플링은 service에서, Python과 동일).
func (r *MemberLocationLogRepository) MapMarkers(mtIdx int, date string, minSpeed, maxAccuracy float64) ([]model.MemberLocationLog, error) {
	startDatetime := date + " 00:00:00"
	endDatetime := date + " 23:59:59"
	out := make([]model.MemberLocationLog, 0)
	err := r.db.Raw(mapMarkersSQL, mtIdx, maxAccuracy, minSpeed, startDatetime, endDatetime, minSpeed, maxAccuracy).
		Scan(&out).Error
	return out, err
}
