# chat 실시간 WebSocket 프로토콜 계약 (Go 이식판)

> SMAP chat 도메인 Go 이식(Phase5)에서 실시간 계층을 **python-socketio → native WebSocket**으로
> 재설계했다. 본 문서는 프론트(웹/앱) 클라이언트 마이그레이션 가이드다.
> 작성: 2026-06-01 · 대상: `backend-go` `/ws`

## 1. 왜 바뀌나

- 기존: `python-socketio 5.11.0`(Engine.IO v4 / Socket.IO protocol v5). Go에 호환 라이브러리 부재.
- 신규: **native WebSocket(gorilla/websocket)** + 자체 JSON 프레임. Socket.IO 핸드셰이크/패킷 인코딩 제거.
- 이벤트명·페이로드 키는 **1:1 유지**(아래 표) → 비즈니스 로직 변경 최소.

## 2. 연결(핸드셰이크)

| 항목 | socket.io (기존) | native WS (신규) |
|------|------------------|------------------|
| URL | `ws(s)://host/ws` (socket.io 경로) | `ws(s)://host/ws?token=<URL인코딩 토큰>` |
| 인증 | `io(url, { auth: { token: "Bearer <jwt>" } })` | 쿼리 `?token=Bearer%20<jwt>` (또는 `<jwt>` 단독) |
| 토큰 | JWT(`mt_idx` claim, `SECRET_KEY` 서명) | 동일 |
| 인증 실패 | `connect` 거부 | **HTTP 401**(Upgrade 전 거부) |
| 성공 | `connect` 이벤트 | **HTTP 101 Switching Protocols** |

- 서버는 `?token`에서 `"Bearer "` 접두를 제거한 뒤 디코드한다(접두 유무 모두 허용).
- `mt_idx` claim이 없거나 0/서명·만료 실패면 401로 거부한다(Python `connect=False` 대응).

## 3. 프레임 형식

모든 메시지는 **텍스트 JSON** 단일 봉투(envelope):

```json
{ "event": "<이벤트명>", "data": { ... } }
```

- 클라→서버, 서버→클라 동일 형식.
- socket.io의 "room" 개념은 서버 Hub가 내부 관리(클라는 `join_room`/`leave_room`만 전송).

## 4. 클라이언트 → 서버 이벤트

| event | data 키 | 동작 | 비고 |
|-------|---------|------|------|
| `join_room` | `scr_idx`(int) | 방 입장 + 최신 메시지로 읽음 위치 갱신 | 멤버 아니면 `error` 수신. `scr_idx` 누락/0이면 무시 |
| `leave_room` | `scr_idx`(int) | 방 퇴장 | `scr_idx` 없어도 active 상태는 해제 |
| `send_message` | `scr_idx`(int), `content`(string) | 메시지 저장 + 방 broadcast + 오프라인 멤버 FCM | `content` trim 후 빈 문자열이면 무시 |
| `read_update` | `scr_idx`(int), `scmsg_idx`(int) | 읽음 위치 갱신 + `read_receipt` broadcast | 셋 중 하나라도 0/누락이면 무시 |

## 5. 서버 → 클라이언트 이벤트

| event | data 키 | 시점 |
|-------|---------|------|
| `new_message` | `scmsg_idx`, `scr_idx`, `mt_idx`, `mt_nickname`, `mt_file1`, `scmsg_type`, `scmsg_content`, `scmsg_wdate`(ISO8601), `unread_count` | 방 멤버가 `send_message` 시 같은 방 전체에 broadcast |
| `read_receipt` | `scr_idx`, `scmsg_idx`, `unread_count` | `read_update` 시 같은 방 전체에 broadcast |
| `error` | `message`(string) | 권한 없는 `join_room`("채팅방 접근 권한이 없습니다.") 또는 전송 실패("메시지 전송에 실패했습니다.") — **해당 연결에만** 전송 |

> `new_message`의 `scmsg_wdate`는 `"2026-06-01T12:34:56"` 형식(초 단위, naive UTC). REST `/chats/rooms/{id}/messages` 응답과 동일 직렬화.

## 6. 프론트 마이그레이션 스니펫

**기존(socket.io-client)**
```js
import { io } from "socket.io-client";
const socket = io(`${WS_BASE}/ws`, { auth: { token: `Bearer ${jwt}` } });
socket.on("connect", () => socket.emit("join_room", { scr_idx }));
socket.on("new_message", (msg) => appendMessage(msg));
socket.on("read_receipt", (r) => updateUnread(r));
socket.on("error", (e) => toast(e.message));
socket.emit("send_message", { scr_idx, content });
```

**신규(native WebSocket)**
```js
const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent("Bearer " + jwt)}`);
const send = (event, data) => ws.send(JSON.stringify({ event, data }));

ws.onopen = () => send("join_room", { scr_idx });
ws.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);
  if (event === "new_message")  appendMessage(data);
  if (event === "read_receipt") updateUnread(data);
  if (event === "error")        toast(data.message);
};
// 전송
send("send_message", { scr_idx, content });
send("read_update", { scr_idx, scmsg_idx });
// 재연결: native WS는 자동 재연결이 없으므로 onclose에서 백오프 재연결 로직을 직접 구현해야 함.
```

### 변경 체크리스트
- [ ] `socket.io-client` 의존성 제거, 표준 `WebSocket` 사용.
- [ ] 토큰을 `auth.token` → **쿼리스트링** `?token=`으로 이동(URL 인코딩 필수).
- [ ] 모든 emit을 `ws.send(JSON.stringify({event, data}))`로 변경.
- [ ] 모든 on(event)를 `onmessage`에서 `event` 분기로 변경.
- [ ] **재연결/하트비트**를 직접 구현(socket.io가 제공하던 기능). 권장: `onclose` 시 지수 백오프 재연결.

## 7. 운영 주의 (Strangler Fig)

- WebSocket은 **stateful**(연결·룸 상태가 인메모리). 컷오버 시 **Python `/ws`와 Go `/ws`를 동시에 구동하지 말 것** — 룸이 두 서버로 갈려 broadcast가 분리되고 오프라인 푸시가 중복된다.
- Nginx `/ws` upstream을 **한쪽으로만** 지정. 롤백도 upstream 한 줄 전환.
- 단일 인스턴스 인메모리 Hub(Python 동일). 다중 인스턴스 확장 시 Redis pub/sub 필요(현재 범위 밖).
