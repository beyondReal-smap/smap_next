// Package ws는 chat 실시간 계층(native WebSocket)을 담당한다.
// Python `app/websocket/chat_ws.py`(python-socketio)의 in-memory 상태와 이벤트를
// gorilla/websocket + Hub로 재설계한다(프로토콜은 socket.io가 아닌 native {event,data} JSON).
//
// 상태 매핑(socket.io → Hub):
//   - connected_users(sid→mt_idx) → Conn.mtIdx + Hub.conns
//   - active_rooms(sid→scr_idx)    → Hub.active (현재 보고 있는 방, 오프라인 푸시 판정용)
//   - enter_room(room_{scr})       → Hub.rooms (broadcast 대상, 누적)
//
// 단일 인스턴스 in-memory(Python 동일). 멀티 인스턴스는 향후 Redis pub/sub.
package ws

import (
	"sync"

	"github.com/gorilla/websocket"
)

// Conn은 단일 WebSocket 연결이다. 쓰기는 send 채널 + writePump로 직렬화한다
// (gorilla/websocket은 동시 WriteMessage를 금지하므로 단일 writer로 모은다).
type Conn struct {
	ws     *websocket.Conn
	mtIdx  int
	send   chan []byte
	hub    *Hub
	closed sync.Once
}

// MtIdx는 연결의 인증된 회원 idx를 반환한다.
func (c *Conn) MtIdx() int { return c.mtIdx }

// Hub는 전체 연결·룸 상태를 mutex로 보호한다.
type Hub struct {
	mu     sync.Mutex
	conns  map[*Conn]bool        // 전체 연결
	rooms  map[int]map[*Conn]bool // scr_idx → 그 방에 enter한 연결들(broadcast 대상)
	active map[*Conn]int         // conn → 현재 active(보고 있는) scr_idx
}

func NewHub() *Hub {
	return &Hub{
		conns:  make(map[*Conn]bool),
		rooms:  make(map[int]map[*Conn]bool),
		active: make(map[*Conn]int),
	}
}

// Register는 새 연결을 등록하고 send 채널을 가진 Conn을 만든다.
func (h *Hub) Register(wsConn *websocket.Conn, mtIdx int) *Conn {
	c := &Conn{ws: wsConn, mtIdx: mtIdx, send: make(chan []byte, 32), hub: h}
	h.mu.Lock()
	h.conns[c] = true
	h.mu.Unlock()
	return c
}

// Unregister는 연결을 전체 상태(conns/rooms/active)에서 제거하고 send를 닫는다.
func (h *Hub) Unregister(c *Conn) {
	h.mu.Lock()
	delete(h.conns, c)
	for scr, set := range h.rooms {
		if _, ok := set[c]; ok {
			delete(set, c)
			if len(set) == 0 {
				delete(h.rooms, scr)
			}
		}
	}
	delete(h.active, c)
	h.mu.Unlock()
	c.closeSend()
}

// JoinRoom은 socket.io enter_room + active_rooms[sid]=scr 대응(누적, 이전 방은 유지).
func (h *Hub) JoinRoom(c *Conn, scrIdx int) {
	h.mu.Lock()
	if h.rooms[scrIdx] == nil {
		h.rooms[scrIdx] = make(map[*Conn]bool)
	}
	h.rooms[scrIdx][c] = true
	h.active[c] = scrIdx
	h.mu.Unlock()
}

// LeaveRoom은 socket.io leave_room 대응(rooms에서 제거, active가 그 방이면 해제).
func (h *Hub) LeaveRoom(c *Conn, scrIdx int) {
	h.mu.Lock()
	if set := h.rooms[scrIdx]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, scrIdx)
		}
	}
	if h.active[c] == scrIdx {
		delete(h.active, c)
	}
	h.mu.Unlock()
}

// ClearActive는 Python leave_room 핸들러의 active_rooms.pop(sid)(무조건) 대응.
func (h *Hub) ClearActive(c *Conn) {
	h.mu.Lock()
	delete(h.active, c)
	h.mu.Unlock()
}

// Broadcast는 scr_idx 방에 enter한 모든 연결에 payload를 보낸다(socket.io emit to room).
// send 버퍼가 가득 찬 느린 연결은 drop한다(전체 broadcast 지연 방지).
func (h *Hub) Broadcast(scrIdx int, payload []byte) {
	h.mu.Lock()
	conns := make([]*Conn, 0, len(h.rooms[scrIdx]))
	for c := range h.rooms[scrIdx] {
		conns = append(conns, c)
	}
	h.mu.Unlock()
	for _, c := range conns {
		select {
		case c.send <- payload:
		default:
		}
	}
}

// OnlineInRoom은 Python online_in_room(active_rooms에서 그 방을 보고 있는 mt_idx 집합)을 반환한다.
func (h *Hub) OnlineInRoom(scrIdx int) map[int]bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make(map[int]bool)
	for c, s := range h.active {
		if s == scrIdx {
			out[c.mtIdx] = true
		}
	}
	return out
}

func (c *Conn) closeSend() {
	c.closed.Do(func() { close(c.send) })
}
