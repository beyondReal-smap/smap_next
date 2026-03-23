"""
위치 진입/퇴장 알림 작업

- 그룹 일정 장소 진입/퇴장 알림
- My Place 진입/퇴장 알림
"""
import logging
from typing import Dict

from sqlalchemy.orm import Session

from app.jobs.base import (
    get_group_member_data,
    haversine,
    normalize_lang,
    prefetch_members,
    record_value,
    render_push_message,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 내부 헬퍼
# ---------------------------------------------------------------------------

def _send_entry_notifications(
    db: Session,
    group_data: Dict,
    schedule,
    plt_condition: str,
    plt_memo: str,
    push_json: Dict,
) -> None:
    """진입 알림을 전송합니다."""
    from app.services.push_service import send_push, push_log_add

    try:
        messages = {
            "ko": {
                "title": "일정장소 도착알림 📍",
                "content": "{name}님이 '{title}' 장소에 도착했어요! 🎉"
            },
            "en": {
                "title": "Arrival at scheduled location 📍",
                "content": "{name} has arrived at '{title}'! 🎉"
            }
        }

        actor_name = group_data["member"].get("mt_name", "회원")
        schedule_title = record_value(schedule, "sst_title") or "일정"

        for target in [group_data.get("owner", {}), group_data.get("leader", {})]:
            if not target:
                continue
            if str(target.get("mt_idx")) == str(group_data["member"].get("mt_idx")):
                continue

            lang = normalize_lang(target.get("mt_lang"))
            fallback_template = messages.get(lang, messages["ko"])
            push_title, push_content = render_push_message(
                event_type="schedule_place_entry",
                lang=lang,
                variables={"name": actor_name, "title": schedule_title},
                fallback_template=fallback_template,
            )

            push_result = send_push(
                target.get("mt_token_id"),
                push_title,
                push_content
            )

            push_log_add(
                db,
                target.get("mt_idx"),
                record_value(schedule, "sst_idx"),
                plt_condition,
                plt_memo,
                push_title,
                push_content,
                push_result,
                push_json
            )

    except Exception as e:
        logger.exception(f"Error sending entry notifications: {e}")


def _send_exit_notifications(
    db: Session,
    group_data: Dict,
    schedule,
    plt_condition: str,
    plt_memo: str,
    push_json: Dict,
) -> None:
    """이탈 알림을 전송합니다."""
    from app.services.push_service import send_push, push_log_add

    try:
        messages = {
            "ko": {
                "title": "일정장소 출발알림 👋",
                "content": "{name}님이 '{title}' 장소에서 출발했어요!"
            },
            "en": {
                "title": "Departure from scheduled location 👋",
                "content": "{name} has departed from '{title}'!"
            }
        }

        actor_name = group_data["member"].get("mt_name", "회원")
        schedule_title = record_value(schedule, "sst_title") or "일정"

        for target in [group_data.get("owner", {}), group_data.get("leader", {})]:
            if not target:
                continue
            if str(target.get("mt_idx")) == str(group_data["member"].get("mt_idx")):
                continue

            lang = normalize_lang(target.get("mt_lang"))
            fallback_template = messages.get(lang, messages["ko"])
            push_title, push_content = render_push_message(
                event_type="schedule_place_exit",
                lang=lang,
                variables={"name": actor_name, "title": schedule_title},
                fallback_template=fallback_template,
            )

            push_result = send_push(
                target.get("mt_token_id"),
                push_title,
                push_content
            )

            push_log_add(
                db,
                target.get("mt_idx"),
                record_value(schedule, "sst_idx"),
                plt_condition,
                plt_memo,
                push_title,
                push_content,
                push_result,
                push_json
            )

    except Exception as e:
        logger.exception(f"Error sending exit notifications: {e}")


def _update_entry_status(db: Session, sst_idx: int) -> None:
    """진입 상태를 업데이트합니다."""
    from app.models.schedule import Schedule

    try:
        schedule = Schedule.find_by_idx(db, sst_idx)
        if schedule:
            schedule.sst_in_chk = "Y"
            schedule.sst_entry_cnt = (schedule.sst_entry_cnt or 0) + 1
            db.commit()

    except Exception as e:
        logger.exception(f"Error updating entry status: {e}")
        db.rollback()


def _update_exit_status(db: Session, sst_idx: int) -> None:
    """이탈 상태를 업데이트합니다."""
    from app.models.schedule import Schedule

    try:
        schedule = Schedule.find_by_idx(db, sst_idx)
        if schedule:
            schedule.sst_in_chk = "N"
            schedule.sst_exit_cnt = (schedule.sst_exit_cnt or 0) + 1
            db.commit()

    except Exception as e:
        logger.exception(f"Error updating exit status: {e}")
        db.rollback()


# ---------------------------------------------------------------------------
# 공개 작업 함수
# ---------------------------------------------------------------------------

def run_location_entry_alert(db: Session) -> None:
    """일정 장소 진입 알림 (배치 최적화)"""
    from app.models.schedule import Schedule
    from app.models.group_detail import GroupDetail
    from app.models.member_location_log import MemberLocationLog

    try:
        plt_condition = "30초 - 장소알림"
        plt_memo = "일정에 입력한 장소의 100미터 반경에 들어왔을때"

        schedules = Schedule.get_now_schedule_in_members(db)
        if not schedules:
            return

        # 배치 Phase 1: GroupDetail sgdt_idx -> mt_idx 매핑
        sgdt_ids = [int(record_value(s, "sgdt_idx")) for s in schedules
                    if record_value(s, "sgdt_idx") not in (None, 0)]
        gd_map = {}
        if sgdt_ids:
            for i in range(0, len(sgdt_ids), 500):
                chunk = sgdt_ids[i:i + 500]
                for gd in db.query(GroupDetail).filter(GroupDetail.sgdt_idx.in_(chunk)).all():
                    gd_map[gd.sgdt_idx] = gd

        # 배치 Phase 2: 관련 mt_idx의 최근 위치 사전로드
        mt_idx_set = set()
        for s in schedules:
            sgdt_idx = record_value(s, "sgdt_idx")
            if sgdt_idx and int(sgdt_idx) in gd_map:
                mt_idx_set.add(gd_map[int(sgdt_idx)].mt_idx)
        recent_locs = MemberLocationLog.get_recent_locations_batch(db, list(mt_idx_set))

        for schedule in schedules:
            mt_idx = None
            sst_idx = record_value(schedule, "sst_idx")
            sgt_idx = None

            if record_value(schedule, "sgt_idx") is not None and record_value(schedule, "sgdt_idx") not in (None, 0):
                sgt_idx = str(record_value(schedule, "sgt_idx"))
                gd = gd_map.get(int(record_value(schedule, "sgdt_idx")))
                if gd:
                    mt_idx = str(gd.mt_idx)

            if mt_idx and int(record_value(schedule, "mt_idx") or 0) != int(mt_idx):
                member_loc = recent_locs.get(int(mt_idx))
                if not member_loc:
                    continue

                target_lat = float(record_value(schedule, "sst_location_lat"))
                target_long = float(record_value(schedule, "sst_location_long"))
                distance = haversine(member_loc["lat"], member_loc["long"], target_lat, target_long)
                formatted_distance = "{:,.1f}".format(distance)
                push_json = {
                    "lat": "{:.7f}".format(target_lat),
                    "lng": "{:.7f}".format(target_long),
                    "distance": formatted_distance
                }

                if distance <= 100.0 and int(record_value(schedule, "sst_entry_cnt") or 0) == 0:
                    group_data = get_group_member_data(db, sgt_idx, mt_idx)
                    _send_entry_notifications(db, group_data, schedule, plt_condition, plt_memo, push_json)
                    _update_entry_status(db, record_value(schedule, "sst_idx"))

        logger.info("Location entry alert executed successfully")

    except Exception as e:
        logger.exception(f"Error in location entry alert: {e}")


def run_location_exit_alert(db: Session) -> None:
    """일정 장소 이탈 알림 (배치 최적화)"""
    from app.models.schedule import Schedule
    from app.models.group_detail import GroupDetail
    from app.models.member_location_log import MemberLocationLog

    try:
        plt_condition = "30초 - 장소알림"
        plt_memo = "일정에 입력한 장소의 100미터 반경에서 이탈했을때"

        schedules = Schedule.get_now_schedule_out_members(db)
        if not schedules:
            return

        # 배치 Phase 1: GroupDetail 사전로드
        sgdt_ids = [int(record_value(s, "sgdt_idx")) for s in schedules
                    if record_value(s, "sgdt_idx") not in (None, 0)]
        gd_map = {}
        if sgdt_ids:
            for i in range(0, len(sgdt_ids), 500):
                chunk = sgdt_ids[i:i + 500]
                for gd in db.query(GroupDetail).filter(GroupDetail.sgdt_idx.in_(chunk)).all():
                    gd_map[gd.sgdt_idx] = gd

        # 배치 Phase 2: 최근 위치 사전로드
        mt_idx_set = set()
        for s in schedules:
            sgdt_idx = record_value(s, "sgdt_idx")
            if sgdt_idx and int(sgdt_idx) in gd_map:
                mt_idx_set.add(gd_map[int(sgdt_idx)].mt_idx)
        recent_locs = MemberLocationLog.get_recent_locations_batch(db, list(mt_idx_set))

        for schedule in schedules:
            mt_idx = None
            sgt_idx = None

            if record_value(schedule, "sgt_idx") is not None and record_value(schedule, "sgdt_idx") not in (None, 0):
                sgt_idx = str(record_value(schedule, "sgt_idx"))
                gd = gd_map.get(int(record_value(schedule, "sgdt_idx")))
                if gd:
                    mt_idx = str(gd.mt_idx)

            if mt_idx and int(record_value(schedule, "mt_idx") or 0) != int(mt_idx):
                member_loc = recent_locs.get(int(mt_idx))
                if not member_loc:
                    continue

                target_lat = float(record_value(schedule, "sst_location_lat"))
                target_long = float(record_value(schedule, "sst_location_long"))
                distance = haversine(member_loc["lat"], member_loc["long"], target_lat, target_long)
                formatted_distance = "{:,.1f}".format(distance)
                push_json = {
                    "lat": "{:.7f}".format(target_lat),
                    "lng": "{:.7f}".format(target_long),
                    "distance": formatted_distance
                }

                if distance >= 100.0 and int(record_value(schedule, "sst_exit_cnt") or 0) == 0:
                    group_data = get_group_member_data(db, sgt_idx, mt_idx)
                    _send_exit_notifications(db, group_data, schedule, plt_condition, plt_memo, push_json)
                    _update_exit_status(db, record_value(schedule, "sst_idx"))

        logger.info("Location exit alert executed successfully")

    except Exception as e:
        logger.exception(f"Error in location exit alert: {e}")


def run_my_location_entry_alert(db: Session) -> None:
    """내 장소 진입 알림 (배치 최적화)"""
    from app.models.my_location import MyLocation
    from app.models.member_location_log import MemberLocationLog
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "30s - My Place Entry"
        plt_memo = "내가 등록한 장소의 100미터 반경에 들어왔을때"

        my_locations = MyLocation.get_all_active(db)
        # 미진입 상태만 필터
        candidates = [loc for loc in my_locations if loc.get("slt_enter_chk") != "Y"]
        if not candidates:
            return

        # 배치 prefetch: 회원 최근 위치 + 회원 정보
        mt_idx_list = list(set(int(loc["mt_idx"]) for loc in candidates))
        recent_locs = MemberLocationLog.get_recent_locations_batch(db, mt_idx_list)
        member_map = prefetch_members(db, mt_idx_list)

        for loc in candidates:
            mt_idx = int(loc["mt_idx"])
            slt_idx = loc["slt_idx"]
            member_loc = recent_locs.get(mt_idx)
            if not member_loc:
                continue

            target_lat = float(loc["slt_lat"])
            target_long = float(loc["slt_long"])
            distance = haversine(member_loc["lat"], member_loc["long"], target_lat, target_long)
            formatted_distance = "{:,.1f}".format(distance)

            if distance <= 100.0:
                member = member_map.get(mt_idx)
                if member and member.mt_token_id:
                    lang = normalize_lang(getattr(member, "mt_lang", None))
                    location_title = loc.get("slt_title") or "내장소"
                    member_name = member.mt_nickname or member.mt_name or "회원"

                    fallback = {
                        "title": "내장소 방문알림 📍",
                        "content": "{name}님이 내장소 '{title}'에 방문했어요! 🎉",
                    } if lang == "ko" else {
                        "title": "My place arrival 📍",
                        "content": "{name} arrived at '{title}'! 🎉",
                    }

                    push_title, push_content = render_push_message(
                        event_type="my_place_entry", lang=lang,
                        variables={"name": member_name, "title": location_title},
                        fallback_template=fallback,
                    )

                    push_result = send_push(member.mt_token_id, push_title, push_content)
                    push_log_add(
                        db, mt_idx, slt_idx, plt_condition, plt_memo,
                        push_title, push_content, push_result,
                        {"lat": "{:.7f}".format(target_lat), "lng": "{:.7f}".format(target_long), "distance": formatted_distance}
                    )

                    location_obj = MyLocation.find_by_idx(db, slt_idx)
                    if location_obj:
                        location_obj.slt_enter_chk = "Y"

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("My location entry alert executed successfully")

    except Exception as e:
        logger.exception(f"Error in my location entry alert: {e}")
        db.rollback()


def run_my_location_exit_alert(db: Session) -> None:
    """내 장소 이탈 알림 (배치 최적화)"""
    from app.models.my_location import MyLocation
    from app.models.member_location_log import MemberLocationLog
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "30s - My Place Exit"
        plt_memo = "내가 등록한 장소의 100미터 반경에서 이탈했을때"

        my_locations = MyLocation.get_all_active_in(db)
        if not my_locations:
            return

        # 배치 prefetch
        mt_idx_list = list(set(int(loc["mt_idx"]) for loc in my_locations))
        recent_locs = MemberLocationLog.get_recent_locations_batch(db, mt_idx_list)
        member_map = prefetch_members(db, mt_idx_list)

        for loc in my_locations:
            mt_idx = int(loc["mt_idx"])
            slt_idx = loc["slt_idx"]
            member_loc = recent_locs.get(mt_idx)
            if not member_loc:
                continue

            target_lat = float(loc["slt_lat"])
            target_long = float(loc["slt_long"])
            distance = haversine(member_loc["lat"], member_loc["long"], target_lat, target_long)
            formatted_distance = "{:,.1f}".format(distance)

            if distance >= 100.0:
                member = member_map.get(mt_idx)
                if member and member.mt_token_id:
                    lang = normalize_lang(getattr(member, "mt_lang", None))
                    location_title = loc.get("slt_title") or "내장소"
                    member_name = member.mt_nickname or member.mt_name or "회원"

                    fallback = {
                        "title": "내장소 이탈알림 👋",
                        "content": "{name}님이 내장소 '{title}'에서 이탈했어요!",
                    } if lang == "ko" else {
                        "title": "My place departure 👋",
                        "content": "{name} departed from '{title}'!",
                    }

                    push_title, push_content = render_push_message(
                        event_type="my_place_exit", lang=lang,
                        variables={"name": member_name, "title": location_title},
                        fallback_template=fallback,
                    )

                    push_result = send_push(member.mt_token_id, push_title, push_content)
                    push_log_add(
                        db, mt_idx, slt_idx, plt_condition, plt_memo,
                        push_title, push_content, push_result,
                        {"lat": "{:.7f}".format(target_lat), "lng": "{:.7f}".format(target_long), "distance": formatted_distance}
                    )

                    location_obj = MyLocation.find_by_idx(db, slt_idx)
                    if location_obj:
                        location_obj.slt_enter_chk = "N"

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("My location exit alert executed successfully")

    except Exception as e:
        logger.exception(f"Error in my location exit alert: {e}")
        db.rollback()
