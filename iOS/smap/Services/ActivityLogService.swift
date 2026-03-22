//
//  ActivityLogService.swift
//  smap
//
//  Extracted from LoginView.swift - Activity log API service
//

import Foundation
import Combine

@MainActor
class ActivityLogService {
    static let shared = ActivityLogService()

    private let baseURL: String
    private var cancellables = Set<AnyCancellable>()

    private init() {
        self.baseURL = "https://api3.smap.site/api/v1"
    }

    // MARK: - Private Helpers

    private func getAuthToken() -> String? {
        return AuthService.shared.getToken()
    }

    private func createRequest(url: URL, method: String = "GET") -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = getAuthToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    // MARK: - API Methods

    /// 최근 N일간 그룹 멤버들의 일별 위치 기록 카운트 조회
    func getDailyLocationCounts(groupId: Int, days: Int = 14) async throws -> DailyCountsResponse {
        guard let url = URL(string: "\(baseURL)/logs/daily-counts?group_id=\(groupId)&days=\(days)") else {
            throw URLError(.badURL)
        }

        let request = createRequest(url: url)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getDailyLocationCounts failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(DailyCountsResponse.self, from: data)
    }

    /// 특정 회원의 특정 날짜 지도 마커 데이터 조회
    func getMapMarkers(memberId: Int, date: String, minSpeed: Double = 1.0, maxAccuracy: Double = 50.0) async throws -> [MapMarker] {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/map-markers?date=\(date)&min_speed=\(minSpeed)&max_accuracy=\(maxAccuracy)") else {
            throw URLError(.badURL)
        }

        let request = createRequest(url: url)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getMapMarkers failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<[MapMarker]>.self, from: data)

        return apiResponse.data ?? []
    }

    /// 특정 회원의 특정 날짜 체류시간 분석 조회
    func getStayTimes(memberId: Int, date: String, minSpeed: Double = 1.0, maxAccuracy: Double = 50.0, minDuration: Int = 5) async throws -> [StayTime] {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/stay-times?date=\(date)&min_speed=\(minSpeed)&max_accuracy=\(maxAccuracy)&min_duration=\(minDuration)") else {
            throw URLError(.badURL)
        }

        let request = createRequest(url: url)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getStayTimes failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<[StayTime]>.self, from: data)

        return apiResponse.data ?? []
    }

    /// 위치 로그 요약 정보 조회 (PHP 로직 기반)
    func getLocationLogSummary(memberId: Int, date: String) async throws -> LocationSummary? {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/summary?date=\(date)") else {
            throw URLError(.badURL)
        }

        let request = createRequest(url: url) // GET Request

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getLocationLogSummary failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<LocationSummary>.self, from: data)

        return apiResponse.data
    }

    /// 특정 날짜의 그룹 멤버별 위치 기록 활동 조회
    func getMemberActivityByDate(groupId: Int, date: String) async throws -> MemberActivityResponse? {
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        guard let url = URL(string: "\(baseURL)/logs/member-activity?group_id=\(groupId)&date=\(date)&_t=\(timestamp)") else {
            throw URLError(.badURL)
        }

        let request = createRequest(url: url)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getMemberActivityByDate failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<MemberActivityResponse>.self, from: data)

        return apiResponse.data
    }

    // MARK: - Combine Publishers (Alternative)

    func getDailyLocationCountsPublisher(groupId: Int, days: Int = 14) -> AnyPublisher<DailyCountsResponse, Error> {
        guard let url = URL(string: "\(baseURL)/logs/daily-counts?group_id=\(groupId)&days=\(days)") else {
            return Fail(error: URLError(.badURL)).eraseToAnyPublisher()
        }

        let request = createRequest(url: url)

        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: DailyCountsResponse.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }

    func getMapMarkersPublisher(memberId: Int, date: String) -> AnyPublisher<[MapMarker], Error> {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/map-markers?date=\(date)&min_speed=1.0&max_accuracy=50.0") else {
            return Fail(error: URLError(.badURL)).eraseToAnyPublisher()
        }

        let request = createRequest(url: url)

        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: ActivityLogAPIResponse<[MapMarker]>.self, decoder: JSONDecoder())
            .map { $0.data ?? [] }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
}
