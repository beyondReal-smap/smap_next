package ws

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/service"
)

const wsSecret = "ws-test-secret"

// fakeSvc는 chatWSService를 구현한다(DB 없이 프로토콜/Hub만 검증).
type fakeSvc struct {
	joinOK      bool
	sendItem    *dto.ChatMessageItem
	sendOK      bool
	pushName    string
	pushTargets []service.PushTarget
	denied      map[int]bool // IsRoomMember가 거부할 회원
	mu          sync.Mutex
}

func (f *fakeSvc) IsRoomMember(s, mt int) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return !f.denied[mt], nil
}
func (f *fakeSvc) JoinRoom(s, mt int) (bool, error) { return f.joinOK, nil }
func (f *fakeSvc) SendMessage(s, mt int, c string) (*dto.ChatMessageItem, bool, error) {
	return f.sendItem, f.sendOK, nil
}
func (f *fakeSvc) ReadUpdate(s, mt, si int) (int, bool, error) { return 2, true, nil }
func (f *fakeSvc) BuildOfflinePush(s, snd int, on map[int]bool) (string, []service.PushTarget, error) {
	return f.pushName, f.pushTargets, nil
}

// fakeFCM은 fcm.Sender를 구현하고 발송된 메시지를 기록한다.
type fakeFCM struct {
	mu   sync.Mutex
	sent []fcm.Message
}

func (f *fakeFCM) Send(ctx context.Context, m fcm.Message) (string, error) {
	f.mu.Lock()
	f.sent = append(f.sent, m)
	f.mu.Unlock()
	return "msg-id", nil
}
func (f *fakeFCM) SendEach(ctx context.Context, msgs []fcm.Message) (*messaging.BatchResponse, error) {
	return nil, nil
}
func (f *fakeFCM) count() int { f.mu.Lock(); defer f.mu.Unlock(); return len(f.sent) }

