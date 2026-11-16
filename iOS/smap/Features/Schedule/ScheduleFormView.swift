//
// ScheduleFormView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct ScheduleFormView: View {
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

    // Section colors — SMAPTheme.ScheduleSection 토큰을 뷰 내부 이름에 매핑.
    // 내부 뷰 구성 코드 가독성을 위해 섹션 번호로 접근하고, 실제 값은 디자인 시스템에 단일화.
    private var section1BgColor: Color { SMAPTheme.ScheduleSection.bgGroup }
    private var section2BgColor: Color { SMAPTheme.ScheduleSection.bgContent }
    private var section3BgColor: Color { SMAPTheme.ScheduleSection.bgDateTime }
    private var section4BgColor: Color { SMAPTheme.ScheduleSection.bgExtra }

    private var section1BadgeColor: Color { SMAPTheme.ScheduleSection.badgeGroup }
    private var section2BadgeColor: Color { SMAPTheme.ScheduleSection.badgeContent }
    private var section3BadgeColor: Color { SMAPTheme.ScheduleSection.badgeDateTime }
    private var section4BadgeColor: Color { SMAPTheme.ScheduleSection.badgeExtra }

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

    var body: some View {
        NavigationStack {
            ZStack {
                SMAPTheme.Adaptive.pageBackground.ignoresSafeArea()

                // ScrollView + Sticky Footer 구조
                // 폼이 길어도 저장/취소 CTA 가 항상 손가락이 닿는 바닥에 상주.
                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 16) {
                                // Section 1: 그룹 및 멤버 선택
                                modernSection1

                                // Section 2: 일정 제목 및 내용
                                modernSection2
                                    .id(FormField.title) // 포커스 시 scrollTo 대상

                                // Section 3: 날짜 및 시간
                                modernSection3

                                // Section 4: 추가 설정
                                modernSection4
                                    .id(FormField.supplies)
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 16)
                            .padding(.bottom, 24) // footer 영역 여유
                        }
                        // 포커스 변경 시 해당 섹션을 상단으로 스크롤해 키보드 가림 방지.
                        .onChange(of: focusedField) { _, newValue in
                            guard let field = newValue else { return }
                            let anchor: FormField = (field == .memo) ? .title : field
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(anchor, anchor: .top)
                            }
                        }
                    }

                    // Sticky footer — 저장 버튼을 하단에 고정
                    stickyFooter
                }

                if isLoading {
                    ZStack {
                        Color.black.opacity(0.2).ignoresSafeArea()
                        VStack(spacing: 12) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: SMAPTheme.Color.primary))
                                .scaleEffect(1.2)
                            Text("저장 중...")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .padding(24)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.1), radius: 10)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(schedule == nil ? "일정 추가" : "일정 수정")
                        .font(.suite(size: 17, weight: .semibold))
                }
                // 키보드 상단 완료 버튼 — 다음 필드가 없을 때 손쉽게 키보드 내릴 수 있도록.
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("완료") { focusedField = nil }
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(SMAPTheme.Color.primary)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            // 미저장 변경이 있으면 시트 스와이프 dismiss 를 막아, '취소' 버튼의 확인 가드를
            // 우회한 채 작성 내용이 유실되는 것을 방지한다(GroupDetail 등 기존 모범 패턴과 일관).
            .interactiveDismissDisabled(hasUnsavedChanges)
            .navigationBarItems(
                leading: Button("취소") {
                    if hasUnsavedChanges {
                        showCancelConfirmation = true
                    } else {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                .font(.suite(size: 16))
                .foregroundColor(.gray)
                .accessibilityHint(hasUnsavedChanges ? "변경사항 확인 후 닫기" : "닫기")
            )
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
            .alert("오류", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) {}
                Button("다시 시도") { saveSchedule() }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    // 반복 표시 텍스트 — Menu 라벨에 표시. 매주+요일 선택 있으면 풀어서 표시.
    private var repeatDisplayText: String {
        if repeatOption == "매주", !selectedWeekdays.isEmpty {
            let dayList = selectedWeekdays.sorted().map { weekdays[$0] }.joined(separator: ",")
            return "매주 \(dayList)"
        }
        return repeatOption
    }

    // MARK: - Section 1: 그룹 및 멤버 선택
    private var modernSection1: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section1BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("1")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("그룹 및 멤버 선택")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }

            // Group Picker — 편집 모드에서는 수정 불가. "수정 불가" 라벨과 lock 아이콘으로 의도 명시.
            if !viewModel.groups.isEmpty {
                let isEditMode = schedule != nil

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Text("그룹")
                            .font(.suite(size: 14, weight: .medium))
                            .foregroundColor(.gray)
                        if isEditMode {
                            HStack(spacing: 2) {
                                Image(systemName: "lock.fill")
                                    .font(.suite(size: 10, weight: .semibold))
                                Text("수정 불가")
                                    .font(.suite(size: 11, weight: .medium))
                            }
                            .foregroundColor(.gray)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.gray.opacity(0.12))
                            .clipShape(Capsule())
                        }
                    }

                    Menu {
                        ForEach(viewModel.groups, id: \.sgt_idx) { group in
                            Button(action: {
                                selectedGroupId = group.sgt_idx
                                loadMembers(groupId: group.sgt_idx)
                            }) {
                                HStack {
                                    Text(group.sgt_title ?? "알 수 없는 그룹")
                                    if selectedGroupId == group.sgt_idx {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Text(viewModel.groups.first(where: { $0.sgt_idx == selectedGroupId })?.sgt_title ?? "그룹 선택")
                                .font(.suite(size: 15))
                                .foregroundColor(isEditMode ? .secondary : .primary)
                            Spacer()
                            Image(systemName: isEditMode ? "lock.fill" : "chevron.down")
                                .font(.suite(size: 13))
                                .foregroundColor(.gray)
                        }
                        .padding(14)
                        .background(isEditMode ? Color.gray.opacity(0.08) : Color.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                    }
                    .disabled(isEditMode)
                    .accessibilityLabel("그룹 선택")
                    .accessibilityHint(isEditMode ? "편집 중에는 그룹을 바꿀 수 없습니다" : "그룹 선택")
                }
            }

            // Member Selection (Avatar Grid) — 타인 대상 선택은 그룹장·리더에게만 보인다 (서버: 본인 일정은 누구나, 타인 일정은 그룹장·리더만)
            if selectableMembers.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("대상 멤버")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(selectableMembers) { member in
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        targetMemberId = member.mt_idx
                                    }
                                }) {
                                    VStack(spacing: 6) {
                                        // Avatar and Selection indicator
                                        ZStack {
                                            if let photoUrl = member.mt_file1, !photoUrl.isEmpty {
                                                AsyncImage(url: URL(string: photoUrl.hasPrefix("http") ? photoUrl : "https://nextstep.aiagnt.kr\(photoUrl)")) { phase in
                                                    if let image = phase.image {
                                                        image.resizable().aspectRatio(contentMode: .fill)
                                                    } else {
                                                        Image(systemName: "person.circle.fill")
                                                            .resizable()
                                                            .foregroundColor(.gray.opacity(0.3))
                                                    }
                                                }
                                                .frame(width: 48, height: 48)
                                                .clipShape(Circle())
                                            } else {
                                                Image(systemName: "person.circle.fill")
                                                    .resizable()
                                                    .frame(width: 48, height: 48)
                                                    .foregroundColor(.gray.opacity(0.3))
                                            }

                                            if targetMemberId == member.mt_idx {
                                                Circle()
                                                    .stroke(section1BadgeColor, lineWidth: 3)
                                                    .frame(width: 54, height: 54)

                                                Image(systemName: "checkmark.circle.fill")
                                                    .font(.suite(size: 16))
                                                    .foregroundColor(section1BadgeColor)
                                                    .background(Color.white.clipShape(Circle()))
                                                    .offset(x: 18, y: 18)
                                            }
                                        }
                                        .frame(width: 60, height: 60)

                                        Text(member.displayName)
                                            .font(.suite(size: 12))
                                            .foregroundColor(targetMemberId == member.mt_idx ? section1BadgeColor : .gray)
                                            .lineLimit(1)
                                    }
                                    .opacity(schedule != nil ? (targetMemberId == member.mt_idx ? 1.0 : 0.5) : 1.0)
                                }
                                .disabled(schedule != nil)
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.leading, 4) // Prevent first member clipping
                        .padding(.vertical, 4)
                    }
                }
            } else {
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .gray))
                    Text("멤버를 불러오는 중...")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .padding()
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(section1BgColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(SMAPTheme.ScheduleSection.strokeGroup, lineWidth: 1)
        )
    }

    // MARK: - Section 2: 일정 제목 및 내용
    private var modernSection2: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section2BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("2")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("일정 제목 및 내용")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }

            // Title Input
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 2) {
                    Text("일정 제목")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    Text("*")
                        .foregroundColor(SMAPTheme.Color.error)
                        .accessibilityLabel("필수")
                }

                TextField("일정 제목을 입력하세요", text: $title)
                    .font(.suite(size: 15))
                    .focused($focusedField, equals: .title)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .memo }
                    .padding(.horizontal, 14)
                    .frame(height: 52) // 고정 높이
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                showTitleError ? SMAPTheme.Color.error.opacity(0.6) : Color.gray.opacity(0.3),
                                lineWidth: showTitleError ? 1.5 : 1
                            )
                    )
                    .accessibilityLabel("일정 제목")
                    .accessibilityValue(title.isEmpty ? "비어 있음" : title)

                // 실시간 검증 피드백 — 저장 시도 후 비어있을 때만 경고 노출 (과도한 경고 방지)
                if showTitleError {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.suite(size: 12, weight: .semibold))
                        Text("필수 입력 항목입니다")
                            .font(.suite(size: 12, weight: .medium))
                        Spacer()
                    }
                    .foregroundColor(SMAPTheme.Color.error)
                    .padding(.horizontal, 4)
                    .accessibilityElement(children: .combine)
                } else {
                    HStack {
                        Text("예) 팀 회의, 프로젝트 미팅 등")
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                        Spacer()
                        Text("\(title.count)/100")
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                            .monospacedDigit()
                    }
                }
            }

            // Memo Input
            VStack(alignment: .leading, spacing: 6) {
                Text("일정 내용 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)

                TextEditor(text: $memo)
                    .font(.suite(size: 15))
                    .focused($focusedField, equals: .memo)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(height: 100) // 고정 높이 (멀티라인)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                    .accessibilityLabel("일정 내용")

                HStack {
                    Text("예) 회의 안건, 준비물, 참고사항 등")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                    Spacer()
                    Text("\(memo.count)/500")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(section2BgColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(SMAPTheme.ScheduleSection.strokeContent, lineWidth: 1)
        )
    }

    // MARK: - Section 3: 날짜 및 시간
    private var modernSection3: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section3BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("3")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("날짜 및 시간")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }

            // All Day Toggle
            HStack {
                Text("하루 종일")
                    .font(.suite(size: 15))
                    .foregroundColor(.primary)
                Spacer()
                Toggle("", isOn: $isAllDay)
                    .labelsHidden()
                    .tint(section3BadgeColor)
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)

            // Date/Time Info Card
            VStack(spacing: 12) {
                // Start
                HStack {
                    Text("시작")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(width: 50, alignment: .leading)

                    DatePickerWith10MinInterval(
                        selection: $startDate,
                        displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute],
                        accentColor: section3BadgeColor
                    )
                    .frame(height: 35)
                }
                .frame(minHeight: 40)

                Divider()

                // End
                HStack {
                    Text("종료")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(width: 50, alignment: .leading)

                    DatePickerWith10MinInterval(
                        selection: $endDate,
                        displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute],
                        accentColor: section3BadgeColor
                    )
                    .frame(height: 35)
                }
                .frame(minHeight: 40)
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)

            // Repeat & Alarm Row — Sheet 대신 Menu 로 즉시 선택. 컨텍스트 전환 최소화.
            HStack(spacing: 12) {
                // Repeat Menu
                VStack(alignment: .leading, spacing: 6) {
                    Text("반복")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    Menu {
                        ForEach(repeatOptions, id: \.self) { option in
                            Button(action: {
                                repeatOption = option
                                if option != "매주" {
                                    selectedWeekdays.removeAll()
                                }
                            }) {
                                HStack {
                                    Text(option)
                                    if repeatOption == option {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Text(repeatDisplayText)
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        .padding(12)
                        .background(Color.white)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                    }
                    .accessibilityLabel("반복 설정")
                    .accessibilityValue(repeatDisplayText)
                }
                .frame(maxWidth: .infinity)

                // Alarm Menu
                VStack(alignment: .leading, spacing: 6) {
                    Text("알림")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    Menu {
                        ForEach(alarmOptions, id: \.1) { option in
                            Button(action: { alarm = option.1 }) {
                                HStack {
                                    Text(option.0)
                                    if alarm == option.1 {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Text(alarmOptions.first(where: { $0.1 == alarm })?.0 ?? "없음")
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        .padding(12)
                        .background(Color.white)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                    }
                    .accessibilityLabel("알림 설정")
                    .accessibilityValue(alarmOptions.first(where: { $0.1 == alarm })?.0 ?? "없음")
                }
                .frame(maxWidth: .infinity)
            }

            // "매주" 선택 시에만 요일 버튼 inline 노출 — Sheet 없이 그 자리에서 바로 선택.
            if repeatOption == "매주" {
                VStack(alignment: .leading, spacing: 8) {
                    Text("반복 요일")
                        .font(.suite(size: 13, weight: .medium))
                        .foregroundColor(.gray)

                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { index in
                            let isSelected = selectedWeekdays.contains(index)
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.15)) {
                                    if isSelected {
                                        selectedWeekdays.remove(index)
                                    } else {
                                        selectedWeekdays.insert(index)
                                    }
                                }
                            }) {
                                Text(weekdays[index])
                                    .font(.suite(size: 13, weight: isSelected ? .bold : .medium))
                                    .foregroundColor(isSelected ? .white : .primary)
                                    .frame(maxWidth: .infinity, minHeight: 36)
                                    .background(
                                        isSelected ? section3BadgeColor : Color.white
                                    )
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(
                                                isSelected ? Color.clear : Color.gray.opacity(0.3),
                                                lineWidth: 1
                                            )
                                    )
                            }
                            .accessibilityLabel("\(weekdays[index])요일")
                            .accessibilityValue(isSelected ? "선택됨" : "선택 안됨")
                            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(section3BgColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(SMAPTheme.ScheduleSection.strokeDateTime, lineWidth: 1)
        )
        .onChange(of: startDate) { _, newStartDate in
            // 시작일시가 종료일시 이후로 변경되면 종료일시를 시작일시 + 1시간으로 자동 조정
            if newStartDate >= endDate {
                endDate = newStartDate.addingTimeInterval(3600) // 1시간 후
            }
        }
    }

    // MARK: - Section 4: 추가 설정
    private var modernSection4: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section4BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("4")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("추가 설정")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }

            // Location — 장소 검색 버튼은 선택 상태를 명확히 보여주고, 선택 후 자동 dismiss + Haptic.
            VStack(alignment: .leading, spacing: 6) {
                Text("장소 정보 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)

                Button(action: {
                    HapticManager.shared.impact(style: .light)
                    showingLocationSearch = true
                }) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            // 선택 전: 아웃라인 핀, 보조 tint / 선택 후: 채워진 핀, 섹션 accent 색
                            Image(systemName: location.isEmpty ? "mappin.and.ellipse" : "mappin.circle.fill")
                                .foregroundColor(location.isEmpty ? Color.gray : section4BadgeColor)
                                .font(.suite(size: 16, weight: .semibold))
                            Text(location.isEmpty ? "장소를 검색하세요" : location)
                                .font(.suite(size: 14, weight: location.isEmpty ? .regular : .semibold))
                                .foregroundColor(location.isEmpty ? .gray : .primary)
                                .lineLimit(1)
                            Spacer()
                            if !location.isEmpty {
                                // 선택 완료 배지 — "방금 선택한 게 반영됐나?" 불안 해소
                                Text("선택됨")
                                    .font(.suite(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(section4BadgeColor)
                                    .clipShape(Capsule())
                                Image(systemName: "chevron.right")
                                    .font(.suite(size: 12, weight: .semibold))
                                    .foregroundColor(.gray)
                            } else {
                                Image(systemName: "magnifyingglass")
                                    .foregroundColor(.gray)
                            }
                        }

                        if let addr = locationAddress, !addr.isEmpty {
                            Text(addr)
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                        }
                    }
                    .padding(12)
                    .frame(minHeight: 48)
                    .background(location.isEmpty ? Color.white : section4BadgeColor.opacity(0.06))
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(
                                location.isEmpty ? Color.gray.opacity(0.3) : section4BadgeColor.opacity(0.3),
                                lineWidth: 1
                            )
                    )
                }
                .accessibilityLabel(location.isEmpty ? "장소 검색" : "선택된 장소: \(location)")
                .accessibilityHint(location.isEmpty ? "장소 검색 시트 열기" : "다른 장소로 변경하려면 탭")

                if !location.isEmpty {
                    // 빠르게 장소를 비우는 보조 액션
                    Button {
                        HapticManager.shared.impact(style: .light)
                        withAnimation(.easeOut(duration: 0.2)) {
                            location = ""
                            locationAddress = nil
                            locationLat = nil
                            locationLong = nil
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.suite(size: 12))
                            Text("장소 지우기")
                                .font(.suite(size: 12, weight: .medium))
                        }
                        .foregroundColor(.gray)
                        .padding(.horizontal, 8)
                        .frame(minHeight: 30)
                    }
                    .accessibilityLabel("선택된 장소 지우기")
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
                        // 선택 성공 피드백 + sheet 명시적 dismiss로 체감 응답성 향상.
                        HapticManager.shared.notification(type: .success)
                        showingLocationSearch = false
                    }
                }
            }

            // Supplies
            VStack(alignment: .leading, spacing: 6) {
                Text("준비물 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)

                TextField("준비물을 입력하세요", text: $supplies)
                    .font(.suite(size: 14))
                    .focused($focusedField, equals: .supplies)
                    .submitLabel(.done)
                    .onSubmit { focusedField = nil }
                    .padding(.horizontal, 12)
                    .frame(height: 48) // 고정 높이
                    .background(Color.white)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                    .accessibilityLabel("준비물")
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(section4BgColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(SMAPTheme.ScheduleSection.strokeExtra, lineWidth: 1)
        )
    }

    // MARK: - Save Button

    /// 시작일시와 종료일시 유효성 검사
    // 변경 여부 — 취소 confirmation 조건.
    // 사용자가 실질적으로 손댄 적 있는 필드 전부를 포함해야 "변경사항 버리기" 경고가 의미 있음.
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

    /// 저장 버튼 활성화 조건
    // "매주" 반복을 선택했는데 요일이 하나도 없으면 서버 포맷이 비어버리므로 저장 차단.
    private var isRepeatValid: Bool {
        repeatOption != "매주" || !selectedWeekdays.isEmpty
    }

    private var canSave: Bool {
        !title.isEmpty && isDateValid && isRepeatValid && !isLoading
    }

    // 화면 하단 고정 footer. 스크롤 여부와 무관하게 항상 저장 CTA 가 도달 가능한 거리에 있도록.
    private var stickyFooter: some View {
        VStack(spacing: 0) {
            // 배경 위로 얇은 divider — 콘텐츠와 경계 구분
            Divider()
                .background(Color.black.opacity(0.05))

            saveButton
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 8)
        }
        .background(
            SMAPTheme.Adaptive.pageBackground
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var saveButton: some View {
        VStack(spacing: 8) {
            // 날짜 유효성 오류 메시지
            if !isDateValid {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(SMAPTheme.Color.warning)
                        .font(.suite(size: 14))
                    Text("종료 일시는 시작 일시보다 이후여야 합니다.")
                        .font(.suite(size: 13))
                        .foregroundColor(SMAPTheme.Color.warning)
                    Spacer()
                }
                .padding(.horizontal, 4)
                .accessibilityElement(children: .combine)
            }

            // 반복 유효성 — 매주 선택했는데 요일 0개일 때 가이드
            if !isRepeatValid {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(SMAPTheme.Color.warning)
                        .font(.suite(size: 14))
                    Text("매주 반복할 요일을 1개 이상 선택하세요.")
                        .font(.suite(size: 13))
                        .foregroundColor(SMAPTheme.Color.warning)
                    Spacer()
                }
                .padding(.horizontal, 4)
                .accessibilityElement(children: .combine)
            }

            Button(action: saveSchedule) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text(schedule == nil ? "일정 추가" : "일정 수정")
                            .font(.suite(size: 16, weight: .bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: canSave ? [SMAPTheme.Color.primary, Color(red: 0, green: 26/255, blue: 138/255)] : [Color.gray.opacity(0.5), Color.gray.opacity(0.3)]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundColor(.white)
                .cornerRadius(14)
                .shadow(color: canSave ? SMAPTheme.Color.primary.opacity(0.3) : Color.clear, radius: 8, x: 0, y: 4)
            }
            .disabled(!canSave)
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

    /// 대상으로 고를 수 있는 멤버 — 요청자가 그룹장·리더면 전원, 아니면 본인만
    private var selectableMembers: [SmapGroupMember] {
        guard let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let me = Int(mtIdxStr),
              let myMember = members.first(where: { $0.mt_idx == me }) else { return [] }
        if myMember.sgdt_owner_chk == "Y" || myMember.sgdt_leader_chk == "Y" { return members }
        return [myMember]
    }

    private func loadMembers(groupId: Int) {
        Task {
            do {
                let fetched = try await GroupService.shared.getGroupMembers(sgtIdx: groupId)
                DispatchQueue.main.async {
                    self.members = fetched
                    // Select member
                    if !fetched.contains(where: { $0.mt_idx == targetMemberId }) {
                        if let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let mtIdx = Int(mtIdxStr), fetched.contains(where: { $0.mt_idx == mtIdx }) {
                            targetMemberId = mtIdx
                        } else {
                            targetMemberId = fetched.first?.mt_idx ?? 0
                        }
                    }
                }
            } catch {
                print("Error loading members: \(error)")
            }
        }
    }

    private func saveSchedule() {
        // 유효성 검사
        guard !title.isEmpty else {
            showTitleError = true
            HapticManager.shared.notification(type: .warning)
            errorMessage = "일정 제목을 입력해주세요."
            return
        }

        guard endDate > startDate else {
            HapticManager.shared.notification(type: .warning)
            errorMessage = "종료 일시는 시작 일시보다 이후여야 합니다."
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
                    errorMessage = error.localizedDescription
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
