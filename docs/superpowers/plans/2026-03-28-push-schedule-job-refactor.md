# Push Schedule Job Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor push/schedule job internals into centralized notification components without changing endpoints, schemas, DB schema, or scheduler behavior, while adding richer AI-backed fallback message variants.

**Architecture:** Add a focused `app.services.notifications` package that owns internal event keys, fallback template catalogs, deterministic variant selection, and high-level dispatch. Existing job modules keep recipient selection and business conditions, but delegate message composition and push/log orchestration to shared helpers. `AIMessageService` remains the AI integration point and is expanded to handle template pools instead of a single fallback template.

**Tech Stack:** FastAPI, SQLAlchemy, APScheduler, Firebase Admin, OpenAI Python SDK, pytest

---

## File Structure

- `backend/app/services/notifications/__init__.py`
  Notification service exports for composer and dispatcher.
- `backend/app/services/notifications/events.py`
  Internal notification event keys and required placeholders.
- `backend/app/services/notifications/catalog.py`
  Rich `ko/en` fallback title/content template pools per event.
- `backend/app/services/notifications/composer.py`
  Language normalization, deterministic variant selection, AI + fallback composition.
- `backend/app/services/notifications/dispatcher.py`
  High-level `dispatch_notification(...)` wrapper around `send_push()` and `push_log_add()`.
- `backend/app/services/ai_message_service.py`
  Expand cache and rendering flow from single fallback template to candidate template lists.
- `backend/app/jobs/base.py`
  Reuse composer/dispatcher from jobs through small helper functions.
- `backend/app/jobs/push_jobs.py`
  Migrate schedule-start and app-reengagement jobs to shared notification flow.
- `backend/app/jobs/daily_jobs.py`
  Migrate battery, daily log, weather, my-location, movement notifications to shared flow.
- `backend/app/jobs/location_alerts.py`
  Migrate schedule entry/exit notifications to shared flow.
- `backend/tests/test_notification_composer.py`
  Unit tests for catalog lookup, deterministic rotation, placeholder rendering.
- `backend/tests/test_ai_message_service.py`
  Unit tests for candidate-pool rendering and fallback behavior.
- `backend/tests/test_notification_dispatcher.py`
  Unit tests for send/log orchestration and token-missing behavior.
- `backend/tests/test_push_jobs.py`
  Job-level tests for schedule start and app-reengagement dispatch behavior.
- `backend/tests/test_daily_jobs.py`
  Job-level tests for daily job event selection and dispatcher payloads.
- `backend/tests/test_location_alerts.py`
  Job-level tests for entry/exit target selection and dispatcher payloads.

## Execution Notes

- Follow `@superpowers:test-driven-development` for every task.
- Follow `@superpowers:verification-before-completion` before claiming any task is complete.
- Run tests from `/data/wwwroot/smap_next/backend`.
- Do not change endpoint modules, request/response schemas, or DB schema.
- Do not rename existing scheduler job ids or exported job functions.

### Task 1: Build Notification Events, Catalog, and Composer

**Files:**
- Create: `backend/app/services/notifications/__init__.py`
- Create: `backend/app/services/notifications/events.py`
- Create: `backend/app/services/notifications/catalog.py`
- Create: `backend/app/services/notifications/composer.py`
- Test: `backend/tests/test_notification_composer.py`

- [ ] **Step 1: Write the failing composer tests**

```python
from datetime import date

from app.services.notifications.composer import compose_notification, select_variant_index


def test_select_variant_index_is_stable_for_same_member_and_day():
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
    monkeypatch.setattr(
        "app.services.notifications.composer.ai_message_service.render_message",
        lambda **kwargs: (
            kwargs["fallback_templates"][kwargs["variant_index"]]["title"].format(title="아침 회의"),
            kwargs["fallback_templates"][kwargs["variant_index"]]["content"].format(title="아침 회의"),
        ),
    )
    title, content = compose_notification(
        event_type="schedule_start",
        lang="ko",
        variables={"title": "아침 회의"},
        member_id=7,
        target_date=date(2026, 3, 28),
    )
    assert "아침 회의" in content
    assert title
```

