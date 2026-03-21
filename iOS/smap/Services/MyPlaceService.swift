//
//  MyPlaceService.swift
//  smap
//
//  내장소 API 서비스
//

import Foundation

// MARK: - MyPlace Service

class MyPlaceService {
    static let shared = MyPlaceService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Get Member Locations

    /// 특정 멤버의 장소 목록 조회
    func getMemberLocations(memberId: Int) async throws -> [SavedLocation] {
        try await apiClient.request(.getMemberLocations(memberId: memberId), token: token)
    }

    // MARK: - Create Location

    /// 새 장소 생성
    func createLocation(memberId: Int, request: LocationCreateRequest) async throws -> SavedLocation? {
        let result: LocationActionResponse = try await apiClient.request(
            .createLocation(memberId: memberId, request: AnyEncodable(request)),
            token: token
        )
        guard result.success else {
            throw NetworkError.badRequest(result.message ?? "장소 생성 실패")
        }
        return result.data
    }

    // MARK: - Update Location

    /// 장소 정보 수정
    func updateLocation(locationId: Int, request: LocationUpdateRequest) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(
            .updateLocation(locationId: locationId, request: AnyEncodable(request)),
            token: token
        )
        return result.success
    }

    // MARK: - Delete Location

    /// 장소 삭제
    func deleteLocation(locationId: Int) async throws -> Bool {
        let (_, response) = try await apiClient.requestRaw(.deleteLocation(locationId: locationId), token: token)
        return response.statusCode == 200
    }

    // MARK: - Toggle Notification

    /// 장소 알림 설정 토글
    func toggleNotification(locationId: Int, enabled: Bool) async throws -> Bool {
        let _ = try await apiClient.requestRaw(
            .toggleLocationNotification(locationId: locationId, enabled: enabled ? "Y" : "N"),
            token: token
        )
        return true
    }
}

// MARK: - Location Action Response (for create)

struct LocationActionResponse: Codable {
    let success: Bool
    let message: String?
    let member_id: Int?
    let slt_idx: Int?
    let data: SavedLocation?
}
