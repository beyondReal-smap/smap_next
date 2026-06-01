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
	for i := 0; i < len(mtIdxList); i += chunkSize {
		end := i + chunkSize
		if end > len(mtIdxList) {
			end = len(mtIdxList)
		}
		chunk := mtIdxList[i:end]

		// 서브쿼리: 각 회원별 최신 mlt_idx.
		sub := r.db.Model(&model.MemberLocationLog{}).
			Select("mt_idx, MAX(mlt_idx) AS max_idx").
			Where("mt_idx IN ?", chunk).
			Group("mt_idx")

		var rows []RecentLocation
		err := r.db.Model(&model.MemberLocationLog{}).
			Select("member_location_log_t.mt_idx, member_location_log_t.mlt_lat, "+
				"member_location_log_t.mlt_long, member_location_log_t.mlt_accuacy, "+
				"member_location_log_t.mlt_gps_time").
			Joins("JOIN (?) AS latest ON member_location_log_t.mlt_idx = latest.max_idx "+
				"AND member_location_log_t.mt_idx = latest.mt_idx", sub).
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
	counts := make([]model.DailyCountRow, 0)
	err = r.db.Raw(`SELECT mt_idx as member_idx, DATE(mlt_gps_time) as log_date, COUNT(DISTINCT mlt_idx) as count
		FROM member_location_log_t WHERE mt_idx IN (`+intsCSV(ids)+`)
		AND DATE(mlt_gps_time) BETWEEN ? AND ?
		GROUP BY mt_idx, DATE(mlt_gps_time) `+havingClause+`ORDER BY mt_idx, log_date DESC`,
		startStr, endStr).Scan(&counts).Error
	if err != nil {
		return nil, nil, err
	}
	return members, counts, nil
}

// MemberActivity는 Python get_member_activity_by_date의 3쿼리(그룹멤버 JOIN + COUNT + MIN/MAX)를
// 이식한다. dateStr(YYYY-MM-DD)로 DATE(mlt_gps_time)= 비교. 멤버 0명이면 빈 슬라이스.
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
	idsCSV := intsCSV(ids)

	type cntRow struct {
		MtIdx    int `gorm:"column:mt_idx"`
		LogCount int `gorm:"column:log_count"`
	}
	var cnts []cntRow
	if err := r.db.Raw(`SELECT mt_idx, COUNT(*) as log_count FROM member_location_log_t
		WHERE mt_idx IN (`+idsCSV+`) AND DATE(mlt_gps_time) = ? GROUP BY mt_idx`, dateStr).
		Scan(&cnts).Error; err != nil {
		return nil, err
	}
	cntMap := make(map[int]int, len(cnts))
	for _, c := range cnts {
		cntMap[c.MtIdx] = c.LogCount
	}

	type timeRow struct {
		MtIdx        int        `gorm:"column:mt_idx"`
		FirstLogTime *time.Time `gorm:"column:first_log_time"`
		LastLogTime  *time.Time `gorm:"column:last_log_time"`
	}
	var times []timeRow
	if err := r.db.Raw(`SELECT mt_idx, MIN(mlt_gps_time) as first_log_time, MAX(mlt_gps_time) as last_log_time
		FROM member_location_log_t WHERE mt_idx IN (`+idsCSV+`) AND DATE(mlt_gps_time) = ? GROUP BY mt_idx`, dateStr).
		Scan(&times).Error; err != nil {
		return nil, err
	}
	type ft struct{ first, last *time.Time }
	timeMap := make(map[int]ft, len(times))
	for _, t := range times {
		timeMap[t.MtIdx] = ft{t.FirstLogTime, t.LastLogTime}
	}

	for _, b := range basics {
		t := timeMap[b.MtIdx]
		out = append(out, model.MemberActivityRow{
			MtIdx: b.MtIdx, MtName: b.MtName, MtNickname: b.MtNickname,
			MtFile1: b.MtFile1, MtGender: b.MtGender,
			LogCount: cntMap[b.MtIdx], FirstLogTime: t.first, LastLogTime: t.last,
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

// gpsDistanceSQL: PHP get_gps_distance 기반 CTE. 파라미터 순서
// mt_idx, date_start, date_end, max_accuracy, min_speed(CASE), min_speed(BETWEEN), max_speed.
const gpsDistanceSQL = `WITH RankedLogs AS (
			SELECT mt_idx, mlt_accuacy, mlt_speed, mlt_lat, mlt_long, mlt_gps_time,
				ROW_NUMBER() OVER (ORDER BY mlt_gps_time ASC) AS rn
			FROM member_location_log_t
			WHERE 1=1 AND mt_idx = ? AND mlt_gps_time BETWEEN ? AND ?
				AND mlt_speed > 0 AND mlt_accuacy < ?
		),
		Diffs AS (
			SELECT L1.rn, L1.mlt_lat AS lat1, L1.mlt_long AS long1, L2.mlt_lat AS lat2, L2.mlt_long AS long2,
				L1.mlt_gps_time AS wdate1, L2.mlt_gps_time AS wdate2, L1.mlt_speed AS speed, L1.mlt_accuacy AS accuracy,
				TIMESTAMPDIFF(SECOND, L1.mlt_gps_time, L2.mlt_gps_time) AS time_diff_seconds
			FROM RankedLogs L1 INNER JOIN RankedLogs L2 ON L1.rn = L2.rn - 1
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
			SELECT rn, lat1, long1, lat2, long2, wdate1, wdate2, speed, accuracy, time_diff_seconds,
				ROUND(6371000 * ACOS(COS(RADIANS(lat2)) * COS(RADIANS(lat1)) * COS(RADIANS(long1) - RADIANS(long2)) + SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))), 1) AS distance_meters
			FROM Diffs
		) rslt
		WHERE ROUND((rslt.distance_meters / rslt.time_diff_seconds) * 3600 / 1000, 1) BETWEEN ? AND ?`

// gpsStepsSQL: 해당 날짜 마지막 걸음수. 파라미터 mt_idx, date_start, date_end. (mlt_wdate 필터에 주의)
const gpsStepsSQL = `SELECT mt_health_work
		FROM member_location_log_t
		WHERE mt_idx = ? AND mlt_wdate BETWEEN ? AND ?
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