- [ ] **Step 2: Run the new composer tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_composer.py -v
```

Expected: FAIL with `ModuleNotFoundError` or import failure for `app.services.notifications`.

- [ ] **Step 3: Create event keys and placeholder metadata**

```python
# backend/app/services/notifications/events.py
EVENT_DEFINITIONS = {
    "schedule_start": {"placeholders": ("title",)},
    "schedule_place_entry": {"placeholders": ("name", "title")},
    "schedule_place_exit": {"placeholders": ("name", "title")},
    "low_battery": {"placeholders": ("battery",)},
    "daily_log": {"placeholders": ("distance",)},
    "daily_weather": {"placeholders": ("temp", "weather", "humidity")},
    "my_location_near": {"placeholders": ("title", "distance")},
    "schedule_movement": {"placeholders": ("title", "distance")},
    "app_reengagement": {"placeholders": ()},
}
```

- [ ] **Step 4: Create the fallback template catalog with 3-5 variants per event/language**

```python
# backend/app/services/notifications/catalog.py
TEMPLATE_CATALOG = {
    "schedule_start": {
        "ko": [
            {"title": "일정 시작 알림 ⏰", "content": "'{title}' 일정이 30분 후에 시작돼요."},
            {"title": "곧 일정이에요 ⏰", "content": "'{title}' 시작까지 30분 남았어요."},
            {"title": "준비할 시간이에요 ⏰", "content": "'{title}' 일정이 곧 시작됩니다."},
        ],
        "en": [
            {"title": "Schedule Reminder ⏰", "content": "\"{title}\" starts in 30 minutes."},
            {"title": "Almost Time ⏰", "content": "\"{title}\" begins in 30 minutes."},
            {"title": "Get Ready ⏰", "content": "\"{title}\" will start soon."},
        ],
    },
}
```

- [ ] **Step 5: Implement deterministic variant selection and composition**

```python
# backend/app/services/notifications/composer.py
from datetime import date
import hashlib

from app.services.ai_message_service import ai_message_service
from app.services.notifications.catalog import get_templates


def normalize_notification_lang(lang: str | None) -> str:
    value = (lang or "ko").strip().lower()
    return "en" if value.startswith("en") else "ko"


def select_variant_index(event_type: str, member_id: int | None, target_date: date, pool_size: int) -> int:
    seed = f"{event_type}:{member_id or 0}:{target_date.isoformat()}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % pool_size
```

- [ ] **Step 6: Export the public composer API**

```python
# backend/app/services/notifications/__init__.py
from .composer import compose_notification

__all__ = ["compose_notification"]
```

- [ ] **Step 7: Run the composer tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_composer.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add backend/app/services/notifications/__init__.py \
  backend/app/services/notifications/events.py \
  backend/app/services/notifications/catalog.py \
  backend/app/services/notifications/composer.py \
  backend/tests/test_notification_composer.py
git commit -m "feat: add notification event catalog and composer"
```

### Task 2: Expand AI Message Service for Template Pools

**Files:**
- Modify: `backend/app/services/ai_message_service.py`
- Test: `backend/tests/test_ai_message_service.py`

- [ ] **Step 1: Write the failing AI message service tests**

```python
from app.services.ai_message_service import AIMessageService


def test_render_message_uses_variant_index_from_fallback_pool(monkeypatch, tmp_path):
    service = AIMessageService()
    monkeypatch.setattr(service, "_get_cached_template", lambda event_type, lang: None)
    monkeypatch.setattr(service, "_generate_templates", lambda **kwargs: None)

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
```

- [ ] **Step 2: Run the AI message tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_ai_message_service.py -v
```

Expected: FAIL because `render_message()` does not yet accept `fallback_templates` and `variant_index`.

- [ ] **Step 3: Change `render_message()` to accept candidate template pools**

```python
def render_message(
    self,
    event_type: str,
    lang: str,
    variables: Dict[str, str],
    fallback_templates: list[Dict[str, str]],
    variant_index: int,
) -> tuple[str, str]:
    ...
