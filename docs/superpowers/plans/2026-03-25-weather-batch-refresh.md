# 기상청 API 날씨 갱신 배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 06:30에 기상청 단기예보 API로 활성 회원의 날씨 데이터를 갱신하여, 07:00 날씨 푸시가 정확한 기온을 보내도록 한다.

**Architecture:** `weather_service.py`에 기상청 API 호출 + 위경도→격자 변환 로직 추가. `daily_jobs.py`에 갱신 배치 job 추가. 회원을 격자(5km) 단위로 그룹핑하여 API 호출 최소화. `get_weather_info()`에 24시간 신선도 체크 추가로 stale 데이터 방어.

**Tech Stack:** Python 3.12, httpx (이미 requirements.txt에 포함), APScheduler, 기상청 VilageFcstInfoService_2.0 API

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `backend/app/core/config.py` | KMA_SERVICE_KEY 설정 추가 |
| Modify | `backend/.env` | KMA_SERVICE_KEY 값 추가 |
| Modify | `backend/app/services/weather_service.py` | 격자 변환, API 호출, 파싱, 신선도 체크 |
| Modify | `backend/app/jobs/daily_jobs.py` | `run_refresh_weather_data()` 배치 job |
| Modify | `backend/app/core/scheduler.py` | 06:30 cron 스케줄 등록 |
| Create | `backend/tests/test_weather_service.py` | 격자 변환, 파싱, 신선도 체크 테스트 |

---

### Task 1: config에 KMA_SERVICE_KEY 추가

**Files:**
- Modify: `backend/app/core/config.py:21-127` (Settings 클래스)
- Modify: `backend/.env`

- [ ] **Step 1: config.py에 KMA_SERVICE_KEY 필드 추가**

`backend/app/core/config.py`의 Settings 클래스, IOS 설정 바로 아래(line 83 뒤)에 추가:

```python
    # 기상청 API 설정
    KMA_SERVICE_KEY: str = Field(default="", validation_alias=AliasChoices("KMA_SERVICE_KEY"))
```

- [ ] **Step 2: .env에 실제 키 추가**

`backend/.env` 파일 끝에 추가:

```
# 기상청 단기예보 API (data.go.kr)
KMA_SERVICE_KEY=eu848OhHKYBTXESTOJk2Zvd2dkcvSgkW/5/w4bN3Doo/FKEjD/zuQLsjVFk4Uwn9KbIUYdvNcbXR1MB9IFHy6w==
```

- [ ] **Step 3: 설정 로드 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -c "from dotenv import load_dotenv; load_dotenv(); from app.core.config import settings; print('KMA key loaded:', bool(settings.KMA_SERVICE_KEY))"`
Expected: `KMA key loaded: True`

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py backend/.env
git commit -m "feat: add KMA_SERVICE_KEY to config"
```

---

### Task 2: 위경도→격자 변환 함수 (PHP lamcproj 포팅)

**Files:**
- Modify: `backend/app/services/weather_service.py`
- Create: `backend/tests/test_weather_service.py`

- [ ] **Step 1: 테스트 작성 — 위경도→격자 변환**

`backend/tests/test_weather_service.py` 생성:

```python
"""weather_service 단위 테스트"""
import pytest


def test_latlong_to_grid_seoul():
    """서울(37.5665, 126.9780) → 격자 (60, 127) 변환 검증.
    기상청 공식 변환 표에서 서울의 격자값은 (60, 127)이다.
    """
    from app.services.weather_service import latlong_to_grid
    nx, ny = latlong_to_grid(37.5665, 126.9780)
    assert nx == 60
    assert ny == 127


def test_latlong_to_grid_busan():
    """부산(35.1796, 129.0756) → 격자 (98, 76) 변환 검증."""
    from app.services.weather_service import latlong_to_grid
    nx, ny = latlong_to_grid(35.1796, 129.0756)
    assert nx == 98
    assert ny == 76


def test_latlong_to_grid_jeju():
    """제주(33.4996, 126.5312) → 격자 (52, 38) 변환 검증."""
    from app.services.weather_service import latlong_to_grid
    nx, ny = latlong_to_grid(33.4996, 126.5312)
    assert nx == 52
    assert ny == 38
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py -v`
Expected: FAIL — `ImportError: cannot import name 'latlong_to_grid'`

- [ ] **Step 3: 격자 변환 함수 구현**

