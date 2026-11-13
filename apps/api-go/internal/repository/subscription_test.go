package repository

import (
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
)

func TestClassifySubscriptionErr(t *testing.T) {
	cases := map[uint16]error{1062: ErrDuplicateKey, 1146: ErrSubscriptionTableMissing, 1213: ErrRetryableTx, 1205: ErrRetryableTx}
	for n, want := range cases {
		if got := classifySubscriptionErr(&mysql.MySQLError{Number: n}); got != want {
			t.Errorf("%d -> %v", n, got)
		}
	}
	other := &mysql.MySQLError{Number: 1045}
	if classifySubscriptionErr(other) != error(other) {
		t.Error("알 수 없는 오류는 그대로")
	}
}

// DSN loc=Local 에서 UTC 벽시계가 그대로 저장되도록 감싸고 풀 때 같은 값이 나온다.
func TestDBWallRoundTrip(t *testing.T) {
	u := time.Date(2027, 11, 13, 3, 0, 5, 0, time.UTC)
	w := dbWall(u)
	if w.Location() != time.Local || w.Hour() != 3 || w.Minute() != 0 {
		t.Fatalf("벽시계 보존 실패 %v", w)
	}
	if !fromDBWall(w).Equal(u) {
		t.Fatal("왕복 불일치")
	}
}

func TestSubscriptionSQLConditions(t *testing.T) {
	db, c := policyDB(t)
	r := NewSubscription(db)
	_, _ = r.CountVisiblePlaces(nil, 7)
	if !strings.Contains(c.sql, "slt_show = 'Y'") || !strings.Contains(c.sql, "mt_idx") {
		t.Fatalf("장소 수 SQL: %s", c.sql)
	}
	_, _ = r.SyncMemberLevel(nil, 7, 2)
	if !strings.Contains(c.sql, "mt_level IN (2, 5)") {
		t.Fatalf("등급 보정은 2/5만 대상: %s", c.sql)
	}
	_, _ = r.ExpireLapsed(nil, time.Now())
	if !strings.Contains(c.sql, "mt_level = 5") || !strings.Contains(c.sql, "mt_plan_date <=") {
		t.Fatalf("만료 보정 SQL: %s", c.sql)
	}
}
