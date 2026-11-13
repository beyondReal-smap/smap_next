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
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("서비스 이용을 위해\n약관에 동의해주세요")
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(SMAPTheme.Color.textPrimary)
            
            VStack(spacing: 16) {
                ToggleRow(title: "(필수) 서비스 이용약관", isChecked: $viewModel.registerData.mt_agree1)
                ToggleRow(title: "(필수) 개인정보 처리방침", isChecked: $viewModel.registerData.mt_agree2)
                ToggleRow(title: "(필수) 위치기반서비스 이용약관", isChecked: $viewModel.registerData.mt_agree3)
                ToggleRow(title: "(선택) 개인정보 제3자 제공 동의", isChecked: $viewModel.registerData.mt_agree4)
                ToggleRow(title: "(선택) 마케팅 정보 수신 동의", isChecked: $viewModel.registerData.mt_agree5)
            }
            .padding(.top, 20)
            
            Spacer()
        }
        .padding()
    }
}

struct ToggleRow: View {
    let title: String
    @Binding var isChecked: Bool
    
    var body: some View {
        HStack {
            Button(action: { isChecked.toggle() }) {
                HStack {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(isChecked ? SMAPTheme.Color.primary : .gray)
                    Text(title)
                        .font(.suite(size: 16))
                        .foregroundColor(SMAPTheme.Color.textPrimary)
                }
            }
            Spacer()
            // 약관 상세 화면이 아직 없어 링크 연결은 보류 — 최소한 터치영역 44pt + 라벨만 적용
            Button(action: { /* Open URL */ }) {
                Image(systemName: "chevron.right")
                    .foregroundColor(.gray)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("약관 보기")
        }
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
                title: "이메일을 입력해 주세요",
                description: "이 이메일이 로그인 아이디가 됩니다.\n인증번호를 보내 본인 확인을 진행해요."
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
        .padding(SMAPTheme.Spacing.lg)
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
                description: "\(viewModel.registerData.mt_id)\n위 주소로 보낸 6자리 숫자를 입력해 주세요."
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
                        .foregroundStyle(canResend ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                        .frame(minHeight: 44) // 글자만 누르는 버튼이라 터치 영역을 44pt 로 보장
                        .contentShape(Rectangle())
                }
                .disabled(!canResend)
            }

            SMAPBanner(message: "메일이 보이지 않으면 스팸함을 확인해 주세요.")

            Spacer()
        }
        .padding(SMAPTheme.Spacing.lg)
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
        Text(title)
            .font(SMAPTheme.Font.title)
            .foregroundStyle(SMAPTheme.Color.textPrimary)
        Text(description)
            .font(SMAPTheme.Font.secondary)
            .foregroundStyle(SMAPTheme.Color.textSecondary)
    }
}

