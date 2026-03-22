//
// EditProfileView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct EditProfileView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared

    @State private var name: String = ""
    @State private var nickname: String = ""
    @State private var birthDate: Date = Date()
    @State private var gender: Int = 1

    @State private var provideBirthDate: Bool = false
    @State private var provideGender: Bool = false

    @State private var isLoading: Bool = false
    @State private var showAlert: Bool = false
    @State private var alertMessage: String = ""

    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    init() {
        if let user = AuthService.shared.currentUser {
            _name = State(initialValue: user.mt_name ?? "")
            _nickname = State(initialValue: user.mt_nickname ?? "")
            if let birthStr = user.mt_birth, let date = DateFormatter.yyyyMMdd.date(from: birthStr) {
                _birthDate = State(initialValue: date)
                _provideBirthDate = State(initialValue: true)
            } else {
                _provideBirthDate = State(initialValue: false)
            }
            if let userGender = user.mt_gender {
                _gender = State(initialValue: userGender)
                _provideGender = State(initialValue: true)
            } else {
                _provideGender = State(initialValue: false)
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Profile Avatar Section
                VStack(spacing: 12) {
                    if let user = authService.currentUser {
                        if let avatarUrl = AuthService.getProfileImageURL(user.mt_file1) {
                            AsyncImage(url: avatarUrl) { phase in
                                if let image = phase.image {
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } else {
                                    Image(systemName: "person.circle.fill")
                                        .resizable()
                                        .foregroundColor(.gray.opacity(0.3))
                                }
                            }
                            .frame(width: 80, height: 80)
                            .clipShape(Circle())
                        } else {
                            Image(systemName: "person.circle.fill")
                                .resizable()
                                .frame(width: 80, height: 80)
                                .foregroundColor(.gray.opacity(0.3))
                        }

                        Text(user.displayName)
                            .font(.suite(size: 18, weight: .bold))
                            .foregroundColor(.primary)
                    }
                }
                .padding(.vertical, 20)

                // Form Fields
                VStack(spacing: 0) {
                    ProfileFormRow(icon: "person.fill", iconColor: brandColor, label: "이름", text: $name, placeholder: "이름을 입력하세요")
                    Divider().padding(.leading, 52)
                    ProfileFormRow(icon: "at", iconColor: .orange, label: "닉네임", text: $nickname, placeholder: "닉네임을 입력하세요")
                }
                .background(Color(UIColor.systemBackground))
                .cornerRadius(12)
                .padding(.horizontal, 16)

                // Birthday & Gender
                VStack(spacing: 0) {
                    HStack(spacing: 12) {
                        Image(systemName: "calendar")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.pink)
                            .cornerRadius(6)

                        Text("생년월일 (선택)")
                            .font(.suite(size: 16))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                            .layoutPriority(1)
                            .frame(width: 150, alignment: .leading)

                        Spacer()

                        Toggle("", isOn: $provideBirthDate)
                            .labelsHidden()
                            .scaleEffect(0.8)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(height: 52)

                    if provideBirthDate {
                        HStack {
                            Spacer()
                            DatePicker("", selection: $birthDate, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                                .accentColor(brandColor)
                                .fixedSize()
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                    }

                    Divider().padding(.leading, 52)

                    HStack(spacing: 12) {
                        Image(systemName: "person.2.fill")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.purple)
                            .cornerRadius(6)

                        Text("성별 (선택)")
                            .font(.suite(size: 16))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                            .layoutPriority(1)
                            .frame(width: 150, alignment: .leading)

                        Spacer()

                        Toggle("", isOn: $provideGender)
                            .labelsHidden()
                            .scaleEffect(0.8)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                    if provideGender {
                        HStack {
                            Spacer()
                            HStack(spacing: 8) {
                                GenderChip(title: "남성", isSelected: gender == 1) { gender = 1 }
                                GenderChip(title: "여성", isSelected: gender == 2) { gender = 2 }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                    }
                }
                .background(Color(UIColor.systemBackground))
                .cornerRadius(12)
                .padding(.horizontal, 16)

                Spacer(minLength: 30)

                // Save Button
                Button(action: handleSave) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .padding(.trailing, 8)
                        }
                        Text("저장하기")
                            .font(.suite(size: 17, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(canSave ? brandColor : Color.gray.opacity(0.3))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(!canSave || isLoading)
                .padding(.horizontal, 16)
                .padding(.bottom, 30)
            }
        }
        .background(Color(UIColor.secondarySystemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("프로필 편집")
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
                title: Text("알림"),
                message: Text(alertMessage),
                dismissButton: .default(Text("확인")) {
                    if alertMessage.contains("성공") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            )
        }
    }

    private var canSave: Bool {
        !name.isEmpty && !nickname.isEmpty
    }

    private func handleSave() {
        isLoading = true
        let birthStr = provideBirthDate ? dateFormatter.string(from: birthDate) : nil
        let genderVal = provideGender ? gender : nil

        Task {
            do {
                let response = try await authService.updateProfile(
                    name: name,
                    nickname: nickname,
                    birth: birthStr,
                    gender: genderVal
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

struct ProfileFormRow: View {
    let icon: String
    let iconColor: Color
    let label: String
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)

            Text(label)
                .font(.suite(size: 16))
                .foregroundColor(.primary)
                .lineLimit(1)
                .layoutPriority(1)
                .frame(width: 100, alignment: .leading)

            TextField(placeholder, text: $text)
                .font(.suite(size: 16))
                .foregroundColor(.primary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

struct GenderChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.suite(size: 14, weight: .medium))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? brandColor : Color.gray.opacity(0.15))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

struct EditProfileTextField: View {
    let label: String
    @Binding var text: String
    let placeholder: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.suite(size: 14, weight: .medium))
                .foregroundColor(.gray)

            TextField(placeholder, text: $text)
                .font(.suite(size: 16))
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
        }
    }
}

struct GenderSelectionButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.suite(size: 16, weight: .medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(isSelected ? Color.indigo : Color(UIColor.secondarySystemBackground))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? Color.indigo : Color.clear, lineWidth: 1)
                )
        }
    }
}
