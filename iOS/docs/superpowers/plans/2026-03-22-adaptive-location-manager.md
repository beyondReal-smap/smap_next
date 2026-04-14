# Adaptive Location Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the battery-draining single-mode LocationService with a 3-mode adaptive LocationManager that uses CMMotionActivity to switch between stationary/walking/automotive power profiles.

**Architecture:** 3 files with clear separation — MotionManager (activity detection), LocationUploader (batched API calls), LocationManager (GPS control + orchestration). MotionManager determines the mode, LocationManager adjusts GPS settings, LocationUploader handles efficient server transmission.

**Tech Stack:** Swift, CoreLocation, CoreMotion, APIClient (Phase 1 infrastructure)

**Spec:** `docs/superpowers/specs/2026-03-22-adaptive-location-manager-design.md`

---

## File Map

### New Files
```
smap/Core/Location/
├── MotionManager.swift         # CMMotionActivity → PowerMode (~100줄)
├── LocationUploader.swift      # 배칭/heartbeat API 전송 (~150줄)
└── LocationManager.swift       # CLLocationManager + 모드 전환 + 호환성 API (~250줄)

smapTests/Core/Location/
├── MotionManagerTests.swift
└── LocationUploaderTests.swift
```

### Modified Files
```
smap/Services/AuthService.swift               # LocationService.sharedInstance → LocationManager.shared
smap/AppDelegate.swift                        # LocationService → LocationManager
smap/Features/Home/NaverMapView.swift         # getLastLocation() → lastLocation
smap/Features/ActivityLog/ActivityLogView.swift
smap/Features/MyPlace/MyPlaceView.swift
smap/Views/WithdrawView.swift (if references exist)
```

### Deleted Files
```
smap/Helper/LocationService.swift             # 628줄 → 전체 대체
smap/Helper/Data/MltGpsData.swift             # LocationData로 대체
smap/Helper/Data/BaseResult.swift             # LocationService.auth()에서만 사용
smap/Helper/Data/AuthData.swift               # LocationService.auth()에서만 사용
```

---

## Task 1: MotionManager — 활동 감지 (TDD)

**Files:**
- Create: `smap/Core/Location/MotionManager.swift`
- Create: `smapTests/Core/Location/MotionManagerTests.swift`

- [ ] **Step 1: 테스트 작성**

Create: `smapTests/Core/Location/MotionManagerTests.swift`
```swift
import XCTest
import CoreMotion
@testable import smap

final class MotionManagerTests: XCTestCase {

    func testDetermineMode_stationary() {
        let activity = MockMotionActivity(stationary: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .stationary)
    }

    func testDetermineMode_walking() {
        let activity = MockMotionActivity(walking: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_running_mapsToWalking() {
        let activity = MockMotionActivity(running: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_automotive() {
        let activity = MockMotionActivity(automotive: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .automotive)
    }

    func testDetermineMode_cycling_mapsToWalking() {
        let activity = MockMotionActivity(cycling: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_unknown_defaultsToWalking() {
        let activity = MockMotionActivity(unknown: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }
}

// MARK: - Mock

class MockMotionActivity: CMMotionActivity {
    private let _stationary: Bool
    private let _walking: Bool
    private let _running: Bool
    private let _automotive: Bool
    private let _cycling: Bool
    private let _unknown: Bool

    init(stationary: Bool = false, walking: Bool = false, running: Bool = false,
         automotive: Bool = false, cycling: Bool = false, unknown: Bool = false) {
        _stationary = stationary; _walking = walking; _running = running
        _automotive = automotive; _cycling = cycling; _unknown = unknown
        super.init()
    }
    required init?(coder: NSCoder) { fatalError() }

    override var stationary: Bool { _stationary }
    override var walking: Bool { _walking }
    override var running: Bool { _running }
    override var automotive: Bool { _automotive }
    override var cycling: Bool { _cycling }
    override var unknown: Bool { _unknown }
}
```

- [ ] **Step 2: MotionManager 구현**

