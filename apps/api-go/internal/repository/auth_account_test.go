package repository

import (
	"errors"
	"strings"
	"testing"
)

func TestFindActiveByEmailQuery(t *testing.T) {
	db, cap := dryRunDB(t)
	_, _ = NewMember(db).FindActiveByEmail(" A@Example.com ")
	for _, want := range []string{"LOWER(TRIM(mt_email)) = ?", "mt_level IS NULL OR mt_level != 1", "LIMIT"} {
		if !strings.Contains(cap.sql, want) {
			t.Errorf("조건 누락 %q: %s", want, cap.sql)
		}
	}
	if len(cap.vars) == 0 || cap.vars[0] != "a@example.com" {
		t.Errorf("정규화된 바인딩 값이어야 함: %v", cap.vars)
	}
}

func TestRegisterConflictErrorIs(t *testing.T) {
	var err error = &RegisterConflictError{Field: "email"}
	if !errors.Is(err, ErrRegisterConflict) {
		t.Error("RegisterConflictError는 ErrRegisterConflict와 매칭돼야 함")
	}
}
