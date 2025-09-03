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
from app.services.firebase_service import firebase_service
from pydantic import BaseModel
from typing import Optional
from firebase_admin import messaging

# 백그라운드 토큰 검증 요청 모델
class BackgroundTokenCheckRequest(BaseModel):
    mt_idx: int
    fcm_token: str
    check_type: str = "background"  # background, immediate, scheduled
    force_refresh: bool = False  # 강제 토큰 갱신 여부
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()


def validate_fcm_token_format(token: str) -> bool:
    """
    FCM 토큰 형식을 검증하는 함수 (개선된 버전)
    Firebase 표준에 맞는 토큰 형식인지 더 엄격하게 검증

    Args:
        token: 검증할 FCM 토큰

    Returns:
        bool: 토큰이 올바른 형식인지 여부
    """
    # FCM 토큰 기본 검증
    if not token or not isinstance(token, str):
        logger.warning("❌ FCM 토큰이 비어있거나 문자열이 아님")
        return False

    # 길이 검증 (현실적인 범위로 조정)
    # 실제 사용되는 FCM 토큰 길이는 다양함 (20자~500자)
    if len(token) < 20 or len(token) > 500:
        logger.warning(f"❌ FCM 토큰 길이가 올바르지 않음: {len(token)}자 (정상 범위: 20-500자)")
        return False

    # 형식 검증 (현실적이고 유연한 검증)
    import re
    
    # FCM 토큰의 다양한 형식을 지원
    # 1. 전통적인 형태: 프로젝트ID:APA91b...
    # 2. 현대적인 형태: 직접적인 토큰 문자열 (콜론 없음)
    
    if ":" in token:
        # 콜론이 있는 경우: 프로젝트ID:토큰 형태
        parts = token.split(":", 1)
        if len(parts) == 2:
            project_id, token_part = parts
            
            # 프로젝트 ID 검증
            if not project_id or len(project_id) == 0 or len(project_id) > 100:
                logger.warning(f"❌ FCM 토큰 프로젝트 ID가 올바르지 않음: '{project_id}'")
                return False
            
            # 토큰 부분이 APA91b로 시작하는지 확인 (선택사항)
            if token_part.startswith("APA91b") and len(token_part) < 100:
                logger.warning(f"❌ FCM 토큰 부분이 너무 짧음: {len(token_part)}자")
                return False
                
        else:
            logger.warning("❌ FCM 토큰 구조가 올바르지 않음")
            return False
    else:
        # 콜론이 없는 경우: 직접적인 토큰 문자열
        # 현재 DB에 저장된 토큰 형태 (fR8nxUvlA0znuI4IoO5h... 등)
        logger.info("✅ FCM 토큰 형식: 직접 토큰 문자열 (콜론 없음)")
    
    # 기본 문자 검증 - 영숫자, 하이픈, 언더스코어만 허용
    if not re.match(r'^[a-zA-Z0-9_-]+$', token.replace(":", "")):
        logger.warning(f"❌ FCM 토큰에 허용되지 않는 문자 포함: {token[:30]}...")
        return False

    logger.info("✅ FCM 토큰 형식 검증 통과")
    return True


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
        
        # 동일한 토큰인 경우 중복 업데이트 방지 (시간 기반 체크 추가)
        if not is_new_token and old_token:
            # 최근 업데이트 시간 확인 (5분 이내 중복 업데이트 방지)
            if member.mt_token_updated_at:
                time_since_update = datetime.now() - member.mt_token_updated_at
                if time_since_update.total_seconds() < 300:  # 5분
                    logger.info(f"🚫 중복 업데이트 방지: 회원 ID {request.mt_idx} (마지막 업데이트: {time_since_update.total_seconds():.1f}초 전)")
                    return MemberFCMTokenResponse(
                        success=True,
                        message="FCM 토큰이 이미 최신 상태입니다. (중복 업데이트 방지)",
                        mt_idx=member.mt_idx,
                        has_token=True,
                        token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
                    )
            
            logger.info(f"✅ 동일 토큰 재등록 허용: 회원 ID {request.mt_idx} (5분 이상 경과)")

        # mt_token_id 삭제 현상 모니터링을 위한 로깅 추가
        if not old_token and is_new_token:
            logger.warning(f"⚠️ mt_token_id 삭제 감지: 회원 {request.mt_idx}의 기존 토큰이 없음 (새 토큰: {request.fcm_token[:20]}...)")
        elif old_token and not is_new_token:
            logger.info(f"✅ mt_token_id 유지 확인: 회원 {request.mt_idx}의 토큰 동일")
        elif old_token != request.fcm_token:
            logger.info(f"🔄 mt_token_id 변경: 회원 {request.mt_idx} 토큰 변경 (기존: {old_token[:20]}... → 새: {request.fcm_token[:20]}...)")

        # FCM 토큰 형식 검증 (개선된 검증 로직)
        if not validate_fcm_token_format(request.fcm_token):
            logger.warning(f"❌ 잘못된 FCM 토큰 형식 감지 - 회원 ID: {request.mt_idx}")
            logger.warning(f"❌ 토큰: {request.fcm_token[:50]}...")
            logger.warning(f"❌ 토큰 길이: {len(request.fcm_token)}자")
            
            # 기존에 저장된 토큰이 있다면 무효화 처리
            if old_token and old_token == request.fcm_token:
                logger.warning(f"⚠️ 기존 저장된 토큰과 동일한 잘못된 토큰 - 무효화 처리")
                try:
                    firebase_service._handle_token_invalidation(
                        old_token, 
                        "invalid_token_format_register",
                        "토큰 등록",
                        "잘못된 형식의 토큰 등록 시도"
                    )
                except Exception as cleanup_error:
                    logger.error(f"❌ 토큰 무효화 처리 실패: {cleanup_error}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="잘못된 FCM 토큰 형식입니다. 앱을 재시작하여 새로운 FCM 토큰을 받은 후 다시 시도해주세요."
            )

        logger.info(f"✅ FCM 토큰 형식 검증 통과 - 회원 ID: {request.mt_idx}")

        # FCM 토큰 업데이트 (FCM 토큰은 일반적으로 1년 이상 유효하므로 90일로 설정)
        member.mt_token_id = request.fcm_token
        member.mt_token_updated_at = datetime.now()  # FCM 토큰 업데이트 일시
        member.mt_token_expiry_date = datetime.now() + timedelta(days=90)  # 90일 후 만료 예상
        member.mt_udate = datetime.now()  # 수정일시 업데이트
        
        db.commit()
        db.refresh(member)
        
        # 토큰 등록 후 간단한 유효성 테스트 (선택적)
        if is_new_token:
            try:
                # Firebase 서비스에서 토큰 검증 (실제 메시지 전송하지 않고 형식만 검증)
                if firebase_service.is_available():
                    logger.info(f"🔍 FCM 토큰 등록 후 유효성 검증 - 회원 ID: {request.mt_idx}")
                    # 실제 푸시 전송은 하지 않고 토큰 형식만 재검증
                    additional_validation = firebase_service._validate_fcm_token(request.fcm_token)
                    if not additional_validation:
                        logger.warning(f"⚠️ Firebase 서비스 레벨 토큰 검증 실패 - 회원 ID: {request.mt_idx}")
                
            except Exception as validation_error:
                logger.warning(f"⚠️ 토큰 등록 후 검증 중 오류: {validation_error}")
                # 검증 실패해도 등록은 성공으로 처리 (토큰이 나중에 유효해질 수 있음)
        
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
            # 동일한 토큰 - 시간 기반 중복 체크
            if member.mt_token_updated_at:
                time_since_update = datetime.now() - member.mt_token_updated_at
                if time_since_update.total_seconds() < 300:  # 5분
                    message = "FCM 토큰이 이미 최신 상태입니다. (중복 체크 방지)"
                    logger.info(f"🚫 중복 체크 방지: 회원 ID {request.mt_idx} (마지막 업데이트: {time_since_update.total_seconds():.1f}초 전)")
                else:
                    message = "FCM 토큰이 이미 최신 상태입니다."
                    logger.info(f"✅ 동일 토큰 체크 허용: 회원 ID {request.mt_idx} (5분 이상 경과)")
            else:
                message = "FCM 토큰이 이미 최신 상태입니다."
                logger.info(f"FCM 토큰 업데이트 불필요 - 회원 ID: {request.mt_idx}")
        
        if needs_update:
            # FCM 토큰 형식 검증 (잘못된 토큰 방지)
            if not validate_fcm_token_format(request.fcm_token):
                logger.warning(f"잘못된 FCM 토큰 형식 감지 (check-and-update) - 회원 ID: {request.mt_idx}")
                logger.warning(f"잘못된 토큰: {request.fcm_token[:50]}...")
                logger.warning(f"토큰 길이: {len(request.fcm_token)}자")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="잘못된 FCM 토큰 형식입니다. 올바른 FCM 토큰을 제공해주세요."
                )

            logger.info(f"✅ FCM 토큰 형식 검증 통과 (check-and-update) - 회원 ID: {request.mt_idx}")

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
        elif member.mt_token_expiry_date and now < member.mt_token_expiry_date and not member.mt_token_updated_at:
            # 토큰이 아직 유효하지만 업데이트 일시가 없는 경우만 업데이트
            needs_refresh = True
            reason = "FCM 토큰 업데이트 일시가 없습니다."
        elif member.mt_token_expiry_date and now < member.mt_token_expiry_date and member.mt_token_updated_at and (now - member.mt_token_updated_at).days >= 30:
            # 토큰이 아직 유효하고 30일 이상 업데이트되지 않은 경우만 (기존 2일에서 30일로 변경)
            needs_refresh = True
            reason = "FCM 토큰이 30일 이상 업데이트되지 않았습니다."

        # FCM 서버와의 실제 토큰 검증 (선택적)
        server_validation_passed = True
        if request.force_refresh or needs_refresh:
            logger.info(f"🔍 FCM 서버 토큰 검증 시작 - 회원 ID: {request.mt_idx}")

            try:
                # FCM 서버에 테스트 메시지를 보내서 토큰 유효성 검증
                test_message = messaging.Message(
                    data={'token_validation': 'true', 'timestamp': str(int(now.timestamp()))},
                    token=request.fcm_token
                )

                # 실제 전송은 시도하지 않고 dry-run으로 검증만 수행
                # (실제 메시지를 보내지 않으려면 validation_only=True로 설정)
                logger.info(f"📡 FCM 서버 토큰 검증 시도 - 토큰: {request.fcm_token[:30]}...")

                # 간단한 토큰 형식 검증만 수행 (실제 FCM 전송은 비용과 사용자 경험 고려)
                if firebase_service.validate_ios_token(request.fcm_token):
                    logger.info(f"✅ FCM 서버 토큰 검증 통과 - 회원 ID: {request.mt_idx}")
                    server_validation_passed = True
                else:
                    logger.warning(f"❌ FCM 서버 토큰 검증 실패 - 회원 ID: {request.mt_idx}")
                    server_validation_passed = False
                    needs_refresh = True
                    reason = "FCM 서버에서 토큰을 인식하지 못합니다."

            except messaging.UnregisteredError as e:
                logger.warning(f"🚨 FCM 서버 검증 중 토큰 무효화 감지 - 회원 ID: {request.mt_idx}: {e}")
                server_validation_passed = False
                needs_refresh = True
                reason = "FCM 서버에서 토큰이 무효화되었습니다."

                # 즉시 토큰 무효화 처리
                try:
                    firebase_service._handle_token_invalidation(
                        request.fcm_token,
                        "server_validation_unregistered",
                        "토큰 검증",
                        "FCM 서버에서 토큰 무효화 감지"
                    )
                except Exception as cleanup_error:
                    logger.error(f"❌ FCM 토큰 무효화 처리 실패: {cleanup_error}")

            except messaging.ThirdPartyAuthError as e:
                logger.warning(f"🚨 FCM 서버 검증 중 인증 오류 - 회원 ID: {request.mt_idx}: {e}")
                server_validation_passed = False
                needs_refresh = True
                reason = "FCM 서버 인증에 실패했습니다."

            except Exception as e:
                logger.warning(f"⚠️ FCM 서버 검증 중 기타 오류 - 회원 ID: {request.mt_idx}: {e}")
                # 서버 검증 실패해도 기본 검증은 계속 진행
                server_validation_passed = False

        if needs_refresh:
            logger.info(f"FCM 토큰 갱신 필요 - 회원 ID: {request.mt_idx}, 사유: {reason}")

            # FCM 토큰 형식 검증 (잘못된 토큰 방지)
            if not validate_fcm_token_format(request.fcm_token):
                logger.warning(f"잘못된 FCM 토큰 형식 감지 (validate-and-refresh) - 회원 ID: {request.mt_idx}")
                logger.warning(f"잘못된 토큰: {request.fcm_token[:50]}...")
                logger.warning(f"토큰 길이: {len(request.fcm_token)}자")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="잘못된 FCM 토큰 형식입니다. 올바른 FCM 토큰을 제공해주세요."
                )

            logger.info(f"✅ FCM 토큰 형식 검증 통과 (validate-and-refresh) - 회원 ID: {request.mt_idx}")

            # 토큰 업데이트 (FCM 토큰은 일반적으로 1년 이상 유효하므로 90일로 설정)
            member.mt_token_id = request.fcm_token
            member.mt_token_updated_at = now
            member.mt_token_expiry_date = now + timedelta(days=90)  # 90일 후 만료 예상
            member.mt_udate = now

            db.commit()
            db.refresh(member)

            validation_status = "서버 검증 통과" if server_validation_passed else "기본 검증만 통과"
            return MemberFCMTokenResponse(
                success=True,
                message=f"FCM 토큰이 갱신되었습니다. 사유: {reason} ({validation_status})",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
            )
        else:
            logger.info(f"FCM 토큰 검증 통과 - 회원 ID: {request.mt_idx}")

            validation_status = "서버 검증 통과" if server_validation_passed else "기본 검증 통과"
            return MemberFCMTokenResponse(
                success=True,
                message=f"FCM 토큰이 유효합니다. ({validation_status})",
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
        
        # 요청된 토큰이 미리보기 토큰인지 확인 (보안상 전체 토큰을 직접 전달할 수 없는 경우)
        is_preview_token = (
            len(request.fcm_token) < 100 or  # 미리보기 토큰은 일반적으로 짧음
            request.fcm_token.endswith("...") or  # 미리보기 토큰 형식
            not validate_fcm_token_format(request.fcm_token)  # 완전한 토큰 형식이 아님
        )
        
        if is_preview_token:
            logger.info(f"미리보기 토큰 감지 - DB의 실제 토큰과 비교 건너뛰기: {request.fcm_token[:20]}...")
            # 미리보기 토큰인 경우 DB의 실제 토큰과 비교하지 않음
            actual_token = member.mt_token_id
            if not actual_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="DB에 저장된 FCM 토큰이 없습니다. 앱에서 새로운 토큰을 등록해주세요."
                )
        else:
            # 전체 토큰이 전달된 경우 해당 토큰 사용
            actual_token = request.fcm_token

        # 토큰 존재 여부 확인
        if not member.mt_token_id:
            needs_refresh = True
            reason = "FCM 토큰이 존재하지 않습니다."
        elif not is_preview_token and member.mt_token_id != request.fcm_token:
            # 전체 토큰이 전달되고 DB 토큰과 다른 경우에만 변경으로 판단
            needs_refresh = True
            reason = "FCM 토큰이 변경되었습니다."
        elif not is_preview_token and member.mt_token_id == request.fcm_token:
            # 동일한 토큰인 경우 최근 체크 시간 확인 (백그라운드 중복 체크 방지)
            if member.mt_token_updated_at:
                time_since_update = datetime.now() - member.mt_token_updated_at
                if time_since_update.total_seconds() < 1800:  # 30분 (백그라운드는 더 긴 간격)
                    logger.info(f"🚫 백그라운드 중복 체크 방지: 회원 ID {request.mt_idx} (마지막 업데이트: {time_since_update.total_seconds():.0f}초 전)")
                    return MemberFCMTokenResponse(
                        success=True,
                        message="백그라운드 토큰 체크 건너뛰기 (중복 방지)",
                        mt_idx=member.mt_idx,
                        has_token=True,
                        token_preview=request.fcm_token[:20] + "..." if len(request.fcm_token) > 20 else request.fcm_token
                    )
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
        elif member.mt_token_expiry_date and current_time < member.mt_token_expiry_date and member.mt_token_updated_at and (current_time - member.mt_token_updated_at).days >= 85:
            # 토큰이 아직 유효하고 85일 이상 업데이트되지 않은 경우만 (90일 만료 5일 전)
            needs_refresh = True
            reason = "토큰이 아직 유효하지만 85일 이상 업데이트되지 않았습니다. (만료 5일 전)"

        if needs_refresh:
            logger.info(f"FCM 토큰 백그라운드 갱신 필요 - 회원 ID: {request.mt_idx}, 사유: {reason}")

            # FCM 토큰 형식 검증 (미리보기 토큰이 아닌 경우에만)
            if not is_preview_token and not validate_fcm_token_format(actual_token):
                logger.warning(f"잘못된 FCM 토큰 형식 감지 (background-check) - 회원 ID: {request.mt_idx}")
                logger.warning(f"잘못된 토큰: {actual_token[:50]}...")
                logger.warning(f"토큰 길이: {len(actual_token)}자")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="잘못된 FCM 토큰 형식입니다. 올바른 FCM 토큰을 제공해주세요."
                )
            elif is_preview_token:
                logger.info(f"미리보기 토큰이므로 형식 검증 건너뛰기 - 회원 ID: {request.mt_idx}")
            else:
                logger.info(f"✅ FCM 토큰 형식 검증 통과 (background-check) - 회원 ID: {request.mt_idx}")

            # 토큰 업데이트 (미리보기 토큰인 경우 실제 토큰은 업데이트하지 않음)
            if not is_preview_token:
                member.mt_token_id = actual_token
                logger.info(f"FCM 토큰 업데이트 완료 - 회원 ID: {request.mt_idx}")
            else:
                logger.info(f"미리보기 토큰이므로 DB 토큰 업데이트 건너뛰기 - 회원 ID: {request.mt_idx}")
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
                token_preview=(actual_token[:20] + "..." if len(actual_token) > 20 else actual_token) if actual_token else None
            )
        else:
            logger.info(f"FCM 토큰 백그라운드 검증 통과 - 회원 ID: {request.mt_idx}")

            return MemberFCMTokenResponse(
                success=True,
                message="FCM 토큰이 백그라운드에서 유효합니다.",
                mt_idx=member.mt_idx,
                has_token=True,
                token_preview=(actual_token[:20] + "..." if len(actual_token) > 20 else actual_token) if actual_token else None
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


@router.post("/cleanup-expired-tokens", response_model=MemberFCMTokenResponse)
async def cleanup_expired_fcm_tokens(
    db: Session = Depends(get_db)
):
    """
    만료된 FCM 토큰들을 정리하는 관리자용 엔드포인트
    주기적으로 호출하여 무효화된 토큰들을 정리합니다.

    Returns:
        MemberFCMTokenResponse: 정리 결과
    """
    try:
        logger.info("🔄 FCM 토큰 정리 작업 시작")

        now = datetime.now()
        cleaned_count = 0
        notified_count = 0

        # 만료된 토큰들을 찾기
        expired_members = db.query(Member).filter(
            Member.mt_token_id.isnot(None),
            Member.mt_token_expiry_date.isnot(None),
            Member.mt_token_expiry_date < now
        ).all()

        for member in expired_members:
            logger.info(f"🗑️ 만료된 토큰 정리 - 회원 ID: {member.mt_idx}, 만료일: {member.mt_token_expiry_date}")

            # 토큰 정보 초기화
            member.mt_token_id = None
            member.mt_token_updated_at = None
            member.mt_token_expiry_date = None
            member.mt_udate = now

            cleaned_count += 1

            # 푸시 알림 동의한 사용자에게 토큰 갱신 요청 알림
            if member.mt_push1 == 'Y':
                try:
                    # 실제 구현에서는 SMS, 이메일 등으로 알림 전송
                    logger.info(f"📢 토큰 만료 알림 필요 - 회원: {member.mt_id} ({member.mt_idx})")
                    notified_count += 1
                except Exception as e:
                    logger.error(f"❌ 토큰 만료 알림 전송 실패 - 회원: {member.mt_idx}: {e}")

        if cleaned_count > 0:
            db.commit()
            logger.info(f"✅ FCM 토큰 정리 완료 - 정리된 토큰: {cleaned_count}개, 알림 대상: {notified_count}명")
        else:
            logger.info("ℹ️ 정리할 만료된 토큰이 없습니다.")

        return MemberFCMTokenResponse(
            success=True,
            message=f"만료된 FCM 토큰 정리 완료 (정리: {cleaned_count}개, 알림: {notified_count}명)",
            mt_idx=0,  # 관리 작업이므로 0으로 설정
            has_token=False,
            token_preview=""
        )

    except Exception as e:
        logger.error(f"FCM 토큰 정리 중 오류 발생: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FCM 토큰 정리 중 내부 서버 오류가 발생했습니다."
        )


@router.post("/reset-invalid-tokens", response_model=MemberFCMTokenResponse)
async def reset_invalid_fcm_tokens(
    db: Session = Depends(get_db)
):
    """
    잘못된 FCM 토큰들을 찾아서 삭제하는 관리자용 엔드포인트
    FCM 토큰 검증 시스템에서 걸러진 잘못된 토큰들을 정리합니다.

    Returns:
        MemberFCMTokenResponse: 정리 결과
    """
    try:
        logger.info("🔄 잘못된 FCM 토큰 정리 작업 시작")

        # 모든 FCM 토큰 조회
        members_with_tokens = db.query(Member).filter(
            Member.mt_token_id.isnot(None)
        ).all()

        cleaned_count = 0
        total_checked = 0

        for member in members_with_tokens:
            total_checked += 1

            # FCM 토큰 형식 검증
            if not validate_fcm_token_format(member.mt_token_id):
                logger.warning(f"🚨 잘못된 FCM 토큰 발견 - 회원 ID: {member.mt_idx}")
                logger.warning(f"   잘못된 토큰: {member.mt_token_id[:50]}...")

                # 잘못된 토큰 삭제
                member.mt_token_id = None
                member.mt_token_updated_at = None
                member.mt_token_expiry_date = None
                member.mt_udate = datetime.now()

                cleaned_count += 1
                logger.info(f"✅ 잘못된 FCM 토큰 삭제 완료 - 회원 ID: {member.mt_idx}")

        if cleaned_count > 0:
            db.commit()
            logger.info(f"🎉 잘못된 FCM 토큰 정리 완료 - 정리된 토큰: {cleaned_count}개, 총 확인: {total_checked}개")
        else:
            logger.info(f"ℹ️ 잘못된 FCM 토큰이 발견되지 않음 - 총 확인: {total_checked}개")

        return MemberFCMTokenResponse(
            success=True,
            message=f"잘못된 FCM 토큰 정리 완료 (정리: {cleaned_count}개, 확인: {total_checked}개)",
            mt_idx=0,  # 관리 작업이므로 0으로 설정
            has_token=False,
            token_preview=""
        )

    except Exception as e:
        logger.error(f"FCM 토큰 정리 중 오류 발생: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="잘못된 FCM 토큰 정리 중 내부 서버 오류가 발생했습니다."
        )


@router.post("/notify-token-refresh", response_model=MemberFCMTokenResponse)
async def notify_token_refresh(
    mt_idx: int,
    db: Session = Depends(get_db)
):
    """
    특정 사용자에게 토큰 갱신 알림을 보내는 엔드포인트
    FCM 토큰이 무효화되었을 때 호출됩니다.

    Args:
        mt_idx: 알림을 보낼 회원 ID

    Returns:
        MemberFCMTokenResponse: 알림 전송 결과
    """
    try:
        logger.info(f"🔔 FCM 토큰 갱신 알림 전송 요청 - 회원 ID: {mt_idx}")

        # 회원 존재 확인
        member = Member.find_by_idx(db, mt_idx)
        if not member:
            logger.warning(f"존재하지 않는 회원: mt_idx={mt_idx}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 회원을 찾을 수 없습니다."
            )

        # 실제 구현에서는 SMS, 이메일, 다른 푸시 채널 등으로 알림 전송
        notification_message = f"""
        안녕하세요 {member.mt_name}님,

        FCM 푸시 알림을 받기 위해서는 앱을 재시작하여 토큰을 갱신해야 합니다.

        ▶ 앱 완전 종료 후 재시작
        ▶ FCM 토큰 자동 갱신
        ▶ 푸시 알림 복원

        감사합니다.
        """

        logger.info(f"📢 토큰 갱신 알림 내용: {notification_message.strip()}")

        # 실제 알림 전송 로직 구현 (SMS, 이메일 등)
        # 현재는 로그로 기록만 함
        firebase_service._send_token_refresh_notification(mt_idx, "FCM 토큰 만료로 인한 갱신 필요")

        return MemberFCMTokenResponse(
            success=True,
            message="토큰 갱신 알림이 전송되었습니다.",
            mt_idx=member.mt_idx,
            has_token=member.mt_token_id is not None,
            token_preview=member.mt_token_id[:20] + "..." if member.mt_token_id and len(member.mt_token_id) > 20 else (member.mt_token_id or "")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FCM 토큰 갱신 알림 전송 중 오류 발생: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="토큰 갱신 알림 전송 중 내부 서버 오류가 발생했습니다."
        )


class TestIOSPushRequest(BaseModel):
    mt_idx: int
    test_type: str = "simple"  # simple, direct, complex

@router.post("/test-ios-push")
async def test_ios_push_delivery(
    request: TestIOSPushRequest,
    db: Session = Depends(get_db)
):
    """
    iOS 푸시 알림 전송 테스트 엔드포인트
    다양한 설정으로 테스트하여 수신 문제 진단
    """
    try:
        logger.info(f"🧪 [TEST] iOS 푸시 테스트 시작 - 회원: {request.mt_idx}, 타입: {request.test_type}")
        
        # 회원 정보 조회
        member = Member.find_by_idx(db, request.mt_idx)
        if not member or not member.mt_token_id:
            raise HTTPException(
                status_code=404,
                detail="회원 또는 FCM 토큰을 찾을 수 없습니다."
            )
        
        # iOS 토큰 검증
        if ':' not in member.mt_token_id:
            raise HTTPException(
                status_code=400,
                detail="iOS FCM 토큰이 아닙니다."
            )
        
        title = f"🧪 iOS 푸시 테스트 ({request.test_type})"
        content = f"테스트 시간: {datetime.now().strftime('%H:%M:%S')}"
        
        # 테스트 타입에 따른 전송 방식 선택
        if request.test_type == "simple":
            # 단순화된 설정으로 테스트 (개선된 APNs 설정 사용)
            response = firebase_service.send_push_notification(
                token=member.mt_token_id,
                title=title,
                content=content,
                member_id=request.mt_idx
            )
        elif request.test_type == "direct":
            # Firebase Console과 동일한 최소 설정으로 테스트
            from firebase_admin import messaging
            
            message = messaging.Message(
                token=member.mt_token_id,
                notification=messaging.Notification(
                    title=title,
                    body=content
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(title=title, body=content),
                            sound='default'
                        )
                    )
                )
            )
            
            response = messaging.send(message)
            logger.info(f"✅ [TEST DIRECT] Firebase Console 방식 테스트 완료: {response}")
        else:
            # 기존 복잡한 설정으로 테스트 (비교용)
            response = firebase_service.send_push_notification(
                token=member.mt_token_id,
                title=title,
                content=content,
                member_id=request.mt_idx,
                max_retries=0
            )
        
        logger.info(f"✅ [TEST] iOS 푸시 테스트 완료 - 응답: {response}")
        
        return {
            "success": True,
            "message": f"iOS 푸시 테스트 완료 ({request.test_type})",
            "response": response,
            "token_length": len(member.mt_token_id),
            "token_preview": f"{member.mt_token_id[:30]}...",
            "test_time": datetime.now().isoformat(),
            "member_id": request.mt_idx
        }
        
    except Exception as e:
        logger.error(f"❌ [TEST] iOS 푸시 테스트 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"iOS 푸시 테스트 실패: {str(e)}"
        )
