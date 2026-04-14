# Android GPS 송신 실패 — 원인 가설 & 수정안 (Draft v1)

**작업 목표**: 사용자가 세 번째 수정을 요청한 증상 — **안드로이드에서 GPS가 서버로 송신되지 않음, 상태바에 "SMAP 위치 공유 중 / 정지 중(저전력 모드)" 표시** — 의 근본 원인을 식별하고, iOS와 동등한 수준으로 신뢰성 있게 동작하도록 최소한의 리팩토링으로 수정.

**독자**: 모바일 인프라 리뷰어(Codex). 실제 구현 코드와 Google Play Services 동작을 근거로 각 가설의 성립 여부를 판정해 주세요.

---

## 1. 관찰된 상태

- iOS: 정상 동작 (`LocationManager.swift` + `LocationUploader.swift` actor).
- Android: 포그라운드 서비스는 살아 있음 (알림이 표시됨). 그러나 서버(`/api/location_log`)로 위치가 들어오지 않음. 알림 텍스트는 `정지 중 (저전력 모드)` → `PowerMode.STATIONARY`로 진입한 상태.
- 최근 3번의 관련 커밋:
  - `106aee3f4` 3-mode adaptive 도입
  - `529677127` 업로드 안정성 개선(대부분 auth/retry)
  - 현재 워킹 트리(커밋 전): AlarmManager heartbeat + pending queue persistence 도입

## 2. 구현 비교

### 2.1 iOS STATIONARY
```
distanceFilter      = CLLocationDistanceMax    // 콜백 거의 안 옴
desiredAccuracy     = kCLLocationAccuracyThreeKilometers
startHeartbeat(900) // actor Task.sleep 15분 루프
sendHeartbeat       = lastHeartbeatLocation 있으면 "무조건" 전송
lastHeartbeatLocation는 enqueue될 때마다 갱신, actor 내에 보관
```
핵심: **주기적 강제 전송이 보장됨**. pending 유무와 무관.

### 2.2 Android STATIONARY (현재)
```kotlin
LocationRequest(BALANCED_POWER_ACCURACY, 120_000 /*2min*/)
  .setMinUpdateDistanceMeters(50f)

// Heartbeat: AlarmManager.setAndAllowWhileIdle 15분
sendHeartbeat() {
    val hadPending = pendingLocations.isNotEmpty()
    flushPendingLocations()
    if (!hadPending) {
        val loc = lastLocation ?: return   // ← no-op 가능
        ...send(loc)
    }
}

// restoreLastLocation(): queue에만 복원, `lastLocation` 변수는 null 유지
```

## 3. 원인 가설 (우선순위 순)

### H1. STATIONARY `setMinUpdateDistanceMeters(50f)` + `lastLocation` 휘발 → heartbeat no-op
- 실내/정지 상태에서는 `FusedLocationProviderClient`가 displacement 필터 50m를 넘기지 못해 **콜백 0건**. 2분 interval은 무시됨(interval은 "빈도 상한"이지 "하한"이 아님).
- 서비스가 메모리 회수/재시작되면 `lastLocation`이 null. `restoreLastLocation()`은 queue에만 넣고 **Location 객체 변수엔 복원 안 함**.
- 결과: STATIONARY 진입 후 콜백이 안 오는 상황 + 서비스 재시작 후 = **heartbeat가 15분마다 조용히 return**.

### H2. Heartbeat이 pending이 있을 때 `lastLocation`을 "건너뛴다"
- iOS와 달리 `if (!hadPending)` 분기로 주기적 송신의 의미가 약해짐.
- pending이 1건 있고 flush 중 네트워크 실패로 재큐잉되면 영원히 "!hadPending" 경로에 안 들어옴.

### H3. AlarmManager.setAndAllowWhileIdle → Doze/App Standby에서 지연
- Android 12+ Working Set/Frequent 버킷이면 OK. Rare/Restricted이면 수 시간 지연 가능.
- 포그라운드 서비스 프로세스라 완화되지만, alarm 인바운드가 idle maintenance window에 정렬되면 체감상 "송신 안 됨".
- 근본 의문: **포그라운드 서비스가 돌고 있는데 왜 굳이 AlarmManager를 써서 자기 자신을 재시작하는가**. coroutine `delay(15.minutes)` 루프로 충분하며 Doze 영향이 작다.

