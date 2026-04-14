# Chat Feature Phase 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete chat backend: DB tables, REST API, WebSocket (Socket.IO), and FCM push integration for group chat + 1:1 DM.

**Architecture:** Three MySQL tables (chat_room, chat_member, chat_msg) with SQLAlchemy models following existing SMAP patterns. REST API for room listing and message history. Socket.IO for real-time messaging and read receipts. Existing FCM push service for offline notifications.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, MySQL (smap2_db), python-socketio, firebase-admin

**Spec:** `docs/superpowers/specs/2026-03-24-chat-feature-design.md`

**Server:** `ssh smap-v1:/data/wwwroot/smap_next/backend` (최신 코드)

---

## File Structure

### New Files
```
backend/app/models/chat_room.py       # ChatRoom SQLAlchemy model
backend/app/models/chat_member.py     # ChatMember SQLAlchemy model
backend/app/models/chat_message.py    # ChatMessage SQLAlchemy model
backend/app/schemas/chat.py           # Pydantic request/response schemas
backend/app/api/v1/endpoints/chats.py # REST API endpoints
backend/app/services/chat_service.py  # Business logic
backend/app/websocket/chat_ws.py      # Socket.IO event handlers
backend/app/websocket/__init__.py     # Package init
```

### Modified Files
```
backend/app/api/v1/api.py             # Add chat router
backend/app/main.py                   # Mount Socket.IO ASGI app
backend/requirements.txt              # Add python-socketio
backend/app/api/v1/endpoints/groups.py # Hook: auto-create chat room on group create/join
```

---

### Task 1: Sync server code to local

**Files:**
- Sync: `smap_next/backend/` (전체)

- [ ] **Step 1: Backup local backend**

```bash
cp -r smap_next/backend smap_next/backend_local_backup
```

- [ ] **Step 2: Sync from server**

```bash
rsync -avz --exclude='__pycache__' --exclude='.env' --exclude='*.pyc' smap-v1:/data/wwwroot/smap_next/backend/ smap_next/backend/
```

- [ ] **Step 3: Verify sync**

```bash
ls smap_next/backend/app/models/
ls smap_next/backend/app/api/v1/endpoints/
```

Expected: 파일 목록이 서버와 동일

---

### Task 2: Create DB tables via SSH

**Files:**
- Execute: SQL on `smap-v1` MySQL

