import SwiftUI

// MARK: - 목록 행·구역 (Android SmapListRow.kt 이식)
//
// 화면마다 카드 안에 카드를 쌓던 것을 "회색 바탕 + 작은 제목 + 흰 묶음 + 한 가지 행"으로 통일한다.

/// 목록 한 줄 — 왼쪽(아바타·아이콘) · 제목/보조 줄 · 오른쪽(값·스위치·화살표).
struct SMAPListRow<Leading: View, Trailing: View>: View {
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
        .background(selected ? SMAPTheme.Surface.primaryContainer.opacity(0.55) : Color.clear)
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
    let systemImage: String
    var emphasized: Bool = false

    var body: some View {
        ZStack {
            if emphasized {
                Circle().fill(SMAPTheme.Navy.gradient)
            } else {
                Circle().fill(SMAPTheme.Surface.primaryContainer)
            }
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(emphasized ? Color.white : SMAPTheme.Navy.base)
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
    let text: String

    var body: some View {
        Text(text)
            .font(SMAPTheme.Font.captionBold)
            .foregroundStyle(SMAPTheme.Navy.base)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(SMAPTheme.Surface.primaryContainer, in: Capsule())
    }
}
