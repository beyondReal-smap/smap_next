from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import ShowEnum

class GroupBase(BaseModel):
    mt_idx: Optional[int] = None
    sgt_title: Optional[str] = None
    sgt_code: Optional[str] = None
    sgt_memo: Optional[str] = None
    sgt_show: Optional[ShowEnum] = None

class GroupCreate(GroupBase):
    pass

class GroupUpdate(GroupBase):
    pass

class GroupResponse(GroupBase):
    sgt_idx: int
    sgt_wdate: Optional[datetime] = None
    sgt_udate: Optional[datetime] = None

    class Config:
        from_attributes = True 