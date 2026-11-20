//
// NotificationRow.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

struct NotificationRow: View {
    let notification: PushLog
    @Environment(\.smapAccent) private var accent

    private var iconName: String {
        if let title = notification.plt_title?.lowercased() {
            if title.contains("위치") || title.contains("도착") || title.contains("방문") || title.contains("이탈") || title.contains("location") {
                return "location.fill"
            } else if title.contains("그룹") || title.contains("group") {
                return "person.3.fill"
            } else if title.contains("일정") || title.contains("schedule") {
                return "calendar"
            } else if title.contains("초대") || title.contains("invite") {
                return "envelope.fill"
            }
        }
        return notification.type.iconName
    }

    var body: some View {
        let isUnread = notification.plt_read_chk == .N
        HStack(alignment: .top, spacing: SMAPTheme.Spacing.sm) {
            SMAPRowIcon(systemImage: iconName)
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
                Text(notification.plt_title ?? "알림")
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                if let content = notification.plt_content, !content.isEmpty {
                    Text(content)
                        .font(SMAPTheme.Font.secondary)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(notification.relativeTime)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if isUnread {
                Circle()
                    .fill(accent.base)
                    .frame(width: 7, height: 7)
                    .padding(.top, 7)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) {
            Divider().padding(.leading, 52)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityValue(isUnread ? Text("읽지 않음") : Text("읽음"))
    }
}
