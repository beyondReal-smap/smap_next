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
                .foregroundColor(BrandColors.textPrimary)
            
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
                        .foregroundColor(isChecked ? BrandColors.primary : .gray)
                    Text(title)
                        .font(.suite(size: 16))
                        .foregroundColor(BrandColors.textPrimary)
                }
            }
            Spacer()
            Button(action: { /* Open URL */ }) {
                Image(systemName: "chevron.right")
                    .foregroundColor(.gray)
            }
        }
    }
}

// MARK: - Phone View
struct RegisterPhoneView: View {
    @ObservedObject var viewModel: RegisterViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("휴대폰 번호를\n입력해주세요")
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(BrandColors.textPrimary)
            
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 12) {
                    Image(systemName: "phone")
                        .foregroundColor(isFocused ? BrandColors.primary : BrandColors.textSecondary)
                        .frame(width: 20)
                    
                    PhoneTextField(text: $viewModel.registerData.mt_id, placeholder: "010-0000-0000", onEditingChanged: { editing in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isFocused = editing
                        }
                    })
                }
                .padding(.horizontal, 16)
                .frame(height: 56)
                .background(BrandColors.inputBackground)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isFocused ? BrandColors.primary : BrandColors.border, lineWidth: isFocused ? 2 : 1)
                )
            }
            
            Spacer()
        }
        .padding()
    }
    
    @State private var isFocused: Bool = false
}

// MARK: - Verification View
struct RegisterVerificationView: View {
    @ObservedObject var viewModel: RegisterViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("인증번호를\n입력해주세요")
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(BrandColors.textPrimary)
            
            Text("문자로 전송된 인증번호 6자리를 입력해주세요.")
                .font(.suite(size: 14))
                .foregroundColor(.gray)
            
            // 인증번호 입력 + 타이머
            HStack {
                FocusableTextField(
                    placeholder: "인증번호 6자리",
                    text: $viewModel.verificationCode,
                    icon: "lock.shield",
                    keyboardType: .numberPad
                )
                
                // 타이머 표시
                if viewModel.verificationTimer > 0 {
                    Text(timeString(time: viewModel.verificationTimer))
                        .font(.suite(size: 14, weight: .semibold))
                        .foregroundColor(.red)
                        .frame(width: 50)
                } else {
                    Text("만료됨")
                        .font(.suite(size: 14, weight: .semibold))
                        .foregroundColor(.red)
                        .frame(width: 50)
                }
            }
            
            // 재발송 버튼
            Button(action: {
                viewModel.resendVerificationCode()
            }) {
                HStack {
                    Text("인증번호 재전송")
                        .font(.suite(size: 13))
                        .foregroundColor(viewModel.canResend() ? BrandColors.primary : .gray)
                        .underline()
                    
                    // 재발송 불가 시 남은 시간 표시
                    if !viewModel.canResend() {
                        let remaining = viewModel.remainingResendTime()
                        Text("(\(remaining / 60):\(String(format: "%02d", remaining % 60)))")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                    }
                }
            }
            .disabled(!viewModel.canResend() && viewModel.isVerificationLoading)
            .padding(.top, 8)
            