Create: `smap/Core/Location/MotionManager.swift`
```swift
import Foundation
import CoreMotion

/// CMMotionActivity를 감지하여 LocationManager.PowerMode를 결정
class MotionManager {

    private let activityManager = CMMotionActivityManager()
    private let operationQueue = OperationQueue()
    private var stationaryTimer: Timer?
    private var debounceTimer: Timer?
    private var lastDetectedMode: LocationManager.PowerMode?

    /// 모드 변경 콜백
    var onModeChange: ((LocationManager.PowerMode) -> Void)?

    /// 모션 활동 가용 여부
    var isAvailable: Bool { CMMotionActivityManager.isActivityAvailable() }

    init() {
        operationQueue.maxConcurrentOperationCount = 1
    }

    func startMonitoring() {
        guard isAvailable else {
            print("⚠️ [MotionManager] CMMotionActivity 사용 불가 — 폴백 모드")
            return
        }

        activityManager.startActivityUpdates(to: operationQueue) { [weak self] activity in
            guard let self, let activity else { return }
            let mode = Self.determineMode(from: activity)
            self.handleDetectedMode(mode)
        }
    }

    func stopMonitoring() {
        activityManager.stopActivityUpdates()
        stationaryTimer?.invalidate()
        stationaryTimer = nil
        debounceTimer?.invalidate()
        debounceTimer = nil
    }

    /// CMMotionActivity → PowerMode 매핑 (테스트 가능한 순수 함수)
    static func determineMode(from activity: CMMotionActivity) -> LocationManager.PowerMode {
        if activity.automotive { return .automotive }
        if activity.walking || activity.running || activity.cycling { return .walking }
        if activity.stationary { return .stationary }
        return .walking // unknown → walking (안전한 기본값)
    }

    // MARK: - Private

    private func handleDetectedMode(_ mode: LocationManager.PowerMode) {
        // 동일 모드 반복 → 무시
        guard mode != lastDetectedMode else { return }

        if mode == .stationary {
            // 5분 타이머 시작 (짧은 정지 무시)
            startStationaryTimer()
        } else {
            // 정지 타이머 취소
            cancelStationaryTimer()

            // 10초 디바운싱
            debounceTransition(to: mode)
        }
    }

    private func startStationaryTimer() {
        cancelStationaryTimer()
        DispatchQueue.main.async {
            self.stationaryTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: false) { [weak self] _ in
                self?.lastDetectedMode = .stationary
                self?.onModeChange?(.stationary)
            }
        }
    }

    private func cancelStationaryTimer() {
        DispatchQueue.main.async {
            self.stationaryTimer?.invalidate()
            self.stationaryTimer = nil
        }
    }

    private func debounceTransition(to mode: LocationManager.PowerMode) {
        DispatchQueue.main.async {
            self.debounceTimer?.invalidate()
            self.debounceTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { [weak self] _ in
                self?.lastDetectedMode = mode
                self?.onModeChange?(mode)
            }
        }
    }
}
```

- [ ] **Step 3: 프로젝트에 추가, 테스트 통과 확인**

mkdir + xcodeproj gem으로 추가. 테스트 실행.

- [ ] **Step 4: 커밋**

```bash
git commit -m "feat: add MotionManager for CMMotionActivity-based power mode detection"
```

---

## Task 2: LocationUploader — 배칭/heartbeat 전송 (TDD)

**Files:**
- Create: `smap/Core/Location/LocationUploader.swift`
- Create: `smapTests/Core/Location/LocationUploaderTests.swift`

- [ ] **Step 1: 테스트 작성**

