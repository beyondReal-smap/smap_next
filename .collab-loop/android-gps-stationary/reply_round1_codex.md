Reading additional input from stdin...
OpenAI Codex v0.118.0 (research preview)
--------
workdir: /Users/genie/SmapSource/smap_next
model: gpt-5-codex
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: detailed
session id: 019d8b74-e761-7862-b151-272e69502fbf
--------
user
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
exec
/bin/zsh -lc ls in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
-p
ALIGO_IP_REGISTRATION.md
ANDROID_DEEP_LINK_SETUP.md
Android
AppDelegate_Complete.swift
AppleWWDRCA.cer
BROWSER_DEBUG_GUIDE.md
Complete_Implementation_Guide.md
DOMAIN_TROUBLESHOOTING_GUIDE.md
FCM_Enhancement_Summary.md
FCM_SETUP_GUIDE.md
FIXIE_PROXY_SETUP_GUIDE.md
FIXIE_SETUP_INSTRUCTIONS.md
GOOGLE_OAUTH_SETUP_GUIDE.md
GROUP_JOIN_FEATURE_README.md
Info_Complete.plist
KAKAO_LOGIN_GUIDE.md
LOGIN_PERSISTENCE_GUIDE.md
LOGS_IMPROVEMENTS.md
MapDebugViewController.swift
Naver_Maps_API_Error_Fix_Guide.md
PERFORMANCE_OPTIMIZATION.md
README.md
SCHEDULE_API_GUIDE.md
SMAP_iOS_URL_변경_가이드.md
SMAP_홈_사이드바_햅틱_테스트_가이드.md
SceneDelegate_Complete.swift
ViewController_Debug_Extension.swift
WebKit_Data_Loading_Optimization_Guide.md
[LTM]minerd.txt
add_member_indicator.py
auto_login_implementation_guide.md
backend
channel_match_rates_radar.png
chart_outputs
config
docs
domain_debug_script.js
fcm_curl_simple.sh
fcm_debug_ios.py
fcm_enhanced_test.sh
fcm_enhanced_test_20250902_082712.log
fcm_enhanced_test_20250902_085732.log
fcm_enhanced_test_20250902_085750.log
fcm_enhanced_test_20250902_110038.log
fcm_enhanced_test_20250902_110052.log
fcm_test.sh
fcm_test_custom.sh
fcm_test_direct.py
fcm_test_simple.py
fcm_test_token.py
fcm_token_debug.py
fcm_token_force_update.py
fcm_token_monitor.py
fcm_token_refresh.sh
fcm_web_test.html
firebase_console_test_guide.md
fix_ios_push_delivery.py
fix_test_token_issue.md
force_fcm_token_refresh.py
frontend
iOS
iOS.zip
iOS_App_Bound_Domain_Fix_Guide.md
iOS_Background_Push_Long_Term_Fix_Guide.md
iOS_DEEP_LINK_SETUP.md
iOS_Debug_Handler.swift
iOS_FCM_Setup_Complete.md
iOS_FCM_Test_Guide.md
iOS_HAPTIC_IMPLEMENTATION_GUIDE.md
iOS_Haptic_Handler.swift
iOS_Push_Fix_Guide.md
iOS_Push_Notification_Debug.md
iOS_Push_Visibility_Fix.md
iOS_Quick_Debug_Checklist.md
iOS_WebView_Cache_Manager.swift
iOS_WebView_Enhanced.swift
iOS_WebView_Log_Handler.swift
iOS_WebView_Setup.swift
iOS_WebView_Troubleshooting_Guide.md
invalid_tokens.log
ios_background_push_fix_guide.md
ios_fcm_debug_guide.md
ios_overnight_debug.py
ios_push_batching_fix_guide.md
ios_push_debug_checklist.md
ios_push_debug_enhanced.py
landing-page
mkdir
models
my-release-key.jks
openapi.json
scripts
seeders
server.js
smap
start-dev.sh
start-prod.sh
svg_parser.py
temp_indicator.txt
test.py
test_apns_direct.py
test_fcm_token_logic.py
test_minimal_apns.py
token_validation_enhanced.py

**Planning multi-step approach with constraints**

I’m mapping out a multi-step plan to address the user's request systematically, including inspecting various Android components and docs. Since network access is restricted, I’m considering searching local documentation for official Android references or relying on known information, while noting the limitation on citing web sources. Let’s try finding relevant local docs next.
exec
/bin/zsh -lc 'rg -n "Doze" -n' in /Users/genie/SmapSource/smap_next
 exited 1 in 0ms:
복잡한 원인 가설/코드 다수를 교차 검토해야 하므로 단계별 계획을 세웁니다.
  → draft.md에서 Claude의 가설과 Option A 내용을 파악한다
  • Android 서비스/매니페스트/리시버를 읽어 heartbeat, lastLocation, AlarmManager 동작을 확인한다
  • iOS 구현과 네트워크/인증 관련 파일을 살펴 비교 근거와 대체 가설을 수집한다
  • 각 가설 및 Option A에 대한 근거 기반 비판/보강을 정리한다
exec
/bin/zsh -lc "sed -n '1,200p' .collab-loop/android-gps-stationary/draft.md" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
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

exec
/bin/zsh -lc "sed -n '200,400p' .collab-loop/android-gps-stationary/draft.md" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
  ✓ draft.md에서 Claude의 가설과 Option A 내용을 파악한다
  → Android 서비스/매니페스트/리시버를 읽어 heartbeat, lastLocation, AlarmManager 동작을 확인한다
  • iOS 구현과 네트워크/인증 관련 파일을 살펴 비교 근거와 대체 가설을 수집한다
  • 각 가설 및 Option A에 대한 근거 기반 비판/보강을 정리한다
exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/LocationService.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.CreateLocationLogRequest
import com.google.android.gms.location.*
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Adaptive 3-mode foreground location service for battery-efficient tracking.
 *
 * Modes:
 *  - STATIONARY : low-power, 5 min interval, 500 m displacement, 15 min heartbeat
 *  - WALKING    : high-accuracy, 30 s interval, 30 m displacement, 1 min batch
 *  - AUTOMOTIVE : high-accuracy, 15 s interval, 100 m displacement, 1 min batch
 *
 * Mode is detected from GPS speed with a 5-minute dwell timer before entering
 * STATIONARY, and instant upgrade to WALKING/AUTOMOTIVE when movement resumes.
 */
class LocationService : Service() {

    // ── Hilt entry point (Service cannot use @Inject) ──────────────────────

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface LocationServiceEntryPoint {
        fun smapApi(): SmapApi
    }

    private val smapApi: SmapApi by lazy {
        EntryPointAccessors.fromApplication(
            applicationContext, LocationServiceEntryPoint::class.java
        ).smapApi()
    }

    // ── Power modes ────────────────────────────────────────────────────────

    enum class PowerMode { STATIONARY, WALKING, AUTOMOTIVE }

    private var currentMode = PowerMode.WALKING

    // ── Location client ────────────────────────────────────────────────────

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest

    // ── Activity / mode detection ──────────────────────────────────────────

    private var stationaryStartTime: Long = 0L
    @Volatile private var lastLocation: Location? = null
    private var consecutiveAuthFailures = 0
    private val maxAuthFailures = 3

    // ── Location batching ──────────────────────────────────────────────────

    private val pendingLocations = mutableListOf<CreateLocationLogRequest>()
    private val maxQueueSize = 100
    private var batchJob: Job? = null
    private var heartbeatPendingIntent: PendingIntent? = null

    // ── Coroutine scope ────────────────────────────────────────────────────

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // ── Constants ──────────────────────────────────────────────────────────

    companion object {
        private const val TAG = "LocationService"
        private const val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
        private const val NOTIFICATION_ID = 10000
        private const val AUTH_PREFS = "smap_auth_prefs"
        private const val QUEUE_PREFS = "smap_location_service"
        private const val KEY_PENDING_QUEUE = "pending_queue"
        private const val KEY_LAST_LOCATION = "last_location"
        private const val RESTART_DELAY_MS = 5_000L

        private const val STATIONARY_DWELL_MS = 5 * 60 * 1000L  // 5 min before entering stationary
        private const val HEARTBEAT_INTERVAL_MS = 900_000L       // 15 min
        private const val BATCH_INTERVAL_MS = 60_000L            // 1 min

        private const val ACTION_HEARTBEAT = "com.dmonster.smap.ACTION_HEARTBEAT"
        private const val REQUEST_CODE_HEARTBEAT = 2002

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            return manager.getRunningServices(Integer.MAX_VALUE)
                .any { it.service.className == LocationService::class.java.name }
        }

        fun hasRequiredPermissions(context: Context): Boolean {
            val fine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val locationGranted = fine || coarse
            val backgroundGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            val foregroundServiceGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            return locationGranted && backgroundGranted && foregroundServiceGranted
        }

        fun isUserLoggedIn(context: Context): Boolean {
            val prefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val mtIdx = prefs.getInt("mt_idx", -1)
            return !token.isNullOrBlank() && mtIdx > 0
        }

        fun startIfEligible(context: Context, reason: String) {
            if (!isUserLoggedIn(context)) {
                Log.d(TAG, "Skip start ($reason): user not logged in")
                return
            }
            if (!hasRequiredPermissions(context)) {
                Log.d(TAG, "Skip start ($reason): required location permissions missing")
                return
            }

            val intent = Intent(context, LocationService::class.java).putExtra("restart_reason", reason)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.d(TAG, "LocationService start requested ($reason)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start LocationService ($reason)", e)
            }
        }
    }

    // ── Location callback ──────────────────────────────────────────────────

    private val locationCallback: LocationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            var latestValid: Location? = null
            for (location in result.locations) {
                if (!isValidCoordinate(location)) continue

                // Build request and enqueue all valid locations
                val request = buildLocationLogRequest(location) ?: continue
                enqueueLocation(request)
                lastLocation = location
                latestValid = location
            }
            // Mode detection on latest location only to avoid thrashing
            latestValid?.let { detectModeFromLocation(it) }
        }
    }

    // ── Service lifecycle ──────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationRequest = createLocationRequest(PowerMode.WALKING)
        restorePendingLocations()
        restoreLastLocation()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Ensure foreground state first (required within 5s of onCreate on API 31+)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification(currentMode))

        // Handle AlarmManager-triggered heartbeat action
        if (intent?.action == ACTION_HEARTBEAT) {
            sendHeartbeat()

exec
/bin/zsh -lc "sed -n '200,400p' Android/app/src/main/java/com/dmonster/smap/LocationService.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
            sendHeartbeat()
            scheduleHeartbeatAlarm()   // schedule next
            return START_STICKY
        }

        Log.d(TAG, "LocationService starting")

        // Android 14+ foreground service location permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.FOREGROUND_SERVICE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                Log.e(TAG, "FOREGROUND_SERVICE_LOCATION permission missing")
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // Location permission
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Location permission missing")
            stopSelf()
            return START_NOT_STICKY
        }

        cancelAlarms()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        startLocationTracking()
        startTimerForMode(currentMode)

        Log.d(TAG, "LocationService started in ${currentMode.name} mode")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        persistPendingLocations()
        persistLastLocation()
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        cancelAlarms()
        serviceScope.cancel()
        Log.d(TAG, "LocationService destroyed")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        scheduleRestart("task_removed")
    }

    // ── Location request per mode ──────────────────────────────────────────

    private fun createLocationRequest(mode: PowerMode): LocationRequest {
        return when (mode) {
            PowerMode.STATIONARY -> LocationRequest.Builder(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY, 120_000L  // 2 min
            ).setMinUpdateDistanceMeters(50f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .build()

            PowerMode.WALKING -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 30_000L  // 30 sec
            ).setMinUpdateDistanceMeters(30f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .setWaitForAccurateLocation(true)
                .build()

            PowerMode.AUTOMOTIVE -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 15_000L  // 15 sec
            ).setMinUpdateDistanceMeters(100f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .setWaitForAccurateLocation(true)
                .build()
        }
    }

    // ── Tracking ───────────────────────────────────────────────────────────

    private fun startLocationTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) return

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission revoked during request", e)
            stopSelf()
        }
    }

    // ── Mode detection (speed-based) ───────────────────────────────────────

    private fun detectModeFromLocation(location: Location) {
        val speed = if (location.speed < 0f) 0f else location.speed  // m/s

        val detectedMode = when {
            speed < 0.5f  -> PowerMode.STATIONARY  // < 1.8 km/h
            speed < 8.0f  -> PowerMode.WALKING     // < 28.8 km/h (walk / run / cycle)
            else          -> PowerMode.AUTOMOTIVE   // > 28.8 km/h
        }

        if (detectedMode == PowerMode.STATIONARY) {
            // Only enter stationary after dwelling for STATIONARY_DWELL_MS
            if (stationaryStartTime == 0L) {
                stationaryStartTime = System.currentTimeMillis()
            } else if (System.currentTimeMillis() - stationaryStartTime > STATIONARY_DWELL_MS) {
                switchToMode(PowerMode.STATIONARY)
            }
        } else {
            // Moving: reset dwell timer & switch immediately
            stationaryStartTime = 0L
            switchToMode(detectedMode)
        }
    }

    // ── Mode switching ─────────────────────────────────────────────────────

    private fun switchToMode(newMode: PowerMode) {
        if (newMode == currentMode) return
        Log.d(TAG, "Mode: ${currentMode.name} -> ${newMode.name}")
        currentMode = newMode

        // Flush pending before reconfiguring
        flushPendingLocations()

        // Stop old alarms
        cancelAlarms()

        // Reconfigure location request
        fusedLocationClient.removeLocationUpdates(locationCallback)
        locationRequest = createLocationRequest(newMode)
        startLocationTracking()

        // Start appropriate alarm
        startTimerForMode(newMode)

        // Update notification
        updateNotification(newMode)
    }

    private fun startTimerForMode(mode: PowerMode) {
        when (mode) {
            PowerMode.STATIONARY -> startHeartbeatTimer()
            PowerMode.WALKING,
            PowerMode.AUTOMOTIVE -> startBatchTimer()
        }
    }

    // ── Batching ───────────────────────────────────────────────────────────

    private fun enqueueLocation(data: CreateLocationLogRequest) {
        synchronized(pendingLocations) {
            pendingLocations.add(data)
            if (pendingLocations.size > maxQueueSize) {
                pendingLocations.removeAt(0)  // evict oldest
            }
        }
        persistPendingLocations()
    }

    private fun startBatchTimer() {
        batchJob?.cancel()
        batchJob = serviceScope.launch {
            while (isActive) {
                delay(BATCH_INTERVAL_MS)
                flushPendingLocations()
            }
        }
    }

    private fun startHeartbeatTimer() {
        cancelHeartbeatAlarm()
        scheduleHeartbeatAlarm()
    }

    private fun scheduleHeartbeatAlarm() {
        val intent = Intent(this, LocationService::class.java).setAction(ACTION_HEARTBEAT)
        heartbeatPendingIntent = PendingIntent.getService(
            this, REQUEST_CODE_HEARTBEAT, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + HEARTBEAT_INTERVAL_MS,
            heartbeatPendingIntent!!
        )
    }


exec
/bin/zsh -lc "sed -n '400,800p' Android/app/src/main/java/com/dmonster/smap/LocationService.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:

    private fun cancelHeartbeatAlarm() {
        heartbeatPendingIntent?.let {
            (getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(it)
            it.cancel()
        }
        heartbeatPendingIntent = null
    }

    private fun cancelAlarms() {
        batchJob?.cancel()
        batchJob = null
        cancelHeartbeatAlarm()
    }

    private fun flushPendingLocations() {
        val toSend: List<CreateLocationLogRequest>
        synchronized(pendingLocations) {
            if (pendingLocations.isEmpty()) return
            toSend = pendingLocations.toList()
            pendingLocations.clear()
        }
        persistPendingLocations()
        toSend.forEach { request ->
            serviceScope.launch { sendLocationToServer(request) }
        }
    }

    /**
     * Heartbeat: flush any queued locations first. If the queue was empty
     * (no new data since last flush), re-send the last known location so
     * the server knows the device is still alive.
     */
    private fun sendHeartbeat() {
        // Flush any locations that accumulated while stationary
        val hadPending: Boolean
        synchronized(pendingLocations) { hadPending = pendingLocations.isNotEmpty() }
        flushPendingLocations()

        // Only send heartbeat if nothing was flushed (avoid duplicate)
        if (!hadPending) {
            val loc = lastLocation ?: return
            val request = buildLocationLogRequest(loc) ?: return
            serviceScope.launch { sendLocationToServer(request) }
        }
    }

    // ── Build request model ────────────────────────────────────────────────

    private fun buildLocationLogRequest(location: Location): CreateLocationLogRequest? {
        val prefs = getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
        val mtIdxInt = prefs.getInt("mt_idx", -1)
        if (mtIdxInt == -1) return null

        val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        // Use the GPS-measured time, not the current wall-clock time
        val locationTime = if (location.time > 0) Date(location.time) else Date()

        return CreateLocationLogRequest(
            mtIdx = mtIdxInt.toString(),
            mltLat = location.latitude,
            mltLong = location.longitude,
            mltAccuracy = location.accuracy.toDouble(),
            mltSpeed = location.speed.toDouble(),
            mltAltitude = if (location.hasAltitude()) location.altitude else 0.0,
            mltTimestamp = dateFormatter.format(locationTime),
            mltBattery = getBatteryLevel()
        )
    }

    // ── Server communication (Retrofit) ────────────────────────────────────

    private suspend fun sendLocationToServer(request: CreateLocationLogRequest) {
        try {
            val response = smapApi.createLocationLog(request)
            if (response.isSuccessful) {
                consecutiveAuthFailures = 0
                Log.d(TAG, "Location sent: (${request.mltLat}, ${request.mltLong}) mode=${currentMode.name}")
            } else {
                Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
                when (response.code()) {
                    401 -> {
                        consecutiveAuthFailures++
                        if (consecutiveAuthFailures >= maxAuthFailures) {
                            // Persistent auth failure — clear token to prevent infinite restart loop
                            getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
                                .edit().remove("auth_token").apply()
                            Log.w(TAG, "Auth failed $maxAuthFailures times — cleared token, stopping service")
                            stopSelf()
                        } else {
                            Log.w(TAG, "Auth failed ($consecutiveAuthFailures/$maxAuthFailures) — will retry")
                            enqueueLocation(request)
                        }
                    }
                    403 -> {
                        // 403 may be rate-limit or authorization issue, not necessarily auth failure
                        Log.w(TAG, "403 Forbidden — dropping location, not clearing token")
                    }
                    in 500..599 -> {
                        // Re-enqueue on server error for retry
                        enqueueLocation(request)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Location upload error: ${e.message}")
            // Re-enqueue on network error for retry
            enqueueLocation(request)
        }
    }

    // ── Coordinate validation ──────────────────────────────────────────────

    private fun isValidCoordinate(location: Location): Boolean {
        val lat = location.latitude
        val lng = location.longitude

        if (lat == 0.0 && lng == 0.0) return false
        if (lat < -90.0 || lat > 90.0) return false
        if (lng < -180.0 || lng > 180.0) return false
        if (lat.isNaN() || lat.isInfinite()) return false
        if (lng.isNaN() || lng.isInfinite()) return false
        if (location.accuracy > 1000) return false

        // Mock location check (skip in debug builds for emulator testing)
        if (!BuildConfig.DEBUG) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (location.isMock) return false
            } else {
                @Suppress("DEPRECATION")
                if (location.isFromMockProvider) return false
            }
        }

        return true
    }

    // ── Battery level ──────────────────────────────────────────────────────

    private fun getBatteryLevel(): String {
        return try {
            val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level != -1 && scale != -1) ((level * 100) / scale.toFloat()).toInt().toString() else "0"
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get battery level", e)
            "0"
        }
    }

    // ── Notification ───────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "SMAP 위치 추적 (활동 로그)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "'활동 로그' 및 '그룹 멤버와 실시간 위치 공유' 기능을 위해 백그라운드에서 위치를 수집합니다."
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(mode: PowerMode) =
        NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("SMAP 위치 공유 중")
            .setContentText(notificationText(mode))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

    private fun updateNotification(mode: PowerMode) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, createNotification(mode))
    }

    private fun notificationText(mode: PowerMode): String = when (mode) {
        PowerMode.STATIONARY -> "정지 중 (저전력 모드)"
        PowerMode.WALKING    -> "이동 중 (도보)"
        PowerMode.AUTOMOTIVE -> "이동 중 (차량)"
    }

    private fun persistPendingLocations() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val queueSnapshot = synchronized(pendingLocations) { pendingLocations.toList() }
        prefs.edit().putString(KEY_PENDING_QUEUE, json.encodeToString(queueSnapshot)).apply()
    }

    private fun restorePendingLocations() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PENDING_QUEUE, null) ?: return
        runCatching {
            json.decodeFromString<List<CreateLocationLogRequest>>(raw)
        }.onSuccess { restored ->
            synchronized(pendingLocations) {
                pendingLocations.clear()
                pendingLocations.addAll(restored.takeLast(maxQueueSize))
            }
        }.onFailure {
            Log.w(TAG, "Failed to restore pending queue", it)
        }
    }

    private fun persistLastLocation() {
        val location = lastLocation ?: return
        val request = buildLocationLogRequest(location) ?: return
        getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_LOCATION, json.encodeToString(request))
            .apply()
    }

    private fun restoreLastLocation() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_LAST_LOCATION, null) ?: return
        runCatching {
            json.decodeFromString<CreateLocationLogRequest>(raw)
        }.onSuccess { restored ->
            enqueueLocation(restored)
        }.onFailure {
            Log.w(TAG, "Failed to restore last location", it)
        }
        prefs.edit().remove(KEY_LAST_LOCATION).apply()
    }

    private fun scheduleRestart(reason: String) {
        if (!isUserLoggedIn(this) || !hasRequiredPermissions(this)) return
        val intent = Intent(this, LocationRestartReceiver::class.java).putExtra("restart_reason", reason)
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + RESTART_DELAY_MS,
            pendingIntent
        )
    }
}

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/AndroidManifest.xml" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- 🔥 에뮬레이터 네트워크 연결을 위한 기본 권한 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />
    
    <!-- 위치 정보 권한 -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    
    <!-- 위치 기능이 필요하지 않을 때를 위한 조건부 권한 -->
    <uses-feature android:name="android.hardware.location" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
    
    <!-- 포그라운드 서비스 권한 -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    
    <!-- 알림 권한 -->
    <uses-permission
        android:name="android.permission.POST_NOTIFICATIONS"
        android:minSdkVersion="33" />
    
    <!-- 저장소 권한 -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="28"/>
    
    <!-- 동작 인식 권한 -->
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
    
    <!-- 블루투스 권한 -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- 광고 ID 권한 -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />

    <!-- 백그라운드 푸시를 위한 Wake Lock 권한 -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <queries>
        <package android:name="com.kakao.talk" />
    </queries>

    <uses-feature android:name="android.hardware.camera" android:required="false"/>
    
    <!-- 기기 지원 범위 명시 -->
    <supports-screens
        android:smallScreens="true"
        android:normalScreens="true"
        android:largeScreens="true"
        android:xlargeScreens="true"
        android:anyDensity="true" />
    
    <uses-feature android:name="android.hardware.telephony" android:required="false" />
    <uses-feature android:name="android.hardware.wifi" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application
        android:name=".SmapApplication"
        android:allowBackup="false"
        android:fullBackupContent="false"
        tools:replace="android:allowBackup"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.SmapWebView"
        android:usesCleartextTraffic="false"
        android:enableOnBackInvokedCallback="true"
        android:networkSecurityConfig="@xml/network_security_config"
        android:hardwareAccelerated="true"
        android:largeHeap="true"
        tools:targetApi="tiramisu">
        
        <!-- 스플래시 화면 (앱 시작점) -->
        <activity
            android:name=".ui.splash.SplashActivity"
            android:exported="true"
            android:theme="@style/Theme.Smap.Splash">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- 네이티브 로그인 화면 -->
        <activity
            android:name=".ui.login.LoginActivity"
            android:exported="false"
            android:theme="@style/Theme.SmapWebView"
            android:windowSoftInputMode="adjustResize" />
        
        <!-- 네이티브 회원가입 화면 -->
        <activity
            android:name=".ui.register.RegisterActivity"
            android:exported="false"
            android:theme="@style/Theme.SmapWebView"
            android:windowSoftInputMode="adjustResize" />
        
        <!-- 메인 WebView 화면 (로그인 후 전환) -->
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboard|keyboardHidden|screenSize|screenLayout|smallestScreenSize"
            android:exported="true"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            <!-- SMAP 딥링크 처리 (smapapp://smap) -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:host="smap"
                    android:scheme="smapapp"/>
            </intent-filter>

            <!-- SMAP 딥링크 처리 (smap://group/{id}/join) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="smap" />
                <data android:host="group" />
            </intent-filter>
        </activity>

        <service android:name=".MyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <service android:name=".LocationService"
            android:exported="false"
            android:foregroundServiceType="location" />

        <receiver
            android:name=".LocationRestartReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>

        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="@string/admob_app_id"/>

        <meta-data
            android:name="com.naver.maps.map.NCP_KEY_ID"
            android:value="4e12mmctfk" />

        <!-- 🔥 Firebase 기본 알림 아이콘 설정 -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_stat_notification" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/brand_primary" />

        <!-- Kakao Login Redirect -->
        <activity
            android:name="com.kakao.sdk.auth.AuthCodeHandlerActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:host="oauth"
                    android:scheme="kakao56b34b5e5e538073805559cabc81e1d8" />
            </intent-filter>
        </activity>
        
    </application>

</manifest> 

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/LocationRestartReceiver.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class LocationRestartReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "LocationRestartReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: "manual_restart"
        Log.d(TAG, "Received restart trigger: $action")
        LocationService.startIfEligible(context, action)
    }
}

exec
/bin/zsh -lc "sed -n '1,200p' iOS/smap/Core/Location/LocationManager.swift" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
import Foundation
import CoreLocation
import UIKit

/// Adaptive location manager with 3-mode power switching
class LocationManager: NSObject, CLLocationManagerDelegate {

    static let shared = LocationManager()

    // MARK: - Public

    private(set) var currentMode: PowerMode = .walking
    var lastLocation: CLLocation?
    var locationAuthStatus: CLAuthorizationStatus?
    private(set) var savedMtIdx: String = ""

    // MARK: - Private

    private let clManager = CLLocationManager()
    private let motionManager = MotionManager()
    let uploader = LocationUploader()
    private var pendingAuthCompletion: (() -> Void)?

    // MARK: - Init

    override init() {
        super.init()
        clManager.delegate = self
        clManager.allowsBackgroundLocationUpdates = true
        clManager.pausesLocationUpdatesAutomatically = false
        clManager.showsBackgroundLocationIndicator = true

        // Motion detection -> mode switching
        motionManager.onModeChange = { [weak self] newMode in
            DispatchQueue.main.async {
                self?.switchToMode(newMode)
            }
        }

        NotificationCenter.default.addObserver(self, selector: #selector(appStateChange(_:)),
                                               name: NSNotification.Name("appStateChange"), object: nil)
    }

    // MARK: - Tracking Control

    private var isTracking = false

    func startTracking() {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = clManager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }

        guard status == .authorizedAlways || status == .authorizedWhenInUse else {
            print("[LocationManager] No location permission - cannot start tracking")
            return
        }

        guard !isTracking else {
            print("[LocationManager] Already tracking - skip")
            return
        }
        isTracking = true

        // Start motion detection
        motionManager.startMonitoring()

        // Apply walking mode config directly (avoid switchToMode guard for initial setup)
        currentMode = .walking
        clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        clManager.distanceFilter = 30
        clManager.activityType = .fitness
        Task { await uploader.startBatching(interval: 60) }

        clManager.startUpdatingLocation()
        print("[LocationManager] Tracking started in walking mode")

        // Warn if only whenInUse permission (stationary mode restricted)
        if status == .authorizedWhenInUse {
            print("[LocationManager] whenInUse only - Stationary mode restricted")
        }
    }

    func stopTracking() {
        isTracking = false
        clManager.stopUpdatingLocation()
        motionManager.stopMonitoring()
        Task {
            await uploader.stopBatching()
            await uploader.stopHeartbeat()
            await uploader.savePendingQueue()
        }
    }

    // MARK: - Mode Switching

    func switchToMode(_ newMode: PowerMode) {
        guard newMode != currentMode else { return }

        // Block stationary mode if only whenInUse permission
        if newMode == .stationary {
            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) { status = clManager.authorizationStatus }
            else { status = CLLocationManager.authorizationStatus() }
            if status != .authorizedAlways {
                print("[LocationManager] No Always permission - cannot enter Stationary mode")
                return
            }
        }

        let oldMode = currentMode
        currentMode = newMode
        print("[LocationManager] Mode switch: \(oldMode.rawValue) -> \(newMode.rawValue)")

        // Clean up previous timers and flush pending data on mode transition
        Task {
            await uploader.stopBatching()
            await uploader.stopHeartbeat()

            if !oldMode.rawValue.isEmpty {
                await uploader.flush()
            }
        }

        switch newMode {
        case .stationary:
            clManager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
            clManager.distanceFilter = CLLocationDistanceMax
            clManager.activityType = .other
            Task { await uploader.startHeartbeat(interval: 900) } // 15 min

        case .walking:
            clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
            clManager.distanceFilter = 30
            clManager.activityType = .fitness
            Task { await uploader.startBatching(interval: 60) } // 1 min

        case .automotive:
            clManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            clManager.distanceFilter = 150
            clManager.activityType = .automotiveNavigation
            Task { await uploader.startBatching(interval: 60) } // 1 min
        }
    }

    // MARK: - User Info (compatibility)

    func updateUserInfo(mtIdx: String, mtId: String, mtName: String) {
        self.savedMtIdx = mtIdx
        Task { await uploader.updateMtIdx(mtIdx) }
        print("[LocationManager] User info updated: \(mtIdx)")

        // If we have a cached location, send it immediately
        if let loc = lastLocation, loc.coordinate.latitude != 0 {
            enqueueLocation(loc)
            Task { await uploader.flush() }
        }
    }

    func clearUserInfo() {
        savedMtIdx = ""
        Task { await uploader.updateMtIdx("") }
        print("[LocationManager] User info cleared")
    }

    // MARK: - Permission (compatibility)

    func requestWhenInUseAuthorization(completion: (() -> Void)? = nil) {
        DispatchQueue.main.async {
            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) { status = self.clManager.authorizationStatus }
            else { status = CLLocationManager.authorizationStatus() }

            if status == .notDetermined {
                self.pendingAuthCompletion = completion
                self.clManager.requestWhenInUseAuthorization()
            } else {
                completion?()
            }
        }
    }

    func checkLocationPermissionStatus(completion: @escaping (Bool) -> Void) {
        let isAuthorized = locationAuthStatus == .authorizedAlways || locationAuthStatus == .authorizedWhenInUse
        completion(isAuthorized)
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        // Validate location
        guard isValidLocation(location) else { return }

        lastLocation = location
        enqueueLocation(location)
    }

exec
/bin/zsh -lc "sed -n '200,400p' iOS/smap/Core/Location/LocationManager.swift" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationManager] Location error: \(error.localizedDescription)")
    }

    @available(iOS 14.0, *)
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthChange(manager.authorizationStatus)
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        handleAuthChange(status)
    }

    // MARK: - Private

    private func handleAuthChange(_ status: CLAuthorizationStatus) {
        locationAuthStatus = status
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            startTracking()
            pendingAuthCompletion?()
            pendingAuthCompletion = nil
        }
    }

    private func enqueueLocation(_ location: CLLocation) {
        guard !savedMtIdx.isEmpty else {
            print("[LocationManager] enqueue 스킵 - savedMtIdx 비어있음")
            return
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"

        UIDevice.current.isBatteryMonitoringEnabled = true
        let battery = Int(UIDevice.current.batteryLevel * 100)

        Task {
            let steps = await uploader.getCurrentStepCount()
            let data = LocationData(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy,
                speed: max(0, location.speed),
                altitude: location.altitude,
                timestamp: formatter.string(from: location.timestamp),
                battery: battery,
                steps: steps
            )
            await uploader.enqueue(data)
        }
    }

    private func isValidLocation(_ location: CLLocation) -> Bool {
        let c = location.coordinate
        if c.latitude == 0.0 && c.longitude == 0.0 { return false }
        if c.latitude < -90 || c.latitude > 90 { return false }
        if c.longitude < -180 || c.longitude > 180 { return false }
        if location.horizontalAccuracy > 500 { return false }
        if abs(location.timestamp.timeIntervalSinceNow) > 300 { return false }
        return true
    }

    @objc private func appStateChange(_ notification: Notification) {
        let state = notification.userInfo?["state"] as? String
        if state == "foreground" {
            // Flush pending data on foreground return
            Task { await uploader.flush() }
        }
    }
}

exec
/bin/zsh -lc "sed -n '1,200p' iOS/smap/Core/Location/LocationUploader.swift" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
import Foundation
import UIKit
import CoreMotion

/// 위치 데이터 모델
struct LocationData: Codable {
    let lat: Double
    let lng: Double
    let accuracy: Double
    let speed: Double
    let altitude: Double
    let timestamp: String
    let battery: Int
    let steps: Int
}

/// 위치 데이터 배칭 및 서버 전송 (actor for thread safety)
actor LocationUploader {

    private let apiClient: APIClient
    private var mtIdx: String
    private var pending: [LocationData] = []
    private let maxQueueSize = 100
    private var lastHeartbeatLocation: LocationData?
    private let pedometer = CMPedometer()

    private var batchTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?

    var pendingCount: Int { pending.count }

    init(apiClient: APIClient = .shared, mtIdx: String = "") {
        self.apiClient = apiClient
        self.mtIdx = mtIdx
        self.pending = Self.loadPersistedQueue()
    }

    func updateMtIdx(_ idx: String) {
        self.mtIdx = idx
    }

    // MARK: - Queue

    func enqueue(_ location: LocationData) {
        pending.append(location)
        lastHeartbeatLocation = location
        if pending.count > maxQueueSize {
            pending.removeFirst(pending.count - maxQueueSize)
        }
        print("[LocationUploader] 위치 enqueue (pending: \(pending.count), mtIdx: \(mtIdx))")
    }

    // MARK: - Batching (이동 중)

    func startBatching(interval: TimeInterval) {
        stopBatching()
        batchTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                guard !Task.isCancelled else { break }
                await self?.flush()
            }
        }
    }

    func stopBatching() {
        batchTask?.cancel()
        batchTask = nil
    }

    // MARK: - Heartbeat (정지 중)

    func startHeartbeat(interval: TimeInterval) {
        stopHeartbeat()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                guard !Task.isCancelled else { break }
                await self?.sendHeartbeat()
            }
        }
    }

    func stopHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = nil
    }

    // MARK: - Send

    func flush() async {
        guard !pending.isEmpty, !mtIdx.isEmpty else {
            if pending.isEmpty { print("[LocationUploader] flush 스킵 - pending 비어있음") }
            if mtIdx.isEmpty { print("[LocationUploader] flush 스킵 - mtIdx 비어있음") }
            return
        }
        print("[LocationUploader] flush 시작 - \(pending.count)건 전송 (mtIdx: \(mtIdx))")

        let toSend = pending
        for location in toSend {
            let success = await sendSingle(location)
            if success {
                pending.removeAll { $0.timestamp == location.timestamp && $0.lat == location.lat }
            }
        }

        // Persist immediately after flush to prevent replay on restart
        persistQueue()
    }

    private func sendHeartbeat() async {
        guard let location = lastHeartbeatLocation, !mtIdx.isEmpty else { return }
        let _ = await sendSingle(location)
    }

    private func sendSingle(_ location: LocationData) async -> Bool {
        let params: [String: Any] = [
            "act": "create_location_log",
            "mt_idx": mtIdx,
            "mlt_lat": location.lat,
            "mlt_long": location.lng,
            "mlt_accuracy": location.accuracy,
            "mlt_speed": location.speed,
            "mlt_altitude": location.altitude,
            "mlt_timestamp": location.timestamp,
            "mlt_battery": String(location.battery),
            "mlt_fine_location": "N",
            "mlt_location_chk": "N",
            "mt_health_work": String(location.steps),
            "source": "ios-app"
        ]

        do {
            let (_, response) = try await apiClient.requestRaw(
                .createLocationLog(params: params),
                token: KeychainManager.shared.getToken()
            )
            print("✅ [LocationUploader] 전송 성공 (status: \(response.statusCode))")
            return true
        } catch {
            print("❌ [LocationUploader] 전송 실패: \(error)")
            return false
        }
    }

    // MARK: - Persistence

    func savePendingQueue() {
        persistQueue()
    }

    private func persistQueue() {
        if pending.isEmpty {
            UserDefaults.standard.removeObject(forKey: "smap_pending_locations")
        } else if let data = try? JSONEncoder().encode(pending) {
            UserDefaults.standard.set(data, forKey: "smap_pending_locations")
        }
    }

    private static func loadPersistedQueue() -> [LocationData] {
        guard let data = UserDefaults.standard.data(forKey: "smap_pending_locations"),
              let saved = try? JSONDecoder().decode([LocationData].self, from: data) else {
            return []
        }
        return saved
    }

    // MARK: - Step Count Helper

    func getCurrentStepCount() async -> Int {
        guard CMPedometer.isStepCountingAvailable() else { return 0 }
        let startOfDay = Calendar.current.startOfDay(for: Date())
        return await withCheckedContinuation { continuation in
            pedometer.queryPedometerData(from: startOfDay, to: Date()) { data, _ in
                continuation.resume(returning: data.map { Int(truncating: $0.numberOfSteps) } ?? 0)
            }
        }
    }
}

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.data.api

import com.dmonster.smap.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

/**
 * Single Retrofit interface for all SMAP backend API endpoints.
 * Base URL: Configured via BuildConfig.API_BASE_URL
 *
 * Note: KakaoLocationService uses a different base URL and auth header,
 * so it is NOT included here.
 */
interface SmapApi {

    // =========================================================================
    // Auth endpoints (from AuthService)
    // =========================================================================

    /** POST /auth/login */
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    /** POST /auth/google-login */
    @POST("auth/google-login")
    suspend fun googleLogin(@Body request: GoogleLoginRequest): SocialLoginResponse

    /** POST /auth/kakao-login */
    @POST("auth/kakao-login")
    suspend fun kakaoLogin(@Body request: KakaoLoginRequest): SocialLoginResponse

    // =========================================================================
    // Member / Profile endpoints (from AuthService)
    // =========================================================================

    /** GET /members/me */
    @GET("members/me")
    suspend fun getUserProfile(): ApiResponse<SMAPUser>

    /** POST /members/update-profile */
    @POST("members/update-profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): ApiResponse<Unit>

    /** POST /members/change-password */
    @POST("members/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): ChangePasswordResponse

    /** POST /members/verify-password */
    @POST("members/verify-password")
    suspend fun verifyPassword(@Body request: VerifyPasswordRequest): VerifyPasswordResponse

    /** POST /members/withdraw */
    @POST("members/withdraw")
    suspend fun withdraw(@Body request: WithdrawRequest): WithdrawResponse

    /** POST /members/upload-profile-image (multipart) */
    @Multipart
    @POST("members/upload-profile-image")
    suspend fun uploadProfileImage(
        @Part file: MultipartBody.Part
    ): ProfileImageUploadResponse

    // =========================================================================
    // Notices (from AuthService)
    // =========================================================================

    /** GET /notices/?page={page}&size={size}&show_only=true */
    @GET("notices/")
    suspend fun getNotices(
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
        @Query("show_only") showOnly: Boolean = true
    ): SmapNoticeListWithPagination

    // =========================================================================
    // Registration endpoints (from RegisterModels -- inferred from standard patterns)
    // =========================================================================

    /** POST /auth/register */
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): RegisterResponse

    /** POST /sms/send-verification-code */
    @POST("sms/send-verification-code")
    suspend fun sendSmsVerification(@Body request: SmsVerificationRequest): SmsVerificationResponse

    /** POST /sms/verify-code */
    @POST("sms/verify-code")
    suspend fun verifySmsCode(@Body request: VerifySmsCodeRequest): SmsVerificationResponse

    /** GET /members/check/phone/{phoneNumber} */
    @GET("members/check/phone/{phoneNumber}")
    suspend fun checkPhone(@Path("phoneNumber") phoneNumber: String): PhoneCheckResponse

    // =========================================================================
    // Group endpoints (from GroupService / HomeService)
    // =========================================================================

    /** GET /groups/current-user */
    @GET("groups/current-user")
    suspend fun getCurrentUserGroups(): List<SmapGroup>

    /** GET /groups/{groupId}/stats */
    @GET("groups/{groupId}/stats")
    suspend fun getGroupStats(@Path("groupId") groupId: Int): GroupStats

    /** POST /groups */
    @POST("groups")
    suspend fun createGroup(@Body body: CreateGroupRequest): SmapGroup

    /** PUT /groups/{groupId} */
    @PUT("groups/{groupId}")
    suspend fun updateGroup(
        @Path("groupId") groupId: Int,
        @Body body: UpdateGroupRequest
    ): SmapGroup

    /** PUT /groups/{groupId} (soft-delete via sgt_show=N) */
    @PUT("groups/{groupId}")
    suspend fun deleteGroup(
        @Path("groupId") groupId: Int,
        @Body body: DeleteGroupRequest
    ): SmapGroup

    /** POST /groups/join (from GroupService.joinGroupByCode) */
    @POST("groups/join")
    suspend fun joinGroupByCode(@Body body: JoinGroupByCodeRequest): SmapGroup

    /** GET /groups/code/{code} (from HomeService.joinGroup step 1) */
    @GET("groups/code/{code}")
    suspend fun getGroupByCode(@Path("code") code: String): SmapGroup

    /** POST /groups/{groupId}/join (from HomeService.joinGroup step 2) */
    @POST("groups/{groupId}/join")
    suspend fun joinGroup(
        @Path("groupId") groupId: Int,
        @Body body: JoinGroupRequest
    ): SmapGroup

    // =========================================================================
    // Group Member endpoints (from GroupService / HomeService)
    // =========================================================================

    /** GET /group-members/member/{groupId} */
    @GET("group-members/member/{groupId}")
    suspend fun getGroupMembers(@Path("groupId") groupId: Int): List<SmapGroupMember>

    /** PUT /group-members/{groupId}/role */
    @PUT("group-members/{groupId}/role")
    suspend fun updateMemberRole(
        @Path("groupId") groupId: Int,
        @Body body: UpdateMemberRoleRequest
    ): Unit

    /** DELETE /group-members/{groupId}/member/{memberId} */
    @DELETE("group-members/{groupId}/member/{memberId}")
    suspend fun removeMember(
        @Path("groupId") groupId: Int,
        @Path("memberId") memberId: Int
    ): Unit

    // =========================================================================
    // Schedule endpoints (from ScheduleService / HomeService)
    // =========================================================================

    /** GET /schedules/group/{groupId}?days={days} */
    @GET("schedules/group/{groupId}")
    suspend fun getGroupSchedules(
        @Path("groupId") groupId: Int,
        @Query("days") days: Int = 14
    ): List<SmapSchedule>

    /** GET /schedules/{scheduleId} */
    @GET("schedules/{scheduleId}")
    suspend fun getScheduleDetail(@Path("scheduleId") scheduleId: String): SmapSchedule

    /** POST /schedules */
    @POST("schedules")
    suspend fun createSchedule(@Body body: CreateScheduleRequest): SmapSchedule

    /** PUT /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id={currentUserId} */
    @PUT("schedule/group/{groupId}/schedules/{scheduleId}")
    suspend fun updateSchedule(
        @Path("groupId") groupId: Int,
        @Path("scheduleId") scheduleId: String,
        @Query("current_user_id") currentUserId: String,
        @Body body: UpdateScheduleRequest
    ): SmapSchedule

    /** DELETE /schedule/group/{groupId}/schedules/{scheduleId}?current_user_id={currentUserId} */
    @HTTP(method = "DELETE", path = "schedule/group/{groupId}/schedules/{scheduleId}", hasBody = true)
    suspend fun deleteSchedule(
        @Path("groupId") groupId: Int,
        @Path("scheduleId") scheduleId: String,
        @Query("current_user_id") currentUserId: String,
        @Body body: DeleteScheduleRequest
    ): Unit

    // =========================================================================
    // MyPlace / Location endpoints (from MyPlaceService)

exec
/bin/zsh -lc 'rg -n "createLocationLog" -n Android/app/src/main/java/com/dmonster/smap' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
Android/app/src/main/java/com/dmonster/smap/LocationService.kt:474:            val response = smapApi.createLocationLog(request)
Android/app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt:244:    suspend fun createLocationLog(@Body request: CreateLocationLogRequest): retrofit2.Response<Unit>

exec
/bin/zsh -lc "sed -n '220,280p' Android/app/src/main/java/com/dmonster/smap/data/api/SmapApi.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
    suspend fun deleteLocation(@Path("locationId") locationId: Int): Unit

    // =========================================================================
    // Notification / Push Log endpoints (from NotificationService)
    // =========================================================================

    /** GET /push-logs/member/{memberId} */
    @GET("push-logs/member/{memberId}")
    suspend fun getMemberPushLogs(@Path("memberId") memberId: Int): List<PushLog>

    /** POST /push-logs/read-all?mt_idx={memberId} */
    @POST("push-logs/read-all")
    suspend fun markAllPushLogsAsRead(@Query("mt_idx") memberId: Int): Unit

    /** POST /push-logs/delete-all?mt_idx={memberId} */
    @POST("push-logs/delete-all")
    suspend fun deleteAllPushLogs(@Query("mt_idx") memberId: Int): Unit

    // =========================================================================
    // Activity Log endpoints (from ActivityLogService)
    // =========================================================================

    /** POST /logs/member-location-logs  (create a new location log entry) */
    @POST("logs/member-location-logs")
    suspend fun createLocationLog(@Body request: CreateLocationLogRequest): retrofit2.Response<Unit>

    /** GET /logs/member-location-logs/{memberId}/map-markers?date={date} */
    @GET("logs/member-location-logs/{memberId}/map-markers")
    suspend fun getLocationLogs(
        @Path("memberId") memberId: Int,
        @Query("date") date: String,
        @Query("min_speed") minSpeed: Double = 1.0,
        @Query("max_accuracy") maxAccuracy: Double = 50.0
    ): retrofit2.Response<okhttp3.ResponseBody>

    /** GET /logs/member-location-logs/{memberId}/summary?date={date} */
    @GET("logs/member-location-logs/{memberId}/summary")
    suspend fun getLocationSummary(
        @Path("memberId") memberId: Int,
        @Query("date") date: String
    ): LocationSummaryResponse

    /** GET /logs/member-location-logs/{memberId}/stay-times?date={date}&min_speed=...&max_accuracy=...&min_duration=... */
    @GET("logs/member-location-logs/{memberId}/stay-times")
    suspend fun getStayTimes(
        @Path("memberId") memberId: Int,
        @Query("date") date: String,
        @Query("min_speed") minSpeed: Double = 1.0,
        @Query("max_accuracy") maxAccuracy: Double = 50.0,
        @Query("min_duration") minDuration: Int = 5
    ): StayTimeListResponse

    /** GET /logs/daily-counts?group_id={groupId}&days={days} */
    @GET("logs/daily-counts")
    suspend fun getDailyCountsForGroup(
        @Query("group_id") groupId: Int,
        @Query("days") days: Int = 14
    ): GroupDailyCountsResponse

    // =========================================================================
    // Chat endpoints

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/di/NetworkModule.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.di

import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.api.AuthInterceptor
import com.dmonster.smap.data.api.SmapApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                        else HttpLoggingInterceptor.Level.NONE
            })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    fun provideSmapApi(retrofit: Retrofit): SmapApi {
        return retrofit.create(SmapApi::class.java)
    }
}

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/data/service/AuthService.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.data.service

import android.content.SharedPreferences
import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Authentication / user-profile service.
 * Network calls delegate to SmapApi; local token/user state uses SharedPreferences.
 */
class AuthService(
    private val api: SmapApi,
    private val prefs: SharedPreferences
) {

    companion object {
        private const val TAG = "AuthService"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_DATA = "user_data"
        private const val KEY_MT_IDX = "mt_idx"
    }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    // =========================================================================
    // Login state
    // =========================================================================

    val isLoggedIn: Boolean
        get() {
            val token = getToken()
            val userData = getUserData()
            val loggedIn = !token.isNullOrBlank() && userData != null
            Log.d(TAG, "isLoggedIn=$loggedIn")
            return loggedIn
        }

    // =========================================================================
    // Token management
    // =========================================================================

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).commit()
        Log.d(TAG, "Token saved: ${token.take(10)}...")
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    // =========================================================================
    // User data management
    // =========================================================================

    fun saveUserData(user: SMAPUser) {
        val userJson = json.encodeToString(user)
        prefs.edit().putString(KEY_USER_DATA, userJson).commit()
        prefs.edit().putInt(KEY_MT_IDX, user.mtIdx ?: 0).commit()
        Log.d(TAG, "User data saved: ${user.mtNickname}")
    }

    fun getUserData(): SMAPUser? {
        val userJson = prefs.getString(KEY_USER_DATA, null) ?: return null
        return try {
            json.decodeFromString<SMAPUser>(userJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse user data", e)
            null
        }
    }

    fun getMtIdx(): Int = prefs.getInt(KEY_MT_IDX, 0)

    // =========================================================================
    // Logout
    // =========================================================================

    fun logout() {
        prefs.edit().clear().apply()
        Log.d(TAG, "Logged out - all data cleared")
    }

    // =========================================================================
    // Network calls (delegated to SmapApi)
    // =========================================================================

    /**
     * POST /auth/login
     */
    suspend fun login(phoneNumber: String, password: String): LoginResponse {
        val cleanPhone = phoneNumber.replace("-", "")

        val request = LoginRequest(
            mtId = cleanPhone,
            mtPwd = password,
            osType = "android"
        )

        return try {
            val loginResponse = api.login(request)

            if (loginResponse.success) {
                Log.d(TAG, "[Login] Success")
                loginResponse.data?.token?.let { saveToken(it) }
                loginResponse.data?.user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            LoginResponse(success = false, message = "Network error: ${e.message}", data = null)
        }
    }

    /**
     * POST /auth/google-login
     */
    suspend fun googleLogin(
        idToken: String,
        email: String?,
        name: String?,
        googleId: String?
    ): SocialLoginResponse {
        val request = GoogleLoginRequest(
            googleId = googleId,
            email = email,
            name = name,
            idToken = idToken
        )

        return try {
            val loginResponse = api.googleLogin(request)

            if (loginResponse.success == true) {
                Log.d(TAG, "[Social Login] Google success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                token?.let { saveToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Google login failed", e)
            SocialLoginResponse(
                success = false,
                message = "Network error: ${e.message}",
                error = e.message
            )
        }
    }

    /**
     * POST /auth/kakao-login
     */
    suspend fun kakaoLogin(
        accessToken: String,
        email: String?,
        nickname: String?,
        kakaoId: String?,
        profileImage: String? = null
    ): SocialLoginResponse {
        val request = KakaoLoginRequest(
            kakaoId = kakaoId ?: "",
            email = email,
            nickname = nickname ?: "",
            accessToken = accessToken,
            profileImage = profileImage
        )

        return try {
            val loginResponse = api.kakaoLogin(request)

            if (loginResponse.success == true) {
                Log.d(TAG, "[Social Login] Kakao success")
                val token = loginResponse.token ?: loginResponse.data?.token
                val user = loginResponse.user ?: loginResponse.data?.user
                token?.let { saveToken(it) }
                user?.let { saveUserData(it) }
            }

            loginResponse
        } catch (e: Exception) {
            Log.e(TAG, "Kakao login failed", e)
            SocialLoginResponse(
                success = false,
                message = "Network error: ${e.message}",
                error = e.message
            )
        }

exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.data.api

import android.content.SharedPreferences
import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val prefs: SharedPreferences
) : Interceptor {
    companion object {
        private const val TAG = "AuthInterceptor"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = prefs.getString("auth_token", null)
        val request = chain.request().newBuilder().apply {
            token?.let { addHeader("Authorization", "Bearer $it") }
        }.build()

        val response = chain.proceed(request)

        if (response.code == 401) {
            Log.w(TAG, "401 Unauthorized - clearing auth token")
            prefs.edit().remove("auth_token").apply()
        }

        return response
    }
}

exec
/bin/zsh -lc 'cat Android/app/src/main/res/xml/network_security_config.xml' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- 🔥 개발 환경에서만 cleartext 허용 (프로덕션에서는 제한적 사용) -->
    <domain-config cleartextTrafficPermitted="false">
        <!-- 운영 서버 -->
        <domain includeSubdomains="true">nextstep.aiagnt.kr</domain>
        <domain includeSubdomains="true">api3.aiagnt.kr</domain>
        <domain includeSubdomains="true">aiagnt.kr</domain>
        
        <!-- Vercel 관련 -->
        <domain includeSubdomains="true">vercel-dns-017.com</domain>
        <domain includeSubdomains="true">vercel.app</domain>
        <domain includeSubdomains="true">vercel.com</domain>
        <domain includeSubdomains="true">smap-team.vercel.app</domain>
        <domain includeSubdomains="true">smap-next.vercel.app</domain>
        
        <!-- 🔥 로컬 네트워크 범위 (개발자 PC IP)는 아래 cleartextTrafficPermitted=true 섹션으로 이동됨 -->
        
        <!-- 외부 서비스 -->
        <domain includeSubdomains="true">map.naver.com</domain>
        <domain includeSubdomains="true">map.naver.net</domain>
        <!-- 네이버 지도 JS SDK 및 오픈 API -->
        <domain includeSubdomains="true">oapi.map.naver.com</domain>
        <domain includeSubdomains="true">openapi.map.naver.com</domain>
        
        <!-- 🔥 IP 주소 직접 접근 (DNS 문제 우회) -->
        <!-- IP 직접 접근은 SSL 핀/호스트네임 검증 문제 유발 가능하므로 제거 -->

        <!-- 🔥 Google 서비스 (에뮬레이터에서 문제 발생 시) -->
        <domain includeSubdomains="true">googleapis.com</domain>
        <domain includeSubdomains="true">google.com</domain>
        <domain includeSubdomains="true">gstatic.com</domain>
        <domain includeSubdomains="true">googleusercontent.com</domain>
    </domain-config>
    
    <!-- 개발 환경용 설정 - 디버그 빌드에서만 cleartext 허용 -->
    <debug-overrides cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </debug-overrides>
    
    <!-- 개발 환경에서만 필요한 도메인들에 대해 cleartext 허용 -->
    <domain-config cleartextTrafficPermitted="true">
        <!-- 로컬 개발 환경 -->
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">0.0.0.0</domain>
        
        <!-- 로컬 네트워크 범위 (개발자 PC IP) -->
        <domain includeSubdomains="true">192.168.0.0</domain>
        <domain includeSubdomains="true">192.168.1.0</domain>
        <domain includeSubdomains="true">192.168.1.100</domain>
        <domain includeSubdomains="true">192.168.100.0</domain>
        <domain includeSubdomains="true">10.0.0.0</domain>
        <domain includeSubdomains="true">172.16.0.0</domain>
    </domain-config>
    
    <!-- 기본 설정 -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config> 
exec
/bin/zsh -lc "sed -n '1,200p' backend/app/api/location.py" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
# DEPRECATED: 이 파일은 더 이상 사용되지 않습니다.
# 활성 엔드포인트는 app/api/v1/endpoints/locations.py에 있습니다.
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import location as location_model
from app.models import member as member_model
from app.schemas import location as location_schema
from datetime import datetime
import traceback

router = APIRouter()

def map_location_data(data: dict) -> dict:
    """클라이언트 데이터를 Location 모델 형식으로 변환"""
    mapping = {
        'id': 'slt_idx',
        'name': 'slt_title',
        'address': 'slt_add',
        'notifications': 'slt_enter_alarm',
        'favorite': 'slt_show'
    }
    
    mapped_data = {}
    for client_key, model_key in mapping.items():
        if client_key in data:
            mapped_data[model_key] = data[client_key]
    
    # coordinates 처리
    if 'coordinates' in data:
        mapped_data['slt_long'] = data['coordinates'][0]
        mapped_data['slt_lat'] = data['coordinates'][1]
    
    return mapped_data

@router.post("/api/location")
async def location_handler(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        act = data.get("act")
        print(f"[API CALL] /api/location act={act} data={data}")
        
        if act == "my_location_list":
            try:
                locations = db.query(location_model.Location).all()
                return {"result": "Y", "data": [{
                    "id": str(loc.slt_idx),
                    "name": loc.slt_title,
                    "address": loc.slt_add,
                    "coordinates": [float(loc.slt_long), float(loc.slt_lat)],
                    "notifications": loc.slt_enter_alarm == 'Y',
                    "favorite": loc.slt_show == 'Y'
                } for loc in locations]}
            except Exception as e:
                print(f"Error in my_location_list: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_add":
            try:
                new_location = location_model.Location(
                    slt_title=data.get("name"),
                    slt_add=data.get("address"),
                    slt_long=str(data.get("coordinates")[0]),
                    slt_lat=str(data.get("coordinates")[1]),
                    slt_enter_alarm='Y' if data.get("notifications") else 'N',
                    slt_show='Y' if data.get("favorite") else 'N'
                )
                db.add(new_location)
                db.commit()
                db.refresh(new_location)
                return {"result": "Y", "data": {"id": str(new_location.slt_idx)}}
            except Exception as e:
                db.rollback()
                print(f"Error in location_add: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_update":
            try:
                location = db.query(location_model.Location).filter(location_model.Location.slt_idx == data.get("id")).first()
                if location:
                    location.slt_title = data.get("name")
                    location.slt_add = data.get("address")
                    location.slt_long = str(data.get("coordinates")[0])
                    location.slt_lat = str(data.get("coordinates")[1])
                    location.slt_enter_alarm = 'Y' if data.get("notifications") else 'N'
                    location.slt_show = 'Y' if data.get("favorite") else 'N'
                    db.commit()
                    return {"result": "Y"}
                return {"result": "E", "error": "Location not found"}
            except Exception as e:
                db.rollback()
                print(f"Error in location_update: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_delete":
            try:
                location = db.query(location_model.Location).filter(location_model.Location.slt_idx == data.get("id")).first()
                if location:
                    db.delete(location)
                    db.commit()
                    return {"result": "Y"}
                return {"result": "E", "error": "Location not found"}
            except Exception as e:
                db.rollback()
                print(f"Error in location_delete: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "group_member_list":
            try:
                members = db.query(member_model.Member).all()
                return {"result": "Y", "data": [{
                    "id": str(member.mem_idx),
                    "name": member.mem_name,
                    "profile": member.mem_profile,
                    "isSelected": False,
                    "photo": member.mem_photo,
                    "location": [float(member.mem_long), float(member.mem_lat)] if member.mem_long and member.mem_lat else None,
                    "schedules": [],
                    "savedLocations": []
                } for member in members]}
            except Exception as e:
                print(f"Error in group_member_list: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        return {"result": "E", "error": "Invalid action"}
    except Exception as e:
        print(f"Error in location_handler: {str(e)}")
        traceback.print_exc()
        return {"result": "E", "error": str(e)} 
exec
/bin/zsh -lc "sed -n '1,200p' backend/app/api/v1/endpoints/locations.py" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter()

@router.get("/", response_model=List[LocationResponse])
def get_locations(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    위치 목록을 조회합니다.
    """
    locations = db.query(Location.__table__).offset(skip).limit(limit).all()
    return locations

@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 위치를 조회합니다.
    """
    location = db.query(Location).filter(Location.slt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@router.get("/member/{member_id}", response_model=List[LocationResponse])
def get_member_locations(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_member(db, member_id)
    return locations

@router.get("/group-detail/{group_detail_id}", response_model=List[LocationResponse])
def get_group_detail_locations(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹 상세의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_group_detail(db, group_detail_id)
    return locations

@router.get("/myplays/in", response_model=List[LocationResponse])
def get_in_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 내부 위치 목록을 조회합니다.
    """
    locations = Location.get_in_myplays_list(db)
    return locations

@router.get("/myplays/out", response_model=List[LocationResponse])
def get_out_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 외부 위치 목록을 조회합니다.
    """
    locations = Location.get_out_myplays_list(db)
    return locations

@router.post("/")
def create_location(
    location_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 위치를 생성합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        import logging
        
        # 디버그 로깅
        logging.info(f"Received location data: {location_data}")
        
        # 필수 필드 검증
        required_fields = ['slt_title', 'slt_add']
        for field in required_fields:
            if field not in location_data or not location_data[field]:
                raise HTTPException(status_code=400, detail=f"Missing or empty required field: {field}")
        
        # 좌표 검증 및 기본값 설정
        slt_lat = location_data.get('slt_lat', 37.5665)
        slt_long = location_data.get('slt_long', 126.9780)
        
        # 숫자로 변환
        try:
            slt_lat = float(slt_lat)
            slt_long = float(slt_long)
        except (ValueError, TypeError):
            slt_lat = 37.5665
            slt_long = 126.9780
        
        # 현재 시간
        current_time = datetime.now()
        
        # 기존 DB 스키마에 맞는 간단한 INSERT
        sql = text("""
            INSERT INTO smap_location_t (
                mt_idx, slt_title, slt_add, slt_lat, slt_long, 
                slt_show, slt_enter_alarm, slt_enter_chk, slt_wdate
            ) VALUES (
                :mt_idx, :slt_title, :slt_add, :slt_lat, :slt_long,
                :slt_show, :slt_enter_alarm, :slt_enter_chk, :slt_wdate
            )
        """)
        
        params = {
            "mt_idx": location_data.get('mt_idx', 282),
            "slt_title": str(location_data['slt_title'])[:100],  # 길이 제한
            "slt_add": str(location_data['slt_add'])[:200],  # 길이 제한
            "slt_lat": slt_lat,
            "slt_long": slt_long,
            "slt_show": location_data.get('slt_show', 'Y'),
            "slt_enter_alarm": location_data.get('slt_enter_alarm', 'Y'),
            "slt_enter_chk": location_data.get('slt_enter_chk', 'N'),
            "slt_wdate": current_time
        }
        
        logging.info(f"SQL parameters: {params}")
        
        # SQL 실행
        result = db.execute(sql, params)
        db.commit()
        
        # 생성된 레코드 ID 가져오기 (MySQL/MariaDB 기준)
        if hasattr(result, 'lastrowid'):
            new_id = result.lastrowid
        else:
            # lastrowid가 없는 경우 직접 조회
            new_id_result = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()
            new_id = new_id_result[0] if new_id_result else None
        
        return {
            "success": True,
            "message": "Location created successfully",
            "slt_idx": new_id,
            "data": {
                "slt_idx": new_id,
                "slt_title": params["slt_title"],
                "slt_add": params["slt_add"],
                "slt_lat": params["slt_lat"],
                "slt_long": params["slt_long"],
                "slt_show": params["slt_show"],
                "slt_enter_alarm": params["slt_enter_alarm"],
                "slt_enter_chk": params["slt_enter_chk"],
                "slt_wdate": current_time.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logging.error(f"Location creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Location creation failed: {str(e)}")

@router.put("/{location_id}/notification")
def update_location_notification(
    location_id: int,
    notification_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    위치의 알림 설정을 업데이트합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        
        # 알림 설정 업데이트를 위한 SQL
        if 'slt_enter_alarm' not in notification_data:
            raise HTTPException(status_code=400, detail="slt_enter_alarm field is required")
        
        alarm_value = notification_data['slt_enter_alarm']
        if alarm_value not in ['Y', 'N']:
            raise HTTPException(status_code=400, detail="slt_enter_alarm must be 'Y' or 'N'")
        
        # 직접 SQL 업데이트 실행
        sql = text("""
            UPDATE smap_location_t 
            SET slt_enter_alarm = :alarm_value, slt_udate = :update_time 
            WHERE slt_idx = :location_id

exec
/bin/zsh -lc 'rg -n "create_location_log" -n backend/app -g"*.py"' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
backend/app/api/v1/endpoints/member_location_log.py:131:        elif act == "create_location_log":
backend/app/api/v1/endpoints/member_location_log.py:157:                                "act": "create_location_log",  # 내부 검증용
backend/app/api/v1/endpoints/member_location_log.py:173:                            result = location_log_crud.create_location_log(db, log_data)
backend/app/api/v1/endpoints/member_location_log.py:196:                result = location_log_crud.create_location_log(db, log_data)
backend/app/api/v1/endpoints/member_location_log.py:447:        # elif act == "create_location_log":
backend/app/api/v1/endpoints/member_location_log.py:450:        #         logger.info("=== create_location_log 액션 실행 ===")
backend/app/api/v1/endpoints/member_location_log.py:455:        #             logger.error("mt_idx is required for create_location_log")
backend/app/crud/member_location_log.py:51:def create_location_log(db: Session, log_data: MemberLocationLogCreate) -> MemberLocationLog:

exec
/bin/zsh -lc "sed -n '1,220p' backend/app/api/v1/endpoints/member_location_log.py" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from ....db.session import get_db
from ....schemas.member_location_log import (
    MemberLocationLogCreate, 
    MemberLocationLogUpdate, 
    MemberLocationLogResponse,
    LocationLogListRequest,
    LocationSummaryResponse,
    LocationPathResponse,
    DailySummary,
    StayTime,
    MapMarker,
    LocationLogSummaryResponse
)
from ....crud import member_location_log as location_log_crud
from ....core.config import settings
import jwt

router = APIRouter()
logger = logging.getLogger(__name__)

def _extract_token_from_header(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def _get_mt_idx_from_token(request: Request) -> Tuple[Optional[int], Optional[str]]:
    """Return (mt_idx, error_message). error_message is None when ok."""
    token = _extract_token_from_header(request)
    if not token:
        return None, "Authorization 헤더가 필요합니다 (Bearer 토큰)."
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        # mt_idx 먼저 확인, 없으면 sub 확인 (하위 호환)
        mt_idx = payload.get("mt_idx") or payload.get("sub")
        if not mt_idx:
            return None, "토큰에 mt_idx가 없습니다."
        return int(mt_idx), None
    except Exception as e:
        return None, f"토큰 검증 실패: {str(e)}"

@router.post("/member-location-logs")
async def handle_location_log_request(
    request: Request,
    db: Session = Depends(get_db)
):
    """위치 로그 관련 요청 처리"""
    # print("==== FastAPI /api/v1/member-location-logs 진입 ====")
    try:
        body = await request.json()
        act = body.get("act")
        
        if not act:
            logger.error("No 'act' parameter provided in request")
            raise HTTPException(status_code=400, detail="'act' parameter is required")
        
        if act == "get_location_logs":
            # 회원의 위치 로그 목록 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                limit = body.get("limit", 100)
                offset = body.get("offset", 0)
                
                logs = location_log_crud.get_member_location_logs(
                    db, mt_idx, start_date, end_date, limit, offset
                )
                
                result = [log.to_dict() for log in logs]
                return {"result": "Y", "data": result}
                
            except Exception as e:
                logger.error(f"Error getting location logs: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_location_summary":
            # 위치 로그 요약 정보 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                
                summary = location_log_crud.get_location_summary(
                    db, mt_idx, start_date, end_date
                )
                
                return {"result": "Y", "data": summary.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting location summary: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "get_location_path":
            # 위치 경로 및 요약 정보 조회
            try:
                mt_idx = body.get("mt_idx")
                if not mt_idx:
                    raise HTTPException(status_code=400, detail="mt_idx is required")
                
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                
                path_data = location_log_crud.get_location_path(
                    db, mt_idx, start_date, end_date
                )
                
                return {"result": "Y", "data": path_data.model_dump()}
                
            except Exception as e:
                logger.error(f"Error getting location path: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "create_location_log":
            # 위치 로그 생성 (토큰 기반 사용자 식별 + 배치 전송 지원)
            try:
                # 토큰이 있으면 토큰 기반, 없으면 body의 mt_idx 사용
                token_mt_idx, token_err = _get_mt_idx_from_token(request)
                if token_err and not body.get("mt_idx"):
                    # 토큰도 없고 body에 mt_idx도 없으면 에러
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=token_err)
                
                # 토큰에서 mt_idx를 가져오거나 body에서 사용
                final_mt_idx = token_mt_idx if token_mt_idx else body.get("mt_idx")
                if not final_mt_idx:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mt_idx가 필요합니다 (토큰 또는 body)")

                # 동의(옵션): body 또는 헤더로 넘어오는 동의 플래그가 명시적으로 'N'이면 차단
                consent = (str(body.get("location_consent", "Y")).upper() != "N")
                if not consent:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="위치 정보 수집 동의가 필요합니다.")

                # 배치 전송 처리: mlt_gps_data 배열이 있으면 배치로 저장
                if isinstance(body.get("mlt_gps_data"), list) and body.get("mlt_gps_data"):
                    created = []
                    errors = []
                    for idx, item in enumerate(body["mlt_gps_data"]):
                        try:
                            single = {
                                "act": "create_location_log",  # 내부 검증용
                                "mt_idx": final_mt_idx,
                                "mlt_lat": item.get("mlt_lat"),
                                "mlt_long": item.get("mlt_long"),
                                "mlt_accuacy": item.get("mlt_accuracy") or item.get("mlt_accuacy"),  # 스키마에 맞게 mlt_accuacy 사용
                                "mlt_speed": item.get("mlt_speed"),
                                "mlt_altitude": item.get("mlt_altitude"),
                                # iOS 배치 필드명 호환: mlt_timestamp → mlt_gps_time (스키마 호환성)
                                "mlt_gps_time": item.get("mlt_timestamp") or item.get("mlt_gps_time"),
                                "source": body.get("source", "ios-app"),
                                "mlt_location_chk": item.get("mlt_location_chk"),
                                "mlt_fine_location": item.get("mlt_fine_location"),
                                "mlt_battery": item.get("mlt_battery"),
                                "mt_health_work": item.get("mt_health_work"),
                            }
                            log_data = MemberLocationLogCreate(**single)
                            result = location_log_crud.create_location_log(db, log_data)
                            created.append(result.to_dict())
                        except Exception as e:
                            logger.warning(f"Batch item {idx} failed: {str(e)}")
                            errors.append({"index": idx, "error": str(e)})
                    return {"result": "Y" if created else "N", "created_count": len(created), "errors": errors, "data": created[:10]}

                # 단건 처리
                # print(f"📍 [BACKEND] 위치 로그 생성 요청 수신 (단건):")
                # print(f"   📍 final_mt_idx: {final_mt_idx}")
                # print(f"   📍 위도: {body.get('mlt_lat')}")
                # print(f"   📍 경도: {body.get('mlt_long')}")
                
                body["mt_idx"] = final_mt_idx  # 토큰 또는 body의 mt_idx 사용
                
                # 필드명 매핑: mlt_timestamp -> mlt_gps_time (스키마 호환성)
                if "mlt_timestamp" in body and "mlt_gps_time" not in body:
                    body["mlt_gps_time"] = body["mlt_timestamp"]
                
                # mlt_accuracy 매핑 (오타 호환성)
                if "mlt_accuracy" in body and "mlt_accuacy" not in body:
                    body["mlt_accuacy"] = body["mlt_accuracy"]
                log_data = MemberLocationLogCreate(**body)
                result = location_log_crud.create_location_log(db, log_data)
                return {"result": "Y", "data": result.to_dict()}
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error creating location log: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
        
        elif act == "update_location_log":
            # 위치 로그 업데이트
            try:
                log_id = body.get("mlt_idx")
                if not log_id:
                    raise HTTPException(status_code=400, detail="mlt_idx is required")
                
                update_data = {k: v for k, v in body.items() if k not in ["act", "mlt_idx"]}
                log_data = MemberLocationLogUpdate(**update_data)
                
                result = location_log_crud.update_location_log(db, log_id, log_data)
                if not result:
                    raise HTTPException(status_code=404, detail="Location log not found")
                
                return {"result": "Y", "data": result.to_dict()}
                

exec
/bin/zsh -lc "nl -ba Android/app/src/main/java/com/dmonster/smap/LocationService.kt | sed -n '220,360p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   220	            != PackageManager.PERMISSION_GRANTED &&
   221	            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
   222	            != PackageManager.PERMISSION_GRANTED
   223	        ) {
   224	            Log.e(TAG, "Location permission missing")
   225	            stopSelf()
   226	            return START_NOT_STICKY
   227	        }
   228	
   229	        cancelAlarms()
   230	        fusedLocationClient.removeLocationUpdates(locationCallback)
   231	        startLocationTracking()
   232	        startTimerForMode(currentMode)
   233	
   234	        Log.d(TAG, "LocationService started in ${currentMode.name} mode")
   235	        return START_STICKY
   236	    }
   237	
   238	    override fun onBind(intent: Intent?): IBinder? = null
   239	
   240	    override fun onDestroy() {
   241	        persistPendingLocations()
   242	        persistLastLocation()
   243	        super.onDestroy()
   244	        fusedLocationClient.removeLocationUpdates(locationCallback)
   245	        cancelAlarms()
   246	        serviceScope.cancel()
   247	        Log.d(TAG, "LocationService destroyed")
   248	    }
   249	
   250	    override fun onTaskRemoved(rootIntent: Intent?) {
   251	        super.onTaskRemoved(rootIntent)
   252	        scheduleRestart("task_removed")
   253	    }
   254	
   255	    // ── Location request per mode ──────────────────────────────────────────
   256	
   257	    private fun createLocationRequest(mode: PowerMode): LocationRequest {
   258	        return when (mode) {
   259	            PowerMode.STATIONARY -> LocationRequest.Builder(
   260	                Priority.PRIORITY_BALANCED_POWER_ACCURACY, 120_000L  // 2 min
   261	            ).setMinUpdateDistanceMeters(50f)
   262	                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
   263	                .build()
   264	
   265	            PowerMode.WALKING -> LocationRequest.Builder(
   266	                Priority.PRIORITY_HIGH_ACCURACY, 30_000L  // 30 sec
   267	            ).setMinUpdateDistanceMeters(30f)
   268	                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
   269	                .setWaitForAccurateLocation(true)
   270	                .build()
   271	
   272	            PowerMode.AUTOMOTIVE -> LocationRequest.Builder(
   273	                Priority.PRIORITY_HIGH_ACCURACY, 15_000L  // 15 sec
   274	            ).setMinUpdateDistanceMeters(100f)
   275	                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
   276	                .setWaitForAccurateLocation(true)
   277	                .build()
   278	        }
   279	    }
   280	
   281	    // ── Tracking ───────────────────────────────────────────────────────────
   282	
   283	    private fun startLocationTracking() {
   284	        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
   285	            != PackageManager.PERMISSION_GRANTED &&
   286	            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
   287	            != PackageManager.PERMISSION_GRANTED
   288	        ) return
   289	
   290	        try {
   291	            fusedLocationClient.requestLocationUpdates(
   292	                locationRequest,
   293	                locationCallback,
   294	                Looper.getMainLooper()
   295	            )
   296	        } catch (e: SecurityException) {
   297	            Log.e(TAG, "Location permission revoked during request", e)
   298	            stopSelf()
   299	        }
   300	    }
   301	
   302	    // ── Mode detection (speed-based) ───────────────────────────────────────
   303	
   304	    private fun detectModeFromLocation(location: Location) {
   305	        val speed = if (location.speed < 0f) 0f else location.speed  // m/s
   306	
   307	        val detectedMode = when {
   308	            speed < 0.5f  -> PowerMode.STATIONARY  // < 1.8 km/h
   309	            speed < 8.0f  -> PowerMode.WALKING     // < 28.8 km/h (walk / run / cycle)
   310	            else          -> PowerMode.AUTOMOTIVE   // > 28.8 km/h
   311	        }
   312	
   313	        if (detectedMode == PowerMode.STATIONARY) {
   314	            // Only enter stationary after dwelling for STATIONARY_DWELL_MS
   315	            if (stationaryStartTime == 0L) {
   316	                stationaryStartTime = System.currentTimeMillis()
   317	            } else if (System.currentTimeMillis() - stationaryStartTime > STATIONARY_DWELL_MS) {
   318	                switchToMode(PowerMode.STATIONARY)
   319	            }
   320	        } else {
   321	            // Moving: reset dwell timer & switch immediately
   322	            stationaryStartTime = 0L
   323	            switchToMode(detectedMode)
   324	        }
   325	    }
   326	
   327	    // ── Mode switching ─────────────────────────────────────────────────────
   328	
   329	    private fun switchToMode(newMode: PowerMode) {
   330	        if (newMode == currentMode) return
   331	        Log.d(TAG, "Mode: ${currentMode.name} -> ${newMode.name}")
   332	        currentMode = newMode
   333	
   334	        // Flush pending before reconfiguring
   335	        flushPendingLocations()
   336	
   337	        // Stop old alarms
   338	        cancelAlarms()
   339	
   340	        // Reconfigure location request
   341	        fusedLocationClient.removeLocationUpdates(locationCallback)
   342	        locationRequest = createLocationRequest(newMode)
   343	        startLocationTracking()
   344	
   345	        // Start appropriate alarm
   346	        startTimerForMode(newMode)
   347	
   348	        // Update notification
   349	        updateNotification(newMode)
   350	    }
   351	
   352	    private fun startTimerForMode(mode: PowerMode) {
   353	        when (mode) {
   354	            PowerMode.STATIONARY -> startHeartbeatTimer()
   355	            PowerMode.WALKING,
   356	            PowerMode.AUTOMOTIVE -> startBatchTimer()
   357	        }
   358	    }
   359	
   360	    // ── Batching ───────────────────────────────────────────────────────────

exec
/bin/zsh -lc "nl -ba Android/app/src/main/java/com/dmonster/smap/LocationService.kt | sed -n '460,660p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   460	            mltLat = location.latitude,
   461	            mltLong = location.longitude,
   462	            mltAccuracy = location.accuracy.toDouble(),
   463	            mltSpeed = location.speed.toDouble(),
   464	            mltAltitude = if (location.hasAltitude()) location.altitude else 0.0,
   465	            mltTimestamp = dateFormatter.format(locationTime),
   466	            mltBattery = getBatteryLevel()
   467	        )
   468	    }
   469	
   470	    // ── Server communication (Retrofit) ────────────────────────────────────
   471	
   472	    private suspend fun sendLocationToServer(request: CreateLocationLogRequest) {
   473	        try {
   474	            val response = smapApi.createLocationLog(request)
   475	            if (response.isSuccessful) {
   476	                consecutiveAuthFailures = 0
   477	                Log.d(TAG, "Location sent: (${request.mltLat}, ${request.mltLong}) mode=${currentMode.name}")
   478	            } else {
   479	                Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
   480	                when (response.code()) {
   481	                    401 -> {
   482	                        consecutiveAuthFailures++
   483	                        if (consecutiveAuthFailures >= maxAuthFailures) {
   484	                            // Persistent auth failure — clear token to prevent infinite restart loop
   485	                            getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
   486	                                .edit().remove("auth_token").apply()
   487	                            Log.w(TAG, "Auth failed $maxAuthFailures times — cleared token, stopping service")
   488	                            stopSelf()
   489	                        } else {
   490	                            Log.w(TAG, "Auth failed ($consecutiveAuthFailures/$maxAuthFailures) — will retry")
   491	                            enqueueLocation(request)
   492	                        }
   493	                    }
   494	                    403 -> {
   495	                        // 403 may be rate-limit or authorization issue, not necessarily auth failure
   496	                        Log.w(TAG, "403 Forbidden — dropping location, not clearing token")
   497	                    }
   498	                    in 500..599 -> {
   499	                        // Re-enqueue on server error for retry
   500	                        enqueueLocation(request)
   501	                    }
   502	                }
   503	            }
   504	        } catch (e: Exception) {
   505	            Log.w(TAG, "Location upload error: ${e.message}")
   506	            // Re-enqueue on network error for retry
   507	            enqueueLocation(request)
   508	        }
   509	    }
   510	
   511	    // ── Coordinate validation ──────────────────────────────────────────────
   512	
   513	    private fun isValidCoordinate(location: Location): Boolean {
   514	        val lat = location.latitude
   515	        val lng = location.longitude
   516	
   517	        if (lat == 0.0 && lng == 0.0) return false
   518	        if (lat < -90.0 || lat > 90.0) return false
   519	        if (lng < -180.0 || lng > 180.0) return false
   520	        if (lat.isNaN() || lat.isInfinite()) return false
   521	        if (lng.isNaN() || lng.isInfinite()) return false
   522	        if (location.accuracy > 1000) return false
   523	
   524	        // Mock location check (skip in debug builds for emulator testing)
   525	        if (!BuildConfig.DEBUG) {
   526	            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
   527	                if (location.isMock) return false
   528	            } else {
   529	                @Suppress("DEPRECATION")
   530	                if (location.isFromMockProvider) return false
   531	            }
   532	        }
   533	
   534	        return true
   535	    }
   536	
   537	    // ── Battery level ──────────────────────────────────────────────────────
   538	
   539	    private fun getBatteryLevel(): String {
   540	        return try {
   541	            val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
   542	            val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
   543	            val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
   544	            if (level != -1 && scale != -1) ((level * 100) / scale.toFloat()).toInt().toString() else "0"
   545	        } catch (e: Exception) {
   546	            Log.w(TAG, "Failed to get battery level", e)
   547	            "0"
   548	        }
   549	    }
   550	
   551	    // ── Notification ───────────────────────────────────────────────────────
   552	
   553	    private fun createNotificationChannel() {
   554	        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
   555	            val channel = NotificationChannel(
   556	                NOTIFICATION_CHANNEL_ID,
   557	                "SMAP 위치 추적 (활동 로그)",
   558	                NotificationManager.IMPORTANCE_LOW
   559	            ).apply {
   560	                description = "'활동 로그' 및 '그룹 멤버와 실시간 위치 공유' 기능을 위해 백그라운드에서 위치를 수집합니다."
   561	                setShowBadge(false)
   562	            }
   563	            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
   564	            nm.createNotificationChannel(channel)
   565	        }
   566	    }
   567	
   568	    private fun createNotification(mode: PowerMode) =
   569	        NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
   570	            .setContentTitle("SMAP 위치 공유 중")
   571	            .setContentText(notificationText(mode))
   572	            .setSmallIcon(R.mipmap.ic_launcher)
   573	            .setPriority(NotificationCompat.PRIORITY_LOW)
   574	            .setOngoing(true)
   575	            .build()
   576	
   577	    private fun updateNotification(mode: PowerMode) {
   578	        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
   579	        nm.notify(NOTIFICATION_ID, createNotification(mode))
   580	    }
   581	
   582	    private fun notificationText(mode: PowerMode): String = when (mode) {
   583	        PowerMode.STATIONARY -> "정지 중 (저전력 모드)"
   584	        PowerMode.WALKING    -> "이동 중 (도보)"
   585	        PowerMode.AUTOMOTIVE -> "이동 중 (차량)"
   586	    }
   587	
   588	    private fun persistPendingLocations() {
   589	        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
   590	        val queueSnapshot = synchronized(pendingLocations) { pendingLocations.toList() }
   591	        prefs.edit().putString(KEY_PENDING_QUEUE, json.encodeToString(queueSnapshot)).apply()
   592	    }
   593	
   594	    private fun restorePendingLocations() {
   595	        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
   596	        val raw = prefs.getString(KEY_PENDING_QUEUE, null) ?: return
   597	        runCatching {
   598	            json.decodeFromString<List<CreateLocationLogRequest>>(raw)
   599	        }.onSuccess { restored ->
   600	            synchronized(pendingLocations) {
   601	                pendingLocations.clear()
   602	                pendingLocations.addAll(restored.takeLast(maxQueueSize))
   603	            }
   604	        }.onFailure {
   605	            Log.w(TAG, "Failed to restore pending queue", it)
   606	        }
   607	    }
   608	
   609	    private fun persistLastLocation() {
   610	        val location = lastLocation ?: return
   611	        val request = buildLocationLogRequest(location) ?: return
   612	        getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
   613	            .edit()
   614	            .putString(KEY_LAST_LOCATION, json.encodeToString(request))
   615	            .apply()
   616	    }
   617	
   618	    private fun restoreLastLocation() {
   619	        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
   620	        val raw = prefs.getString(KEY_LAST_LOCATION, null) ?: return
   621	        runCatching {
   622	            json.decodeFromString<CreateLocationLogRequest>(raw)
   623	        }.onSuccess { restored ->
   624	            enqueueLocation(restored)
   625	        }.onFailure {
   626	            Log.w(TAG, "Failed to restore last location", it)
   627	        }
   628	        prefs.edit().remove(KEY_LAST_LOCATION).apply()
   629	    }
   630	
   631	    private fun scheduleRestart(reason: String) {
   632	        if (!isUserLoggedIn(this) || !hasRequiredPermissions(this)) return
   633	        val intent = Intent(this, LocationRestartReceiver::class.java).putExtra("restart_reason", reason)
   634	        val pendingIntent = PendingIntent.getBroadcast(
   635	            this,
   636	            1001,
   637	            intent,
   638	            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
   639	        )
   640	        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
   641	        alarmManager.setAndAllowWhileIdle(
   642	            AlarmManager.RTC_WAKEUP,
   643	            System.currentTimeMillis() + RESTART_DELAY_MS,
   644	            pendingIntent
   645	        )
   646	    }
   647	}

exec
/bin/zsh -lc "nl -ba Android/app/src/main/java/com/dmonster/smap/LocationService.kt | sed -n '380,460p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   380	    }
   381	
   382	    private fun startHeartbeatTimer() {
   383	        cancelHeartbeatAlarm()
   384	        scheduleHeartbeatAlarm()
   385	    }
   386	
   387	    private fun scheduleHeartbeatAlarm() {
   388	        val intent = Intent(this, LocationService::class.java).setAction(ACTION_HEARTBEAT)
   389	        heartbeatPendingIntent = PendingIntent.getService(
   390	            this, REQUEST_CODE_HEARTBEAT, intent,
   391	            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
   392	        )
   393	        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
   394	        am.setAndAllowWhileIdle(
   395	            AlarmManager.RTC_WAKEUP,
   396	            System.currentTimeMillis() + HEARTBEAT_INTERVAL_MS,
   397	            heartbeatPendingIntent!!
   398	        )
   399	    }
   400	
   401	    private fun cancelHeartbeatAlarm() {
   402	        heartbeatPendingIntent?.let {
   403	            (getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(it)
   404	            it.cancel()
   405	        }
   406	        heartbeatPendingIntent = null
   407	    }
   408	
   409	    private fun cancelAlarms() {
   410	        batchJob?.cancel()
   411	        batchJob = null
   412	        cancelHeartbeatAlarm()
   413	    }
   414	
   415	    private fun flushPendingLocations() {
   416	        val toSend: List<CreateLocationLogRequest>
   417	        synchronized(pendingLocations) {
   418	            if (pendingLocations.isEmpty()) return
   419	            toSend = pendingLocations.toList()
   420	            pendingLocations.clear()
   421	        }
   422	        persistPendingLocations()
   423	        toSend.forEach { request ->
   424	            serviceScope.launch { sendLocationToServer(request) }
   425	        }
   426	    }
   427	
   428	    /**
   429	     * Heartbeat: flush any queued locations first. If the queue was empty
   430	     * (no new data since last flush), re-send the last known location so
   431	     * the server knows the device is still alive.
   432	     */
   433	    private fun sendHeartbeat() {
   434	        // Flush any locations that accumulated while stationary
   435	        val hadPending: Boolean
   436	        synchronized(pendingLocations) { hadPending = pendingLocations.isNotEmpty() }
   437	        flushPendingLocations()
   438	
   439	        // Only send heartbeat if nothing was flushed (avoid duplicate)
   440	        if (!hadPending) {
   441	            val loc = lastLocation ?: return
   442	            val request = buildLocationLogRequest(loc) ?: return
   443	            serviceScope.launch { sendLocationToServer(request) }
   444	        }
   445	    }
   446	
   447	    // ── Build request model ────────────────────────────────────────────────
   448	
   449	    private fun buildLocationLogRequest(location: Location): CreateLocationLogRequest? {
   450	        val prefs = getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
   451	        val mtIdxInt = prefs.getInt("mt_idx", -1)
   452	        if (mtIdxInt == -1) return null
   453	
   454	        val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
   455	        // Use the GPS-measured time, not the current wall-clock time
   456	        val locationTime = if (location.time > 0) Date(location.time) else Date()
   457	
   458	        return CreateLocationLogRequest(
   459	            mtIdx = mtIdxInt.toString(),
   460	            mltLat = location.latitude,

**Analyzing Doze mode impact on coroutine timers**

I’m piecing together how the coroutine timer in the foreground service relates to Doze mode by examining the LocationService.kt code and searching for relevant documentation in the repo. Since official docs can’t be directly verified here, I’m weighing known Android behaviors about Doze—like restrictions on timers and alarms—and trying to connect that to the service’s use of Dispatchers.IO and the absence of explicit wakelocks, to assess whether the timer is reliably guaranteed to run under Doze conditions.
exec
/bin/zsh -lc "rg -n \"Doze\" -n -g'*'" in /Users/genie/SmapSource/smap_next
 succeeded in 3112ms:
.collab-loop/android-gps-stationary/reply_round1_codex.md:32:3. **H3**: 포그라운드 서비스가 살아 있는데 AlarmManager로 자기 자신을 재시작하는 설계 자체가 Doze/App Standby에서 불리. coroutine `delay` 루프가 더 안전.
.collab-loop/android-gps-stationary/reply_round1_codex.md:36:1. **포그라운드 서비스의 coroutine 타이머가 Doze에서 실제로 보장되는가?** Android 공식 문서 근거로 판정해 주세요. `serviceScope.launch { delay(...) }`가 Doze deep idle에서 block되지 않는지, partial wake lock을 명시적으로 획득할 필요는 없는지.
.collab-loop/android-gps-stationary/reply_round1_codex.md:188:/bin/zsh -lc 'rg -n "Doze" -n' in /Users/genie/SmapSource/smap_next
.collab-loop/android-gps-stationary/reply_round1_codex.md:256:### H3. AlarmManager.setAndAllowWhileIdle → Doze/App Standby에서 지연
.collab-loop/android-gps-stationary/reply_round1_codex.md:259:- 근본 의문: **포그라운드 서비스가 돌고 있는데 왜 굳이 AlarmManager를 써서 자기 자신을 재시작하는가**. coroutine `delay(15.minutes)` 루프로 충분하며 Doze 영향이 작다.
.collab-loop/android-gps-stationary/reply_round1_codex.md:275:   - 포그라운드 서비스는 Doze에서도 CPU 실행 허용. AlarmManager 의존 제거 → 재시작 루프/지연 제거.
.collab-loop/android-gps-stationary/reply_round1_codex.md:288:- 단점: Doze/App Standby 지연 리스크 잔존, 디버깅 어려움.
.collab-loop/android-gps-stationary/reply_round1_codex.md:300:- Android 14+ `foregroundServiceType=location`에서 coroutine `delay` 기반 타이머가 Doze에서 실행 보장되는가? (포그라운드 서비스는 partial wake lock이 implicit하므로 OK지만 문서로 확인 필요)
.collab-loop/android-gps-stationary/reply_round1_codex.md:3310:**Analyzing Doze mode impact on coroutine timers**
.collab-loop/android-gps-stationary/reply_round1_codex.md:3312:I’m piecing together how the coroutine timer in the foreground service relates to Doze mode by examining the LocationService.kt code and searching for relevant documentation in the repo. Since official docs can’t be directly verified here, I’m weighing known Android behaviors about Doze—like restrictions on timers and alarms—and trying to connect that to the service’s use of Dispatchers.IO and the absence of explicit wakelocks, to assess whether the timer is reliably guaranteed to run under Doze conditions.
.collab-loop/android-gps-stationary/reply_round1_codex.md:3314:/bin/zsh -lc "rg -n \"Doze\" -n -g'*'" in /Users/genie/SmapSource/smap_next
.collab-loop/android-gps-stationary/packet_round1.md:19:3. **H3**: 포그라운드 서비스가 살아 있는데 AlarmManager로 자기 자신을 재시작하는 설계 자체가 Doze/App Standby에서 불리. coroutine `delay` 루프가 더 안전.
.collab-loop/android-gps-stationary/packet_round1.md:23:1. **포그라운드 서비스의 coroutine 타이머가 Doze에서 실제로 보장되는가?** Android 공식 문서 근거로 판정해 주세요. `serviceScope.launch { delay(...) }`가 Doze deep idle에서 block되지 않는지, partial wake lock을 명시적으로 획득할 필요는 없는지.
.collab-loop/android-gps-stationary/draft.md:59:### H3. AlarmManager.setAndAllowWhileIdle → Doze/App Standby에서 지연
.collab-loop/android-gps-stationary/draft.md:62:- 근본 의문: **포그라운드 서비스가 돌고 있는데 왜 굳이 AlarmManager를 써서 자기 자신을 재시작하는가**. coroutine `delay(15.minutes)` 루프로 충분하며 Doze 영향이 작다.
.collab-loop/android-gps-stationary/draft.md:78:   - 포그라운드 서비스는 Doze에서도 CPU 실행 허용. AlarmManager 의존 제거 → 재시작 루프/지연 제거.
.collab-loop/android-gps-stationary/draft.md:91:- 단점: Doze/App Standby 지연 리스크 잔존, 디버깅 어려움.
.collab-loop/android-gps-stationary/draft.md:103:- Android 14+ `foregroundServiceType=location`에서 coroutine `delay` 기반 타이머가 Doze에서 실행 보장되는가? (포그라운드 서비스는 partial wake lock이 implicit하므로 OK지만 문서로 확인 필요)
frontend/node_modules/date-fns/README.md:20:- **I18n**: Dozens of locales. Include only what you need.
iOS/unsloth_studio/lib/python3.13/site-packages/transformers-5.3.0.dist-info/METADATA:537:    - Dozens of model architectures with 1M+ pretrained checkpoints across all modalities.
frontend/node_modules/react-icons/gi/index.d.ts:1213:export declare const GiDozen: IconType;
frontend/node_modules/react-icons/gi/index.mjs:3633:export function GiDozen (props) {
frontend/node_modules/react-icons/gi/index.js:3633:module.exports.GiDozen = function GiDozen (props) {

**Analyzing heartbeat and location update logic**

I'm piecing together how heartbeat and location updates work on Android and iOS, looking into alarms, background restrictions, and how last location is used. I want to cross-check the Android AlarmManager usage and iOS heartbeat tasks, plus understand battery impacts from parameters like min update distance and priority. I’m also gathering precise code references to confirm how pending heartbeats flush and how last locations are handled. Let's explore this carefully!
exec
/bin/zsh -lc "nl -ba iOS/smap/Core/Location/LocationUploader.swift | sed -n '60,140p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
    60	                guard !Task.isCancelled else { break }
    61	                await self?.flush()
    62	            }
    63	        }
    64	    }
    65	
    66	    func stopBatching() {
    67	        batchTask?.cancel()
    68	        batchTask = nil
    69	    }
    70	
    71	    // MARK: - Heartbeat (정지 중)
    72	
    73	    func startHeartbeat(interval: TimeInterval) {
    74	        stopHeartbeat()
    75	        heartbeatTask = Task { [weak self] in
    76	            while !Task.isCancelled {
    77	                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
    78	                guard !Task.isCancelled else { break }
    79	                await self?.sendHeartbeat()
    80	            }
    81	        }
    82	    }
    83	
    84	    func stopHeartbeat() {
    85	        heartbeatTask?.cancel()
    86	        heartbeatTask = nil
    87	    }
    88	
    89	    // MARK: - Send
    90	
    91	    func flush() async {
    92	        guard !pending.isEmpty, !mtIdx.isEmpty else {
    93	            if pending.isEmpty { print("[LocationUploader] flush 스킵 - pending 비어있음") }
    94	            if mtIdx.isEmpty { print("[LocationUploader] flush 스킵 - mtIdx 비어있음") }
    95	            return
    96	        }
    97	        print("[LocationUploader] flush 시작 - \(pending.count)건 전송 (mtIdx: \(mtIdx))")
    98	
    99	        let toSend = pending
   100	        for location in toSend {
   101	            let success = await sendSingle(location)
   102	            if success {
   103	                pending.removeAll { $0.timestamp == location.timestamp && $0.lat == location.lat }
   104	            }
   105	        }
   106	
   107	        // Persist immediately after flush to prevent replay on restart
   108	        persistQueue()
   109	    }
   110	
   111	    private func sendHeartbeat() async {
   112	        guard let location = lastHeartbeatLocation, !mtIdx.isEmpty else { return }
   113	        let _ = await sendSingle(location)
   114	    }
   115	
   116	    private func sendSingle(_ location: LocationData) async -> Bool {
   117	        let params: [String: Any] = [
   118	            "act": "create_location_log",
   119	            "mt_idx": mtIdx,
   120	            "mlt_lat": location.lat,
   121	            "mlt_long": location.lng,
   122	            "mlt_accuracy": location.accuracy,
   123	            "mlt_speed": location.speed,
   124	            "mlt_altitude": location.altitude,
   125	            "mlt_timestamp": location.timestamp,
   126	            "mlt_battery": String(location.battery),
   127	            "mlt_fine_location": "N",
   128	            "mlt_location_chk": "N",
   129	            "mt_health_work": String(location.steps),
   130	            "source": "ios-app"
   131	        ]
   132	
   133	        do {
   134	            let (_, response) = try await apiClient.requestRaw(
   135	                .createLocationLog(params: params),
   136	                token: KeychainManager.shared.getToken()
   137	            )
   138	            print("✅ [LocationUploader] 전송 성공 (status: \(response.statusCode))")
   139	            return true
   140	        } catch {

**Analyzing LocationService and Android 12 restrictions**

I'm piecing together how the LocationService interacts with auth tokens, update distance settings, and heartbeat logic, especially around 401 handling by AuthInterceptor and pending location flushing. I'm also investigating how Android 12 foreground service start limits might affect service behavior, checking startForeground usage and PendingIntent triggers for edge cases. There's a lot to unpack related to network retries, sensor updates, and background execution constraints; I'll look closely into both the code and platform docs to clarify these intricate interactions.
exec
/bin/zsh -lc "sed -n '1,200p' Android/app/src/main/java/com/dmonster/smap/data/model/CreateLocationLogRequest.kt" in /Users/genie/SmapSource/smap_next
 exited 1 in 0ms:
sed: Android/app/src/main/java/com/dmonster/smap/data/model/CreateLocationLogRequest.kt: No such file or directory

exec
/bin/zsh -lc "rg --files -g'*CreateLocationLogRequest*'" in /Users/genie/SmapSource/smap_next
 exited 1 in 0ms:
exec
/bin/zsh -lc 'rg -n "mltLat" -n Android/app/src/main/java/com/dmonster/smap' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
Android/app/src/main/java/com/dmonster/smap/data/model/HomeModels.kt:46:    @SerialName("mlt_lat") var mltLat: Double? = null,
Android/app/src/main/java/com/dmonster/smap/data/model/ActivityLogModels.kt:13:    @SerialName("mlt_lat") val mltLat: Double,
Android/app/src/main/java/com/dmonster/smap/data/model/ActivityLogModels.kt:33:    @SerialName("mlt_lat") val mltLat: Double? = null,
Android/app/src/main/java/com/dmonster/smap/data/model/ActivityLogModels.kt:39:    val latitude: Double get() = mltLat ?: 0.0
Android/app/src/main/java/com/dmonster/smap/data/model/ActivityLogModels.kt:45:        get() = mltLat != null && mltLong != null && mltLat != 0.0 && mltLong != 0.0
Android/app/src/main/java/com/dmonster/smap/LocationService.kt:460:            mltLat = location.latitude,
Android/app/src/main/java/com/dmonster/smap/LocationService.kt:477:                Log.d(TAG, "Location sent: (${request.mltLat}, ${request.mltLong}) mode=${currentMode.name}")
Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt:175:        if (selectedMember != null && selectedMember.mltLat != null && selectedMember.mltLong != null) {
Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt:177:            val lat = selectedMember.mltLat ?: return@LaunchedEffect
Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt:189:                val lat = m.mltLat
Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt:262:                            val memberLat = member.mltLat
Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt:306:                            val selectedLat = selected?.mltLat

exec
/bin/zsh -lc "sed -n '1,120p' Android/app/src/main/java/com/dmonster/smap/data/model/ActivityLogModels.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 위치 로그 생성 요청 (LocationService -> server)
 */
@Serializable
data class CreateLocationLogRequest(
    @SerialName("act") val act: String = "create_location_log",
    @SerialName("mt_idx") val mtIdx: String,
    @SerialName("mlt_lat") val mltLat: Double,
    @SerialName("mlt_long") val mltLong: Double,
    @SerialName("mlt_accuracy") val mltAccuracy: Double,
    @SerialName("mlt_speed") val mltSpeed: Double,
    @SerialName("mlt_altitude") val mltAltitude: Double = 0.0,
    @SerialName("mlt_timestamp") val mltTimestamp: String,
    @SerialName("mlt_battery") val mltBattery: String,
    @SerialName("mlt_fine_location") val mltFineLocation: String = "N",
    @SerialName("mlt_location_chk") val mltLocationChk: String = "N",
    @SerialName("mt_health_work") val mtHealthWork: String = "0",
    @SerialName("source") val source: String = "android-app"
)

/**
 * 위치 로그 데이터
 */
@Serializable
data class LocationLog(
    @SerialName("mlt_idx") val mltIdx: Int? = null,
    @SerialName("mt_idx") val mtIdx: Int? = null,
    @SerialName("mlt_lat") val mltLat: Double? = null,
    @SerialName("mlt_long") val mltLong: Double? = null,
    @SerialName("mlt_speed") val mltSpeed: Double? = null,
    @SerialName("mlt_gps_time") val mltGpsTime: String? = null,
    @SerialName("mlt_wdate") val mltWdate: String? = null
) {
    val latitude: Double get() = mltLat ?: 0.0
    val longitude: Double get() = mltLong ?: 0.0
    val speed: Double get() = mltSpeed ?: 0.0
    val time: String get() = mltGpsTime ?: ""

    val hasValidCoordinates: Boolean
        get() = mltLat != null && mltLong != null && mltLat != 0.0 && mltLong != 0.0
}

/**
 * 위치 요약 데이터 - iOS API 응답 형식과 일치
 */
@Serializable
data class LocationSummary(
    @SerialName("schedule_count") val scheduleCount: String? = null,
    @SerialName("distance") val distance: String? = null,
    @SerialName("duration") val duration: String? = null,
    @SerialName("steps") val steps: Int? = null,
    // Legacy fields (fallback)
    @SerialName("total_distance") val totalDistance: Double? = null,
    @SerialName("total_time") val totalTime: Int? = null,
    @SerialName("total_steps") val totalSteps: Int? = null,
    @SerialName("date") val date: String? = null
) {

    val distanceFormatted: String
        get() {
            // First try iOS format (pre-formatted string)
            if (!distance.isNullOrBlank() && distance != "0" && distance != "0.0") {
                return distance
            }
            // Fallback to legacy format
            val dist = totalDistance ?: 0.0
            return if (dist >= 1000) {
                String.format("%.1f km", dist / 1000)
            } else {
                String.format("%.0f m", dist)
            }
        }

    val timeFormatted: String
        get() {
            // First try iOS format (pre-formatted string)
            if (!duration.isNullOrBlank() && duration != "0" && duration != "0분") {
                return duration
            }
            // Fallback to legacy format
            val minutes = totalTime ?: 0
            return if (minutes >= 60) {
                val hours = minutes / 60
                val mins = minutes % 60
                "${hours}시간 ${mins}분"
            } else {
                "${minutes}분"
            }
        }

    val stepsFormatted: String
        get() {
            val stepsValue = steps ?: totalSteps ?: 0
            return if (stepsValue >= 10000) {
                String.format("%.1f만 걸음", stepsValue / 10000.0)
            } else {
                String.format("%,d 걸음", stepsValue)
            }
        }
}

@Serializable
data class StayTime(
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("end_time") val endTime: String? = null,
    @SerialName("duration") val durationDouble: Double? = null,
    @SerialName("latitude") val latitude: Double? = null,
    @SerialName("longitude") val longitude: Double? = null,
    @SerialName("start_lat") val startLat: Double? = null,
    @SerialName("start_long") val startLong: Double? = null,
    @SerialName("location") val location: String? = null,
    @SerialName("stay_duration") val stayDuration: String? = null
) {
    val duration: Int
        get() = durationDouble?.toInt() ?: 0

exec
/bin/zsh -lc "sed -n '1,200p' backend/app/schemas/member_location_log.py" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class MemberLocationLogBase(BaseModel):
    """위치 로그 기본 스키마"""
    mt_idx: int
    mlt_lat: Optional[float] = None
    mlt_long: Optional[float] = None
    mlt_accuacy: Optional[float] = None
    mlt_speed: Optional[float] = None
    mlt_battery: Optional[int] = None
    mlt_fine_location: Optional[str] = 'Y'
    mlt_location_chk: Optional[str] = 'Y'
    mt_health_work: Optional[int] = None
    mlt_gps_time: datetime
    stay_lat: Optional[float] = None
    stay_long: Optional[float] = None

class MemberLocationLogCreate(MemberLocationLogBase):
    """위치 로그 생성 스키마"""
    pass

class MemberLocationLogUpdate(BaseModel):
    """위치 로그 업데이트 스키마"""
    mlt_lat: Optional[float] = None
    mlt_long: Optional[float] = None
    mlt_accuacy: Optional[float] = None
    mlt_speed: Optional[float] = None
    mlt_battery: Optional[int] = None
    mlt_fine_location: Optional[str] = None
    mlt_location_chk: Optional[str] = None
    mt_health_work: Optional[int] = None
    stay_lat: Optional[float] = None
    stay_long: Optional[float] = None

class MemberLocationLogResponse(MemberLocationLogBase):
    """위치 로그 응답 스키마"""
    mlt_idx: int
    mlt_wdate: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class LocationLogListRequest(BaseModel):
    """위치 로그 목록 요청 스키마"""
    mt_idx: int
    start_date: Optional[str] = None  # YYYY-MM-DD 형식
    end_date: Optional[str] = None    # YYYY-MM-DD 형식
    limit: Optional[int] = 100
    offset: Optional[int] = 0

class LocationSummaryResponse(BaseModel):
    """위치 로그 요약 응답 스키마"""
    total_distance: float
    total_time: str
    step_count: int
    average_speed: float
    battery_consumption: int

class LocationPathResponse(BaseModel):
    """위치 경로 응답 스키마"""
    points: List[dict]  # 위치 포인트 목록
    summary: LocationSummaryResponse

class LocationPathPoint(BaseModel):
    timestamp: str
    latitude: float
    longitude: float
    speed: Optional[float] = None
    accuracy: Optional[float] = None
    battery: Optional[int] = None

class LocationPath(BaseModel):
    points: List[LocationPathPoint]

class DailySummary(BaseModel):
    mlt_idx: int
    log_date: str
    start_time: str
    end_time: str

class StayTime(BaseModel):
    label: str
    grp: int
    start_time: str
    end_time: str
    duration: float
    distance: float
    start_lat: float
    start_long: float

class MapMarker(BaseModel):
    mlt_idx: int
    mt_idx: int
    mlt_gps_time: str
    mlt_speed: float
    mlt_lat: float
    mlt_long: float
    mlt_accuacy: float
    mt_health_work: int
    mlt_battery: int
    mlt_fine_location: str
    mlt_location_chk: str
    mlt_wdate: str
    stay_lat: Optional[float] = None
    stay_long: Optional[float] = None

# 새로운 스키마 추가 - PHP 로직 기반
class LocationLogSummary(BaseModel):
    schedule_count: str  # 일정 개수 (포맷된 문자열)
    distance: str        # 이동거리 (포맷된 문자열, 예: "5.2 km")
    duration: str        # 이동시간 (포맷된 문자열, 예: "2시간 30분")
    steps: int          # 걸음수

class LocationLogSummaryResponse(BaseModel):
    result: str
    data: LocationLogSummary
    message: str 
exec
/bin/zsh -lc "rg -n \"API_BASE_URL\" -n -g'*'" in /Users/genie/SmapSource/smap_next
 succeeded in 3823ms:
Android/app/build/outputs/mapping/release/mapping.txt:1247169:    0:2:java.lang.String access$getAPI_BASE_URL$cp():33:33 -> access$getAPI_BASE_URL$cp
frontend/.env:5:NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
Android/app/build/outputs/mapping/release/seeds.txt:94507:com.dmonster.smap.MyFirebaseMessagingService: java.lang.String API_BASE_URL
Android/app/build/outputs/mapping/release/seeds.txt:116249:com.dmonster.smap.BuildConfig: java.lang.String API_BASE_URL
Android/app/build/outputs/mapping/release/seeds.txt:214590:com.dmonster.smap.MyFirebaseMessagingService: java.lang.String access$getAPI_BASE_URL$cp()
frontend/.next/static/chunks/app/layout.js:3949:eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/* provided dependency */ var process = __webpack_require__(/*! process */ \"(app-pages-browser)/./node_modules/next/dist/build/polyfills/process.js\");\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = function() {\n    let language = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 'ko';\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (true) {\n            const currentDomain = window.location.host;\n            const domainClientId = MAP_CONFIG.NAVER.CLIENT_IDS[currentDomain];\n            // Vercel 환경 감지 및 로깅\n            const isVercel = currentDomain.includes('vercel.app') || currentDomain.includes('nextstep.aiagnt.kr');\n            console.log(\"\\uD83D\\uDDFA️ [NAVER MAPS] 도메인: \".concat(currentDomain, \", Vercel: \").concat(isVercel, \", Client ID: \").concat(domainClientId || '기본값'));\n            // Vercel 환경에서는 환경 변수 우선 사용\n            if (isVercel && \"91y2nh0yff\") {\n                console.log(\"\\uD83D\\uDDFA️ [NAVER MAPS] Vercel 환경에서 환경 변수 사용: \".concat(\"91y2nh0yff\".substring(0, 8), \"...\"));\n                return \"91y2nh0yff\";\n            }\n            return domainClientId || \"91y2nh0yff\" || 0;\n        }\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (true) {\n            const currentDomain = window.location.host;\n            const domainClientId = GOOGLE_CONFIG.OAUTH.CLIENT_IDS[currentDomain];\n            // Vercel 환경 감지 및 로깅\n            const isVercel = currentDomain.includes('vercel.app') || currentDomain.includes('nextstep.aiagnt.kr');\n            console.log(\"\\uD83D\\uDD10 [GOOGLE OAUTH] 도메인: \".concat(currentDomain, \", Vercel: \").concat(isVercel, \", Client ID: \").concat(domainClientId ? domainClientId.substring(0, 12) + '...' : '기본값'));\n            // Vercel 환경에서는 환경 변수 우선 사용\n            if (isVercel && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {\n                console.log(\"\\uD83D\\uDD10 [GOOGLE OAUTH] Vercel 환경에서 환경 변수 사용: \".concat(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.substring(0, 12), \"...\"));\n                return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;\n            }\n            return domainClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n        }\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (true) {\n        return navigator.language.substring(0, 2);\n    }\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LE9BQU87SUFDUEMsb0JBQW9CO0lBQ3BCQyx5QkFBeUI7SUFDekJDLFlBQVk7QUFDZCxFQUFFO0FBRUYsU0FBUztBQUNGLE1BQU1DLGVBQWU7SUFDMUJDLGVBQWU7SUFDZkMsYUFBYTtJQUNiQyxjQUFjO0FBQ2hCLEVBQUU7QUFFRixpQkFBaUI7QUFDVixNQUFNQyxjQUFjO0lBQ3pCQyxrQkFBa0I7UUFBQztRQUFPO1FBQU87UUFBTztRQUFRO0tBQU07SUFDdERDLGNBQWM7SUFDZEMsYUFBYTtJQUNiQyxTQUFTO0lBQ1RDLFdBQVc7QUFDYixFQUFFO0FBRUYsZUFBZTtBQUNSLE1BQU1DLGlCQUFpQjtJQUM1QixJQUFJLElBQTZCLEVBQUU7UUFDakMsT0FBT0MsVUFBVWxFLFFBQVEsQ0FBQ3FCLFNBQVMsQ0FBQyxHQUFHO0lBQ3pDO0lBQ0EsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNOEMsTUFBTTtJQUNqQkMsVUFBVWxELGlCQUF3QixDQUFhO0lBQy9DbUQsY0FBY25ELHVCQUFvQyxJQUFJLENBQXVCO0FBQy9FLEVBQUU7QUFFRixpRUFBZTtJQUNiMUI7SUFDQVk7SUFDQXVDO0lBQ0FJO0lBQ0FRO0lBQ0FJO0lBQ0E1RDtJQUNBa0U7SUFDQUU7SUFDQXhEO0lBQ0FvQjtBQUNGLENBQUMsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9jb25maWcvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTTUFQIOyVoO2UjOumrOy8gOydtOyFmCDqs7XthrUg7ISk7KCVIO2MjOydvFxuICogY29uZmlnLmluYy5waHDsnZgg6rCS7J2EIFR5cGVTY3JpcHTsl5DshJwg7IKs7Jqp7ZWgIOyImCDsnojrj4TroZ0g67OA7ZmYXG4gKi9cblxuLy8g7JWxIOygleuztFxuZXhwb3J0IGNvbnN0IEFQUF9JTkZPID0ge1xuICBET01BSU46ICdodHRwczovL2FwcDIuc21hcC5zaXRlJyxcbiAgQ0ROX0hUVFA6ICdodHRwczovL2FwcDIuc21hcC5zaXRlJyxcbiAgREVTSUdOX0hUVFA6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2Rlc2lnbicsXG4gIEFETUlOX05BTUU6ICdTTUFQJyxcbiAgT0dfSU1BR0U6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9vZy1pbWFnZS5wbmcnLFxuICBWRVJTSU9OOiAnMjAyNDA1MjJfOCcsIC8vIENTUywgSlMg7LqQ7IucIOumrOyFi+yaqSDrsoTsoIRcbn07XG5cbi8vIOuLpOq1reyWtCDsp4Dsm5BcbmV4cG9ydCBjb25zdCBnZXRMb2NhbGl6ZWRBcHBJbmZvID0gKGxhbmd1YWdlOiBzdHJpbmcgPSAna28nKSA9PiB7XG4gIHN3aXRjaCAobGFuZ3VhZ2UpIHtcbiAgICBjYXNlICdrbyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0g7J6Q64WAIOydvOyglcK37JyE7LmYIO2ZleyduFwiLFxuICAgICAgICBERVNDUklQVElPTjogXCLsnpDrhYAg7JyE7LmYIO2ZleyduOu2gO2EsCDsnbzsoJUg6rO17Jyg6rmM7KeALCDrqqjrk6Ag6rKD7J2EIO2VnCDqs7Psl5DshJwuXCJcbiAgICAgIH07XG4gICAgY2FzZSAnZW4nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gICAgY2FzZSAnamEnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0g5a2Q5L6b44Gu44K544Kx44K444Ol44O844Or44O75L2N572u56K66KqNXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0g5a2Q5L6b44Gu44K544Kx44K444Ol44O844Or44O75L2N572u56K66KqNXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuWtkOS+m+OBruS9jee9rueiuuiqjeOBi+OCieOCueOCseOCuOODpeODvOODq+WFseacieOBvuOBp+OAgeOBmeOBueOBpuOCkuS4gOOBi+aJgOOBp+OAglwiXG4gICAgICB9O1xuICAgIC8vIOuNlCDrp47snYAg7Ja47Ja0IOyngOybkCDstpTqsIAg6rCA64qlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIENoaWxkIFNjaGVkdWxlIGFuZCBMb2NhdGlvbiBUcmFja2luZ1wiLFxuICAgICAgICBBUFBfVElUTEU6IFwiU01BUCAtIENoaWxkIFNjaGVkdWxlIGFuZCBMb2NhdGlvbiBUcmFja2luZ1wiLFxuICAgICAgICBERVNDUklQVElPTjogXCJGcm9tIGNoaWxkIGxvY2F0aW9uIHRyYWNraW5nIHRvIHNjaGVkdWxlIHNoYXJpbmcsIGV2ZXJ5dGhpbmcgaW4gb25lIHBsYWNlLlwiXG4gICAgICB9O1xuICB9XG59O1xuXG4vLyBBUEkg7YKkXG5leHBvcnQgY29uc3QgQVBJX0tFWVMgPSB7XG4gIC8vIEdvb2dsZSBNYXBzIEFQSSDtgqQg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxuICAvLyDrj5nsoIEg64Sk7J2067KEIOyngOuPhCBDbGllbnQgSUQgKOuPhOuplOyduOuzhCDsnpDrj5kg7ISg7YOdKVxuICBnZXQgTkFWRVJfTUFQU19DTElFTlRfSUQoKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBjdXJyZW50RG9tYWluID0gd2luZG93LmxvY2F0aW9uLmhvc3Q7XG4gICAgICBjb25zdCBkb21haW5DbGllbnRJZCA9IE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU1tjdXJyZW50RG9tYWluIGFzIGtleW9mIHR5cGVvZiBNQVBfQ09ORklHLk5BVkVSLkNMSUVOVF9JRFNdO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9IOqwkOyngCDrsI8g66Gc6rmFXG4gICAgICBjb25zdCBpc1ZlcmNlbCA9IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ3ZlcmNlbC5hcHAnKSB8fCBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCduZXh0c3RlcC5zbWFwLnNpdGUnKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCB8fCAn6riw67O46rCSJ31gKTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyveyXkOyEnOuKlCDtmZjqsr0g67OA7IiYIOyasOyEoCDsgqzsmqlcbiAgICAgIGlmIChpc1ZlcmNlbCAmJiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19OQVZFUl9NQVBTX0NMSUVOVF9JRCkge1xuICAgICAgICBjb25zb2xlLmxvZyhg8J+Xuu+4jyBbTkFWRVIgTUFQU10gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19OQVZFUl9NQVBTX0NMSUVOVF9JRC5zdWJzdHJpbmcoMCwgOCl9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19OQVZFUl9NQVBTX0NMSUVOVF9JRDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRvbWFpbkNsaWVudElkIHx8IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEIHx8ICc5MXkybmgweWZmJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEIHx8ICc5MXkybmgweWZmJztcbiAgfSxcbiAgTkFWRVJfTUFQU19BUElfS0VZOiAnYktSemtGQmJBdmZkSERUWkIwbUo4MWptTzh1ZlVMdlFhdlFJUVptcCcsXG4gIE1BUEJPWF9BQ0NFU1NfVE9LRU46IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX01BUEJPWF9BQ0NFU1NfVE9LRU4gfHwgJycsXG4gIFxuICAvLyDshozshZwv66mU7Iuc7KeVIEFQSSDtgqRcbiAgS0FLQU9fSkFWQVNDUklQVF9LRVk6ICdlN2UxYzkyMWU1MDZlMTkwODc1YjRjOGY0MzIxYzVhYycsXG4gIEtBS0FPX05BVElWRUFQUF9LRVk6ICc1NmIzNGI1ZTVlNTM4MDczODA1NTU5Y2FiYzgxZTFkOCcsXG4gIEtBS0FPX1JFU1RfQVBJX0tFWTogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfS0FLQU9fTUFQU19BUElfS0VZIHx8ICc3ZmJmNjA1NzFkYWY1NGNhNWJlZTgzNzNhMWYzMWQyZCcsIC8vIOy5tOy5tOyYpCDroZzsu6wgQVBJ7JqpIFJFU1QgQVBJIO2CpCDstpTqsIBcbiAgRklSRUJBU0VLRVk6ICdCT0N6a1g0NXpFM3UwSEZmTnBmWkRiVUhIMzNPSE5vZTNrNUtlVGFsRWVzSGduYUJxQ3lrakpVeG5EY1M2bXY5TVBTeFU4RVYzUUhDTDYxZ213emtYbEUnLFxuICBcbiAgLy8g64+Z7KCBIEdvb2dsZSBPQXV0aCBDbGllbnQgSUQgKOuPhOuplOyduOuzhCDsnpDrj5kg7ISg7YOdKVxuICBnZXQgR09PR0xFX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIEdPT0dMRV9DT05GSUcuT0FVVEguQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0g64+E66mU7J24OiAke2N1cnJlbnREb21haW59LCBWZXJjZWw6ICR7aXNWZXJjZWx9LCBDbGllbnQgSUQ6ICR7ZG9tYWluQ2xpZW50SWQgPyBkb21haW5DbGllbnRJZC5zdWJzdHJpbmcoMCwgMTIpICsgJy4uLicgOiAn6riw67O46rCSJ31gKTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyveyXkOyEnOuKlCDtmZjqsr0g67OA7IiYIOyasOyEoCDsgqzsmqlcbiAgICAgIGlmIChpc1ZlcmNlbCAmJiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5SQIFtHT09HTEUgT0FVVEhdIFZlcmNlbCDtmZjqsr3sl5DshJwg7ZmY6rK9IOuzgOyImCDsgqzsmqk6ICR7cHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRC5zdWJzdHJpbmcoMCwgMTIpfS4uLmApO1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRvbWFpbkNsaWVudElkIHx8IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gICAgfVxuICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEIHx8ICcyODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm0uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20nO1xuICB9LFxuICBcbiAgLy8gTkNQIOq0gOugqCDtgqRcbiAgTkNQX0FDQ0VTU19LRVk6IFwibmNwX2lhbV9CUEFNS1I1YW1DWENnUlNEb2RBN1wiLFxuICBOQ1BfU0VDUkVUX0tFWTogXCJuY3BfaWFtX0JQS01LUjNFOEI4aDFKMEZoQWFmblc4Q3c4M0lLdkRvaGxcIixcbn07XG5cbi8vIOyngOuPhCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgTUFQX0NPTkZJRyA9IHtcbiAgLy8gTmF2ZXIgTWFwcyDshKTsoJVcbiAgTkFWRVI6IHtcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIEFQSeyXkCDrk7HroZ3rkJwg64+E66mU7J24IOuqqeuhnSAo7Iuk7KCcIOuEpOydtOuyhCDtgbTrnbzsmrDrk5wg7ZSM656r7Y+8IOyEpOygleqzvCDsnbzsuZgpXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAnMTE4LjY3LjEzMC43MTozMDAwJywgIC8vIElQIOyjvOyGjCDrj4TrqZTsnbhcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr1cbiAgICAgICcqLnZlcmNlbC5hcHAnLFxuICAgICAgLy8g6rCc67CcIO2ZmOqyvVxuICAgICAgJ2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICcxMjcuMC4wLjE6MzAwMCcsXG4gICAgXSxcbiAgICAvLyDtlITroZzrjZXshZgg7ZmY6rK967OEIENsaWVudCBJRCDshKTsoJVcbiAgICBDTElFTlRfSURTOiB7XG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJzogJzkxeTJuaDB5ZmYnLCAgLy8g7Jq07JiBIO2ZmOqyveyaqVxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzkxeTJuaDB5ZmYnLCAgICAgIC8vIOyKpO2FjOydtOynleyaqVxuICAgICAgJ2xvY2FsaG9zdDozMDAwJzogJzkxeTJuaDB5ZmYnLCAgICAgIC8vIOqwnOuwnOyaqVxuICAgICAgLy8gVmVyY2VsIO2ZmOqyveydgCDtmZjqsr0g67OA7IiY7JeQ7IScIOqwgOyguOyYtFxuICAgIH0sXG4gICAgLy8g64Sk7J2067KEIOyngOuPhCDsmLXshZhcbiAgICBERUZBVUxUX09QVElPTlM6IHtcbiAgICAgIG1hcFR5cGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHNjYWxlQ29udHJvbDogZmFsc2UsXG4gICAgICB6b29tOiAxNlxuICAgIH1cbiAgfSxcbiAgLy8gR29vZ2xlIE1hcHMg7ISk7KCVIOygnOqxsOuQqCAo7IKs7Jqp7ZWY7KeAIOyViuydjClcbn07XG5cbi8vIEdvb2dsZSDshJzruYTsiqQg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IEdPT0dMRV9DT05GSUcgPSB7XG4gIC8vIEdvb2dsZSBPQXV0aCDshKTsoJVcbiAgT0FVVEg6IHtcbiAgICAvLyBHb29nbGUgQ29uc29sZeyXkCDrk7HroZ3rkJwg64+E66mU7J2467OEIENsaWVudCBJRFxuICAgIEFMTE9XRURfRE9NQUlOUzogW1xuICAgICAgJ25leHRzdGVwLnNtYXAuc2l0ZScsICAvLyDtmITsnqwg7Jq07JiBIOuPhOuplOyduFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJyxcbiAgICAgICdhcHAuc21hcC5zaXRlJyxcbiAgICAgICdzbWFwLnNpdGUnLFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgR29vZ2xlIE9BdXRoIENsaWVudCBJRCDshKTsoJVcbiAgICBDTElFTlRfSURTOiB7XG4gICAgICAvLyDinIUgbmV4dHN0ZXAuc21hcC5zaXRl7JqpIEdvb2dsZSBDbGllbnQgSUQgKDIwMjXrhYQgNuyblCAxNeydvCDsg53shLEpXG4gICAgICAvLyDsnbQgQ2xpZW50IElE64qUIG5leHRzdGVwLnNtYXAuc2l0ZSDrj4TrqZTsnbjsl5Ag64yA7ZW0IOyKueyduOuQnCBKYXZhU2NyaXB0IOy2nOyymOuhnCDrk7HroZ3rkJjslrQg7J6I7J2MXG4gICAgICAvLyBpT1MgVVJMIOyKpO2CpOuniDogY29tLmdvb2dsZXVzZXJjb250ZW50LmFwcHMuMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAvLyDinIUg7Iuk7KCcIOuTseuhneuQnCBDbGllbnQgSURcbiAgICAgICdhcHAyLnNtYXAuc2l0ZSc6ICcyODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm0uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20nLCAgICAgIC8vIOyKpO2FjOydtOynleyaqVxuICAgICAgJ2xvY2FsaG9zdDozMDAwJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgfSxcbiAgLy8gTWFwYm94IOyEpOyglVxuICBNQVBCT1g6IHtcbiAgICBERUZBVUxUX09QVElPTlM6IHtcbiAgICAgIHN0eWxlOiAnbWFwYm94Oi8vc3R5bGVzL21hcGJveC9zdHJlZXRzLXYxMScsXG4gICAgICB6b29tOiAxNlxuICAgIH1cbiAgfVxufTtcblxuLy8g7Lm07Lm07JikIOqzteycoCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgS0FLQU9fU0hBUkUgPSB7XG4gIFRJVExFOiAnU01BUCwg7Lmc6rWs7JmAIOqwgOyhseydhCDrjZQg6rCA6rmM7J20JyxcbiAgREVTQzogJ1NNQVDsnLzroZwg6rCA7KGxLCDsuZzqtazsmYAg7J287KCVLCDsnITsuZjrpbwg7Iuk7Iuc6rCEIOqzteycoO2VmOyEuOyalCEnLFxuICBJTUc6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9rYWthb19saW5rX2ltZy5wbmcnLFxufTtcblxuLy8g7JyE7LmYIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBMT0NBVElPTl9DT05GSUcgPSB7XG4gIFJFQ09NX0NJUkNMRTogNTAwMCwgLy8gNWttXG4gIExPQ0FUSU9OX01FTUJFUl9OVU06IDEwLCAvLyDsnITsuZgg6re466O57JuQIOy2lOqwgCDstZzrjIDqsJJcbiAgQUNDVVJBQ1k6IDUwLFxuICBTUEVFRDogMSxcbiAgTk9fUFJPRklMRV9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbm9fcHJvZmlsZS5wbmcnLFxuICBNQVBfUkVDT01fUE9JTlRfSU1HX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL21hcF9yZWNvbV9wb2ludC5wbmcnLFxuICBJTlZJVEVfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbnZpdGU/c2l0X2NvZGU9Jyxcbn07XG5cbi8vIOqyjOyLnO2MkCDshKTsoJVcbmV4cG9ydCBjb25zdCBCT0FSRF9DT05GSUcgPSB7XG4gIERFRkFVTFRfTElNSVQ6IDEwLFxuICBHUk9VUF9MSU1JVDogNyxcbiAgTk9USUNFX0xJTUlUOiA3LFxufTtcblxuLy8g7J2066+47KeAIOuwjyDtjIzsnbwg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IEZJTEVfQ09ORklHID0ge1xuICBJTUFHRV9FWFRFTlNJT05TOiBbXCJqcGdcIiwgXCJwbmdcIiwgXCJnaWZcIiwgXCJqcGVnXCIsIFwiYm1wXCJdLFxuICBOT19JTUFHRV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19pbWFnZS5wbmcnLFxuICBVUExPQURTX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL3VwbG9hZHMnLFxuICBQREZfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvcGRmJyxcbiAgRVhDRUxfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvZXhjZWwnLFxufTtcblxuLy8g6riw67O4IOugjOuNlOungSDslrjslrQg6rCQ7KeAXG5leHBvcnQgY29uc3QgZGV0ZWN0TGFuZ3VhZ2UgPSAoKTogc3RyaW5nID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIG5hdmlnYXRvci5sYW5ndWFnZS5zdWJzdHJpbmcoMCwgMik7XG4gIH1cbiAgcmV0dXJuICdrbyc7IC8vIOq4sOuzuOqwklxufTtcblxuLy8g7ZmY6rK9IOuzgOyImCAoTmV4dC5qc+ydmCDtmZjqsr0g67OA7IiY7JmAIO2Gte2VqSlcbmV4cG9ydCBjb25zdCBFTlYgPSB7XG4gIE5PREVfRU5WOiBwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAnZGV2ZWxvcG1lbnQnLFxuICBBUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCB8fCAnaHR0cHM6Ly9hcGkuc21hcC5zaXRlJyxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgQVBQX0lORk8sXG4gIEFQSV9LRVlTLFxuICBLQUtBT19TSEFSRSxcbiAgTE9DQVRJT05fQ09ORklHLFxuICBCT0FSRF9DT05GSUcsXG4gIEZJTEVfQ09ORklHLFxuICBnZXRMb2NhbGl6ZWRBcHBJbmZvLFxuICBkZXRlY3RMYW5ndWFnZSxcbiAgRU5WLFxuICBNQVBfQ09ORklHLFxuICBHT09HTEVfQ09ORklHLFxufTsgIl0sIm5hbWVzIjpbIkFQUF9JTkZPIiwiRE9NQUlOIiwiQ0ROX0hUVFAiLCJERVNJR05fSFRUUCIsIkFETUlOX05BTUUiLCJPR19JTUFHRSIsIlZFUlNJT04iLCJnZXRMb2NhbGl6ZWRBcHBJbmZvIiwibGFuZ3VhZ2UiLCJBUFBfQVVUSE9SIiwiQVBQX1RJVExFIiwiREVTQ1JJUFRJT04iLCJBUElfS0VZUyIsIk5BVkVSX01BUFNfQ0xJRU5UX0lEIiwiY3VycmVudERvbWFpbiIsIndpbmRvdyIsImxvY2F0aW9uIiwiaG9zdCIsImRvbWFpbkNsaWVudElkIiwiTUFQX0NPTkZJRyIsIk5BVkVSIiwiQ0xJRU5UX0lEUyIsImlzVmVyY2VsIiwiaW5jbHVkZXMiLCJjb25zb2xlIiwibG9nIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEIiwic3Vic3RyaW5nIiwiTkFWRVJfTUFQU19BUElfS0VZIiwiTUFQQk9YX0FDQ0VTU19UT0tFTiIsIk5FWFRfUFVCTElDX01BUEJPWF9BQ0NFU1NfVE9LRU4iLCJLQUtBT19KQVZBU0NSSVBUX0tFWSIsIktBS0FPX05BVElWRUFQUF9LRVkiLCJLQUtBT19SRVNUX0FQSV9LRVkiLCJORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkiLCJGSVJFQkFTRUtFWSIsIkdPT0dMRV9DTElFTlRfSUQiLCJHT09HTEVfQ09ORklHIiwiT0FVVEgiLCJORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEIiwiTkNQX0FDQ0VTU19LRVkiLCJOQ1BfU0VDUkVUX0tFWSIsIkFMTE9XRURfRE9NQUlOUyIsIkRFRkFVTFRfT1BUSU9OUyIsIm1hcFR5cGVDb250cm9sIiwic2NhbGVDb250cm9sIiwiem9vbSIsIk1BUEJPWCIsInN0eWxlIiwiS0FLQU9fU0hBUkUiLCJUSVRMRSIsIkRFU0MiLCJJTUciLCJMT0NBVElPTl9DT05GSUciLCJSRUNPTV9DSVJDTEUiLCJMT0NBVElPTl9NRU1CRVJfTlVNIiwiQUNDVVJBQ1kiLCJTUEVFRCIsIk5PX1BST0ZJTEVfSU1HX1VSTCIsIk1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMIiwiSU5WSVRFX1VSTCIsIkJPQVJEX0NPTkZJRyIsIkRFRkFVTFRfTElNSVQiLCJHUk9VUF9MSU1JVCIsIk5PVElDRV9MSU1JVCIsIkZJTEVfQ09ORklHIiwiSU1BR0VfRVhURU5TSU9OUyIsIk5PX0lNQUdFX1VSTCIsIlVQTE9BRFNfVVJMIiwiUERGX1VSTCIsIkVYQ0VMX1VSTCIsImRldGVjdExhbmd1YWdlIiwibmF2aWdhdG9yIiwiRU5WIiwiTk9ERV9FTlYiLCJBUElfQkFTRV9VUkwiLCJORVhUX1BVQkxJQ19BUElfQkFTRV9VUkwiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(app-pages-browser)/./src/config/index.ts\n"));
frontend/.next/static/chunks/app/layout.js:4026:eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(app-pages-browser)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(app-pages-browser)/./src/utils/navigationManager.ts\");\n/* provided dependency */ var process = __webpack_require__(/*! process */ \"(app-pages-browser)/./node_modules/next/dist/build/polyfills/process.js\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (false) {}\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (false) {}\n    const webkit = window.webkit;\n    return !!(webkit === null || webkit === void 0 ? void 0 : webkit.messageHandlers);\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (true) {\n        const isWebKitEnv = isWebKit();\n        const protocol = window.location.protocol;\n        const host = window.location.host;\n        console.log('[API CLIENT] 환경 감지:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebView(),\n            protocol,\n            host,\n            userAgent: navigator.userAgent\n        });\n        // WebKit 환경에서는 더 안정적인 URL 생성\n        if (isWebKitEnv) {\n            const baseUrl = \"\".concat(protocol, \"//\").concat(host, \"/api\");\n            console.log('[API CLIENT] WebKit 최적화 URL:', baseUrl);\n            return baseUrl;\n        }\n        return \"\".concat(protocol, \"//\").concat(host, \"/api\");\n    }\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (true) {\n        try {\n            // 새로운 토큰 키로 조회\n            let token = localStorage.getItem('smap_auth_token');\n            // 만약 새로운 키에 토큰이 없고, 기존 키에 토큰이 있다면 마이그레이션\n            if (!token) {\n                const oldToken = localStorage.getItem('auth-token');\n                if (oldToken) {\n                    console.log('[API CLIENT] 기존 토큰을 새로운 키로 마이그레이션');\n                    localStorage.setItem('smap_auth_token', oldToken);\n                    localStorage.removeItem('auth-token');\n                    token = oldToken;\n                }\n            }\n            return token;\n        } catch (error) {\n            console.error('[API CLIENT] 토큰 조회 중 오류:', error);\n            return null;\n        }\n    }\n    return null;\n};\nconst removeToken = ()=>{\n    if (true) {\n        console.log('[API CLIENT] 🧹 모든 인증 관련 localStorage 삭제 시작');\n        // 모든 인증 관련 토큰 삭제\n        localStorage.removeItem('auth-token');\n        localStorage.removeItem('smap_auth_token');\n        // 모든 사용자 정보 삭제\n        localStorage.removeItem('smap_user_data');\n        localStorage.removeItem('smap_user_info');\n        localStorage.removeItem('user_data');\n        localStorage.removeItem('user_profile');\n        localStorage.removeItem('recentUserInfo');\n        // 로그인 상태 플래그 삭제\n        localStorage.removeItem('isLoggedIn');\n        // 기타 인증 관련 데이터 삭제\n        localStorage.removeItem('smap_last_login_time');\n        localStorage.removeItem('last_logout_time');\n        console.log('[API CLIENT] ✅ 모든 인증 데이터 삭제 완료');\n    }\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"object\" !== 'undefined') {\n        const protocol = window.location.protocol;\n        const host = window.location.host;\n        // WebKit 환경에서는 더 안정적인 URL 구성\n        if (isWebKitEnv) {\n            config.baseURL = \"\".concat(protocol, \"//\").concat(host, \"/api\");\n            console.log('[API CLIENT] WebKit 환경 - baseURL 설정:', config.baseURL);\n        } else {\n            config.baseURL = \"\".concat(protocol, \"//\").concat(host, \"/api\");\n        }\n    } else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = \"Bearer \".concat(token);\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        var _config_method;\n        console.log(\"[API REQUEST] \".concat((_config_method = config.method) === null || _config_method === void 0 ? void 0 : _config_method.toUpperCase(), \" \").concat(config.baseURL).concat(config.url), {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(\"[API WEBKIT] 응답 시간: \".concat(responseTime, \"ms\"));\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(\"[API WEBKIT] 응답 시간 경고: \".concat(responseTime, \"ms (5초 초과)\"));\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        var _response_config_method;\n        console.log(\"[API RESPONSE] \".concat((_response_config_method = response.config.method) === null || _response_config_method === void 0 ? void 0 : _response_config_method.toUpperCase(), \" \").concat(response.config.url), {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    var _error_response, _error_response1;\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        var _error_config, _error_config1, _error_config2;\n        console.error(\"[API RESPONSE ERROR] \".concat(error.response.status, \":\"), {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: (_error_config = error.config) === null || _error_config === void 0 ? void 0 : _error_config.url,\n            method: (_error_config1 = error.config) === null || _error_config1 === void 0 ? void 0 : _error_config1.method,\n            timeout: (_error_config2 = error.config) === null || _error_config2 === void 0 ? void 0 : _error_config2.timeout\n        });\n    } else if (error.request) {\n        var _error_config3, _error_config4, _error_config5;\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: (_error_config3 = error.config) === null || _error_config3 === void 0 ? void 0 : _error_config3.url,\n            method: (_error_config4 = error.config) === null || _error_config4 === void 0 ? void 0 : _error_config4.method,\n            timeout: (_error_config5 = error.config) === null || _error_config5 === void 0 ? void 0 : _error_config5.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            var _navigator_connection;\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: ((_navigator_connection = navigator.connection) === null || _navigator_connection === void 0 ? void 0 : _navigator_connection.effectiveType) || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (((_error_response = error.response) === null || _error_response === void 0 ? void 0 : _error_response.status) === 401 && !originalRequest._retry) {\n        var _originalRequest_url;\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(\"[API CLIENT] 401 에러 발생 (연속 \".concat(consecutiveUnauthorizedCount, \"회)\"));\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if ( true && window.location.pathname !== '/signin') {\n                _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__[\"default\"].redirectToSignin();\n            }\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  true ? window.location.pathname : 0;\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if ( true && window.__SIGNIN_ERROR_MODAL_ACTIVE__) {\n            console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 401 에러 리다이렉트 방지');\n            return Promise.reject(error);\n        }\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if ((_originalRequest_url = originalRequest.url) === null || _originalRequest_url === void 0 ? void 0 : _originalRequest_url.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if ( true && window.__SIGNIN_ERROR_MODAL_ACTIVE__) {\n                console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 토큰 갱신 실패 리다이렉트 방지');\n                return Promise.reject(error);\n            }\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if ( true && window.location.pathname !== '/signin') {\n                _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__[\"default\"].redirectToSignin();\n            }\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = \"Bearer \".concat(newToken);\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if ( true && window.__SIGNIN_ERROR_MODAL_ACTIVE__) {\n                console.log('[API CLIENT] 🚫 에러 모달 표시 중 - 토큰 갱신 실패 리다이렉트 방지');\n                return Promise.reject(error);\n            }\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if ( true && window.location.pathname !== '/signin') {\n                _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__[\"default\"].redirectToSignin();\n            }\n        }\n    } else if (((_error_response1 = error.response) === null || _error_response1 === void 0 ? void 0 : _error_response1.status) !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwcC1wYWdlcy1icm93c2VyKS8uL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFpRTtBQUNQO0FBRTFELGVBQWU7QUFDZixNQUFNRSxXQUFXO0lBQ2YsSUFBSSxLQUE2QixFQUFFLEVBQWE7SUFDaEQsT0FBTyxDQUFDLENBQUMsT0FBZ0JFLE1BQU0sSUFBSUMsVUFBVUMsU0FBUyxDQUFDQyxRQUFRLENBQUM7QUFDbEU7QUFFQSxNQUFNQyxlQUFlO0lBQ25CLElBQUksS0FBNkIsRUFBRSxFQUFhO0lBQ2hELE1BQU1KLFNBQVMsT0FBZ0JBLE1BQU07SUFDckMsT0FBTyxDQUFDLEVBQUVBLG1CQUFBQSw2QkFBQUEsT0FBUUssZUFBZTtBQUNuQztBQUVBLDZCQUE2QjtBQUM3QixNQUFNQyxnQkFBZ0I7SUFDcEIsSUFBSSxJQUE2QixFQUFFO1FBQ2pDLE1BQU1DLGNBQWNUO1FBQ3BCLE1BQU1VLFdBQVdULE9BQU9VLFFBQVEsQ0FBQ0QsUUFBUTtRQUN6QyxNQUFNRSxPQUFPWCxPQUFPVSxRQUFRLENBQUNDLElBQUk7UUFFakNDLFFBQVFDLEdBQUcsQ0FBQyx1QkFBdUI7WUFDakNkLFVBQVVTO1lBQ1ZILGNBQWNBO1lBQ2RJO1lBQ0FFO1lBQ0FSLFdBQVdELFVBQVVDLFNBQVM7UUFDaEM7UUFFQSw2QkFBNkI7UUFDN0IsSUFBSUssYUFBYTtZQUNmLE1BQU1NLFVBQVUsR0FBZ0JILE9BQWJGLFVBQVMsTUFBUyxPQUFMRSxNQUFLO1lBQ3JDQyxRQUFRQyxHQUFHLENBQUMsZ0NBQWdDQztZQUM1QyxPQUFPQTtRQUNUO1FBRUEsT0FBTyxHQUFnQkgsT0FBYkYsVUFBUyxNQUFTLE9BQUxFLE1BQUs7SUFDOUI7SUFDQSxPQUFPSSxPQUFPQSxDQUFDQyxHQUFHLENBQUNDLG1CQUFtQixJQUFJO0FBQzVDO0FBRUEsTUFBTUMsZUFBZVg7QUFPckIsdUJBQXVCO0FBQ3ZCLE1BQU1ZLHdCQUF3QjtJQUM1QixNQUFNWCxjQUFjVDtJQUNwQixN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RjtJQUNGLE9BQU8sSUFBSWpELEVBQUFBLG1CQUFBQSxNQUFNNkIsUUFBUSxjQUFkN0IsdUNBQUFBLGlCQUFnQkwsTUFBTSxNQUFLLEtBQUs7UUFDekMsb0JBQW9CO1FBQ3BCVSwrQkFBK0I7SUFDakM7SUFFQSxPQUFPc0IsUUFBUUMsTUFBTSxDQUFDNUI7QUFDeEI7QUFHRixvQkFBb0I7QUFDcEJHLFVBQVVzRCxNQUFNLEdBQUcsT0FBT2hDLEtBQWFpQztJQUNyQyxNQUFNN0IsV0FBVyxNQUFNMUIsVUFBVW1ELElBQUksQ0FBQzdCLEtBQUtpQyxVQUFVO1FBQ25EbkUsU0FBUztZQUNQLGdCQUFnQjtRQUNsQjtJQUNGO0lBQ0EsT0FBT3NDLFNBQVNoQyxJQUFJO0FBQ3RCO0FBRUEsaUVBQWVNLFNBQVNBLEVBQUMiLCJzb3VyY2VzIjpbIi9Vc2Vycy9nZW5pZS9TbWFwU291cmNlL3NtYXBfbmV4dC9mcm9udGVuZC9zcmMvc2VydmljZXMvYXBpQ2xpZW50LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBheGlvcywgeyBBeGlvc0luc3RhbmNlLCBBeGlvc1JlcXVlc3RDb25maWcgfSBmcm9tICdheGlvcyc7XG5pbXBvcnQgbmF2aWdhdGlvbk1hbmFnZXIgZnJvbSAnQC91dGlscy9uYXZpZ2F0aW9uTWFuYWdlcic7XG5cbi8vIFdlYktpdCDtmZjqsr0g6rCQ7KeAXG5jb25zdCBpc1dlYktpdCA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAhISh3aW5kb3cgYXMgYW55KS53ZWJraXQgfHwgbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmNsdWRlcygnV2ViS2l0Jyk7XG59O1xuXG5jb25zdCBpc0lPU1dlYlZpZXcgPSAoKSA9PiB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCB3ZWJraXQgPSAod2luZG93IGFzIGFueSkud2Via2l0O1xuICByZXR1cm4gISEod2Via2l0Py5tZXNzYWdlSGFuZGxlcnMpO1xufTtcblxuLy8gQVBJIOq4sOuzuCBVUkwg7ISk7KCVIC0gV2ViS2l0IOy1nOygge2ZlFxuY29uc3QgZ2V0QXBpQmFzZVVybCA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IHByb3RvY29sID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sO1xuICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICBcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2ZmOqyvSDqsJDsp4A6Jywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXcoKSxcbiAgICAgIHByb3RvY29sLFxuICAgICAgaG9zdCxcbiAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudFxuICAgIH0pO1xuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJzripQg642UIOyViOygleyggeyduCBVUkwg7IOd7ISxXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zdCBiYXNlVXJsID0gYCR7cHJvdG9jb2x9Ly8ke2hvc3R9L2FwaWA7XG4gICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDstZzsoIHtmZQgVVJMOicsIGJhc2VVcmwpO1xuICAgICAgcmV0dXJuIGJhc2VVcmw7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgfVxuICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX1VSTCB8fCAnL2FwaSc7XG59O1xuXG5jb25zdCBBUElfQkFTRV9VUkwgPSBnZXRBcGlCYXNlVXJsKCk7XG5cbi8vIOy7pOyKpO2FgCBBUEkg7YG065287J207Ja47Yq4IO2DgOyehSDsoJXsnZhcbmludGVyZmFjZSBDdXN0b21BcGlDbGllbnQgZXh0ZW5kcyBBeGlvc0luc3RhbmNlIHtcbiAgdXBsb2FkOiAodXJsOiBzdHJpbmcsIGZvcm1EYXRhOiBGb3JtRGF0YSkgPT4gUHJvbWlzZTxhbnk+O1xufVxuXG4vLyBXZWJLaXQg7LWc7KCB7ZmU65CcIEF4aW9zIOyEpOyglVxuY29uc3QgY3JlYXRlQXBpQ2xpZW50Q29uZmlnID0gKCk6IEF4aW9zUmVxdWVzdENvbmZpZyA9PiB7XG4gIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgY29uc3QgaXNJT1NXZWJWaWV3RW52ID0gaXNJT1NXZWJWaWV3KCk7XG4gIFxuICBjb25zdCBjb25maWc6IEF4aW9zUmVxdWVzdENvbmZpZyA9IHtcbiAgICBiYXNlVVJMOiAnJywgLy8g64+Z7KCB7Jy866GcIOyEpOyglVxuICAgIHRpbWVvdXQ6IGlzV2ViS2l0RW52ID8gMzAwMDAgOiA2MDAwMCwgLy8gV2ViS2l07JeQ7ISc64qUIOuNlCDsp6fsnYAg7YOA7J6E7JWE7JuDICgzMOy0iClcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICdDYWNoZS1Db250cm9sJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnIDogJ2RlZmF1bHQnLFxuICAgICAgJ1ByYWdtYSc6IGlzV2ViS2l0RW52ID8gJ25vLWNhY2hlJyA6ICdkZWZhdWx0JyxcbiAgICB9LFxuICAgIHdpdGhDcmVkZW50aWFsczogZmFsc2UsXG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7ISk7KCVXG4gICAgLi4uKGlzV2ViS2l0RW52ICYmIHtcbiAgICAgIG1heFJlZGlyZWN0czogMyxcbiAgICAgIHZhbGlkYXRlU3RhdHVzOiAoc3RhdHVzKSA9PiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCxcbiAgICAgIHRyYW5zZm9ybVJlcXVlc3Q6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEsIGhlYWRlcnMpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwgSlNPTiDrjbDsnbTthLAg7KCE7IahIOy1nOygge2ZlFxuICAgICAgICAgIGlmIChkYXRhICYmIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBDTElFTlRdIEpTT04g7KeB66Cs7ZmUIOyYpOulmDonLCBlcnJvcik7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBbXG4gICAgICAgIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgLy8gV2ViS2l07JeQ7IScIOydkeuLtSDrjbDsnbTthLAg7YyM7IuxIOy1nOygge2ZlFxuICAgICAgICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg67CY7ZmYOicsIGRhdGEpO1xuICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICAvLyBpT1MgV2ViVmlldyDtmZjqsr3sl5DshJwg7LaU6rCAIOy1nOygge2ZlFxuICAgIC4uLihpc0lPU1dlYlZpZXdFbnYgJiYge1xuICAgICAgdGltZW91dDogMjUwMDAsIC8vIGlPUyBXZWJWaWV37JeQ7ISc64qUIOuNlOyasSDsp6fsnYAg7YOA7J6E7JWE7JuDXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJzogJ1NNQVAtaU9TLVdlYlZpZXcnLFxuICAgICAgICAnWC1DbGllbnQtSW5mbyc6IG5hdmlnYXRvci51c2VyQWdlbnQsIC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICAgICdDYWNoZS1Db250cm9sJzogJ25vLWNhY2hlLCBuby1zdG9yZSwgbXVzdC1yZXZhbGlkYXRlJyxcbiAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICdFeHBpcmVzJzogJzAnXG4gICAgICB9XG4gICAgfSlcbiAgfTtcbiAgXG4gIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ISk7KCVIOyDneyEsSDsmYTro4w6Jywge1xuICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICB0aW1lb3V0OiBjb25maWcudGltZW91dCxcbiAgICBoZWFkZXJzOiBjb25maWcuaGVhZGVyc1xuICB9KTtcbiAgXG4gIHJldHVybiBjb25maWc7XG59O1xuXG4vLyBBeGlvcyDsnbjsiqTthLTsiqQg7IOd7ISxXG5jb25zdCBhcGlDbGllbnQ6IEN1c3RvbUFwaUNsaWVudCA9IGF4aW9zLmNyZWF0ZShjcmVhdGVBcGlDbGllbnRDb25maWcoKSkgYXMgQ3VzdG9tQXBpQ2xpZW50O1xuXG4vLyDrrLTtlZwg66Oo7ZSEIOuwqeyngOulvCDsnITtlZwgNDAxIOyXkOufrCDsubTsmrTthLBcbmxldCBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbmNvbnN0IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUyA9IDM7XG5sZXQgbGFzdFVuYXV0aG9yaXplZFRpbWUgPSAwO1xuXG4vLyDthqDtgbAg6rSA66asIOycoO2LuOumrO2LsFxuY29uc3QgZ2V0VG9rZW4gPSAoKTogc3RyaW5nIHwgbnVsbCA9PiB7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHRyeSB7XG4gICAgICAvLyDsg4jroZzsmrQg7Yag7YGwIO2CpOuhnCDsobDtmoxcbiAgICAgIGxldCB0b2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nKTtcblxuICAgICAgLy8g66eM7JW9IOyDiOuhnOyatCDtgqTsl5Ag7Yag7YGw7J20IOyXhuqzoCwg6riw7KG0IO2CpOyXkCDthqDtgbDsnbQg7J6I64uk66m0IOuniOydtOq3uOugiOydtOyFmFxuICAgICAgaWYgKCF0b2tlbikge1xuICAgICAgICBjb25zdCBvbGRUb2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhdXRoLXRva2VuJyk7XG4gICAgICAgIGlmIChvbGRUb2tlbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g6riw7KG0IO2GoO2BsOydhCDsg4jroZzsmrQg7YKk66GcIOuniOydtOq3uOugiOydtOyFmCcpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBvbGRUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgICB0b2tlbiA9IG9sZFRva2VuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0b2tlbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0FQSSBDTElFTlRdIO2GoO2BsCDsobDtmowg7KSRIOyYpOulmDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5jb25zdCByZW1vdmVUb2tlbiA9ICgpOiB2b2lkID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn6e5IOuqqOuToCDsnbjspp0g6rSA66CoIGxvY2FsU3RvcmFnZSDsgq3soJwg7Iuc7J6RJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyduOymnSDqtIDroKgg7Yag7YGwIOyCreygnFxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhdXRoLXRva2VuJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuICAgIFxuICAgIC8vIOuqqOuToCDsgqzsmqnsnpAg7KCV67O0IOyCreygnFxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzbWFwX3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzbWFwX3VzZXJfaW5mbycpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX2RhdGEnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgndXNlcl9wcm9maWxlJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3JlY2VudFVzZXJJbmZvJyk7XG4gICAgXG4gICAgLy8g66Gc6re47J24IOyDge2DnCDtlIzrnpjqt7gg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2lzTG9nZ2VkSW4nKTtcbiAgICBcbiAgICAvLyDquLDtg4Ag7J247KadIOq0gOugqCDrjbDsnbTthLAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfbGFzdF9sb2dpbl90aW1lJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2xhc3RfbG9nb3V0X3RpbWUnKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIOKchSDrqqjrk6Ag7J247KadIOuNsOydtO2EsCDsgq3soJwg7JmE66OMJyk7XG4gIH1cbn07XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7JqU7LKtIOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXF1ZXN0LnVzZShcbiAgKGNvbmZpZykgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDrj5nsoIHsnLzroZwgYmFzZVVSTCDshKTsoJUgKFdlYktpdCDstZzsoIHtmZQpXG4gICAgaWYgKCFjb25maWcuYmFzZVVSTCAmJiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgICBjb25zdCBob3N0ID0gd2luZG93LmxvY2F0aW9uLmhvc3Q7XG4gICAgICBcbiAgICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJzripQg642UIOyViOygleyggeyduCBVUkwg6rWs7ISxXG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uZmlnLmJhc2VVUkwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSBXZWJLaXQg7ZmY6rK9IC0gYmFzZVVSTCDshKTsoJU6JywgY29uZmlnLmJhc2VVUkwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlnLmJhc2VVUkwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFjb25maWcuYmFzZVVSTCkge1xuICAgICAgY29uZmlnLmJhc2VVUkwgPSAnL2FwaSc7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7LaU6rCAIO2XpOuNlCDshKTsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzID0ge1xuICAgICAgICAuLi5jb25maWcuaGVhZGVycyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJ1xuICAgICAgfSBhcyBhbnk7XG4gICAgICBcbiAgICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52KSB7XG4gICAgICAgIChjb25maWcuaGVhZGVycyBhcyBhbnkpWydYLVJlcXVlc3RlZC1XaXRoJ10gPSAnU01BUC1pT1MtV2ViVmlldyc7XG4gICAgICAgIChjb25maWcuaGVhZGVycyBhcyBhbnkpWydYLWlPUy1XZWJWaWV3J10gPSAndHJ1ZSc7XG4gICAgICAgIChjb25maWcuaGVhZGVycyBhcyBhbnkpWydYLUNsaWVudC1JbmZvJ10gPSBuYXZpZ2F0b3IudXNlckFnZW50OyAvLyBVc2VyLUFnZW50IOuMgOyLoCDsu6TsiqTthYAg7Zek642UIOyCrOyaqVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnbjspp3snbQg7ZWE7JqU7ZWcIOyalOyyreyXkCDthqDtgbAg7LaU6rCAXG4gICAgY29uc3QgdG9rZW4gPSBnZXRUb2tlbigpO1xuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIO2ZleyduDonLCB0b2tlbiA/ICfthqDtgbAg7J6I7J2MJyA6ICfthqDtgbAg7JeG7J2MJyk7XG4gICAgaWYgKHRva2VuKSB7XG4gICAgICBjb25maWcuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke3Rva2VufWA7XG4gICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEF1dGhvcml6YXRpb24g7Zek642UIOy2lOqwgOuQqCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsOydtCDsl4bslrTshJwgQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCAIOyViOuQqCcpO1xuICAgIH1cbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyalOyyrSDsi5zqsIQg7Lih7KCVIOyLnOyekVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgKGNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB9XG4gICAgXG4gICAgLy8g7JqU7LKtIOuhnOq5hSAoV2ViS2l0IO2ZmOqyveyXkOyEnCDrjZQg7IOB7IS47Z6IKVxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50JyB8fCBpc1dlYktpdEVudikge1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgUkVRVUVTVF0gJHtjb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke2NvbmZpZy5iYXNlVVJMfSR7Y29uZmlnLnVybH1gLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgICAgICBoZWFkZXJzOiBjb25maWcuaGVhZGVycyxcbiAgICAgICAgZGF0YTogY29uZmlnLmRhdGFcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY29uZmlnO1xuICB9LFxuICAoZXJyb3IpID0+IHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc29sZS5lcnJvcignW0FQSSBSRVFVRVNUIEVSUk9SXScsIHtcbiAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgY29uZmlnOiBlcnJvci5jb25maWdcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICB9XG4pO1xuXG4vLyBXZWJLaXQg7LWc7KCB7ZmU65CcIOydkeuLtSDsnbjthLDshYnthLBcbmFwaUNsaWVudC5pbnRlcmNlcHRvcnMucmVzcG9uc2UudXNlKFxuICAocmVzcG9uc2UpID0+IHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgaXNJT1NXZWJWaWV3RW52ID0gaXNJT1NXZWJWaWV3KCk7XG4gICAgXG4gICAgLy8g7KCV7IOBIOydkeuLtSDsi5wgNDAxIOy5tOyatO2EsCDrpqzshYtcbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID49IDIwMCAmJiByZXNwb25zZS5zdGF0dXMgPCAzMDApIHtcbiAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuICAgIH1cbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOydkeuLtSDsi5zqsIQg7Lih7KCVXG4gICAgaWYgKGlzV2ViS2l0RW52ICYmIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZSkge1xuICAgICAgY29uc3QgcmVzcG9uc2VUaW1lID0gRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhDogJHtyZXNwb25zZVRpbWV9bXNgKTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXfsl5DshJwgNey0iCDsnbTsg4Eg6rG466as66m0IOqyveqzoFxuICAgICAgaWYgKGlzSU9TV2ViVmlld0VudiAmJiByZXNwb25zZVRpbWUgPiA1MDAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW0FQSSBXRUJLSVRdIOydkeuLtSDsi5zqsIQg6rK96rOgOiAke3Jlc3BvbnNlVGltZX1tcyAoNey0iCDstIjqs7wpYCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOuNsOydtO2EsCDqsoDspp1cbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g7J2R64u1IOuNsOydtO2EsOqwgCDrrLjsnpDsl7TsnbTqs6AgSlNPTuyymOufvCDrs7TsnbTrqbQg7YyM7IuxIOyLnOuPhFxuICAgICAgICBpZiAodHlwZW9mIHJlc3BvbnNlLmRhdGEgPT09ICdzdHJpbmcnICYmIFxuICAgICAgICAgICAgKHJlc3BvbnNlLmRhdGEuc3RhcnRzV2l0aCgneycpIHx8IHJlc3BvbnNlLmRhdGEuc3RhcnRzV2l0aCgnWycpKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIFdFQktJVF0g66y47J6Q7Je0IOydkeuLtSDrjbDsnbTthLAgSlNPTiDtjIzsi7Eg7Iuc64+EJyk7XG4gICAgICAgICAgcmVzcG9uc2UuZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbQVBJIFdFQktJVF0gSlNPTiDtjIzsi7Eg7Iuk7YyoLCDsm5Drs7gg642w7J207YSwIOycoOyngDonLCBwYXJzZUVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g7J2R64u1IOuhnOq5hSAoV2ViS2l0IO2ZmOqyveyXkOyEnCDrjZQg7IOB7IS47Z6IKVxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50JyB8fCBpc1dlYktpdEVudikge1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgUkVTUE9OU0VdICR7cmVzcG9uc2UuY29uZmlnLm1ldGhvZD8udG9VcHBlckNhc2UoKX0gJHtyZXNwb25zZS5jb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgc3RhdHVzOiByZXNwb25zZS5zdGF0dXMsXG4gICAgICAgIGRhdGFUeXBlOiB0eXBlb2YgcmVzcG9uc2UuZGF0YSxcbiAgICAgICAgZGF0YVNpemU6IHJlc3BvbnNlLmRhdGEgPyBKU09OLnN0cmluZ2lmeShyZXNwb25zZS5kYXRhKS5sZW5ndGggOiAwLFxuICAgICAgICBoZWFkZXJzOiByZXNwb25zZS5oZWFkZXJzLFxuICAgICAgICAuLi4oaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lICYmIHtcbiAgICAgICAgICByZXNwb25zZVRpbWU6IERhdGUubm93KCkgLSAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWVcbiAgICAgICAgfSlcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH0sXG4gIGFzeW5jIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IG9yaWdpbmFsUmVxdWVzdCA9IGVycm9yLmNvbmZpZztcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgaXNJT1NXZWJWaWV3RW52ID0gaXNJT1NXZWJWaWV3KCk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsg4HshLjtlZwg7Jik66WYIOuhnOq5hVxuICAgIGlmIChlcnJvci5yZXNwb25zZSkge1xuICAgICAgY29uc29sZS5lcnJvcihgW0FQSSBSRVNQT05TRSBFUlJPUl0gJHtlcnJvci5yZXNwb25zZS5zdGF0dXN9OmAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgc3RhdHVzOiBlcnJvci5yZXNwb25zZS5zdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQ6IGVycm9yLnJlc3BvbnNlLnN0YXR1c1RleHQsXG4gICAgICAgIGRhdGE6IGVycm9yLnJlc3BvbnNlLmRhdGEsXG4gICAgICAgIGhlYWRlcnM6IGVycm9yLnJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIHVybDogZXJyb3IuY29uZmlnPy51cmwsXG4gICAgICAgIG1ldGhvZDogZXJyb3IuY29uZmlnPy5tZXRob2QsXG4gICAgICAgIHRpbWVvdXQ6IGVycm9yLmNvbmZpZz8udGltZW91dFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChlcnJvci5yZXF1ZXN0KSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdOicsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgZXJyb3JUeXBlOiAnbmV0d29yaycsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIGNvZGU6IGVycm9yLmNvZGUsXG4gICAgICAgIHVybDogZXJyb3IuY29uZmlnPy51cmwsXG4gICAgICAgIG1ldGhvZDogZXJyb3IuY29uZmlnPy5tZXRob2QsXG4gICAgICAgIHRpbWVvdXQ6IGVycm9yLmNvbmZpZz8udGltZW91dCxcbiAgICAgICAgcmVxdWVzdDogZXJyb3IucmVxdWVzdFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg64Sk7Yq47JuM7YGsIOyYpOulmCDsi5wg7LaU6rCAIOygleuztFxuICAgICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgV0VCS0lUIEVSUk9SXSDrhKTtirjsm4ztgawg7Jew6rKwIOyYpOulmDonLCB7XG4gICAgICAgICAgbmV0d29ya1N0YXRlOiBuYXZpZ2F0b3Iub25MaW5lID8gJ+yYqOudvOyduCcgOiAn7Jik7ZSE65287J24JyxcbiAgICAgICAgICB1c2VyQWdlbnQ6IG5hdmlnYXRvci51c2VyQWdlbnQsXG4gICAgICAgICAgY29ubmVjdGlvblR5cGU6IChuYXZpZ2F0b3IgYXMgYW55KS5jb25uZWN0aW9uPy5lZmZlY3RpdmVUeXBlIHx8ICd1bmtub3duJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignW0FQSSBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2tcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyA0MDEg7Jik66WYIOyymOumrCAo7Yag7YGwIOunjOujjCDrmJDripQg7J247KadIOyLpO2MqClcbiAgICBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDAxICYmICFvcmlnaW5hbFJlcXVlc3QuX3JldHJ5KSB7XG4gICAgICAvLyDrrLTtlZwg66Oo7ZSEIOuwqeyngDog7Jew7IaN65CcIDQwMSDsl5Drn6wg7Lm07Jq07Yq4IOymneqwgFxuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmIChub3cgLSBsYXN0VW5hdXRob3JpemVkVGltZSA8IDUwMDApIHtcbiAgICAgICAgLy8gNey0iCDsnbTrgrQg7Jew7IaNIDQwMSDsl5Drn6xcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gNey0iCDsnbTsg4Eg7KeA64Ks7Jy866m0IOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDE7XG4gICAgICB9XG4gICAgICBsYXN0VW5hdXRob3JpemVkVGltZSA9IG5vdztcblxuICAgICAgY29uc29sZS5sb2coYFtBUEkgQ0xJRU5UXSA0MDEg7JeQ65+sIOuwnOyDnSAo7Jew7IaNICR7Y29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudH3tmowpYCk7XG5cbiAgICAgIC8vIOustO2VnCDro6jtlIQg6rCQ7KeAOiAz7ZqMIOydtOyDgSDsl7Dsho0gNDAxIOyXkOufrCDrsJzsg50g7IucXG4gICAgICBpZiAoY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA+PSBNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBDTElFTlRdIPCfmqgg66y07ZWcIOujqO2UhCDqsJDsp4AhIOyXsOyGjSA0MDEg7JeQ65+s66GcIOyduO2VnCDqsJXsoJwg66Gc6re47JWE7JuDJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG4gICAgICAgIFxuICAgICAgICAvLyDroZzqt7jsnbgg7Y6Y7J207KeA66GcIOuLqCDtlZwg67KI66eMIOumrOuLpOydtOugie2KuFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICE9PSAnL3NpZ25pbicpIHtcbiAgICAgICAgICBuYXZpZ2F0aW9uTWFuYWdlci5yZWRpcmVjdFRvU2lnbmluKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgb3JpZ2luYWxSZXF1ZXN0Ll9yZXRyeSA9IHRydWU7XG5cbiAgICAgIGNvbnN0IGhhc1Rva2VuID0gISFnZXRUb2tlbigpO1xuICAgICAgY29uc3QgY3VycmVudFBhdGggPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSA6ICcnO1xuXG4gICAgICAvLyDwn5qrIOyXkOufrCDrqqjri6zsnbQg7ZGc7IucIOykkeydtOuptCDrpqzri6TsnbTroIntirgg67Cp7KeAXG4gICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSA0MDEg7JeQ65+sIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8g4pyFIOy0iOq4sCDruYTroZzqt7jsnbgg7IOB7YOcKO2GoO2BsCDsl4bsnYwp7JeQ7ISc64qUIOumrOuLpOydtOugie2KuC/thqDtgbDqsLHsi6Ag7Iuc64+E7ZWY7KeAIOyViuqzoCDsobDsmqntnogg7Iuk7YyoIOuwmO2ZmFxuICAgICAgaWYgKCFoYXNUb2tlbikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIDQwMSAo7LSI6riwIOu5hOuhnOq3uOyduCkgLSDrpqzri6TsnbTroIntirgv66as7ZSE66CI7IucIOyDneuetScpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFiyAo7KCV7IOB7KCB7J24IOu5hOuhnOq3uOyduCDsg4Htg5wpXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIC8vIHJlZnJlc2gg7JqU7LKtIOyekOyytOqwgCA0MDHsnbTrqbQg7Yag7YGwIOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK7J2MXG4gICAgICBpZiAob3JpZ2luYWxSZXF1ZXN0LnVybD8uaW5jbHVkZXMoJy9hdXRoL3JlZnJlc2gnKSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7JqU7LKt7J20IDQwMSAtIOustO2aqO2VnCDthqDtgbDsnLzroZwg7YyQ64uo7ZWY7JesIOuhnOq3uOyVhOybgyDsspjrpqwnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcblxuICAgICAgICAvLyDwn5qrIOyXkOufrCDrqqjri6zsnbQg7ZGc7IucIOykkeydtOuptCDrpqzri6TsnbTroIntirgg67Cp7KeAXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfmqsg7JeQ65+sIOuqqOuLrCDtkZzsi5wg7KSRIC0g7Yag7YGwIOqwseyLoCDsi6TtjKgg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDroZzqt7jsnbgg7Y6Y7J207KeA66GcIOumrOuLpOydtOugie2KuCAoTmF2aWdhdGlvbk1hbmFnZXIg7IKs7JqpKVxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICE9PSAnL3NpZ25pbicpIHtcbiAgICAgICAgICBuYXZpZ2F0aW9uTWFuYWdlci5yZWRpcmVjdFRvU2lnbmluKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyLnOuPhCcpO1xuICAgICAgICAvLyDthqDtgbAg6rCx7IugIOyLnOuPhFxuICAgICAgICBjb25zdCByZWZyZXNoUmVzcG9uc2UgPSBhd2FpdCBhcGlDbGllbnQucG9zdCgnL2F1dGgvcmVmcmVzaCcpO1xuICAgICAgICBjb25zdCBuZXdUb2tlbiA9IHJlZnJlc2hSZXNwb25zZS5kYXRhLnRva2VuO1xuXG4gICAgICAgIGlmIChuZXdUb2tlbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDshLHqs7UnKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc21hcF9hdXRoX3Rva2VuJywgbmV3VG9rZW4pO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhdXRoLXRva2VuJywgbmV3VG9rZW4pOyAvLyDtlZjsnIQg7Zi47ZmY7ISxXG4gICAgICAgICAgb3JpZ2luYWxSZXF1ZXN0LmhlYWRlcnMuQXV0aG9yaXphdGlvbiA9IGBCZWFyZXIgJHtuZXdUb2tlbn1gO1xuICAgICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDshLHqs7Ug7IucIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgICByZXR1cm4gYXBpQ2xpZW50KG9yaWdpbmFsUmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKHJlZnJlc2hFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbVE9LRU4gUkVGUkVTSCBFUlJPUl06JywgcmVmcmVzaEVycm9yKTtcblxuICAgICAgICAvLyDthqDtgbAg6rCx7IugIOyLpO2MqCDsi5wg66Gc6re47JWE7JuDIOyymOumrFxuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIC0g66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIO2GoO2BsOydtCDsnojsl4jrjZgg7IKs7Jqp7J6Q6rCAIDQwMeydtOuptCDroZzqt7jsnbgg7Y6Y7J207KeA66GcIOumrOuLpOydtOugie2KuCAo7LSI6riwIOu5hOuhnOq3uOyduOydgCDsnITsl5DshJwgcmV0dXJu65CoKVxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICE9PSAnL3NpZ25pbicpIHtcbiAgICAgICAgICBuYXZpZ2F0aW9uTWFuYWdlci5yZWRpcmVjdFRvU2lnbmluKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlc3BvbnNlPy5zdGF0dXMgIT09IDQwMSkge1xuICAgICAgLy8gNDAx7J20IOyVhOuLjCDqsr3smrAg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIO2MjOydvCDsl4XroZzrk5zrpbwg7JyE7ZWcIOuplOyEnOuTnCDstpTqsIBcbmFwaUNsaWVudC51cGxvYWQgPSBhc3luYyAodXJsOiBzdHJpbmcsIGZvcm1EYXRhOiBGb3JtRGF0YSkgPT4ge1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KHVybCwgZm9ybURhdGEsIHtcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQ29udGVudC1UeXBlJzogJ211bHRpcGFydC9mb3JtLWRhdGEnLFxuICAgIH0sXG4gIH0pO1xuICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGFwaUNsaWVudDsgIl0sIm5hbWVzIjpbImF4aW9zIiwibmF2aWdhdGlvbk1hbmFnZXIiLCJpc1dlYktpdCIsIndpbmRvdyIsIndlYmtpdCIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImluY2x1ZGVzIiwiaXNJT1NXZWJWaWV3IiwibWVzc2FnZUhhbmRsZXJzIiwiZ2V0QXBpQmFzZVVybCIsImlzV2ViS2l0RW52IiwicHJvdG9jb2wiLCJsb2NhdGlvbiIsImhvc3QiLCJjb25zb2xlIiwibG9nIiwiYmFzZVVybCIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1BVQkxJQ19BUElfVVJMIiwiQVBJX0JBU0VfVVJMIiwiY3JlYXRlQXBpQ2xpZW50Q29uZmlnIiwiaXNJT1NXZWJWaWV3RW52IiwiY29uZmlnIiwiYmFzZVVSTCIsInRpbWVvdXQiLCJoZWFkZXJzIiwid2l0aENyZWRlbnRpYWxzIiwibWF4UmVkaXJlY3RzIiwidmFsaWRhdGVTdGF0dXMiLCJzdGF0dXMiLCJ0cmFuc2Zvcm1SZXF1ZXN0IiwiZGF0YSIsIkpTT04iLCJzdHJpbmdpZnkiLCJlcnJvciIsInRyYW5zZm9ybVJlc3BvbnNlIiwicGFyc2UiLCJhcGlDbGllbnQiLCJjcmVhdGUiLCJjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50IiwiTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTIiwibGFzdFVuYXV0aG9yaXplZFRpbWUiLCJnZXRUb2tlbiIsInRva2VuIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsIm9sZFRva2VuIiwic2V0SXRlbSIsInJlbW92ZUl0ZW0iLCJyZW1vdmVUb2tlbiIsImludGVyY2VwdG9ycyIsInJlcXVlc3QiLCJ1c2UiLCJBdXRob3JpemF0aW9uIiwiX3JlcXVlc3RTdGFydFRpbWUiLCJEYXRlIiwibm93IiwibWV0aG9kIiwidG9VcHBlckNhc2UiLCJ1cmwiLCJtZXNzYWdlIiwiUHJvbWlzZSIsInJlamVjdCIsInJlc3BvbnNlIiwicmVzcG9uc2VUaW1lIiwid2FybiIsInN0YXJ0c1dpdGgiLCJwYXJzZUVycm9yIiwiZGF0YVR5cGUiLCJkYXRhU2l6ZSIsImxlbmd0aCIsIm9yaWdpbmFsUmVxdWVzdCIsInN0YXR1c1RleHQiLCJlcnJvclR5cGUiLCJjb2RlIiwibmV0d29ya1N0YXRlIiwib25MaW5lIiwiY29ubmVjdGlvblR5cGUiLCJjb25uZWN0aW9uIiwiZWZmZWN0aXZlVHlwZSIsInN0YWNrIiwiX3JldHJ5IiwicGF0aG5hbWUiLCJyZWRpcmVjdFRvU2lnbmluIiwiaGFzVG9rZW4iLCJjdXJyZW50UGF0aCIsIl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fIiwicmVmcmVzaFJlc3BvbnNlIiwicG9zdCIsIm5ld1Rva2VuIiwicmVmcmVzaEVycm9yIiwidXBsb2FkIiwiZm9ybURhdGEiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(app-pages-browser)/./src/services/apiClient.ts\n"));
Android/app/build/generated/source/buildConfig/debug/com/dmonster/smap/BuildConfig.java:13:  public static final String API_BASE_URL = "https://api3.aiagnt.kr/api/v1/";
Android/app/build/generated/source/buildConfig/release/com/dmonster/smap/BuildConfig.java:13:  public static final String API_BASE_URL = "https://api3.aiagnt.kr/api/v1/";
Android/app/build/generated/source/buildConfig/androidTest/debug/com/dmonster/smap/test/BuildConfig.java:11:  public static final String API_BASE_URL = "https://api3.aiagnt.kr/api/v1/";
frontend/.next/server/app/legal/terms/page.js:236:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/legal/terms/page.js:439:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/legal/terms/page.js:516:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
frontend/.next/server/app/legal/privacy/page.js:236:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/legal/privacy/page.js:439:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/legal/privacy/page.js:516:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
frontend/.next/server/app/setting/service/page.js:257:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/setting/service/page.js:525:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/setting/service/page.js:613:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9zcmMvc2VydmljZXMvYXBpQ2xpZW50LnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFpRTtBQUNQO0FBRTFELGVBQWU7QUFDZixNQUFNRSxXQUFXO0lBQ2YsSUFBSSxJQUE2QixFQUFFLE9BQU87SUFDMUMsT0FBTyxDQUFDLENBQUMsT0FBZ0JFLE1BQU0sSUFBSUMsVUFBVUMsU0FBUyxDQUFDQyxRQUFRLENBQUM7QUFDbEU7QUFFQSxNQUFNQyxlQUFlO0lBQ25CLElBQUksSUFBNkIsRUFBRSxPQUFPO0lBQzFDLE1BQU1KLFNBQVMsT0FBZ0JBLE1BQU07SUFDckMsT0FBTyxDQUFDLENBQUVBLFFBQVFLO0FBQ3BCO0FBRUEsNkJBQTZCO0FBQzdCLE1BQU1DLGdCQUFnQjtJQUNwQixJQUFJLEtBQTZCLEVBQUUsRUFxQmxDO0lBQ0QsT0FBT1EsUUFBUUMsR0FBRyxDQUFDQyxtQkFBbUIsSUFBSTtBQUM1QztBQUVBLE1BQU1DLGVBQWVYO0FBT3JCLHVCQUF1QjtBQUN2QixNQUFNWSx3QkFBd0I7SUFDNUIsTUFBTVgsY0FBY1Q7SUFDcEIsTUFBTXFCLGtCQUFrQmY7SUFFeEIsTUFBTWdCLFNBQTZCO1FBQ2pDQyxTQUFTO1FBQ1RDLFNBQVNmLGNBQWMsUUFBUTtRQUMvQmdCLFNBQVM7WUFDUCxnQkFBZ0I7WUFDaEIsVUFBVTtZQUNWLGlCQUFpQmhCLGNBQWMsd0NBQXdDO1lBQ3ZFLFVBQVVBLGNBQWMsYUFBYTtRQUN2QztRQUNBaUIsaUJBQWlCO1FBRWpCLG9CQUFvQjtRQUNwQixHQUFJakIsZUFBZTtZQUNqQmtCLGNBQWM7WUFDZEMsZ0JBQWdCLENBQUNDLFNBQVdBLFVBQVUsT0FBT0EsU0FBUztZQUN0REMsa0JBQWtCO2dCQUNoQixTQUFVQyxJQUFJLEVBQUVOLE9BQU87b0JBQ3JCLDJCQUEyQjtvQkFDM0IsSUFBSU0sUUFBUSxPQUFPQSxTQUFTLFVBQVU7d0JBQ3BDLElBQUk7NEJBQ0YsT0FBT0MsS0FBS0MsU0FBUyxDQUFDRjt3QkFDeEIsRUFBRSxPQUFPRyxPQUFPOzRCQUNkckIsUUFBUXFCLEtBQUssQ0FBQyw2QkFBNkJBOzRCQUMzQyxPQUFPSDt3QkFDVDtvQkFDRjtvQkFDQSxPQUFPQTtnQkFDVDthQUNEO1lBQ0RJLG1CQUFtQjtnQkFDakIsU0FBVUosSUFBSTtvQkFDWix5QkFBeUI7b0JBQ3pCLElBQUksT0FBT0EsU0FBUyxVQUFVO3dCQUM1QixJQUFJOzRCQUNGLE9BQU9DLEtBQUtJLEtBQUssQ0FBQ0w7d0JBQ3BCLEVBQUUsT0FBT0csT0FBTzs0QkFDZHJCLFFBQVFDLEdBQUcsQ0FBQyx1Q0FBdUNpQjs0QkFDbkQsT0FBT0E7d0JBQ1Q7b0JBQ0Y7b0JBQ0EsT0FBT0E7Z0JBQ1Q7YUFDRDtRQUNILENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsR0FBSVYsbUJBQW1CO1lBQ3JCRyxTQUFTO1lBQ1RDLFNBQVM7Z0JBQ1AsZ0JBQWdCO2dCQUNoQixVQUFVO2dCQUNWLG9CQUFvQjtnQkFDcEIsaUJBQWlCdEIsVUFBVUMsU0FBUztnQkFDcEMsaUJBQWlCO2dCQUNqQixVQUFVO2dCQUNWLFdBQVc7WUFDYjtRQUNGLENBQUM7SUFDSDtJQUVBUyxRQUFRQyxHQUFHLENBQUMsMEJBQTBCO1FBQ3BDZCxVQUFVUztRQUNWSCxjQUFjZTtRQUNkRyxTQUFTRixPQUFPRSxPQUFPO1FBQ3ZCQyxTQUFTSCxPQUFPRyxPQUFPO0lBQ3pCO0lBRUEsT0FBT0g7QUFDVDtBQUVBLGdCQUFnQjtBQUNoQixNQUFNZSxZQUE2QnZDLDZDQUFLQSxDQUFDd0MsTUFBTSxDQUFDbEI7QUFFaEQsMEJBQTBCO0FBQzFCLElBQUltQiwrQkFBK0I7QUFDbkMsTUFBTUMsMkJBQTJCO0FBQ2pDLElBQUlDLHVCQUF1QjtBQUUzQixhQUFhO0FBQ2IsTUFBTUMsV0FBVztJQUNmLElBQUksS0FBNkIsRUFBRSxFQXFCbEM7SUFDRCxPQUFPO0FBQ1Q7QUFFQSxNQUFNTyxjQUFjO0lBQ2xCLElBQUksS0FBNkIsRUFBRSxFQXNCbEM7QUFDSDtBQUVBLHNCQUFzQjtBQUN0QlosVUFBVWEsWUFBWSxDQUFDQyxPQUFPLENBQUNDLEdBQUcsQ0FDaEMsQ0FBQzlCO0lBQ0MsTUFBTWIsY0FBY1Q7SUFDcEIsTUFBTXFCLGtCQUFrQmY7SUFFeEIsK0JBQStCO0lBQy9CLElBQUksQ0FBQ2dCLE9BQU9DLE9BQU8sSUFBSSxnQkFBa0IsYUFBYSxFQVdyRCxNQUFNLElBQUksQ0FBQ0QsT0FBT0MsT0FBTyxFQUFFO1FBQzFCRCxPQUFPQyxPQUFPLEdBQUc7SUFDbkI7SUFFQSx1QkFBdUI7SUFDdkIsSUFBSWQsYUFBYTtRQUNmYSxPQUFPRyxPQUFPLEdBQUc7WUFDZixHQUFHSCxPQUFPRyxPQUFPO1lBQ2pCLFVBQVU7WUFDVixpQkFBaUI7WUFDakIsVUFBVTtRQUNaO1FBRUEseUJBQXlCO1FBQ3pCLElBQUlKLGlCQUFpQjtZQUNsQkMsT0FBT0csT0FBTyxDQUFTLG1CQUFtQixHQUFHO1lBQzdDSCxPQUFPRyxPQUFPLENBQVMsZ0JBQWdCLEdBQUc7WUFDMUNILE9BQU9HLE9BQU8sQ0FBUyxnQkFBZ0IsR0FBR3RCLFVBQVVDLFNBQVMsRUFBRSwwQkFBMEI7UUFDNUY7SUFDRjtJQUVBLG9CQUFvQjtJQUNwQixNQUFNdUMsUUFBUUQ7SUFDZDdCLFFBQVFDLEdBQUcsQ0FBQyx1QkFBdUI2QixRQUFRLFVBQVU7SUFDckQsSUFBSUEsT0FBTztRQUNUckIsT0FBT0csT0FBTyxDQUFDNEIsYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFVixPQUFPO1FBQ2hEOUIsUUFBUUMsR0FBRyxDQUFDO0lBQ2QsT0FBTztRQUNMRCxRQUFRQyxHQUFHLENBQUM7SUFDZDtJQUVBLDBCQUEwQjtJQUMxQixJQUFJTCxhQUFhO1FBQ2RhLE9BQWVnQyxpQkFBaUIsR0FBR0MsS0FBS0MsR0FBRztJQUM5QztJQUVBLDRCQUE0QjtJQUM1QixJQUFJeEMsSUFBcURQLEVBQUU7UUFDekRJLFFBQVFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRVEsT0FBT21DLE1BQU0sRUFBRUMsY0FBYyxDQUFDLEVBQUVwQyxPQUFPQyxPQUFPLEdBQUdELE9BQU9xQyxHQUFHLEVBQUUsRUFBRTtZQUMxRjNELFVBQVVTO1lBQ1ZILGNBQWNlO1lBQ2RHLFNBQVNGLE9BQU9FLE9BQU87WUFDdkJDLFNBQVNILE9BQU9HLE9BQU87WUFDdkJNLE1BQU1ULE9BQU9TLElBQUk7UUFDbkI7SUFDRjtJQUVBLE9BQU9UO0FBQ1QsR0FDQSxDQUFDWTtJQUNDLE1BQU16QixjQUFjVDtJQUNwQmEsUUFBUXFCLEtBQUssQ0FBQyx1QkFBdUI7UUFDbkNsQyxVQUFVUztRQUNWeUIsT0FBT0EsTUFBTTBCLE9BQU87UUFDcEJ0QyxRQUFRWSxNQUFNWixNQUFNO0lBQ3RCO0lBQ0EsT0FBT3VDLFFBQVFDLE1BQU0sQ0FBQzVCO0FBQ3hCO0FBR0Ysc0JBQXNCO0FBQ3RCRyxVQUFVYSxZQUFZLENBQUNhLFFBQVEsQ0FBQ1gsR0FBRyxDQUNqQyxDQUFDVztJQUNDLE1BQU10RCxjQUFjVDtJQUNwQixNQUFNcUIsa0JBQWtCZjtJQUV4QixxQkFBcUI7SUFDckIsSUFBSXlELFNBQVNsQyxNQUFNLElBQUksT0FBT2tDLFNBQVNsQyxNQUFNLEdBQUcsS0FBSztRQUNuRFUsK0JBQStCO0lBQ2pDO0lBRUEsdUJBQXVCO0lBQ3ZCLElBQUk5QixlQUFlLFNBQVVhLE1BQU0sQ0FBU2dDLGlCQUFpQixFQUFFO1FBQzdELE1BQU1VLGVBQWVULEtBQUtDLEdBQUcsS0FBSyxTQUFVbEMsTUFBTSxDQUFTZ0MsaUJBQWlCO1FBQzVFekMsUUFBUUMsR0FBRyxDQUFDLENBQUMsb0JBQW9CLEVBQUVrRCxhQUFhLEVBQUUsQ0FBQztRQUVuRCw2QkFBNkI7UUFDN0IsSUFBSTNDLG1CQUFtQjJDLGVBQWUsTUFBTTtZQUMxQ25ELFFBQVFvRCxJQUFJLENBQUMsQ0FBQyx1QkFBdUIsRUFBRUQsYUFBYSxVQUFVLENBQUM7UUFDakU7SUFDRjtJQUVBLHdCQUF3QjtJQUN4QixJQUFJdkQsZUFBZXNELFNBQVNoQyxJQUFJLEVBQUU7UUFDaEMsSUFBSTtZQUNGLGlDQUFpQztZQUNqQyxJQUFJLE9BQU9nQyxTQUFTaEMsSUFBSSxLQUFLLFlBQ3hCZ0MsQ0FBQUEsU0FBU2hDLElBQUksQ0FBQ21DLFVBQVUsQ0FBQyxRQUFRSCxTQUFTaEMsSUFBSSxDQUFDbUMsVUFBVSxDQUFDLElBQUcsR0FBSTtnQkFDcEVyRCxRQUFRQyxHQUFHLENBQUM7Z0JBQ1ppRCxTQUFTaEMsSUFBSSxHQUFHQyxLQUFLSSxLQUFLLENBQUMyQixTQUFTaEMsSUFBSTtZQUMxQztRQUNGLEVBQUUsT0FBT29DLFlBQVk7WUFDbkJ0RCxRQUFRb0QsSUFBSSxDQUFDLHVDQUF1Q0U7UUFDdEQ7SUFDRjtJQUVBLDRCQUE0QjtJQUM1QixJQUFJbkQsSUFBcURQLEVBQUU7UUFDekRJLFFBQVFDLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRWlELFNBQVN6QyxNQUFNLENBQUNtQyxNQUFNLEVBQUVDLGNBQWMsQ0FBQyxFQUFFSyxTQUFTekMsTUFBTSxDQUFDcUMsR0FBRyxFQUFFLEVBQUU7WUFDNUYzRCxVQUFVUztZQUNWSCxjQUFjZTtZQUNkUSxRQUFRa0MsU0FBU2xDLE1BQU07WUFDdkJ1QyxVQUFVLE9BQU9MLFNBQVNoQyxJQUFJO1lBQzlCc0MsVUFBVU4sU0FBU2hDLElBQUksR0FBR0MsS0FBS0MsU0FBUyxDQUFDOEIsU0FBU2hDLElBQUksRUFBRXVDLE1BQU0sR0FBRztZQUNqRTdDLFNBQVNzQyxTQUFTdEMsT0FBTztZQUN6QixHQUFJaEIsZUFBZSxTQUFVYSxNQUFNLENBQVNnQyxpQkFBaUIsSUFBSTtnQkFDL0RVLGNBQWNULEtBQUtDLEdBQUcsS0FBSyxTQUFVbEMsTUFBTSxDQUFTZ0MsaUJBQWlCO1lBQ3ZFLENBQUM7UUFDSDtJQUNGO0lBRUEsT0FBT1M7QUFDVCxHQUNBLE9BQU83QjtJQUNMLE1BQU1xQyxrQkFBa0JyQyxNQUFNWixNQUFNO0lBQ3BDLE1BQU1iLGNBQWNUO0lBQ3BCLE1BQU1xQixrQkFBa0JmO0lBRXhCLHdCQUF3QjtJQUN4QixJQUFJNEIsTUFBTTZCLFFBQVEsRUFBRTtRQUNsQmxELFFBQVFxQixLQUFLLENBQUMsQ0FBQyxxQkFBcUIsRUFBRUEsTUFBTTZCLFFBQVEsQ0FBQ2xDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUM5RDdCLFVBQVVTO1lBQ1ZILGNBQWNlO1lBQ2RRLFFBQVFLLE1BQU02QixRQUFRLENBQUNsQyxNQUFNO1lBQzdCMkMsWUFBWXRDLE1BQU02QixRQUFRLENBQUNTLFVBQVU7WUFDckN6QyxNQUFNRyxNQUFNNkIsUUFBUSxDQUFDaEMsSUFBSTtZQUN6Qk4sU0FBU1MsTUFBTTZCLFFBQVEsQ0FBQ3RDLE9BQU87WUFDL0JrQyxLQUFLekIsTUFBTVosTUFBTSxFQUFFcUM7WUFDbkJGLFFBQVF2QixNQUFNWixNQUFNLEVBQUVtQztZQUN0QmpDLFNBQVNVLE1BQU1aLE1BQU0sRUFBRUU7UUFDekI7SUFDRixPQUFPLElBQUlVLE1BQU1pQixPQUFPLEVBQUU7UUFDeEJ0QyxRQUFRcUIsS0FBSyxDQUFDLHdCQUF3QjtZQUNwQ2xDLFVBQVVTO1lBQ1ZILGNBQWNlO1lBQ2RvRCxXQUFXO1lBQ1hiLFNBQVMxQixNQUFNMEIsT0FBTztZQUN0QmMsTUFBTXhDLE1BQU13QyxJQUFJO1lBQ2hCZixLQUFLekIsTUFBTVosTUFBTSxFQUFFcUM7WUFDbkJGLFFBQVF2QixNQUFNWixNQUFNLEVBQUVtQztZQUN0QmpDLFNBQVNVLE1BQU1aLE1BQU0sRUFBRUU7WUFDdkIyQixTQUFTakIsTUFBTWlCLE9BQU87UUFDeEI7UUFFQSw4QkFBOEI7UUFDOUIsSUFBSTFDLGFBQWE7WUFDZkksUUFBUXFCLEtBQUssQ0FBQyxrQ0FBa0M7Z0JBQzlDeUMsY0FBY3hFLFVBQVV5RSxNQUFNLEdBQUcsUUFBUTtnQkFDekN4RSxXQUFXRCxVQUFVQyxTQUFTO2dCQUM5QnlFLGdCQUFnQixVQUFtQkMsVUFBVSxFQUFFQyxpQkFBaUI7WUFDbEU7UUFDRjtJQUNGLE9BQU87UUFDTGxFLFFBQVFxQixLQUFLLENBQUMsZ0JBQWdCO1lBQzVCbEMsVUFBVVM7WUFDVkgsY0FBY2U7WUFDZHVDLFNBQVMxQixNQUFNMEIsT0FBTztZQUN0Qm9CLE9BQU85QyxNQUFNOEMsS0FBSztRQUNwQjtJQUNGO0lBRUEsNkJBQTZCO0lBQzdCLElBQUk5QyxNQUFNNkIsUUFBUSxFQUFFbEMsV0FBVyxPQUFPLENBQUMwQyxnQkFBZ0JVLE1BQU0sRUFBRTtRQUM3RCw4QkFBOEI7UUFDOUIsTUFBTXpCLE1BQU1ELEtBQUtDLEdBQUc7UUFDcEIsSUFBSUEsTUFBTWYsdUJBQXVCLE1BQU07WUFDckMsa0JBQWtCO1lBQ2xCRjtRQUNGLE9BQU87WUFDTCxvQkFBb0I7WUFDcEJBLCtCQUErQjtRQUNqQztRQUNBRSx1QkFBdUJlO1FBRXZCM0MsUUFBUUMsR0FBRyxDQUFDLENBQUMsMkJBQTJCLEVBQUV5Qiw2QkFBNkIsRUFBRSxDQUFDO1FBRTFFLGlDQUFpQztRQUNqQyxJQUFJQSxnQ0FBZ0NDLDBCQUEwQjtZQUM1RDNCLFFBQVFxQixLQUFLLENBQUM7WUFDZGU7WUFDQVYsK0JBQStCLEdBQUcsU0FBUztZQUUzQyx3QkFBd0I7WUFDeEIsSUFBSSxLQUF1RSxFQUFFLEVBRTVFO1lBQ0QsT0FBT3NCLFFBQVFDLE1BQU0sQ0FBQzVCO1FBQ3hCO1FBRUFxQyxnQkFBZ0JVLE1BQU0sR0FBRztRQUV6QixNQUFNRyxXQUFXLENBQUMsQ0FBQzFDO1FBQ25CLE1BQU0yQyxjQUFjLE1BQTZCLEdBQUdwRixDQUF3QixHQUFHO1FBRS9FLDRCQUE0QjtRQUM1QixJQUFJLEtBQThFLEVBQUUsRUFHbkY7UUFFRCxzREFBc0Q7UUFDdEQsSUFBSSxDQUFDbUYsVUFBVTtZQUNidkUsUUFBUUMsR0FBRyxDQUFDO1lBQ1p5QiwrQkFBK0IsR0FBRyx3QkFBd0I7WUFDMUQsT0FBT3NCLFFBQVFDLE1BQU0sQ0FBQzVCO1FBQ3hCO1FBRUEscUNBQXFDO1FBQ3JDLElBQUlxQyxnQkFBZ0JaLEdBQUcsRUFBRXRELFNBQVMsa0JBQWtCO1lBQ2xEUSxRQUFRQyxHQUFHLENBQUM7WUFDWm1DO1lBQ0FWLCtCQUErQixHQUFHLFNBQVM7WUFFM0MsNEJBQTRCO1lBQzVCLElBQUksS0FBOEUsRUFBRSxFQUduRjtZQUVELHdDQUF3QztZQUN4QyxJQUFJLEtBQXVFLEVBQUUsRUFFNUU7WUFDRCxPQUFPc0IsUUFBUUMsTUFBTSxDQUFDNUI7UUFDeEI7UUFFQSxJQUFJO1lBQ0ZyQixRQUFRQyxHQUFHLENBQUM7WUFDWixXQUFXO1lBQ1gsTUFBTXlFLGtCQUFrQixNQUFNbEQsVUFBVW1ELElBQUksQ0FBQztZQUM3QyxNQUFNQyxXQUFXRixnQkFBZ0J4RCxJQUFJLENBQUNZLEtBQUs7WUFFM0MsSUFBSThDLFVBQVU7Z0JBQ1o1RSxRQUFRQyxHQUFHLENBQUM7Z0JBQ1o4QixhQUFhRyxPQUFPLENBQUMsbUJBQW1CMEM7Z0JBQ3hDN0MsYUFBYUcsT0FBTyxDQUFDLGNBQWMwQyxXQUFXLFNBQVM7Z0JBQ3ZEbEIsZ0JBQWdCOUMsT0FBTyxDQUFDNEIsYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFb0MsVUFBVTtnQkFDNURsRCwrQkFBK0IsR0FBRyxjQUFjO2dCQUNoRCxPQUFPRixVQUFVa0M7WUFDbkI7UUFDRixFQUFFLE9BQU9tQixjQUFjO1lBQ3JCN0UsUUFBUXFCLEtBQUssQ0FBQywwQkFBMEJ3RDtZQUV4QyxxQkFBcUI7WUFDckI3RSxRQUFRQyxHQUFHLENBQUM7WUFDWm1DO1lBQ0FWLCtCQUErQixHQUFHLFNBQVM7WUFFM0MsNEJBQTRCO1lBQzVCLElBQUksS0FBOEUsRUFBRSxFQUduRjtZQUVELDJEQUEyRDtZQUMzRCxJQUFJLEtBQXVFLEVBQUUsRUFFNUU7UUFDSDtJQUNGLE9BQU8sSUFBSUwsTUFBTTZCLFFBQVEsRUFBRWxDLFdBQVcsS0FBSztRQUN6QyxvQkFBb0I7UUFDcEJVLCtCQUErQjtJQUNqQztJQUVBLE9BQU9zQixRQUFRQyxNQUFNLENBQUM1QjtBQUN4QjtBQUdGLG9CQUFvQjtBQUNwQkcsVUFBVXNELE1BQU0sR0FBRyxPQUFPaEMsS0FBYWlDO0lBQ3JDLE1BQU03QixXQUFXLE1BQU0xQixVQUFVbUQsSUFBSSxDQUFDN0IsS0FBS2lDLFVBQVU7UUFDbkRuRSxTQUFTO1lBQ1AsZ0JBQWdCO1FBQ2xCO0lBQ0Y7SUFDQSxPQUFPc0MsU0FBU2hDLElBQUk7QUFDdEI7QUFFQSxpRUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
frontend/.next/server/app/setting/terms/privacy/page.js:257:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/setting/terms/privacy/page.js:525:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/setting/terms/privacy/page.js:613:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
frontend/.next/server/app/account-deletion/withdraw/page.js:236:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/account-deletion/withdraw/page.js:450:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/account-deletion/withdraw/page.js:527:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
frontend/.next/server/app/account-deletion/page.js:236:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/config/index.ts\n");
frontend/.next/server/app/account-deletion/page.js:450:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_KEYS: () => (/* binding */ API_KEYS),\n/* harmony export */   APP_INFO: () => (/* binding */ APP_INFO),\n/* harmony export */   BOARD_CONFIG: () => (/* binding */ BOARD_CONFIG),\n/* harmony export */   ENV: () => (/* binding */ ENV),\n/* harmony export */   FILE_CONFIG: () => (/* binding */ FILE_CONFIG),\n/* harmony export */   GOOGLE_CONFIG: () => (/* binding */ GOOGLE_CONFIG),\n/* harmony export */   KAKAO_SHARE: () => (/* binding */ KAKAO_SHARE),\n/* harmony export */   LOCATION_CONFIG: () => (/* binding */ LOCATION_CONFIG),\n/* harmony export */   MAP_CONFIG: () => (/* binding */ MAP_CONFIG),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   detectLanguage: () => (/* binding */ detectLanguage),\n/* harmony export */   getLocalizedAppInfo: () => (/* binding */ getLocalizedAppInfo)\n/* harmony export */ });\n/**\n * SMAP 애플리케이션 공통 설정 파일\n * config.inc.php의 값을 TypeScript에서 사용할 수 있도록 변환\n */ // 앱 정보\nconst APP_INFO = {\n    DOMAIN: 'https://app2.aiagnt.kr',\n    CDN_HTTP: 'https://app2.aiagnt.kr',\n    DESIGN_HTTP: 'https://app2.aiagnt.kr/design',\n    ADMIN_NAME: 'SMAP',\n    OG_IMAGE: 'https://app2.aiagnt.kr/img/og-image.png',\n    VERSION: '20240522_8'\n};\n// 다국어 지원\nconst getLocalizedAppInfo = (language = 'ko')=>{\n    switch(language){\n        case 'ko':\n            return {\n                APP_AUTHOR: \"SMAP - 자녀 일정·위치 확인\",\n                APP_TITLE: \"SMAP - 자녀 일정·위치 확인\",\n                DESCRIPTION: \"자녀 위치 확인부터 일정 공유까지, 모든 것을 한 곳에서.\"\n            };\n        case 'en':\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n        case 'ja':\n            return {\n                APP_AUTHOR: \"SMAP - 子供のスケジュール・位置確認\",\n                APP_TITLE: \"SMAP - 子供のスケジュール・位置確認\",\n                DESCRIPTION: \"子供の位置確認からスケジュール共有まで、すべてを一か所で。\"\n            };\n        // 더 많은 언어 지원 추가 가능\n        default:\n            return {\n                APP_AUTHOR: \"SMAP - Child Schedule and Location Tracking\",\n                APP_TITLE: \"SMAP - Child Schedule and Location Tracking\",\n                DESCRIPTION: \"From child location tracking to schedule sharing, everything in one place.\"\n            };\n    }\n};\n// API 키\nconst API_KEYS = {\n    // Google Maps API 키 제거됨 (사용하지 않음)\n    // 동적 네이버 지도 Client ID (도메인별 자동 선택)\n    get NAVER_MAPS_CLIENT_ID () {\n        if (false) {}\n        return \"91y2nh0yff\" || 0;\n    },\n    NAVER_MAPS_API_KEY: 'bKRzkFBbAvfdHDTZB0mJ81jmO8ufULvQavQIQZmp',\n    MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',\n    // 소셜/메시징 API 키\n    KAKAO_JAVASCRIPT_KEY: 'e7e1c921e506e190875b4c8f4321c5ac',\n    KAKAO_NATIVEAPP_KEY: '56b34b5e5e538073805559cabc81e1d8',\n    KAKAO_REST_API_KEY: \"bc7899314df5dc2bebcb2a7960ac89bf\" || 0,\n    FIREBASEKEY: 'BOCzkX45zE3u0HFfNpfZDbUHH33OHNoe3k5KeTalEesHgnaBqCykjJUxnDcS6mv9MPSxU8EV3QHCL61gmwzkXlE',\n    // 동적 Google OAuth Client ID (도메인별 자동 선택)\n    get GOOGLE_CLIENT_ID () {\n        if (false) {}\n        return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';\n    },\n    // NCP 관련 키\n    NCP_ACCESS_KEY: \"ncp_iam_BPAMKR5amCXCgRSDodA7\",\n    NCP_SECRET_KEY: \"ncp_iam_BPKMKR3E8B8h1J0FhAafnW8Cw83IKvDohl\"\n};\n// 지도 관련 설정\nconst MAP_CONFIG = {\n    // Naver Maps 설정\n    NAVER: {\n        // 네이버 지도 API에 등록된 도메인 목록 (실제 네이버 클라우드 플랫폼 설정과 일치)\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            '118.67.130.71:3000',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Client ID 설정\n        CLIENT_IDS: {\n            'nextstep.aiagnt.kr': '91y2nh0yff',\n            'app2.aiagnt.kr': '91y2nh0yff',\n            'localhost:3000': '91y2nh0yff'\n        },\n        // 네이버 지도 옵션\n        DEFAULT_OPTIONS: {\n            mapTypeControl: false,\n            scaleControl: false,\n            zoom: 16\n        }\n    }\n};\n// Google 서비스 관련 설정\nconst GOOGLE_CONFIG = {\n    // Google OAuth 설정\n    OAUTH: {\n        // Google Console에 등록된 도메인별 Client ID\n        ALLOWED_DOMAINS: [\n            'nextstep.aiagnt.kr',\n            'app2.aiagnt.kr',\n            'app.aiagnt.kr',\n            'aiagnt.kr',\n            // Vercel 환경\n            '*.vercel.app',\n            // 개발 환경\n            'localhost:3000',\n            '127.0.0.1:3000'\n        ],\n        // 프로덕션 환경별 Google OAuth Client ID 설정\n        CLIENT_IDS: {\n            // ✅ nextstep.aiagnt.kr용 Google Client ID (2025년 6월 15일 생성)\n            // 이 Client ID는 nextstep.aiagnt.kr 도메인에 대해 승인된 JavaScript 출처로 등록되어 있음\n            // iOS URL 스키마: com.googleusercontent.apps.283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm\n            'nextstep.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'app2.aiagnt.kr': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com',\n            'localhost:3000': '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'\n        }\n    },\n    // Mapbox 설정\n    MAPBOX: {\n        DEFAULT_OPTIONS: {\n            style: 'mapbox://styles/mapbox/streets-v11',\n            zoom: 16\n        }\n    }\n};\n// 카카오 공유 관련 설정\nconst KAKAO_SHARE = {\n    TITLE: 'SMAP, 친구와 가족을 더 가까이',\n    DESC: 'SMAP으로 가족, 친구와 일정, 위치를 실시간 공유하세요!',\n    IMG: 'https://app2.aiagnt.kr/img/kakao_link_img.png'\n};\n// 위치 관련 설정\nconst LOCATION_CONFIG = {\n    RECOM_CIRCLE: 5000,\n    LOCATION_MEMBER_NUM: 10,\n    ACCURACY: 50,\n    SPEED: 1,\n    NO_PROFILE_IMG_URL: 'https://app2.aiagnt.kr/img/no_profile.png',\n    MAP_RECOM_POINT_IMG_URL: 'https://app2.aiagnt.kr/img/map_recom_point.png',\n    INVITE_URL: 'https://app2.aiagnt.kr/invite?sit_code='\n};\n// 게시판 설정\nconst BOARD_CONFIG = {\n    DEFAULT_LIMIT: 10,\n    GROUP_LIMIT: 7,\n    NOTICE_LIMIT: 7\n};\n// 이미지 및 파일 관련 설정\nconst FILE_CONFIG = {\n    IMAGE_EXTENSIONS: [\n        \"jpg\",\n        \"png\",\n        \"gif\",\n        \"jpeg\",\n        \"bmp\"\n    ],\n    NO_IMAGE_URL: 'https://app2.aiagnt.kr/img/no_image.png',\n    UPLOADS_URL: 'https://app2.aiagnt.kr/img/uploads',\n    PDF_URL: 'https://app2.aiagnt.kr/img/pdf',\n    EXCEL_URL: 'https://app2.aiagnt.kr/img/excel'\n};\n// 기본 렌더링 언어 감지\nconst detectLanguage = ()=>{\n    if (false) {}\n    return 'ko'; // 기본값\n};\n// 환경 변수 (Next.js의 환경 변수와 통합)\nconst ENV = {\n    NODE_ENV: \"development\" || 0,\n    API_BASE_URL: \"http://localhost:3000\" || 0\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    APP_INFO,\n    API_KEYS,\n    KAKAO_SHARE,\n    LOCATION_CONFIG,\n    BOARD_CONFIG,\n    FILE_CONFIG,\n    getLocalizedAppInfo,\n    detectLanguage,\n    ENV,\n    MAP_CONFIG,\n    GOOGLE_CONFIG\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q2ZDLGFBQWE7SUFDYkMsY0FBYztBQUNoQixFQUFFO0FBRUYsaUJBQWlCO0FBQ1YsTUFBTUMsY0FBYztJQUN6QkMsa0JBQWtCO1FBQUM7UUFBTztRQUFPO1FBQU87UUFBUTtLQUFNO0lBQ3REQyxjQUFjO0lBQ2RDLGFBQWE7SUFDYkMsU0FBUztJQUNUQyxXQUFXO0FBQ2IsRUFBRTtBQUVGLGVBQWU7QUFDUixNQUFNQyxpQkFBaUI7SUFDNUIsSUFBSSxLQUE2QixFQUFFLEVBRWxDO0lBQ0QsT0FBTyxNQUFNLE1BQU07QUFDckIsRUFBRTtBQUVGLDZCQUE2QjtBQUN0QixNQUFNRSxNQUFNO0lBQ2pCQyxVQUFVbEQsaUJBQXdCLENBQWE7SUFDL0NtRCxjQUFjbkQsdUJBQW9DLElBQUksQ0FBdUI7QUFDL0UsRUFBRTtBQUVGLGlFQUFlO0lBQ2IxQjtJQUNBWTtJQUNBdUM7SUFDQUk7SUFDQVE7SUFDQUk7SUFDQTVEO0lBQ0FrRTtJQUNBRTtJQUNBeEQ7SUFDQW9CO0FBQ0YsQ0FBQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvZ2VuaWUvU21hcFNvdXJjZS9zbWFwX25leHQvZnJvbnRlbmQvc3JjL2NvbmZpZy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNNQVAg7JWg7ZSM66as7LyA7J207IWYIOqzte2GtSDshKTsoJUg7YyM7J28XG4gKiBjb25maWcuaW5jLnBocOydmCDqsJLsnYQgVHlwZVNjcmlwdOyXkOyEnCDsgqzsmqntlaAg7IiYIOyeiOuPhOuhnSDrs4DtmZhcbiAqL1xuXG4vLyDslbEg7KCV67O0XG5leHBvcnQgY29uc3QgQVBQX0lORk8gPSB7XG4gIERPTUFJTjogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBDRE5fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUnLFxuICBERVNJR05fSFRUUDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvZGVzaWduJyxcbiAgQURNSU5fTkFNRTogJ1NNQVAnLFxuICBPR19JTUFHRTogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL29nLWltYWdlLnBuZycsXG4gIFZFUlNJT046ICcyMDI0MDUyMl84JywgLy8gQ1NTLCBKUyDsupDsi5wg66as7IWL7JqpIOuyhOyghFxufTtcblxuLy8g64uk6rWt7Ja0IOyngOybkFxuZXhwb3J0IGNvbnN0IGdldExvY2FsaXplZEFwcEluZm8gPSAobGFuZ3VhZ2U6IHN0cmluZyA9ICdrbycpID0+IHtcbiAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIEFQUF9BVVRIT1I6IFwiU01BUCAtIOyekOuFgCDsnbzsoJXCt+ychOy5mCDtmZXsnbhcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDsnpDrhYAg7J287KCVwrfsnITsuZgg7ZmV7J24XCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIuyekOuFgCDsnITsuZgg7ZmV7J2467aA7YSwIOydvOyglSDqs7XsnKDquYzsp4AsIOuqqOuToCDqsoPsnYQg7ZWcIOqzs+yXkOyEnC5cIlxuICAgICAgfTtcbiAgICBjYXNlICdlbic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSBDaGlsZCBTY2hlZHVsZSBhbmQgTG9jYXRpb24gVHJhY2tpbmdcIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwiRnJvbSBjaGlsZCBsb2NhdGlvbiB0cmFja2luZyB0byBzY2hlZHVsZSBzaGFyaW5nLCBldmVyeXRoaW5nIGluIG9uZSBwbGFjZS5cIlxuICAgICAgfTtcbiAgICBjYXNlICdqYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBBUFBfQVVUSE9SOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgQVBQX1RJVExFOiBcIlNNQVAgLSDlrZDkvpvjga7jgrnjgrHjgrjjg6Xjg7zjg6vjg7vkvY3nva7norroqo1cIixcbiAgICAgICAgREVTQ1JJUFRJT046IFwi5a2Q5L6b44Gu5L2N572u56K66KqN44GL44KJ44K544Kx44K444Ol44O844Or5YWx5pyJ44G+44Gn44CB44GZ44G544Gm44KS5LiA44GL5omA44Gn44CCXCJcbiAgICAgIH07XG4gICAgLy8g642UIOunjuydgCDslrjslrQg7KeA7JuQIOy2lOqwgCDqsIDriqVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgQVBQX0FVVEhPUjogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIEFQUF9USVRMRTogXCJTTUFQIC0gQ2hpbGQgU2NoZWR1bGUgYW5kIExvY2F0aW9uIFRyYWNraW5nXCIsXG4gICAgICAgIERFU0NSSVBUSU9OOiBcIkZyb20gY2hpbGQgbG9jYXRpb24gdHJhY2tpbmcgdG8gc2NoZWR1bGUgc2hhcmluZywgZXZlcnl0aGluZyBpbiBvbmUgcGxhY2UuXCJcbiAgICAgIH07XG4gIH1cbn07XG5cbi8vIEFQSSDtgqRcbmV4cG9ydCBjb25zdCBBUElfS0VZUyA9IHtcbiAgLy8gR29vZ2xlIE1hcHMgQVBJIO2CpCDsoJzqsbDrkKggKOyCrOyaqe2VmOyngCDslYrsnYwpXG4gIC8vIOuPmeyggSDrhKTsnbTrsoQg7KeA64+EIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBOQVZFUl9NQVBTX0NMSUVOVF9JRCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnREb21haW4gPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIGNvbnN0IGRvbWFpbkNsaWVudElkID0gTUFQX0NPTkZJRy5OQVZFUi5DTElFTlRfSURTW2N1cnJlbnREb21haW4gYXMga2V5b2YgdHlwZW9mIE1BUF9DT05GSUcuTkFWRVIuQ0xJRU5UX0lEU107XG4gICAgICBcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr0g6rCQ7KeAIOuwjyDroZzquYVcbiAgICAgIGNvbnN0IGlzVmVyY2VsID0gY3VycmVudERvbWFpbi5pbmNsdWRlcygndmVyY2VsLmFwcCcpIHx8IGN1cnJlbnREb21haW4uaW5jbHVkZXMoJ25leHRzdGVwLnNtYXAuc2l0ZScpO1xuICAgICAgY29uc29sZS5sb2coYPCfl7rvuI8gW05BVkVSIE1BUFNdIOuPhOuplOyduDogJHtjdXJyZW50RG9tYWlufSwgVmVyY2VsOiAke2lzVmVyY2VsfSwgQ2xpZW50IElEOiAke2RvbWFpbkNsaWVudElkIHx8ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5e677iPIFtOQVZFUiBNQVBTXSBWZXJjZWwg7ZmY6rK97JeQ7IScIO2ZmOqyvSDrs4DsiJgg7IKs7JqpOiAke3Byb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lELnN1YnN0cmluZygwLCA4KX0uLi5gKTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX05BVkVSX01BUFNfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQgfHwgJzkxeTJuaDB5ZmYnO1xuICB9LFxuICBOQVZFUl9NQVBTX0FQSV9LRVk6ICdiS1J6a0ZCYkF2ZmRIRFRaQjBtSjgxam1POHVmVUx2UWF2UUlRWm1wJyxcbiAgTUFQQk9YX0FDQ0VTU19UT0tFTjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiB8fCAnJyxcbiAgXG4gIC8vIOyGjOyFnC/rqZTsi5zsp5UgQVBJIO2CpFxuICBLQUtBT19KQVZBU0NSSVBUX0tFWTogJ2U3ZTFjOTIxZTUwNmUxOTA4NzViNGM4ZjQzMjFjNWFjJyxcbiAgS0FLQU9fTkFUSVZFQVBQX0tFWTogJzU2YjM0YjVlNWU1MzgwNzM4MDU1NTljYWJjODFlMWQ4JyxcbiAgS0FLQU9fUkVTVF9BUElfS0VZOiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19LQUtBT19NQVBTX0FQSV9LRVkgfHwgJzdmYmY2MDU3MWRhZjU0Y2E1YmVlODM3M2ExZjMxZDJkJywgLy8g7Lm07Lm07JikIOuhnOy7rCBBUEnsmqkgUkVTVCBBUEkg7YKkIOy2lOqwgFxuICBGSVJFQkFTRUtFWTogJ0JPQ3prWDQ1ekUzdTBIRmZOcGZaRGJVSEgzM09ITm9lM2s1S2VUYWxFZXNIZ25hQnFDeWtqSlV4bkRjUzZtdjlNUFN4VThFVjNRSENMNjFnbXd6a1hsRScsXG4gIFxuICAvLyDrj5nsoIEgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAo64+E66mU7J2467OEIOyekOuPmSDshKDtg50pXG4gIGdldCBHT09HTEVfQ0xJRU5UX0lEKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc3QgY3VycmVudERvbWFpbiA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgICAgY29uc3QgZG9tYWluQ2xpZW50SWQgPSBHT09HTEVfQ09ORklHLk9BVVRILkNMSUVOVF9JRFNbY3VycmVudERvbWFpbiBhcyBrZXlvZiB0eXBlb2YgR09PR0xFX0NPTkZJRy5PQVVUSC5DTElFTlRfSURTXTtcbiAgICAgIFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvSDqsJDsp4Ag67CPIOuhnOq5hVxuICAgICAgY29uc3QgaXNWZXJjZWwgPSBjdXJyZW50RG9tYWluLmluY2x1ZGVzKCd2ZXJjZWwuYXBwJykgfHwgY3VycmVudERvbWFpbi5pbmNsdWRlcygnbmV4dHN0ZXAuc21hcC5zaXRlJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkCBbR09PR0xFIE9BVVRIXSDrj4TrqZTsnbg6ICR7Y3VycmVudERvbWFpbn0sIFZlcmNlbDogJHtpc1ZlcmNlbH0sIENsaWVudCBJRDogJHtkb21haW5DbGllbnRJZCA/IGRvbWFpbkNsaWVudElkLnN1YnN0cmluZygwLCAxMikgKyAnLi4uJyA6ICfquLDrs7jqsJInfWApO1xuICAgICAgXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97JeQ7ISc64qUIO2ZmOqyvSDrs4DsiJgg7Jqw7ISgIOyCrOyaqVxuICAgICAgaWYgKGlzVmVyY2VsICYmIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJAgW0dPT0dMRSBPQVVUSF0gVmVyY2VsIO2ZmOqyveyXkOyEnCDtmZjqsr0g67OA7IiYIOyCrOyaqTogJHtwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lELnN1YnN0cmluZygwLCAxMil9Li4uYCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19HT09HTEVfQ0xJRU5UX0lEO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZG9tYWluQ2xpZW50SWQgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfR09PR0xFX0NMSUVOVF9JRCB8fCAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJztcbiAgICB9XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQgfHwgJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSc7XG4gIH0sXG4gIFxuICAvLyBOQ1Ag6rSA66CoIO2CpFxuICBOQ1BfQUNDRVNTX0tFWTogXCJuY3BfaWFtX0JQQU1LUjVhbUNYQ2dSU0RvZEE3XCIsXG4gIE5DUF9TRUNSRVRfS0VZOiBcIm5jcF9pYW1fQlBLTUtSM0U4QjhoMUowRmhBYWZuVzhDdzgzSUt2RG9obFwiLFxufTtcblxuLy8g7KeA64+EIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBNQVBfQ09ORklHID0ge1xuICAvLyBOYXZlciBNYXBzIOyEpOyglVxuICBOQVZFUjoge1xuICAgIC8vIOuEpOydtOuyhCDsp4Drj4QgQVBJ7JeQIOuTseuhneuQnCDrj4TrqZTsnbgg66qp66GdICjsi6TsoJwg64Sk7J2067KEIO2BtOudvOyasOuTnCDtlIzrnqvtj7wg7ISk7KCV6rO8IOydvOy5mClcbiAgICBBTExPV0VEX0RPTUFJTlM6IFtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnLCAgLy8g7ZiE7J6sIOyatOyYgSDrj4TrqZTsnbhcbiAgICAgICdhcHAyLnNtYXAuc2l0ZScsXG4gICAgICAnYXBwLnNtYXAuc2l0ZScsXG4gICAgICAnc21hcC5zaXRlJyxcbiAgICAgICcxMTguNjcuMTMwLjcxOjMwMDAnLCAgLy8gSVAg7KO87IaMIOuPhOuplOyduFxuICAgICAgLy8gVmVyY2VsIO2ZmOqyvVxuICAgICAgJyoudmVyY2VsLmFwcCcsXG4gICAgICAvLyDqsJzrsJwg7ZmY6rK9XG4gICAgICAnbG9jYWxob3N0OjMwMDAnLFxuICAgICAgJzEyNy4wLjAuMTozMDAwJyxcbiAgICBdLFxuICAgIC8vIO2UhOuhnOuNleyFmCDtmZjqsr3rs4QgQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAvLyDsmrTsmIEg7ZmY6rK97JqpXG4gICAgICAnYXBwMi5zbWFwLnNpdGUnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnOTF5Mm5oMHlmZicsICAgICAgLy8g6rCc67Cc7JqpXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK97J2AIO2ZmOqyvSDrs4DsiJjsl5DshJwg6rCA7KC47Ji0XG4gICAgfSxcbiAgICAvLyDrhKTsnbTrsoQg7KeA64+EIOyYteyFmFxuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgbWFwVHlwZUNvbnRyb2w6IGZhbHNlLFxuICAgICAgc2NhbGVDb250cm9sOiBmYWxzZSxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9LFxuICAvLyBHb29nbGUgTWFwcyDshKTsoJUg7KCc6rGw65CoICjsgqzsmqntlZjsp4Ag7JWK7J2MKVxufTtcblxuLy8gR29vZ2xlIOyEnOu5hOyKpCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgR09PR0xFX0NPTkZJRyA9IHtcbiAgLy8gR29vZ2xlIE9BdXRoIOyEpOyglVxuICBPQVVUSDoge1xuICAgIC8vIEdvb2dsZSBDb25zb2xl7JeQIOuTseuhneuQnCDrj4TrqZTsnbjrs4QgQ2xpZW50IElEXG4gICAgQUxMT1dFRF9ET01BSU5TOiBbXG4gICAgICAnbmV4dHN0ZXAuc21hcC5zaXRlJywgIC8vIO2YhOyerCDsmrTsmIEg64+E66mU7J24XG4gICAgICAnYXBwMi5zbWFwLnNpdGUnLFxuICAgICAgJ2FwcC5zbWFwLnNpdGUnLFxuICAgICAgJ3NtYXAuc2l0ZScsXG4gICAgICAvLyBWZXJjZWwg7ZmY6rK9XG4gICAgICAnKi52ZXJjZWwuYXBwJyxcbiAgICAgIC8vIOqwnOuwnCDtmZjqsr1cbiAgICAgICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAnMTI3LjAuMC4xOjMwMDAnLFxuICAgIF0sXG4gICAgLy8g7ZSE66Gc642V7IWYIO2ZmOqyveuzhCBHb29nbGUgT0F1dGggQ2xpZW50IElEIOyEpOyglVxuICAgIENMSUVOVF9JRFM6IHtcbiAgICAgIC8vIOKchSBuZXh0c3RlcC5zbWFwLnNpdGXsmqkgR29vZ2xlIENsaWVudCBJRCAoMjAyNeuFhCA27JuUIDE17J28IOyDneyEsSlcbiAgICAgIC8vIOydtCBDbGllbnQgSUTripQgbmV4dHN0ZXAuc21hcC5zaXRlIOuPhOuplOyduOyXkCDrjIDtlbQg7Iq57J2465CcIEphdmFTY3JpcHQg7Lac7LKY66GcIOuTseuhneuQmOyWtCDsnojsnYxcbiAgICAgIC8vIGlPUyBVUkwg7Iqk7YKk66eIOiBjb20uZ29vZ2xldXNlcmNvbnRlbnQuYXBwcy4yODMyNzExODA5NzItaTBhM3NhNTQzbzYxb3Y0dW9lZ2cwdGh2MWZ2Yzhmdm1cbiAgICAgICduZXh0c3RlcC5zbWFwLnNpdGUnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgIC8vIOKchSDsi6TsoJwg65Ox66Gd65CcIENsaWVudCBJRFxuICAgICAgJ2FwcDIuc21hcC5zaXRlJzogJzI4MzI3MTE4MDk3Mi1pMGEzc2E1NDNvNjFvdjR1b2VnZzB0aHYxZnZjOGZ2bS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbScsICAgICAgLy8g7Iqk7YWM7J207KeV7JqpXG4gICAgICAnbG9jYWxob3N0OjMwMDAnOiAnMjgzMjcxMTgwOTcyLWkwYTNzYTU0M282MW92NHVvZWdnMHRodjFmdmM4ZnZtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJywgICAgICAvLyDqsJzrsJzsmqlcbiAgICAgIC8vIFZlcmNlbCDtmZjqsr3snYAg7ZmY6rK9IOuzgOyImOyXkOyEnCDqsIDsoLjsmLRcbiAgICB9LFxuICB9LFxuICAvLyBNYXBib3gg7ISk7KCVXG4gIE1BUEJPWDoge1xuICAgIERFRkFVTFRfT1BUSU9OUzoge1xuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvbWFwYm94L3N0cmVldHMtdjExJyxcbiAgICAgIHpvb206IDE2XG4gICAgfVxuICB9XG59O1xuXG4vLyDsubTsubTsmKQg6rO17JygIOq0gOugqCDshKTsoJVcbmV4cG9ydCBjb25zdCBLQUtBT19TSEFSRSA9IHtcbiAgVElUTEU6ICdTTUFQLCDsuZzqtazsmYAg6rCA7KGx7J2EIOuNlCDqsIDquYzsnbQnLFxuICBERVNDOiAnU01BUOycvOuhnCDqsIDsobEsIOy5nOq1rOyZgCDsnbzsoJUsIOychOy5mOulvCDsi6Tsi5zqsIQg6rO17Jyg7ZWY7IS47JqUIScsXG4gIElNRzogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL2tha2FvX2xpbmtfaW1nLnBuZycsXG59O1xuXG4vLyDsnITsuZgg6rSA66CoIOyEpOyglVxuZXhwb3J0IGNvbnN0IExPQ0FUSU9OX0NPTkZJRyA9IHtcbiAgUkVDT01fQ0lSQ0xFOiA1MDAwLCAvLyA1a21cbiAgTE9DQVRJT05fTUVNQkVSX05VTTogMTAsIC8vIOychOy5mCDqt7jro7nsm5Ag7LaU6rCAIOy1nOuMgOqwklxuICBBQ0NVUkFDWTogNTAsXG4gIFNQRUVEOiAxLFxuICBOT19QUk9GSUxFX0lNR19VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9ub19wcm9maWxlLnBuZycsXG4gIE1BUF9SRUNPTV9QT0lOVF9JTUdfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvbWFwX3JlY29tX3BvaW50LnBuZycsXG4gIElOVklURV9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ludml0ZT9zaXRfY29kZT0nLFxufTtcblxuLy8g6rKM7Iuc7YyQIOyEpOyglVxuZXhwb3J0IGNvbnN0IEJPQVJEX0NPTkZJRyA9IHtcbiAgREVGQVVMVF9MSU1JVDogMTAsXG4gIEdST1VQX0xJTUlUOiA3LFxuICBOT1RJQ0VfTElNSVQ6IDcsXG59O1xuXG4vLyDsnbTrr7jsp4Ag67CPIO2MjOydvCDqtIDroKgg7ISk7KCVXG5leHBvcnQgY29uc3QgRklMRV9DT05GSUcgPSB7XG4gIElNQUdFX0VYVEVOU0lPTlM6IFtcImpwZ1wiLCBcInBuZ1wiLCBcImdpZlwiLCBcImpwZWdcIiwgXCJibXBcIl0sXG4gIE5PX0lNQUdFX1VSTDogJ2h0dHBzOi8vYXBwMi5zbWFwLnNpdGUvaW1nL25vX2ltYWdlLnBuZycsXG4gIFVQTE9BRFNfVVJMOiAnaHR0cHM6Ly9hcHAyLnNtYXAuc2l0ZS9pbWcvdXBsb2FkcycsXG4gIFBERl9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9wZGYnLFxuICBFWENFTF9VUkw6ICdodHRwczovL2FwcDIuc21hcC5zaXRlL2ltZy9leGNlbCcsXG59O1xuXG4vLyDquLDrs7gg66CM642U66eBIOyWuOyWtCDqsJDsp4BcbmV4cG9ydCBjb25zdCBkZXRlY3RMYW5ndWFnZSA9ICgpOiBzdHJpbmcgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gbmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cmluZygwLCAyKTtcbiAgfVxuICByZXR1cm4gJ2tvJzsgLy8g6riw67O46rCSXG59O1xuXG4vLyDtmZjqsr0g67OA7IiYIChOZXh0Lmpz7J2YIO2ZmOqyvSDrs4DsiJjsmYAg7Ya17ZWpKVxuZXhwb3J0IGNvbnN0IEVOViA9IHtcbiAgTk9ERV9FTlY6IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcsXG4gIEFQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8ICdodHRwczovL2FwaS5zbWFwLnNpdGUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBUFBfSU5GTyxcbiAgQVBJX0tFWVMsXG4gIEtBS0FPX1NIQVJFLFxuICBMT0NBVElPTl9DT05GSUcsXG4gIEJPQVJEX0NPTkZJRyxcbiAgRklMRV9DT05GSUcsXG4gIGdldExvY2FsaXplZEFwcEluZm8sXG4gIGRldGVjdExhbmd1YWdlLFxuICBFTlYsXG4gIE1BUF9DT05GSUcsXG4gIEdPT0dMRV9DT05GSUcsXG59OyAiXSwibmFtZXMiOlsiQVBQX0lORk8iLCJET01BSU4iLCJDRE5fSFRUUCIsIkRFU0lHTl9IVFRQIiwiQURNSU5fTkFNRSIsIk9HX0lNQUdFIiwiVkVSU0lPTiIsImdldExvY2FsaXplZEFwcEluZm8iLCJsYW5ndWFnZSIsIkFQUF9BVVRIT1IiLCJBUFBfVElUTEUiLCJERVNDUklQVElPTiIsIkFQSV9LRVlTIiwiTkFWRVJfTUFQU19DTElFTlRfSUQiLCJjdXJyZW50RG9tYWluIiwid2luZG93IiwibG9jYXRpb24iLCJob3N0IiwiZG9tYWluQ2xpZW50SWQiLCJNQVBfQ09ORklHIiwiTkFWRVIiLCJDTElFTlRfSURTIiwiaXNWZXJjZWwiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTkFWRVJfTUFQU19DTElFTlRfSUQiLCJzdWJzdHJpbmciLCJOQVZFUl9NQVBTX0FQSV9LRVkiLCJNQVBCT1hfQUNDRVNTX1RPS0VOIiwiTkVYVF9QVUJMSUNfTUFQQk9YX0FDQ0VTU19UT0tFTiIsIktBS0FPX0pBVkFTQ1JJUFRfS0VZIiwiS0FLQU9fTkFUSVZFQVBQX0tFWSIsIktBS0FPX1JFU1RfQVBJX0tFWSIsIk5FWFRfUFVCTElDX0tBS0FPX01BUFNfQVBJX0tFWSIsIkZJUkVCQVNFS0VZIiwiR09PR0xFX0NMSUVOVF9JRCIsIkdPT0dMRV9DT05GSUciLCJPQVVUSCIsIk5FWFRfUFVCTElDX0dPT0dMRV9DTElFTlRfSUQiLCJOQ1BfQUNDRVNTX0tFWSIsIk5DUF9TRUNSRVRfS0VZIiwiQUxMT1dFRF9ET01BSU5TIiwiREVGQVVMVF9PUFRJT05TIiwibWFwVHlwZUNvbnRyb2wiLCJzY2FsZUNvbnRyb2wiLCJ6b29tIiwiTUFQQk9YIiwic3R5bGUiLCJLQUtBT19TSEFSRSIsIlRJVExFIiwiREVTQyIsIklNRyIsIkxPQ0FUSU9OX0NPTkZJRyIsIlJFQ09NX0NJUkNMRSIsIkxPQ0FUSU9OX01FTUJFUl9OVU0iLCJBQ0NVUkFDWSIsIlNQRUVEIiwiTk9fUFJPRklMRV9JTUdfVVJMIiwiTUFQX1JFQ09NX1BPSU5UX0lNR19VUkwiLCJJTlZJVEVfVVJMIiwiQk9BUkRfQ09ORklHIiwiREVGQVVMVF9MSU1JVCIsIkdST1VQX0xJTUlUIiwiTk9USUNFX0xJTUlUIiwiRklMRV9DT05GSUciLCJJTUFHRV9FWFRFTlNJT05TIiwiTk9fSU1BR0VfVVJMIiwiVVBMT0FEU19VUkwiLCJQREZfVVJMIiwiRVhDRUxfVVJMIiwiZGV0ZWN0TGFuZ3VhZ2UiLCJuYXZpZ2F0b3IiLCJFTlYiLCJOT0RFX0VOViIsIkFQSV9CQVNFX1VSTCIsIk5FWFRfUFVCTElDX0FQSV9CQVNFX1VSTCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/config/index.ts\n");
frontend/.next/server/app/account-deletion/page.js:527:eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ \"(ssr)/./node_modules/axios/lib/axios.js\");\n/* harmony import */ var _utils_navigationManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/utils/navigationManager */ \"(ssr)/./src/utils/navigationManager.ts\");\n\n\n// WebKit 환경 감지\nconst isWebKit = ()=>{\n    if (true) return false;\n    return !!window.webkit || navigator.userAgent.includes('WebKit');\n};\nconst isIOSWebView = ()=>{\n    if (true) return false;\n    const webkit = window.webkit;\n    return !!webkit?.messageHandlers;\n};\n// API 기본 URL 설정 - WebKit 최적화\nconst getApiBaseUrl = ()=>{\n    if (false) {}\n    return process.env.NEXT_PUBLIC_API_URL || '/api';\n};\nconst API_BASE_URL = getApiBaseUrl();\n// WebKit 최적화된 Axios 설정\nconst createApiClientConfig = ()=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    const config = {\n        baseURL: '',\n        timeout: isWebKitEnv ? 30000 : 60000,\n        headers: {\n            'Content-Type': 'application/json',\n            'Accept': 'application/json',\n            'Cache-Control': isWebKitEnv ? 'no-cache, no-store, must-revalidate' : 'default',\n            'Pragma': isWebKitEnv ? 'no-cache' : 'default'\n        },\n        withCredentials: false,\n        // WebKit 환경에서 추가 설정\n        ...isWebKitEnv && {\n            maxRedirects: 3,\n            validateStatus: (status)=>status >= 200 && status < 300,\n            transformRequest: [\n                function(data, headers) {\n                    // WebKit에서 JSON 데이터 전송 최적화\n                    if (data && typeof data === 'object') {\n                        try {\n                            return JSON.stringify(data);\n                        } catch (error) {\n                            console.error('[API CLIENT] JSON 직렬화 오류:', error);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ],\n            transformResponse: [\n                function(data) {\n                    // WebKit에서 응답 데이터 파싱 최적화\n                    if (typeof data === 'string') {\n                        try {\n                            return JSON.parse(data);\n                        } catch (error) {\n                            console.log('[API CLIENT] JSON 파싱 실패, 원본 데이터 반환:', data);\n                            return data;\n                        }\n                    }\n                    return data;\n                }\n            ]\n        },\n        // iOS WebView 환경에서 추가 최적화\n        ...isIOSWebViewEnv && {\n            timeout: 25000,\n            headers: {\n                'Content-Type': 'application/json',\n                'Accept': 'application/json',\n                'X-Requested-With': 'SMAP-iOS-WebView',\n                'X-Client-Info': navigator.userAgent,\n                'Cache-Control': 'no-cache, no-store, must-revalidate',\n                'Pragma': 'no-cache',\n                'Expires': '0'\n            }\n        }\n    };\n    console.log('[API CLIENT] 설정 생성 완료:', {\n        isWebKit: isWebKitEnv,\n        isIOSWebView: isIOSWebViewEnv,\n        timeout: config.timeout,\n        headers: config.headers\n    });\n    return config;\n};\n// Axios 인스턴스 생성\nconst apiClient = axios__WEBPACK_IMPORTED_MODULE_1__[\"default\"].create(createApiClientConfig());\n// 무한 루프 방지를 위한 401 에러 카운터\nlet consecutiveUnauthorizedCount = 0;\nconst MAX_UNAUTHORIZED_RETRIES = 3;\nlet lastUnauthorizedTime = 0;\n// 토큰 관리 유틸리티\nconst getToken = ()=>{\n    if (false) {}\n    return null;\n};\nconst removeToken = ()=>{\n    if (false) {}\n};\n// WebKit 최적화된 요청 인터셉터\napiClient.interceptors.request.use((config)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 동적으로 baseURL 설정 (WebKit 최적화)\n    if (!config.baseURL && \"undefined\" !== 'undefined') {} else if (!config.baseURL) {\n        config.baseURL = '/api';\n    }\n    // WebKit 환경에서 추가 헤더 설정\n    if (isWebKitEnv) {\n        config.headers = {\n            ...config.headers,\n            'Accept': 'application/json',\n            'Cache-Control': 'no-cache, no-store, must-revalidate',\n            'Pragma': 'no-cache'\n        };\n        // iOS WebView 환경에서 추가 헤더\n        if (isIOSWebViewEnv) {\n            config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';\n            config.headers['X-iOS-WebView'] = 'true';\n            config.headers['X-Client-Info'] = navigator.userAgent; // User-Agent 대신 커스텀 헤더 사용\n        }\n    }\n    // 인증이 필요한 요청에 토큰 추가\n    const token = getToken();\n    console.log('[API CLIENT] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');\n    if (token) {\n        config.headers.Authorization = `Bearer ${token}`;\n        console.log('[API CLIENT] Authorization 헤더 추가됨');\n    } else {\n        console.log('[API CLIENT] 토큰이 없어서 Authorization 헤더 추가 안됨');\n    }\n    // WebKit 환경에서 요청 시간 측정 시작\n    if (isWebKitEnv) {\n        config._requestStartTime = Date.now();\n    }\n    // 요청 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            timeout: config.timeout,\n            headers: config.headers,\n            data: config.data\n        });\n    }\n    return config;\n}, (error)=>{\n    const isWebKitEnv = isWebKit();\n    console.error('[API REQUEST ERROR]', {\n        isWebKit: isWebKitEnv,\n        error: error.message,\n        config: error.config\n    });\n    return Promise.reject(error);\n});\n// WebKit 최적화된 응답 인터셉터\napiClient.interceptors.response.use((response)=>{\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // 정상 응답 시 401 카운터 리셋\n    if (response.status >= 200 && response.status < 300) {\n        consecutiveUnauthorizedCount = 0;\n    }\n    // WebKit 환경에서 응답 시간 측정\n    if (isWebKitEnv && response.config._requestStartTime) {\n        const responseTime = Date.now() - response.config._requestStartTime;\n        console.log(`[API WEBKIT] 응답 시간: ${responseTime}ms`);\n        // iOS WebView에서 5초 이상 걸리면 경고\n        if (isIOSWebViewEnv && responseTime > 5000) {\n            console.warn(`[API WEBKIT] 응답 시간 경고: ${responseTime}ms (5초 초과)`);\n        }\n    }\n    // WebKit 환경에서 응답 데이터 검증\n    if (isWebKitEnv && response.data) {\n        try {\n            // 응답 데이터가 문자열이고 JSON처럼 보이면 파싱 시도\n            if (typeof response.data === 'string' && (response.data.startsWith('{') || response.data.startsWith('['))) {\n                console.log('[API WEBKIT] 문자열 응답 데이터 JSON 파싱 시도');\n                response.data = JSON.parse(response.data);\n            }\n        } catch (parseError) {\n            console.warn('[API WEBKIT] JSON 파싱 실패, 원본 데이터 유지:', parseError);\n        }\n    }\n    // 응답 로깅 (WebKit 환경에서 더 상세히)\n    if (true) {\n        console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url}`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: response.status,\n            dataType: typeof response.data,\n            dataSize: response.data ? JSON.stringify(response.data).length : 0,\n            headers: response.headers,\n            ...isWebKitEnv && response.config._requestStartTime && {\n                responseTime: Date.now() - response.config._requestStartTime\n            }\n        });\n    }\n    return response;\n}, async (error)=>{\n    const originalRequest = error.config;\n    const isWebKitEnv = isWebKit();\n    const isIOSWebViewEnv = isIOSWebView();\n    // WebKit 환경에서 상세한 오류 로깅\n    if (error.response) {\n        console.error(`[API RESPONSE ERROR] ${error.response.status}:`, {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            status: error.response.status,\n            statusText: error.response.statusText,\n            data: error.response.data,\n            headers: error.response.headers,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout\n        });\n    } else if (error.request) {\n        console.error('[API REQUEST ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            errorType: 'network',\n            message: error.message,\n            code: error.code,\n            url: error.config?.url,\n            method: error.config?.method,\n            timeout: error.config?.timeout,\n            request: error.request\n        });\n        // WebKit 환경에서 네트워크 오류 시 추가 정보\n        if (isWebKitEnv) {\n            console.error('[API WEBKIT ERROR] 네트워크 연결 오류:', {\n                networkState: navigator.onLine ? '온라인' : '오프라인',\n                userAgent: navigator.userAgent,\n                connectionType: navigator.connection?.effectiveType || 'unknown'\n            });\n        }\n    } else {\n        console.error('[API ERROR]:', {\n            isWebKit: isWebKitEnv,\n            isIOSWebView: isIOSWebViewEnv,\n            message: error.message,\n            stack: error.stack\n        });\n    }\n    // 401 오류 처리 (토큰 만료 또는 인증 실패)\n    if (error.response?.status === 401 && !originalRequest._retry) {\n        // 무한 루프 방지: 연속된 401 에러 카운트 증가\n        const now = Date.now();\n        if (now - lastUnauthorizedTime < 5000) {\n            // 5초 이내 연속 401 에러\n            consecutiveUnauthorizedCount++;\n        } else {\n            // 5초 이상 지났으면 카운터 리셋\n            consecutiveUnauthorizedCount = 1;\n        }\n        lastUnauthorizedTime = now;\n        console.log(`[API CLIENT] 401 에러 발생 (연속 ${consecutiveUnauthorizedCount}회)`);\n        // 무한 루프 감지: 3회 이상 연속 401 에러 발생 시\n        if (consecutiveUnauthorizedCount >= MAX_UNAUTHORIZED_RETRIES) {\n            console.error('[API CLIENT] 🚨 무한 루프 감지! 연속 401 에러로 인한 강제 로그아웃');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 로그인 페이지로 단 한 번만 리다이렉트\n            if (false) {}\n            return Promise.reject(error);\n        }\n        originalRequest._retry = true;\n        const hasToken = !!getToken();\n        const currentPath =  false ? 0 : '';\n        // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n        if (false) {}\n        // ✅ 초기 비로그인 상태(토큰 없음)에서는 리다이렉트/토큰갱신 시도하지 않고 조용히 실패 반환\n        if (!hasToken) {\n            console.log('[API CLIENT] 401 (초기 비로그인) - 리다이렉트/리프레시 생략');\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋 (정상적인 비로그인 상태)\n            return Promise.reject(error);\n        }\n        // refresh 요청 자체가 401이면 토큰 갱신 시도하지 않음\n        if (originalRequest.url?.includes('/auth/refresh')) {\n            console.log('[API CLIENT] 토큰 갱신 요청이 401 - 무효한 토큰으로 판단하여 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 로그인 페이지로 리다이렉트 (NavigationManager 사용)\n            if (false) {}\n            return Promise.reject(error);\n        }\n        try {\n            console.log('[API CLIENT] 토큰 갱신 시도');\n            // 토큰 갱신 시도\n            const refreshResponse = await apiClient.post('/auth/refresh');\n            const newToken = refreshResponse.data.token;\n            if (newToken) {\n                console.log('[API CLIENT] 토큰 갱신 성공');\n                localStorage.setItem('smap_auth_token', newToken);\n                localStorage.setItem('auth-token', newToken); // 하위 호환성\n                originalRequest.headers.Authorization = `Bearer ${newToken}`;\n                consecutiveUnauthorizedCount = 0; // 성공 시 카운터 리셋\n                return apiClient(originalRequest);\n            }\n        } catch (refreshError) {\n            console.error('[TOKEN REFRESH ERROR]:', refreshError);\n            // 토큰 갱신 실패 시 로그아웃 처리\n            console.log('[API CLIENT] 토큰 갱신 실패 - 로그아웃 처리');\n            removeToken();\n            consecutiveUnauthorizedCount = 0; // 카운터 리셋\n            // 🚫 에러 모달이 표시 중이면 리다이렉트 방지\n            if (false) {}\n            // 토큰이 있었던 사용자가 401이면 로그인 페이지로 리다이렉트 (초기 비로그인은 위에서 return됨)\n            if (false) {}\n        }\n    } else if (error.response?.status !== 401) {\n        // 401이 아닌 경우 카운터 리셋\n        consecutiveUnauthorizedCount = 0;\n    }\n    return Promise.reject(error);\n});\n// 파일 업로드를 위한 메서드 추가\napiClient.upload = async (url, formData)=>{\n    const response = await apiClient.post(url, formData, {\n        headers: {\n            'Content-Type': 'multipart/form-data'\n        }\n    });\n    return response.data;\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (apiClient);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBZU0sU0FBU0EsRUFBQyIsInNvdXJjZXMiOlsiL1VzZXJzL2dlbmllL1NtYXBTb3VyY2Uvc21hcF9uZXh0L2Zyb250ZW5kL3NyYy9zZXJ2aWNlcy9hcGlDbGllbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZyB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCBuYXZpZ2F0aW9uTWFuYWdlciBmcm9tICdAL3V0aWxzL25hdmlnYXRpb25NYW5hZ2VyJztcblxuLy8gV2ViS2l0IO2ZmOqyvSDqsJDsp4BcbmNvbnN0IGlzV2ViS2l0ID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICEhKHdpbmRvdyBhcyBhbnkpLndlYmtpdCB8fCBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdXZWJLaXQnKTtcbn07XG5cbmNvbnN0IGlzSU9TV2ViVmlldyA9ICgpID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHdlYmtpdCA9ICh3aW5kb3cgYXMgYW55KS53ZWJraXQ7XG4gIHJldHVybiAhISh3ZWJraXQ/Lm1lc3NhZ2VIYW5kbGVycyk7XG59O1xuXG4vLyBBUEkg6riw67O4IFVSTCDshKTsoJUgLSBXZWJLaXQg7LWc7KCB7ZmUXG5jb25zdCBnZXRBcGlCYXNlVXJsID0gKCkgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBpc1dlYktpdEVudiA9IGlzV2ViS2l0KCk7XG4gICAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gICAgY29uc3QgaG9zdCA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7ZmY6rK9IOqwkOyngDonLCB7XG4gICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlldygpLFxuICAgICAgcHJvdG9jb2wsXG4gICAgICBob3N0LFxuICAgICAgdXNlckFnZW50OiBuYXZpZ2F0b3IudXNlckFnZW50XG4gICAgfSk7XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDsg53shLFcbiAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgIGNvbnN0IGJhc2VVcmwgPSBgJHtwcm90b2NvbH0vLyR7aG9zdH0vYXBpYDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gV2ViS2l0IOy1nOygge2ZlCBVUkw6JywgYmFzZVVybCk7XG4gICAgICByZXR1cm4gYmFzZVVybDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICB9XG4gIHJldHVybiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfVVJMIHx8ICcvYXBpJztcbn07XG5cbmNvbnN0IEFQSV9CQVNFX1VSTCA9IGdldEFwaUJhc2VVcmwoKTtcblxuLy8g7Luk7Iqk7YWAIEFQSSDtgbTrnbzsnbTslrjtirgg7YOA7J6FIOygleydmFxuaW50ZXJmYWNlIEN1c3RvbUFwaUNsaWVudCBleHRlbmRzIEF4aW9zSW5zdGFuY2Uge1xuICB1cGxvYWQ6ICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiBQcm9taXNlPGFueT47XG59XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwgQXhpb3Mg7ISk7KCVXG5jb25zdCBjcmVhdGVBcGlDbGllbnRDb25maWcgPSAoKTogQXhpb3NSZXF1ZXN0Q29uZmlnID0+IHtcbiAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgXG4gIGNvbnN0IGNvbmZpZzogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuICAgIGJhc2VVUkw6ICcnLCAvLyDrj5nsoIHsnLzroZwg7ISk7KCVXG4gICAgdGltZW91dDogaXNXZWJLaXRFbnYgPyAzMDAwMCA6IDYwMDAwLCAvLyBXZWJLaXTsl5DshJzripQg642UIOynp+ydgCDtg4DsnoTslYTsm4MgKDMw7LSIKVxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiBpc1dlYktpdEVudiA/ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScgOiAnZGVmYXVsdCcsXG4gICAgICAnUHJhZ21hJzogaXNXZWJLaXRFbnYgPyAnbm8tY2FjaGUnIDogJ2RlZmF1bHQnLFxuICAgIH0sXG4gICAgd2l0aENyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOy2lOqwgCDshKTsoJVcbiAgICAuLi4oaXNXZWJLaXRFbnYgJiYge1xuICAgICAgbWF4UmVkaXJlY3RzOiAzLFxuICAgICAgdmFsaWRhdGVTdGF0dXM6IChzdGF0dXMpID0+IHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwLFxuICAgICAgdHJhbnNmb3JtUmVxdWVzdDogW1xuICAgICAgICBmdW5jdGlvbiAoZGF0YSwgaGVhZGVycykge1xuICAgICAgICAgIC8vIFdlYktpdOyXkOyEnCBKU09OIOuNsOydtO2EsCDsoITshqEg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0gSlNPTiDsp4HroKztmZQg7Jik66WYOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IFtcbiAgICAgICAgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAvLyBXZWJLaXTsl5DshJwg7J2R64u1IOuNsOydtO2EsCDtjIzsi7Eg7LWc7KCB7ZmUXG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIEpTT04g7YyM7IuxIOyLpO2MqCwg7JuQ67O4IOuNsOydtO2EsCDrsJjtmZg6JywgZGF0YSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIC8vIGlPUyBXZWJWaWV3IO2ZmOqyveyXkOyEnCDstpTqsIAg7LWc7KCB7ZmUXG4gICAgLi4uKGlzSU9TV2ViVmlld0VudiAmJiB7XG4gICAgICB0aW1lb3V0OiAyNTAwMCwgLy8gaU9TIFdlYlZpZXfsl5DshJzripQg642U7JqxIOynp+ydgCDtg4DsnoTslYTsm4NcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ1gtUmVxdWVzdGVkLVdpdGgnOiAnU01BUC1pT1MtV2ViVmlldycsXG4gICAgICAgICdYLUNsaWVudC1JbmZvJzogbmF2aWdhdG9yLnVzZXJBZ2VudCwgLy8gVXNlci1BZ2VudCDrjIDsi6Ag7Luk7Iqk7YWAIO2XpOuNlCDsgqzsmqlcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnLFxuICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgJ0V4cGlyZXMnOiAnMCdcbiAgICAgIH1cbiAgICB9KVxuICB9O1xuICBcbiAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDshKTsoJUg7IOd7ISxIOyZhOujjDonLCB7XG4gICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgIHRpbWVvdXQ6IGNvbmZpZy50aW1lb3V0LFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzXG4gIH0pO1xuICBcbiAgcmV0dXJuIGNvbmZpZztcbn07XG5cbi8vIEF4aW9zIOyduOyKpO2EtOyKpCDsg53shLFcbmNvbnN0IGFwaUNsaWVudDogQ3VzdG9tQXBpQ2xpZW50ID0gYXhpb3MuY3JlYXRlKGNyZWF0ZUFwaUNsaWVudENvbmZpZygpKSBhcyBDdXN0b21BcGlDbGllbnQ7XG5cbi8vIOustO2VnCDro6jtlIQg67Cp7KeA66W8IOychO2VnCA0MDEg7JeQ65+sIOy5tOyatO2EsFxubGV0IGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwO1xuY29uc3QgTUFYX1VOQVVUSE9SSVpFRF9SRVRSSUVTID0gMztcbmxldCBsYXN0VW5hdXRob3JpemVkVGltZSA9IDA7XG5cbi8vIO2GoO2BsCDqtIDrpqwg7Jyg7Yu466as7YuwXG5jb25zdCBnZXRUb2tlbiA9ICgpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOyDiOuhnOyatCDthqDtgbAg7YKk66GcIOyhsO2ajFxuICAgICAgbGV0IHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicpO1xuXG4gICAgICAvLyDrp4zslb0g7IOI66Gc7Jq0IO2CpOyXkCDthqDtgbDsnbQg7JeG6rOgLCDquLDsobQg7YKk7JeQIO2GoO2BsOydtCDsnojri6TrqbQg66eI7J206re466CI7J207IWYXG4gICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgIGNvbnN0IG9sZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICAgICAgaWYgKG9sZFRva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDquLDsobQg7Yag7YGw7J2EIOyDiOuhnOyatCDtgqTroZwg66eI7J206re466CI7J207IWYJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3NtYXBfYXV0aF90b2tlbicsIG9sZFRva2VuKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXV0aC10b2tlbicpO1xuICAgICAgICAgIHRva2VuID0gb2xkVG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g7Yag7YGwIOyhsO2ajCDspJEg7Jik66WYOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IHJlbW92ZVRva2VuID0gKCk6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIPCfp7kg66qo65OgIOyduOymnSDqtIDroKggbG9jYWxTdG9yYWdlIOyCreygnCDsi5zsnpEnKTtcbiAgICBcbiAgICAvLyDrqqjrk6Ag7J247KadIOq0gOugqCDthqDtgbAg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2F1dGgtdG9rZW4nKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9hdXRoX3Rva2VuJyk7XG4gICAgXG4gICAgLy8g66qo65OgIOyCrOyaqeyekCDsoJXrs7Qg7IKt7KCcXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9kYXRhJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3NtYXBfdXNlcl9pbmZvJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfZGF0YScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd1c2VyX3Byb2ZpbGUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncmVjZW50VXNlckluZm8nKTtcbiAgICBcbiAgICAvLyDroZzqt7jsnbgg7IOB7YOcIO2UjOuemOq3uCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnaXNMb2dnZWRJbicpO1xuICAgIFxuICAgIC8vIOq4sO2DgCDsnbjspp0g6rSA66CoIOuNsOydtO2EsCDsgq3soJxcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21hcF9sYXN0X2xvZ2luX3RpbWUnKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbGFzdF9sb2dvdXRfdGltZScpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g4pyFIOuqqOuToCDsnbjspp0g642w7J207YSwIOyCreygnCDsmYTro4wnKTtcbiAgfVxufTtcblxuLy8gV2ViS2l0IOy1nOygge2ZlOuQnCDsmpTssq0g7J247YSw7IWJ7YSwXG5hcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKFxuICAoY29uZmlnKSA9PiB7XG4gICAgY29uc3QgaXNXZWJLaXRFbnYgPSBpc1dlYktpdCgpO1xuICAgIGNvbnN0IGlzSU9TV2ViVmlld0VudiA9IGlzSU9TV2ViVmlldygpO1xuICAgIFxuICAgIC8vIOuPmeyggeycvOuhnCBiYXNlVVJMIOyEpOyglSAoV2ViS2l0IOy1nOygge2ZlClcbiAgICBpZiAoIWNvbmZpZy5iYXNlVVJMICYmIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgIGNvbnN0IGhvc3QgPSB3aW5kb3cubG9jYXRpb24uaG9zdDtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnOuKlCDrjZQg7JWI7KCV7KCB7J24IFVSTCDqtazshLFcbiAgICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIFdlYktpdCDtmZjqsr0gLSBiYXNlVVJMIOyEpOyglTonLCBjb25maWcuYmFzZVVSTCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWcuYmFzZVVSTCA9IGAke3Byb3RvY29sfS8vJHtob3N0fS9hcGlgO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5iYXNlVVJMKSB7XG4gICAgICBjb25maWcuYmFzZVVSTCA9ICcvYXBpJztcbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDstpTqsIAg7Zek642UIOyEpOyglVxuICAgIGlmIChpc1dlYktpdEVudikge1xuICAgICAgY29uZmlnLmhlYWRlcnMgPSB7XG4gICAgICAgIC4uLmNvbmZpZy5oZWFkZXJzLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZScsXG4gICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnXG4gICAgICB9IGFzIGFueTtcbiAgICAgIFxuICAgICAgLy8gaU9TIFdlYlZpZXcg7ZmY6rK97JeQ7IScIOy2lOqwgCDtl6TrjZRcbiAgICAgIGlmIChpc0lPU1dlYlZpZXdFbnYpIHtcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtUmVxdWVzdGVkLVdpdGgnXSA9ICdTTUFQLWlPUy1XZWJWaWV3JztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtaU9TLVdlYlZpZXcnXSA9ICd0cnVlJztcbiAgICAgICAgKGNvbmZpZy5oZWFkZXJzIGFzIGFueSlbJ1gtQ2xpZW50LUluZm8nXSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7IC8vIFVzZXItQWdlbnQg64yA7IugIOy7pOyKpO2FgCDtl6TrjZQg7IKs7JqpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOyduOymneydtCDtlYTsmpTtlZwg7JqU7LKt7JeQIO2GoO2BsCDstpTqsIBcbiAgICBjb25zdCB0b2tlbiA9IGdldFRva2VuKCk7XG4gICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg7ZmV7J24OicsIHRva2VuID8gJ+2GoO2BsCDsnojsnYwnIDogJ+2GoO2BsCDsl4bsnYwnKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIGNvbmZpZy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gQXV0aG9yaXphdGlvbiDtl6TrjZQg7LaU6rCA65CoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGw7J20IOyXhuyWtOyEnCBBdXRob3JpemF0aW9uIO2XpOuNlCDstpTqsIAg7JWI65CoJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7JqU7LKtIOyLnOqwhCDsuKHsoJUg7Iuc7J6RXG4gICAgaWYgKGlzV2ViS2l0RW52KSB7XG4gICAgICAoY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgICBcbiAgICAvLyDsmpTssq0g66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVFVRVNUXSAke2NvbmZpZy5tZXRob2Q/LnRvVXBwZXJDYXNlKCl9ICR7Y29uZmlnLmJhc2VVUkx9JHtjb25maWcudXJsfWAsIHtcbiAgICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgICBpc0lPU1dlYlZpZXc6IGlzSU9TV2ViVmlld0VudixcbiAgICAgICAgdGltZW91dDogY29uZmlnLnRpbWVvdXQsXG4gICAgICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgICAgICBkYXRhOiBjb25maWcuZGF0YVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb25maWc7XG4gIH0sXG4gIChlcnJvcikgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJIFJFUVVFU1QgRVJST1JdJywge1xuICAgICAgaXNXZWJLaXQ6IGlzV2ViS2l0RW52LFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBjb25maWc6IGVycm9yLmNvbmZpZ1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gIH1cbik7XG5cbi8vIFdlYktpdCDstZzsoIHtmZTrkJwg7J2R64u1IOyduO2EsOyFie2EsFxuYXBpQ2xpZW50LmludGVyY2VwdG9ycy5yZXNwb25zZS51c2UoXG4gIChyZXNwb25zZSkgPT4ge1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyDsoJXsg4Eg7J2R64u1IOyLnCA0MDEg7Lm07Jq07YSwIOumrOyFi1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkge1xuICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7XG4gICAgfVxuICAgIFxuICAgIC8vIFdlYktpdCDtmZjqsr3sl5DshJwg7J2R64u1IOyLnOqwhCDsuKHsoJVcbiAgICBpZiAoaXNXZWJLaXRFbnYgJiYgKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lKSB7XG4gICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gKHJlc3BvbnNlLmNvbmZpZyBhcyBhbnkpLl9yZXF1ZXN0U3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYFtBUEkgV0VCS0lUXSDsnZHri7Ug7Iuc6rCEOiAke3Jlc3BvbnNlVGltZX1tc2ApO1xuICAgICAgXG4gICAgICAvLyBpT1MgV2ViVmlld+yXkOyEnCA17LSIIOydtOyDgSDqsbjrpqzrqbQg6rK96rOgXG4gICAgICBpZiAoaXNJT1NXZWJWaWV3RW52ICYmIHJlc3BvbnNlVGltZSA+IDUwMDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbQVBJIFdFQktJVF0g7J2R64u1IOyLnOqwhCDqsr3qs6A6ICR7cmVzcG9uc2VUaW1lfW1zICg17LSIIOy0iOqzvClgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDsnZHri7Ug642w7J207YSwIOqygOymnVxuICAgIGlmIChpc1dlYktpdEVudiAmJiByZXNwb25zZS5kYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyDsnZHri7Ug642w7J207YSw6rCAIOusuOyekOyXtOydtOqzoCBKU09O7LKY65+8IOuztOydtOuptCDtjIzsi7Eg7Iuc64+EXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UuZGF0YSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgICAgICAocmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCd7JykgfHwgcmVzcG9uc2UuZGF0YS5zdGFydHNXaXRoKCdbJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgV0VCS0lUXSDrrLjsnpDsl7Qg7J2R64u1IOuNsOydtO2EsCBKU09OIO2MjOyLsSDsi5zrj4QnKTtcbiAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tBUEkgV0VCS0lUXSBKU09OIO2MjOyLsSDsi6TtjKgsIOybkOuzuCDrjbDsnbTthLAg7Jyg7KeAOicsIHBhcnNlRXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDsnZHri7Ug66Gc6rmFIChXZWJLaXQg7ZmY6rK97JeQ7IScIOuNlCDsg4HshLjtnogpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIHx8IGlzV2ViS2l0RW52KSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBSRVNQT05TRV0gJHtyZXNwb25zZS5jb25maWcubWV0aG9kPy50b1VwcGVyQ2FzZSgpfSAke3Jlc3BvbnNlLmNvbmZpZy51cmx9YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgZGF0YVR5cGU6IHR5cGVvZiByZXNwb25zZS5kYXRhLFxuICAgICAgICBkYXRhU2l6ZTogcmVzcG9uc2UuZGF0YSA/IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLmRhdGEpLmxlbmd0aCA6IDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgIC4uLihpc1dlYktpdEVudiAmJiAocmVzcG9uc2UuY29uZmlnIGFzIGFueSkuX3JlcXVlc3RTdGFydFRpbWUgJiYge1xuICAgICAgICAgIHJlc3BvbnNlVGltZTogRGF0ZS5ub3coKSAtIChyZXNwb25zZS5jb25maWcgYXMgYW55KS5fcmVxdWVzdFN0YXJ0VGltZVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSxcbiAgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gZXJyb3IuY29uZmlnO1xuICAgIGNvbnN0IGlzV2ViS2l0RW52ID0gaXNXZWJLaXQoKTtcbiAgICBjb25zdCBpc0lPU1dlYlZpZXdFbnYgPSBpc0lPU1dlYlZpZXcoKTtcbiAgICBcbiAgICAvLyBXZWJLaXQg7ZmY6rK97JeQ7IScIOyDgeyEuO2VnCDsmKTrpZgg66Gc6rmFXG4gICAgaWYgKGVycm9yLnJlc3BvbnNlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbQVBJIFJFU1BPTlNFIEVSUk9SXSAke2Vycm9yLnJlc3BvbnNlLnN0YXR1c306YCwge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBzdGF0dXM6IGVycm9yLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogZXJyb3IucmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgaGVhZGVyczogZXJyb3IucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLnJlcXVlc3QpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEkgUkVRVUVTVCBFUlJPUl06Jywge1xuICAgICAgICBpc1dlYktpdDogaXNXZWJLaXRFbnYsXG4gICAgICAgIGlzSU9TV2ViVmlldzogaXNJT1NXZWJWaWV3RW52LFxuICAgICAgICBlcnJvclR5cGU6ICduZXR3b3JrJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgY29kZTogZXJyb3IuY29kZSxcbiAgICAgICAgdXJsOiBlcnJvci5jb25maWc/LnVybCxcbiAgICAgICAgbWV0aG9kOiBlcnJvci5jb25maWc/Lm1ldGhvZCxcbiAgICAgICAgdGltZW91dDogZXJyb3IuY29uZmlnPy50aW1lb3V0LFxuICAgICAgICByZXF1ZXN0OiBlcnJvci5yZXF1ZXN0XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gV2ViS2l0IO2ZmOqyveyXkOyEnCDrhKTtirjsm4ztgawg7Jik66WYIOyLnCDstpTqsIAg7KCV67O0XG4gICAgICBpZiAoaXNXZWJLaXRFbnYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FQSSBXRUJLSVQgRVJST1JdIOuEpO2KuOybjO2BrCDsl7DqsrAg7Jik66WYOicsIHtcbiAgICAgICAgICBuZXR3b3JrU3RhdGU6IG5hdmlnYXRvci5vbkxpbmUgPyAn7Jio65287J24JyA6ICfsmKTtlITrnbzsnbgnLFxuICAgICAgICAgIHVzZXJBZ2VudDogbmF2aWdhdG9yLnVzZXJBZ2VudCxcbiAgICAgICAgICBjb25uZWN0aW9uVHlwZTogKG5hdmlnYXRvciBhcyBhbnkpLmNvbm5lY3Rpb24/LmVmZmVjdGl2ZVR5cGUgfHwgJ3Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQVBJIEVSUk9SXTonLCB7XG4gICAgICAgIGlzV2ViS2l0OiBpc1dlYktpdEVudixcbiAgICAgICAgaXNJT1NXZWJWaWV3OiBpc0lPU1dlYlZpZXdFbnYsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQwMSDsmKTrpZgg7LKY66asICjthqDtgbAg66eM66OMIOuYkOuKlCDsnbjspp0g7Iuk7YyoKVxuICAgIGlmIChlcnJvci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDEgJiYgIW9yaWdpbmFsUmVxdWVzdC5fcmV0cnkpIHtcbiAgICAgIC8vIOustO2VnCDro6jtlIQg67Cp7KeAOiDsl7Dsho3rkJwgNDAxIOyXkOufrCDsubTsmrTtirgg7Kad6rCAXG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyAtIGxhc3RVbmF1dGhvcml6ZWRUaW1lIDwgNTAwMCkge1xuICAgICAgICAvLyA17LSIIOydtOuCtCDsl7Dsho0gNDAxIOyXkOufrFxuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyA17LSIIOydtOyDgSDsp4DrgqzsnLzrqbQg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMTtcbiAgICAgIH1cbiAgICAgIGxhc3RVbmF1dGhvcml6ZWRUaW1lID0gbm93O1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0FQSSBDTElFTlRdIDQwMSDsl5Drn6wg67Cc7IOdICjsl7Dsho0gJHtjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50fe2ajClgKTtcblxuICAgICAgLy8g66y07ZWcIOujqO2UhCDqsJDsp4A6IDPtmowg7J207IOBIOyXsOyGjSA0MDEg7JeQ65+sIOuwnOyDnSDsi5xcbiAgICAgIGlmIChjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID49IE1BWF9VTkFVVEhPUklaRURfUkVUUklFUykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQVBJIENMSUVOVF0g8J+aqCDrrLTtlZwg66Oo7ZSEIOqwkOyngCEg7Jew7IaNIDQwMSDsl5Drn6zroZwg7J247ZWcIOqwleygnCDroZzqt7jslYTsm4MnKTtcbiAgICAgICAgcmVtb3ZlVG9rZW4oKTtcbiAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOy5tOyatO2EsCDrpqzshYtcbiAgICAgICAgXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg64uoIO2VnCDrsojrp4wg66as64uk7J2066CJ7Yq4XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbFJlcXVlc3QuX3JldHJ5ID0gdHJ1ZTtcblxuICAgICAgY29uc3QgaGFzVG9rZW4gPSAhIWdldFRva2VuKCk7XG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cbiAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSkuX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIDQwMSDsl5Drn6wg66as64uk7J2066CJ7Yq4IOuwqeyngCcpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICAvLyDinIUg7LSI6riwIOu5hOuhnOq3uOyduCDsg4Htg5wo7Yag7YGwIOyXhuydjCnsl5DshJzripQg66as64uk7J2066CJ7Yq4L+2GoO2BsOqwseyLoCDsi5zrj4TtlZjsp4Ag7JWK6rOgIOyhsOyaqe2eiCDsi6TtjKgg67CY7ZmYXG4gICAgICBpZiAoIWhhc1Rva2VuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0gNDAxICjstIjquLAg67mE66Gc6re47J24KSAtIOumrOuLpOydtOugie2KuC/rpqztlITroIjsi5wg7IOd6561Jyk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLICjsoJXsg4HsoIHsnbgg67mE66Gc6re47J24IOyDge2DnClcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVmcmVzaCDsmpTssq0g7J6Q7LK06rCAIDQwMeydtOuptCDthqDtgbAg6rCx7IugIOyLnOuPhO2VmOyngCDslYrsnYxcbiAgICAgIGlmIChvcmlnaW5hbFJlcXVlc3QudXJsPy5pbmNsdWRlcygnL2F1dGgvcmVmcmVzaCcpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsmpTssq3snbQgNDAxIC0g66y07Zqo7ZWcIO2GoO2BsOycvOuhnCDtjJDri6jtlZjsl6wg66Gc6re47JWE7JuDIOyymOumrCcpO1xuICAgICAgICByZW1vdmVUb2tlbigpO1xuICAgICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDsgLy8g7Lm07Jq07YSwIOumrOyFi1xuXG4gICAgICAgIC8vIPCfmqsg7JeQ65+sIOuqqOuLrOydtCDtkZzsi5wg7KSR7J2066m0IOumrOuLpOydtOugie2KuCDrsKnsp4BcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICh3aW5kb3cgYXMgYW55KS5fX1NJR05JTl9FUlJPUl9NT0RBTF9BQ1RJVkVfXykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g8J+aqyDsl5Drn6wg66qo64usIO2RnOyLnCDspJEgLSDthqDtgbAg6rCx7IugIOyLpO2MqCDrpqzri6TsnbTroIntirgg67Cp7KeAJyk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4IChOYXZpZ2F0aW9uTWFuYWdlciDsgqzsmqkpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0FQSSBDTElFTlRdIO2GoO2BsCDqsLHsi6Ag7Iuc64+EJyk7XG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuc64+EXG4gICAgICAgIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGFwaUNsaWVudC5wb3N0KCcvYXV0aC9yZWZyZXNoJyk7XG4gICAgICAgIGNvbnN0IG5ld1Rva2VuID0gcmVmcmVzaFJlc3BvbnNlLmRhdGEudG9rZW47XG5cbiAgICAgICAgaWYgKG5ld1Rva2VuKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDthqDtgbAg6rCx7IugIOyEseqztScpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzbWFwX2F1dGhfdG9rZW4nLCBuZXdUb2tlbik7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2F1dGgtdG9rZW4nLCBuZXdUb2tlbik7IC8vIO2VmOychCDtmLjtmZjshLFcbiAgICAgICAgICBvcmlnaW5hbFJlcXVlc3QuaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke25ld1Rva2VufWA7XG4gICAgICAgICAgY29uc2VjdXRpdmVVbmF1dGhvcml6ZWRDb3VudCA9IDA7IC8vIOyEseqztSDsi5wg7Lm07Jq07YSwIOumrOyFi1xuICAgICAgICAgIHJldHVybiBhcGlDbGllbnQob3JpZ2luYWxSZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUT0tFTiBSRUZSRVNIIEVSUk9SXTonLCByZWZyZXNoRXJyb3IpO1xuXG4gICAgICAgIC8vIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOyLnCDroZzqt7jslYTsm4Mg7LKY66asXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQVBJIENMSUVOVF0g7Yag7YGwIOqwseyLoCDsi6TtjKggLSDroZzqt7jslYTsm4Mg7LKY66asJyk7XG4gICAgICAgIHJlbW92ZVRva2VuKCk7XG4gICAgICAgIGNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQgPSAwOyAvLyDsubTsmrTthLAg66as7IWLXG5cbiAgICAgICAgLy8g8J+aqyDsl5Drn6wg66qo64us7J20IO2RnOyLnCDspJHsnbTrqbQg66as64uk7J2066CJ7Yq4IOuwqeyngFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHdpbmRvdyBhcyBhbnkpLl9fU0lHTklOX0VSUk9SX01PREFMX0FDVElWRV9fKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBUEkgQ0xJRU5UXSDwn5qrIOyXkOufrCDrqqjri6wg7ZGc7IucIOykkSAtIO2GoO2BsCDqsLHsi6Ag7Iuk7YyoIOumrOuLpOydtOugie2KuCDrsKnsp4AnKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g7Yag7YGw7J20IOyeiOyXiOuNmCDsgqzsmqnsnpDqsIAgNDAx7J2066m0IOuhnOq3uOyduCDtjpjsnbTsp4DroZwg66as64uk7J2066CJ7Yq4ICjstIjquLAg67mE66Gc6re47J247J2AIOychOyXkOyEnCByZXR1cm7rkKgpXG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgIT09ICcvc2lnbmluJykge1xuICAgICAgICAgIG5hdmlnYXRpb25NYW5hZ2VyLnJlZGlyZWN0VG9TaWduaW4oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyAhPT0gNDAxKSB7XG4gICAgICAvLyA0MDHsnbQg7JWE64uMIOqyveyasCDsubTsmrTthLAg66as7IWLXG4gICAgICBjb25zZWN1dGl2ZVVuYXV0aG9yaXplZENvdW50ID0gMDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgfVxuKTtcblxuLy8g7YyM7J28IOyXheuhnOuTnOulvCDsnITtlZwg66mU7ISc65OcIOy2lOqwgFxuYXBpQ2xpZW50LnVwbG9hZCA9IGFzeW5jICh1cmw6IHN0cmluZywgZm9ybURhdGE6IEZvcm1EYXRhKSA9PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpQ2xpZW50LnBvc3QodXJsLCBmb3JtRGF0YSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgfSxcbiAgfSk7XG4gIHJldHVybiByZXNwb25zZS5kYXRhO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXBpQ2xpZW50OyAiXSwibmFtZXMiOlsiYXhpb3MiLCJuYXZpZ2F0aW9uTWFuYWdlciIsImlzV2ViS2l0Iiwid2luZG93Iiwid2Via2l0IiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiaW5jbHVkZXMiLCJpc0lPU1dlYlZpZXciLCJtZXNzYWdlSGFuZGxlcnMiLCJnZXRBcGlCYXNlVXJsIiwiaXNXZWJLaXRFbnYiLCJwcm90b2NvbCIsImxvY2F0aW9uIiwiaG9zdCIsImNvbnNvbGUiLCJsb2ciLCJiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJBUElfQkFTRV9VUkwiLCJjcmVhdGVBcGlDbGllbnRDb25maWciLCJpc0lPU1dlYlZpZXdFbnYiLCJjb25maWciLCJiYXNlVVJMIiwidGltZW91dCIsImhlYWRlcnMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJtYXhSZWRpcmVjdHMiLCJ2YWxpZGF0ZVN0YXR1cyIsInN0YXR1cyIsInRyYW5zZm9ybVJlcXVlc3QiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImVycm9yIiwidHJhbnNmb3JtUmVzcG9uc2UiLCJwYXJzZSIsImFwaUNsaWVudCIsImNyZWF0ZSIsImNvbnNlY3V0aXZlVW5hdXRob3JpemVkQ291bnQiLCJNQVhfVU5BVVRIT1JJWkVEX1JFVFJJRVMiLCJsYXN0VW5hdXRob3JpemVkVGltZSIsImdldFRva2VuIiwidG9rZW4iLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwib2xkVG9rZW4iLCJzZXRJdGVtIiwicmVtb3ZlSXRlbSIsInJlbW92ZVRva2VuIiwiaW50ZXJjZXB0b3JzIiwicmVxdWVzdCIsInVzZSIsIkF1dGhvcml6YXRpb24iLCJfcmVxdWVzdFN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJtZXRob2QiLCJ0b1VwcGVyQ2FzZSIsInVybCIsIm1lc3NhZ2UiLCJQcm9taXNlIiwicmVqZWN0IiwicmVzcG9uc2UiLCJyZXNwb25zZVRpbWUiLCJ3YXJuIiwic3RhcnRzV2l0aCIsInBhcnNlRXJyb3IiLCJkYXRhVHlwZSIsImRhdGFTaXplIiwibGVuZ3RoIiwib3JpZ2luYWxSZXF1ZXN0Iiwic3RhdHVzVGV4dCIsImVycm9yVHlwZSIsImNvZGUiLCJuZXR3b3JrU3RhdGUiLCJvbkxpbmUiLCJjb25uZWN0aW9uVHlwZSIsImNvbm5lY3Rpb24iLCJlZmZlY3RpdmVUeXBlIiwic3RhY2siLCJfcmV0cnkiLCJwYXRobmFtZSIsInJlZGlyZWN0VG9TaWduaW4iLCJoYXNUb2tlbiIsImN1cnJlbnRQYXRoIiwiX19TSUdOSU5fRVJST1JfTU9EQUxfQUNUSVZFX18iLCJyZWZyZXNoUmVzcG9uc2UiLCJwb3N0IiwibmV3VG9rZW4iLCJyZWZyZXNoRXJyb3IiLCJ1cGxvYWQiLCJmb3JtRGF0YSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./src/services/apiClient.ts\n");
backend/README.md:157:EXTERNAL_API_BASE_URL=https://api3.aiagnt.kr
frontend/test-api.js:5:const API_BASE_URL = 'http://localhost:3000/api';
frontend/test-api.js:9:  baseURL: API_BASE_URL,

  ✓ draft.md에서 Claude의 가설과 Option A 내용을 파악한다
  ✓ Android 서비스/매니페스트/리시버를 읽어 heartbeat, lastLocation, AlarmManager 동작을 확인한다
  → iOS 구현과 네트워크/인증 관련 파일을 살펴 비교 근거와 대체 가설을 수집한다
  • 각 가설 및 Option A에 대한 근거 기반 비판/보강을 정리한다
**Analyzing Android location service and network behaviors**

I'm thoroughly reviewing Android files related to location uploading, network modules, and authentication interceptors to understand potential causes of upload issues, focusing on timers, token handling on 401 errors, request field compatibility, and how pending locations and heartbeat flushes are managed. There is a lot here about interplay between flushing mechanics and service eligibility that could explain observed problems. I'll keep inspecting related components and cross-check usage to connect the dots.
exec
/bin/zsh -lc "rg -n \"startIfEligible\" -n -g'*'" in /Users/genie/SmapSource/smap_next
 succeeded in 4362ms:
Android/app/build/outputs/mapping/release/mapping.txt:1246910:    14:23:void startIfEligible(android.content.Context,java.lang.String):141:141 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246911:    24:44:void startIfEligible(android.content.Context,java.lang.String):142:142 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246912:    45:50:void startIfEligible(android.content.Context,java.lang.String):145:145 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246913:    51:71:void startIfEligible(android.content.Context,java.lang.String):146:146 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246914:    72:89:void startIfEligible(android.content.Context,java.lang.String):150:150 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246915:    90:92:void startIfEligible(android.content.Context,java.lang.String):153:153 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246916:    93:112:void startIfEligible(android.content.Context,java.lang.String):157:157 -> startIfEligible
Android/app/build/outputs/mapping/release/mapping.txt:1246917:    113:133:void startIfEligible(android.content.Context,java.lang.String):159:159 -> startIfEligible
Android/app/build/outputs/mapping/release/seeds.txt:323757:com.dmonster.smap.LocationService$Companion: void startIfEligible(android.content.Context,java.lang.String)

exec
/bin/zsh -lc "nl -ba Android/app/src/main/java/com/dmonster/smap/MainActivity.kt | sed -n '220,280p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   220	
   221	    private fun markFirstLaunchDone() {
   222	        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
   223	            .putBoolean("permission_onboarding_done", true)
   224	            .apply()
   225	    }
   226	
   227	    private fun hasShownBackgroundGuide(): Boolean {
   228	        return getSharedPreferences("smap_prefs", MODE_PRIVATE)
   229	            .getBoolean("background_guide_dismissed", false)
   230	    }
   231	
   232	    private fun markBackgroundGuideDismissed() {
   233	        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
   234	            .putBoolean("background_guide_dismissed", true)
   235	            .apply()
   236	    }
   237	
   238	    private fun startLocationService() {
   239	        if (!LocationService.isUserLoggedIn(this)) {
   240	            Log.w(TAG, "[LOCATION] Skip start - user not logged in")
   241	            return
   242	        }
   243	        if (!LocationService.hasRequiredPermissions(this)) {
   244	            Log.w(TAG, "[LOCATION] Skip start - required location permissions missing")
   245	            return
   246	        }
   247	        LocationService.startIfEligible(this, "main_activity")
   248	    }
   249	
   250	    private fun stopLocationService() {
   251	        val intent = Intent(this, LocationService::class.java)
   252	        stopService(intent)
   253	        Log.d(TAG, "[LOCATION] LocationService stopped")
   254	    }
   255	
   256	    private fun navigateToLogin() {
   257	        val intent = Intent(this, LoginActivity::class.java)
   258	        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
   259	        startActivity(intent)
   260	        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
   261	            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, android.R.anim.fade_in, android.R.anim.fade_out)
   262	        } else {
   263	            @Suppress("DEPRECATION")
   264	            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
   265	        }
   266	        finish()
   267	    }
   268	
   269	    override fun onNewIntent(intent: Intent) {
   270	        super.onNewIntent(intent)
   271	        setIntent(intent)
   272	        handleDeepLink(intent)
   273	    }
   274	
   275	    private fun handleDeepLink(intent: Intent?) {
   276	        intent?.data?.let { uri ->
   277	            Log.d(TAG, "[DEEP_LINK] Received URI: $uri")
   278	
   279	            // smap://group/{id}/join 처리
   280	            if (uri.scheme == "smap" && uri.host == "group") {

**Analyzing Android LocationService and Doze Impact**

I’m carefully reviewing how LocationService handles heartbeat scheduling with AlarmManager and the effects of Doze mode on timers and wake locks. I’m gathering relevant Android docs and code details to understand update intervals, battery usage, and background service restrictions, aiming to address why location uploads may stop when stationary.
exec
/bin/zsh -lc 'nl -ba Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
     1	package com.dmonster.smap.data.api
     2	
     3	import android.content.SharedPreferences
     4	import android.util.Log
     5	import okhttp3.Interceptor
     6	import okhttp3.Response
     7	import javax.inject.Inject
     8	
     9	class AuthInterceptor @Inject constructor(
    10	    private val prefs: SharedPreferences
    11	) : Interceptor {
    12	    companion object {
    13	        private const val TAG = "AuthInterceptor"
    14	    }
    15	
    16	    override fun intercept(chain: Interceptor.Chain): Response {
    17	        val token = prefs.getString("auth_token", null)
    18	        val request = chain.request().newBuilder().apply {
    19	            token?.let { addHeader("Authorization", "Bearer $it") }
    20	        }.build()
    21	
    22	        val response = chain.proceed(request)
    23	
    24	        if (response.code == 401) {
    25	            Log.w(TAG, "401 Unauthorized - clearing auth token")
    26	            prefs.edit().remove("auth_token").apply()
    27	        }
    28	
    29	        return response
    30	    }
    31	}

**Analyzing Android location service risks and behaviors**

I'm digging into multiple potential causes for the location service issues, like token handling on 401, network security config, background service start restrictions on Android 12+, Doze mode effects on timers, and queue flushing behavior. I'm cross-referencing Android docs and the code logic to evaluate each scenario’s viability and noting how things like `AuthInterceptor`, `restoreLastLocation`, and `startAlarm` interact to influence service stability and battery usage. There's a lot to unpack here!
  ✓ draft.md에서 Claude의 가설과 Option A 내용을 파악한다
  ✓ Android 서비스/매니페스트/리시버를 읽어 heartbeat, lastLocation, AlarmManager 동작을 확인한다
  ✓ iOS 구현과 네트워크/인증 관련 파일을 살펴 비교 근거와 대체 가설을 수집한다
  → 각 가설 및 Option A에 대한 근거 기반 비판/보강을 정리한다
exec
/bin/zsh -lc "nl -ba backend/app/api/v1/endpoints/member_location_log.py | sed -n '100,220p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   100	                    db, mt_idx, start_date, end_date
   101	                )
   102	                
   103	                return {"result": "Y", "data": summary.model_dump()}
   104	                
   105	            except Exception as e:
   106	                logger.error(f"Error getting location summary: {str(e)}")
   107	                logger.error(traceback.format_exc())
   108	                raise HTTPException(status_code=500, detail=str(e))
   109	        
   110	        elif act == "get_location_path":
   111	            # 위치 경로 및 요약 정보 조회
   112	            try:
   113	                mt_idx = body.get("mt_idx")
   114	                if not mt_idx:
   115	                    raise HTTPException(status_code=400, detail="mt_idx is required")
   116	                
   117	                start_date = body.get("start_date")
   118	                end_date = body.get("end_date")
   119	                
   120	                path_data = location_log_crud.get_location_path(
   121	                    db, mt_idx, start_date, end_date
   122	                )
   123	                
   124	                return {"result": "Y", "data": path_data.model_dump()}
   125	                
   126	            except Exception as e:
   127	                logger.error(f"Error getting location path: {str(e)}")
   128	                logger.error(traceback.format_exc())
   129	                raise HTTPException(status_code=500, detail=str(e))
   130	        
   131	        elif act == "create_location_log":
   132	            # 위치 로그 생성 (토큰 기반 사용자 식별 + 배치 전송 지원)
   133	            try:
   134	                # 토큰이 있으면 토큰 기반, 없으면 body의 mt_idx 사용
   135	                token_mt_idx, token_err = _get_mt_idx_from_token(request)
   136	                if token_err and not body.get("mt_idx"):
   137	                    # 토큰도 없고 body에 mt_idx도 없으면 에러
   138	                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=token_err)
   139	                
   140	                # 토큰에서 mt_idx를 가져오거나 body에서 사용
   141	                final_mt_idx = token_mt_idx if token_mt_idx else body.get("mt_idx")
   142	                if not final_mt_idx:
   143	                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mt_idx가 필요합니다 (토큰 또는 body)")
   144	
   145	                # 동의(옵션): body 또는 헤더로 넘어오는 동의 플래그가 명시적으로 'N'이면 차단
   146	                consent = (str(body.get("location_consent", "Y")).upper() != "N")
   147	                if not consent:
   148	                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="위치 정보 수집 동의가 필요합니다.")
   149	
   150	                # 배치 전송 처리: mlt_gps_data 배열이 있으면 배치로 저장
   151	                if isinstance(body.get("mlt_gps_data"), list) and body.get("mlt_gps_data"):
   152	                    created = []
   153	                    errors = []
   154	                    for idx, item in enumerate(body["mlt_gps_data"]):
   155	                        try:
   156	                            single = {
   157	                                "act": "create_location_log",  # 내부 검증용
   158	                                "mt_idx": final_mt_idx,
   159	                                "mlt_lat": item.get("mlt_lat"),
   160	                                "mlt_long": item.get("mlt_long"),
   161	                                "mlt_accuacy": item.get("mlt_accuracy") or item.get("mlt_accuacy"),  # 스키마에 맞게 mlt_accuacy 사용
   162	                                "mlt_speed": item.get("mlt_speed"),
   163	                                "mlt_altitude": item.get("mlt_altitude"),
   164	                                # iOS 배치 필드명 호환: mlt_timestamp → mlt_gps_time (스키마 호환성)
   165	                                "mlt_gps_time": item.get("mlt_timestamp") or item.get("mlt_gps_time"),
   166	                                "source": body.get("source", "ios-app"),
   167	                                "mlt_location_chk": item.get("mlt_location_chk"),
   168	                                "mlt_fine_location": item.get("mlt_fine_location"),
   169	                                "mlt_battery": item.get("mlt_battery"),
   170	                                "mt_health_work": item.get("mt_health_work"),
   171	                            }
   172	                            log_data = MemberLocationLogCreate(**single)
   173	                            result = location_log_crud.create_location_log(db, log_data)
   174	                            created.append(result.to_dict())
   175	                        except Exception as e:
   176	                            logger.warning(f"Batch item {idx} failed: {str(e)}")
   177	                            errors.append({"index": idx, "error": str(e)})
   178	                    return {"result": "Y" if created else "N", "created_count": len(created), "errors": errors, "data": created[:10]}
   179	
   180	                # 단건 처리
   181	                # print(f"📍 [BACKEND] 위치 로그 생성 요청 수신 (단건):")
   182	                # print(f"   📍 final_mt_idx: {final_mt_idx}")
   183	                # print(f"   📍 위도: {body.get('mlt_lat')}")
   184	                # print(f"   📍 경도: {body.get('mlt_long')}")
   185	                
   186	                body["mt_idx"] = final_mt_idx  # 토큰 또는 body의 mt_idx 사용
   187	                
   188	                # 필드명 매핑: mlt_timestamp -> mlt_gps_time (스키마 호환성)
   189	                if "mlt_timestamp" in body and "mlt_gps_time" not in body:
   190	                    body["mlt_gps_time"] = body["mlt_timestamp"]
   191	                
   192	                # mlt_accuracy 매핑 (오타 호환성)
   193	                if "mlt_accuracy" in body and "mlt_accuacy" not in body:
   194	                    body["mlt_accuacy"] = body["mlt_accuracy"]
   195	                log_data = MemberLocationLogCreate(**body)
   196	                result = location_log_crud.create_location_log(db, log_data)
   197	                return {"result": "Y", "data": result.to_dict()}
   198	            except HTTPException:
   199	                raise
   200	            except Exception as e:
   201	                logger.error(f"Error creating location log: {str(e)}")
   202	                logger.error(traceback.format_exc())
   203	                raise HTTPException(status_code=500, detail=str(e))
   204	        
   205	        elif act == "update_location_log":
   206	            # 위치 로그 업데이트
   207	            try:
   208	                log_id = body.get("mlt_idx")
   209	                if not log_id:
   210	                    raise HTTPException(status_code=400, detail="mlt_idx is required")
   211	                
   212	                update_data = {k: v for k, v in body.items() if k not in ["act", "mlt_idx"]}
   213	                log_data = MemberLocationLogUpdate(**update_data)
   214	                
   215	                result = location_log_crud.update_location_log(db, log_id, log_data)
   216	                if not result:
   217	                    raise HTTPException(status_code=404, detail="Location log not found")
   218	                
   219	                return {"result": "Y", "data": result.to_dict()}
   220	                

exec
/bin/zsh -lc "nl -ba Android/app/src/main/java/com/dmonster/smap/LocationService.kt | sed -n '1,160p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
     1	package com.dmonster.smap
     2	
     3	import android.Manifest
     4	import android.app.AlarmManager
     5	import android.app.NotificationChannel
     6	import android.app.NotificationManager
     7	import android.app.PendingIntent
     8	import android.app.Service
     9	import android.content.Context
    10	import android.content.Intent
    11	import android.content.pm.PackageManager
    12	import android.location.Location
    13	import android.os.Build
    14	import android.os.IBinder
    15	import android.os.Looper
    16	import android.util.Log
    17	import androidx.core.app.ActivityCompat
    18	import androidx.core.app.NotificationCompat
    19	import com.dmonster.smap.data.api.SmapApi
    20	import com.dmonster.smap.data.model.CreateLocationLogRequest
    21	import com.google.android.gms.location.*
    22	import dagger.hilt.android.EntryPointAccessors
    23	import dagger.hilt.EntryPoint
    24	import dagger.hilt.InstallIn
    25	import dagger.hilt.components.SingletonComponent
    26	import kotlinx.coroutines.*
    27	import kotlinx.serialization.encodeToString
    28	import kotlinx.serialization.decodeFromString
    29	import kotlinx.serialization.json.Json
    30	import java.text.SimpleDateFormat
    31	import java.util.Date
    32	import java.util.Locale
    33	
    34	/**
    35	 * Adaptive 3-mode foreground location service for battery-efficient tracking.
    36	 *
    37	 * Modes:
    38	 *  - STATIONARY : low-power, 5 min interval, 500 m displacement, 15 min heartbeat
    39	 *  - WALKING    : high-accuracy, 30 s interval, 30 m displacement, 1 min batch
    40	 *  - AUTOMOTIVE : high-accuracy, 15 s interval, 100 m displacement, 1 min batch
    41	 *
    42	 * Mode is detected from GPS speed with a 5-minute dwell timer before entering
    43	 * STATIONARY, and instant upgrade to WALKING/AUTOMOTIVE when movement resumes.
    44	 */
    45	class LocationService : Service() {
    46	
    47	    // ── Hilt entry point (Service cannot use @Inject) ──────────────────────
    48	
    49	    @EntryPoint
    50	    @InstallIn(SingletonComponent::class)
    51	    interface LocationServiceEntryPoint {
    52	        fun smapApi(): SmapApi
    53	    }
    54	
    55	    private val smapApi: SmapApi by lazy {
    56	        EntryPointAccessors.fromApplication(
    57	            applicationContext, LocationServiceEntryPoint::class.java
    58	        ).smapApi()
    59	    }
    60	
    61	    // ── Power modes ────────────────────────────────────────────────────────
    62	
    63	    enum class PowerMode { STATIONARY, WALKING, AUTOMOTIVE }
    64	
    65	    private var currentMode = PowerMode.WALKING
    66	
    67	    // ── Location client ────────────────────────────────────────────────────
    68	
    69	    private lateinit var fusedLocationClient: FusedLocationProviderClient
    70	    private lateinit var locationRequest: LocationRequest
    71	
    72	    // ── Activity / mode detection ──────────────────────────────────────────
    73	
    74	    private var stationaryStartTime: Long = 0L
    75	    @Volatile private var lastLocation: Location? = null
    76	    private var consecutiveAuthFailures = 0
    77	    private val maxAuthFailures = 3
    78	
    79	    // ── Location batching ──────────────────────────────────────────────────
    80	
    81	    private val pendingLocations = mutableListOf<CreateLocationLogRequest>()
    82	    private val maxQueueSize = 100
    83	    private var batchJob: Job? = null
    84	    private var heartbeatPendingIntent: PendingIntent? = null
    85	
    86	    // ── Coroutine scope ────────────────────────────────────────────────────
    87	
    88	    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    89	    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    90	
    91	    // ── Constants ──────────────────────────────────────────────────────────
    92	
    93	    companion object {
    94	        private const val TAG = "LocationService"
    95	        private const val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
    96	        private const val NOTIFICATION_ID = 10000
    97	        private const val AUTH_PREFS = "smap_auth_prefs"
    98	        private const val QUEUE_PREFS = "smap_location_service"
    99	        private const val KEY_PENDING_QUEUE = "pending_queue"
   100	        private const val KEY_LAST_LOCATION = "last_location"
   101	        private const val RESTART_DELAY_MS = 5_000L
   102	
   103	        private const val STATIONARY_DWELL_MS = 5 * 60 * 1000L  // 5 min before entering stationary
   104	        private const val HEARTBEAT_INTERVAL_MS = 900_000L       // 15 min
   105	        private const val BATCH_INTERVAL_MS = 60_000L            // 1 min
   106	
   107	        private const val ACTION_HEARTBEAT = "com.dmonster.smap.ACTION_HEARTBEAT"
   108	        private const val REQUEST_CODE_HEARTBEAT = 2002
   109	
   110	        fun isRunning(context: Context): Boolean {
   111	            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
   112	            return manager.getRunningServices(Integer.MAX_VALUE)
   113	                .any { it.service.className == LocationService::class.java.name }
   114	        }
   115	
   116	        fun hasRequiredPermissions(context: Context): Boolean {
   117	            val fine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
   118	            val coarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
   119	            val locationGranted = fine || coarse
   120	            val backgroundGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
   121	                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
   122	            } else {
   123	                true
   124	            }
   125	            val foregroundServiceGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
   126	                ActivityCompat.checkSelfPermission(context, Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED
   127	            } else {
   128	                true
   129	            }
   130	            return locationGranted && backgroundGranted && foregroundServiceGranted
   131	        }
   132	
   133	        fun isUserLoggedIn(context: Context): Boolean {
   134	            val prefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
   135	            val token = prefs.getString("auth_token", null)
   136	            val mtIdx = prefs.getInt("mt_idx", -1)
   137	            return !token.isNullOrBlank() && mtIdx > 0
   138	        }
   139	
   140	        fun startIfEligible(context: Context, reason: String) {
   141	            if (!isUserLoggedIn(context)) {
   142	                Log.d(TAG, "Skip start ($reason): user not logged in")
   143	                return
   144	            }
   145	            if (!hasRequiredPermissions(context)) {
   146	                Log.d(TAG, "Skip start ($reason): required location permissions missing")
   147	                return
   148	            }
   149	
   150	            val intent = Intent(context, LocationService::class.java).putExtra("restart_reason", reason)
   151	            try {
   152	                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
   153	                    context.startForegroundService(intent)
   154	                } else {
   155	                    context.startService(intent)
   156	                }
   157	                Log.d(TAG, "LocationService start requested ($reason)")
   158	            } catch (e: Exception) {
   159	                Log.e(TAG, "Failed to start LocationService ($reason)", e)
   160	            }

exec
/bin/zsh -lc 'nl -ba Android/app/src/main/java/com/dmonster/smap/LocationRestartReceiver.kt' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
     1	package com.dmonster.smap
     2	
     3	import android.content.BroadcastReceiver
     4	import android.content.Context
     5	import android.content.Intent
     6	import android.util.Log
     7	
     8	class LocationRestartReceiver : BroadcastReceiver() {
     9	
    10	    companion object {
    11	        private const val TAG = "LocationRestartReceiver"
    12	    }
    13	
    14	    override fun onReceive(context: Context, intent: Intent?) {
    15	        val action = intent?.action ?: "manual_restart"
    16	        Log.d(TAG, "Received restart trigger: $action")
    17	        LocationService.startIfEligible(context, action)
    18	    }
    19	}

exec
/bin/zsh -lc "nl -ba iOS/smap/Core/Location/LocationManager.swift | sed -n '60,140p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
    60	
    61	        guard !isTracking else {
    62	            print("[LocationManager] Already tracking - skip")
    63	            return
    64	        }
    65	        isTracking = true
    66	
    67	        // Start motion detection
    68	        motionManager.startMonitoring()
    69	
    70	        // Apply walking mode config directly (avoid switchToMode guard for initial setup)
    71	        currentMode = .walking
    72	        clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    73	        clManager.distanceFilter = 30
    74	        clManager.activityType = .fitness
    75	        Task { await uploader.startBatching(interval: 60) }
    76	
    77	        clManager.startUpdatingLocation()
    78	        print("[LocationManager] Tracking started in walking mode")
    79	
    80	        // Warn if only whenInUse permission (stationary mode restricted)
    81	        if status == .authorizedWhenInUse {
    82	            print("[LocationManager] whenInUse only - Stationary mode restricted")
    83	        }
    84	    }
    85	
    86	    func stopTracking() {
    87	        isTracking = false
    88	        clManager.stopUpdatingLocation()
    89	        motionManager.stopMonitoring()
    90	        Task {
    91	            await uploader.stopBatching()
    92	            await uploader.stopHeartbeat()
    93	            await uploader.savePendingQueue()
    94	        }
    95	    }
    96	
    97	    // MARK: - Mode Switching
    98	
    99	    func switchToMode(_ newMode: PowerMode) {
   100	        guard newMode != currentMode else { return }
   101	
   102	        // Block stationary mode if only whenInUse permission
   103	        if newMode == .stationary {
   104	            let status: CLAuthorizationStatus
   105	            if #available(iOS 14.0, *) { status = clManager.authorizationStatus }
   106	            else { status = CLLocationManager.authorizationStatus() }
   107	            if status != .authorizedAlways {
   108	                print("[LocationManager] No Always permission - cannot enter Stationary mode")
   109	                return
   110	            }
   111	        }
   112	
   113	        let oldMode = currentMode
   114	        currentMode = newMode
   115	        print("[LocationManager] Mode switch: \(oldMode.rawValue) -> \(newMode.rawValue)")
   116	
   117	        // Clean up previous timers and flush pending data on mode transition
   118	        Task {
   119	            await uploader.stopBatching()
   120	            await uploader.stopHeartbeat()
   121	
   122	            if !oldMode.rawValue.isEmpty {
   123	                await uploader.flush()
   124	            }
   125	        }
   126	
   127	        switch newMode {
   128	        case .stationary:
   129	            clManager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
   130	            clManager.distanceFilter = CLLocationDistanceMax
   131	            clManager.activityType = .other
   132	            Task { await uploader.startHeartbeat(interval: 900) } // 15 min
   133	
   134	        case .walking:
   135	            clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
   136	            clManager.distanceFilter = 30
   137	            clManager.activityType = .fitness
   138	            Task { await uploader.startBatching(interval: 60) } // 1 min
   139	
   140	        case .automotive:

exec
/bin/zsh -lc "nl -ba iOS/smap/Core/Location/LocationUploader.swift | sed -n '1,80p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
     1	import Foundation
     2	import UIKit
     3	import CoreMotion
     4	
     5	/// 위치 데이터 모델
     6	struct LocationData: Codable {
     7	    let lat: Double
     8	    let lng: Double
     9	    let accuracy: Double
    10	    let speed: Double
    11	    let altitude: Double
    12	    let timestamp: String
    13	    let battery: Int
    14	    let steps: Int
    15	}
    16	
    17	/// 위치 데이터 배칭 및 서버 전송 (actor for thread safety)
    18	actor LocationUploader {
    19	
    20	    private let apiClient: APIClient
    21	    private var mtIdx: String
    22	    private var pending: [LocationData] = []
    23	    private let maxQueueSize = 100
    24	    private var lastHeartbeatLocation: LocationData?
    25	    private let pedometer = CMPedometer()
    26	
    27	    private var batchTask: Task<Void, Never>?
    28	    private var heartbeatTask: Task<Void, Never>?
    29	
    30	    var pendingCount: Int { pending.count }
    31	
    32	    init(apiClient: APIClient = .shared, mtIdx: String = "") {
    33	        self.apiClient = apiClient
    34	        self.mtIdx = mtIdx
    35	        self.pending = Self.loadPersistedQueue()
    36	    }
    37	
    38	    func updateMtIdx(_ idx: String) {
    39	        self.mtIdx = idx
    40	    }
    41	
    42	    // MARK: - Queue
    43	
    44	    func enqueue(_ location: LocationData) {
    45	        pending.append(location)
    46	        lastHeartbeatLocation = location
    47	        if pending.count > maxQueueSize {
    48	            pending.removeFirst(pending.count - maxQueueSize)
    49	        }
    50	        print("[LocationUploader] 위치 enqueue (pending: \(pending.count), mtIdx: \(mtIdx))")
    51	    }
    52	
    53	    // MARK: - Batching (이동 중)
    54	
    55	    func startBatching(interval: TimeInterval) {
    56	        stopBatching()
    57	        batchTask = Task { [weak self] in
    58	            while !Task.isCancelled {
    59	                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
    60	                guard !Task.isCancelled else { break }
    61	                await self?.flush()
    62	            }
    63	        }
    64	    }
    65	
    66	    func stopBatching() {
    67	        batchTask?.cancel()
    68	        batchTask = nil
    69	    }
    70	
    71	    // MARK: - Heartbeat (정지 중)
    72	
    73	    func startHeartbeat(interval: TimeInterval) {
    74	        stopHeartbeat()
    75	        heartbeatTask = Task { [weak self] in
    76	            while !Task.isCancelled {
    77	                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
    78	                guard !Task.isCancelled else { break }
    79	                await self?.sendHeartbeat()
    80	            }

exec
/bin/zsh -lc "nl -ba Android/app/src/main/AndroidManifest.xml | sed -n '120,220p'" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
   120	            <intent-filter>
   121	                <action android:name="android.intent.action.VIEW"/>
   122	                <category android:name="android.intent.category.DEFAULT"/>
   123	                <category android:name="android.intent.category.BROWSABLE" />
   124	                <data
   125	                    android:host="smap"
   126	                    android:scheme="smapapp"/>
   127	            </intent-filter>
   128	
   129	            <!-- SMAP 딥링크 처리 (smap://group/{id}/join) -->
   130	            <intent-filter android:autoVerify="true">
   131	                <action android:name="android.intent.action.VIEW"/>
   132	                <category android:name="android.intent.category.DEFAULT"/>
   133	                <category android:name="android.intent.category.BROWSABLE" />
   134	                <data android:scheme="smap" />
   135	                <data android:host="group" />
   136	            </intent-filter>
   137	        </activity>
   138	
   139	        <service android:name=".MyFirebaseMessagingService"
   140	            android:exported="false">
   141	            <intent-filter>
   142	                <action android:name="com.google.firebase.MESSAGING_EVENT" />
   143	            </intent-filter>
   144	        </service>
   145	
   146	        <service android:name=".LocationService"
   147	            android:exported="false"
   148	            android:foregroundServiceType="location" />
   149	
   150	        <receiver
   151	            android:name=".LocationRestartReceiver"
   152	            android:enabled="true"
   153	            android:exported="true">
   154	            <intent-filter>
   155	                <action android:name="android.intent.action.BOOT_COMPLETED" />
   156	                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
   157	            </intent-filter>
   158	        </receiver>
   159	
   160	        <meta-data
   161	            android:name="com.google.android.gms.ads.APPLICATION_ID"
   162	            android:value="@string/admob_app_id"/>
   163	
   164	        <meta-data
   165	            android:name="com.naver.maps.map.NCP_KEY_ID"
   166	            android:value="4e12mmctfk" />
   167	
   168	        <!-- 🔥 Firebase 기본 알림 아이콘 설정 -->
   169	        <meta-data
   170	            android:name="com.google.firebase.messaging.default_notification_icon"
   171	            android:resource="@drawable/ic_stat_notification" />
   172	        <meta-data
   173	            android:name="com.google.firebase.messaging.default_notification_color"
   174	            android:resource="@color/brand_primary" />
   175	
   176	        <!-- Kakao Login Redirect -->
   177	        <activity
   178	            android:name="com.kakao.sdk.auth.AuthCodeHandlerActivity"
   179	            android:exported="true">
   180	            <intent-filter>
   181	                <action android:name="android.intent.action.VIEW" />
   182	                <category android:name="android.intent.category.DEFAULT" />
   183	                <category android:name="android.intent.category.BROWSABLE" />
   184	                <data android:host="oauth"
   185	                    android:scheme="kakao56b34b5e5e538073805559cabc81e1d8" />
   186	            </intent-filter>
   187	        </activity>
   188	        
   189	    </application>
   190	
   191	</manifest> 

**Summarizing detailed analysis and citations**

I'm gathering all key points, hypotheses, code references, and official docs carefully to prepare a structured, cited response with tables and status emojis. This will include issues, reasoning for agreement or disagreement, and recommended minimal changes while respecting citation formats and user instructions.
  ✓ draft.md에서 Claude의 가설과 Option A 내용을 파악한다
  ✓ Android 서비스/매니페스트/리시버를 읽어 heartbeat, lastLocation, AlarmManager 동작을 확인한다
  ✓ iOS 구현과 네트워크/인증 관련 파일을 살펴 비교 근거와 대체 가설을 수집한다
  ✓ 각 가설 및 Option A에 대한 근거 기반 비판/보강을 정리한다
exec
/bin/zsh -lc 'rg -n "member-location-logs" -n backend/app -g"*.py"' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
backend/app/main.py:59:            if "/api/v1/logs/member-location-logs" in message:
backend/app/api/api.py:22:api_router.include_router(member_location_log.router, prefix="/logs", tags=["member-location-logs"])
backend/app/api/v1/api.py:19:api_router.include_router(member_location_log.router, prefix="/logs", tags=["member-location-logs"])
backend/app/api/v1/endpoints/member_location_log.py:50:@router.post("/member-location-logs")
backend/app/api/v1/endpoints/member_location_log.py:56:    # print("==== FastAPI /api/v1/member-location-logs 진입 ====")
backend/app/api/v1/endpoints/member_location_log.py:513:@router.get("/member-location-logs/{mt_idx}")
backend/app/api/v1/endpoints/member_location_log.py:533:@router.get("/member-location-logs/{mt_idx}/summary")
backend/app/api/v1/endpoints/member_location_log.py:563:@router.get("/member-location-logs/{mt_idx}/path")
backend/app/api/v1/endpoints/member_location_log.py:578:@router.get("/member-location-logs/{mt_idx}/daily")
backend/app/api/v1/endpoints/member_location_log.py:602:@router.get("/member-location-logs/{mt_idx}/path")
backend/app/api/v1/endpoints/member_location_log.py:642:@router.get("/member-location-logs/{mt_idx}/daily-summary")
backend/app/api/v1/endpoints/member_location_log.py:675:@router.get("/member-location-logs/{mt_idx}/stay-times")
backend/app/api/v1/endpoints/member_location_log.py:708:@router.get("/member-location-logs/{mt_idx}/map-markers")

exec
/bin/zsh -lc 'rg -n "smap_auth_prefs" -n -g"*.kt"' in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
Android/app/src/main/java/com/dmonster/smap/di/AppModule.kt:18:        return context.getSharedPreferences("smap_auth_prefs", Context.MODE_PRIVATE)
Android/app/src/main/java/com/dmonster/smap/MyFirebaseMessagingService.kt:38:        private const val PREF_NAME = "smap_auth_prefs"
Android/app/src/main/java/com/dmonster/smap/LocationService.kt:97:        private const val AUTH_PREFS = "smap_auth_prefs"

exec
/bin/zsh -lc "sed -n '1,80p' Android/app/src/main/java/com/dmonster/smap/di/AppModule.kt" in /Users/genie/SmapSource/smap_next
 succeeded in 0ms:
package com.dmonster.smap.di

import android.content.Context
import android.content.SharedPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideSharedPreferences(@ApplicationContext context: Context): SharedPreferences {
        return context.getSharedPreferences("smap_auth_prefs", Context.MODE_PRIVATE)
    }
}

**Summarizing alternative root causes and recommendations**

I’m putting together a detailed summary of several alternative root causes related to authorization token issues, location update handling, and system constraints affecting service behavior. I’m also organizing recommended code modifications and addressing all user questions with references to official Android and Google location docs to provide a thorough, well-supported critique and proposal.
codex
대표님, 핵심만 정리해 드리겠습니다.

### [A] 동의하는 가설 & 보강 근거
- ✅ **H1 (displacement+lastLocation 손실)**: STATIONARY 요청이 `setMinUpdateDistanceMeters(50f)`로 고정돼 있어 정지 상태에서 콜백이 거의 발생하지 않고(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:259`), `restoreLastLocation()`은 큐에만 복원하고 `lastLocation` 필드는 계속 `null`이라(`…/LocationService.kt:618`) 15분마다 호출되는 `sendHeartbeat()`가 바로 `return` 합니다(`…/LocationService.kt:441`). Google Fused Location Provider 가이드도 Balanced 모드에서 “수 분 단위 혹은 정지 시 콜백 없음”을 허용한다고 명시합니다(`https://developers.google.com/location-context/fused-location-provider/best-practices`).
- ⚠️ **H2 (pending 조건 분기)**: iOS는 `lastHeartbeatLocation`을 actor에 항상 보관하고(`iOS/smap/Core/Location/LocationUploader.swift:44`) heartbeat가 큐 상태와 무관하게 전송되지만(`…LocationUploader.swift:73`), Android는 `hadPending`이 true면 즉시 종료합니다(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:433`). 네트워크 오류로 `sendLocationToServer()`가 재큐잉하면(`…/LocationService.kt:481`) heartbeat가 장시간 skip될 수 있어 부분적으로 타당합니다.

### [B] 반대/수정 필요
- ❌ **H3 (AlarmManager 대신 coroutine)**: Doze/App Standby에서는 CPU가 대부분 슬립이라 `delay()`로 만든 타이머는 maintenance window가 열릴 때까지 깨어나지 않습니다. Android 공식 문서 *Optimize for Doze and App Standby*가 “Doze 중 일반 타이머/핸들러는 지연되고, 실행 보장 수단은 `setAndAllowWhileIdle()`/`setExactAndAllowWhileIdle()`뿐”이라고 못 박습니다 (`https://developer.android.com/training/monitoring-device-state/doze-standby#restrictions`). 따라서 Alarm 제거는 오히려 heartbeat 누락 위험을 키웁니다.
- ⚠️ **H2 원인성 과대평가**: `hadPending` 분기 자체가 iOS보다 약한 건 맞지만, 현 증상의 “완전 무음”은 `lastLocation`이 null인 상태에서만 발생합니다. 분기 수정보다 복원 로직 보강이 우선입니다.
- ❌ **Option A-3 (displacement 0 + 5분)**: FusedLocation `setMinUpdateDistanceMeters(0f)`는 “센서가 허용하는 한 최대 빈도로 보고하며 배터리 부담 커짐”이라고 레퍼런스에 적혀 있어(`https://developers.google.com/android/reference/com/google/android/gms/location/LocationRequest.Builder#setMinUpdateDistanceMeters(float)`), Balanced 모드에서 5분 주기로 강제 polling하면 LTE/Wi-Fi 스캔이 계속 붙습니다. 배터리 회귀 없이 검증 데이터가 없습니다.
- ❌ **Alarm 15분이 문제라는 주장**: `setAndAllowWhileIdle()`는 앱당 9분 최소 간격이 있어 15분 주기는 정책 한도 밖이며(`https://developer.android.com/reference/android/app/AlarmManager#setAndAllowWhileIdle(int,long,android.app.PendingIntent)`), 따라서 “정상처럼 보였다”가 아니라 실제로 정책상 허용 가능한 설정입니다. 지연 체감이 있었다면 Doze maintenance window 정렬 때문이지 인터벌 때문이 아닙니다.
- ✅ **FGS 재진입 제한 관련 의문 해소**: 서비스는 이미 foreground 상태이고 매니페스트에 `android:foregroundServiceType="location"`이 선언돼 있어(`Android/app/src/main/AndroidManifest.xml:146`), Alarm이 `onStartCommand()`를 재호출해도 Android 12+의 background-start 금지 대상이 아닙니다. `startForeground()`를 분기 최상단에서 즉시 다시 호출하는 구현(`…/LocationService.kt:205`)도 10초 제한을 충족합니다(`https://developer.android.com/guide/components/foreground-services#background-start-restrictions`).

### [C] 제가 놓친 원인/리스크
- ⚠️ **Auth 토큰 일괄 폐기**: `AuthInterceptor`는 어떤 API에서든 401이 오면 즉시 `auth_token`을 삭제합니다(`Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt:16`). 위치 업로드도 같은 클라이언트를 쓰므로 토큰이 날아가면 서버 `/logs/member-location-logs`에서 인증 실패(코드 401 → stopSelf)→서비스 중단 루프가 생깁니다(`backend/app/api/v1/endpoints/member_location_log.py:135`, `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:481`). 우선순위: **높음**.
- ⚠️ **401 누적 stopSelf**: `sendLocationToServer()`는 401이 3회 누적되면 `stopSelf()`를 호출해 버립니다(`…/LocationService.kt:483`). 짧은 기간 동안 백엔드가 401을 반환하면 알림도 함께 사라지므로 현 증상과 다를 수 있지만, 토큰 갱신 없이 기기 재기동 시 서비스가 완전히 멈출 리스크가 있습니다. 우선순위: **중간**.

### [D] Option A 구조적 피드백
1. ⚠️ **Alarm 제거**: Doze 환경에서 coroutine 타이머는 실행 보장이 없어 heartbeat이 maintenance window에 묶입니다. Alarm 유지 + `setExactAndAllowWhileIdle()`로만 정밀도 보완하는 게 안전합니다.
2. ⚠️ **Displacement 0/간격 5분**: Balanced 파워 모드에서 0m 요구는 센서 노이즈마다 콜백을 발생시켜 배터리를 급격히 소모합니다(상기 공식 레퍼런스). 최소 20~30m 혹은 `setMinUpdateIntervalMillis(300000L)` 같이 시간 기반 상한을 적용하는 것이 합리적입니다.
3. ⚠️ **Heartbeat 5~10분**: 5분은 9분 정책에 막혀 실제론 9분 이상으로 강제됩니다. 10분도 Doze 윈도와 어긋나면 체감 지연이 발생하니, “서비스가 살아 있다는 증거”가 필요하다면 서버 측에서 last-seen을 허용 범위 내로 relax하거나 high-priority FCM ping을 병행해야 합니다.
4. ⚠️ **이중 타이머 취소**: coroutine 타이머로 전환한다면 `onDestroy()`에서 `serviceScope.cancel()` 후 재생성하는 로직이 필요합니다. 현 구조는 scope가 final이라 재시작 시 새 timer를 만들 수 없습니다(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:88`).

### [E] 최종 권고 수정안
| 변경 | 위치 | 의도 |
|------|------|------|
| `restoreLastLocation()`에서 JSON을 `CreateLocationLogRequest`뿐 아니라 `Location("cached")` 객체로 복원해 `lastLocation`에 주입 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:609` | 재시작 직후 heartbeat가 즉시 좌표를 전송하도록 보장 |
| STATIONARY 요청에 시간 기반 하한을 추가 (`setMinUpdateIntervalMillis(300000L)`)하고 displacement는 15–20m 수준으로만 완화 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:259` | Google 가이드 범위 내에서 standstill 감지 민감도 향상 |
| Alarm 유지하되 `setExactAndAllowWhileIdle()`와 `setWindow()` 조합으로 지터를 줄이고, heartbeat 실패 시 로그/metric을 서버에 보고 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:382` | Doze 호환성을 잃지 않고 모니터링 강화 |
| 401 대응: `AuthInterceptor`가 토큰을 즉시 삭제하지 말고, 위치 서비스 전용 401 카운터와 재인증 루틴을 도입 | `Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt:16` | 위치 업로드 중 인증 오류가 전체 세션을 망가뜨리지 않도록 함 |

### [F] 합의/미합의 표
| # | 쟁점 | 내 주장(Claude) | 당신 주장(Codex) | 상태 |
|---|------|-----------------|------------------|------|
| 1 | H1 핵심 원인 | displacement 50m + lastLocation 미복원 | 동일 + 코드 근거 제시 | 합의 |
| 2 | H2 pending 분기 | 주기 송신 약화가 원인 | 부분 영향, 근본 원인은 lastLocation null | 부분합의 |
| 3 | H3 (Alarm → coroutine) | coroutine delay가 더 안전 | Doze에서 실행 보장 X, Alarm 유지 필요 | 미합의 |
| 4 | Displacement 0/5분 간격 | 배터리 영향 경미 | 공식 가이드상 배터리 리스크 큼 | 미합의 |
| 5 | FGS 재시작 제한 | Alarm 재시작이 제한에 걸릴 수 있음 | 현재 구현은 type=location FGS로 면제 | 합의 |

⚠️ 다음 단계: 위 권고대로 `lastLocation` 복원과 STATIONARY 요청 재설계부터 적용한 뒤, Alarm 기반 heartbeat 지터를 계측해 필요시 서버 측 모니터링을 추가하시는 것을 추천드립니다.
tokens used
481,987
대표님, 핵심만 정리해 드리겠습니다.

### [A] 동의하는 가설 & 보강 근거
- ✅ **H1 (displacement+lastLocation 손실)**: STATIONARY 요청이 `setMinUpdateDistanceMeters(50f)`로 고정돼 있어 정지 상태에서 콜백이 거의 발생하지 않고(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:259`), `restoreLastLocation()`은 큐에만 복원하고 `lastLocation` 필드는 계속 `null`이라(`…/LocationService.kt:618`) 15분마다 호출되는 `sendHeartbeat()`가 바로 `return` 합니다(`…/LocationService.kt:441`). Google Fused Location Provider 가이드도 Balanced 모드에서 “수 분 단위 혹은 정지 시 콜백 없음”을 허용한다고 명시합니다(`https://developers.google.com/location-context/fused-location-provider/best-practices`).
- ⚠️ **H2 (pending 조건 분기)**: iOS는 `lastHeartbeatLocation`을 actor에 항상 보관하고(`iOS/smap/Core/Location/LocationUploader.swift:44`) heartbeat가 큐 상태와 무관하게 전송되지만(`…LocationUploader.swift:73`), Android는 `hadPending`이 true면 즉시 종료합니다(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:433`). 네트워크 오류로 `sendLocationToServer()`가 재큐잉하면(`…/LocationService.kt:481`) heartbeat가 장시간 skip될 수 있어 부분적으로 타당합니다.

### [B] 반대/수정 필요
- ❌ **H3 (AlarmManager 대신 coroutine)**: Doze/App Standby에서는 CPU가 대부분 슬립이라 `delay()`로 만든 타이머는 maintenance window가 열릴 때까지 깨어나지 않습니다. Android 공식 문서 *Optimize for Doze and App Standby*가 “Doze 중 일반 타이머/핸들러는 지연되고, 실행 보장 수단은 `setAndAllowWhileIdle()`/`setExactAndAllowWhileIdle()`뿐”이라고 못 박습니다 (`https://developer.android.com/training/monitoring-device-state/doze-standby#restrictions`). 따라서 Alarm 제거는 오히려 heartbeat 누락 위험을 키웁니다.
- ⚠️ **H2 원인성 과대평가**: `hadPending` 분기 자체가 iOS보다 약한 건 맞지만, 현 증상의 “완전 무음”은 `lastLocation`이 null인 상태에서만 발생합니다. 분기 수정보다 복원 로직 보강이 우선입니다.
- ❌ **Option A-3 (displacement 0 + 5분)**: FusedLocation `setMinUpdateDistanceMeters(0f)`는 “센서가 허용하는 한 최대 빈도로 보고하며 배터리 부담 커짐”이라고 레퍼런스에 적혀 있어(`https://developers.google.com/android/reference/com/google/android/gms/location/LocationRequest.Builder#setMinUpdateDistanceMeters(float)`), Balanced 모드에서 5분 주기로 강제 polling하면 LTE/Wi-Fi 스캔이 계속 붙습니다. 배터리 회귀 없이 검증 데이터가 없습니다.
- ❌ **Alarm 15분이 문제라는 주장**: `setAndAllowWhileIdle()`는 앱당 9분 최소 간격이 있어 15분 주기는 정책 한도 밖이며(`https://developer.android.com/reference/android/app/AlarmManager#setAndAllowWhileIdle(int,long,android.app.PendingIntent)`), 따라서 “정상처럼 보였다”가 아니라 실제로 정책상 허용 가능한 설정입니다. 지연 체감이 있었다면 Doze maintenance window 정렬 때문이지 인터벌 때문이 아닙니다.
- ✅ **FGS 재진입 제한 관련 의문 해소**: 서비스는 이미 foreground 상태이고 매니페스트에 `android:foregroundServiceType="location"`이 선언돼 있어(`Android/app/src/main/AndroidManifest.xml:146`), Alarm이 `onStartCommand()`를 재호출해도 Android 12+의 background-start 금지 대상이 아닙니다. `startForeground()`를 분기 최상단에서 즉시 다시 호출하는 구현(`…/LocationService.kt:205`)도 10초 제한을 충족합니다(`https://developer.android.com/guide/components/foreground-services#background-start-restrictions`).

### [C] 제가 놓친 원인/리스크
- ⚠️ **Auth 토큰 일괄 폐기**: `AuthInterceptor`는 어떤 API에서든 401이 오면 즉시 `auth_token`을 삭제합니다(`Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt:16`). 위치 업로드도 같은 클라이언트를 쓰므로 토큰이 날아가면 서버 `/logs/member-location-logs`에서 인증 실패(코드 401 → stopSelf)→서비스 중단 루프가 생깁니다(`backend/app/api/v1/endpoints/member_location_log.py:135`, `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:481`). 우선순위: **높음**.
- ⚠️ **401 누적 stopSelf**: `sendLocationToServer()`는 401이 3회 누적되면 `stopSelf()`를 호출해 버립니다(`…/LocationService.kt:483`). 짧은 기간 동안 백엔드가 401을 반환하면 알림도 함께 사라지므로 현 증상과 다를 수 있지만, 토큰 갱신 없이 기기 재기동 시 서비스가 완전히 멈출 리스크가 있습니다. 우선순위: **중간**.

### [D] Option A 구조적 피드백
1. ⚠️ **Alarm 제거**: Doze 환경에서 coroutine 타이머는 실행 보장이 없어 heartbeat이 maintenance window에 묶입니다. Alarm 유지 + `setExactAndAllowWhileIdle()`로만 정밀도 보완하는 게 안전합니다.
2. ⚠️ **Displacement 0/간격 5분**: Balanced 파워 모드에서 0m 요구는 센서 노이즈마다 콜백을 발생시켜 배터리를 급격히 소모합니다(상기 공식 레퍼런스). 최소 20~30m 혹은 `setMinUpdateIntervalMillis(300000L)` 같이 시간 기반 상한을 적용하는 것이 합리적입니다.
3. ⚠️ **Heartbeat 5~10분**: 5분은 9분 정책에 막혀 실제론 9분 이상으로 강제됩니다. 10분도 Doze 윈도와 어긋나면 체감 지연이 발생하니, “서비스가 살아 있다는 증거”가 필요하다면 서버 측에서 last-seen을 허용 범위 내로 relax하거나 high-priority FCM ping을 병행해야 합니다.
4. ⚠️ **이중 타이머 취소**: coroutine 타이머로 전환한다면 `onDestroy()`에서 `serviceScope.cancel()` 후 재생성하는 로직이 필요합니다. 현 구조는 scope가 final이라 재시작 시 새 timer를 만들 수 없습니다(`Android/app/src/main/java/com/dmonster/smap/LocationService.kt:88`).

### [E] 최종 권고 수정안
| 변경 | 위치 | 의도 |
|------|------|------|
| `restoreLastLocation()`에서 JSON을 `CreateLocationLogRequest`뿐 아니라 `Location("cached")` 객체로 복원해 `lastLocation`에 주입 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:609` | 재시작 직후 heartbeat가 즉시 좌표를 전송하도록 보장 |
| STATIONARY 요청에 시간 기반 하한을 추가 (`setMinUpdateIntervalMillis(300000L)`)하고 displacement는 15–20m 수준으로만 완화 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:259` | Google 가이드 범위 내에서 standstill 감지 민감도 향상 |
| Alarm 유지하되 `setExactAndAllowWhileIdle()`와 `setWindow()` 조합으로 지터를 줄이고, heartbeat 실패 시 로그/metric을 서버에 보고 | `Android/app/src/main/java/com/dmonster/smap/LocationService.kt:382` | Doze 호환성을 잃지 않고 모니터링 강화 |
| 401 대응: `AuthInterceptor`가 토큰을 즉시 삭제하지 말고, 위치 서비스 전용 401 카운터와 재인증 루틴을 도입 | `Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt:16` | 위치 업로드 중 인증 오류가 전체 세션을 망가뜨리지 않도록 함 |

### [F] 합의/미합의 표
| # | 쟁점 | 내 주장(Claude) | 당신 주장(Codex) | 상태 |
|---|------|-----------------|------------------|------|
| 1 | H1 핵심 원인 | displacement 50m + lastLocation 미복원 | 동일 + 코드 근거 제시 | 합의 |
| 2 | H2 pending 분기 | 주기 송신 약화가 원인 | 부분 영향, 근본 원인은 lastLocation null | 부분합의 |
| 3 | H3 (Alarm → coroutine) | coroutine delay가 더 안전 | Doze에서 실행 보장 X, Alarm 유지 필요 | 미합의 |
| 4 | Displacement 0/5분 간격 | 배터리 영향 경미 | 공식 가이드상 배터리 리스크 큼 | 미합의 |
| 5 | FGS 재시작 제한 | Alarm 재시작이 제한에 걸릴 수 있음 | 현재 구현은 type=location FGS로 면제 | 합의 |

⚠️ 다음 단계: 위 권고대로 `lastLocation` 복원과 STATIONARY 요청 재설계부터 적용한 뒤, Alarm 기반 heartbeat 지터를 계측해 필요시 서버 측 모니터링을 추가하시는 것을 추천드립니다.
