import SwiftUI

// MARK: - 활동 로그 지도 시트 (Android ActivityLogSheet.kt 이식)
//
// 사이드바("로그 조회")·떠 있는 요약 카드·떠 있는 경로 막대·멤버 버튼을 대신한다.
// 접힌 상태: "멤버 · 날짜" + 요약 한 줄 (+ 경로 따라가기 막대) + 14일 날짜 줄(기록 있는 날 점, 구독 필요한 날 자물쇠).
// 펼친 상태: 요약 3칸, 멤버 목록(최근 14일 중 기록한 날 수).

enum ActivityLogSheet {
    static let peekHeight: CGFloat = 190
    /// 경로 따라가기 줄 높이 — 경로가 없는 날도 줄을 두므로 접힌 시트는 늘 이만큼 더 높다.
    static let routeControlHeight: CGFloat = 84

    static func dateString(_ date: Date) -> String { DateFormatter.apiDateOnlyFormatter.string(from: date) }
}

/// 머리 띠 안 — "나 · 11월 16일 (월)" + 요약 한 줄
struct ActivityLogSheetHeader: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    let currentUserIdx: Int?

    @State private var choosingMember = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E)"
        return f
    }()

    var body: some View {
        let member = viewModel.selectedMemberDailyCount
        HStack(spacing: 12) {
            if let member {
                SMAPAvatar(name: member.displayName, imagePath: member.member_photo, size: 48, memberID: member.member_id)
            } else {
                Image(systemName: "figure.walk").font(.title2).foregroundStyle(SMAPAccent.activity.deep)
                    .frame(width: 48, height: 48).background(.white, in: Circle()).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(dateText).font(SMAPTheme.Font.captionBold).foregroundStyle(SMAPAccent.activity.deep)
                Text(member.map { $0.member_id == currentUserIdx ? "나의 발자취" : "\($0.displayName)의 발자취" } ?? "하루의 발자취")
                    .font(.suite(size: 22, weight: .bold)).foregroundStyle(SMAPTheme.Family.ink)
                    .lineLimit(1).accessibilityAddTraits(.isHeader)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if viewModel.memberDailyCounts.count > 1 {
                Button { choosingMember = true } label: {
                    Text("멤버 변경").font(SMAPTheme.Font.captionBold).foregroundStyle(SMAPAccent.activity.deep)
                        .padding(.horizontal, 12).frame(minHeight: 44).background(.white, in: Capsule())
                }
                .buttonStyle(.plain)
                    .confirmationDialog("기록을 볼 멤버", isPresented: $choosingMember, titleVisibility: .visible) {
                        ForEach(viewModel.memberDailyCounts) { person in
                            Button(person.member_id == currentUserIdx ? "\(person.displayName) (나)" : person.displayName) {
                                Task { await viewModel.selectMember(person.member_id) }
                            }
                        }
                        Button("취소", role: .cancel) {}
                    }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
    }

    private var dateText: String {
        guard let date = DateFormatter.apiDateOnlyFormatter.date(from: viewModel.selectedDate) else { return viewModel.selectedDate }
        return Self.dateFormatter.string(from: date)
    }
}

/// 날짜를 고르면 해당 날짜의 경로 막대와 이동 요약을 확인할 수 있다.
struct ActivityLogSheetBody: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    let currentUserIdx: Int?

    var body: some View {
        let hasRoute = viewModel.sortedMapMarkers.count >= 2
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "point.topleft.down.to.point.bottomright.curvepath").accessibilityHidden(true)
                Text(summaryLine).font(SMAPTheme.Font.captionBold)
            }
            .foregroundStyle(SMAPAccent.activity.deep)
            .padding(.horizontal, 20).padding(.bottom, 10)
            .frame(maxWidth: .infinity, alignment: .leading).background(SMAPAccent.activity.container)
            Spacer().frame(height: 8)
            DateStrip(items: dateItems, selected: selectedDate) { item in
                if item.locked {
                    viewModel.showRetentionLock()
                } else {
                    Task { await viewModel.selectDate(ActivityLogSheet.dateString(item.date)) }
                }
            }
            // 경로가 없는 날(불러오는 중 포함)도 막대 자리를 지킨다 — 날짜를 바꿀 때 시트 높이가 바뀌어 레이아웃이 흔들리지 않게.
            RouteScrubber(viewModel: viewModel, enabled: hasRoute)
            Spacer().frame(height: SMAPTheme.Spacing.md)

            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    if viewModel.locationSummary != nil && !viewModel.sortedMapMarkers.isEmpty {
                        SMAPSection(title: "이날의 이동") {
                            HStack(spacing: 0) {
                                statCell("이동 거리", viewModel.formattedDistance)
                                statCell("이동 시간", viewModel.formattedDuration)
                                statCell("걸음 수", viewModel.formattedSteps)
                            }
                            .padding(.vertical, SMAPTheme.Spacing.md)
                        }
                    }
                    SMAPSection(title: "기록을 볼 멤버") {
                        ForEach(Array(viewModel.memberDailyCounts.enumerated()), id: \.element.id) { index, member in
                            if index > 0 { SMAPRowDivider() }
                            let days = member.daily_counts.filter { $0.count > 0 }.count
                            SMAPListRow(
                                title: member.member_id == currentUserIdx ? "\(member.displayName) (나)" : member.displayName,
                                subtitle: days > 0 ? "최근 2주 중 \(days)일 기록" : "최근 2주 기록 없음",
                                selected: member.member_id == viewModel.selectedMemberId,
                                action: { Task { await viewModel.selectMember(member.member_id) } },
                                leading: { SMAPAvatar(name: member.displayName, imagePath: member.member_photo, memberID: member.member_id) }
                            )
                        }
                    }
                }
                .padding(SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.lg)
            }
            .background(SMAPTheme.Surface.canvas)
        }
    }

    private var summaryLine: String {
        if viewModel.isMarkersLoading { return "기록을 불러오는 중…" }
        // 지도 가운데 큰 카드 대신 여기서 알린다(카드는 펼친 시트를 가렸다).
        if viewModel.sortedMapMarkers.isEmpty { return "이날은 이동 기록이 없어요" }
        guard viewModel.locationSummary != nil else { return viewModel.sortedMapMarkers.count > 1 ? "이동 기록이 있어요 · 아래 막대로 따라가 보세요" : "위치가 한 곳에 기록됐어요" }
        return "\(viewModel.formattedDistance) 이동 · \(viewModel.formattedDuration) · \(viewModel.formattedSteps)"
    }

    private var selectedDate: Date {
        DateFormatter.apiDateOnlyFormatter.date(from: viewModel.selectedDate) ?? Date()
    }

    /// 최근 14일(오래된 날 → 오늘). 점은 고른 멤버가 기록한 날, 자물쇠는 무료 보존 기간 밖.
    private var dateItems: [DateChipItem] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return (0..<14).reversed().compactMap { offset -> DateChipItem? in
            guard let date = calendar.date(byAdding: .day, value: -offset, to: today) else { return nil }
            let dot = viewModel.selectedMemberId.map { viewModel.hasActivityForMember($0, on: ActivityLogSheet.dateString(date)) } ?? false
            let locked = viewModel.lockedFromOffset.map { offset >= $0 } ?? false
            return DateChipItem(date: date, dot: dot, locked: locked)
        }
    }

    private func statCell(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(SMAPTheme.Font.headline)
                .foregroundStyle(SMAPTheme.Surface.onSurface)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(label)
                .font(SMAPTheme.Font.captionSmall)
                .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label) \(value)")
    }
}

