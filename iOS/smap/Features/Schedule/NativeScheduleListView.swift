//
// NativeScheduleListView.swift
// smap
//
// 선택한 날의 약속을 먼저 보여 주고, 월 달력에서 다른 달로 이동한다.

import SwiftUI

struct NativeScheduleListView: View {
    @Environment(\.smapAccent) private var accent
    @StateObject private var viewModel = ScheduleViewModel()

    @State private var showsMonth = false
    @State private var showingAddSchedule = false
    @State private var showingGroupPicker = false
    @State private var detailSchedule: Schedule?
    @State private var scheduleToEdit: Schedule?
    @State private var scheduleToEditOption: String? // "this", "all"
    @State private var scheduleToDelete: Schedule?

    @State private var showingRecurringActionSheet = false
    @State private var recurringActionType: RecurringActionType = .edit
    @State private var selectedScheduleForAction: Schedule?

    enum RecurringActionType {
        case edit, delete
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
                    topControls
                    agendaHeader
                    if showsMonth {
                        ScheduleMonthCalendar(
                            currentMonth: viewModel.currentMonth, selectedDate: viewModel.selectedDate,
                            eventDates: viewModel.datesWithEvents,
                            onSelect: { viewModel.selectDate($0); showsMonth = false },
                            onPrevious: { browseMonth(-1) }, onNext: { browseMonth(1) },
                            onToday: { viewModel.goToToday(); showsMonth = false }
                        )
                    } else {
                        DateStrip(items: monthDays, selected: viewModel.selectedDate) { viewModel.selectDate($0.date) }
                            .id(Calendar.current.dateComponents([.year, .month], from: viewModel.selectedDate))
                    }
                    daySection
                        .padding(.top, SMAPTheme.Spacing.sm)
                }
                .padding(.horizontal, SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.xl)
            }
            .background(SMAPTheme.Family.paper.ignoresSafeArea())
            .refreshable { viewModel.fetchSchedules() }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingGroupPicker) {
                GroupPickerSheet(
                    groups: viewModel.groups,
                    selectedGroupId: viewModel.selectedGroup?.sgt_idx,
                    onSelect: { viewModel.selectGroup($0) }
                )
            }
            .sheet(item: $detailSchedule) { schedule in
                ScheduleDetailSheet(
                    schedule: schedule,
                    canManage: viewModel.canManageSchedule(schedule),
                    onEdit: { startEdit(schedule) },
                    onDelete: { startDelete(schedule) }
                )
            }
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
                            scheduleToEditOption = "this"
                            scheduleToEdit = s
                        }
                    }
                    Button("모든 반복 일정 수정") {
                        if let s = selectedScheduleForAction {
                            scheduleToEditOption = "all"
                            scheduleToEdit = s
                        }
                    }
                } else {
                    Button("이 일정만 삭제", role: .destructive) {
                        if let s = selectedScheduleForAction { viewModel.deleteSchedule(s, option: "this") }
                    }
                    Button("모든 반복 일정 삭제", role: .destructive) {
                        if let s = selectedScheduleForAction { viewModel.deleteSchedule(s, option: "all") }
                    }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("수행할 범위를 선택해 주세요.")
            }
            // 반복이 아닌 일정 삭제 — 이전에는 … 메뉴에서 누르자마자 확인 없이 지워졌다.
            .alert(
                "일정을 삭제할까요?",
                isPresented: Binding(get: { scheduleToDelete != nil }, set: { if !$0 { scheduleToDelete = nil } }),
                presenting: scheduleToDelete
            ) { schedule in
                Button("취소", role: .cancel) {}
                Button("삭제", role: .destructive) { viewModel.deleteSchedule(schedule) }
            } message: { schedule in
                Text("‘\(schedule.sst_title ?? "제목 없음")’ 일정을 지우면 되돌릴 수 없어요.")
            }
            // 불러오기·삭제 실패를 알린다(이전에는 errorMessage 를 화면에 보여 주지 않아 실패가 묻혔다).
            .alert(
                "알림",
                isPresented: Binding(get: { viewModel.errorMessage != nil }, set: { if !$0 { viewModel.errorMessage = nil } })
            ) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: 맨 위 줄 — 그룹 전환 알약(지도 탭과 같은 모양) + 일정 추가(이 탭의 주 동작이라 남색 원)

    private var topControls: some View {
        HStack(spacing: SMAPTheme.Spacing.sm) {
            GroupSwitcherPill(groupName: viewModel.selectedGroup?.sgt_title) { showingGroupPicker = true }
            Spacer(minLength: 0)
            SMAPGradientIconButton(systemImage: "plus", accessibilityLabel: "일정 추가") {
                HapticManager.shared.impact(style: .light)
                showingAddSchedule = true
            }
        }
        .padding(.top, SMAPSheetMetrics.topControlsVerticalPadding)
    }

    // MARK: 고른 날 일정

    private func browseMonth(_ offset: Int) {
        viewModel.changeMonth(by: offset)
        if let start = Calendar.current.dateInterval(of: .month, for: viewModel.currentMonth)?.start {
            viewModel.selectDate(start)
        }
    }

    private var monthDays: [DateChipItem] {
        let calendar = Calendar.current
        guard let month = calendar.dateInterval(of: .month, for: viewModel.selectedDate),
              let range = calendar.range(of: .day, in: .month, for: month.start) else { return [] }
        let events = Set(viewModel.datesWithEvents.map { calendar.startOfDay(for: $0) })
        return range.compactMap { day in
            guard let date = calendar.date(byAdding: .day, value: day - 1, to: month.start) else { return nil }
            return DateChipItem(date: date, dot: events.contains(date))
        }
    }

    private var agendaHeader: some View {
        let date = viewModel.selectedDate
        let calendar = Calendar.current
        return HStack(spacing: 14) {
            Text(String(calendar.component(.day, from: date)))
                .font(.suite(size: 46, weight: .bold)).monospacedDigit()
                .foregroundStyle(SMAPTheme.Family.ink)
                .frame(minWidth: 68, minHeight: 76)
                .background(SMAPTheme.Family.highlight, in: RoundedRectangle(cornerRadius: 15))
                .accessibilityLabel("\(calendar.component(.day, from: date))일")
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: "\(calendar.component(.year, from: date))년 \(calendar.component(.month, from: date))월")
                    .font(SMAPTheme.Font.captionBold).foregroundStyle(accent.deep)
                Text(date.formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "ko_KR"))))
                    .font(.suite(size: 25, weight: .bold)).foregroundStyle(SMAPTheme.Family.ink)
            }
            Spacer(minLength: 0)
            Button { showsMonth.toggle() } label: {
                Label(showsMonth ? "달력 접기" : "월 달력", systemImage: "calendar")
                    .font(SMAPTheme.Font.captionBold).foregroundStyle(accent.deep)
                    .padding(.horizontal, 12).frame(minHeight: 44)
                    .background(accent.container, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(12).frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 22))
    }

    private var daySection: some View {
        let schedules = viewModel.filteredSchedules
        let day = Calendar.current.isDateInToday(viewModel.selectedDate) ? "오늘의 약속" : "이날의 약속"
        let title = schedules.isEmpty ? day : "\(day) · \(schedules.count)개"
        return SMAPSection(title: title) {
            if viewModel.isLoading && schedules.isEmpty {
                // 그날 일정이 이미 보이면 새로 불러오는 동안에도 그대로 둔다(화면 전체를 덮던 스피너 제거).
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 96)
            } else if schedules.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        Image(systemName: "calendar.badge.plus").font(.title2).foregroundStyle(accent.deep)
                            .frame(width: 46, height: 48).background(accent.container, in: RoundedRectangle(cornerRadius: 12))
                        Text("아직 약속이 없는 날이에요")
                            .font(SMAPTheme.Font.headline).foregroundStyle(SMAPTheme.Surface.onSurface)
                    }
                    Button { showingAddSchedule = true } label: {
                        Label("이날 약속 추가", systemImage: "plus")
                            .font(SMAPTheme.Font.captionBold).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(SMAPTheme.Family.ink, in: RoundedRectangle(cornerRadius: 13))
                    }
                    .buttonStyle(.plain)
                }
                .padding(SMAPTheme.Spacing.md)
            } else {
                ForEach(Array(schedules.enumerated()), id: \.element.id) { index, schedule in
                    if index > 0 { SMAPRowDivider() }
                    ScheduleRow(schedule: schedule) { detailSchedule = schedule }
                }
            }
        }
    }

    // MARK: 수정·삭제 — 반복 일정은 범위를 먼저 묻는다

    private func startEdit(_ schedule: Schedule) {
        detailSchedule = nil
        if schedule.isRecurring {
            selectedScheduleForAction = schedule
            recurringActionType = .edit
            presentAfterSheetDismiss { showingRecurringActionSheet = true }
        } else {
            scheduleToEditOption = nil
            presentAfterSheetDismiss { scheduleToEdit = schedule }
        }
    }

    private func startDelete(_ schedule: Schedule) {
        detailSchedule = nil
        if schedule.isRecurring {
            selectedScheduleForAction = schedule
            recurringActionType = .delete
            presentAfterSheetDismiss { showingRecurringActionSheet = true }
        } else {
            presentAfterSheetDismiss { scheduleToDelete = schedule }
        }
    }

    /// 상세 시트가 내려간 뒤에 다음 창을 띄운다 — 시트가 닫히는 중에 다른 창을 띄우면 SwiftUI 가 무시한다.
    private func presentAfterSheetDismiss(_ action: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: action)
    }
}

