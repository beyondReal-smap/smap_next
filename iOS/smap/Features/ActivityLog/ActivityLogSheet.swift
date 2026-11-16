import SwiftUI

// MARK: - 활동 로그 지도 시트 (Android ActivityLogSheet.kt 이식)
//
// 사이드바("로그 조회")·떠 있는 요약 카드·떠 있는 경로 막대·멤버 버튼을 대신한다.
// 접힌 상태: "멤버 · 날짜" + 요약 한 줄 (+ 경로 따라가기 막대) + 14일 날짜 줄(기록 있는 날 점, 구독 필요한 날 자물쇠).
// 펼친 상태: 요약 3칸, 멤버 목록(최근 14일 중 기록한 날 수).

enum ActivityLogSheet {
    static let peekHeight: CGFloat = 180
    /// 경로 따라가기 줄이 있을 때 접힌 시트에 더하는 높이
    static let routeControlHeight: CGFloat = 84

    static func dateString(_ date: Date) -> String { DateFormatter.apiDateOnlyFormatter.string(from: date) }
}

/// 머리 띠 안 — "나 · 11월 16일 (월)" + 요약 한 줄
struct ActivityLogSheetHeader: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    let currentUserIdx: Int?

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E)"
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(name) · \(dateText)")
                .font(SMAPTheme.Font.headline)
                .foregroundStyle(.white)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            Text(summaryLine)
                .font(SMAPTheme.Font.caption)
                .foregroundStyle(SMAPTheme.Surface.onNavyMuted)
                .lineLimit(1)
        }
        .padding(.horizontal, 20)
    }

    private var name: String {
        guard let member = viewModel.selectedMemberDailyCount else { return "멤버" }
        return member.member_id == currentUserIdx ? "나" : member.displayName
    }

    private var dateText: String {
        guard let date = DateFormatter.apiDateOnlyFormatter.date(from: viewModel.selectedDate) else { return viewModel.selectedDate }
        return Self.dateFormatter.string(from: date)
    }

    private var summaryLine: String {
        if viewModel.isMarkersLoading { return "기록을 불러오는 중…" }
        // 지도 가운데 큰 카드 대신 여기서 알린다(카드는 펼친 시트를 가렸다).
        if viewModel.mapMarkers.isEmpty { return "이 날은 이동 기록이 없어요 · 다른 날을 골라 보세요" }
        guard viewModel.locationSummary != nil else { return "이동 기록이 있어요 · 아래 막대로 따라가 보세요" }
        return "\(viewModel.formattedDistance) 이동 · \(viewModel.formattedDuration) · \(viewModel.formattedSteps)"
    }
}

/// 띠 아래 — (경로 따라가기) + 날짜 줄(접혀도 보임) + 요약·멤버 목록
struct ActivityLogSheetBody: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    let currentUserIdx: Int?

    var body: some View {
        let hasRoute = !viewModel.sortedMapMarkers.isEmpty
        VStack(spacing: 0) {
            if hasRoute {
                RouteScrubber(viewModel: viewModel)
            }
            // 경로 막대가 있으면 막대 자체가 띠 아래 여백 역할을 한다.
            Spacer().frame(height: hasRoute ? SMAPTheme.Spacing.sm : SMAPSheetMetrics.headerBandGap)
            DateStrip(items: dateItems, selected: selectedDate) { item in
                if item.locked {
                    viewModel.showRetentionLock()
                } else {
                    Task { await viewModel.selectDate(ActivityLogSheet.dateString(item.date)) }
                }
            }
            Spacer().frame(height: SMAPTheme.Spacing.md)

            ScrollView {
                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                    SMAPSection(title: "요약") {
                        HStack(spacing: 0) {
                            statCell("이동 거리", viewModel.formattedDistance)
                            statCell("이동 시간", viewModel.formattedDuration)
                            statCell("걸음 수", viewModel.formattedSteps)
                        }
                        .padding(.vertical, SMAPTheme.Spacing.md)
                    }
                    SMAPSection(title: "멤버") {
                        ForEach(Array(viewModel.memberDailyCounts.enumerated()), id: \.element.id) { index, member in
                            if index > 0 { SMAPRowDivider() }
                            let days = member.daily_counts.filter { $0.count > 0 }.count
                            SMAPListRow(
                                title: member.member_id == currentUserIdx ? "\(member.displayName) (나)" : member.displayName,
                                subtitle: days > 0 ? "최근 2주 중 \(days)일 기록" : "최근 2주 기록 없음",
                                selected: member.member_id == viewModel.selectedMemberId,
                                action: { Task { await viewModel.selectMember(member.member_id) } },
                                leading: { SMAPAvatar(name: member.displayName, imagePath: member.member_photo) }
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

    private let thumbSize: CGFloat = 22

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("경로 따라가기")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                Spacer()
                Text(timeText(viewModel.currentMarkerAtSlider?.mlt_gps_time) ?? "--:--")
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(accent.base)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                let size = viewModel.isSliderDragging ? thumbSize + 4 : thumbSize
                let usable = max(geo.size.width - thumbSize, 1)
                let fraction = CGFloat(viewModel.sliderValue / 100)
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
                        .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                        .position(x: centerX, y: geo.size.height / 2)
                }
                .frame(height: geo.size.height)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !viewModel.isSliderDragging { viewModel.isSliderDragging = true }
                            let x = min(max(value.location.x - thumbSize / 2, 0), usable)
                            viewModel.updateSliderValue(Double(x / usable) * 100)
                        }
                        .onEnded { _ in viewModel.isSliderDragging = false }
                )
                .animation(.easeOut(duration: 0.12), value: viewModel.isSliderDragging)
            }
            .frame(height: 32)
            HStack {
                Text(timeText(viewModel.sortedMapMarkers.first?.mlt_gps_time) ?? "")
                Spacer()
                Text(timeText(viewModel.sortedMapMarkers.last?.mlt_gps_time) ?? "")
            }
            .font(SMAPTheme.Font.captionSmall)
            .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
        }
        // 남색 띠 바로 아래 글자가 띠에 붙어 보이지 않게 위 여백 12 (Android 와 동일)
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .frame(height: ActivityLogSheet.routeControlHeight, alignment: .top)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("경로 따라가기, 현재 \(timeText(viewModel.currentMarkerAtSlider?.mlt_gps_time) ?? "알 수 없음")")
        .accessibilityValue("\(Int(viewModel.sliderValue))%")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: viewModel.updateSliderValue(viewModel.sliderValue + 5)
            case .decrement: viewModel.updateSliderValue(viewModel.sliderValue - 5)
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
