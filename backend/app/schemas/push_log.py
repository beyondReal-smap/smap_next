from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import ReadCheckEnum, ShowEnum

class PushLogBase(BaseModel):
    plt_type: Optional[int] = None
    mt_idx: Optional[int] = None
    sst_idx: Optional[int] = None
    plt_condition: Optional[str] = None
    plt_memo: Optional[str] = None
    plt_title: Optional[str] = None
    plt_content: Optional[str] = None
    plt_sdate: Optional[datetime] = None
    plt_status: Optional[int] = None
    plt_read_chk: Optional[ReadCheckEnum] = None
    plt_show: Optional[ShowEnum] = None
    push_json: Optional[str] = None

class PushLogCreate(PushLogBase):
    pass

class PushLogUpdate(PushLogBase):
    pass

class PushLogResponse(PushLogBase):
    plt_idx: int
    plt_wdate: Optional[datetime] = None
    plt_rdate: Optional[datetime] = None

    class Config:
        from_attributes = True 