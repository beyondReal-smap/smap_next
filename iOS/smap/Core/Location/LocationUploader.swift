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
