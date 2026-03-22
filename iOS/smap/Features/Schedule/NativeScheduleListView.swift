//
// NativeScheduleListView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct NativeScheduleListView: View {
    @StateObject private var viewModel = ScheduleViewModel()
    @Environment(\.presentationMode) var presentationMode

    @State private var showingAddSchedule = false
    @State private var scheduleToEdit: Schedule?
    @State private var scheduleToEditOption: String? // "this", "future", "all"

    @State private var showingRecurringActionSheet = false
    @State private var recurringActionType: RecurringActionType = .edit
    @State private var selectedScheduleForAction: Schedule?

    enum RecurringActionType {
        case edit, delete
    }

    

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).ignoresSafeArea()


                VStack(spacing: 0) {
                    titleView // "Schedule" Title area
                        .zIndex(1)

                    // Floating Card Container (Month Nav + Calendar)
                    VStack(spacing: 0) {
                        monthNavView
                        calendarGridView
                    }
                    .padding(.bottom, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 5)
                    .padding(.horizontal, 16) // Aligned with summary card padding
                    .zIndex(1)

                    // Scrollable Event List
                    ScrollView {
                        VStack(spacing: 20) {
                            eventListView
                        }
                        .padding(.top, 20)
                        .padding(.bottom, 80)
                    }
                    .refreshable {
                        viewModel.fetchSchedules()
                    }
                }

                if viewModel.isLoading {
                    ZStack {
                        Color.black.opacity(0.1).ignoresSafeArea()
                        ActivityIndicator(style: .large, color: SMAPTheme.Color.primary.uiColor)
                            .padding()
                            .background(Color.white)
                            .cornerRadius(12)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingAddSchedule) {
                ScheduleFormView(
                    viewModel: viewModel,
                    initialGroupId: viewModel.selectedGroup?.sgt_idx ?? 0,
                    onSave: {
                        viewModel.fetchSchedules()
                        showingAddSchedule = false
                    }
                )
            }
            .sheet(item: $scheduleToEdit) { schedule in
                ScheduleFormView(
                    viewModel: viewModel,
                    initialGroupId: viewModel.selectedGroup?.sgt_idx ?? 0,
                    schedule: schedule,
                    editOption: scheduleToEditOption,
                    onSave: {
                        viewModel.fetchSchedules()
                        scheduleToEdit = nil
                    }
                )
            }
            .confirmationDialog(
                recurringActionType == .edit ? "반복 일정 수정" : "반복 일정 삭제",
                isPresented: $showingRecurringActionSheet,
                titleVisibility: .visible
            ) {
                if recurringActionType == .edit {
                    Button("이 일정만 수정") {
                        if let s = selectedScheduleForAction {
                            scheduleToEdit = s
                            scheduleToEditOption = "this"
                        }
                    }
                    Button("모든 반복 일정 수정") {
                        if let s = selectedScheduleForAction {
                            scheduleToEdit = s
                            scheduleToEditOption = "all"
                        }
                    }
                } else {
                    Button("이 일정만 삭제", role: .destructive) {
                        if let s = selectedScheduleForAction {
                            viewModel.deleteSchedule(s, option: "this")
                        }
                    }
                    Button("모든 반복 일정 삭제", role: .destructive) {
                        if let s = selectedScheduleForAction {
                            viewModel.deleteSchedule(s, option: "all")
                        }
                    }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("수행할 범위를 선택해 주세요.")
            }
        }
    }

    private var titleView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("일정")
                    .font(.suite(size: 22, weight: .bold)) // Updated to match Group List
                    .foregroundColor(.primary)
                Text("그룹 멤버들과 일정을 공유해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            Spacer()
            Button(action: { showingAddSchedule = true }) {
                Image(systemName: "plus")
                    .font(.suite(size: 22, weight: .bold)) // Larger Plus
                    .foregroundColor(SMAPTheme.Color.primary)
            }
            .accessibilityLabel("일정 추가")
        }

        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .padding(.bottom, 10) // Extra bottom spacing for card separation
    }

    private var monthNavView: some View {
        // Month Navigation and "Go to Today"
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Spacer()
                Button(action: { viewModel.changeMonth(by: -1) }) {
                    Image(systemName: "chevron.left")
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                }
                .accessibilityLabel("이전 달")
                Text(formatMonth(viewModel.currentMonth))
                    .font(.suite(size: 16, weight: .bold)) // Larger Month
                    .frame(width: 140)
                Button(action: { viewModel.changeMonth(by: 1) }) {
                    Image(systemName: "chevron.right")
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                }
                .accessibilityLabel("다음 달")
                Spacer()
            }
            .padding(.top, 8)

            Button(action: {
                withAnimation {
                    viewModel.goToToday()
                }
            }) {
                Text("오늘로 이동")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(SMAPTheme.Color.primary)
            }
            .padding(.bottom, 4)
            .padding(.top, 4)
        }
    }

    private var calendarGridView: some View {
        VStack(spacing: 0) { // Reduced spacing
            let days = ["일", "월", "화", "수", "목", "금", "토"]
            HStack {
                ForEach(days, id: \.self) { day in
                    Text(day)
                        .font(.suite(size: 12))
                        .foregroundColor(day == "일" ? .red : (day == "토" ? .blue : .gray))
                        .frame(maxWidth: .infinity)
                }
            }
            let monthDays = generateMonthDays()
            ForEach(0..<monthDays.count / 7, id: \.self) { weekIndex in
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { dayIndex in
                        let index = weekIndex * 7 + dayIndex
                        if index < monthDays.count {
                            let date = monthDays[index]
                            CalendarDateCell(
                                date: date,
                                isSelected: Calendar.current.isDate(date, inSameDayAs: viewModel.selectedDate),
                                isToday: Calendar.current.isDateInToday(date),
                                isCurrentMonth: Calendar.current.isDate(date, equalTo: viewModel.currentMonth, toGranularity: .month),
                                hasEvent: viewModel.datesWithEvents.contains(Calendar.current.startOfDay(for: date)),
                                onTap: { viewModel.selectDate(date) }
                            )
                        }
                    }
                }
            }
        }
        .padding(.horizontal)
        .padding(.top, 4)
        .padding(.bottom, 0)
    }

    private var memberFilterView: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Text removed as requested

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(viewModel.groupMembers) { member in
                        Button(action: {
                            withAnimation(.spring()) {
                                viewModel.toggleMemberSelection(member.id)
                            }
                        }) {
                            VStack(spacing: 8) {
                                ZStack {
                                    if let photoUrl = member.mt_file1, !photoUrl.isEmpty {
                                        AsyncImage(url: URL(string: photoUrl.hasPrefix("http") ? photoUrl : "https://nextstep.smap.site\(photoUrl)")) { phase in
                                            if let image = phase.image {
                                                image.resizable().aspectRatio(contentMode: .fill)
                                            } else {
                                                Image(systemName: "person.circle.fill").resizable().foregroundColor(.gray.opacity(0.3))
                                            }
                                        }
                                        .frame(width: 52, height: 52)
                                        .clipShape(Circle())
                                    } else {
                                        Image(systemName: "person.circle.fill")
                                            .resizable()
                                            .frame(width: 52, height: 52)
                                            .foregroundColor(.gray.opacity(0.3))
                                    }

                                    if viewModel.selectedMemberIds.contains(member.id) {
                                        Circle()
                                            .stroke(SMAPTheme.Color.primary, lineWidth: 3)
                                            .frame(width: 60, height: 60)

                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(SMAPTheme.Color.primary)
                                            .background(Color.white.clipShape(Circle()))
                                            .font(.suite(size: 16))
                                            .offset(x: 20, y: 20)
                                    }
                                }
                                .padding(4)

                                Text(member.displayName)
                                    .font(.suite(size: 11, weight: viewModel.selectedMemberIds.contains(member.id) ? .bold : .medium))
                                    .foregroundColor(viewModel.selectedMemberIds.contains(member.id) ? .primary : .gray)
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 4)
            }
        }
        .padding(.vertical, 8)
    }

    private var eventListView: some View {
        VStack(spacing: 0) {
            // Selected Date Banner
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(formatSelectedDate(viewModel.selectedDate))
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)

                    Text("\(viewModel.filteredSchedules.count)개의 일정")
                        .font(.suite(size: 14))
                        .foregroundColor(.white.opacity(0.8))
                }
                Spacer()
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color(red: 0/255, green: 20/255, blue: 140/255)) // Dark Brand Color
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 16)

            VStack(alignment: .leading, spacing: 8) {
                if viewModel.filteredSchedules.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "calendar.badge.plus")
                            .font(.suite(size: 48))
                            .foregroundColor(.gray.opacity(0.2))
                        Text("등록된 일정이 없습니다")
                            .font(.suite(size: 16))
                            .foregroundColor(.gray)
                        Button(action: { showingAddSchedule = true }) {
                            Text("일정 추가하기")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(SMAPTheme.Color.primary)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(SMAPTheme.Color.primary.opacity(0.1))
                                .cornerRadius(20)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    ForEach(viewModel.filteredSchedules) { schedule in
                        ScheduleEventCard(
                            schedule: schedule,
                            groupName: viewModel.selectedGroup?.sgt_title,
                            canManage: viewModel.canManageSchedule(schedule),
                            onEdit: {
                                print("DEBUG: Edit clicked for schedule: \(schedule.sst_title ?? ""), isRecurring: \(schedule.isRecurring)")
                                if schedule.isRecurring {
                                    selectedScheduleForAction = schedule
                                    recurringActionType = .edit
                                    showingRecurringActionSheet = true
                                } else {
                                    scheduleToEdit = schedule
                                    scheduleToEditOption = nil
                                }
                            },
                            onDelete: {
                                print("DEBUG: Delete clicked for schedule: \(schedule.sst_title ?? ""), isRecurring: \(schedule.isRecurring)")
                                if schedule.isRecurring {
                                    selectedScheduleForAction = schedule
                                    recurringActionType = .delete
                                    showingRecurringActionSheet = true
                                } else {
                                    viewModel.deleteSchedule(schedule)
                                }
                            }
                        )
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
    }

    private func formatMonth(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy년 MM월"
        return formatter.string(from: date)
    }

    private func formatSelectedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M월 d일 EEEE"
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.string(from: date)
    }

    private func generateMonthDays() -> [Date] {
        let calendar = Calendar.current

        // Start of the month
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: viewModel.currentMonth))!

        // End of the month
        let range = calendar.range(of: .day, in: .month, for: startOfMonth)!
        let endOfMonth = calendar.date(byAdding: .day, value: range.count - 1, to: startOfMonth)!

        // Start of the grid (Previous Sunday)
        let firstWeekday = calendar.component(.weekday, from: startOfMonth)
        let startOfCalendar = calendar.date(byAdding: .day, value: -(firstWeekday - 1), to: startOfMonth)!

        // End of the grid (Next Saturday)
        let lastWeekday = calendar.component(.weekday, from: endOfMonth)
        let daysToAdd = 7 - lastWeekday
        let endOfCalendar = calendar.date(byAdding: .day, value: daysToAdd, to: endOfMonth)!

        // Total days to show
        let numberOfDays = calendar.dateComponents([.day], from: startOfCalendar, to: endOfCalendar).day! + 1

        var days: [Date] = []
        for i in 0..<numberOfDays {
            if let date = calendar.date(byAdding: .day, value: i, to: startOfCalendar) {
                days.append(date)
            }
        }
        return days
    }
}

