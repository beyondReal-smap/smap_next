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

# Google 로그인 요청 스키마
class GoogleLoginRequest(BaseModel):
    google_id: str
    email: str
    name: str
    image: Optional[str] = None
    access_token: Optional[str] = None

# Google 로그인 응답 스키마
class GoogleLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 비밀번호 확인 요청 스키마
class VerifyPasswordRequest(BaseModel):
    currentPassword: str
    
    @validator('currentPassword')
    def validate_current_password(cls, v):
        if not v or not v.strip():
            raise ValueError('현재 비밀번호를 입력해주세요.')
        return v

# 비밀번호 확인 응답 스키마
class VerifyPasswordResponse(BaseModel):
    success: bool
    message: str

# 비밀번호 변경 요청 스키마
class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str
    
    @validator('currentPassword')
    def validate_current_password(cls, v):
        if not v or not v.strip():
            raise ValueError('현재 비밀번호를 입력해주세요.')
        return v
    
    @validator('newPassword')
    def validate_new_password(cls, v):
        if not v or not v.strip():
            raise ValueError('새 비밀번호를 입력해주세요.')
        
        # 비밀번호 강도 검사
        if len(v) < 8:
            raise ValueError('새 비밀번호는 8자 이상이어야 합니다.')
        
        import re
        
        # 대문자 포함 검사
        if not re.search(r'[A-Z]', v):
            raise ValueError('새 비밀번호는 대문자를 포함해야 합니다.')
        
        # 소문자 포함 검사
        if not re.search(r'[a-z]', v):
            raise ValueError('새 비밀번호는 소문자를 포함해야 합니다.')
        
        # 숫자 포함 검사
        if not re.search(r'\d', v):
            raise ValueError('새 비밀번호는 숫자를 포함해야 합니다.')
        
        # 특수문자 포함 검사
        if not re.search(r'[@$!%*?&]', v):
            raise ValueError('새 비밀번호는 특수문자(@$!%*?&)를 포함해야 합니다.')
        
        return v

# 비밀번호 변경 응답 스키마
class ChangePasswordResponse(BaseModel):
    success: bool
    message: str

# 프로필 수정 관련 스키마
class UpdateProfileRequest(BaseModel):
    mt_name: str
    mt_nickname: str
    mt_birth: Optional[str] = None
    mt_gender: Optional[int] = None

class UpdateProfileResponse(BaseModel):
    result: str
    message: str
    success: bool

# 연락처 수정 관련 스키마
class UpdateContactRequest(BaseModel):
    mt_hp: str
    mt_email: str

class UpdateContactResponse(BaseModel):
    result: str
    message: str
    success: bool

# 회원 탈퇴 관련 스키마
class WithdrawRequest(BaseModel):
    mt_retire_chk: int  # 탈퇴 사유 번호 (1-5)
    mt_retire_etc: Optional[str] = None  # 기타 사유 (mt_retire_chk가 5일 때)
    reasons: Optional[list] = None  # 프론트엔드에서 전달하는 사유 목록
    
    @validator('mt_retire_chk')
    def validate_retire_reason(cls, v):
        if v not in [1, 2, 3, 4, 5]:
            raise ValueError('탈퇴 사유는 1-5 사이의 값이어야 합니다.')
        return v
    
    @validator('mt_retire_etc')
    def validate_etc_reason(cls, v, values):
        # mt_retire_chk가 5(기타 이유)일 때 mt_retire_etc 필수
        if values.get('mt_retire_chk') == 5:
            if not v or not v.strip():
                raise ValueError('기타 사유를 입력해주세요.')
        return v

class WithdrawResponse(BaseModel):
    success: bool
    message: str
    result: Optional[str] = None 