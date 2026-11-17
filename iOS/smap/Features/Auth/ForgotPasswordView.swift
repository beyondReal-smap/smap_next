//
// ForgotPasswordView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - ForgotPasswordView

/// 비밀번호 찾기 — 가입 화면(`NativeRegisterView`)과 같은 구성(상단 바 + 진행 표시, 머리말, `SMAPTextField`, 하단 고정 `SMAPButton`).
/// 이메일 경로와 전화번호(SMS) 경로가 같은 디자인을 쓴다.
struct ForgotPasswordView: View {
    @StateObject private var viewModel = ForgotPasswordViewModel()
    @Environment(\.dismiss) var dismiss
    /// 서버 실패·틀린 인증번호·429 같은 오류를 알럿 대신 화면 안에 보여 주기 위한 표시용 문구.
    @State private var inlineError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                SMAPTheme.Color.white.ignoresSafeArea()

                VStack(spacing: 0) {
                    navigationBar

                    if viewModel.currentStep != .complete {
                        ProgressView(value: currentProgress, total: 1.0)
                            .accentColor(SMAPTheme.Color.primary)
                            .scaleEffect(x: 1, y: 0.5, anchor: .center)
                    }

                    if viewModel.currentStep == .complete {
                        completeStepView
                    } else {
                        ScrollView {
                            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                                switch viewModel.currentStep {
                                case .phone:
                                    phoneStepView
                                case .verification:
                                    verificationStepView
                                case .newPassword:
                                    newPasswordStepView
                                case .complete:
                                    EmptyView()
                                }
                            }
                            .padding(SMAPTheme.Spacing.lg)
                        }
                        .scrollDismissesKeyboard(.interactively)

                        SMAPButton(
                            primaryButtonTitle,
                            isLoading: viewModel.isLoading,
                            isDisabled: !isPrimaryEnabled,
                            action: primaryAction
                        )
                        .padding()
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            // 뷰모델이 알럿용으로 올리는 오류를 화면 안 표시로 돌린다(뷰모델 로직은 그대로).
            .onChange(of: viewModel.showError) { _, newValue in
                guard newValue else { return }
                inlineError = viewModel.errorMessage ?? "오류가 발생했어요. 잠시 후 다시 시도해 주세요."
                viewModel.showError = false
            }
            .onChange(of: viewModel.currentStep) { _, _ in inlineError = nil }
            .onChange(of: viewModel.phoneNumber) { _, _ in inlineError = nil }
            .onChange(of: viewModel.verificationCode) { _, _ in inlineError = nil }
            .onChange(of: viewModel.newPassword) { _, _ in inlineError = nil }
            .onChange(of: viewModel.confirmPassword) { _, _ in inlineError = nil }
        }
    }

    // MARK: - Navigation

    private var navigationBar: some View {
        HStack {
            if viewModel.currentStep != .complete {
                Button(action: goBack) {
                    Image(systemName: "chevron.left")
                        .font(.suite(size: 20, weight: .semibold))
                        .foregroundColor(SMAPTheme.Color.textPrimary)
                }
                .accessibilityLabel("뒤로")
            }

            Spacer()

            Text("비밀번호 찾기")
                .font(SMAPTheme.Font.headline)
                .foregroundColor(SMAPTheme.Color.textPrimary)

            Spacer()

            // 제목을 가운데에 두기 위한 균형용 빈 뷰
            if viewModel.currentStep != .complete {
                Image(systemName: "chevron.left")
                    .font(.suite(size: 20, weight: .semibold))
                    .foregroundColor(.clear)
            }
        }
        .padding()
    }

    private func goBack() {
        switch viewModel.currentStep {
        case .phone, .complete: dismiss()
        case .verification: viewModel.currentStep = .phone
        case .newPassword: viewModel.currentStep = .verification
        }
    }

    private var currentProgress: Double {
        switch viewModel.currentStep {
        case .phone: return 0.25
        case .verification: return 0.5
        case .newPassword: return 0.75
        case .complete: return 1.0
        }
    }

    // MARK: - Primary button

    private var primaryButtonTitle: String {
        switch viewModel.currentStep {
        case .phone: return "인증번호 받기"
        case .verification: return "확인"
        case .newPassword: return "비밀번호 변경"
        case .complete: return "로그인하러 가기"
        }
    }

    private var isPrimaryEnabled: Bool {
        switch viewModel.currentStep {
        case .phone: return viewModel.isIdentifierValid
        case .verification: return viewModel.verificationCode.count == 6
        case .newPassword: return !isResetDisabled
        case .complete: return true
        }
    }

    private func primaryAction() {
        switch viewModel.currentStep {
        case .phone: viewModel.checkUserAndSendCode()
        case .verification: viewModel.verifyCode()
        case .newPassword: viewModel.resetPassword()
        case .complete: dismiss()
        }
    }

    // MARK: - Step Views

    private var phoneStepView: some View {
        Group {
            StepHeader(
                title: "이메일을 입력해 주세요",
                description: "가입할 때 쓴 주소로 인증번호를 보내 드려요."
            )

            SMAPTextField(
                "name@example.com",
                text: $viewModel.phoneNumber,
                label: "이메일",
                errorMessage: inlineError,
                keyboardType: .emailAddress,
                textContentType: .username
            )
            .padding(.top, SMAPTheme.Spacing.md)
        }
    }

    private var verificationStepView: some View {
        let resendWait = viewModel.remainingResendTime()
        let canResend = viewModel.canResend() && !viewModel.isLoading
        let expired = viewModel.verificationTimer <= 0
        let isPhone = viewModel.isPhoneInput

        return Group {
            StepHeader(
                title: "인증번호를 입력해 주세요",
                description: isPhone
                    ? "\(viewModel.phoneNumber)\n문자로 보낸 6자리 숫자를 입력해 주세요."
                    : "\(viewModel.phoneNumber)\n위 주소로 보낸 6자리 숫자를 입력해 주세요."
            )

            SMAPTextField(
                "6자리 숫자",
                text: $viewModel.verificationCode,
                label: "인증번호",
                // 남은 시간은 입력칸 바로 아래 도움말로 둔다(오류처럼 보이지 않게 보조 글자색).
                helperText: expired ? nil : "남은 시간 \(timeString(viewModel.verificationTimer))",
                errorMessage: inlineError ?? (expired ? "인증번호가 만료됐어요. 다시 받아 주세요." : nil),
                keyboardType: .numberPad,
                textContentType: .oneTimeCode
            )
            .padding(.top, SMAPTheme.Spacing.md)

            HStack {
                Text(isPhone ? "문자가 오지 않았나요?" : "메일이 오지 않았나요?")
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
                Spacer()
                Button {
                    viewModel.checkUserAndSendCode()
                } label: {
                    Text(resendWait > 0 ? "다시 받기 (\(resendWait)초)" : "인증번호 다시 받기")
                        .font(SMAPTheme.Font.secondaryMedium)
                        .foregroundStyle(canResend ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .disabled(!canResend)
            }

            if !isPhone {
                SMAPBanner(message: "메일이 보이지 않으면 스팸함을 확인해 주세요.")
            }
        }
    }

    private var newPasswordStepView: some View {
        Group {
            StepHeader(
                title: "새 비밀번호를 정해 주세요",
                description: "8자 이상, 영문 대소문자·숫자·특수문자를 모두 포함해 주세요."
            )

            if let inlineError {
                SMAPBanner(message: inlineError, tone: .error)
                    .padding(.top, SMAPTheme.Spacing.sm)
            }

            SMAPTextField(
                "새 비밀번호",
                text: $viewModel.newPassword,
                label: "새 비밀번호",
                isSecure: true,
                textContentType: .newPassword
            )
            .padding(.top, SMAPTheme.Spacing.md)

            // 가입 화면의 규칙 칩(`PasswordRuleItem`)을 재사용
            VStack(alignment: .leading, spacing: 4) {
                Text("비밀번호 규칙")
                    .font(.suite(size: 12, weight: .medium))
                    .foregroundColor(SMAPTheme.Color.textSecondary)
                HStack(spacing: 12) {
                    PasswordRuleItem(text: "8자 이상", isValid: viewModel.isPasswordLengthValid)
                    PasswordRuleItem(text: "영문 대소문자", isValid: viewModel.hasPasswordLetter)
                    PasswordRuleItem(text: "숫자", isValid: viewModel.hasPasswordNumber)
                    PasswordRuleItem(text: "특수문자", isValid: viewModel.hasPasswordSpecialChar)
                }
            }

            SMAPTextField(
                "비밀번호 다시 입력",
                text: $viewModel.confirmPassword,
                label: "비밀번호 확인",
                errorMessage: (!viewModel.confirmPassword.isEmpty && viewModel.newPassword != viewModel.confirmPassword)
                    ? "비밀번호가 일치하지 않아요." : nil,
                isSecure: true
            )
            .padding(.top, SMAPTheme.Spacing.sm)
        }
    }

    private var isResetDisabled: Bool {
        !viewModel.isPasswordRulesSatisfied || viewModel.newPassword != viewModel.confirmPassword
    }

    private var completeStepView: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: SMAPTheme.Spacing.md) {
                Image(systemName: "checkmark.circle.fill")
                    .resizable()
                    .frame(width: 80, height: 80)
                    .foregroundColor(SMAPTheme.Color.primary)
                    .accessibilityHidden(true)

                Text("비밀번호를 바꿨어요")
                    .font(SMAPTheme.Font.title)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)

                Text("새 비밀번호로 로그인해 주세요.")
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)

                if viewModel.isPhoneInput {
                    Text("이메일을 등록해 두면 다음에는 이메일로 찾을 수 있어요.")
                        .font(SMAPTheme.Font.caption)
                        .foregroundStyle(SMAPTheme.Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, SMAPTheme.Spacing.lg)

            Spacer()

            SMAPButton("로그인하러 가기", action: { dismiss() })
                .padding()
        }
    }

    private func timeString(_ time: Int) -> String {
        String(format: "%d:%02d", time / 60, time % 60)
    }
}

/// 단계 공통 머리말(제목 + 설명). 가입 화면의 `RegisterStepHeader` 와 같은 스타일.
private struct StepHeader: View {
    let title: String
    let description: String

    var body: some View {
        Text(title)
            .font(SMAPTheme.Font.title)
            .foregroundStyle(SMAPTheme.Color.textPrimary)
        Text(description)
            .font(SMAPTheme.Font.secondary)
            .foregroundStyle(SMAPTheme.Color.textSecondary)
    }
}
