//
// NotificationService.swift
// smap
//
// 푸시 알림 관련 API 서비스
//

import Foundation

class NotificationService {
    static let shared = NotificationService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    /// 회원의 푸시 알림 내역 조회 (최근 7일)
    func getMemberPushLogs(memberId: Int) async throws -> [PushLog] {
        try await apiClient.request(.getMemberPushLogs(memberId: memberId), token: token)
    }

    /// 특정 알림 읽음 처리
    func markAsRead(notificationId: Int) async throws -> Bool {
        let (_, response) = try await apiClient.requestRaw(.markNotificationRead(notificationId: notificationId), token: token)
        return response.statusCode == 200
    }

    /// 모든 알림 읽음 처리
    func markAllAsRead(memberId: Int) async throws -> NotificationActionResponse {
        try await apiClient.request(.markAllNotificationsRead(memberId: memberId), token: token)
    }

    /// 특정 알림 삭제 (plt_show를 'N'으로 변경)
    func deleteNotification(notificationId: Int) async throws -> Bool {
        let (_, response) = try await apiClient.requestRaw(.deleteNotification(notificationId: notificationId), token: token)
        return response.statusCode == 200
    }

    /// 모든 알림 삭제
    func deleteAllNotifications(memberId: Int) async throws -> NotificationActionResponse {
        try await apiClient.request(.deleteAllNotifications(memberId: memberId), token: token)
    }
}
