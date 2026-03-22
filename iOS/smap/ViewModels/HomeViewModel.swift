//
//  HomeViewModel.swift
//  smap
//
//  Extracted from LoginView.swift - Home tab ViewModel
//

import Foundation
import SwiftUI

@MainActor
class HomeViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var members: [SmapGroupMember] = []
    @Published var schedules: [SmapSchedule] = []

    @Published var selectedDate: Date = Date()
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var isSidebarOpen: Bool = false
    @Published var hasUnreadNotifications: Bool = false
    @Published var showGroupCreationModal: Bool = false

    private let homeService = HomeService.shared
    private var badgePollingTimer: Timer?
    private var syncObserver: Any?

    init() {
        // 알림 상태 동기화를 위한 observer 추가
        syncObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("notificationSyncNeeded"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.checkUnreadNotifications()
            }
        }
    }

    deinit {
        badgePollingTimer?.invalidate()
        if let observer = syncObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    func fetchInitialData() async {
        print("🚀 [HomeViewModel] fetchInitialData started")
        self.isLoading = true

        do {
            let fetchedGroups = try await homeService.getMyGroups()

            print("📝 [HomeViewModel] Fetched \(fetchedGroups.count) groups")
            self.groups = fetchedGroups

            if fetchedGroups.isEmpty {
                print("⚠️ [HomeViewModel] No groups found, triggering mandatory group creation")
                self.showGroupCreationModal = true
            } else if let first = fetchedGroups.first {
                self.selectGroup(first)
            }

            self.isLoading = false
            checkUnreadNotifications()
            startBadgePolling() // 폴링 시작
        } catch {
            print("❌ [HomeViewModel] fetchInitialData failed: \(error)")
            if let apiError = error as? APIError {
                self.errorMessage = apiError.message ?? "그룹 목록을 불러오는데 실패했습니다."
            } else {
                self.errorMessage = error.localizedDescription
            }

            // 그룹이 없고 에러가 난 경우에도 (특히 401 등) 신규 사용자의 경우일 수 있으므로
            // 모달을 띄워 그룹 생성을 유도하거나 최소한 UI가 멈춰있지 않게 함
            // 단, 401이면 생성이 실패할 수도 있지만, 사용자 경험상 먹통보다는 나음
            if self.groups.isEmpty {
                 print("⚠️ [HomeViewModel] Error occurred but groups are empty. Forcing Group Creation Modal.")
                self.showGroupCreationModal = true
            }

            self.isLoading = false
        }
    }

    func selectGroup(_ group: SmapGroup) {
        HapticManager.shared.selection()
        self.selectedGroup = group
        Task {
            await fetchGroupData(sgtIdx: group.sgt_idx)
        }
    }

    func fetchGroupData(sgtIdx: Int) async {
        print("🚀 [HomeViewModel] fetchGroupData started for group: \(sgtIdx)")

        // 1. 멤버 데이터 가져오기 (필수)
        do {
            let fetchedMembers = try await homeService.getGroupMembers(sgtIdx: sgtIdx)
            print("📝 [HomeViewModel] Fetched \(fetchedMembers.count) members")

            self.members = fetchedMembers

            // 3. 로그인한 사용자 자동 선택 (최초 진입 시)
            if let currentUser = AuthService.shared.getUserData(),
               let currentMember = fetchedMembers.first(where: { $0.mt_idx == currentUser.mt_idx }) {
                print("👤 [HomeViewModel] Auto-selecting logged-in user: \(currentMember.displayName)")
                self.selectMember(currentMember)
            }
        } catch {
            print("❌ [HomeViewModel] 멤버 데이터 가져오기 실패: \(error)")
            if let apiError = error as? APIError {
                self.errorMessage = apiError.message ?? "멤버 정보를 불러오는데 실패했습니다."
            } else {
                self.errorMessage = "멤버 정보를 불러오는데 실패했습니다."
            }
            return // 멤버를 못 가져오면 중단
        }

        // 2. 일정 데이터 가져오기 (선택 - 에러나도 무시)
        do {
            let fetchedSchedules = try await homeService.getGroupSchedules(sgtIdx: sgtIdx)
            print("📝 [HomeViewModel] Fetched \(fetchedSchedules.count) schedules")

            self.schedules = fetchedSchedules
        } catch {
            print("⚠️ [HomeViewModel] 일정 데이터 가져오기 실패 (무시됨): \(error)")
        }

        checkUnreadNotifications()
    }

    /// 미확인 알림 여부 체크
    func checkUnreadNotifications() {
        guard let user = AuthService.shared.getUserData() else { return }

        Task {
            do {
                let logs = try await NotificationService.shared.getMemberPushLogs(memberId: user.mt_idx ?? 0)
                self.hasUnreadNotifications = logs.contains(where: { $0.plt_read_chk == .N })
            } catch {
                print("⚠️ [HomeViewModel] 미확인 알림 체크 실패: \(error)")
            }
        }
    }

    /// 모든 알림 읽음 처리
    func markAllAsRead() {
        guard let user = AuthService.shared.getUserData() else { return }
        Task {
            do {
                let response = try await NotificationService.shared.markAllAsRead(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    print("✅ [HomeViewModel] 모든 알림 읽음 처리 성공")
                    self.hasUnreadNotifications = false
                    // 알림 목록이 열려있을 경우를 위해 이벤트 발송
                    NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                }
            } catch {
                print("❌ [HomeViewModel] 모든 알림 읽음 처리 실패: \(error)")
            }
        }
    }

    /// 30초마다 알림 체크 폴링 시작
    func startBadgePolling() {
        badgePollingTimer?.invalidate()
        badgePollingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkUnreadNotifications()
            }
        }
        print("⏱️ [HomeViewModel] Badge polling started")
    }

    func stopBadgePolling() {
        badgePollingTimer?.invalidate()
        badgePollingTimer = nil
        print("🛑 [HomeViewModel] Badge polling stopped")
    }

    // MARK: - Lifecycle Support

    func pauseUpdates() {
        stopBadgePolling()
        print("⏸️ [HomeViewModel] Updates paused (Tab inactive)")
    }

    func resumeUpdates() {
        checkUnreadNotifications() // 즉시 체크
        startBadgePolling()
        print("▶️ [HomeViewModel] Updates resumed (Tab active)")
    }

    // 선택된 날짜에 해당하는 일정 필터링 (선택되지 않은 경우 빈 배열 반환)
    var filteredSchedules: [SmapSchedule] {
        // 선택된 멤버 찾기
        guard let selectedMember = members.first(where: { $0.isSelected }) else {
            print("⚠️ [filteredSchedules] No member selected")
            return []
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let selectedDateStr = dateFormatter.string(from: selectedDate)

        print("🔍 [filteredSchedules] Filtering - Member: \(selectedMember.mt_name ?? "Unknown"), sgdt_idx: \(selectedMember.sgdt_idx ?? -1), selectedDate: \(selectedDateStr)")
        print("🔍 [filteredSchedules] Total schedules available: \(schedules.count)")

        let filtered = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }

            // sgdt_idx 매칭 확인 (Next.js와 동일 로직)
            guard let scheduleSgdtIdx = schedule.sgdt_idx,
                  let memberSgdtIdx = selectedMember.sgdt_idx else {
                return false
            }

            // sgdt_idx로 비교 (Next.js: Number(schedule.sgdt_idx) === Number(member.sgdt_idx))
            let sgdtMatch = scheduleSgdtIdx == memberSgdtIdx
            if !sgdtMatch {
                return false
            }

            // 날짜 매칭 확인
            guard let sDateStr = schedule.date else {
                return false
            }

            // sst_edate 디버깅 (처음 5개만)
            if schedules.firstIndex(where: { $0.sst_idx == schedule.sst_idx })! < 5 {
                print("🔍 [DEBUG] Schedule '\(schedule.title ?? "")': date=\(schedule.date ?? "nil"), sst_edate=\(schedule.sst_edate ?? "nil")")
            }

            // "yyyy-MM-dd HH:mm:ss" 형식으로 파싱
            let scheduleDateFormatter = DateFormatter()
            scheduleDateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"

            if let scheduleDate = scheduleDateFormatter.date(from: sDateStr) {
                let scheduleDateStr = dateFormatter.string(from: scheduleDate)
                let dateMatch = scheduleDateStr == selectedDateStr
                if sgdtMatch && dateMatch {
                    print("✅ [filteredSchedules] Match: '\(schedule.title ?? "")', sgdt_idx: \(scheduleSgdtIdx), edate: \(schedule.sst_edate ?? "nil")")
                }
                return dateMatch
            }

            // 날짜 파싱 실패 시 문자열로 비교
            let dateMatch = sDateStr.hasPrefix(selectedDateStr)
            return dateMatch
        }

        print("📊 [filteredSchedules] Total filtered: \(filtered.count) schedules")
        return filtered
    }

    func selectMember(_ member: SmapGroupMember) {
        HapticManager.shared.selection()
        for i in 0..<members.count {
            members[i].isSelected = (members[i].mt_idx == member.mt_idx)
        }
    }

    func getMemberTodayStats(mtIdx: Int) -> (completed: Int, ongoing: Int, upcoming: Int) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let selectedDateStr = dateFormatter.string(from: selectedDate)

        // mtIdx로 멤버 찾기
        guard let member = members.first(where: { $0.mt_idx == mtIdx }),
              let memberSgdtIdx = member.sgdt_idx else {
            print("⚠️ [getMemberTodayStats] Member not found or missing sgdt_idx for mtIdx: \(mtIdx)")
            return (0, 0, 0)
        }

        print("📊 [getMemberTodayStats] Calculating stats for \(member.mt_name ?? "Unknown") (sgdt_idx: \(memberSgdtIdx)) on \(selectedDateStr)")

        let todaySchedules = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }

            // sgdt_idx 매칭
            guard let scheduleSgdtIdx = schedule.sgdt_idx,
                  scheduleSgdtIdx == memberSgdtIdx else {
                return false
            }

            // 날짜 매칭
            guard let sDateStr = schedule.date else { return false }

            let scheduleDateFormatter = DateFormatter()
            scheduleDateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"

            if let scheduleDate = scheduleDateFormatter.date(from: sDateStr) {
                let scheduleDateStr = dateFormatter.string(from: scheduleDate)
                return scheduleDateStr == selectedDateStr
            }

            return sDateStr.hasPrefix(selectedDateStr)
        }

        print("📊 [getMemberTodayStats] Found \(todaySchedules.count) schedules for this member on this date")

        var completed = 0
        var ongoing = 0
        var upcoming = 0

        for schedule in todaySchedules {
            let status = schedule.status
            print("   - Schedule '\(schedule.title ?? "No title")': \(status.text)")
            switch status {
            case .completed: completed += 1
            case .ongoing: ongoing += 1
            case .upcoming: upcoming += 1
            case .defaultStatus: break
            }
        }

        print("📊 [getMemberTodayStats] Stats: completed=\(completed), ongoing=\(ongoing), upcoming=\(upcoming)")
        return (completed, ongoing, upcoming)
    }

    /// 현재 선택된 그룹의 데이터 새로고침 (멤버 위치 포함)
    func refreshData() async {
        print("🔄 [HomeViewModel] refreshData started")

        // 1. 그룹 목록 새로고침
        do {
            let fetchedGroups = try await homeService.getMyGroups()
            self.groups = fetchedGroups
            print("🔄 [HomeViewModel] Refreshed \(fetchedGroups.count) groups")
        } catch {
            print("⚠️ [HomeViewModel] 그룹 새로고침 실패: \(error)")
        }

        // 2. 현재 선택된 그룹의 멤버/일정 새로고침
        if let currentGroup = selectedGroup {
            print("🔄 [HomeViewModel] Refreshing group \(currentGroup.sgt_idx) data")
            await fetchGroupData(sgtIdx: currentGroup.sgt_idx)
        } else if let firstGroup = groups.first {
            // 선택된 그룹이 없으면 첫 번째 그룹 선택
            selectGroup(firstGroup)
        }

        print("✅ [HomeViewModel] refreshData completed")
    }
}
