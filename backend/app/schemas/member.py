from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MemberBase(BaseModel):
    mt_type: Optional[int] = None
    mt_level: Optional[int] = None
    mt_status: Optional[int] = None
    mt_id: str
    mt_name: Optional[str] = None
    mt_nickname: Optional[str] = None
    mt_hp: Optional[str] = None
    mt_email: Optional[str] = None
    mt_show: Optional[str] = 'Y'
    mt_lang: Optional[str] = 'ko'
    mt_lat: Optional[float] = None
    mt_long: Optional[float] = None
    mt_sido: Optional[str] = None
    mt_gu: Optional[str] = None
    mt_dong: Optional[str] = None
    mt_file1: Optional[str] = None

class MemberCreate(MemberBase):
    mt_pwd: Optional[str] = None

class MemberUpdate(BaseModel):
    mt_type: Optional[int] = None
    mt_level: Optional[int] = None
    mt_status: Optional[int] = None
    mt_name: Optional[str] = None
    mt_nickname: Optional[str] = None
    mt_hp: Optional[str] = None
    mt_email: Optional[str] = None
    mt_pwd: Optional[str] = None
    mt_show: Optional[str] = None
    mt_lang: Optional[str] = None
    mt_lat: Optional[float] = None
    mt_long: Optional[float] = None
    mt_sido: Optional[str] = None
    mt_gu: Optional[str] = None
    mt_dong: Optional[str] = None
    mt_file1: Optional[str] = None

class MemberResponse(MemberBase):
    mt_idx: int
    mt_token_id: Optional[str] = None
    mt_gender: Optional[int] = None
    mt_wdate: Optional[datetime] = None
    mt_ldate: Optional[datetime] = None
    mt_udate: Optional[datetime] = None
    mt_weather_pop: Optional[int] = None
    mt_weather_tmn: Optional[int] = None
    mt_weather_tmx: Optional[int] = None
    mt_weather_sky: Optional[int] = None
    mt_weather_date: Optional[datetime] = None

    class Config:
        from_attributes = True 