//
//  NotificationViewModel.swift
//  smap
//
//  Extracted from LoginView.swift - Notification list ViewModel
//

import Foundation
import SwiftUI

class NotificationViewModel: ObservableObject {
    @Published var notifications: [PushLog] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private let notificationService = NotificationService.shared
    private let authService = AuthService.shared

    /// 알림 목록 가져오기
    func fetchNotifications() {
        guard let user = getLoggedInUser() else {
            self.errorMessage = "사용자 정보를 찾을 수 없습니다."
            return
        }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                let logs = try await notificationService.getMemberPushLogs(memberId: user.mt_idx ?? 0)
                DispatchQueue.main.async {
                    self.notifications = logs
                    self.isLoading = false
                    print("📝 [NotificationViewModel] \(logs.count)개의 알림을 가져왔습니다.")
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    print("❌ [NotificationViewModel] 알림 조회 실패: \(error)")
                }
            }
        }
    }

    /// 특정 알림 읽음 처리
    func markAsRead(_ notification: PushLog) {
        guard notification.plt_read_chk == .N else { return }

        Task {
            do {
                let success = try await notificationService.markAsRead(notificationId: notification.plt_idx)
                if success {
                    print("✅ [NotificationViewModel] 읽음 처리 성공: \(notification.plt_idx)")
                    DispatchQueue.main.async {
                        if let index = self.notifications.firstIndex(where: { $0.plt_idx == notification.plt_idx }) {
                            // 로컬 상태 업데이트
                            let log = self.notifications[index]
                            let updated = PushLog(
                                plt_idx: log.plt_idx,
                                plt_type: log.plt_type,
                                mt_idx: log.mt_idx,
                                sst_idx: log.sst_idx,
                                plt_condition: log.plt_condition,
                                plt_memo: log.plt_memo,
                                plt_title: log.plt_title,
                                plt_content: log.plt_content,
                                plt_sdate: log.plt_sdate,
                                plt_status: log.plt_status,
                                plt_read_chk: .Y,
                                plt_show: log.plt_show,
                                push_json: log.push_json,
                                plt_wdate: log.plt_wdate,
                                plt_rdate: ISO8601DateFormatter().string(from: Date())
                            )
                            self.notifications[index] = updated
                            print("📝 [NotificationViewModel] 로컬 상태 업데이트 완료 (Index: \(index))")
                            // 홈 화면 배지 동기화를 위해 알림 발송
                            NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                        }
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 읽음 처리 실패: \(error)")
            }
        }
    }

    /// 모든 알림 읽음 처리
    func markAllAsRead() {
        guard let user = getLoggedInUser() else { return }

        Task {
            do {
                let response = try await notificationService.markAllAsRead(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    DispatchQueue.main.async {
                        self.notifications = self.notifications.map { log in
                            return PushLog(
                                plt_idx: log.plt_idx,
                                plt_type: log.plt_type,
                                mt_idx: log.mt_idx,
                                sst_idx: log.sst_idx,
                                plt_condition: log.plt_condition,
                                plt_memo: log.plt_memo,
                                plt_title: log.plt_title,
                                plt_content: log.plt_content,
                                plt_sdate: log.plt_sdate,
                                plt_status: log.plt_status,
                                plt_read_chk: .Y,
                                plt_show: log.plt_show,
                                push_json: log.push_json,
                                plt_wdate: log.plt_wdate,
                                plt_rdate: ISO8601DateFormatter().string(from: Date())
                            )
                        }
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 전체 읽음 처리 실패: \(error)")
            }
        }
    }

    /// 특정 알림 삭제
    func deleteNotification(_ notification: PushLog) {
        Task {
            do {
                let success = try await notificationService.deleteNotification(notificationId: notification.plt_idx)
                if success {
                    DispatchQueue.main.async {
                        self.notifications.removeAll(where: { $0.id == notification.id })
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 알림 삭제 실패: \(error)")
            }
        }
    }

    /// 모든 알림 삭제
    func deleteAllNotifications() {
        guard let user = getLoggedInUser() else { return }

        Task {
            do {
                let response = try await notificationService.deleteAllNotifications(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    DispatchQueue.main.async {
                        self.notifications.removeAll()
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 전체 삭제 실패: \(error)")
            }
        }
    }

    /// 로그인된 사용자 정보 가져오기
    private func getLoggedInUser() -> SMAPUser? {
        if let data = UserDefaults.standard.data(forKey: "smap_user_data"),
           let user = try? JSONDecoder().decode(SMAPUser.self, from: data) {
            return user
        }
        return nil
    }
}
