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
        uploader.startBatching(interval: 60)

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
        uploader.stopBatching()
        uploader.stopHeartbeat()
        uploader.savePendingQueue()
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

        // Clean up previous timers
        uploader.stopBatching()
        uploader.stopHeartbeat()

        // Flush pending data on mode transition
        if !oldMode.rawValue.isEmpty {
            Task { await uploader.flush() }
        }

        switch newMode {
        case .stationary:
            clManager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
            clManager.distanceFilter = CLLocationDistanceMax
            clManager.activityType = .other
            uploader.startHeartbeat(interval: 900) // 15 min

        case .walking:
            clManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
            clManager.distanceFilter = 30
            clManager.activityType = .fitness
            uploader.startBatching(interval: 60) // 1 min

        case .automotive:
            clManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            clManager.distanceFilter = 150
            clManager.activityType = .automotiveNavigation
            uploader.startBatching(interval: 60) // 1 min
        }
    }

    // MARK: - User Info (compatibility)

    func updateUserInfo(mtIdx: String, mtId: String, mtName: String) {
        self.savedMtIdx = mtIdx
        uploader.updateMtIdx(mtIdx)
        print("[LocationManager] User info updated: \(mtIdx)")

        // If we have a cached location, send it immediately
        if let loc = lastLocation, loc.coordinate.latitude != 0 {
            enqueueLocation(loc)
            Task { await uploader.flush() }
        }
    }

    func clearUserInfo() {
        savedMtIdx = ""
        uploader.updateMtIdx("")
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
            // Flush pending data on foreground return
            Task { await uploader.flush() }
        }
    }
}