// MARK: - Basic Info View
struct RegisterBasicInfoView: View {
    @ObservedObject var viewModel: RegisterViewModel
    @FocusState private var focusedField: String?
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("기본 정보를\n입력해주세요")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.textPrimary)
                
                VStack(spacing: 16) {
                    // 이름
                    FocusableTextField(
                        placeholder: "이름",
                        text: $viewModel.registerData.mt_name,
                        icon: "person"
                    )
                    .frame(height: 56)
                    
                    // 닉네임
                    FocusableTextField(
                        placeholder: "닉네임",
                        text: $viewModel.registerData.mt_nickname,
                        icon: "tag"
                    )
                    .frame(height: 56)
                    
                    // 이메일 (선택)
                    VStack(alignment: .leading, spacing: 4) {
                        FocusableTextField(
                            placeholder: "전화번호 (선택)",
                            text: Binding(
                                 get: { viewModel.optionalPhone },
                                 set: { viewModel.optionalPhone = String($0.filter { $0.isNumber }.prefix(11)) }
                             ),
                            icon: "envelope",
                            keyboardType: .phonePad
                        )
                        .frame(height: 56)
                        
                        // 이메일 형식 오류 표시
                        if let email = viewModel.registerData.mt_email, !email.isEmpty, !viewModel.validateEmail(email) {
                            HStack(spacing: 4) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .font(.suite(size: 12))
                                Text("올바른 이메일 형식을 입력해주세요")
                                    .font(.suite(size: 12))
                            }
                            .foregroundColor(SMAPTheme.Color.error)
                        }
                    }
                    
                    // 비밀번호 (토글 가능) - 소셜 계정은 생략
                    Group {
                        VStack(alignment: .leading, spacing: 8) {
                            FocusableSecureField(
                                 placeholder: "비밀번호",
                                 text: Binding(
                                     get: { viewModel.registerData.mt_pwd ?? "" },
                                     set: { viewModel.registerData.mt_pwd = $0 }
                                 ),
                                 icon: "lock",
                                 showPassword: $viewModel.showPassword
                            )
                            .frame(height: 56)
                            
                            // 비밀번호 규칙 표시
                            PasswordRulesView(password: viewModel.registerData.mt_pwd ?? "", viewModel: viewModel)
                        }
                        
                        // 비밀번호 확인 (토글 가능)
                        VStack(alignment: .leading, spacing: 4) {
                            FocusableSecureField(
                                placeholder: "비밀번호 확인",
                                text: $viewModel.passwordConfirm,
                                icon: "lock.shield",
                                showPassword: $viewModel.showPasswordConfirm
                            )
                            .frame(height: 56)
                            
                            // 비밀번호 일치 여부 표시
                            if !viewModel.passwordConfirm.isEmpty {
                                let matches = viewModel.registerData.mt_pwd == viewModel.passwordConfirm
                                HStack(spacing: 4) {
                                    Image(systemName: matches ? "checkmark.circle.fill" : "xmark.circle.fill")
                                        .font(.suite(size: 12))
                                    Text(matches ? "비밀번호가 일치합니다" : "비밀번호가 일치하지 않습니다")
                                        .font(.suite(size: 12))
                                }
                                .foregroundColor(matches ? .green : SMAPTheme.Color.error)
                            }
                        }
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Password Rules View
struct PasswordRulesView: View {
    let password: String
    @ObservedObject var viewModel: RegisterViewModel
    
    var body: some View {
        let details = viewModel.passwordValidationDetails(password)
        
        VStack(alignment: .leading, spacing: 4) {
            Text("비밀번호 규칙")
                .font(.suite(size: 12, weight: .medium))
                .foregroundColor(SMAPTheme.Color.textSecondary)
            
            HStack(spacing: 12) {
                PasswordRuleItem(text: "8자 이상", isValid: details.hasMinLength)
                PasswordRuleItem(text: "영문 대소문자", isValid: details.hasLetter)
                PasswordRuleItem(text: "숫자", isValid: details.hasNumber)
                PasswordRuleItem(text: "특수문자", isValid: details.hasSpecialChar)
            }
            
            // 조합 안내
            Text("* 영문 대소문자, 숫자, 특수문자를 모두 포함해주세요")
                .font(.suite(size: 11))
                .foregroundColor(SMAPTheme.Color.textSecondary)
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
        VStack(alignment: .leading, spacing: 20) {
            Text("프로필 정보를\n설정해주세요")
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(SMAPTheme.Color.textPrimary)
            
            // Birth Date
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("생년월일")
                        .font(.suite(size: 16, weight: .bold))
                    Text("(선택)")
                        .font(.suite(size: 12))
                        .foregroundColor(SMAPTheme.Color.textSecondary)
                    
                    Spacer()
                    
                    Toggle("", isOn: $provideBirthDate)
                        .labelsHidden()
                        .scaleEffect(0.8)
                }
                
                if provideBirthDate {
                    // DatePicker (Wheel Style)
                    DatePicker(
                        "",
                        selection: $birthDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                    .frame(height: 150)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(SMAPTheme.Color.primary.opacity(0.1), lineWidth: 1)
                    )
                    .transition(.opacity.combined(with: .move(edge: .top)))
                } else {
                    Text("생년월일을 입력하지 않습니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(SMAPTheme.Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(white: 0.98))
                        .cornerRadius(12)
                }
                
                // 생년월일 형식 에러 표시 (미래 날짜 등 DatePicker로 제한되지만 검증 로직 결과 표시)
                if let birth = viewModel.registerData.mt_birth, !birth.isEmpty, !viewModel.validateBirthDate(birth) {
                     HStack(spacing: 4) {
                         Image(systemName: "exclamationmark.circle.fill")
                             .font(.suite(size: 12))
                         Text("생년월일을 확인해주세요")
                             .font(.suite(size: 12))
                     }
                     .foregroundColor(SMAPTheme.Color.error)
                }
            }
            .padding(.bottom, 10)
            
            // Gender
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("성별")
                        .font(.suite(size: 16, weight: .bold))
                    Text("(선택)")
                        .font(.suite(size: 12))
                        .foregroundColor(SMAPTheme.Color.textSecondary)
                    
                    Spacer()
                    
                    Toggle("", isOn: $provideGender)
                        .labelsHidden()
                        .scaleEffect(0.8)
                }
                
                if provideGender {
                    HStack(spacing: 16) {
                        GenderButton(title: "남성", isSelected: viewModel.registerData.mt_gender == 1) {
                            viewModel.registerData.mt_gender = 1
                        }
                        GenderButton(title: "여성", isSelected: viewModel.registerData.mt_gender == 2) {
                            viewModel.registerData.mt_gender = 2
                        }
                    }
                } else {
                    Text("성별을 선택하지 않습니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(SMAPTheme.Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(white: 0.98))
                        .cornerRadius(12)
                }
            }
            
            Spacer()
        }
        .padding()
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
            Text(title)
                .font(.suite(size: 16, weight: .medium))
                .frame(maxWidth: .infinity)
                .padding()
                .background(isSelected ? SMAPTheme.Color.primary : Color.white)
                .foregroundColor(isSelected ? .white : SMAPTheme.Color.textPrimary)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? SMAPTheme.Color.primary : Color.gray.opacity(0.3), lineWidth: 1)
                )
        }
    }
}