`backend/app/services/weather_service.py` 파일 상단(import 뒤, 기존 함수 앞)에 추가:

```python
import math

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/weather_service.py backend/tests/test_weather_service.py
git commit -m "feat: add KMA grid coordinate conversion (latlong_to_grid)"
```

---

### Task 3: 기상청 API 호출 + 파싱 함수

**Files:**
- Modify: `backend/app/services/weather_service.py`
- Modify: `backend/tests/test_weather_service.py`

- [ ] **Step 1: API 응답 파싱 테스트 작성**

`backend/tests/test_weather_service.py`에 추가:

```python
def test_parse_kma_forecast_response():
    """기상청 단기예보 응답에서 TMX, TMN, SKY, POP 파싱 검증."""
    from app.services.weather_service import parse_kma_forecast

    # 기상청 실제 응답 형식의 축소 샘플
    sample_response = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"category": "TMX", "fcstDate": "20260325", "fcstTime": "1500", "fcstValue": "12"},
                        {"category": "TMN", "fcstDate": "20260325", "fcstTime": "0600", "fcstValue": "3"},
                        {"category": "SKY", "fcstDate": "20260325", "fcstTime": "0600", "fcstValue": "1"},
                        {"category": "POP", "fcstDate": "20260325", "fcstTime": "0600", "fcstValue": "10"},
                    ]
                }
            },
        }
    }
    result = parse_kma_forecast(sample_response, "20260325")
    assert result["tmx"] == 12
    assert result["tmn"] == 3
    assert result["sky"] == 1
    assert result["pop"] == "10%"


def test_parse_kma_forecast_empty_response():
    """빈 응답 또는 에러 응답 시 None 반환."""
    from app.services.weather_service import parse_kma_forecast

    assert parse_kma_forecast(None, "20260325") is None
    assert parse_kma_forecast({}, "20260325") is None
    assert parse_kma_forecast(
        {"response": {"header": {"resultCode": "99"}}}, "20260325"
    ) is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py::test_parse_kma_forecast_response -v`
Expected: FAIL — `ImportError: cannot import name 'parse_kma_forecast'`

- [ ] **Step 3: parse_kma_forecast 구현**

`backend/app/services/weather_service.py`에 추가 (`latlong_to_grid` 아래):

```python
def parse_kma_forecast(response: dict | None, target_date: str) -> dict | None:
    """기상청 단기예보 JSON 응답에서 TMX, TMN, SKY, POP를 추출한다.

    Args:
        response: 기상청 API JSON 응답
        target_date: 조회 대상 날짜 (YYYYMMDD)

    Returns:
        {"tmx": int, "tmn": int, "sky": int, "pop": str} 또는 None
    """
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
        for item in items:
            cat = item.get("category")
            fdate = item.get("fcstDate")
            val = item.get("fcstValue")
            if fdate != target_date:
                continue
            if cat == "TMX" and "tmx" not in result:
                result["tmx"] = int(float(val))
            elif cat == "TMN" and "tmn" not in result:
                result["tmn"] = int(float(val))
            elif cat == "SKY" and "sky" not in result:
                result["sky"] = int(val)
            elif cat == "POP" and "pop" not in result:
                result["pop"] = f"{val}%"

        if "tmx" not in result and "tmn" not in result:
            return None
        # 누락 필드 기본값
        result.setdefault("tmx", result.get("tmn", 0))
        result.setdefault("tmn", result.get("tmx", 0))
        result.setdefault("sky", 1)
        result.setdefault("pop", "0%")
        return result

    except Exception as e:
        logger.error(f"Error parsing KMA forecast: {e}")
        return None
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py -v`
Expected: 5 passed

- [ ] **Step 5: fetch_kma_forecast 함수 구현 (API 호출)**

`backend/app/services/weather_service.py`에 추가:

```python
import httpx
from datetime import datetime


def _get_kma_base_datetime() -> tuple[str, str]:
    """현재 시각 기준 기상청 단기예보 base_date, base_time을 반환한다.

    단기예보 발표 시각: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    API 제공 시각은 발표 후 약 10분 (ex: 0210).
    06:30 배치 기준으로 0200 발표 데이터를 사용한다.
    """
    now = datetime.now()
    base_date = now.strftime("%Y%m%d")
    hhmm = int(now.strftime("%H%M"))

    if hhmm < 215:
        # 전날 2300 발표 데이터
        base_date = (now - __import__("datetime").timedelta(days=1)).strftime("%Y%m%d")
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
    """기상청 단기예보 API를 호출하여 JSON 응답을 반환한다.

    Args:
        nx, ny: 격자 좌표
        retries: 재시도 횟수

    Returns:
        API JSON 응답 dict 또는 None
    """
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
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/weather_service.py backend/tests/test_weather_service.py
git commit -m "feat: add KMA forecast API fetch and parse functions"
```

