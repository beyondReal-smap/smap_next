package service

import (
	"context"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// mt_id 가 이메일과 같은 상태 미지정(NULL) 예전 행이 있어도, 같은 이메일의 유일한 활성 행으로 로그인한다.
func TestG4LoginPrefersSoleActiveEmailRowOverStaleMtID(t *testing.T) {
	e := newG4(AuthPolicy{})
	staleHash, _ := auth.HashPassword("OldPassw0rd!", 4)
	liveHash, _ := auth.HashPassword("Passw0rd!x", 4)
	lvl, st, show := 5, 1, "Y"
	stale := model.Member{MtIdx: 2344, MtPwd: &staleHash, MtShow: &show}
	live := model.Member{MtIdx: 1186, MtPwd: &liveHash, MtLevel: &lvl, MtStatus: &st, MtShow: &show}
	e.mem.byMtID = map[string]*model.Member{"owner@example.com": &stale}
	e.mem.dupEmail = map[string][]model.Member{"owner@example.com": {live, stale}}
	e.mem.byID = map[int]*model.Member{1186: &live, 2344: &stale}

	resp, rej := e.svc.Login(context.Background(), LoginInput{MtID: "owner@example.com", MtPwd: "Passw0rd!x"}, g4Meta)
	if rej != nil || !resp.Success {
		t.Fatalf("활성 행 로그인 실패: %+v %+v", resp, rej)
	}

	// 활성 행이 둘이면 고르지 않고, mt_id 로 잡힌 행 그대로 비밀번호를 대조한다(기존 동작).
	e2 := newG4(AuthPolicy{})
	e2.mem.byMtID = map[string]*model.Member{"owner@example.com": &stale}
	e2.mem.dupEmail = map[string][]model.Member{"owner@example.com": {live, live}}
	e2.mem.byID = map[int]*model.Member{1186: &live, 2344: &stale}
	if r, _ := e2.svc.Login(context.Background(), LoginInput{MtID: "owner@example.com", MtPwd: "Passw0rd!x"}, g4Meta); r.Success {
		t.Errorf("활성 행이 둘이면 임의로 고르면 안 된다: %+v", r)
	}
}
