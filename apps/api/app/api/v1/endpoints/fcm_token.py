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
def update_fcm_token(
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
        
        # 토큰 변경 여부 확인
        token_changed = current_member.mt_token_id != request.fcm_token
        old_token = current_member.mt_token_id

        # 현재 회원의 FCM 토큰 업데이트
        current_member.mt_token_id = request.fcm_token
        db.commit()

        logger.info(f"FCM 토큰 업데이트 완료 - 회원 ID: {current_member.mt_idx}, 변경: {token_changed}")

        # 토큰이 실제로 변경되었고 이전 토큰이 있는 경우
        if token_changed and old_token:
            logger.info(f"🔄 FCM 토큰 변경 감지 - 이전 토큰으로 Silent Push 전송 시도")

            # 여러 번 Silent Push 전송하여 백그라운드 앱 깨우기 보장
            silent_push_attempts = 0
            max_attempts = 3

            while silent_push_attempts < max_attempts:
                try:
                    silent_push_attempts += 1
                    logger.info(f"🤫 Silent Push 시도 {silent_push_attempts}/{max_attempts} - 토큰: {old_token[:30]}...")

                    # 이전 토큰으로 Silent Push 전송하여 백그라운드 앱 깨우기
                    silent_response = firebase_service.send_silent_push_notification(
                        old_token,
                        reason="token_changed_update",
                        priority="high"
                    )
                    logger.info(f"✅ Silent Push 전송 성공 (시도 {silent_push_attempts}/{max_attempts}): {silent_response}")
                    break  # 성공하면 루프 종료

                except Exception as silent_error:
                    logger.warning(f"⚠️ Silent Push 전송 실패 (시도 {silent_push_attempts}/{max_attempts}): {silent_error}")

                    if silent_push_attempts < max_attempts:
                        # 다음 시도 전 잠시 대기
                        import time
                        time.sleep(1)
                    else:
                        logger.error(f"❌ 모든 Silent Push 시도 실패 ({max_attempts}회) - 백그라운드 앱 깨우기 실패")

            # 새로운 토큰으로도 Silent Push 전송 (안전장치)
            try:
                logger.info(f"🛡️ 새로운 토큰으로 추가 Silent Push 전송 - 토큰: {request.fcm_token[:30]}...")
                additional_response = firebase_service.send_silent_push_notification(
                    request.fcm_token,
                    reason="token_update_confirmation",
                    priority="high"
                )
                logger.info(f"✅ 추가 Silent Push 전송 성공: {additional_response}")
            except Exception as additional_error:
                logger.warning(f"⚠️ 추가 Silent Push 전송 실패 (무시 가능): {additional_error}")

        return create_response(
            SUCCESS,
            "FCM 토큰 업데이트 성공",
            {
                "mt_idx": current_member.mt_idx,
                "token_updated": True,
                "token_changed": token_changed,
                "silent_push_sent": token_changed and old_token is not None
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
def get_fcm_token_status(
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

@router.post("/notify-token-change", response_model=FCMTokenResponse)
def notify_fcm_token_change(
    db: Session = Depends(deps.get_db),
    current_member: Member = Depends(get_current_member)
):
    """
    FCM 토큰 변경을 백그라운드 앱에 알리기 위한 Silent Push 전송
    백그라운드 앱이 새로운 토큰으로 업데이트하도록 유도

    Args:
        db: 데이터베이스 세션
        current_member: 현재 로그인한 회원

    Returns:
        FCMTokenResponse: 토큰 변경 알림 결과
    """
    try:
        logger.info(f"🔄 FCM 토큰 변경 알림 요청 - 회원 ID: {current_member.mt_idx}")

        if not current_member.mt_token_id:
            logger.warning(f"⚠️ FCM 토큰 변경 알림 실패 - 토큰 없음: 회원 {current_member.mt_idx}")
            return create_response(
                FAILURE,
                "토큰 변경 알림 실패",
                "FCM 토큰이 등록되지 않았습니다."
            )

        # 기존 토큰으로 Silent Push 전송하여 백그라운드 앱 깨우기
        try:
            logger.info(f"🤫 Silent Push 전송 시작 - 토큰: {current_member.mt_token_id[:30]}...")
            response = firebase_service.send_silent_push_notification(
                current_member.mt_token_id,
                reason="token_change_notification",
                priority="high"
            )
            logger.info(f"✅ Silent Push 전송 성공 - 응답: {response}")

            return create_response(
                SUCCESS,
                "토큰 변경 알림 전송 성공",
                {
                    "mt_idx": current_member.mt_idx,
                    "silent_push_sent": True,
                    "push_response": response,
                    "purpose": "백그라운드 앱에 토큰 변경 알림"
                }
            )

        except Exception as push_error:
            logger.error(f"❌ Silent Push 전송 실패: {push_error}")
            return create_response(
                FAILURE,
                "토큰 변경 알림 실패",
                f"Silent Push 전송 실패: {str(push_error)}"
            )

    except Exception as e:
        logger.error(f"FCM 토큰 변경 알림 처리 실패: {e}")
        return create_response(
            FAILURE,
            "토큰 변경 알림 실패",
            str(e)
        )
