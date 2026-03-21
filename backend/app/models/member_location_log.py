from sqlalchemy import Column, Integer, DECIMAL, Float, Enum, SmallInteger, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import Session
from .base import Base
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)

class MemberLocationLog(Base):
    __tablename__ = "member_location_log_t"
    
    mlt_idx = Column(Integer, primary_key=True, autoincrement=True, comment='위치로그 인덱스')
    mt_idx = Column(Integer, nullable=False, comment='회원 인덱스')
    mlt_lat = Column(DECIMAL(16, 14), comment='위도')
    mlt_long = Column(DECIMAL(17, 14), comment='경도')
    mlt_accuacy = Column(Float, comment='위치값(수평 정확도)')
    mlt_speed = Column(Float, comment='속도(m/s)')
    mlt_battery = Column(SmallInteger, comment='배터리')
    mlt_fine_location = Column(Enum('Y', 'N'), default='Y', comment='위치정확도')
    mlt_location_chk = Column(Enum('Y', 'N'), default='Y', comment='위치정보허용여부')
    mt_health_work = Column(SmallInteger, comment='걸음수')
    mlt_gps_time = Column(DateTime, nullable=False, comment='GPS 시간')
    mlt_wdate = Column(DateTime, default=func.now(), comment='등록일시')
    stay_lat = Column(DECIMAL(16, 14), comment='체류 중심위도')
    stay_long = Column(DECIMAL(17, 14), comment='체류 중심경도')
    
    def to_dict(self):
        """모델을 딕셔너리로 변환"""
        return {
            'mlt_idx': self.mlt_idx,
            'mt_idx': self.mt_idx,
            'mlt_lat': float(self.mlt_lat) if self.mlt_lat else None,
            'mlt_long': float(self.mlt_long) if self.mlt_long else None,
            'mlt_accuacy': self.mlt_accuacy,
            'mlt_speed': self.mlt_speed,
            'mlt_battery': self.mlt_battery,
            'mlt_fine_location': self.mlt_fine_location,
            'mlt_location_chk': self.mlt_location_chk,
            'mt_health_work': self.mt_health_work,
            'mlt_gps_time': self.mlt_gps_time.isoformat() if self.mlt_gps_time else None,
            'mlt_wdate': self.mlt_wdate.isoformat() if self.mlt_wdate else None,
            'stay_lat': float(self.stay_lat) if self.stay_lat else None,
            'stay_long': float(self.stay_long) if self.stay_long else None
        }
    
    @classmethod
    def get_recent_location(cls, db: Session, mt_idx: int) -> Optional['MemberLocationLog']:
        """회원의 최근 위치 로그를 가져옵니다."""
        return db.query(cls).filter(
            cls.mt_idx == mt_idx
        ).order_by(cls.mlt_wdate.desc()).first()
    
    @classmethod
    def getDistance(cls, db: Session, lat: str, long: str, mt_idx: str) -> Optional[Dict]:
        """회원의 위치와 특정 좌표 사이의 거리를 계산합니다."""
        try:
            # 회원의 최근 위치 로그 가져오기
            recent_location = cls.get_recent_location(db, int(mt_idx))
            if not recent_location:
                return None
            
            # 거리 계산 (간단한 유클리드 거리)
            from math import sqrt
            member_lat = float(recent_location.mlt_lat) if recent_location.mlt_lat else 0
            member_long = float(recent_location.mlt_long) if recent_location.mlt_long else 0
            target_lat = float(lat) if lat else 0
            target_long = float(long) if long else 0
            
            # 위도/경도 차이를 미터로 변환 (대략적인 계산)
            lat_diff = (member_lat - target_lat) * 111000  # 1도 = 약 111km
            long_diff = (member_long - target_long) * 111000 * 0.5  # 경도는 위도에 따라 조정
            
            distance = sqrt(lat_diff**2 + long_diff**2)
            
            return {
                'distance': distance,
                'member_lat': member_lat,
                'member_long': member_long,
                'target_lat': target_lat,
                'target_long': target_long
            }
        except Exception as e:
            logger.error(f"Error in getDistance: {e}")
            return None