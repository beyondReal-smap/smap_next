package service

import (
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/repository"
)

type fakeAdminRepo struct {
	stats     repository.AdminStats
	statsErr  error
	groups    []repository.AdminGroupRow
	groupsErr error
}

func (f *fakeAdminRepo) Stats() (repository.AdminStats, error) {
	return f.stats, f.statsErr
}

func (f *fakeAdminRepo) Groups(offset, limit int, showHidden bool) ([]repository.AdminGroupRow, error) {
	return f.groups, f.groupsErr
}

func TestGetStats(t *testing.T) {
	t.Run("정상", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{stats: repository.AdminStats{
			TotalMembers: 100, TotalGroups: 20, TodaySignups: 3,
		}})
		resp, err := svc.GetStats()
		if err != nil || !resp.Success {
			t.Fatalf("err=%v success=%v", err, resp.Success)
		}
		if resp.Data.TotalMembers != 100 || resp.Data.TotalGroups != 20 ||
			resp.Data.TodaySignups != 3 || resp.Data.PendingInquiries != 0 {
			t.Errorf("data=%+v", resp.Data)
		}
	})

	t.Run("에러 전파", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{statsErr: errors.New("db")})
		_, err := svc.GetStats()
		if err == nil {
			t.Error("expected error")
		}
	})
}

func TestGetGroups(t *testing.T) {
	t.Run("owner_name 우선순위(mt_name > nickname > 사용자 id)", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{groups: []repository.AdminGroupRow{
			{SgtIdx: 1, MtName: pStr("이름"), MtNickname: pStr("닉"), MtIdx: pInt(10)},
			{SgtIdx: 2, MtNickname: pStr("닉만"), MtIdx: pInt(11)},
			{SgtIdx: 3, MtIdx: pInt(12)},
			{SgtIdx: 4}, // mt_idx NULL → "사용자 None"
		}})
		items, err := svc.GetGroups(0, 100, false)
		if err != nil || len(items) != 4 {
			t.Fatalf("err=%v len=%d", err, len(items))
		}
		if items[0].OwnerName != "이름" || items[1].OwnerName != "닉만" ||
			items[2].OwnerName != "사용자 12" || items[3].OwnerName != "사용자 None" {
			t.Errorf("owners: %q %q %q %q",
				items[0].OwnerName, items[1].OwnerName, items[2].OwnerName, items[3].OwnerName)
		}
	})

	t.Run("sgt 기본값(title/memo/code→'', show→'Y') + 날짜 nil", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{groups: []repository.AdminGroupRow{
			{SgtIdx: 1, MtName: pStr("x")},
		}})
		items, _ := svc.GetGroups(0, 100, false)
		it := items[0]
		if it.SgtTitle != "" || it.SgtMemo != "" || it.SgtCode != "" || it.SgtShow != "Y" {
			t.Errorf("defaults: %+v", it)
		}
		if it.SgtWdate != nil || it.SgtUdate != nil {
			t.Error("dates should be nil")
		}
	})

	t.Run("빈 결과 → 빈 슬라이스(non-nil)", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{groups: nil})
		items, err := svc.GetGroups(0, 100, false)
		if err != nil || items == nil || len(items) != 0 {
			t.Errorf("items=%v err=%v", items, err)
		}
	})

	t.Run("에러 전파", func(t *testing.T) {
		svc := NewAdmin(&fakeAdminRepo{groupsErr: errors.New("db")})
		_, err := svc.GetGroups(0, 100, false)
		if err == nil {
			t.Error("expected error")
		}
	})
}
