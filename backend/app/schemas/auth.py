from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    mt_hp: str  # 전화번호 (로그인 ID로 사용)
    mt_pass: str # 비밀번호
    fcm_token: Optional[str] = None  # 선택적 FCM 토큰

class UserIdentity(BaseModel):
    mt_idx: int
    mt_id: str
    mt_name: Optional[str] = None
    mt_level: Optional[int] = None
    # 필요한 경우 다른 필드 추가 (예: email, role 등)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserIdentity

# 회원가입 요청 스키마
class RegisterRequest(BaseModel):
    mt_id: str          # 사용자 ID (전화번호, frontend에서 phoneNumber.replace('-', '') 값)
    mt_pwd: str         # 비밀번호
    mt_name: str        # 이름
    mt_email: EmailStr  # 이메일 (Pydantic의 EmailStr로 유효성 검사)
    mt_hp: str          # 연락처 (전화번호, mt_id와 동일하거나 다른 형식일 수 있음)
    fcm_token: Optional[str] = None  # 선택적 FCM 토큰
    # mt_type: int = 1    # 회원 유형 (기본값: 일반회원)
    # mt_level: int = 2   # 회원 레벨 (기본값: 일반(무료))
    # ... 기타 필요한 필드 (예: 약관 동의 여부 등) ...

# 사용자 정보 반환 시 사용할 스키마 (UserIdentity 재사용 또는 확장 가능)
# class UserResponse(UserIdentity):
#     mt_email: Optional[EmailStr] = None
#     mt_hp: Optional[str] = None
#     # ... 기타 반환할 사용자 정보 ...

# 비밀번호 찾기 요청 스키마
class ForgotPasswordRequest(BaseModel):
    type: str  # 'phone' 또는 'email'
    contact: str  # 전화번호 또는 이메일

# 비밀번호 찾기 응답 스키마
class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 토큰 검증 요청 스키마
class VerifyResetTokenRequest(BaseModel):
    token: str

# 토큰 검증 응답 스키마
class VerifyResetTokenResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# 비밀번호 재설정 요청 스키마
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# 비밀번호 재설정 응답 스키마
class ResetPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None 