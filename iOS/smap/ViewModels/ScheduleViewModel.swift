//
// ScheduleViewModel.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import Foundation
import Combine

@MainActor
class ScheduleViewModel: ObservableObject {
    @Published var schedules: [Schedule] = []
    @Published var groupMembers: [SmapGroupMember] = []
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var selectedDate: Date = Date()
    @Published var currentMonth: Date = Date()
    @Published var selectedMemberIds: Set<Int> = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var userPermissions: UserPermissions?

    private let scheduleService = ScheduleService.shared
    private let groupService = GroupService.shared
    private var cancellables = Set<AnyCancellable>()

    @MainActor
    func canManageSchedule(_ schedule: Schedule) -> Bool {
        guard let currentUserMtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"),
              let currentUserMtIdx = Int(currentUserMtIdxStr) else { return false }

        // 1. Own schedule
        if schedule.mt_idx == currentUserMtIdx {
            return true
        }

        // Find current user's role in the group members list
        guard let currentMember = groupMembers.first(where: { $0.mt_idx == currentUserMtIdx }) else {
            // Fallback to userPermissions if member list search fails
            if let perms = userPermissions {
                if perms.isOwner { return true }
            }
            return false
        }

        // 2. Owner can manage everything
        if currentMember.sgdt_owner_chk == "Y" {
            return true
        }

        // 3. Leader can manage everything except Owner's data
        if currentMember.sgdt_leader_chk == "Y" {
            let targetMember = groupMembers.first(where: { $0.mt_idx == schedule.mt_idx })
            if targetMember?.sgdt_owner_chk == "Y" {
                return false
            }
            return true
        }

        return false
    }

    var filteredSchedules: [Schedule] {
        let schedulesForDate = schedules.filter { schedule in
            guard let startDate = schedule.startDateOnly else { return false }
            return Calendar.current.isDate(startDate, inSameDayAs: selectedDate)
        }
        if selectedMemberIds.isEmpty {
            return schedulesForDate
        } else {
            return schedulesForDate.filter { schedule in
                if let mtIdx = schedule.mt_idx { return selectedMemberIds.contains(mtIdx) }
                return false
            }
        }
    }

    var datesWithEvents: Set<Date> {
        let dates = schedules.compactMap { $0.startDateOnly }
        return Set(dates)
    }

    init() {
        Task { @MainActor in
            fetchGroups()
        }

        // Listen for group changes from GroupScreen
        NotificationCenter.default.addObserver(forName: NSNotification.Name("groupsDidChange"), object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.fetchGroups()
            }
        }
    }

    func fetchGroups() {
        isLoading = true
        Task {
            do {
                let fetchedGroups = try await groupService.getCurrentUserGroups()
                DispatchQueue.main.async {
                    self.groups = fetchedGroups
                    if self.selectedGroup == nil, let firstGroup = fetchedGroups.first { self.selectGroup(firstGroup) }
                    self.isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    func fetchSchedules() {
        guard let group = selectedGroup else { return }
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: currentMonth))!
        let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth)!
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let startDateStr = formatter.string(from: calendar.startOfDay(for: startOfMonth))
        let endDateStr = formatter.string(from: calendar.date(bySettingHour: 23, minute: 59, second: 59, of: endOfMonth)!)
        isLoading = true
        Task {
            do {
                let data = try await scheduleService.getGroupSchedules(groupId: group.sgt_idx, startDate: startDateStr, endDate: endDateStr)
                DispatchQueue.main.async {
                    self.schedules = data.schedules
                    self.groupMembers = data.groupMembers
                    self.userPermissions = data.userPermission
                    self.isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    func selectGroup(_ group: SmapGroup) {
        selectedGroup = group
        selectedMemberIds.removeAll()
        fetchSchedules()
    }

    func changeMonth(by value: Int) {
        if let newMonth = Calendar.current.date(byAdding: .month, value: value, to: currentMonth) {
            currentMonth = newMonth
            fetchSchedules()
        }
    }

    func goToToday() {
        let now = Date()
        selectedDate = now
        currentMonth = now
        fetchSchedules()
    }

    func selectDate(_ date: Date) { selectedDate = date }
    func toggleMemberSelection(_ memberId: Int) {
        if selectedMemberIds.contains(memberId) { selectedMemberIds.remove(memberId) }
        else { selectedMemberIds.insert(memberId) }
    }

    func deleteSchedule(_ schedule: Schedule, option: String? = nil) {
        guard let groupId = selectedGroup?.sgt_idx else { return }
        isLoading = true

        let editorId = UserDefaults.standard.string(forKey: "mt_idx")
        let editorName = UserDefaults.standard.string(forKey: "mt_name")

        let request = DeleteScheduleRequest(
            sst_idx: schedule.sst_idx,
            groupId: groupId,
            sst_pidx: schedule.sst_pidx,
            deleteOption: option,
            editorId: editorId,
            editorName: editorName
        )

        Task {
            do {
                let success = try await scheduleService.deleteSchedule(request: request)
                if success {
                    // 홈 화면 일정 데이터 새로고침을 위한 알림 발송
                    NotificationCenter.default.post(name: NSNotification.Name("scheduleDataChanged"), object: nil)
                    print("📢 [ScheduleViewModel] Posted scheduleDataChanged notification after delete")

                    fetchSchedules()
                }
                else {
                    DispatchQueue.main.async {
                        self.errorMessage = "일정 삭제에 실패했습니다."
                        self.isLoading = false
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}
