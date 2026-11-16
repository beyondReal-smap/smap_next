//
// LoginView.swift
// smap
//
// 네이티브 로그인 화면 (iOS 13+)
// Next.js 스타일 반영: 브랜드 색상 #0113A3
//

import SwiftUI
import AuthenticationServices


// MARK: - Custom Font Extension
//
// 앱 전반에서 `.font(.suite(size:weight:))` 로 호출되는 폰트 팩토리 — SUITE 글꼴(Android 와 같은 파일).
// (2026-11-16) AtoZ(A2Z) → SUITE 로 바꾸고, SwiftUI 쪽에만 있던 +2pt 보정을 없앴다.
// 같은 크기 값(예: 본문 16)이 Android 보다 2pt 크게 보여 "글씨가 전체적으로 크다"는 피드백이 있었다.

/// SUITE 굵기별 PostScript 이름. 파일에 없는 굵기(Thin·ExtraLight·Black)는 가장 가까운 굵기로.
enum SuiteFontName {
    static func postScriptName(for weight: Font.Weight) -> String {
        switch weight {
        case .ultraLight, .thin, .light: return "SUITE-Light"
        case .regular: return "SUITE-Regular"
        case .medium: return "SUITE-Medium"
        case .semibold: return "SUITE-SemiBold"
        case .bold: return "SUITE-Bold"
        case .heavy: return "SUITE-ExtraBold"
        case .black: return "SUITE-Heavy"
        default: return "SUITE-Regular"
        }
    }

    static func postScriptName(for weight: UIFont.Weight) -> String {
        switch weight {
        case .ultraLight, .thin, .light: return "SUITE-Light"
        case .regular: return "SUITE-Regular"
        case .medium: return "SUITE-Medium"
        case .semibold: return "SUITE-SemiBold"
        case .bold: return "SUITE-Bold"
        case .heavy: return "SUITE-ExtraBold"
        case .black: return "SUITE-Heavy"
        default: return "SUITE-Regular"
        }
    }
}

extension Font {
    static func suite(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom(SuiteFontName.postScriptName(for: weight), size: size)
    }
}

// UIKit 경로(UILabel/UITextField/NSAttributedString 등)에서도 같은 SUITE 글꼴을 쓰도록 UIFont 대응 팩토리.
extension UIFont {
    static func suite(size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        UIFont(name: SuiteFontName.postScriptName(for: weight), size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
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
                .ignoresSafeArea()

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
        .onChange(of: viewModel.isLoggedIn) { _, isLoggedIn in
            if isLoggedIn {
                onLoginSuccess?()
            }
        }
        .onChange(of: viewModel.isNewUser) { _, isNewUser in
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
                .accessibilityHidden(true)

            VStack(spacing: 4) {
                // 앱 이름 - smap
                Text("smap")
                    .font(.suite(size: 32, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.textPrimary)

                // 서브텍스트
                Text("소중한 사람들과 함께하는 위치 공유")
                    .font(.suite(size: 14))
                    .foregroundColor(SMAPTheme.Color.textSecondary)
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
                Image(systemName: "person.fill")
                    .foregroundColor(isFocused ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                    .frame(width: 20)

                TextField("이메일 또는 전화번호", text: $viewModel.phoneNumber, onEditingChanged: { editing in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isFocused = editing
                    }
                })
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            }
            .padding(.horizontal, 16)
            .frame(height: 56)
            .background(SMAPTheme.Color.inputBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isFocused ? SMAPTheme.Color.primary : SMAPTheme.Color.border, lineWidth: isFocused ? 2 : 1)
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
                .foregroundColor(SMAPTheme.Color.error)


            Text(message)
                .font(.suite(size: 14))
                .foregroundColor(SMAPTheme.Color.error)

            Spacer()
        }
        .padding(12)
        .background(SMAPTheme.Color.error.opacity(0.1))
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
            .background(viewModel.isInputValid ? SMAPTheme.Color.primary : SMAPTheme.Color.primary.opacity(0.3))
            .cornerRadius(12)
            .shadow(color: viewModel.isInputValid ? SMAPTheme.Color.primary.opacity(0.3) : Color.clear, radius: 4, x: 0, y: 2)
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
                .foregroundColor(SMAPTheme.Color.primary)
        }
    }

    // MARK: - Divider Section

    private var dividerSection: some View {
        HStack {
            Rectangle()
                .fill(SMAPTheme.Color.border)
                .frame(height: 1)

            Text("또는")
                .font(.suite(size: 14))
                .foregroundColor(SMAPTheme.Color.textSecondary)
                .padding(.horizontal, 12)

            Rectangle()
                .fill(SMAPTheme.Color.border)
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
                        .foregroundColor(SMAPTheme.Color.textPrimary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.white)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(SMAPTheme.Color.border, lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
            }

            // Kakao 로그인 버튼 — Kakao 공식 규격(배경 #FEE500, 글자·심볼 검정 계열). Android 와 같이 Google 다음 순서.
            Button(action: {
                HapticManager.shared.impact(style: .medium)
                viewModel.kakaoLogin()
            }) {
                HStack(spacing: 12) {
                    KakaoBubbleShape()
                        .fill(Color(red: 0x19/255, green: 0x19/255, blue: 0x19/255))
                        .frame(width: 24, height: 24)
                        .accessibilityHidden(true)

                    Text("카카오로 계속하기")
                        .font(.suite(size: 15, weight: .medium))
                        .foregroundColor(Color(red: 0x19/255, green: 0x19/255, blue: 0x19/255))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color(red: 0xFE/255, green: 0xE5/255, blue: 0x00/255))
                .cornerRadius(12)
            }
            .disabled(viewModel.isLoading)

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
                .foregroundColor(SMAPTheme.Color.textSecondary)

            Button(action: {
                print("📝 [LoginView] 가입하기 버튼 클릭 (Native Flow)")
                onNavigateToRegister?(nil)
            }) {
                Text("가입하기")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(SMAPTheme.Color.primary)
            }
        }
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()

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

// MARK: - Kakao 말풍선 심볼

/// Kakao 로그인 버튼용 말풍선 심볼. 외부 이미지 에셋을 추가하지 않기 위해 Shape 로 직접 그린다.
struct KakaoBubbleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        // 몸통: 가로로 넓은 타원 (위쪽 약 85%)
        path.addEllipse(in: CGRect(x: rect.minX + w * 0.04, y: rect.minY + h * 0.08, width: w * 0.92, height: h * 0.74))
        // 꼬리: 왼쪽 아래로 뻗는 작은 삼각형
        path.move(to: CGPoint(x: rect.minX + w * 0.26, y: rect.minY + h * 0.72))
        path.addLine(to: CGPoint(x: rect.minX + w * 0.20, y: rect.minY + h * 0.95))
        path.addLine(to: CGPoint(x: rect.minX + w * 0.46, y: rect.minY + h * 0.80))
        path.closeSubpath()
        return path
    }
}
