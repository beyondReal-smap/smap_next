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

            unread = db.query(ChatMessage).filter(
                ChatMessage.scr_idx == room.scr_idx,
                ChatMessage.scmsg_idx > last_read,
                ChatMessage.scmsg_show == ShowEnum.Y
            ).count()
            total_unread += unread

            latest = ChatMessage.get_latest(db, room.scr_idx)
            member_count = len(ChatMember.get_room_members(db, room.scr_idx))

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
    def get_messages(db: Session, scr_idx: int, mt_idx: int, before_idx: Optional[int] = None, limit: int = 50) -> Optional[List[Dict]]:
        membership = ChatMember.find_membership(db, scr_idx, mt_idx)
        if not membership:
            return None

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
        db.flush()

        room = ChatRoom.find_by_idx(db, scr_idx)
        if room:
            room.scr_udate = datetime.utcnow()

        membership.scm_last_read_idx = msg.scmsg_idx
        db.commit()
        db.refresh(msg)

        sender = db.query(Member).filter(Member.mt_idx == mt_idx).first()
        members = ChatMember.get_room_members(db, scr_idx)
        unread = len(members) - 1

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
        room = ChatRoom.find_by_group(db, sgt_idx)
        if not room:
            return
        membership = ChatMember.find_membership(db, room.scr_idx, mt_idx)
        if membership:
            membership.scm_show = ShowEnum.N
            db.commit()


chat_service = ChatService()
