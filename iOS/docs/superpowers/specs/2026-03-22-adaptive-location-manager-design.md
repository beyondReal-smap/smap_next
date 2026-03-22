# Adaptive Location Manager — Battery-Optimized Background Location Tracking

## Overview

SMAP iOS 앱의 백그라운드 위치 추적을 배터리 효율적으로 재구현. CMMotionActivity 기반 3단계 전력 모드 자동 전환으로 정지 시 GPS를 완전히 끄고, 이동 시에만 활성화.

**현재 상태:**
- `Helper/LocationService.swift` (628줄) — 단일 모드, GPS 상시 ON
- `desiredAccuracy = kCLLocationAccuracyNearestTenMeters`, `distanceFilter = 10m`
- `pausesLocationUpdatesAutomatically = false` — iOS 자체 최적화 비활성
- 매 위치 업데이트마다 즉시 API 호출 (배칭 없음)
- CMMotionActivityManager import만 됨 (미사용)

**목표 상태:**
- 3개 파일로 분리: LocationManager, MotionManager, LocationUploader
- 정지 시 GPS OFF (significantLocationChanges만), 15분 heartbeat
- 이동 시 GPS ON, 1분 배칭 전송
- CMMotionActivity로 자동 상태 전환
- 네트워크 실패 시 로컬 큐잉

---

## Architecture

### 파일 구조

```
Core/Location/
├── LocationManager.swift      # CLLocationManager + 전력 모드 전환 (~250줄)
├── MotionManager.swift         # CMMotionActivity 감지 → 모드 결정 (~100줄)
└── LocationUploader.swift      # 배칭 + heartbeat API 전송 (~150줄)
```

### 전력 모드 상태 머신

```
                 ┌──────────────┐
    ┌───────────▶│   Stationary  │◀──────────┐
    │            │ (저전력)       │           │
    │            └──────┬───────┘           │
    │                   │ 이동 감지          │ 5분간 정지
    │                   ▼                   │
    │            ┌──────────────┐           │
    │            │   Walking     │───────────┤
    │            │ (중간 전력)    │           │
    │            └──────┬───────┘           │
    │                   │ automotive 감지    │
    │                   ▼                   │
    │            ┌──────────────┐           │
    └────────────│  Automotive   │───────────┘
                 │ (고전력)       │
                 └──────────────┘
```

### 모드별 설정

| 모드 | GPS 정확도 | 위치 수신 방식 | distanceFilter | API 전송 | 예상 배터리 |
|------|-----------|--------------|----------------|---------|-----------|
| **Stationary** | OFF | significantLocationChanges만 | N/A | 15분 heartbeat | ~0%/h |
| **Walking** | nearestTenMeters | startUpdatingLocation | 50m | 1분 배칭 | ~3%/h |
| **Automotive** | bestForNavigation | startUpdatingLocation | 100m | 1분 배칭 | ~5%/h |

---

## Component Design

### LocationManager (~250줄)

GPS 제어만 담당. 모드 전환 시 CLLocationManager 설정 변경.

```swift
class LocationManager: NSObject, CLLocationManagerDelegate {
    static let shared = LocationManager()

    enum PowerMode: String {
        case stationary, walking, automotive
    }

    private(set) var currentMode: PowerMode = .stationary
    private let clManager = CLLocationManager()
    private let motionManager = MotionManager()
    private let uploader = LocationUploader()

    var lastLocation: CLLocation?
    var savedMtIdx: String = ""
}
```

**핵심 메서드:**
- `startTracking()` — 권한 확인 후 모션 감지 + 위치 추적 시작
- `stopTracking()` — 전체 중지
- `switchToMode(_:)` — 모드 전환 (GPS 설정 변경)
- `locationManager(_:didUpdateLocations:)` — 위치 수신 → uploader에 전달
- `updateUserInfo(mtIdx:mtId:mtName:)` — 기존 호환성 유지
- `clearUserInfo()` — 기존 호환성 유지

**모드 전환 로직:**
```swift
func switchToMode(_ newMode: PowerMode) {
    guard newMode != currentMode else { return }
    currentMode = newMode

    switch newMode {
    case .stationary:
        clManager.stopUpdatingLocation()
        clManager.startMonitoringSignificantLocationChanges()
        uploader.startHeartbeat(interval: 900) // 15분

    case .walking:
        clManager.stopMonitoringSignificantLocationChanges()
        clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        clManager.distanceFilter = 50
        clManager.startUpdatingLocation()
        uploader.startBatching(interval: 60) // 1분

    case .automotive:
        clManager.stopMonitoringSignificantLocationChanges()
        clManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        clManager.distanceFilter = 100
        clManager.startUpdatingLocation()
        uploader.startBatching(interval: 60) // 1분
    }
}
```

**공통 설정 (init에서):**
- `allowsBackgroundLocationUpdates = true`
- `pausesLocationUpdatesAutomatically = true` (iOS 자체 최적화 활용)
- `showsBackgroundLocationIndicator = true`
- `activityType = .other` (모드별로 변경하지 않음 — MotionManager가 판단)

### MotionManager (~100줄)

CMMotionActivity 감지만 담당. 활동 변화를 LocationManager에 전달.

```swift
class MotionManager {
    private let activityManager = CMMotionActivityManager()
    private var stationaryTimer: Timer?
    private var lastActivity: CMMotionActivity?

    var onModeChange: ((LocationManager.PowerMode) -> Void)?
}
```

