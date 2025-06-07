from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime, date
from enum import Enum

class YNEnum(str, Enum):
    Y = "Y"
    N = "N"

class MemberBase(BaseModel):
    mt_type: Optional[int] = 1
    mt_level: Optional[int] = 2
    mt_status: Optional[int] = 1
    mt_id: str
    mt_name: str
    mt_nickname: str
    mt_hp: Optional[str] = None
    mt_email: Optional[str] = None
    mt_birth: Optional[date] = None
    mt_gender: Optional[int] = None
    mt_show: Optional[YNEnum] = YNEnum.Y
    mt_agree1: Optional[YNEnum] = YNEnum.N
    mt_agree2: Optional[YNEnum] = YNEnum.N
    mt_agree3: Optional[YNEnum] = YNEnum.N
    mt_agree4: Optional[YNEnum] = YNEnum.N
    mt_agree5: Optional[YNEnum] = YNEnum.N
    mt_push1: Optional[YNEnum] = YNEnum.N
    mt_lat: Optional[float] = None
    mt_long: Optional[float] = None
    mt_onboarding: Optional[YNEnum] = YNEnum.N

class MemberCreate(MemberBase):
    mt_pwd: str
    
    @validator('mt_email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('올바른 이메일 형식이 아닙니다.')
        return v
    
    @validator('mt_id')
    def validate_phone(cls, v):
        if not v:
            raise ValueError('전화번호는 필수입니다.')
        # 전화번호 형식 검증 (하이픈 제거 후)
        clean_phone = v.replace('-', '')
        if not clean_phone.isdigit() or len(clean_phone) < 10:
            raise ValueError('올바른 전화번호 형식이 아닙니다.')
        return clean_phone

class MemberUpdate(BaseModel):
    mt_name: Optional[str] = None
    mt_nickname: Optional[str] = None
    mt_email: Optional[str] = None
    mt_birth: Optional[date] = None
    mt_gender: Optional[int] = None
    mt_lat: Optional[float] = None
    mt_long: Optional[float] = None
    mt_push1: Optional[YNEnum] = None
    mt_file1: Optional[str] = None

class MemberResponse(MemberBase):
    mt_idx: int
    mt_file1: Optional[str] = None
    mt_wdate: Optional[datetime] = None
    mt_ldate: Optional[datetime] = None
    mt_udate: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class MemberLogin(BaseModel):
    mt_id: str  # 전화번호 또는 이메일
    mt_pwd: str

class MemberLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 회원가입 요청 스키마 (프론트엔드와 호환)
class RegisterRequest(BaseModel):
    mt_type: Optional[int] = 1
    mt_level: Optional[int] = 2
    mt_status: Optional[int] = 1
    mt_id: str  # 전화번호
    mt_pwd: str
    mt_name: str
    mt_nickname: str
    mt_email: Optional[str] = None
    mt_birth: Optional[str] = None  # YYYY-MM-DD 형식
    mt_gender: Optional[int] = None
    mt_onboarding: Optional[str] = "N"
    mt_show: Optional[str] = "Y"
    mt_agree1: bool
    mt_agree2: bool
    mt_agree3: bool
    mt_agree4: Optional[bool] = False
    mt_agree5: Optional[bool] = False
    mt_push1: Optional[bool] = True
    mt_lat: Optional[float] = None
    mt_long: Optional[float] = None

class RegisterResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None 