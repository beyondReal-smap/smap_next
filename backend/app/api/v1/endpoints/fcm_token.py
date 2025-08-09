from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.crud.crud_auth import get_current_member
from app.schemas.fcm_token import FCMTokenUpdateRequest, FCMTokenResponse
from app.core.response import create_response, SUCCESS, FAILURE
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/update", response_model=FCMTokenResponse)
async def update_fcm_token(
    request: FCMTokenUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_member: Member = Depends(get_current_member)
):
    """
    FCM 토큰 업데이트
    
    Args:
        request: FCM 토큰 업데이트 요청 데이터
        db: 데이터베이스 세션
        current_member: 현재 로그인한 회원
    
    Returns:
        FCMTokenResponse: 업데이트 결과
    """
    try:
        logger.info(f"FCM 토큰 업데이트 요청 - 회원 ID: {current_member.mt_idx}, 토큰: {request.fcm_token[:50]}...")
        
        # 현재 회원의 FCM 토큰 업데이트
        current_member.mt_token_id = request.fcm_token
        db.commit()
        
        logger.info(f"FCM 토큰 업데이트 완료 - 회원 ID: {current_member.mt_idx}")
        
        return create_response(
            SUCCESS,
            "FCM 토큰 업데이트 성공",
            {
                "mt_idx": current_member.mt_idx,
                "token_updated": True
            }
        )
        
    except Exception as e:
        logger.error(f"FCM 토큰 업데이트 실패: {e}")
        db.rollback()
        return create_response(
            FAILURE,
            "FCM 토큰 업데이트 실패",
            str(e)
        )

@router.get("/status", response_model=FCMTokenResponse)
async def get_fcm_token_status(
    db: Session = Depends(deps.get_db),
    current_member: Member = Depends(get_current_member)
):
    """
    현재 회원의 FCM 토큰 상태 조회
    
    Args:
        db: 데이터베이스 세션
        current_member: 현재 로그인한 회원
    
    Returns:
        FCMTokenResponse: FCM 토큰 상태
    """
    try:
        has_token = bool(current_member.mt_token_id)
        token_preview = current_member.mt_token_id[:20] + "..." if current_member.mt_token_id else None
        
        return create_response(
            SUCCESS,
            "FCM 토큰 상태 조회 성공",
            {
                "mt_idx": current_member.mt_idx,
                "has_token": has_token,
                "token_preview": token_preview
            }
        )
        
    except Exception as e:
        logger.error(f"FCM 토큰 상태 조회 실패: {e}")
        return create_response(
            FAILURE,
            "FCM 토큰 상태 조회 실패",
            str(e)
        )
