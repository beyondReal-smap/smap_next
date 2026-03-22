//
// MainTabView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - MainTabView & Subviews (Consolidated for Compilation)

struct MainTabView: View {
    @State private var selectedTab: Int = 0
    @Namespace private var tabAnimation
    @StateObject private var locationPermission = LocationPermissionChecker()
    @State private var dismissedPermissionView = false
    @State private var showPermissionView = false
    
    // 로그아웃 알림 퍼블리셔
    private let logoutPublisher = NotificationCenter.default.publisher(for: NSNotification.Name("logout"))
    
    init() {
        // 탭바 폰트 전역 설정
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = .white
        
        // 아이콘 + 텍스트 색상
        let _ = UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1.0)
        let _ = UIColor.systemGray
        
        // 폰트 설정 (SUITE-Medium, 10pt)
        let fontAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "SUITE-Medium", size: 10) ?? UIFont.systemFont(ofSize: 10, weight: .medium)
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
        }
        .onChange(of: selectedTab) { _, _ in
            HapticManager.shared.selection()
            // 탭 전환 시 모든 사이드바 닫기 알림 발생 (현재 선택된 탭 인덱스 전달)
            NotificationCenter.default.post(name: NSNotification.Name("closeSidebars"), object: selectedTab)
        }
        .onReceive(logoutPublisher) { _ in
            // RootView observes "logout" and swaps to LoginView.
            // No UIKit window manipulation needed.
            print("[MainTabView] logout notification received — RootView will handle navigation")
        }
        .task {
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
}

