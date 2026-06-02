package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeFCMTokenRepo struct {
	byID       map[int]*model.Member
	lastFields map[string]interface{}
	updateErr  error
}

func (f *fakeFCMTokenRepo) GetByID(idx int) (*model.Member, error) { return f.byID[idx], nil }
func (f *fakeFCMTokenRepo) UpdateColumns(idx int, fields map[string]interface{}) error {
	f.lastFields = fields
	return f.updateErr
}

func TestFCMTokenStatusHasToken(t *testing.T) {
	m := &model.Member{MtIdx: 1186, MtTokenID: pStr("d4VmvnfJFkyikLRrgyvdABCDEFGH")}
	r := NewFCMToken(&fakeFCMTokenRepo{}).Status(m)
	if r.ResultCode != 200 || r.ResultMsg != "FCM 토큰 상태 조회 성공" {
		t.Fatalf("status 오류: %+v", r)
	}
	d := r.ResultData.(dto.FCMTokenStatusData)
	if !d.HasToken || d.TokenPreview == nil || *d.TokenPreview != "d4VmvnfJFkyikLRrgyvd..." {
		t.Fatalf("status data 오류: %+v", d)
	}
}

func TestFCMTokenStatusNoToken(t *testing.T) {
	m := &model.Member{MtIdx: 1186, MtTokenID: nil}
	d := NewFCMToken(&fakeFCMTokenRepo{}).Status(m).ResultData.(dto.FCMTokenStatusData)
	if d.HasToken || d.TokenPreview != nil {
		t.Fatalf("no-token status 오류: %+v", d)
	}
}

func TestFCMTokenUpdateChanged(t *testing.T) {
	m := &model.Member{MtIdx: 1186, MtTokenID: pStr("oldtoken")}
	repo := &fakeFCMTokenRepo{}
	r, ok := NewFCMToken(repo).Update(m, "newtoken")
	if !ok {
		t.Fatal("update ok 기대")
	}
	d := r.ResultData.(dto.FCMTokenUpdateData)
	if !d.TokenUpdated || !d.TokenChanged || !d.SilentPushSent {
		t.Fatalf("update changed 오류(old 존재→silent_push_sent true): %+v", d)
	}
	if repo.lastFields["mt_token_id"] != "newtoken" {
		t.Fatalf("mt_token_id 갱신 누락: %v", repo.lastFields)
	}
}

func TestFCMTokenUpdateUnchanged(t *testing.T) {
	m := &model.Member{MtIdx: 1186, MtTokenID: pStr("same")}
	d := mustUpdate(t, m, "same")
	if d.TokenChanged || d.SilentPushSent {
		t.Fatalf("same-token: changed/silent false 기대: %+v", d)
	}
}

func TestFCMTokenUpdateNoOldToken(t *testing.T) {
	m := &model.Member{MtIdx: 1186, MtTokenID: nil}
	d := mustUpdate(t, m, "newtoken")
	// old_token is None → silent_push_sent=false(token_changed=true지만 old None).
	if !d.TokenChanged || d.SilentPushSent {
		t.Fatalf("no-old-token: changed=true·silent=false 기대: %+v", d)
	}
}

func mustUpdate(t *testing.T, m *model.Member, tok string) dto.FCMTokenUpdateData {
	r, ok := NewFCMToken(&fakeFCMTokenRepo{}).Update(m, tok)
	if !ok {
		t.Fatal("update ok 기대")
	}
	return r.ResultData.(dto.FCMTokenUpdateData)
}
