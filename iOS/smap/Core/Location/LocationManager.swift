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

    private var clearingSessionTask: Task<Void, Never>?
    private var sessionGeneration = UUID()
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
        // WhenInUse 권한일 때 STATIONARY로 진입하면 desiredAccuracy=ThreeKilometers + heartbeat만으로
        // 백그라운드에서는 콜백이 거의 들어오지 않아 "정지된 듯"보이는 회귀가 발생한다.
        // 이를 강제 차단(return)하면 모드 전환 자체가 실패하므로, WALKING으로 graceful fallback해
        // 추적은 계속 유지한다(Always 권한 부여 시 다음 motion change에서 STATIONARY 진입).
        var effectiveMode = newMode
        if newMode == .stationary {
            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) { status = clManager.authorizationStatus }
            else { status = CLLocationManager.authorizationStatus() }
            if status != .authorizedAlways {
                print("[LocationManager] No Always permission - falling back to walking instead of stationary")
                effectiveMode = .walking
            }
        }

        guard effectiveMode != currentMode else { return }

        let oldMode = currentMode
        currentMode = effectiveMode
        let newMode = effectiveMode
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
        let clearing = clearingSessionTask
        let generation = sessionGeneration
        Task {
            await clearing?.value
            guard generation == sessionGeneration else { return }
            await uploader.updateMtIdx(mtIdx)
        }
        print("[LocationManager] User info updated: \(mtIdx)")

        // If we have a cached location, send it immediately
        if let loc = lastLocation, loc.coordinate.latitude != 0 {
            enqueueLocation(loc)
            Task { await uploader.flush() }
        }
    }

    func clearUserInfo() {
        sessionGeneration = UUID()
        stopTracking()
        savedMtIdx = ""
        lastLocation = nil
        UserDefaults.standard.removeObject(forKey: "smap_pending_locations")
        let prior = clearingSessionTask
        clearingSessionTask = Task {
            await prior?.value
            await uploader.clearSession()
        }
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

        // Validate location with mode-specific accuracy threshold
        guard isValidLocation(location, forMode: currentMode) else { return }

        lastLocation = location
        enqueueLocation(location)
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
        let previousStatus = locationAuthStatus
        locationAuthStatus = status

        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            startTracking()
            pendingAuthCompletion?()
            pendingAuthCompletion = nil

        case .denied, .restricted:
            // 권한이 박탈되면 즉시 추적 중단. 그렇지 않으면 batchTask가 계속 돌면서
            // sendSingle을 시도하다 401/네트워크 에러로 배터리만 소모한다.
            if isTracking {
                print("[LocationManager] Permission revoked (\(status.rawValue)) - stopping tracking")
                stopTracking()
            }
            pendingAuthCompletion?()
            pendingAuthCompletion = nil

        case .notDetermined:
            // 사용자가 아직 응답하지 않은 상태. 시스템 다이얼로그 결과를 기다린다.
            break

        @unknown default:
            print("[LocationManager] Unknown auth status: \(status.rawValue), previous: \(String(describing: previousStatus))")
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

        let generation = sessionGeneration
        Task {
            let uploaderGeneration = await uploader.currentSessionGeneration()
            let steps = await uploader.getCurrentStepCount()
            guard generation == sessionGeneration else { return }
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
            await uploader.enqueue(data, generation: uploaderGeneration)
        }
    }

    private func isValidLocation(_ location: CLLocation, forMode mode: PowerMode) -> Bool {
        let c = location.coordinate
        if c.latitude == 0.0 && c.longitude == 0.0 { return false }
        if c.latitude < -90 || c.latitude > 90 { return false }
        if c.longitude < -180 || c.longitude > 180 { return false }
        if location.horizontalAccuracy < 0 { return false }   // invalid fix per Apple docs
        // 모드별 정확도 임계값. STATIONARY는 desiredAccuracy=ThreeKilometers라 큰 오차가 정상이지만,
        // WALKING/AUTOMOTIVE는 NearestTenMeters/BestForNavigation이라 큰 오차는 노이즈로 보고 차단.
        let accuracyThreshold: CLLocationDistance
        switch mode {
        case .walking:    accuracyThreshold = 100
        case .automotive: accuracyThreshold = 150
        case .stationary: accuracyThreshold = 1000
        }
        if location.horizontalAccuracy > accuracyThreshold { return false }
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
