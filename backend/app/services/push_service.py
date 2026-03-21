import logging
from typing import Dict, Optional
from datetime import datetime
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

        logger.info(f"📤 푸시 알림 전송 시작 - 토큰: {str(token_id)[:30]}..., 제목: {title}")

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

def push_log_add(
    db,
    mt_idx: int,
    sst_idx: Optional[int],
    plt_condition: str,
    plt_memo: str,
    plt_title: str,
    plt_content: str,
    push_result: Dict,
    push_json: str = ""
) -> None:
    """
    푸시 알림 로그를 저장합니다.
    """
    try:
        now = datetime.now()
        plt_status = 2 if push_result["result"] else 4

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
        db.commit()

        if not push_result["result"]:
            logger.error(f"Push notification failed for member {mt_idx}: {push_result['msg']}")

    except Exception as e:
        logger.error(f"Error adding push log: {e}")
        db.rollback() 
