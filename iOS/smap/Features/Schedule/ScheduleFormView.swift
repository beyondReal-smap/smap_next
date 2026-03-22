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

    // Section colors (matching Next.js design)
    private var section1BgColor: Color { Color(red: 254/255, green: 226/255, blue: 226/255) } // Red 50
    private var section2BgColor: Color { Color(red: 219/255, green: 234/255, blue: 254/255) } // Blue 50
    private var section3BgColor: Color { Color(red: 220/255, green: 252/255, blue: 231/255) } // Green 50
    private var section4BgColor: Color { Color(red: 255/255, green: 251/255, blue: 235/255) } // Amber 50

    private var section1BadgeColor: Color { Color(red: 220/255, green: 38/255, blue: 38/255) }  // Red 600
    private var section2BadgeColor: Color { Color(red: 37/255, green: 99/255, blue: 235/255) }  // Blue 600
    private var section3BadgeColor: Color { Color(red: 22/255, green: 163/255, blue: 74/255) }  // Green 600
    private var section4BadgeColor: Color { Color(red: 217/255, green: 119/255, blue: 6/255) }  // Amber 600

    // Alarm options
    private var alarmOptions: [(String, Int)] {
        [("없음", 0), ("정시", 1), ("5분 전", 5), ("10분 전", 10), ("15분 전", 15), ("30분 전", 30), ("1시간 전", 60), ("1일 전", 1440)]
    }

    @State private var showingAlarmSheet: Bool = false
    @State private var showingRepeatSheet: Bool = false
    @State private var showingDateTimeSheet: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Section 1: 그룹 및 멤버 선택
                        modernSection1

                        // Section 2: 일정 제목 및 내용
                        modernSection2

                        // Section 3: 날짜 및 시간
                        modernSection3

                        // Section 4: 추가 설정
                        modernSection4

                        // 저장 버튼
                        saveButton
                            .padding(.top, 8)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
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
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("취소") {
                    presentationMode.wrappedValue.dismiss()
                }
                .font(.suite(size: 16))
                .foregroundColor(.gray)
            )
            .onAppear(perform: setupInitialValues)
            .alert("오류", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $showingAlarmSheet) {
                alarmSelectionSheet
            }
            .sheet(isPresented: $showingRepeatSheet) {
                repeatSelectionSheet
            }
        }
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

            // Group Picker
            if !viewModel.groups.isEmpty {
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
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                    }
                    .padding(14)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                    .opacity(schedule != nil ? 0.6 : 1.0)
                }
                .disabled(schedule != nil)
            }

            // Member Selection (Avatar Grid)
            if !members.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("대상 멤버")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(members) { member in
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        targetMemberId = member.mt_idx
                                    }
                                }) {
                                    VStack(spacing: 6) {
                                        // Avatar and Selection indicator
                                        ZStack {
                                            if let photoUrl = member.mt_file1, !photoUrl.isEmpty {
                                                AsyncImage(url: URL(string: photoUrl.hasPrefix("http") ? photoUrl : "https://nextstep.smap.site\(photoUrl)")) { phase in
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
        .background(section1BgColor)
        .cornerRadius(16)
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
                HStack {
                    Text("일정 제목")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    Text("*")
                        .foregroundColor(.red)
                }

                TextField("일정 제목을 입력하세요", text: $title)
                    .font(.suite(size: 15))
                    .padding(.horizontal, 14)
                    .frame(height: 52) // 고정 높이
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(title.isEmpty ? Color.red.opacity(0.3) : Color.gray.opacity(0.3), lineWidth: 1)
                    )

                HStack {
                    Text("예) 팀 회의, 프로젝트 미팅 등")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                    Spacer()
                    Text("\(title.count)/100")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
            }

            // Memo Input
            VStack(alignment: .leading, spacing: 6) {
                Text("일정 내용 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)

                TextEditor(text: $memo)
                    .font(.suite(size: 15))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(height: 100) // 고정 높이 (멀티라인)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )

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
        .background(section2BgColor)
        .cornerRadius(16)
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

                    if isAllDay {
                        DatePicker("", selection: $startDate, displayedComponents: [.date])
                            .labelsHidden()
                            .datePickerStyle(CompactDatePickerStyle())
                            .accentColor(section3BadgeColor)
                    } else {
                        DatePickerWith10MinInterval(
                            selection: $startDate,
                            displayedComponents: [.date, .hourAndMinute],
                            accentColor: section3BadgeColor
                        )
                        .frame(height: 35)
                    }
                }
                .frame(minHeight: 40)

                Divider()

                // End
                HStack {
                    Text("종료")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(width: 50, alignment: .leading)

                    if isAllDay {
                        DatePicker("", selection: $endDate, displayedComponents: [.date])
                            .labelsHidden()
                            .datePickerStyle(CompactDatePickerStyle())
                            .accentColor(section3BadgeColor)
                    } else {
                        DatePickerWith10MinInterval(
                            selection: $endDate,
                            displayedComponents: [.date, .hourAndMinute],
                            accentColor: section3BadgeColor
                        )
                        .frame(height: 35)
                    }
                }
                .frame(minHeight: 40)
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)

            // Repeat & Alarm Row (moved from section 4)
            HStack(spacing: 12) {
                // Repeat Button
                VStack(alignment: .leading, spacing: 6) {
                    Text("반복")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    Button(action: { showingRepeatSheet = true }) {
                        HStack {
                            Text(repeatOption == "매주" && !selectedWeekdays.isEmpty ? "매주 \(selectedWeekdays.sorted().map { weekdays[$0] }.joined(separator: ","))" : repeatOption)
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
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
                }
                .frame(maxWidth: .infinity)

                // Alarm Button
                VStack(alignment: .leading, spacing: 6) {
                    Text("알림")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)

                    Button(action: { showingAlarmSheet = true }) {
                        HStack {
                            Text(alarmOptions.first(where: { $0.1 == alarm })?.0 ?? "없음")
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
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
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(section3BgColor)
        .cornerRadius(16)
        .onChange(of: startDate) { newStartDate in
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

            // Location
            VStack(alignment: .leading, spacing: 6) {
                Text("장소 정보 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)

                Button(action: { showingLocationSearch = true }) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "mappin.and.ellipse")
                                .foregroundColor(section4BadgeColor)
                            Text(location.isEmpty ? "장소를 검색하세요" : location)
                                .font(.suite(size: 14))
                                .foregroundColor(location.isEmpty ? .gray : .primary)
                            Spacer()
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.gray)
                        }

                        if let addr = locationAddress, !addr.isEmpty {
                            Text(addr)
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                        }
                    }
                    .padding(12)
                    .background(Color.white)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
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
                    .padding(.horizontal, 12)
                    .frame(height: 48) // 고정 높이
                    .background(Color.white)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
            }
        }
        .padding(16)
        .background(section4BgColor)
        .cornerRadius(16)
    }

    // MARK: - Save Button

    /// 시작일시와 종료일시 유효성 검사
    private var isDateValid: Bool {
        endDate > startDate
    }

    /// 저장 버튼 활성화 조건
    private var canSave: Bool {
        !title.isEmpty && isDateValid && !isLoading
    }

    private var saveButton: some View {
        VStack(spacing: 8) {
            // 날짜 유효성 오류 메시지
            if !isDateValid {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.suite(size: 14))
                    Text("종료 일시는 시작 일시보다 이후여야 합니다.")
                        .font(.suite(size: 13))
                        .foregroundColor(.orange)
                    Spacer()
                }
                .padding(.horizontal, 4)
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

    // MARK: - Alarm Selection Sheet
    private var alarmSelectionSheet: some View {
        NavigationStack {
            List {
                ForEach(alarmOptions, id: \.1) { option in
                    Button(action: {
                        alarm = option.1
                        showingAlarmSheet = false
                    }) {
                        HStack {
                            Text(option.0)
                                .font(.suite(size: 16))
                                .foregroundColor(.primary)
                            Spacer()
                            if alarm == option.1 {
                                Image(systemName: "checkmark")
                                    .foregroundColor(section4BadgeColor)
                            }
                        }
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("알림 설정")
                        .font(.suite(size: 17, weight: .semibold))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("완료") { showingAlarmSheet = false }.font(.suite(size: 16)))
        }
    }

    // MARK: - Repeat Selection Sheet
    private var repeatSelectionSheet: some View {
        NavigationStack {
            VStack(spacing: 0) {
                List {
                    ForEach(repeatOptions, id: \.self) { option in
                        Button(action: {
                            repeatOption = option
                            if option != "매주" {
                                selectedWeekdays.removeAll()
                                showingRepeatSheet = false
                            }
                        }) {
                            HStack {
                                Text(option)
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Spacer()
                                if repeatOption == option {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(section3BadgeColor)
                                }
                            }
                        }
                    }
                }

                // Weekday Selection (if 매주 selected)
                if repeatOption == "매주" {
                    VStack(spacing: 12) {
                        Text("반복할 요일 선택")
                            .font(.suite(size: 14, weight: .medium))
                            .foregroundColor(.gray)

                        HStack(spacing: 10) {
                            ForEach(0..<7) { index in
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        if selectedWeekdays.contains(index) {
                                            selectedWeekdays.remove(index)
                                        } else {
                                            selectedWeekdays.insert(index)
                                        }
                                    }
                                }) {
                                    Text(weekdays[index])
                                        .font(.suite(size: 14, weight: .bold))
                                        .frame(width: 38, height: 38)
                                        .background(selectedWeekdays.contains(index) ? section3BadgeColor : Color.gray.opacity(0.1))
                                        .foregroundColor(selectedWeekdays.contains(index) ? .white : .primary)
                                        .clipShape(Circle())
                                }
                            }
                        }

                        Button("완료") {
                            showingRepeatSheet = false
                        }
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 40)
                        .padding(.vertical, 12)
                        .background(section3BadgeColor)
                        .cornerRadius(10)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(section3BgColor)
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("반복 설정")
                        .font(.suite(size: 17, weight: .semibold))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("완료") { showingRepeatSheet = false }.font(.suite(size: 16)))
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
            errorMessage = "일정 제목을 입력해주세요."
            return
        }

        guard endDate > startDate else {
            errorMessage = "종료 일시는 시작 일시보다 이후여야 합니다."
            return
        }

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
                        sst_alram: alarm == 0 ? nil : alarm,
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
                        sst_alram: alarm == 0 ? nil : alarm,
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

                        onSave()
                        presentationMode.wrappedValue.dismiss()
                    } else {
                        errorMessage = "저장에 실패했습니다."
                    }
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
