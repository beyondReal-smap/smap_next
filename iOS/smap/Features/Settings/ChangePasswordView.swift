//
// ChangePasswordView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

/// 비밀번호 변경 — 36단계: 이메일 변경·회원탈퇴와 같은 "제목 + 설명 + 입력창 + 아래 버튼" 폼 화면 (Android ChangePasswordScreen 과 같은 구성).
///
/// 이전에는 남색 그라데이션 머리 카드 + 칸마다 색 아이콘 + 결과 알림창이었다.
/// 조건 목록을 서버 검사(POST /members/change-password)와 맞췄다: 이전 목록은 소문자만 있어도 "영문" 통과로 표시해
/// 화면에선 다 맞았는데 서버가 "대문자를 포함해야 합니다"로 거절할 수 있었다.
struct ChangePasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var authService = AuthService.shared

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    @State private var isLoading = false
    @State private var successMessage: String?
    @State private var errorMessage: String?

    /// 서버가 받는 특수문자 — 서버 검사와 같은 목록
    private static let serverSpecialChars = "@$!%*?&"

    private var rules: [(title: String, met: Bool)] {
        [
            ("8자 이상", newPassword.count >= 8),
            ("영문 대문자", newPassword.contains { ("A"..."Z").contains($0) }),
            ("영문 소문자", newPassword.contains { ("a"..."z").contains($0) }),
            ("숫자", newPassword.contains { ("0"..."9").contains($0) }),
            ("특수문자 (\(Self.serverSpecialChars))", newPassword.contains { Self.serverSpecialChars.contains($0) }),
        ]
    }
    private var isPasswordStrong: Bool { rules.allSatisfy(\.met) }
    private var isPasswordMatch: Bool { !newPassword.isEmpty && newPassword == confirmPassword }

    /// 소셜 로그인 회원(mt_type 1 이 아님)은 비밀번호가 없다
    private var isSocialUser: Bool {
        guard let type = authService.currentUser?.mt_type else { return false }
        return type != 1
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                if isSocialUser {
                    socialUserNotice
                } else {
                    form
                }
            }
            .padding(SMAPTheme.Spacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("비밀번호 변경").font(SMAPTheme.Font.bodyBold)
            }
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { hideKeyboard(); dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold))
                        Text("뒤로").font(SMAPTheme.Font.bodyBold)
                    }
                    .foregroundStyle(SMAPTheme.Surface.onSurface)
                }
            }
        }
        // 성공 안내를 잠깐 보여 준 뒤 이전 화면으로 돌아간다(이메일 변경 화면과 같다).
        .task(id: successMessage) {
            guard successMessage != nil else { return }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            dismiss()
        }
    }

    @ViewBuilder
    private var form: some View {
        Text("새 비밀번호를 설정해 주세요")
            .font(SMAPTheme.Font.pageTitle)
            .foregroundStyle(.primary)
        Text("영문 대·소문자, 숫자, 특수문자를 섞어 8자 이상으로 만들어 주세요.")
            .font(SMAPTheme.Font.secondary)
            .foregroundStyle(SMAPTheme.Color.textSecondary)

        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
            SMAPTextField("현재 비밀번호를 입력하세요", text: $currentPassword, label: "현재 비밀번호", isSecure: true, textContentType: .password, submitLabel: .next)
            SMAPTextField("새 비밀번호", text: $newPassword, label: "새 비밀번호", isSecure: true, textContentType: .newPassword, submitLabel: .next)
            SMAPTextField(
                "새 비밀번호를 한 번 더 입력하세요",
                text: $confirmPassword,
                label: "새 비밀번호 확인",
                errorMessage: !confirmPassword.isEmpty && !isPasswordMatch ? "새 비밀번호와 달라요" : nil,
                isSecure: true,
                textContentType: .newPassword
            )
        }
        .padding(.top, SMAPTheme.Spacing.md)

        // 조건 목록 — 처음부터 보여 주고, 맞춘 조건은 초록 체크로 바뀐다.
        VStack(alignment: .leading, spacing: 8) {
            ForEach(rules, id: \.title) { rule in
                ruleRow(rule.title, met: rule.met)
            }
            ruleRow("새 비밀번호 확인 일치", met: isPasswordMatch)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(SMAPTheme.Spacing.md)
        .background(SMAPTheme.Color.inputBackground, in: RoundedRectangle(cornerRadius: 12))
        .padding(.top, SMAPTheme.Spacing.sm)
    }

    private func ruleRow(_ title: String, met: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 16))
                .foregroundStyle(met ? SMAPTheme.Color.success : SMAPTheme.Surface.outline)
            Text(title)
                .font(SMAPTheme.Font.caption)
                .foregroundStyle(met ? SMAPTheme.Color.textPrimary : SMAPTheme.Color.textSecondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) \(met ? "충족" : "미충족")")
    }

    /// 소셜 로그인 회원 안내 — 비밀번호는 그 서비스(카카오·Apple·Google)에서 관리한다.
    private var socialUserNotice: some View {
        VStack(spacing: SMAPTheme.Spacing.sm) {
            SMAPRowIcon(systemImage: "shield")
                .scaleEffect(1.8)
                .frame(width: 72, height: 72)
                .padding(.bottom, SMAPTheme.Spacing.sm)
            Text("비밀번호를 바꿀 수 없는 계정이에요")
                .font(SMAPTheme.Font.pageTitle)
                .foregroundStyle(.primary)
            Text("카카오·Apple·Google 계정으로 로그인했다면 그 서비스의 설정에서 비밀번호를 관리해 주세요.")
                .font(SMAPTheme.Font.secondary)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, SMAPTheme.Spacing.xl)
    }

    // MARK: 아래 — 결과 배너 + 버튼

    private var bottomBar: some View {
        VStack(spacing: SMAPTheme.Spacing.sm) {
            if let successMessage {
                SMAPBanner(message: successMessage, tone: .success)
            } else if let errorMessage {
                SMAPBanner(message: errorMessage, tone: .error)
            }
            if isSocialUser {
                SMAPButton("돌아가기") { dismiss() }
            } else {
                SMAPButton("비밀번호 변경", isLoading: isLoading, isDisabled: !canSave) { handleSave() }
            }
        }
        .padding(SMAPTheme.Spacing.lg)
        .background(Color(uiColor: .systemBackground))
    }

    private var canSave: Bool {
        successMessage == nil && !currentPassword.isEmpty && isPasswordStrong && isPasswordMatch
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func handleSave() {
        isLoading = true
        errorMessage = nil
        HapticManager.shared.impact(style: .light)
        hideKeyboard()

        Task {
            do {
                let response = try await authService.changePassword(current: currentPassword, new: newPassword)
                await MainActor.run {
                    isLoading = false
                    HapticManager.shared.notification(type: response.success ? .success : .error)
                    if response.success {
                        successMessage = response.message
                    } else {
                        errorMessage = response.message
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    HapticManager.shared.notification(type: .error)
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}
