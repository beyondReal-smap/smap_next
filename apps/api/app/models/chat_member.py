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
