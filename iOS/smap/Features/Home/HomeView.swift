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
    @State private var scheduleFocus: MapFocus?

    private var currentUserIdx: Int? { AuthService.shared.getUserData()?.mt_idx }

    var body: some View {
        let schedules = viewModel.sheetSchedules
        GeometryReader { geo in
            ZStack(alignment: .top) {
                NaverMapView(
                    members: $viewModel.members,
                    groupID: viewModel.selectedGroup?.sgt_idx,
                    // 시트 목록과 같은 일정 — "전체"에서도 그룹 일정이 지도에 보이고, 마커 번호가 목록 순서와 같다(Android 와 같게).
                    // 이전에는 멤버를 골라야만 일정 마커가 떠서, 목록에서 일정을 눌러 옮겨 가도 마커가 없었다.
                    schedules: schedules,
                    contentInsets: UIEdgeInsets(top: geo.safeAreaInsets.top + 64, left: 0, bottom: HomeSheet.peekHeight, right: 0),
                    fitAllToken: fitAllToken,
                    onMemberTap: selectMember,
                    focus: scheduleFocus
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
                    .smapAccent(.family)
                    if let message = viewModel.errorMessage {
                        VStack(spacing: 8) {
                            SMAPBanner(message: message, tone: .error)
                            SMAPButton("다시 시도", style: .outline) { viewModel.retryLoad() }
                                .frame(maxWidth: 200)
                        }
                        .padding(.horizontal, 16)
                    }
                }

                SMAPMapSheet(peekHeight: HomeSheet.peekHeight, isExpanded: $isSheetExpanded,
                             maxHeightFraction: 0.72, headerSurface: SMAPTheme.Family.paper, keepsContentSize: true) {
                    HomeSheetHeader(members: viewModel.members, currentUserIdx: currentUserIdx,
                                    selectedDate: viewModel.selectedDate, onShowAll: showAll)
                } content: { expansionProgress, toggleSheet in
                    HomeSheetBody(
                        viewModel: viewModel,
                        schedules: schedules,
                        currentUserIdx: currentUserIdx,
                        isExpanded: isSheetExpanded,
                        expansionProgress: expansionProgress,
                        onToggleSchedule: toggleSheet,
                        onSelectMember: selectMember,
                        onShowAll: showAll,
                        onSelectSchedule: focusSchedule
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
                onCreateGroup: { viewModel.showGroupCreationModal = true },
                compact: true
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

    private func selectMember(_ member: SmapGroupMember) {
        viewModel.selectMember(member)
        isSheetExpanded = false
    }

    /// 시트에서 일정을 누르면 그 일정의 장소로 지도를 옮기고 시트를 접어 지도를 보여 준다.
    private func focusSchedule(_ schedule: SmapSchedule) {
        guard let coordinate = schedule.mapCoordinate else { return }
        isSheetExpanded = false
        scheduleFocus = MapFocus(latitude: coordinate.latitude, longitude: coordinate.longitude, token: (scheduleFocus?.token ?? 0) + 1)
    }

    /// 시트 "전체" — 선택을 풀고 모든 멤버가 보이게 지도를 맞춘다.
    private func showAll() {
        isSheetExpanded = false
        viewModel.showAllMembers()
        fitAllToken += 1
    }
}
