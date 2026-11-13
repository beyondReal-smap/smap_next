//
// ScheduleCardView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MemberHorizontalListView was deleted in favor of SidebarView.

struct ScheduleCardView: View {
    let schedule: SmapSchedule

    var body: some View {
        HStack(spacing: 15) {
            VStack {
                Text(scheduleTime)
                    .font(.suite(size: 12))
                    .foregroundColor(.secondary)
            }
            .frame(width: 60)

            VStack(alignment: .leading, spacing: 4) {
                Text(schedule.title ?? "일정 이름 없음")
                    .font(.suite(size: 15, weight: .bold))

                if let memo = schedule.sst_memo, !memo.isEmpty {
                    Text(memo)
                        .font(.suite(size: 12))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            StatusBadge(status: schedule.status)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 15).fill(Color.secondary.opacity(0.05)))
    }

    var scheduleTime: String {
        guard let sDateStr = schedule.date else { return "--:--" }

        // "2023-10-27T09:00:00" or "2023-10-27 09:00:00"
        let parts = sDateStr.contains("T") ? sDateStr.split(separator: "T") : sDateStr.split(separator: " ")

        if parts.count > 1 {
            let timeParts = parts[1].split(separator: ":")
            if timeParts.count > 1 {
                return "\(timeParts[0]):\(timeParts[1])"
            }
        }
        return "--:--"
    }
}

struct StatusBadge: View {
    let status: ScheduleStatus

    var body: some View {
        Text(status.text)
            .font(.suite(size: 10, weight: .bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor.opacity(0.1))
            .foregroundColor(backgroundColor)
            .cornerRadius(5)
    }

    var backgroundColor: Color {
        switch status {
        case .completed: return SMAPTheme.Semantic.statCompleted
        case .ongoing: return SMAPTheme.Semantic.statOngoing
        case .upcoming: return SMAPTheme.Semantic.statUpcoming
        case .defaultStatus: return .gray
        }
    }
}

// MARK: - Today Schedule Preview (홈 지도 위 컴팩트 카드 캐로셀)
// 일정·위치 공유 앱의 성격을 홈 화면에서 한눈에 드러내기 위한 오버레이 뷰.

struct TodaySchedulePreviewView: View {
    let schedules: [SmapSchedule]
    let onTap: (SmapSchedule) -> Void

    var body: some View {
        if schedules.isEmpty {
            EmptyView()
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(schedules, id: \.id) { schedule in
                        Button {
                            onTap(schedule)
                        } label: {
                            TodaySchedulePreviewCard(schedule: schedule)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("오늘 일정 미리보기")
        }
    }
}

private struct TodaySchedulePreviewCard: View {
    let schedule: SmapSchedule

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(statusColor)
                .frame(width: 3, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(schedule.status.text)
                        .font(.suite(size: 11, weight: .bold))
                        .foregroundColor(statusColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor.opacity(0.12))
                        .clipShape(Capsule())

                    Text(timeLabel)
                        .font(.suite(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                        .monospacedDigit()
                }

                Text(schedule.title ?? "제목 없는 일정")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(minWidth: 200, maxWidth: 260)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(schedule.status.text) · \(schedule.title ?? "제목 없음") · \(timeLabel)")
        .accessibilityHint("상세 보기")
    }

    private var statusColor: Color {
        switch schedule.status {
        case .ongoing: return SMAPTheme.Semantic.statOngoing
        case .upcoming: return SMAPTheme.Semantic.statUpcoming
        case .completed: return SMAPTheme.Semantic.statCompleted
        case .defaultStatus: return .gray
        }
    }

    private var timeLabel: String {
        guard let sDateStr = schedule.date else { return "--:--" }
        let parts = sDateStr.contains("T")
            ? sDateStr.split(separator: "T")
            : sDateStr.split(separator: " ")
        if parts.count > 1 {
            let timeParts = parts[1].split(separator: ":")
            if timeParts.count >= 2 {
                return "\(timeParts[0]):\(timeParts[1])"
            }
        }
        return "--:--"
    }
}
