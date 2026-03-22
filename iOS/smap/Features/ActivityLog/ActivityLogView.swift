//
// ActivityLogView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import NMapsMap

// MARK: - ActivityLog Implementation (Consolidated)


struct ActivityLogSidebarView: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    
    @State private var isGroupSelectorOpen = false
    
    
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            sidebarHeader
                .padding(.top, 20)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector
                    groupSelectorSection
                    
                    // Member List
                    memberListSection
                }
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .ignoresSafeArea()
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
    
    // MARK: - Header
    
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(SMAPTheme.Color.primary)
                    .frame(width: 40, height: 40)
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("로그 조회")
                    .font(.suite(size: 20, weight: .bold))
                Text("멤버를 선택해보세요")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                viewModel.closeSidebar()
            }) {
                Image(systemName: "xmark")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.6))
                    .clipShape(Circle())
            }
        }
    }
    
    // MARK: - Group Selector
    
    private var groupSelectorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Text("그룹 목록")
                    .font(.suite(size: 16, weight: .bold))
            }
            
            Menu {
                ForEach(viewModel.groups) { group in
                    Button(group.sgt_title ?? "이름 없음") {
                        Task {
                            await viewModel.selectGroupFromSidebar(group)
                        }
                    }
                }
            } label: {
                HStack {
                    Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                        .font(.suite(size: 17))
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
    
    // MARK: - Member List
    
    private var memberListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(Color.green).frame(width: 8, height: 8)
                Text("멤버 목록")
                    .font(.suite(size: 16, weight: .bold))
                Spacer()
                Text("\(viewModel.memberDailyCounts.count)명")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.secondary.opacity(0.1)))
            }
            
            if viewModel.isDailyCountsLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if viewModel.memberDailyCounts.isEmpty {
                emptyMemberView
            } else {
                VStack(spacing: 8) {
                    let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
                    ForEach(viewModel.memberDailyCounts) { member in
                        ActivityLogMemberCell(
                            member: member,
                            isSelected: viewModel.selectedMemberId == member.member_id,
                            isSelf: member.member_id == currentUserIdx,
                            selectedDate: viewModel.selectedDate,
                            onMemberTap: {
                                Task {
                                    await viewModel.selectMember(member.member_id)
                                }
                            },
                            onDateTap: { dateString in
                                Task {
                                    await viewModel.selectMemberAndDate(memberId: member.member_id, date: dateString)
                                }
                            }
                        )
                    }
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
    }
    
    private var emptyMemberView: some View {
        VStack(spacing: 12) {
            Circle()
                .fill(Color.gray.opacity(0.1))
                .frame(width: 48, height: 48)
                .overlay(
                    Image(systemName: "person.fill")
                        .foregroundColor(.gray)
                )
            
            Text("그룹 멤버가 없습니다")
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.gray)
            
            Text("그룹을 선택하거나 멤버를 초대해보세요")
                .font(.suite(size: 14))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

// MARK: - Member Cell with Calendar

struct ActivityLogMemberCell: View {
    let member: MemberDailyCount
    let isSelected: Bool
    var isSelf: Bool = false
    let selectedDate: String
    let onMemberTap: () -> Void
    let onDateTap: (String) -> Void
    
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: onMemberTap) {
            HStack(spacing: 16) {
                // Left: Avatar + Nickname
                VStack(spacing: 8) {
                    // Avatar
                    ZStack(alignment: .topTrailing) {
                        Group {
                            if let url = getProfileImageUrl(member.member_photo) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(isSelected ? SMAPTheme.Color.primary : Color.gray.opacity(0.1), lineWidth: isSelected ? 3 : 1)
                        )
                    } // End ZStack
                    
                    // Display Name (Nickname below Avatar)
                    Text(isSelf ? "\(member.displayName) (나)" : member.displayName)
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                        .frame(width: 65) // Limit text width to align with avatar column
                }
                
                // Right: 14-Day Calendar
                calendarView
            }
            .padding(12)
            .background(isSelected ? SMAPTheme.Color.primary.opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? SMAPTheme.Color.primary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Calendar View
    
    private var calendarView: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header
            HStack {
                Text("2주간 활동")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(member.activeDaysCount)/14일")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
            }
            
            // Day of Week Headers
            HStack(spacing: 6) {
                ForEach(0..<7) { index in
                    let dayInfo = getDayInfo(for: 13 - index)
                    
                    Text(dayInfo.dayOfWeek)
                        .font(.suite(size: 11, weight: .bold))
                        .foregroundColor(dayInfo.isWeekend ? (dayInfo.isSunday ? .red : .blue) : .gray)
                        .frame(width: 16)
                        .background(dayInfo.isWeekend ? (dayInfo.isSunday ? Color.red.opacity(0.1) : Color.blue.opacity(0.1)) : Color.gray.opacity(0.05))
                        .cornerRadius(2)
                }
            }
            
            // First Row (7 days ago to 13 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = col  // 0-6: 13일전 ~ 7일전
                    let offset = 13 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Second Row (Today to 6 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = 7 + col  // 7-13: 6일전 ~ 오늘
                    let offset = 6 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Footer
            HStack {
                Text("1주전")
                    .font(.suite(size: 12))
                    .foregroundColor(.secondary)
                Spacer()
                Text("오늘")
                    .font(.suite(size: 12, weight: .semibold))
                    .foregroundColor(indigoColor)
            }
        }
        .padding(8)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
    
    // MARK: - Helpers
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
    
    private func getDateString(daysAgo: Int) -> String {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            return DateFormatter.apiDateOnlyFormatter.string(from: date)
        }
        return ""
    }
    
    private func getDayInfo(for daysAgo: Int) -> (dayOfWeek: String, isWeekend: Bool, isSunday: Bool) {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            let weekday = calendar.component(.weekday, from: date)
            let dayNames = ["S", "M", "T", "W", "T", "F", "S"]
            let dayOfWeek = dayNames[weekday - 1]
            let isWeekend = weekday == 1 || weekday == 7
            let isSunday = weekday == 1
            return (dayOfWeek, isWeekend, isSunday)
        }
        return ("", false, false)
    }
}

// MARK: - Calendar Day Cell

struct CalendarDayCell: View {
    let hasActivity: Bool
    let isSelected: Bool
    let isToday: Bool
    let onTap: (() -> Void)?
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: {
            onTap?()
        }) {
            ZStack {
                if isSelected {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [pinkColor, Color(red: 244/255, green: 63/255, blue: 94/255)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(pinkColor.opacity(0.6), lineWidth: 1)
                        )
                        .shadow(color: pinkColor.opacity(0.3), radius: 2)
                } else if hasActivity {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(indigoColor.opacity(0.8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(indigoColor.opacity(0.3), lineWidth: 0.5)
                        )
                } else {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 0.5)
                        )
                }
                
                if isToday {
                    Text("●")
                        .font(.suite(size: 8))
                        .foregroundColor(isSelected || hasActivity ? .white : .gray)
                }
            }
            .frame(width: 16, height: 16)
            .overlay(
                isToday ?
                RoundedRectangle(cornerRadius: 4)
                    .stroke(indigoColor, lineWidth: 1.5)
                : nil
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(onTap == nil)
    }
}