```

- [ ] **Step 4: Add AI candidate generation and cache support**

```python
template_pool = self._get_cached_template(event_type, normalized_lang)
if template_pool is None:
    template_pool = self._generate_templates(...)
if not template_pool:
    template_pool = fallback_templates
template = template_pool[variant_index % len(template_pool)]
```

- [ ] **Step 5: Keep strict placeholder validation when parsing AI output**

```python
for placeholder in placeholders:
    token = "{" + placeholder + "}"
    if token not in title and token not in content:
        return None
```

- [ ] **Step 6: Run the AI message tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_ai_message_service.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add backend/app/services/ai_message_service.py \
  backend/tests/test_ai_message_service.py
git commit -m "feat: support ai notification template pools"
```

### Task 3: Add the High-Level Dispatcher and Job Helpers

**Files:**
- Create: `backend/app/services/notifications/dispatcher.py`
- Modify: `backend/app/services/notifications/__init__.py`
- Modify: `backend/app/jobs/base.py`
- Test: `backend/tests/test_notification_dispatcher.py`

- [ ] **Step 1: Write the failing dispatcher tests**

```python
from app.services.notifications.dispatcher import dispatch_notification


def test_dispatch_notification_sends_push_and_stores_log(monkeypatch):
    sent = {}
    logs = {}

    monkeypatch.setattr(
        "app.services.notifications.dispatcher.compose_notification",
        lambda **kwargs: ("제목", "본문"),
    )
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.send_push",
        lambda token_id, title, content, url=None, member_id=None: sent.update({
            "token_id": token_id,
            "title": title,
            "content": content,
            "member_id": member_id,
        }) or {"result": True, "msg": "Success"},
    )
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.push_log_add",
        lambda db, mt_idx, sst_idx, plt_condition, plt_memo, plt_title, plt_content, push_result, push_json: logs.update({
            "mt_idx": mt_idx,
            "plt_title": plt_title,
            "plt_content": plt_content,
        }),
    )

    result = dispatch_notification(
        db=object(),
        mt_idx=10,
        token_id="token-1",
        event_type="schedule_start",
        lang="ko",
        variables={"title": "산책"},
        plt_condition="1분 - 일정알림",
        plt_memo="일정 시작 30분 전 알림",
    )

    assert result["push_result"]["result"] is True
    assert sent["title"] == "제목"
    assert logs["plt_title"] == "제목"
```

- [ ] **Step 2: Run the dispatcher tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_dispatcher.py -v
```

Expected: FAIL with import failure for `dispatcher.py`.

- [ ] **Step 3: Implement the dispatcher wrapper around composer and push service**

```python
def dispatch_notification(
    db,
    *,
    mt_idx,
    token_id,
    event_type,
    lang,
    variables,
    plt_condition,
    plt_memo,
    sst_idx=None,
    push_json=None,
    member_id_for_seed=None,
):
    title, content = compose_notification(
        event_type=event_type,
        lang=lang,
        variables=variables,
        member_id=member_id_for_seed or int(mt_idx),
    )
    push_result = send_push(token_id, title, content, member_id=member_id_for_seed or int(mt_idx))
    push_log_add(db, mt_idx, sst_idx, plt_condition, plt_memo, title, content, push_result, push_json or {})
    return {"title": title, "content": content, "push_result": push_result}
```

- [ ] **Step 4: Add small helpers in `jobs/base.py` for reuse from job modules**

```python
def dispatch_event_notification(db, **kwargs):
    from app.services.notifications.dispatcher import dispatch_notification
    return dispatch_notification(db=db, **kwargs)
```

- [ ] **Step 5: Run the dispatcher tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_dispatcher.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/app/services/notifications/dispatcher.py \
  backend/app/services/notifications/__init__.py \
  backend/app/jobs/base.py \
  backend/tests/test_notification_dispatcher.py
git commit -m "feat: add notification dispatcher helpers"
```

