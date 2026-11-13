package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- push_log write ---

func TestCreatePushLogFakeResponse(t *testing.T) {
	svc := NewPushLog(&fakePushLogRepo{})
	memo := "API3_FCM_service"
	mt := 1186
	r, ok := svc.CreatePushLog(PushLogWriteInput{PltMemo: &memo, MtIdx: &mt})
	if !ok || r == nil {
		t.Fatalf("fake-response ok=%v", ok)
	}
	if r.PltIdx != 0 || r.MtIdx == nil || *r.MtIdx != 1186 || r.PltWdate == nil || r.PltRdate != nil {
		t.Fatalf("fake-response 필드 오류: %+v", r)
	}
}

func TestCreatePushLogSystemAuto(t *testing.T) {
	svc := NewPushLog(&fakePushLogRepo{})
	cond := "system_auto"
	r, ok := svc.CreatePushLog(PushLogWriteInput{PltCondition: &cond})
	if !ok || r.PltIdx != 0 || r.PltWdate == nil {
		t.Fatalf("system_auto fake-response 오류: %+v", r)
	}
}

func TestCreatePushLogReal(t *testing.T) {
	saved := &model.PushLog{PltIdx: 555, PltType: pInt(5), MtIdx: pInt(1186), PltReadChk: pStr("N"), PltShow: pStr("Y")}
	svc := NewPushLog(&fakePushLogRepo{one: saved})
	title := "hello"
	r, ok := svc.CreatePushLog(PushLogWriteInput{PltTitle: &title, MtIdx: pInt(1186)})
	if !ok || r.PltIdx != 555 {
		t.Fatalf("real create 오류: ok=%v %+v", ok, r)
	}
}

func TestUpdatePushLogNotFound(t *testing.T) {
	svc := NewPushLog(&fakePushLogRepo{one: nil})
	_, found, ok := svc.UpdatePushLog(999, map[string]interface{}{"plt_title": "x"})
	if found || !ok {
		t.Fatalf("update not-found: found=%v ok=%v", found, ok)
	}
}

func TestDeletePushLogNotFoundAndFound(t *testing.T) {
	nf, ok := NewPushLog(&fakePushLogRepo{one: nil}).DeletePushLog(999)
	if nf || !ok {
		t.Fatalf("delete not-found: found=%v ok=%v", nf, ok)
	}
	f, ok2 := NewPushLog(&fakePushLogRepo{one: &model.PushLog{PltIdx: 1}}).DeletePushLog(1)
	if !f || !ok2 {
		t.Fatalf("delete found: found=%v ok=%v", f, ok2)
	}
}

func TestMarkReadFound(t *testing.T) {
	f, ok := NewPushLog(&fakePushLogRepo{one: &model.PushLog{PltIdx: 1}}).MarkPushLogRead(1)
	if !f || !ok {
		t.Fatalf("mark-read found: %v %v", f, ok)
	}
}

func TestDeleteAllReadAll(t *testing.T) {
	if !NewPushLog(&fakePushLogRepo{}).DeleteAllPushLogs(1186) {
		t.Fatal("delete-all ok 기대")
	}
	if !NewPushLog(&fakePushLogRepo{}).ReadAllPushLogs(1186) {
		t.Fatal("read-all ok 기대")
	}
}

// --- push_fcm write ---

func TestCreatePushFCMReal(t *testing.T) {
	saved := &model.PushFCM{PftIdx: 77, PftTitle: pStr("t")}
	r, ok := NewPushFCM(&fakePushFCMRepo{one: saved}).CreatePushFCM(PushFCMWriteInput{PftTitle: pStr("t")})
	if !ok || r.PftIdx != 77 {
		t.Fatalf("push_fcm create 오류: %v %+v", ok, r)
	}
}

func TestUpdatePushFCMNotFound(t *testing.T) {
	_, found, ok := NewPushFCM(&fakePushFCMRepo{one: nil}).UpdatePushFCM(999, map[string]interface{}{"pft_title": "x"})
	if found || !ok {
		t.Fatalf("push_fcm update not-found: %v %v", found, ok)
	}
}

func TestMarkDeliveredNoOp(t *testing.T) {
	nf, ok := NewPushFCM(&fakePushFCMRepo{one: nil}).MarkDelivered(999)
	if nf || !ok {
		t.Fatalf("mark-delivered not-found: %v %v", nf, ok)
	}
	f, ok2 := NewPushFCM(&fakePushFCMRepo{one: &model.PushFCM{PftIdx: 1}}).MarkDelivered(1)
	if !f || !ok2 {
		t.Fatalf("mark-delivered found(no-op): %v %v", f, ok2)
	}
}

func TestDeletePushFCMFound(t *testing.T) {
	f, ok := NewPushFCM(&fakePushFCMRepo{one: &model.PushFCM{PftIdx: 1}}).DeletePushFCM(1)
	if !f || !ok {
		t.Fatalf("push_fcm delete found: %v %v", f, ok)
	}
}
