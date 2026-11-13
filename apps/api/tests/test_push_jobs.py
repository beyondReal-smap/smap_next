from types import SimpleNamespace


def test_run_trigger_app_execution_dispatches_reengagement(monkeypatch):
    from app.jobs.push_jobs import run_trigger_app_execution_at_7_30pm
    from app.models.member import Member

    dispatched = []
    members = [
        SimpleNamespace(mt_idx=1, mt_lang="ko", mt_token_id="token-a"),
        SimpleNamespace(mt_idx=2, mt_lang="en", mt_token_id="token-b"),
    ]

    monkeypatch.setattr(Member, "get_recently_active", staticmethod(lambda db: members))
    monkeypatch.setattr(
        "app.jobs.push_jobs.dispatch_notifications_batch",
        lambda db, batch: dispatched.extend(batch) or [{"push_result": {"result": True}} for _ in batch],
    )

    run_trigger_app_execution_at_7_30pm(db=object())

    assert len(dispatched) == 2
    assert all(item["event_type"] == "app_reengagement" for item in dispatched)
