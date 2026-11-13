package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

func TestTestEcho(t *testing.T) {
	svc := NewPushSend(&fakePushMemberRepo{}, &fakePushLogWriter{}, &fakePushSender{available: true})
	echo := dto.FCMTestEchoData{PltType: "5", SstIdx: "7", MtIdx: 1186, PltTitle: "t", PltContent: "c"}
	r := svc.TestEcho(echo)
	if r.Success != "true" || r.Title != "푸시발송(단건) 성공" || r.Message != "푸시발송(단건) 성공했습니다." {
		t.Fatalf("test echo 오류: %+v", r)
	}
	d, ok := r.Data.(dto.FCMTestEchoData)
	if !ok || d.MtIdx != 1186 || d.PltType != "5" {
		t.Fatalf("echo data 오류: %T %+v", r.Data, r.Data)
	}
}

func TestTestSendNotFound(t *testing.T) {
	r := NewPushSend(&fakePushMemberRepo{byID: map[int]*model.Member{}}, &fakePushLogWriter{}, &fakePushSender{available: true}).TestSendToUser(999)
	if r.Success != "false" || r.Title != "테스트 푸시 실패" || r.Message != "존재하지 않는 회원입니다." {
		t.Fatalf("test-send not-found 오류: %+v", r)
	}
}

func TestTestSendNoToken(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: {MtIdx: 30, MtTokenID: pStr("")}}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true}).TestSendToUser(30)
	if r.Success != "false" || r.Message != "FCM 토큰이 등록되지 않았습니다." {
		t.Fatalf("test-send no-token 오류: %+v", r)
	}
}

func TestTestSendSuccess(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true}).TestSendToUser(30)
	if r.Success != "true" || r.Title != "테스트 푸시 전송 성공" || !strings.HasPrefix(r.Message, "테스트 푸시가 성공적으로 전송되었습니다. (응답: ") {
		t.Fatalf("test-send 성공 오류: %+v", r)
	}
}

func TestSilentNotFoundNoToken(t *testing.T) {
	r := NewPushSend(&fakePushMemberRepo{byID: map[int]*model.Member{}}, &fakePushLogWriter{}, &fakePushSender{available: true}).SendSilent(999, "token_refresh")
	if r.Success != "false" || r.Title != "Silent 푸시발송 실패" || r.Message != "존재하지 않는 회원입니다." {
		t.Fatalf("silent not-found 오류: %+v", r)
	}
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: {MtIdx: 30, MtTokenID: pStr("")}}}
	r2 := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true}).SendSilent(30, "token_refresh")
	if r2.Message != "앱토큰이 존재하지 않습니다." {
		t.Fatalf("silent no-token 오류: %+v", r2)
	}
}

func TestSilentSuccess(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true}).SendSilent(30, "token_refresh")
	if r.Success != "true" || r.Title != "Silent 푸시발송 성공" || r.Message != "Silent 푸시발송 성공했습니다." {
		t.Fatalf("silent 성공 오류: %+v", r)
	}
	if len(logs.created) != 0 {
		t.Fatalf("silent은 push_log를 기록하면 안 됨: %d", len(logs.created))
	}
}

func TestSilentGenericError(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true, err: errors.New("boom")}).SendSilent(30, "x")
	if r.Success != "false" || r.Title != "Silent 푸시발송 실패" || r.Message != "Firebase 전송 실패: boom" {
		t.Fatalf("silent generic 오류: %+v", r)
	}
}

func TestSilentBatch(t *testing.T) {
	mem := &fakePushMemberRepo{tokenList: []model.Member{memberWithTokenV(1, "a"), memberWithTokenV(2, "b")}}
	r := NewPushSend(mem, &fakePushLogWriter{}, &fakePushSender{available: true}).SendSilentBatch()
	if r.Success != "true" || r.Title != "Silent 푸시 배치 전송" || r.Message != "총 2명 중 2명에게 성공적으로 전송했습니다." {
		t.Fatalf("silent-batch 오류: %+v", r)
	}
}

func bgInput(mtIdx int) BackgroundInput {
	return BackgroundInput{
		FCMSendInput:     FCMSendInput{PltType: "5", SstIdx: "0", PltCondition: "0", PltMemo: "m", MtIdx: mtIdx, PltTitle: "t", PltContent: "c"},
		ContentAvailable: true,
	}
}

func TestBackgroundNotFound(t *testing.T) {
	logs := &fakePushLogWriter{}
	r := NewPushSend(&fakePushMemberRepo{byID: map[int]*model.Member{}}, logs, &fakePushSender{available: true}).SendBackground(bgInput(999))
	if r.Success != "false" || r.Title != "백그라운드 푸시발송 실패" || r.Message != "존재하지 않는 회원입니다." {
		t.Fatalf("bg not-found 오류: %+v", r)
	}
	if len(logs.created) != 0 {
		t.Fatalf("not-found는 push_log 미기록이어야: %d", len(logs.created))
	}
}

func TestBackgroundNoTokenLogsStatus4(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: {MtIdx: 30, MtTokenID: pStr("")}}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true}).SendBackground(bgInput(30))
	if r.Message != "앱토큰이 존재하지 않습니다." {
		t.Fatalf("bg no-token 오류: %+v", r)
	}
	if len(logs.created) != 1 || *logs.created[0].PltStatus != 4 {
		t.Fatalf("bg no-token은 status=4 로그여야: %+v", logs.created)
	}
}

func TestBackgroundFirebaseUnavailableLogsStatus5(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: false}).SendBackground(bgInput(30))
	if r.Message != "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요." {
		t.Fatalf("bg firebase-unavail 오류: %+v", r)
	}
	if len(logs.created) != 1 || *logs.created[0].PltStatus != 5 {
		t.Fatalf("bg firebase-unavail은 status=5 로그여야: %+v", logs.created)
	}
}

func TestBackgroundSuccessLogsStatus2(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true}).SendBackground(bgInput(30))
	if r.Success != "true" || r.Title != "백그라운드 푸시발송 성공" || r.Message != "백그라운드 푸시발송 성공했습니다." {
		t.Fatalf("bg 성공 오류: %+v", r)
	}
	if len(logs.created) != 1 || *logs.created[0].PltStatus != 2 {
		t.Fatalf("bg 성공은 status=2 로그여야: %+v", logs.created)
	}
}

func TestBackgroundGenericErrorLogsStatus3(t *testing.T) {
	mem := &fakePushMemberRepo{byID: map[int]*model.Member{30: memberWithToken(30, "tok")}}
	logs := &fakePushLogWriter{}
	r := NewPushSend(mem, logs, &fakePushSender{available: true, err: errors.New("boom")}).SendBackground(bgInput(30))
	if r.Success != "false" || r.Title != "백그라운드 푸시발송 실패" || r.Message != "Firebase 전송 실패: boom" {
		t.Fatalf("bg generic 오류: %+v", r)
	}
	if len(logs.created) != 1 || *logs.created[0].PltStatus != 3 {
		t.Fatalf("bg generic은 status=3 로그여야: %+v", logs.created)
	}
}
