from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.enums import (
    AllDayCheckEnum,
    ShowEnum,
    ScheduleAlarmCheckEnum,
    InCheckEnum,
    ScheduleCheckEnum
)

class ScheduleBase(BaseModel):
    sst_pidx: Optional[int] = None
    mt_idx: Optional[int] = None
    sst_title: Optional[str] = None
    sst_sdate: Optional[datetime] = None
    sst_edate: Optional[datetime] = None
    sst_sedate: Optional[str] = None
    sst_all_day: Optional[AllDayCheckEnum] = None
    sst_repeat_json: Optional[str] = None
    sst_repeat_json_v: Optional[str] = None
    sgt_idx: Optional[int] = None
    sgdt_idx: Optional[int] = None
    sgdt_idx_t: Optional[str] = None
    sst_alram: Optional[int] = None
    sst_alram_t: Optional[str] = None
    sst_adate: Optional[datetime] = None
    slt_idx: Optional[int] = None
    slt_idx_t: Optional[str] = None
    sst_location_title: Optional[str] = None
    sst_location_add: Optional[str] = None
    sst_location_lat: Optional[Decimal] = None
    sst_location_long: Optional[Decimal] = None
    sst_supplies: Optional[str] = None
    sst_memo: Optional[str] = None
    sst_show: Optional[ShowEnum] = None
    sst_location_alarm: Optional[int] = None
    sst_schedule_alarm_chk: Optional[ScheduleAlarmCheckEnum] = None
    sst_pick_type: Optional[str] = None
    sst_pick_result: Optional[int] = None
    sst_schedule_alarm: Optional[datetime] = None
    sst_update_chk: Optional[str] = None
    sst_in_chk: Optional[InCheckEnum] = None
    sst_schedule_chk: Optional[ScheduleCheckEnum] = None
    sst_entry_cnt: Optional[int] = None
    sst_exit_cnt: Optional[int] = None

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(ScheduleBase):
    pass

class ScheduleResponse(ScheduleBase):
    sst_idx: int
    sst_wdate: Optional[datetime] = None
    sst_udate: Optional[datetime] = None
    sst_ddate: Optional[datetime] = None

    class Config:
        orm_mode = True 