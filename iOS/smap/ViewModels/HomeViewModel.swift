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
        self.errorMessage = nil

        do {
            let fetchedGroups = try await homeService.getMyGroups()

            print("📝 [HomeViewModel] Fetched \(fetchedGroups.count) groups")
            self.groups = fetchedGroups

            if fetchedGroups.isEmpty {
                print("⚠️ [HomeViewModel] No groups found, triggering mandatory group creation")
                selectedGroup = nil
                members = []
                schedules = []
                self.showGroupCreationModal = true
            } else if let group = fetchedGroups.first(where: { $0.sgt_idx == selectedGroup?.sgt_idx }) ?? fetchedGroups.first {
                self.selectGroup(group)
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

            self.isLoading = false
        }
    }

    /// 홈 오류 배너의 "다시 시도" — 그룹 목록 자체가 실패했으면 처음부터, 아니면 선택 그룹의 멤버만 다시 조회한다.
    func retryLoad() {
        Task {
            if let group = selectedGroup, !groups.isEmpty {
                await fetchGroupData(sgtIdx: group.sgt_idx)
            } else {
                await fetchInitialData()
            }
        }
    }

    func selectGroup(_ group: SmapGroup) {
        HapticManager.shared.selection()
        if selectedGroup?.sgt_idx != group.sgt_idx {
            members = []
            schedules = []
        }
        self.selectedGroup = group
        Task {
            await fetchGroupData(sgtIdx: group.sgt_idx)
        }
    }

    func fetchGroupData(sgtIdx: Int) async {
        print("🚀 [HomeViewModel] fetchGroupData started for group: \(sgtIdx)")
        self.errorMessage = nil

        // 1. 멤버 데이터 가져오기 (필수)
        do {
            let fetchedMembers = try await homeService.getGroupMembers(sgtIdx: sgtIdx)
            print("📝 [HomeViewModel] Fetched \(fetchedMembers.count) members")

            guard selectedGroup?.sgt_idx == sgtIdx else { return }
            updateMembers(fetchedMembers)
        } catch {
            guard selectedGroup?.sgt_idx == sgtIdx else { return }
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
            guard selectedGroup?.sgt_idx == sgtIdx else { return }
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

        print("🔍 [filteredSchedules] Filtering - Member: \(selectedMember.mt_name ?? "Unknown"), mt_idx: \(selectedMember.mt_idx), selectedDate: \(selectedDateStr)")
        print("🔍 [filteredSchedules] Total schedules available: \(schedules.count)")

        let filtered = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }

            // 이 멤버의 일정인지 — 일정 주인으로 비교(Android filterSchedules 와 같은 규칙)
            guard Self.isSchedule(schedule, ownedBy: selectedMember) else {
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
                if dateMatch {
                    print("✅ [filteredSchedules] Match: '\(schedule.title ?? "")', owner: \(schedule.ownerIdx ?? -1), edate: \(schedule.sst_edate ?? "nil")")
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

    /// 홈 시트 "그날 일정" — 멤버를 골랐으면 그 멤버의 일정, 아니면(전체 보기) 그룹 전체 일정. 시작 시각 순.
    /// (이전 "오늘 일정 미리보기" 카드를 시트가 대신하면서 날짜를 골라 볼 수 있게 했다.)
    var sheetSchedules: [SmapSchedule] {
        let pool: [SmapSchedule]
        if members.contains(where: { $0.isSelected }) {
            pool = filteredSchedules
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let targetDateStr = formatter.string(from: selectedDate)
            let scheduleFmt = DateFormatter()
            scheduleFmt.dateFormat = "yyyy-MM-dd HH:mm:ss"
            pool = schedules.filter { schedule in
                guard schedule.sst_show == "Y", let sDateStr = schedule.date else { return false }
                if let scheduleDate = scheduleFmt.date(from: sDateStr) {
                    return formatter.string(from: scheduleDate) == targetDateStr
                }
                return sDateStr.hasPrefix(targetDateStr)
            }
        }
        return pool.sorted { ($0.date ?? "") < ($1.date ?? "") }
    }

    /// 시트 "전체" — 선택을 풀어 모든 멤버를 본다(지도 맞춤은 화면이 한다).
    func showAllMembers() {
        HapticManager.shared.selection()
        for i in 0..<members.count {
            members[i].isSelected = false
        }
    }

    func selectMember(_ member: SmapGroupMember) {
        HapticManager.shared.selection()
        for i in 0..<members.count {
            members[i].isSelected = (members[i].mt_idx == member.mt_idx)
        }
    }

    func updateMembers(_ incoming: [SmapGroupMember]) {
        let selectedID = members.first(where: { $0.isSelected })?.mt_idx
        members = incoming.map { member in
            var updated = member
            updated.isSelected = member.mt_idx == selectedID
            return updated
        }
    }

    /// 일정이 이 멤버 것인지 — 일정 주인(mt_idx / mt_schedule_idx)을 멤버 mt_idx 와 비교한다(Android filterSchedules 와 같은 규칙).
    /// 2026-11-20: 이전엔 sgdt_idx 로만 비교했는데 그룹 일정 응답은 이 값이 비어 있을 수 있어, 멤버를 고르면 일정이 하나도 안 나왔다.
    /// 주인 값이 없는 응답만 예전처럼 sgdt_idx 로 비교한다(주인을 모르는 일정을 아무 멤버에게나 보이지 않게).
    static func isSchedule(_ schedule: SmapSchedule, ownedBy member: SmapGroupMember) -> Bool {
        if let owner = schedule.ownerIdx { return owner == member.mt_idx }
        guard let scheduleSgdt = schedule.sgdt_idx, let memberSgdt = member.sgdt_idx else { return false }
        return scheduleSgdt == memberSgdt
    }

    func getMemberTodayStats(mtIdx: Int) -> (completed: Int, ongoing: Int, upcoming: Int) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let selectedDateStr = dateFormatter.string(from: selectedDate)

        // mtIdx로 멤버 찾기
        guard let member = members.first(where: { $0.mt_idx == mtIdx }) else {
            print("⚠️ [getMemberTodayStats] Member not found for mtIdx: \(mtIdx)")
            return (0, 0, 0)
        }

        print("📊 [getMemberTodayStats] Calculating stats for \(member.mt_name ?? "Unknown") (mt_idx: \(member.mt_idx)) on \(selectedDateStr)")

        let todaySchedules = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }

            // 이 멤버의 일정인지 — 일정 주인으로 비교
            guard Self.isSchedule(schedule, ownedBy: member) else {
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
        if let currentGroup = selectedGroup, groups.contains(where: { $0.sgt_idx == currentGroup.sgt_idx }) {
            print("🔄 [HomeViewModel] Refreshing group \(currentGroup.sgt_idx) data")
            await fetchGroupData(sgtIdx: currentGroup.sgt_idx)
        } else {
            selectedGroup = nil
            members = []
            schedules = []
            if let firstGroup = groups.first {
                selectGroup(firstGroup)
            }
        }

        print("✅ [HomeViewModel] refreshData completed")
    }
}
