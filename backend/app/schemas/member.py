from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MemberBase(BaseModel):
    mb_id: str
    mb_name: str
    mb_nick: Optional[str] = None
    mb_email: Optional[str] = None
    mb_hp: Optional[str] = None
    mb_level: int = 1
    mb_status: str = "active"
    mb_group: Optional[int] = None
    mb_location: Optional[int] = None

class MemberCreate(MemberBase):
    mb_password: str

class MemberUpdate(BaseModel):
    mb_name: Optional[str] = None
    mb_nick: Optional[str] = None
    mb_email: Optional[str] = None
    mb_hp: Optional[str] = None
    mb_level: Optional[int] = None
    mb_status: Optional[str] = None
    mb_group: Optional[int] = None
    mb_location: Optional[int] = None
    mb_password: Optional[str] = None

class MemberResponse(MemberBase):
    mb_idx: int
    mb_datetime: datetime
    mb_ip: str
    mb_last_login: Optional[datetime] = None
    mb_last_ip: Optional[str] = None

    class Config:
        from_attributes = True 