Create: `smapTests/Core/Location/LocationUploaderTests.swift`
```swift
import XCTest
@testable import smap

final class LocationUploaderTests: XCTestCase {

    var uploader: LocationUploader!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let client = APIClient(session: URLSession(configuration: config))
        uploader = LocationUploader(apiClient: client, mtIdx: "42")
    }

    override func tearDown() {
        uploader.stopBatching()
        uploader.stopHeartbeat()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testEnqueue_addsToQueue() {
        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "2026-03-22 12:00:00", battery: 80, steps: 100)
        uploader.enqueue(loc)
        XCTAssertEqual(uploader.pendingCount, 1)
    }

    func testEnqueue_evictsOldest_whenOverMax() {
        for i in 0..<105 {
            let loc = LocationData(lat: Double(i), lng: 0, accuracy: 10, speed: 0,
                                   altitude: 0, timestamp: "", battery: 0, steps: 0)
            uploader.enqueue(loc)
        }
        XCTAssertEqual(uploader.pendingCount, 100) // max 100
    }

    func testFlush_sendsAllPending() async {
        var requestCount = 0
        MockURLProtocol.requestHandler = { request in
            requestCount += 1
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "2026-03-22 12:00:00", battery: 80, steps: 100)
        uploader.enqueue(loc)
        uploader.enqueue(loc)

        await uploader.flush()
        XCTAssertEqual(uploader.pendingCount, 0)
        XCTAssertGreaterThan(requestCount, 0)
    }

    func testFlush_keepsOnFailure() async {
        MockURLProtocol.requestHandler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
        }

        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "", battery: 0, steps: 0)
        uploader.enqueue(loc)

        await uploader.flush()
        XCTAssertEqual(uploader.pendingCount, 1) // still there
    }
}
```

- [ ] **Step 2: LocationUploader 구현**

Create: `smap/Core/Location/LocationUploader.swift`
```swift
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

/// 위치 데이터 배칭 및 서버 전송
class LocationUploader {

    private let apiClient: APIClient
    private var mtIdx: String
    private var pending: [LocationData] = []
    private var batchTimer: Timer?
    private var heartbeatTimer: Timer?
    private let maxQueueSize = 100
    private var lastHeartbeatLocation: LocationData?
    private let pedometer = CMPedometer()

    var pendingCount: Int { pending.count }

    init(apiClient: APIClient = .shared, mtIdx: String = "") {
        self.apiClient = apiClient
        self.mtIdx = mtIdx
        restorePendingQueue()
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
    }

    // MARK: - Batching (이동 중)

    func startBatching(interval: TimeInterval) {
        stopBatching()
        DispatchQueue.main.async {
            self.batchTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
                Task { await self?.flush() }
            }
        }
    }

    func stopBatching() {
        DispatchQueue.main.async {
            self.batchTimer?.invalidate()
            self.batchTimer = nil
        }
    }

    // MARK: - Heartbeat (정지 중)

    func startHeartbeat(interval: TimeInterval) {
        stopHeartbeat()
        DispatchQueue.main.async {
            self.heartbeatTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
                Task { await self?.sendHeartbeat() }
            }
        }
    }

    func stopHeartbeat() {
        DispatchQueue.main.async {
            self.heartbeatTimer?.invalidate()
            self.heartbeatTimer = nil
        }
    }

    // MARK: - Send

    func flush() async {
        guard !pending.isEmpty, !mtIdx.isEmpty else { return }

        let toSend = pending
        for location in toSend {
            let success = await sendSingle(location)
            if success {
                pending.removeAll { $0.timestamp == location.timestamp && $0.lat == location.lat }
            }
        }
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
            let _ = try await apiClient.requestRaw(
                .createLocationLog(params: params),
                token: KeychainManager.shared.getToken()
            )
            return true
        } catch {
            print("❌ [LocationUploader] 전송 실패: \(error)")
            return false
        }
    }

    // MARK: - Persistence

    func savePendingQueue() {
        if let data = try? JSONEncoder().encode(pending) {
            UserDefaults.standard.set(data, forKey: "smap_pending_locations")
        }
    }

    private func restorePendingQueue() {
        if let data = UserDefaults.standard.data(forKey: "smap_pending_locations"),
           let saved = try? JSONDecoder().decode([LocationData].self, from: data) {
            pending = saved
        }
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
```

- [ ] **Step 3: 프로젝트에 추가, 테스트 통과 확인**

- [ ] **Step 4: 커밋**

```bash
git commit -m "feat: add LocationUploader for batched/heartbeat location transmission"
```

---

## Task 3: LocationManager — GPS 제어 + 모드 전환

**Files:**
- Create: `smap/Core/Location/LocationManager.swift`

- [ ] **Step 1: LocationManager 구현**

