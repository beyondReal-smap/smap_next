"""
푸시 알림 작업

- 예약된 푸시 알림 발송
- 일정 알림
- Silent 푸시 전송
- 앱 실행 트리거
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.jobs.base import (
    prefetch_members,
)
from app.services.notifications import dispatch_notification

logger = logging.getLogger(__name__)


def run_send_reserved_push_notifications(db: Session) -> None:
    """예약된 푸시 알림 발송 (배치 멤버 조회 + 단일 커밋)"""
    from app.models.push_log import PushLog
    from app.models.member import Member
    from app.services.push_service import send_push

    try:
        now = datetime.now()

        reserved_pushes = PushLog.get_reserved_pushes(db, now)
        if not reserved_pushes:
            return

        # 배치로 멤버 정보 조회 (N+1 해결)
        mt_idx_list = list(set(int(push.mt_idx) for push in reserved_pushes if push.mt_idx))
        member_map = prefetch_members(db, mt_idx_list)

        for push in reserved_pushes:
            # 배치 조회된 멤버 정보 사용
            member = member_map.get(int(push.mt_idx))
            if not member:
                continue

            push_result = send_push(
                member.mt_token_id,
                push.plt_title,
                push.plt_content
            )

            # 푸시 로그 상태 업데이트
            push.plt_status = 2 if push_result.get("result") else 4
            push.plt_sdate = now

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Reserved push notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in reserved push notifications: {e}")
        db.rollback()


def run_schedule_notification(db: Session) -> None:
    """일정 알림 (배치 최적화)"""
    from app.models.schedule import Schedule
    from app.models.group_detail import GroupDetail

    try:
        plt_condition = "1분 - 일정알림"
        plt_memo = "일정 시작 30분 전 알림"

        schedules = Schedule.get_now_schedule_push(db)
        if not schedules:
            return

        # 배치 prefetch: 모든 소유자 회원 정보
        owner_ids = list(set(int(s.mt_idx) for s in schedules if s.mt_idx))
        member_map = prefetch_members(db, owner_ids)

        for schedule in schedules:
            sst_idx = schedule.sst_idx
            mt_idx = str(schedule.mt_idx)
            schedule_title = schedule.sst_title or "일정"

            owner = member_map.get(int(schedule.mt_idx))
            if not owner or not owner.mt_token_id:
                continue

            dispatch_notification(
                db=db,
                recipient=owner,
                event_type="schedule_start",
                variables={"title": schedule_title},
                plt_condition=plt_condition,
                plt_memo=plt_memo,
                resource_id=sst_idx,
                push_json={},
            )

            # 그룹 일정인 경우 그룹 멤버들에게도 알림 (단일 쿼리)
            if schedule.sgt_idx is not None:
                group_data = GroupDetail.get_group_members_with_roles(db, schedule.sgt_idx)
                all_targets = [t for t in [group_data.get("owner"), group_data.get("leader")] + group_data.get("members", [])
                               if t and str(t.get("mt_idx")) != str(owner.mt_idx) and t.get("mt_token_id")]

                for target in all_targets:
                    dispatch_notification(
                        db=db,
                        recipient=target,
                        event_type="schedule_start",
                        variables={"title": schedule_title},
                        plt_condition=plt_condition,
                        plt_memo=plt_memo,
                        resource_id=sst_idx,
                        push_json={},
                    )

            schedule.sst_schedule_chk = "Y"

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Schedule notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in schedule notifications: {e}")
        db.rollback()


_SILENT_BATCH_SIZE = 500


def run_send_silent_push_to_all_users(db: Session) -> None:
    """모든 FCM 토큰 보유 사용자에게 Silent 푸시 배치 전송 (백그라운드 토큰 유지용)

    메모리 최적화: 전체 Message 리스트를 한번에 구성하지 않고
    500건 청크 단위로 빌드→전송→해제를 반복합니다.
    Config 객체는 한 번만 생성하여 재사용합니다.
    """
    import time as _time
    from firebase_admin import messaging
    from app.core.config import settings
    from app.models.member import Member
    from app.services.firebase_service import firebase_service

    try:
        logger.info("백그라운드 FCM 토큰 유지용 Silent 푸시 배치 전송 시작")

        current_time = datetime.now()
        expired_threshold = current_time + timedelta(days=30)

        priority_members = Member.get_token_expiring_soon(db, expired_threshold)
        all_members = Member.get_token_list(db)

        priority_mt_idxs = {member.mt_idx for member in priority_members}
        remaining_members = [m for m in all_members if m.mt_idx not in priority_mt_idxs]

        target_members = priority_members + remaining_members
        priority_count = len(priority_members)

        logger.info(
            f"FCM 토큰 보유 사용자 수: {len(target_members)} "
            f"(우선순위: {priority_count}, 일반: {len(remaining_members)})"
        )

        if not target_members:
            return

        # 공유 config 객체를 한 번만 생성하여 재사용 (객체 할당 최소화)
        android_cfg = messaging.AndroidConfig(priority="high")
        apns_expiration = str(int(_time.time()) + 7776000)
        apns_payload = messaging.APNSPayload(
            aps=messaging.Aps(content_available=True, thread_id="silent"),
        )

        total_success = 0
        total_fail = 0

        # 청크 단위로 빌드→전송→해제 (메모리 피크 최소화)
        for chunk_start in range(0, len(target_members), _SILENT_BATCH_SIZE):
            chunk = target_members[chunk_start:chunk_start + _SILENT_BATCH_SIZE]
            ts = str(int(_time.time() * 1000))

            messages = []
            for i, member in enumerate(chunk, start=chunk_start):
                reason = "priority_token_refresh" if i < priority_count else "scheduled_token_refresh"
                try:
                    messages.append(messaging.Message(
                        data={
                            "silent_push": "true",
                            "reason": reason,
                            "timestamp": ts,
                            "token_refresh": "true",
                            "background_wake": "true",
                            "force_token_update": "true",
                        },
                        android=android_cfg,
                        apns=messaging.APNSConfig(
                            headers={
                                "apns-push-type": "background",
                                "apns-priority": "10",
                                "apns-topic": settings.IOS_BUNDLE_ID,
                                "apns-expiration": apns_expiration,
                            },
                            payload=apns_payload,
                        ),
                        token=member.mt_token_id,
                    ))
                except Exception as e:
                    logger.warning(f"Silent 메시지 구성 실패 - mt_idx: {member.mt_idx}: {e}")

            if messages:
                responses = firebase_service.send_batch_push(messages)
                total_success += sum(1 for r in responses if r and r.success)
                total_fail += sum(1 for r in responses if not r or not r.success)

        logger.info(
            f"Silent 푸시 배치 전송 완료 - 성공: {total_success}, "
            f"실패: {total_fail}, 전체: {total_success + total_fail}"
        )

    except Exception as e:
        logger.error(f"Silent 푸시 배치 전송 중 오류 발생: {e}")
        db.rollback()


def run_trigger_app_execution_at_7_30pm(db: Session) -> None:
    """앱 실행 트리거 — 최근 1주일 내 접속자만 대상"""
    from app.models.member import Member

    try:
        plt_condition = "일일 - 앱실행알림"
        plt_memo = "저녁 7시 30분 앱 실행 알림"

        members = Member.get_recently_active(db)

        for member in members:
            dispatch_notification(
                db=db,
                recipient=member,
                event_type="app_reengagement",
                variables={},
                plt_condition=plt_condition,
                plt_memo=plt_memo,
            )

        logger.info("App execution trigger executed successfully")

    except Exception as e:
        logger.exception(f"Error in app execution trigger: {e}")
        db.rollback()
