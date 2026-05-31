package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeGroupDetailRepo struct {
	one  *model.GroupDetail
	many []model.GroupDetail
	err  error
}

func (f *fakeGroupDetailRepo) List(skip, limit int) ([]model.GroupDetail, error) {
	return f.many, f.err
}
func (f *fakeGroupDetailRepo) GetByID(id int) (*model.GroupDetail, error) { return f.one, f.err }
func (f *fakeGroupDetailRepo) FindByMember(mtIdx int) ([]model.GroupDetail, error) {
	return f.many, f.err
}
func (f *fakeGroupDetailRepo) FindByGroup(sgtIdx int) ([]model.GroupDetail, error) {
	return f.many, f.err
}

// TestGroupDetailResponseJSON은 스키마-모델 불일치(7개 _chk 항상 null)를 포함한
// GroupDetailResponse 직렬화가 Python 실측 바이트와 동일한지 검증한다.
func TestGroupDetailResponseJSON(t *testing.T) {
	svc := NewGroupDetail(&fakeGroupDetailRepo{one: &model.GroupDetail{
		SgdtIdx: 2346, SgtIdx: pInt(112004), MtIdx: pInt(2584),
		SgdtOwnerChk: pStr("Y"), SgdtLeaderChk: pStr("N"),
		SgdtDischarge: pStr("N"), SgdtGroupChk: pStr("Y"), SgdtExit: pStr("N"),
		SgdtShow: pStr("Y"), SgdtPushChk: pStr("Y"),
		SgdtWdate: pTimePtr(time.Date(2026, 5, 17, 14, 33, 34, 0, time.Local)),
		SgdtUdate: pTimePtr(time.Date(2026, 5, 17, 14, 33, 34, 0, time.Local)),
	}})
	res, _ := svc.GetGroupDetail(2346)
	b, _ := json.Marshal(res)
	// Python 실측(/group-details/2346)
	want := `{"sgt_idx":112004,"mt_idx":2584,"sgdt_owner_chk":"Y","sgdt_leader_chk":"N","sgdt_discharge_chk":null,"sgdt_group_chk":"Y","sgdt_exit_chk":null,"sgdt_push_chk":"Y","sgdt_in_chk":null,"sgdt_schedule_chk":null,"sgdt_read_chk":null,"sgdt_enter_alarm":null,"sgdt_enter_chk":null,"sgdt_idx":2346,"sgdt_wdate":"2026-05-17T14:33:34","sgdt_udate":"2026-05-17T14:33:34"}`
	if string(b) != want {
		t.Errorf("JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMemberItemJSON은 수동 dict(/member) 직렬화가 Python 실측 바이트와 동일한지 검증한다.
func TestMemberItemJSON(t *testing.T) {
	svc := NewGroupDetail(&fakeGroupDetailRepo{many: []model.GroupDetail{{
		SgdtIdx: 2314, SgtIdx: pInt(111972), MtIdx: pInt(2584),
		SgdtOwnerChk: pStr("Y"), SgdtLeaderChk: pStr("N"),
		SgdtDischarge: pStr("N"), SgdtGroupChk: pStr("Y"), SgdtExit: pStr("N"),
		SgdtShow: pStr("Y"), SgdtPushChk: pStr("Y"),
		SgdtWdate: pTimePtr(time.Date(2026, 5, 17, 14, 33, 2, 0, time.Local)),
		SgdtUdate: pTimePtr(time.Date(2026, 5, 17, 14, 33, 2, 0, time.Local)),
		// ddate/xdate/adate nil → ""
	}}})
	res, _ := svc.MemberGroupDetails(2584)
	b, _ := json.Marshal(res)
	want := `[{"sgdt_idx":2314,"sgt_idx":111972,"mt_idx":2584,"sgdt_owner_chk":"Y","sgdt_leader_chk":"N","sgdt_discharge":"N","sgdt_group_chk":"Y","sgdt_exit":"N","sgdt_show":"Y","sgdt_push_chk":"Y","sgdt_wdate":"2026-05-17T14:33:02","sgdt_udate":"2026-05-17T14:33:02","sgdt_ddate":"","sgdt_xdate":"","sgdt_adate":""}]`
	if string(b) != want {
		t.Errorf("JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMemberItemFallback은 null enum→'N'/'Y' 폴백을 검증한다.
func TestMemberItemFallback(t *testing.T) {
	svc := NewGroupDetail(&fakeGroupDetailRepo{many: []model.GroupDetail{{
		SgdtIdx:   1, // 모든 chk nil → 폴백
		SgdtWdate: pTimePtr(time.Date(2025, 1, 1, 0, 0, 0, 0, time.Local)),
		SgdtUdate: pTimePtr(time.Date(2025, 1, 1, 0, 0, 0, 0, time.Local)),
	}}})
	res, _ := svc.MemberGroupDetails(1)
	it := res[0]
	if it.SgdtOwnerChk != "N" || it.SgdtLeaderChk != "N" || it.SgdtDischarge != "N" ||
		it.SgdtGroupChk != "Y" || it.SgdtExit != "N" || it.SgdtShow != "Y" || it.SgdtPushChk != "Y" {
		t.Errorf("폴백 불일치: %+v", it)
	}
	if it.SgdtDdate != "" || it.SgdtXdate != "" || it.SgdtAdate != "" {
		t.Errorf("ddate/xdate/adate는 빈 문자열이어야 함: %+v", it)
	}
}

func TestGroupDetailNotFoundAndErr(t *testing.T) {
	t.Run("없음 → (nil,nil)", func(t *testing.T) {
		svc := NewGroupDetail(&fakeGroupDetailRepo{one: nil})
		res, err := svc.GetGroupDetail(99)
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})
	t.Run("빈 목록 → []", func(t *testing.T) {
		svc := NewGroupDetail(&fakeGroupDetailRepo{many: nil})
		res, _ := svc.MemberGroupDetails(99)
		b, _ := json.Marshal(res)
		if string(b) != "[]" {
			t.Errorf("빈 목록 [] 기대: %s", b)
		}
	})
	t.Run("repo 에러 전파", func(t *testing.T) {
		svc := NewGroupDetail(&fakeGroupDetailRepo{err: errors.New("db down")})
		if _, err := svc.ListGroupDetails(0, 100); err == nil {
			t.Error("expected error")
		}
	})
}
