//
// FocusableTextField.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - Custom TextField with Focus State (iOS 13+)

struct FocusableTextField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalizationType: UITextAutocapitalizationType = .none
    var autocorrectionDisabled: Bool = true
    @State private var isFocused: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(isFocused ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                .frame(width: 20)

            TextField(placeholder, text: $text, onEditingChanged: { editing in
                withAnimation(.easeInOut(duration: 0.2)) {
                    isFocused = editing
                }
            })
            .font(.suite(size: 16))
            .keyboardType(keyboardType)
            .autocapitalization(autocapitalizationType) // use older API for better FocusableTextField compatibility if needed, or textInputAutocapitalization
            .disableAutocorrection(autocorrectionDisabled)
        }
        .padding(.horizontal, 16)
        .frame(height: 56) // 고정 높이
        .background(SMAPTheme.Color.inputBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isFocused ? SMAPTheme.Color.primary : SMAPTheme.Color.border, lineWidth: isFocused ? 2 : 1)
        )
    }
}
