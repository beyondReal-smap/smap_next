from pydantic import BaseModel, Field
from typing import Optional

class FCMTokenUpdateRequest(BaseModel):
    """FCM 토큰 업데이트 요청"""
    fcm_token: str = Field(..., description="Firebase에서 생성된 FCM 토큰", min_length=100, max_length=255)
    
    class Config:
        json_schema_extra = {
            "example": {
                "fcm_token": "fz6CAxDq4UVBmoaEdMtIHZ:APA91bG3i8_fwzaYnHOn9zQVLQdtZ0ZsmFY9EY0U1VGO1CPePWMTjsY1ls6Gpu6Dj44jDIq35AW-uZMWj6NjwO0lWV0O8RqWcvhuCez4Pv_jvncLg98zzFI"
            }
        }

class FCMTokenResponse(BaseModel):
    """FCM 토큰 응답"""
    resultCode: int
    resultMsg: str
    resultData: Optional[dict] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "resultCode": 200,
                "resultMsg": "FCM 토큰 업데이트 성공",
                "resultData": {
                    "mt_idx": 1186,
                    "token_updated": True
                }
            }
        }