### Task 4: Refactor `push_jobs.py` to Use the Shared Notification Flow

**Files:**
- Modify: `backend/app/jobs/push_jobs.py`
- Test: `backend/tests/test_push_jobs.py`

- [ ] **Step 1: Write the failing `push_jobs` tests**

```python
from types import SimpleNamespace

from app.jobs.push_jobs import run_schedule_notification, run_trigger_app_execution_at_7_30pm


def test_run_schedule_notification_dispatches_schedule_start(monkeypatch):
    fake_db = SimpleNamespace(commit=lambda: None, rollback=lambda: None)
    schedule = SimpleNamespace(sst_idx=11, mt_idx=1, sst_title="조식", sgt_idx=None, sst_schedule_chk="N")
    owner = SimpleNamespace(mt_idx=1, mt_token_id="token-1", mt_lang="ko")
    calls = []

    monkeypatch.setattr("app.models.schedule.Schedule.get_now_schedule_push", lambda db: [schedule])
    monkeypatch.setattr("app.jobs.push_jobs.prefetch_members", lambda db, ids: {1: owner})
    monkeypatch.setattr(
        "app.jobs.push_jobs.dispatch_event_notification",
        lambda db, **kwargs: calls.append(kwargs) or {"push_result": {"result": True}},
    )

    run_schedule_notification(fake_db)

    assert calls[0]["event_type"] == "schedule_start"
    assert calls[0]["variables"] == {"title": "조식"}
```

- [ ] **Step 2: Run the `push_jobs` tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_push_jobs.py -v
```

Expected: FAIL because `push_jobs.py` does not yet use `dispatch_event_notification`.

- [ ] **Step 3: Migrate schedule-start notifications to the dispatcher**

```python
dispatch_event_notification(
    db,
    mt_idx=owner.mt_idx,
    token_id=owner.mt_token_id,
    event_type="schedule_start",
    lang=owner.mt_lang,
    variables={"title": schedule_title},
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    sst_idx=sst_idx,
    member_id_for_seed=owner.mt_idx,
)
```

- [ ] **Step 4: Migrate app re-engagement notifications to the dispatcher**

```python
dispatch_event_notification(
    db,
    mt_idx=mt_idx,
    token_id=member.mt_token_id,
    event_type="app_reengagement",
    lang=getattr(member, "mt_lang", None),
    variables={},
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    member_id_for_seed=member.mt_idx,
)
```

- [ ] **Step 5: Leave reserved push behavior intact unless the message is already event-based**

```python
# keep direct send for persisted ad-hoc reserved pushes
push_result = send_push(member.mt_token_id, push.plt_title, push.plt_content)
```

- [ ] **Step 6: Run the `push_jobs` tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_push_jobs.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/app/jobs/push_jobs.py \
  backend/tests/test_push_jobs.py
git commit -m "refactor: centralize push job notification dispatch"
```

### Task 5: Refactor `daily_jobs.py` to Use the Shared Notification Flow

**Files:**
- Modify: `backend/app/jobs/daily_jobs.py`
- Test: `backend/tests/test_daily_jobs.py`

- [ ] **Step 1: Write the failing `daily_jobs` tests**

```python
from types import SimpleNamespace

from app.jobs.daily_jobs import run_notify_low_battery_at_9pm


def test_run_notify_low_battery_dispatches_low_battery_event(monkeypatch):
    fake_db = SimpleNamespace(execute=lambda *args, **kwargs: SimpleNamespace(fetchall=lambda: [
        SimpleNamespace(mt_idx=7, mt_token_id="token-7", mt_lang="ko", battery=24)
    ]), rollback=lambda: None)
    calls = []

    monkeypatch.setattr(
        "app.jobs.daily_jobs.dispatch_event_notification",
        lambda db, **kwargs: calls.append(kwargs) or {"push_result": {"result": True}},
    )

    run_notify_low_battery_at_9pm(fake_db)

    assert calls[0]["event_type"] == "low_battery"
    assert calls[0]["variables"] == {"battery": "24"}
```

