package model

import "time"

// MemberLocationLog는 Python `app/models/member_location_log.py`의 모델(테이블 member_location_log_t)과
// 대응한다. mlt_lat/long/stay_lat/stay_long은 DECIMAL이지만 to_dict가 float()로 변환하므로
// *float64로 읽는다(Decimal 문자열 아님). mlt_accuacy/mlt_speed는 Float, mlt_battery는 SmallInt.
type MemberLocationLog struct {
	MltIdx          int        `gorm:"column:mlt_idx;primaryKey;autoIncrement"`
	MtIdx           int        `gorm:"column:mt_idx"`
	MltLat          *float64   `gorm:"column:mlt_lat"`
	MltLong         *float64   `gorm:"column:mlt_long"`
	MltAccuacy      *float64   `gorm:"column:mlt_accuacy"` // 오타 컬럼명(원본 그대로)
	MltSpeed        *float64   `gorm:"column:mlt_speed"`
	MltBattery      *int       `gorm:"column:mlt_battery"`
	MltFineLocation *string    `gorm:"column:mlt_fine_location"`
	MltLocationChk  *string    `gorm:"column:mlt_location_chk"`
	MtHealthWork    *int       `gorm:"column:mt_health_work"`
	MltGpsTime      *time.Time `gorm:"column:mlt_gps_time"`
	MltWdate        *time.Time `gorm:"column:mlt_wdate"`
	StayLat         *float64   `gorm:"column:stay_lat"`
	StayLong        *float64   `gorm:"column:stay_long"`
}

// TableName은 GORM 기본 복수화를 막고 실제 테이블명을 고정한다.
func (MemberLocationLog) TableName() string { return "member_location_log_t" }

// LocationDailySummaryRow는 /daily-summary의 GROUP BY DATE 집계 한 행이다(조회 프로젝션).
type LocationDailySummaryRow struct {
	MltIdx    int       `gorm:"column:mlt_idx"`
	LogDate   time.Time `gorm:"column:log_date"`
	StartTime time.Time `gorm:"column:start_time"`
	EndTime   time.Time `gorm:"column:end_time"`
}

// MemberActivityRow는 /member-activity의 멤버별 활동(기본정보 + 로그수 + 첫/마지막 시각)이다.
type MemberActivityRow struct {
	MtIdx        int
	MtName       *string
	MtNickname   *string
	MtFile1      *string
	MtGender     *int
	LogCount     int
	FirstLogTime *time.Time
	LastLogTime  *time.Time
}

// LocationLogMemberBasic은 daily-counts(-simple)의 그룹멤버 기본정보(Member JOIN GroupDetail).
type LocationLogMemberBasic struct {
	MtIdx      int     `gorm:"column:mt_idx"`
	MtName     *string `gorm:"column:mt_name"`
	MtNickname *string `gorm:"column:mt_nickname"`
	MtFile1    *string `gorm:"column:mt_file1"`
	MtGender   *int    `gorm:"column:mt_gender"`
}

// DailyCountRow는 mt_idx/날짜별 위치로그 COUNT(DISTINCT mlt_idx) 한 행.
type DailyCountRow struct {
	MemberIdx int       `gorm:"column:member_idx"`
	LogDate   time.Time `gorm:"column:log_date"`
	Count     int       `gorm:"column:count"`
}

// StayTimeRow는 /stay-times CTE 최종 SELECT 한 행. start/end_time은 NULL 가능(*time.Time),
// duration/distance/start_lat/start_long은 DECIMAL(*float64, NULL/0 처리는 service에서).
type StayTimeRow struct {
	Label     string     `gorm:"column:label"`
	Grp       int64      `gorm:"column:grp"`
	StartTime *time.Time `gorm:"column:start_time"`
	EndTime   *time.Time `gorm:"column:end_time"`
	Duration  *float64   `gorm:"column:duration"`
	Distance  *float64   `gorm:"column:distance"`
	StartLat  *float64   `gorm:"column:start_lat"`
	StartLong *float64   `gorm:"column:start_long"`
}
