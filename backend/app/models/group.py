from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List

class Group(BaseModel):
    __tablename__ = "smap_group_t"

    sgt_idx = Column(Integer, primary_key=True)
    mt_idx = Column(Integer, nullable=True)
    sgt_title = Column(String(50), nullable=True)
    sgt_code = Column(String(10), nullable=True)
    sgt_memo = Column(Text, nullable=True)
    sgt_show = Column(Enum(ShowEnum), nullable=True)
    sgt_wdate = Column(DateTime, nullable=True)
    sgt_udate = Column(DateTime, nullable=True)

    @classmethod
    def get_group_count(cls, db: Session, mt_idx: int) -> int:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sgt_show == ShowEnum.Y
        ).count()

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Group']:
        return db.query(cls).filter(cls.sgt_idx == idx).first()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['Group']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sgt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_code(cls, db: Session, code: str) -> Optional['Group']:
        return db.query(cls).filter(cls.sgt_code == code).first() 