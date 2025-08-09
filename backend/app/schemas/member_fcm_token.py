"""회원 FCM 토큰 관리 스키마."""

from pydantic import BaseModel, Field
from typing import Optional

class MemberFCMTokenRequest(BaseModel):
    """회원 FCM 토큰 요청 스키마"""
    mt_idx: int = Field(..., description="회원 고유번호", gt=0)
    fcm_token: str = Field(..., description="Firebase FCM 토큰", min_length=50, max_length=255)
    
    class Config:
        schema_extra = {
            "example": {
                "mt_idx": 1186,
                "fcm_token": "fz6CAxDq4UVBmoaEdMtIHZ:APA91bG3i8_fwzaYnHOn9zQVLQdtZ0ZsmFY9EY0U1VGO1CPePWMTjsY1ls6Gpu6Dj44jDIq35AW-uZMWj6NjwO0lWV0O8RqWcvhuCez4Pv_jvncLg98zzFI"
            }
        }

class MemberFCMTokenResponse(BaseModel):
    """회원 FCM 토큰 응답 스키마"""
    success: bool = Field(..., description="요청 성공 여부")
    message: str = Field(..., description="응답 메시지")
    mt_idx: int = Field(..., description="회원 고유번호")
    has_token: bool = Field(..., description="FCM 토큰 보유 여부")
    token_preview: Optional[str] = Field(None, description="FCM 토큰 미리보기 (앞 20자 + ...)")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "FCM 토큰이 성공적으로 등록/업데이트되었습니다.",
                "mt_idx": 1186,
                "has_token": True,
                "token_preview": "fz6CAxDq4UVBmoaEdMt..."
            }
        }

class MemberFCMTokenStatusResponse(BaseModel):
    """회원 FCM 토큰 상태 응답 스키마"""
    mt_idx: int = Field(..., description="회원 고유번호")
    has_token: bool = Field(..., description="FCM 토큰 보유 여부")
    token_preview: Optional[str] = Field(None, description="FCM 토큰 미리보기")
    mt_level: Optional[int] = Field(None, description="회원 등급")
    mt_status: Optional[int] = Field(None, description="회원 상태")
    last_updated: Optional[str] = Field(None, description="마지막 업데이트 시간 (ISO format)")
    
    class Config:
        schema_extra = {
            "example": {
                "mt_idx": 1186,
                "has_token": True,
                "token_preview": "fz6CAxDq4UVBmoaEdMt...",
                "mt_level": 2,
                "mt_status": 1,
                "last_updated": "2025-01-16T10:30:00"
            }
        }
