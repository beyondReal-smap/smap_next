//
// NativeRegisterView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - Register Steps Views

// MARK: - Terms View
struct RegisterTermsView: View {
    @ObservedObject var viewModel: RegisterViewModel
    let allAgreed: Bool
    let toggleAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            RegisterPhotoHeader(image: "LoginArrivalDoorway", title: "이용 약관을\n확인해 주세요", height: 176)
            Button(action: toggleAll) {
                HStack(spacing: 12) {
                    Image(systemName: allAgreed ? "checkmark.circle.fill" : "circle")
                    Text("전체 동의하기").font(.suite(size: 17, weight: .bold))
                    Spacer()
                }
                .padding(.horizontal, 16)
                .frame(minHeight: 54)
                .foregroundStyle(SMAPAccent.family.deep)
                .background(SMAPAccent.family.container, in: RoundedRectangle(cornerRadius: 14))
            }
            .accessibilityValue(allAgreed ? "선택됨" : "선택 안 됨")

            VStack(spacing: 0) {
                ToggleRow(title: "서비스 이용약관", required: true, isChecked: $viewModel.registerData.mt_agree1, termsDestination: AnyView(ServiceTermsView()))
                ToggleRow(title: "개인정보 처리방침", required: true, isChecked: $viewModel.registerData.mt_agree2, termsDestination: AnyView(PrivacyPolicyView()))
                ToggleRow(title: "위치기반서비스 이용약관", required: true, isChecked: $viewModel.registerData.mt_agree3, termsDestination: AnyView(LocationTermsView()))
                Divider().padding(.vertical, 4)
                ToggleRow(title: "개인정보 제3자 제공 동의", required: false, isChecked: $viewModel.registerData.mt_agree4, termsDestination: AnyView(ThirdPartyProvisionView()))
                ToggleRow(title: "마케팅 정보 수신 동의", required: false, isChecked: $viewModel.registerData.mt_agree5, termsDestination: AnyView(MarketingConsentView()))
            }
        }
    }
}

struct ToggleRow: View {
    let title: String
    let required: Bool
    @Binding var isChecked: Bool
    let termsDestination: AnyView
    @State private var showTerms = false

    var body: some View {
        HStack(spacing: 0) {
            Button { isChecked.toggle() } label: {
                HStack(spacing: 8) {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(isChecked ? SMAPAccent.family.base : .secondary)
                        .font(.system(size: 19))
                    Text(required ? "필수" : "선택")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundStyle(.secondary)
                    Text(title).font(.suite(size: 15, weight: .medium))
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: 48)
                .contentShape(Rectangle())
            }
            .accessibilityLabel("\(required ? "필수" : "선택") \(title)")
            .accessibilityValue(isChecked ? "선택됨" : "선택 안 됨")
            Button { showTerms = true } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 44, height: 48)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("\(title) 보기")
        }
        .sheet(isPresented: $showTerms) {
            NavigationStack { termsDestination }
                .presentationDragIndicator(.visible)
        }
    }
}

private struct RegisterPhotoHeader: View {
    let image: String
    let title: String
    let height: CGFloat

