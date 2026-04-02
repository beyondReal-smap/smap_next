import re

from app.services.notifications.catalog import TEMPLATE_CATALOG
from app.services.notifications.events import EVENT_DEFINITIONS


def test_each_notification_event_has_ten_variants_per_language():
    for event_type, language_map in TEMPLATE_CATALOG.items():
        assert len(language_map["ko"]) == 10, f"{event_type} ko variant count mismatch"
        assert len(language_map["en"]) == 10, f"{event_type} en variant count mismatch"


def test_catalog_and_events_placeholder_sync():
    """catalog.py의 템플릿 placeholder와 events.py 정의가 일치하는지 검증"""
    placeholder_re = re.compile(r"\{(\w+)\}")

    for event_type, definition in EVENT_DEFINITIONS.items():
        required = set(definition.get("placeholders", ()))
        assert event_type in TEMPLATE_CATALOG, (
            f"events.py에 정의된 '{event_type}'이 catalog에 없음"
        )

        for lang, templates in TEMPLATE_CATALOG[event_type].items():
            for i, tpl in enumerate(templates):
                combined = tpl["title"] + " " + tpl["content"]
                used = set(placeholder_re.findall(combined))
                missing = required - used
                extra = used - required
                assert not missing, (
                    f"{event_type}:{lang}[{i}] — 필수 placeholder 누락: {missing}"
                )
                assert not extra, (
                    f"{event_type}:{lang}[{i}] — 미정의 placeholder 사용: {extra}"
                )

    # catalog에 있지만 events에 없는 이벤트 타입 체크
    for event_type in TEMPLATE_CATALOG:
        assert event_type in EVENT_DEFINITIONS, (
            f"catalog에 '{event_type}'이 있지만 events.py에 정의 없음"
        )
