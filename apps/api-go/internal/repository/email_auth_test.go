package repository

import (
	"strings"
	"testing"
)

// 쿼리 조건만 검증한다(DryRun). 실행 결과 의미는 검증하지 못한다.

func TestEmailAuthFindByEmailQuery(t *testing.T) {
	db, cap := dryRunDB(t)
	_, _ = NewEmailAuth(db).FindByEmail("a@example.com")
	sql := cap.sql
	for _, want := range []string{"LOWER(TRIM(mt_email)) = ?", "mt_level IS NULL OR mt_level != 1"} {
		if !strings.Contains(sql, want) {
			t.Errorf("조건 누락 %q: %s", want, sql)
		}
	}
	if len(cap.vars) != 1 || cap.vars[0] != "a@example.com" {
		t.Errorf("바인딩 값: %v", cap.vars)
	}
}

func TestEmailAuthIdentifierTakenQuery(t *testing.T) {
	db, cap := dryRunDB(t)
	_, _ = NewEmailAuth(db).IdentifierTaken("a@example.com", 9)
	sql := cap.sql
	for _, want := range []string{"mt_idx != ?", "LOWER(TRIM(mt_email)) = ?", "LOWER(TRIM(mt_id)) = ?", "mt_level IS NULL OR mt_level != 1"} {
		if !strings.Contains(sql, want) {
			t.Errorf("조건 누락 %q: %s", want, sql)
		}
	}
	if len(cap.vars) != 3 || cap.vars[0] != 9 || cap.vars[1] != "a@example.com" || cap.vars[2] != "a@example.com" {
		t.Errorf("바인딩 값(파라미터 바인딩이어야 함): %v", cap.vars)
	}
}
