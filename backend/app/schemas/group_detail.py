from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import (
    OwnerCheckEnum,
    LeaderCheckEnum,
    DischargeEnum,
    GroupCheckEnum,
    ExitEnum,
    PushCheckEnum,
    InCheckEnum,
    ScheduleCheckEnum,
    ReadCheckEnum,
    EnterAlarmEnum,
    EnterCheckEnum
)

class GroupDetailBase(BaseModel):
    sgt_idx: Optional[int] = None
    mt_idx: Optional[int] = None
    sgdt_owner_chk: Optional[OwnerCheckEnum] = None
    sgdt_leader_chk: Optional[LeaderCheckEnum] = None
    sgdt_discharge_chk: Optional[DischargeEnum] = None
    sgdt_group_chk: Optional[GroupCheckEnum] = None
    sgdt_exit_chk: Optional[ExitEnum] = None
    sgdt_push_chk: Optional[PushCheckEnum] = None
    sgdt_in_chk: Optional[InCheckEnum] = None
    sgdt_schedule_chk: Optional[ScheduleCheckEnum] = None
    sgdt_read_chk: Optional[ReadCheckEnum] = None
    sgdt_enter_alarm: Optional[EnterAlarmEnum] = None
    sgdt_enter_chk: Optional[EnterCheckEnum] = None

class GroupDetailCreate(GroupDetailBase):
    pass

class GroupDetailUpdate(GroupDetailBase):
    pass

class GroupDetailResponse(GroupDetailBase):
    sgdt_idx: int
    sgdt_wdate: Optional[datetime] = None
    sgdt_udate: Optional[datetime] = None

    class Config:
        orm_mode = True 