// MARK: - Preview

struct ActivityLogSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogSidebarView(viewModel: ActivityLogViewModel())
    }
}


// MARK: - ActivityLog Main View

struct ActivityLogView: View {
    @StateObject private var viewModel = ActivityLogViewModel()
    
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var isMapLoading = true  // 지도 로딩 상태
    
    
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer
            ActivityLogMapView(
                mapMarkers: viewModel.mapMarkers,
                stayTimes: viewModel.stayTimes,
                sliderValue: viewModel.sliderValue,
                isSliderDragging: viewModel.isSliderDragging
            )
            .ignoresSafeArea()
            .offset(y: 60)
            
            // 2. Header
            VStack {
                ActivityLogHeaderView()
                Spacer()
            }
            
            // 3. Floating Info Card
            if viewModel.selectedMemberId != nil {
                VStack {
                    ActivityLogFloatingCard(
                        memberName: selectedMemberName,
                        memberPhoto: selectedMemberPhoto,
                        displayDate: viewModel.displayDate,
                        distance: viewModel.formattedDistance,
                        duration: viewModel.formattedDuration,
                        steps: viewModel.formattedSteps,
                        isLoading: viewModel.isLoading,
                        onTap: {
                            viewModel.toggleSidebar()
                        }
                    )
                    .padding(.horizontal, 20)
                    .padding(.top, 76)
                    
                    Spacer()
                }
            }
            
