import hashlib
from datetime import date
from typing import Dict, List, Optional, Tuple

from app.core.utils import normalize_lang as normalize_notification_lang
from app.services.ai_message_service import ai_message_service
from app.services.notifications.catalog import get_templates
from app.services.notifications.events import get_required_placeholders


def select_variant_index(
    event_type: str,
    member_id: Optional[int],
    target_date: date,
    pool_size: int,
) -> int:
    if pool_size <= 1:
        return 0

    seed = f"{event_type}:{member_id or 0}:{target_date.isoformat()}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % pool_size


def compose_notification(
    event_type: str,
    lang: Optional[str],
    variables: Dict[str, object],
    member_id: Optional[int] = None,
    target_date: Optional[date] = None,
    fallback_templates: Optional[List[Dict[str, str]]] = None,
) -> Tuple[str, str]:
    normalized_lang = normalize_notification_lang(lang)
    resolved_templates = fallback_templates or get_templates(event_type, normalized_lang)
    if not resolved_templates:
        raise ValueError(f"No templates configured for event_type={event_type}, lang={normalized_lang}")

    safe_variables = {key: str(value) for key, value in (variables or {}).items()}
    missing = [
        placeholder
        for placeholder in get_required_placeholders(event_type)
        if placeholder not in safe_variables
    ]
    if missing:
        raise ValueError(
            f"Missing variables for event_type={event_type}: {', '.join(missing)}"
        )

    chosen_date = target_date or date.today()
    variant_index = select_variant_index(
        event_type=event_type,
        member_id=member_id,
        target_date=chosen_date,
        pool_size=len(resolved_templates),
    )

    return ai_message_service.render_message(
        event_type=event_type,
        lang=normalized_lang,
        variables=safe_variables,
        fallback_templates=resolved_templates,
        variant_index=variant_index,
    )
