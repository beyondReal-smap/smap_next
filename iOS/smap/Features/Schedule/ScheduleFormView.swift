//
// ScheduleFormView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct ScheduleFormView: View {
    @Environment(\.smapAccent) private var accent
    @ObservedObject var viewModel: ScheduleViewModel
    let initialGroupId: Int
    var schedule: Schedule? = nil
    var editOption: String? = nil // "this", "all", "future"
    let onSave: () -> Void

    @Environment(\.presentationMode) var presentationMode

    // Form State
    @State private var selectedGroupId: Int
    @State private var members: [SmapGroupMember] = []

    @State private var title: String = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date().addingTimeInterval(3600)
    @State private var isAllDay: Bool = false
    @State private var location: String = ""
    @State private var locationAddress: String?
    @State private var locationLat: Double?
    @State private var locationLong: Double?
    @State private var showingLocationSearch: Bool = false
    @State private var memo: String = ""
    @State private var targetMemberId: Int = 0
    @State private var supplies: String = ""
    @State private var alarm: Int = 0

    // Repeat State
    @State private var repeatOption: String = "안함"
    @State private var selectedWeekdays: Set<Int> = []

    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    
    private let repeatOptions = ["안함", "매일", "매주", "매월", "매년"]
    private let weekdays = ["일", "월", "화", "수", "목", "금", "토"]

    init(viewModel: ScheduleViewModel, initialGroupId: Int, schedule: Schedule? = nil, editOption: String? = nil, onSave: @escaping () -> Void) {
        self.viewModel = viewModel
        self.initialGroupId = initialGroupId
        self.schedule = schedule
        self.editOption = editOption
        self.onSave = onSave

        let startGroupId = schedule?.sgt_idx ?? (initialGroupId > 0 ? initialGroupId : (viewModel.groups.first?.sgt_idx ?? 0))
        _selectedGroupId = State(initialValue: startGroupId)
    }


    // Alarm options
    private var alarmOptions: [(String, Int)] {
        [("없음", 0), ("정시", 1), ("5분 전", 5), ("10분 전", 10), ("15분 전", 15), ("30분 전", 30), ("1시간 전", 60), ("1일 전", 1440)]
    }

    // UX 피드백 상태
    @State private var showTitleError: Bool = false          // 저장 시도 후 제목 빈 경우만 노출
    @State private var showCancelConfirmation: Bool = false  // 변경사항 있을 때 취소 확인

    // 키보드 회피 — 포커스된 필드를 sticky footer 위로 자동 스크롤.
    private enum FormField: Hashable { case title, memo, supplies }
    @FocusState private var focusedField: FormField?

    // Draft 복구 — 신규 작성 중 실수로 닫거나 앱이 종료돼도 내용을 살려준다.
    @State private var showDraftRestoreAlert: Bool = false
    @State private var pendingDraft: ScheduleDraft?  // onAppear 에서 감지한 draft
    @State private var didSaveOrDiscard: Bool = false // 저장 성공/명시적 버리기 시 true → onDisappear 의 재저장 스킵
    private let draftUserDefaultsKey = "ScheduleFormView.draft.v1"

    // 초기값 스냅샷 — 취소 시 "진짜 변경사항이 있는지" 판단.
    @State private var initialTitleSnapshot: String = ""
    @State private var initialMemoSnapshot: String = ""
    @State private var initialStartDateSnapshot: Date = Date()
    @State private var initialEndDateSnapshot: Date = Date()
    @State private var initialLocationSnapshot: String = ""
    @State private var initialSuppliesSnapshot: String = ""
    @State private var initialRepeatOptionSnapshot: String = "안함"
    @State private var initialWeekdaysSnapshot: Set<Int> = []
    @State private var initialAlarmSnapshot: Int = 0
    @State private var initialIsAllDaySnapshot: Bool = false
    @State private var initialTargetMemberIdSnapshot: Int = 0

    @State private var membersLoaded = false
    @State private var membersError: String?
    @State private var showingGroupPicker = false

    private var isEditMode: Bool { schedule != nil }
    private var myMemberId: Int? { UserDefaults.standard.string(forKey: "mt_idx").flatMap(Int.init) }

    // 36단계 재설계 — Android CreateEditEventDialog 와 같은 구성.
    // 이전: 번호 붙은 분홍·파랑·초록·노랑 4색 구역 + 칸마다 다른 테두리, 저장 중 화면 전체를 덮는 회색 막.
    // 지금: 회색 바탕 위 "무엇 / 누구의 일정 / 언제 / 어디" 흰 묶음, 저장 버튼은 아래 고정(버튼 안에서 진행 표시).
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                            whatSection
                            whoSection
                            whenSection
                            whereSection
                        }
                        .padding(SMAPTheme.Spacing.md)
                        .padding(.bottom, SMAPTheme.Spacing.lg)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    // 포커스된 칸을 화면 가운데로 — 키보드와 아래 고정 버튼에 가리지 않게.
                    .onChange(of: focusedField) { _, newValue in
                        guard let field = newValue else { return }
                        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(field, anchor: .center) }
                    }
                }
                stickyFooter
            }
            .background(SMAPTheme.Surface.canvas.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(isEditMode ? "일정 수정" : "새 일정")
                        .font(SMAPTheme.Font.bodyBold)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("취소") {
                        if hasUnsavedChanges {
                            showCancelConfirmation = true
                        } else {
                            presentationMode.wrappedValue.dismiss()
                        }
                    }
                    .font(SMAPTheme.Font.body)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                    .accessibilityHint(hasUnsavedChanges ? "변경사항 확인 후 닫기" : "닫기")
                }
                // 키보드 위 완료 — 메모처럼 줄바꿈이 되는 칸에서도 키보드를 내릴 수 있게.
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("완료") { focusedField = nil }
                        .font(SMAPTheme.Font.bodyBold)
                        .foregroundStyle(SMAPTheme.Color.primary)
                }
            }
            // 미저장 변경이 있으면 시트 스와이프 닫기를 막아 '취소' 확인을 우회해 내용이 사라지지 않게.
            .interactiveDismissDisabled(hasUnsavedChanges)
            .confirmationDialog(
                "변경사항이 저장되지 않았습니다",
                isPresented: $showCancelConfirmation,
                titleVisibility: .visible
            ) {
                Button("변경사항 버리기", role: .destructive) {
                    clearDraft() // 명시적으로 버리기 선택 — draft 도 함께 제거
                    didSaveOrDiscard = true
                    presentationMode.wrappedValue.dismiss()
                }
                Button("계속 편집", role: .cancel) {}
            } message: {
                Text("수정 중인 내용을 버리고 닫으시겠습니까?")
            }
            .alert("이전 작성 내용이 있어요", isPresented: $showDraftRestoreAlert, presenting: pendingDraft) { draft in
                Button("불러오기") {
                    applyDraft(draft)
                    HapticManager.shared.impact(style: .light)
                    pendingDraft = nil
                }
                Button("새로 작성", role: .destructive) {
                    clearDraft()
                    pendingDraft = nil
                }
            } message: { draft in
                Text("마지막 작성: \(draft.summaryLabel)\n이어서 작성할까요?")
            }
            .onAppear {
                setupInitialValues()
                // 신규 작성 모드에서만 draft 복구 제안
                if schedule == nil, let draft = loadDraft() {
                    pendingDraft = draft
                    showDraftRestoreAlert = true
                }
            }
            .onDisappear {
                // 실수 dismiss / 앱 종료 대비 — 변경사항이 있으면 draft 저장.
                // 저장 성공 또는 명시적 버리기 경로는 이미 clearDraft() 되었고 플래그로 스킵.
                guard !didSaveOrDiscard else { return }
                saveDraftIfNeeded()
            }
            .alert("저장하지 못했어요", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) {}
                Button("다시 시도") { saveSchedule() }
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $showingGroupPicker) {
                GroupPickerSheet(groups: viewModel.groups, selectedGroupId: selectedGroupId) { group in
                    guard group.sgt_idx != selectedGroupId else { return }
                    selectedGroupId = group.sgt_idx
                    loadMembers(groupId: group.sgt_idx)
                }
            }
            .sheet(isPresented: $showingLocationSearch) {
                NavigationStack {
                    LocationSearchView { place in
                        self.location = place.place_name
                        self.locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                        if let x = Double(place.x), let y = Double(place.y) {
                            self.locationLong = x
                            self.locationLat = y
                        }
                        HapticManager.shared.notification(type: .success)
                        showingLocationSearch = false
                    }
                }
            }
        }
    }

    // 반복 표시 텍스트 — 매주+요일 선택 있으면 풀어서 표시.
    private var repeatDisplayText: String {
        if repeatOption == "매주", !selectedWeekdays.isEmpty {
            let dayList = selectedWeekdays.sorted().map { weekdays[$0] }.joined(separator: ",")
            return "매주 \(dayList)"
        }
        return repeatOption == "안함" ? "반복 안함" : repeatOption
    }

    private var alarmDisplayText: String {
        alarmOptions.first(where: { $0.1 == alarm })?.0 ?? "없음"
    }

    // MARK: 무엇

    private var whatSection: some View {
        SMAPSection(title: "무엇") {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
                FormFieldLabel(text: "제목", error: showTitleError ? "제목을 입력해 주세요" : nil) {
                    TextField("예: 병원 예약, 학원 픽업", text: $title)
                        .font(SMAPTheme.Font.body)
                        .focused($focusedField, equals: .title)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .memo }
                        .modifier(FormInputBox(focused: focusedField == .title, error: showTitleError))
                        .accessibilityLabel("일정 제목")
                }
                .id(FormField.title)
                .onChange(of: title) { _, newValue in
                    // 입력을 시작하면 경고를 내린다(저장 시도 후에만 보이는 경고).
                    if !newValue.trimmingCharacters(in: .whitespaces).isEmpty { showTitleError = false }
                }

                FormFieldLabel(text: "메모 (선택)") {
                    ZStack(alignment: .topLeading) {
                        if memo.isEmpty {
                            Text("참고할 내용")
                                .font(SMAPTheme.Font.body)
                                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted.opacity(0.7))
                                .padding(.horizontal, SMAPTheme.Spacing.md)
                                .padding(.vertical, 15)
                                .allowsHitTesting(false)
                                .accessibilityHidden(true)
                        }
                        TextEditor(text: $memo)
                            .font(SMAPTheme.Font.body)
                            .focused($focusedField, equals: .memo)
                            .scrollContentBackground(.hidden)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 7)
                            .frame(minHeight: 96)
                            .accessibilityLabel("메모")
                    }
                    .modifier(FormInputBox(focused: focusedField == .memo, error: false, padded: false))
                }
                .id(FormField.memo)

                FormFieldLabel(text: "준비물 (선택)") {
                    TextField("예: 신분증, 우산", text: $supplies)
                        .font(SMAPTheme.Font.body)
                        .focused($focusedField, equals: .supplies)
                        .submitLabel(.done)
                        .onSubmit { focusedField = nil }
                        .modifier(FormInputBox(focused: focusedField == .supplies, error: false))
                        .accessibilityLabel("준비물")
                }
                .id(FormField.supplies)
            }
            .padding(SMAPTheme.Spacing.md)
        }
    }

    // MARK: 누구의 일정

    private var whoSection: some View {
        let groupName = viewModel.groups.first(where: { $0.sgt_idx == selectedGroupId })?.sgt_title
        let canPickGroup = !isEditMode && viewModel.groups.count >= 2
        return SMAPSection(title: "누구의 일정") {
            SMAPListRow(
                title: groupName.flatMap { $0.isEmpty ? nil : $0 } ?? "그룹을 골라 주세요",
                subtitle: isEditMode ? "그룹은 바꿀 수 없어요" : "그룹",
                action: canPickGroup ? { showingGroupPicker = true } : nil,
                leading: { SMAPRowIcon(systemImage: "person.2.fill") },
                trailing: {
                    if isEditMode {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                            .accessibilityHidden(true)
                    } else if canPickGroup {
                        RowChevron()
                    }
                }
            )
            SMAPRowDivider()
            memberArea
        }
    }

    @ViewBuilder
    private var memberArea: some View {
        if let membersError {
            // 이전: 실패해도 로그만 남기고 "불러오는 중"이 계속 돌았다.
            SMAPListRow(
                title: "멤버를 불러오지 못했어요",
                subtitle: membersError,
                action: { loadMembers(groupId: selectedGroupId) },
                leading: { SMAPRowIcon(systemImage: "exclamationmark.triangle") },
                trailing: {
                    Text("다시 시도")
                        .font(SMAPTheme.Font.captionBold)
                        .foregroundStyle(accent.base)
                }
            )
        } else if !membersLoaded {
            HStack(spacing: SMAPTheme.Spacing.sm) {
                ProgressView()
                Text("멤버를 불러오는 중...")
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
        } else if isEditMode {
            // 수정 중에는 대상을 바꿀 수 없다 — 고를 수 없는 얼굴 줄 대신 대상 한 명만 보여 준다.
            let target = members.first(where: { $0.mt_idx == targetMemberId })
            SMAPListRow(
                title: target.map { $0.mt_idx == myMemberId ? "\($0.displayName) (나)" : $0.displayName } ?? "알 수 없는 멤버",
                subtitle: "일정 대상은 바꿀 수 없어요",
                leading: { SMAPAvatar(name: target?.displayName ?? "?", imagePath: target?.mt_file1) }
            )
        } else if selectableMembers.isEmpty {
            SMAPListRow(
                title: "이 그룹에서 내 정보를 찾지 못했어요",
                subtitle: "그룹 목록을 새로 고친 뒤 다시 시도해 주세요",
                leading: { SMAPRowIcon(systemImage: "person.crop.circle.badge.questionmark") }
            )
        } else {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                MemberStrip(
                    members: selectableMembers.map {
                        MemberStripItem(id: $0.mt_idx, name: $0.displayName, imagePath: $0.mt_file1, isMe: $0.mt_idx == myMemberId)
                    },
                    selectedId: targetMemberId,
                    onSelect: { targetMemberId = $0.id }
                )
                // 이전에는 고를 사람이 나 하나뿐이면 "멤버를 불러오는 중..."이 끝나지 않았다.
                // 일반 멤버라 나만 고를 수 있을 때 이유를 알려 준다(그룹에 나 혼자인 그룹장에게는 보이지 않게).
                if !isLeaderOrOwner && members.count > 1 {
                    Text("그룹장·리더는 다른 멤버의 일정도 만들 수 있어요")
                        .font(SMAPTheme.Font.captionSmall)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                        .padding(.horizontal, SMAPTheme.Spacing.md)
                }
            }
            .padding(.vertical, SMAPTheme.Spacing.md)
        }
    }

    // MARK: 언제

    private var whenSection: some View {
        SMAPSection(title: "언제") {
            FormRow(icon: "sun.max", title: "하루 종일") {
                Toggle("하루 종일", isOn: $isAllDay)
                    .labelsHidden()
                    .tint(SMAPTheme.Color.primary)
            }
            SMAPRowDivider()
            FormRow(icon: "clock", title: "시작") {
                DatePickerWith10MinInterval(
                    selection: $startDate,
                    displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute],
                    accentColor: SMAPTheme.Color.primary
                )
                .accessibilityLabel("시작 일시")
            }
            SMAPRowDivider()
            FormRow(icon: "flag", title: "종료") {
                DatePickerWith10MinInterval(
                    selection: $endDate,
                    displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute],
                    accentColor: SMAPTheme.Color.primary
                )
                .accessibilityLabel("종료 일시")
            }
            SMAPRowDivider()
            // 반복 — 행을 누르면 바로 목록(시트로 넘어가지 않게).
            Menu {
                ForEach(repeatOptions, id: \.self) { option in
                    Button {
                        repeatOption = option
                        if option != "매주" { selectedWeekdays.removeAll() }
                    } label: {
                        if repeatOption == option {
                            Label(option == "안함" ? "반복 안함" : option, systemImage: "checkmark")
                        } else {
                            Text(option == "안함" ? "반복 안함" : option)
                        }
                    }
                }
            } label: {
                FormRow(icon: "repeat", title: "반복") { MenuValue(text: repeatDisplayText) }
            }
            .accessibilityLabel("반복")
            .accessibilityValue(repeatDisplayText)
            if repeatOption == "매주" {
                weekdayPicker
                    .transition(.opacity)
            }
            SMAPRowDivider()
            Menu {
                ForEach(alarmOptions, id: \.1) { option in
                    Button {
                        alarm = option.1
                    } label: {
                        if alarm == option.1 {
                            Label(option.0, systemImage: "checkmark")
                        } else {
                            Text(option.0)
                        }
                    }
                }
            } label: {
                FormRow(icon: "bell", title: "알림") { MenuValue(text: alarmDisplayText) }
            }
            .accessibilityLabel("알림")
            .accessibilityValue(alarmDisplayText)
        }
        .animation(.easeInOut(duration: 0.15), value: repeatOption)
        .onChange(of: startDate) { _, newStartDate in
            // 시작이 종료 이후로 바뀌면 종료를 시작 + 1시간으로 맞춘다.
            if newStartDate >= endDate {
                endDate = newStartDate.addingTimeInterval(3600)
            }
        }
    }

    /// "매주"일 때 요일 고르기 — 고른 요일은 남색 채움.
    private var weekdayPicker: some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { index in
                let isSelected = selectedWeekdays.contains(index)
                Button {
                    HapticManager.shared.selection()
                    if isSelected { selectedWeekdays.remove(index) } else { selectedWeekdays.insert(index) }
                } label: {
                    Text(weekdays[index])
                        .font(isSelected ? SMAPTheme.Font.captionBold : SMAPTheme.Font.caption)
                        .foregroundStyle(isSelected ? Color.white : SMAPTheme.Surface.onSurface)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background {
                            if isSelected {
                                Circle().fill(accent.gradient).frame(width: 40, height: 40)
                            } else {
                                Circle().fill(SMAPTheme.Surface.variant).frame(width: 40, height: 40)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(weekdays[index])요일")
                .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.bottom, 12)
    }

    // MARK: 어디

    private var whereSection: some View {
        SMAPSection(title: "어디") {
            HStack(spacing: 0) {
                Button {
                    HapticManager.shared.impact(style: .light)
                    showingLocationSearch = true
                } label: {
                    HStack(spacing: 12) {
                        SMAPRowIcon(systemImage: "mappin.and.ellipse", emphasized: !location.isEmpty)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(location.isEmpty ? "장소 추가" : location)
                                .font(SMAPTheme.Font.bodyBold)
                                .foregroundStyle(SMAPTheme.Surface.onSurface)
                                .lineLimit(1)
                            Text(location.isEmpty ? "검색해서 고를 수 있어요 (선택)" : (locationAddress ?? ""))
                                .font(SMAPTheme.Font.caption)
                                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if location.isEmpty {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(.leading, SMAPTheme.Spacing.md)
                    .padding(.trailing, location.isEmpty ? SMAPTheme.Spacing.md : 0)
                    .padding(.vertical, 10)
                    .frame(minHeight: 60)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(location.isEmpty ? "장소 추가" : "장소: \(location)")
                .accessibilityHint("장소 검색 열기")

                if !location.isEmpty {
                    // 행 안의 버튼과 겹치지 않게 지우기 버튼은 행 옆에 따로 둔다.
                    Button {
                        HapticManager.shared.impact(style: .light)
                        location = ""
                        locationAddress = nil
                        locationLat = nil
                        locationLong = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                            .frame(width: 52, height: 52)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("장소 지우기")
                }
            }
        }
    }

    // MARK: 저장

    // 변경 여부 — 취소 confirmation 조건. 편집 가능한 필드 전부를 포함한다.
    private var hasUnsavedChanges: Bool {
        title != initialTitleSnapshot
            || memo != initialMemoSnapshot
            || startDate != initialStartDateSnapshot
            || endDate != initialEndDateSnapshot
            || location != initialLocationSnapshot
            || supplies != initialSuppliesSnapshot
            || repeatOption != initialRepeatOptionSnapshot
            || selectedWeekdays != initialWeekdaysSnapshot
            || alarm != initialAlarmSnapshot
            || isAllDay != initialIsAllDaySnapshot
            || targetMemberId != initialTargetMemberIdSnapshot
    }

    private var isDateValid: Bool {
        endDate > startDate
    }

    // "매주" 반복을 선택했는데 요일이 하나도 없으면 서버 포맷이 비어버리므로 저장 차단.
    private var isRepeatValid: Bool {
        repeatOption != "매주" || !selectedWeekdays.isEmpty
    }

    /// 버튼 위 안내 — 무엇을 고쳐야 저장되는지 바로 보이게(이전: 버튼만 회색으로 꺼짐).
    private var footerMessage: String? {
        if !isDateValid { return "끝나는 시각이 시작 시각보다 뒤여야 해요" }
        if !isRepeatValid { return "매주 반복할 요일을 하나 이상 골라 주세요" }
        return nil
    }

    // 아래 고정 — 스크롤과 무관하게 저장 버튼이 손 닿는 곳에 있다.
    private var stickyFooter: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            if let footerMessage {
                Label(footerMessage, systemImage: "exclamationmark.circle.fill")
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.error)
                    .padding(.leading, 4)
            }
            SMAPButton(isEditMode ? "저장" : "일정 추가", isLoading: isLoading, isDisabled: isLoading, action: saveSchedule)
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, SMAPTheme.Spacing.sm)
        .background {
            SMAPTheme.Surface.card
                .overlay(alignment: .top) { Rectangle().fill(SMAPTheme.Surface.divider).frame(height: 0.5) }
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func setupInitialValues() {
        loadMembers(groupId: selectedGroupId)

        if let schedule = schedule {
            title = schedule.sst_title ?? ""
            location = schedule.sst_location_title ?? ""
            locationAddress = schedule.sst_location_add
            locationLat = schedule.sst_location_lat
            locationLong = schedule.sst_location_long
            memo = schedule.sst_memo ?? ""
            isAllDay = schedule.sst_all_day == "Y"
            supplies = schedule.sst_supplies ?? ""
            targetMemberId = schedule.mt_idx ?? 0

            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            if let sDateStr = schedule.sst_sdate, let sDate = formatter.date(from: sDateStr) { startDate = sDate }
            if let eDateStr = schedule.sst_edate, let eDate = formatter.date(from: eDateStr) { endDate = eDate }

            // Load Alarm - from sst_alarm_t (text) or sst_alram (minutes)
            if let alarmText = schedule.sst_alarm_t, !alarmText.isEmpty {
                // Parse alarm text to minutes
                alarm = parseAlarmTextToMinutes(alarmText)
            } else if let alarmVal = schedule.sst_alram, alarmVal > 0 {
                alarm = alarmVal
            } else {
                alarm = 0
            }

            // Parse Repeat
            if let v = schedule.sst_repeat_json_v, !v.isEmpty {
                if v.contains("매주") || v.contains("1주마다") {
                    repeatOption = "매주"
                    // Parse weekdays from sst_repeat_json
                    if let jsonStr = schedule.sst_repeat_json,
                       let data = jsonStr.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                       let r2 = json["r2"], !r2.isEmpty {
                        // r2 = "1,5" means Monday(1) and Friday(5), 7 = Sunday
                        let weekdayIndices = r2.split(separator: ",").compactMap { Int($0) }
                        // Convert: 1-6 stays same, 7 becomes 0 (Sunday)
                        selectedWeekdays = Set(weekdayIndices.map { $0 == 7 ? 0 : $0 })
                    }
                } else if repeatOptions.contains(v) {
                    repeatOption = v
                }
            }
        } else {
            if let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let mtIdx = Int(mtIdxStr) {
                targetMemberId = mtIdx
            }
        }

        // 변경 여부 판단을 위한 초기 스냅샷 — 모든 편집 가능 필드 포함.
        initialTitleSnapshot = title
        initialMemoSnapshot = memo
        initialStartDateSnapshot = startDate
        initialEndDateSnapshot = endDate
        initialLocationSnapshot = location
        initialSuppliesSnapshot = supplies
        initialRepeatOptionSnapshot = repeatOption
        initialWeekdaysSnapshot = selectedWeekdays
        initialAlarmSnapshot = alarm
        initialIsAllDaySnapshot = isAllDay
        initialTargetMemberIdSnapshot = targetMemberId
    }

    // Helper function to convert alarm text to minutes
    private func parseAlarmTextToMinutes(_ text: String) -> Int {
        switch text {
        case "정시": return 1
        case "5분 전": return 5
        case "10분 전": return 10
        case "15분 전": return 15
        case "30분 전": return 30
        case "1시간 전": return 60
        case "1일 전": return 1440
        default: return 0
        }
    }

    private var isLeaderOrOwner: Bool {
        guard let me = myMemberId, let mine = members.first(where: { $0.mt_idx == me }) else { return false }
        return mine.sgdt_owner_chk == "Y" || mine.sgdt_leader_chk == "Y"
    }

    /// 대상으로 고를 수 있는 멤버 — 요청자가 그룹장·리더면 전원, 아니면 본인만
    private var selectableMembers: [SmapGroupMember] {
        guard let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let me = Int(mtIdxStr),
              let myMember = members.first(where: { $0.mt_idx == me }) else { return [] }
        if myMember.sgdt_owner_chk == "Y" || myMember.sgdt_leader_chk == "Y" { return members }
        return [myMember]
    }

    private func loadMembers(groupId: Int) {
        membersLoaded = false
        membersError = nil
        Task { @MainActor in
            do {
                let fetched = try await GroupService.shared.getGroupMembers(sgtIdx: groupId)
                // 그사이 다른 그룹을 골랐으면 늦게 온 응답은 버린다.
                guard groupId == selectedGroupId else { return }
                members = fetched
                membersLoaded = true
                // 대상이 이 그룹에 없으면(그룹을 바꾼 경우 등) 나로 — 내가 없으면 첫 멤버.
                if !fetched.contains(where: { $0.mt_idx == targetMemberId }) {
                    if let me = myMemberId, fetched.contains(where: { $0.mt_idx == me }) {
                        targetMemberId = me
                    } else {
                        targetMemberId = fetched.first?.mt_idx ?? 0
                    }
                }
            } catch {
                guard groupId == selectedGroupId else { return }
                // 이전: 로그만 남겨 "불러오는 중"이 계속 돌았다 — 화면에 알리고 다시 시도할 수 있게.
                membersError = (error as? NetworkError)?.userMessage ?? "잠시 후 다시 시도해 주세요"
            }
        }
    }

    private func saveSchedule() {
        // 유효성 검사
        // 입력 문제는 알림창 대신 해당 칸 아래·버튼 위에 보여 준다(알림창의 "다시 시도"는 네트워크 실패에만).
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else {
            showTitleError = true
            focusedField = .title
            HapticManager.shared.notification(type: .warning)
            return
        }

        guard isDateValid, isRepeatValid else {
            HapticManager.shared.notification(type: .warning)
            return
        }

        // 입력 통과 — 에러 표시 해제
        showTitleError = false
        isLoading = true

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"

        let sDateStr = formatter.string(from: startDate)
        let eDateStr = formatter.string(from: endDate)

        // Generate alarm text from minutes
        let alarmText: String? = {
            switch alarm {
            case 0: return nil
            case 1: return "정시"
            case 5: return "5분 전"
            case 10: return "10분 전"
            case 15: return "15분 전"
            case 30: return "30분 전"
            case 60: return "1시간 전"
            case 1440: return "1일 전"
            default: return nil
            }
        }()

        // Generate alarm pick type and result (matches Next.js)
        let scheduleAlarmChk: String = alarm == 0 ? "N" : "Y"
        let pickType: String? = {
            switch alarm {
            case 5, 10, 15, 30: return "minute"
            case 60: return "hour"
            case 1440: return "day"
            default: return nil
            }
        }()
        let pickResult: String? = {
            switch alarm {
            case 0, 1: return nil
            case 5: return "5"
            case 10: return "10"
            case 15: return "15"
            case 30: return "30"
            case 60: return "1"
            case 1440: return "1"
            default: return nil
            }
        }()

        // Location alarm: 4 if location is set, nil otherwise
        let locationAlarm: Int? = !location.isEmpty ? 4 : nil

        // Repeat JSON - matches Next.js format
        var repeatJson: String? = nil
        var repeatJsonV: String? = nil
        if repeatOption != "안함" {
            var r1 = "0"
            var r2 = ""
            switch repeatOption {
            case "매일": r1 = "2"  // Next.js uses 2 for daily
            case "매주": r1 = "3"  // Next.js uses 3 for weekly
            case "매월": r1 = "4"  // Next.js uses 4 for monthly
            case "매년": r1 = "5"  // Next.js uses 5 for yearly
            default: break
            }

            if repeatOption == "매주" && !selectedWeekdays.isEmpty {
                // Convert weekdays: 0 (Sunday) becomes 7, 1-6 stay same
                let sortedDays = selectedWeekdays.sorted()
                let r2Values = sortedDays.map { $0 == 0 ? "7" : String($0) }
                r2 = r2Values.joined(separator: ",")
                let dayString = sortedDays.map { weekdays[$0] }.joined(separator: ",")
                repeatJsonV = "1주마다 \(dayString)"
            } else {
                repeatJsonV = repeatOption
            }

            repeatJson = "{\"r1\":\"\(r1)\",\"r2\":\"\(r2)\"}"
        }

        // For repeat schedule updates: use "all" to update all occurrences if no option provided
        let isRepeatSchedule = schedule?.sst_repeat_json != nil && !(schedule?.sst_repeat_json?.isEmpty ?? true)
        let finalEditOption: String? = editOption ?? (isRepeatSchedule ? "all" : nil)

        Task {
            do {
                let success: Bool
                if let schedule = schedule {
                    let editorId = UserDefaults.standard.string(forKey: "mt_idx")
                    let editorName = UserDefaults.standard.string(forKey: "mt_name")

                    let request = UpdateScheduleRequest(
                        sst_idx: schedule.sst_idx,
                        groupId: selectedGroupId,
                        sst_pidx: schedule.sst_pidx,
                        sst_title: title,
                        sst_sdate: sDateStr,
                        sst_edate: eDateStr,
                        sst_all_day: isAllDay ? "Y" : "N",
                        sst_location_title: location,
                        sst_location_add: locationAddress,
                        sst_location_lat: locationLat,
                        sst_location_long: locationLong,
                        sst_memo: memo,
                        // 알림 없음도 0 으로 보낸다(Android 와 동일). nil 이면 키가 빠지고, 서버가 빈 값을 'N' 으로 채워
                        // 숫자 칸(sst_alram)에 넣으려다 DB 오류(500) — "알림 없음" 일정이 저장되지 않았다.
                        sst_alram: alarm,
                        sst_alarm_t: alarmText,
                        sst_schedule_alarm_chk: scheduleAlarmChk,
                        sst_pick_type: pickType,
                        sst_pick_result: pickResult,
                        sst_location_alarm: locationAlarm,
                        sst_supplies: supplies,
                        sst_repeat_json: repeatJson,
                        sst_repeat_json_v: repeatJsonV,
                        editOption: finalEditOption,
                        editorId: editorId,
                        editorName: editorName
                    )
                    success = try await ScheduleService.shared.updateSchedule(request)
                } else {
                    let request = CreateScheduleRequest(
                        groupId: selectedGroupId,
                        targetMemberId: targetMemberId,
                        sst_title: title,
                        sst_sdate: sDateStr,
                        sst_edate: eDateStr,
                        sst_all_day: isAllDay ? "Y" : "N",
                        sst_location_title: location,
                        sst_location_add: locationAddress,
                        sst_location_lat: locationLat,
                        sst_location_long: locationLong,
                        sst_memo: memo,
                        // 알림 없음도 0 으로 보낸다(Android 와 동일). nil 이면 키가 빠지고, 서버가 빈 값을 'N' 으로 채워
                        // 숫자 칸(sst_alram)에 넣으려다 DB 오류(500) — "알림 없음" 일정이 저장되지 않았다.
                        sst_alram: alarm,
                        sst_alarm_t: alarmText,
                        sst_schedule_alarm_chk: scheduleAlarmChk,
                        sst_pick_type: pickType,
                        sst_pick_result: pickResult,
                        sst_location_alarm: locationAlarm,
                        sst_supplies: supplies,
                        sst_repeat_json: repeatJson,
                        sst_repeat_json_v: repeatJsonV
                    )
                    success = try await ScheduleService.shared.createSchedule(request)
                }

                DispatchQueue.main.async {
                    if success {
                        // 홈 화면 일정 데이터 새로고침을 위한 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("scheduleDataChanged"), object: nil)
                        print("📢 [ScheduleFormView] Posted scheduleDataChanged notification")

                        // 저장 성공 피드백 — "정말 저장됐나?" 불안감 해소
                        HapticManager.shared.notification(type: .success)
                        clearDraft() // 저장 성공 → draft 제거 (onDisappear 에서 재저장되지 않도록)
                        didSaveOrDiscard = true
                        onSave()
                        presentationMode.wrappedValue.dismiss()
                    } else {
                        HapticManager.shared.notification(type: .error)
                        errorMessage = "저장에 실패했습니다."
                    }
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    HapticManager.shared.notification(type: .error)
                    errorMessage = (error as? NetworkError)?.userMessage ?? error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    // MARK: - Draft Persistence (신규 작성 한정)

    /// 현재 폼 상태를 UserDefaults draft 로 저장.
    /// - 편집 모드(schedule != nil) 에서는 저장하지 않음 (원본과 충돌 방지).
    /// - `hasUnsavedChanges == false` 이면 호출 의미 없음.
    private func saveDraftIfNeeded() {
        guard schedule == nil, hasUnsavedChanges else { return }
        let draft = ScheduleDraft(
            title: title,
            memo: memo,
            startDate: startDate,
            endDate: endDate,
            isAllDay: isAllDay,
            location: location,
            locationAddress: locationAddress,
            locationLat: locationLat,
            locationLong: locationLong,
            supplies: supplies,
            repeatOption: repeatOption,
            selectedWeekdays: Array(selectedWeekdays),
            alarm: alarm,
            targetMemberId: targetMemberId,
            selectedGroupId: selectedGroupId,
            savedAt: Date()
        )
        if let data = try? JSONEncoder().encode(draft) {
            UserDefaults.standard.set(data, forKey: draftUserDefaultsKey)
        }
    }

    /// 저장된 draft 를 로드. 없거나 파싱 실패 시 nil.
    private func loadDraft() -> ScheduleDraft? {
        guard schedule == nil,
              let data = UserDefaults.standard.data(forKey: draftUserDefaultsKey),
              let draft = try? JSONDecoder().decode(ScheduleDraft.self, from: data) else {
            return nil
        }
        // 24시간 넘은 draft 는 노이즈 — 자동 폐기.
        if Date().timeIntervalSince(draft.savedAt) > 60 * 60 * 24 {
            clearDraft()
            return nil
        }
        return draft
    }

    /// draft 를 폼 상태로 복원.
    private func applyDraft(_ draft: ScheduleDraft) {
        title = draft.title
        memo = draft.memo
        startDate = draft.startDate
        endDate = draft.endDate
        isAllDay = draft.isAllDay
        location = draft.location
        locationAddress = draft.locationAddress
        locationLat = draft.locationLat
        locationLong = draft.locationLong
        supplies = draft.supplies
        repeatOption = draft.repeatOption
        selectedWeekdays = Set(draft.selectedWeekdays)
        alarm = draft.alarm
        targetMemberId = draft.targetMemberId
        if draft.selectedGroupId > 0 {
            selectedGroupId = draft.selectedGroupId
            loadMembers(groupId: draft.selectedGroupId)
        }
    }

    /// draft 제거.
    private func clearDraft() {
        UserDefaults.standard.removeObject(forKey: draftUserDefaultsKey)
    }
}

// 신규 일정 작성 draft. 편집 모드에서는 사용하지 않음.
private struct ScheduleDraft: Codable {
    var title: String
    var memo: String
    var startDate: Date
    var endDate: Date
    var isAllDay: Bool
    var location: String
    var locationAddress: String?
    var locationLat: Double?
    var locationLong: Double?
    var supplies: String
    var repeatOption: String
    var selectedWeekdays: [Int]
    var alarm: Int
    var targetMemberId: Int
    var selectedGroupId: Int
    var savedAt: Date

    /// 복구 제안 Alert 에 쓰일 요약 — 제목이 있으면 그걸, 없으면 날짜/시간으로.
    var summaryLabel: String {
        if !title.trimmingCharacters(in: .whitespaces).isEmpty {
            return title
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 HH:mm"
        return formatter.string(from: startDate)
    }
}

// MARK: - 작성 화면 전용 작은 뷰

/// 라벨 + 입력 + 오류 문구(SMAPTextField 와 같은 규격). 포커스·스크롤을 화면이 관리해야 해서 입력 자체는 밖에서 넣는다.
private struct FormFieldLabel<Field: View>: View {
    let text: String
    var error: String? = nil
    @ViewBuilder var field: () -> Field

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Text(text)
                .font(SMAPTheme.Font.captionMedium)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
            field()
            if let error {
                Text(error)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Color.error)
            }
        }
    }
}

/// SMAPTextField 와 같은 입력 상자 — 옅은 회색 바탕, 포커스면 남색 테두리, 오류면 빨강 테두리.
private struct FormInputBox: ViewModifier {
    let focused: Bool
    let error: Bool
    var padded: Bool = true

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, padded ? SMAPTheme.Spacing.md : 0)
            .frame(minHeight: 52)
            .background(SMAPTheme.Color.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
            .overlay {
                RoundedRectangle(cornerRadius: SMAPTheme.Radius.md)
                    .stroke(error ? SMAPTheme.Color.error : (focused ? SMAPTheme.Color.primary : .clear), lineWidth: 1)
            }
    }
}

/// 아이콘 · 제목 · 오른쪽 조작(스위치·날짜 선택)이 있는 행. SMAPListRow 는 행 전체를 한 요소로 묶어
/// 오른쪽 조작이 VoiceOver 에서 닿지 않으므로, 같은 모양으로 따로 둔다.
private struct FormRow<Trailing: View>: View {
    let icon: String
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 12) {
            SMAPRowIcon(systemImage: icon)
            Text(title)
                .font(SMAPTheme.Font.bodyBold)
                .foregroundStyle(SMAPTheme.Surface.onSurface)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, 10)
        .frame(minHeight: 60)
        .contentShape(Rectangle())
    }
}

/// 목록에서 고르는 값(반복·알림) — 값 + 위아래 화살표.
private struct MenuValue: View {
    let text: String

    var body: some View {
        HStack(spacing: 4) {
            Text(text)
                .font(SMAPTheme.Font.body)
                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                .lineLimit(1)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
        }
    }
}
