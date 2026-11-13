//
// ForgotPasswordView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - ForgotPasswordView

struct ForgotPasswordView: View {
    @StateObject private var viewModel = ForgotPasswordViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var isFocused = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.white.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Header
                    headerView
                    
                    ScrollView {
                        VStack(alignment: .leading, spacing: 30) {
                            // Step indicator and title
                            titleSection
                            
                            // Step-specific content
                            switch viewModel.currentStep {
                            case .phone:
                                phoneStepView
                            case .verification:
                                verificationStepView
                            case .newPassword:
                                newPasswordStepView
                            case .complete:
                                completeStepView
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                    }
                }
                
                if viewModel.isLoading {
                    Color.black.opacity(0.15)
                        .ignoresSafeArea()
                    ProgressView()
                        .scaleEffect(1.5)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(10)
                        .shadow(radius: 10)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .alert("알림", isPresented: $viewModel.showError) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "오류가 발생했습니다.")
            }
        }
    }
    
    // MARK: - Subviews
    
    private var headerView: some View {
        HStack {
            Button(action: {
                if viewModel.currentStep == .phone || viewModel.currentStep == .complete {
                    dismiss()
                } else if viewModel.currentStep == .verification {
                    viewModel.currentStep = .phone
                } else if viewModel.currentStep == .newPassword {
                    viewModel.currentStep = .verification
                }
            }) {
                Image(systemName: "chevron.left")
                    .font(.suite(size: 20, weight: .medium))
                    .foregroundColor(.black)
            }
            .accessibilityLabel("뒤로")
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
    
    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(stepTitle)
                .font(.suite(size: 28, weight: .bold))
                .foregroundColor(.black)
            
            Text(stepDescription)
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.gray)
                .lineLimit(2)
        }
    }
    
    private var stepTitle: String {
        switch viewModel.currentStep {
        case .phone: return "비밀번호 찾기"
        case .verification: return "인증번호 입력"
        case .newPassword: return "새 비밀번호 설정"
        case .complete: return "설정 완료"
        }
    }
    
    private var stepDescription: String {
        switch viewModel.currentStep {
        case .phone: return "가입하실 때 사용한 이메일을 입력해주세요."
        case .verification: return "\(viewModel.phoneNumber)로 발송된\n6자리 인증번호를 입력해주세요."
        case .newPassword: return "새로운 비밀번호를 설정해주세요."
        case .complete: return "비밀번호가 성공적으로 변경되었습니다."
        }
    }
    
    // MARK: - Step Views
    
    private var phoneStepView: some View {
        VStack(spacing: 40) {
            VStack(alignment: .leading, spacing: 10) {
                Text("이메일")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(.gray)
                
                TextField("이메일 주소", text: $viewModel.phoneNumber, onEditingChanged: { editing in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isFocused = editing
                    }
                })
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isFocused ? SMAPTheme.Color.primary : SMAPTheme.Color.primary.opacity(0.3), lineWidth: isFocused ? 2 : 1)
                    )
            }
            
            Button(action: {
                viewModel.checkUserAndSendCode()
            }) {
                Text("인증번호 받기")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(viewModel.phoneNumber.contains("@") ? SMAPTheme.Color.primary : Color.gray.opacity(0.3))
                    .cornerRadius(12)
            }
            .disabled(!viewModel.phoneNumber.contains("@") || viewModel.isLoading)
        }
    }
    
    private var verificationStepView: some View {
        VStack(spacing: 40) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("인증번호")
                        .font(.suite(size: 14, weight: .semibold))
                        .foregroundColor(.gray)
                    Spacer()
                    if viewModel.verificationTimer > 0 {
                        Text(String(format: "%d:%02d", viewModel.verificationTimer / 60, viewModel.verificationTimer % 60))
                            .font(.suite(size: 14, weight: .medium))
                            .foregroundColor(.red)
                    }
                }
                
                TextField("6자리 입력", text: $viewModel.verificationCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode) // SMS 인증코드 자동완성
                    .font(.suite(size: 18, weight: .medium))
                    .padding()
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(SMAPTheme.Color.primary.opacity(0.3), lineWidth: 1)
                    )
            }
            
            VStack(spacing: 16) {
                Button(action: {
                    viewModel.verifyCode()
                }) {
                    Text("인증하기")
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(viewModel.verificationCode.count == 6 ? SMAPTheme.Color.primary : Color.gray.opacity(0.3))
                        .cornerRadius(12)
                }
                .disabled(viewModel.verificationCode.count != 6)
                
                Button(action: {
                    viewModel.checkUserAndSendCode() // Resend
                }) {
                    Text("인증번호 재발송")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .underline()
                }
            }
        }
    }
    
    private var newPasswordStepView: some View {
        VStack(spacing: 30) {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("새 비밀번호")
                        .font(.suite(size: 14, weight: .semibold))
                        .foregroundColor(.gray)
                    
                    HStack {
                        if viewModel.showNewPassword {
                            TextField("8자 이상, 영문 대소문자/숫자/특수문자 포함", text: $viewModel.newPassword)
                                .textContentType(.newPassword)
                        } else {
                            SecureField("8자 이상, 영문 대소문자/숫자/특수문자 포함", text: $viewModel.newPassword)
                                .textContentType(.newPassword)
                        }
                        
                        Button(action: { viewModel.showNewPassword.toggle() }) {
                            Image(systemName: viewModel.showNewPassword ? "eye.slash.fill" : "eye.fill")
                                .foregroundColor(.gray)
                        }
                        .accessibilityLabel(viewModel.showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기")
                    }
                    .font(.suite(size: 18, weight: .medium))
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    
                    // Password Rules Guide
                    VStack(alignment: .leading, spacing: 6) {
                        ruleRow(text: "8자 이상", isValid: viewModel.isPasswordLengthValid)
                        ruleRow(text: "영문 대소문자 포함", isValid: viewModel.hasPasswordLetter)
                        ruleRow(text: "숫자 포함", isValid: viewModel.hasPasswordNumber)
                        ruleRow(text: "특수문자 포함", isValid: viewModel.hasPasswordSpecialChar)
                    }
                    .padding(.top, 4)
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("비밀번호 확인")
                        .font(.suite(size: 14, weight: .semibold))
                        .foregroundColor(.gray)
                    
                    HStack {
                        if viewModel.showConfirmPassword {
                            TextField("다시 입력해주세요", text: $viewModel.confirmPassword)
                        } else {
                            SecureField("다시 입력해주세요", text: $viewModel.confirmPassword)
                        }
                        
                        Button(action: { viewModel.showConfirmPassword.toggle() }) {
                            Image(systemName: viewModel.showConfirmPassword ? "eye.slash.fill" : "eye.fill")
                                .foregroundColor(.gray)
                        }
                        .accessibilityLabel(viewModel.showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기")
                    }
                    .font(.suite(size: 18, weight: .medium))
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    
                    if !viewModel.confirmPassword.isEmpty && viewModel.newPassword != viewModel.confirmPassword {
                        Text("비밀번호가 일치하지 않습니다.")
                            .font(.suite(size: 12))
                            .foregroundColor(.red)
                    } else {
                        // 공간 확보를 위한 투명 텍스트 또는 고정 높이
                        Text(" ")
                            .font(.suite(size: 12))
                    }
                }
                .frame(height: 100, alignment: .top) // 고정 높이로 밀림 방지
            }
            
            Button(action: {
                viewModel.resetPassword()
            }) {
                Text("비밀번호 변경")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(isResetDisabled ? Color.gray.opacity(0.3) : SMAPTheme.Color.primary)
                    .cornerRadius(12)
            }
            .disabled(isResetDisabled)
        }
    }
    
    private func ruleRow(text: String, isValid: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isValid ? .green : .gray.opacity(0.5))
                .font(.suite(size: 14))
            
            Text(text)
                .font(.suite(size: 13))
                .foregroundColor(isValid ? .primary : .gray)
        }
    }
    
    private var isResetDisabled: Bool {
        !viewModel.isPasswordRulesSatisfied || viewModel.newPassword != viewModel.confirmPassword
    }
    
    private var completeStepView: some View {
        VStack(spacing: 60) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.suite(size: 80))
                .foregroundColor(SMAPTheme.Color.primary)
            
            VStack(spacing: 12) {
                Text("완료되었습니다")
                    .font(.suite(size: 24, weight: .bold))
                Text("이제 새로운 비밀번호로 로그인해주세요.")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            Button(action: {
                dismiss()
            }) {
                Text("로그인하러 가기")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(SMAPTheme.Color.primary)
                    .cornerRadius(12)
            }
        }
        .frame(height: 500)
    }
}

