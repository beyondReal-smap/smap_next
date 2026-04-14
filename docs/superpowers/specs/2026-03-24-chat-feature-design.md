# SMAP 채팅 기능 설계 문서

**작성일:** 2026-03-24
**상태:** 승인됨

## 요구사항

| 항목 | 결정 |
|------|------|
| 채팅 범위 | 그룹 채팅 + 1:1 채팅 |
| 메시지 타입 | 텍스트 (확장 가능 구조) |
| 실시간 방식 | WebSocket (Socket.IO) |
| 탭 위치 | 하단 네비게이션 맨 오른쪽 (6번째) |
| 읽음 표시 | 안 읽은 수 배지 + 메시지별 읽지 않은 사람 수 |

## 기존 인프라

- **백엔드:** FastAPI (Python) + MySQL (smap2_db) + SQLAlchemy 2.0
- **인증:** JWT (HS256, 90일 만료)
- **푸시:** Firebase Cloud Messaging (FCM) 구성 완료
- **서버:** ssh smap-v1, 경로 `/data/wwwroot/smap_next/backend`
- **WebSocket:** 미구성 (신규 추가)

---

## 1. 데이터베이스 설계

### 채팅방 테이블 (`smap_chat_room_t`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `scr_idx` | INT AUTO_INCREMENT PK | 채팅방 ID |
| `sgt_idx` | INT NULL | 그룹 FK (그룹채팅일 때) |
| `scr_type` | ENUM('group','dm') | 그룹채팅 / 1:1 |
| `scr_title` | VARCHAR(100) NULL | 채팅방 이름 (DM은 NULL) |
| `scr_show` | ENUM('Y','N') DEFAULT 'Y' | 소프트 삭제 |
| `scr_wdate` | DATETIME | 생성일 |
| `scr_udate` | DATETIME | 마지막 메시지 시간 (정렬용) |

### 채팅방 멤버 테이블 (`smap_chat_member_t`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `scm_idx` | INT AUTO_INCREMENT PK | PK |
| `scr_idx` | INT NOT NULL | 채팅방 FK |
| `mt_idx` | INT NOT NULL | 멤버 FK |
| `scm_last_read_idx` | INT DEFAULT 0 | 마지막 읽은 메시지 ID |
| `scm_show` | ENUM('Y','N') DEFAULT 'Y' | 소프트 삭제 |
| `scm_wdate` | DATETIME | 가입일 |

### 채팅 메시지 테이블 (`smap_chat_msg_t`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `scmsg_idx` | INT AUTO_INCREMENT PK | 메시지 ID |
| `scr_idx` | INT NOT NULL | 채팅방 FK |
| `mt_idx` | INT NOT NULL | 발신자 FK |
| `scmsg_type` | ENUM('text','image','location','system') DEFAULT 'text' | 메시지 유형 |
| `scmsg_content` | TEXT NOT NULL | 메시지 내용 |
| `scmsg_show` | ENUM('Y','N') DEFAULT 'Y' | 소프트 삭제 |
| `scmsg_wdate` | DATETIME | 발송 시간 |

### 읽음 처리 방식

`scm_last_read_idx` 기반:
- 각 멤버가 마지막으로 읽은 메시지 ID를 저장
- 메시지별 안 읽은 사람 수 = 채팅방 총 멤버 수 - `scm_last_read_idx >= 해당 scmsg_idx`인 멤버 수
- 채팅방 진입 시 `scm_last_read_idx`를 최신 메시지로 갱신

### 자동 동기화

- **그룹 생성 시:** `smap_chat_room_t`에 `scr_type='group'` 채팅방 자동 생성
- **그룹 가입 시:** `smap_chat_member_t`에 멤버 자동 추가
- **그룹 탈퇴 시:** `scm_show='N'`으로 소프트 삭제

---

## 2. 백엔드 API 설계

### REST API (`/api/v1/chats`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/rooms` | 내 채팅방 목록 (안 읽은 수, 마지막 메시지 포함) |
| POST | `/rooms/dm` | 1:1 채팅방 생성 (`{target_mt_idx}`) |
| GET | `/rooms/{scr_idx}/messages` | 메시지 조회 (페이지네이션) |
| GET | `/rooms/{scr_idx}/messages?before={scmsg_idx}` | 이전 메시지 로드 |