    var body: some View {
        Text(title)
            .font(.suite(size: 29, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .frame(minHeight: height, alignment: .bottomLeading)
            .background {
                GeometryReader { geometry in
                    Image(image).resizable().scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                        .overlay(LinearGradient(colors: [.clear, .black.opacity(0.68)], startPoint: .top, endPoint: .bottom))
                        .accessibilityHidden(true)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Email View
// 구조체 이름의 "Phone" 은 SMS 인증 시절의 이름이다. 호출부가 같은 이름을 쓰고 있어 그대로 두었다.
/// 가입 1단계 — 로그인 ID 가 될 이메일을 입력한다. Android `PhoneContent` 와 같은 구성.
struct RegisterPhoneView: View {
    @ObservedObject var viewModel: RegisterViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            RegisterStepHeader(
                title: "어떤 이메일로 가입할까요?",
                description: "로그인에 사용할 이메일로 인증번호를 보내드려요."
            )

            SMAPTextField(
                "name@example.com",
                text: Binding(get: { viewModel.registerData.mt_id }, set: { viewModel.updateEmail($0) }),
                label: "이메일",
                keyboardType: .emailAddress,
                textContentType: .emailAddress
            )
            .padding(.top, SMAPTheme.Spacing.md)

            Spacer()
        }
    }
}

// MARK: - Verification View
/// 가입 2단계 — 메일로 받은 6자리 인증번호를 입력한다.
struct RegisterVerificationView: View {
    @ObservedObject var viewModel: RegisterViewModel

    var body: some View {
        let resendWait = viewModel.remainingResendTime()
        let canResend = viewModel.canResend() && !viewModel.isVerificationLoading
        let expired = viewModel.verificationTimer <= 0

        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            RegisterStepHeader(
                title: "인증번호를 입력해 주세요",
                description: "\(viewModel.registerData.mt_id)로 보낸 숫자 6자리를 입력해 주세요."
            )

            SMAPTextField(
                "6자리 숫자",
                text: $viewModel.verificationCode,
                label: "인증번호",
                // 남은 시간을 입력창 바로 아래에 두어, 만료 여부를 입력하면서 볼 수 있게 한다.
                helperText: expired ? nil : "남은 시간 \(timeString(time: viewModel.verificationTimer))",
                errorMessage: expired ? "인증번호가 만료됐어요. 다시 받아 주세요." : nil,
                keyboardType: .numberPad,
                textContentType: .oneTimeCode // 키보드 상단 '코드 자동 채우기' 활성화
            )
            .padding(.top, SMAPTheme.Spacing.md)

            HStack {
                Text("메일이 오지 않았나요?")
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
                Spacer()
                Button {
                    viewModel.resendVerificationCode()
                } label: {
                    // 대기 중에는 몇 초 뒤에 누를 수 있는지 알려 준다.
                    Text(resendWait > 0 ? "다시 받기 (\(resendWait)초)" : "인증번호 다시 받기")
                        .font(SMAPTheme.Font.secondaryMedium)
                        .foregroundStyle(canResend ? SMAPAccent.family.base : .secondary)
                        .frame(minHeight: 44) // 글자만 누르는 버튼이라 터치 영역을 44pt 로 보장
                        .contentShape(Rectangle())
                }
                .disabled(!canResend)
            }

            SMAPBanner(message: "메일이 보이지 않으면 스팸함을 확인해 주세요.")

            Spacer()
        }
    }

    func timeString(time: Int) -> String {
        let minutes = time / 60
        let seconds = time % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

/// 가입 단계 공통 머리말(제목 + 설명).
private struct RegisterStepHeader: View {
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.suite(size: 28, weight: .bold))
                .tracking(-0.6)
                .accessibilityAddTraits(.isHeader)
            Text(description)
                .font(SMAPTheme.Font.secondary)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Basic Info View
struct RegisterBasicInfoView: View {
    @ObservedObject var viewModel: RegisterViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            RegisterStepHeader(title: "계정 정보를 입력해 주세요", description: "닉네임은 가족에게 보이는 이름이에요.")
            SMAPTextField("이름 입력", text: $viewModel.registerData.mt_name, label: "이름", textContentType: .name)
            SMAPTextField("닉네임 입력", text: $viewModel.registerData.mt_nickname, label: "닉네임", textContentType: .nickname)
            SMAPTextField("숫자만 입력", text: Binding(
                get: { viewModel.optionalPhone },
                set: { viewModel.optionalPhone = String($0.filter { $0.isNumber }.prefix(11)) }
            ), label: "전화번호 (선택)", keyboardType: .phonePad, textContentType: .telephoneNumber)

            Divider()
            SMAPTextField("새 비밀번호", text: Binding(
                get: { viewModel.registerData.mt_pwd ?? "" },
                set: { viewModel.registerData.mt_pwd = $0 }
            ), label: "비밀번호", isSecure: true, textContentType: .newPassword)
            PasswordRulesView(password: viewModel.registerData.mt_pwd ?? "", viewModel: viewModel)
            SMAPTextField("비밀번호 다시 입력", text: $viewModel.passwordConfirm, label: "비밀번호 확인",
                          helperText: !viewModel.passwordConfirm.isEmpty && viewModel.passwordConfirm == viewModel.registerData.mt_pwd ? "비밀번호가 일치해요." : nil,
                          errorMessage: !viewModel.passwordConfirm.isEmpty && viewModel.passwordConfirm != viewModel.registerData.mt_pwd ? "비밀번호가 일치하지 않아요." : nil,
                          isSecure: true, textContentType: .newPassword)
        }
    }
}

// MARK: - Password Rules View
struct PasswordRulesView: View {
    let password: String
    @ObservedObject var viewModel: RegisterViewModel
    
    var body: some View {
        let details = viewModel.passwordValidationDetails(password)
        
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 95), alignment: .leading)], alignment: .leading, spacing: 6) {
            PasswordRuleItem(text: "8자 이상", isValid: details.hasMinLength)
            PasswordRuleItem(text: "영문 대소문자", isValid: details.hasLetter)
            PasswordRuleItem(text: "숫자", isValid: details.hasNumber)
            PasswordRuleItem(text: "특수문자", isValid: details.hasSpecialChar)
        }
    }
}

struct PasswordRuleItem: View {
    let text: String
    let isValid: Bool
    
    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .font(.suite(size: 10))
                .foregroundColor(isValid ? .green : SMAPTheme.Color.textSecondary)
            Text(text)
                .font(.suite(size: 11))
                .foregroundColor(isValid ? .green : SMAPTheme.Color.textSecondary)
        }
    }
}

