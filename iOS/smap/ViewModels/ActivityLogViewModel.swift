//
//  ActivityLogViewModel.swift
//  smap
//
//  Extracted from LoginView.swift - Activity log tab ViewModel
//

import Foundation
import SwiftUI
import Combine

class ActivityLogViewModel: ObservableObject {
    // MARK: - Published Properties

    // Loading States
    @Published var isLoading = false
    @Published var isMapLoading = false
    @Published var isDailyCountsLoading = false
    @Published var isMarkersLoading = false
    @Published var isGroupsLoading = false

    // Error State
    @Published var errorMessage: String?
    @Published var showError = false

    // Groups
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?

    // Selection States
    @Published var selectedGroupId: Int?
    @Published var selectedMemberId: Int?
    @Published var selectedDate: String

    // Data
    @Published var dailyCountsResponse: DailyCountsResponse?
    @Published var memberDailyCounts: [MemberDailyCount] = []
    @Published var mapMarkers: [MapMarker] = []
    @Published var stayTimes: [StayTime] = []
    @Published var locationSummary: LocationSummary?

    // UI States
    @Published var isSidebarOpen = false
    @Published var sliderValue: Double = 0
    @Published var isSliderDragging = false

    // MARK: - Computed Properties

    /// 현재 선택된 멤버의 일별 카운트 데이터
    var selectedMemberDailyCount: MemberDailyCount? {
        guard let memberId = selectedMemberId else { return nil }
        return memberDailyCounts.first { $0.member_id == memberId }
    }

    /// 정렬된 맵 마커 (시간순)
    var sortedMapMarkers: [MapMarker] {
        mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
    }

    /// 슬라이더 현재 위치의 마커
    var currentMarkerAtSlider: MapMarker? {
        guard !sortedMapMarkers.isEmpty else { return nil }
        let index = Int(Double(sortedMapMarkers.count - 1) * sliderValue / 100.0)
        let clampedIndex = max(0, min(index, sortedMapMarkers.count - 1))
        return sortedMapMarkers[clampedIndex]
    }

    /// 위치 요약 - 거리
    var formattedDistance: String {
        locationSummary?.formattedDistance ?? "0 km"
    }

    /// 위치 요약 - 시간
    var formattedDuration: String {
        locationSummary?.formattedDuration ?? "0분"
    }

    /// 위치 요약 - 걸음수
    var formattedSteps: String {
        locationSummary?.formattedSteps ?? "0 걸음"
    }

    /// 선택된 날짜의 표시 형식
    var displayDate: String {
        if let date = DateFormatter.apiDateOnlyFormatter.date(from: selectedDate) {
            return DateFormatter.displayDateFormatter.string(from: date)
        }
        return selectedDate
    }

    /// 최근 14일 날짜 목록
    var recentDays: [(date: String, displayDate: String, dayOfWeek: String, isToday: Bool, isWeekend: Bool)] {
        let calendar = Calendar.current
        let today = Date()
        var days: [(String, String, String, Bool, Bool)] = []

        for i in 0..<14 {
            if let date = calendar.date(byAdding: .day, value: -(13 - i), to: today) {
                let dateString = DateFormatter.apiDateOnlyFormatter.string(from: date)
                let displayString = DateFormatter.shortDateFormatter.string(from: date)
                let weekday = calendar.component(.weekday, from: date)
                let dayNames = ["S", "M", "T", "W", "T", "F", "S"]
                let dayOfWeek = dayNames[weekday - 1]
                let isToday = calendar.isDateInToday(date)
                let isWeekend = weekday == 1 || weekday == 7

                days.append((dateString, displayString, dayOfWeek, isToday, isWeekend))
            }
        }

        return days
    }

    // MARK: - Private Properties

