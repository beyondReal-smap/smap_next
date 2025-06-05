from sqlalchemy import Column, Integer, DECIMAL, Float, Enum, SmallInteger, DateTime
from sqlalchemy.sql import func
from .base import Base

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