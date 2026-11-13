package ws

import (
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
)

// C-1: 이미 접속해 방에 입장한 소켓이라도, 메시지 전달 시점에 현재 멤버가 아니면 받지 못하고 방에서 제외된다.
func TestWSBroadcastSkipsRevokedMember(t *testing.T) {
	svc := &fakeSvc{joinOK: true, sendOK: true, sendItem: &dto.ChatMessageItem{ScmsgIdx: 1, ScrIdx: 7, MtIdx: 1, ScmsgContent: "hi"}}
	srv := newTestWS(svc, &fakeFCM{})
	defer srv.Close()

	sender, _, err := dial(srv, wsToken(t, 1))
	if err != nil {
		t.Fatal(err)
	}
	defer sender.Close()
	stay, _, err := dial(srv, wsToken(t, 2))
	if err != nil {
		t.Fatal(err)
	}
	defer stay.Close()
	kicked, _, err := dial(srv, wsToken(t, 3))
	if err != nil {
		t.Fatal(err)
	}
	defer kicked.Close()

	for _, c := range []interface{ WriteJSON(v interface{}) error }{sender, stay, kicked} {
		_ = c.WriteJSON(map[string]interface{}{"event": "join_room", "data": map[string]int{"scr_idx": 7}})
	}
	time.Sleep(200 * time.Millisecond) // 입장 처리 대기

	// 입장 후 3번이 강퇴됨(그룹 멤버십 상실)
	svc.mu.Lock()
	svc.denied = map[int]bool{3: true}
	svc.mu.Unlock()

	writeEv(t, sender, "send_message", map[string]interface{}{"scr_idx": 7, "content": "hi"})

	if ev, _ := readEv(t, stay); ev != "new_message" {
		t.Errorf("현재 멤버는 new_message를 받아야 함: %s", ev)
	}
	if ev, _ := readEv(t, sender); ev != "new_message" {
		t.Errorf("발신자(현재 멤버)도 받아야 함: %s", ev)
	}
	_ = kicked.SetReadDeadline(time.Now().Add(400 * time.Millisecond))
	if _, _, err := kicked.ReadMessage(); err == nil {
		t.Error("강퇴된 회원의 소켓이 메시지를 받음")
	}
}
