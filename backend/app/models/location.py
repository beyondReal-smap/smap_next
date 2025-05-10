from sqlalchemy import Column, Integer, String, DateTime, Numeric, Enum, text
from app.models.base import BaseModel
from app.models.enums import ShowEnum, EnterAlarmEnum, EnterCheckEnum
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class Location(BaseModel):
    __tablename__ = "smap_location_t"

    slt_idx = Column(Integer, primary_key=True)
    insert_mt_idx = Column(Integer, nullable=True)
    mt_idx = Column(Integer, nullable=True)
    sgdt_idx = Column(Integer, nullable=True)
    slt_title = Column(String(50), nullable=True)
    slt_add = Column(String(100), nullable=True)
    slt_lat = Column(Numeric(16, 14), nullable=True)
    slt_long = Column(Numeric(17, 14), nullable=True)
    slt_show = Column(Enum(ShowEnum), nullable=True)
    slt_enter_alarm = Column(Enum(EnterAlarmEnum), nullable=True)
    slt_enter_chk = Column(Enum(EnterCheckEnum), nullable=True)
    slt_wdate = Column(DateTime, nullable=True)
    slt_udate = Column(DateTime, nullable=True)
    slt_ddate = Column(DateTime, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Location']:
        return db.query(cls).filter(cls.slt_idx == idx).first()

    @classmethod
    def get_in_myplays_list(cls, db: Session) -> List[Dict]:
        try:
            from app.models.member import Member
            sql = text("""
                SELECT slt.slt_idx, slt.insert_mt_idx, slt.mt_idx, slt.sgdt_idx, 
                       slt.slt_title, slt.slt_add, slt.slt_lat, slt.slt_long, 
                       slt.slt_show, 
                       CASE slt.slt_enter_alarm WHEN 'Y' THEN 'Y' ELSE 'N' END AS slt_enter_alarm,
                       CASE slt.slt_enter_chk WHEN 'Y' THEN 'Y' ELSE 'N' END AS slt_enter_chk,
                       slt.slt_wdate, slt.slt_udate, slt.slt_ddate, mt.mt_lang
                FROM smap_location_t slt
                JOIN member_t mt ON slt.mt_idx = mt.mt_idx
                WHERE slt.slt_show = 'Y'
                  AND slt.slt_enter_chk = 'N'
            """)
            result = db.execute(sql)
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error in get_in_myplays_list: {e}")
            return []

    @classmethod
    def get_out_myplays_list(cls, db: Session) -> List[Dict]:
        try:
            sql = text("""
                SELECT slt_idx, insert_mt_idx, mt_idx, sgdt_idx, slt_title, slt_add, 
                       slt_lat, slt_long, slt_show, 
                       CASE slt_enter_alarm WHEN 'Y' THEN 'Y' ELSE 'N' END AS slt_enter_alarm,
                       CASE slt_enter_chk WHEN 'Y' THEN 'Y' ELSE 'N' END AS slt_enter_chk,
                       slt_wdate, slt_udate, slt_ddate
                FROM smap_location_t
                WHERE slt_show = 'Y'
                  AND slt_enter_chk = 'Y'
                  AND DATE(slt_udate) = CURDATE()
            """)
            result = db.execute(sql)
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error in get_out_myplays_list: {e}")
            return []

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['Location']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.slt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_group_detail(cls, db: Session, sgdt_idx: int) -> List['Location']:
        return db.query(cls).filter(
            cls.sgdt_idx == sgdt_idx,
            cls.slt_show == ShowEnum.Y
        ).all() 