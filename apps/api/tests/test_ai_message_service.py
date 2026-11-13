def test_render_message_uses_variant_index_from_fallback_pool(monkeypatch):
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()
    monkeypatch.setattr(service, "_generate_message", lambda **kwargs: None)

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


def test_render_message_accepts_single_fallback_template(monkeypatch):
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()
    monkeypatch.setattr(service, "_generate_message", lambda **kwargs: None)

    title, content = service.render_message(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "아침 회의"},
        fallback_template={"title": "T {title}", "content": "C {title}"},
    )

    assert title == "T 아침 회의"
    assert content == "C 아침 회의"


def test_render_message_uses_generated_message(monkeypatch):
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()
    monkeypatch.setattr(
        service,
        "_generate_message",
        lambda **kwargs: ("새 문구 저녁 약속 ⏰", "새 본문 저녁 약속"),
    )

    title, content = service.render_message(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "저녁 약속"},
        fallback_templates=[{"title": "A {title}", "content": "A body {title}"}],
    )

    assert title == "새 문구 저녁 약속 ⏰"
    assert content == "새 본문 저녁 약속"


def test_parse_message_requires_all_variable_values():
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()

    assert (
        service._parse_message(
            '{"title": "도착 알림 📍", "content": "지민님이 회사에 도착했어요."}',
            {"name": "지민", "title": "회사"},
        )
        == ("도착 알림 📍", "지민님이 회사에 도착했어요.")
    )
    # 변수 값 누락 시 거부
    assert (
        service._parse_message(
            '{"title": "도착 알림 📍", "content": "회사에 도착했어요."}',
            {"name": "지민", "title": "회사"},
        )
        is None
    )
    # 미치환 placeholder 흔적(중괄호) 거부
    assert (
        service._parse_message(
            '{"title": "도착 알림 📍", "content": "{name}님이 회사에 도착했어요."}',
            {"title": "회사"},
        )
        is None
    )


def test_parse_message_rejects_leaked_mask_tokens():
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()

    # PII 필터가 프롬프트 속 "스맵"을 [조직]으로 마스킹 → 모델이 복사한 케이스 거부
    assert (
        service._parse_message(
            '{"title": "하루 마무리 🌙", "content": "소중한 가족들의 오늘 하루도 [조직] 에서 확인해보세요!"}',
            {},
        )
        is None
    )
    # 서러게이트 토큰([이름] 등)은 정상 통과
    assert (
        service._parse_message(
            '{"title": "도착 알림 📍", "content": "[이름]님이 [제목]에 도착했어요."}',
            {"name": "[이름]", "title": "[제목]"},
        )
        == ("도착 알림 📍", "[이름]님이 [제목]에 도착했어요.")
    )


def test_render_examples_sanitizes_app_name():
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()

    rendered = service._render_examples(
        [
            {"title": "좋은 아침이에요 ☀️", "content": "오늘도 스맵과 함께 하루를 시작해보세요!"},
            {"title": "A Fresh Start ☀️", "content": "SMAP is here to keep your day on track."},
        ],
        {},
        0,
    )

    assert "스맵" not in rendered
    assert "SMAP" not in rendered
    assert "앱과 함께" in rendered
    assert "the app is here" in rendered


def test_restore_pii_replaces_surrogate_with_real_name():
    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()

    title, content = service._restore_pii(
        ("도착 알림 📍", "[이름]님이 '회사'에 도착했어요."),
        {"name": "지민", "title": "회사"},
        {"name": "[이름]"},
    )

    assert title == "도착 알림 📍"
    assert content == "지민님이 '회사'에 도착했어요."


def test_generate_message_skips_during_failure_cooldown(monkeypatch):
    import time

    from app.services.ai_message_service import AIMessageService

    service = AIMessageService()
    service._failure_until = time.monotonic() + 60

    called = {"value": False}

    def fake_get_client():
        called["value"] = True
        return None

    monkeypatch.setattr(service, "_get_client", fake_get_client)

    result = service._generate_message(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "저녁 약속"},
        style_examples=[{"title": "A {title}", "content": "B {title}"}],
    )

    assert result is None
    assert called["value"] is False
