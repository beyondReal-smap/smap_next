from types import SimpleNamespace


def test_dispatch_notification_composes_sends_and_logs(monkeypatch):
    from app.services.notifications.dispatcher import dispatch_notification

    db = object()
    member = SimpleNamespace(mt_idx=11, mt_lang="ko", mt_token_id="token-123")
    sent = {}
    logged = {}

    monkeypatch.setattr(
        "app.services.notifications.dispatcher.compose_notification",
        lambda **kwargs: ("제목", "본문"),
    )
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.send_push",
        lambda token_id, title, content, url=None, member_id=None: sent.update(
            {
                "token_id": token_id,
                "title": title,
                "content": content,
                "member_id": member_id,
            }
        ) or {"result": True, "msg": "ok"},
    )
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.push_log_add",
        lambda *args, **kwargs: logged.update({"args": args, "kwargs": kwargs}),
    )

    result = dispatch_notification(
        db=db,
        recipient=member,
        event_type="app_reengagement",
        variables={},
        plt_condition="일일 - 앱실행알림",
        plt_memo="저녁 7시 30분 앱 실행 알림",
    )

    assert result["title"] == "제목"
    assert sent["token_id"] == "token-123"
    assert sent["member_id"] == 11
    assert logged["args"][1] == 11
    assert logged["args"][4] == "저녁 7시 30분 앱 실행 알림"