// MARK: - Profile View
struct RegisterProfileView: View {
    @ObservedObject var viewModel: RegisterViewModel
    @State private var birthDate: Date = {
        var components = DateComponents()
        components.year = 2000
        components.month = 1
        components.day = 1
        return Calendar.current.date(from: components) ?? Date()
    }()
    
    // 생년월일 입력 여부 (Apple 가이드라인 대응)
    @State private var provideBirthDate: Bool = false
    @State private var provideGender: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            RegisterStepHeader(title: "프로필을 채워볼까요?", description: "생년월일과 성별은 선택 사항이에요. 비워 두고 가입할 수 있어요.")
            VStack(alignment: .leading, spacing: 12) {
                Toggle("생년월일", isOn: $provideBirthDate)
                    .font(.suite(size: 17, weight: .semibold))
                    .frame(minHeight: 48)
                if provideBirthDate {
                    DatePicker("생년월일 선택", selection: $birthDate, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.compact)
                    if let birth = viewModel.registerData.mt_birth, !birth.isEmpty, !viewModel.validateBirthDate(birth) {
                        Text("생년월일을 확인해 주세요.").font(SMAPTheme.Font.caption).foregroundStyle(SMAPTheme.Color.error)
                    }
                }
                Divider()
                Toggle("성별", isOn: $provideGender)
                    .font(.suite(size: 17, weight: .semibold))
                    .frame(minHeight: 48)
                if provideGender {
                    HStack(spacing: 10) {
                        GenderButton(title: "남성", isSelected: viewModel.registerData.mt_gender == 1) { viewModel.registerData.mt_gender = 1 }
                        GenderButton(title: "여성", isSelected: viewModel.registerData.mt_gender == 2) { viewModel.registerData.mt_gender = 2 }
                    }
                }
            }
            .padding(16)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        .onAppear {
            // 초기 로드 시 기존 데이터가 있으면 토글 활성화
            if let birth = viewModel.registerData.mt_birth, !birth.isEmpty {
                provideBirthDate = true
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                if let date = formatter.date(from: birth) {
                    self.birthDate = date
                }
            } else {
                provideBirthDate = false
            }
            
            if viewModel.registerData.mt_gender != nil {
                provideGender = true
            } else {
                provideGender = false
            }
        }
        .onChange(of: provideBirthDate) { _, newValue in
            if newValue {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                viewModel.registerData.mt_birth = formatter.string(from: birthDate)
            } else {
                viewModel.registerData.mt_birth = nil
            }
        }
        .onChange(of: provideGender) { _, newValue in
            if !newValue {
                viewModel.registerData.mt_gender = nil
            }
        }
        .onChange(of: birthDate) { _, newValue in
            if provideBirthDate {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                viewModel.registerData.mt_birth = formatter.string(from: newValue)
            }
        }
    }
}

struct GenderButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isSelected { Image(systemName: "checkmark") }
                Text(title)
            }
            .font(.suite(size: 16, weight: .medium))
            .frame(maxWidth: .infinity, minHeight: 48)
            .foregroundStyle(isSelected ? Color.white : .primary)
            .background(isSelected ? SMAPAccent.family.deep : Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 12))
        }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct RegisterCompleteView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            RegisterPhotoHeader(image: "LoginArrivalCycling", title: "가입을 마쳤어요", height: 300)
            Text("이제 가족과 위치와 일정을 공유할 수 있어요.")
                .font(SMAPTheme.Font.body)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Native Register View

struct NativeRegisterView: View {
    @StateObject private var viewModel = RegisterViewModel()
    @Environment(\.presentationMode) var presentationMode
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    
    // Callback when registration is complete or cancelled
    var onComplete: (() -> Void)?
    var socialData: [String: Any]?
    
