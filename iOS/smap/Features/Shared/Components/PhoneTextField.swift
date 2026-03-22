//
// PhoneTextField.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import UIKit

// MARK: - Phone Number TextField with Auto Hyphenation (iOS 13+ / UIViewRepresentable)
// Handles cursor jumping issue by managing formatting at the UITextField level.
struct PhoneTextField: UIViewRepresentable {
    @Binding var text: String
    let placeholder: String
    var onEditingChanged: ((Bool) -> Void)? = nil

    class Coordinator: NSObject, UITextFieldDelegate {
        @Binding var text: String
        var onEditingChanged: ((Bool) -> Void)?

        init(text: Binding<String>, onEditingChanged: ((Bool) -> Void)?) {
            _text = text
            self.onEditingChanged = onEditingChanged
        }

        @objc func textFieldDidChange(_ textField: UITextField) {
            let digits = (textField.text ?? "").filter { $0.isNumber }.prefix(11)
            let formatted = formatPhone(String(digits))

            // Calculate cursor offset from the end to maintain position
            let selectedRange = textField.selectedTextRange
            let cursorOffsetFromEnd = textField.offset(from: textField.endOfDocument, to: selectedRange?.end ?? textField.endOfDocument)

            textField.text = formatted
            self.text = String(digits) // Update binding with digits only

            // Restore cursor position
            if let newPosition = textField.position(from: textField.endOfDocument, offset: cursorOffsetFromEnd) {
                textField.selectedTextRange = textField.textRange(from: newPosition, to: newPosition)
            }
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            onEditingChanged?(true)
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            onEditingChanged?(false)
        }

        private func formatPhone(_ value: String) -> String {
            let limited = String(value.prefix(11))
            switch limited.count {
            case 0...3:
                return limited
            case 4...6:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                return "\(limited[..<index1])-\(limited[index1...])"
            case 7...10:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                let index2 = limited.index(limited.startIndex, offsetBy: 6)
                return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
            default:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                let index2 = limited.index(limited.startIndex, offsetBy: 7)
                return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onEditingChanged: onEditingChanged)
    }

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.keyboardType = .numberPad
        textField.delegate = context.coordinator
        textField.font = UIFont(name: "SUITE-Regular", size: 16)
        textField.addTarget(context.coordinator, action: #selector(Coordinator.textFieldDidChange(_:)), for: .editingChanged)

        // Initial text
        let digits = text.filter { $0.isNumber }
        textField.text = formatPhone(String(digits.prefix(11)))

        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        let digits = text.filter { $0.isNumber }
        let formatted = formatPhone(String(digits.prefix(11)))
        if uiView.text != formatted {
            uiView.text = formatted
        }
    }

    private func formatPhone(_ value: String) -> String {
        let limited = String(value.prefix(11))
        switch limited.count {
        case 0...3: return limited
        case 4...6:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            return "\(limited[..<index1])-\(limited[index1...])"
        case 7...10:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            let index2 = limited.index(limited.startIndex, offsetBy: 6)
            return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
        default:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            let index2 = limited.index(limited.startIndex, offsetBy: 7)
            return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
        }
    }
}
