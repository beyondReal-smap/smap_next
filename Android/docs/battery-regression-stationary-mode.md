# STATIONARY 모드 배터리 회귀 측정 가이드

## 배경
`LocationService.createLocationRequest(STATIONARY)`를 다음과 같이 변경.

| 항목 | Before | After |
|------|--------|-------|
| displacement filter | 50 m | 20 m |
| interval (desired) | 2 min | 2 min |
| `setMinUpdateIntervalMillis` | 없음 | 5 min (300_000 ms) |
| priority | BALANCED_POWER_ACCURACY | 동일 |

정지 상태에서도 5분마다 최소 한 건 콜백을 받도록 완화했기 때문에, 정지 시간이 긴 사용자의 배터리 소모가 증가할 가능성이 있음. 변경 이전 대비 "유의미한 배터리 회귀가 없음"을 확인해야 함.

## 측정 대상

- **기기**: 안드로이드 13 이상 실기 2대(고사양/중저사양 각 1). 에뮬레이터 불가.
- **빌드**: `debug` 빌드 2개
  - `baseline` — `git stash` 혹은 직전 커밋(`HEAD~1`)으로 이전 STATIONARY 설정 유지
  - `candidate` — 이번 변경 적용본

## 시나리오

각 빌드에 대해 동일 순서 수행. **두 빌드는 같은 기기에서 순차 측정**(상태 격차 최소화).

1. 기기 완충 → 설치 → 로그인 → 위치 권한 `Always`.
2. 앱을 실행해 LocationService가 WALKING으로 시작되는 것을 `adb logcat -s LocationService` 로 확인.
3. 화면 끄고 기기를 정지 위치(창가 아님, 실내 책상 위)에 **60분 방치**. 이때 STATIONARY 진입 후 관측.
4. 60분 후 배터리 퍼센트 및 `adb shell dumpsys batterystats --reset` 기반 통계 확인.
5. 백엔드에서 해당 mtIdx의 `member_location_log` row 수를 측정 기간 기준으로 count.

## 수집 지표

| 지표 | 수집 방법 | 허용 회귀 |
|------|----------|----------|
| 배터리 퍼센트 감소 | `dumpsys battery` / UI | baseline 대비 +1.0%p 이하 |
| STATIONARY 기간 동안 로그 건수 | 서버 DB count | baseline 대비 2배 이하(5분 주기 보장을 만족) |
| WiFi 스캔 횟수 | `dumpsys batterystats` 내 `wifi-scan-count` | baseline 대비 +20% 이하 |
| `FusedLocationProvider` CPU 시간 | `dumpsys cpuinfo \| grep gms.persistent` | baseline 대비 +15% 이하 |

## 판정

- 모든 지표가 허용 범위 내 → **통과**. 배포.
- 배터리 퍼센트 감소만 회귀 → displacement를 25~30m로 완화 검토(단 heartbeat 경로가 정상이면 displacement↑도 허용 가능).
- 로그 건수가 급증 → `setMinUpdateIntervalMillis` 상향 또는 Priority를 `PRIORITY_LOW_POWER`로 완화.
- WiFi 스캔/CPU 급증 → `Priority.PRIORITY_LOW_POWER`로 완화하거나 displacement 복원.

## 빠른 점검(30분 미니 측정)

정식 측정 전 PR 리뷰 단계에서 "이상 패턴 없음" 확인용:

```sh
# 1) baseline 빌드 설치 후 로그인, 15분 방치
adb shell dumpsys batterystats --reset
# ... 15분 방치 ...
adb shell dumpsys batterystats --charged > baseline.txt

# 2) candidate 빌드로 교체(uninstall 후 설치), 로그인, 15분 방치
adb shell dumpsys batterystats --reset
# ... 15분 방치 ...
adb shell dumpsys batterystats --charged > candidate.txt

diff <(grep -E "wifi-scan|gms\.persistent|Kernel wakelock" baseline.txt | sort) \
     <(grep -E "wifi-scan|gms\.persistent|Kernel wakelock" candidate.txt | sort)
```

## 후속 티켓 연결

- 실측 결과에 따라 `LocationService.kt` 상수(`STATIONARY_DWELL_MS`, STATIONARY 빌더 파라미터) 재조정.
- 실측 로그는 `.collab-loop/android-gps-stationary/measurements/` 아래 보관.