    // 기존 가입자 발견 시 콜백 (전화번호와 함께 로그인 페이지로 이동)
    var onExistingUser: ((String) -> Void)?
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                if viewModel.currentStep != .complete {
                    Button {
                        if viewModel.currentStep == .terms { onComplete?() } else { viewModel.previousStep() }
                    } label: {
                        Image(systemName: "arrow.left").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("뒤로")
                }
                Text("회원가입").font(.suite(size: 18, weight: .bold))
                Spacer()
                if viewModel.currentStep != .complete {
                    Text("\(stage.title)  ·  \(stage.index)/4").font(SMAPTheme.Font.captionMedium).foregroundStyle(.secondary)
                }
            }
            .frame(minHeight: 48)
            if viewModel.currentStep != .complete {
                HStack(spacing: 5) {
                    ForEach(1...4, id: \.self) { index in
                        Capsule().fill(index <= stage.index ? SMAPAccent.family.base : Color(uiColor: .systemGray5)).frame(height: 3)
                    }
                }
                .accessibilityHidden(true)
            }
            ZStack {
                ScrollView {
                    Group {
                        switch viewModel.currentStep {
                        case .terms: RegisterTermsView(viewModel: viewModel, allAgreed: isAllTermsAgreed, toggleAll: toggleAllTerms)
                        case .phone: RegisterPhoneView(viewModel: viewModel)
                        case .verification: RegisterVerificationView(viewModel: viewModel)
                        case .basicInfo: RegisterBasicInfoView(viewModel: viewModel)
                        case .profile: RegisterProfileView(viewModel: viewModel)
                        case .complete: RegisterCompleteView()
                        }
                    }
                    .padding(.vertical, 22)
                }
                .id(viewModel.currentStep)
                .scrollBounceBehavior(.basedOnSize)
                .scrollDismissesKeyboard(.interactively)
                .transition(.opacity)
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: viewModel.currentStep)
            Button {
                switch viewModel.currentStep {
                case .phone: viewModel.sendVerificationCode()
                case .verification: viewModel.verifyCode()
                case .complete:
                    presentationMode.wrappedValue.dismiss()
                    onComplete?()
                default: viewModel.nextStep()
                }
            } label: {
                HStack {
                    if viewModel.isVerificationLoading || viewModel.isLoading { ProgressView().tint(.white) }
                    Text(nextButtonTitle).font(.suite(size: 17, weight: .bold))
                }
                .frame(maxWidth: .infinity, minHeight: 54)
                .foregroundStyle(isNextButtonEnabled ? .white : .secondary)
                .background(isNextButtonEnabled ? SMAPAccent.family.deep : Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(.vertical, 10)
            .disabled(!isNextButtonEnabled || viewModel.isVerificationLoading || viewModel.isLoading)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
        .buttonStyle(.plain)
        .smapAccent(.family)
        .toolbar(.hidden, for: .navigationBar)
        .alert("가입을 진행할 수 없어요", isPresented: $viewModel.showError) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage.flatMap { !$0.isEmpty && !$0.contains("알 수 없는 오류") ? $0 : nil } ?? "잠시 후 다시 시도해 주세요.")
        }
        .alert("알림", isPresented: $viewModel.socialSessionExpired) {
            Button("확인") { onComplete?() }
        } message: {
            Text("소셜 로그인을 다시 진행해 주세요")
        }
        .alert("알림", isPresented: $viewModel.showExistingUserAlert) {
            Button("확인", role: .cancel) {
                // 확인 버튼 누르면 로그인 페이지로 이동
                onExistingUser?(viewModel.existingUserPhone)
            }
        } message: {
            Text("이미 가입된 계정입니다.\n로그인 페이지로 이동합니다.")
        }
        .onAppear {
            if let socialData = socialData {
                viewModel.applySocialData(socialData)
            }
            
            // 기존 가입자 발견 시 콜백 연결
            viewModel.onExistingUserFound = { [onExistingUser] phone in
                onExistingUser?(phone)
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var stage: (title: String, index: Int) {
        switch viewModel.currentStep {
        case .terms: return ("약관 동의", 1)
        case .phone, .verification: return ("이메일 인증", 2)
        case .basicInfo: return ("계정 정보", 3)
        case .profile, .complete: return ("프로필", 4)
        }
    }

    var nextButtonTitle: String {
        switch viewModel.currentStep {
        case .terms: return "동의하고 계속하기"
        case .complete: return "시작하기"
        case .phone: return "인증번호 받기"
        case .verification: return "확인"
        case .profile: return "가입 완료"
        default: return "다음"
        }
    }
    
    var isNextButtonEnabled: Bool {
        switch viewModel.currentStep {
        case .terms: return viewModel.isTermsValid
        case .phone: return viewModel.isPhoneValid
        case .verification: return viewModel.verificationCode.count == 6
        case .basicInfo: return viewModel.isBasicInfoValid
        case .profile: return viewModel.isProfileValid
        case .complete: return true
        }
    }
    
    // 전체 약관 동의 여부
    var isAllTermsAgreed: Bool {
        return viewModel.registerData.mt_agree1 &&
               viewModel.registerData.mt_agree2 &&
               viewModel.registerData.mt_agree3 &&
               viewModel.registerData.mt_agree4 &&
               viewModel.registerData.mt_agree5
    }
    
    // 전체 약관 토글
    func toggleAllTerms() {
        let newValue = !isAllTermsAgreed
        viewModel.registerData.mt_agree1 = newValue
        viewModel.registerData.mt_agree2 = newValue
        viewModel.registerData.mt_agree3 = newValue
        viewModel.registerData.mt_agree4 = newValue
        viewModel.registerData.mt_agree5 = newValue
    }
}
