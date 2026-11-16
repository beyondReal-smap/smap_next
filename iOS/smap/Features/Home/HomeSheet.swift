import SwiftUI

// MARK: - 홈 지도 시트 (Android HomeSheet.kt 이식)
//
// 사이드바("멤버 조회")·떠 있는 멤버 버튼·지도 말풍선·"오늘 일정" 카드를 시트 하나로 대신한다.
// 접힌 상태: 남색 머리 줄(선택한 멤버의 상태 또는 "멤버 N명") + 얼굴 줄.
// 펼친 상태: 멤버 목록(위치 갱신·배터리·그날 일정 수) → 날짜 줄 → 그날 일정.

enum HomeSheet {
    /// 접힌 시트 높이: 손잡이 + 머리 줄 + 얼굴 줄
    static let peekHeight: CGFloat = 178
}

/// 머리 띠 안 — 선택한 멤버 이름·상태, 또는 멤버 수 안내
struct HomeSheetHeader: View {
    let members: [SmapGroupMember]
    let currentUserIdx: Int?
    let onShowAll: () -> Void

    var body: some View {
        let selected = members.first(where: { $0.isSelected })
        HStack(spacing: SMAPTheme.Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                if let selected {
                    Text(selected.mt_idx == currentUserIdx ? "\(selected.displayName) (나)" : selected.displayName)
                        .font(SMAPTheme.Font.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .accessibilityAddTraits(.isHeader)
                    Text(memberStatusLine(selected) ?? "아직 위치 정보가 없어요")
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onNavyMuted)
                        .lineLimit(1)
                } else {
                    Text("멤버 \(members.count)명")
                        .font(SMAPTheme.Font.headline)
                        .foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)
                    Text("얼굴을 누르면 그 멤버 위치로 이동해요")
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onNavyMuted)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if selected != nil {
                SheetBandButton(title: "전체 보기", systemImage: "map", action: onShowAll)
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, SMAPTheme.Spacing.sm)
    }
}

/// 띠 아래 흰 영역 — 얼굴 줄(접혀도 보임) + 펼치면 보이는 목록
struct HomeSheetBody: View {
    @Environment(\.smapAccent) private var accent
    @ObservedObject var viewModel: HomeViewModel
    let currentUserIdx: Int?
    let onSelectMember: (SmapGroupMember) -> Void
    let onShowAll: () -> Void

    private static let dayTitleFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 EEEE"
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: SMAPSheetMetrics.headerBandGap)
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
            Spacer().frame(height: SMAPTheme.Spacing.md)

            // 펼친 영역 — 회색 바탕 위 묶음들
            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    memberSection
                    scheduleSection
                }
                .padding(SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.lg)
            }
            .background(SMAPTheme.Surface.canvas)
        }
    }

    private var memberSection: some View {
        SMAPSection(title: "멤버") {
            ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                if index > 0 { SMAPRowDivider() }
                let stats = viewModel.getMemberTodayStats(mtIdx: member.mt_idx)
                let count = stats.completed + stats.ongoing + stats.upcoming
                SMAPListRow(
                    title: member.mt_idx == currentUserIdx ? "\(member.displayName) (나)" : member.displayName,
                    subtitle: memberStatusLine(member) ?? "위치 정보 없음",
                    selected: member.isSelected,
                    action: { onSelectMember(member) },
                    leading: { SMAPAvatar(name: member.displayName, imagePath: member.mt_file1) },
                    trailing: {
                        if count > 0 { SMAPCountPill(text: "일정 \(count)") }
                    }
                )
            }
        }
    }

    private var scheduleSection: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            Text(Self.dayTitleFormatter.string(from: viewModel.selectedDate) + " 일정")
                .font(SMAPTheme.Font.captionBold)
                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                .padding(.leading, 4)
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
                let schedules = viewModel.sheetSchedules
                if schedules.isEmpty {
                    SMAPListRow(title: "일정이 없어요", subtitle: "일정 탭에서 추가할 수 있어요", leading: {
                        SMAPRowIcon(systemImage: "calendar.badge.checkmark")
                    })
                } else {
                    ForEach(Array(schedules.enumerated()), id: \.offset) { index, schedule in
                        if index > 0 { SMAPRowDivider() }
                        SMAPListRow(title: schedule.title.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없음", subtitle: scheduleMemberName(schedule), leading: {
                            Text(scheduleTime(schedule))
                                .font(SMAPTheme.Font.captionBold)
                                .foregroundStyle(accent.base)
                                .frame(width: 52, alignment: .leading)
                        })
                    }
                }
            }
        }
    }

    /// 그룹 전체 일정을 볼 때 누구의 일정인지
    private func scheduleMemberName(_ schedule: SmapSchedule) -> String? {
        guard !viewModel.members.contains(where: { $0.isSelected }), let sgdt = schedule.sgdt_idx else { return nil }
        return viewModel.members.first(where: { $0.sgdt_idx == sgdt })?.displayName
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
