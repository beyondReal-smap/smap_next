//
// HomeView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import NMapsMap

// MARK: - HomeView (Merged from separate file)

struct HomeView: View {
    @StateObject var viewModel = HomeViewModel()
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var showNotifications = false
    @State private var showSettings = false // 설정 시트용 추가
    @State private var isMapLoading = true  // 지도 로딩 상태


    
    private let sidebarWidth: CGFloat = 320

    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer (Fullscreen from top 60px basically)
            NaverMapView(members: $viewModel.members, schedules: viewModel.filteredSchedules)
                .ignoresSafeArea()
                .offset(y: 60) // Offset map slightly below header
                .task {
                    // 최초 진입 시에만 데이터 로드
                    if viewModel.groups.isEmpty {
                        await viewModel.fetchInitialData()
                    }
                }
                .onAppear {
                    viewModel.resumeUpdates()
                }

            // 2. Header + 오늘 일정 미리보기
            VStack(spacing: 8) {
                HomeHeaderView(
                    groups: viewModel.groups,
                    selectedGroup: $viewModel.selectedGroup,
                    hasUnread: viewModel.hasUnreadNotifications,
                    onSelect: { group in
                        viewModel.selectGroup(group)
                    },
                    onNotificationTap: {
                        // 읽음 처리는 목록을 본 뒤(시트가 닫힐 때) 수행한다 — 여는 즉시 처리하면 안 읽은 표시가 의미가 없다.
                        showNotifications = true
                    },
                    onSettingsTap: {
                        showSettings = true
                    }
                )

                if let message = viewModel.errorMessage {
                    VStack(spacing: 8) {
                        SMAPBanner(message: message, tone: .error)
                        SMAPButton("다시 시도", style: .outline) {
                            viewModel.retryLoad()
                        }
                        .frame(maxWidth: 200)
                    }
                    .padding(.horizontal, 16)
                }

                // 일정·위치 공유 앱 성격 강화 — 홈에서 오늘의 진행 중/다음 일정 바로 확인.
                TodaySchedulePreviewView(schedules: viewModel.homePreviewSchedules) { _ in
                    HapticManager.shared.impact(style: .light)
                    // 일정 탭(tag 2)으로 이동 — MainTabView 가 수신한다.
                    NotificationCenter.default.post(name: NSNotification.Name("switchMainTab"), object: 2)
                }

                Spacer()
            }
            .sheet(isPresented: $showNotifications, onDismiss: {
                // 목록을 열어 본 뒤 닫는 시점에 전체 읽음 처리 (성공 시 배지 해제, 이후 서버 기준으로 재확인)
                viewModel.markAllAsRead()
                viewModel.checkUnreadNotifications()
            }) {
                NotificationListView()
            }
            .sheet(isPresented: $showSettings) {
                SettingMenuView()
            }
            .fullScreenCover(isPresented: $viewModel.showGroupCreationModal) {
                GroupCreationView(viewModel: viewModel)
            }

            // 3. Sidebar Overlay (Blur + Dim)
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .ignoresSafeArea()
                    .onTapGesture {
                        closeSidebar()
                    }
                    .transition(.opacity)
            }

            // 4. Sidebar Content with Gesture
            SidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)

            // 5. Edge Swipe Detection Area (Left Edge)
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // 6. Floating Action Button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionHomeButton(count: viewModel.members.count) {
                        toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }

            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .onAppear {
            handleLoading()
        }
        .task {
            // 홈 화면이 다시 표시될 때 멤버 위치 새로고침
            await viewModel.refreshData()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
            Task { await viewModel.refreshData() }
        }
        .onDisappear {
            viewModel.pauseUpdates()
            // 페이지를 벗어날 때 사이드바 자동(즉시) 닫기
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            // 다시 돌아올 때를 위해 로딩 상태 리셋
            isMapLoading = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // 앱이 foreground로 돌아올 때 위치 데이터 새로고침
            print("🔄 [HomeView] App entered foreground - refreshing location data")
            Task {
                await viewModel.refreshData()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            if let targetTab = notification.object as? Int, targetTab == 0 {
                isMapLoading = true
                handleLoading()
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        // 이미 진행 중인 타이머가 있을 수 있으므로 isMapLoading이 true일 때만 시작
        guard isMapLoading else { return }

        Task {

            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }

            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }

    // MARK: - Computed Properties

    private var sidebarOffset: CGFloat {
        if viewModel.isSidebarOpen {
            return max(0, sidebarDragOffset)
        } else {
            return min(0, -sidebarWidth + sidebarDragOffset)
        }
    }

    private var overlayOpacity: Double {
        let progress: Double
        if viewModel.isSidebarOpen {
            progress = 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth)
        } else {
            progress = Double(sidebarDragOffset) / Double(sidebarWidth)
        }
        return 0.4 * max(0, min(1, progress))
    }

    // MARK: - Gestures

    private var edgeSwipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                if value.translation.width > 0 {
                    sidebarDragOffset = min(sidebarWidth, value.translation.width)
                }
            }
            .onEnded { value in
                if value.translation.width > sidebarWidth * 0.3 || value.predictedEndTranslation.width > sidebarWidth * 0.5 {
                    openSidebar()
                } else {
                    closeSidebar()
                }
            }
    }

    private var sidebarDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                sidebarDragOffset = value.translation.width
            }
            .onEnded { value in
                if viewModel.isSidebarOpen {
                    // Closing gesture (drag left)
                    if value.translation.width < -sidebarWidth * 0.3 || value.predictedEndTranslation.width < -sidebarWidth * 0.5 {
                        closeSidebar()
                    } else {
                        // Snap back open
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            sidebarDragOffset = 0
                        }
                    }
                }
            }
    }

    // MARK: - Actions

    private func openSidebar() {
        HapticManager.shared.impact(style: .light)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            viewModel.isSidebarOpen = true
            sidebarDragOffset = 0
        }
    }

    private func closeSidebar() {
        HapticManager.shared.impact(style: .light)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
        }
    }

    private func toggleSidebar() {
        if viewModel.isSidebarOpen {
            closeSidebar()
        } else {
            openSidebar()
        }
    }
}
