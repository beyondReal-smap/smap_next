//
// NotificationRow.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

struct NotificationRow: View {
    let notification: PushLog
    let pinkColor: Color

    private var iconName: String {
        if let title = notification.plt_title?.lowercased() {
            if title.contains("위치") || title.contains("location") {
                return "location.fill"
            } else if title.contains("그룹") || title.contains("group") {
                return "person.3.fill"
            } else if title.contains("일정") || title.contains("schedule") {
                return "calendar"
            } else if title.contains("초대") || title.contains("invite") {
                return "envelope.fill"
            }
        }
        return "bell.fill"
    }

    private var iconColor: Color {
        switch iconName {
        case "location.fill": return .red
        case "person.3.fill": return SMAPTheme.Color.primary
        case "calendar": return .orange
        case "envelope.fill": return .green
        default: return pinkColor
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Content
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(notification.plt_title ?? "알림")
                        .font(.suite(size: 15, weight: notification.plt_read_chk == .N ? .bold : .medium))
                        .foregroundColor(.black)

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text(notification.relativeTime)
                            .font(.suite(size: 11))
                            .foregroundColor(.gray)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(10)

                        // NEW Badge (Repositioned)
                        if notification.plt_read_chk == .N {
                            Text("NEW")
                                .font(.suite(size: 9, weight: .bold))
                                .foregroundColor(pinkColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(pinkColor.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }

                Text(notification.plt_content ?? "")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.06), radius: 10, x: 0, y: 4)
        )
        .overlay(
            // Unread indicator (Border only)
            Group {
                if notification.plt_read_chk == .N {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(pinkColor.opacity(0.3), lineWidth: 2)
                }
            },
            alignment: .center // Ensure it covers the whole card
        )
    }
}