/// 경로 따라가기 — 막대를 밀면 지도 위 표시가 그 시각 위치로 움직인다(값 0~100, 기존 지도 연동 그대로).
/// 이전에는 지도 왼쪽 아래 떠 있는 작은 카드라 시트·사이드바에 가려졌다. 이제 시트 머리 띠 바로 아래에 늘 보인다.
struct RouteScrubber: View {
    @Environment(\.smapAccent) private var accent
    @ObservedObject var viewModel: ActivityLogViewModel
    /// 이동 점이 2개 이상일 때만 끌 수 있다. 아니면 흐리게 두고 시각은 비운다.
    let enabled: Bool

    private let thumbSize: CGFloat = 22

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("경로 따라가기")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                Spacer()
                Text(enabled ? timeText(viewModel.currentMarkerAtSlider?.mlt_gps_time) ?? "--:--" : "--:--")
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(accent.base)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                let size = viewModel.scrubber.isDragging ? thumbSize + 4 : thumbSize
                let usable = max(geo.size.width - thumbSize, 1)
                let fraction = enabled ? CGFloat(viewModel.scrubber.value / 100) : 0
                let centerX = thumbSize / 2 + usable * fraction
                ZStack(alignment: .leading) {
                    // 연한 남색 바탕 위에 지나온 구간만 남색으로 채운다
                    Capsule().fill(accent.container).frame(height: 6)
                    Capsule().fill(accent.band).frame(width: centerX, height: 6)
                    // 손잡이 — 흰 테두리 남색 원. 맨 왼쪽에서도 분명히 보인다.
                    Circle()
                        .fill(accent.gradient)
                        .padding(3)
                        .background(Circle().fill(Color.white))
                        .frame(width: size, height: size)
                        .animation(.easeOut(duration: 0.12), value: viewModel.scrubber.isDragging)
                        .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                        .position(x: centerX, y: geo.size.height / 2)
                }
                .frame(height: geo.size.height)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !viewModel.scrubber.isDragging { viewModel.scrubber.isDragging = true }
                            let x = min(max(value.location.x - thumbSize / 2, 0), usable)
                            viewModel.updateSliderValue(Double(x / usable) * 100)
                        }
                        .onEnded { _ in viewModel.scrubber.isDragging = false }
                )
            }
            .frame(height: 32)
            .allowsHitTesting(enabled)
            HStack {
                Text(enabled ? timeText(viewModel.sortedMapMarkers.first?.mlt_gps_time) ?? "" : "")
                Spacer()
                Text(enabled ? timeText(viewModel.sortedMapMarkers.last?.mlt_gps_time) ?? "" : "")
            }
            .font(SMAPTheme.Font.captionSmall)
            .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
        }
        // 남색 띠 바로 아래 글자가 띠에 붙어 보이지 않게 위 여백 12 (Android 와 동일)
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .frame(height: ActivityLogSheet.routeControlHeight, alignment: .top)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(enabled ? "경로 따라가기, 현재 \(timeText(viewModel.currentMarkerAtSlider?.mlt_gps_time) ?? "알 수 없음")" : "경로 따라가기, 이날은 따라갈 경로가 없음")
        .accessibilityValue("\(Int(viewModel.scrubber.value))%")
        .accessibilityAdjustableAction { direction in
            guard enabled else { return }
            switch direction {
            case .increment: viewModel.updateSliderValue(viewModel.scrubber.value + 5)
            case .decrement: viewModel.updateSliderValue(viewModel.scrubber.value - 5)
            @unknown default: break
            }
        }
    }

    /// "2026-11-16 08:50:12" → "08:50"
    private func timeText(_ raw: String?) -> String? {
        guard let raw, let range = raw.range(of: #"[T ](\d{2}):(\d{2})"#, options: .regularExpression) else { return nil }
        return String(raw[range].dropFirst())
    }
}
