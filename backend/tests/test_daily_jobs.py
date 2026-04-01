from types import SimpleNamespace
from unittest.mock import MagicMock


def test_run_send_daily_weather_notifications_dispatches_weather_event(monkeypatch):
    from app.jobs.daily_jobs import run_send_daily_weather_notifications
    from app.models.member import Member

    member = SimpleNamespace(
        mt_idx=7,
        mt_lang="ko",
        mt_token_id="token-7",
        mt_lat=37.5,
        mt_long=127.0,
    )
    dispatched = []

    monkeypatch.setattr(Member, "get_recently_active", staticmethod(lambda db: [member]))
    monkeypatch.setattr(
        "app.services.weather_service.get_weather_info",
        lambda db, lat, long: {
            "temperature": 19,
            "weather": "맑음",
            "humidity": "20",
            "location": "서울 강남구",
        },
    )
    monkeypatch.setattr(
        "app.jobs.daily_jobs.dispatch_notification",
        lambda **kwargs: dispatched.append(kwargs) or {"push_result": {"result": True}},
    )

    db = MagicMock()
    run_send_daily_weather_notifications(db=db)

    assert len(dispatched) == 1
    assert dispatched[0]["event_type"] == "daily_weather"
    assert dispatched[0]["variables"]["location"] == "서울 강남구"
    db.commit.assert_called_once()