- [ ] **Step 1: Create smap_chat_room_t table**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e \"
CREATE TABLE IF NOT EXISTS smap_chat_room_t (
    scr_idx INT AUTO_INCREMENT PRIMARY KEY,
    sgt_idx INT NULL COMMENT '그룹 FK (그룹채팅)',
    scr_type ENUM('group','dm') NOT NULL DEFAULT 'group' COMMENT '채팅방 유형',
    scr_title VARCHAR(100) NULL COMMENT '채팅방 이름 (DM은 NULL)',
    scr_show ENUM('Y','N') NOT NULL DEFAULT 'Y' COMMENT '표시 여부',
    scr_wdate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    scr_udate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 메시지 시간',
    INDEX idx_sgt_idx (sgt_idx),
    INDEX idx_scr_type (scr_type),
    INDEX idx_scr_udate (scr_udate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='채팅방 테이블';
\""
```

- [ ] **Step 2: Create smap_chat_member_t table**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e \"
CREATE TABLE IF NOT EXISTS smap_chat_member_t (
    scm_idx INT AUTO_INCREMENT PRIMARY KEY,
    scr_idx INT NOT NULL COMMENT '채팅방 FK',
    mt_idx INT NOT NULL COMMENT '멤버 FK',
    scm_last_read_idx INT NOT NULL DEFAULT 0 COMMENT '마지막 읽은 메시지 ID',
    scm_show ENUM('Y','N') NOT NULL DEFAULT 'Y' COMMENT '표시 여부',
    scm_wdate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입일',
    UNIQUE INDEX idx_room_member (scr_idx, mt_idx),
    INDEX idx_mt_idx (mt_idx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='채팅방 멤버 테이블';
\""
```

- [ ] **Step 3: Create smap_chat_msg_t table**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e \"
CREATE TABLE IF NOT EXISTS smap_chat_msg_t (
    scmsg_idx INT AUTO_INCREMENT PRIMARY KEY,
    scr_idx INT NOT NULL COMMENT '채팅방 FK',
    mt_idx INT NOT NULL COMMENT '발신자 FK',
    scmsg_type ENUM('text','image','location','system') NOT NULL DEFAULT 'text' COMMENT '메시지 유형',
    scmsg_content TEXT NOT NULL COMMENT '메시지 내용',
    scmsg_show ENUM('Y','N') NOT NULL DEFAULT 'Y' COMMENT '표시 여부',
    scmsg_wdate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발송 시간',
    INDEX idx_scr_idx_wdate (scr_idx, scmsg_wdate),
    INDEX idx_mt_idx (mt_idx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='채팅 메시지 테이블';
\""
```

- [ ] **Step 4: Verify tables**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e 'SHOW TABLES LIKE \"smap_chat%\";'"
```

Expected:
```
smap_chat_member_t
smap_chat_msg_t
smap_chat_room_t
```

- [ ] **Step 5: Create chat rooms for existing groups**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e \"
INSERT INTO smap_chat_room_t (sgt_idx, scr_type, scr_title, scr_show, scr_wdate, scr_udate)
SELECT g.sgt_idx, 'group', g.sgt_title, 'Y', NOW(), NOW()
FROM smap_group_t g
WHERE g.sgt_show = 'Y'
  AND g.sgt_idx NOT IN (SELECT sgt_idx FROM smap_chat_room_t WHERE sgt_idx IS NOT NULL);
\""
```

- [ ] **Step 6: Add existing group members to chat rooms**

```bash
ssh smap-v1 "mysql -u smap2 -pdmonster smap2_db -e \"
INSERT INTO smap_chat_member_t (scr_idx, mt_idx, scm_show, scm_wdate)
SELECT cr.scr_idx, gd.mt_idx, 'Y', NOW()
FROM smap_chat_room_t cr
JOIN smap_group_detail_t gd ON cr.sgt_idx = gd.sgt_idx
WHERE cr.scr_type = 'group'
  AND gd.sgdt_exit = 'N'
  AND gd.sgdt_show = 'Y'
  AND NOT EXISTS (
    SELECT 1 FROM smap_chat_member_t cm
    WHERE cm.scr_idx = cr.scr_idx AND cm.mt_idx = gd.mt_idx
  );
\""
```

---

### Task 3: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/chat_room.py`
- Create: `backend/app/models/chat_member.py`
- Create: `backend/app/models/chat_message.py`

- [ ] **Step 1: Create ChatRoom model**

```python
# backend/app/models/chat_room.py
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime


class ChatRoom(BaseModel):
    __tablename__ = "smap_chat_room_t"

    scr_idx = Column(Integer, primary_key=True)
    sgt_idx = Column(Integer, nullable=True)
    scr_type = Column(Enum('group', 'dm'), nullable=False, default='group')
    scr_title = Column(String(100), nullable=True)
    scr_show = Column(Enum(ShowEnum), nullable=False, default=ShowEnum.Y)
    scr_wdate = Column(DateTime, nullable=False, default=datetime.utcnow)
    scr_udate = Column(DateTime, nullable=False, default=datetime.utcnow)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['ChatRoom']:
        return db.query(cls).filter(cls.scr_idx == idx, cls.scr_show == ShowEnum.Y).first()

    @classmethod
    def find_by_group(cls, db: Session, sgt_idx: int) -> Optional['ChatRoom']:
        return db.query(cls).filter(
            cls.sgt_idx == sgt_idx, cls.scr_type == 'group', cls.scr_show == ShowEnum.Y
        ).first()

    @classmethod
    def find_dm(cls, db: Session, mt_idx_1: int, mt_idx_2: int) -> Optional['ChatRoom']:
        """Find existing DM room between two members."""
        from app.models.chat_member import ChatMember
        subq = db.query(ChatMember.scr_idx).filter(
            ChatMember.mt_idx.in_([mt_idx_1, mt_idx_2]),
            ChatMember.scm_show == ShowEnum.Y
        ).group_by(ChatMember.scr_idx).having(
            db.func.count(ChatMember.mt_idx) == 2
        ).subquery()
        return db.query(cls).filter(
            cls.scr_idx.in_(subq), cls.scr_type == 'dm', cls.scr_show == ShowEnum.Y
        ).first()

    @classmethod
    def get_rooms_for_member(cls, db: Session, mt_idx: int) -> List['ChatRoom']:
        from app.models.chat_member import ChatMember
        return db.query(cls).join(
            ChatMember, cls.scr_idx == ChatMember.scr_idx
        ).filter(
            ChatMember.mt_idx == mt_idx,
            ChatMember.scm_show == ShowEnum.Y,
            cls.scr_show == ShowEnum.Y
        ).order_by(cls.scr_udate.desc()).all()
```

- [ ] **Step 2: Create ChatMember model**

```python
# backend/app/models/chat_member.py
from sqlalchemy import Column, Integer, DateTime, Enum
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime


class ChatMember(BaseModel):
    __tablename__ = "smap_chat_member_t"

    scm_idx = Column(Integer, primary_key=True)
    scr_idx = Column(Integer, nullable=False)
    mt_idx = Column(Integer, nullable=False)
    scm_last_read_idx = Column(Integer, nullable=False, default=0)
    scm_show = Column(Enum(ShowEnum), nullable=False, default=ShowEnum.Y)
    scm_wdate = Column(DateTime, nullable=False, default=datetime.utcnow)

    @classmethod
    def find_membership(cls, db: Session, scr_idx: int, mt_idx: int) -> Optional['ChatMember']:
        return db.query(cls).filter(
            cls.scr_idx == scr_idx, cls.mt_idx == mt_idx, cls.scm_show == ShowEnum.Y
        ).first()

    @classmethod
    def get_room_members(cls, db: Session, scr_idx: int) -> List['ChatMember']:
        return db.query(cls).filter(
            cls.scr_idx == scr_idx, cls.scm_show == ShowEnum.Y
        ).all()

    @classmethod
    def count_unread(cls, db: Session, scr_idx: int, scmsg_idx: int) -> int:
        """Count members who have NOT read this message."""
        total = db.query(cls).filter(cls.scr_idx == scr_idx, cls.scm_show == ShowEnum.Y).count()
        read = db.query(cls).filter(
            cls.scr_idx == scr_idx, cls.scm_show == ShowEnum.Y,
            cls.scm_last_read_idx >= scmsg_idx
        ).count()
        return total - read

    def update_last_read(self, db: Session, scmsg_idx: int):
        if scmsg_idx > self.scm_last_read_idx:
            self.scm_last_read_idx = scmsg_idx
            db.commit()
```

- [ ] **Step 3: Create ChatMessage model**

```python
# backend/app/models/chat_message.py
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime


class ChatMessage(BaseModel):
    __tablename__ = "smap_chat_msg_t"

    scmsg_idx = Column(Integer, primary_key=True)
    scr_idx = Column(Integer, nullable=False)
    mt_idx = Column(Integer, nullable=False)
    scmsg_type = Column(Enum('text', 'image', 'location', 'system'), nullable=False, default='text')
    scmsg_content = Column(Text, nullable=False)
    scmsg_show = Column(Enum(ShowEnum), nullable=False, default=ShowEnum.Y)
    scmsg_wdate = Column(DateTime, nullable=False, default=datetime.utcnow)

    @classmethod
    def get_messages(cls, db: Session, scr_idx: int, before_idx: Optional[int] = None, limit: int = 50) -> List['ChatMessage']:
        query = db.query(cls).filter(cls.scr_idx == scr_idx, cls.scmsg_show == ShowEnum.Y)
        if before_idx:
            query = query.filter(cls.scmsg_idx < before_idx)
        return query.order_by(cls.scmsg_idx.desc()).limit(limit).all()[::-1]

    @classmethod
    def get_latest(cls, db: Session, scr_idx: int) -> Optional['ChatMessage']:
        return db.query(cls).filter(
            cls.scr_idx == scr_idx, cls.scmsg_show == ShowEnum.Y
        ).order_by(cls.scmsg_idx.desc()).first()
```

- [ ] **Step 4: Commit models**

```bash
git add backend/app/models/chat_room.py backend/app/models/chat_member.py backend/app/models/chat_message.py
git commit -m "feat(chat): add ChatRoom, ChatMember, ChatMessage SQLAlchemy models"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/chat.py`

- [ ] **Step 1: Create chat schemas**

```python
# backend/app/schemas/chat.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Request schemas ---

class CreateDMRequest(BaseModel):
    target_mt_idx: int


class SendMessageRequest(BaseModel):
    scr_idx: int
    content: str


class ReadUpdateRequest(BaseModel):
    scr_idx: int
    scmsg_idx: int


# --- Response schemas ---

class MessageResponse(BaseModel):
    scmsg_idx: int
    scr_idx: int
    mt_idx: int
    mt_nickname: Optional[str] = None
    mt_file1: Optional[str] = None
    scmsg_type: str = "text"
    scmsg_content: str
    scmsg_wdate: datetime
    unread_count: int = 0

    class Config:
        from_attributes = True


class ChatRoomResponse(BaseModel):
    scr_idx: int
    sgt_idx: Optional[int] = None
    scr_type: str
    scr_title: Optional[str] = None
    scr_udate: datetime
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    member_count: int = 0
    # DM 상대방 정보
    dm_target_nickname: Optional[str] = None
    dm_target_file1: Optional[str] = None

    class Config:
        from_attributes = True


class ChatRoomListResponse(BaseModel):
    rooms: List[ChatRoomResponse]
    total_unread: int = 0
```

- [ ] **Step 2: Commit schemas**

```bash
git add backend/app/schemas/chat.py
git commit -m "feat(chat): add Pydantic request/response schemas"
```

---

### Task 5: Chat Service (Business Logic)

**Files:**
- Create: `backend/app/services/chat_service.py`

- [ ] **Step 1: Create chat service**

```python
# backend/app/services/chat_service.py
import logging
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.models.chat_room import ChatRoom
from app.models.chat_member import ChatMember
from app.models.chat_message import ChatMessage
from app.models.member import Member
from app.models.enums import ShowEnum

logger = logging.getLogger(__name__)


class ChatService:

    @staticmethod
    def get_rooms_for_member(db: Session, mt_idx: int) -> Dict:
        rooms = ChatRoom.get_rooms_for_member(db, mt_idx)
        result = []
        total_unread = 0

        for room in rooms:
            membership = ChatMember.find_membership(db, room.scr_idx, mt_idx)
            last_read = membership.scm_last_read_idx if membership else 0

            # Unread count
            unread = db.query(ChatMessage).filter(
                ChatMessage.scr_idx == room.scr_idx,
                ChatMessage.scmsg_idx > last_read,
                ChatMessage.scmsg_show == ShowEnum.Y
            ).count()
            total_unread += unread

            # Last message
            latest = ChatMessage.get_latest(db, room.scr_idx)

            # Member count
            member_count = len(ChatMember.get_room_members(db, room.scr_idx))

            # DM target info
            dm_target_nickname = None
            dm_target_file1 = None
            if room.scr_type == 'dm':
                members = ChatMember.get_room_members(db, room.scr_idx)
                other = next((m for m in members if m.mt_idx != mt_idx), None)
                if other:
                    target_user = db.query(Member).filter(Member.mt_idx == other.mt_idx).first()
                    if target_user:
                        dm_target_nickname = target_user.mt_nickname or target_user.mt_name
                        dm_target_file1 = target_user.mt_file1

            result.append({
                "scr_idx": room.scr_idx,
                "sgt_idx": room.sgt_idx,
                "scr_type": room.scr_type,
                "scr_title": room.scr_title,
                "scr_udate": room.scr_udate,
                "unread_count": unread,
                "last_message": latest.scmsg_content[:50] if latest else None,
                "last_message_time": latest.scmsg_wdate if latest else None,
                "member_count": member_count,
                "dm_target_nickname": dm_target_nickname,
                "dm_target_file1": dm_target_file1,
            })

        return {"rooms": result, "total_unread": total_unread}

    @staticmethod
    def get_messages(db: Session, scr_idx: int, mt_idx: int, before_idx: Optional[int] = None, limit: int = 50) -> List[Dict]:
        # Verify membership
        membership = ChatMember.find_membership(db, scr_idx, mt_idx)
        if not membership:
            return []

        messages = ChatMessage.get_messages(db, scr_idx, before_idx, limit)
        result = []
        for msg in messages:
            sender = db.query(Member).filter(Member.mt_idx == msg.mt_idx).first()
            unread = ChatMember.count_unread(db, scr_idx, msg.scmsg_idx)
            result.append({
                "scmsg_idx": msg.scmsg_idx,
                "scr_idx": msg.scr_idx,
                "mt_idx": msg.mt_idx,
                "mt_nickname": (sender.mt_nickname or sender.mt_name) if sender else None,
                "mt_file1": sender.mt_file1 if sender else None,
                "scmsg_type": msg.scmsg_type,
                "scmsg_content": msg.scmsg_content,
                "scmsg_wdate": msg.scmsg_wdate,
                "unread_count": unread,
            })
        return result

    @staticmethod
    def send_message(db: Session, scr_idx: int, mt_idx: int, content: str) -> Optional[Dict]:
        membership = ChatMember.find_membership(db, scr_idx, mt_idx)
        if not membership:
            return None

        msg = ChatMessage(
            scr_idx=scr_idx,
            mt_idx=mt_idx,
            scmsg_type='text',
            scmsg_content=content,
            scmsg_wdate=datetime.utcnow()
        )
        db.add(msg)

        # Update room timestamp
        room = ChatRoom.find_by_idx(db, scr_idx)
        if room:
            room.scr_udate = datetime.utcnow()

        # Auto-read own message
        membership.scm_last_read_idx = msg.scmsg_idx

        db.commit()
        db.refresh(msg)

        sender = db.query(Member).filter(Member.mt_idx == mt_idx).first()
        members = ChatMember.get_room_members(db, scr_idx)
        unread = len(members) - 1  # Everyone except sender hasn't read yet

        return {
            "scmsg_idx": msg.scmsg_idx,
            "scr_idx": msg.scr_idx,
            "mt_idx": msg.mt_idx,
            "mt_nickname": (sender.mt_nickname or sender.mt_name) if sender else None,
            "mt_file1": sender.mt_file1 if sender else None,
            "scmsg_type": msg.scmsg_type,
            "scmsg_content": msg.scmsg_content,
            "scmsg_wdate": msg.scmsg_wdate,
            "unread_count": unread,
        }

    @staticmethod
    def create_dm_room(db: Session, mt_idx: int, target_mt_idx: int) -> Optional[Dict]:
        # Check if DM already exists
        existing = ChatRoom.find_dm(db, mt_idx, target_mt_idx)
        if existing:
            return {"scr_idx": existing.scr_idx, "is_new": False}

        now = datetime.utcnow()
        room = ChatRoom(scr_type='dm', scr_show=ShowEnum.Y, scr_wdate=now, scr_udate=now)
        db.add(room)
        db.flush()

        for member_id in [mt_idx, target_mt_idx]:
            cm = ChatMember(scr_idx=room.scr_idx, mt_idx=member_id, scm_wdate=now)
            db.add(cm)

        db.commit()
        return {"scr_idx": room.scr_idx, "is_new": True}

    @staticmethod
    def create_group_chat_room(db: Session, sgt_idx: int, title: str, member_ids: List[int]):
        """Called when a new group is created."""
        existing = ChatRoom.find_by_group(db, sgt_idx)
        if existing:
            return existing

        now = datetime.utcnow()
        room = ChatRoom(sgt_idx=sgt_idx, scr_type='group', scr_title=title, scr_show=ShowEnum.Y, scr_wdate=now, scr_udate=now)
        db.add(room)
        db.flush()

        for member_id in member_ids:
            cm = ChatMember(scr_idx=room.scr_idx, mt_idx=member_id, scm_wdate=now)
            db.add(cm)

        db.commit()
        return room

    @staticmethod
    def add_member_to_group_chat(db: Session, sgt_idx: int, mt_idx: int):
        """Called when a member joins a group."""
        room = ChatRoom.find_by_group(db, sgt_idx)
        if not room:
            return
        existing = ChatMember.find_membership(db, room.scr_idx, mt_idx)
        if existing:
            return
        cm = ChatMember(scr_idx=room.scr_idx, mt_idx=mt_idx, scm_wdate=datetime.utcnow())
        db.add(cm)
        db.commit()

    @staticmethod
    def remove_member_from_group_chat(db: Session, sgt_idx: int, mt_idx: int):
        """Called when a member leaves a group."""
        room = ChatRoom.find_by_group(db, sgt_idx)
        if not room:
            return
        membership = ChatMember.find_membership(db, room.scr_idx, mt_idx)
        if membership:
            membership.scm_show = ShowEnum.N
            db.commit()


chat_service = ChatService()
```

- [ ] **Step 2: Commit service**

```bash
git add backend/app/services/chat_service.py
git commit -m "feat(chat): add ChatService business logic"
```

---

### Task 6: REST API Endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/chats.py`
- Modify: `backend/app/api/v1/api.py`

- [ ] **Step 1: Create chats endpoint**

```python
# backend/app/api/v1/endpoints/chats.py
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from jose import jwt

from app.api import deps
from app.core.config import settings
from app.schemas.chat import CreateDMRequest, ChatRoomListResponse, MessageResponse
from app.services.chat_service import chat_service

logger = logging.getLogger(__name__)
router = APIRouter()


def get_current_user_id(authorization: str = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx = payload.get("mt_idx")
        if not mt_idx:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
        return mt_idx
    except Exception:
        raise HTTPException(status_code=401, detail="토큰 인증에 실패했습니다.")


@router.get("/rooms")
def get_chat_rooms(
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    return chat_service.get_rooms_for_member(db, mt_idx)


@router.post("/rooms/dm")
def create_dm_room(
    request: CreateDMRequest,
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    if request.target_mt_idx == mt_idx:
        raise HTTPException(status_code=400, detail="자기 자신에게는 DM을 보낼 수 없습니다.")
    result = chat_service.create_dm_room(db, mt_idx, request.target_mt_idx)
    if not result:
        raise HTTPException(status_code=500, detail="채팅방 생성에 실패했습니다.")
    return result


@router.get("/rooms/{scr_idx}/messages")
def get_messages(
    scr_idx: int,
    before: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    messages = chat_service.get_messages(db, scr_idx, mt_idx, before, min(limit, 100))
    if messages is None:
        raise HTTPException(status_code=403, detail="채팅방 접근 권한이 없습니다.")
    return messages
```

- [ ] **Step 2: Register router in api.py**

Add to `backend/app/api/v1/api.py`:

```python
from app.api.v1.endpoints import chats
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
```

- [ ] **Step 3: Commit endpoints**

```bash
git add backend/app/api/v1/endpoints/chats.py backend/app/api/v1/api.py
git commit -m "feat(chat): add REST API endpoints for chat rooms and messages"
```

---

### Task 7: WebSocket (Socket.IO) Handler

**Files:**
- Create: `backend/app/websocket/__init__.py`
- Create: `backend/app/websocket/chat_ws.py`
- Modify: `backend/app/main.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add python-socketio to requirements**

Append to `backend/requirements.txt`:

```
python-socketio[asyncio]==5.11.0
```

- [ ] **Step 2: Create WebSocket package init**

```python
# backend/app/websocket/__init__.py
```

- [ ] **Step 3: Create Socket.IO handler**

```python
# backend/app/websocket/chat_ws.py
import logging
import socketio
from jose import jwt
from datetime import datetime

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.chat_service import chat_service
from app.models.chat_member import ChatMember
from app.models.chat_message import ChatMessage
from app.models.member import Member

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Track online users: {sid: mt_idx}
connected_users: dict[str, int] = {}
# Track which room each sid is viewing: {sid: scr_idx}
active_rooms: dict[str, int] = {}


def get_mt_idx_from_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("mt_idx")
    except Exception:
        return None


@sio.event
async def connect(sid, environ, auth):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token", "").replace("Bearer ", "")
    if not token:
        logger.warning(f"[WS] Connection rejected: no token (sid={sid})")
        return False

    mt_idx = get_mt_idx_from_token(token)
    if not mt_idx:
        logger.warning(f"[WS] Connection rejected: invalid token (sid={sid})")
        return False

    connected_users[sid] = mt_idx
    logger.info(f"[WS] Connected: mt_idx={mt_idx}, sid={sid}")
    return True


@sio.event
async def disconnect(sid):
    mt_idx = connected_users.pop(sid, None)
    active_rooms.pop(sid, None)
    logger.info(f"[WS] Disconnected: mt_idx={mt_idx}, sid={sid}")


@sio.event
async def join_room(sid, data):
    scr_idx = data.get("scr_idx")
    mt_idx = connected_users.get(sid)
    if not scr_idx or not mt_idx:
        return

    db = SessionLocal()
    try:
        membership = ChatMember.find_membership(db, scr_idx, mt_idx)
        if not membership:
            await sio.emit("error", {"message": "채팅방 접근 권한이 없습니다."}, to=sid)
            return

        sio.enter_room(sid, f"room_{scr_idx}")
        active_rooms[sid] = scr_idx

        # Update read position to latest message
        latest = ChatMessage.get_latest(db, scr_idx)
        if latest:
            membership.update_last_read(db, latest.scmsg_idx)

        logger.info(f"[WS] join_room: mt_idx={mt_idx}, scr_idx={scr_idx}")
    finally:
        db.close()


@sio.event
async def leave_room(sid, data):
    scr_idx = data.get("scr_idx")
    if scr_idx:
        sio.leave_room(sid, f"room_{scr_idx}")
    active_rooms.pop(sid, None)


@sio.event
async def send_message(sid, data):
    mt_idx = connected_users.get(sid)
    scr_idx = data.get("scr_idx")
    content = data.get("content", "").strip()

    if not mt_idx or not scr_idx or not content:
        return

    db = SessionLocal()
    try:
        msg_data = chat_service.send_message(db, scr_idx, mt_idx, content)
        if not msg_data:
            await sio.emit("error", {"message": "메시지 전송에 실패했습니다."}, to=sid)
            return

        # Serialize datetime
        msg_data["scmsg_wdate"] = msg_data["scmsg_wdate"].isoformat()

        # Broadcast to room
        await sio.emit("new_message", msg_data, room=f"room_{scr_idx}")

        # Send FCM push to offline members
        _send_push_to_offline(db, scr_idx, mt_idx, content)

        logger.info(f"[WS] Message sent: mt_idx={mt_idx}, scr_idx={scr_idx}, scmsg_idx={msg_data['scmsg_idx']}")
    finally:
        db.close()


@sio.event
async def read_update(sid, data):
    mt_idx = connected_users.get(sid)
    scr_idx = data.get("scr_idx")
    scmsg_idx = data.get("scmsg_idx")

    if not mt_idx or not scr_idx or not scmsg_idx:
        return

    db = SessionLocal()
    try:
        membership = ChatMember.find_membership(db, scr_idx, mt_idx)
        if membership:
            membership.update_last_read(db, scmsg_idx)
            # Broadcast updated unread count
            unread = ChatMember.count_unread(db, scr_idx, scmsg_idx)
            await sio.emit("read_receipt", {
                "scr_idx": scr_idx,
                "scmsg_idx": scmsg_idx,
                "unread_count": unread
            }, room=f"room_{scr_idx}")
    finally:
        db.close()


def _send_push_to_offline(db, scr_idx: int, sender_mt_idx: int, content: str):
    """Send FCM push to members not currently viewing this room."""
    from app.services.push_service import send_push

    members = ChatMember.get_room_members(db, scr_idx)
    sender = db.query(Member).filter(Member.mt_idx == sender_mt_idx).first()
    sender_name = (sender.mt_nickname or sender.mt_name or "알 수 없음") if sender else "알 수 없음"

    # Find sids currently in this room
    online_in_room = {connected_users[s] for s, r in active_rooms.items() if r == scr_idx}

    for member in members:
        if member.mt_idx == sender_mt_idx:
            continue
        if member.mt_idx in online_in_room:
            continue

        target = db.query(Member).filter(Member.mt_idx == member.mt_idx).first()
        if target and target.mt_token_id:
            try:
                send_push(
                    token_id=target.mt_token_id,
                    title=sender_name,
                    content=content[:50],
                    member_id=target.mt_idx
                )
            except Exception as e:
                logger.error(f"[WS] FCM push failed for mt_idx={member.mt_idx}: {e}")
```

- [ ] **Step 4: Mount Socket.IO in main.py**

Add at the top of `backend/app/main.py` imports:

```python
import socketio
from app.websocket.chat_ws import sio
```

After `app = FastAPI(...)` creation, add:

```python
# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, other_app=app)
```

Change the uvicorn target: In the deployment, run `socket_app` instead of `app` — or wrap via:

```python
# At the very end of main.py
app.mount("/ws", socketio.ASGIApp(sio))
```

- [ ] **Step 5: Commit WebSocket**

```bash
git add backend/app/websocket/ backend/app/main.py backend/requirements.txt
git commit -m "feat(chat): add Socket.IO WebSocket handler with FCM push for offline users"
```

---

### Task 8: Hook group create/join to auto-create chat rooms

**Files:**
- Modify: `backend/app/api/v1/endpoints/groups.py`

- [ ] **Step 1: Add chat room creation hook to group creation**

In `groups.py` `create_group()` function, after `db.commit()` for the new group, add:

```python
from app.services.chat_service import chat_service
chat_service.create_group_chat_room(db, group.sgt_idx, group.sgt_title, [user_id])
```

- [ ] **Step 2: Add chat member hook to group join**

In `groups.py` `join_group()` and `join_group_by_code()` functions, after successful join, add:

```python
from app.services.chat_service import chat_service
chat_service.add_member_to_group_chat(db, group_id, join_request.mt_idx)
```

- [ ] **Step 3: Commit hooks**

```bash
git add backend/app/api/v1/endpoints/groups.py
git commit -m "feat(chat): auto-create chat room on group create, add member on group join"
```

---

### Task 9: Deploy to server

- [ ] **Step 1: Install python-socketio on server**

```bash
ssh smap-v1 "cd /data/wwwroot/smap_next/backend && pip install 'python-socketio[asyncio]==5.11.0'"
```

- [ ] **Step 2: Sync new files to server**

```bash
rsync -avz --exclude='__pycache__' --exclude='.env' --exclude='*.pyc' \
  smap_next/backend/app/models/chat_room.py \
  smap_next/backend/app/models/chat_member.py \
  smap_next/backend/app/models/chat_message.py \
  smap_next/backend/app/schemas/chat.py \
  smap_next/backend/app/api/v1/endpoints/chats.py \
  smap_next/backend/app/services/chat_service.py \
  smap-v1:/data/wwwroot/smap_next/backend/app/

rsync -avz smap_next/backend/app/websocket/ smap-v1:/data/wwwroot/smap_next/backend/app/websocket/
rsync -avz smap_next/backend/app/api/v1/api.py smap-v1:/data/wwwroot/smap_next/backend/app/api/v1/api.py
rsync -avz smap_next/backend/app/api/v1/endpoints/groups.py smap-v1:/data/wwwroot/smap_next/backend/app/api/v1/endpoints/groups.py
rsync -avz smap_next/backend/app/main.py smap-v1:/data/wwwroot/smap_next/backend/app/main.py
rsync -avz smap_next/backend/requirements.txt smap-v1:/data/wwwroot/smap_next/backend/requirements.txt
```

- [ ] **Step 3: Restart backend service**

```bash
ssh smap-v1 "cd /data/wwwroot/smap_next/backend && supervisorctl restart smap-backend"
```

- [ ] **Step 4: Verify API**

```bash
curl -s https://api3.smap.site/api/v1/chats/rooms -H "Authorization: Bearer <test_token>" | python3 -m json.tool
```

Expected: `{"rooms": [...], "total_unread": 0}`

- [ ] **Step 5: Verify WebSocket**

```bash
python3 -c "
import socketio
sio = socketio.Client()
sio.connect('https://api3.smap.site', auth={'token': '<test_token>'}, wait_timeout=5)
print('Connected:', sio.connected)
sio.disconnect()
"
```

Expected: `Connected: True`
