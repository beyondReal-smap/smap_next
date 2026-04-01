from app.services.notifications.catalog import TEMPLATE_CATALOG


def test_each_notification_event_has_ten_variants_per_language():
    for event_type, language_map in TEMPLATE_CATALOG.items():
        assert len(language_map["ko"]) == 10, f"{event_type} ko variant count mismatch"
        assert len(language_map["en"]) == 10, f"{event_type} en variant count mismatch"