struct CalendarDateCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let isCurrentMonth: Bool
    let hasEvent: Bool
    let onTap: () -> Void

    

    var body: some View {
        VStack(spacing: 0) { // Spacing 0 for tighter layout
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.suite(size: 15, weight: isSelected ? .bold : (isToday ? .bold : .medium)))
                .foregroundColor(textColor)
                .frame(width: 36, height: 36)
                .background(
                    ZStack {
                        if isSelected {
                            SMAPTheme.Color.primary
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 4, x: 0, y: 2)
                        } else if isToday {
                            SMAPTheme.Color.primary.opacity(0.1)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                )

            if hasEvent {
                Circle()
                    .fill(Color.red) // Red Dot
                    .frame(width: 4, height: 4)
                    .padding(.top, -8) // Pull closer to the number
            } else {
                Spacer().frame(height: 4) // Mantain height consistency
            }
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring()) {
                onTap()
            }
        }
        .opacity(isCurrentMonth ? 1.0 : 0.2)
        // Removed vertical padding to reduce height
    }

    private var textColor: Color {
        if isSelected { return .white }
        if isToday { return SMAPTheme.Color.primary }
        let weekday = Calendar.current.component(.weekday, from: date)
        if weekday == 1 { return .red.opacity(isCurrentMonth ? 1.0 : 0.5) }
        if weekday == 7 { return .blue.opacity(isCurrentMonth ? 1.0 : 0.5) }
        return .primary
    }
}