            Spacer()
        }
        .padding()
    }
    
    func timeString(time: Int) -> String {
        let minutes = time / 60
        let seconds = time % 60
        return String(format: "%02d:%02d", minutes, seconds)
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
                    .foregroundColor(BrandColors.textPrimary)
                
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
                            placeholder: "이메일 (선택)",
                            text: Binding(
                                 get: { viewModel.registerData.mt_email ?? "" },
                                 set: { viewModel.registerData.mt_email = $0 }
                             ),
                            icon: "envelope",
                            keyboardType: .emailAddress
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
                            .foregroundColor(BrandColors.error)
                        }
                    }
                    
                    // 비밀번호 (토글 가능) - 소셜 계정은 생략
                    if !viewModel.isSocialAccount {
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
                                .foregroundColor(matches ? .green : BrandColors.error)
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
                .foregroundColor(BrandColors.textSecondary)
            
            HStack(spacing: 12) {
                PasswordRuleItem(text: "8자 이상", isValid: details.hasMinLength)
                PasswordRuleItem(text: "영문", isValid: details.hasLetter)
                PasswordRuleItem(text: "숫자", isValid: details.hasNumber)
                PasswordRuleItem(text: "특수문자", isValid: details.hasSpecialChar)
            }
            
            // 조합 안내
            Text("* 영문, 숫자, 특수문자 중 2가지 이상 조합")
                .font(.suite(size: 11))
                .foregroundColor(BrandColors.textSecondary)
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
                .foregroundColor(isValid ? .green : BrandColors.textSecondary)
            Text(text)
                .font(.suite(size: 11))
                .foregroundColor(isValid ? .green : BrandColors.textSecondary)
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
                .foregroundColor(BrandColors.textPrimary)
            
            // Birth Date
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("생년월일")
                        .font(.suite(size: 16, weight: .bold))
                    Text("(선택)")
                        .font(.suite(size: 12))
                        .foregroundColor(BrandColors.textSecondary)
                    
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
                            .stroke(Color(hex: "#0113A3").opacity(0.1), lineWidth: 1)
                    )
                    .transition(.opacity.combined(with: .move(edge: .top)))
                } else {
                    Text("생년월일을 입력하지 않습니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(BrandColors.textSecondary)
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
                     .foregroundColor(BrandColors.error)
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
                        .foregroundColor(BrandColors.textSecondary)
                    
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
                        .foregroundColor(BrandColors.textSecondary)
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
        .onChange(of: provideBirthDate) { newValue in
            if newValue {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                viewModel.registerData.mt_birth = formatter.string(from: birthDate)
            } else {
                viewModel.registerData.mt_birth = nil
            }
        }
        .onChange(of: provideGender) { newValue in
            if !newValue {
                viewModel.registerData.mt_gender = nil
            }
        }
        .onChange(of: birthDate) { newValue in
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
                .background(isSelected ? BrandColors.primary : Color.white)
                .foregroundColor(isSelected ? .white : BrandColors.textPrimary)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? BrandColors.primary : Color.gray.opacity(0.3), lineWidth: 1)
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
                .foregroundColor(BrandColors.primary)
            
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
            Color.white.edgesIgnoringSafeArea(.all)
            
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
                                .foregroundColor(BrandColors.textPrimary)
                        }
                    }
                    
                    Spacer()
                    
                    Text(viewModel.currentStep.title)
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(BrandColors.textPrimary)
                    
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
                        .accentColor(BrandColors.primary)
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
                                .foregroundColor(isAllTermsAgreed ? BrandColors.primary : .gray)
                            
                            Text("전체 동의하기")
                                .font(.suite(size: 16, weight: .semibold))
                                .foregroundColor(BrandColors.textPrimary)
                            
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
                        .background(isNextButtonEnabled ? BrandColors.primary : BrandColors.primary.opacity(0.3))
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
                            .background(BrandColors.primary)
                            .cornerRadius(12)
                    }
                    .padding()
                }
            }
        }
        .navigationBarHidden(true)
        .alert(isPresented: $viewModel.showError) {
            Alert(title: Text("오류"), message: Text(viewModel.errorMessage ?? "알 수 없는 오류"), dismissButton: .default(Text("확인")))
        }
        .alert(isPresented: $viewModel.showExistingUserAlert) {
            Alert(
                title: Text("알림"),
                message: Text("이미 가입된 전화번호입니다.\n로그인 페이지로 이동합니다."),
                dismissButton: .default(Text("확인")) {
                    // 확인 버튼 누르면 로그인 페이지로 이동
                    onExistingUser?(viewModel.existingUserPhone)
                }
            )
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
        case .verification: return true // Mock
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
