from sqlalchemy import Column, Integer, String, DateTime, Enum
from app.models.base import BaseModel
from app.models.enums import ReadCheckEnum, ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List

class PushLog(BaseModel):
    __tablename__ = "push_log_t"

    plt_idx = Column(Integer, primary_key=True)
    plt_type = Column(Integer, nullable=True)
    mt_idx = Column(Integer, nullable=True)
    sst_idx = Column(Integer, nullable=True)
    plt_condition = Column(String(50), nullable=True)
    plt_memo = Column(String(50), nullable=True)
    plt_title = Column(String(50), nullable=True)
    plt_content = Column(String(200), nullable=True)
    plt_sdate = Column(DateTime, nullable=True)
    plt_status = Column(Integer, nullable=True)
    plt_read_chk = Column(Enum(ReadCheckEnum), nullable=True)
    plt_show = Column(Enum(ShowEnum), nullable=True)
    push_json = Column(String(255), nullable=True)
    plt_wdate = Column(DateTime, nullable=True)
    plt_rdate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['PushLog']:
        return db.query(cls).filter(cls.plt_idx == idx).first()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['PushLog']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.plt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_schedule(cls, db: Session, sst_idx: int) -> List['PushLog']:
        return db.query(cls).filter(
            cls.sst_idx == sst_idx,
            cls.plt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_unread(cls, db: Session, mt_idx: int) -> List['PushLog']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.plt_read_chk == ReadCheckEnum.N,
            cls.plt_show == ShowEnum.Y
        ).all() 