- [ ] **Step 2: Run the `daily_jobs` tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_daily_jobs.py -v
```

Expected: FAIL because `daily_jobs.py` still builds inline message dictionaries.

- [ ] **Step 3: Migrate low-battery, daily-log, and weather notifications**

```python
dispatch_event_notification(
    db,
    mt_idx=mt_idx,
    token_id=member.mt_token_id,
    event_type="daily_weather",
    lang=getattr(member, "mt_lang", None),
    variables={
        "temp": str(weather_info["temperature"]),
        "weather": str(weather_info["weather"]),
        "humidity": str(weather_info["humidity"]),
    },
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    push_json=weather_info,
)
```

- [ ] **Step 4: Migrate my-location-near and schedule-movement notifications**

```python
dispatch_event_notification(
    db,
    mt_idx=mt_idx,
    token_id=member.mt_token_id,
    event_type="my_location_near",
    lang=getattr(member, "mt_lang", None),
    variables={"title": loc.get("slt_title") or "내장소", "distance": formatted_distance},
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    sst_idx=slt_idx,
    push_json=push_json,
)
```

- [ ] **Step 5: Preserve current targeting and skip logic**

```python
if not member or not member.mt_token_id:
    continue
if not weather_info:
    continue
if distance <= 1000.0:
    ...
```

- [ ] **Step 6: Run the `daily_jobs` tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_daily_jobs.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add backend/app/jobs/daily_jobs.py \
  backend/tests/test_daily_jobs.py
git commit -m "refactor: centralize daily job notification dispatch"
```

### Task 6: Refactor `location_alerts.py` to Use the Shared Notification Flow

**Files:**
- Modify: `backend/app/jobs/location_alerts.py`
- Test: `backend/tests/test_location_alerts.py`

- [ ] **Step 1: Write the failing `location_alerts` tests**

```python
from types import SimpleNamespace

from app.jobs.location_alerts import _send_entry_notifications


def test_send_entry_notifications_dispatches_entry_event_for_non_actor_targets(monkeypatch):
    calls = []
    group_data = {
        "member": {"mt_idx": 3, "mt_name": "민수"},
        "owner": {"mt_idx": 1, "mt_token_id": "owner-token", "mt_lang": "ko"},
        "leader": {"mt_idx": 2, "mt_token_id": "leader-token", "mt_lang": "ko"},
    }
    schedule = SimpleNamespace(sst_idx=15, sst_title="점심 약속")

    monkeypatch.setattr(
        "app.jobs.location_alerts.dispatch_event_notification",
        lambda db, **kwargs: calls.append(kwargs) or {"push_result": {"result": True}},
    )

    _send_entry_notifications(
        db=object(),
        group_data=group_data,
        schedule=schedule,
        plt_condition="30초 - 장소알림",
        plt_memo="진입 알림",
        push_json={},
    )

    assert [call["mt_idx"] for call in calls] == [1, 2]
    assert all(call["event_type"] == "schedule_place_entry" for call in calls)
```

- [ ] **Step 2: Run the `location_alerts` tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_location_alerts.py -v
```

Expected: FAIL because `_send_entry_notifications()` and `_send_exit_notifications()` still call `send_push()` directly.

- [ ] **Step 3: Migrate entry notifications to the dispatcher**

```python
dispatch_event_notification(
    db,
    mt_idx=target.get("mt_idx"),
    token_id=target.get("mt_token_id"),
    event_type="schedule_place_entry",
    lang=target.get("mt_lang"),
    variables={"name": actor_name, "title": schedule_title},
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    sst_idx=record_value(schedule, "sst_idx"),
    push_json=push_json,
    member_id_for_seed=target.get("mt_idx"),
)
```

- [ ] **Step 4: Migrate exit notifications to the dispatcher**

```python
dispatch_event_notification(
    db,
    mt_idx=target.get("mt_idx"),
    token_id=target.get("mt_token_id"),
    event_type="schedule_place_exit",
    lang=target.get("mt_lang"),
    variables={"name": actor_name, "title": schedule_title},
    plt_condition=plt_condition,
    plt_memo=plt_memo,
    sst_idx=record_value(schedule, "sst_idx"),
    push_json=push_json,
    member_id_for_seed=target.get("mt_idx"),
)
```

- [ ] **Step 5: Keep geofence logic and status updates unchanged**

```python
if not _is_gps_usable(member_loc, now):
    continue
