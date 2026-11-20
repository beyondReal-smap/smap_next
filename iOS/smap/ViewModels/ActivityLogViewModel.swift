//
//  ActivityLogViewModel.swift
//  smap
//
//  Extracted from LoginView.swift - Activity log tab ViewModel
//

import Foundation
import SwiftUI
import Combine
import Observation

/// 손가락을 움직일 때 지도와 경로 막대를 읽는 뷰만 갱신한다.
@Observable
final class ActivityLogScrubberState {
    var value: Double = 0
    var isDragging = false
}

@MainActor
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
    /// 구독 제한(403 LOG_RETENTION_EXCEEDED) 안내 문구 — 설정되면 "프리미엄 알아보기" 알림을 띄운다.
    @Published var subscriptionLimitMessage: String?

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
    private(set) var overlayRevision = 0
    private(set) var sortedMapMarkers: [MapMarker] = []
    @Published var mapMarkers: [MapMarker] = [] {
        didSet {
            sortedMapMarkers = mapMarkers.filter { $0.latitude != 0 && $0.longitude != 0 }
                .sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
            overlayRevision += 1
        }
    }
    @Published var stayTimes: [StayTime] = [] {
        didSet { overlayRevision += 1 }
    }
    @Published var locationSummary: LocationSummary?

    // UI States
    let scrubber = ActivityLogScrubberState()

    // MARK: - Computed Properties

    /// 현재 선택된 멤버의 일별 카운트 데이터
    var selectedMemberDailyCount: MemberDailyCount? {
        guard let memberId = selectedMemberId else { return nil }
        return memberDailyCounts.first { $0.member_id == memberId }
    }

    /// 슬라이더 현재 위치의 마커
    var currentMarkerAtSlider: MapMarker? {
        guard !sortedMapMarkers.isEmpty else { return nil }
        let index = Int(Double(sortedMapMarkers.count - 1) * scrubber.value / 100.0)
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

    /// 보존 기간 밖 날짜를 잠글 기준 offset(오늘=0). 서버가 제한을 강제 중이고 무료 회원일 때만 값이 있다.
    /// "최근 N일"은 오늘 포함 N일이므로 offset >= N 이 잠금 대상이다.
    var lockedFromOffset: Int? {
        guard let status = StoreKitManager.shared.status,
              status.enforcement_enabled, !status.is_premium else { return nil }
        return status.limits.log_retention_days
    }

    /// 잠긴 날짜를 눌렀을 때의 안내 문구
    func showRetentionLock() {
        let days = lockedFromOffset ?? 0
        subscriptionLimitMessage = "무료 회원은 최근 \(days)일의 활동 기록만 볼 수 있어요."
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
    private var locationRequestID = UUID()
    /// 이동 경로를 마지막으로 받은 시각 — 탭에 다시 들어올 때 조용히 새로 받을지 판단한다
    private var lastLocationLoadAt: Date?
    /// 이 시간이 지난 오늘 기록은 탭에 들어올 때 새로 받는다 (Android ActivityLogViewModel 과 같은 값)
    private static let staleInterval: TimeInterval = 120
    private var countsRequestID = UUID()

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
        locationRequestID = UUID()
        isMarkersLoading = false
        mapMarkers = []
        stayTimes = []
        locationSummary = nil

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

    /// 슬라이더 값 업데이트
    func updateSliderValue(_ value: Double) {
        scrubber.value = max(0, min(100, value))
    }

    /// 초기 데이터 로드 (뷰 진입 시 호출)
    func loadInitialData() async {
        print("[ActivityLogViewModel] 초기 데이터 로드 시작")
        isLoading = true

        // 1. 그룹 목록 먼저 로드
        await fetchGroups()

        if let group = groups.first(where: { $0.sgt_idx == selectedGroupId }) ?? groups.first {
            if selectedGroupId != group.sgt_idx {
                selectedMemberId = nil
                locationRequestID = UUID()
                isMarkersLoading = false
                mapMarkers = []
                stayTimes = []
                locationSummary = nil
            }
            selectedGroup = group
            selectedGroupId = group.sgt_idx
            await loadDailyLocationCounts()
        } else {
            selectedGroup = nil
            selectedGroupId = nil
            selectedMemberId = nil
            locationRequestID = UUID()
            countsRequestID = UUID()
            isMarkersLoading = false
            isDailyCountsLoading = false
            dailyCountsResponse = nil
            memberDailyCounts = []
            mapMarkers = []
            stayTimes = []
            locationSummary = nil
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

    /// 그룹 선택 시트에서 그룹을 고른 경우
    func selectGroupFromPicker(_ group: SmapGroup) async {
        guard selectedGroupId != group.sgt_idx else { return }

        print("[ActivityLogViewModel] 그룹 변경: \(group.sgt_title ?? "N/A")")
        selectedGroup = group
        selectedGroupId = group.sgt_idx
        selectedMemberId = nil
        locationRequestID = UUID()
        isMarkersLoading = false
        mapMarkers = []
        stayTimes = []
        locationSummary = nil

        await loadDailyLocationCounts()
    }

    // MARK: - Private Methods

    /// 일별 위치 카운트 로드
    private func loadDailyLocationCounts() async {
        guard let groupId = selectedGroupId else { return }

        let requestID = UUID()
        countsRequestID = requestID
        isDailyCountsLoading = true
        errorMessage = nil

        do {
            print("[ActivityLogViewModel] 일별 카운트 로드 시작: groupId=\(groupId)")
            let response = try await service.getDailyLocationCounts(groupId: groupId, days: 14)

            guard countsRequestID == requestID, selectedGroupId == groupId else { return }
            dailyCountsResponse = response
            memberDailyCounts = response.member_daily_counts

            print("[ActivityLogViewModel] 일별 카운트 로드 완료: \(memberDailyCounts.count)명")

            if let selected = selectedMemberId, !memberDailyCounts.contains(where: { $0.member_id == selected }) {
                selectedMemberId = nil
                locationRequestID = UUID()
                isMarkersLoading = false
                mapMarkers = []
                stayTimes = []
                locationSummary = nil
            }
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
            guard countsRequestID == requestID, selectedGroupId == groupId else { return }
            print("[ActivityLogViewModel] 일별 카운트 로드 실패: \(error)")
            errorMessage = "활동 데이터를 불러오는데 실패했습니다."
            showError = true
        }

        if countsRequestID == requestID { isDailyCountsLoading = false }
    }

    /// 선택된 멤버의 위치 데이터 로드
    private func capture<T>(_ operation: () async throws -> T) async -> Result<T, Error> {
        do { return .success(try await operation()) }
        catch { return .failure(error) }
    }

    private func loadMemberLocationData() async {
        guard let memberId = selectedMemberId else { return }
        let date = selectedDate
        let requestID = UUID()
        locationRequestID = requestID
        isMarkersLoading = true
        isLoading = true
        errorMessage = nil
        mapMarkers = []
        stayTimes = []
        locationSummary = nil
        scrubber.isDragging = false
        scrubber.value = 0

        async let markers = capture { try await self.service.getMapMarkers(memberId: memberId, date: date) }
        async let stays = capture { try await self.service.getStayTimes(memberId: memberId, date: date) }
        async let summary = capture { try await self.service.getLocationLogSummary(memberId: memberId, date: date) }
        let (markerResult, stayResult, summaryResult) = await (markers, stays, summary)
        guard locationRequestID == requestID, selectedMemberId == memberId, selectedDate == date else { return }

        var failed: [String] = []
        var limitMessage: String?
        func note(_ error: Error, _ label: String) {
            if case NetworkError.subscriptionLimit(_, let message)? = error as? NetworkError {
                limitMessage = message
            } else {
                failed.append(label)
            }
        }
        switch markerResult {
        case .success(let value):
            mapMarkers = value
            lastLocationLoadAt = Date()
        case .failure(let error): note(error, "이동 경로")
        }
        switch stayResult {
        case .success(let value): stayTimes = value
        case .failure(let error): note(error, "체류 기록")
        }
        switch summaryResult {
        case .success(let value): locationSummary = value
        case .failure(let error): note(error, "활동 요약")
        }
        if let limitMessage {
            subscriptionLimitMessage = limitMessage
        } else if !failed.isEmpty {
            errorMessage = "\(failed.joined(separator: ", "))을(를) 불러오지 못했습니다."
            showError = true
        }
        isMarkersLoading = false
        isLoading = false
    }

    /// 탭에 다시 들어올 때 — 오늘을 보고 있고 마지막으로 받은 지 2분이 넘었으면 화면을 가리지 않고 새로 받는다.
    /// 로딩 표시·슬라이더 초기화·오류 알림 없이 값만 바꾼다. 실패하면 지금 보이는 기록을 그대로 두고 로그만 남긴다.
    func refreshIfStale() async {
        guard isToday(selectedDate),
              let memberId = selectedMemberId,
              !isMarkersLoading,
              let last = lastLocationLoadAt,
              Date().timeIntervalSince(last) >= Self.staleInterval else { return }
        let date = selectedDate
        let requestID = UUID()
        locationRequestID = requestID

        async let markers = capture { try await self.service.getMapMarkers(memberId: memberId, date: date) }
        async let stays = capture { try await self.service.getStayTimes(memberId: memberId, date: date) }
        async let summary = capture { try await self.service.getLocationLogSummary(memberId: memberId, date: date) }
        let (markerResult, stayResult, summaryResult) = await (markers, stays, summary)
        // 그사이 날짜·멤버를 바꿨거나 다른 요청이 시작됐으면 버린다.
        guard locationRequestID == requestID, selectedMemberId == memberId, selectedDate == date else { return }

        switch markerResult {
        case .success(let value):
            mapMarkers = value
            lastLocationLoadAt = Date()
        case .failure(let error):
            print("[ActivityLogViewModel] 조용한 새로고침 실패(이동 경로): \(error)")
            return
        }
        switch stayResult {
        case .success(let value): stayTimes = value
        case .failure(let error): print("[ActivityLogViewModel] 조용한 새로고침 실패(체류 기록): \(error)")
        }
        switch summaryResult {
        case .success(let value): locationSummary = value
        case .failure(let error): print("[ActivityLogViewModel] 조용한 새로고침 실패(활동 요약): \(error)")
        }
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
