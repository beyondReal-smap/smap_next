from datetime import date
from typing import Any, Dict, Optional

from app.services.notifications.composer import compose_notification
from app.services.push_service import push_log_add, send_push


def _value(source: Any, key: str, default=None):
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def dispatch_notification(
    db,
    recipient: Any,
    event_type: str,
    variables: Dict[str, object],
    plt_condition: str,
    plt_memo: str,
    resource_id: Optional[int] = None,
    push_json: Any = "",
    target_date: Optional[date] = None,
    fallback_templates: Optional[list[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    member_id = _value(recipient, "mt_idx")
    lang = _value(recipient, "mt_lang")
    token_id = _value(recipient, "mt_token_id")

    title, content = compose_notification(
        event_type=event_type,
        lang=lang,
        variables=variables,
        member_id=int(member_id) if member_id is not None else None,
        target_date=target_date,
        fallback_templates=fallback_templates,
    )

    push_result = send_push(
        token_id=token_id,
        title=title,
        content=content,
        member_id=int(member_id) if member_id is not None else None,
    )

    push_log_add(
        db,
        member_id,
        resource_id,
        plt_condition,
        plt_memo,
        title,
        content,
        push_result,
        push_json,
    )

    return {
        "title": title,
        "content": content,
        "push_result": push_result,
    }
