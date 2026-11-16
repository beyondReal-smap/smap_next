//
// HomeView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import NMapsMap

// MARK: - HomeView
//
// 지도는 화면 전체, 조작은 위쪽 떠 있는 줄(그룹 알약·알림·설정)과 아래 시트(멤버·일정)로 나눈다.
// 이전의 왼쪽 사이드바·떠 있는 멤버 버튼·"오늘 일정" 카드·지도 말풍선을 시트 하나가 대신한다(Android 와 같은 구조).

struct HomeView: View {
    /// 지금 보이는 탭인지 — 탭 컨테이너가 홈을 계속 살려 두므로 onAppear 대신 이 값으로 갱신을 켜고 끈다.
    var isActive: Bool = true
    /// 첫 데이터·지도 로딩이 끝났을 때 한 번 — 탭 컨테이너가 이 뒤에 다른 지도 탭을 미리 만든다.
    var onInitialLoadFinished: () -> Void = {}
    @StateObject var viewModel = HomeViewModel()
    @State private var showNotifications = false
    @State private var showSettings = false
    @State private var showGroupPicker = false
    @State private var isSheetExpanded = false
    @State private var isMapLoading = true
    @State private var fitAllToken = 0

    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                NaverMapView(
                    members: $viewModel.members,
                    schedules: viewModel.filteredSchedules,
                    contentInsets: UIEdgeInsets(top: geo.safeAreaInsets.top + 64, left: 0, bottom: HomeSheet.peekHeight, right: 0),
                    fitAllToken: fitAllToken,
                    onMemberTap: { viewModel.selectMember($0) }
                )
                .ignoresSafeArea(edges: .top)

                MapTopScrim()
                    .frame(height: geo.safeAreaInsets.top + 24)
                    .ignoresSafeArea(edges: .top)

                VStack(spacing: 8) {
                    MapTopControls(groupName: viewModel.selectedGroup?.sgt_title, onGroupTap: { showGroupPicker = true }) {
                        MapCircleButton(systemImage: "bell", accessibilityLabel: "알림", badge: viewModel.hasUnreadNotifications) {
                            // 읽음 처리는 목록을 본 뒤(시트가 닫힐 때) 수행한다 — 여는 즉시 처리하면 안 읽은 표시가 의미가 없다.
                            showNotifications = true
                        }
                        MapCircleButton(systemImage: "gearshape", accessibilityLabel: "설정") { showSettings = true }
                    }
                    if let message = viewModel.errorMessage {
                        VStack(spacing: 8) {
                            SMAPBanner(message: message, tone: .error)
                            SMAPButton("다시 시도", style: .outline) { viewModel.retryLoad() }
                                .frame(maxWidth: 200)
                        }
                        .padding(.horizontal, 16)
                    }
                }

                SMAPMapSheet(peekHeight: HomeSheet.peekHeight, isExpanded: $isSheetExpanded) {
                    HomeSheetHeader(members: viewModel.members, currentUserIdx: currentUserIdx, onShowAll: showAll)
                } content: {
                    HomeSheetBody(
                        viewModel: viewModel,
                        currentUserIdx: currentUserIdx,
                        onSelectMember: { viewModel.selectMember($0) },
                        onShowAll: showAll
                    )
                }

                if isMapLoading {
                    MapLoadingOverlay()
                        .transition(.opacity)
                        .zIndex(1000)
                }
            }
        }
        .sheet(isPresented: $showGroupPicker) {
            GroupPickerSheet(
                groups: viewModel.groups,
                selectedGroupId: viewModel.selectedGroup?.sgt_idx,
                onSelect: { viewModel.selectGroup($0) },
                onCreateGroup: { viewModel.showGroupCreationModal = true }
            )
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
        .task {
            // 최초 진입 시 데이터 로드 — 지도 로딩 막은 처음 한 번만 보인다.
            // (이전에는 탭을 떠날 때마다 막을 다시 켜서 돌아올 때마다 "지도 로딩 중"이 깜빡였다.)
            if viewModel.groups.isEmpty {
                await viewModel.fetchInitialData()
            }
            viewModel.resumeUpdates()
            withAnimation(.easeOut(duration: 0.3)) { isMapLoading = false }
            onInitialLoadFinished()
        }
        .onChange(of: isActive) { _, active in
            if active {
                viewModel.resumeUpdates()
                // 홈으로 돌아올 때 멤버 위치 새로고침
                Task { await viewModel.refreshData() }
            } else {
                viewModel.pauseUpdates()
                showGroupPicker = false
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("groupsDidChange"))) { _ in
            Task { await viewModel.refreshData() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // 앱이 foreground로 돌아올 때 위치 데이터 새로고침
            guard isActive else { return }
            Task { await viewModel.refreshData() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    /// 시트 "전체" — 선택을 풀고 모든 멤버가 보이게 지도를 맞춘다.
    private func showAll() {
        viewModel.showAllMembers()
        fitAllToken += 1
    }
}