distance = haversine(...)
if distance <= GEOFENCE_ENTRY_RADIUS:
    ...
```

- [ ] **Step 6: Run the `location_alerts` tests to verify they pass**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_location_alerts.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add backend/app/jobs/location_alerts.py \
  backend/tests/test_location_alerts.py
git commit -m "refactor: centralize location alert notification dispatch"
```

### Task 7: Run End-to-End Verification for the Refactor Slice

**Files:**
- Modify: `backend/app/services/notifications/catalog.py`
- Modify: `backend/app/services/notifications/composer.py`
- Modify: `backend/app/services/notifications/dispatcher.py`
- Modify: `backend/app/services/ai_message_service.py`
- Modify: `backend/app/jobs/base.py`
- Modify: `backend/app/jobs/push_jobs.py`
- Modify: `backend/app/jobs/daily_jobs.py`
- Modify: `backend/app/jobs/location_alerts.py`
- Test: `backend/tests/test_notification_composer.py`
- Test: `backend/tests/test_ai_message_service.py`
- Test: `backend/tests/test_notification_dispatcher.py`
- Test: `backend/tests/test_push_jobs.py`
- Test: `backend/tests/test_daily_jobs.py`
- Test: `backend/tests/test_location_alerts.py`
- Test: `backend/tests/test_weather_service.py`

- [ ] **Step 1: Run the full targeted notification test suite**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest \
  tests/test_notification_composer.py \
  tests/test_ai_message_service.py \
  tests/test_notification_dispatcher.py \
  tests/test_push_jobs.py \
  tests/test_daily_jobs.py \
  tests/test_location_alerts.py \
  tests/test_weather_service.py -v
```

Expected: PASS for every test in the targeted suite.

- [ ] **Step 2: If any test fails, fix the production code and re-run the same suite**

```bash
cd /data/wwwroot/smap_next/backend
pytest \
  tests/test_notification_composer.py \
  tests/test_ai_message_service.py \
  tests/test_notification_dispatcher.py \
  tests/test_push_jobs.py \
  tests/test_daily_jobs.py \
  tests/test_location_alerts.py \
  tests/test_weather_service.py -v
```

Expected: PASS with zero failures before completion claims.

- [ ] **Step 3: Inspect the final diff to confirm no endpoint/schema files were changed**

Run:

```bash
cd /data/wwwroot/smap_next
git diff --stat -- backend/app docs/superpowers/plans
```

Expected: only notification service, job modules, tests, and the plan document are changed for this work.

- [ ] **Step 4: Commit the completed refactor slice**

```bash
git add backend/app/services/notifications \
  backend/app/services/ai_message_service.py \
  backend/app/jobs/base.py \
  backend/app/jobs/push_jobs.py \
  backend/app/jobs/daily_jobs.py \
  backend/app/jobs/location_alerts.py \
  backend/tests/test_notification_composer.py \
  backend/tests/test_ai_message_service.py \
  backend/tests/test_notification_dispatcher.py \
  backend/tests/test_push_jobs.py \
  backend/tests/test_daily_jobs.py \
  backend/tests/test_location_alerts.py
git commit -m "refactor: centralize push notification composition and dispatch"
```

- [ ] **Step 5: Record final verification evidence in the execution handoff**

```text
Targeted notification suite: PASS
Endpoints/schemas touched: NO
Scheduler job ids changed: NO
```
