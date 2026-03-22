//
// LoginView.swift
// smap
//
// 네이티브 로그인 화면 (iOS 13+)
// Next.js 스타일 반영: 브랜드 색상 #0113A3
//

import SwiftUI
import AuthenticationServices

// MARK: - Brand Colors

struct BrandColors {
    static let primary = Color(red: 1/255, green: 19/255, blue: 163/255)  // #0113A3
    static let primaryDark = Color(red: 0/255, green: 31/255, blue: 135/255)  // #001f87
    static let background = Color(red: 254/255, green: 248/255, blue: 249/255)  // #fef8f9
    static let textPrimary = Color.black
    static let textSecondary = Color(UIColor.systemGray)
    static let inputBackground = Color(UIColor.systemGray6)
    static let border = Color(UIColor.systemGray4)
    static let error = Color.red
}

// MARK: - Custom Font Extension
extension Font {
    static func suite(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        var fontName = "SUITE-Regular"
        switch weight {
        case .light: fontName = "SUITE-Light"
        case .regular: fontName = "SUITE-Regular"
        case .medium: fontName = "SUITE-Medium"
        case .semibold: fontName = "SUITE-SemiBold"
        case .bold: fontName = "SUITE-Bold"
        case .heavy: fontName = "SUITE-Heavy"
        case .black: fontName = "SUITE-ExtraBold"
        default: fontName = "SUITE-Regular"
        }
        // 전체 폰트 크기를 2포인트 증가
        return Font.custom(fontName, size: size + 2)
    }
}

// MARK: - LoginView

struct LoginView: View {

    @StateObject private var viewModel = LoginViewModel()

    /// 비밀번호 찾기 시트 표시 여부
    @State private var showForgotPassword = false
    @State private var isFocused = false

    /// 기존 가입자 발견 시 전달받은 전화번호 (자동 입력)
    var prefilledPhone: String?

    /// 로그인 성공 시 콜백
    var onLoginSuccess: (() -> Void)?

