from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class MemberLocationLogBase(BaseModel):
    """위치 로그 기본 스키마"""
    mt_idx: int
    mlt_lat: Optional[float] = None
    mlt_long: Optional[float] = None
    mlt_accuacy: Optional[float] = None
    mlt_speed: Optional[float] = None
    mlt_battery: Optional[int] = None
    mlt_fine_location: Optional[str] = 'Y'
    mlt_location_chk: Optional[str] = 'Y'
    mt_health_work: Optional[int] = None
    mlt_gps_time: datetime
    stay_lat: Optional[float] = None
    stay_long: Optional[float] = None

class MemberLocationLogCreate(MemberLocationLogBase):
    """위치 로그 생성 스키마"""
    pass

class MemberLocationLogUpdate(BaseModel):
    """위치 로그 업데이트 스키마"""
    mlt_lat: Optional[float] = None
    mlt_long: Optional[float] = None
    mlt_accuacy: Optional[float] = None
    mlt_speed: Optional[float] = None
    mlt_battery: Optional[int] = None
    mlt_fine_location: Optional[str] = None
    mlt_location_chk: Optional[str] = None
    mt_health_work: Optional[int] = None
    stay_lat: Optional[float] = None
    stay_long: Optional[float] = None

class MemberLocationLogResponse(MemberLocationLogBase):
    """위치 로그 응답 스키마"""
    mlt_idx: int
    mlt_wdate: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class LocationLogListRequest(BaseModel):
    """위치 로그 목록 요청 스키마"""
    mt_idx: int
    start_date: Optional[str] = None  # YYYY-MM-DD 형식
    end_date: Optional[str] = None    # YYYY-MM-DD 형식
    limit: Optional[int] = 100
    offset: Optional[int] = 0

class LocationSummaryResponse(BaseModel):
    """위치 로그 요약 응답 스키마"""
    total_distance: float  # 총 이동거리 (km)
    total_time: int        # 총 이동시간 (분)
    total_steps: int       # 총 걸음수
    average_speed: float   # 평균 속도 (km/h)
    battery_usage: int     # 배터리 사용량
    log_count: int         # 로그 개수

class LocationPathResponse(BaseModel):
    """위치 경로 응답 스키마"""
    points: List[dict]  # 위치 포인트 목록
    summary: LocationSummaryResponse 