struct ScheduleEventCard: View {
    let schedule: Schedule
    let groupName: String? // Added groupName
    let canManage: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void

    

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Left: Time Block (Compact)
            VStack(alignment: .leading, spacing: 2) {
                if let sDate = scheduleDate(from: schedule.sst_sdate) {
                    Text(formatTime(sDate))
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }

                if let eDate = scheduleDate(from: schedule.sst_edate) {
                    Text("~ \(formatTime(eDate))")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }

                // Moved Repeat Info to here for visibility
                if let repeatText = schedule.repeatDescription {
                     HStack(spacing: 2) {
                        Image(systemName: "repeat")
                            .font(.suite(size: 10))
                        Text(repeatText)
                            .font(.suite(size: 11))
                    }
                    .foregroundColor(.blue.opacity(0.8))
                    .padding(.top, 4)
                }
            }
            .frame(width: 70, alignment: .leading)

            // Right: Content Block
            VStack(alignment: .leading, spacing: 4) {
                // Member & Group Info
                HStack(spacing: 6) {
                    // Avatar
                    if #available(iOS 15.0, *),
                       let photo = schedule.validMemberPhoto,
                       !photo.isEmpty,
                       let url = URL(string: photo.hasPrefix("http") ? photo : "https://nextstep.smap.site\(photo)") {

                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().aspectRatio(contentMode: .fill)
                            } else {
                                Image(systemName: "person.circle.fill").foregroundColor(.gray)
                            }
                        }
                        .frame(width: 20, height: 20)
                        .clipShape(Circle())
                    } else {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .frame(width: 20, height: 20)
                            .foregroundColor(.gray)
                    }

