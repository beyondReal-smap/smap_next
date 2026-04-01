def test_render_message_uses_variant_index_from_fallback_pool(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_MESSAGE_CACHE_PATH", str(tmp_path / "ai_message_cache.sqlite3"))

    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()
    monkeypatch.setattr(service, "_get_cached_template", lambda event_type, lang: None)
    monkeypatch.setattr(service, "_generate_templates", lambda **kwargs: None, raising=False)

    title, content = service.render_message(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "저녁 약속"},
        fallback_templates=[
            {"title": "A {title}", "content": "A body {title}"},
            {"title": "B {title}", "content": "B body {title}"},
        ],
        variant_index=1,
    )

    assert title == "B 저녁 약속"
    assert content == "B body 저녁 약속"
