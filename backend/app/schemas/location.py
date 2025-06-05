from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.enums import FineLocationEnum, LocationCheckEnum, AllDayCheckEnum, ShowEnum, EnterAlarmEnum, EnterCheckEnum

class LocationBase(BaseModel):
    insert_mt_idx: Optional[int] = None
    mt_idx: Optional[int] = None
    sgdt_idx: Optional[int] = None
    slt_title: Optional[str] = None
    slt_add: Optional[str] = None
    slt_lat: Optional[Decimal] = None
    slt_long: Optional[Decimal] = None
    slt_fine_location: Optional[FineLocationEnum] = None
    slt_location_chk: Optional[LocationCheckEnum] = None
    slt_all_day: Optional[AllDayCheckEnum] = None
    slt_show: Optional[ShowEnum] = None
    slt_enter_alarm: Optional[EnterAlarmEnum] = None
    slt_enter_chk: Optional[EnterCheckEnum] = None

class LocationCreate(LocationBase):
    pass

class LocationUpdate(LocationBase):
    pass

class LocationResponse(LocationBase):
    slt_idx: int
    slt_wdate: Optional[datetime] = None
    slt_udate: Optional[datetime] = None
    slt_ddate: Optional[datetime] = None

    class Config:
        from_attributes = True

# 누락된 스키마 클래스들 추가
class LocationData(BaseModel):
    """위치 데이터 스키마"""
    slt_idx: int
    slt_title: Optional[str] = None
    slt_lat: Optional[Decimal] = None
    slt_long: Optional[Decimal] = None
    
    class Config:
        from_attributes = True

class MemberLocation(BaseModel):
    """멤버 위치 스키마"""
    mt_idx: int
    mt_name: Optional[str] = None
    locations: List[LocationData] = []
    
    class Config:
        from_attributes = True

class GroupMemberWithLocations(BaseModel):
    """그룹 멤버와 위치 정보 스키마"""
    group_id: int
    members: List[MemberLocation] = []
    
    class Config:
        from_attributes = True 