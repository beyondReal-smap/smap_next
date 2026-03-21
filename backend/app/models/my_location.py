from sqlalchemy import Column, Integer, String, DateTime, Numeric, text
from app.models.base import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MyLocation(BaseModel):
    __tablename__ = "smap_location_t"
    __table_args__ = {'extend_existing': True}

    slt_idx = Column(Integer, primary_key=True)
    insert_mt_idx = Column(Integer, nullable=True)
    mt_idx = Column(Integer, nullable=True)
    sgt_idx = Column(Integer, nullable=True)
    sgdt_idx = Column(Integer, nullable=True)
    slt_title = Column(String(50), nullable=True)
    slt_add = Column(String(100), nullable=True)
    slt_lat = Column(Numeric(16, 14), nullable=True)
    slt_long = Column(Numeric(17, 14), nullable=True)
    slt_show = Column(String(1), nullable=True, default='Y')
    slt_enter_chk = Column(String(1), nullable=True, default='N')
    slt_enter_alarm = Column(String(1), nullable=True, default='Y')
    slt_wdate = Column(DateTime, nullable=True)
    slt_udate = Column(DateTime, nullable=True)
    slt_ddate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['MyLocation']:
        """인덱스로 내 장소를 찾습니다."""
        return db.query(cls).filter(cls.slt_idx == idx).first()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['MyLocation']:
        """회원의 모든 내 장소를 찾습니다."""
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.slt_ddate.is_(None)
        ).all()

    @classmethod
    def get_all_active(cls, db: Session) -> List['MyLocation']:
        """활성화된 모든 내 장소를 가져옵니다."""
        try:
            sql = text("""
                SELECT slt_idx, mt_idx, slt_title, slt_lat, slt_long,
                       slt_enter_alarm, slt_enter_chk, slt_wdate, slt_udate, slt_ddate
                FROM smap_location_t
                WHERE slt_ddate IS NULL
                  AND slt_enter_alarm = 'Y'
                  AND slt_show = 'Y'
            """)
            result = db.execute(sql)
            return [dict(row._mapping) for row in result]
        except Exception as e:
            logger.error(f"Error in get_all_active: {e}")
            return []

    @classmethod
    def get_all_active_in(cls, db: Session) -> List['MyLocation']:
        """진입 상태인 활성화된 내 장소들을 가져옵니다."""
        try:
            sql = text("""
                SELECT slt_idx, mt_idx, slt_title, slt_lat, slt_long,
                       slt_enter_alarm, slt_enter_chk, slt_wdate, slt_udate, slt_ddate
                FROM smap_location_t
                WHERE slt_enter_alarm = 'Y'
                  AND slt_enter_chk = 'Y'
                  AND slt_show = 'Y'
            """)
            result = db.execute(sql)
            return [dict(row._mapping) for row in result]
        except Exception as e:
            logger.error(f"Error in get_all_active_in: {e}")
            return []

    @classmethod
    def create(cls, db: Session, **kwargs) -> 'MyLocation':
        """새로운 내 장소를 생성합니다."""
        try:
            my_location = cls(**kwargs)
            my_location.slt_wdate = datetime.now()
            db.add(my_location)
            db.commit()
            db.refresh(my_location)
            return my_location
        except Exception as e:
            logger.error(f"Error creating my location: {e}")
            db.rollback()
            raise

    @classmethod
    def update(cls, db: Session, slt_idx: int, **kwargs) -> Optional['MyLocation']:
        """내 장소를 업데이트합니다."""
        try:
            my_location = cls.find_by_idx(db, slt_idx)
            if my_location:
                for key, value in kwargs.items():
                    if hasattr(my_location, key):
                        setattr(my_location, key, value)
                my_location.slt_udate = datetime.now()
                db.commit()
                db.refresh(my_location)
                return my_location
            return None
        except Exception as e:
            logger.error(f"Error updating my location: {e}")
            db.rollback()
            raise

    @classmethod
    def delete(cls, db: Session, slt_idx: int) -> bool:
        """내 장소를 삭제합니다 (논리 삭제)."""
        try:
            my_location = cls.find_by_idx(db, slt_idx)
            if my_location:
                my_location.slt_ddate = datetime.now()
                db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting my location: {e}")
            db.rollback()
            raise
