import SwiftUI

struct SMAPButton: View {
    @Environment(\.smapAccent) private var accent
    enum Style { case primary, secondary, outline, danger }

    let title: String
    let style: Style
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    init(_ title: String, style: Style = .primary, isLoading: Bool = false, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: SMAPTheme.Spacing.sm) {
                if isLoading {
                    ProgressView().tint(foregroundColor)
                }
                Text(title).font(SMAPTheme.Font.bodyBold)
            }
            .frame(maxWidth: .infinity)
            // 높이를 고정값으로 맞춘다(Android SmapButton 52dp 와 동일). 글자 크기에 따라 버튼 높이가 달라지던 것을 방지.
            .frame(minHeight: 52)
            // 주 버튼은 브랜드 남색 그라데이션(Android SmapButton 과 동일) — 단색은 밋밋하다는 피드백(2026-11-16)
            .background {
                if style == .primary {
                    accent.gradient
                } else {
                    backgroundColor
                }
            }
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
            .overlay {
                if style == .outline {
                    RoundedRectangle(cornerRadius: SMAPTheme.Radius.md)
                        .stroke(SMAPTheme.Color.primary, lineWidth: 1)
                }
            }
        }
        .disabled(isDisabled || isLoading)
        // 로딩 중에는 흐리게 하지 않는다. "눌렸다"는 것이 보여야 하고, 비활성과 구분되어야 한다.
        .opacity(isDisabled ? 0.5 : 1.0)
        .accessibilityLabel(isLoading ? "\(title), 처리 중" : title)
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: return SMAPTheme.Color.primary
        case .secondary: return SMAPTheme.Color.inputBackground
        case .outline: return .clear
        case .danger: return SMAPTheme.Color.error
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .primary, .danger: return SMAPTheme.Color.white
        case .secondary: return SMAPTheme.Color.textPrimary
        case .outline: return SMAPTheme.Color.primary
        }
    }
}
