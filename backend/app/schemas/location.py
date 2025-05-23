from typing import Optional
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
        orm_mode = True 