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

    /// 기존 가입자 발견 시 전달받은 전화번호 (자동 입력)
    var prefilledPhone: String?

    /// 로그인 성공 시 콜백
    var onLoginSuccess: (() -> Void)?

    /// 회원가입 이동 콜백
    var onNavigateToRegister: (([String: Any]?) -> Void)?

    var body: some View {
        ZStack {
            // 스플래시와 같은 브랜드 남색에서 이어지게 한다(Android SmapAccent.Navy.brush 와 같은 값).
            // 아래 절반은 흰색 — 내용이 화면보다 짧아도 흰 시트가 화면 아래 끝까지 이어 보이게.
            VStack(spacing: 0) {
                SMAPTheme.Navy.gradient
                SMAPTheme.Surface.card
            }
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    logoSection
                        .padding(.top, 40)
                        .padding(.bottom, 32)

                    // 입력 시트 — 위쪽 모서리만 둥근 흰 판(앱 공용 시트 반경)
                    VStack(spacing: 0) {
                        loginFormSection

                        if viewModel.showError, let error = viewModel.errorMessage {
                            errorMessageView(error)
                                .padding(.top, SMAPTheme.Spacing.md)
                        }

                        SMAPButton("로그인", isLoading: viewModel.isLoading, isDisabled: !viewModel.isInputValid) {
                            HapticManager.shared.impact(style: .medium)
                            hideKeyboard()
                            loginAction()
                        }
                        .padding(.top, SMAPTheme.Spacing.lg)

                        forgotPasswordLink
                            .padding(.top, SMAPTheme.Spacing.sm)

                        dividerSection
                            .padding(.top, SMAPTheme.Spacing.md)

                        socialLoginSection
                            .padding(.top, SMAPTheme.Spacing.lg)

                        signUpSection
                            .padding(.top, SMAPTheme.Spacing.lg)
                    }
                    .padding(.horizontal, SMAPTheme.Spacing.lg)
                    .padding(.vertical, SMAPTheme.Spacing.xl)
                    .frame(maxWidth: .infinity)
                    .background(
                        UnevenRoundedRectangle(topLeadingRadius: SMAPTheme.sheetRadius, topTrailingRadius: SMAPTheme.sheetRadius)
                            .fill(SMAPTheme.Surface.card)
                    )
                }
            }
            .scrollDismissesKeyboard(.interactively)

            // 로딩 오버레이
            if viewModel.isLoading {
                loadingOverlay
            }
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

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    // MARK: - Logo Section

    /// 남색 바탕 위 앱 아이콘·이름·한 줄 소개
    private var logoSection: some View {
        VStack(spacing: 0) {
            Image("AppNoBg")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 76, height: 76)
                .accessibilityHidden(true)

            Text("도착했어")
                .font(.suite(size: 32, weight: .bold))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
                .padding(.top, SMAPTheme.Spacing.md)

            Text("가족이 도착하면 먼저 알려 드려요")
                .font(SMAPTheme.Font.body)
                .foregroundStyle(SMAPTheme.Surface.onNavyMuted)
                .multilineTextAlignment(.center)
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Login Form Section

    private var loginFormSection: some View {
        VStack(spacing: 12) {
            SMAPTextField(
                "이메일",
                text: $viewModel.phoneNumber,
                keyboardType: .emailAddress,
                textContentType: .username,
                submitLabel: .next
            )

            SMAPTextField(
                "비밀번호",
                text: $viewModel.password,
                isSecure: true,
                textContentType: .password,
                submitLabel: .done
            )
        }
    }

    // MARK: - Error Message

    private func errorMessageView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(SMAPTheme.Color.error)


            Text(message)
                .font(SMAPTheme.Font.secondary)
                .foregroundColor(SMAPTheme.Color.error)

            Spacer()
        }
        .padding(12)
        .background(SMAPTheme.Color.error.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm))
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
            Text("비밀번호를 잊으셨나요?")
                .font(SMAPTheme.Font.secondaryMedium)
                .foregroundColor(SMAPTheme.Color.primary)
                .frame(minHeight: 44)
        }
    }

    // MARK: - Divider Section

    private var dividerSection: some View {
        HStack {
            Rectangle()
                .fill(SMAPTheme.Surface.divider)
                .frame(height: 1)

            Text("또는")
                .font(SMAPTheme.Font.secondary)
                .foregroundColor(SMAPTheme.Color.textSecondary)
                .padding(.horizontal, 12)

            Rectangle()
                .fill(SMAPTheme.Surface.divider)
                .frame(height: 1)
        }
    }

    // MARK: - Social Login Section

    /// 높이·모서리는 앱 공용 버튼(SMAPButton 52pt·12pt)과 맞춘다. Android SocialLoginSection 과 같은 규격.
    private var socialLoginSection: some View {
        VStack(spacing: 12) {
            // Google — 공식 규격: 흰 바탕 + 옅은 테두리 + 컬러 G 로고
            Button(action: {
                HapticManager.shared.impact(style: .medium)
                viewModel.googleLogin()
            }) {
                HStack(spacing: 10) {
                    GoogleLogoView()
                        .frame(width: 20, height: 20)

                    Text("Google로 계속하기")
                        .font(.suite(size: 16, weight: .medium))
                        .foregroundColor(Color(red: 0x1F/255, green: 0x1F/255, blue: 0x1F/255))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: SMAPTheme.Radius.md)
                        .stroke(Color(red: 0xDA/255, green: 0xDC/255, blue: 0xE0/255), lineWidth: 1)
                )
            }
            .disabled(viewModel.isLoading)

            // Kakao — 공식 규격: 바탕 #FEE500, 심볼 #000000, 글자 #000000 85%. Android 와 같이 Google 다음 순서.
            Button(action: {
                HapticManager.shared.impact(style: .medium)
                viewModel.kakaoLogin()
            }) {
                HStack(spacing: 10) {
                    KakaoSymbolShape()
                        .fill(Color.black)
                        .frame(width: 20, height: 20)
                        .accessibilityHidden(true)

                    Text("카카오로 계속하기")
                        .font(.suite(size: 16, weight: .medium))
                        .foregroundColor(Color.black.opacity(0.85))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color(red: 0xFE/255, green: 0xE5/255, blue: 0x00/255))
                .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
            }
            .disabled(viewModel.isLoading)

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
                .font(SMAPTheme.Font.secondary)
                .foregroundColor(SMAPTheme.Color.textSecondary)

            Button(action: {
                print("📝 [LoginView] 가입하기 버튼 클릭 (Native Flow)")
                onNavigateToRegister?(nil)
            }) {
                Text("가입하기")
                    .font(.suite(size: 15, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.primary)
                    .frame(minWidth: 44, minHeight: 44)
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

/// Kakao 로그인 버튼용 말풍선 심볼(공식 규격: 검정). 외부 이미지 에셋을 추가하지 않기 위해 Shape 로 직접 그린다.
/// 몸통과 꼬리를 한 덩어리의 닫힌 경로로 그린다 — 예전처럼 타원과 삼각형을 따로 겹치면 감는 방향이 반대라
/// 겹친 부분이 비어 노란 선이 보였다. Android res/drawable/ic_kakao_logo.xml 과 같은 좌표(24 기준).
struct KakaoSymbolShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 24, sy = rect.height / 24
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        path.move(to: p(12, 3))
        path.addCurve(to: p(1, 11), control1: p(5.9, 3), control2: p(1, 6.5))
        path.addCurve(to: p(6.2, 17.8), control1: p(1, 13.9), control2: p(3.1, 16.4))
        path.addLine(to: p(5.3, 21.5))
        path.addCurve(to: p(6, 22), control1: p(5.2, 21.9), control2: p(5.7, 22.2))
        path.addLine(to: p(10.3, 19.1))
        path.addCurve(to: p(12.1, 19.2), control1: p(10.9, 19.2), control2: p(11.5, 19.2))
        path.addCurve(to: p(23.1, 11.2), control1: p(18.2, 19.2), control2: p(23.1, 15.7))
        path.addCurve(to: p(12, 3), control1: p(23.1, 6.7), control2: p(18.1, 3))
        path.closeSubpath()
        return path
    }
}
