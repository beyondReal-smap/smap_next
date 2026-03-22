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
        case .completed: return .green
        case .ongoing: return .orange
        case .upcoming: return .blue
        case .defaultStatus: return .gray
        }
    }
}
