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
    private let authService = AuthService.shared
    
    private init() {}
    
    private var baseURL: String {
        return authService.baseURL
    }
    
    // MARK: - Get Member Locations
    
    /// 특정 멤버의 장소 목록 조회
    func getMemberLocations(memberId: Int) async throws -> [SavedLocation] {
        let url = URL(string: "\(baseURL)/locations/member/\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [MyPlaceService] getMemberLocations URL: \(url.absoluteString)")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [MyPlaceService] Invalid response type")
                throw APIError(detail: nil, message: "Invalid response")
            }
            
            print("🌐 [MyPlaceService] Response status: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode != 200 {
                let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
                print("❌ [MyPlaceService] Error response: \(responseString)")
                throw APIError(detail: nil, message: "장소 목록을 불러오는데 실패했습니다. (Error: \(httpResponse.statusCode))")
            }
            
            // Try to decode
            do {
                let locations = try JSONDecoder().decode([SavedLocation].self, from: data)
                print("📍 [MyPlaceService] Loaded \(locations.count) locations for member \(memberId)")
                return locations
            } catch let decodingError {
                let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
                print("❌ [MyPlaceService] Decoding error: \(decodingError)")
                print("❌ [MyPlaceService] Response data: \(responseString)")
                throw decodingError
            }
        } catch {
            print("❌ [MyPlaceService] Network/request error: \(error.localizedDescription)")
            throw error
        }
    }
    
    // MARK: - Create Location
    
    /// 새 장소 생성
    func createLocation(memberId: Int, request: LocationCreateRequest) async throws -> SavedLocation? {
        let url = URL(string: "\(baseURL)/locations/members/\(memberId)/locations")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        print("🌐 [MyPlaceService] createLocation for member \(memberId): \(request.slt_title)")
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "장소 생성에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(LocationActionResponse.self, from: data)
        if result.success {
            print("✅ [MyPlaceService] Location created: \(result.slt_idx ?? 0)")
            return result.data
        } else {
            throw APIError(detail: nil, message: result.message ?? "장소 생성 실패")
        }
    }
    
    // MARK: - Update Location
    
    /// 장소 정보 수정
    func updateLocation(locationId: Int, request: LocationUpdateRequest) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        print("🌐 [MyPlaceService] updateLocation \(locationId)")
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "장소 수정에 실패했습니다. (Error: \(statusCode))")
        }
        
        // 응답 파싱 시도
        if let result = try? JSONDecoder().decode(SimpleResponse.self, from: data) {
            return result.success
        }
        
        print("✅ [MyPlaceService] Location updated: \(locationId)")
        return true
    }
    
    // MARK: - Delete Location
    
    /// 장소 삭제
    func deleteLocation(locationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [MyPlaceService] deleteLocation \(locationId)")
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "장소 삭제에 실패했습니다. (Error: \(statusCode))")
        }
        
        print("✅ [MyPlaceService] Location deleted: \(locationId)")
        return true
    }
    
    // MARK: - Toggle Notification
    
    /// 장소 알림 설정 토글
    func toggleNotification(locationId: Int, enabled: Bool) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)/notification")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: String] = ["slt_enter_alarm": enabled ? "Y" : "N"]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("🌐 [MyPlaceService] toggleNotification \(locationId) -> \(enabled)")
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "알림 설정 변경에 실패했습니다. (Error: \(statusCode))")
        }
        
        print("✅ [MyPlaceService] Notification toggled for location \(locationId)")
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
