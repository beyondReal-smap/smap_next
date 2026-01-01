//
// NotificationService.swift
// smap
//
// 푸시 알림 관련 API 서비스
//

import Foundation

class NotificationService {
    static let shared = NotificationService()
    private let authService = AuthService.shared
    private let baseURL = "https://api3.smap.site/api/v1"
    
    private init() {}
    
    /// 회원의 푸시 알림 내역 조회 (최근 7일)
    func getMemberPushLogs(memberId: Int) async throws -> [PushLog] {
        let url = URL(string: "\(baseURL)/push-logs/member/\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [NotificationService] getMemberPushLogs request: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "알림 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([PushLog].self, from: data)
    }
    
    /// 특정 알림 읽음 처리
    func markAsRead(notificationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/push-logs/\(notificationId)/read")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    
    /// 모든 알림 읽음 처리
    func markAllAsRead(memberId: Int) async throws -> NotificationActionResponse {
        let url = URL(string: "\(baseURL)/push-logs/read-all?mt_idx=\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "알림 읽음 처리에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(NotificationActionResponse.self, from: data)
    }
    
    /// 특정 알림 삭제 (plt_show를 'N'으로 변경)
    func deleteNotification(notificationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/push-logs/\(notificationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    
    /// 모든 알림 삭제
    func deleteAllNotifications(memberId: Int) async throws -> NotificationActionResponse {
        let url = URL(string: "\(baseURL)/push-logs/delete-all?mt_idx=\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "알림 삭제에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(NotificationActionResponse.self, from: data)
    }
}
