from pydantic import BaseModel
from typing import Optional, Any, Dict

class FCMSendRequest(BaseModel):
    """FCM 푸시 알림 전송 요청 스키마"""
    plt_type: str  # 전송구분
    sst_idx: str   # 일정idx
    plt_condition: str  # 전송조건
    plt_memo: str  # 전송조건설명
    mt_idx: int    # 회원 인덱스 (mt_id 대신 mt_idx 사용)
    plt_title: str # 제목
    plt_content: str # 내용
    user_agent: Optional[str] = None  # User-Agent 헤더 (선택적)

class FCMSendResponse(BaseModel):
    """FCM 푸시 알림 전송 응답 스키마"""
    success: str
    title: str
    message: str
    data: Optional[Any] = None 