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

    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)

    var body: some View {
        NavigationView {
            ZStack {
                // Background Gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 248/255, green: 250/255, blue: 255/255),
                        Color.white
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Custom Header
                    notificationHeader

                    // Stats Card
                    if !viewModel.notifications.isEmpty {
                        statsCard
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                            .padding(.bottom, 8)
                    }

                    // Content
                    if viewModel.isLoading && viewModel.notifications.isEmpty {
                        Spacer()
                        loadingView
                        Spacer()
                    } else if viewModel.notifications.isEmpty {
                        Spacer()
                        emptyStateView
                        Spacer()
                    } else {
                        notificationList
                    }
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                viewModel.fetchNotifications()
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
    }

    // MARK: - Header
    private var notificationHeader: some View {
        HStack(spacing: 16) {
            // Close Button
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 36, height: 36)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(Circle())
            }

            // Title
            VStack(alignment: .leading, spacing: 2) {
                Text("알림")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("최근 7일간의 알림을 확인하세요")
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }

            Spacer()

            // Menu
            Menu {
                Button(role: .destructive, action: { viewModel.deleteAllNotifications() }) {
                    Label("전체 삭제", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 36, height: 36)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color.white.shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2))
    }

    // MARK: - Stats Card
    private var statsCard: some View {
        HStack(spacing: 16) {
            // Total count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(brandColor)
                Text("전체")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(brandColor.opacity(0.08))
            .cornerRadius(12)

            // Unread count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.filter { $0.plt_read_chk == .N }.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(pinkColor)
                Text("읽지 않음")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(pinkColor.opacity(0.08))
            .cornerRadius(12)

            // Read count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.filter { $0.plt_read_chk == .Y }.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(.green)
                Text("읽음")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.green.opacity(0.08))
            .cornerRadius(12)
        }
    }

    // MARK: - Loading
    private var loadingView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(brandColor.opacity(0.1))
                    .frame(width: 80, height: 80)

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: brandColor))
                    .scaleEffect(1.5)
            }

            Text("알림을 불러오는 중...")
                .font(.suite(size: 14))
                .foregroundColor(.gray)
        }
    }

    // MARK: - Empty State
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [brandColor.opacity(0.1), pinkColor.opacity(0.1)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [brandColor, pinkColor]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)
                    .shadow(color: brandColor.opacity(0.3), radius: 15, x: 0, y: 8)

                Image(systemName: "bell.slash.fill")
                    .font(.suite(size: 32))
                    .foregroundColor(.white)
            }

            VStack(spacing: 8) {
                Text("새로운 알림이 없습니다")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.black)

                Text("위치 공유 및 그룹 활동 알림이\n여기에 표시됩니다")
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.suite(size: 14))
                    .foregroundColor(.blue.opacity(0.7))

                Text("최근 7일간의 알림만 표시됩니다")
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.blue.opacity(0.08))
            .cornerRadius(20)
        }
        .padding(.horizontal, 40)
    }

    // MARK: - Notification List
    private var notificationList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.notifications) { notification in
                    NotificationRow(notification: notification, brandColor: brandColor, pinkColor: pinkColor)
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
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 20)
        }
        .refreshable {
            viewModel.fetchNotifications()
        }
    }
}

struct NotificationListView_Previews: PreviewProvider {
    static var previews: some View {
        NotificationListView()
    }
}
