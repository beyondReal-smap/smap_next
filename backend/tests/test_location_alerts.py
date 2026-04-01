from types import SimpleNamespace


def test_send_entry_notifications_notifies_owner_and_leader_except_actor(monkeypatch):
    from app.jobs.location_alerts import _send_entry_notifications

    dispatched = []
    schedule = SimpleNamespace(sst_idx=31, sst_title="저녁 모임")
    group_data = {
        "member": {"mt_idx": 5, "mt_name": "민수"},
        "owner": {"mt_idx": 1, "mt_lang": "ko", "mt_token_id": "owner-token"},
        "leader": {"mt_idx": 2, "mt_lang": "ko", "mt_token_id": "leader-token"},
    }

    monkeypatch.setattr(
        "app.jobs.location_alerts.dispatch_notification",
        lambda **kwargs: dispatched.append(kwargs) or {"push_result": {"result": True}},
    )

    _send_entry_notifications(
        db=object(),
        group_data=group_data,
        schedule=schedule,
        plt_condition="30초 - 장소알림",
        plt_memo="도착",
        push_json={"distance": "10.0"},
    )

    assert len(dispatched) == 2
    assert all(item["event_type"] == "schedule_place_entry" for item in dispatched)
    assert {item["recipient"]["mt_idx"] for item in dispatched} == {1, 2}
