"""회원 FCM 토큰 관리 엔드포인트."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.member import Member
from app.schemas.member_fcm_token import (
    MemberFCMTokenRequest, 
    MemberFCMTokenResponse, 
    MemberFCMTokenStatusResponse
)
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=MemberFCMTokenResponse)
async def register_member_fcm_token(
    request: MemberFCMTokenRequest,
    db: Session = Depends(get_db)
):
    """
    회원 FCM 토큰 등록/업데이트
    
    앱에서 회원가입 완료 후 또는 로그인 후 FCM 토큰을 등록합니다.
    이미 토큰이 있는 경우 새로운 토큰으로 업데이트합니다.
    
    Args:
        request: mt_idx와 fcm_token을 포함한 요청 데이터
        db: 데이터베이스 세션
    
    Returns:
        MemberFCMTokenResponse: 등록/업데이트 결과
    """
    try:
        logger.info(f"FCM 토큰 등록/업데이트 요청 - 회원 ID: {request.mt_idx}, 토큰 길이: {len(request.fcm_token)}")
        
        # 회원 존재 확인
        member = Member.find_by_idx(db, request.mt_idx)
        if not member:
            logger.warning(f"존재하지 않는 회원: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 회원을 찾을 수 없습니다."
            )
        
        # 회원 상태 확인
        if member.mt_level == 1:  # 탈퇴회원
            logger.warning(f"탈퇴회원의 FCM 토큰 등록 시도: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="탈퇴한 회원은 FCM 토큰을 등록할 수 없습니다."
            )
        
        if member.mt_status != 1:  # 비정상 상태
            logger.warning(f"비정상 상태 회원의 FCM 토큰 등록 시도: mt_idx={request.mt_idx}, status={member.mt_status}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="정상 상태가 아닌 회원은 FCM 토큰을 등록할 수 없습니다."
            )
        
        # 기존 토큰과 비교
        old_token = member.mt_token_id
        is_new_token = old_token != request.fcm_token
        
        # FCM 토큰 업데이트
        member.mt_token_id = request.fcm_token
        member.mt_token_updated_at = datetime.now()  # FCM 토큰 업데이트 일시
        member.mt_token_expiry_date = datetime.now() + datetime.timedelta(days=7)  # 7일 후 만료 예상
        member.mt_udate = datetime.now()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(member)
        
        if is_new_token:
            logger.info(f"FCM 토큰 업데이트 완료 - 회원 ID: {request.mt_idx} (토큰 변경됨)")
        else:
            logger.info(f"FCM 토큰 재등록 완료 - 회원 ID: {request.mt_idx} (동일 토큰)")
        
        return MemberFCMTokenResponse(
            success=True,
            message="FCM 토큰이 성공적으로 등록/업데이트되었습니다.",
            mt_idx=member.mt_idx,
            has_token=True,
            token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 등록/업데이트 중 오류 발생: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 등록/업데이트 중 서버 오류가 발생했습니다."
        )


@router.get("/status/{mt_idx}", response_model=MemberFCMTokenStatusResponse)
async def get_member_fcm_token_status(
    mt_idx: int,
    db: Session = Depends(get_db)
):
    """
    회원의 FCM 토큰 상태 조회
    
    Args:
        mt_idx: 회원 고유번호
        db: 데이터베이스 세션
    
    Returns:
        MemberFCMTokenStatusResponse: FCM 토큰 상태 정보
    """
    try:
        logger.info(f"FCM 토큰 상태 조회 요청 - 회원 ID: {mt_idx}")
        
        # 회원 조회
        member = Member.find_by_idx(db, mt_idx)
        if not member:
            logger.warning(f"존재하지 않는 회원: mt_idx={mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 회원을 찾을 수 없습니다."
            )
        
        has_token = bool(member.mt_token_id)
        token_preview = member.mt_token_id[:20] + "..." if member.mt_token_id else None
        
        # 토큰 만료 상태 확인
        is_token_expired = False
        is_token_near_expiry = False

        if member.mt_token_expiry_date:
            now = datetime.now()
            if now > member.mt_token_expiry_date:
                is_token_expired = True
            elif (member.mt_token_expiry_date - now).days <= 1:  # 만료 1일 전
                is_token_near_expiry = True

        return MemberFCMTokenStatusResponse(
            mt_idx=member.mt_idx,
            has_token=has_token,
            token_preview=token_preview,
            mt_level=member.mt_level,
            mt_status=member.mt_status,
            last_updated=member.mt_udate.isoformat() if member.mt_udate else None,
            token_updated_at=member.mt_token_updated_at.isoformat() if member.mt_token_updated_at else None,
            token_expiry_date=member.mt_token_expiry_date.isoformat() if member.mt_token_expiry_date else None,
            is_token_expired=is_token_expired,
            is_token_near_expiry=is_token_near_expiry
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 상태 조회 중 오류 발생: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 상태 조회 중 서버 오류가 발생했습니다."
        )


@router.post("/check-and-update", response_model=MemberFCMTokenResponse)
async def check_and_update_fcm_token(
    request: MemberFCMTokenRequest,
    db: Session = Depends(get_db)
):
    """
    FCM 토큰 체크 후 필요시 업데이트
    
    로그인 시 호출하여 FCM 토큰이 없거나 다른 경우에만 업데이트합니다.
    이미 동일한 토큰이 있는 경우 불필요한 DB 업데이트를 하지 않습니다.
    
    Args:
        request: mt_idx와 fcm_token을 포함한 요청 데이터
        db: 데이터베이스 세션
    
    Returns:
        MemberFCMTokenResponse: 체크/업데이트 결과
    """
    try:
        logger.info(f"FCM 토큰 체크 요청 - 회원 ID: {request.mt_idx}")
        
        # 회원 존재 확인
        member = Member.find_by_idx(db, request.mt_idx)
        if not member:
            logger.warning(f"존재하지 않는 회원: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 회원을 찾을 수 없습니다."
            )
        
        # 회원 상태 확인
        if member.mt_level == 1:  # 탈퇴회원
            logger.warning(f"탈퇴회원의 FCM 토큰 체크 시도: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."
            )
        
        # 토큰 상태 확인
        current_token = member.mt_token_id
        needs_update = False
        message = ""
        
        if not current_token:
            # 토큰이 없는 경우 - 새로 등록
            needs_update = True
            message = "FCM 토큰이 새로 등록되었습니다."
            logger.info(f"새 FCM 토큰 등록 필요 - 회원 ID: {request.mt_idx}")
        elif current_token != request.fcm_token:
            # 토큰이 다른 경우 - 업데이트
            needs_update = True
            message = "FCM 토큰이 업데이트되었습니다."
            logger.info(f"FCM 토큰 업데이트 필요 - 회원 ID: {request.mt_idx}")
        else:
            # 동일한 토큰 - 업데이트 불필요
            message = "FCM 토큰이 이미 최신 상태입니다."
            logger.info(f"FCM 토큰 업데이트 불필요 - 회원 ID: {request.mt_idx}")
        
        if needs_update:
            member.mt_token_id = request.fcm_token
            member.mt_token_updated_at = datetime.now()  # FCM 토큰 업데이트 일시
            member.mt_token_expiry_date = datetime.now() + datetime.timedelta(days=7)  # 7일 후 만료 예상
            member.mt_udate = datetime.now()
            db.commit()
            db.refresh(member)
        
        return MemberFCMTokenResponse(
            success=True,
            message=message,
            mt_idx=member.mt_idx,
            has_token=True,
            token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 체크/업데이트 중 오류 발생: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 체크/업데이트 중 서버 오류가 발생했습니다."
        )


@router.post("/validate-and-refresh", response_model=MemberFCMTokenResponse)
async def validate_and_refresh_fcm_token(
    request: MemberFCMTokenRequest,
    db: Session = Depends(get_db)
):
    """
    FCM 토큰 유효성 검증 및 필요시 갱신
    앱 시작 시 호출하여 토큰 만료 상태를 확인하고 갱신을 유도합니다.

    Args:
        request: mt_idx와 fcm_token을 포함한 요청 데이터
        db: 데이터베이스 세션

    Returns:
        MemberFCMTokenResponse: 검증/갱신 결과
    """
    try:
        logger.info(f"FCM 토큰 유효성 검증 요청 - 회원 ID: {request.mt_idx}")

        # 회원 존재 확인
        member = Member.find_by_idx(db, request.mt_idx)
        if not member:
            logger.warning(f"존재하지 않는 회원: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 회원을 찾을 수 없습니다."
            )

        # 회원 상태 확인
        if member.mt_level == 1:  # 탈퇴회원
            logger.warning(f"탈퇴회원의 FCM 토큰 검증 시도: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."
            )

        # 현재 시간
        now = datetime.now()

        # 토큰 만료 상태 확인
        needs_refresh = False
        reason = ""

        if not member.mt_token_id:
            # 토큰이 없는 경우
            needs_refresh = True
            reason = "FCM 토큰이 존재하지 않습니다."
        elif member.mt_token_id != request.fcm_token:
            # 토큰이 다른 경우 (앱에서 새로운 토큰이 생성됨)
            needs_refresh = True
            reason = "FCM 토큰이 변경되었습니다."
        elif member.mt_token_expiry_date and now > member.mt_token_expiry_date:
            # 토큰이 만료된 경우
            needs_refresh = True
            reason = "FCM 토큰이 만료되었습니다."
        elif member.mt_token_expiry_date and (member.mt_token_expiry_date - now).days <= 1:
            # 토큰 만료 임박 (1일 이내)
            needs_refresh = True
            reason = "FCM 토큰이 곧 만료됩니다."
        elif not member.mt_token_updated_at or (now - member.mt_token_updated_at).days >= 3:
            # 3일 이상 업데이트되지 않은 경우
            needs_refresh = True
            reason = "FCM 토큰이 3일 이상 업데이트되지 않았습니다."

        if needs_refresh:
            logger.info(f"FCM 토큰 갱신 필요 - 회원 ID: {request.mt_idx}, 사유: {reason}")

            # 토큰 업데이트
            member.mt_token_id = request.fcm_token
            member.mt_token_updated_at = now
            member.mt_token_expiry_date = now + datetime.timedelta(days=7)
            member.mt_udate = now

            db.commit()
            db.refresh(member)

            return MemberFCMTokenResponse(
                success=True,
                message=f"FCM 토큰이 갱신되었습니다. 사유: {reason}",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
            )
        else:
            logger.info(f"FCM 토큰 검증 통과 - 회원 ID: {request.mt_idx}")

            return MemberFCMTokenResponse(
                success=True,
                message="FCM 토큰이 유효합니다.",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 유효성 검증 중 오류 발생: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 유효성 검증 중 서버 오류가 발생했습니다."
        )
