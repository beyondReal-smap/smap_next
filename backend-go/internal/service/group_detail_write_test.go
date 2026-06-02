package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

func TestUpdateGroupDetailNotFound(t *testing.T) {
	svc := NewGroupDetail(&fakeGroupDetailRepo{one: nil})
	_, found, ok := svc.UpdateGroupDetail(999, map[string]interface{}{"sgdt_push_chk": "Y"})
	if found || !ok {
		t.Fatalf("update not-found: found=%v ok=%v", found, ok)
	}
}

func TestUpdateRoleFound(t *testing.T) {
	gd := &model.GroupDetail{SgdtIdx: 5, SgdtLeaderChk: pStr("N")}
	svc := NewGroupDetail(&fakeGroupDetailRepo{one: gd})
	resp, found, ok := svc.UpdateRole(5, "Y")
	if !found || !ok {
		t.Fatalf("role found=%v ok=%v", found, ok)
	}
	if resp.Message != "멤버 역할이 성공적으로 변경되었습니다." {
		t.Fatalf("role 메시지 오류: %+v", resp)
	}
	d, isData := resp.Data.(dto.GroupDetailRoleData)
	if !isData || d.SgdtIdx != 5 {
		t.Fatalf("role data 오류: %T %+v", resp.Data, resp.Data)
	}
}

func TestRemoveMemberFound(t *testing.T) {
	gd := &model.GroupDetail{SgdtIdx: 5}
	resp, found, ok := NewGroupDetail(&fakeGroupDetailRepo{one: gd}).RemoveMember(5)
	if !found || !ok || resp.Message != "멤버가 그룹에서 탈퇴되었습니다." {
		t.Fatalf("remove 오류: found=%v ok=%v %+v", found, ok, resp)
	}
}

func TestDeleteGroupDetailFoundAndNotFound(t *testing.T) {
	f, ok := NewGroupDetail(&fakeGroupDetailRepo{one: &model.GroupDetail{SgdtIdx: 5}}).DeleteGroupDetail(5)
	if !f || !ok {
		t.Fatalf("delete found: %v %v", f, ok)
	}
	nf, ok2 := NewGroupDetail(&fakeGroupDetailRepo{one: nil}).DeleteGroupDetail(999)
	if nf || !ok2 {
		t.Fatalf("delete not-found: %v %v", nf, ok2)
	}
}