Create: `smap/Core/Location/LocationManager.swift`
```swift
import Foundation
import CoreLocation
import UIKit

/// 적응형 위치 관리자 — 3단계 전력 모드 자동 전환
class LocationManager: NSObject, CLLocationManagerDelegate {

    static let shared = LocationManager()

    enum PowerMode: String { case stationary, walking, automotive }

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

        // 모션 감지 → 모드 전환
        motionManager.onModeChange = { [weak self] newMode in
            DispatchQueue.main.async {
                self?.switchToMode(newMode)
            }
        }

        NotificationCenter.default.addObserver(self, selector: #selector(appStateChange(_:)),
                                               name: NSNotification.Name("appStateChange"), object: nil)
    }

    // MARK: - Tracking Control

    func startTracking() {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = clManager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }

        guard status == .authorizedAlways || status == .authorizedWhenInUse else {
            print("📍 [LocationManager] 위치 권한 없음 — 추적 시작 불가")
            return
        }

        // 모션 감지 시작
        motionManager.startMonitoring()

        // Walking 모드로 시작 (가장 안전한 기본값)
        switchToMode(.walking)
        clManager.startUpdatingLocation()

        // whenInUse만 있으면 Stationary 모드 비활성화 경고
        if status == .authorizedWhenInUse {
            print("⚠️ [LocationManager] whenInUse 권한만 — Stationary 모드 제한됨")
        }
    }

    func stopTracking() {
        clManager.stopUpdatingLocation()
        motionManager.stopMonitoring()
        uploader.stopBatching()
        uploader.stopHeartbeat()
        uploader.savePendingQueue()
    }

    // MARK: - Mode Switching

    func switchToMode(_ newMode: PowerMode) {
        guard newMode != currentMode else { return }

        // whenInUse 권한이면 stationary 모드 차단
        if newMode == .stationary {
            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) { status = clManager.authorizationStatus }
            else { status = CLLocationManager.authorizationStatus() }
            if status != .authorizedAlways {
                print("⚠️ [LocationManager] Always 권한 없어 Stationary 모드 진입 불가")
                return
            }
        }

        let oldMode = currentMode
        currentMode = newMode
        print("📍 [LocationManager] 모드 전환: \(oldMode.rawValue) → \(newMode.rawValue)")

        // 이전 타이머 정리
        uploader.stopBatching()
        uploader.stopHeartbeat()

        // 모드 전환 시 미전송 데이터 즉시 전송
        if !oldMode.rawValue.isEmpty {
            Task { await uploader.flush() }
        }

        switch newMode {
        case .stationary:
            clManager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
            clManager.distanceFilter = CLLocationDistanceMax
            clManager.activityType = .other
            uploader.startHeartbeat(interval: 900) // 15분

        case .walking:
            clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
            clManager.distanceFilter = 30
            clManager.activityType = .fitness
            uploader.startBatching(interval: 60) // 1분

        case .automotive:
            clManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            clManager.distanceFilter = 150
            clManager.activityType = .automotiveNavigation
            uploader.startBatching(interval: 60) // 1분
        }
    }

    // MARK: - User Info (호환성)

    func updateUserInfo(mtIdx: String, mtId: String, mtName: String) {
        self.savedMtIdx = mtIdx
        uploader.updateMtIdx(mtIdx)
        print("📍 [LocationManager] 사용자 정보 업데이트: \(mtIdx)")

        // 저장된 위치가 있으면 즉시 전송
        if let loc = lastLocation, loc.coordinate.latitude != 0 {
            enqueueLocation(loc)
            Task { await uploader.flush() }
        }
    }

    func clearUserInfo() {
        savedMtIdx = ""
        uploader.updateMtIdx("")
        print("📍 [LocationManager] 사용자 정보 초기화")
    }

    // MARK: - Permission (호환성)

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

        // 유효성 검사
        guard isValidLocation(location) else { return }

        lastLocation = location
        enqueueLocation(location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [LocationManager] 위치 오류: \(error.localizedDescription)")
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
            clManager.startUpdatingLocation()
            pendingAuthCompletion?()
            pendingAuthCompletion = nil
        }
    }

    private func enqueueLocation(_ location: CLLocation) {
        guard !savedMtIdx.isEmpty else { return }

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
            uploader.enqueue(data)
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
            // 포그라운드 복귀 시 미전송 데이터 전송
            Task { await uploader.flush() }
        }
    }
}
```

- [ ] **Step 2: 프로젝트에 추가, 빌드 확인**

