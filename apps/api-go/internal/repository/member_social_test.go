package repository

import (
	"strings"
	"testing"
)

// ExistsActiveByEmail은 탈퇴(mt_level=1)를 제외하고 정규화한 이메일로 조회한다.
func TestExistsActiveByEmailQuery(t *testing.T) {
	db, cap := dryRunDB(t)
	if _, err := NewMember(db).ExistsActiveByEmail("a@x.com"); err != nil {
		t.Fatal(err)
	}
	sql := cap.sql
	for _, want := range []string{"FROM `member_t`", "LOWER(TRIM(mt_email)) = ?", "mt_level IS NULL OR mt_level <> 1"} {
		if !strings.Contains(sql, want) {
			t.Errorf("SQL에 %q 가 없음: %s", want, sql)
		}
	}
	if len(cap.vars) == 0 || cap.vars[0] != "a@x.com" {
		t.Errorf("이메일은 바인딩이어야 함: %v", cap.vars)
	}
}