**핵심 로직:**
- `startMonitoring()` — `CMMotionActivityManager.startActivityUpdates(to:)` 시작
- 활동 감지 시:
  - `stationary` → 5분 타이머 시작. 5분 연속 유지 시 `.stationary` 모드 콜백
  - `walking` / `running` → 10초 유지 확인 후 `.walking` 모드 콜백 + 타이머 취소
  - `automotive` → 10초 유지 확인 후 `.automotive` 모드 콜백 + 타이머 취소
- **디바운싱:** 동일 활동이 10초 미만이면 무시 (버스 정류장에서 잠깐 걷기 등)
- **5분 정지 룰:** 짧은 정지(신호 대기, 엘리베이터)에서 GPS를 끄지 않기 위함

**폴백:** `CMMotionActivityManager.isActivityAvailable()` false인 기기 → 모션 감지 없이 distanceFilter 50m + 1분 쓰로틀링

### LocationUploader (~150줄)

API 전송만 담당. 배칭과 heartbeat를 관리.

```swift
class LocationUploader {
    private let apiClient: APIClient
    private var pendingLocations: [LocationData] = []
    private var batchTimer: Timer?
    private var heartbeatTimer: Timer?
    private let maxQueueSize = 100
}

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
```

**핵심 메서드:**
- `enqueue(_:)` — 위치 데이터를 pendingLocations에 추가
- `startBatching(interval:)` — N초마다 pendingLocations 일괄 전송
- `startHeartbeat(interval:)` — N초마다 마지막 위치 1건 전송
- `flush()` — 즉시 전송 (모드 전환 시, 앱 백그라운드 진입 시)
- `sendToServer(_:)` — APIClient.shared.requestRaw(.createLocationLog(...)) 호출

**네트워크 실패 처리:**
- 전송 실패 시 pendingLocations에 보존
- 다음 전송 시 재시도
- 최대 100건 큐 (초과 시 가장 오래된 데이터 폐기)
- 앱 종료 시 미전송 데이터를 UserDefaults에 저장 → 재시작 시 복원

---

## 모드 전환 상세 규칙

### 정지 진입 (배터리 절약 핵심)
1. CMMotionActivity가 `stationary` 보고
2. 5분 타이머 시작
3. 5분간 연속 stationary 유지
4. `switchToMode(.stationary)` 호출
5. `stopUpdatingLocation()` → **GPS 칩 OFF**
6. `startMonitoringSignificantLocationChanges()` → 셀타워 기반 대기
7. 현재 pendingLocations flush
8. heartbeat 타이머 시작 (15분)

### 정지 해제
두 가지 트리거 중 먼저 발생하는 것:
- **셀타워 변경:** `locationManager(_:didUpdateLocations:)` via significantLocationChanges (~500m 이동)
- **모션 감지:** CMMotionActivity가 walking/automotive 보고 (10초 유지)

해제 시:
1. `stopMonitoringSignificantLocationChanges()`
2. `switchToMode(.walking 또는 .automotive)`
3. 즉시 위치 1건 획득 + 전송

### 이상 상황

| 상황 | 처리 |
|------|------|
| 모션 센서 미지원 기기 | distanceFilter 50m + 1분 쓰로틀링 폴백 |
| 위치 권한 whenInUse만 | 백그라운드 heartbeat 불가, 포그라운드만 동작 |
| 위치 권한 거부 | 추적 중지, 에러 로깅 |
| 네트워크 끊김 | 최대 100건 로컬 큐, 연결 복구 시 일괄 전송 |
| 앱 종료 | 미전송 데이터 UserDefaults 저장, 재시작 시 복원 |
| 정확도 낮은 위치 | horizontalAccuracy > 500m → 폐기 |
| 오래된 위치 | timestamp 5분 이상 지난 데이터 → 폐기 |

---

## 기존 코드와의 호환성

### 삭제 대상
- `Helper/LocationService.swift` (628줄) — 전체 대체

### 호환성 유지 API
기존 코드에서 호출하는 메서드를 LocationManager에 보존:

```swift
// AuthService.saveUserData에서 호출
LocationManager.shared.updateUserInfo(mtIdx:mtId:mtName:)

// AuthService.deleteUserData에서 호출
LocationManager.shared.clearUserInfo()

// AppDelegate에서 호출
LocationManager.shared.startTracking()

// 기존 LocationService.sharedInstance 참조 대응
typealias LocationService = LocationManager // 임시 호환성
```

### 참조 변경 필요한 곳
```
AuthService.swift → LocationService.sharedInstance → LocationManager.shared
AppDelegate.swift → LocationService.sharedInstance → LocationManager.shared
```

---

## 예상 배터리 개선

| 시나리오 | 현재 | 개선 후 | 절약 |
|---------|------|---------|------|
| 하루 종일 사무실 (8h 정지) | ~24%/day (GPS 상시 ON) | ~2%/day (GPS OFF) | **~90%** |
| 출퇴근 (1h 이동 + 7h 정지) | ~27%/day | ~5%/day | **~80%** |
| 하루 종일 이동 (8h) | ~24%/day | ~24%/day | 동일 |

핵심 절약: **정지 시 GPS OFF**. 대부분의 사용자는 하루 중 70-80%를 정지 상태로 보냄.

---

## Testing Strategy

- **MotionManager 단위 테스트:** 디바운싱 로직, 5분 정지 룰, 모드 결정
- **LocationUploader 단위 테스트:** 배칭 타이머, heartbeat, 큐 관리, 네트워크 실패 재시도
- **LocationManager 통합 테스트:** 모드 전환 시 CLLocationManager 설정 변경 확인
- **시뮬레이터 테스트:** Xcode Location Simulation으로 이동/정지 시나리오 재현
