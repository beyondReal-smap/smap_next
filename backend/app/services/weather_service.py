"""날씨 정보 서비스 — member_t 테이블의 기존 날씨 데이터를 활용합니다."""
import logging
import math
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# 기상청 Lambert Conformal Conic 격자 변환 상수
_KMA_RE = 6371.00877  # 지구 반경 (km)
_KMA_GRID = 5.0       # 격자 간격 (km)
_KMA_SLAT1 = 30.0     # 표준위도 1
_KMA_SLAT2 = 60.0     # 표준위도 2
_KMA_OLON = 126.0     # 기준점 경도
_KMA_OLAT = 38.0      # 기준점 위도
_KMA_XO = 210 / _KMA_GRID  # 기준점 X좌표
_KMA_YO = 675 / _KMA_GRID  # 기준점 Y좌표


def latlong_to_grid(lat: float, lon: float) -> tuple[int, int]:
    """위경도를 기상청 격자 좌표(nx, ny)로 변환한다.

    기상청 단기예보 API는 Lambert Conformal Conic 투영의
    5km 격자 좌표를 사용한다. PHP weather.inc.php의 lamcproj 포팅.
    """
    DEGRAD = math.pi / 180.0

    re = _KMA_RE / _KMA_GRID
    slat1 = _KMA_SLAT1 * DEGRAD
    slat2 = _KMA_SLAT2 * DEGRAD
    olon = _KMA_OLON * DEGRAD
    olat = _KMA_OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    ra = math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lon * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    x = ra * math.sin(theta) + _KMA_XO
    y = ro - ra * math.cos(theta) + _KMA_YO
    return int(x + 1.5), int(y + 1.5)


def parse_kma_forecast(response: dict | None, target_date: str) -> dict | None:
    """기상청 단기예보 JSON 응답에서 TMX, TMN, SKY, POP를 추출한다."""
    if not response:
        return None

    try:
        header = response.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.warning(f"KMA API error: {header.get('resultMsg')}")
            return None

        items = (
            response.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
        )
        if not items:
            return None

        result = {}
        tmp_today = None       # TMP(현재기온) 폴백용
        next_date_tmx = None   # 다음날 TMX 폴백용
        next_date_tmn = None   # 다음날 TMN 폴백용

        def _valid_temp(val) -> int | None:
            """기상청 결측값(-999 등)을 필터링하고 정수 온도를 반환한다."""
            v = int(float(val))
            return v if -80 <= v <= 60 else None  # 지구상 기온 범위

        for item in items:
            cat = item.get("category")
            fdate = item.get("fcstDate")
            val = item.get("fcstValue")

            # 기상청 결측값 스킵 (-999, -998 등)
            if val is None or float(val) <= -900:
                continue

            if fdate == target_date:
                if cat == "TMX" and "tmx" not in result:
                    t = _valid_temp(val)
                    if t is not None:
                        result["tmx"] = t
                elif cat == "TMN" and "tmn" not in result:
                    t = _valid_temp(val)
                    if t is not None:
                        result["tmn"] = t
                elif cat == "SKY" and "sky" not in result:
                    result["sky"] = int(val)
                elif cat == "POP" and "pop" not in result:
                    result["pop"] = f"{val}%"
                elif cat == "TMP" and tmp_today is None:
                    t = _valid_temp(val)
                    if t is not None:
                        tmp_today = t
            else:
                # 다음날 TMX/TMN (오후 발표 시 오늘 TMX/TMN 없을 때 폴백)
                if cat == "TMX" and next_date_tmx is None:
                    t = _valid_temp(val)
                    if t is not None:
                        next_date_tmx = t
                elif cat == "TMN" and next_date_tmn is None:
                    t = _valid_temp(val)
                    if t is not None:
                        next_date_tmn = t

        # 폴백 체인: 오늘 TMX/TMN → TMP → 내일 TMX/TMN
        if "tmx" not in result:
            if tmp_today is not None:
                result["tmx"] = tmp_today
            elif next_date_tmx is not None:
                result["tmx"] = next_date_tmx
        if "tmn" not in result:
            if tmp_today is not None:
                result["tmn"] = tmp_today
            elif next_date_tmn is not None:
                result["tmn"] = next_date_tmn

        if "tmx" not in result and "tmn" not in result:
            return None
        result.setdefault("tmx", result.get("tmn", 0))
        result.setdefault("tmn", result.get("tmx", 0))
        result.setdefault("sky", 1)
        result.setdefault("pop", "0%")
        return result

    except Exception as e:
        logger.error(f"Error parsing KMA forecast: {e}")
        return None


def _get_kma_base_datetime() -> tuple[str, str]:
    """현재 시각 기준 기상청 단기예보 base_date, base_time을 반환한다."""
    now = datetime.now()
    base_date = now.strftime("%Y%m%d")
    hhmm = int(now.strftime("%H%M"))

    if hhmm < 215:
        base_date = (now - timedelta(days=1)).strftime("%Y%m%d")
        base_time = "2300"
    elif hhmm < 515:
        base_time = "0200"
    elif hhmm < 815:
        base_time = "0500"
    elif hhmm < 1115:
        base_time = "0800"
    elif hhmm < 1415:
        base_time = "1100"
    elif hhmm < 1715:
        base_time = "1400"
    elif hhmm < 2015:
        base_time = "1700"
    elif hhmm < 2315:
        base_time = "2000"
    else:
        base_time = "2300"

    return base_date, base_time


_KMA_VILAGE_FCST_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"


def fetch_kma_forecast(nx: int, ny: int, retries: int = 3) -> dict | None:
    """기상청 단기예보 API를 호출하여 JSON 응답을 반환한다."""
    from app.core.config import settings

    service_key = settings.KMA_SERVICE_KEY
    if not service_key:
        logger.error("KMA_SERVICE_KEY not configured")
        return None

    base_date, base_time = _get_kma_base_datetime()

    params = {
        "serviceKey": service_key,
        "numOfRows": 1000,
        "pageNo": 1,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    for attempt in range(retries):
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(_KMA_VILAGE_FCST_URL, params=params)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"KMA API attempt {attempt + 1}/{retries} failed for ({nx},{ny}): {e}")
            if attempt < retries - 1:
                import time
                time.sleep(1)

    logger.error(f"KMA API failed after {retries} attempts for grid ({nx},{ny})")
    return None


WEATHER_STALE_HOURS = 24


def get_weather_info(db: Session, lat, long) -> Optional[Dict]:
    """회원의 위치 기반 날씨 정보를 반환합니다.

    24시간 이내에 갱신된 데이터만 사용합니다.
    """
    if lat is None or long is None:
        return None

    try:
        from sqlalchemy import text
        lat_f, lng_f = float(lat), float(long)
        stale_cutoff = datetime.now() - timedelta(hours=WEATHER_STALE_HOURS)

        result = db.execute(text("""
            SELECT mt_weather_sky, mt_weather_tmx, mt_weather_tmn,
                   mt_weather_pop, mt_weather_date,
                   mt_sido, mt_gu, mt_dong
            FROM member_t
            WHERE mt_weather_sky IS NOT NULL
              AND mt_weather_tmx IS NOT NULL
              AND mt_weather_date >= :stale_cutoff
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
            "stale_cutoff": stale_cutoff,
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
