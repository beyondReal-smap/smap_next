# Packet Round 1 — critique

## 역할
당신은 독립적인 리뷰어입니다. 제가(Claude) 작성한 원인 가설/수정안 초안에 대해 **근거 기반으로 반론/확장/수정**해 주세요. 수용할 부분은 수용하되, **코드/문서/공식 동작으로 반박 가능한 지점은 반드시 지적**해 주세요.

## 작업 목표
안드로이드에서 위치가 서버로 송신되지 않는 증상(포그라운드 알림은 표시, "정지 중 / 저전력 모드" 상태)을 근본 해결. iOS는 정상. 사용자가 3번째 수정을 요청.

## 검토 대상
- 초안: `/Users/genie/SmapSource/smap_next/.collab-loop/android-gps-stationary/draft.md`
- Android 서비스: `/Users/genie/SmapSource/smap_next/Android/app/src/main/java/com/dmonster/smap/LocationService.kt`
- Android 매니페스트: `/Users/genie/SmapSource/smap_next/Android/app/src/main/AndroidManifest.xml`
- Android 재시작 리시버: `/Users/genie/SmapSource/smap_next/Android/app/src/main/java/com/dmonster/smap/LocationRestartReceiver.kt`
- iOS 레퍼런스 구현: `/Users/genie/SmapSource/smap_next/iOS/smap/Core/Location/LocationManager.swift`, `LocationUploader.swift`

## 핵심 주장 (제가 내놓은 것)
1. **H1**: STATIONARY의 `setMinUpdateDistanceMeters(50f)`와 `lastLocation`이 서비스 재시작 시 복원되지 않는 점이 결합해 heartbeat가 no-op로 조용히 실패.
2. **H2**: `sendHeartbeat`의 `if (!hadPending)` 분기가 iOS와 달리 주기 송신을 약화.
3. **H3**: 포그라운드 서비스가 살아 있는데 AlarmManager로 자기 자신을 재시작하는 설계 자체가 Doze/App Standby에서 불리. coroutine `delay` 루프가 더 안전.
4. **수정안 Option A**: Heartbeat을 AlarmManager에서 coroutine 타이머로 이전 + pending 무관 lastLocation 항상 전송 + displacement 0 + `restoreLastLocation` 변수 복원 + 간격 10분.

## 중점 검토 포인트
1. **포그라운드 서비스의 coroutine 타이머가 Doze에서 실제로 보장되는가?** Android 공식 문서 근거로 판정해 주세요. `serviceScope.launch { delay(...) }`가 Doze deep idle에서 block되지 않는지, partial wake lock을 명시적으로 획득할 필요는 없는지.
2. **`setMinUpdateDistanceMeters(0)`로 낮췄을 때 FusedLocationProviderClient의 배터리 영향**. 실측/공식 가이드가 있으면 인용.
3. **STATIONARY에서 완전히 standstill일 때 Google Play Services가 callback을 보장하는 상/하한 빈도**. `Priority.PRIORITY_BALANCED_POWER_ACCURACY` + interval 300_000ms 조합의 실제 행동.
4. **AlarmManager.setAndAllowWhileIdle의 최소 간격 제한** (Android 9+ 9분 하한이었으나 이후 정책 변화). heartbeat 15분이 왜 정상 작동해 보였는지 설명.
5. **서비스가 onStartCommand(ACTION_HEARTBEAT)로 재진입할 때 Android 12+ foreground service start from background 제한**에 걸리는지 여부. 현재 서비스는 이미 포그라운드이니 면제되지만 프로세스가 죽었다가 alarm으로 깨어나는 시나리오 검증.
6. 제가 놓친 **다른 원인 가설**이 있는지. 특히 Retrofit 계층(AuthInterceptor), JWT 만료, 네트워크 보안 설정(`network_security_config.xml`), Hilt `EntryPointAccessors.by lazy` 초기화 경합 등.
7. **Option A의 실행 계획에 있는 구체적 결함**. 예를 들어 coroutine 타이머는 onDestroy에서 cancel되어야 하는데 이것이 보장되는가, mode switch 시 double-fire 가능성 등.

## 근거 경로
- Claude가 아직 읽지 않은 파일이라도, 당신이 참고할 수 있으면 직접 읽어 인용해 주세요:
  - `Android/app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt` — 업로드 엔드포인트
  - `Android/app/src/main/java/com/dmonster/smap/di/NetworkModule.kt` — Retrofit/OkHttp 설정
  - `Android/app/src/main/java/com/dmonster/smap/data/service/AuthService.kt` — 인증 토큰 흐름
  - `Android/app/src/main/res/xml/network_security_config.xml`
  - `backend/app/api/location.py` — 서버 측 수신 로직

## Reply Contract
아래 섹션 구조로 답변해 주세요. 각 항목은 **근거 인용**(파일 경로 + 라인 / 공식 문서 링크)을 포함해야 합니다.

### [A] 동의하는 가설 & 보강 근거
- 제 주장 중 맞다고 판단한 것 + 당신이 찾은 추가 증거.

### [B] 반대/수정 필요
- 틀렸다고 판단한 주장 + 반박 근거. "그럴듯하지만 실제론 이렇다" 형태로.

### [C] 제가 놓친 원인/리스크
- 초안에 없는 근본 원인 후보. 우선순위 매김.

### [D] Option A에 대한 구조적 피드백
- 실행 시 현실적 함정, 대안, 단계 순서 제안.

### [E] 최종 권고 수정안
- 당신이 생각하는 최소한의 수정 Δ (파일 경로 + 라인 힌트 + 의도). 한 번에 구현 가능한 수준으로.

### [F] 합의/미합의 분류
표 형식:
| # | 쟁점 | 내 주장(Claude) | 당신 주장(Codex) | 상태(합의/부분합의/미합의/보류) |

답변 분량은 자유. 장황함보다 근거 있는 판정이 우선입니다.
