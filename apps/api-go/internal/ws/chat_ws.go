package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// upgrader는 socket.io cors_allowed_origins='*'에 대응해 모든 Origin을 허용한다.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

const (
	writeWait = 10 * time.Second
	readLimit = 1 << 20 // 1MB
)

// chatWSService는 ChatWS가 의존하는 서비스 동작이다(테스트 시 fake 주입).
type chatWSService interface {
	JoinRoom(scrIdx, mtIdx int) (bool, error)
	SendMessage(scrIdx, mtIdx int, content string) (*dto.ChatMessageItem, bool, error)
	ReadUpdate(scrIdx, mtIdx, scmsgIdx int) (int, bool, error)
	BuildOfflinePush(scrIdx, senderMtIdx int, onlineMtIdx map[int]bool) (string, []service.PushTarget, error)
	// IsRoomMember: 지금 이 회원이 방의 유효 참가자(방 참가 + 현재 그룹 멤버십)인지. 메시지 수신 시점에 접속자마다 확인한다.
	IsRoomMember(scrIdx, mtIdx int) (bool, error)
}

// ChatWS는 chat 실시간 핸들러다. Python chat_ws.py의 socket.io 이벤트를 native WS로 이식한다.
type ChatWS struct {
	hub *Hub
	svc chatWSService
	fcm fcm.Sender
	cfg *config.Config
	log *slog.Logger
	// revocation: 비밀번호 변경 이전에 발급된 토큰의 핸드셰이크를 거부한다(SetRevocation). nil이면 보지 않는다.
	revocation auth.AccessRevocationChecker
}

// SetRevocation은 구 access token 무효 기준 조회기를 주입한다.
func (w *ChatWS) SetRevocation(r auth.AccessRevocationChecker) { w.revocation = r }

func NewChatWS(hub *Hub, svc chatWSService, sender fcm.Sender, cfg *config.Config, log *slog.Logger) *ChatWS {
	if log == nil {
		log = slog.Default()
	}
	return &ChatWS{hub: hub, svc: svc, fcm: sender, cfg: cfg, log: log}
}

// envelope은 native WS 프레임 {"event":<name>,"data":<obj>}(클라↔서버 공통).
type envelope struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// Handle은 GET /ws 업그레이드 핸들러다.
// 핸드셰이크: ?token=Bearer%20<jwt>(socket.io auth.token 대체). 토큰 무효 시 Upgrade 전에 401로 거부
// (Python connect 핸들러가 False를 반환해 연결을 거부하는 것과 동일).
func (w *ChatWS) Handle(c *gin.Context) {
	mtIdx, ok := w.authToken(c.Query("token"))
	if !ok {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		w.log.Warn("ws upgrade failed", slog.String("err", err.Error()))
		return
	}
	conn := w.hub.Register(wsConn, mtIdx)
	w.log.Info("ws connected", slog.Int("mt_idx", mtIdx))

	go w.writePump(conn)
	w.readPump(conn)
}

// authToken은 Python get_mt_idx_from_token: "Bearer " 제거 후 mt_idx 디코드.
func (w *ChatWS) authToken(raw string) (int, bool) {
	token := strings.ReplaceAll(raw, "Bearer ", "")
	return auth.ParseWSTokenChecked(w.revocation, w.log, token, w.cfg.JWTSecretKey, w.cfg.JWTAlgorithm)
}

// readPump는 수신 루프다. 연결 종료 시 Hub에서 정리한다(Python disconnect).
func (w *ChatWS) readPump(conn *Conn) {
	defer func() {
		w.hub.Unregister(conn)
		_ = conn.ws.Close()
		w.log.Info("ws disconnected", slog.Int("mt_idx", conn.mtIdx))
	}()
	conn.ws.SetReadLimit(readLimit)
	for {
		_, raw, err := conn.ws.ReadMessage()
		if err != nil {
			return
		}
		var env envelope
		if err := json.Unmarshal(raw, &env); err != nil {
			continue // 잘못된 프레임 무시
		}
		w.dispatch(conn, env)
	}
}

