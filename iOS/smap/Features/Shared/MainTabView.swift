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
    // 탭 전환 좌우 슬라이드 — 시스템 TabView 는 한 프레임에 화면 전체를 바꿔 "깜빡"이는 것처럼 보였고,
    // 화면을 옆으로 미는 전환을 지원하지 않는다. 왼쪽 탭 → 오른쪽 탭이면 새 화면이 오른쪽에서, 반대면 왼쪽에서 들어온다.
    @State private var transitionFrom: Int?
    @State private var transitionProgress: CGFloat = 1
    @State private var transitionToken = 0
    // 지도 탭(내장소·활동 로그)은 한 번 열면 계속 살려 둔다 — 다시 열 때마다 지도를 새로 그리며 깜빡이지 않게.
    @State private var visitedMyPlace = false
    @State private var visitedActivityLog = false
    @State private var keyboardVisible = false
    @StateObject private var locationPermission = LocationPermissionChecker()
    @State private var dismissedPermissionView = false
    @State private var showPermissionView = false
    @State private var joiningPendingGroup = false
    @State private var showJoinResult = false
    @State private var joinResultMessage = ""
    @State private var joinFailed = false
    
    // 로그아웃 알림 퍼블리셔
    private let logoutPublisher = NotificationCenter.default.publisher(for: NSNotification.Name("logout"))
    
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            ZStack {
                tabPage(0, width: width) { HomeView(isActive: selectedTab == 0) }
                if visitedMyPlace { tabPage(3, width: width) { MyPlaceView(isActive: selectedTab == 3) } }
                if visitedActivityLog { tabPage(4, width: width) { ActivityLogView(isActive: selectedTab == 4) } }
                // 그룹·일정은 보일 때와 밀려 나가는 동안만 둔다(열 때마다 새로 불러오는 기존 동작 유지).
                if selectedTab == 1 || transitionFrom == 1 { tabPage(1, width: width) { GroupListView() } }
                if selectedTab == 2 || transitionFrom == 2 { tabPage(2, width: width) { NativeScheduleListView() } }
            }
            .frame(width: width, height: geo.size.height)
            .clipped()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // 시스템 탭바처럼 키보드가 올라오면 키보드 뒤로 숨는다(키보드 위에 탭바가 떠 있지 않게).
            if !keyboardVisible {
                SMAPTabBar(selected: selectedTab, onSelect: switchTab)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardVisible = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardVisible = false }
        .onChange(of: selectedTab) { _, _ in
            HapticManager.shared.selection()
            // 탭 전환 시 모든 사이드바 닫기 알림 발생 (현재 선택된 탭 인덱스 전달)
            NotificationCenter.default.post(name: NSNotification.Name("closeSidebars"), object: selectedTab)
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("switchMainTab"))) { note in
            if let tab = note.object as? Int { switchTab(tab) }
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
            // 로그인 상태에서 구독 상태 조회 + 미완료 거래(서버 검증 지연분) 재처리
            await StoreKitManager.shared.syncAfterLogin()
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

    // MARK: - 탭 전환

    private func switchTab(_ index: Int) {
        guard index != selectedTab, (0...4).contains(index) else { return }
        if index == 3 { visitedMyPlace = true }
        if index == 4 { visitedActivityLog = true }
        transitionToken += 1
        let token = transitionToken
        // 1) 애니메이션 없이 시작 위치(새 화면은 화면 밖)로 놓고 2) 다음 프레임에 제자리로 민다.
        //    한 번에 바꾸면 SwiftUI 가 두 값을 합쳐 첫 위치가 그려지지 않는다.
        var start = Transaction()
        start.disablesAnimations = true
        withTransaction(start) {
            transitionFrom = selectedTab
            transitionProgress = 0
            selectedTab = index
        }
        DispatchQueue.main.async {
            withAnimation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.28)) {
                transitionProgress = 1
            } completion: {
                // 그사이 다른 탭을 또 눌렀으면 그 전환이 정리한다.
                if token == transitionToken { transitionFrom = nil }
            }
        }
    }

    /// 탭 화면 한 장 — 전환 중에는 진행률만큼 옆으로 밀고, 숨은 탭은 보이지 않게·누를 수 없게 둔다.
    private func tabPage<Content: View>(_ index: Int, width: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        let isSelected = index == selectedTab
        let isLeaving = index == transitionFrom && !isSelected
        var x: CGFloat = 0
        if let from = transitionFrom, from != selectedTab {
            let direction: CGFloat = selectedTab > from ? 1 : -1
            if isSelected { x = direction * width * (1 - transitionProgress) }
            if isLeaving { x = -direction * width * transitionProgress }
        }
        return content()
            .offset(x: x)
            .opacity(isSelected || isLeaving ? 1 : 0)
            .allowsHitTesting(isSelected)
            .accessibilityHidden(!isSelected)
            .zIndex(isSelected ? 2 : (isLeaving ? 1 : 0))
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

// MARK: - 하단 탭바

/// 하단 탭바 — Android 와 같은 흰 바탕 + 남색 선택(회색 미선택), 아이콘 위 글자 아래.
private struct SMAPTabBar: View {
    let selected: Int
    let onSelect: (Int) -> Void

    private static let items: [(title: String, icon: String, selectedIcon: String)] = [
        ("홈", "house", "house.fill"),
        ("그룹", "person.2", "person.2.fill"),
        ("일정", "calendar", "calendar"),
        ("내장소", "mappin.circle", "mappin.circle.fill"),
        ("활동 로그", "clock.arrow.circlepath", "clock.arrow.circlepath"),
    ]
    private static let unselectedColor = Color(red: 0x94 / 255, green: 0xA3 / 255, blue: 0xB8 / 255)

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(Self.items.enumerated()), id: \.offset) { index, item in
                let isSelected = index == selected
                Button {
                    onSelect(index)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: isSelected ? item.selectedIcon : item.icon)
                            .font(.system(size: 20, weight: isSelected ? .semibold : .regular))
                            .frame(height: 24)
                        Text(item.title)
                            .font(.suite(size: 11, weight: isSelected ? .medium : .regular))
                            .lineLimit(1)
                    }
                    .foregroundStyle(isSelected ? SMAPTheme.Color.primary : Self.unselectedColor)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(item.title) 탭")
                .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .background {
            Color.white
                .overlay(alignment: .top) { Rectangle().fill(SMAPTheme.Surface.divider).frame(height: 0.5) }
                .ignoresSafeArea(edges: .bottom)
        }
    }
}