### H4. Auth 3회 실패 → 토큰 삭제 & stopSelf → 서비스 조용히 중단
- 서버가 일시적으로 401을 발사하면 3회 누적 후 `auth_token` 제거 + `stopSelf()`.
- 그러나 사용자 관점에선 "정지 중 알림이 표시된 상태"가 우선이므로, 실제 stopSelf가 발동되면 알림도 사라져야 함 → 현재 증상과는 불일치. 하지만 401이 간헐적으로 섞이고 리트라이가 무한 재큐잉되면 consecutiveAuthFailures 카운터가 stale하게 남아 있을 수 있음(성공 시 리셋은 됨).
- H1~H3보다는 우선순위 낮음. 별개 이슈로 관찰만.

### H5. STATIONARY dwell 감지 루프가 stale
- `detectModeFromLocation`은 콜백이 와야 호출됨. H1로 콜백이 안 오면 **STATIONARY에서 빠져나올 수도 없음**. 사용자가 이동해도 GPS가 새 fix를 잡아 콜백을 트리거해야 하는데, displacement 필터가 50m이라 짧은 이동(10~40m)에선 감지 실패.
- 즉 STATIONARY는 한 번 진입하면 관성이 있음. 이동 감지 회복 경로가 **displacement 넘는 외부 이동**에만 의존.

## 4. 수정안 (옵션)

### Option A — iOS와 구조 동형화 (권장)
1. **Heartbeat를 AlarmManager에서 coroutine 타이머로 이전**
   - `serviceScope.launch { while (isActive) { delay(HEARTBEAT_INTERVAL_MS); sendHeartbeat() } }`
   - 포그라운드 서비스는 Doze에서도 CPU 실행 허용. AlarmManager 의존 제거 → 재시작 루프/지연 제거.
2. **`sendHeartbeat()` 로직 단순화 — pending 무관, lastLocation 있으면 항상 전송**
   - iOS `sendHeartbeat`와 일치. pending은 batch timer가 별도 처리.
3. **STATIONARY `minUpdateDistanceMeters` 0으로 낮추고 interval 5분으로 단축**
   - iOS `distanceFilter = max`와 대칭적이지 않지만, Android fused provider는 displacement 필터 0이어도 provider가 효율적으로 throttle.
   - 대안: displacement는 0으로 두고 `Priority.PRIORITY_BALANCED_POWER_ACCURACY` + interval 5분 유지.
4. **`restoreLastLocation()`에서 복원된 값으로 `lastLocation` 변수도 세팅**
   - Location 객체 재구성(위/경도/정확도 set). 재시작 직후 heartbeat 빈 발사 방지.
5. **Heartbeat 간격 15분 → 5분** 고려 (iOS는 15분이지만 iOS는 significant location change로 보완됨. Android에 상응하는 signal이 없음).

### Option B — AlarmManager 유지하되 lastLocation 복원 + 조건부 분기 제거
- 위 1, 3번 제외한 2, 4, 5만 적용.
- 장점: 변경 범위 최소.
- 단점: Doze/App Standby 지연 리스크 잔존, 디버깅 어려움.

### Option C — STATIONARY 모드 자체 제거 (iOS는 유지, Android만)
- Android 16 이상이 보편화되기 전까진 `foregroundServiceType=location` + 포그라운드 상태가 배터리 영향 제한적이라는 최근 보고가 있음. 모든 시간대에 WALKING 모드 유지.
- 장점: 코드 대폭 단순화.
- 단점: 배터리 regression. 리그레션 테스트 부담.

**현 제안: Option A**. iOS와의 행동 대칭성이 가장 크고, AlarmManager가 빼낼 수 있는 가장 큰 리스크.

## 5. 확인 필요 항목

- Option A 3번(displacement 0)에 대한 Google Play Services의 실제 throttle 동작 검증 — provider는 과거 대비 얼마나 자주 콜백을 내리는가? 실제 batter impact는?
- Android 14+ `foregroundServiceType=location`에서 coroutine `delay` 기반 타이머가 Doze에서 실행 보장되는가? (포그라운드 서비스는 partial wake lock이 implicit하므로 OK지만 문서로 확인 필요)
- Heartbeat 15분 → 5분 단축의 배터리 영향. 측정 없이 결정하지 않음.
- `consecutiveAuthFailures` 카운터의 리셋 타이밍 — 성공 시 0으로 돌아가지만 체류 시간 기반으로 자동 리셋도 필요한가.

## 6. 제안하는 최종 결과물

- `LocationService.kt`: heartbeat AlarmManager 제거 → coroutine 타이머, `sendHeartbeat()` 조건 단순화, STATIONARY displacement 0, `restoreLastLocation()` 변수 세팅, heartbeat 간격 5~15분 (측정 후 결정, 일단 10분 제안).
- 매니페스트 변경 없음.
- iOS 코드 변경 없음.
- 로그 유지(디버깅 필수).
