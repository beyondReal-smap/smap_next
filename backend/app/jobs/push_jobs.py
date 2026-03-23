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
    normalize_lang,
    prefetch_members,
    render_push_message,
)

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
    from app.services.push_service import send_push, push_log_add

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

            # 푸시 알림 메시지 생성 및 전송
            messages = {
                "ko": {
                    "title": "일정 시작 알림 ⏰",
                    "content": "'{title}' 일정이 30분 후에 시작해요!"
                },
                "en": {
                    "title": "Schedule Start Alert ⏰",
                    "content": "Schedule '{title}' starts in 30 minutes!"
                }
            }

            owner_lang = normalize_lang(owner.mt_lang)
            owner_fallback = messages.get(owner_lang, messages["ko"])
            push_title, push_content = render_push_message(
                event_type="schedule_start",
                lang=owner_lang,
                variables={"title": schedule_title},
                fallback_template=owner_fallback,
            )

            push_result = send_push(
                owner.mt_token_id,
                push_title,
                push_content
            )

            push_log_add(
                db,
                mt_idx,
                sst_idx,
                plt_condition,
                plt_memo,
                push_title,
                push_content,
                push_result,
                {}
            )

            # 그룹 일정인 경우 그룹 멤버들에게도 알림 (단일 쿼리)
            if schedule.sgt_idx is not None:
                group_data = GroupDetail.get_group_members_with_roles(db, schedule.sgt_idx)
                all_targets = [t for t in [group_data.get("owner"), group_data.get("leader")] + group_data.get("members", [])
                               if t and str(t.get("mt_idx")) != str(owner.mt_idx) and t.get("mt_token_id")]

                for target in all_targets:
                    target_lang = normalize_lang(target.get("mt_lang"))
                    target_fallback = messages.get(target_lang, messages["ko"])
                    member_title, member_content = render_push_message(
                        event_type="schedule_start",
                        lang=target_lang,
                        variables={"title": schedule_title},
                        fallback_template=target_fallback,
                    )

                    push_result = send_push(
                        target.get("mt_token_id"),
                        member_title,
                        member_content
                    )

                    push_log_add(
                        db,
                        str(target.get("mt_idx")),
                        sst_idx,
                        plt_condition,
                        plt_memo,
                        member_title,
                        member_content,
                        push_result,
                        {}
                    )

            schedule.sst_schedule_chk = "Y"

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Schedule notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in schedule notifications: {e}")
        db.rollback()


def run_send_silent_push_to_all_users(db: Session) -> None:
    """모든 FCM 토큰 보유 사용자에게 Silent 푸시 전송 (백그라운드 토큰 유지용)"""
    from app.models.member import Member
    from app.services.firebase_service import firebase_service

    try:
        logger.info("백그라운드 FCM 토큰 유지용 Silent 푸시 배치 전송 시작")

        # FCM 토큰이 있는 모든 사용자 조회 (토큰 만료 임박 사용자 우선)
        current_time = datetime.now()
        expired_threshold = current_time + timedelta(days=30)

        # 우선순위 1: 토큰 만료 임박 사용자
        priority_members = Member.get_token_expiring_soon(db, expired_threshold)
        # 우선순위 2: 나머지 모든 토큰 보유 사용자
        all_members = Member.get_token_list(db)

        # 중복 제거를 위해 우선순위 멤버들을 제외한 나머지 멤버들
        priority_mt_idxs = {member.mt_idx for member in priority_members}
        remaining_members = [member for member in all_members if member.mt_idx not in priority_mt_idxs]

        # 우선순위 멤버 먼저, 나머지 멤버들 뒤에 추가
        target_members = priority_members + remaining_members

        logger.info(f"FCM 토큰 보유 사용자 수: {len(target_members)} (우선순위: {len(priority_members)}, 일반: {len(remaining_members)})")

        success_count = 0
        fail_count = 0
        priority_success_count = 0
        priority_fail_count = 0

        for i, member in enumerate(target_members):
            try:
                is_priority = i < len(priority_members)
                reason = "priority_token_refresh" if is_priority else "scheduled_token_refresh"
                priority = "high" if is_priority else "high"  # 모두 high로 설정하여 푸시 수신 보장

                # 각 사용자에게 silent push 전송 (priority를 높게 설정하여 iOS 무시 방지)
                response = firebase_service.send_silent_push_notification(
                    member.mt_token_id,
                    reason,
                    priority
                )

                if is_priority:
                    priority_success_count += 1
                success_count += 1

                logger.debug(f"Silent 푸시 전송 성공 - mt_idx: {member.mt_idx}, 우선순위: {is_priority}, 토큰 만료일: {member.mt_token_expiry_date}")

            except Exception as e:
                if i < len(priority_members):
                    priority_fail_count += 1
                fail_count += 1
                logger.error(f"Silent 푸시 전송 실패 - mt_idx: {member.mt_idx}, error: {str(e)}")

        logger.info(f"Silent 푸시 배치 전송 완료 - 전체: {success_count}/{len(target_members)} 성공")
        logger.info(f"우선순위 토큰: {priority_success_count}/{len(priority_members)} 성공, 일반 토큰: {success_count - priority_success_count}/{len(remaining_members)} 성공")

        if fail_count > 0:
            logger.warning(f"Silent 푸시 전송 실패: {fail_count}개 (우선순위 실패: {priority_fail_count})")

    except Exception as e:
        logger.error(f"Silent 푸시 배치 전송 중 오류 발생: {e}")
        db.rollback()


def run_trigger_app_execution_at_7_30pm(db: Session) -> None:
    """앱 실행 트리거"""
    from app.models.member import Member
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "일일 - 앱실행알림"
        plt_memo = "저녁 7시 30분 앱 실행 알림"

        members = Member.get_all_active(db)

        for member in members:
            mt_idx = str(member.mt_idx)

            messages = {
                "ko": {
                    "title": "오늘 하루는 어떠셨나요? 🌙",
                    "content": "오늘의 일정과 위치 기록을 확인해보세요!"
                },
                "en": {
                    "title": "How was your day? 🌙",
                    "content": "Check your today's schedule and location records!"
                }
            }

            lang = normalize_lang(getattr(member, "mt_lang", None))
            push_title = messages.get(lang, messages["ko"])["title"]
            push_content = messages.get(lang, messages["ko"])["content"]

            push_result = send_push(
                member.mt_token_id,
                push_title,
                push_content
            )

            push_log_add(
                db,
                mt_idx,
                None,
                plt_condition,
                plt_memo,
                push_title,
                push_content,
                push_result,
                {}
            )

        logger.info("App execution trigger executed successfully")

    except Exception as e:
        logger.exception(f"Error in app execution trigger: {e}")
        db.rollback()
