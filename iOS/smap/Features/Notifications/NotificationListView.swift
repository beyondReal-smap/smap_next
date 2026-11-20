//
// NotificationListView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - Notification Components

struct NotificationListView: View {
    @StateObject var viewModel = NotificationViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var showDeleteAllConfirm = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                notificationHeader
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                        statsCard
                            .padding(.bottom, SMAPTheme.Spacing.sm)

                        if viewModel.isLoading && viewModel.notifications.isEmpty {
                            SMAPLoadingView(message: nil)
                                .frame(minHeight: 220)
                        } else if viewModel.notifications.isEmpty {
                            SMAPEmptyState(
                                title: "받은 알림이 없어요",
                                description: "가족의 위치와 그룹 활동 알림이 여기에 표시돼요.",
                                systemImage: "bell.slash"
                            )
                            .frame(minHeight: 220)
                        } else {
                            notificationList
                        }
                    }
                    .frame(maxWidth: 600)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                }
                .refreshable { viewModel.fetchNotifications() }
            }
            .background(Color(uiColor: .systemBackground).ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                viewModel.fetchNotifications()
            }
            .confirmationDialog("알림을 모두 삭제할까요?", isPresented: $showDeleteAllConfirm, titleVisibility: .visible) {
                Button("전체 삭제", role: .destructive) { viewModel.deleteAllNotifications() }
                Button("취소", role: .cancel) { }
            } message: {
                Text("삭제한 알림은 되돌릴 수 없어요.")
            }
            .alert("오류", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
        .smapAccent(.family)
    }

    private var notificationHeader: some View {
        HStack(spacing: SMAPTheme.Spacing.sm) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("뒤로")

            Text("알림")
                .font(SMAPTheme.Font.headline)
                .accessibilityAddTraits(.isHeader)
                .frame(maxWidth: .infinity)

            Menu {
                Button(role: .destructive, action: { showDeleteAllConfirm = true }) {
                    Label("전체 삭제", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("알림 메뉴")
        }
        .foregroundStyle(SMAPTheme.Surface.onSurface)
        .padding(.horizontal, SMAPTheme.Spacing.sm)
        .padding(.vertical, SMAPTheme.Spacing.xs)
        .background(SMAPTheme.Surface.card)
    }

    private var statsCard: some View {
        let total = viewModel.notifications.count
        let unread = viewModel.notifications.filter { $0.plt_read_chk == .N }.count
        return SMAPFamilyCover(image: "LoginArrivalCycling", minHeight: 144) {
            VStack(alignment: .leading, spacing: 5) {
                Text("최근 7일").font(SMAPTheme.Font.captionBold)
                Text(total > 0 ? "받은 알림 \(total)건" : "가족 알림함").font(SMAPTheme.Font.pageTitle)
                    .accessibilityAddTraits(.isHeader)
                if total > 0 {
                    Text("읽지 않음 \(unread)  ·  읽음 \(total - unread)").font(SMAPTheme.Font.secondaryMedium)
                }
            }
        }
    }

    @ViewBuilder
    private var notificationList: some View {
        ForEach(viewModel.notifications) { notification in
            NotificationRow(notification: notification)
                .onAppear {
                    if notification.plt_read_chk == .N {
                        viewModel.markAsRead(notification)
                    }
                }
                .onTapGesture {
                    viewModel.markAsRead(notification)
                }
                .contextMenu {
                    Button(role: .destructive) {
                        viewModel.deleteNotification(notification)
                    } label: {
                        Label("삭제", systemImage: "trash")
                    }
                }
        }
    }
}

struct NotificationListView_Previews: PreviewProvider {
    static var previews: some View {
        NotificationListView()
    }
}
