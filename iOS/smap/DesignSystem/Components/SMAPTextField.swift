import SwiftUI

struct SMAPTextField: View {
    let placeholder: String
    @Binding var text: String
    var errorMessage: String?
    var isSecure: Bool
    var keyboardType: UIKeyboardType
    var submitLabel: SubmitLabel

    init(_ placeholder: String, text: Binding<String>, errorMessage: String? = nil, isSecure: Bool = false, keyboardType: UIKeyboardType = .default, submitLabel: SubmitLabel = .done) {
        self.placeholder = placeholder
        self._text = text
        self.errorMessage = errorMessage
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.submitLabel = submitLabel
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                }
            }
            .font(SMAPTheme.Font.body)
            .padding(.horizontal, SMAPTheme.Spacing.md)
            .padding(.vertical, 14)
            .background(SMAPTheme.Color.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm))
            .overlay {
                RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm)
                    .stroke(errorMessage != nil ? SMAPTheme.Color.error : .clear, lineWidth: 1)
            }
            .submitLabel(submitLabel)

            if let error = errorMessage {
                Text(error)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Color.error)
            }
        }
    }
}
