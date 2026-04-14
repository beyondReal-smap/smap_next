# Decision Log — Android GPS 송신 실패 (1 round, 종료)

## 현재 버전 요약
증상: 포그라운드 서비스 알림은 "정지 중(저전력 모드)"로 떠있지만 서버로 위치가 들어오지 않음. iOS는 정상. 이번이 3번째 수정.

## 토론 상태표

| # | 쟁점 | Claude 주장 | Codex 주장 | 최종 결정 |
|---|------|------------|-----------|-----------|
| 1 | `lastLocation` 복원 누락 + STATIONARY 콜백 없음 → heartbeat no-op | 확정 | 확정 + 근거 인용 | **합의**. 수정 적용. |
| 2 | `sendHeartbeat()`의 `if (!hadPending)` 분기로 주기 송신 약화 | 주요 원인 | 부차적, lastLocation null이 주 | **부분합의**. 분기 제거하여 iOS와 대칭화. |
| 3 | AlarmManager→coroutine 이전 | coroutine 안전 | Doze에서 타이머 지연, Alarm 필수 | **미합의 → Codex 수용**. AlarmManager 유지. |
| 4 | `setMinUpdateDistanceMeters(0f)` + 5분 | 경미 | 배터리 회귀 위험 | **미합의 → Codex 수용**. 20m + `setMinUpdateIntervalMillis(300_000L)`. |
| 5 | AuthInterceptor 401→토큰 삭제 | 미언급 | 고우선 원인 | **신규 합의**. 자동 삭제 제거. |
| 6 | FGS 재진입 제한 | 의문 | 면제됨 | **합의**. 변경 없음. |

## 이번 루프에서 바뀐 핵심 내용
1. `AuthInterceptor.kt`: 401 수신 시 토큰 자동 삭제 제거. 삭제는 인증 flow(로그인/재발급) 책임.
2. `LocationService.kt`:
   - `restoreLastLocation()`: 복원된 좌표로 `Location("cached")` 객체 생성, `lastLocation` 변수에도 주입.
   - `sendHeartbeat()`: `hadPending` 분기 제거. pending flush 후 lastLocation이 있으면 항상 전송.
   - `createLocationRequest(STATIONARY)`: 2min interval + `setMinUpdateIntervalMillis(300_000L)` + displacement 20m.
   - AlarmManager 기반 heartbeat 유지(15분).
   - `consecutiveAuthFailures` 카운터도 기존 유지(이중 방어).

## 보류 / 후속
- 배터리 회귀 측정: 20m/5분 하한 조합의 소비 전력 변화는 실기에서 30분 샘플로 측정 권장.
- AuthInterceptor 삭제 로직의 대체: **로그아웃 시점 / 재로그인 실패 시점**에서만 토큰 삭제하도록 인증 flow 재정비(별도 티켓). 현재 변경은 "임의 API의 401이 위치 세션을 망가뜨리는" 구조만 차단.

## 추가 루프 필요 여부
없음. 합의된 범위에서 구현 진행.
