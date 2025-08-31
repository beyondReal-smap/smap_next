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
from pydantic import BaseModel
from typing import Optional

# 백그라운드 토큰 검증 요청 모델
class BackgroundTokenCheckRequest(BaseModel):
    mt_idx: int
    fcm_token: str
    check_type: str = "background"  # background, immediate, scheduled
    force_refresh: bool = False  # 강제 토큰 갱신 여부
from datetime import datetime, timedelta

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

        # mt_token_id 삭제 현상 모니터링을 위한 로깅 추가
        if not old_token and is_new_token:
            logger.warning(f"⚠️ mt_token_id 삭제 감지: 회원 {request.mt_idx}의 기존 토큰이 없음 (새 토큰: {request.fcm_token[:20]}...)")
        elif old_token and not is_new_token:
            logger.info(f"✅ mt_token_id 유지 확인: 회원 {request.mt_idx}의 토큰 동일")
        elif old_token != request.fcm_token:
            logger.info(f"🔄 mt_token_id 변경: 회원 {request.mt_idx} 토큰 변경 (기존: {old_token[:20]}... → 새: {request.fcm_token[:20]}...)")

        # FCM 토큰 업데이트 (FCM 토큰은 일반적으로 1년 이상 유효하므로 90일로 설정)
        member.mt_token_id = request.fcm_token
        member.mt_token_updated_at = datetime.now()  # FCM 토큰 업데이트 일시
        member.mt_token_expiry_date = datetime.now() + timedelta(days=90)  # 90일 후 만료 예상
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

        # mt_token_id 상태 모니터링
        if not member.mt_token_id:
            logger.warning(f"⚠️ mt_token_id 없음: 회원 {mt_idx}의 FCM 토큰이 데이터베이스에 존재하지 않음")
        else:
            logger.info(f"✅ mt_token_id 존재: 회원 {mt_idx}의 토큰 상태 정상 (길이: {len(member.mt_token_id)})")
        
        # 토큰 만료 상태 확인
        is_token_expired = False
        is_token_near_expiry = False

        if member.mt_token_expiry_date:
            now = datetime.now()
            if now > member.mt_token_expiry_date:
                is_token_expired = True
            elif (member.mt_token_expiry_date - now).days <= 7:  # 만료 7일 전 (90일 만료에 맞게 조정)
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
            member.mt_token_expiry_date = datetime.now() + timedelta(days=90)  # 90일 후 만료 예상
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
        elif member.mt_token_expiry_date and (member.mt_token_expiry_date - now).days <= 7:
            # 토큰 만료 임박 (7일 이내, 90일 만료에 맞게 조정)
            needs_refresh = True
            reason = "FCM 토큰이 곧 만료됩니다."
        elif not member.mt_token_updated_at or (now - member.mt_token_updated_at).days >= 2:
            # 2일 이상 업데이트되지 않은 경우 (더 적극적인 갱신)
            needs_refresh = True
            reason = "FCM 토큰이 2일 이상 업데이트되지 않았습니다."

        if needs_refresh:
            logger.info(f"FCM 토큰 갱신 필요 - 회원 ID: {request.mt_idx}, 사유: {reason}")

            # 토큰 업데이트 (FCM 토큰은 일반적으로 1년 이상 유효하므로 90일로 설정)
            member.mt_token_id = request.fcm_token
            member.mt_token_updated_at = now
            member.mt_token_expiry_date = now + timedelta(days=90)  # 90일 후 만료 예상
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


@router.post("/background-check", response_model=MemberFCMTokenResponse)
async def background_token_check(
    request: BackgroundTokenCheckRequest,
    db: Session = Depends(get_db)
):
    """
    백그라운드 FCM 토큰 검증 및 필요시 갱신
    앱이 백그라운드에 있을 때 토큰 상태를 효율적으로 확인

    Args:
        request: 백그라운드 토큰 검증 요청 데이터
        db: 데이터베이스 세션

    Returns:
        MemberFCMTokenResponse: 검증/갱신 결과
    """
    try:
        logger.info(f"백그라운드 FCM 토큰 검증 요청 - 회원 ID: {request.mt_idx}, 타입: {request.check_type}")

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
            logger.warning(f"탈퇴회원의 FCM 토큰 백그라운드 검증 시도: mt_idx={request.mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."
            )

        current_time = datetime.now()
        needs_refresh = False
        reason = ""

        # 토큰 존재 여부 확인
        if not member.mt_token_id:
            needs_refresh = True
            reason = "FCM 토큰이 존재하지 않습니다."
        elif member.mt_token_id != request.fcm_token:
            # 토큰이 변경된 경우
            needs_refresh = True
            reason = "FCM 토큰이 변경되었습니다."
        elif member.mt_token_expiry_date and current_time > member.mt_token_expiry_date:
            # 토큰이 만료된 경우
            needs_refresh = True
            reason = "FCM 토큰이 만료되었습니다."
        elif request.force_refresh:
            # 강제 갱신 요청
            needs_refresh = True
            reason = "강제 토큰 갱신 요청"
        elif request.check_type == "background" and member.mt_token_expiry_date:
            # 백그라운드 검증의 경우 더 엄격한 만료 기준 적용 (안정적인 푸시 수신)
            if (member.mt_token_expiry_date - current_time).days <= 7:  # 7일 이내 만료 (90일 만료에 맞게 조정)
                needs_refresh = True
                reason = "백그라운드 검증: 토큰이 곧 만료됩니다."
        elif member.mt_token_updated_at and (current_time - member.mt_token_updated_at).days >= 2:
            # 2일 이상 업데이트되지 않은 경우 (더 적극적)
            needs_refresh = True
            reason = "토큰이 2일 이상 업데이트되지 않았습니다."

        if needs_refresh:
            logger.info(f"FCM 토큰 백그라운드 갱신 필요 - 회원 ID: {request.mt_idx}, 사유: {reason}")

            # 토큰 업데이트 (FCM 토큰은 일반적으로 1년 이상 유효하므로 90일로 설정)
            member.mt_token_id = request.fcm_token
            member.mt_token_updated_at = current_time
            member.mt_token_expiry_date = current_time + timedelta(days=90)  # 90일 후 만료
            member.mt_udate = current_time

            db.commit()
            db.refresh(member)

            return MemberFCMTokenResponse(
                success=True,
                message=f"FCM 토큰이 백그라운드에서 갱신되었습니다. 사유: {reason}",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
            )
        else:
            logger.info(f"FCM 토큰 백그라운드 검증 통과 - 회원 ID: {request.mt_idx}")

            return MemberFCMTokenResponse(
                success=True,
                message="FCM 토큰이 백그라운드에서 유효합니다.",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 백그라운드 검증 중 오류 발생: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 백그라운드 검증 중 서버 오류가 발생했습니다."
        )