---

### Task 4: get_weather_info 신선도 체크 추가

**Files:**
- Modify: `backend/app/services/weather_service.py`
- Modify: `backend/tests/test_weather_service.py`

- [ ] **Step 1: 신선도 체크 테스트 작성**

`backend/tests/test_weather_service.py`에 추가:

```python
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


def test_get_weather_info_filters_stale_data():
    """24시간 이상 지난 날씨 데이터는 None을 반환해야 한다."""
    from app.services.weather_service import get_weather_info

    mock_db = MagicMock()
    # mt_weather_date가 2일 전인 row를 반환하도록 mock
    stale_row = MagicMock()
    stale_row.mt_weather_sky = 1
    stale_row.mt_weather_tmx = 32
    stale_row.mt_weather_tmn = 25
    stale_row.mt_weather_pop = "20%"
    stale_row.mt_weather_date = datetime.now() - timedelta(days=2)
    stale_row.mt_sido = "서울"
    stale_row.mt_gu = "강남구"
    stale_row.mt_dong = "역삼동"

    mock_result = MagicMock()
    mock_result.first.return_value = stale_row
    mock_db.execute.return_value = mock_result

    result = get_weather_info(mock_db, 37.5, 127.0)
    assert result is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py::test_get_weather_info_filters_stale_data -v`
Expected: FAIL — 현재 `get_weather_info`는 stale 데이터도 반환함

- [ ] **Step 3: get_weather_info에 신선도 체크 추가**

`backend/app/services/weather_service.py`에서 기존 `get_weather_info` 함수를 수정:

기존 쿼리의 WHERE 조건에 `mt_weather_date` 필터 추가, 그리고 결과 검증 추가:

```python
WEATHER_STALE_HOURS = 24  # 이보다 오래된 날씨 데이터는 무시


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
```

**주의:** `from datetime import datetime, timedelta`가 파일 상단 import에 있어야 함. 이미 Task 3에서 `datetime` import를 추가했으므로 `timedelta`만 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/weather_service.py backend/tests/test_weather_service.py
git commit -m "fix: add 24h staleness check to get_weather_info"
```

---

### Task 5: 날씨 갱신 배치 job 구현

**Files:**
- Modify: `backend/app/jobs/daily_jobs.py`

- [ ] **Step 1: run_refresh_weather_data 함수 추가**

`backend/app/jobs/daily_jobs.py` 파일 끝에 추가:

```python
def run_refresh_weather_data(db: Session) -> None:
    """기상청 단기예보 API로 활성 회원의 날씨 데이터를 갱신한다.

    회원을 격자(5km) 단위로 그룹핑하여 격자당 1회만 API 호출.
    매일 06:30 실행 → 07:00 날씨 푸시 전에 데이터 갱신 완료.
    """
    from app.models.member import Member
    from app.services.weather_service import (
        latlong_to_grid,
        fetch_kma_forecast,
        parse_kma_forecast,
    )

    try:
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

        # 격자 단위로 회원 그룹핑
        grid_members: dict[tuple[int, int], list[int]] = {}
        for m in members:
            try:
                lat_f, lon_f = float(m.mt_lat), float(m.mt_long)
                if not (33.0 <= lat_f <= 39.0 and 124.0 <= lon_f <= 132.0):
                    continue  # 한국 범위 밖 무시
                nx, ny = latlong_to_grid(lat_f, lon_f)
                grid_members.setdefault((nx, ny), []).append(m.mt_idx)
            except (TypeError, ValueError):
                continue

        logger.info(
            f"[Weather Refresh] {len(members)} members → "
            f"{len(grid_members)} unique grids"
        )

        target_date = datetime.now().strftime("%Y%m%d")
        updated_count = 0
        failed_grids = 0

        for (nx, ny), mt_idx_list in grid_members.items():
            raw = fetch_kma_forecast(nx, ny)
            forecast = parse_kma_forecast(raw, target_date)

            if not forecast:
                failed_grids += 1
                continue

            # 해당 격자의 모든 회원 일괄 업데이트
            now = datetime.now()
            db.execute(text("""
                UPDATE member_t
                SET mt_weather_tmx = :tmx,
                    mt_weather_tmn = :tmn,
                    mt_weather_sky = :sky,
                    mt_weather_pop = :pop,
                    mt_weather_date = :wdate
                WHERE mt_idx IN :mt_idxs
            """), {
                "tmx": forecast["tmx"],
                "tmn": forecast["tmn"],
                "sky": forecast["sky"],
                "pop": forecast["pop"],
                "wdate": now,
                "mt_idxs": tuple(mt_idx_list),
            })
            updated_count += len(mt_idx_list)

        db.commit()
        logger.info(
            f"[Weather Refresh] Done: {updated_count} members updated, "
            f"{failed_grids} grids failed"
        )

    except Exception as e:
        logger.exception(f"[Weather Refresh] Error: {e}")
        db.rollback()
