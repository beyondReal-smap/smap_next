//
// InquiryView.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

struct InquiryView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var category = "general"
    @State private var email = ""
    @State private var subject = ""
    @State private var message = ""
    @State private var isSending = false
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var isSuccess = false

    private enum InquiryField: Hashable { case email, subject, message }
    @FocusState private var focusedField: InquiryField?

    private let botToken = "8110782503:AAFSLBB8NWjzZy3vhPZGJH4boVEM2y9h0HM"
    private let chatId = "6495247513"

    // SF Symbols — OS 일관성 + 접근성 라벨 자동 지원 + 다크모드 대응
    private let categories: [(id: String, name: String, icon: String)] = [
        ("general", "일반 문의", "bubble.left.fill"),
        ("technical", "기술 지원", "wrench.and.screwdriver.fill"),
        ("account", "계정 문제", "person.circle.fill"),
        ("billing", "결제 문의", "creditcard.fill")
    ]

    var body: some View {
        ZStack {
            SMAPTheme.Adaptive.pageBackground.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("1:1 문의").font(.suite(size: 20, weight: .bold)).foregroundColor(.white)
                                Text("궁금한 점을 문의하세요").font(.suite(size: 14)).foregroundColor(.white.opacity(0.8))
                            }
                            Spacer()
                            Image(systemName: "envelope.fill").font(.suite(size: 32)).foregroundColor(.white.opacity(0.3))
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(24)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [SMAPTheme.Accent.orange, SMAPTheme.Accent.pinkDeep]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(24).padding(.horizontal)

                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("문의 유형").font(.suite(size: 15, weight: .bold))
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(categories, id: \.id) { item in
                                    Button(action: {
                                        HapticManager.shared.selection()
                                        category = item.id
                                    }) {
                                        VStack(spacing: 6) {
                                            Image(systemName: item.icon)
                                                .font(.suite(size: 18, weight: .semibold))
                                            Text(item.name)
                                                .font(.suite(size: 13, weight: .medium))
                                                .lineLimit(1)
                                                .minimumScaleFactor(0.85)
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 14)
                                        .background(category == item.id ? SMAPTheme.Accent.orange.opacity(0.12) : Color.gray.opacity(0.05))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(category == item.id ? SMAPTheme.Accent.orange : Color.clear, lineWidth: 2)
                                        )
                                        .cornerRadius(12)
                                        .foregroundColor(category == item.id ? SMAPTheme.Accent.orange : .primary)
                                        .contentShape(Rectangle())
                                    }
                                    .accessibilityLabel(item.name)
                                    .accessibilityAddTraits(category == item.id ? [.isButton, .isSelected] : [.isButton])
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("이메일").font(.suite(size: 15, weight: .bold))
                            TextField("답변받을 이메일을 입력하세요", text: $email)
                                .font(.suite(size: 15))
                                .keyboardType(.emailAddress)
                                .textContentType(.emailAddress)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .email)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .subject }
                                .padding(.horizontal, 16).frame(height: 52)
                                .background(Color.white).cornerRadius(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(emailValidationBorderColor, lineWidth: 1))
                                .accessibilityLabel("답변 이메일")
                            if !email.isEmpty {
                                HStack(spacing: 6) {
                                    Image(systemName: isEmailValid ? "checkmark.circle.fill" : "exclamationmark.circle.fill").font(.suite(size: 12))
                                    Text(isEmailValid ? "올바른 이메일 형식입니다." : "올바른 이메일 형식이 아닙니다.").font(.suite(size: 12))
                                }
                                .foregroundColor(isEmailValid ? SMAPTheme.Color.success : SMAPTheme.Color.error)
                                .padding(.leading, 4)
                                .accessibilityElement(children: .combine)
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("제목").font(.suite(size: 15, weight: .bold))
                            TextField("문의 제목을 입력하세요", text: $subject)
                                .font(.suite(size: 15))
                                .focused($focusedField, equals: .subject)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .message }
                                .padding(.horizontal, 16).frame(height: 52)
                                .background(Color.white).cornerRadius(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                                .accessibilityLabel("문의 제목")
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("내용").font(.suite(size: 15, weight: .bold))
                            ZStack(alignment: .topLeading) {
                                if message.isEmpty {
                                    Text("문의 내용을 입력해주세요").font(.suite(size: 15)).foregroundColor(Color(UIColor.placeholderText))
                                        .padding(.horizontal, 12).padding(.vertical, 16).allowsHitTesting(false)
                                }
                                TextEditor(text: $message)
                                    .font(.suite(size: 15))
                                    .focused($focusedField, equals: .message)
                                    .frame(height: 150).padding(8)
                                    .hideScrollBackground().background(Color.clear)
                                    .accessibilityLabel("문의 내용")
                            }
                            .background(Color.white).cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                        }

                        Button(action: sendInquiry) {
                            HStack {
                                if isSending { ProgressView().tint(.white) }
                                else { Image(systemName: "paperplane.fill"); Text("문의 전송") }
                            }
                            .font(.suite(size: 16, weight: .bold)).foregroundColor(.white).frame(maxWidth: .infinity).padding()
                            .background(isFormValid ? SMAPTheme.Accent.orange : Color.gray.opacity(0.3))
                            .cornerRadius(16)
                        }
                        .disabled(!isFormValid || isSending)
                        .accessibilityLabel(isSending ? "전송 중" : "문의 전송")
                        .accessibilityHint(isFormValid ? "" : "필수 항목을 모두 입력하세요")
                    }.padding(.horizontal)
                }.padding(.vertical)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .navigationTitle("1:1 문의").navigationBarTitleDisplayMode(.inline).navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .principal) { Text("1:1 문의").font(.suite(size: 18, weight: .bold)) }
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: {
                    focusedField = nil
                    presentationMode.wrappedValue.dismiss()
                }) {
                    HStack(spacing: 4) { Image(systemName: "chevron.left").font(.suite(size: 18, weight: .semibold)); Text("뒤로").font(.suite(size: 18, weight: .bold)) }.foregroundColor(.primary)
                }
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("완료") { focusedField = nil }
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(SMAPTheme.Accent.orange)
            }
        }
        .alert(isSuccess ? "전송 완료" : "오류", isPresented: $showingAlert) {
            Button("확인", role: .cancel) {
                if isSuccess { presentationMode.wrappedValue.dismiss() }
            }
        } message: {
            Text(alertMessage)
        }
    }

    private var isEmailValid: Bool {
        let emailRegex = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        return NSPredicate(format: "SELF MATCHES %@", emailRegex).evaluate(with: email)
    }

    private var emailValidationBorderColor: Color {
        if email.isEmpty { return Color.gray.opacity(0.2) }
        return isEmailValid ? SMAPTheme.Color.success.opacity(0.5) : SMAPTheme.Color.error.opacity(0.5)
    }

    private var isFormValid: Bool { isEmailValid && !subject.isEmpty && !message.isEmpty }

    private func sendInquiry() {
        guard isFormValid else {
            HapticManager.shared.notification(type: .warning)
            return
        }
        isSending = true
        HapticManager.shared.impact(style: .light)

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy. M. d. a h:mm:ss"
        let dateString = formatter.string(from: Date())
        let categoryName = categories.first(where: { $0.0 == category })?.1 ?? category

        let text = "📨 새로운 1:1 문의\n\n📋 문의 유형: \(categoryName)\n📝 제목: \(subject)\n📧 이메일: \(email)\n\n💬 문의 내용:\n\(message)\n\n⏰ 접수 시간: \(dateString)"

        let urlString = "https://api.telegram.org/bot\(botToken)/sendMessage"
        guard let url = URL(string: urlString) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["chat_id": chatId, "text": text, "parse_mode": "HTML"]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                isSending = false
                if let error = error {
                    HapticManager.shared.notification(type: .error)
                    alertMessage = "전송 중 오류가 발생했습니다: \(error.localizedDescription)"
                    isSuccess = false
                    showingAlert = true
                } else if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        HapticManager.shared.notification(type: .success)
                        alertMessage = "문의가 성공적으로 전송되었습니다."
                        isSuccess = true
                        showingAlert = true
                        email = ""; subject = ""; message = ""
                    } else {
                        HapticManager.shared.notification(type: .error)
                        alertMessage = "전송에 실패했습니다. (Error: \(httpResponse.statusCode))"
                        isSuccess = false
                        showingAlert = true
                    }
                } else {
                    HapticManager.shared.notification(type: .error)
                    alertMessage = "알 수 없는 오류가 발생했습니다."
                    isSuccess = false
                    showingAlert = true
                }
            }
        }.resume()
    }
}