                    Text(schedule.validMemberName)
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(SMAPTheme.Color.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    if let gName = groupName {
                        Text("•")
                            .font(.suite(size: 10))
                            .foregroundColor(.gray)
                        Text(gName)
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }

                Text(schedule.sst_title ?? "제목 없음")
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                if let location = schedule.sst_location_title, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.suite(size: 12))
                        Text(location)
                            .font(.suite(size: 13))
                    }
                    .foregroundColor(.gray)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Status Badge & Menu
            VStack(alignment: .trailing, spacing: 4) {
                Text(schedule.status.text)
                    .font(.suite(size: 11, weight: .bold))
                    .foregroundColor(statusColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(statusColor.opacity(0.1))
                    .cornerRadius(4)

                if canManage {
                    Menu {
                        Button(action: onEdit) {
                            Label("수정", systemImage: "pencil")
                        }
                        Button(role: .destructive, action: onDelete) {
                            Label("삭제", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                            .padding(8)
                    }
                    .accessibilityLabel("일정 관리")
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private func scheduleDate(from string: String?) -> Date? {
        guard let str = string else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = formatter.date(from: str) { return date }

        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter.date(from: str)
    }

    private var statusColor: Color {
        switch schedule.status {
        case .completed: return .green
        case .ongoing: return .orange
        case .upcoming: return .blue
        case .defaultStatus: return .gray
        }
    }
}
