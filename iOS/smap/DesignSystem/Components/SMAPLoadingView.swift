import SwiftUI

struct SMAPLoadingView: View {
    var message: String?

    var body: some View {
        VStack(spacing: SMAPTheme.Spacing.md) {
            ProgressView()
                .controlSize(.large)
                .tint(SMAPTheme.Color.primary)
            if let message {
                Text(message)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