// writePump는 송신 루프다. send 채널을 단일 writer로 직렬화한다.
func (w *ChatWS) writePump(conn *Conn) {
	for payload := range conn.send {
		_ = conn.ws.SetWriteDeadline(time.Now().Add(writeWait))
		if err := conn.ws.WriteMessage(websocket.TextMessage, payload); err != nil {
			return
		}
	}
	_ = conn.ws.WriteMessage(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
}

func (w *ChatWS) dispatch(conn *Conn, env envelope) {
	switch env.Event {
	case "join_room":
		w.onJoinRoom(conn, env.Data)
	case "leave_room":
		w.onLeaveRoom(conn, env.Data)
	case "send_message":
		w.onSendMessage(conn, env.Data)
	case "read_update":
		w.onReadUpdate(conn, env.Data)
	}
}

// onJoinRoom: Python join_room. scr_idx 없으면 무시, membership 없으면 error emit, 있으면 입장+last_read.
func (w *ChatWS) onJoinRoom(conn *Conn, data json.RawMessage) {
	var d struct {
		ScrIdx int `json:"scr_idx"`
	}
	_ = json.Unmarshal(data, &d)
	if d.ScrIdx == 0 {
		return
	}
	ok, err := w.svc.JoinRoom(d.ScrIdx, conn.mtIdx)
	if err != nil {
		w.log.Warn("join_room error", slog.String("err", err.Error()))
		return
	}
	if !ok {
		w.emitError(conn, "채팅방 접근 권한이 없습니다.")
		return
	}
	w.hub.JoinRoom(conn, d.ScrIdx)
}

// onLeaveRoom: Python leave_room. scr_idx 있으면 방 퇴장, active는 무조건 해제.
func (w *ChatWS) onLeaveRoom(conn *Conn, data json.RawMessage) {
	var d struct {
		ScrIdx int `json:"scr_idx"`
	}
	_ = json.Unmarshal(data, &d)
	if d.ScrIdx != 0 {
		w.hub.LeaveRoom(conn, d.ScrIdx)
	}
	w.hub.ClearActive(conn)
}

// onSendMessage: Python send_message. content strip 후 빈/누락이면 무시, 저장→broadcast→오프라인 푸시.
func (w *ChatWS) onSendMessage(conn *Conn, data json.RawMessage) {
	var d struct {
		ScrIdx  int    `json:"scr_idx"`
		Content string `json:"content"`
	}
	_ = json.Unmarshal(data, &d)
	content := strings.TrimSpace(d.Content)
	if conn.mtIdx == 0 || d.ScrIdx == 0 || content == "" {
		return
	}

	item, ok, err := w.svc.SendMessage(d.ScrIdx, conn.mtIdx, content)
	if err != nil {
		// Python은 try/except 없이 예외 전파(emit 안 함) → 로깅만.
		w.log.Warn("send_message db error", slog.String("err", err.Error()))
		return
	}
	if !ok {
		w.emitError(conn, "메시지 전송에 실패했습니다.")
		return
	}
	w.broadcastEvent(d.ScrIdx, "new_message", item)
	// 오프라인 멤버 FCM 푸시는 비동기(Python은 동기 N+1이나 Go는 응답 지연 방지).
	go w.sendPushToOffline(d.ScrIdx, conn.mtIdx, content)
}

// onReadUpdate: Python read_update. membership 있으면 last_read 갱신 + read_receipt broadcast.
func (w *ChatWS) onReadUpdate(conn *Conn, data json.RawMessage) {
	var d struct {
		ScrIdx   int `json:"scr_idx"`
		ScmsgIdx int `json:"scmsg_idx"`
	}
	_ = json.Unmarshal(data, &d)
	if conn.mtIdx == 0 || d.ScrIdx == 0 || d.ScmsgIdx == 0 {
		return
	}
	unread, ok, err := w.svc.ReadUpdate(d.ScrIdx, conn.mtIdx, d.ScmsgIdx)
	if err != nil {
		w.log.Warn("read_update error", slog.String("err", err.Error()))
		return
	}
	if !ok {
		return
	}
	w.broadcastEvent(d.ScrIdx, "read_receipt", map[string]interface{}{
		"scr_idx":      d.ScrIdx,
		"scmsg_idx":    d.ScmsgIdx,
		"unread_count": unread,
	})
}

// sendPushToOffline: Python _send_push_to_offline. 방을 보고 있지 않은 멤버에게 FCM 알림.
func (w *ChatWS) sendPushToOffline(scrIdx, senderMtIdx int, content string) {
	online := w.hub.OnlineInRoom(scrIdx)
	senderName, targets, err := w.svc.BuildOfflinePush(scrIdx, senderMtIdx, online)
	if err != nil {
		w.log.Warn("offline push build error", slog.String("err", err.Error()))
		return
	}
	if len(targets) == 0 {
		return
	}
	body := runeHead(content, 50) // Python content[:50]
	ctx := context.Background()
	for _, t := range targets {
		if _, err := w.fcm.Send(ctx, fcm.Message{Token: t.Token, Title: senderName, Body: body}); err != nil {
			w.log.Error("ws fcm push failed", slog.Int("mt_idx", t.MemberID), slog.String("err", err.Error()))
		}
	}
}

// --- emit 헬퍼 ---

// broadcastEvent는 방에 enter한 접속자에게 이벤트를 보낸다. 전달 시점마다 접속자의 현재 멤버십을 확인한다(C-1):
// 이미 접속한 소켓이라도 그룹을 나가거나 강퇴된 회원은 방에서 제외하고 보내지 않는다. 확인에 실패하면 보내지 않는다.
// 확인은 서비스의 짧은 TTL 캐시(허용 결과만)를 거치므로 접속자 수만큼 DB를 조회하지는 않는다.
func (w *ChatWS) broadcastEvent(scrIdx int, event string, data interface{}) {
	payload, err := marshalEvent(event, data)
	if err != nil {
		return
	}
	for _, c := range w.hub.RoomConns(scrIdx) {
		ok, err := w.svc.IsRoomMember(scrIdx, c.mtIdx)
		if err != nil {
			w.log.Warn("ws membership check failed", slog.String("err", err.Error()))
			continue
		}
		if !ok {
			w.hub.LeaveRoom(c, scrIdx)
			continue
		}
		w.hub.Send(c, payload)
	}
}

func (w *ChatWS) emitError(conn *Conn, msg string) {
	payload, err := marshalEvent("error", map[string]string{"message": msg})
	if err != nil {
		return
	}
	select {
	case conn.send <- payload:
	default:
	}
}

// marshalEvent는 {"event":..,"data":..} 프레임을 직렬화한다.
func marshalEvent(event string, data interface{}) ([]byte, error) {
	d, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}{Event: event, Data: d})
}

// runeHead는 Python content[:n](유니코드 코드포인트 기준).
func runeHead(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
