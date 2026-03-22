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
