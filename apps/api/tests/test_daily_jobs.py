from datetime import datetime
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
        "app.jobs.daily_jobs.dispatch_notifications_batch",
        lambda db, batch: dispatched.extend(batch) or [{"push_result": {"result": True}} for _ in batch],
    )

    db = MagicMock()
    run_send_daily_weather_notifications(db=db)

    assert len(dispatched) == 1
    assert dispatched[0]["event_type"] == "daily_weather"
    assert dispatched[0]["variables"]["location"] == "서울 강남구"
    db.commit.assert_called_once()


def test_run_send_my_location_push_notifications_omits_distance_from_message_and_payload(monkeypatch):
    from app.jobs.daily_jobs import run_send_my_location_push_notifications
    from app.models.my_location import MyLocation
    from app.models.member_location_log import MemberLocationLog

    member = SimpleNamespace(
        mt_idx=7,
        mt_lang="ko",
        mt_token_id="token-7",
        mt_ldate=datetime.now(),
    )
    location = {
        "slt_idx": 11,
        "mt_idx": 7,
        "slt_title": "회사",
        "slt_lat": 37.5000000,
        "slt_long": 127.0000000,
    }
    dispatched = []

    monkeypatch.setattr(MyLocation, "get_all_active", staticmethod(lambda db: [location]))
    monkeypatch.setattr(
        "app.jobs.daily_jobs.prefetch_members",
        lambda db, mt_idx_list: {7: member},
    )
    monkeypatch.setattr(
        MemberLocationLog,
        "get_recent_locations_batch",
        staticmethod(lambda db, mt_idx_list: {7: {"lat": 37.5, "long": 127.0}}),
    )
    monkeypatch.setattr(
        "app.jobs.daily_jobs.dispatch_notifications_batch",
        lambda db, batch: dispatched.extend(batch) or [{"push_result": {"result": True}} for _ in batch],
    )

    db = MagicMock()
    run_send_my_location_push_notifications(db=db)

    assert len(dispatched) == 1
    assert dispatched[0]["event_type"] == "my_location_near"
    assert dispatched[0]["variables"] == {"title": "회사"}
    assert dispatched[0]["push_json"] == {
        "lat": "37.5000000",
        "lng": "127.0000000",
    }
    db.commit.assert_called_once()


def test_run_schedule_movement_alert_omits_distance_from_message_and_payload(monkeypatch):
    from app.jobs.daily_jobs import run_schedule_movement_alert
    from app.models.schedule import Schedule
    from app.models.member_location_log import MemberLocationLog

    owner = SimpleNamespace(
        mt_idx=9,
        mt_lang="ko",
        mt_token_id="token-9",
    )
    schedule = SimpleNamespace(
        sst_idx=41,
        mt_idx=9,
        sst_title="병원 방문",
        sst_location_lat=37.6000000,
        sst_location_long=127.1000000,
        sst_alram=1,
    )
    dispatched = []

    monkeypatch.setattr(Schedule, "get_upcoming_schedules", staticmethod(lambda db, hours=1: [schedule]))
    monkeypatch.setattr(
        "app.jobs.daily_jobs.prefetch_members",
        lambda db, mt_idx_list: {9: owner},
    )
    monkeypatch.setattr(
        MemberLocationLog,
        "get_recent_locations_batch",
        staticmethod(lambda db, mt_idx_list: {9: {"lat": 37.5, "long": 127.0}}),
    )
    monkeypatch.setattr(
        "app.jobs.base.haversine",
        lambda lat1, lon1, lat2, lon2: 1500.0,
    )
    monkeypatch.setattr(
        "app.jobs.daily_jobs.dispatch_notifications_batch",
        lambda db, batch: dispatched.extend(batch) or [{"push_result": {"result": True}} for _ in batch],
    )

    db = MagicMock()
    run_schedule_movement_alert(db=db)

    assert len(dispatched) == 1
    assert dispatched[0]["event_type"] == "schedule_movement"
    assert dispatched[0]["variables"] == {"title": "병원 방문"}
    assert dispatched[0]["push_json"] == {
        "lat": "37.6000000",
        "lng": "127.1000000",
    }
    assert schedule.sst_alram == 0
    db.commit.assert_called_once()
