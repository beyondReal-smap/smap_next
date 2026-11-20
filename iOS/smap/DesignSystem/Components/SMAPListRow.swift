import SwiftUI

// MARK: - 목록 행·구역 (Android SmapListRow.kt 이식)
//
// 화면마다 카드 안에 카드를 쌓던 것을 "회색 바탕 + 작은 제목 + 흰 묶음 + 한 가지 행"으로 통일한다.

/// 목록 한 줄 — 왼쪽(아바타·아이콘) · 제목/보조 줄 · 오른쪽(값·스위치·화살표).
struct SMAPListRow<Leading: View, Trailing: View>: View {
    @Environment(\.smapAccent) private var accent
    let title: String
    var subtitle: String? = nil
    var selected: Bool = false
    var destructive: Bool = false
    var action: (() -> Void)? = nil
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        if let action {
            Button(action: action) { row }
                .buttonStyle(SMAPRowButtonStyle())
        } else {
            row
        }
    }

    private var row: some View {
        HStack(spacing: 12) {
            leading()
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(destructive ? SMAPTheme.Color.error : SMAPTheme.Surface.onSurface)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, 10)
        .frame(minHeight: 60)
        .background(selected ? accent.container.opacity(0.55) : Color.clear)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

extension SMAPListRow where Leading == EmptyView {
    init(title: String, subtitle: String? = nil, selected: Bool = false, destructive: Bool = false,
         action: (() -> Void)? = nil, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.init(title: title, subtitle: subtitle, selected: selected, destructive: destructive, action: action,
                  leading: { EmptyView() }, trailing: trailing)
    }
}

extension SMAPListRow where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil, selected: Bool = false, destructive: Bool = false,
         action: (() -> Void)? = nil, @ViewBuilder leading: @escaping () -> Leading) {
        self.init(title: title, subtitle: subtitle, selected: selected, destructive: destructive, action: action,
                  leading: leading, trailing: { EmptyView() })
    }
}

/// 눌렀을 때 옅은 회색으로 바뀌는 행 버튼
private struct SMAPRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? SMAPTheme.Surface.variant : Color.clear)
    }
}

/// 행 왼쪽 아이콘 원. [emphasized] 면 남색 그라데이션 원 + 흰 아이콘 — 그 화면의 주인공 항목에 써서 목록에 무게를 준다.
struct SMAPRowIcon: View {
    @Environment(\.smapAccent) private var accent
    let systemImage: String
    var emphasized: Bool = false

    var body: some View {
        ZStack {
            if emphasized {
                Circle().fill(accent.gradient)
            } else {
                Circle().fill(accent.container)
            }
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(emphasized ? Color.white : accent.base)
        }
        .frame(width: 40, height: 40)
        .accessibilityHidden(true)
    }
}

/// 위험 동작(삭제·나가기·로그아웃) 행 왼쪽 아이콘 — 연한 빨강 원 + 빨강 아이콘.
/// 그룹 상세에만 있던 것을 계정설정 로그아웃과 함께 쓰려고 공용으로 옮겼다.
struct SMAPDangerIcon: View {
    let systemImage: String

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(SMAPTheme.Color.error)
            .frame(width: 40, height: 40)
            .background(SMAPTheme.Color.error.opacity(0.08), in: Circle())
            .accessibilityHidden(true)
    }
}

/// 구역 — 회색 배경 위 "작은 제목 + 흰 묶음". [action] 은 제목 오른쪽 글자 버튼.
struct SMAPSection<Content: View, Action: View>: View {
    var title: String? = nil
    @ViewBuilder var action: () -> Action
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            if title != nil || Action.self != EmptyView.self {
                HStack {
                    Text(title ?? "")
                        .font(SMAPTheme.Font.captionBold)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 0)
                    action()
                }
                .padding(.leading, 4)
            }
            VStack(spacing: 0, content: content)
                .frame(maxWidth: .infinity)
                .background(SMAPTheme.Surface.card, in: RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg, style: .continuous))
                .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg, style: .continuous))
        }
    }
}

extension SMAPSection where Action == EmptyView {
    init(title: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.init(title: title, action: { EmptyView() }, content: content)
    }
}

/// 묶음 안 행 사이 구분선 — 왼쪽 아이콘 뒤에서 시작해 정렬선을 맞춘다.
struct SMAPRowDivider: View {
    var inset: Bool = true

    var body: some View {
        Rectangle()
            .fill(SMAPTheme.Surface.divider)
            .frame(height: 0.5)
            .padding(.leading, inset ? 68 : 16)
    }
}

/// 남색 글자 알약 (예: "일정 3") — 연한 남색 바탕
struct SMAPCountPill: View {
    @Environment(\.smapAccent) private var accent
    let text: String

