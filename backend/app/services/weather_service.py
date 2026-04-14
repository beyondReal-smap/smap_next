"""날씨 정보 서비스 — member_t 테이블의 기존 날씨 데이터를 활용합니다."""
import logging
from typing import Optional, Dict
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_weather_info(db: Session, lat, long) -> Optional[Dict]:
    """회원의 위치 기반 날씨 정보를 반환합니다.

    현재는 member_t에 저장된 날씨 데이터가 별도 프로세스(앱/크롤러)에 의해
    업데이트되므로, 여기서는 가장 가까운 회원의 날씨 데이터를 재활용합니다.
    """
    if lat is None or long is None:
        return None

    try:
        from sqlalchemy import text
        lat_f, lng_f = float(lat), float(long)
        result = db.execute(text("""
            SELECT mt_weather_sky, mt_weather_tmx, mt_weather_tmn,
                   mt_weather_pop, mt_sido, mt_gu, mt_dong
            FROM member_t
            WHERE mt_weather_sky IS NOT NULL
              AND mt_weather_tmx IS NOT NULL
              AND mt_lat IS NOT NULL
              AND mt_status = 1
              AND mt_lat BETWEEN :lat_min AND :lat_max
              AND mt_long BETWEEN :lng_min AND :lng_max
            ORDER BY ABS(mt_lat - :lat) + ABS(mt_long - :lng)
            LIMIT 1
        """), {
            "lat": lat_f, "lng": lng_f,
            "lat_min": lat_f - 0.1, "lat_max": lat_f + 0.1,
            "lng_min": lng_f - 0.1, "lng_max": lng_f + 0.1,
        }).first()

        if not result:
            return None

        return {
            "temperature": result.mt_weather_tmx,
            "weather": _sky_to_text(result.mt_weather_sky),
            "humidity": result.mt_weather_pop or "0",
            "location": f"{result.mt_sido or ''} {result.mt_gu or ''} {result.mt_dong or ''}".strip(),
        }
    except Exception as e:
        logger.error(f"Error in get_weather_info: {e}")
        return None


def _sky_to_text(sky) -> str:
    """기상청 하늘 상태 코드를 텍스트로 변환합니다."""
    mapping = {1: "맑음", 3: "구름많음", 4: "흐림"}
    return mapping.get(int(sky) if sky else 0, "맑음")
