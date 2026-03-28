# Push Schedule Job Refactor Design

**Date:** 2026-03-28

## Goal
`backend/app`의 푸시 및 스케줄 잡 구조를 엔드포인트와 스키마 변경 없이 정리한다. 잡 함수에서 메시지 하드코딩, 전송, 로그 저장, AI fallback 처리까지 뒤섞인 책임을 분리하고, 상황별 기본 푸시 메시지 후보를 다양화한다.

## Current Problems
- `backend/app/jobs/push_jobs.py`, `backend/app/jobs/daily_jobs.py`, `backend/app/jobs/location_alerts.py`에 메시지 템플릿이 분산되어 있다.
- 잡 함수가 대상 조회, 문구 생성, FCM 전송, 로그 저장을 모두 직접 처리한다.
- `ai_message_service`는 일부 이벤트만 지원하며 단일 fallback 템플릿만 받는다.
- 새 푸시 이벤트를 추가하거나 문구를 수정할 때 여러 잡 파일을 직접 수정해야 한다.
- 메시지 다양화가 부족해 동일한 문구 반복 노출이 많다.

## Constraints
- 기존 API 엔드포인트 경로는 유지한다.
- 기존 request/response schema는 유지한다.
- 기존 DB schema는 유지한다.
- 운영 중인 FastAPI 앱 초기화 구조(`main.py`, router wiring)는 이번 리팩토링 범위에서 제외한다.
- 기존 스케줄러 job 이름과 외부 동작 시맨틱은 유지한다.

## Non-Goals
- 새로운 엔드포인트 추가
- DB 마이그레이션
- FCM 인프라 자체 교체
- 스케줄러 프레임워크 교체
- 채팅/WebSocket 구조 리팩토링

## Recommended Approach
하이브리드 중앙화 구조를 적용한다.

- 잡 모듈은 "누가, 언제, 어떤 이벤트를 받는지"만 결정한다.
- 새 notification 서비스 레이어는 "어떤 문구를 만들고 어떻게 전송/기록할지"를 담당한다.
- 기존 `push_service.py`는 저수준 전송/로그 유틸 역할을 유지하되 상위 orchestration은 별도 모듈로 이동한다.
- `ai_message_service`는 이벤트별 다중 후보 템플릿을 캐시하고, 실패 시 풍부한 기본 템플릿 풀로 fallback 한다.

## Internal Architecture

### 1. Notification Catalog
새 내부 모듈에서 이벤트별 메시지 후보를 관리한다.

예상 파일:
- `backend/app/services/notifications/catalog.py`
- `backend/app/services/notifications/events.py`

역할:
- 내부 이벤트 키 정의
- 이벤트별 `ko/en` 제목/본문 후보 리스트 정의
- 템플릿에 필요한 placeholder 메타데이터 정의

대상 이벤트:
- `schedule_start`
- `schedule_place_entry`
- `schedule_place_exit`
- `low_battery`
- `daily_log`
- `daily_weather`
- `my_location_near`
- `schedule_movement`
- `app_reengagement`

### 2. Message Composer
메시지 선택과 렌더링을 담당한다.

예상 파일:
- `backend/app/services/notifications/composer.py`

역할:
- 언어 정규화
- 이벤트별 후보 템플릿 조회
- 사용자/날짜 기반 안정적 variant 선택
- placeholder 치환
- AI 생성 템플릿과 기본 템플릿 풀 결합
- AI 실패 시 기본 후보 중 하나로 fallback

선택 전략:
- 완전 랜덤 대신 `event_type + member_id + date` 기반 deterministic rotation 사용
- 같은 날 같은 사용자에게는 일관된 문구를 유지
- 날짜 또는 이벤트가 바뀌면 자연스럽게 다른 문구 노출

### 3. Notification Dispatcher
전송과 로그 기록을 공통화한다.

예상 파일:
- `backend/app/services/notifications/dispatcher.py`

역할:
- 고수준 `dispatch_notification(...)` 제공
- 내부에서 기존 `send_push()` 및 `push_log_add()` 호출
- 공통 로그 payload 구성
- 실패 로깅 표준화

### 4. AI Template Service Expansion
기존 AI 메시지 서비스를 확장한다.

