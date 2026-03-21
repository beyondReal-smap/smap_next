import SwiftUI

struct SMAPSnackBar: ViewModifier {
    @Binding var isPresented: Bool
    let message: String
    let duration: TimeInterval

    init(isPresented: Binding<Bool>, message: String, duration: TimeInterval = 3.0) {
        self._isPresented = isPresented
        self.message = message
        self.duration = duration
    }

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if isPresented {
                Text(message)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.white)
                    .padding(.horizontal, SMAPTheme.Spacing.lg)
                    .padding(.vertical, SMAPTheme.Spacing.md)
                    .background(Color.black.opacity(0.85))
                    .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm))
                    .padding(.horizontal, SMAPTheme.Spacing.md)
                    .padding(.bottom, SMAPTheme.Spacing.xl)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task {
                        try? await Task.sleep(for: .seconds(duration))
                        withAnimation { isPresented = false }
                    }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: isPresented)
    }
}

extension View {
    func smapSnackBar(isPresented: Binding<Bool>, message: String, duration: TimeInterval = 3.0) -> some View {
        modifier(SMAPSnackBar(isPresented: isPresented, message: message, duration: duration))
    }
}
