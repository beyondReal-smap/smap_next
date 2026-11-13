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

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=settings.BACKEND_CORS_ORIGINS)

# Track online users: {sid: mt_idx}
connected_users: dict = {}
# Track which room each sid is viewing: {sid: scr_idx}
active_rooms: dict = {}


def get_mt_idx_from_token(token: str):
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

        # Serialize datetime for JSON
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
    try:
        from app.services.push_service import send_push
    except ImportError:
        logger.warning("[WS] push_service not available, skipping FCM")
        return

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