func wsToken(t *testing.T, mtIdx int) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"mt_idx": mtIdx, "exp": time.Now().Add(time.Hour).Unix(),
	})
	s, err := tok.SignedString([]byte(wsSecret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

func newTestWS(svc chatWSService, sender fcm.Sender) *httptest.Server {
	gin.SetMode(gin.TestMode)
	hub := NewHub()
	cfg := &config.Config{JWTSecretKey: wsSecret, JWTAlgorithm: "HS256"}
	cws := NewChatWS(hub, svc, sender, cfg, nil)
	r := gin.New()
	r.GET("/ws", cws.Handle)
	return httptest.NewServer(r)
}

func dial(srv *httptest.Server, token string) (*websocket.Conn, int, error) {
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?token=" + token
	c, resp, err := websocket.DefaultDialer.Dial(u, nil)
	status := 0
	if resp != nil {
		status = resp.StatusCode
	}
	return c, status, err
}

func writeEv(t *testing.T, c *websocket.Conn, event string, data interface{}) {
	t.Helper()
	d, _ := json.Marshal(data)
	payload, _ := json.Marshal(struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}{event, d})
	if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func readEv(t *testing.T, c *websocket.Conn) (string, json.RawMessage) {
	t.Helper()
	_ = c.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, raw, err := c.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var env struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatalf("unmarshal env: %v", err)
	}
	return env.Event, env.Data
}

func TestWSAuth(t *testing.T) {
	srv := newTestWS(&fakeSvc{}, &fakeFCM{})
	defer srv.Close()

	// 무토큰 → Upgrade 거부(401)
	if c, status, err := dial(srv, ""); err == nil {
		c.Close()
		t.Error("무토큰 연결이 수락됨")
	} else if status != 401 {
		t.Errorf("무토큰 기대 401, got %d", status)
	}

	// 유효 토큰 → 연결 성공
	c, _, err := dial(srv, wsToken(t, 10))
	if err != nil {
		t.Fatalf("유효 토큰 연결 실패: %v", err)
	}
	c.Close()
}

func TestWSSendBroadcast(t *testing.T) {
	item := &dto.ChatMessageItem{
		ScmsgIdx: 1, ScrIdx: 5, MtIdx: 10, ScmsgType: "text",
		ScmsgContent: "안녕", ScmsgWdate: "2026-06-01T00:00:00", UnreadCount: 1,
	}
	svc := &fakeSvc{joinOK: true, sendItem: item, sendOK: true}
	srv := newTestWS(svc, &fakeFCM{})
	defer srv.Close()

	ca, _, err := dial(srv, wsToken(t, 10))
	if err != nil {
		t.Fatal(err)
	}
	defer ca.Close()
	cb, _, err := dial(srv, wsToken(t, 20))
	if err != nil {
		t.Fatal(err)
	}
	defer cb.Close()

	// 둘 다 room 5 입장
	writeEv(t, ca, "join_room", map[string]int{"scr_idx": 5})
	writeEv(t, cb, "join_room", map[string]int{"scr_idx": 5})
	time.Sleep(100 * time.Millisecond) // join 처리(Hub 등록) 대기

	// A가 메시지 전송 → B가 new_message 수신
	writeEv(t, ca, "send_message", map[string]interface{}{"scr_idx": 5, "content": "안녕"})

	event, data := readEv(t, cb)
	if event != "new_message" {
		t.Fatalf("기대 new_message, got %q", event)
	}
	var got dto.ChatMessageItem
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if got.ScmsgContent != "안녕" || got.ScmsgIdx != 1 || got.UnreadCount != 1 {
		t.Errorf("broadcast 페이로드 불일치: %+v", got)
	}
}

func TestWSReadReceipt(t *testing.T) {
	svc := &fakeSvc{joinOK: true}
	srv := newTestWS(svc, &fakeFCM{})
	defer srv.Close()

	ca, _, _ := dial(srv, wsToken(t, 10))
	defer ca.Close()
	cb, _, _ := dial(srv, wsToken(t, 20))
	defer cb.Close()
	writeEv(t, ca, "join_room", map[string]int{"scr_idx": 7})
	writeEv(t, cb, "join_room", map[string]int{"scr_idx": 7})
	time.Sleep(100 * time.Millisecond)

	writeEv(t, ca, "read_update", map[string]int{"scr_idx": 7, "scmsg_idx": 42})
	event, data := readEv(t, cb)
	if event != "read_receipt" {
		t.Fatalf("기대 read_receipt, got %q", event)
	}
	var r struct {
		ScrIdx      int `json:"scr_idx"`
		ScmsgIdx    int `json:"scmsg_idx"`
		UnreadCount int `json:"unread_count"`
	}
	json.Unmarshal(data, &r)
	if r.ScrIdx != 7 || r.ScmsgIdx != 42 || r.UnreadCount != 2 {
		t.Errorf("read_receipt 페이로드 불일치: %+v", r)
	}
}

func TestWSJoinDenied(t *testing.T) {
	svc := &fakeSvc{joinOK: false} // membership 없음
	srv := newTestWS(svc, &fakeFCM{})
	defer srv.Close()

	c, _, _ := dial(srv, wsToken(t, 10))
	defer c.Close()
	writeEv(t, c, "join_room", map[string]int{"scr_idx": 9})

	event, data := readEv(t, c)
	if event != "error" {
		t.Fatalf("기대 error, got %q", event)
	}
	var e struct {
		Message string `json:"message"`
	}
	json.Unmarshal(data, &e)
	if e.Message != "채팅방 접근 권한이 없습니다." {
		t.Errorf("error 메시지 불일치: %q", e.Message)
	}
}

func TestWSOfflinePush(t *testing.T) {
	item := &dto.ChatMessageItem{ScmsgIdx: 1, ScrIdx: 5, MtIdx: 10, ScmsgContent: "hi", ScmsgWdate: "2026-06-01T00:00:00"}
	fk := &fakeFCM{}
	svc := &fakeSvc{
		joinOK: true, sendItem: item, sendOK: true,
		pushName:    "보낸이",
		pushTargets: []service.PushTarget{{Token: "tok-a", MemberID: 20}, {Token: "tok-b", MemberID: 30}},
	}
	srv := newTestWS(svc, fk)
	defer srv.Close()

	ca, _, _ := dial(srv, wsToken(t, 10))
	defer ca.Close()
	writeEv(t, ca, "join_room", map[string]int{"scr_idx": 5})
	time.Sleep(50 * time.Millisecond)
	writeEv(t, ca, "send_message", map[string]interface{}{"scr_idx": 5, "content": "hi"})
	time.Sleep(150 * time.Millisecond) // 비동기 푸시 goroutine 완료 대기

	if fk.count() != 2 {
		t.Fatalf("오프라인 푸시 2건 기대, got %d", fk.count())
	}
	if fk.sent[0].Title != "보낸이" || fk.sent[0].Body != "hi" {
		t.Errorf("푸시 페이로드 불일치: %+v", fk.sent[0])
	}
}