            // 4. Path Slider (Bottom Left)
            if !viewModel.sortedMapMarkers.isEmpty {
                VStack {
                    Spacer()
                    HStack {
                        PathSliderView(
                            sliderValue: $viewModel.sliderValue,
                            isSliderDragging: $viewModel.isSliderDragging
                        )
                        .padding(.leading, 16)
                        .padding(.bottom, 20) // adjusted from 90 to 20 to match LoginView version
                        
                        Spacer()
                    }
                }
            }
            
            // 5. Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .ignoresSafeArea()
                    .onTapGesture {
                        viewModel.closeSidebar()
                    }
                    .transition(.opacity)
            }
            
            // 6. Sidebar
            ActivityLogSidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)
            
            // 7. Edge Swipe Detection
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 8. FAB
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionLogButton(count: viewModel.memberDailyCounts.count) {
                        viewModel.toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            
            // 9. Loading Overlay
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .onAppear {
            handleLoading()
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            // 초기 데이터 로드 (그룹 목록 + 첫 그룹 선택 + 일별 카운트)
            await viewModel.loadInitialData()
        }
        .alert("오류", isPresented: $viewModel.showError) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "알 수 없는 오류가 발생했습니다.")
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            // 탭 전환 시 사이드바를 닫기
            viewModel.closeSidebar()
            
            // 본인 탭(활동 로그 = 4)으로 전환될 때만 로딩 화면을 다시 표시
            if let targetTab = notification.object as? Int, targetTab == 4 {
                isMapLoading = true
                handleLoading()
            }
        }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동 닫기 및 로딩 상태 리셋
            viewModel.closeSidebar()
            isMapLoading = true
        }
    }
    
    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        guard isMapLoading else { return }
        
        Task {
            // 최소 1.5초 대기
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }
            
            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var selectedMemberName: String {
        guard let memberId = viewModel.selectedMemberId else { return "" }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.displayName ?? ""
    }
    
    private var selectedMemberPhoto: String? {
        guard let memberId = viewModel.selectedMemberId else { return nil }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.member_photo
    }
    
    private var sidebarOffset: CGFloat {
        if viewModel.isSidebarOpen {
            return max(0, sidebarDragOffset)
        } else {
            return min(0, -sidebarWidth + sidebarDragOffset)
        }
    }
    
    private var overlayOpacity: Double {
        let progress: Double
        if viewModel.isSidebarOpen {
            progress = 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth)
        } else {
            progress = Double(sidebarDragOffset) / Double(sidebarWidth)
        }
        return 0.4 * max(0, min(1, progress))
    }
    
    // MARK: - Gestures
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                if value.translation.width > 0 {
                    sidebarDragOffset = min(sidebarWidth, value.translation.width)
                }
            }
            .onEnded { value in
                if value.translation.width > sidebarWidth * 0.3 || value.predictedEndTranslation.width > sidebarWidth * 0.5 {
                    viewModel.isSidebarOpen = true
                    sidebarDragOffset = 0
                } else {
                    viewModel.isSidebarOpen = false
                    sidebarDragOffset = 0
                }
            }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                sidebarDragOffset = value.translation.width
            }
            .onEnded { value in
                if viewModel.isSidebarOpen {
                    if value.translation.width < -sidebarWidth * 0.3 || value.predictedEndTranslation.width < -sidebarWidth * 0.5 {
                        viewModel.closeSidebar()
                    }
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    sidebarDragOffset = 0
                }
            }
    }
}

// MARK: - Header View

struct ActivityLogHeaderView: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("활동 로그")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹 멤버들의 활동 기록을 확인해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Color.white.opacity(0.95)
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                .ignoresSafeArea(edges: .top)
        )
    }
}

// MARK: - Floating Info Card

