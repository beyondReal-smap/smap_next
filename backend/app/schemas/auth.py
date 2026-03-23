from pydantic import BaseModel, ConfigDict
from typing import Optional

# 회원가입 요청/응답 스키마는 member 스키마에서 정의되어 있어 호환을 위해 재노출합니다.
from .member import RegisterRequest, RegisterResponse


class UserIdentity(BaseModel):
    mt_idx: int
    mt_id: str
    mt_name: str
    mt_level: int


# ---------------------------------------------------------------------------
# 로그인 요청/응답 스키마
# ---------------------------------------------------------------------------

class LoginRequestHome(BaseModel):
    """home/page.tsx AuthContext에서 사용하는 로그인 요청 모델"""
    mt_id: str
    mt_pwd: str
    fcm_token: Optional[str] = None
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None


class LoginResponseHome(BaseModel):
    """home/page.tsx AuthContext에서 사용하는 로그인 응답 모델"""
    success: bool
    message: str
    data: Optional[dict] = None


class LoginRequest(BaseModel):
    """레거시 로그인 요청"""
    mt_hp: str
    mt_pass: str
    fcm_token: Optional[str] = None


class LoginResponse(BaseModel):
    """레거시 로그인 응답"""
    access_token: str
    user: UserIdentity


# ---------------------------------------------------------------------------
# 카카오 로그인
# ---------------------------------------------------------------------------

class KakaoLoginRequest(BaseModel):
    kakao_id: str
    email: Optional[str] = None
    nickname: str
    profile_image: Optional[str] = None
    access_token: str
    fcm_token: Optional[str] = None
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None


class KakaoLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


# ---------------------------------------------------------------------------
# Google 로그인
# ---------------------------------------------------------------------------

class GoogleUserDataRequest(BaseModel):
    email: str
    google_id: Optional[str] = None


class PhoneUserDataRequest(BaseModel):
    phone: str
    google_id: Optional[str] = None


class GoogleUserDataResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class GoogleLoginRequest(BaseModel):
    """Google 로그인 요청 (유연한 필드 처리)"""
    google_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    image: Optional[str] = None
    id_token: Optional[str] = None
    lookup_strategy: Optional[str] = "email_first"
    search_by_email: Optional[bool] = True
    verify_email_match: Optional[bool] = True
    email_first_lookup: Optional[bool] = True
    lookup_priority: Optional[str] = "email"

    model_config = ConfigDict(extra="allow")


class GoogleLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


# ---------------------------------------------------------------------------
# 비밀번호 관련
# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    type: str  # "phone" | "email"
    contact: str


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class ResetPasswordByPhoneRequest(BaseModel):
    """전화번호 기반 비밀번호 재설정 (네이티브 앱용)"""
    phone: str
    new_password: str
    verification_code: str


class VerifyResetTokenRequest(BaseModel):
    token: str


class VerifyResetTokenResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


__all__ = [
    "UserIdentity",
    "RegisterRequest",
    "RegisterResponse",
    "LoginRequestHome",
    "LoginResponseHome",
    "LoginRequest",
    "LoginResponse",
    "KakaoLoginRequest",
    "KakaoLoginResponse",
    "GoogleUserDataRequest",
    "PhoneUserDataRequest",
    "GoogleUserDataResponse",
    "GoogleLoginRequest",
    "GoogleLoginResponse",
    "ForgotPasswordRequest",
    "ForgotPasswordResponse",
    "ResetPasswordByPhoneRequest",
    "VerifyResetTokenRequest",
    "VerifyResetTokenResponse",
    "ResetPasswordRequest",
    "ResetPasswordResponse",
]