// MARK: - Complete View
struct RegisterCompleteView: View {
    @ObservedObject var viewModel: RegisterViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .resizable()
                .frame(width: 80, height: 80)
                .foregroundColor(SMAPTheme.Color.primary)
            
            Text("회원가입이\n완료되었습니다!")
                .font(.suite(size: 24, weight: .bold))
                .multilineTextAlignment(.center)
            
            Text("smap과 함께 소중한 일상을 공유해보세요.")
                .font(.suite(size: 16))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
            
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity)
        // ScrollView 내부에서 수직 중앙 정렬 효과를 위해 화면 높이 활용
        .frame(height: UIScreen.main.bounds.height - 200) 
    }
}

// MARK: - Native Register View

struct NativeRegisterView: View {
    @StateObject private var viewModel = RegisterViewModel()
    @Environment(\.presentationMode) var presentationMode
    
    // Callback when registration is complete or cancelled
    var onComplete: (() -> Void)?
    var socialData: [String: Any]?
    
    // 기존 가입자 발견 시 콜백 (전화번호와 함께 로그인 페이지로 이동)
    var onExistingUser: ((String) -> Void)?
    
    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Custom Navigation Bar
                HStack {
                    if viewModel.currentStep != .complete {
                        Button(action: {
                            if viewModel.currentStep == .terms {
                                // 약관 페이지에서 뒤로가기 -> 로그인 페이지로 이동
                                // presentationMode.dismiss()는 rootViewController로 설정된 경우 효과 없음
                                // onComplete 콜백이 로그인 페이지로 이동시킴
                                onComplete?()
                            } else {
                                viewModel.previousStep()
                            }
                        }) {
                            Image(systemName: "chevron.left")
                                .font(.suite(size: 20, weight: .semibold))
                                .foregroundColor(SMAPTheme.Color.textPrimary)
                        }
                        .accessibilityLabel("뒤로")
                    }
                    
                    Spacer()
                    
                    Text(viewModel.currentStep == .phone ? "이메일 인증" : viewModel.currentStep.title)
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(SMAPTheme.Color.textPrimary)
                    
                    Spacer()
                    
                    // Empty view for balance
                    if viewModel.currentStep != .complete {
                        Image(systemName: "chevron.left")
                            .font(.suite(size: 20, weight: .semibold))
                            .foregroundColor(.clear)
                    }
                }
                .padding()
                
