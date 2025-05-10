from sqlalchemy import Column, Integer, String, DateTime, Numeric, Enum, Text, text
from app.models.base import BaseModel
from app.models.enums import (
    AllDayCheckEnum,
    ShowEnum,
    ScheduleAlarmCheckEnum,
    InCheckEnum,
    ScheduleCheckEnum
)
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime, timedelta

class Schedule(BaseModel):
    __tablename__ = "smap_schedule_t"

    sst_idx = Column(Integer, primary_key=True)
    sst_pidx = Column(Integer, nullable=True)
    mt_idx = Column(Integer, nullable=True)
    sst_title = Column(String(100), nullable=True)
    sst_sdate = Column(DateTime, nullable=True)
    sst_edate = Column(DateTime, nullable=True)
    sst_sedate = Column(String(100), nullable=True)
    sst_all_day = Column(Enum(AllDayCheckEnum), nullable=True)
    sst_repeat_json = Column(String(200), nullable=True)
    sst_repeat_json_v = Column(String(200), nullable=True)
    sgt_idx = Column(Integer, nullable=True)
    sgdt_idx = Column(Integer, nullable=True)
    sgdt_idx_t = Column(String(100), nullable=True)
    sst_alram = Column(Integer, nullable=True)
    sst_alram_t = Column(String(100), nullable=True)
    sst_adate = Column(DateTime, nullable=True)
    slt_idx = Column(Integer, nullable=True)
    slt_idx_t = Column(String(100), nullable=True)
    sst_location_title = Column(String(50), nullable=True)
    sst_location_add = Column(String(100), nullable=True)
    sst_location_lat = Column(Numeric(16, 14), nullable=True)
    sst_location_long = Column(Numeric(17, 14), nullable=True)
    sst_supplies = Column(String(200), nullable=True)
    sst_memo = Column(Text, nullable=True)
    sst_show = Column(Enum(ShowEnum), nullable=True)
    sst_location_alarm = Column(Integer, nullable=True)
    sst_schedule_alarm_chk = Column(Enum(ScheduleAlarmCheckEnum), nullable=True)
    sst_pick_type = Column(String(20), nullable=True)
    sst_pick_result = Column(Integer, nullable=True)
    sst_schedule_alarm = Column(DateTime, nullable=True)
    sst_update_chk = Column(String(10), nullable=True)
    sst_wdate = Column(DateTime, nullable=True)
    sst_udate = Column(DateTime, nullable=True)
    sst_ddate = Column(DateTime, nullable=True)
    sst_in_chk = Column(Enum(InCheckEnum), nullable=True)
    sst_schedule_chk = Column(Enum(ScheduleCheckEnum), nullable=True)
    sst_entry_cnt = Column(Integer, nullable=True)
    sst_exit_cnt = Column(Integer, nullable=True)

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Schedule']:
        return db.query(cls).filter(cls.sst_idx == idx).first()

    @classmethod
    def get_now_schedule_in_members(cls, db: Session) -> List[Dict]:
        try:
            from app.models.member import Member
            sql = text("""
                SELECT sst.*, mt.mt_lang as mt_lang
                FROM smap_schedule_t sst
                LEFT JOIN member_t mt ON sst.mt_idx = mt.mt_idx
                WHERE NOW() BETWEEN 
                    LEAST(
                        DATE_SUB(sst.sst_sdate, INTERVAL 30 MINUTE),
                        IFNULL(sst.sst_adate, sst.sst_sdate)
                    ) AND sst.sst_edate 
                AND (sst.sst_location_alarm = 1 OR sst.sst_location_alarm = 4) 
                AND sst.sst_in_chk = 'N' 
                AND sst.sst_entry_cnt = 0 
                AND sst.sst_show = 'Y'
            """)
            result = db.execute(sql)
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error in get_now_schedule_in_members: {e}")
            return []

    @classmethod
    def get_now_schedule_out_members(cls, db: Session) -> List[Dict]:
        try:
            from app.models.member import Member
            sql = text("""
                SELECT sst.*, mt.mt_lang as mt_lang
                FROM smap_schedule_t sst
                LEFT JOIN member_t mt ON sst.mt_idx = mt.mt_idx
                WHERE NOW() BETWEEN sst.sst_sdate AND sst.sst_edate 
                AND (sst.sst_location_alarm = 2 OR sst.sst_location_alarm = 4) 
                AND sst.sst_in_chk = 'Y' 
                AND sst.sst_exit_cnt = 0 
                AND sst.sst_show = 'Y'
            """)
            result = db.execute(sql)
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error in get_now_schedule_out_members: {e}")
            return []

    @classmethod
    def get_now_schedule_push(cls, db: Session) -> List['Schedule']:
        now = datetime.now()
        today1 = now.replace(second=0, microsecond=0)
        today2 = today1 + timedelta(minutes=1) - timedelta(seconds=1)

        return db.query(cls).filter(
            cls.sst_schedule_alarm.between(today1, today2),
            cls.sst_schedule_alarm_chk == ScheduleAlarmCheckEnum.Y,
            cls.sst_schedule_chk == ScheduleCheckEnum.N,
            cls.sst_show == ShowEnum.Y
        ).all()

    @classmethod
    def get_schedule_before_30min(cls, db: Session) -> List['Schedule']:
        before30 = datetime.now() + timedelta(minutes=30)
        before30 = before30.strftime('%Y-%m-%d %H:%M:00')
        return db.query(cls).filter(
            cls.sst_sdate == before30,
            cls.sst_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['Schedule']:
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.sst_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_group(cls, db: Session, sgt_idx: int) -> List['Schedule']:
        return db.query(cls).filter(
            cls.sgt_idx == sgt_idx,
            cls.sst_show == ShowEnum.Y
        ).all() 