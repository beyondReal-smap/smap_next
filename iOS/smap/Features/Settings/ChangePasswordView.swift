//
// ChangePasswordView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct ChangePasswordView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared

    @State private var currentPassword: String = ""
    @State private var newPassword: String = ""
    @State private var confirmPassword: String = ""

    @State private var isLoading: Bool = false
    @State private var showAlert: Bool = false
    @State private var alertMessage: String = ""

    // Password Strength
    private var isLengthValid: Bool { newPassword.count >= 8 && newPassword.count <= 20 }
    private var hasLetter: Bool { newPassword.rangeOfCharacter(from: .letters) != nil }
    private var hasNumber: Bool { newPassword.rangeOfCharacter(from: .decimalDigits) != nil }
    private var hasSpecial: Bool { newPassword.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*()-_=+[]{}|;:'\",.<>/?")) != nil }
    private var isPasswordStrong: Bool { isLengthValid && hasLetter && hasNumber && hasSpecial }
    private var isPasswordMatch: Bool { !newPassword.isEmpty && newPassword == confirmPassword }

    private var isSocialUser: Bool {
        guard let type = authService.currentUser?.mt_type else { return false }
        return type != 1
    }

    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if isSocialUser {
                    socialUserView
                        .padding(.top, 60)
                } else {
                    changePasswordForm
                }
            }
            .padding(.top, 20)
        }
        .background(Color(UIColor.secondarySystemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("비밀번호 변경")
                    .font(.suite(size: 18, weight: .bold))
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.suite(size: 18, weight: .semibold))
                        Text("뒤로")
                            .font(.suite(size: 18, weight: .bold))
                    }
                    .foregroundColor(.primary)
                }
            }
        }
        .alert(isPresented: $showAlert) {
            Alert(
                title: Text("알림").font(.suite(size: 17, weight: .bold)),
                message: Text(alertMessage).font(.suite(size: 15)),
                dismissButton: .default(Text("확인").font(.suite(size: 16, weight: .semibold))) {
                    if alertMessage.contains("성공") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            )
        }
    }

    private var socialUserView: some View {
        VStack(spacing: 24) {
            Image(systemName: "shield.slash")
                .font(.system(size: 60))
                .foregroundColor(.orange)

            Text("소셜 로그인 사용자는\n비밀번호를 변경할 수 없습니다.")
                .font(.suite(size: 20, weight: .bold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Text("Google 또는 Apple 계정을 통해 로그인하신 경우, 해당 서비스의 설정에서 비밀번호를 관리해 주세요.")
                .font(.suite(size: 15))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button(action: { presentationMode.wrappedValue.dismiss() }) {
                Text("뒤로 가기")
                    .font(.suite(size: 17, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(brandColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
        }
        .padding(24)
        .background(Color(UIColor.systemBackground))
        .cornerRadius(20)
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .padding(.horizontal, 16)
    }

    private var changePasswordForm: some View {
        VStack(spacing: 24) {
            // Header Card (Premium Gradient)
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("비밀번호 변경")
                            .font(.suite(size: 24, weight: .bold))
                            .foregroundColor(.white)

                        Text("보안을 위해 8~20자의 영문, 숫자,\n특수문자를 조합하여 설정해 주세요.")
                            .font(.suite(size: 14))
                            .foregroundColor(.white.opacity(0.85))
                            .lineSpacing(4)
                    }
                    Spacer()
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.white.opacity(0.3))
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [brandColor, Color(red: 102/255, green: 126/255, blue: 234/255)]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(24)
            .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
            .padding(.horizontal, 16)
            .padding(.top, 8)

            // Input Fields Card
            VStack(spacing: 20) {
                PasswordFormRow(icon: "lock.fill", iconColor: brandColor, label: "현재 비밀번호", text: $currentPassword, placeholder: "현재 비밀번호를 입력하세요")

                PasswordFormRow(icon: "key.fill", iconColor: brandColor, label: "새 비밀번호", text: $newPassword, placeholder: "새 비밀번호 (8-20자)")

                PasswordFormRow(icon: "checkmark.circle.fill", iconColor: .green, label: "새 비밀번호 확인", text: $confirmPassword, placeholder: "비밀번호를 한번 더 입력해 주세요")
            }
            .padding(20)
            .background(Color(UIColor.systemBackground))
            .cornerRadius(20)
            .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
            .padding(.horizontal, 16)

            // Password Strength Indicators
            VStack(alignment: .leading, spacing: 12) {
                Text("비밀번호 체크")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.primary)
                    .padding(.leading, 4)

                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 10) {
                        StrengthRow(title: "8-20자 이내", isValid: isLengthValid)
                        StrengthRow(title: "영문/숫자/특수문자", isValid: isPasswordStrong)
                    }
                    Spacer()
                    VStack(alignment: .leading, spacing: 10) {
                        StrengthRow(title: "비밀번호 일치", isValid: isPasswordMatch)
                        Spacer().frame(height: 12)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(UIColor.systemBackground))
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
            }
            .padding(.horizontal, 16)

            // Action Button
            Button(action: handleSave) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .padding(.trailing, 8)
                    }
                    Text("비밀번호 변경 완료")
                        .font(.suite(size: 17, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(canSave ? brandColor : Color.gray.opacity(0.3))
                .foregroundColor(.white)
                .cornerRadius(12)
                .shadow(color: canSave ? brandColor.opacity(0.2) : Color.clear, radius: 8, x: 0, y: 4)
            }
            .disabled(!canSave || isLoading)
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
        }
    }

    private var canSave: Bool {
        !currentPassword.isEmpty && isPasswordStrong && isPasswordMatch
    }

    private func handleSave() {
        isLoading = true

        Task {
            do {
                let response = try await authService.changePassword(
                    current: currentPassword,
                    new: newPassword
                )

                await MainActor.run {
                    isLoading = false
                    alertMessage = response.message
                    showAlert = true
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    alertMessage = error.localizedDescription
                    showAlert = true
                }
            }
        }
    }
}

struct PasswordFormRow: View {
    let icon: String
    let iconColor: Color
    let label: String
    @Binding var text: String
    let placeholder: String
    @State private var isVisible: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(iconColor)
                Text(label)
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.primary)
            }
            .padding(.leading, 4)

            ZStack(alignment: .trailing) {
                if isVisible {
                    TextField(placeholder, text: $text)
                        .autocapitalization(.none)
                } else {
                    SecureField(placeholder, text: $text)
                        .autocapitalization(.none)
                }

                Button(action: { isVisible.toggle() }) {
                    Image(systemName: isVisible ? "eye.slash.fill" : "eye.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.gray.opacity(0.5))
                        .padding(10)
                }
            }
            .font(.suite(size: 15))
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(UIColor.secondarySystemBackground).opacity(0.5))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.gray.opacity(0.1), lineWidth: 1)
            )
        }
    }
}

struct StrengthRow: View {
    let title: String
    let isValid: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 12))
                .foregroundColor(isValid ? .green : .gray.opacity(0.5))
            Text(title)
                .font(.suite(size: 12))
                .foregroundColor(isValid ? .green : .gray)
        }
        .padding(.leading, 4)
    }
}
