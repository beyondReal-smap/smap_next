from typing import Dict, Tuple


EVENT_DEFINITIONS: Dict[str, Dict[str, Tuple[str, ...]]] = {
    "schedule_start": {"placeholders": ("title",)},
    "schedule_place_entry": {"placeholders": ("name", "title")},
    "schedule_place_exit": {"placeholders": ("name", "title")},
    "low_battery": {"placeholders": ("battery",)},
    "daily_log": {"placeholders": ()},
    "daily_weather": {"placeholders": ("temp", "weather", "humidity", "location")},
    "my_location_near": {"placeholders": ("title",)},
    "schedule_movement": {"placeholders": ("title",)},
    "app_reengagement": {"placeholders": ()},
    "my_place_entry": {"placeholders": ("name", "title")},
    "my_place_exit": {"placeholders": ("name", "title")},
}


def get_required_placeholders(event_type: str) -> Tuple[str, ...]:
    definition = EVENT_DEFINITIONS.get(event_type, {})
    return definition.get("placeholders", ())