// MARK: - 남색 달력 카드

/// 월 달력 — 남색 그라데이션 카드 위 흰 글자. 고른 날은 흰 원 + 남색 글자, 오늘은 옅은 흰 원, 일정 있는 날은 점.
/// 지난/다음 달 날짜 칸은 비워 이번 달만 보이게 한다(Android 와 동일).
struct ScheduleMonthCalendar: View {
    @Environment(\.smapAccent) private var accent
    let currentMonth: Date
    let selectedDate: Date
    let eventDates: Set<Date>
    let onSelect: (Date) -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onToday: () -> Void

    /// 남색 바탕 위 일요일 — 빨강을 옅게 해 남색 위에서도 읽히게 한다.
    private static let sundayOnNavy = Color(red: 1, green: 0xEE / 255, blue: 0xDF / 255)
    private let calendar = Calendar.current

    var body: some View {
        let today = Date()
        let isThisMonth = calendar.isDate(currentMonth, equalTo: today, toGranularity: .month)
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                // verbatim — 숫자를 그냥 넣으면 SwiftUI 가 "2,026년"처럼 자릿수 쉼표를 붙인다.
                Text(verbatim: "\(calendar.component(.year, from: currentMonth))년 \(calendar.component(.month, from: currentMonth))월")
                    .font(SMAPTheme.Font.headline)
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                if !isThisMonth || !calendar.isDate(selectedDate, inSameDayAs: today) {
                    Button(action: onToday) {
                        Text("오늘")
                            .font(SMAPTheme.Font.captionBold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                monthButton("chevron.left", label: "이전 달", action: onPrevious)
                monthButton("chevron.right", label: "다음 달", action: onNext)
            }
            .padding(.leading, SMAPTheme.Spacing.md)
            .padding(.trailing, 4)

            HStack(spacing: 0) {
                ForEach(Array(["일", "월", "화", "수", "목", "금", "토"].enumerated()), id: \.offset) { index, day in
                    Text(day)
                        .font(SMAPTheme.Font.captionSmall)
                        .foregroundStyle(index == 0 ? Self.sundayOnNavy : Color.white.opacity(0.94))
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, SMAPTheme.Spacing.sm)
            .padding(.bottom, 4)
            .accessibilityHidden(true)

            let cells = monthCells()
            VStack(spacing: 0) {
                ForEach(0..<(cells.count / 7), id: \.self) { week in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { col in
                            Group {
                                if let date = cells[week * 7 + col] {
                                    dayCell(date, isSunday: col == 0)
                                } else {
                                    Color.clear
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                        }
                    }
                }
            }
            .padding(.horizontal, SMAPTheme.Spacing.sm)
            .padding(.bottom, SMAPTheme.Spacing.sm)
        }
        .padding(.top, 4)
        .background(
            GeometryReader { geo in
                ZStack {
                    accent.gradient
                    Circle()
                        .fill(Color.white.opacity(0.07))
                        .frame(width: geo.size.width * 0.76)
                        .position(x: geo.size.width, y: 0)
                }
            }
            // 장식 원은 카드 밖으로 삐져나간다. clipShape 는 그림만 자르고 누름 영역은 자르지 않아
            // 카드 위 "일정 추가" 버튼의 누름을 가로챘다 — 장식은 누름을 받지 않게 한다.
            .allowsHitTesting(false)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: accent.base.opacity(0.28), radius: 10, y: 4)
    }

    private func monthButton(_ systemImage: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.85))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func dayCell(_ date: Date, isSunday: Bool) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
        let isToday = calendar.isDateInToday(date)
        let hasEvent = eventDates.contains(calendar.startOfDay(for: date))
        let day = calendar.component(.day, from: date)
        let textColor: Color = isSelected ? accent.base : (isToday ? .white : (isSunday ? Self.sundayOnNavy : .white))
        var a11y = "\(day)일"
        if isToday { a11y += ", 오늘" }
        if hasEvent { a11y += ", 일정 있음" }

        return Button {
            HapticManager.shared.selection()
            onSelect(date)
        } label: {
            VStack(spacing: 1) {
                Text("\(day)")
                    .font(.suite(size: 16, weight: isSelected || isToday ? .bold : .regular))
                    .foregroundStyle(textColor)
                Circle()
                    .fill(!hasEvent ? Color.clear : (isSelected ? accent.base : Color.white))
                    .frame(width: 4, height: 4)
            }
            .frame(width: 40, height: 40)
            .background(Circle().fill(isSelected ? Color.white : (isToday ? Color.white.opacity(0.08) : Color.clear)))
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11y)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    /// 이번 달 칸 — 1일 앞쪽(일요일 시작)과 마지막 주 뒤쪽은 nil(빈칸)
    private func monthCells() -> [Date?] {
        guard let start = calendar.date(from: calendar.dateComponents([.year, .month], from: currentMonth)),
              let days = calendar.range(of: .day, in: .month, for: start)?.count else { return [] }
        let leading = calendar.component(.weekday, from: start) - 1
        var cells: [Date?] = Array(repeating: nil, count: leading)
        cells += (0..<days).map { calendar.date(byAdding: .day, value: $0, to: start) }
        cells += Array(repeating: nil, count: (7 - cells.count % 7) % 7)
        return cells
    }
}

// MARK: - 일정 한 줄

/// 왼쪽 시각(시작·끝), 가운데 제목과 "누구 · 어디 · 반복", 오른쪽 상태(진행 중일 때만 남색으로 강조).
/// 이전 카드의 … 메뉴는 없앴다 — 눌러서 여는 상세 시트에 수정·삭제가 있다.
/// 일정 탭 한 줄 — 모양은 공용 SMAPScheduleRow(홈 시트와 같은 줄). 여기서는 일정 모델을 값으로 풀어 넘긴다.
struct ScheduleRow: View {
    let schedule: Schedule
    let action: () -> Void

    var body: some View {
        SMAPScheduleRow(
            start: scheduleClock(schedule.sst_sdate),
            end: scheduleClock(schedule.sst_edate),
            allDay: schedule.sst_all_day == "Y",
            title: schedule.sst_title.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없음",
            member: schedule.validMemberName.isEmpty ? nil
                : .init(name: schedule.validMemberName, photo: schedule.validMemberPhoto, id: schedule.mt_idx),
            place: schedule.sst_location_title.flatMap { $0.isEmpty ? nil : $0 },
            repeatText: schedule.isRecurring ? (schedule.repeatDescription ?? "반복") : nil,
            isDone: schedule.status == .completed,
            ongoingText: schedule.status == .ongoing ? schedule.status.text : nil,
            action: action
        )
    }
}

// MARK: - 일정 상세 시트

/// 일정 상세 — 상태·제목, 날짜·시간, 대상, 장소, 반복, 메모 + (권한 있으면) 삭제·수정.
struct ScheduleDetailSheet: View {
    @Environment(\.smapAccent) private var accent
    let schedule: Schedule
    let canManage: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 EEEE"
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(schedule.status.text)
                            .font(SMAPTheme.Font.captionBold)
                            .foregroundStyle(schedule.status == .ongoing ? accent.base : SMAPTheme.Surface.onSurfaceMuted)
                        Text(schedule.sst_title.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없음")
                            .font(SMAPTheme.Font.title)
                            .foregroundStyle(SMAPTheme.Surface.onSurface)
                            .accessibilityAddTraits(.isHeader)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, SMAPTheme.Spacing.sm)

                    SMAPListRow(title: dateText, subtitle: timeText, leading: { SMAPRowIcon(systemImage: "clock") })
                    if !schedule.validMemberName.isEmpty {
                        SMAPListRow(title: schedule.validMemberName, subtitle: "일정 대상", leading: {
                            SMAPAvatar(name: schedule.validMemberName, imagePath: schedule.validMemberPhoto, size: 40)
                        })
                    }
                    if let place = schedule.sst_location_title, !place.isEmpty {
                        SMAPListRow(title: place, subtitle: schedule.sst_location_add.flatMap { $0.isEmpty ? nil : $0 } ?? "장소",
                                    leading: { SMAPRowIcon(systemImage: "mappin.and.ellipse") })
                    }
                    if schedule.isRecurring {
                        SMAPListRow(title: schedule.repeatDescription ?? "반복 일정", subtitle: "반복",
                                    leading: { SMAPRowIcon(systemImage: "repeat") })
                    }
                    if let alarm = schedule.sst_alarm_t, !alarm.isEmpty {
                        SMAPListRow(title: alarm, subtitle: "알림", leading: { SMAPRowIcon(systemImage: "bell") })
                    }
                    if let memo = schedule.sst_memo, !memo.isEmpty {
                        HStack(alignment: .top, spacing: 12) {
                            SMAPRowIcon(systemImage: "text.alignleft")
                            Text(memo)
                                .font(SMAPTheme.Font.body)
                                .foregroundStyle(SMAPTheme.Surface.onSurface)
                                .padding(.top, 9)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.horizontal, SMAPTheme.Spacing.md)
                        .padding(.vertical, 10)
                    }
                }
            }
            if canManage {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    // 삭제는 보조 동작이라 좁게, 수정이 나머지 폭 (Android 1:2 비율과 비슷하게)
                    SMAPButton("삭제", style: .secondary, action: onDelete)
                        .frame(width: 110)
                    SMAPButton("수정", action: onEdit)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, SMAPTheme.Spacing.md)
            }
        }
        .background(SMAPTheme.Surface.card.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var dateText: String {
        guard let raw = schedule.sst_sdate, let date = scheduleDate(raw) else { return schedule.sst_sdate ?? "" }
        return Self.dayFormatter.string(from: date)
    }

    private var timeText: String? {
        if schedule.sst_all_day == "Y" { return "하루 종일" }
        switch (scheduleClock(schedule.sst_sdate), scheduleClock(schedule.sst_edate)) {
        case let (start?, end?): return "\(start) – \(end)"
        case let (start?, nil): return start
        default: return nil
        }
    }

    private func scheduleDate(_ raw: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: String(raw.prefix(10)))
    }
}

/// "2026-11-16 10:00:00" / "2026-11-16T10:00" → "10:00"
private func scheduleClock(_ raw: String?) -> String? {
    guard let raw, let range = raw.range(of: #"[T ](\d{2}):(\d{2})"#, options: .regularExpression) else { return nil }
    return String(raw[range].dropFirst())
}
