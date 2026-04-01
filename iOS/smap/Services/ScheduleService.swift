//
// ScheduleService.swift
// smap
//
// Migrated to use APIClient/APIEndpoint
//

import Foundation

@MainActor
class ScheduleService {
    static let shared = ScheduleService()
    private let apiClient = APIClient.shared
    private init() {}

    private var token: String? { KeychainManager.shared.getToken() }
    private var currentUserId: String { UserDefaults.standard.string(forKey: "mt_idx") ?? "" }

    func getGroupSchedules(groupId: Int, startDate: String, endDate: String, memberId: Int? = nil) async throws -> ScheduleData {
        // Backend expects yyyy-MM-dd
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let apiFormatter = DateFormatter()
        apiFormatter.dateFormat = "yyyy-MM-dd"

        let apiStartDate: String
        if let parsed = displayFormatter.date(from: startDate) {
            apiStartDate = apiFormatter.string(from: parsed)
        } else {
            apiStartDate = startDate
        }

        let apiEndDate: String
        if let parsed = displayFormatter.date(from: endDate) {
            apiEndDate = apiFormatter.string(from: parsed)
        } else {
            apiEndDate = endDate
        }

        let endpoint = APIEndpoint.getGroupSchedules(
            sgtIdx: groupId,
            currentUserId: currentUserId,
            startDate: apiStartDate,
            endDate: apiEndDate,
            memberId: memberId
        )

        let result: ScheduleListResponse = try await apiClient.request(endpoint, token: token)

        if result.success, let scheduleData = result.data {
            return scheduleData
        } else {
            throw APIError(detail: nil, message: result.error ?? "스케줄 로드 실패")
        }
    }

    func createSchedule(_ scheduleRequest: CreateScheduleRequest) async throws -> Bool {
        let endpoint = APIEndpoint.createSchedule(
            sgtIdx: scheduleRequest.groupId,
            currentUserId: currentUserId,
            request: AnyEncodable(scheduleRequest)
        )

        let result: ScheduleSimpleResponse = try await apiClient.request(endpoint, token: token)
        return result.success
    }

    func updateSchedule(_ scheduleRequest: UpdateScheduleRequest) async throws -> Bool {
        let endpoint = APIEndpoint.updateSchedule(
            sgtIdx: scheduleRequest.groupId,
            sstIdx: scheduleRequest.sst_idx,
            currentUserId: currentUserId,
            request: AnyEncodable(scheduleRequest)
        )

        let result: ScheduleSimpleResponse = try await apiClient.request(endpoint, token: token)
        return result.success
    }

    func deleteSchedule(request: DeleteScheduleRequest) async throws -> Bool {
        let endpoint = APIEndpoint.deleteSchedule(
            sgtIdx: request.groupId,
            sstIdx: request.sst_idx,
            currentUserId: currentUserId,
            request: AnyEncodable(request)
        )

        let result: ScheduleSimpleResponse = try await apiClient.request(endpoint, token: token)
        return result.success
    }
}
