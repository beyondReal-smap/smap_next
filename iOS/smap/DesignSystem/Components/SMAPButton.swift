import SwiftUI

struct SMAPButton: View {
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
            .padding(.vertical, 14)
            .background(backgroundColor)
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
        .opacity((isDisabled || isLoading) ? 0.6 : 1.0)
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
