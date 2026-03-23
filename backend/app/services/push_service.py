import json
import logging
from typing import Dict, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.push_log import PushLog
from app.models.push_fcm import PushFCM
from app.models.enums import ReadCheckEnum, ShowEnum
from app.services.firebase_service import firebase_service

logger = logging.getLogger(__name__)

def send_push(token_id: str, title: str, content: str, url: Optional[str] = None, member_id: Optional[int] = None) -> Dict:
    """
    FCM을 통해 푸시 알림을 전송합니다.
    """
    try:
        if not token_id:
            logger.warning(f"📤 푸시 전송 건너뜀 - 토큰 없음, 제목: {title}")
            return {
                "result": False,
                "msg": "Missing token"
            }

        logger.info(f"📤 푸시 알림 전송 시작 - 토큰: {token_id[:8] if token_id else '***'}..., 제목: {title}")

        if not firebase_service.is_available():
            logger.error("❌ Firebase 서비스가 초기화되지 않아 푸시 알림을 전송할 수 없습니다.")
            return {
                "result": False,
                "msg": "Firebase service not available"
            }

        # FCM 메시지 전송
        response = firebase_service.send_push_notification(
            token=token_id,
            title=title,
            content=content,
            member_id=member_id
        )

        logger.info(f"✅ 푸시 알림 전송 성공: {response}")
        return {
            "result": True,
            "msg": "Success",
            "fcm_response": response
        }

    except Exception as e:
        logger.error(f"❌ 푸시 알림 전송 실패: {e}")
        return {
            "result": False,
            "msg": str(e)
        }

def send_batch_push(tokens_and_messages: list) -> list:
    """
    FCM 배치 푸시 전송 — FirebaseService.send_batch_push() 래퍼

    Args:
        tokens_and_messages: [{"token": str, "title": str, "content": str, "member_id": int|None}, ...]

    Returns:
        list: 각 메시지의 전송 결과 (SendResponse 또는 None)
    """
    from firebase_admin import messaging as fb_messaging

    if not firebase_service.is_available():
        logger.error("Firebase 서비스가 초기화되지 않아 배치 푸시를 전송할 수 없습니다.")
        return [None] * len(tokens_and_messages)

    # FCM Message 객체 리스트 생성
    messages = []
    for item in tokens_and_messages:
        token = item.get("token")
        title = item.get("title", "")
        content = item.get("content", "")

        if not token:
            messages.append(None)
            continue

        msg = fb_messaging.Message(
            token=token,
            notification=fb_messaging.Notification(
                title=title,
                body=content
            ),
            android=fb_messaging.AndroidConfig(
                priority='high',
                notification=fb_messaging.AndroidNotification(sound='default')
            )
        )
        messages.append(msg)

    # None 항목 필터링 (토큰 없는 항목)
    valid_indices = [i for i, m in enumerate(messages) if m is not None]
    valid_messages = [messages[i] for i in valid_indices]

    if not valid_messages:
        return [None] * len(tokens_and_messages)

    # 배치 전송
    batch_responses = firebase_service.send_batch_push(valid_messages)

    # 결과를 원래 인덱스에 매핑
    result = [None] * len(tokens_and_messages)
    for idx, resp in zip(valid_indices, batch_responses):
        result[idx] = resp

    success_count = sum(1 for r in result if r and getattr(r, 'success', False))
    logger.info(f"배치 푸시 전송 완료 - 성공: {success_count}/{len(tokens_and_messages)}")

    return result


def push_log_add(
    db: Session,
    mt_idx: int,
    sst_idx: Optional[int],
    plt_condition: str,
    plt_memo: str,
    plt_title: str,
    plt_content: str,
    push_result: Dict,
    push_json: Union[str, Dict] = ""
) -> None:
    """
    푸시 알림 로그를 저장합니다.
    """
    try:
        now = datetime.now()
        plt_status = 2 if push_result["result"] else 4

        # dict인 경우 JSON 문자열로 변환
        if isinstance(push_json, dict):
            push_json = json.dumps(push_json, ensure_ascii=False)

        push_log = PushLog(
            plt_type=2,
            mt_idx=mt_idx,
            sst_idx=sst_idx,
            plt_condition=plt_condition,
            plt_memo=plt_memo,
            plt_title=plt_title,
            plt_content=plt_content,
            plt_sdate=now,
            plt_status=plt_status,
            plt_read_chk=ReadCheckEnum.N,
            plt_show=ShowEnum.Y,
            push_json=push_json,
            plt_wdate=now
        )

        db.add(push_log)
        db.flush()

        if not push_result["result"]:
            logger.error(f"Push notification failed for member {mt_idx}: {push_result['msg']}")

    except Exception as e:
        logger.error(f"Error adding push log: {e}")
        db.rollback()
