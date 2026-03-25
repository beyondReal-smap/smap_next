"""weather_service 단위 테스트"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta


def test_latlong_to_grid_seoul():
    """서울(37.5665, 126.9780) → 격자 (60, 127) 변환 검증."""
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
    """제주(33.4996, 126.5312) → 격자 (53, 38) 변환 검증."""
    from app.services.weather_service import latlong_to_grid
    nx, ny = latlong_to_grid(33.4996, 126.5312)
    assert nx == 53
    assert ny == 38


def test_parse_kma_forecast_response():
    """기상청 단기예보 응답에서 TMX, TMN, SKY, POP 파싱 검증."""
    from app.services.weather_service import parse_kma_forecast

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


def test_get_weather_info_filters_stale_data():
    """24시간 이상 지난 날씨 데이터는 None을 반환해야 한다."""
    from app.services.weather_service import get_weather_info

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.first.return_value = None  # stale_cutoff 필터에 의해 결과 없음
    mock_db.execute.return_value = mock_result

    result = get_weather_info(mock_db, 37.5, 127.0)
    assert result is None

    # 쿼리에 stale_cutoff 파라미터가 전달되었는지 확인
    call_args = mock_db.execute.call_args
    params = call_args[0][1] if len(call_args[0]) > 1 else call_args[1]
    assert "stale_cutoff" in params
