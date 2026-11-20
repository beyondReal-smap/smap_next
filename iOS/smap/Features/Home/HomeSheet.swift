import SwiftUI

// MARK: - 가족 홈 지도 시트

enum HomeSheet {
    static let peekHeight: CGFloat = 228
}

struct HomeSheetHeader: View {
    let members: [SmapGroupMember]
    let currentUserIdx: Int?
    let selectedDate: Date
    let onShowAll: () -> Void

    var body: some View {
        let selected = members.first(where: { $0.isSelected })
        let weekday = selectedDate.formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "ko_KR")))
        HStack(spacing: 12) {
            VStack(spacing: 0) {
                Text("\(Calendar.current.component(.month, from: selectedDate))월")
                    .font(.suite(size: 11, weight: .bold))
                    .foregroundStyle(SMAPTheme.Family.ink)
                    .frame(maxWidth: .infinity)
                    .background(SMAPTheme.Family.highlight)
                Text("\(Calendar.current.component(.day, from: selectedDate))")
                    .font(.suite(size: 23, weight: .bold))
                    .foregroundStyle(SMAPTheme.Family.ink)
                    .monospacedDigit()
            }
            .frame(width: 46, height: 48)
            .background(.white, in: RoundedRectangle(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(SMAPTheme.Family.ink.opacity(0.15)) }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .accessibilityLabel(selectedDate.formatted(.dateTime.month().day().locale(Locale(identifier: "ko_KR"))))

            VStack(alignment: .leading, spacing: 2) {
                Text(selected.map { $0.mt_idx == currentUserIdx ? "나의 하루" : "\($0.displayName)의 하루" } ?? "우리의 하루")
                    .font(.suite(size: 23, weight: .bold))
                    .foregroundStyle(SMAPTheme.Family.ink)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Text(selected.map { memberStatusLine($0) ?? "아직 위치 정보가 없어요" }
                     ?? (members.isEmpty ? "함께할 멤버가 아직 없어요" : "\(weekday) · 함께하는 \(members.count)명"))
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Family.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if selected != nil {
                SheetBandButton(title: "전체 보기", systemImage: "map", action: onShowAll)
                    .smapAccent(.family)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, SMAPTheme.Spacing.lg)
    }
}

/// 접힌 상태에서도 멤버 선택과 일정 미리보기가 보인다.
struct HomeSheetBody: View {
    @ObservedObject var viewModel: HomeViewModel
    let schedules: [SmapSchedule]
    let currentUserIdx: Int?
    let isExpanded: Bool
    let expansionProgress: CGFloat
    let onToggleSchedule: () -> Void
    let onSelectMember: (SmapGroupMember) -> Void
    let onShowAll: () -> Void
    /// 장소가 저장된 일정을 누르면 지도를 그 장소로 옮긴다
    let onSelectSchedule: (SmapSchedule) -> Void

    private static let dayTitleFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 EEEE"
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                Spacer().frame(height: 6)
                MemberStrip(
                    members: viewModel.members.map {
                        MemberStripItem(id: $0.mt_idx, name: $0.displayName, imagePath: $0.mt_file1, isMe: $0.mt_idx == currentUserIdx)
                    },
                    selectedId: viewModel.members.first(where: { $0.isSelected })?.mt_idx,
                    onSelect: { item in
                        if let member = viewModel.members.first(where: { $0.mt_idx == item.id }) { onSelectMember(member) }
                    },
                    onAllTap: onShowAll
                )
                .smapAccent(.family)
                schedulePreview
                    .padding(.horizontal, SMAPTheme.Spacing.md)
                    .padding(.top, 10)
                    .padding(.bottom, 14)
            }
            .fixedSize(horizontal: false, vertical: true)

            // 펼친 영역 — 회색 바탕 위 묶음들
            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    scheduleSection
                    memberSection
                }
                .padding(SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.lg)
            }
            .background(SMAPTheme.Surface.canvas)
        }
        .background(SMAPTheme.Family.paper)
    }

    private var schedulePreview: some View {
        let featured = schedules.first { $0.status != .completed } ?? schedules.last
        let day = Calendar.current.isDateInToday(viewModel.selectedDate) ? "오늘" : "이날"
        return Button(action: onToggleSchedule) {
            HStack(spacing: 12) {
                Group {
                    if let featured {
                        Text(scheduleTime(featured))
                            .font(.suite(size: 23, weight: .bold))
                            .monospacedDigit()
                    } else {
                        Image(systemName: "calendar").font(.system(size: 22, weight: .medium))
                    }
                }
                .foregroundStyle(SMAPTheme.Family.highlight)
                .frame(minWidth: 66)
                Rectangle().fill(.white.opacity(0.26)).frame(width: 1, height: 31)
                VStack(alignment: .leading, spacing: 3) {
                    Text(schedules.isEmpty ? "\(day)의 일정" : "\(day)의 일정 · \(schedules.count)개")
                        .font(SMAPTheme.Font.captionSmall)
                        .foregroundStyle(.white.opacity(0.80))
                    Text(featured.map { $0.title.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없는 일정" } ?? "잡힌 약속이 없어요")
                        .font(SMAPTheme.Font.subheadline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.up")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .rotationEffect(.degrees(Double(expansionProgress) * 180))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 64)
            .background(SMAPTheme.Family.ink, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("home.schedulePreview")
        .accessibilityHint(isExpanded ? "일정 목록을 접습니다" : "일정 목록과 날짜 선택을 펼칩니다")
    }

    private var memberSection: some View {
        SMAPSection(title: "함께하는 멤버") {
            ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                if index > 0 { SMAPRowDivider() }
                let stats = viewModel.getMemberTodayStats(mtIdx: member.mt_idx)
                let count = stats.completed + stats.ongoing + stats.upcoming
                SMAPListRow(
                    title: member.mt_idx == currentUserIdx ? "\(member.displayName) (나)" : member.displayName,
                    subtitle: memberStatusLine(member) ?? "위치 정보 없음",
                    selected: member.isSelected,
                    action: { onSelectMember(member) },
                    leading: { SMAPAvatar(name: member.displayName, imagePath: member.mt_file1, memberID: member.mt_idx) },
                    trailing: {
                        if count > 0 { SMAPCountPill(text: "일정 \(count)") }
                    }
                )
            }
        }
    }

    private var scheduleSection: some View {
        let isToday = Calendar.current.isDateInToday(viewModel.selectedDate)
        return VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(isToday ? "오늘의 일정" : "이날의 일정")
                    .font(SMAPTheme.Font.headline)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                Spacer()
                Text(Self.dayTitleFormatter.string(from: viewModel.selectedDate))
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
            }
            .padding(.horizontal, 4)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            DateStrip(
                items: (0..<14).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: Calendar.current.startOfDay(for: Date())) }
                    .map { DateChipItem(date: $0) },
                selected: viewModel.selectedDate,
                onSelect: { viewModel.selectedDate = $0.date }
            )
            .padding(.horizontal, -SMAPTheme.Spacing.md)
            .padding(.bottom, 4)

            SMAPSection {
                if schedules.isEmpty {
                    SMAPListRow(title: "아직 잡힌 일정이 없어요", subtitle: "일정 탭에서 함께할 약속을 추가해요", leading: {
                        SMAPRowIcon(systemImage: "calendar.badge.checkmark")
                    })
                } else {
                    ForEach(Array(schedules.enumerated()), id: \.offset) { index, schedule in
                        if index > 0 { SMAPRowDivider() }
                        // 장소가 있는 일정만 누를 수 있다 — 장소 없는 일정은 옮겨 갈 곳이 없으니 누름 표시도 하지 않는다.
                        // 일정 탭과 같은 줄(시각·막대 / 제목 / 멤버·반복 / 장소). 색은 일정 강조색.
                        SMAPScheduleRow(
                            start: schedule.date.flatMap { ScheduleMarkerRenderer.clock(from: $0) },
                            end: schedule.sst_edate.flatMap { ScheduleMarkerRenderer.clock(from: $0) },
                            allDay: schedule.sst_all_day == "Y",
                            title: schedule.title.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없음",
                            member: scheduleMember(schedule),
                            place: schedule.location.flatMap { $0.isEmpty ? nil : $0 },
                            repeatText: schedule.isRecurring ? (schedule.repeatDescription ?? "반복") : nil,
                            isDone: schedule.status == .completed,
                            ongoingText: schedule.status == .ongoing ? schedule.status.text : nil,
                            action: schedule.mapCoordinate == nil ? nil : { onSelectSchedule(schedule) }
                        )
                        .environment(\.smapAccent, .schedule)
                    }
                }
            }
        }
    }

    /// 그룹 전체 일정을 볼 때 누구의 일정인지(한 멤버만 볼 때는 모두 같은 사람이라 뺀다).
    /// 일정 주인(mt_idx / mt_schedule_idx)으로 찾는다 — 이전엔 sgdt_idx 로 찾았는데 그룹 일정 응답은 이 값이 비어 있어 이름이 안 나왔다.
    private func scheduleMember(_ schedule: SmapSchedule) -> SMAPScheduleRow.Member? {
        guard !viewModel.members.contains(where: { $0.isSelected }),
              let owner = viewModel.members.first(where: { HomeViewModel.isSchedule(schedule, ownedBy: $0) }) else { return nil }
        return .init(name: owner.displayName, photo: owner.mt_file1, id: owner.mt_idx)
    }
}

/// "16:46 갱신 · 배터리 80% · 12km/h 이동 중" — 값이 없는 항목은 빼고, 모두 없으면 nil.
func memberStatusLine(_ member: SmapGroupMember) -> String? {
    var parts: [String] = []
    if let time = formatGpsTime(member.mlt_gps_time) { parts.append("\(time) 갱신") }
    if let battery = member.mlt_battery, battery >= 0 { parts.append("배터리 \(battery)%") }
    // 서버 속도는 m/s — 이전 지도 말풍선과 같은 환산(×3.6)
    if let speed = member.mlt_speed, speed * 3.6 >= 1 { parts.append("\(Int((speed * 3.6).rounded()))km/h 이동 중") }
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
}

/// 서버 GPS 시각("yyyy-MM-dd HH:mm:ss", 한국 시각)을 "HH:mm"(오늘) 또는 "M/d HH:mm" 으로.
/// 끝에 Z 가 있을 때만 UTC 로 읽는다.
private func formatGpsTime(_ raw: String?) -> String? {
    guard var raw, !raw.isEmpty else { return nil }
    let isUTC = raw.hasSuffix("Z")
    if isUTC { raw.removeLast() }
    raw = raw.replacingOccurrences(of: "T", with: " ")
    if let dot = raw.firstIndex(of: ".") { raw = String(raw[..<dot]) }
    let input = DateFormatter()
    input.locale = Locale(identifier: "en_US_POSIX")
    input.dateFormat = "yyyy-MM-dd HH:mm:ss"
    input.timeZone = isUTC ? TimeZone(identifier: "UTC") : TimeZone.current
    guard let date = input.date(from: raw) else { return nil }
    let output = DateFormatter()
    output.locale = Locale(identifier: "ko_KR")
    output.dateFormat = Calendar.current.isDateInToday(date) ? "HH:mm" : "M/d HH:mm"
    return output.string(from: date)
}

/// 일정 시작 시각 "HH:mm", 하루 종일이면 "종일".
private func scheduleTime(_ schedule: SmapSchedule) -> String {
    if schedule.sst_all_day == "Y" { return "종일" }
    guard let date = schedule.date, let range = date.range(of: #"[T ](\d{2}):(\d{2})"#, options: .regularExpression) else { return "-" }
    return String(date[range].dropFirst())
}
