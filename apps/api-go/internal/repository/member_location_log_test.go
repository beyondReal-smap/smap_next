package repository

import (
	"strings"
	"testing"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// dryRunInsertDB는 DB에 접속하지 않고 SQL만 생성하는 gorm 세션을 만든다.
func dryRunInsertDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(mysql.New(mysql.Config{
		DSN:                       "u:p@tcp(127.0.0.1:1)/x?parseTime=true&loc=Local",
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, SkipDefaultTransaction: true})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return db
}

func TestFillWdate(t *testing.T) {
	now := time.Date(2026, 11, 19, 13, 0, 0, 0, time.Local)

	empty := &model.MemberLocationLog{}
	fillWdate(empty, now)
	if empty.MltWdate == nil || !empty.MltWdate.Equal(now) {
		t.Fatalf("mlt_wdate가 비어 있으면 now로 채워야 한다: got %v", empty.MltWdate)
	}

	given := now.Add(-time.Hour)
	preset := &model.MemberLocationLog{MltWdate: &given}
	fillWdate(preset, now)
	if !preset.MltWdate.Equal(given) {
		t.Fatalf("이미 있는 mlt_wdate는 유지해야 한다: got %v", preset.MltWdate)
	}
}

// 배치 저장이 건별 INSERT가 아니라 다중행 INSERT 1문장이며, mlt_wdate 값을 함께 쓰는지 확인한다.
func TestBatchInsertIsSingleMultiRowStatementWithWdate(t *testing.T) {
	now := time.Date(2026, 11, 19, 13, 0, 0, 0, time.Local)
	lat, lng := 37.5, 127.0
	logs := make([]*model.MemberLocationLog, 3)
	for i := range logs {
		gt := now.Add(time.Duration(i) * time.Second)
		logs[i] = &model.MemberLocationLog{MtIdx: 1, MltLat: &lat, MltLong: &lng, MltGpsTime: &gt}
		fillWdate(logs[i], now)
	}

	// CreateInBatches는 하위 세션에서 SQL을 만들어 반환 Statement에 남지 않는다.
	// 배치 크기(500) 이하면 슬라이스 전체를 Create 1회로 처리하므로 같은 문장을 Create로 확인한다.
	res := dryRunInsertDB(t).Create(logs)
	if res.Error != nil {
		t.Fatalf("dry-run create: %v", res.Error)
	}
	stmt := res.Statement
	sql := stmt.SQL.String()
	if n := strings.Count(sql, "INSERT INTO"); n != 1 {
		t.Fatalf("INSERT 문은 1개여야 한다: got %d\n%s", n, sql)
	}
	if !strings.Contains(sql, "`mlt_wdate`") {
		t.Fatalf("INSERT 컬럼에 mlt_wdate가 있어야 한다:\n%s", sql)
	}
	if n := strings.Count(sql, "),("); n != len(logs)-1 {
		t.Fatalf("VALUES 행은 %d개여야 한다: got %d\n%s", len(logs), n+1, sql)
	}
	var wdates int
	for _, v := range stmt.Vars {
		if p, ok := v.(*time.Time); ok && p != nil && p.Equal(now) {
			wdates++
		}
	}
	// 행마다 mlt_wdate=now 1개(+ 첫 행은 mlt_gps_time도 now라 1개 더)
	if wdates < len(logs) {
		t.Fatalf("행마다 mlt_wdate=now가 바인딩돼야 한다: got %d", wdates)
	}
}

func TestNextDayYMD(t *testing.T) {
	cases := map[string]string{
		"2026-11-19": "2026-11-20",
		"2026-11-30": "2026-12-01",
		"2026-12-31": "2027-01-01",
		"2028-02-28": "2028-02-29",
	}
	for in, want := range cases {
		got, err := nextDayYMD(in)
		if err != nil || got != want {
			t.Fatalf("nextDayYMD(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	if _, err := nextDayYMD("2026/11/19"); err == nil {
		t.Fatal("잘못된 형식은 에러여야 한다")
	}
}
