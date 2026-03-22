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
        .onChange(of: selectedTab) { _ in
            HapticManager.shared.selection()
            // 탭 전환 시 모든 사이드바 닫기 알림 발생 (현재 선택된 탭 인덱스 전달)
            NotificationCenter.default.post(name: NSNotification.Name("closeSidebars"), object: selectedTab)
        }
        .onReceive(logoutPublisher) { _ in
            // RootView observes "logout" and swaps to LoginView.
            // No UIKit window manipulation needed.
            print("[MainTabView] logout notification received — RootView will handle navigation")
        }
    }
}