수정 대상:
- `backend/app/services/ai_message_service.py`

변경 방향:
- 단일 fallback template 대신 후보 리스트를 지원
- 더 많은 이벤트 타입을 지원
- cache key 구조는 유지하되 value는 후보 리스트 또는 선택 가능한 템플릿 세트로 확장
- OpenAI 응답 실패 시 후보 리스트 기반 fallback 수행

## Job Refactor Boundaries

### `backend/app/jobs/push_jobs.py`
- 예약 푸시, 일정 시작 알림, 앱 재방문 유도 알림에서 공통 dispatcher 사용
- 메시지 딕셔너리 제거
- 대상자 조회와 이벤트별 변수 구성만 유지

### `backend/app/jobs/daily_jobs.py`
- 배터리, 이동기록, 날씨, 내 장소 근처, 일정 이동 알림의 메시지 하드코딩 제거
- 이벤트 키 + 변수만 넘기도록 단순화

### `backend/app/jobs/location_alerts.py`
- 일정 장소 진입/이탈 알림에서 owner/leader 대상 전송 로직은 유지
- 메시지 구성과 로그 저장은 dispatcher로 이관

### `backend/app/jobs/base.py`
- 메시지 렌더링 헬퍼는 notification composer 경유로 단순화
- 공통 이벤트 payload 생성 helper를 추가할 수 있음

## Message Diversity Rules
- 각 이벤트마다 언어별 기본 문구 3~5개 제공
- title/content 모두 placeholder를 유지해야 함
- 어조는 짧고 자연스러운 모바일 푸시 톤 유지
- 중복 표현은 피하고, 상황에 맞는 미세한 뉘앙스 차이를 둔다
- AI 생성 결과가 placeholder를 누락하면 폐기하고 기본 템플릿으로 fallback 한다

예시 변화:
- 일정 시작: reminder / urgency / friendly tone variants
- 배터리 부족: 단순 경고 / 부드러운 권장 / 즉시 충전 유도
- 날씨 알림: 일반 안내 / 외출 준비 유도 / 기온 체감 강조
- 재방문 유도: 하루 정리 / 일정 확인 / 위치 기록 점검 유도

## Backward Compatibility
- 잡 함수 이름은 유지한다.
- 스케줄러 registry와 job id는 유지한다.
- 외부에서 호출하는 API 라우트와 schema는 유지한다.
- 기존 `send_push()` 시그니처는 유지한다.

## Error Handling
- AI 실패: 기본 템플릿 풀 사용
- Firebase 미가용: 기존 실패 응답 구조 유지
- placeholder 누락: 잘못된 AI 응답으로 간주하고 fallback
- 로그 저장 실패: 기존처럼 rollback 처리하되 dispatcher에서 공통 에러 로깅

## Testing Strategy

### Unit Tests
추가 대상:
- `backend/tests/test_notification_composer.py`
- `backend/tests/test_ai_message_service.py`

검증 항목:
- 이벤트/언어별 후보 조회
- deterministic variant selection
- placeholder 치환
- AI 실패 시 fallback
- placeholder 누락 응답 거절

### Job-Level Tests
추가 또는 확장 대상:
- `backend/tests/test_push_jobs.py`
- `backend/tests/test_daily_jobs.py`
- `backend/tests/test_location_alerts.py`

검증 항목:
- 잡이 올바른 이벤트 키와 변수를 dispatcher에 전달하는지
- 대상자 필터링이 유지되는지
- 기존 조건 분기(최근 접속자, 거리 기준, 그룹 멤버 제외 등)가 유지되는지

## Implementation Notes
- 파일 분리는 책임 기준으로만 수행하고 과도한 추상화는 피한다.
- 기존 코드에서 이미 안정적인 DB 조회 로직은 유지한다.
- 이번 작업은 구조 정리와 메시지 품질 향상이 목적이므로 기능 범위를 확장하지 않는다.

## Expected Outcome
- 잡 코드 길이와 중복 감소
- 메시지 수정 지점의 단일화
- AI 메시지 실패 시에도 풍부한 fallback 보장
- 사용자별/날짜별 자연스러운 메시지 다양화
