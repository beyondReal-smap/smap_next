package repository

import (
	"strings"
	"testing"

	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// dryRunDB는 실제 DB 접속 없이 GORM이 만드는 SQL과 바인딩 값을 캡처한다.
// (go.mod에 sqlite/sqlmock 드라이버가 없고 새 의존성 추가가 금지라, MySQL 방언의 DryRun으로
// "쿼리 조건"이 의도대로 생성되는지만 검증한다. 실행 결과 의미까지는 검증하지 못한다.)
func dryRunDB(t *testing.T) (*gorm.DB, *capturedQuery) {
	t.Helper()
	db, err := gorm.Open(gormmysql.New(gormmysql.Config{
		DSN:                       "user:pass@tcp(127.0.0.1:1)/none?parseTime=true",
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, Logger: logger.Discard})
	if err != nil {
		t.Fatalf("dry-run DB 생성 실패: %v", err)
	}
	cap := &capturedQuery{}
	if err := db.Callback().Query().After("gorm:query").Register("capture_sql", func(tx *gorm.DB) {
		cap.sql = tx.Statement.SQL.String()
		cap.vars = append([]interface{}(nil), tx.Statement.Vars...)
	}); err != nil {
		t.Fatal(err)
	}
	return db, cap
}

type capturedQuery struct {
	sql  string
	vars []interface{}
}

func TestGetAccessStateQuery(t *testing.T) {
	db, cap := dryRunDB(t)
	st, err := NewMember(db).GetAccessState(1186)
	if err != nil || st != nil {
		t.Fatalf("DryRun에서는 행이 없어 (nil,nil)이어야 함: %v %v", st, err)
	}
	sql := cap.sql
	for _, want := range []string{"`mt_level`", "`mt_status`", "`mt_show`", "FROM `member_t`", "mt_idx = ?", "LIMIT ?"} {
		if !strings.Contains(sql, want) {
			t.Errorf("SQL에 %q 가 없음: %s", want, sql)
		}
	}
	// 필요한 3개 컬럼만 읽는다(비밀번호 해시 등 전체 행을 읽지 않음).
	if strings.Contains(sql, "*") || strings.Contains(sql, "mt_pwd") {
		t.Errorf("상태 조회는 전체 컬럼을 읽으면 안 됨: %s", sql)
	}
	if len(cap.vars) != 2 || cap.vars[0] != 1186 || cap.vars[1] != 1 {
		t.Errorf("바인딩 값은 [mt_idx, LIMIT 1]이어야 함: %v", cap.vars)
	}
}