struct ActivityLogFloatingCard: View {
    let memberName: String
    let memberPhoto: String?
    let displayDate: String
    let distance: String
    let duration: String
    let steps: String
    let isLoading: Bool
    let onTap: () -> Void
    
    
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Member Info
                HStack(spacing: 10) {
                    // Avatar
                    ZStack(alignment: .bottomTrailing) {
                        Group {
                            if let url = getProfileImageUrl(memberPhoto) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: Color.black.opacity(0.1), radius: 2)
                        
                        // Online indicator
                        Circle()
                            .fill(Color.green)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                            .offset(x: 2, y: 2)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(memberName)
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.black)
                            Text("의 기록")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        Text(displayDate)
                            .font(.suite(size: 12, weight: .medium))
                            .foregroundColor(SMAPTheme.Color.primary)
                    }
                }
                
                // Divider
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 1, height: 32)
                
                // Stats
                if isLoading {
                    ProgressView()
                        .frame(width: 100)
                } else {
                    HStack(spacing: 12) {
                        StatItem(icon: "arrow.up.right", color: .red, value: distance)
                        StatItem(icon: "clock", color: .yellow, value: duration)
                        StatItem(icon: "figure.walk", color: .blue, value: steps)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white)
                    .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

struct StatItem: View {
    let icon: String
    let color: Color
    let value: String
    
    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color.opacity(0.8))
                .frame(width: 24, height: 24)
                .overlay(
                    Image(systemName: icon)
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                )
            
            Text(value)
                .font(.suite(size: 12, weight: .semibold))
                .foregroundColor(.gray)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(minWidth: 50)
    }
}

// MARK: - Path Slider View

struct PathSliderView: View {
    @Binding var sliderValue: Double
    @Binding var isSliderDragging: Bool
    
    
    private let thumbSize: CGFloat = 20
    private let trackHeight: CGFloat = 8
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack(spacing: 8) {
                Circle()
                    .fill(SMAPTheme.Color.primary)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "play.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.white)
                    )
                
                Text("경로 따라가기")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.black)
            }
            
            // Custom Slider
            VStack(spacing: 4) {
                GeometryReader { geometry in
                    let totalWidth = geometry.size.width
                    let thumbRadius = thumbSize / 2
                    // 핸들이 트랙 안에 머물도록 유효 범위 계산
                    let minX = thumbRadius
                    let maxX = totalWidth - thumbRadius
                    let availableWidth = maxX - minX
                    let thumbCenterX = minX + (availableWidth * CGFloat(sliderValue / 100))
                    
                    ZStack {
                        // Track Background
                        RoundedRectangle(cornerRadius: trackHeight / 2)
                            .fill(Color.gray.opacity(0.3))
                            .frame(height: trackHeight)
                        
                        // Track Progress
                        HStack {
                            RoundedRectangle(cornerRadius: trackHeight / 2)
                                .fill(SMAPTheme.Color.primary)
                                .frame(width: thumbCenterX, height: trackHeight)
                            Spacer(minLength: 0)
                        }
                        
                        // Thumb (핸들)
                        Circle()
                            .fill(SMAPTheme.Color.primary)
                            .frame(width: thumbSize, height: thumbSize)
                            .overlay(
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 8, height: 8)
                            )
                            .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 4)
                            .position(x: thumbCenterX, y: geometry.size.height / 2)
                    }
                    .frame(height: geometry.size.height)
                    .contentShape(Rectangle()) // 전체 영역 터치 가능
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isSliderDragging = true
                                // 터치 위치를 0-100% 값으로 변환
                                let touchX = value.location.x
                                let clampedX = max(minX, min(maxX, touchX))
                                let newValue = Double((clampedX - minX) / availableWidth) * 100
                                sliderValue = max(0, min(100, newValue))
                            }
                            .onEnded { _ in
                                isSliderDragging = false
                            }
                    )
                }
                .frame(height: 40) // 터치 영역
                
                // Labels
                HStack {
                    Text("시작")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    Text("\(Int(sliderValue))%")
                        .font(.suite(size: 10, weight: .bold))
                        .foregroundColor(SMAPTheme.Color.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(SMAPTheme.Color.primary.opacity(0.1))
                        .cornerRadius(8)
                    
                    Spacer()
                    
                    Text("종료")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(width: 220)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.95))
                .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
    }
}


// MARK: - FAB

struct FloatingActionLogButton: View {
    let count: Int
    let action: () -> Void
    
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(SMAPTheme.Color.primary)
                    .frame(width: 56, height: 56)
                    .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24)
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

// MARK: - Map View

struct ActivityLogMapView: UIViewRepresentable {
    let mapMarkers: [MapMarker]
    let stayTimes: [StayTime]
    let sliderValue: Double
    let isSliderDragging: Bool
    
