"""간헐적 흥미 유발 푸시 알림 (07:00~22:00, 하루 1-2회 랜덤)"""
import logging
import random
from datetime import datetime, date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

_PLT_CONDITION = "engagement_push"


def run_engagement_push(db: Session) -> None:
    now = datetime.now()
    hour = now.hour

    # 22:00~07:00 발송 금지
    if hour < 7 or hour >= 22:
        return

    # 오늘 배치 실행 현황 (plt_memo로 1회차/2회차 구분)
    today = date.today().isoformat()
    batch_rows = db.execute(text("""
        SELECT DISTINCT plt_memo
        FROM push_log_t
        WHERE plt_condition = :cond
          AND DATE(plt_wdate) = :today
    """), {"cond": _PLT_CONDITION, "today": today}).fetchall()

    completed = {row.plt_memo for row in batch_rows}

    if "batch_2" in completed:
        return  # 오늘 2회 완료
    elif "batch_1" in completed:
        prob = 0.04
        batch_memo = "batch_2"
    else:
        prob = 0.08
        batch_memo = "batch_1"

    if random.random() > prob:
        return

    # 시간대별 event_type
    if hour < 12:
        event_type = "engagement_morning"
    elif hour < 17:
        event_type = "engagement_afternoon"
    else:
        event_type = "engagement_evening"

    # 활성 멤버 조회 — 토큰 중복 제거(같은 토큰 여러 계정 보유 시 1건만)
    stale_cutoff = now - timedelta(hours=24)
    members = db.execute(text("""
        SELECT mt_idx, mt_token_id, mt_lang,
               mt_sido, mt_gu,
               mt_weather_sky, mt_weather_tmx, mt_weather_date
        FROM member_t
        WHERE mt_status = 1
          AND mt_token_id IS NOT NULL
          AND mt_token_id != ''
          AND mt_idx = (
              SELECT MIN(m2.mt_idx)
              FROM member_t m2
              WHERE m2.mt_token_id = member_t.mt_token_id
                AND m2.mt_status = 1
          )
    """), {}).fetchall()

    if not members:
        return

    from app.jobs.base import normalize_lang, render_push_message
    from app.services.push_service import send_push, push_log_add
    from app.services.weather_service import _sky_to_text
    from app.services.notifications.catalog import get_templates

    success = 0
    for member in members:
        lang = normalize_lang(member.mt_lang)

        has_weather = (
            member.mt_weather_sky is not None
            and member.mt_weather_tmx is not None
            and member.mt_weather_date is not None
            and member.mt_weather_date >= stale_cutoff
            and member.mt_sido
        )

        variables = {}
        if has_weather:
            variables = {
                "location": f"{member.mt_sido} {member.mt_gu or ''}".strip(),
                "weather": _sky_to_text(member.mt_weather_sky),
                "temp": str(member.mt_weather_tmx),
            }

        templates = get_templates(event_type, lang)
        fallback = templates[0] if templates else {"title": "안녕하세요 👋", "content": "스맵에서 오늘을 확인해보세요!"}

        title, content = render_push_message(
            event_type=event_type,
            lang=lang,
            variables=variables,
            fallback_template=fallback,
        )

        push_result = send_push(member.mt_token_id, title, content)
        push_log_add(
            db,
            member.mt_idx,
            None,
            _PLT_CONDITION,
            batch_memo,
            title,
            content,
            push_result,
            {},
        )
        success += 1

    db.commit()
    logger.info(f"[Engagement Push] {batch_memo}: {success}명 발송 완료 (event_type={event_type})")
