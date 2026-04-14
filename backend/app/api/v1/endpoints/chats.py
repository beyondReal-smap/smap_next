import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from jose import jwt

from app.api import deps
from app.core.config import settings
from app.schemas.chat import CreateDMRequest
from app.services.chat_service import chat_service

logger = logging.getLogger(__name__)
router = APIRouter()


def get_current_user_id(authorization: str = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx = payload.get("mt_idx")
        if not mt_idx:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
        return mt_idx
    except Exception:
        raise HTTPException(status_code=401, detail="토큰 인증에 실패했습니다.")


@router.get("/rooms")
def get_chat_rooms(
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    """내 채팅방 목록 조회 (안 읽은 수 포함)"""
    return chat_service.get_rooms_for_member(db, mt_idx)


@router.post("/rooms/dm")
def create_dm_room(
    request: CreateDMRequest,
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    """1:1 채팅방 생성 (기존 DM이 있으면 반환)"""
    if request.target_mt_idx == mt_idx:
        raise HTTPException(status_code=400, detail="자기 자신에게는 DM을 보낼 수 없습니다.")
    result = chat_service.create_dm_room(db, mt_idx, request.target_mt_idx)
    if not result:
        raise HTTPException(status_code=500, detail="채팅방 생성에 실패했습니다.")
    return result


@router.get("/rooms/{scr_idx}/messages")
def get_messages(
    scr_idx: int,
    before: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    mt_idx: int = Depends(get_current_user_id)
):
    """채팅방 메시지 조회 (페이지네이션)"""
    messages = chat_service.get_messages(db, scr_idx, mt_idx, before, min(limit, 100))
    if messages is None:
        raise HTTPException(status_code=403, detail="채팅방 접근 권한이 없습니다.")
    return messages