- [ ] **Step 3: 커밋**

```bash
git commit -m "feat: add LocationManager with adaptive 3-mode power management"
```

---

## Task 4: 기존 코드 참조 변경 + LocationService 삭제

**Files:**
- Modify: `smap/Services/AuthService.swift`
- Modify: `smap/AppDelegate.swift`
- Modify: `smap/Features/Home/NaverMapView.swift`
- Modify: `smap/Features/ActivityLog/ActivityLogView.swift`
- Modify: `smap/Features/MyPlace/MyPlaceView.swift`
- Delete: `smap/Helper/LocationService.swift`
- Delete: `smap/Helper/Data/MltGpsData.swift`
- Delete: `smap/Helper/Data/BaseResult.swift`
- Delete: `smap/Helper/Data/AuthData.swift`

- [ ] **Step 1: 모든 LocationService 참조를 LocationManager로 변경**

```bash
grep -rn "LocationService" smap/ --include="*.swift" | grep -v "KakaoLocationSearchService" | grep -v "//.*LocationService"
```

각 파일에서:
```swift
// Before
LocationService.sharedInstance.updateUserInfo(...)
LocationService.sharedInstance.clearUserInfo()
LocationService.sharedInstance.getLastLocation()
LocationService.sharedInstance.startLocationUpdatesWithPermissionCheck()

// After
LocationManager.shared.updateUserInfo(...)
LocationManager.shared.clearUserInfo()
LocationManager.shared.lastLocation  // CLLocation? 프로퍼티
LocationManager.shared.startTracking()
```

- [ ] **Step 2: Helper/Data 모델 참조 확인 후 삭제**

```bash
grep -rn "BaseResult\|AuthData\|MltGpsData" smap/ --include="*.swift" | grep -v "Helper/"
```

LocationService.auth() 외에 참조가 없으면 삭제.

- [ ] **Step 3: LocationService.swift 삭제**

```bash
git rm smap/Helper/LocationService.swift
git rm smap/Helper/Data/MltGpsData.swift
git rm smap/Helper/Data/BaseResult.swift
git rm smap/Helper/Data/AuthData.swift
```

프로젝트에서도 참조 제거 (xcodeproj gem).

- [ ] **Step 4: Helper/Utils.swift에서 mtIdx 관련 코드 확인**

LocationService가 `Utils.shared.getMtIdx()` / `Utils.shared.setMtIdx()`를 사용했음. LocationManager는 `savedMtIdx` + `UserDefaultsManager.shared.mtIdx`를 사용. Utils의 mtIdx 메서드가 다른 곳에서 안 쓰이면 제거 가능.

- [ ] **Step 5: 빌드 확인**

```bash
xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' 2>&1 | grep -E "BUILD|error:" | tail -10
```

- [ ] **Step 6: 커밋**

```bash
git commit -m "refactor: replace LocationService with adaptive LocationManager, delete legacy files"
```

---

## Task 5: 전체 빌드 & 테스트 검증

- [ ] **Step 1: 전체 테스트**

```bash
xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:smapTests 2>&1 | grep -c "passed"
```

- [ ] **Step 2: 전체 빌드**

- [ ] **Step 3: 삭제된 파일 확인**

```bash
ls smap/Helper/LocationService.swift 2>&1  # Should not exist
ls smap/Helper/Data/ 2>&1                   # Should be empty or not exist
```

---

## Summary

| Task | 핵심 | 파일 |
|------|------|------|
| 1 | MotionManager (활동 감지) | 1 생성 + 1 테스트 |
| 2 | LocationUploader (배칭 전송) | 1 생성 + 1 테스트 |
| 3 | LocationManager (GPS 모드 전환) | 1 생성 |
| 4 | 참조 변경 + 레거시 삭제 | 5 수정 + 4 삭제 |
| 5 | 전체 검증 | - |

**완료 후 상태:**
- Helper/LocationService.swift (628줄) → Core/Location/ 3개 파일 (~500줄)
- 정지 시 GPS 최소 전력, 15분 heartbeat
- 이동 시 1분 배칭 전송
- CMMotionActivity 자동 모드 전환
- Helper/Data/ 레거시 모델 삭제
