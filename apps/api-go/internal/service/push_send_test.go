package service

import (
	"context"
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakePushMemberRepo struct {
	byID      map[int]*model.Member
	tokenList []model.Member
	getErr    error
}

func (f *fakePushMemberRepo) GetByID(idx int) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byID[idx], nil
}
func (f *fakePushMemberRepo) GetTokenList() ([]model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.tokenList, nil
}

type fakePushLogWriter struct {
	created []*model.PushLog
	err     error
}

func (f *fakePushLogWriter) Create(p *model.PushLog) error {
	if f.err != nil {
		return f.err
	}
	f.created = append(f.created, p)
	return nil
}

type fakePushSender struct {
	available bool
	err       error
	sent      int
}

func (f *fakePushSender) Send(ctx context.Context, msg fcm.Message) (string, error) {
	f.sent++
	return "msg-id", f.err
}
func (f *fakePushSender) Available() bool { return f.available }

func memberWithToken(idx int, token string) *model.Member {
	return &model.Member{MtIdx: idx, MtTokenID: pStr(token)}
}

func TestPushSendNotFound(t *testing.T) {
	svc := NewPushSend(&fakePushMemberRepo{byID: map[int]*model.Member{}}, &fakePushLogWriter{}, &fakePushSender{available: true})
	r := svc.SendOne(FCMSendInput{MtIdx: 999, PltTitle: "t", PltContent: "c"})
	if r.Success != "false" || r.Title != "푸시발송(단건) 실패" || r.Message != "존재하지 않는 회원입니다." {
		t.Fatalf("not-found 오류: %+v", r)
	}
}

func TestPushSendNoToken(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: {MtIdx: 30, MtTokenID: pStr("")}}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true}).SendOne(FCMSendInput{MtIdx: 30, PltTitle: "t", PltContent: "c"})
	if r.Success != "false" || r.Message != "앱토큰이 존재하지 않습니다." {
		t.Fatalf("no-token 오류: %+v", r)
	}
}

func TestPushSendFirebaseUnavailable(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: false}).SendOne(FCMSendInput{MtIdx: 30, PltTitle: "t", PltContent: "c"})
	if r.Success != "false" || r.Message != "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요." {
		t.Fatalf("firebase-unavailable 오류: %+v", r)
	}
}

func TestPushSendSuccess(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true}).SendOne(FCMSendInput{
		PltType: "test", SstIdx: "0", PltCondition: "0", PltMemo: "m", MtIdx: 30, PltTitle: "t", PltContent: "c",
	})
	if r.Success != "true" || r.Title != "푸시발송(단건) 성공" || r.Message != "푸시발송(단건) 성공 및 이력이 저장되었습니다." {
		t.Fatalf("성공 오류: %+v", r)
	}
	if len(logs.created) != 1 {
		t.Fatalf("push_log 미저장: %d", len(logs.created))
	}
	p := logs.created[0]
	if *p.MtIdx != 30 || *p.PltStatus != 2 || *p.PltReadChk != "N" || *p.PltShow != "Y" {
		t.Fatalf("push_log 필드 오류: %+v", p)
	}
}

func TestPushSendGenericNetworkError(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true, err: errors.New("network unreachable")}).
		SendOne(FCMSendInput{MtIdx: 30, PltTitle: "t", PltContent: "c"})
	if r.Success != "false" || r.Message != "푸시 메시지 전송에 실패했습니다. 네트워크 연결을 확인해주세요." {
		t.Fatalf("generic network 오류: %+v", r)
	}
}

func TestPushSendGenericPlainError(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true, err: errors.New("internal")}).
		SendOne(FCMSendInput{MtIdx: 30, PltTitle: "t", PltContent: "c"})
	if r.Success != "false" || r.Message != "푸시 메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요." {
		t.Fatalf("generic plain 오류: %+v", r)
	}
}

func TestPushSendAllUsers(t *testing.T) {
	mem := &fakePushMemberRepo{tokenList: []model.Member{memberWithTokenV(1, "a"), memberWithTokenV(2, "b:ios")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true}).SendOne(FCMSendInput{
		PltType: "admin", SstIdx: "0", PltCondition: "0", PltMemo: "m", MtIdx: 0, PltTitle: "t", PltContent: "c",
	})
	if r.Success != "true" || r.Title != "전체 발송 성공" || r.Message != "총 2명 중 2명에게 푸시를 발송했습니다." {
		t.Fatalf("전체발송 오류: %+v", r)
	}
	if len(logs.created) != 1 || *logs.created[0].MtIdx != 0 || *logs.created[0].PltType != 1 {
		t.Fatalf("전체발송 로그 오류(plt_type admin→1, mt_idx 0): %+v", logs.created)
	}
}

func memberWithTokenV(idx int, token string) model.Member {
	return model.Member{MtIdx: idx, MtTokenID: pStr(token)}
}

func TestPushTypeToInt(t *testing.T) {
	cases := map[string]int{"admin": 1, "5": 5, "0": 0, "test": 0, "": 0}
	for in, want := range cases {
		if got := pushTypeToInt(in); got != want {
			t.Errorf("pushTypeToInt(%q)=%d, want %d", in, got, want)
		}
	}
}
