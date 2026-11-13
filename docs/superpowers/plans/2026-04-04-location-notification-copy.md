# Location Notification Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove visible distance text from the `my_location_near` and `schedule_movement` push messages while expanding each language pool to 20 variants and preserving internal distance metadata.

**Architecture:** Keep distance calculation and `push_json.distance` unchanged in the job layer. Update only the notification catalog and placeholder contract for the two affected events so composition no longer requires `distance` for user-facing copy. Adjust focused tests to validate the new variant counts and placeholder behavior.

**Tech Stack:** Python, FastAPI service modules, pytest

---

## File Structure

- `backend/app/services/notifications/catalog.py`
  Fallback title/content pools for notification events. Update two event catalogs to 20 `ko/en` variants without distance text.
- `backend/app/services/notifications/events.py`
  Placeholder contract for each event type. Remove `distance` from the two affected events.
- `backend/tests/test_notification_catalog.py`
  Verify event-by-event variant counts and placeholder/catalog consistency.
- `backend/tests/test_notification_composer.py`
  Verify composition works for `my_location_near` without passing `distance`.

## Execution Notes

- Follow `@superpowers:test-driven-development`.
- Follow `@superpowers:verification-before-completion` before reporting final status.
- Do not change job-layer distance calculation or `push_json.distance`.
- Limit edits to the files above to avoid conflicts with unrelated local changes.

### Task 1: Lock In the New Contract with Failing Tests

**Files:**
- Modify: `backend/tests/test_notification_catalog.py`
- Modify: `backend/tests/test_notification_composer.py`

- [ ] **Step 1: Write a failing catalog-count test**

```python
SPECIAL_VARIANT_COUNTS = {
    "my_location_near": 20,
    "schedule_movement": 20,
}
```

- [ ] **Step 2: Write a failing composer test for missing distance**

```python
title, content = compose_notification(
    event_type="my_location_near",
    lang="ko",
    variables={"title": "회사"},
    member_id=7,
    target_date=date(2026, 4, 4),
)
assert "회사" in content
```

- [ ] **Step 3: Run focused tests to verify they fail**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_catalog.py tests/test_notification_composer.py -v
```

Expected: FAIL because the catalog still has 10 variants and the composer still requires `distance`.

### Task 2: Update the Notification Catalog and Placeholder Definitions

**Files:**
- Modify: `backend/app/services/notifications/catalog.py`
- Modify: `backend/app/services/notifications/events.py`

- [ ] **Step 1: Change the placeholder contract**

```python
"my_location_near": {"placeholders": ("title",)},
"schedule_movement": {"placeholders": ("title",)},
```

- [ ] **Step 2: Replace both event pools with 20 variants per language**

```python
{"title": "내 장소가 가까워요 📍", "content": "'{title}' 근처를 지나고 있어요. 필요한 일이 있으면 확인해보세요."}
```

- [ ] **Step 3: Keep all other events untouched**

### Task 3: Verify Green

**Files:**
- Verify: `backend/tests/test_notification_catalog.py`
- Verify: `backend/tests/test_notification_composer.py`

- [ ] **Step 1: Run the focused tests again**

Run:

```bash
cd /data/wwwroot/smap_next/backend
pytest tests/test_notification_catalog.py tests/test_notification_composer.py -v
```

Expected: PASS.

- [ ] **Step 2: Review the diff for only intended files**

Run:

```bash
git -C /data/wwwroot/smap_next diff -- \
  docs/superpowers/plans/2026-04-04-location-notification-copy.md \
  backend/app/services/notifications/catalog.py \
  backend/app/services/notifications/events.py \
  backend/tests/test_notification_catalog.py \
  backend/tests/test_notification_composer.py
```
