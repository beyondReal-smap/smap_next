from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import ShowEnum

class PushFCMBase(BaseModel):
    pft_code: Optional[str] = None
    pft_title: Optional[str] = None
    pft_content: Optional[str] = None
    pft_send_type: Optional[int] = None
    pft_send_mt_idx: Optional[int] = None
    pft_rdate: Optional[datetime] = None
    pft_url: Optional[str] = None
    pft_status: Optional[int] = None
    pft_show: Optional[ShowEnum] = None
    pft_sdate: Optional[datetime] = None
    pft_edate: Optional[datetime] = None

class PushFCMCreate(PushFCMBase):
    pass

class PushFCMUpdate(PushFCMBase):
    pass

class PushFCMResponse(PushFCMBase):
    pft_idx: int
    pft_wdate: Optional[datetime] = None

    class Config:
        from_attributes = True 