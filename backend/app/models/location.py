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
    slt_show = Column(Enum(ShowEnum), nullable=True, default=ShowEnum.Y)
    slt_enter_alarm = Column(Enum(EnterAlarmEnum), nullable=True, default=EnterAlarmEnum.Y)
    slt_enter_chk = Column(Enum(EnterCheckEnum), nullable=True, default=EnterCheckEnum.N)
    slt_wdate = Column(DateTime, nullable=True)
    slt_udate = Column(DateTime, nullable=True)
    slt_ddate = Column(DateTime, nullable=True)

    # ── 업데이트 허용 필드 화이트리스트 (식별자/소유자 필드 제외) ──
    ALLOWED_UPDATE_FIELDS = {
        "slt_title", "slt_add", "slt_lat", "slt_long",
        "slt_show", "slt_enter_alarm", "slt_enter_chk",
    }

    # ── 단건 조회 ──

    @classmethod
    def find_by_idx(cls, db: Session, idx: int) -> Optional['Location']:
        """인덱스로 장소를 찾습니다."""
        return db.query(cls).filter(cls.slt_idx == idx).first()

    # ── 목록 조회 ──

    @classmethod
    def find_by_member(cls, db: Session, mt_idx: int) -> List['Location']:
        """회원의 활성 장소를 찾습니다."""
        return db.query(cls).filter(
            cls.mt_idx == mt_idx,
            cls.slt_show == ShowEnum.Y
        ).all()

    @classmethod
    def find_by_group_detail(cls, db: Session, sgdt_idx: int) -> List['Location']:
        """그룹 상세의 활성 장소를 찾습니다."""
        return db.query(cls).filter(
            cls.sgdt_idx == sgdt_idx,
            cls.slt_show == ShowEnum.Y
        ).all()

    @classmethod
    def get_all_active(cls, db: Session) -> List[Dict]:
        """활성화된 모든 장소를 가져옵니다 (알람 활성 & 표시 중)."""
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
    def get_all_active_in(cls, db: Session) -> List[Dict]:
        """진입 상태인 활성화된 장소들을 가져옵니다."""
        try:
            sql = text("""
                SELECT slt_idx, mt_idx, slt_title, slt_lat, slt_long,
                       slt_enter_alarm, slt_enter_chk, slt_wdate, slt_udate, slt_ddate
                FROM smap_location_t
                WHERE slt_ddate IS NULL
                  AND slt_enter_alarm = 'Y'
                  AND slt_enter_chk = 'Y'
                  AND slt_show = 'Y'
            """)
            result = db.execute(sql)
            return [dict(row._mapping) for row in result]
        except Exception as e:
            logger.error(f"Error in get_all_active_in: {e}")
            return []

    @classmethod
    def get_in_myplays_list(cls, db: Session) -> List[Dict]:
        """진입 알림 대상 장소 목록 (미진입 상태)을 가져옵니다."""
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
        """이탈 알림 대상 장소 목록 (진입 완료 상태, 오늘)을 가져옵니다."""
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

    # ── CUD 메서드 ──

    @classmethod
    def create(cls, db: Session, **kwargs) -> 'Location':
        """새로운 장소를 생성합니다. 호출자가 db.commit()을 관리합니다."""
        location = cls(**kwargs)
        location.slt_wdate = datetime.now()
        db.add(location)
        db.flush()
        return location

    @classmethod
    def update(cls, db: Session, slt_idx: int, **kwargs) -> Optional['Location']:
        """장소를 업데이트합니다. 호출자가 db.commit()을 관리합니다."""
        location = cls.find_by_idx(db, slt_idx)
        if location:
            for key, value in kwargs.items():
                if key in cls.ALLOWED_UPDATE_FIELDS:
                    setattr(location, key, value)
            location.slt_udate = datetime.now()
            db.flush()
            return location
        return None

    @classmethod
    def delete(cls, db: Session, slt_idx: int) -> bool:
        """장소를 삭제합니다 (논리 삭제). 호출자가 db.commit()을 관리합니다."""
        location = cls.find_by_idx(db, slt_idx)
        if location:
            location.slt_ddate = datetime.now()
            db.flush()
            return True
        return False
