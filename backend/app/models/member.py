from sqlalchemy import Column, Integer, String, DateTime, Numeric, text
from app.models.base import BaseModel
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, List

class Member(BaseModel):
    __tablename__ = "member_t"

    mt_idx = Column(Integer, primary_key=True)
    mt_level = Column(Integer, nullable=True)
    mt_status = Column(Integer, nullable=True)
    mt_id = Column(String(200), unique=True, nullable=False)
    mt_token_id = Column(String(255), nullable=True)
    mt_name = Column(String(50), nullable=True)
    mt_nickname = Column(String(50), nullable=True)
    mt_wdate = Column(DateTime, nullable=True)
    mt_lat = Column(Numeric(16, 14), nullable=True)
    mt_long = Column(Numeric(17, 14), nullable=True)
    mt_sido = Column(String(20), nullable=True)
    mt_gu = Column(String(20), nullable=True)
    mt_dong = Column(String(20), nullable=True)
    mt_weather_pop = Column(Integer, nullable=True)
    mt_weather_tmn = Column(Integer, nullable=True)
    mt_weather_tmx = Column(Integer, nullable=True)
    mt_weather_sky = Column(Integer, nullable=True)
    mt_weather_date = Column(DateTime, nullable=True)
    mt_udate = Column(DateTime, nullable=True)
    mt_lang = Column(String(2), nullable=True)
    mt_email = Column(String(200), nullable=True)

    @classmethod
    def find_by_email(cls, db: Session, email: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_email == email).first()

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_idx == idx).first()

    @classmethod
    def find_by_id(cls, db: Session, member_id: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_id == member_id).first()

    @classmethod
    def find_by_token(cls, db: Session, token: str) -> Optional['Member']:
        return db.query(cls).filter(cls.mt_token_id == token).first()

    @classmethod
    def get_not_join_group_11(cls, db: Session) -> List['Member']:
        before_11 = datetime.now() + datetime.timedelta(days=-11)
        before_11_sday = before_11.strftime("%Y-%m-%d 00:00:00")
        before_11_eday = before_11.strftime("%Y-%m-%d 23:59:59")

        sql = text("""
            SELECT a1.*, a2.sgdt_owner_chk 
            FROM member_t a1 
            LEFT JOIN smap_group_detail_t a2 ON a1.mt_idx = a2.mt_idx
            WHERE (a1.mt_level = 2 AND a1.mt_wdate BETWEEN :start_date AND :end_date)
            AND (a2.sgdt_owner_chk = 'Y' AND a2.sgdt_discharge = 'N' 
                 AND a2.sgdt_exit = 'N' AND a2.sgdt_show = 'Y')
            GROUP BY a1.mt_idx
        """)
        
        return db.execute(sql, {
            "start_date": before_11_sday,
            "end_date": before_11_eday
        }).fetchall()

    @classmethod
    def get_token_list(cls, db: Session) -> List['Member']:
        return db.query(cls).filter(
            cls.mt_level > 1,
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != "",
            cls.mt_status == 1
        ).all()

    @classmethod
    def get_sign_in_3(cls, db: Session) -> List['Member']:
        before3h_start = datetime.now() + datetime.timedelta(hours=-3)
        before3h_end = before3h_start + datetime.timedelta(hours=1)
        now_stime = before3h_start.strftime("%Y-%m-%d %H:%M:%S")
        now_etime = before3h_end.strftime("%Y-%m-%d %H:%M:%S")
        
        return db.query(cls).filter(
            cls.mt_wdate.between(now_stime, now_etime),
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != ""
        ).all()

    @classmethod
    def get_sign_in_24(cls, db: Session) -> List['Member']:
        before24h_start = datetime.now() + datetime.timedelta(hours=-24)
        before24h_end = before24h_start + datetime.timedelta(hours=1)
        now_stime = before24h_start.strftime("%Y-%m-%d %H:%M:%S")
        now_etime = before24h_end.strftime("%Y-%m-%d %H:%M:%S")
        
        return db.query(cls).filter(
            cls.mt_wdate.between(now_stime, now_etime),
            cls.mt_token_id.isnot(None),
            cls.mt_token_id != ""
        ).all() 