//
// MainTabView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import UIKit

// MARK: - MainTabView & Subviews (Consolidated for Compilation)

struct MainTabView: View {
    @State private var selectedTab: Int = 0
    @Namespace private var tabAnimation
    @StateObject private var locationPermission = LocationPermissionChecker()
    @State private var dismissedPermissionView = false
    @State private var showPermissionView = false
    @State private var joiningPendingGroup = false
    @State private var showJoinResult = false
    @State private var joinResultMessage = ""
    @State private var joinFailed = false
    
    // 로그아웃 알림 퍼블리셔
    private let logoutPublisher = NotificationCenter.default.publisher(for: NSNotification.Name("logout"))
    
    init() {
        // 탭바 폰트 전역 설정
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = .white

        // 폰트 설정 (AtoZ Medium, 10pt)
        let fontAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.suite(size: 10, weight: .medium)
        ]
        
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = fontAttributes
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = fontAttributes
        
        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
    
    var body: some View {
        TabView(selection: $selectedTab.animation(.easeInOut(duration: 0.25))) {
            // 1. 홈 (Native)
            HomeView()
                .tabItem {
                    Image(systemName: "house")
                    Text("홈")
                }
                .accessibilityLabel("홈 탭")
                .tag(0)

            // 2. 그룹 (Native)
            GroupListView()
                .tabItem {
                    Image(systemName: "person.3.fill")
                    Text("그룹")
                }
                .accessibilityLabel("그룹 탭")
                .tag(1)

            // 3. 일정 (Native)
            NativeScheduleListView()
                .tabItem {
                    Image(systemName: "calendar")
                    Text("일정")
                }
                .accessibilityLabel("일정 탭")
                .tag(2)

            // 4. 내장소 (Native)
            MyPlaceView()
                .tabItem {
                    Image(systemName: "location.circle")
                    Text("내장소")
                }
                .accessibilityLabel("내장소 탭")
                .tag(3)

            // 5. 활동 로그 (Native)
            ActivityLogView()
                .tabItem {
                    Image(systemName: "clock.arrow.circlepath")
                    Text("활동 로그")
                }
                .accessibilityLabel("활동 로그 탭")
                .tag(4)

            // 6. 채팅 (Native) - TODO: 빌드 에러 해결 후 활성화
            // ChatListView()
            //     .tabItem {
            //         Image(systemName: "bubble.left.and.bubble.right")
            //         Text("채팅")
            //     }
            //     .accessibilityLabel("채팅 탭")
            //     .tag(5)
        }
        .tint(SMAPTheme.Color.primary) // 선택 탭 강조색을 브랜드색(#0113A3)으로 고정
        .onChange(of: selectedTab) { _, _ in
            HapticManager.shared.selection()
            // 탭 전환 시 모든 사이드바 닫기 알림 발생 (현재 선택된 탭 인덱스 전달)
            NotificationCenter.default.post(name: NSNotification.Name("closeSidebars"), object: selectedTab)
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("switchMainTab"))) { note in
            if let tab = note.object as? Int { selectedTab = tab }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("handleGroupJoinDeepLink"))) { _ in
            processPendingGroup()
        }
        .alert("그룹 초대", isPresented: $showJoinResult) {
            if joinFailed { Button("다시 시도") { processPendingGroup() } }
            Button("확인", role: .cancel) {
                if !joinFailed { processPendingGroup() }
            }
        } message: { Text(joinResultMessage) }
        .onReceive(logoutPublisher) { _ in
            // RootView observes "logout" and swaps to LoginView.
            // No UIKit window manipulation needed.
            print("[MainTabView] logout notification received — RootView will handle navigation")
        }
        .task {
            processPendingGroup()
            // 첫 로그인/가입 시에는 AppDelegate가 시스템 권한 팝업을 순차 처리하므로
            // 온보딩 완료 후에만 커스텀 오버레이를 표시
            let hasOnboarded = UserDefaults.standard.bool(forKey: "smap_permission_onboarding_done")
            if hasOnboarded {
                // 이전에 온보딩 완료된 사용자 → 즉시 체크
                showPermissionView = true
            } else {
                // 첫 로그인 → AppDelegate 시스템 팝업이 끝날 때까지 대기 후 체크
                // 시스템 팝업 종료 후 온보딩 플래그가 설정되면 표시
                while !UserDefaults.standard.bool(forKey: "smap_permission_onboarding_done") {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                }
                showPermissionView = true
            }
        }
        .overlay {
            if showPermissionView && !locationPermission.isAuthorized && !dismissedPermissionView {
                LocationPermissionView {
                    dismissedPermissionView = true
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: locationPermission.isAuthorized)
        .animation(.easeInOut(duration: 0.3), value: dismissedPermissionView)
        .animation(.easeInOut(duration: 0.3), value: showPermissionView)
    }

    private func processPendingGroup() {
        guard !joiningPendingGroup,
              let value = UserDefaults.standard.string(forKey: "pending_join_group_id") else { return }
        guard let groupId = Int(value), let memberId = AuthService.shared.getUserData()?.mt_idx else {
            joinFailed = true
            joinResultMessage = "그룹 초대 정보를 확인할 수 없습니다. 다시 로그인 후 시도해주세요."
            showJoinResult = true
            return
        }
        joiningPendingGroup = true
        let code = UserDefaults.standard.string(forKey: "pending_join_group_code")
        Task { @MainActor in
            defer { joiningPendingGroup = false }
            do {
                guard try await GroupService.shared.joinGroupById(mt_idx: memberId, sgt_idx: groupId, code: code) else {
                    throw NetworkError.badRequest("그룹 가입에 실패했습니다.")
                }
                if UserDefaults.standard.string(forKey: "pending_join_group_id") == value && UserDefaults.standard.string(forKey: "pending_join_group_code") == code {
                    UserDefaults.standard.removeObject(forKey: "pending_join_group_id")
                    UserDefaults.standard.removeObject(forKey: "pending_join_group_code")
                }
                NotificationCenter.default.post(name: NSNotification.Name("groupsDidChange"), object: nil)
                joinFailed = false
                joinResultMessage = "그룹에 가입했습니다."
            } catch {
                joinFailed = true
                if let networkError = error as? NetworkError, case .forbidden = networkError {
                    joinResultMessage = "초대 링크가 유효하지 않거나 만료됐어요"
                } else {
                    joinResultMessage = (error as? NetworkError)?.userMessage ?? "그룹 가입에 실패했습니다. 다시 시도해주세요."
                }
            }
            showJoinResult = true
        }
    }

}