```

**주의:** 파일 상단에 `from sqlalchemy import text` 가 이미 import 되어 있는지 확인. 되어 있음 (line 6).

- [ ] **Step 2: 빠른 검증 — import 에러 없는지 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -c "from app.jobs.daily_jobs import run_refresh_weather_data; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/jobs/daily_jobs.py
git commit -m "feat: add run_refresh_weather_data batch job"
```

---

### Task 6: 스케줄러에 06:30 cron 등록

**Files:**
- Modify: `backend/app/core/scheduler.py`

- [ ] **Step 1: _JOB_REGISTRY에 refresh_weather_data 추가**

`backend/app/core/scheduler.py`의 `_get_job_func` 함수 내, `daily_jobs` import 블록에 추가:

기존 (line 42-48):
```python
        from app.jobs.daily_jobs import (
            run_notify_low_battery_at_9pm,
            run_send_daily_log_notifications,
            run_send_daily_weather_notifications,
            run_send_my_location_push_notifications,
            run_schedule_movement_alert,
        )
```

변경:
```python
        from app.jobs.daily_jobs import (
            run_notify_low_battery_at_9pm,
            run_send_daily_log_notifications,
            run_send_daily_weather_notifications,
            run_send_my_location_push_notifications,
            run_schedule_movement_alert,
            run_refresh_weather_data,
        )
```

`_JOB_REGISTRY.update` 블록 (line 66-70)의 일일 알림 섹션에 추가:

```python
            "refresh_weather_data": run_refresh_weather_data,
```

- [ ] **Step 2: _schedule_all_jobs에 06:30 cron 추가**

`backend/app/core/scheduler.py`의 `_schedule_all_jobs` 메서드에서, 기존 `send_daily_weather_notifications` (line 162-166) 바로 위에 추가:

```python
        self.scheduler.add_job(
            self._run_job, CronTrigger(hour=6, minute=30),
            args=['refresh_weather_data'],
            id='refresh_weather_data', **_cron_opts
        )
```

- [ ] **Step 3: import 검증**

Run: `cd /data/wwwroot/smap_next/backend && python3 -c "from app.core.scheduler import scheduler; print('Scheduler OK')"`
Expected: `Scheduler OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/scheduler.py
git commit -m "feat: schedule weather refresh at 06:30 daily"
```

---

### Task 7: 날씨 푸시에서 stale 데이터 스킵 처리

**Files:**
- Modify: `backend/app/jobs/daily_jobs.py`

- [ ] **Step 1: run_send_daily_weather_notifications에 스킵 로직 추가**

`backend/app/jobs/daily_jobs.py`의 `run_send_daily_weather_notifications` (line 159-223)에서, `weather_info` 체크 후 로그 추가:

기존 (line 181):
```python
            if weather_info:
```

변경:
```python
            if not weather_info:
                logger.debug(f"[Weather Push] mt_idx={mt_idx}: no fresh weather data, skipping")
                continue

            if True:  # weather_info exists
```

**더 깔끔한 접근:** 기존 `if weather_info:` 블록의 들여쓰기를 유지하되, else에 skip 로그 추가:

기존 for 루프 마지막 (line 217 직전)에 추가:
```python
            else:
                logger.debug(f"[Weather Push] mt_idx={mt_idx}: no fresh weather data, skipping")
```

이렇게 하면 `get_weather_info()`의 신선도 체크(Task 4)가 stale 데이터를 걸러낸 경우 자동으로 스킵된다.

