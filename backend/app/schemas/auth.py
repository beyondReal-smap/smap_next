from pydantic import BaseModel
from typing import Optional

# 회원가입 요청/응답 스키마는 member 스키마에서 정의되어 있어 호환을 위해 재노출합니다.
from .member import RegisterRequest, RegisterResponse

class UserIdentity(BaseModel):
    mt_idx: int
    mt_id: str
    mt_name: str
    mt_level: int

__all__ = [
    "UserIdentity",
    "RegisterRequest",
    "RegisterResponse",
]