//
// EditProfileView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

/// 프로필 편집 — 36단계: 이메일 변경·회원탈퇴와 같은 "제목 + 설명 + 입력창 + 아래 버튼" 폼 화면 (Android EditProfileScreen 과 같은 구성).
///
/// 이전에는 행마다 남색·주황·분홍·보라 아이콘 상자 + 생년월일·성별 켜기 스위치 + 결과 알림창이었다.
/// 생년월일은 칸을 누르면 고르는 창이 뜨고, 성별은 반반 나눈 두 칸에서 고른다(고르지 않으면 보내지 않음).
/// 결과는 알림창 대신 버튼 위 배너로 보여 주고, 성공하면 잠깐 뒤 이전 화면으로 돌아간다.
struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.smapAccent) private var accent
    @ObservedObject var authService = AuthService.shared

    @State private var name: String = ""
    @State private var nickname: String = ""
    /// nil 이면 입력하지 않음(서버에 보내지 않는다)
    @State private var birthDate: Date?
    @State private var gender: Int?

    @State private var showingBirthPicker = false
    @State private var pickerDate = EditProfileView.defaultBirthDate
    @State private var isLoading = false
    @State private var successMessage: String?
    @State private var errorMessage: String?

    /// 생년월일을 처음 고를 때 달력이 열리는 날짜
    private static let defaultBirthDate = DateFormatter.yyyyMMdd.date(from: "1990-01-01") ?? Date()

    init() {
        if let user = AuthService.shared.currentUser {
            _name = State(initialValue: user.mt_name ?? "")
            _nickname = State(initialValue: user.mt_nickname ?? "")
            _birthDate = State(initialValue: user.mt_birth.flatMap { DateFormatter.yyyyMMdd.date(from: $0) })
            _gender = State(initialValue: user.mt_gender.flatMap { $0 == 1 || $0 == 2 ? $0 : nil })
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
                Text("프로필을 수정해 주세요")
                    .font(SMAPTheme.Font.title)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
                Text("닉네임은 그룹 멤버에게 보이는 이름이에요.")
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)

                VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
                    SMAPTextField("이름을 입력하세요", text: $name, label: "이름", textContentType: .name, submitLabel: .next)
                    SMAPTextField("닉네임을 입력하세요", text: $nickname, label: "닉네임", textContentType: .nickname)
                }
                .padding(.top, SMAPTheme.Spacing.md)

                Text("선택 정보")
                    .font(SMAPTheme.Font.captionBold)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
                    .padding(.top, SMAPTheme.Spacing.md)

                birthField
                genderField
            }
            .padding(SMAPTheme.Spacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(SMAPTheme.Adaptive.pageBackground.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("프로필 편집").font(SMAPTheme.Font.bodyBold)
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
        .sheet(isPresented: $showingBirthPicker) { birthPickerSheet }
        // 성공 안내를 잠깐 보여 준 뒤 이전 화면으로 돌아간다(이메일 변경 화면과 같다).
        .task(id: successMessage) {
            guard successMessage != nil else { return }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            dismiss()
        }
    }

    // MARK: 생년월일 — 입력창 모양의 칸, 누르면 고르는 창

    private var birthField: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Text("생년월일")
                .font(SMAPTheme.Font.captionMedium)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
            Button {
                hideKeyboard()
                pickerDate = birthDate ?? Self.defaultBirthDate
                showingBirthPicker = true
            } label: {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    Image(systemName: "calendar")
                        .foregroundStyle(SMAPTheme.Color.textSecondary)
                    Text(birthDate.map { DateFormatter.yyyyMMdd.string(from: $0) } ?? "선택")
                        .font(SMAPTheme.Font.body)
                        .foregroundStyle(birthDate == nil ? SMAPTheme.Color.textSecondary : SMAPTheme.Color.textPrimary)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(SMAPTheme.Color.textSecondary)
                }
                .padding(.horizontal, SMAPTheme.Spacing.md)
                .frame(minHeight: 52)
                .background(SMAPTheme.Color.inputBackground, in: RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("생년월일, \(birthDate.map { DateFormatter.yyyyMMdd.string(from: $0) } ?? "선택 안 함")")
        }
    }

    private var birthPickerSheet: some View {
        VStack(spacing: SMAPTheme.Spacing.md) {
            Text("생년월일")
                .font(SMAPTheme.Font.bodyBold)
                .padding(.top, SMAPTheme.Spacing.lg)
            DatePicker("생년월일", selection: $pickerDate, in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "ko_KR"))
            SMAPButton("선택") {
                birthDate = pickerDate
                showingBirthPicker = false
            }
            .padding(.horizontal, SMAPTheme.Spacing.lg)
            Spacer(minLength: 0)
        }
        .presentationDetents([.height(380)])
        .smapAccent(accent)
    }

    // MARK: 성별 — 반반 나눈 두 칸

    private var genderField: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Text("성별")
                .font(SMAPTheme.Font.captionMedium)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
                .padding(.top, SMAPTheme.Spacing.xs)
            HStack(spacing: SMAPTheme.Spacing.sm) {
                genderOption("남성", value: 1)
                genderOption("여성", value: 2)
            }
        }
    }

    private func genderOption(_ title: String, value: Int) -> some View {
        let selected = gender == value
        return Button {
            HapticManager.shared.selection()
            gender = value
        } label: {
            Text(title)
                .font(selected ? SMAPTheme.Font.bodyBold : SMAPTheme.Font.body)
                .foregroundStyle(selected ? Color.white : SMAPTheme.Color.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(selected ? accent.base : SMAPTheme.Color.inputBackground, in: RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: 아래 — 결과 배너 + 저장

    private var bottomBar: some View {
        VStack(spacing: SMAPTheme.Spacing.sm) {
            if let successMessage {
                SMAPBanner(message: successMessage, tone: .success)
            } else if let errorMessage {
                SMAPBanner(message: errorMessage, tone: .error)
            }
            SMAPButton("저장", isLoading: isLoading, isDisabled: !canSave) { handleSave() }
        }
        .padding(SMAPTheme.Spacing.lg)
        .background(SMAPTheme.Adaptive.pageBackground)
    }

    private var canSave: Bool {
        successMessage == nil && !name.trimmingCharacters(in: .whitespaces).isEmpty && !nickname.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func handleSave() {
        isLoading = true
        errorMessage = nil
        HapticManager.shared.impact(style: .light)
        hideKeyboard()
        let birthStr = birthDate.map { DateFormatter.yyyyMMdd.string(from: $0) }

        Task {
            do {
                let response = try await authService.updateProfile(name: name, nickname: nickname, birth: birthStr, gender: gender)
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