- [ ] **Step 2: Commit**

```bash
git add backend/app/jobs/daily_jobs.py
git commit -m "fix: skip weather push for members with no fresh data"
```

---

### Task 8: 수동 테스트 및 통합 검증

**Files:** (변경 없음 — 실행만)

- [ ] **Step 1: 단위 테스트 전체 통과 확인**

Run: `cd /data/wwwroot/smap_next/backend && python3 -m pytest tests/test_weather_service.py -v`
Expected: All passed

- [ ] **Step 2: 격자 변환 → API 호출 → 파싱 수동 검증**

```bash
cd /data/wwwroot/smap_next/backend && python3 -c "
from dotenv import load_dotenv; load_dotenv()
from app.services.weather_service import latlong_to_grid, fetch_kma_forecast, parse_kma_forecast
from datetime import datetime

# 서울 테스트
nx, ny = latlong_to_grid(37.5665, 126.9780)
print(f'Seoul grid: ({nx}, {ny})')

raw = fetch_kma_forecast(nx, ny)
print(f'API response status: {raw[\"response\"][\"header\"][\"resultCode\"] if raw else \"FAILED\"}')

forecast = parse_kma_forecast(raw, datetime.now().strftime('%Y%m%d'))
print(f'Parsed forecast: {forecast}')
"
```

Expected: 서울 격자 (60, 127), API 응답 코드 "00", 합리적인 기온 (3월 말 기준 5~15°C)

- [ ] **Step 3: DB 갱신 소규모 테스트 (10명만)**

```bash
cd /data/wwwroot/smap_next/backend && python3 -c "
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.services.weather_service import latlong_to_grid, fetch_kma_forecast, parse_kma_forecast
from datetime import datetime

url = f'mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DB}?charset={settings.MYSQL_CHARSET}'
engine = create_engine(url)

with engine.connect() as conn:
    members = conn.execute(text('''
        SELECT mt_idx, mt_lat, mt_long FROM member_t
        WHERE mt_status=1 AND mt_level>1 AND mt_lat IS NOT NULL
        LIMIT 10
    ''')).fetchall()

    target_date = datetime.now().strftime('%Y%m%d')
    for m in members:
        nx, ny = latlong_to_grid(float(m.mt_lat), float(m.mt_long))
        raw = fetch_kma_forecast(nx, ny)
        fc = parse_kma_forecast(raw, target_date)
        if fc:
            print(f'mt_idx={m.mt_idx}: grid=({nx},{ny}) tmx={fc[\"tmx\"]} tmn={fc[\"tmn\"]} sky={fc[\"sky\"]}')
        else:
            print(f'mt_idx={m.mt_idx}: grid=({nx},{ny}) FAILED')
"
```

Expected: 10명 모두 합리적인 기온 출력 (3월 기준 -5 ~ 20°C)

- [ ] **Step 4: 전체 배치 실행 (dry-run 확인 후 실행)**

```bash
cd /data/wwwroot/smap_next/backend && python3 -c "
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.jobs.daily_jobs import run_refresh_weather_data

db = SessionLocal()
try:
    run_refresh_weather_data(db)
finally:
    db.close()
"
```

Expected: 로그에 `[Weather Refresh] Done: XXXX members updated, X grids failed` 출력

- [ ] **Step 5: 갱신 결과 DB 확인**

```bash
cd /data/wwwroot/smap_next/backend && python3 -c "
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
from app.core.config import settings

url = f'mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DB}?charset={settings.MYSQL_CHARSET}'
engine = create_engine(url)
with engine.connect() as conn:
    result = conn.execute(text('''
        SELECT COUNT(*) as cnt,
               MIN(mt_weather_tmx) as min_tmx, MAX(mt_weather_tmx) as max_tmx,
               MIN(mt_weather_date) as oldest, MAX(mt_weather_date) as newest
        FROM member_t
        WHERE mt_weather_date >= NOW() - INTERVAL 1 HOUR AND mt_status=1
    ''')).first()
    print(f'Updated: {result.cnt} members')
    print(f'TMX range: {result.min_tmx}~{result.max_tmx}°C')
    print(f'Date range: {result.oldest} ~ {result.newest}')
"
```

Expected: 갱신된 회원 수 > 0, TMX 범위 합리적 (3월 기준 5~15°C)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: KMA weather batch refresh — 06:30 daily cron, staleness check, grid optimization"
```
