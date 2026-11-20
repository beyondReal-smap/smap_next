//
// LoginView.swift
// smap
//
// 네이티브 로그인 화면 (iOS 13+)
// Next.js 스타일 반영: 브랜드 색상(SMAPTheme.Color.primary, 앱 남색 #345F8C)
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
    @State private var showsEmailForm = false
    @State private var waitingForApple = false
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver

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
            NavigationStack {
                welcomeScreen
                    .navigationTitle("로그인")
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(isPresented: $showsEmailForm) {
                        emailScreen
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar(.visible, for: .navigationBar)
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) { signUpSection }
                            }
                    }
            }
            .disabled(viewModel.isLoading)

            // 로딩 오버레이
            if viewModel.isLoading {
                loadingOverlay
            }
        }
        .overlay(alignment: showsEmailForm ? .bottom : .top) {
            if viewModel.showError, let message = viewModel.errorMessage {
                HStack(spacing: 10) {
                    Image(systemName: "info.circle.fill").accessibilityHidden(true)
                    Text(message).font(SMAPTheme.Font.secondary).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button { viewModel.dismissError() } label: {
                        Image(systemName: "xmark").font(.caption.bold()).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("안내 닫기")
                }
                .foregroundStyle(.white)
                .padding(.leading, 14)
                .padding(.vertical, 4)
                .background(SMAPTheme.Surface.onSurface, in: RoundedRectangle(cornerRadius: 14))
                .frame(maxWidth: 480)
                .padding(.horizontal, 20)
                .padding(.top, showsEmailForm ? 0 : 70)
                .padding(.bottom, showsEmailForm ? 12 : 0)
                .task(id: message) {
                    if voiceOver {
                        UIAccessibility.post(notification: .announcement, argument: message)
                        return
                    }
                    try? await Task.sleep(for: .seconds(6))
                    if !Task.isCancelled { viewModel.dismissError() }
                }
            }
        }
        .smapAccent(.family)
        .onChange(of: showsEmailForm) { _, _ in viewModel.dismissError() }
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
                showsEmailForm = true
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

    private var welcomeScreen: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    HStack(spacing: 9) {
                        Image("AppNoBg")
                            .resizable()
                            .frame(width: 30, height: 30)
                            .accessibilityHidden(true)
                        Text("도착했어")
                            .font(.suite(size: 23, weight: .heavy))
                            .tracking(-0.8)
                            .accessibilityAddTraits(.isHeader)
                        Spacer()
                        signUpSection
                    }
                    .frame(minHeight: 48)

                    LoginArrivalPhotos(isActive: !showsEmailForm && !waitingForApple && !viewModel.isLoading && !viewModel.showError)
                        .frame(height: min(530, max(145, geometry.size.height - 252)))
                        .padding(.top, 8)

                    Button {
                        showsEmailForm = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "envelope")
                            Text("이메일로 계속하기").font(SMAPTheme.Font.bodyBold)
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .padding(.horizontal, 20)
                        .frame(minHeight: 56)
                        .foregroundStyle(.white)
                        .background(SMAPAccent.family.deep, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 16)

                    dividerSection.padding(.top, 18)
                    socialLoginSection.padding(.top, 10)
                }
                .frame(maxWidth: 480)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, minHeight: geometry.size.height)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
        }
        .background(Color(uiColor: .systemBackground))
    }

    private var emailScreen: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("이메일 로그인")
                    .font(.suite(size: 32, weight: .bold))
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, 24)
                loginFormSection
                SMAPButton("로그인", isLoading: viewModel.isLoading, isDisabled: !viewModel.isInputValid) {
                    HapticManager.shared.impact(style: .medium)
                    hideKeyboard()
                    loginAction()
                }
                .padding(.top, 20)
                forgotPasswordLink
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.plain)
                    .padding(.top, 8)
            }
            .frame(maxWidth: 440)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Login Form Section

    private var loginFormSection: some View {
        VStack(spacing: 12) {
            SMAPTextField(
                "name@example.com",
                text: $viewModel.phoneNumber,
                label: "이메일",
                keyboardType: .emailAddress,
                textContentType: .username,
                submitLabel: .next
            )

            SMAPTextField(
                "비밀번호 입력",
                text: $viewModel.password,
                label: "비밀번호",
                isSecure: true,
                textContentType: .password,
                submitLabel: .done
            )
        }
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
            Text("비밀번호 찾기")
                .font(SMAPTheme.Font.captionMedium)
                .foregroundStyle(Color(uiColor: .secondaryLabel))
                .frame(minHeight: 44)
        }
    }

    // MARK: - Divider Section

    private var dividerSection: some View {
        HStack {
            Rectangle()
                .fill(Color(uiColor: .separator).opacity(0.5))
                .frame(height: 1)

            Text("간편 로그인")
                .font(SMAPTheme.Font.captionMedium)
                .foregroundColor(SMAPTheme.Color.textSecondary)
                .padding(.horizontal, 12)

            Rectangle()
                .fill(Color(uiColor: .separator).opacity(0.5))
                .frame(height: 1)
        }
    }

    // MARK: - Social Login Section

    private var socialLoginSection: some View {
        HStack(spacing: 8) {
            Button {
                HapticManager.shared.impact(style: .medium)
                viewModel.googleLogin()
            } label: {
                LoginProviderLabel(name: "Google", background: .white) {
                    GoogleLogoView()
                }
            }
            .accessibilityLabel("Google로 계속하기")

            Button {
                HapticManager.shared.impact(style: .medium)
                viewModel.kakaoLogin()
            } label: {
                LoginProviderLabel(name: "카카오", background: Color(red: 1, green: 229/255, blue: 0), brandText: .black) {
                    KakaoSymbolShape().fill(.black)
                }
            }
            .accessibilityLabel("카카오로 계속하기")

            CustomAppleSignInButton(onTap: triggerAppleSignIn)
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isLoading)
    }

    // Apple Sign In 트리거
    private func triggerAppleSignIn() {
        viewModel.dismissError()
        waitingForApple = true
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email, .fullName]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = AppleSignInCoordinator.shared
        controller.presentationContextProvider = AppleSignInCoordinator.shared

        AppleSignInCoordinator.shared.onCompletion = { result in
            self.waitingForApple = false
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
        Button {
            onNavigateToRegister?(nil)
        } label: {
            Text("회원가입")
                .font(.suite(size: 14, weight: .bold))
                .foregroundStyle(.primary)
                .frame(minWidth: 44, minHeight: 44)
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

private struct LoginArrivalPhotos: View {
    let isActive: Bool
    private let photos = ["LoginArrival", "LoginArrivalCycling", "LoginArrivalDoorway"]
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var index = 0
    @State private var paused = false

    private var playing: Bool { isActive && scenePhase == .active && !reduceMotion && !paused }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { geometry in
                Image(photos[index])
                    .resizable()
                    .scaledToFill()
                    .alignmentGuide(.trailing) { image in
                        image.width - max(0, image.width - geometry.size.width) * (index == 2 ? 0.40 : 0.22)
                    }
                    .frame(width: geometry.size.width, height: geometry.size.height, alignment: .trailing)
                    .accessibilityHidden(true)
                    .id(index)
                    .transition(.opacity)
            }
            LinearGradient(
                stops: [.init(color: .clear, location: 0.45), .init(color: .black.opacity(0.63), location: 1)],
                startPoint: .top, endPoint: .bottom
            )
            Text("가족이 도착하면,\n먼저 알려드려요.")
                .font(.suite(size: 30, weight: .bold))
                .tracking(-1)
                .foregroundStyle(.white)
                .padding(20)
        }
        .overlay(alignment: .topTrailing) {
            Button {
                if reduceMotion {
                    index = (index + 1) % photos.count
                } else {
                    paused.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Text("\(index + 1) / \(photos.count)").font(.caption.weight(.semibold)).monospacedDigit()
                    Image(systemName: reduceMotion ? "chevron.right" : (paused ? "play.fill" : "pause.fill"))
                        .font(.system(size: 10, weight: .bold))
                }
                .padding(.horizontal, 10)
                .frame(height: 28)
                .foregroundStyle(.white)
                .background(.black.opacity(0.55), in: Capsule())
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(reduceMotion ? "다음 사진" : (paused ? "사진 전환 재생" : "사진 전환 일시 정지"))
            .accessibilityValue("\(index + 1) / \(photos.count)")
            .padding(.trailing, 12)
            .padding(.top, 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .task(id: playing) {
            guard playing else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(6))
                guard !Task.isCancelled else { return }
                withAnimation(.easeInOut(duration: 0.7)) { index = (index + 1) % photos.count }
            }
        }
    }
}

struct LoginProviderLabel<Logo: View>: View {
    let name: String
    let background: Color
    var brandText: Color? = nil
    @ViewBuilder var logo: () -> Logo

    var body: some View {
        HStack(spacing: 7) {
            logo()
                .frame(width: 17, height: 17)
                .frame(width: 26, height: 26)
                .background(background, in: Circle())
                .accessibilityHidden(true)
            Text(name)
                .font(SMAPTheme.Font.captionMedium)
                .foregroundStyle(brandText ?? .primary)
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(brandText == nil ? Color.clear : background, in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            if brandText == nil {
                RoundedRectangle(cornerRadius: 12).strokeBorder(Color(uiColor: .separator).opacity(0.6))
            }
        }
        .contentShape(Rectangle())
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
