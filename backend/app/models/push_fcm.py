from sqlalchemy import Column, Integer, String, DateTime, Enum
from app.models.base import BaseModel
from app.models.enums import ShowEnum
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

class PushFCM(BaseModel):
    __tablename__ = "push_fcm_t"

    pft_idx = Column(Integer, primary_key=True)
    pft_code = Column(String(20), nullable=True)
    pft_title = Column(String(100), nullable=True)
    pft_content = Column(String(200), nullable=True)
    pft_send_type = Column(Integer, nullable=True)
    pft_send_mt_idx = Column(Integer, nullable=True)
    pft_rdate = Column(DateTime, nullable=True)
    pft_url = Column(String(255), nullable=True)
    pft_status = Column(Integer, nullable=True)
    pft_show = Column(Enum(ShowEnum), nullable=True)
    pft_sdate = Column(DateTime, nullable=True)
    pft_edate = Column(DateTime, nullable=True)
    pft_wdate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['PushFCM']:
        return db.query(cls).filter(cls.pft_idx == idx).first()

    @classmethod
    def find_push_list(cls, db: Session) -> List['PushFCM']:
        now = datetime.now()
        pft_rdate = now.strftime('%Y-%m-%d %H:00:00')
        return db.query(cls).filter(
            cls.pft_rdate == pft_rdate,
            cls.pft_show == ShowEnum.Y,
            cls.pft_status == 1
        ).all()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['PushFCM']:
        return db.query(cls).filter(
            cls.pft_send_mt_idx == mt_idx,
            cls.pft_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_code(cls, db: Session, code: str) -> List['PushFCM']:
        return db.query(cls).filter(
            cls.pft_code == code,
            cls.pft_show == ShowEnum.Y
        ).all() 