    private let rainbowColors: [UIColor] = [
        UIColor(red: 255/255, green: 138/255, blue: 128/255, alpha: 1), // Pastel Red
        UIColor(red: 255/255, green: 183/255, blue: 77/255, alpha: 1),  // Pastel Orange
        UIColor(red: 255/255, green: 213/255, blue: 79/255, alpha: 1),  // Pastel Yellow
        UIColor(red: 129/255, green: 199/255, blue: 132/255, alpha: 1), // Pastel Green
        UIColor(red: 79/255, green: 195/255, blue: 247/255, alpha: 1),  // Pastel Blue
        UIColor(red: 121/255, green: 134/255, blue: 203/255, alpha: 1), // Pastel Indigo
        UIColor(red: 186/255, green: 104/255, blue: 200/255, alpha: 1)  // Pastel Violet
    ]

    func makeUIView(context: Context) -> NMFMapView {
        let m = NMFMapView()
        m.positionMode = .disabled
        m.logoAlign = .leftBottom
        m.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화
        let lastLocation = LocationManager.shared.lastLocation ?? CLLocation(latitude: 37.5665, longitude: 126.978)
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            let initialPosition = NMGLatLng(lat: lastLocation.coordinate.latitude, lng: lastLocation.coordinate.longitude)
            m.moveCamera(NMFCameraUpdate(scrollTo: initialPosition))
            print("📍 [ActivityLogMapView] Using device location: (\(lastLocation.coordinate.latitude), \(lastLocation.coordinate.longitude))")
        } else {
            print("📍 [ActivityLogMapView] No device location, using default")
        }
        
        return m
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        // 1. Data Processing
        let sorted = mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
        
        var validMarkers: [MapMarker] = []
        var coords: [NMGLatLng] = []
        for marker in sorted {
            if marker.latitude != 0 && marker.longitude != 0 {
                validMarkers.append(marker)
                coords.append(NMGLatLng(lat: marker.latitude, lng: marker.longitude))
            }
        }
        
