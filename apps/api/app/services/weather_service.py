"""날씨 정보 서비스 — member_t 테이블의 기존 날씨 데이터를 활용합니다."""
import logging
import math
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# 기상청 Lambert Conformal Conic 격자 변환 상수
_KMA_RE = 6371.00877
_KMA_GRID = 5.0
_KMA_SLAT1 = 30.0
_KMA_SLAT2 = 60.0
_KMA_OLON = 126.0
_KMA_OLAT = 38.0
_KMA_XO = 210 / _KMA_GRID
_KMA_YO = 675 / _KMA_GRID
_KMA_VILAGE_FCST_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
WEATHER_STALE_HOURS = 24


def latlong_to_grid(lat: float, lon: float) -> tuple[int, int]:
    """위경도를 기상청 격자 좌표(nx, ny)로 변환한다."""
    degrad = math.pi / 180.0

    re = _KMA_RE / _KMA_GRID
    slat1 = _KMA_SLAT1 * degrad
    slat2 = _KMA_SLAT2 * degrad
    olon = _KMA_OLON * degrad
    olat = _KMA_OLAT * degrad

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    ra = math.tan(math.pi * 0.25 + lat * degrad * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lon * degrad - olon
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
        tmp_today = None
        next_date_tmx = None
        next_date_tmn = None

        # 우리가 사용하는 카테고리는 모두 숫자값.
        # PCP('강수없음')·SNO('적설없음') 등 문자열 값 카테고리는 건너뛴다.
        _NUMERIC_CATEGORIES = {"TMX", "TMN", "SKY", "POP", "TMP"}

        def _valid_temp(val) -> int | None:
            value = int(float(val))
            return value if -80 <= value <= 60 else None

        for item in items:
            category = item.get("category")
            if category not in _NUMERIC_CATEGORIES:
                continue
            forecast_date = item.get("fcstDate")
            value = item.get("fcstValue")

            if value is None or float(value) <= -900:
                continue

            if forecast_date == target_date:
                if category == "TMX" and "tmx" not in result:
                    temp = _valid_temp(value)
                    if temp is not None:
                        result["tmx"] = temp
                elif category == "TMN" and "tmn" not in result:
                    temp = _valid_temp(value)
                    if temp is not None:
                        result["tmn"] = temp
                elif category == "SKY" and "sky" not in result:
                    result["sky"] = int(value)
                elif category == "POP" and "pop" not in result:
                    result["pop"] = f"{value}%"
                elif category == "TMP" and tmp_today is None:
                    temp = _valid_temp(value)
                    if temp is not None:
                        tmp_today = temp
            else:
                if category == "TMX" and next_date_tmx is None:
                    temp = _valid_temp(value)
                    if temp is not None:
                        next_date_tmx = temp
                elif category == "TMN" and next_date_tmn is None:
                    temp = _valid_temp(value)
                    if temp is not None:
                        next_date_tmn = temp

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
                response = client.get(_KMA_VILAGE_FCST_URL, params=params)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning(f"KMA API attempt {attempt + 1}/{retries} failed for ({nx},{ny}): {e}")
            if attempt < retries - 1:
                import time
                time.sleep(1)

    logger.error(f"KMA API failed after {retries} attempts for grid ({nx},{ny})")
    return None


def get_weather_info(db: Session, lat, long, mt_idx: int = None) -> Optional[Dict]:
    """회원의 위치 기반 날씨 정보를 반환합니다.

    24시간 이내에 갱신된 데이터만 사용합니다.
    mt_idx가 주어지면 본인 데이터를 우선 조회하고, 없으면 위치 기반으로 폴백합니다.
    """
    if lat is None or long is None:
        return None

    try:
        from sqlalchemy import text
        lat_f, lng_f = float(lat), float(long)
        stale_cutoff = datetime.now() - timedelta(hours=WEATHER_STALE_HOURS)

        result = None

        # 본인 날씨 데이터 우선 조회
        if mt_idx:
            result = db.execute(text("""
                SELECT mt_weather_sky, mt_weather_tmx, mt_weather_tmn,
                       mt_weather_pop, mt_weather_date,
                       mt_sido, mt_gu, mt_dong
                FROM member_t
                WHERE mt_idx = :mt_idx
                  AND mt_weather_sky IS NOT NULL
                  AND mt_weather_tmx IS NOT NULL
                  AND mt_weather_date >= :stale_cutoff
            """), {"mt_idx": mt_idx, "stale_cutoff": stale_cutoff}).first()

        # 없으면 위치 기반으로 가장 가까운 회원 데이터 사용
        if not result:
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

        pop = str(result.mt_weather_pop or "0").rstrip("%")
        return {
            "temperature": result.mt_weather_tmx,
            "weather": _sky_to_text(result.mt_weather_sky),
            "humidity": pop,
            "location": f"{result.mt_sido or ''} {result.mt_gu or ''} {result.mt_dong or ''}".strip(),
        }
    except Exception as e:
        logger.error(f"Error in get_weather_info: {e}")
        return None


def reverse_geocode(lat: float, lon: float) -> dict:
    """Nominatim(OpenStreetMap)으로 위경도 → 한국 행정구역(sido/gu/dong) 반환.

    Nominatim 사용 정책상 1req/sec 제한 — 호출 측에서 sleep 필요.
    실패 시 빈 dict 반환(날씨 데이터 갱신은 계속 진행).
    """
    try:
        with httpx.Client(timeout=5.0, headers={
            "User-Agent": "smap-app/1.0 (contact: admin@smap.site)"
        }) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json", "accept-language": "ko"},
            )
            resp.raise_for_status()
            addr = resp.json().get("address", {})

        # 한국 주소 구조: city=시도, borough=구군, suburb=동
        # 지방의 경우 province=시도, county=시군, suburb=동
        sido = addr.get("province") or addr.get("city") or addr.get("state") or ""
        gu = addr.get("borough") or addr.get("county") or addr.get("city_district") or ""
        dong = addr.get("suburb") or addr.get("quarter") or addr.get("neighbourhood") or ""
        return {"sido": sido, "gu": gu, "dong": dong}
    except Exception as e:
        logger.warning(f"[Nominatim] reverse geocode failed ({lat},{lon}): {e}")
        return {}


def _sky_to_text(sky) -> str:
    """기상청 하늘 상태 코드를 텍스트로 변환합니다."""
    mapping = {1: "맑음", 3: "구름많음", 4: "흐림"}
    return mapping.get(int(sky) if sky else 0, "맑음")
