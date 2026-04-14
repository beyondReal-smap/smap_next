from sqlalchemy import Column, Integer, String, DateTime, Enum, func
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
        from app.models.chat_member import ChatMember
        subq = db.query(ChatMember.scr_idx).filter(
            ChatMember.mt_idx.in_([mt_idx_1, mt_idx_2]),
            ChatMember.scm_show == ShowEnum.Y
        ).group_by(ChatMember.scr_idx).having(
            func.count(ChatMember.mt_idx) == 2
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
