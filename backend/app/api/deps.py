"""API 의존성 모듈.

데이터베이스 세션, 인증 등 공통 의존성을 제공합니다.
"""
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.member import Member

logger = logging.getLogger(__name__)


def get_current_user_id(authorization: str = Header(None)) -> Optional[int]:
    """
    Authorization 헤더에서 JWT 토큰을 추출하고 사용자 ID(mt_idx)를 반환합니다.
    인증 실패 시 None을 반환합니다 (선택적 인증).
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload.get("mt_idx")
    except JWTError:
        return None


def get_required_user_id(
    user_id: Optional[int] = Depends(get_current_user_id),
) -> int:
    """
    인증이 필수인 엔드포인트용 의존성.
    인증 실패 시 401 에러를 반환합니다.
    """
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def get_current_user(
    user_id: int = Depends(get_required_user_id),
    db: Session = Depends(get_db),
) -> Member:
    """
    현재 인증된 사용자의 Member 객체를 반환합니다.
    사용자가 존재하지 않으면 404 에러를 반환합니다.
    """
    user = db.query(Member).filter(Member.mt_idx == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )
    return user
