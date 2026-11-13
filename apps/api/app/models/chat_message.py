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
