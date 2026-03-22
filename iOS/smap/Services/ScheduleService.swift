//
// ScheduleService.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import Foundation

@MainActor
class ScheduleService {
    static let shared = ScheduleService()
    private let authService = AuthService.shared
    private init() {}
    private var baseURL: String { return authService.baseURL }

    func getGroupSchedules(groupId: Int, startDate: String, endDate: String, memberId: Int? = nil) async throws -> ScheduleData {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        var components = URLComponents(string: "\(baseURL)/schedule/group/\(groupId)/schedules")!

        // Backend expects yyyy-MM-dd
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let apiFormatter = DateFormatter()
        apiFormatter.dateFormat = "yyyy-MM-dd"

        let apiStartDate = displayFormatter.string(from: displayFormatter.date(from: startDate) ?? Date())
        let apiEndDate = displayFormatter.string(from: displayFormatter.date(from: endDate) ?? Date())

        var queryItems = [
            URLQueryItem(name: "current_user_id", value: currentUserId),
            URLQueryItem(name: "start_date", value: apiStartDate),
            URLQueryItem(name: "end_date", value: apiEndDate)
        ]
        if let memberId = memberId { queryItems.append(URLQueryItem(name: "member_id", value: String(memberId))) }
        components.queryItems = queryItems

        guard let url = components.url else { throw APIError(detail: nil, message: "잘못된 URL 형식입니다.") }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        print("🌐 [ScheduleService] Fetching schedules: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [ScheduleService] Status: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                 let errorBody = String(data: data, encoding: .utf8) ?? ""
                 print("🌐 [ScheduleService] Error body: \(errorBody)")
            }
        }

        if let jsonString = String(data: data, encoding: .utf8) {
            print("📦 [ScheduleService] Raw JSON: \(jsonString)")
        }

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }

        let decoder = JSONDecoder()
        do {
            let result = try decoder.decode(ScheduleListResponse.self, from: data)
            if result.success, let scheduleData = result.data { return scheduleData }
            else { throw APIError(detail: nil, message: result.error ?? "스케줄 로드 실패") }
        } catch {
            // Fallback: Try decoding as raw array [Schedule]
            if let schedules = try? decoder.decode([Schedule].self, from: data) {
                print("⚠️ [ScheduleService] Decoded as raw array. Using default permissions.")
                return ScheduleData(
                    schedules: schedules,
                    groupMembers: [],
                    userPermission: UserPermissions(canManage: false, isOwner: false, isLeader: false)
                )
            }
            print("❌ [ScheduleService] Decoding failed: \(error)")
            throw error
        }
    }

    func createSchedule(_ scheduleRequest: CreateScheduleRequest) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        let url = URL(string: "\(baseURL)/schedule/group/\(scheduleRequest.groupId)/schedules?current_user_id=\(currentUserId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(scheduleRequest)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 생성에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }

    func updateSchedule(_ scheduleRequest: UpdateScheduleRequest) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        let url = URL(string: "\(baseURL)/schedule/group/\(scheduleRequest.groupId)/schedules/\(scheduleRequest.sst_idx)?current_user_id=\(currentUserId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(scheduleRequest)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 수정에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }

    func deleteSchedule(request: DeleteScheduleRequest) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        let urlString = "\(baseURL)/schedule/group/\(request.groupId)/schedules/\(request.sst_idx)?current_user_id=\(currentUserId)"

        guard let url = URL(string: urlString) else { throw APIError(detail: nil, message: "잘못된 URL 형식입니다.") }
        var httpRequest = URLRequest(url: url)
        httpRequest.httpMethod = "DELETE"
        httpRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { httpRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let encoder = JSONEncoder()
        httpRequest.httpBody = try? encoder.encode(request)

        let (data, response) = try await URLSession.shared.data(for: httpRequest)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 삭제에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }
}
