import logging
from datetime import date
from typing import Any, Dict, List, Optional

from app.services.notifications.composer import compose_notification
from app.services.push_service import push_log_add, send_batch_push, send_push

logger = logging.getLogger(__name__)


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


def dispatch_notifications_batch(
    db,
    notifications: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """배치 FCM 전송으로 다수 수신자에게 알림을 발송합니다.

    각 항목은 dispatch_notification()과 동일한 키를 가진 dict:
        recipient, event_type, variables, plt_condition, plt_memo,
        resource_id(opt), push_json(opt), target_date(opt), fallback_templates(opt)

    Returns:
        각 알림의 결과 dict 리스트 (title, content, push_result)
    """
    if not notifications:
        return []

    # 1) 메시지 조합 (compose)
    composed: List[Dict[str, Any]] = []
    for spec in notifications:
        recipient = spec["recipient"]
        member_id = _value(recipient, "mt_idx")
        lang = _value(recipient, "mt_lang")
        token_id = _value(recipient, "mt_token_id")

        try:
            title, content = compose_notification(
                event_type=spec["event_type"],
                lang=lang,
                variables=spec["variables"],
                member_id=int(member_id) if member_id is not None else None,
                target_date=spec.get("target_date"),
                fallback_templates=spec.get("fallback_templates"),
            )
        except Exception as e:
            logger.warning(f"compose failed for mt_idx={member_id}: {e}")
            composed.append(None)
            continue

        composed.append({
            "token": token_id,
            "title": title,
            "content": content,
            "member_id": int(member_id) if member_id is not None else None,
        })

    # 2) 배치 FCM 전송
    batch_items = [c for c in composed if c is not None]
    if batch_items:
        batch_responses = send_batch_push(batch_items)
    else:
        batch_responses = []

    # 3) 결과 매핑 + 로그 저장
    results: List[Dict[str, Any]] = []
    batch_idx = 0
    for i, spec in enumerate(notifications):
        comp = composed[i]
        if comp is None:
            results.append({"title": "", "content": "", "push_result": {"result": False, "msg": "compose failed"}})
            continue

        resp = batch_responses[batch_idx] if batch_idx < len(batch_responses) else None
        batch_idx += 1

        success = resp is not None and getattr(resp, "success", False)
        push_result = {"result": success, "msg": "Success" if success else "batch_failed"}

        push_log_add(
            db,
            comp["member_id"],
            spec.get("resource_id"),
            spec["plt_condition"],
            spec["plt_memo"],
            comp["title"],
            comp["content"],
            push_result,
            spec.get("push_json", ""),
        )

        results.append({
            "title": comp["title"],
            "content": comp["content"],
            "push_result": push_result,
        })

    logger.info(
        f"배치 알림 발송 완료: {sum(1 for r in results if r['push_result']['result'])}/{len(results)} 성공"
    )
    return results