    var body: some View {
        Text(text)
            .font(SMAPTheme.Font.captionBold)
            .foregroundStyle(accent.base)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(accent.container, in: Capsule())
    }
}

// MARK: - 일정 줄 (Android SmapScheduleRow 이식)

/// 일정 한 줄 — 왼쪽 시각(시작·끝)과 강조색 세로 막대, 가운데 세 줄:
/// 제목 / 멤버(얼굴·이름) + 반복 칩 / 장소(핀). 오른쪽 위는 진행 중일 때만 강조 표시.
/// 일정 탭 목록과 홈 시트 "오늘의 일정"이 함께 쓴다 — 모델이 서로 달라(Schedule / SmapSchedule) 값으로 받는다.
/// 2026-11-20: 이전엔 "멤버 · 장소 · 반복"을 부제 한 줄에 이어 붙여 길면 잘리고 무엇이 무엇인지 읽기 어려웠다.
struct SMAPScheduleRow: View {
    struct Member {
        let name: String
        let photo: String?
        let id: Int?
    }

    @Environment(\.smapAccent) private var accent
    /// "15:30" — 종일이면 무시
    let start: String?
    let end: String?
    let allDay: Bool
    let title: String
    var member: Member? = nil
    var place: String? = nil
    var repeatText: String? = nil
    var isDone: Bool = false
    /// 값이 있으면 제목 오른쪽에 강조 배지("진행 중")
    var ongoingText: String? = nil
    /// nil 이면 누를 수 없는 줄(누름 표시도 없음)
    var action: (() -> Void)? = nil

    var body: some View {
        if let action {
            Button(action: action) { row }
                .buttonStyle(SMAPRowButtonStyle())
        } else {
            row
        }
    }

    private var row: some View {
        HStack(alignment: .top, spacing: 12) {
            // 시각
            VStack(alignment: .leading, spacing: 2) {
                Text(allDay ? "종일" : (start ?? "-"))
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(isDone ? SMAPTheme.Surface.onSurfaceMuted : accent.base)
                if !allDay, let end {
                    Text(end)
                        .font(SMAPTheme.Font.captionSmall)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
            }
            .monospacedDigit()
            .frame(width: 48, alignment: .leading)

            // 시간 막대 — 목록이 하루 시간표처럼 읽히게. 끝난 일정은 회색.
            RoundedRectangle(cornerRadius: 1.5)
                .fill(isDone ? SMAPTheme.Surface.divider : accent.base)
                .frame(width: 3)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(title)
                        .font(SMAPTheme.Font.bodyBold)
                        .foregroundStyle(isDone ? SMAPTheme.Surface.onSurfaceMuted : SMAPTheme.Surface.onSurface)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let ongoingText {
                        // 진행 중은 지금 봐야 할 일정이라 강조색으로 채워 목록에서 가장 먼저 보이게 한다.
                        Text(ongoingText)
                            .font(SMAPTheme.Font.captionBold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(accent.gradient, in: Capsule())
                            .fixedSize()
                    }
                }
                if member != nil || repeatText != nil {
                    HStack(spacing: 8) {
                        if let member {
                            HStack(spacing: 6) {
                                SMAPAvatar(name: member.name, imagePath: member.photo, size: 20, memberID: member.id)
                                Text(member.name)
                                    .font(SMAPTheme.Font.caption)
                                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                                    .lineLimit(1)
                            }
                        }
                        if let repeatText {
                            Label(repeatText, systemImage: "repeat")
                                .labelStyle(.titleAndIcon)
                                .font(SMAPTheme.Font.captionSmall)
                                .foregroundStyle(accent.deep)
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(accent.container, in: Capsule())
                        }
                    }
                }
                if let place {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin")
                            .font(.system(size: 11, weight: .semibold))
                        Text(place).lineLimit(1)
                    }
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
            }
        }
        .padding(.horizontal, SMAPTheme.Spacing.md)
        .padding(.vertical, 12)
        .frame(minHeight: 60)
        .contentShape(Rectangle())
        // 버튼 안쪽에서 하나로 묶어야 한 줄이 한 번만 읽힌다(바깥에 달면 버튼과 묶음이 따로 잡혔다).
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spokenText)
    }

    /// "15:30 ~ 18:00, 수학학원, 민지, 장소 공덕 수학학원, 반복 매주, 진행 중" 처럼 한 번에 읽는다.
    private var spokenText: String {
        let time = allDay ? "종일" : [start, end.map { "~ \($0)" }].compactMap { $0 }.joined(separator: " ")
        return [
            time.isEmpty ? nil : time,
            title,
            member?.name,
            place.map { "장소 \($0)" },
            repeatText.map { "반복 \($0)" },
            ongoingText,
        ].compactMap { $0 }.joined(separator: ", ")
    }
}