    /// 회원가입 이동 콜백
    var onNavigateToRegister: (([String: Any]?) -> Void)?

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background Gradient (Matches Frontend)
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 102/255, green: 126/255, blue: 234/255), // #667eea
                        Color(red: 118/255, green: 75/255, blue: 162/255),  // #764ba2
                        Color(red: 240/255, green: 147/255, blue: 251/255), // #f093fb
                        Color(red: 245/255, green: 87/255, blue: 108/255),  // #f5576c
                        Color(red: 79/255, green: 172/255, blue: 254/255),  // #4facfe
                        Color(red: 0/255, green: 242/255, blue: 254/255)    // #00f2fe
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .edgesIgnoringSafeArea(.all)

                // Floating Animations
                FloatingBackgroundView()

                VStack(spacing: 0) {
                    VStack(spacing: 0) {
                        // 상단 여백 (유동적)
                        Spacer()

                        // Card Container
                        VStack(spacing: 0) {
                            // 로고 영역
                            logoSection
                                .padding(.top, 24) // Reduced from 32

                            Spacer().frame(height: 24) // Reduced from 32

                            // 로그인 폼
                            loginFormSection

                            Spacer().frame(height: 16)

                            // 에러 메시지
                            if viewModel.showError, let error = viewModel.errorMessage {
                                errorMessageView(error)
                                Spacer().frame(height: 16)
                            }

                            // 로그인 버튼
                            loginButton

                            Spacer().frame(height: 16)

                            // 비밀번호 찾기 링크
                            forgotPasswordLink

                            Spacer().frame(height: 24)

                            // 구분선
                            dividerSection

                            Spacer().frame(height: 24)

                            // 소셜 로그인 버튼들
                            socialLoginSection

                            // 하단 여백 (회원가입 링크 위)
                            Spacer().frame(height: 32)

                            // 회원가입 링크
                            signUpSection
                                .padding(.bottom, 32)
                        }
                        .padding(.horizontal, 24)
                        .background(Color.white.opacity(0.95))
                        .cornerRadius(24)
                        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 0, y: 10)

                        // 하단 safe area 여백 (유동적)
                        Spacer()
                    }
                    .padding(.horizontal, 24)
                }

                // 로딩 오버레이
                if viewModel.isLoading {
                    loadingOverlay
                }
            }
            .onTapGesture {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        .onChange(of: viewModel.isLoggedIn) { isLoggedIn in
            if isLoggedIn {
                onLoginSuccess?()
            }
        }
        .onChange(of: viewModel.isNewUser) { isNewUser in
            if isNewUser {
                onNavigateToRegister?(viewModel.socialLoginData)
            }
        }
        .onAppear {
            // 기존 가입자 전화번호 자동 입력
            if let phone = prefilledPhone, !phone.isEmpty {
                viewModel.phoneNumber = phone
                print("📱 [LOGIN] 기존 가입자 전화번호 자동 입력: \(phone)")
            }
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
        }
    }
}

    // MARK: - Logo Section

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: -10) {
            // 앱 아이콘
            // 앱 아이콘 (AppNoBg)
            Image("AppNoBg")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 80, height: 80) // Size adjustment if needed

            VStack(spacing: 4) {
                // 앱 이름 - smap
                Text("smap")
                    .font(.suite(size: 32, weight: .bold))
                    .foregroundColor(BrandColors.textPrimary)

                // 서브텍스트
                Text("소중한 사람들과 함께하는 위치 공유")
                    .font(.suite(size: 14))
                    .foregroundColor(BrandColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.bottom, 20)
    }

    // MARK: - Login Form Section

    private var loginFormSection: some View {
        VStack(spacing: 16) {
            // 전화번호 입력
            HStack(spacing: 12) {
                Image(systemName: "phone.fill")
                    .foregroundColor(isFocused ? BrandColors.primary : BrandColors.textSecondary)
                    .frame(width: 20)

                PhoneTextField(text: $viewModel.phoneNumber, placeholder: "전화번호", onEditingChanged: { editing in
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

            // 비밀번호 입력
            FocusableSecureField(
                placeholder: "비밀번호",
                text: $viewModel.password,
                icon: "lock.fill",
                showPassword: $viewModel.showPassword
            )
        }
    }

    // MARK: - Error Message

    private func errorMessageView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(BrandColors.error)


            Text(message)
                .font(.suite(size: 14))
                .foregroundColor(BrandColors.error)

            Spacer()
        }
        .padding(12)
        .background(BrandColors.error.opacity(0.1))
        .cornerRadius(8)
    }

    // MARK: - Login Button

    private var loginButton: some View {
        Button(action: {
            HapticManager.shared.impact(style: .medium)
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            loginAction()
        }) {
            HStack {
                if viewModel.isLoading {
                    ActivityIndicator(style: .medium, color: .white)
                } else {
                    Text("로그인")
                        .font(.suite(size: 16, weight: .semibold))
                }
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(viewModel.isInputValid ? BrandColors.primary : BrandColors.primary.opacity(0.3))
            .cornerRadius(12)
            .shadow(color: viewModel.isInputValid ? BrandColors.primary.opacity(0.3) : Color.clear, radius: 4, x: 0, y: 2)
        }
        .disabled(!viewModel.isInputValid || viewModel.isLoading)
    }

    private func loginAction() {
        if #available(iOS 15.0, *) {
            Task {
                await viewModel.login()
            }
        } else {
            viewModel.loginSync()
        }
    }

    // MARK: - Forgot Password Link

    private var forgotPasswordLink: some View {
        Button(action: {
            HapticManager.shared.impact(style: .light)
            showForgotPassword = true
        }) {
            Text("비밀번호를 잊어버리셨나요?")
                .font(.suite(size: 14))
                .foregroundColor(BrandColors.primary)
        }
    }

    // MARK: - Divider Section

    private var dividerSection: some View {
        HStack {
            Rectangle()
                .fill(BrandColors.border)
                .frame(height: 1)

            Text("또는")
                .font(.suite(size: 14))
                .foregroundColor(BrandColors.textSecondary)
                .padding(.horizontal, 12)

            Rectangle()
                .fill(BrandColors.border)
                .frame(height: 1)
        }
    }

    // MARK: - Social Login Section

    private var socialLoginSection: some View {
        VStack(spacing: 12) {
            // Google 로그인 버튼
            Button(action: {
                HapticManager.shared.impact(style: .medium)
                viewModel.googleLogin()
            }) {
                HStack(spacing: 12) {
                    // Google 아이콘
                    GoogleLogoView()
                        .frame(width: 24, height: 24)

                    Text("Google로 계속하기")
                        .font(.suite(size: 15, weight: .medium))
                        .foregroundColor(BrandColors.textPrimary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.white)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(BrandColors.border, lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
            }

            // Apple 로그인 버튼 (Google 스타일과 동일하게)
            CustomAppleSignInButton(onTap: {
                triggerAppleSignIn()
            })
        }
    }

    // Apple Sign In 트리거
    private func triggerAppleSignIn() {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email, .fullName]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = AppleSignInCoordinator.shared
        controller.presentationContextProvider = AppleSignInCoordinator.shared

        AppleSignInCoordinator.shared.onCompletion = { result in
            switch result {
            case .success(let authorization):
                self.handleAppleLoginAction(authorization: authorization)
            case .failure(let error):
                self.viewModel.handleAppleLoginError(error)
            }
        }

        controller.performRequests()
    }

    private func handleAppleLoginAction(authorization: ASAuthorization) {
        if #available(iOS 15.0, *) {
            Task {
                await viewModel.handleAppleLogin(authorization: authorization)
            }
        } else {
            viewModel.handleAppleLoginSync(authorization: authorization)
        }
    }

    // MARK: - Sign Up Section

    private var signUpSection: some View {
        HStack(spacing: 4) {
            Text("아직 회원이 아니신가요?")
                .font(.suite(size: 14))
                .foregroundColor(BrandColors.textSecondary)

            Button(action: {
                print("📝 [LoginView] 가입하기 버튼 클릭 (Native Flow)")
                onNavigateToRegister?(nil)
            }) {
                Text("가입하기")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(BrandColors.primary)
            }
        }
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.4)
                .edgesIgnoringSafeArea(.all)

            VStack(spacing: 16) {
                ActivityIndicator(style: .large, color: .white)

                Text("로그인 중...")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.white)
            }
            .padding(32)
            .background(Color.black.opacity(0.7))
            .cornerRadius(16)
        }
    }
}

// MARK: - Preview

struct LoginView_Previews: PreviewProvider {
    static var previews: some View {
        LoginView()
    }
}

// MARK: - Bundle Extension for App Icon
extension Bundle {
    public var icon: UIImage? {
        if let icons = infoDictionary?["CFBundleIcons"] as? [String: Any],
           let primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any],
           let iconFiles = primaryIcon["CFBundleIconFiles"] as? [String],
           let lastIcon = iconFiles.last {
            return UIImage(named: lastIcon)
        }
        return nil
    }
}

// MARK: - Color Extension

extension Color {
    #if os(iOS)
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    #endif
}
