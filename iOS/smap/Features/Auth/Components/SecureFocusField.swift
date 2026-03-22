//
// SecureFocusField.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - SecureField with Focus handling (iOS 13+)
struct SecureFocusField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    var onFocusChange: (Bool) -> Void

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.isSecureTextEntry = true
        textField.delegate = context.coordinator
        textField.isSecureTextEntry = true
        textField.delegate = context.coordinator
        textField.font = UIFont(name: "SUITE-Regular", size: 16)
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
        textField.returnKeyType = .done

        textField.addTarget(context.coordinator, action: #selector(Coordinator.textFieldDidChange(_:)), for: .editingChanged)

        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UITextFieldDelegate {
        var parent: SecureFocusField

        init(parent: SecureFocusField) {
            self.parent = parent
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.onFocusChange(true)
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.onFocusChange(false)
        }

        @objc func textFieldDidChange(_ textField: UITextField) {
            parent.text = textField.text ?? ""
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            textField.resignFirstResponder()
            return true
        }
    }
}

struct FocusableSecureField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String
    @Binding var showPassword: Bool
    @State private var isFocused: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(isFocused ? BrandColors.primary : BrandColors.textSecondary)
                .frame(width: 20)

            ZStack(alignment: .leading) {
                if showPassword {
                    TextField(placeholder, text: $text, onEditingChanged: { editing in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isFocused = editing
                        }
                    })
                    .font(.suite(size: 16))
                    .frame(height: 24)
                } else {
                    // SecureField alternative that supports focus detection
                    SecureFocusField(placeholder: placeholder, text: $text) { editing in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isFocused = editing
                        }
                    }
                    .frame(height: 24)
                }
            }
            .frame(height: 24) // 고정 높이로 토글 시 높이 변화 방지

            Button(action: {
                showPassword.toggle()
            }) {
                Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                    .foregroundColor(BrandColors.textSecondary)
                    .frame(width: 20)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 56) // 고정 높이
        .background(BrandColors.inputBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isFocused ? BrandColors.primary : BrandColors.border, lineWidth: isFocused ? 2 : 1)
        )
    }
}