    private let service = ActivityLogService.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        // 기본값으로 오늘 날짜 설정
        self.selectedDate = DateFormatter.apiDateOnlyFormatter.string(from: Date())
    }

    // MARK: - Public Methods

    /// 그룹 선택 시 호출
    func selectGroup(_ groupId: Int) async {
        guard selectedGroupId != groupId else { return }

        print("[ActivityLogViewModel] 그룹 선택: \(groupId)")
        selectedGroupId = groupId
        selectedMemberId = nil

        // 일별 카운트 데이터 로드
        await loadDailyLocationCounts()
    }

    /// 멤버 선택 시 호출
    func selectMember(_ memberId: Int) async {
        guard selectedMemberId != memberId else { return }

        print("[ActivityLogViewModel] 멤버 선택: \(memberId)")
        selectedMemberId = memberId

        // 해당 멤버의 위치 데이터 로드
        await loadMemberLocationData()
    }

    /// 날짜 선택 시 호출
    func selectDate(_ date: String) async {
        guard selectedDate != date else { return }

        print("[ActivityLogViewModel] 날짜 선택: \(date)")
        selectedDate = date

        // 선택된 멤버가 있으면 해당 날짜의 데이터 로드
        if selectedMemberId != nil {
            await loadMemberLocationData()
        }
    }

    /// 캘린더 셀 클릭 시 호출 (멤버 + 날짜 동시 변경)
    func selectMemberAndDate(memberId: Int, date: String) async {
        print("[ActivityLogViewModel] 멤버+날짜 선택: \(memberId), \(date)")
        selectedMemberId = memberId
        selectedDate = date

        await loadMemberLocationData()
    }

    /// 사이드바 토글
    func toggleSidebar() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isSidebarOpen.toggle()
        }
    }

    /// 사이드바 닫기
    func closeSidebar() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isSidebarOpen = false
        }
    }

    /// 슬라이더 값 업데이트
    func updateSliderValue(_ value: Double) {
        sliderValue = max(0, min(100, value))
    }

    /// 초기 데이터 로드 (뷰 진입 시 호출)
    func loadInitialData() async {
        print("[ActivityLogViewModel] 초기 데이터 로드 시작")
        isLoading = true

        // 1. 그룹 목록 먼저 로드
        await fetchGroups()

        // 2. 첫 번째 그룹 자동 선택
        if let firstGroup = groups.first {
            print("[ActivityLogViewModel] 첫 번째 그룹 자동 선택: \(firstGroup.sgt_title ?? "N/A")")
            selectedGroup = firstGroup
            selectedGroupId = firstGroup.sgt_idx

            // 3. 해당 그룹의 일별 카운트 로드
            await loadDailyLocationCounts()
        }

        isLoading = false
    }

    /// 그룹 목록 가져오기
    private func fetchGroups() async {
        isGroupsLoading = true

        do {
            let fetchedGroups = try await HomeService.shared.getMyGroups()
            groups = fetchedGroups
            print("[ActivityLogViewModel] 그룹 목록 로드 완료: \(fetchedGroups.count)개")
        } catch {
            print("[ActivityLogViewModel] 그룹 목록 로드 실패: \(error)")
            errorMessage = "그룹 목록을 불러오는데 실패했습니다."
            showError = true
        }

        isGroupsLoading = false
    }

    /// 그룹 선택 핸들러
    func selectGroupFromSidebar(_ group: SmapGroup) async {
        guard selectedGroupId != group.sgt_idx else { return }

        print("[ActivityLogViewModel] 그룹 변경: \(group.sgt_title ?? "N/A")")
        selectedGroup = group
        selectedGroupId = group.sgt_idx
        selectedMemberId = nil

        await loadDailyLocationCounts()
    }

    // MARK: - Private Methods

    /// 일별 위치 카운트 로드
    private func loadDailyLocationCounts() async {
        guard let groupId = selectedGroupId else { return }

        isDailyCountsLoading = true
        errorMessage = nil

        do {
            print("[ActivityLogViewModel] 일별 카운트 로드 시작: groupId=\(groupId)")
            let response = try await service.getDailyLocationCounts(groupId: groupId, days: 14)

            dailyCountsResponse = response
            memberDailyCounts = response.member_daily_counts

            print("[ActivityLogViewModel] 일별 카운트 로드 완료: \(memberDailyCounts.count)명")

            // 현재 사용자 먼저 선택, 없으면 첫 번째 멤버
            if selectedMemberId == nil {
                let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
                let selfMember = memberDailyCounts.first(where: { $0.member_id == currentUserIdx })
                let memberToSelect = selfMember ?? memberDailyCounts.first
                if let member = memberToSelect {
                    await selectMember(member.member_id)
                }
            }

        } catch {
            print("[ActivityLogViewModel] 일별 카운트 로드 실패: \(error)")
            errorMessage = "활동 데이터를 불러오는데 실패했습니다."
            showError = true
        }

        isDailyCountsLoading = false
    }

    /// 선택된 멤버의 위치 데이터 로드
    private func loadMemberLocationData() async {
        guard let memberId = selectedMemberId else { return }

        isMarkersLoading = true
        isLoading = true
        errorMessage = nil

        // 기존 데이터 초기화
        mapMarkers = []
        stayTimes = []
        locationSummary = nil
        sliderValue = 0

        do {
            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 시작: memberId=\(memberId), date=\(selectedDate)")

            // 병렬로 API 호출
            async let markersTask = service.getMapMarkers(memberId: memberId, date: selectedDate)
            async let stayTimesTask = service.getStayTimes(memberId: memberId, date: selectedDate)
            async let summaryTask = service.getLocationLogSummary(memberId: memberId, date: selectedDate)

            let (markers, stays, summary) = try await (markersTask, stayTimesTask, summaryTask)

            mapMarkers = markers
            stayTimes = stays
            locationSummary = summary

            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 완료: 마커=\(markers.count), 체류=\(stays.count)")

            // 사이드바 자동 닫기 (데이터 로드 후)
            if isSidebarOpen {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.closeSidebar()
                }
            }

        } catch {
            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 실패: \(error)")
            errorMessage = "위치 데이터를 불러오는데 실패했습니다."
            showError = true
        }

        isMarkersLoading = false
        isLoading = false
    }

    /// 특정 날짜에 해당 멤버의 활동이 있는지 확인
    func hasActivityForMember(_ memberId: Int, on date: String) -> Bool {
        guard let memberCount = memberDailyCounts.first(where: { $0.member_id == memberId }) else {
            return false
        }

        return memberCount.daily_counts.first(where: { $0.date == date })?.count ?? 0 > 0
    }

    /// 14일 인덱스에서 날짜 문자열 반환
    func dateStringForIndex(_ index: Int) -> String {
        let calendar = Calendar.current
        let today = Date()
        let offset = 13 - index // 0 = 13일전, 13 = 오늘

        if let date = calendar.date(byAdding: .day, value: -offset, to: today) {
            return DateFormatter.apiDateOnlyFormatter.string(from: date)
        }

        return selectedDate
    }

    /// 날짜가 선택된 날짜와 같은지 확인
    func isDateSelected(_ date: String) -> Bool {
        return date == selectedDate
    }

    /// 날짜가 오늘인지 확인
    func isToday(_ date: String) -> Bool {
        let today = DateFormatter.apiDateOnlyFormatter.string(from: Date())
        return date == today
    }
}
