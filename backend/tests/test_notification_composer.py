from datetime import date


def test_select_variant_index_is_stable_for_same_member_and_day():
    from app.services.notifications.composer import select_variant_index

    first = select_variant_index(
        event_type="schedule_start",
        member_id=42,
        target_date=date(2026, 3, 28),
        pool_size=4,
    )
    second = select_variant_index(
        event_type="schedule_start",
        member_id=42,
        target_date=date(2026, 3, 28),
        pool_size=4,
    )

    assert first == second


def test_compose_notification_renders_placeholders_from_catalog(monkeypatch):
    from app.services.notifications.composer import compose_notification

    captured = {}

    def fake_render_message(**kwargs):
        captured.update(kwargs)
        variant = kwargs["fallback_templates"][kwargs["variant_index"]]
        return (
            variant["title"].format(title="아침 회의"),
            variant["content"].format(title="아침 회의"),
        )

    monkeypatch.setattr(
        "app.services.notifications.composer.ai_message_service.render_message",
        fake_render_message,
    )

    title, content = compose_notification(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "아침 회의"},
        member_id=7,
        target_date=date(2026, 3, 28),
    )

    assert title
    assert "아침 회의" in content
    assert captured["event_type"] == "schedule_start"
    assert captured["variant_index"] < len(captured["fallback_templates"])