### WebSocket (Socket.IO) 이벤트

| 이벤트 | 방향 | 데이터 | 설명 |
|--------|------|--------|------|
| `connect` | C→S | `{token}` | 연결 + JWT 인증 |
| `join_room` | C→S | `{scr_idx}` | 채팅방 입장 |
| `leave_room` | C→S | `{scr_idx}` | 채팅방 퇴장 |
| `send_message` | C→S | `{scr_idx, content}` | 메시지 전송 |
| `new_message` | S→C | `{scmsg_idx, scr_idx, mt_idx, content, scmsg_wdate}` | 새 메시지 수신 |
| `read_update` | C→S | `{scr_idx, scmsg_idx}` | 읽음 위치 갱신 |
| `read_receipt` | S→C | `{scr_idx, scmsg_idx, unread_count}` | 읽음 수 브로드캐스트 |

### 메시지 전송 흐름

```
1. 클라이언트 → send_message → 서버
2. 서버: DB 저장 → scr_udate 갱신
3. 서버 → new_message → 채팅방의 온라인 멤버
4. 서버 → FCM 푸시 → 오프라인 멤버 (현재 채팅방 보고 있는 멤버 제외)
```

### 백엔드 파일 구조

```
backend/app/
├── models/chat_room.py
├── models/chat_member.py
├── models/chat_message.py
├── schemas/chat.py
├── api/v1/endpoints/chats.py
├── services/chat_service.py
└── websocket/chat_ws.py
```

---

## 3. 클라이언트 UI 설계 (iOS / Android 공통)

### 탭 바

```
홈 | 그룹 | 일정 | 내장소 | 활동로그 | 채팅
```

- 아이콘: `bubble.left.and.bubble.right` (iOS) / `Icons.Filled.Chat` (Android)
- 탭 배지: 전체 안 읽은 메시지 수 합산

### 화면 구조

```
ChatListView (채팅방 목록)
├── 상단: "채팅" 타이틀 + 새 DM 버튼 (연필 아이콘)
├── 그룹 채팅 섹션
│   └── 셀: 그룹명 | 마지막 메시지 미리보기 | 시간 | 안읽은수 배지
├── 1:1 채팅 섹션
│   └── 셀: 상대방 프로필+이름 | 마지막 메시지 | 시간 | 안읽은수 배지
└── 빈 상태: "채팅이 없습니다"

ChatRoomView (채팅방 내부)
├── 헤더: 채팅방 이름 + 뒤로가기 + 멤버수
├── 메시지 리스트 (무한스크롤)
│   ├── 내 메시지: 오른쪽 + 파란 배경 + 안읽은수
│   ├── 상대 메시지: 왼쪽 + 프로필사진 + 이름 + 회색 배경 + 안읽은수
│   └── 날짜 구분선
└── 하단 입력바: 텍스트 입력 + 전송 버튼

NewDMView (새 1:1 채팅)
├── 내 그룹 멤버 목록 표시
└── 멤버 선택 → 채팅방 생성/기존 DM 열기
```

---

## 4. 푸시 알림

- 기존 `firebase_service.send_push()` 활용
- 푸시 제목: 발신자 닉네임 (그룹채팅: "그룹명 - 닉네임")
- 푸시 내용: 메시지 미리보기 (최대 50자)
- 딥링크: 앱 열림 → 해당 채팅방으로 이동
- 현재 해당 채팅방을 보고 있는 멤버에게는 푸시 미전송

---

## 5. 구현 단계

| 단계 | 범위 | 설명 |
|------|------|------|
| **Phase 1** | DB + 백엔드 | 서버 코드 동기화 → DB 테이블 생성 → REST API + Socket.IO 구현 |
| **Phase 2** | iOS | 채팅 탭 추가 → ChatListView → ChatRoomView → WebSocket 연결 |
| **Phase 3** | Android | 동일 구조로 Android 구현 |

---

## 제약사항

- 서버 최신 코드는 `ssh smap-v1:/data/wwwroot/smap_next/backend`에 있으므로 구현 전 반드시 동기화 필요
- Socket.IO를 위해 `python-socketio` 패키지 서버에 추가 설치 필요
- iOS/Android 모두 Socket.IO 클라이언트 라이브러리 추가 필요
