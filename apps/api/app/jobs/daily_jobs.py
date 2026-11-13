"""
일일 알림 작업

- 배터리 부족 알림
- 일일 로그 알림
- 일일 날씨 알림
- 내 위치 푸시 알림
- 이동 감지 알림
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.jobs.base import (
    haversine,
    normalize_lang,
    prefetch_members,
    record_value,
)
from app.services.notifications import dispatch_notifications_batch

logger = logging.getLogger(__name__)


def run_notify_low_battery_at_9pm(db: Session) -> None:
    """배터리 부족 알림"""
    from app.models.member import Member
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "일일 - 배터리알림"
        plt_memo = "저녁 9시 배터리 부족 알림"

        members = Member.get_all_active(db)

        seen_tokens: set = set()
        for member in members:
            if not member.mt_token_id or member.mt_token_id in seen_tokens:
                continue
            seen_tokens.add(member.mt_token_id)
            mt_idx = str(member.mt_idx)

            messages = {
                "ko": {
                    "title": "배터리 부족 알림 🔋",
                    "content": "배터리가 부족해요! 충전해주세요."
                },
                "en": {
                    "title": "Low Battery Alert 🔋",
                    "content": "Your battery is low! Please charge your device."
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

        logger.info("Low battery notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in low battery notifications: {e}")
        db.rollback()


def run_send_daily_log_notifications(db: Session) -> None:
    """일일 로그 알림 (단일 GROUP BY 쿼리로 N+1 해결)"""
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "일일 - 로그알림"
        plt_memo = "오늘의 위치 이동 기록 요약"

        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 단일 GROUP BY 쿼리로 모든 멤버의 오늘 로그 개수 조회
        log_counts_result = db.execute(text(
            "SELECT mt_idx, COUNT(*) as cnt FROM member_location_log_t "
            "WHERE mlt_wdate >= :start GROUP BY mt_idx HAVING cnt > 0"
        ), {"start": today_start}).fetchall()

        if not log_counts_result:
            logger.info("Daily log notifications - 오늘 위치 로그가 있는 멤버 없음")
            return

        # mt_idx -> 로그 개수 매핑
        log_count_map = {int(row.mt_idx): int(row.cnt) for row in log_counts_result}

        # 로그가 있는 멤버만 배치 조회
        member_map = prefetch_members(db, list(log_count_map.keys()))

        seen_tokens: set = set()
        for mt_idx, log_count in log_count_map.items():
            member = member_map.get(mt_idx)
            if not member or not member.mt_token_id:
                continue
            if member.mt_token_id in seen_tokens:
                continue
            seen_tokens.add(member.mt_token_id)

            total_distance = 0  # 실제 거리 계산은 별도 구현 필요
            formatted_distance = "{:,.1f}".format(total_distance)

            messages = {
                "ko": {
                    "title": "오늘의 이동 기록 📊",
                    "content": "오늘 총 {distance}m를 이동했어요!"
                },
                "en": {
                    "title": "Today's Movement Record 📊",
                    "content": "You moved {distance}m today!"
                }
            }

            lang = normalize_lang(getattr(member, "mt_lang", None))
            push_title = messages.get(lang, messages["ko"])["title"]
            push_content = messages.get(lang, messages["ko"])["content"].format(
                distance=formatted_distance
            )

            push_result = send_push(
                member.mt_token_id,
                push_title,
                push_content
            )

            push_log_add(
                db,
                str(mt_idx),
                None,
                plt_condition,
                plt_memo,
                push_title,
                push_content,
                push_result,
                {"distance": formatted_distance}
            )

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Daily log notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in daily log notifications: {e}")
        db.rollback()


def run_send_daily_weather_notifications(db: Session) -> None:
    """일일 날씨 알림 — 최근 1주일 내 접속자만 대상"""
    from app.models.member import Member
    from app.services.weather_service import get_weather_info

    try:
        plt_condition = "일일 - 날씨알림"
        plt_memo = "오늘의 날씨 정보 알림"

        members = Member.get_recently_active(db)

        seen_tokens: set = set()
        batch = []
        for member in members:
            if not member.mt_token_id or member.mt_token_id in seen_tokens:
                continue
            seen_tokens.add(member.mt_token_id)
            weather_info = get_weather_info(db, member.mt_lat, member.mt_long, member.mt_idx)
            if weather_info:
                is_english = str(getattr(member, "mt_lang", "") or "").lower().startswith("en")
                location = weather_info.get("location") or ("your area" if is_english else "현재 위치")
                batch.append({
                    "recipient": member,
                    "event_type": "daily_weather",
                    "variables": {
                        "temp": weather_info["temperature"],
                        "weather": weather_info["weather"],
                        "humidity": weather_info["humidity"],
                        "location": location,
                    },
                    "plt_condition": plt_condition,
                    "plt_memo": plt_memo,
                    "push_json": weather_info,
                })
            else:
                logger.debug(f"[Weather Push] mt_idx={member.mt_idx}: no fresh weather data, skipping")

        dispatch_notifications_batch(db, batch)
        db.commit()
        logger.info("Daily weather notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error sending daily weather notification: {e}")
        db.rollback()


def run_refresh_weather_data(db: Session) -> None:
    """기상청 단기예보 API로 활성 회원의 날씨 데이터를 갱신한다."""
    from app.models.member import Member
    from app.services.weather_service import (
        fetch_kma_forecast,
        latlong_to_grid,
        parse_kma_forecast,
    )

    try:
        import time
        from app.services.weather_service import reverse_geocode

        members = db.query(
            Member.mt_idx, Member.mt_lat, Member.mt_long
        ).filter(
            Member.mt_level > 1,
            Member.mt_status == 1,
            Member.mt_lat.isnot(None),
            Member.mt_long.isnot(None),
        ).all()

        if not members:
            logger.info("[Weather Refresh] No active members with location data")
            return

        grid_members: dict[tuple[int, int], list[int]] = {}
        grid_coords: dict[tuple[int, int], tuple[float, float]] = {}
        for member in members:
            try:
                lat_f = float(member.mt_lat)
                lon_f = float(member.mt_long)
                if not (33.0 <= lat_f <= 39.0 and 124.0 <= lon_f <= 132.0):
                    continue
                nx, ny = latlong_to_grid(lat_f, lon_f)
                if (nx, ny) not in grid_coords:
                    grid_coords[(nx, ny)] = (lat_f, lon_f)
                grid_members.setdefault((nx, ny), []).append(member.mt_idx)
            except (TypeError, ValueError):
                continue

        logger.info(f"[Weather Refresh] {len(members)} members -> {len(grid_members)} unique grids")

        target_date = datetime.now().strftime("%Y%m%d")
        updated_count = 0
        failed_grids = 0
        geo_success = 0

        for (nx, ny), mt_idx_list in grid_members.items():
            raw = fetch_kma_forecast(nx, ny)
            forecast = parse_kma_forecast(raw, target_date)

            if not forecast:
                failed_grids += 1
                continue

            tmx = max(-128, min(127, forecast["tmx"]))
            tmn = max(-128, min(127, forecast["tmn"]))
            sky = max(0, min(127, forecast["sky"]))
            now = datetime.now()

            # 역지오코딩 — Nominatim 1req/sec 제한
            rep_lat, rep_lon = grid_coords[(nx, ny)]
            geo = reverse_geocode(rep_lat, rep_lon)
            time.sleep(1.1)
            if geo:
                geo_success += 1

            try:
                if geo:
                    stmt = text("""
                        UPDATE member_t
                        SET mt_weather_tmx = :tmx,
                            mt_weather_tmn = :tmn,
                            mt_weather_sky = :sky,
                            mt_weather_pop = :pop,
                            mt_weather_date = :wdate,
                            mt_sido = :sido,
                            mt_gu = :gu,
                            mt_dong = :dong
                        WHERE mt_idx IN :mt_idxs
                    """).bindparams(bindparam("mt_idxs", expanding=True))
                    db.execute(stmt, {
                        "tmx": tmx, "tmn": tmn, "sky": sky,
                        "pop": forecast["pop"], "wdate": now,
                        "sido": geo["sido"], "gu": geo["gu"], "dong": geo["dong"],
                        "mt_idxs": list(mt_idx_list),
                    })
                else:
                    stmt = text("""
                        UPDATE member_t
                        SET mt_weather_tmx = :tmx,
                            mt_weather_tmn = :tmn,
                            mt_weather_sky = :sky,
                            mt_weather_pop = :pop,
                            mt_weather_date = :wdate
                        WHERE mt_idx IN :mt_idxs
                    """).bindparams(bindparam("mt_idxs", expanding=True))
                    db.execute(stmt, {
                        "tmx": tmx, "tmn": tmn, "sky": sky,
                        "pop": forecast["pop"], "wdate": now,
                        "mt_idxs": list(mt_idx_list),
                    })
                updated_count += len(mt_idx_list)
            except Exception as e:
                logger.warning(
                    f"[Weather Refresh] Grid ({nx},{ny}) update failed: {e}, "
                    f"values: tmx={tmx} tmn={tmn} sky={sky}"
                )
                failed_grids += 1
                db.rollback()

        db.commit()
        logger.info(
            f"[Weather Refresh] Done: {updated_count} members updated, "
            f"{geo_success}/{len(grid_members)} grids geocoded, {failed_grids} grids failed"
        )

    except Exception as e:
        logger.exception(f"[Weather Refresh] Error: {e}")
        db.rollback()


def run_send_my_location_push_notifications(db: Session) -> None:
    """내 위치 푸시 알림"""
    from app.models.my_location import MyLocation
    from app.models.member import Member
    from app.models.member_location_log import MemberLocationLog
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "일일 - 내위치알림"
        plt_memo = "내가 등록한 장소 근처에 있는지 확인"

        my_locations = MyLocation.get_all_active(db)

        for loc in my_locations:
            mt_idx = str(loc["mt_idx"])
            slt_idx = loc["slt_idx"]

            member = Member.find_by_idx(db, int(mt_idx))
            if not member:
                continue

            member_location = MemberLocationLog.getDistance(
                db,
                str(loc["slt_lat"]),
                str(loc["slt_long"]),
                mt_idx
            )

            if member_location:
                distance = member_location["distance"]
                formatted_distance = "{:,.1f}".format(distance)
                push_json = {
                    "lat": "{:.7f}".format(float(loc["slt_lat"])),
                    "lng": "{:.7f}".format(float(loc["slt_long"])),
                    "distance": formatted_distance
                }

                # 1km 이내에 있는 경우
                if distance <= 1000.0:
                    messages = {
                        "ko": {
                            "title": "내 장소 근처 알림 📍",
                            "content": "'{title}' 장소에서 {distance}m 거리에 있어요!"
                        },
                        "en": {
                            "title": "Near My Location Alert 📍",
                            "content": "You are {distance}m away from '{title}'!"
                        }
                    }

                    lang = normalize_lang(getattr(member, "mt_lang", None))
                    loc_msg = messages.get(lang, messages["ko"])
                    push_title = loc_msg["title"]
                    push_content = loc_msg["content"].format(
                        title=loc.get("slt_title") or "내장소",
                        distance=formatted_distance
                    )

                    push_result = send_push(
                        member.mt_token_id,
                        push_title,
                        push_content
                    )

                    push_log_add(
                        db,
                        mt_idx,
                        slt_idx,
                        plt_condition,
                        plt_memo,
                        push_title,
                        push_content,
                        push_result,
                        push_json
                    )

        logger.info("My location push notifications executed successfully")

    except Exception as e:
        logger.exception(f"Error in my location push notifications: {e}")
        db.rollback()


def run_schedule_movement_alert(db: Session) -> None:
    """일정 이동 알림"""
    from app.models.schedule import Schedule
    from app.models.member import Member
    from app.models.member_location_log import MemberLocationLog
    from app.services.push_service import send_push, push_log_add

    try:
        plt_condition = "5분 - 이동알림"
        plt_memo = "일정 장소로 이동 중인지 확인"

        # 1시간 이내에 시작하는 일정 가져오기
        schedules = Schedule.get_upcoming_schedules(
            db,
            hours=1
        )

        for schedule in schedules:
            sst_idx = schedule.sst_idx
            mt_idx = str(schedule.mt_idx)

            # 일정 소유자 정보 가져오기
            owner = Member.find_by_idx(db, mt_idx)
            if not owner:
                continue

            # 회원의 최근 위치와 일정 장소 사이의 거리 계산
            member_location = MemberLocationLog.getDistance(
                db,
                str(schedule.sst_location_lat),
                str(schedule.sst_location_long),
                mt_idx
            )

            if member_location:
                distance = member_location["distance"]
                formatted_distance = "{:,.1f}".format(distance)
                push_json = {
                    "lat": "{:.7f}".format(float(schedule.sst_location_lat)),
                    "lng": "{:.7f}".format(float(schedule.sst_location_long)),
                    "distance": formatted_distance
                }

                # 1km 이상 떨어져 있고, 아직 이동 중 알림을 받지 않은 경우
                if distance >= 1000.0 and not getattr(schedule, "sst_movement_alert_sent", False):
                    messages = {
                        "ko": {
                            "title": "일정 이동 알림 🚶",
                            "content": "'{title}' 일정 장소까지 {distance}m 남았어요!"
                        },
                        "en": {
                            "title": "Schedule Movement Alert 🚶",
                            "content": "You are {distance}m away from '{title}' schedule location!"
                        }
                    }

                    lang = normalize_lang(getattr(owner, "mt_lang", None))
                    push_title = messages.get(lang, messages["ko"])["title"]
                    push_content = messages.get(lang, messages["ko"])["content"].format(
                        title=schedule.sst_title,
                        distance=formatted_distance
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
                        push_json
                    )

                    # 이동 중 알림 상태 업데이트 (sst_alram 활용)
                    schedule.sst_alram = 0

        # 루프 완료 후 단일 커밋
        db.commit()
        logger.info("Schedule movement alerts executed successfully")

    except Exception as e:
        logger.exception(f"Error in schedule movement alerts: {e}")
        db.rollback()