                // Progress Bar
                if viewModel.currentStep != .complete {
                    ProgressView(value: currentProgress, total: 1.0)
                        .accentColor(SMAPTheme.Color.primary)
                        .scaleEffect(x: 1, y: 0.5, anchor: .center)
                }
                
                // Content with slide animation
                ScrollView {
                    Group {
                        switch viewModel.currentStep {
                        case .terms:
                            RegisterTermsView(viewModel: viewModel)
                        case .phone:
                            RegisterPhoneView(viewModel: viewModel)
                        case .verification:
                            RegisterVerificationView(viewModel: viewModel)
                        case .basicInfo:
                            RegisterBasicInfoView(viewModel: viewModel)
                        case .profile:
                            RegisterProfileView(viewModel: viewModel)
                        case .complete:
                            RegisterCompleteView(viewModel: viewModel)
                        }
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing),
                        removal: .move(edge: .leading)
                    ))
                    .id(viewModel.currentStep) // 페이지 변경 시 애니메이션 트리거
                }
                .animation(.easeInOut(duration: 0.3), value: viewModel.currentStep)
                
                // 약관 페이지 전체 동의 버튼 (다음 버튼 바로 위)
                if viewModel.currentStep == .terms {
                    Button(action: {
                        toggleAllTerms()
                    }) {
                        HStack {
                            Image(systemName: isAllTermsAgreed ? "checkmark.circle.fill" : "circle")
                                .font(.suite(size: 22))
                                .foregroundColor(isAllTermsAgreed ? SMAPTheme.Color.primary : .gray)
                            
                            Text("전체 동의하기")
                                .font(.suite(size: 16, weight: .semibold))
                                .foregroundColor(SMAPTheme.Color.textPrimary)
                            
                            Spacer()
                        }
                        .padding(16)
                        .background(Color(UIColor.systemGray6))
                        .cornerRadius(12)
                    }
                    .padding(.horizontal)
                }
                
                // Bottom Button
                if viewModel.currentStep != .complete {
                    Button(action: {
                        switch viewModel.currentStep {
                        case .phone:
                            // 전화번호 단계: SMS 발송
                            viewModel.sendVerificationCode()
                        case .verification:
                            // 인증번호 단계: 코드 확인
                            viewModel.verifyCode()
                        default:
                            viewModel.nextStep()
                        }
                    }) {
                        HStack(spacing: 8) {
                            if viewModel.isVerificationLoading || viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text(nextButtonTitle)
                                .font(.suite(size: 16, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(isNextButtonEnabled ? SMAPTheme.Color.primary : SMAPTheme.Color.primary.opacity(0.3))
                        .cornerRadius(12)
                    }
                    .padding()
                    .disabled(!isNextButtonEnabled || viewModel.isVerificationLoading || viewModel.isLoading)
                } else {
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                        onComplete?()
                    }) {
                        Text("시작하기")
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(SMAPTheme.Color.primary)
                            .cornerRadius(12)
                    }
                    .padding()
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .alert("오류", isPresented: $viewModel.showError) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "알 수 없는 오류")
        }
        .alert("알림", isPresented: $viewModel.showExistingUserAlert) {
            Button("확인", role: .cancel) {
                // 확인 버튼 누르면 로그인 페이지로 이동
                onExistingUser?(viewModel.existingUserPhone)
            }
        } message: {
            Text("이미 가입된 전화번호입니다.\n로그인 페이지로 이동합니다.")
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
    
    var currentProgress: Double {
        switch viewModel.currentStep {
        case .terms: return 0.2
        case .phone: return 0.4
        case .verification: return 0.5
        case .basicInfo: return 0.6
        case .profile: return 0.8
        case .complete: return 1.0
        }
    }
    
    var nextButtonTitle: String {
        switch viewModel.currentStep {
        case .phone: return "인증번호 발송"
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
