import Foundation
import CoreMotion

/// GPS power mode determined by motion activity
enum PowerMode: String { case stationary, walking, automotive }

/// CMMotionActivity를 감지하여 PowerMode를 결정
class MotionManager {

    private let activityManager = CMMotionActivityManager()
    private let operationQueue = OperationQueue()
    private var stationaryTimer: Timer?
    private var debounceTimer: Timer?
    private var lastDetectedMode: PowerMode?

    /// 모드 변경 콜백
    var onModeChange: ((PowerMode) -> Void)?

    /// 모션 활동 가용 여부
    var isAvailable: Bool { CMMotionActivityManager.isActivityAvailable() }

    init() {
        operationQueue.maxConcurrentOperationCount = 1
    }

    func startMonitoring() {
        guard isAvailable else {
            print("[MotionManager] CMMotionActivity not available - fallback mode")
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

    /// CMMotionActivity -> PowerMode mapping (pure function, testable)
    static func determineMode(from activity: CMMotionActivity) -> PowerMode {
        if activity.automotive { return .automotive }
        if activity.walking || activity.running || activity.cycling { return .walking }
        if activity.stationary { return .stationary }
        return .walking // unknown -> walking (safe default)
    }

    // MARK: - Private

    private func handleDetectedMode(_ mode: PowerMode) {
        // Same mode repeated -> ignore
        guard mode != lastDetectedMode else { return }

        if mode == .stationary {
            // Start 5-minute timer (ignore brief stops)
            startStationaryTimer()
        } else {
            // Cancel stationary timer
            cancelStationaryTimer()

            // 10-second debounce
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

    private func debounceTransition(to mode: PowerMode) {
        DispatchQueue.main.async {
            self.debounceTimer?.invalidate()
            self.debounceTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { [weak self] _ in
                self?.lastDetectedMode = mode
                self?.onModeChange?(mode)
            }
        }
    }
}