        // 2. Path Drawing (Only if data changed)
        if context.coordinator.lastMapMarkersCount != mapMarkers.count || context.coordinator.lastMapMarkersCount == 0 {
            context.coordinator.clearOverlays()
            context.coordinator.lastMapMarkersCount = mapMarkers.count
            
            print("📍 [ActivityLogMapView] Redrawing path. Markers: \(validMarkers.count)")
            
            // Draw Gradient Path
            if coords.count >= 2 {
                for i in 0..<(coords.count - 1) {
                    let start = coords[i]
                    let end = coords[i+1]
                    
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let line = NMFPolylineOverlay([start, end])
                    line?.color = interpolatedColor
                    line?.width = 6
                    line?.mapView = mapView
                    if let line = line {
                        context.coordinator.polylines.append(line)
                    }
                }
                
                // Draw Path Dots
                for i in 0..<coords.count {
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let dot = NMFMarker()
                    dot.position = coords[i]
                    dot.iconImage = NMFOverlayImage(image: generatePathDotImage(color: interpolatedColor))
                    dot.width = 8
                    dot.height = 8
                    dot.anchor = CGPoint(x: 0.5, y: 0.5)
                    dot.mapView = mapView
                    context.coordinator.pathDotMarkers.append(dot)
                }
                
                // Draw Arrows
                for i in 0..<(coords.count - 1) {
                    if i % 3 == 0, i + 1 < coords.count {
                        let start = coords[i]
                        let end = coords[i+1]
                        
                        let dLon = (end.lng - start.lng) * .pi / 180
                        let y = sin(dLon) * cos(end.lat * .pi / 180)
                        let x = cos(start.lat * .pi / 180) * sin(end.lat * .pi / 180) - sin(start.lat * .pi / 180) * cos(end.lat * .pi / 180) * cos(dLon)
                        var heading = atan2(y, x) * 180 / .pi
                        if heading < 0 { heading += 360 }
                        
                        let progress = Double(i) / Double(coords.count - 1)
                        let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                        let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                        let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                        
                        let color1 = rainbowColors[colorIndex]
                        let color2 = rainbowColors[nextColorIndex]
                        let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                        
                        let arrow = NMFMarker()
                        arrow.position = NMGLatLng(lat: (start.lat + end.lat)/2, lng: (start.lng + end.lng)/2)
                        arrow.iconImage = NMFOverlayImage(image: generateArrowImage(color: interpolatedColor))
                        arrow.angle = heading
                        arrow.width = 12
                        arrow.height = 12
                        arrow.anchor = CGPoint(x: 0.5, y: 0.5)
                        arrow.mapView = mapView
                        context.coordinator.arrowMarkers.append(arrow)
                    }
                }
            }
            
            // Draw Start/End Markers
            if let first = validMarkers.first {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: first.latitude, lng: first.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "S", color: UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
                
                let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: first.latitude, lng: first.longitude))
                cameraUpdate.animation = .fly
                mapView.moveCamera(cameraUpdate)
            }
            
            if let last = validMarkers.last {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: last.latitude, lng: last.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "E", color: UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
            }
            
            // Stay Markers
            for (index, stay) in stayTimes.enumerated() {
                if stay.stayLatitude != 0 && stay.stayLongitude != 0 {
                    let m = NMFMarker()
                    m.position = NMGLatLng(lat: stay.stayLatitude, lng: stay.stayLongitude)
                    
                    let durationForColor = stay.duration
                    var color = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)
                    var size: CGFloat = 26
                    
                    if durationForColor >= 300 { 
                        color = UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 1); size = 40
                    } else if durationForColor >= 120 {
                        color = UIColor(red: 234/255, green: 88/255, blue: 12/255, alpha: 1); size = 36
                    } else if durationForColor >= 60 {
                        color = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1); size = 32
                    } else if durationForColor >= 30 {
                        color = UIColor(red: 234/255, green: 179/255, blue: 8/255, alpha: 1); size = 28
                    }
                    
                    let markerResult = generateStayMarkerImage(number: index + 1, duration: stay.formattedDuration, color: color, size: size)
                    
                    m.iconImage = NMFOverlayImage(image: markerResult.image)
                    m.width = CGFloat(markerResult.image.size.width)
                    m.height = CGFloat(markerResult.image.size.height)
                    m.anchor = markerResult.anchor
                    
                    m.mapView = mapView
                    context.coordinator.stayMarkers.append(m)
                }
            }
        }
        
        // 3. Current Position Marker & Camera
        if !validMarkers.isEmpty {
            let index = Int(Double(validMarkers.count - 1) * sliderValue / 100.0)
            let curr = validMarkers[max(0, min(index, validMarkers.count - 1))]
            
            context.coordinator.currentPositionMarker?.mapView = nil
            context.coordinator.currentInfoMarker?.mapView = nil
            
            // Get time and speed from current log
            let timeStr: String
            if let gpsTime = curr.mlt_gps_time {
                let cleanedTime = gpsTime.replacingOccurrences(of: "Z", with: "").components(separatedBy: ".").first ?? gpsTime
                if cleanedTime.count >= 16 {
                    let startIdx = cleanedTime.index(cleanedTime.startIndex, offsetBy: 11)
                    let endIdx = cleanedTime.index(cleanedTime.startIndex, offsetBy: 16)
                    timeStr = String(cleanedTime[startIdx..<endIdx])
                } else {
                    timeStr = "--:--"
                }
            } else {
                timeStr = "--:--"
            }
            let speed = curr.mlt_speed ?? 0.0
            let speedStr = String(format: "%.1f km/h", speed)
            
            // Current Position Marker (Blue Bordered Circle)
            let m = NMFMarker()
            m.position = NMGLatLng(lat: curr.latitude, lng: curr.longitude)
            m.iconImage = NMFOverlayImage(image: generateCurrentLocationMarkerImage(color: UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1)))
            m.width = 24
            m.height = 24
            m.zIndex = 1000
            m.mapView = mapView
            context.coordinator.currentPositionMarker = m
            
            // Info Capsule Marker (Time + Speed)
            let infoMarker = NMFMarker()
            infoMarker.position = NMGLatLng(lat: curr.latitude, lng: curr.longitude)
            let infoImage = generateCurrentPositionInfoImage(time: timeStr, speed: speedStr)
            infoMarker.iconImage = NMFOverlayImage(image: infoImage)
            infoMarker.width = CGFloat(infoImage.size.width)
            infoMarker.height = CGFloat(infoImage.size.height)
            infoMarker.anchor = CGPoint(x: 0.5, y: 1.0) // Bottom center anchor
            infoMarker.zIndex = 1001
            infoMarker.mapView = mapView
            context.coordinator.currentInfoMarker = infoMarker
            
            let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: curr.latitude, lng: curr.longitude))
            cameraUpdate.animation = .none
            mapView.moveCamera(cameraUpdate)
        }
    }
    
    private func interpolateColor(color1: UIColor, color2: UIColor, factor: CGFloat) -> UIColor {
        var r1: CGFloat=0, g1: CGFloat=0, b1: CGFloat=0, a1: CGFloat=0
        var r2: CGFloat=0, g2: CGFloat=0, b2: CGFloat=0, a2: CGFloat=0
        color1.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        color2.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(
            red: r1 + (r2 - r1) * factor,
            green: g1 + (g2 - g1) * factor,
            blue: b1 + (b2 - b1) * factor,
            alpha: 1.0
        )
    }
    
    func makeCoordinator() -> Coordinator { Coordinator() }
    
    private func generateArrowImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 20, height: 20)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 10, y: 0))
            path.addLine(to: CGPoint(x: 20, y: 20))
            path.addLine(to: CGPoint(x: 10, y: 15))
            path.addLine(to: CGPoint(x: 0, y: 20))
            path.close()
            color.setFill()
            path.fill()
        }
    }
    
    private func generatePathDotImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 8, height: 8)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 8, height: 8))
            color.setFill()
            path.fill()
            let borderPath = UIBezierPath(ovalIn: CGRect(x: 0.5, y: 0.5, width: 7, height: 7))
            UIColor.white.setStroke()
            borderPath.lineWidth = 1.0
            borderPath.stroke()
        }
    }
    
    private func generateStayMarkerImage(number: Int, duration: String, color: UIColor, size: CGFloat = 30) -> (image: UIImage, anchor: CGPoint) {
        let bubbleFont = UIFont(name: "SUITE-Medium", size: 11) ?? UIFont.systemFont(ofSize: 11, weight: .medium)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let bubbleAttrs: [NSAttributedString.Key: Any] = [
            .font: bubbleFont,
            .foregroundColor: UIColor.white,
            .paragraphStyle: paragraphStyle
        ]
        let bubbleSizeCalc = duration.size(withAttributes: bubbleAttrs)
        let bubblePaddingH: CGFloat = 12
        let bubblePaddingV: CGFloat = 4
        let bubbleW = bubbleSizeCalc.width + bubblePaddingH
        let bubbleH = bubbleSizeCalc.height + bubblePaddingV
        let margin: CGFloat = 10
        let markerX: CGFloat = margin
        let initialMarkerY: CGFloat = margin + bubbleH/2 
        let bubbleX = markerX + size - 10
        let bubbleBottom = initialMarkerY + 8
        let bubbleY = bubbleBottom - bubbleH
        let yShift = max(0, margin - bubbleY)
        let finalMarkerY = initialMarkerY + yShift
        let finalBubbleY = bubbleY + yShift
        let canvasW = bubbleX + bubbleW + margin
        let canvasH = max(finalMarkerY + size + margin, finalBubbleY + bubbleH + margin)
        let canvasSize = CGSize(width: canvasW, height: canvasH)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        let image = renderer.image { ctx in
            let bubbleRect = CGRect(x: bubbleX, y: finalBubbleY, width: bubbleW, height: bubbleH)
            let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: 6)
            UIColor(red: 31/255, green: 41/255, blue: 55/255, alpha: 1).setFill()
            bubblePath.fill()
            let textRect = CGRect(x: bubbleRect.minX, y: bubbleRect.minY + (bubbleRect.height - bubbleSizeCalc.height) / 2, width: bubbleRect.width, height: bubbleSizeCalc.height)
            duration.draw(in: textRect, withAttributes: bubbleAttrs)
            let markerRect = CGRect(x: markerX, y: finalMarkerY, width: size, height: size)
            let circlePath = UIBezierPath(ovalIn: markerRect)
            color.setFill()
            circlePath.fill()
            let borderRect = markerRect.insetBy(dx: 1.5, dy: 1.5)
            let borderPath = UIBezierPath(ovalIn: borderRect)
            UIColor.white.setStroke()
            borderPath.lineWidth = 3
            borderPath.stroke()
            let numberStr = "\(number)"
            let numberFont = UIFont(name: "SUITE-Bold", size: 12) ?? UIFont.boldSystemFont(ofSize: 12)
            let numberAttrs: [NSAttributedString.Key: Any] = [.font: numberFont, .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let numberSize = numberStr.size(withAttributes: numberAttrs)
            let numberRect = CGRect(x: markerRect.midX - numberSize.width/2, y: markerRect.midY - numberSize.height/2, width: numberSize.width, height: numberSize.height)
            numberStr.draw(in: numberRect, withAttributes: numberAttrs)
        }
        let anchorX = (markerX + size/2) / canvasSize.width
        let anchorY = (finalMarkerY + size/2) / canvasSize.height
        return (image: image, anchor: CGPoint(x: anchorX, y: anchorY))
    }
    
    private func generateCurrentLocationMarkerImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            // White circle background
            let circleRect = CGRect(x: 2.5, y: 2.5, width: 19, height: 19)
            let circlePath = UIBezierPath(ovalIn: circleRect)
            UIColor.white.setFill()
            circlePath.fill()
            
            // Color border
            color.setStroke()
            circlePath.lineWidth = 5
            circlePath.stroke()
        }
    }
    
    private func generateStartEndMarkerImage(text: String, color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let rect = CGRect(x: 2, y: 2, width: 20, height: 20)
            let path = UIBezierPath(ovalIn: rect)
            color.setFill()
            path.fill()
            UIColor.white.setStroke()
            path.lineWidth = 2
            path.stroke()
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center
            let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 10), .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let textSize = text.size(withAttributes: attrs)
            let textRect = CGRect(x: (24 - textSize.width)/2, y: (24 - textSize.height)/2, width: textSize.width, height: textSize.height)
            text.draw(in: textRect, withAttributes: attrs)
        }
    }

    class Coordinator: NSObject {
        var markers: [NMFMarker] = []
        var stayMarkers: [NMFMarker] = []
        var arrowMarkers: [NMFMarker] = []
        var pathDotMarkers: [NMFMarker] = []
        var polylines: [NMFPolylineOverlay] = []
        var currentPositionMarker: NMFMarker?
        var currentInfoMarker: NMFMarker?
        var lastMapMarkersCount: Int = 0
        
        func clearOverlays() {
            markers.forEach { $0.mapView = nil }
            markers.removeAll()
            stayMarkers.forEach { $0.mapView = nil }
            stayMarkers.removeAll()
            arrowMarkers.forEach { $0.mapView = nil }
            arrowMarkers.removeAll()
            pathDotMarkers.forEach { $0.mapView = nil }
            pathDotMarkers.removeAll()
            polylines.forEach { $0.mapView = nil }
            polylines.removeAll()
            currentPositionMarker?.mapView = nil
            currentPositionMarker = nil
            currentInfoMarker?.mapView = nil
            currentInfoMarker = nil
            lastMapMarkersCount = 0
        }
    }
    
    private func generateCurrentPositionInfoImage(time: String, speed: String) -> UIImage {
        let font = UIFont(name: "SUITE-Bold", size: 12) ?? UIFont.boldSystemFont(ofSize: 12)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.white,
            .paragraphStyle: paragraphStyle
        ]
        
        let displayText = "\(time)  |  \(speed)"
        let textSize = displayText.size(withAttributes: attrs)
        
        let paddingH: CGFloat = 12
        let paddingV: CGFloat = 6
        let capsuleWidth = textSize.width + paddingH * 2
        let capsuleHeight = textSize.height + paddingV * 2
        let markerBottomPadding: CGFloat = 32 // Gap between capsule and marker
        
        let canvasSize = CGSize(width: capsuleWidth, height: capsuleHeight + markerBottomPadding)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        
        return renderer.image { ctx in
            // Draw capsule background
            let capsuleRect = CGRect(x: 0, y: 0, width: capsuleWidth, height: capsuleHeight)
            let capsulePath = UIBezierPath(roundedRect: capsuleRect, cornerRadius: capsuleHeight / 2)
            UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 0.9).setFill()
            capsulePath.fill()
            
            // Draw text
            let textRect = CGRect(
                x: (capsuleWidth - textSize.width) / 2,
                y: (capsuleHeight - textSize.height) / 2,
                width: textSize.width,
                height: textSize.height
            )
            displayText.draw(in: textRect, withAttributes: attrs)
        }
    }
}

// MARK: - Preview

struct ActivityLogView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogView()
    }
}
