import SwiftUI

/// 앱 공용 입력창. Android `SmapTextField` 와 같은 규격(라벨 / 입력 / 도움말·오류).
///
/// 오류를 알럿이 아니라 입력창 바로 아래에 보여 어느 칸이 문제인지 알 수 있게 한다.
/// `isSecure` 이면 보기/숨기기 토글을 함께 제공한다.
struct SMAPTextField: View {
    let placeholder: String
    @Binding var text: String
    var label: String?
    var helperText: String?
    var errorMessage: String?
    var isSecure: Bool
    var keyboardType: UIKeyboardType
    var contentType: UITextContentType?
    var submitLabel: SubmitLabel
    var onSubmit: (() -> Void)?

    @State private var isRevealed = false
    @FocusState private var isFocused: Bool

    init(
        _ placeholder: String,
        text: Binding<String>,
        label: String? = nil,
        helperText: String? = nil,
        errorMessage: String? = nil,
        isSecure: Bool = false,
        keyboardType: UIKeyboardType = .default,
        textContentType: UITextContentType? = nil,
        submitLabel: SubmitLabel = .done,
        onSubmit: (() -> Void)? = nil
    ) {
        self.placeholder = placeholder
        self._text = text
        self.label = label
        self.helperText = helperText
        self.errorMessage = errorMessage
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.contentType = textContentType
        self.submitLabel = submitLabel
        self.onSubmit = onSubmit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            if let label {
                Text(label)
                    .font(SMAPTheme.Font.captionMedium)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }

            HStack(spacing: SMAPTheme.Spacing.sm) {
                Group {
                    if isSecure && !isRevealed {
                        SecureField(placeholder, text: $text)
                    } else {
                        TextField(placeholder, text: $text)
                            .keyboardType(keyboardType)
                    }
                }
                .font(SMAPTheme.Font.body)
                .textContentType(contentType)
                // 이메일·비밀번호는 자동 대문자·자동 수정이 입력을 망가뜨린다.
                .textInputAutocapitalization(usesPlainInput ? .never : .sentences)
                .autocorrectionDisabled(usesPlainInput)
                .focused($isFocused)
                .submitLabel(submitLabel)
                .onSubmit { onSubmit?() }

                if isSecure {
                    Button {
                        isRevealed.toggle()
                    } label: {
                        Image(systemName: isRevealed ? "eye.slash" : "eye")
                            .foregroundStyle(SMAPTheme.Color.textSecondary)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(isRevealed ? "비밀번호 숨기기" : "비밀번호 보기")
                }
            }
            .padding(.leading, SMAPTheme.Spacing.md)
            .padding(.trailing, isSecure ? 0 : SMAPTheme.Spacing.md)
            .frame(minHeight: 52)
            .background(SMAPTheme.Color.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
            .overlay {
                RoundedRectangle(cornerRadius: SMAPTheme.Radius.md)
                    .stroke(borderColor, lineWidth: 1)
            }

            if let supporting = errorMessage ?? helperText {
                Text(supporting)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(errorMessage != nil ? SMAPTheme.Color.error : SMAPTheme.Color.textSecondary)
            }
        }
    }

    private var usesPlainInput: Bool {
        isSecure || keyboardType == .emailAddress || keyboardType == .numberPad || keyboardType == .phonePad
    }

    private var borderColor: Color {
        if errorMessage != nil { return SMAPTheme.Color.error }
        return isFocused ? SMAPTheme.Color.primary : .clear
    }
}
