//
// LoginView.swift
// smap
//
// 네이티브 로그인 화면 (iOS 13+)
// Next.js 스타일 반영: 브랜드 색상 #0113A3
//

import SwiftUI
import AuthenticationServices
import CoreLocation
import NMapsMap
import WebKit
import Combine

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

// MARK: - Custom TextField with Focus State (iOS 13+)

struct FocusableTextField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalizationType: UITextAutocapitalizationType = .none
    var autocorrectionDisabled: Bool = true
    @State private var isFocused: Bool = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(isFocused ? BrandColors.primary : BrandColors.textSecondary)
                .frame(width: 20)
            
            TextField(placeholder, text: $text, onEditingChanged: { editing in
                withAnimation(.easeInOut(duration: 0.2)) {
                    isFocused = editing
                }
            })
            .font(.suite(size: 16))
            .keyboardType(keyboardType)
            .autocapitalization(autocapitalizationType) // use older API for better FocusableTextField compatibility if needed, or textInputAutocapitalization
            .disableAutocorrection(autocorrectionDisabled)
        }
        .padding(.horizontal, 16)
        .frame(height: 56) // 고정 높이
        .background(BrandColors.inputBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isFocused ? BrandColors.primary : BrandColors.border, lineWidth: isFocused ? 2 : 1)
        )
    }
}

// MARK: - SecureField with Focus handling (iOS 13+)
struct SecureFocusField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    var onFocusChange: (Bool) -> Void

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.isSecureTextEntry = true
        textField.delegate = context.coordinator
        textField.isSecureTextEntry = true
        textField.delegate = context.coordinator
        textField.font = UIFont(name: "SUITE-Regular", size: 16)
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
        textField.returnKeyType = .done
        
        textField.addTarget(context.coordinator, action: #selector(Coordinator.textFieldDidChange(_:)), for: .editingChanged)
        
        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UITextFieldDelegate {
        var parent: SecureFocusField

        init(parent: SecureFocusField) {
            self.parent = parent
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.onFocusChange(true)
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.onFocusChange(false)
        }

        @objc func textFieldDidChange(_ textField: UITextField) {
            parent.text = textField.text ?? ""
        }
        
        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            textField.resignFirstResponder()
            return true
        }
    }
}

struct FocusableSecureField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String
    @Binding var showPassword: Bool
    @State private var isFocused: Bool = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(isFocused ? BrandColors.primary : BrandColors.textSecondary)
                .frame(width: 20)
            
            ZStack(alignment: .leading) {
                if showPassword {
                    TextField(placeholder, text: $text, onEditingChanged: { editing in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isFocused = editing
                        }
                    })
                    .font(.suite(size: 16))
                    .frame(height: 24)
                } else {
                    // SecureField alternative that supports focus detection
                    SecureFocusField(placeholder: placeholder, text: $text) { editing in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isFocused = editing
                        }
                    }
                    .frame(height: 24)
                }
            }
            .frame(height: 24) // 고정 높이로 토글 시 높이 변화 방지
            
            Button(action: {
                showPassword.toggle()
            }) {
                Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                    .foregroundColor(BrandColors.textSecondary)
                    .frame(width: 20)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 56) // 고정 높이
        .background(BrandColors.inputBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isFocused ? BrandColors.primary : BrandColors.border, lineWidth: isFocused ? 2 : 1)
        )
    }
}

// MARK: - Custom Apple Sign In Button (Google 스타일과 동일)

struct CustomAppleSignInButton: View {
    var onTap: () -> Void
    
    var body: some View {
        Button(action: {
            HapticManager.shared.impact(style: .medium)
            onTap()
        }) {
            HStack(spacing: 12) {
                // Apple 로고
                Image(systemName: "apple.logo")
                    .font(.suite(size: 22, weight: .medium))
                    .foregroundColor(.white)
                
                Text("Apple로 계속하기")
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.black)
            .cornerRadius(12)
            // .overlay(
            //    RoundedRectangle(cornerRadius: 12)
            //        .stroke(BrandColors.border, lineWidth: 1)
            // )
            .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
        }
    }
}

// MARK: - Apple Sign In Coordinator (Singleton)

class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleSignInCoordinator()
    
    var onCompletion: ((Result<ASAuthorization, Error>) -> Void)?
    
    private override init() {
        super.init()
    }
    
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            return window
        }
        return UIWindow()
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        onCompletion?(.success(authorization))
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        onCompletion?(.failure(error))
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

// MARK: - HomeViewModel (Merged from separate file)

@MainActor
class HomeViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var members: [SmapGroupMember] = []
    @Published var schedules: [SmapSchedule] = []
    
    @Published var selectedDate: Date = Date()
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var isSidebarOpen: Bool = false
    @Published var hasUnreadNotifications: Bool = false
    @Published var showGroupCreationModal: Bool = false
    
    private let homeService = HomeService.shared
    private var badgePollingTimer: Timer?
    private var syncObserver: Any?
    
    init() {
        // 알림 상태 동기화를 위한 observer 추가
        syncObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("notificationSyncNeeded"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.checkUnreadNotifications()
            }
        }
    }
    
    deinit {
        badgePollingTimer?.invalidate()
        if let observer = syncObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    func fetchInitialData() async {
        print("🚀 [HomeViewModel] fetchInitialData started")
        self.isLoading = true
        
        do {
            let fetchedGroups = try await homeService.getMyGroups()
            
            print("📝 [HomeViewModel] Fetched \(fetchedGroups.count) groups")
            self.groups = fetchedGroups
            
            if fetchedGroups.isEmpty {
                print("⚠️ [HomeViewModel] No groups found, triggering mandatory group creation")
                self.showGroupCreationModal = true
            } else if let first = fetchedGroups.first {
                self.selectGroup(first)
            }
            
            self.isLoading = false
            checkUnreadNotifications()
            startBadgePolling() // 폴링 시작
        } catch {
            print("❌ [HomeViewModel] fetchInitialData failed: \(error)")
            if let apiError = error as? APIError {
                self.errorMessage = apiError.message ?? "그룹 목록을 불러오는데 실패했습니다."
            } else {
                self.errorMessage = error.localizedDescription
            }
            
            // 그룹이 없고 에러가 난 경우에도 (특히 401 등) 신규 사용자의 경우일 수 있으므로
            // 모달을 띄워 그룹 생성을 유도하거나 최소한 UI가 멈춰있지 않게 함
            // 단, 401이면 생성이 실패할 수도 있지만, 사용자 경험상 먹통보다는 나음
            if self.groups.isEmpty {
                 print("⚠️ [HomeViewModel] Error occurred but groups are empty. Forcing Group Creation Modal.")
                self.showGroupCreationModal = true
            }
            
            self.isLoading = false
        }
    }
    
    func selectGroup(_ group: SmapGroup) {
        HapticManager.shared.selection()
        self.selectedGroup = group
        Task {
            await fetchGroupData(sgtIdx: group.sgt_idx)
        }
    }
    
    func fetchGroupData(sgtIdx: Int) async {
        print("🚀 [HomeViewModel] fetchGroupData started for group: \(sgtIdx)")
        
        // 1. 멤버 데이터 가져오기 (필수)
        do {
            let fetchedMembers = try await homeService.getGroupMembers(sgtIdx: sgtIdx)
            print("📝 [HomeViewModel] Fetched \(fetchedMembers.count) members")
            
            self.members = fetchedMembers
            
            // 3. 로그인한 사용자 자동 선택 (최초 진입 시)
            if let currentUser = AuthService.shared.getUserData(),
               let currentMember = fetchedMembers.first(where: { $0.mt_idx == currentUser.mt_idx }) {
                print("👤 [HomeViewModel] Auto-selecting logged-in user: \(currentMember.displayName)")
                self.selectMember(currentMember)
            }
        } catch {
            print("❌ [HomeViewModel] 멤버 데이터 가져오기 실패: \(error)")
            if let apiError = error as? APIError {
                self.errorMessage = apiError.message ?? "멤버 정보를 불러오는데 실패했습니다."
            } else {
                self.errorMessage = "멤버 정보를 불러오는데 실패했습니다."
            }
            return // 멤버를 못 가져오면 중단
        }
        
        // 2. 일정 데이터 가져오기 (선택 - 에러나도 무시)
        do {
            let fetchedSchedules = try await homeService.getGroupSchedules(sgtIdx: sgtIdx)
            print("📝 [HomeViewModel] Fetched \(fetchedSchedules.count) schedules")
            
            self.schedules = fetchedSchedules
        } catch {
            print("⚠️ [HomeViewModel] 일정 데이터 가져오기 실패 (무시됨): \(error)")
        }
        
        checkUnreadNotifications()
    }
    
    /// 미확인 알림 여부 체크
    func checkUnreadNotifications() {
        guard let user = AuthService.shared.getUserData() else { return }
        
        Task {
            do {
                let logs = try await NotificationService.shared.getMemberPushLogs(memberId: user.mt_idx ?? 0)
                DispatchQueue.main.async {
                    self.hasUnreadNotifications = logs.contains(where: { $0.plt_read_chk == .N })
                }
            } catch {
                print("⚠️ [HomeViewModel] 미확인 알림 체크 실패: \(error)")
            }
        }
    }
    
    /// 모든 알림 읽음 처리
    func markAllAsRead() {
        guard let user = AuthService.shared.getUserData() else { return }
        Task {
            do {
                let response = try await NotificationService.shared.markAllAsRead(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    print("✅ [HomeViewModel] 모든 알림 읽음 처리 성공")
                    DispatchQueue.main.async {
                        self.hasUnreadNotifications = false
                    }
                    // 알림 목록이 열려있을 경우를 위해 이벤트 발송
                    NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                }
            } catch {
                print("❌ [HomeViewModel] 모든 알림 읽음 처리 실패: \(error)")
            }
        }
    }
    
    /// 30초마다 알림 체크 폴링 시작
    func startBadgePolling() {
        badgePollingTimer?.invalidate()
        badgePollingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkUnreadNotifications()
            }
        }
        print("⏱️ [HomeViewModel] Badge polling started")
    }
    
    func stopBadgePolling() {
        badgePollingTimer?.invalidate()
        badgePollingTimer = nil
        print("🛑 [HomeViewModel] Badge polling stopped")
    }
    
    // MARK: - Lifecycle Support
    
    func pauseUpdates() {
        stopBadgePolling()
        print("⏸️ [HomeViewModel] Updates paused (Tab inactive)")
    }
    
    func resumeUpdates() {
        checkUnreadNotifications() // 즉시 체크
        startBadgePolling()
        print("▶️ [HomeViewModel] Updates resumed (Tab active)")
    }
    
    // 선택된 날짜에 해당하는 일정 필터링 (선택되지 않은 경우 빈 배열 반환)
    var filteredSchedules: [SmapSchedule] {
        // 선택된 멤버 찾기
        guard let selectedMember = members.first(where: { $0.isSelected }) else {
            print("⚠️ [filteredSchedules] No member selected")
            return []
        }
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let selectedDateStr = dateFormatter.string(from: selectedDate)
        
        print("🔍 [filteredSchedules] Filtering - Member: \(selectedMember.mt_name ?? "Unknown"), sgdt_idx: \(selectedMember.sgdt_idx ?? -1), selectedDate: \(selectedDateStr)")
        print("🔍 [filteredSchedules] Total schedules available: \(schedules.count)")
        
        let filtered = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }
            
            // sgdt_idx 매칭 확인 (Next.js와 동일 로직)
            guard let scheduleSgdtIdx = schedule.sgdt_idx,
                  let memberSgdtIdx = selectedMember.sgdt_idx else {
                return false
            }
            
            // sgdt_idx로 비교 (Next.js: Number(schedule.sgdt_idx) === Number(member.sgdt_idx))
            let sgdtMatch = scheduleSgdtIdx == memberSgdtIdx
            if !sgdtMatch {
                return false
            }
            
            // 날짜 매칭 확인
            guard let sDateStr = schedule.date else {
                return false
            }
            
            // sst_edate 디버깅 (처음 5개만)
            if schedules.firstIndex(where: { $0.sst_idx == schedule.sst_idx })! < 5 {
                print("🔍 [DEBUG] Schedule '\(schedule.title ?? "")': date=\(schedule.date ?? "nil"), sst_edate=\(schedule.sst_edate ?? "nil")")
            }
            
            // "yyyy-MM-dd HH:mm:ss" 형식으로 파싱
            let scheduleDateFormatter = DateFormatter()
            scheduleDateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            
            if let scheduleDate = scheduleDateFormatter.date(from: sDateStr) {
                let scheduleDateStr = dateFormatter.string(from: scheduleDate)
                let dateMatch = scheduleDateStr == selectedDateStr
                if sgdtMatch && dateMatch {
                    print("✅ [filteredSchedules] Match: '\(schedule.title ?? "")', sgdt_idx: \(scheduleSgdtIdx), edate: \(schedule.sst_edate ?? "nil")")
                }
                return dateMatch
            }
            
            // 날짜 파싱 실패 시 문자열로 비교
            let dateMatch = sDateStr.hasPrefix(selectedDateStr)
            return dateMatch
        }
        
        print("📊 [filteredSchedules] Total filtered: \(filtered.count) schedules")
        return filtered
    }
    
    func selectMember(_ member: SmapGroupMember) {
        HapticManager.shared.selection()
        for i in 0..<members.count {
            members[i].isSelected = (members[i].mt_idx == member.mt_idx)
        }
    }
    
    func getMemberTodayStats(mtIdx: Int) -> (completed: Int, ongoing: Int, upcoming: Int) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let selectedDateStr = dateFormatter.string(from: selectedDate)
        
        // mtIdx로 멤버 찾기
        guard let member = members.first(where: { $0.mt_idx == mtIdx }),
              let memberSgdtIdx = member.sgdt_idx else {
            print("⚠️ [getMemberTodayStats] Member not found or missing sgdt_idx for mtIdx: \(mtIdx)")
            return (0, 0, 0)
        }
        
        print("📊 [getMemberTodayStats] Calculating stats for \(member.mt_name ?? "Unknown") (sgdt_idx: \(memberSgdtIdx)) on \(selectedDateStr)")
        
        let todaySchedules = schedules.filter { schedule in
            // sst_show가 Y인 것만 표시
            guard schedule.sst_show == "Y" else {
                return false
            }
            
            // sgdt_idx 매칭
            guard let scheduleSgdtIdx = schedule.sgdt_idx,
                  scheduleSgdtIdx == memberSgdtIdx else {
                return false
            }
            
            // 날짜 매칭
            guard let sDateStr = schedule.date else { return false }
            
            let scheduleDateFormatter = DateFormatter()
            scheduleDateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            
            if let scheduleDate = scheduleDateFormatter.date(from: sDateStr) {
                let scheduleDateStr = dateFormatter.string(from: scheduleDate)
                return scheduleDateStr == selectedDateStr
            }
            
            return sDateStr.hasPrefix(selectedDateStr)
        }
        
        print("📊 [getMemberTodayStats] Found \(todaySchedules.count) schedules for this member on this date")
        
        var completed = 0
        var ongoing = 0
        var upcoming = 0
        
        for schedule in todaySchedules {
            let status = schedule.status
            print("   - Schedule '\(schedule.title ?? "No title")': \(status.text)")
            switch status {
            case .completed: completed += 1
            case .ongoing: ongoing += 1
            case .upcoming: upcoming += 1
            case .defaultStatus: break
            }
        }
        
        print("📊 [getMemberTodayStats] Stats: completed=\(completed), ongoing=\(ongoing), upcoming=\(upcoming)")
        return (completed, ongoing, upcoming)
    }
    
    /// 현재 선택된 그룹의 데이터 새로고침 (멤버 위치 포함)
    func refreshData() async {
        print("🔄 [HomeViewModel] refreshData started")
        
        // 1. 그룹 목록 새로고침
        do {
            let fetchedGroups = try await homeService.getMyGroups()
            self.groups = fetchedGroups
            print("🔄 [HomeViewModel] Refreshed \(fetchedGroups.count) groups")
        } catch {
            print("⚠️ [HomeViewModel] 그룹 새로고침 실패: \(error)")
        }
        
        // 2. 현재 선택된 그룹의 멤버/일정 새로고침
        if let currentGroup = selectedGroup {
            print("🔄 [HomeViewModel] Refreshing group \(currentGroup.sgt_idx) data")
            await fetchGroupData(sgtIdx: currentGroup.sgt_idx)
        } else if let firstGroup = groups.first {
            // 선택된 그룹이 없으면 첫 번째 그룹 선택
            selectGroup(firstGroup)
        }
        
        print("✅ [HomeViewModel] refreshData completed")
    }
}

// MARK: - HomeView (Merged from separate file)
import NMapsMap
import WebKit

struct HomeView: View {
    @StateObject var viewModel = HomeViewModel()
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var showNotifications = false
    @State private var showSettings = false // 설정 시트용 추가
    @State private var isMapLoading = true  // 지도 로딩 상태

    
    let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255) // #0113A3
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer (Fullscreen from top 60px basically)
            NaverMapView(members: $viewModel.members, schedules: viewModel.filteredSchedules)
                .edgesIgnoringSafeArea(.all)
                .offset(y: 60) // Offset map slightly below header
                .task {
                    // 최초 진입 시에만 데이터 로드
                    if viewModel.groups.isEmpty {
                        print("👀 [HomeView] View appeared - triggering fetchInitialData")
                        await viewModel.fetchInitialData()
                    }
                }
                .onAppear {
                    viewModel.resumeUpdates()
                }
            
            // 2. Header
            VStack {
                HomeHeaderView(
                    groups: viewModel.groups,
                    selectedGroup: $viewModel.selectedGroup,
                    hasUnread: viewModel.hasUnreadNotifications,
                    onSelect: { group in
                        viewModel.selectGroup(group)
                    },
                    onNotificationTap: {
                        viewModel.markAllAsRead() // 알림 아이콘 누르면 즉시 모두 읽음 처리
                        showNotifications = true
                    },
                    onSettingsTap: {
                        showSettings = true
                    }
                )
                Spacer()
            }
            .sheet(isPresented: $showNotifications, onDismiss: {
                viewModel.checkUnreadNotifications()
            }) {
                NotificationListView()
            }
            .sheet(isPresented: $showSettings) {
                SettingMenuView()
            }
            .fullScreenCover(isPresented: $viewModel.showGroupCreationModal) {
                GroupCreationView(viewModel: viewModel)
            }
            
            // 3. Sidebar Overlay (Blur + Dim)
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .edgesIgnoringSafeArea(.all)
                    .onTapGesture {
                        closeSidebar()
                    }
                    .transition(.opacity)
            }
            
            // 4. Sidebar Content with Gesture
            SidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)
            
            // 5. Edge Swipe Detection Area (Left Edge)
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 6. Floating Action Button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionHomeButton(count: viewModel.members.count) {
                        toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .onAppear {
            handleLoading()
            // 홈 화면이 다시 표시될 때 멤버 위치 새로고침
            Task {
                await viewModel.refreshData()
            }
        }
        .onDisappear {
            viewModel.pauseUpdates()
            // 페이지를 벗어날 때 사이드바 자동(즉시) 닫기
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            // 다시 돌아올 때를 위해 로딩 상태 리셋
            isMapLoading = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // 앱이 foreground로 돌아올 때 위치 데이터 새로고침
            print("🔄 [HomeView] App entered foreground - refreshing location data")
            Task {
                await viewModel.refreshData()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            if let targetTab = notification.object as? Int, targetTab == 0 {
                isMapLoading = true
                handleLoading()
            }
        }
        .navigationBarHidden(true)
    }
    
    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        // 이미 진행 중인 타이머가 있을 수 있으므로 isMapLoading이 true일 때만 시작
        guard isMapLoading else { return }
        
        Task {
            // 최소 1.5초 대기
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }
            
            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var sidebarOffset: CGFloat {
        if viewModel.isSidebarOpen {
            return max(0, sidebarDragOffset)
        } else {
            return min(0, -sidebarWidth + sidebarDragOffset)
        }
    }
    
    private var overlayOpacity: Double {
        let progress: Double
        if viewModel.isSidebarOpen {
            progress = 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth)
        } else {
            progress = Double(sidebarDragOffset) / Double(sidebarWidth)
        }
        return 0.4 * max(0, min(1, progress))
    }
    
    // MARK: - Gestures
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                if value.translation.width > 0 {
                    sidebarDragOffset = min(sidebarWidth, value.translation.width)
                }
            }
            .onEnded { value in
                if value.translation.width > sidebarWidth * 0.3 || value.predictedEndTranslation.width > sidebarWidth * 0.5 {
                    openSidebar()
                } else {
                    closeSidebar()
                }
            }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                sidebarDragOffset = value.translation.width
            }
            .onEnded { value in
                if viewModel.isSidebarOpen {
                    // Closing gesture (drag left)
                    if value.translation.width < -sidebarWidth * 0.3 || value.predictedEndTranslation.width < -sidebarWidth * 0.5 {
                        closeSidebar()
                    } else {
                        // Snap back open
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            sidebarDragOffset = 0
                        }
                    }
                }
            }
    }
    
    // MARK: - Actions
    
    private func openSidebar() {
        HapticManager.shared.impact(style: .light)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            viewModel.isSidebarOpen = true
            sidebarDragOffset = 0
        }
    }
    
    private func closeSidebar() {
        HapticManager.shared.impact(style: .light)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
        }
    }
    
    private func toggleSidebar() {
        if viewModel.isSidebarOpen {
            closeSidebar()
        } else {
            openSidebar()
        }
    }
}

struct SidebarView: View {
    @ObservedObject var viewModel: HomeViewModel
    let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Sidebar Header
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(brandColor)
                        .frame(width: 40, height: 40)
                    Image(systemName: "person.2.fill")
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("멤버 조회")
                        .font(.suite(size: 20, weight: .bold))
                    Text("멤버를 선택해보세요")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 20)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) { // Reduced spacing from 24
                    // Group Selector Section
                    VStack(alignment: .leading, spacing: 8) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.red).frame(width: 8, height: 8)
                            Text("그룹 목록").font(.suite(size: 16, weight: .bold))
                        }
                        
                        Menu {
                            ForEach(viewModel.groups) { group in
                                Button(group.sgt_title ?? "이름 없음") {
                                    viewModel.selectGroup(group)
                                }
                            }
                        } label: {
                            HStack {
                                Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                                    .font(.suite(size: 17))
                                    .foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.down")
                                    .font(.suite(size: 15))
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                            .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    
                    // Date Selector Section
                    VStack(alignment: .leading, spacing: 8) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.yellow).frame(width: 8, height: 8)
                            Text("날짜 선택").font(.suite(size: 16, weight: .bold))
                        }
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) { // Reduced spacing from 12
                                ForEach(0..<14) { i in
                                    let date = Calendar.current.date(byAdding: .day, value: i, to: Date()) ?? Date()
                                    DateCell(date: date, isSelected: Calendar.current.isDate(date, inSameDayAs: viewModel.selectedDate)) {
                                        viewModel.selectedDate = date
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    
                    // Member List Section
                    VStack(alignment: .leading, spacing: 10) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.blue).frame(width: 8, height: 8)
                            Text("멤버 목록").font(.suite(size: 16, weight: .bold))
                            Spacer()
                            Text("\(viewModel.members.count)명")
                                .font(.suite(size: 14))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(Color.secondary.opacity(0.1)))
                        }
                        
                        VStack(spacing: 8) { // Reduced spacing from 12
                            ForEach(viewModel.members) { member in
                                SidebarMemberCell(member: member, stats: viewModel.getMemberTodayStats(mtIdx: member.mt_idx)) {
                                    viewModel.selectMember(member)
                                    withAnimation {
                                        viewModel.isSidebarOpen = false
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .edgesIgnoringSafeArea(.all)
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
}

struct DateCell: View {
    let date: Date
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                Text(dayOfWeek)
                    .font(.suite(size: 10))
                Text(dayOfMonth)
                    .font(.suite(size: 14, weight: .bold))
            }
            .frame(width: 50, height: 50)
            .background(isSelected ? Color(red: 1/255, green: 19/255, blue: 163/255) : Color.white)
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 5)
        }
    }
    
    var dayOfWeek: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "E"
        return formatter.string(from: date)
    }
    
    var dayOfMonth: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

struct SidebarMemberCell: View {
    let member: SmapGroupMember
    let stats: (completed: Int, ongoing: Int, upcoming: Int)
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                MemberAvatarView(member: member)
                
                MemberStatsView(name: member.displayName, stats: stats)
                
                Spacer()
            }
            .padding(12)
            .background(member.isSelected ? Color(red: 1/255, green: 19/255, blue: 163/255).opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(member.isSelected ? Color(red: 1/255, green: 19/255, blue: 163/255).opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
    }
}

struct MemberAvatarView: View {
    let member: SmapGroupMember
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        let _ = print("🔍 [MemberAvatarView] \(member.mt_name ?? "unknown"): mt_file1 = '\(member.mt_file1 ?? "nil")', URL = \(getProfileImageUrl(member.mt_file1)?.absoluteString ?? "nil")")
        ZStack(alignment: .bottomTrailing) {
            // Profile Image with Selection Border
            Group {
                if let url = getProfileImageUrl(member.mt_file1) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: 44, height: 44)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                        case .failure:
                            placeholderCircle
                        @unknown default:
                            placeholderCircle
                        }
                    }
                } else {
                    placeholderCircle
                }
            }
            .overlay(
                Circle()
                    .stroke(member.isSelected ? brandColor : Color.clear, lineWidth: 2.5)
            )
            
            // Crown Icon (Owner) - 테두리 위에 표시
            if member.sgdt_owner_chk == "Y" {
                Circle()
                    .fill(Color.yellow)
                    .frame(width: 16, height: 16)
                    .overlay(Image(systemName: "crown.fill").font(.suite(size: 8)).foregroundColor(.white))
                    .offset(x: 4, y: 4)
            }
        }
        .frame(width: 52, height: 52)
    }
    
    var placeholderCircle: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 44, height: 44)
            .overlay(
                Image(systemName: "person.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.gray)
            )
    }
    
    var placeholderView: some View {
        placeholderCircle
    }
    
    func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

struct MemberStatsView: View {
    let name: String
    let stats: (completed: Int, ongoing: Int, upcoming: Int)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(.suite(size: 17, weight: .medium))
                .foregroundColor(.primary)
            
            HStack(spacing: 8) {
                StatItemView(label: "완료", count: stats.completed, color: .green)
                StatItemView(label: "진행", count: stats.ongoing, color: .orange)
                StatItemView(label: "예정", count: stats.upcoming, color: .blue)
            }
        }
    }
}

struct StatItemView: View {
    let label: String
    let count: Int
    let color: Color
    
    var body: some View {
        HStack(spacing: 2) {
            Text(label).font(.suite(size: 10)).foregroundColor(.gray)
            Text("\(count)").font(.suite(size: 13, weight: .bold)).foregroundColor(color)
        }
    }
}

struct FloatingActionHomeButton: View {
    let count: Int
    let action: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255) // #0113A3
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255) // Pink-500
    
    var body: some View {
        Button(action: {
            HapticManager.shared.impact(style: .medium)
            action()
        }) {
            ZStack(alignment: .topTrailing) {
                // Main Button Circle
                Circle()
                    .fill(brandColor)
                    .frame(width: 56, height: 56)
                    .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                // Badge (Pink)
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold)) // Size increased from 10
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24) // Dimension increased from 20
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape( RoundedCorner(radius: radius, corners: corners) )
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}

// MARK: - Home Subviews

struct HomeHeaderView: View {
    let groups: [SmapGroup]
    @Binding var selectedGroup: SmapGroup?
    let hasUnread: Bool
    let onSelect: (SmapGroup) -> Void
    let onNotificationTap: () -> Void
    let onSettingsTap: () -> Void
    
    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("홈")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹 멤버들과 실시간으로 소통해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            HStack(spacing: 0) {
                Button(action: {
                    onNotificationTap()
                }) {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(.gray)
                        
                        if hasUnread {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                        }
                    }
                }
                .frame(width: 36, height: 44)
                
                Button(action: {
                    onSettingsTap()
                }) {
                    Image(systemName: "gearshape.fill")
                        .font(.suite(size: 20))
                        .foregroundColor(.gray)
                }
                .frame(width: 36, height: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            BlurView(style: .systemUltraThinMaterialLight)
                .edgesIgnoringSafeArea(.top)
        )
    }
}

struct BlurView: UIViewRepresentable {
    var style: UIBlurEffect.Style
    func makeUIView(context: Context) -> UIVisualEffectView {
        return UIVisualEffectView(effect: UIBlurEffect(style: style))
    }
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: style)
    }
}

// MemberHorizontalListView was deleted in favor of SidebarView.

struct ScheduleCardView: View {
    let schedule: SmapSchedule
    
    var body: some View {
        HStack(spacing: 15) {
            VStack {
                Text(scheduleTime)
                    .font(.suite(size: 12))
                    .foregroundColor(.secondary)
            }
            .frame(width: 60)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(schedule.title ?? "일정 이름 없음")
                    .font(.suite(size: 15, weight: .bold))
                
                if let memo = schedule.sst_memo, !memo.isEmpty {
                    Text(memo)
                        .font(.suite(size: 12))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            StatusBadge(status: schedule.status)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 15).fill(Color.secondary.opacity(0.05)))
    }
    
    var scheduleTime: String {
        guard let sDateStr = schedule.date else { return "--:--" }
        
        // "2023-10-27T09:00:00" or "2023-10-27 09:00:00"
        let parts = sDateStr.contains("T") ? sDateStr.split(separator: "T") : sDateStr.split(separator: " ")
        
        if parts.count > 1 {
            let timeParts = parts[1].split(separator: ":")
            if timeParts.count > 1 {
                return "\(timeParts[0]):\(timeParts[1])"
            }
        }
        return "--:--"
    }
}

struct StatusBadge: View {
    let status: ScheduleStatus
    
    var body: some View {
        Text(status.text)
            .font(.suite(size: 10, weight: .bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor.opacity(0.1))
            .foregroundColor(backgroundColor)
            .cornerRadius(5)
    }
    
    var backgroundColor: Color {
        switch status {
        case .completed: return .green
        case .ongoing: return .orange
        case .upcoming: return .blue
        case .defaultStatus: return .gray
        }
    }
}

// NativeMapView struct removed in favor of NaverMapView

// MARK: - MainTabView & Subviews (Consolidated for Compilation)

struct MainTabView: View {
    @State private var selectedTab: Int = 0
    @Namespace private var tabAnimation
    
    // 로그아웃 알림 퍼블리셔
    private let logoutPublisher = NotificationCenter.default.publisher(for: NSNotification.Name("logout"))
    
    init() {
        // 탭바 폰트 전역 설정
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = .white
        
        // 아이콘 + 텍스트 색상
        let _ = UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1.0)
        let _ = UIColor.systemGray
        
        // 폰트 설정 (SUITE-Medium, 10pt)
        let fontAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "SUITE-Medium", size: 10) ?? UIFont.systemFont(ofSize: 10, weight: .medium)
        ]
        
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = fontAttributes
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = fontAttributes
        
        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
    
    var body: some View {
        TabView(selection: $selectedTab.animation(.easeInOut(duration: 0.25))) {
            // 1. 홈 (Native)
            HomeView()
                .tabItem {
                    Image(systemName: "house")
                    Text("홈")
                }
                .tag(0)
            
            // 2. 그룹 (Native)
            GroupListView()
                .tabItem {
                    Image(systemName: "person.3.fill")
                    Text("그룹")
                }
                .tag(1)
            
            // 3. 일정 (Native)
            NativeScheduleListView()
                .tabItem {
                    Image(systemName: "calendar")
                    Text("일정")
                }
                .tag(2)
            
            // 4. 내장소 (Native)
            MyPlaceView()
                .tabItem {
                    Image(systemName: "location.circle")
                    Text("내장소")
                }
                .tag(3)
            
            // 5. 활동 로그 (Native)
            ActivityLogView()
                .tabItem {
                    Image(systemName: "clock.arrow.circlepath")
                    Text("활동 로그")
                }
                .tag(4)
        }
        .onChange(of: selectedTab) { _ in
            HapticManager.shared.selection()
            // 탭 전환 시 모든 사이드바 닫기 알림 발생 (현재 선택된 탭 인덱스 전달)
            NotificationCenter.default.post(name: NSNotification.Name("closeSidebars"), object: selectedTab)
        }
        .onReceive(logoutPublisher) { _ in
            // 로그아웃 알림 수신 시 로그인 페이지로 이동
            print("🔐 [MainTabView] 로그아웃 알림 수신 - LoginView로 이동")
            DispatchQueue.main.async {
                if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
                    IntroView.navigateToLoginView(appDelegate: appDelegate)
                }
            }
        }
    }
}

struct TabWebView: UIViewRepresentable {
    let urlString: String
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = URL(string: urlString) {
            let request = URLRequest(url: url)
            
            let authService = AuthService.shared
            var storageScript = ""
            if let token = authService.getToken(), let user = authService.getUserData() {
                if let userJsonData = try? JSONEncoder().encode(user),
                   let userJson = String(data: userJsonData, encoding: .utf8) {
                    let timestamp = Int64(Date().timeIntervalSince1970 * 1000)
                    storageScript += """
                        localStorage.setItem('smap_auth_token', '\(token)');
                        localStorage.setItem('smap_user_data', '\(userJson)');
                        localStorage.setItem('smap_login_time', '\(timestamp)');
                        localStorage.setItem('isLoggedIn', 'true');
                    """
                }
            }
            
            if !storageScript.isEmpty {
                let userScript = WKUserScript(source: "(function() { \(storageScript) })();", injectionTime: .atDocumentStart, forMainFrameOnly: true)
                uiView.configuration.userContentController.addUserScript(userScript)
            }
            
            uiView.load(request)
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: TabWebView
        
        init(_ parent: TabWebView) {
            self.parent = parent
        }
    }
}

struct NaverMapView: UIViewRepresentable {
    @Binding var members: [SmapGroupMember]
    var schedules: [SmapSchedule]
    
    func makeUIView(context: Context) -> NMFNaverMapView {
        let view = NMFNaverMapView()
        view.showZoomControls = false
        view.showLocationButton = false  // 현재위치 플로팅 버튼 숨김
        view.mapView.positionMode = .disabled  // 현재위치 마커 숨김
        view.mapView.zoomLevel = 15
        view.mapView.touchDelegate = context.coordinator
        
        // 사용자의 현재 위치로 초기화 (LocationService에서 가져옴)
        let lastLocation = LocationService.sharedInstance.getLastLocation()
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            let initialPosition = NMGLatLng(lat: lastLocation.coordinate.latitude, lng: lastLocation.coordinate.longitude)
            view.mapView.moveCamera(NMFCameraUpdate(scrollTo: initialPosition))
            print("📍 [NaverMapView-Home] Using device location: (\(lastLocation.coordinate.latitude), \(lastLocation.coordinate.longitude))")
        } else {
            print("📍 [NaverMapView-Home] No device location, using default")
        }
        
        return view
    }
    
    func updateUIView(_ uiView: NMFNaverMapView, context: Context) {
        context.coordinator.updateMarkers(mapView: uiView.mapView, members: members, schedules: schedules)
        
        // 맵 이동 로직 (선택된 멤버가 있을 때만 이동)
        // 주의: Binding이 변할 때마다 호출되므로, 실제로 위치가 변했을 때만 이동하도록 하는 것이 좋음
        if let targetMember = members.first(where: { $0.isSelected }) {
             if let lat = targetMember.mlt_lat, let lon = targetMember.mlt_long {
                 let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: lat, lng: lon))
                 cameraUpdate.animation = .easeIn
                 uiView.mapView.moveCamera(cameraUpdate)
             }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, NMFMapViewTouchDelegate, NMFOverlayImageDataSource {
        var parent: NaverMapView
        var markers: [NMFMarker] = []
        var infoWindow: NMFInfoWindow?
        var currentMapView: NMFMapView?
        var currentMember: SmapGroupMember?
        
        init(_ parent: NaverMapView) {
            self.parent = parent
            super.init()
            
            // InfoWindow 초기화
            infoWindow = NMFInfoWindow()
            infoWindow?.dataSource = self
            infoWindow?.anchor = CGPoint(x: 0.5, y: 1.2) // 마커와 간격 추가
        }
        
        // MARK: - NMFOverlayImageDataSource (InfoWindow 내용)
        func view(with overlay: NMFOverlay) -> UIView {
            let containerView = UIView()
            containerView.backgroundColor = .white
            containerView.layer.cornerRadius = 12
            containerView.layer.shadowColor = UIColor.black.cgColor
            containerView.layer.shadowOpacity = 0.15
            containerView.layer.shadowOffset = CGSize(width: 0, height: 4)
            containerView.layer.shadowRadius = 12
            
            guard let member = currentMember else {
                containerView.frame = CGRect(origin: .zero, size: CGSize(width: 100, height: 40))
                return containerView
            }
            
            // 멤버 정보 추출
            let name = member.displayName
            let battery = member.mlt_battery ?? 0
            let speed = member.mlt_speed ?? 0.0
            let gpsTime = member.mlt_gps_time ?? "업데이트 없음"
            
            // 배터리 색상
            let _ : UIColor = battery > 50 ? .systemGreen : (battery > 20 ? .systemOrange : .systemRed)
            
            // 레이아웃
            let padding: CGFloat = 12
            let width: CGFloat = 150
            var yOffset: CGFloat = padding
            
            // 이름 라벨
            let nameLabel = UILabel()
            nameLabel.font = UIFont(name: "SUITE-SemiBold", size: 14) ?? .systemFont(ofSize: 14, weight: .semibold)
            nameLabel.text = "👤 \(name)"
            nameLabel.textColor = .black
            nameLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 20)
            containerView.addSubview(nameLabel)
            yOffset += 24
            
            // 배터리 라벨
            let batteryLabel = UILabel()
            batteryLabel.font = UIFont(name: "SUITE-Regular", size: 12) ?? .systemFont(ofSize: 12)
            let batteryLevel = member.mlt_battery ?? -1
            let batteryText = batteryLevel < 0 ? "확인 불가" : "\(batteryLevel)%"
            batteryLabel.text = "🔋 배터리: \(batteryText)"
            batteryLabel.textColor = .gray
            batteryLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 18)
            containerView.addSubview(batteryLabel)
            yOffset += 20
            
            // 속도 라벨
            let speedLabel = UILabel()
            speedLabel.font = UIFont(name: "SUITE-Regular", size: 12) ?? .systemFont(ofSize: 12)
            speedLabel.text = "🚶 속도: \(String(format: "%.1f", speed))km/h"
            speedLabel.textColor = .gray
            speedLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 18)
            containerView.addSubview(speedLabel)
            yOffset += 20
            
            // GPS 시간 라벨
            let timeLabel = UILabel()
            timeLabel.font = UIFont(name: "SUITE-Regular", size: 11) ?? .systemFont(ofSize: 11)
            timeLabel.text = "🕒 GPS 업데이트: \(formatGpsTime(gpsTime))"
            timeLabel.textColor = .lightGray
            timeLabel.frame = CGRect(x: padding, y: yOffset, width: width - padding * 2, height: 16)
            containerView.addSubview(timeLabel)
            yOffset += 20
            
            containerView.frame = CGRect(x: 0, y: 0, width: width, height: yOffset + padding)
            return containerView
        }
        
        private func formatGpsTime(_ timeStr: String) -> String {
            // "2024-12-30 13:45:00" -> "13:45"
            if timeStr.count >= 16 {
                let start = timeStr.index(timeStr.startIndex, offsetBy: 11)
                let end = timeStr.index(timeStr.startIndex, offsetBy: 16)
                return String(timeStr[start..<end])
            }
            return timeStr
        }
        
        func updateMarkers(mapView: NMFMapView, members: [SmapGroupMember], schedules: [SmapSchedule]) {
            print("📍 [NaverMapView] Markers update requested. Members: \(members.count), Schedules: \(schedules.count)")
            
            currentMapView = mapView
            
            // 기존 마커 제거
            for marker in markers {
                marker.mapView = nil
            }
            markers.removeAll()
            
            // 선택된 멤버 추적
            var selectedMember: SmapGroupMember? = nil
            var selectedMarker: NMFMarker? = nil
            
            for member in members {
                if let lat = member.mlt_lat, let lon = member.mlt_long {
                    print("📍 [NaverMapView] Creating marker for \(member.displayName): (\(lat), \(lon))")
                    let marker = NMFMarker()
                    marker.position = NMGLatLng(lat: lat, lng: lon)
                    
                    // 커스텀 마커 이미지 생성
                    let markerImage = MarkerFactory.createMarkerImage(for: member, image: nil)
                    marker.iconImage = NMFOverlayImage(image: markerImage)
                    
                    // 앵커 조정 (아이콘의 중심 하단이 지도 좌표에 오도록)
                    // 이미지 크기가 (50, 70) 정도이므로 대략 (0.5, 0.5)가 아니라 중심을 맞춰야 함
                    // 아바타 중심을 좌표에 맞추려면 anchor를 조정해야 함.
                    // 디자인상 아바타(32px)가 메인이고 아래 이름표는 부가적.
                    // 아바타 중심이 좌표에 오게 하려면: 전체 높이 중 아바타 중심점 비율 계산
                    marker.anchor = CGPoint(x: 0.5, y: 0.5) 
                    
                    // 마커에 멤버 데이터 저장
                    marker.userInfo = ["member": member]
                    
                    // 마커 터치 핸들러
                    marker.touchHandler = { [weak self] overlay -> Bool in
                        if let marker = overlay as? NMFMarker,
                           let memberData = marker.userInfo["member"] as? SmapGroupMember {
                            self?.showInfoWindow(for: memberData, at: marker)
                        }
                        return true
                    }
                    
                    marker.mapView = mapView
                    markers.append(marker)
                    
                    // 선택된 멤버 추적
                    if member.isSelected {
                        selectedMember = member
                        selectedMarker = marker
                        // Z-order: 선택된 멤버는 더 위에 표시
                        marker.zIndex = 2000
                    } else {
                        marker.zIndex = 100
                    }
                    
                    // 비동기 이미지 로드 및 업데이트
                    if let url = Coordinator.getSafeImageUrl(member.mt_file1) {
                         URLSession.shared.dataTask(with: url) { data, _, _ in
                             if let data = data, let image = UIImage(data: data) {
                                 DispatchQueue.main.async {
                                     // 이미지가 로드되면 마커 아이콘 업데이트
                                     let newIcon = MarkerFactory.createMarkerImage(for: member, image: image)
                                     marker.iconImage = NMFOverlayImage(image: newIcon)
                                 }
                             }
                         }.resume()
                    }
                }
            }
            
            // 선택된 멤버의 InfoWindow 자동 표시
            if let member = selectedMember, let marker = selectedMarker {
                showInfoWindow(for: member, at: marker)
            }
            
            for (index, schedule) in schedules.enumerated() {
                if let lat = schedule.sst_location_lat, let lon = schedule.sst_location_long {
                    let marker = NMFMarker()
                    marker.position = NMGLatLng(lat: lat, lng: lon)
                    
                    // 스케줄 마커 커스텀 이미지 생성
                    let markerImage = createScheduleMarkerImage(
                        order: index + 1,
                        title: schedule.title ?? "일정",
                        startTime: schedule.date,
                        endTime: schedule.sst_edate,
                        status: schedule.status
                    )
                    marker.iconImage = NMFOverlayImage(image: markerImage)
                    marker.anchor = CGPoint(x: 0.5, y: 1.0) // 하단 중앙이 좌표
                    
                    // 마커에 스케줄 데이터 저장
                    marker.userInfo = ["schedule": schedule]
                    
                    // Z-order: 일정 마커는 일반 멤버보다는 위, 선택된 멤버보다는 아래
                    marker.zIndex = 1000
                    
                    marker.mapView = mapView
                    markers.append(marker)
                }
            }
        }
        
        // MARK: - Schedule Marker Factory
        
        private func createScheduleMarkerImage(order: Int, title: String, startTime: String?, endTime: String?, status: ScheduleStatus) -> UIImage {
            let width: CGFloat = 100
            let height: CGFloat = 75  // 65 -> 75 (상태 원이 잘리지 않도록)
            
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
            return renderer.image { context in
                let ctx = context.cgContext
                
                // Colors matching Next.js
                let orderCircleBg = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1) // 초록
                let titleBg = UIColor(red: 79/255, green: 70/255, blue: 229/255, alpha: 1) // 인디고
                let timeBg = UIColor(red: 236/255, green: 72/255, blue: 153/255, alpha: 1) // 핑크
                
                let statusColor: UIColor
                switch status {
                case .completed: statusColor = .systemGreen
                case .ongoing: statusColor = .systemOrange
                case .upcoming: statusColor = .systemBlue
                case .defaultStatus: statusColor = .systemGray
                }
                
                // 1. 순서 원 (상단 중앙)
                let orderSize: CGFloat = 16
                let orderX = (width - orderSize) / 2
                let orderY: CGFloat = 0
                ctx.setFillColor(orderCircleBg.cgColor)
                ctx.fillEllipse(in: CGRect(x: orderX, y: orderY, width: orderSize, height: orderSize))
                
                let orderText = "\(order)"
                let orderAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont(name: "SUITE-Bold", size: 11) ?? UIFont.boldSystemFont(ofSize: 11),
                    .foregroundColor: UIColor.white
                ]
                let orderTextSize = orderText.size(withAttributes: orderAttr)
                let orderTextRect = CGRect(
                    x: orderX + (orderSize - orderTextSize.width) / 2,
                    y: orderY + (orderSize - orderTextSize.height) / 2,
                    width: orderTextSize.width,
                    height: orderTextSize.height
                )
                orderText.draw(in: orderTextRect, withAttributes: orderAttr)
                
                // 2. 제목 박스
                let titleHeight: CGFloat = 20
                let titleY = orderY + orderSize + 2
                let titleRect = CGRect(x: 4, y: titleY, width: width - 8, height: titleHeight)
                
                let titlePath = UIBezierPath(roundedRect: titleRect, cornerRadius: 6)
                ctx.setFillColor(titleBg.cgColor)
                ctx.addPath(titlePath.cgPath)
                ctx.fillPath()
                
                let displayTitle = title.count > 10 ? String(title.prefix(10)) + "..." : title
                let titleAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont(name: "SUITE-SemiBold", size: 12) ?? UIFont.systemFont(ofSize: 12, weight: .semibold),
                    .foregroundColor: UIColor.white
                ]
                let titleTextSize = displayTitle.size(withAttributes: titleAttr)
                let titleTextRect = CGRect(
                    x: (width - titleTextSize.width) / 2,
                    y: titleY + (titleHeight - titleTextSize.height) / 2,
                    width: titleTextSize.width,
                    height: titleTextSize.height
                )
                displayTitle.draw(in: titleTextRect, withAttributes: titleAttr)
                
                // 3. 시간 박스
                let timeHeight: CGFloat = 16
                let timeY = titleY + titleHeight + 2
                
                let timeText = formatTimeRange(start: startTime, end: endTime)
                let timeWidth = max(width - 16, 60)
                let timeRect = CGRect(x: (width - timeWidth) / 2, y: timeY, width: timeWidth, height: timeHeight)
                
                let timePath = UIBezierPath(roundedRect: timeRect, cornerRadius: 4)
                ctx.setFillColor(timeBg.cgColor)
                ctx.addPath(timePath.cgPath)
                ctx.fillPath()
                
                let timeAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont(name: "SUITE-Regular", size: 10) ?? UIFont.systemFont(ofSize: 10),
                    .foregroundColor: UIColor.white
                ]
                let timeTextSize = timeText.size(withAttributes: timeAttr)
                let timeTextRect = CGRect(
                    x: (width - timeTextSize.width) / 2,
                    y: timeY + (timeHeight - timeTextSize.height) / 2,
                    width: timeTextSize.width,
                    height: timeTextSize.height
                )
                timeText.draw(in: timeTextRect, withAttributes: timeAttr)
                
                // 4. 상태 원 (하단 중앙)
                let statusSize: CGFloat = 10
                let statusX = (width - statusSize) / 2
                let statusY = timeY + timeHeight + 2
                
                ctx.setFillColor(statusColor.cgColor)
                ctx.fillEllipse(in: CGRect(x: statusX, y: statusY, width: statusSize, height: statusSize))
                
                // 흰색 테두리
                ctx.setStrokeColor(UIColor.white.cgColor)
                ctx.setLineWidth(1.5)
                ctx.strokeEllipse(in: CGRect(x: statusX, y: statusY, width: statusSize, height: statusSize))
            }
        }
        
        private func formatTimeRange(start: String?, end: String?) -> String {
            guard let start = start else { return "시간 없음" }
            
            let startTime = extractTime(from: start)
            if let end = end {
                let endTime = extractTime(from: end)
                return "\(startTime) ~ \(endTime)"
            }
            return startTime
        }
        
        private func extractTime(from dateStr: String) -> String {
            // "2025-12-30T10:00:00" -> "10:00"
            if dateStr.contains("T") {
                let components = dateStr.components(separatedBy: "T")
                if components.count > 1 {
                    let timePart = components[1]
                    let timeComponents = timePart.components(separatedBy: ":")
                    if timeComponents.count >= 2 {
                        return "\(timeComponents[0]):\(timeComponents[1])"
                    }
                }
            }
            return dateStr
        }
        
        // MARK: - InfoWindow Display
        
        func showInfoWindow(for member: SmapGroupMember, at marker: NMFMarker) {
            // 현재 열린 InfoWindow 닫기
            infoWindow?.close()
            
            // InfoWindow 데이터 업데이트
            currentMember = member
            
            // InfoWindow 열기
            infoWindow?.open(with: marker)
            
            print("ℹ️ [NaverMapView] InfoWindow opened for: \(member.displayName)")
        }
        
        // 이미지 URL 처리 헬퍼 (Frontend imageUtils.ts 로직 반영)
        static func getSafeImageUrl(_ mtFile1: String?) -> URL? {
            return AuthService.getProfileImageURL(mtFile1)
        }
    }
}

// MARK: - Marker Factory (Custom Image Generation)

struct MarkerFactory {
    static func createMarkerImage(for member: SmapGroupMember, image: UIImage?) -> UIImage {
        // Layout Constants (reduced by 30%)
        let avatarSize: CGFloat = 28 // was 40
        let borderWidth: CGFloat = 1.5 // was 2
        let topPadding: CGFloat = 3 // was 4
        let labelHeight: CGFloat = 14 // was 16
        let labelPadding: CGFloat = 3 // was 4
        let totalWidth: CGFloat = max(avatarSize, 60) // was 80
        let totalHeight: CGFloat = topPadding + avatarSize + 5 + labelHeight // 여백 + 아바타 + 간격 + 라벨
        
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: totalWidth, height: totalHeight))
        
        return renderer.image { context in
            let ctx = context.cgContext
            
            // 1. Avatar Circle (위쪽 여백 추가)
            let avatarRect = CGRect(x: (totalWidth - avatarSize) / 2, y: topPadding, width: avatarSize, height: avatarSize)
            let path = UIBezierPath(ovalIn: avatarRect)
            
            // Border Color (Selected vs Normal)
            let borderColor: UIColor = member.isSelected ?
                UIColor(red: 236/255, green: 72/255, blue: 153/255, alpha: 1.0) : // Pink
                UIColor(red: 79/255, green: 70/255, blue: 229/255, alpha: 1.0)  // Indigo
            
            // Fill Background (White)
            UIColor.white.setFill()
            path.fill()
            
            // Draw Image (Clipped)
            path.addClip()
            if let img = image {
                img.draw(in: avatarRect)
            } else {
                // Placeholder (Gray)
                UIColor.systemGray5.setFill()
                path.fill()
            }
            
            // Reset Clip to draw border
            ctx.resetClip()
            
            // Draw Border
            borderColor.setStroke()
            path.lineWidth = borderWidth
            path.stroke()
            
            // 2. Name Label
            let name = member.displayName
            if !name.isEmpty {
                let paragraphStyle = NSMutableParagraphStyle()
                paragraphStyle.alignment = .center
                
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 10, weight: .medium),
                    .foregroundColor: UIColor.white,
                    .paragraphStyle: paragraphStyle
                ]
                
                let textSize = (name as NSString).size(withAttributes: attrs)
                let labelWidth = textSize.width + (labelPadding * 2)
                let labelRect = CGRect(
                    x: (totalWidth - labelWidth) / 2,
                    y: topPadding + avatarSize + 2, // 여백 + 아바타 바로 아래
                    width: labelWidth,
                    height: labelHeight
                )
                
                // Label Background (Semi-transparent Black)
                let labelPath = UIBezierPath(roundedRect: labelRect, cornerRadius: 4)
                UIColor.black.withAlphaComponent(0.7).setFill()
                labelPath.fill()
                
                // Draw Text
                (name as NSString).draw(in: CGRect(x: labelRect.origin.x, y: labelRect.origin.y + (labelHeight - textSize.height)/2, width: labelRect.width, height: textSize.height), withAttributes: attrs)
            }
        }
    }
    
    static func createPlaceMarkerImage(title: String, isSelected: Bool) -> UIImage {
        let size: CGFloat = 28
        let borderWidth: CGFloat = 2.0
        let labelHeight: CGFloat = 14
        let labelPadding: CGFloat = 3
        let topPadding: CGFloat = 2
        
        // Marker size is 80x(topPadding + size + 5 + labelHeight)
        let totalWidth: CGFloat = 80
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: totalWidth, height: topPadding + size + 5 + labelHeight))
        
        return renderer.image { context in
            _ = context.cgContext
            
            // 1. Circle & Pin
            let rect = CGRect(x: (totalWidth - size) / 2, y: topPadding, width: size, height: size)
            let path = UIBezierPath(ovalIn: rect)
            
            // Background (White)
            UIColor.white.setFill()
            path.fill()
            
            // Border Color (Selected: Red, Normal: Indigo/Blue)
            let color = isSelected ? 
                UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1.0) : // ef4444 (Red)
                UIColor(red: 99/255, green: 102/255, blue: 241/255, alpha: 1.0)  // 6366f1 (Indigo/Blue)
            
            color.setStroke()
            path.lineWidth = borderWidth
            path.stroke()
            
            // Enlarged & Centered Pin Icon
            let x = rect.midX
            let y = rect.midY // Center of the circle
            
            let pinPath = UIBezierPath()
            // Top circle parts (larger radius 6 vs 4)
            pinPath.addArc(withCenter: CGPoint(x: x, y: y - 2), radius: 6, startAngle: 0, endAngle: .pi, clockwise: false)
            // Tip (longer tip)
            pinPath.addLine(to: CGPoint(x: x, y: y + 9))
            pinPath.close()
            
            color.setFill()
            pinPath.fill()
            
            // Center hole (larger hole for larger pin)
            let holePath = UIBezierPath(ovalIn: CGRect(x: x - 2, y: y - 4, width: 4, height: 4))
            UIColor.white.setFill()
            holePath.fill()
            
            // 2. Name Label
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center
            
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10, weight: .medium),
                .foregroundColor: UIColor.white,
                .paragraphStyle: paragraphStyle
            ]
            
            let name = title as NSString
            let textSize = name.size(withAttributes: attrs)
            let labelWidth = min(76, textSize.width + (labelPadding * 2))
            let labelRect = CGRect(
                x: (totalWidth - labelWidth) / 2,
                y: topPadding + size + 3,
                width: labelWidth,
                height: labelHeight
            )
            
            // Label Background (Solid Black)
            let labelPath = UIBezierPath(roundedRect: labelRect, cornerRadius: 4)
            UIColor.black.withAlphaComponent(0.8).setFill()
            labelPath.fill()
            
            // Draw Text
            name.draw(in: CGRect(x: labelRect.origin.x, y: labelRect.origin.y + (labelHeight - textSize.height)/2, width: labelRect.width, height: textSize.height), withAttributes: attrs)
        }
    }
}



// MARK: - Notification Components


@MainActor
class NotificationViewModel: ObservableObject {
    @Published var notifications: [PushLog] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    private let notificationService = NotificationService.shared
    private let authService = AuthService.shared
    
    /// 알림 목록 가져오기
    func fetchNotifications() {
        guard let user = getLoggedInUser() else {
            self.errorMessage = "사용자 정보를 찾을 수 없습니다."
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let logs = try await notificationService.getMemberPushLogs(memberId: user.mt_idx ?? 0)
                DispatchQueue.main.async {
                    self.notifications = logs
                    self.isLoading = false
                    print("📝 [NotificationViewModel] \(logs.count)개의 알림을 가져왔습니다.")
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    print("❌ [NotificationViewModel] 알림 조회 실패: \(error)")
                }
            }
        }
    }
    
    /// 특정 알림 읽음 처리
    func markAsRead(_ notification: PushLog) {
        guard notification.plt_read_chk == .N else { return }
        
        Task {
            do {
                let success = try await notificationService.markAsRead(notificationId: notification.plt_idx)
                if success {
                    print("✅ [NotificationViewModel] 읽음 처리 성공: \(notification.plt_idx)")
                    DispatchQueue.main.async {
                        if let index = self.notifications.firstIndex(where: { $0.plt_idx == notification.plt_idx }) {
                            // 로컬 상태 업데이트
                            let log = self.notifications[index]
                            let updated = PushLog(
                                plt_idx: log.plt_idx,
                                plt_type: log.plt_type,
                                mt_idx: log.mt_idx,
                                sst_idx: log.sst_idx,
                                plt_condition: log.plt_condition,
                                plt_memo: log.plt_memo,
                                plt_title: log.plt_title,
                                plt_content: log.plt_content,
                                plt_sdate: log.plt_sdate,
                                plt_status: log.plt_status,
                                plt_read_chk: .Y,
                                plt_show: log.plt_show,
                                push_json: log.push_json,
                                plt_wdate: log.plt_wdate,
                                plt_rdate: ISO8601DateFormatter().string(from: Date())
                            )
                            self.notifications[index] = updated
                            print("📝 [NotificationViewModel] 로컬 상태 업데이트 완료 (Index: \(index))")
                            // 홈 화면 배지 동기화를 위해 알림 발송
                            NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                        }
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 읽음 처리 실패: \(error)")
            }
        }
    }
    
    /// 모든 알림 읽음 처리
    func markAllAsRead() {
        guard let user = getLoggedInUser() else { return }
        
        Task {
            do {
                let response = try await notificationService.markAllAsRead(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    DispatchQueue.main.async {
                        self.notifications = self.notifications.map { log in
                            return PushLog(
                                plt_idx: log.plt_idx,
                                plt_type: log.plt_type,
                                mt_idx: log.mt_idx,
                                sst_idx: log.sst_idx,
                                plt_condition: log.plt_condition,
                                plt_memo: log.plt_memo,
                                plt_title: log.plt_title,
                                plt_content: log.plt_content,
                                plt_sdate: log.plt_sdate,
                                plt_status: log.plt_status,
                                plt_read_chk: .Y,
                                plt_show: log.plt_show,
                                push_json: log.push_json,
                                plt_wdate: log.plt_wdate,
                                plt_rdate: ISO8601DateFormatter().string(from: Date())
                            )
                        }
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 전체 읽음 처리 실패: \(error)")
            }
        }
    }
    
    /// 특정 알림 삭제
    func deleteNotification(_ notification: PushLog) {
        Task {
            do {
                let success = try await notificationService.deleteNotification(notificationId: notification.plt_idx)
                if success {
                    DispatchQueue.main.async {
                        self.notifications.removeAll(where: { $0.id == notification.id })
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 알림 삭제 실패: \(error)")
            }
        }
    }
    
    /// 모든 알림 삭제
    func deleteAllNotifications() {
        guard let user = getLoggedInUser() else { return }
        
        Task {
            do {
                let response = try await notificationService.deleteAllNotifications(memberId: user.mt_idx ?? 0)
                if response.success == true {
                    DispatchQueue.main.async {
                        self.notifications.removeAll()
                        // 홈 화면 배지 동기화를 위해 알림 발송
                        NotificationCenter.default.post(name: NSNotification.Name("notificationSyncNeeded"), object: nil)
                    }
                }
            } catch {
                print("❌ [NotificationViewModel] 전체 삭제 실패: \(error)")
            }
        }
    }
    
    /// 로그인된 사용자 정보 가져오기
    private func getLoggedInUser() -> SMAPUser? {
        if let data = UserDefaults.standard.data(forKey: "smap_user_data"),
           let user = try? JSONDecoder().decode(SMAPUser.self, from: data) {
            return user
        }
        return nil
    }
}


struct NotificationListView: View {
    @StateObject var viewModel = NotificationViewModel()
    @Environment(\.dismiss) var dismiss
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background Gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 248/255, green: 250/255, blue: 255/255),
                        Color.white
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Header
                    notificationHeader
                    
                    // Stats Card
                    if !viewModel.notifications.isEmpty {
                        statsCard
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                            .padding(.bottom, 8)
                    }
                    
                    // Content
                    if viewModel.isLoading && viewModel.notifications.isEmpty {
                        Spacer()
                        loadingView
                        Spacer()
                    } else if viewModel.notifications.isEmpty {
                        Spacer()
                        emptyStateView
                        Spacer()
                    } else {
                        notificationList
                    }
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                viewModel.fetchNotifications()
            }
            .alert("오류", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }
    
    // MARK: - Header
    private var notificationHeader: some View {
        HStack(spacing: 16) {
            // Close Button
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 36, height: 36)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(Circle())
            }
            
            // Title
            VStack(alignment: .leading, spacing: 2) {
                Text("알림")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("최근 7일간의 알림을 확인하세요")
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            // Menu
            Menu {
                Button(role: .destructive, action: { viewModel.deleteAllNotifications() }) {
                    Label("전체 삭제", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 36, height: 36)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color.white.shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2))
    }
    
    // MARK: - Stats Card
    private var statsCard: some View {
        HStack(spacing: 16) {
            // Total count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(brandColor)
                Text("전체")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(brandColor.opacity(0.08))
            .cornerRadius(12)
            
            // Unread count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.filter { $0.plt_read_chk == .N }.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(pinkColor)
                Text("읽지 않음")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(pinkColor.opacity(0.08))
            .cornerRadius(12)
            
            // Read count
            VStack(spacing: 4) {
                Text("\(viewModel.notifications.filter { $0.plt_read_chk == .Y }.count)")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(.green)
                Text("읽음")
                    .font(.suite(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.green.opacity(0.08))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Loading
    private var loadingView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(brandColor.opacity(0.1))
                    .frame(width: 80, height: 80)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: brandColor))
                    .scaleEffect(1.5)
            }
            
            Text("알림을 불러오는 중...")
                .font(.suite(size: 14))
                .foregroundColor(.gray)
        }
    }
    
    // MARK: - Empty State
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [brandColor.opacity(0.1), pinkColor.opacity(0.1)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)
                
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [brandColor, pinkColor]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)
                    .shadow(color: brandColor.opacity(0.3), radius: 15, x: 0, y: 8)
                
                Image(systemName: "bell.slash.fill")
                    .font(.suite(size: 32))
                    .foregroundColor(.white)
            }
            
            VStack(spacing: 8) {
                Text("새로운 알림이 없습니다")
                    .font(.suite(size: 18, weight: .bold))
                    .foregroundColor(.black)
                
                Text("위치 공유 및 그룹 활동 알림이\n여기에 표시됩니다")
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }
            
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.suite(size: 14))
                    .foregroundColor(.blue.opacity(0.7))
                
                Text("최근 7일간의 알림만 표시됩니다")
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.blue.opacity(0.08))
            .cornerRadius(20)
        }
        .padding(.horizontal, 40)
    }
    
    // MARK: - Notification List
    private var notificationList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.notifications) { notification in
                    NotificationRow(notification: notification, brandColor: brandColor, pinkColor: pinkColor)
                        .onAppear {
                            if notification.plt_read_chk == .N {
                                viewModel.markAsRead(notification)
                            }
                        }
                        .onTapGesture {
                            viewModel.markAsRead(notification)
                        }
                        .contextMenu {
                            Button(role: .destructive) {
                                viewModel.deleteNotification(notification)
                            } label: {
                                Label("삭제", systemImage: "trash")
                            }
                        }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 20)
        }
        .refreshable {
            viewModel.fetchNotifications()
        }
    }
}

struct NotificationRow: View {
    let notification: PushLog
    let brandColor: Color
    let pinkColor: Color
    
    private var iconName: String {
        if let title = notification.plt_title?.lowercased() {
            if title.contains("위치") || title.contains("location") {
                return "location.fill"
            } else if title.contains("그룹") || title.contains("group") {
                return "person.3.fill"
            } else if title.contains("일정") || title.contains("schedule") {
                return "calendar"
            } else if title.contains("초대") || title.contains("invite") {
                return "envelope.fill"
            }
        }
        return "bell.fill"
    }
    
    private var iconColor: Color {
        switch iconName {
        case "location.fill": return .red
        case "person.3.fill": return brandColor
        case "calendar": return .orange
        case "envelope.fill": return .green
        default: return pinkColor
        }
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Content
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(notification.plt_title ?? "알림")
                        .font(.suite(size: 15, weight: notification.plt_read_chk == .N ? .bold : .medium))
                        .foregroundColor(.black)
                    
                    Spacer()
                    
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(notification.relativeTime)
                            .font(.suite(size: 11))
                            .foregroundColor(.gray)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(10)
                        
                        // NEW Badge (Repositioned)
                        if notification.plt_read_chk == .N {
                            Text("NEW")
                                .font(.suite(size: 9, weight: .bold))
                                .foregroundColor(pinkColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(pinkColor.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }
                
                Text(notification.plt_content ?? "")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.06), radius: 10, x: 0, y: 4)
        )
        .overlay(
            // Unread indicator (Border only)
            Group {
                if notification.plt_read_chk == .N {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(pinkColor.opacity(0.3), lineWidth: 2)
                }
            },
            alignment: .center // Ensure it covers the whole card
        )
    }
}

struct NotificationListView_Previews: PreviewProvider {
    static var previews: some View {
        NotificationListView()
    }
}



// MARK: - Notification Models


/// 푸시 알림 읽음 상태
enum ReadCheck: String, Codable, Equatable {
    case Y = "Y"
    case N = "N"
}

/// 푸시 알림 표시 여부
enum ShowStatus: String, Codable, Equatable {
    case Y = "Y"
    case N = "N"
}

/// 푸시 알림 타입 (plt_type 기반)
enum PushNotificationType: Int, Codable, Equatable {
    case general = 1      // 일반
    case visit = 2        // 방문 (지오펜스 인/아웃)
    case schedule = 3     // 일정 알림
    case system = 4       // 시스템 알림
    case visitRequest = 5 // 방문 요청
    case visitAccepted = 6// 방문 수락
    
    var iconName: String {
        switch self {
        case .general: return "bell.fill"
        case .visit: return "mappin.and.ellipse"
        case .schedule: return "calendar"
        case .system: return "exclamationmark.triangle.fill"
        case .visitRequest: return "person.badge.plus"
        case .visitAccepted: return "checkmark.circle.fill"
        }
    }
}

/// 푸시 로그 데이터 모델
struct PushLog: Codable, Identifiable, Equatable {
    var id: Int { plt_idx }
    
    let plt_idx: Int
    let plt_type: Int?
    let mt_idx: Int?
    let sst_idx: Int?
    let plt_condition: String?
    let plt_memo: String?
    let plt_title: String?
    let plt_content: String?
    let plt_sdate: String?   // 발송일시
    let plt_status: Int?     // 2: 전송완료
    let plt_read_chk: ReadCheck?
    let plt_show: ShowStatus?
    let push_json: String?
    let plt_wdate: String?   // 생성일시
    let plt_rdate: String?   // 읽은일시
    
    /// 알림 타입 열거형 반환
    var type: PushNotificationType {
        PushNotificationType(rawValue: plt_type ?? 1) ?? .general
    }
    
    /// iOS 알림센터 스타일 시간 문자열 (예: 오전 04:05, 어제 13:11, (일) 오전 11:10)
    var relativeTime: String {
        guard let sDateStr = plt_sdate else { return "" }
        
        let dateFormats = [
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX"
        ]
        
        var date: Date? = nil
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        
        for format in dateFormats {
            f.dateFormat = format
            if let d = f.date(from: sDateStr) {
                date = d
                break
            }
        }
        
        guard let targetDate = date else { return sDateStr }
        
        let calendar = Calendar.current
        _ = Date()
        
        // 시간 포맷 (오전/오후 HH:mm)
        let timeFormatter = DateFormatter()
        timeFormatter.locale = Locale(identifier: "ko_KR")
        timeFormatter.dateFormat = "a hh:mm"
        let timeString = timeFormatter.string(from: targetDate)
        
        // 오늘인지 확인
        if calendar.isDateInToday(targetDate) {
            return timeString
        }
        
        // 어제인지 확인
        if calendar.isDateInYesterday(targetDate) {
            return "어제 " + timeString
        }
        
        // 그 외: 요일 + 시간
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale(identifier: "ko_KR")
        weekdayFormatter.dateFormat = "(E)"
        let weekday = weekdayFormatter.string(from: targetDate)
        
        return weekday + " " + timeString
    }
}

/// 알림 전체 삭제/읽음 처리 응답
struct NotificationActionResponse: Codable, Equatable {
    let success: Bool?
    let message: String?
}

// MARK: - Notification Service


class NotificationService {
    static let shared = NotificationService()
    private let authService = AuthService.shared
    private let baseURL = "https://api3.smap.site/api/v1"
    
    private init() {}
    
    /// 회원의 푸시 알림 내역 조회 (최근 7일)
    func getMemberPushLogs(memberId: Int) async throws -> [PushLog] {
        let url = URL(string: "\(baseURL)/push-logs/member/\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [NotificationService] getMemberPushLogs request: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "알림 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([PushLog].self, from: data)
    }
    
    /// 특정 알림 읽음 처리
    func markAsRead(notificationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/push-logs/\(notificationId)/read")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    
    /// 모든 알림 읽음 처리
    func markAllAsRead(memberId: Int) async throws -> NotificationActionResponse {
        let url = URL(string: "\(baseURL)/push-logs/read-all?mt_idx=\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "알림 읽음 처리에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(NotificationActionResponse.self, from: data)
    }
    
    /// 특정 알림 삭제 (plt_show를 'N'으로 변경)
    func deleteNotification(notificationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/push-logs/\(notificationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    
    /// 모든 알림 삭제
    func deleteAllNotifications(memberId: Int) async throws -> NotificationActionResponse {
        let url = URL(string: "\(baseURL)/push-logs/delete-all?mt_idx=\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError(detail: nil, message: "알림 삭제에 실패했습니다.")
        }
        
        return try JSONDecoder().decode(NotificationActionResponse.self, from: data)
    }
}

// MARK: - Group Components

// MARK: - Group Statistics Models

struct GroupStats: Codable {
    let group_id: Int
    let group_title: String
    let member_count: Int
    let weekly_schedules: Int
    let total_locations: Int
    let stats_period: StatsPeriod
    let member_stats: [GroupMemberStats]
}

struct StatsPeriod: Codable {
    let start_date: String
    let end_date: String
    let days: Int
}

struct GroupMemberStats: Codable {
    let mt_idx: Int
    let mt_name: String
    let mt_nickname: String
    let weekly_schedules: Int
    let total_locations: Int
    let weekly_locations: Int
    let is_owner: Bool
    let is_leader: Bool
}

struct GroupSummary: Codable {
    let group_count: Int
    let total_members: Int
}

// MARK: - GroupService

class GroupService {
    static let shared = GroupService()
    private let authService = AuthService.shared
    
    private init() {}
    
    private var baseURL: String {
        return authService.baseURL
    }
    
    /// 현재 사용자의 그룹 목록 가져오기
    func getCurrentUserGroups() async throws -> [SmapGroup] {
        let url = URL(string: "\(baseURL)/groups/current-user")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 목록을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroup].self, from: data)
    }
    
    /// 그룹 요약 정보 가져오기 (총 그룹 수, 총 멤버 수)
    func getGroupSummary() async throws -> GroupSummary {
        let url = URL(string: "\(baseURL)/groups/current-user/summary")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 요약 정보를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode(GroupSummary.self, from: data)
    }
    
    /// 그룹 멤버 목록 가져오기
    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        let url = URL(string: "\(baseURL)/group-members/member/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "멤버 정보를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode([SmapGroupMember].self, from: data)
    }
    
    /// 그룹 통계 가져오기
    func getGroupStats(sgtIdx: Int) async throws -> GroupStats {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)/stats")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 통계를 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(GroupStats.self, from: data)
        return result
    }
    
    /// 그룹 생성
    func createGroup(title: String, memo: String) async throws -> SmapGroup {
        let url = URL(string: "\(baseURL)/groups/")!  // 꼭 trailing slash 필요!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 토큰 디버깅
        let token = authService.getToken()
        print("🔑 [HomeService.createGroup] Token retrieved: \(token != nil ? "YES (\(token!.prefix(20))...)" : "NO (nil)")")
        
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("🔑 [HomeService.createGroup] Authorization header set")
        } else {
            print("⚠️ [HomeService.createGroup] No token available - request will fail!")
        }
        
        // Get user ID from UserDefaults
        let userId = UserDefaults.standard.integer(forKey: "mt_idx")
        
        var body: [String: Any] = [
            "sgt_title": title,
            "sgt_memo": memo,
            "sgt_show": "Y"
        ]
        
        // Add user ID if available
        if userId > 0 {
            body["mt_idx"] = userId
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 생성에 실패했습니다. (Error: \(statusCode))")
        }
        
        // Backend returns GroupResponse directly, try decoding SmapGroup first
        do {
            let group = try JSONDecoder().decode(SmapGroup.self, from: data)
            return group
        } catch {
            // Fallback: try wrapped response format
            if let result = try? JSONDecoder().decode(GroupCreateResponse.self, from: data),
               result.success, let group = result.data {
                return group
            }
            throw APIError(detail: nil, message: "그룹 생성 응답 파싱 실패")
        }
    }
    
    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) async throws -> SmapGroup {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "sgt_title": title,
            "sgt_memo": memo
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 수정에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(GroupCreateResponse.self, from: data)
        if result.success, let group = result.data {
            return group
        } else {
            throw APIError(detail: nil, message: result.message ?? "그룹 수정 실패")
        }
    }
    
    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) async throws -> Bool {
        print("🚀 [HomeService.joinGroup] 초대코드로 그룹 가입 시작: \(inviteCode)")
        
        // 1. 코드로 그룹 정보 조회
        let codeUrl = URL(string: "\(baseURL)/groups/code/\(inviteCode)")!
        var codeRequest = URLRequest(url: codeUrl)
        codeRequest.httpMethod = "GET"
        codeRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            codeRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (codeData, codeResponse) = try await URLSession.shared.data(for: codeRequest)
        
        guard let httpCodeResponse = codeResponse as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [HomeService.joinGroup] 그룹 조회 응답: \(httpCodeResponse.statusCode)")
        
        if httpCodeResponse.statusCode != 200 {
            throw APIError(detail: nil, message: "유효하지 않은 초대 코드입니다.")
        }
        
        let group = try JSONDecoder().decode(SmapGroup.self, from: codeData)
        print("✅ [HomeService.joinGroup] 그룹 정보 조회 성공: \(group.sgt_title ?? "") (ID: \(group.sgt_idx))")
        
        // 2. 가입 실행 - mt_idx와 sgt_idx를 body에 포함
        guard let currentUser = authService.currentUser else {
            print("❌ [HomeService.joinGroup] 현재 사용자 정보가 없습니다.")
            throw APIError(detail: nil, message: "로그인이 필요합니다.")
        }
        
        guard let mtIdx = currentUser.mt_idx else {
            print("❌ [HomeService.joinGroup] 사용자 ID(mt_idx)가 없습니다.")
            throw APIError(detail: nil, message: "사용자 정보가 올바르지 않습니다. 다시 로그인해주세요.")
        }
        
        let joinUrl = URL(string: "\(baseURL)/groups/\(group.sgt_idx)/join")!
        var joinRequest = URLRequest(url: joinUrl)
        joinRequest.httpMethod = "POST"
        joinRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            joinRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // 백엔드 GroupJoinRequest 스키마에 맞게 body 구성
        let body: [String: Any] = [
            "mt_idx": mtIdx,
            "sgt_idx": group.sgt_idx
        ]
        joinRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📤 [HomeService.joinGroup] 가입 요청: mt_idx=\(mtIdx), sgt_idx=\(group.sgt_idx)")
        
        let (joinData, joinResponse) = try await URLSession.shared.data(for: joinRequest)
        
        guard let httpJoinResponse = joinResponse as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        print("📥 [HomeService.joinGroup] 가입 응답: \(httpJoinResponse.statusCode)")
        
        if httpJoinResponse.statusCode == 200 {
            print("✅ [HomeService.joinGroup] 그룹 가입 성공!")
            return true
        } else if httpJoinResponse.statusCode == 400 {
            if let json = try? JSONSerialization.jsonObject(with: joinData) as? [String: Any],
               let detail = json["detail"] as? String {
                throw APIError(detail: nil, message: detail)
            }
            throw APIError(detail: nil, message: "이미 가입된 그룹입니다.")
        } else {
            if let json = try? JSONSerialization.jsonObject(with: joinData) as? [String: Any],
               let detail = json["detail"] as? String {
                throw APIError(detail: nil, message: detail)
            }
            throw APIError(detail: nil, message: "그룹 가입에 실패했습니다. (Error: \(httpJoinResponse.statusCode))")
        }
    }
    
    /// 그룹 삭제 (소프트 삭제)
    func deleteGroup(sgtIdx: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/groups/\(sgtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // sgt_show를 N으로 변경하여 삭제 처리 (소프트 삭제)
        let body: [String: Any] = [
            "sgt_show": "N"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "그룹 삭제에 실패했습니다. (Error: \(statusCode))")
        }
        
        return true
    }
    
    /// 멤버 권한 변경
    func updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool) async throws -> Bool {
        let url = URL(string: "\(baseURL)/group-members/\(sgtIdx)/role")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "mt_idx": mtIdx,
            "is_leader": isLeader
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "권한 변경에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(SimpleResponse.self, from: data)
        return result.success
    }
    
    /// 그룹에서 멤버 내보내기/탈퇴
    func removeMember(sgtIdx: Int, mtIdx: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/group-members/\(sgtIdx)/member/\(mtIdx)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "멤버 내보내기에 실패했습니다. (Error: \(statusCode))")
        }
        
        let result = try JSONDecoder().decode(SimpleResponse.self, from: data)
        return result.success
    }
    
    /// 그룹 ID로 직접 가입 (딥링크용)
    func joinGroupById(mt_idx: Int, sgt_idx: Int) async throws -> Bool {
        print("🚀 [GroupService.joinGroupById] 그룹 ID로 가입 시작: \(sgt_idx)")
        
        let joinUrl = URL(string: "\(baseURL)/groups/\(sgt_idx)/join")!
        var joinRequest = URLRequest(url: joinUrl)
        joinRequest.httpMethod = "POST"
        joinRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            joinRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "mt_idx": mt_idx,
            "sgt_idx": sgt_idx
        ]
        joinRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (joinData, joinResponse) = try await URLSession.shared.data(for: joinRequest)
        
        guard let httpJoinResponse = joinResponse as? HTTPURLResponse else {
            throw APIError(detail: nil, message: "네트워크 오류가 발생했습니다.")
        }
        
        if httpJoinResponse.statusCode == 200 {
            print("✅ [GroupService.joinGroupById] 그룹 가입 성공!")
            return true
        } else {
            if let json = try? JSONSerialization.jsonObject(with: joinData) as? [String: Any],
               let detail = json["detail"] as? String {
                throw APIError(detail: nil, message: detail)
            }
            throw APIError(detail: nil, message: "그룹 가입에 실패했습니다. (Error: \(httpJoinResponse.statusCode))")
        }
    }
}

// MARK: - API Response Helpers for Groups

struct StatsResponse: Codable {
    let success: Bool
    let message: String?
    let data: GroupStats?
}

struct GroupCreateResponse: Codable {
    let success: Bool
    let message: String?
    let data: SmapGroup?
}

struct SimpleResponse: Codable {
    let success: Bool
    let message: String?
}

// MARK: - GroupViewModel

@MainActor
class GroupViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?

    @Published var groupMembers: [SmapGroupMember] = []
    @Published var groupStats: GroupStats?
    @Published var totalMembers: Int = 0
    
    // Loading States
    @Published var isLoading: Bool = false
    @Published var isCreating: Bool = false
    @Published var isUpdating: Bool = false
    @Published var isDeleting: Bool = false
    @Published var isJoining: Bool = false
    
    // Error States
    @Published var errorMessage: String?
    @Published var showError: Bool = false
    
    private let groupService = GroupService.shared
    
    // MARK: - Group Management
    
    /// 내 그룹 목록 조회
    func fetchGroups() {
        isLoading = true
        Task {
            do {
                let fetchedGroups = try await groupService.getCurrentUserGroups()
                DispatchQueue.main.async {
                    self.groups = fetchedGroups
                    self.isLoading = false
                    
                    // 만약 선택된 그룹이 있다면 정보 업데이트
                    if let selected = self.selectedGroup,
                       let updated = fetchedGroups.first(where: { $0.sgt_idx == selected.sgt_idx }) {
                        self.selectedGroup = updated
                    } else if self.selectedGroup == nil && !fetchedGroups.isEmpty {
                        // 선택된 그룹이 없으면 첫번째 그룹 선택 (옵션)
                        // self.selectedGroup = fetchedGroups.first
                    }
                    
                    // 요약 정보도 갱신
                    self.fetchGroupSummary()
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isLoading = false
                }
            }
        }
    }
    
    /// 그룹 생성
    func createGroup(title: String, memo: String) {
        guard !title.isEmpty else { return }
        isCreating = true
        Task {
            do {
                let newGroup = try await groupService.createGroup(title: title, memo: memo)
                DispatchQueue.main.async {
                    self.groups.append(newGroup)
                    self.selectedGroup = newGroup
                    self.isCreating = false
                    self.fetchGroups() // 목록 갱신
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isCreating = false
                }
            }
        }
    }
    
    /// 그룹 수정
    func updateGroup(sgtIdx: Int, title: String, memo: String) {
        guard !title.isEmpty else { return }
        isUpdating = true
        Task {
            do {
                // 수정된 그룹 정보 반환을 가정하거나, 다시 조회
                let updatedGroup = try await groupService.updateGroup(sgtIdx: sgtIdx, title: title, memo: memo)
                DispatchQueue.main.async {
                    if let index = self.groups.firstIndex(where: { $0.sgt_idx == sgtIdx }) {
                        self.groups[index] = updatedGroup
                    }
                    if self.selectedGroup?.sgt_idx == sgtIdx {
                        self.selectedGroup = updatedGroup
                    }
                    self.isUpdating = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isUpdating = false
                }
            }
        }
    }
    
    /// 그룹 삭제 (소프트 삭제)
    func deleteGroup(sgtIdx: Int) {
        isDeleting = true
        Task {
            do {
                let success = try await groupService.deleteGroup(sgtIdx: sgtIdx)
                if success {
                    DispatchQueue.main.async {
                        self.groups.removeAll(where: { $0.sgt_idx == sgtIdx })
                        if self.selectedGroup?.sgt_idx == sgtIdx {
                            self.selectedGroup = nil
                            self.groupMembers = []
                            self.groupStats = nil
                        }
                        self.isDeleting = false
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isDeleting = false
                }
            }
        }
    }
    
    /// 그룹 가입 (초대 코드)
    func joinGroup(inviteCode: String) {
        guard !inviteCode.isEmpty else { return }
        isJoining = true
        Task {
            do {
                let success = try await groupService.joinGroup(inviteCode: inviteCode)
                if success {
                    DispatchQueue.main.async {
                        self.isJoining = false
                        self.fetchGroups() // 목록 갱신 및 UI 이동
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error)
                    self.isJoining = false
                }
            }
        }
    }
    
    // MARK: - Detail Info
    
    /// 그룹 멤버 조회
    func fetchGroupMembers(sgtIdx: Int) {
        // 이미 로딩 중이면 스킵하거나, 개별 로딩 상태 관리
        Task {
            do {
                let members = try await groupService.getGroupMembers(sgtIdx: sgtIdx)
                DispatchQueue.main.async {
                    self.groupMembers = members
                    // Debug: Log member avatar URLs
                    print("✅ [GroupViewModel] Loaded \(members.count) members")
                    for (index, member) in members.enumerated() {
                        print("   Member \(index): \(member.displayName) - Avatar: \(member.mt_file1 ?? "nil")")
                    }
                }
            } catch {
                print("❌ [GroupViewModel] 멤버 조회 실패: \(error)")
            }
        }
    }
    
    /// 그룹 통계 조회
    func fetchGroupStats(sgtIdx: Int) {
        Task {
            do {
                let stats = try await groupService.getGroupStats(sgtIdx: sgtIdx)
                DispatchQueue.main.async {
                    self.groupStats = stats
                }
            } catch {
                print("❌ [GroupViewModel] 통계 조회 실패: \(error)")
            }
        }
    }
    
    /// 멤버 권한 변경 (리더 위임 등)
    func updateMemberRole(member: SmapGroupMember, isLeader: Bool) {
        guard let group = selectedGroup else { return }
        Task {
            do {
                let success = try await groupService.updateMemberRole(sgtIdx: group.sgt_idx, mtIdx: member.mt_idx, isLeader: isLeader)
                if success {
                    self.fetchGroupMembers(sgtIdx: group.sgt_idx) // 멤버 목록 갱신
                }
            } catch {
                DispatchQueue.main.async { self.handleError(error) }
            }
        }
    }
    
    /// 멤버 강퇴
    func removeMember(member: SmapGroupMember) {
        guard let group = selectedGroup else { return }
        Task {
            do {
                let success = try await groupService.removeMember(sgtIdx: group.sgt_idx, mtIdx: member.mt_idx)
                if success {
                    self.fetchGroupMembers(sgtIdx: group.sgt_idx) // 멤버 목록 갱신
                    self.fetchGroupStats(sgtIdx: group.sgt_idx) // 통계도 갱신
                }
            } catch {
                DispatchQueue.main.async { self.handleError(error) }
            }
        }
    }
    
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            self.errorMessage = apiError.message ?? apiError.detail ?? "오류가 발생했습니다."
        } else {
            self.errorMessage = error.localizedDescription
        }
        self.showError = true
    }
    
    /// 그룹 요약 정보 조회
    func fetchGroupSummary() {
        Task {
            do {
                let summary = try await groupService.getGroupSummary()
                DispatchQueue.main.async {
                    self.totalMembers = summary.total_members
                }
            } catch {
                print("❌ [GroupViewModel] 요약 정보 조회 실패: \(error)")
            }
        }
    }
}

// MARK: - GoogleLogoView

struct GoogleLogoView: View {
    var body: some View {
        GeometryReader { geometry in
            let w = geometry.size.width
            let h = geometry.size.height
            let s = min(w, h) / 24.0
            
            // Center alignment
            let offsetX = (w - (24 * s)) / 2
            let offsetY = (h - (24 * s)) / 2
            
            ZStack {
                // Blue
                Path { path in
                    path.move(to: CGPoint(x: 22.56 * s, y: 12.25 * s))
                    path.addCurve(to: CGPoint(x: 22.36 * s, y: 10.0 * s), control1: CGPoint(x: 22.56 * s, y: 11.47 * s), control2: CGPoint(x: 22.49 * s, y: 10.72 * s))
                    path.addLine(to: CGPoint(x: 12.0 * s, y: 10.0 * s))
                    path.addLine(to: CGPoint(x: 12.0 * s, y: 14.26 * s))
                    path.addLine(to: CGPoint(x: 17.92 * s, y: 14.26 * s))
                    path.addCurve(to: CGPoint(x: 15.71 * s, y: 17.57 * s), control1: CGPoint(x: 17.66 * s, y: 15.63 * s), control2: CGPoint(x: 16.88 * s, y: 16.79 * s))
                    path.addLine(to: CGPoint(x: 15.71 * s, y: 20.34 * s))
                    path.addLine(to: CGPoint(x: 19.28 * s, y: 20.34 * s))
                    path.addCurve(to: CGPoint(x: 22.56 * s, y: 12.25 * s), control1: CGPoint(x: 21.36 * s, y: 18.42 * s), control2: CGPoint(x: 22.56 * s, y: 15.6 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 66/255, green: 133/255, blue: 244/255))
                
                // Green
                Path { path in
                    path.move(to: CGPoint(x: 12.0 * s, y: 23.0 * s))
                    path.addCurve(to: CGPoint(x: 19.28 * s, y: 20.34 * s), control1: CGPoint(x: 14.97 * s, y: 23.0 * s), control2: CGPoint(x: 17.46 * s, y: 22.02 * s))
                    path.addLine(to: CGPoint(x: 15.71 * s, y: 17.57 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 18.63 * s), control1: CGPoint(x: 14.73 * s, y: 18.23 * s), control2: CGPoint(x: 13.48 * s, y: 18.63 * s))
                    path.addCurve(to: CGPoint(x: 5.84 * s, y: 14.10 * s), control1: CGPoint(x: 9.14 * s, y: 18.63 * s), control2: CGPoint(x: 6.71 * s, y: 16.7 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 14.10 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 16.94 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 23.0 * s), control1: CGPoint(x: 3.99 * s, y: 20.53 * s), control2: CGPoint(x: 7.7 * s, y: 23.0 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 52/255, green: 168/255, blue: 83/255))
                
                // Yellow
                Path { path in
                    path.move(to: CGPoint(x: 5.84 * s, y: 14.09 * s))
                    path.addCurve(to: CGPoint(x: 5.49 * s, y: 12.0 * s), control1: CGPoint(x: 5.62 * s, y: 13.43 * s), control2: CGPoint(x: 5.49 * s, y: 12.73 * s))
                    path.addCurve(to: CGPoint(x: 5.84 * s, y: 9.91 * s), control1: CGPoint(x: 5.49 * s, y: 12.0 * s), control2: CGPoint(x: 5.62 * s, y: 10.57 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 7.07 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 7.07 * s))
                    path.addCurve(to: CGPoint(x: 1.0 * s, y: 12.0 * s), control1: CGPoint(x: 1.43 * s, y: 8.55 * s), control2: CGPoint(x: 1.0 * s, y: 10.22 * s))
                    path.addCurve(to: CGPoint(x: 2.18 * s, y: 16.93 * s), control1: CGPoint(x: 1.0 * s, y: 12.0 * s), control2: CGPoint(x: 1.43 * s, y: 15.45 * s))
                    path.addLine(to: CGPoint(x: 5.03 * s, y: 14.71 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 14.09 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 251/255, green: 188/255, blue: 5/255))
                
                // Red
                Path { path in
                    path.move(to: CGPoint(x: 12.0 * s, y: 5.38 * s))
                    path.addCurve(to: CGPoint(x: 16.21 * s, y: 7.02 * s), control1: CGPoint(x: 13.62 * s, y: 5.38 * s), control2: CGPoint(x: 15.06 * s, y: 5.94 * s))
                    path.addLine(to: CGPoint(x: 19.36 * s, y: 3.87 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 1.0 * s), control1: CGPoint(x: 17.45 * s, y: 2.09 * s), control2: CGPoint(x: 14.97 * s, y: 1.0 * s))
                    path.addCurve(to: CGPoint(x: 2.18 * s, y: 7.07 * s), control1: CGPoint(x: 7.7 * s, y: 1.0 * s), control2: CGPoint(x: 3.99 * s, y: 3.47 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 9.91 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 5.38 * s), control1: CGPoint(x: 6.71 * s, y: 7.31 * s), control2: CGPoint(x: 9.14 * s, y: 5.38 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 234/255, green: 67/255, blue: 53/255))
            }
            .offset(x: offsetX, y: offsetY)
        }
    }
}


// MARK: - FloatingBackgroundView

struct FloatingBackgroundView: View {
    var body: some View {
        ZStack {
            // 1. Top-left big
            FloatingCircle(
                size: 96, // w-24 * 4
                opacity: 0.2,
                blur: 24, // blur-xl
                initialX: 40, initialY: 80,
                moveX: 30, moveY: -40,
                duration: 10
            )
            
            // 2. Bottom-right big
            FloatingCircle(
                size: 160, // w-40 * 4
                opacity: 0.15,
                blur: 24,
                initialX: UIScreen.main.bounds.width - 64, initialY: UIScreen.main.bounds.height - 128,
                moveX: -40, moveY: 50,
                duration: 15,
                delay: 3
            )
            
            // 3. Center-ish
            FloatingCircle(
                size: 80, // w-20 * 4
                opacity: 0.18,
                blur: 16, // blur-lg
                initialX: UIScreen.main.bounds.width / 3, initialY: UIScreen.main.bounds.height / 2,
                moveX: 25, moveY: -30,
                duration: 12,
                delay: 6
            )
            
            // 4. Top-right small
            FloatingCircle(
                size: 64, // w-16 * 4
                opacity: 0.12,
                blur: 12, // blur-md
                initialX: UIScreen.main.bounds.width * 0.75, initialY: UIScreen.main.bounds.height * 0.25,
                moveX: -20, moveY: 35,
                duration: 8,
                delay: 1
            )
            
            // 5. Bottom-left
            FloatingCircle(
                size: 112, // w-28 * 4
                opacity: 0.1,
                blur: 16,
                initialX: UIScreen.main.bounds.width * 0.33, initialY: UIScreen.main.bounds.height * 0.75,
                moveX: 35, moveY: -25,
                duration: 18,
                delay: 4
            )
        }
        .edgesIgnoringSafeArea(.all)
    }
}

struct FloatingCircle: View {
    let size: CGFloat
    let opacity: Double
    let blur: CGFloat
    let initialX: CGFloat
    let initialY: CGFloat
    let moveX: CGFloat
    let moveY: CGFloat
    let duration: Double
    var delay: Double = 0
    
    @State private var animate = false
    
    var body: some View {
        Circle()
            .fill(Color.white.opacity(opacity))
            .frame(width: size, height: size)
            .blur(radius: blur)
            .position(x: initialX, y: initialY)
            .offset(x: animate ? moveX : 0, y: animate ? moveY : 0)
            .scaleEffect(animate ? 1.2 : 1.0)
            .onAppear {
                withAnimation(Animation.easeInOut(duration: duration).repeatForever(autoreverses: true).delay(delay)) {
                    animate.toggle()
                }
            }
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
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("프로필 정보를\n설정해주세요")
                .font(.suite(size: 24, weight: .bold))
                .foregroundColor(BrandColors.textPrimary)
            
            // Birth Date
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("생년월일")
                        .font(.suite(size: 16, weight: .bold))
                    Text("* 필수")
                        .font(.suite(size: 12))
                        .foregroundColor(BrandColors.primary)
                }
                
                // DatePicker (Wheel Style for fixed height feeling)
                DatePicker(
                    "",
                    selection: $birthDate,
                    in: ...Date(), // Future dates disabled
                    displayedComponents: .date
                )
                .datePickerStyle(.wheel)
                .labelsHidden()
                .frame(maxWidth: .infinity) // 좌우 꽉 차게 설정하여 중앙 정렬 효과
                .frame(height: 150) // Fixed height
                .background(Color(white: 0.96))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(hex: "#0113A3").opacity(0.1), lineWidth: 1)
                )
                
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
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("성별")
                        .font(.suite(size: 16, weight: .bold))
                    Text("* 필수")
                        .font(.suite(size: 12))
                        .foregroundColor(BrandColors.primary)
                }
                
                HStack(spacing: 16) {
                    GenderButton(title: "남성", isSelected: viewModel.registerData.mt_gender == 1) {
                        viewModel.registerData.mt_gender = 1
                    }
                    GenderButton(title: "여성", isSelected: viewModel.registerData.mt_gender == 2) {
                        viewModel.registerData.mt_gender = 2
                    }
                }
            }
            
            Spacer()
        }
        .padding()
        .onAppear {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            
            if let birth = viewModel.registerData.mt_birth, let date = formatter.date(from: birth) {
                self.birthDate = date
            } else {
                // 초기값 설정 (2000-01-01) - 필수 값이므로 초기화 시 값 주입
                viewModel.registerData.mt_birth = formatter.string(from: birthDate)
            }
        }
        .onChange(of: birthDate) { newValue in
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            viewModel.registerData.mt_birth = formatter.string(from: newValue)
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

// MARK: - ForgotPasswordView

struct ForgotPasswordView: View {
    @StateObject private var viewModel = ForgotPasswordViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var isFocused = false
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.white.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Header
                    headerView
                    
                    ScrollView {
                        VStack(alignment: .leading, spacing: 30) {
                            // Step indicator and title
                            titleSection
                            
                            // Step-specific content
                            switch viewModel.currentStep {
                            case .phone:
                                phoneStepView
                            case .verification:
                                verificationStepView
                            case .newPassword:
                                newPasswordStepView
                            case .complete:
                                completeStepView
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                    }
                }
                
                if viewModel.isLoading {
                    Color.black.opacity(0.15)
                        .ignoresSafeArea()
                    ProgressView()
                        .scaleEffect(1.5)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(10)
                        .shadow(radius: 10)
                }
            }
            .navigationBarHidden(true)
            .alert(isPresented: $viewModel.showError) {
                Alert(
                    title: Text("알림"),
                    message: Text(viewModel.errorMessage ?? "오류가 발생했습니다."),
                    dismissButton: .default(Text("확인"))
                )
            }
        }
    }
    
    // MARK: - Subviews
    
    private var headerView: some View {
        HStack {
            Button(action: {
                if viewModel.currentStep == .phone || viewModel.currentStep == .complete {
                    dismiss()
                } else if viewModel.currentStep == .verification {
                    viewModel.currentStep = .phone
                } else if viewModel.currentStep == .newPassword {
                    viewModel.currentStep = .verification
                }
            }) {
                Image(systemName: "chevron.left")
                    .font(.suite(size: 20, weight: .medium))
                    .foregroundColor(.black)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
    
    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(stepTitle)
                .font(.custom("SUITE-Bold", size: 28))
                .foregroundColor(.black)
            
            Text(stepDescription)
                .font(.custom("SUITE-Medium", size: 16))
                .foregroundColor(.gray)
                .lineLimit(2)
        }
    }
    
    private var stepTitle: String {
        switch viewModel.currentStep {
        case .phone: return "비밀번호 찾기"
        case .verification: return "인증번호 입력"
        case .newPassword: return "새 비밀번호 설정"
        case .complete: return "설정 완료"
        }
    }
    
    private var stepDescription: String {
        switch viewModel.currentStep {
        case .phone: return "가입하실 때 사용한 전화번호를 입력해주세요."
        case .verification: return "\(viewModel.phoneNumber)로 발송된\n6자리 인증번호를 입력해주세요."
        case .newPassword: return "새로운 비밀번호를 설정해주세요."
        case .complete: return "비밀번호가 성공적으로 변경되었습니다."
        }
    }
    
    // MARK: - Step Views
    
    private var phoneStepView: some View {
        VStack(spacing: 40) {
            VStack(alignment: .leading, spacing: 10) {
                Text("전화번호")
                    .font(.custom("SUITE-SemiBold", size: 14))
                    .foregroundColor(.gray)
                
                PhoneTextField(text: $viewModel.phoneNumber, placeholder: "010-0000-0000", onEditingChanged: { editing in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isFocused = editing
                    }
                })
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isFocused ? Color(hex: "#0113A3") : Color(hex: "#0113A3").opacity(0.3), lineWidth: isFocused ? 2 : 1)
                    )
            }
            
            Button(action: {
                viewModel.checkUserAndSendCode()
            }) {
                Text("인증번호 받기")
                    .font(.custom("SUITE-Bold", size: 18))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(viewModel.phoneNumber.count >= 10 ? Color(hex: "#0113A3") : Color.gray.opacity(0.3))
                    .cornerRadius(12)
            }
            .disabled(viewModel.phoneNumber.count < 10)
        }
    }
    
    private var verificationStepView: some View {
        VStack(spacing: 40) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("인증번호")
                        .font(.custom("SUITE-SemiBold", size: 14))
                        .foregroundColor(.gray)
                    Spacer()
                    if viewModel.verificationTimer > 0 {
                        Text(String(format: "%d:%02d", viewModel.verificationTimer / 60, viewModel.verificationTimer % 60))
                            .font(.custom("SUITE-Medium", size: 14))
                            .foregroundColor(.red)
                    }
                }
                
                TextField("6자리 입력", text: $viewModel.verificationCode)
                    .keyboardType(.numberPad)
                    .font(.custom("SUITE-Medium", size: 18))
                    .padding()
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(hex: "#0113A3").opacity(0.3), lineWidth: 1)
                    )
            }
            
            VStack(spacing: 16) {
                Button(action: {
                    viewModel.verifyCode()
                }) {
                    Text("인증하기")
                        .font(.custom("SUITE-Bold", size: 18))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(viewModel.verificationCode.count == 6 ? Color(hex: "#0113A3") : Color.gray.opacity(0.3))
                        .cornerRadius(12)
                }
                .disabled(viewModel.verificationCode.count != 6)
                
                Button(action: {
                    viewModel.checkUserAndSendCode() // Resend
                }) {
                    Text("인증번호 재발송")
                        .font(.custom("SUITE-Medium", size: 14))
                        .foregroundColor(.gray)
                        .underline()
                }
            }
        }
    }
    
    private var newPasswordStepView: some View {
        VStack(spacing: 30) {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("새 비밀번호")
                        .font(.custom("SUITE-SemiBold", size: 14))
                        .foregroundColor(.gray)
                    
                    HStack {
                        if viewModel.showNewPassword {
                            TextField("8자 이상, 영문/숫자/특수문자 포함", text: $viewModel.newPassword)
                        } else {
                            SecureField("8자 이상, 영문/숫자/특수문자 포함", text: $viewModel.newPassword)
                        }
                        
                        Button(action: { viewModel.showNewPassword.toggle() }) {
                            Image(systemName: viewModel.showNewPassword ? "eye.slash.fill" : "eye.fill")
                                .foregroundColor(.gray)
                        }
                    }
                    .font(.custom("SUITE-Medium", size: 18))
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    
                    // Password Rules Guide
                    VStack(alignment: .leading, spacing: 6) {
                        ruleRow(text: "8자 이상", isValid: viewModel.isPasswordLengthValid)
                        ruleRow(text: "영문 포함", isValid: viewModel.hasPasswordLetter)
                        ruleRow(text: "숫자 포함", isValid: viewModel.hasPasswordNumber)
                        ruleRow(text: "특수문자 포함", isValid: viewModel.hasPasswordSpecialChar)
                    }
                    .padding(.top, 4)
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("비밀번호 확인")
                        .font(.custom("SUITE-SemiBold", size: 14))
                        .foregroundColor(.gray)
                    
                    HStack {
                        if viewModel.showConfirmPassword {
                            TextField("다시 입력해주세요", text: $viewModel.confirmPassword)
                        } else {
                            SecureField("다시 입력해주세요", text: $viewModel.confirmPassword)
                        }
                        
                        Button(action: { viewModel.showConfirmPassword.toggle() }) {
                            Image(systemName: viewModel.showConfirmPassword ? "eye.slash.fill" : "eye.fill")
                                .foregroundColor(.gray)
                        }
                    }
                    .font(.custom("SUITE-Medium", size: 18))
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color(white: 0.96))
                    .cornerRadius(12)
                    
                    if !viewModel.confirmPassword.isEmpty && viewModel.newPassword != viewModel.confirmPassword {
                        Text("비밀번호가 일치하지 않습니다.")
                            .font(.custom("SUITE-Regular", size: 12))
                            .foregroundColor(.red)
                    } else {
                        // 공간 확보를 위한 투명 텍스트 또는 고정 높이
                        Text(" ")
                            .font(.custom("SUITE-Regular", size: 12))
                    }
                }
                .frame(height: 100, alignment: .top) // 고정 높이로 밀림 방지
            }
            
            Button(action: {
                viewModel.resetPassword()
            }) {
                Text("비밀번호 변경")
                    .font(.custom("SUITE-Bold", size: 18))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(isResetDisabled ? Color.gray.opacity(0.3) : Color(hex: "#0113A3"))
                    .cornerRadius(12)
            }
            .disabled(isResetDisabled)
        }
    }
    
    private func ruleRow(text: String, isValid: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isValid ? .green : .gray.opacity(0.5))
                .font(.suite(size: 14))
            
            Text(text)
                .font(.custom("SUITE-Regular", size: 13))
                .foregroundColor(isValid ? .primary : .gray)
        }
    }
    
    private var isResetDisabled: Bool {
        !viewModel.isPasswordRulesSatisfied || viewModel.newPassword != viewModel.confirmPassword
    }
    
    private var completeStepView: some View {
        VStack(spacing: 60) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.suite(size: 80))
                .foregroundColor(Color(hex: "#0113A3"))
            
            VStack(spacing: 12) {
                Text("완료되었습니다")
                    .font(.custom("SUITE-Bold", size: 24))
                Text("이제 새로운 비밀번호로 로그인해주세요.")
                    .font(.custom("SUITE-Medium", size: 16))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            Button(action: {
                dismiss()
            }) {
                Text("로그인하러 가기")
                    .font(.custom("SUITE-Bold", size: 18))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color(hex: "#0113A3"))
                    .cornerRadius(12)
            }
        }
        .frame(height: 500)
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

// MARK: - MyPlace Models

/// 저장된 장소 데이터 모델
struct SavedLocation: Codable, Identifiable, Equatable {
    var id: Int { slt_idx }
    
    let slt_idx: Int
    let insert_mt_idx: Int?
    let mt_idx: Int?
    let sgt_idx: Int?
    let sgdt_idx: Int?
    let slt_title: String?
    let slt_add: String?
    let slt_lat: Double?
    let slt_long: Double?
    let slt_show: String?
    var slt_enter_alarm: String?
    let slt_enter_chk: String?
    let slt_wdate: String?
    let slt_udate: String?
    
    var notifications: Bool { slt_enter_alarm == "Y" }
    var isVisible: Bool { slt_show == "Y" }
    var latitude: Double { slt_lat ?? 37.5665 }
    var longitude: Double { slt_long ?? 126.9780 }
    var name: String { slt_title ?? "이름 없음" }
    var address: String { slt_add ?? "주소 없음" }
    
    // Custom decoder for string-encoded coordinates
    enum CodingKeys: String, CodingKey {
        case slt_idx, insert_mt_idx, mt_idx, sgt_idx, sgdt_idx
        case slt_title, slt_add, slt_lat, slt_long
        case slt_show, slt_enter_alarm, slt_enter_chk
        case slt_wdate, slt_udate
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        slt_idx = try container.decode(Int.self, forKey: .slt_idx)
        insert_mt_idx = try container.decodeIfPresent(Int.self, forKey: .insert_mt_idx)
        mt_idx = try container.decodeIfPresent(Int.self, forKey: .mt_idx)
        sgt_idx = try container.decodeIfPresent(Int.self, forKey: .sgt_idx)
        sgdt_idx = try container.decodeIfPresent(Int.self, forKey: .sgdt_idx)
        slt_title = try container.decodeIfPresent(String.self, forKey: .slt_title)
        slt_add = try container.decodeIfPresent(String.self, forKey: .slt_add)
        
        // Handle coordinates as either Double or String
        if let latDouble = try? container.decodeIfPresent(Double.self, forKey: .slt_lat) {
            slt_lat = latDouble
        } else if let latString = try? container.decodeIfPresent(String.self, forKey: .slt_lat) {
            slt_lat = Double(latString)
        } else {
            slt_lat = nil
        }
        
        if let longDouble = try? container.decodeIfPresent(Double.self, forKey: .slt_long) {
            slt_long = longDouble
        } else if let longString = try? container.decodeIfPresent(String.self, forKey: .slt_long) {
            slt_long = Double(longString)
        } else {
            slt_long = nil
        }
        
        slt_show = try container.decodeIfPresent(String.self, forKey: .slt_show)
        slt_enter_alarm = try container.decodeIfPresent(String.self, forKey: .slt_enter_alarm)
        slt_enter_chk = try container.decodeIfPresent(String.self, forKey: .slt_enter_chk)
        slt_wdate = try container.decodeIfPresent(String.self, forKey: .slt_wdate)
        slt_udate = try container.decodeIfPresent(String.self, forKey: .slt_udate)
    }
}

struct LocationCreateRequest: Codable {
    let slt_title: String
    let slt_add: String
    let slt_lat: Double
    let slt_long: Double
    let slt_show: String
    let slt_enter_alarm: String
    let slt_enter_chk: String
    
    init(title: String, address: String, latitude: Double, longitude: Double, show: String = "Y", enterAlarm: String = "Y", enterChk: String = "N") {
        self.slt_title = title
        self.slt_add = address
        self.slt_lat = latitude
        self.slt_long = longitude
        self.slt_show = show
        self.slt_enter_alarm = enterAlarm
        self.slt_enter_chk = enterChk
    }
}

struct LocationUpdateRequest: Codable {
    var slt_title: String?
    var slt_add: String?
    var slt_lat: Double?
    var slt_long: Double?
    var slt_show: String?
    var slt_enter_alarm: String?
}

struct LocationActionResponse: Codable {
    let success: Bool
    let message: String?
    let member_id: Int?
    let slt_idx: Int?
    let data: SavedLocation?
}

struct PlaceMember: Identifiable {
    var id: Int { mt_idx }
    let mt_idx: Int
    let mt_name: String
    let mt_nickname: String? // Added for nickname support
    let mt_file1: String?
    let sgdt_owner_chk: String?
    let sgdt_leader_chk: String?
    var locationCount: Int
    var isSelected: Bool
    
    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return mt_name
    }
    var isOwner: Bool { sgdt_owner_chk == "Y" }
    var isLeader: Bool { sgdt_leader_chk == "Y" }
    
    init(from member: SmapGroupMember, locationCount: Int = 0, isSelected: Bool = false) {
        self.mt_idx = member.mt_idx
        self.mt_name = member.mt_name ?? "알 수 없음"
        self.mt_nickname = member.mt_nickname
        self.mt_file1 = member.mt_file1
        self.sgdt_owner_chk = member.sgdt_owner_chk
        self.sgdt_leader_chk = member.sgdt_leader_chk
        self.locationCount = locationCount
        self.isSelected = isSelected
    }
}

// MARK: - MyPlace Service

class MyPlaceService {
    static let shared = MyPlaceService()
    private let authService = AuthService.shared
    private init() {}
    
    private var baseURL: String { authService.baseURL }
    
    func getMemberLocations(memberId: Int) async throws -> [SavedLocation] {
        let url = URL(string: "\(baseURL)/locations/member/\(memberId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        print("🌐 [MyPlaceService] getMemberLocations URL: \(url.absoluteString)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [MyPlaceService] Invalid response type")
            throw APIError(detail: nil, message: "Invalid response")
        }
        
        print("🌐 [MyPlaceService] Response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode != 200 {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [MyPlaceService] Error response: \(responseString)")
            throw APIError(detail: nil, message: "장소 목록을 불러오는데 실패했습니다. (Error: \(httpResponse.statusCode))")
        }
        
        // Try to decode
        do {
            let locations = try JSONDecoder().decode([SavedLocation].self, from: data)
            print("📍 [MyPlaceService] Loaded \(locations.count) locations for member \(memberId)")
            return locations
        } catch let decodingError {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [MyPlaceService] Decoding error: \(decodingError)")
            print("❌ [MyPlaceService] Response data: \(responseString.prefix(500))")
            throw decodingError
        }
    }
    
    func createLocation(memberId: Int, request: LocationCreateRequest) async throws -> SavedLocation? {
        let url = URL(string: "\(baseURL)/locations/members/\(memberId)/locations")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = try JSONEncoder().encode(request)
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            throw APIError(detail: nil, message: "장소 생성에 실패했습니다.")
        }
        let result = try JSONDecoder().decode(LocationActionResponse.self, from: data)
        return result.data
    }
    
    func updateLocation(memberId: Int, locationId: Int, request: LocationUpdateRequest) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)")!
        print("🌐 [MyPlaceService] Updating location \(locationId) at \(url)")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Use manual serialization with Strings for coordinates to ensure backend compatibility
        let bodyDict: [String: Any?] = [
            "mt_idx": String(memberId),
            "slt_title": request.slt_title,
            "slt_add": request.slt_add,
            "slt_lat": request.slt_lat != nil ? String(format: "%.8f", request.slt_lat!) : nil,
            "slt_long": request.slt_long != nil ? String(format: "%.8f", request.slt_long!) : nil,
            "slt_enter_alarm": request.slt_enter_alarm
        ]
        let filteredBody = bodyDict.compactMapValues { $0 }
        
        let jsonData = try JSONSerialization.data(withJSONObject: filteredBody)
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print("🌐 [MyPlaceService] Update JSON: \(jsonString)")
        }
        urlRequest.httpBody = jsonData
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [MyPlaceService] Response status: \(httpResponse.statusCode)")
            if let responseData = String(data: data, encoding: .utf8) {
                print("🌐 [MyPlaceService] Response data: \(responseData)")
            }
            return (200...299).contains(httpResponse.statusCode)
        }
        return false
    }
    
    func deleteLocation(locationId: Int) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    
    func toggleNotification(locationId: Int, enabled: Bool) async throws -> Bool {
        let url = URL(string: "\(baseURL)/locations/\(locationId)/notification")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let body: [String: String] = ["slt_enter_alarm": enabled ? "Y" : "N"]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
}

// MARK: - MyPlace ViewModel

class MyPlaceViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var members: [PlaceMember] = []
    @Published var selectedMember: PlaceMember?
    @Published var locations: [SavedLocation] = []
    @Published var selectedLocation: SavedLocation?
    @Published var isSidebarOpen: Bool = false
    @Published var isLocationPanelOpen: Bool = false
    @Published var isEditMode: Bool = false
    @Published var isLoading: Bool = true // Start with loading true to prevent map init with default coordinates
    @Published var isLoadingLocations: Bool = false
    @Published var isSaving: Bool = false
    @Published var errorMessage: String?
    @Published var showError: Bool = false
    @Published var targetCoordinate: (lat: Double, lng: Double)?  // For map centering
    @Published var initialMapCenter: (lat: Double, lng: Double)?   // Initial center for map (first location)
    @Published var isHeaderSearchPresented = false
    
    private let groupService = GroupService.shared
    private let myPlaceService = MyPlaceService.shared
    
    @MainActor
    func loadInitialData() async {
        isLoading = true
        do {
            let fetchedGroups = try await groupService.getCurrentUserGroups()
            self.groups = fetchedGroups
            if let firstGroup = fetchedGroups.first {
                self.selectedGroup = firstGroup
                await loadGroupMembers(sgtIdx: firstGroup.sgt_idx)
            }
            isLoading = false
        } catch {
            handleError(error)
            isLoading = false
        }
    }
    
    @MainActor
    func loadGroupMembers(sgtIdx: Int) async {
        do {
            let fetchedMembers = try await groupService.getGroupMembers(sgtIdx: sgtIdx)
            var placeMembers: [PlaceMember] = []
            for (index, member) in fetchedMembers.enumerated() {
                var placeMember = PlaceMember(from: member, isSelected: index == 0)
                
                // Use the unwrapped mt_idx from placeMember (defaults to 0 if nil)
                let mtIdx = placeMember.mt_idx
                if mtIdx > 0 {
                    print("📍 [MyPlaceViewModel] Loading locations for member \(mtIdx)")
                    if let memberLocations = try? await myPlaceService.getMemberLocations(memberId: mtIdx) {
                        placeMember.locationCount = memberLocations.count
                        print("📍 [MyPlaceViewModel] Member \(mtIdx) has \(memberLocations.count) locations")
                    } else {
                        print("⚠️ [MyPlaceViewModel] Failed to load locations for member \(mtIdx)")
                    }
                }
                placeMembers.append(placeMember)
            }
            self.members = placeMembers
            if let firstMember = placeMembers.first, firstMember.mt_idx > 0 {
                self.selectedMember = firstMember
                await loadMemberLocations(memberId: firstMember.mt_idx, centerOnFirst: true)
            }
        } catch {
            handleError(error)
        }
    }
    
    @MainActor
    func loadMemberLocations(memberId: Int, centerOnFirst: Bool = false) async {
        isLoadingLocations = true
        do {
            let fetchedLocations = try await myPlaceService.getMemberLocations(memberId: memberId)
            self.locations = fetchedLocations.filter { $0.isVisible }
            
            // Auto-focus first location if requested
            if centerOnFirst, let first = self.locations.first {
                self.targetCoordinate = (lat: first.latitude, lng: first.longitude)
                self.selectedLocation = first
                // Set initial map center only on first load
                if self.initialMapCenter == nil {
                    self.initialMapCenter = (lat: first.latitude, lng: first.longitude)
                }
            }
            
            isLoadingLocations = false
        } catch {
            handleError(error)
            isLoadingLocations = false
        }
    }
    
    @MainActor func selectGroup(_ group: SmapGroup) {
        HapticManager.shared.selection()
        guard selectedGroup?.sgt_idx != group.sgt_idx else { return }
        selectedGroup = group
        Task { await loadGroupMembers(sgtIdx: group.sgt_idx) }
    }
    
    @MainActor func selectMember(_ member: PlaceMember) {
        HapticManager.shared.selection()
        guard selectedMember?.mt_idx != member.mt_idx else { return }
        for i in members.indices { members[i].isSelected = members[i].mt_idx == member.mt_idx }
        selectedMember = member
        Task { 
            await loadMemberLocations(memberId: member.mt_idx, centerOnFirst: true)
        }
        // Keep sidebar open to show locations list
    }
    
    func selectLocationFromSidebar(_ location: SavedLocation) {
        selectedLocation = location
        targetCoordinate = (lat: location.latitude, lng: location.longitude)
        // Ensure detail panel is closed when selecting from sidebar
        isLocationPanelOpen = false
        // Close sidebar to show the map update
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { isSidebarOpen = false }
    }
    
    func selectLocationFromMarker(_ location: SavedLocation) {
        selectedLocation = location
        targetCoordinate = (lat: location.latitude, lng: location.longitude)
        // Open Location Detail Panel only when marker is tapped
        isEditMode = false
        isLocationPanelOpen = true
    }
    
    func closeLocationPanel() { 
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            isLocationPanelOpen = false
            selectedLocation = nil
            isEditMode = false
        }
    }
    
    func startEditing() { 
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isEditMode = true 
        }
    }
    
    func startNewLocation(latitude: Double, longitude: Double) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            selectedLocation = nil
            isEditMode = true
            isLocationPanelOpen = true
        }
    }
    
    @MainActor
    func saveLocation(title: String, address: String, latitude: Double, longitude: Double, notifications: Bool) async -> Bool {
        guard let memberId = selectedMember?.mt_idx else { return false }
        isSaving = true
        do {
            if let existingLocation = selectedLocation {
                let request = LocationUpdateRequest(slt_title: title, slt_add: address, slt_lat: latitude, slt_long: longitude, slt_enter_alarm: notifications ? "Y" : "N")
                let success = try await myPlaceService.updateLocation(memberId: memberId, locationId: existingLocation.slt_idx, request: request)
                if !success { throw APIError(detail: nil, message: "장소 정보 수정 내용이 서버에 반영되지 않았습니다. 다시 시도해주세요.") }
            } else {
                let request = LocationCreateRequest(title: title, address: address, latitude: latitude, longitude: longitude, enterAlarm: notifications ? "Y" : "N")
                _ = try await myPlaceService.createLocation(memberId: memberId, request: request)
            }
            
            // Reload and sync
            await loadMemberLocations(memberId: memberId)
            
            // Critical: Update selectedLocation to the newly saved/updated version to refresh map/UI
            if let existing = selectedLocation {
                if let updated = locations.first(where: { $0.slt_idx == existing.slt_idx }) {
                    selectedLocation = updated
                }
            } else if let latest = locations.last { // For newly created, usually last in the fetched list
                selectedLocation = latest
            }
            
            if let index = members.firstIndex(where: { $0.mt_idx == memberId }) { 
                members[index].locationCount = locations.count 
            }
            
            isSaving = false
            isLocationPanelOpen = false
            isEditMode = false
            return true
        } catch {
            handleError(error)
            isSaving = false
            return false
        }
    }
    
    @MainActor
    func deleteLocation(_ location: SavedLocation) async -> Bool {
        guard let memberId = selectedMember?.mt_idx else { return false }
        isSaving = true
        do {
            _ = try await myPlaceService.deleteLocation(locationId: location.slt_idx)
            await loadMemberLocations(memberId: memberId)
            if let index = members.firstIndex(where: { $0.mt_idx == memberId }) { members[index].locationCount = locations.count }
            isSaving = false
            isLocationPanelOpen = false
            return true
        } catch {
            handleError(error)
            isSaving = false
            return false
        }
    }
    
    @MainActor
    func toggleNotification(for location: SavedLocation) async -> Bool {
        // Optimistic UI update: update local state immediately to prevent layout jitter
        let newNotificationState = !location.notifications
        let newAlarmValue = newNotificationState ? "Y" : "N"
        if let index = locations.firstIndex(where: { $0.slt_idx == location.slt_idx }) {
            locations[index].slt_enter_alarm = newAlarmValue
            // Also update selectedLocation if it's the same location
            if selectedLocation?.slt_idx == location.slt_idx {
                selectedLocation = locations[index]
            }
        }
        
        do {
            // Make the API call (no need to reload all locations)
            _ = try await myPlaceService.toggleNotification(locationId: location.slt_idx, enabled: newNotificationState)
            return true
        } catch {
            // Revert on error
            let revertAlarmValue = newNotificationState ? "N" : "Y"
            if let index = locations.firstIndex(where: { $0.slt_idx == location.slt_idx }) {
                locations[index].slt_enter_alarm = revertAlarmValue
                if selectedLocation?.slt_idx == location.slt_idx {
                    selectedLocation = locations[index]
                }
            }
            handleError(error)
            return false
        }
    }
    
    func toggleSidebar() { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { isSidebarOpen.toggle() } }
    func openSidebar() { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { isSidebarOpen = true } }
    func closeSidebar() { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { isSidebarOpen = false } }
    
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError { errorMessage = apiError.message ?? "알 수 없는 오류" }
        else { errorMessage = error.localizedDescription }
        showError = true
    }
}

// MARK: - MyPlace View

struct MyPlaceView: View {
    @StateObject private var viewModel = MyPlaceViewModel()
    @Environment(\.presentationMode) var presentationMode
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var newLocationCoordinates: (lat: Double, lng: Double)?
    @State private var newLocationName: String? = nil
    @State private var newLocationAddress: String? = nil
    @State private var isMapLoading = true  // 지도 로딩 상태
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // Map
            // Map - Render only after loading to ensure initial coordinates are set
            if !viewModel.isLoading {
                MyPlaceMapView(
                    locations: viewModel.locations,
                    selectedLocation: $viewModel.selectedLocation,
                    targetCoordinate: $viewModel.targetCoordinate,
                    initialCenter: viewModel.initialMapCenter,
                    onLocationTap: { viewModel.selectLocationFromMarker($0) },
                    onMapTap: { lat, lng in 
                        Task {
                            let address = try? await KakaoLocationSearchService.shared.reverseGeocode(latitude: lat, longitude: lng)
                            newLocationCoordinates = (lat, lng)
                            newLocationName = nil // Leave empty for user to fill
                            newLocationAddress = address ?? ""
                            viewModel.startNewLocation(latitude: lat, longitude: lng)
                        }
                    })
                .edgesIgnoringSafeArea(.all).offset(y: 60)
            }
            
            // Header
            VStack { 
                MyPlaceHeaderView(
                    onBackTap: { presentationMode.wrappedValue.dismiss() }, 
                    onSearchTap: { viewModel.isHeaderSearchPresented = true }
                )
                Spacer() 
            }
            
            // Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity).edgesIgnoringSafeArea(.all).onTapGesture { viewModel.closeSidebar() }
            }
            
            // Sidebar
            MyPlaceSidebarView(viewModel: viewModel).frame(width: sidebarWidth).offset(x: sidebarOffset).gesture(sidebarDragGesture).zIndex(100)
            
            // Edge Swipe
            if !viewModel.isSidebarOpen {
                Color.clear.frame(width: 20).contentShape(Rectangle()).gesture(edgeSwipeGesture).frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // FAB
            VStack { Spacer(); HStack { Spacer(); FloatingActionPlaceButton(count: viewModel.members.count) { viewModel.toggleSidebar() }.padding(.trailing, 20).padding(.bottom, 20) } }
            
            // Loading
            
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            handleLoading()
        }
        .task { await viewModel.loadInitialData() }
        .sheet(isPresented: $viewModel.isLocationPanelOpen) { 
            LocationDetailPanel(
                viewModel: viewModel, 
                initialCoordinates: newLocationCoordinates,
                initialName: newLocationName,
                initialAddress: newLocationAddress
            ) 
        }
        .sheet(isPresented: $viewModel.isHeaderSearchPresented) {
            NavigationView {
                LocationSearchView { place in
                    if let lat = Double(place.y), let lng = Double(place.x) {
                        newLocationCoordinates = (lat, lng)
                        newLocationName = place.place_name
                        newLocationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                        
                        viewModel.targetCoordinate = (lat: lat, lng: lng)
                        viewModel.selectedLocation = nil
                        viewModel.isEditMode = true
                        viewModel.isLocationPanelOpen = true
                        viewModel.isHeaderSearchPresented = false
                    }
                }
                .navigationBarItems(leading: Button(action: { viewModel.isHeaderSearchPresented = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
        .alert(isPresented: $viewModel.showError) { Alert(title: Text("오류"), message: Text(viewModel.errorMessage ?? ""), dismissButton: .default(Text("확인"))) }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동(즉시) 닫기
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            // 다시 돌아올 때를 위해 로딩 상태 리셋
            isMapLoading = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            viewModel.isSidebarOpen = false
            sidebarDragOffset = 0
            if let targetTab = notification.object as? Int, targetTab == 3 {
                isMapLoading = true
                handleLoading()
            }
        }
    }
    
    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        // 이미 진행 중인 타이머가 있을 수 있으므로 isMapLoading이 true일 때만 시작
        guard isMapLoading else { return }
        
        Task {
            // 최소 1.5초 대기
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }
            
            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }
    
    private var sidebarOffset: CGFloat { viewModel.isSidebarOpen ? max(0, sidebarDragOffset) : min(0, -sidebarWidth + sidebarDragOffset) }
    private var overlayOpacity: Double { let progress = viewModel.isSidebarOpen ? 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth) : Double(sidebarDragOffset) / Double(sidebarWidth); return 0.4 * max(0, min(1, progress)) }
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture().onChanged { if $0.translation.width > 0 { sidebarDragOffset = min(sidebarWidth, $0.translation.width) } }
        .onEnded { if $0.translation.width > sidebarWidth * 0.3 { viewModel.openSidebar() } else { viewModel.closeSidebar() }; sidebarDragOffset = 0 }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture().onChanged { sidebarDragOffset = $0.translation.width }
        .onEnded { if viewModel.isSidebarOpen && $0.translation.width < -sidebarWidth * 0.3 { viewModel.closeSidebar() }; withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { sidebarDragOffset = 0 } }
    }
}

struct MyPlaceHeaderView: View {
    let onBackTap: () -> Void
    let onSearchTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("내장소")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("장소를 등록하고 관리하세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            Button(action: onSearchTap) {
                Image(systemName: "magnifyingglass")
                    .font(.suite(size: 20))
                    .foregroundColor(.gray)
            }
            .frame(width: 36, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            BlurView(style: .systemUltraThinMaterialLight)
                .edgesIgnoringSafeArea(.top)
        )
    }
}

struct FloatingActionPlaceButton: View {
    let count: Int
    let action: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255) // Pink-500
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                // Main Button Circle
                Circle()
                    .fill(brandColor)
                    .frame(width: 56, height: 56)
                    .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                // Badge (Pink)
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24)
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

struct MyPlaceSidebarView: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            sidebarHeader
                .padding(.top, 20)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector Section
                    groupSelectorSection
                    
                    // Member Horizontal Selector
                    memberSelectorSection
                    
                    // Location List Section
                    locationListSection
                }
                .padding(.bottom, 40)
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .edgesIgnoringSafeArea(.all)
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
    
    // MARK: - Sections
    
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(brandColor)
                    .frame(width: 40, height: 40)
                Image(systemName: "mappin.and.ellipse")
                    .foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("장소 관리")
                    .font(.suite(size: 20, weight: .bold))
                Text("멤버를 선택해보세요")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private var groupSelectorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Text("그룹 선택").font(.suite(size: 16, weight: .bold))
            }
            
            Menu {
                ForEach(viewModel.groups) { group in
                    Button(group.sgt_title ?? "이름 없음") { viewModel.selectGroup(group) }
                }
            } label: {
                HStack {
                    Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                        .font(.suite(size: 17))
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
    
    private var memberSelectorSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(Color.blue).frame(width: 8, height: 8)
                Text("멤버 선택").font(.suite(size: 16, weight: .bold))
                Spacer()
                Text("\(viewModel.members.count)명")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(viewModel.members) { member in
                        PlaceMemberCircleCell(member: member) {
                            viewModel.selectMember(member)
                        }
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 4)
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
    
    private var locationListSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(Color.green).frame(width: 8, height: 8)
                Text("장소 목록").font(.suite(size: 16, weight: .bold))
                Spacer()
                if let selected = viewModel.selectedMember {
                    Text("\(selected.displayName)님의 장소")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
            }
            
            if viewModel.isLoadingLocations {
                HStack { Spacer(); ProgressView().padding(); Spacer() }
            } else if viewModel.locations.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "mappin.slash")
                        .font(.system(size: 30))
                        .foregroundColor(.gray.opacity(0.4))
                    Text("등록된 장소가 없습니다")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.locations) { location in
                        PlaceLocationCell(
                            location: location,
                            isSelected: viewModel.selectedLocation?.slt_idx == location.slt_idx,
                            onToggleNotification: {
                                Task { await viewModel.toggleNotification(for: location) }
                            }
                        ) {
                            viewModel.selectLocationFromSidebar(location)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
}


struct PlaceMemberCell: View {
    let member: PlaceMember
    let onTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Avatar with Badge
                ZStack(alignment: .bottomTrailing) {
                    // Profile Image with Selection Border
                    Group {
                        if let url = getProfileImageUrl(member.mt_file1) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView()
                                        .frame(width: 44, height: 44)
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 44, height: 44)
                                        .clipShape(Circle())
                                case .failure:
                                    defaultAvatar
                                @unknown default:
                                    defaultAvatar
                                }
                            }
                        } else {
                            defaultAvatar
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(member.isSelected ? brandColor : Color.clear, lineWidth: 2.5)
                    )
                    
                    // Crown/Star Icon
                    if member.isOwner {
                        Circle()
                            .fill(Color.yellow)
                            .frame(width: 16, height: 16)
                            .overlay(Image(systemName: "crown.fill").font(.suite(size: 8)).foregroundColor(.white))
                            .offset(x: 4, y: 4)
                    } else if member.isLeader {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 16, height: 16) 
                            .overlay(Image(systemName: "star.fill").font(.suite(size: 8)).foregroundColor(.white))
                            .offset(x: 4, y: 4)
                    }
                }
                .frame(width: 52, height: 52)
                
                // Member Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.suite(size: 17, weight: .medium))
                        .foregroundColor(.primary)
                    Text("장소 \(member.locationCount)개")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if member.isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(brandColor)
                        .font(.suite(size: 22))
                }
            }
            .padding(12)
            .background(member.isSelected ? brandColor.opacity(0.05) : Color.white)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(member.isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 44, height: 44)
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    // Helper function to construct proper profile image URL
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

// MARK: - New Member Circle Cell for Horizontal selector

struct PlaceMemberCircleCell: View {
    let member: PlaceMember
    let onTap: () -> Void
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                ZStack(alignment: .bottomTrailing) {
                    // Profile Image
                    Group {
                        if let url = getProfileImageUrl(member.mt_file1) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView().frame(width: 48, height: 48)
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 48, height: 48)
                                        .clipShape(Circle())
                                case .failure:
                                    defaultAvatar
                                @unknown default:
                                    defaultAvatar
                                }
                            }
                        } else {
                            defaultAvatar
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(member.isSelected ? brandColor : Color.gray.opacity(0.2), lineWidth: 2)
                    )
                    
                    // Owner/Leader Badge
                    if member.isOwner {
                        Circle()
                            .fill(Color.yellow)
                            .frame(width: 14, height: 14)
                            .overlay(Image(systemName: "crown.fill").font(.system(size: 7)).foregroundColor(.white))
                            .offset(x: 2, y: 2)
                    } else if member.isLeader {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 14, height: 14)
                            .overlay(Image(systemName: "star.fill").font(.system(size: 7)).foregroundColor(.white))
                            .offset(x: 2, y: 2)
                    }
                }
                
                Text(member.displayName)
                    .font(.suite(size: 13, weight: member.isSelected ? .bold : .medium))
                    .foregroundColor(member.isSelected ? brandColor : .primary)
                    .lineLimit(1)
                    .frame(width: 60)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 48, height: 48)
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

// MARK: - Place Location Cell

struct PlaceLocationCell: View {
    let location: SavedLocation
    let isSelected: Bool
    let onToggleNotification: () -> Void
    let onTap: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Base layer: Main row content (tappable for selection)
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Location Info
                    VStack(alignment: .leading, spacing: 3) {
                        Text(location.name)
                            .font(.suite(size: 16, weight: .medium))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        Text(location.address)
                            .font(.suite(size: 10))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    
                    Spacer()
                    
                    // Placeholder for bell button (important: disable hit testing)
                    Color.clear
                        .frame(width: 40, height: 40)
                        .allowsHitTesting(false)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(isSelected ? brandColor.opacity(0.08) : Color.white.opacity(0.6))
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
            
            // Top layer: Notification Toggle Button (independent touch target)
            Button(action: onToggleNotification) {
                Image(systemName: location.notifications ? "bell.fill" : "bell.slash")
                    .font(.system(size: 14))
                    .foregroundColor(location.notifications ? .orange : .gray.opacity(0.4))
                    .frame(width: 36, height: 36)
                    .background(Color.white)
                    .clipShape(Circle())
                    .shadow(color: Color.black.opacity(0.08), radius: 2, x: 0, y: 1)
                    .contentShape(Circle())
            }
            .buttonStyle(PlainButtonStyle())
            .padding(.trailing, 12)
        }
    }
}

struct MyPlaceMapView: UIViewRepresentable {
    let locations: [SavedLocation]
    @Binding var selectedLocation: SavedLocation?
    @Binding var targetCoordinate: (lat: Double, lng: Double)?
    var initialCenter: (lat: Double, lng: Double)?  // Initial center for map initialization
    let onLocationTap: (SavedLocation) -> Void
    let onMapTap: (Double, Double) -> Void
    
    func makeUIView(context: Context) -> NMFMapView {
        let mapView = NMFMapView()
        mapView.positionMode = .disabled
        mapView.logoAlign = .leftBottom
        mapView.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화 (LocationService에서 가져옴)
        var userLat: Double = 37.5665  // 기본값은 서울
        var userLng: Double = 126.9780
        
        // 현재 기기의 마지막 위치 사용 (getLastLocation은 non-optional)
        let lastLocation = LocationService.sharedInstance.getLastLocation()
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            userLat = lastLocation.coordinate.latitude
            userLng = lastLocation.coordinate.longitude
            print("📍 [MyPlaceMapView-LoginView] Using device location: (\(userLat), \(userLng))")
        } else {
            print("📍 [MyPlaceMapView-LoginView] No device location, using Seoul default")
        }
        
        // Use initial center if provided, otherwise use user's location
        let center = initialCenter ?? (lat: userLat, lng: userLng)
        mapView.moveCamera(NMFCameraUpdate(scrollTo: NMGLatLng(lat: center.lat, lng: center.lng)))
        
        mapView.touchDelegate = context.coordinator
        return mapView
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        // Update markers
        context.coordinator.clearMarkers()
        for location in locations {
            let marker = NMFMarker()
            marker.position = NMGLatLng(lat: location.latitude, lng: location.longitude)
            
            // Custom Icon matching Next.js style
            let isSelected = selectedLocation?.id == location.id
            let iconImage = MarkerFactory.createPlaceMarkerImage(title: location.name, isSelected: isSelected)
            marker.iconImage = NMFOverlayImage(image: iconImage)
            marker.anchor = CGPoint(x: 0.5, y: 0.4) // Adjust anchor to keep circle centered
            
            marker.touchHandler = { _ in 
                context.coordinator.onLocationTap(location)
                return true 
            }
            marker.zIndex = isSelected ? 1000 : 100
            marker.mapView = mapView
            context.coordinator.markers.append(marker)
        }
        
        // Center map on target coordinate if set
        if let target = targetCoordinate {
            let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: target.lat, lng: target.lng))
            cameraUpdate.animation = .easeIn
            cameraUpdate.animationDuration = 0.3
            mapView.moveCamera(cameraUpdate)
            
            // Clear target after moving (to allow re-triggering)
            DispatchQueue.main.async {
                self.targetCoordinate = nil
            }
        }
    }
    
    func makeCoordinator() -> Coordinator { Coordinator(onLocationTap: onLocationTap, onMapTap: onMapTap) }
    
    class Coordinator: NSObject, NMFMapViewTouchDelegate {
        var markers: [NMFMarker] = []
        let onLocationTap: (SavedLocation) -> Void
        let onMapTap: (Double, Double) -> Void
        init(onLocationTap: @escaping (SavedLocation) -> Void, onMapTap: @escaping (Double, Double) -> Void) { self.onLocationTap = onLocationTap; self.onMapTap = onMapTap }
        func clearMarkers() { markers.forEach { $0.mapView = nil }; markers.removeAll() }
        func mapView(_ mapView: NMFMapView, didTapMap latlng: NMGLatLng, point: CGPoint) { onMapTap(latlng.lat, latlng.lng) }
    }
}

struct LocationDetailPanel: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    @Environment(\.presentationMode) var presentationMode
    var initialCoordinates: (lat: Double, lng: Double)?
    var initialName: String? = nil
    var initialAddress: String? = nil
    
    @State private var locationName: String = ""
    @State private var locationAddress: String = ""
    @State private var locationLatitude: Double = 37.5665
    @State private var locationLongitude: Double = 126.9780
    @State private var notificationsEnabled: Bool = true
    @State private var showLocationSearch: Bool = false
    @State private var isInitialized: Bool = false
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        NavigationView {
            ScrollView {
                ZStack {
                    if let location = viewModel.selectedLocation, !viewModel.isEditMode { 
                        locationInfoView(location: location)
                            .transition(.asymmetric(insertion: .move(edge: .leading), removal: .move(edge: .leading)))
                    } else { 
                        locationEditView 
                            .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .trailing)))
                    }
                }
                .padding(20)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Text(panelTitle).font(.suite(size: 17, weight: .bold)) }
                ToolbarItem(placement: .navigationBarLeading) { 
                    Button(action: { 
                        viewModel.closeLocationPanel()
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("닫기").font(.suite(size: 16, weight: .medium))
                    }
                    .foregroundColor(brandColor) 
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if viewModel.isEditMode {
                        Button("저장") { saveLocation() }
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(brandColor)
                            .disabled(viewModel.isSaving || locationName.isEmpty || locationAddress.isEmpty)
                    }
                }
            }
        }
        .onAppear { setupInitialValues() }
        .sheet(isPresented: $showLocationSearch) {
            NavigationView {
                LocationSearchView { place in
                    locationName = place.place_name
                    locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                    if let lat = Double(place.y), let lng = Double(place.x) { 
                        locationLatitude = lat
                        locationLongitude = lng 
                    }
                    showLocationSearch = false // Explicitly close and prevent refresh
                }.navigationBarItems(leading: Button(action: { showLocationSearch = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
    }
    
    private var panelTitle: String { viewModel.selectedLocation != nil ? (viewModel.isEditMode ? "장소 편집" : "장소 정보") : "새 장소 등록" }
    
    private func locationInfoView(location: SavedLocation) -> some View {
        VStack(spacing: 24) {
            // Premium Header Section
            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(brandColor.opacity(0.1))
                        .frame(width: 100, height: 100)
                    
                    Circle()
                        .fill(LinearGradient(gradient: Gradient(colors: [brandColor, brandColor.opacity(0.7)]), startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 72, height: 72)
                        .shadow(color: brandColor.opacity(0.3), radius: 10, x: 0, y: 5)
                    
                    Image(systemName: "mappin.and.ellipse")
                        .font(.suite(size: 32, weight: .bold))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 8) {
                    Text(location.name)
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.center)
                    
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.suite(size: 14))
                            .foregroundColor(brandColor)
                        Text(location.address)
                            .font(.suite(size: 15))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
            }
            .padding(.top, 10)
            
            // Info Cards Section
            VStack(spacing: 16) {
                // Coordinate Card
                HStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(brandColor.opacity(0.05))
                            .frame(width: 44, height: 44)
                        Image(systemName: "location.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(brandColor)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("좌표 정보").font(.suite(size: 12, weight: .bold)).foregroundColor(.secondary)
                        Text(String(format: "%.6f, %.6f", location.latitude, location.longitude))
                            .font(.suite(size: 15, weight: .medium))
                            .foregroundColor(.primary)
                    }
                    Spacer()
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
                
                // Notification Card
                HStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(location.notifications ? Color.orange.opacity(0.1) : Color.gray.opacity(0.1))
                            .frame(width: 44, height: 44)
                        Image(systemName: location.notifications ? "bell.fill" : "bell.slash.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(location.notifications ? .orange : .gray)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("알림 상태").font(.suite(size: 12, weight: .bold)).foregroundColor(.secondary)
                        Text(location.notifications ? "도착 알림 활성화됨" : "알림 꺼짐")
                            .font(.suite(size: 15, weight: .semibold))
                            .foregroundColor(location.notifications ? .orange : .secondary)
                    }
                    Spacer()
                    
                    Circle()
                        .fill(location.notifications ? Color.orange : Color.gray.opacity(0.3))
                        .frame(width: 8, height: 8)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            // Actions Section
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Button(action: { viewModel.startEditing() }) {
                        HStack {
                            Image(systemName: "pencil")
                            Text("정보 수정")
                        }
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(brandColor)
                        .cornerRadius(16)
                        .shadow(color: brandColor.opacity(0.2), radius: 8, x: 0, y: 4)
                    }
                    
                    Button(action: { Task { _ = await viewModel.toggleNotification(for: location) } }) {
                        VStack(spacing: 4) {
                            Image(systemName: location.notifications ? "bell.slash.fill" : "bell.fill")
                                .font(.suite(size: 18))
                            Text(location.notifications ? "알림 끄기" : "알림 켜기")
                                .font(.suite(size: 11, weight: .bold))
                        }
                        .foregroundColor(location.notifications ? .orange : .green)
                        .frame(width: 80, height: 56)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    }
                }
                
                Button(action: { Task { let success = await viewModel.deleteLocation(location); if success { presentationMode.wrappedValue.dismiss() } } }) {
                    HStack {
                        Image(systemName: "trash")
                        Text("이 장소 삭제")
                    }
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.red.opacity(0.05))
                    .cornerRadius(16)
                }
            }
            .padding(.top, 8)
            
            Spacer().frame(height: 20)
        }
    }
    
    private var locationEditView: some View {
        VStack(spacing: 24) {
            // Section 1: Target Member Info
            VStack(alignment: .leading, spacing: 12) {
                Label("등록 대상 멤버", systemImage: "person.circle.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(brandColor)
                
                if let member = viewModel.selectedMember {
                    HStack(spacing: 16) {
                        Group {
                            if let url = getProfileImageUrl(member.mt_file1) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .empty:
                                        Circle().fill(Color.gray.opacity(0.1))
                                            .overlay(ProgressView().scaleEffect(0.8))
                                    case .success(let image):
                                        image.resizable().aspectRatio(contentMode: .fill)
                                    case .failure(_):
                                        Image(systemName: "person.fill").resizable().padding(10).foregroundColor(.gray).background(Color.gray.opacity(0.1))
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                            } else {
                                Image(systemName: "person.fill").resizable().padding(10).foregroundColor(.gray).background(Color.gray.opacity(0.1))
                            }
                        }
                        .frame(width: 52, height: 52)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(member.displayName)
                                .font(.suite(size: 18, weight: .bold))
                                .foregroundColor(.primary)
                            Text("이 멤버의 장소로 등록됩니다")
                                .font(.suite(size: 12))
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(16)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
                }
            }
            
            // Section 2: Location Information
            VStack(alignment: .leading, spacing: 12) {
                Label("장소 정보", systemImage: "map.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(brandColor)
                
                VStack(spacing: 16) {
                    // Search Trigger
                    Button(action: { showLocationSearch = true }) {
                        HStack {
                            Image(systemName: "magnifyingglass").foregroundColor(brandColor)
                            Text("주소 검색으로 찾기").font(.suite(size: 15, weight: .medium))
                            Spacer()
                            Image(systemName: "chevron.right").font(.suite(size: 14, weight: .bold)).foregroundColor(.secondary)
                        }
                        .padding(16)
                        .background(brandColor.opacity(0.05))
                        .cornerRadius(12)
                    }
                    
                    // Name Input
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("장소 이름").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*").foregroundColor(.red)
                        }
                        TextField("나만의 장소 이름을 지어주세요", text: $locationName)
                            .font(.suite(size: 16))
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationName.isEmpty ? Color.orange.opacity(0.3) : Color.clear, lineWidth: 1))
                    }
                    
                    // Address Input (Can be filled manually or via search)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("상세 주소").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*").foregroundColor(.red)
                        }
                        TextField("상세 주소를 입력하거나 검색하세요", text: $locationAddress)
                            .font(.suite(size: 15))
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationAddress.isEmpty ? Color.orange.opacity(0.3) : Color.clear, lineWidth: 1))
                    }
                    
                    // Coordinates Display
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("선택된 좌표").font(.suite(size: 12, weight: .semibold)).foregroundColor(.secondary)
                            Text(String(format: "%.6f, %.6f", locationLatitude, locationLongitude))
                                .font(.suite(size: 14))
                                .foregroundColor(brandColor)
                        }
                        Spacer()
                        Image(systemName: "location.viewfinder").foregroundColor(brandColor)
                    }
                    .padding(14)
                    .background(brandColor.opacity(0.03))
                    .cornerRadius(12)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            // Section 3: Notification Settings
            VStack(alignment: .leading, spacing: 12) {
                Label("알림 설정", systemImage: "bell.badge.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(brandColor)
                
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("도착 알람 받기").font(.suite(size: 16, weight: .semibold))
                        Text("선택한 멤버가 이 장소에 도착하면 푸시 알림을 받습니다")
                            .font(.suite(size: 12))
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Toggle("", isOn: $notificationsEnabled).labelsHidden()
                        .tint(brandColor)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            Spacer().frame(height: 32)
        }
    }
    
    private func setupInitialValues() {
        guard !isInitialized else { return } // Prevent overwriting by .onAppear
        
        if let location = viewModel.selectedLocation { 
            locationName = location.name
            locationAddress = location.address
            locationLatitude = location.latitude
            locationLongitude = location.longitude
            notificationsEnabled = location.notifications 
        } else {
            if let name = initialName { locationName = name }
            if let address = initialAddress { locationAddress = address }
            if let coords = initialCoordinates { 
                locationLatitude = coords.lat
                locationLongitude = coords.lng 
            }
            notificationsEnabled = true
        }
        isInitialized = true
    }
    
    private func saveLocation() { Task { let success = await viewModel.saveLocation(title: locationName, address: locationAddress, latitude: locationLatitude, longitude: locationLongitude, notifications: notificationsEnabled); if success { presentationMode.wrappedValue.dismiss() } } }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

// [Consolidated] All Activity Log implementation (Models, Service, ViewModel, and Views) 
// has been moved to specialized files:
// - Models: ActivityLogModels.swift
// - Service: ActivityLogService.swift
// - ViewModel: ActivityLogViewModel.swift
// - Views: ActivityLogView.swift, ActivityLogSidebarView.swift
// 
// MARK: - Group Creation View (Mandatory)

struct GroupCreationView: View {
    @ObservedObject var viewModel: HomeViewModel
    @State private var groupName: String = ""
    @State private var groupDescription: String = ""
    @State private var inviteCode: String = ""
    @State private var isCreating: Bool = false
    @State private var errorMessage: String?
    @State private var selectedTab: Int = 0 // 0 = Create, 1 = Join
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let orangeColor = Color(red: 245/255, green: 158/255, blue: 11/255)
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [Color(white: 0.98), Color.white]),
                startPoint: .top,
                endPoint: .bottom
            )
            .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                // Header Icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [brandColor.opacity(0.1), pinkColor.opacity(0.1)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 120, height: 120)
                    
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [brandColor, pinkColor]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 80, height: 80)
                        .shadow(color: brandColor.opacity(0.3), radius: 16, x: 0, y: 8)
                    
                    Image(systemName: selectedTab == 0 ? "person.3.fill" : "person.badge.plus")
                        .font(.system(size: 32))
                        .foregroundColor(.white)
                }
                .padding(.top, 40)
                .padding(.bottom, 20)
                
                // Title
                Text("그룹 시작하기")
                    .font(.suite(size: 24, weight: .bold))
                    .foregroundColor(.black)
                
                Text("새 그룹을 만들거나 초대코드로 가입하세요")
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                    .padding(.top, 8)
                
                // Tab Selector
                HStack(spacing: 0) {
                    TabButton(text: "그룹 만들기", isSelected: selectedTab == 0) {
                        withAnimation { selectedTab = 0 }
                    }
                    TabButton(text: "초대코드 입력", isSelected: selectedTab == 1) {
                        withAnimation { selectedTab = 1 }
                    }
                }
                .padding(4)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                
                // Form Card
                VStack(spacing: 20) {
                    if selectedTab == 0 {
                        // === Create Group Form ===
                        VStack(alignment: .leading, spacing: 6) {
                            Text("그룹 이름")
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "예: 우리 가족, 회사 동료",
                                text: $groupName,
                                icon: "tag"
                            )
                            .frame(height: 56)
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("그룹 설명 (선택)")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "그룹에 대한 간단한 설명",
                                text: $groupDescription,
                                icon: "doc.text"
                            )
                            .frame(height: 56)
                        }
                    } else {
                        // === Join Group Form ===
                        // 커스텀 바인딩을 사용하여 입력을 즉시 필터링
                        let filteredBinding = Binding<String>(
                            get: { self.inviteCode },
                            set: { newValue in
                                // 대문자로 변환하고 영문 알파벳(A-Z)과 숫자(0-9)만 허용
                                self.inviteCode = newValue.uppercased().filter { char in
                                    char.isASCII && (char.isLetter || char.isNumber)
                                }
                            }
                        )
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("초대 코드")
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.gray)
                            
                            FocusableTextField(
                                placeholder: "초대 코드를 입력하세요",
                                text: filteredBinding,
                                icon: "person.badge.plus",
                                keyboardType: .asciiCapable, // 영문/숫자 키보드 강제
                                autocapitalizationType: .allCharacters
                            )
                            .frame(height: 56)
                            // FocusableTextField 내부에 전달되지 않을 수 있으므로 내부 TextField 수정 필요
                        }
                        
                        Text("그룹 초대 코드를 받으셨나요?\n코드를 입력하면 해당 그룹에 가입됩니다.")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.top, 8)
                    }
                }
                .padding(24)
                .background(Color.white)
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                
                if let error = errorMessage {
                    Text(error)
                        .font(.suite(size: 13))
                        .foregroundColor(.red)
                        .padding(.top, 16)
                        .padding(.horizontal, 24)
                }
                
                Spacer()
                
                // Submit Button
                Button(action: {
                    print("🔘 [GroupCreationView] 버튼 클릭됨 - selectedTab: \(selectedTab), inviteCode: '\(inviteCode)', groupName: '\(groupName)'")
                    HapticManager.shared.impact(style: .medium)
                    if selectedTab == 0 {
                        print("🔘 [GroupCreationView] createGroup() 호출")
                        createGroup()
                    } else {
                        print("🔘 [GroupCreationView] joinGroup() 호출")
                        joinGroup()
                    }
                }) {
                    HStack {
                        if isCreating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .padding(.trailing, 8)
                        }
                        Text(selectedTab == 0 ? "그룹 만들기" : "그룹 가입하기")
                            .font(.suite(size: 16, weight: .bold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(
                        (selectedTab == 0 && groupName.isEmpty) || (selectedTab == 1 && inviteCode.isEmpty)
                            ? Color.gray.opacity(0.3)
                            : (selectedTab == 0 ? brandColor : orangeColor)
                    )
                    .cornerRadius(12)
                    .shadow(color: (selectedTab == 0 ? brandColor : orangeColor).opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .disabled((selectedTab == 0 && groupName.isEmpty) || (selectedTab == 1 && inviteCode.isEmpty) || isCreating)
                .padding(.horizontal, 24)
                
                // Tip
                HStack(spacing: 8) {
                    Text("💡")
                        .font(.system(size: 16))
                    Text(selectedTab == 0
                        ? "그룹을 만들면 멤버들을 초대할 수 있는 코드가 생성됩니다"
                        : "초대 코드는 그룹 관리자에게 받을 수 있습니다")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(selectedTab == 0 ? Color.yellow.opacity(0.1) : Color.orange.opacity(0.1))
                .cornerRadius(12)
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
        }
    }
    
    // Tab Button Component
    @ViewBuilder
    private func TabButton(text: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.suite(size: 14, weight: isSelected ? .bold : .medium))
                .foregroundColor(isSelected ? brandColor : .gray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(isSelected ? Color.white : Color.clear)
                .cornerRadius(10)
        }
    }
    
    private func createGroup() {
        guard !groupName.isEmpty else { return }
        
        isCreating = true
        errorMessage = nil
        
        Task {
            do {
                let _ = try await GroupService.shared.createGroup(title: groupName, memo: groupDescription)
                await viewModel.fetchInitialData()
                
                DispatchQueue.main.async {
                    viewModel.showGroupCreationModal = false
                    isCreating = false
                }
            } catch {
                DispatchQueue.main.async {
                    isCreating = false
                    if let apiError = error as? APIError {
                        errorMessage = apiError.message ?? "그룹 생성에 실패했습니다."
                    } else {
                        errorMessage = "알 수 없는 오류가 발생했습니다."
                    }
                }
            }
        }
    }
    
    private func joinGroup() {
        print("🔵 [GroupCreationView.joinGroup] 함수 호출됨 - inviteCode: '\(inviteCode)'")
        
        guard !inviteCode.isEmpty else {
            print("🔴 [GroupCreationView.joinGroup] 초대코드가 비어있음 - 종료")
            return
        }
        
        print("🟢 [GroupCreationView.joinGroup] 초대코드 확인됨 - 가입 시작")
        isCreating = true
        errorMessage = nil
        
        Task {
            do {
                // 사용자 정보 확인
                let currentUser = AuthService.shared.currentUser
                print("🟡 [GroupCreationView.joinGroup] currentUser: \(String(describing: currentUser))")
                print("🟡 [GroupCreationView.joinGroup] mt_idx: \(String(describing: currentUser?.mt_idx))")
                print("🟡 [GroupCreationView.joinGroup] token: \(AuthService.shared.getToken()?.prefix(20) ?? "nil")...")
                
                print("🟡 [GroupCreationView.joinGroup] GroupService.joinGroup 호출 시작")
                let success = try await GroupService.shared.joinGroup(inviteCode: inviteCode)
                print("🟡 [GroupCreationView.joinGroup] GroupService.joinGroup 결과: \(success)")
                
                if success {
                    print("✅ [GroupCreationView.joinGroup] 가입 성공 - 데이터 갱신 시작")
                    await viewModel.fetchInitialData()
                    
                    await MainActor.run {
                        viewModel.showGroupCreationModal = false
                        isCreating = false
                        print("✅ [GroupCreationView.joinGroup] 모달 닫기 완료")
                    }
                } else {
                    print("❌ [GroupCreationView.joinGroup] 가입 실패 (success=false)")
                    await MainActor.run {
                        isCreating = false
                        errorMessage = "그룹 가입에 실패했습니다. 초대 코드를 확인해주세요."
                    }
                }
            } catch {
                print("❌ [GroupCreationView.joinGroup] 에러 발생: \(error)")
                await MainActor.run {
                    isCreating = false
                    if let apiError = error as? APIError {
                        errorMessage = apiError.message ?? "그룹 가입에 실패했습니다."
                        print("❌ [GroupCreationView.joinGroup] API 에러 메시지: \(apiError.message ?? "nil")")
                    } else {
                        errorMessage = "알 수 없는 오류가 발생했습니다: \(error.localizedDescription)"
                        print("❌ [GroupCreationView.joinGroup] 일반 에러: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
}

// MARK: - Haptic Feedback Manager

struct HapticManager {
    static let shared = HapticManager()
    
    private init() {}
    
    /// 가벼운 충격 (버튼 탭, 리프레시 등)
    func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
    
    /// 알림 유형 (성공, 경고, 에러)
    func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }
    
    /// 선택 변경 (피커, 리스트 선택 등)
    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }
}


// MARK: - ActivityLog Implementation (Consolidated)
// MARK: - Location Log Models

/// 개별 위치 로그 데이터
struct LocationLog: Codable, Identifiable {
    let mlt_idx: Int
    let mt_idx: Int
    let mlt_gps_time: String?
    let mlt_speed: Double?
    let mlt_lat: Double?
    let mlt_long: Double?
    let mlt_accuacy: Double?
    let mt_health_work: Int?
    let mlt_battery: Int?
    let mlt_fine_location: String?
    let mlt_location_chk: String?
    let mlt_wdate: String?
    
    var id: Int { mlt_idx }
    
    var latitude: Double { mlt_lat ?? 0 }
    var longitude: Double { mlt_long ?? 0 }
    var timestamp: Date? {
        guard let timeStr = mlt_gps_time else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: timeStr) ?? DateFormatter.apiDateFormatter.date(from: timeStr)
    }
}

/// 위치 요약 데이터
struct LocationSummary: Codable {
    let schedule_count: String?
    let distance: String?
    let duration: String?
    let steps: Int?
    
    var formattedDistance: String {
        distance ?? "0 km"
    }
    
    var formattedDuration: String {
        duration ?? "0분"
    }
    
    var formattedSteps: String {
        if let s = steps {
            return "\(s) 걸음"
        }
        return "0 걸음"
    }
}

/// 지도 마커 데이터
struct MapMarker: Codable, Identifiable {
    let mlt_idx: Int?
    let mt_idx: Int?
    let mlt_gps_time: String?
    let mlt_speed: Double?
    let mlt_lat: Double?
    let mlt_long: Double?
    let mlt_accuacy: Double?
    let mt_health_work: Int?
    let mlt_battery: Int?
    let mlt_fine_location: String?
    let mlt_location_chk: String?
    let mlt_wdate: String?
    let stay_lat: Double?
    let stay_long: Double?
    
    var id: Int { mlt_idx ?? 0 }
    var latitude: Double { mlt_lat ?? stay_lat ?? 0 }
    var longitude: Double { mlt_long ?? stay_long ?? 0 }
    var speed: Double { mlt_speed ?? 0 }
    var accuracy: Double { mlt_accuacy ?? 0 }
    var batteryLevel: Int { mlt_battery ?? 0 }
    
    var timestamp: Date? {
        guard let timeStr = mlt_gps_time else { return nil }
        return DateFormatter.apiDateFormatter.date(from: timeStr)
    }
    
    var formattedTime: String {
        guard let timeStr = mlt_gps_time else { return "" }
        // "2025-01-01 12:30:45" 형식에서 시간만 추출
        let components = timeStr.split(separator: " ")
        if components.count >= 2 {
            let timePart = String(components[1])
            let timeComponents = timePart.split(separator: ":")
            if timeComponents.count >= 2 {
                return "\(timeComponents[0]):\(timeComponents[1])"
            }
        }
        return timeStr
    }
}

/// 체류 시간 분석 데이터
struct StayTime: Codable, Identifiable {
    let label: String?
    let grp: Int?
    let start_time: String
    let end_time: String
    let duration: Double
    let distance: Double?
    let start_lat: Double?
    let start_long: Double?
    let location: String?
    let latitude: Double?
    let longitude: Double?
    let stay_duration: String?
    let point_count: Int?
    
    var id: String { "\(grp ?? 0)_\(start_time)" }
    
    var stayLatitude: Double { latitude ?? start_lat ?? 0 }
    var stayLongitude: Double { longitude ?? start_long ?? 0 }
    
    var formattedDuration: String {
        if let sd = stay_duration {
            return sd
        }
        let durationInt = Int(duration)
        let hours = durationInt / 60
        let minutes = durationInt % 60
        if hours > 0 {
            return "\(hours)시간 \(minutes)분"
        }
        return "\(minutes)분"
    }
}

// MARK: - Daily Counts Models

/// 일별 활동 카운트
struct DailyCount: Codable, Identifiable {
    let date: String
    let count: Int
    let formatted_date: String
    let day_of_week: String
    let is_today: Bool
    let is_weekend: Bool
    
    var id: String { date }
    
    var hasActivity: Bool { count > 0 }
}

/// 멤버별 일별 카운트
struct MemberDailyCount: Codable, Identifiable {
    let member_id: Int
    let member_name: String
    let mt_nickname: String? // Added for nickname support
    let member_photo: String?
    let member_gender: Int?
    let daily_counts: [DailyCount]
    
    var id: Int { member_id }
    
    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return member_name
    }
    
    /// 14일간 활동 여부 배열 (오래된 날짜 -> 최근 날짜 순)
    var activityDistribution: [Bool] {
        // 최근 14일 날짜 생성
        let calendar = Calendar.current
        let today = Date()
        var distribution = [Bool](repeating: false, count: 14)
        
        for i in 0..<14 {
            if let date = calendar.date(byAdding: .day, value: -(13 - i), to: today) {
                let dateString = DateFormatter.apiDateOnlyFormatter.string(from: date)
                if let dayCount = daily_counts.first(where: { $0.date == dateString }) {
                    distribution[i] = dayCount.count > 0
                }
            }
        }
        
        return distribution
    }
    
    /// 활동이 있는 총 일수
    var activeDaysCount: Int {
        activityDistribution.filter { $0 }.count
    }
}

/// 일별 카운트 API 응답
struct DailyCountsResponse: Codable {
    let member_daily_counts: [MemberDailyCount]
    let total_daily_counts: [DailyCount]?
    let total_days: Int
    let start_date: String
    let end_date: String
    let group_id: Int
    let total_members: Int
}

// MARK: - Member Activity Models

/// 멤버 활동 데이터
struct MemberActivity: Codable, Identifiable {
    let member_id: Int
    let member_name: String
    let mt_nickname: String? // Added for nickname support
    let member_photo: String?
    let member_gender: Int?
    let log_count: Int
    let first_log_time: String?
    let last_log_time: String?
    let is_active: Bool
    
    var id: Int { member_id }
    
    var displayName: String {
        if let nick = mt_nickname, !nick.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nick
        }
        return member_name
    }
}

/// 멤버 활동 응답
struct MemberActivityResponse: Codable {
    let member_activities: [MemberActivity]
    let date: String
    let group_id: Int
    let total_members: Int
    let active_members: Int
}

// MARK: - API Response Wrapper

struct ActivityLogAPIResponse<T: Codable>: Codable {
    let result: String
    let data: T?
    let total_days: Int?
    let total_stays: Int?
    let total_markers: Int?
    let message: String?
    
    var isSuccess: Bool { result == "Y" }
}

// MARK: - DateFormatter Extensions

extension DateFormatter {
    static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()
    
    static let apiDateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()
    
    static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM월 dd일 (E)"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()
    
    static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM.dd"
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()
}


class ActivityLogService {
    static let shared = ActivityLogService()
    
    private let baseURL: String
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        self.baseURL = "https://api3.smap.site/api/v1"
    }
    
    // MARK: - Private Helpers
    
    private func getAuthToken() -> String? {
        return AuthService.shared.getToken()
    }
    
    private func createRequest(url: URL, method: String = "GET") -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = getAuthToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
    
    // MARK: - API Methods
    
    /// 최근 N일간 그룹 멤버들의 일별 위치 기록 카운트 조회
    func getDailyLocationCounts(groupId: Int, days: Int = 14) async throws -> DailyCountsResponse {
        guard let url = URL(string: "\(baseURL)/logs/daily-counts?group_id=\(groupId)&days=\(days)") else {
            throw URLError(.badURL)
        }
        
        let request = createRequest(url: url)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getDailyLocationCounts failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(DailyCountsResponse.self, from: data)
    }
    
    /// 특정 회원의 특정 날짜 지도 마커 데이터 조회
    func getMapMarkers(memberId: Int, date: String, minSpeed: Double = 1.0, maxAccuracy: Double = 50.0) async throws -> [MapMarker] {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/map-markers?date=\(date)&min_speed=\(minSpeed)&max_accuracy=\(maxAccuracy)") else {
            throw URLError(.badURL)
        }
        
        let request = createRequest(url: url)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getMapMarkers failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<[MapMarker]>.self, from: data)
        
        return apiResponse.data ?? []
    }
    
    /// 특정 회원의 특정 날짜 체류시간 분석 조회
    func getStayTimes(memberId: Int, date: String, minSpeed: Double = 1.0, maxAccuracy: Double = 50.0, minDuration: Int = 5) async throws -> [StayTime] {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/stay-times?date=\(date)&min_speed=\(minSpeed)&max_accuracy=\(maxAccuracy)&min_duration=\(minDuration)") else {
            throw URLError(.badURL)
        }
        
        let request = createRequest(url: url)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getStayTimes failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<[StayTime]>.self, from: data)
        
        return apiResponse.data ?? []
    }
    
    /// 위치 로그 요약 정보 조회 (PHP 로직 기반)
    func getLocationLogSummary(memberId: Int, date: String) async throws -> LocationSummary? {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/summary?date=\(date)") else {
            throw URLError(.badURL)
        }
        
        let request = createRequest(url: url) // GET Request
        // Body removal as we switched to GET
        // request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getLocationLogSummary failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<LocationSummary>.self, from: data)
        
        return apiResponse.data
    }
    
    /// 특정 날짜의 그룹 멤버별 위치 기록 활동 조회
    func getMemberActivityByDate(groupId: Int, date: String) async throws -> MemberActivityResponse? {
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        guard let url = URL(string: "\(baseURL)/logs/member-activity?group_id=\(groupId)&date=\(date)&_t=\(timestamp)") else {
            throw URLError(.badURL)
        }
        
        let request = createRequest(url: url)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            print("[ActivityLogService] getMemberActivityByDate failed with status: \(httpResponse.statusCode)")
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let apiResponse = try decoder.decode(ActivityLogAPIResponse<MemberActivityResponse>.self, from: data)
        
        return apiResponse.data
    }
    
    // MARK: - Combine Publishers (Alternative)
    
    func getDailyLocationCountsPublisher(groupId: Int, days: Int = 14) -> AnyPublisher<DailyCountsResponse, Error> {
        guard let url = URL(string: "\(baseURL)/logs/daily-counts?group_id=\(groupId)&days=\(days)") else {
            return Fail(error: URLError(.badURL)).eraseToAnyPublisher()
        }
        
        let request = createRequest(url: url)
        
        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: DailyCountsResponse.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    func getMapMarkersPublisher(memberId: Int, date: String) -> AnyPublisher<[MapMarker], Error> {
        guard let url = URL(string: "\(baseURL)/logs/member-location-logs/\(memberId)/map-markers?date=\(date)&min_speed=1.0&max_accuracy=50.0") else {
            return Fail(error: URLError(.badURL)).eraseToAnyPublisher()
        }
        
        let request = createRequest(url: url)
        
        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: ActivityLogAPIResponse<[MapMarker]>.self, decoder: JSONDecoder())
            .map { $0.data ?? [] }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
}



@MainActor
class ActivityLogViewModel: ObservableObject {
    // MARK: - Published Properties
    
    // Loading States
    @Published var isLoading = false
    @Published var isMapLoading = false
    @Published var isDailyCountsLoading = false
    @Published var isMarkersLoading = false
    @Published var isGroupsLoading = false
    
    // Error State
    @Published var errorMessage: String?
    @Published var showError = false
    
    // Groups
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    
    // Selection States
    @Published var selectedGroupId: Int?
    @Published var selectedMemberId: Int?
    @Published var selectedDate: String
    
    // Data
    @Published var dailyCountsResponse: DailyCountsResponse?
    @Published var memberDailyCounts: [MemberDailyCount] = []
    @Published var mapMarkers: [MapMarker] = []
    @Published var stayTimes: [StayTime] = []
    @Published var locationSummary: LocationSummary?
    
    // UI States
    @Published var isSidebarOpen = false
    @Published var sliderValue: Double = 0
    @Published var isSliderDragging = false
    
    // MARK: - Computed Properties
    
    /// 현재 선택된 멤버의 일별 카운트 데이터
    var selectedMemberDailyCount: MemberDailyCount? {
        guard let memberId = selectedMemberId else { return nil }
        return memberDailyCounts.first { $0.member_id == memberId }
    }
    
    /// 정렬된 맵 마커 (시간순)
    var sortedMapMarkers: [MapMarker] {
        mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
    }
    
    /// 슬라이더 현재 위치의 마커
    var currentMarkerAtSlider: MapMarker? {
        guard !sortedMapMarkers.isEmpty else { return nil }
        let index = Int(Double(sortedMapMarkers.count - 1) * sliderValue / 100.0)
        let clampedIndex = max(0, min(index, sortedMapMarkers.count - 1))
        return sortedMapMarkers[clampedIndex]
    }
    
    /// 위치 요약 - 거리
    var formattedDistance: String {
        locationSummary?.formattedDistance ?? "0 km"
    }
    
    /// 위치 요약 - 시간
    var formattedDuration: String {
        locationSummary?.formattedDuration ?? "0분"
    }
    
    /// 위치 요약 - 걸음수
    var formattedSteps: String {
        locationSummary?.formattedSteps ?? "0 걸음"
    }
    
    /// 선택된 날짜의 표시 형식
    var displayDate: String {
        if let date = DateFormatter.apiDateOnlyFormatter.date(from: selectedDate) {
            return DateFormatter.displayDateFormatter.string(from: date)
        }
        return selectedDate
    }
    
    /// 최근 14일 날짜 목록
    var recentDays: [(date: String, displayDate: String, dayOfWeek: String, isToday: Bool, isWeekend: Bool)] {
        let calendar = Calendar.current
        let today = Date()
        var days: [(String, String, String, Bool, Bool)] = []
        
        for i in 0..<14 {
            if let date = calendar.date(byAdding: .day, value: -(13 - i), to: today) {
                let dateString = DateFormatter.apiDateOnlyFormatter.string(from: date)
                let displayString = DateFormatter.shortDateFormatter.string(from: date)
                let weekday = calendar.component(.weekday, from: date)
                let dayNames = ["S", "M", "T", "W", "T", "F", "S"]
                let dayOfWeek = dayNames[weekday - 1]
                let isToday = calendar.isDateInToday(date)
                let isWeekend = weekday == 1 || weekday == 7
                
                days.append((dateString, displayString, dayOfWeek, isToday, isWeekend))
            }
        }
        
        return days
    }
    
    // MARK: - Private Properties
    
    private let service = ActivityLogService.shared
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    init() {
        // 기본값으로 오늘 날짜 설정
        self.selectedDate = DateFormatter.apiDateOnlyFormatter.string(from: Date())
    }
    
    // MARK: - Public Methods
    
    /// 그룹 선택 시 호출
    func selectGroup(_ groupId: Int) async {
        guard selectedGroupId != groupId else { return }
        
        print("[ActivityLogViewModel] 그룹 선택: \(groupId)")
        selectedGroupId = groupId
        selectedMemberId = nil
        
        // 일별 카운트 데이터 로드
        await loadDailyLocationCounts()
    }
    
    /// 멤버 선택 시 호출
    func selectMember(_ memberId: Int) async {
        guard selectedMemberId != memberId else { return }
        
        print("[ActivityLogViewModel] 멤버 선택: \(memberId)")
        selectedMemberId = memberId
        
        // 해당 멤버의 위치 데이터 로드
        await loadMemberLocationData()
    }
    
    /// 날짜 선택 시 호출
    func selectDate(_ date: String) async {
        guard selectedDate != date else { return }
        
        print("[ActivityLogViewModel] 날짜 선택: \(date)")
        selectedDate = date
        
        // 선택된 멤버가 있으면 해당 날짜의 데이터 로드
        if selectedMemberId != nil {
            await loadMemberLocationData()
        }
    }
    
    /// 캘린더 셀 클릭 시 호출 (멤버 + 날짜 동시 변경)
    func selectMemberAndDate(memberId: Int, date: String) async {
        print("[ActivityLogViewModel] 멤버+날짜 선택: \(memberId), \(date)")
        selectedMemberId = memberId
        selectedDate = date
        
        await loadMemberLocationData()
    }
    
    /// 사이드바 토글
    func toggleSidebar() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isSidebarOpen.toggle()
        }
    }
    
    /// 사이드바 닫기
    func closeSidebar() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isSidebarOpen = false
        }
    }
    
    /// 슬라이더 값 업데이트
    func updateSliderValue(_ value: Double) {
        sliderValue = max(0, min(100, value))
    }
    
    /// 초기 데이터 로드 (뷰 진입 시 호출)
    func loadInitialData() async {
        print("[ActivityLogViewModel] 초기 데이터 로드 시작")
        isLoading = true
        
        // 1. 그룹 목록 먼저 로드
        await fetchGroups()
        
        // 2. 첫 번째 그룹 자동 선택
        if let firstGroup = groups.first {
            print("[ActivityLogViewModel] 첫 번째 그룹 자동 선택: \(firstGroup.sgt_title ?? "N/A")")
            selectedGroup = firstGroup
            selectedGroupId = firstGroup.sgt_idx
            
            // 3. 해당 그룹의 일별 카운트 로드
            await loadDailyLocationCounts()
        }
        
        isLoading = false
    }
    
    /// 그룹 목록 가져오기
    private func fetchGroups() async {
        isGroupsLoading = true
        
        do {
            let fetchedGroups = try await HomeService.shared.getMyGroups()
            groups = fetchedGroups
            print("[ActivityLogViewModel] 그룹 목록 로드 완료: \(fetchedGroups.count)개")
        } catch {
            print("[ActivityLogViewModel] 그룹 목록 로드 실패: \(error)")
            errorMessage = "그룹 목록을 불러오는데 실패했습니다."
            showError = true
        }
        
        isGroupsLoading = false
    }
    
    /// 그룹 선택 핸들러
    func selectGroupFromSidebar(_ group: SmapGroup) async {
        guard selectedGroupId != group.sgt_idx else { return }
        
        print("[ActivityLogViewModel] 그룹 변경: \(group.sgt_title ?? "N/A")")
        selectedGroup = group
        selectedGroupId = group.sgt_idx
        selectedMemberId = nil
        
        await loadDailyLocationCounts()
    }
    
    // MARK: - Private Methods
    
    /// 일별 위치 카운트 로드
    private func loadDailyLocationCounts() async {
        guard let groupId = selectedGroupId else { return }
        
        isDailyCountsLoading = true
        errorMessage = nil
        
        do {
            print("[ActivityLogViewModel] 일별 카운트 로드 시작: groupId=\(groupId)")
            let response = try await service.getDailyLocationCounts(groupId: groupId, days: 14)
            
            dailyCountsResponse = response
            memberDailyCounts = response.member_daily_counts
            
            print("[ActivityLogViewModel] 일별 카운트 로드 완료: \(memberDailyCounts.count)명")
            
            // 첫 번째 멤버 자동 선택
            if selectedMemberId == nil, let firstMember = memberDailyCounts.first {
                await selectMember(firstMember.member_id)
            }
            
        } catch {
            print("[ActivityLogViewModel] 일별 카운트 로드 실패: \(error)")
            errorMessage = "활동 데이터를 불러오는데 실패했습니다."
            showError = true
        }
        
        isDailyCountsLoading = false
    }
    
    /// 선택된 멤버의 위치 데이터 로드
    private func loadMemberLocationData() async {
        guard let memberId = selectedMemberId else { return }
        
        isMarkersLoading = true
        isLoading = true
        errorMessage = nil
        
        // 기존 데이터 초기화
        mapMarkers = []
        stayTimes = []
        locationSummary = nil
        sliderValue = 0
        
        do {
            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 시작: memberId=\(memberId), date=\(selectedDate)")
            
            // 병렬로 API 호출
            async let markersTask = service.getMapMarkers(memberId: memberId, date: selectedDate)
            async let stayTimesTask = service.getStayTimes(memberId: memberId, date: selectedDate)
            async let summaryTask = service.getLocationLogSummary(memberId: memberId, date: selectedDate)
            
            let (markers, stays, summary) = try await (markersTask, stayTimesTask, summaryTask)
            
            mapMarkers = markers
            stayTimes = stays
            locationSummary = summary
            
            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 완료: 마커=\(markers.count), 체류=\(stays.count)")
            
            // 사이드바 자동 닫기 (데이터 로드 후)
            if isSidebarOpen {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.closeSidebar()
                }
            }
            
        } catch {
            print("[ActivityLogViewModel] 멤버 위치 데이터 로드 실패: \(error)")
            errorMessage = "위치 데이터를 불러오는데 실패했습니다."
            showError = true
        }
        
        isMarkersLoading = false
        isLoading = false
    }
    
    /// 특정 날짜에 해당 멤버의 활동이 있는지 확인
    func hasActivityForMember(_ memberId: Int, on date: String) -> Bool {
        guard let memberCount = memberDailyCounts.first(where: { $0.member_id == memberId }) else {
            return false
        }
        
        return memberCount.daily_counts.first(where: { $0.date == date })?.count ?? 0 > 0
    }
    
    /// 14일 인덱스에서 날짜 문자열 반환
    func dateStringForIndex(_ index: Int) -> String {
        let calendar = Calendar.current
        let today = Date()
        let offset = 13 - index // 0 = 13일전, 13 = 오늘
        
        if let date = calendar.date(byAdding: .day, value: -offset, to: today) {
            return DateFormatter.apiDateOnlyFormatter.string(from: date)
        }
        
        return selectedDate
    }
    
    /// 날짜가 선택된 날짜와 같은지 확인
    func isDateSelected(_ date: String) -> Bool {
        return date == selectedDate
    }
    
    /// 날짜가 오늘인지 확인
    func isToday(_ date: String) -> Bool {
        let today = DateFormatter.apiDateOnlyFormatter.string(from: Date())
        return date == today
    }
}



struct ActivityLogSidebarView: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    
    @State private var isGroupSelectorOpen = false
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            sidebarHeader
                .padding(.top, 20)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector
                    groupSelectorSection
                    
                    // Member List
                    memberListSection
                }
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .edgesIgnoringSafeArea(.all)
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
    
    // MARK: - Header
    
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(brandColor)
                    .frame(width: 40, height: 40)
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("로그 조회")
                    .font(.suite(size: 20, weight: .bold))
                Text("멤버를 선택해보세요")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                viewModel.closeSidebar()
            }) {
                Image(systemName: "xmark")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.6))
                    .clipShape(Circle())
            }
        }
    }
    
    // MARK: - Group Selector
    
    private var groupSelectorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Text("그룹 목록")
                    .font(.suite(size: 16, weight: .bold))
            }
            
            Menu {
                ForEach(viewModel.groups) { group in
                    Button(group.sgt_title ?? "이름 없음") {
                        Task {
                            await viewModel.selectGroupFromSidebar(group)
                        }
                    }
                }
            } label: {
                HStack {
                    Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                        .font(.suite(size: 17))
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
    }
    
    // MARK: - Member List
    
    private var memberListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(Color.green).frame(width: 8, height: 8)
                Text("멤버 목록")
                    .font(.suite(size: 16, weight: .bold))
                Spacer()
                Text("\(viewModel.memberDailyCounts.count)명")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.secondary.opacity(0.1)))
            }
            
            if viewModel.isDailyCountsLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if viewModel.memberDailyCounts.isEmpty {
                emptyMemberView
            } else {
                VStack(spacing: 8) {
                    ForEach(viewModel.memberDailyCounts) { member in
                        ActivityLogMemberCell(
                            member: member,
                            isSelected: viewModel.selectedMemberId == member.member_id,
                            selectedDate: viewModel.selectedDate,
                            onMemberTap: {
                                Task {
                                    await viewModel.selectMember(member.member_id)
                                }
                            },
                            onDateTap: { dateString in
                                Task {
                                    await viewModel.selectMemberAndDate(memberId: member.member_id, date: dateString)
                                }
                            }
                        )
                    }
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
    }
    
    private var emptyMemberView: some View {
        VStack(spacing: 12) {
            Circle()
                .fill(Color.gray.opacity(0.1))
                .frame(width: 48, height: 48)
                .overlay(
                    Image(systemName: "person.fill")
                        .foregroundColor(.gray)
                )
            
            Text("그룹 멤버가 없습니다")
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.gray)
            
            Text("그룹을 선택하거나 멤버를 초대해보세요")
                .font(.suite(size: 14))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

// MARK: - Member Cell with Calendar

struct ActivityLogMemberCell: View {
    let member: MemberDailyCount
    let isSelected: Bool
    let selectedDate: String
    let onMemberTap: () -> Void
    let onDateTap: (String) -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: onMemberTap) {
            HStack(spacing: 16) {
                // Left: Avatar + Nickname
                VStack(spacing: 8) {
                    // Avatar
                    ZStack {
                        Group {
                            if let url = getProfileImageUrl(member.member_photo) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(isSelected ? brandColor : Color.gray.opacity(0.1), lineWidth: isSelected ? 3 : 1)
                        )
                    } // End ZStack
                    
                    // Display Name (Nickname below Avatar)
                    Text(member.displayName)
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                        .frame(width: 60) // Limit text width to align with avatar column
                }
                
                // Right: 14-Day Calendar
                calendarView
            }
            .padding(12)
            .background(isSelected ? brandColor.opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Calendar View
    
    private var calendarView: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header
            HStack {
                Text("2주간 활동")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(member.activeDaysCount)/14일")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
            }
            
            // Day of Week Headers
            HStack(spacing: 6) {
                ForEach(0..<7) { index in
                    let dayInfo = getDayInfo(for: 13 - index)
                    
                    Text(dayInfo.dayOfWeek)
                        .font(.suite(size: 11, weight: .bold))
                        .foregroundColor(dayInfo.isWeekend ? (dayInfo.isSunday ? .red : .blue) : .gray)
                        .frame(width: 16)
                        .background(dayInfo.isWeekend ? (dayInfo.isSunday ? Color.red.opacity(0.1) : Color.blue.opacity(0.1)) : Color.gray.opacity(0.05))
                        .cornerRadius(2)
                }
            }
            
            // First Row (7 days ago to 13 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = col  // 0-6: 13일전 ~ 7일전
                    let offset = 13 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Second Row (Today to 6 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = 7 + col  // 7-13: 6일전 ~ 오늘
                    let offset = 6 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Footer
            HStack {
                Text("1주전")
                    .font(.suite(size: 12))
                    .foregroundColor(.secondary)
                Spacer()
                Text("오늘")
                    .font(.suite(size: 12, weight: .semibold))
                    .foregroundColor(indigoColor)
            }
        }
        .padding(8)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
    
    // MARK: - Helpers
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
    
    private func getDateString(daysAgo: Int) -> String {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            return DateFormatter.apiDateOnlyFormatter.string(from: date)
        }
        return ""
    }
    
    private func getDayInfo(for daysAgo: Int) -> (dayOfWeek: String, isWeekend: Bool, isSunday: Bool) {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            let weekday = calendar.component(.weekday, from: date)
            let dayNames = ["S", "M", "T", "W", "T", "F", "S"]
            let dayOfWeek = dayNames[weekday - 1]
            let isWeekend = weekday == 1 || weekday == 7
            let isSunday = weekday == 1
            return (dayOfWeek, isWeekend, isSunday)
        }
        return ("", false, false)
    }
}

// MARK: - Calendar Day Cell

struct CalendarDayCell: View {
    let hasActivity: Bool
    let isSelected: Bool
    let isToday: Bool
    let onTap: (() -> Void)?
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: {
            onTap?()
        }) {
            ZStack {
                if isSelected {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [pinkColor, Color(red: 244/255, green: 63/255, blue: 94/255)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(pinkColor.opacity(0.6), lineWidth: 1)
                        )
                        .shadow(color: pinkColor.opacity(0.3), radius: 2)
                } else if hasActivity {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(indigoColor.opacity(0.8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(indigoColor.opacity(0.3), lineWidth: 0.5)
                        )
                } else {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 0.5)
                        )
                }
                
                if isToday {
                    Text("●")
                        .font(.suite(size: 8))
                        .foregroundColor(isSelected || hasActivity ? .white : .gray)
                }
            }
            .frame(width: 16, height: 16)
            .overlay(
                isToday ?
                RoundedRectangle(cornerRadius: 4)
                    .stroke(indigoColor, lineWidth: 1.5)
                : nil
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(onTap == nil)
    }
}



// MARK: - Preview

struct ActivityLogSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogSidebarView(viewModel: ActivityLogViewModel())
    }
}


// MARK: - ActivityLog Main View

struct ActivityLogView: View {
    @StateObject private var viewModel = ActivityLogViewModel()
    
    @State private var sidebarDragOffset: CGFloat = 0
    @State private var isMapLoading = true  // 지도 로딩 상태
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let sidebarWidth: CGFloat = 320
    
    var body: some View {
        ZStack(alignment: .leading) {
            // 1. Map Layer
            ActivityLogMapView(
                mapMarkers: viewModel.mapMarkers,
                stayTimes: viewModel.stayTimes,
                sliderValue: viewModel.sliderValue,
                isSliderDragging: viewModel.isSliderDragging
            )
            .edgesIgnoringSafeArea(.all)
            .offset(y: 60)
            
            // 2. Header
            VStack {
                ActivityLogHeaderView()
                Spacer()
            }
            
            // 3. Floating Info Card
            if viewModel.selectedMemberId != nil {
                VStack {
                    ActivityLogFloatingCard(
                        memberName: selectedMemberName,
                        memberPhoto: selectedMemberPhoto,
                        displayDate: viewModel.displayDate,
                        distance: viewModel.formattedDistance,
                        duration: viewModel.formattedDuration,
                        steps: viewModel.formattedSteps,
                        isLoading: viewModel.isLoading,
                        onTap: {
                            viewModel.toggleSidebar()
                        }
                    )
                    .padding(.horizontal, 20)
                    .padding(.top, 76)
                    
                    Spacer()
                }
            }
            
            // 4. Path Slider (Bottom Left)
            if !viewModel.sortedMapMarkers.isEmpty {
                VStack {
                    Spacer()
                    HStack {
                        PathSliderView(
                            sliderValue: $viewModel.sliderValue,
                            isSliderDragging: $viewModel.isSliderDragging
                        )
                        .padding(.leading, 16)
                        .padding(.bottom, 20) // adjusted from 90 to 20 to match LoginView version
                        
                        Spacer()
                    }
                }
            }
            
            // 5. Sidebar Overlay
            if viewModel.isSidebarOpen || sidebarDragOffset > 0 {
                Color.black.opacity(overlayOpacity)
                    .edgesIgnoringSafeArea(.all)
                    .onTapGesture {
                        viewModel.closeSidebar()
                    }
                    .transition(.opacity)
            }
            
            // 6. Sidebar
            ActivityLogSidebarView(viewModel: viewModel)
                .frame(width: sidebarWidth)
                .offset(x: sidebarOffset)
                .gesture(sidebarDragGesture)
                .zIndex(100)
            
            // 7. Edge Swipe Detection
            if !viewModel.isSidebarOpen {
                Color.clear
                    .frame(width: 20)
                    .contentShape(Rectangle())
                    .gesture(edgeSwipeGesture)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 8. FAB
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    FloatingActionLogButton(count: viewModel.memberDailyCounts.count) {
                        viewModel.toggleSidebar()
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
            
            // 9. Loading Overlay
            if isMapLoading {
                MapLoadingOverlay()
                    .transition(AnyTransition.opacity)
                    .zIndex(1000)
            }
        }
        .onAppear {
            handleLoading()
        }
        .navigationBarHidden(true)
        .task {
            // 초기 데이터 로드 (그룹 목록 + 첫 그룹 선택 + 일별 카운트)
            await viewModel.loadInitialData()
        }
        .alert(isPresented: $viewModel.showError) {
            Alert(
                title: Text("오류"),
                message: Text(viewModel.errorMessage ?? "알 수 없는 오류가 발생했습니다."),
                dismissButton: .default(Text("확인"))
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("closeSidebars"))) { notification in
            // 탭 전환 시 사이드바를 닫기
            viewModel.closeSidebar()
            
            // 본인 탭(활동 로그 = 4)으로 전환될 때만 로딩 화면을 다시 표시
            if let targetTab = notification.object as? Int, targetTab == 4 {
                isMapLoading = true
                handleLoading()
            }
        }
        .onDisappear {
            // 페이지를 벗어날 때 사이드바 자동 닫기 및 로딩 상태 리셋
            viewModel.closeSidebar()
            isMapLoading = true
        }
    }
    
    /// 지도 로딩 조절 로직 (최소 1.5초 및 데이터 완료 대기)
    private func handleLoading() {
        guard isMapLoading else { return }
        
        Task {
            // 최소 1.5초 대기
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // 뷰모델 데이터 로딩 대기 (최대 5초)
            var retryCount = 0
            while viewModel.isLoading && retryCount < 25 {
                try? await Task.sleep(nanoseconds: 200_000_000)
                retryCount += 1
            }
            
            withAnimation(.easeOut(duration: 0.3)) {
                isMapLoading = false
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var selectedMemberName: String {
        guard let memberId = viewModel.selectedMemberId else { return "" }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.displayName ?? ""
    }
    
    private var selectedMemberPhoto: String? {
        guard let memberId = viewModel.selectedMemberId else { return nil }
        return viewModel.memberDailyCounts.first { $0.member_id == memberId }?.member_photo
    }
    
    private var sidebarOffset: CGFloat {
        if viewModel.isSidebarOpen {
            return max(0, sidebarDragOffset)
        } else {
            return min(0, -sidebarWidth + sidebarDragOffset)
        }
    }
    
    private var overlayOpacity: Double {
        let progress: Double
        if viewModel.isSidebarOpen {
            progress = 1.0 - Double(max(0, -sidebarDragOffset)) / Double(sidebarWidth)
        } else {
            progress = Double(sidebarDragOffset) / Double(sidebarWidth)
        }
        return 0.4 * max(0, min(1, progress))
    }
    
    // MARK: - Gestures
    
    private var edgeSwipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                if value.translation.width > 0 {
                    sidebarDragOffset = min(sidebarWidth, value.translation.width)
                }
            }
            .onEnded { value in
                if value.translation.width > sidebarWidth * 0.3 || value.predictedEndTranslation.width > sidebarWidth * 0.5 {
                    viewModel.isSidebarOpen = true
                    sidebarDragOffset = 0
                } else {
                    viewModel.isSidebarOpen = false
                    sidebarDragOffset = 0
                }
            }
    }
    
    private var sidebarDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                sidebarDragOffset = value.translation.width
            }
            .onEnded { value in
                if viewModel.isSidebarOpen {
                    if value.translation.width < -sidebarWidth * 0.3 || value.predictedEndTranslation.width < -sidebarWidth * 0.5 {
                        viewModel.closeSidebar()
                    }
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    sidebarDragOffset = 0
                }
            }
    }
}

// MARK: - Header View

struct ActivityLogHeaderView: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("활동 로그")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("그룹 멤버들의 활동 기록을 확인해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Color.white.opacity(0.95)
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                .edgesIgnoringSafeArea(.top)
        )
    }
}

// MARK: - Floating Info Card

struct ActivityLogFloatingCard: View {
    let memberName: String
    let memberPhoto: String?
    let displayDate: String
    let distance: String
    let duration: String
    let steps: String
    let isLoading: Bool
    let onTap: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Member Info
                HStack(spacing: 10) {
                    // Avatar
                    ZStack(alignment: .bottomTrailing) {
                        Group {
                            if let url = getProfileImageUrl(memberPhoto) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: Color.black.opacity(0.1), radius: 2)
                        
                        // Online indicator
                        Circle()
                            .fill(Color.green)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                            .offset(x: 2, y: 2)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(memberName)
                                .font(.suite(size: 14, weight: .bold))
                                .foregroundColor(.black)
                            Text("의 기록")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        Text(displayDate)
                            .font(.suite(size: 12, weight: .medium))
                            .foregroundColor(brandColor)
                    }
                }
                
                // Divider
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 1, height: 32)
                
                // Stats
                if isLoading {
                    ProgressView()
                        .frame(width: 100)
                } else {
                    HStack(spacing: 12) {
                        StatItem(icon: "arrow.up.right", color: .red, value: distance)
                        StatItem(icon: "clock", color: .yellow, value: duration)
                        StatItem(icon: "figure.walk", color: .blue, value: steps)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white)
                    .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

struct StatItem: View {
    let icon: String
    let color: Color
    let value: String
    
    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color.opacity(0.8))
                .frame(width: 24, height: 24)
                .overlay(
                    Image(systemName: icon)
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                )
            
            Text(value)
                .font(.suite(size: 12, weight: .semibold))
                .foregroundColor(.gray)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(minWidth: 50)
    }
}

// MARK: - Path Slider View

struct PathSliderView: View {
    @Binding var sliderValue: Double
    @Binding var isSliderDragging: Bool
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let thumbSize: CGFloat = 20
    private let trackHeight: CGFloat = 8
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack(spacing: 8) {
                Circle()
                    .fill(brandColor)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "play.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.white)
                    )
                
                Text("경로 따라가기")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.black)
            }
            
            // Custom Slider
            VStack(spacing: 4) {
                GeometryReader { geometry in
                    let totalWidth = geometry.size.width
                    let thumbRadius = thumbSize / 2
                    // 핸들이 트랙 안에 머물도록 유효 범위 계산
                    let minX = thumbRadius
                    let maxX = totalWidth - thumbRadius
                    let availableWidth = maxX - minX
                    let thumbCenterX = minX + (availableWidth * CGFloat(sliderValue / 100))
                    
                    ZStack {
                        // Track Background
                        RoundedRectangle(cornerRadius: trackHeight / 2)
                            .fill(Color.gray.opacity(0.3))
                            .frame(height: trackHeight)
                        
                        // Track Progress
                        HStack {
                            RoundedRectangle(cornerRadius: trackHeight / 2)
                                .fill(brandColor)
                                .frame(width: thumbCenterX, height: trackHeight)
                            Spacer(minLength: 0)
                        }
                        
                        // Thumb (핸들)
                        Circle()
                            .fill(brandColor)
                            .frame(width: thumbSize, height: thumbSize)
                            .overlay(
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 8, height: 8)
                            )
                            .shadow(color: brandColor.opacity(0.3), radius: 4)
                            .position(x: thumbCenterX, y: geometry.size.height / 2)
                    }
                    .frame(height: geometry.size.height)
                    .contentShape(Rectangle()) // 전체 영역 터치 가능
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isSliderDragging = true
                                // 터치 위치를 0-100% 값으로 변환
                                let touchX = value.location.x
                                let clampedX = max(minX, min(maxX, touchX))
                                let newValue = Double((clampedX - minX) / availableWidth) * 100
                                sliderValue = max(0, min(100, newValue))
                            }
                            .onEnded { _ in
                                isSliderDragging = false
                            }
                    )
                }
                .frame(height: 40) // 터치 영역
                
                // Labels
                HStack {
                    Text("시작")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    Text("\(Int(sliderValue))%")
                        .font(.suite(size: 10, weight: .bold))
                        .foregroundColor(brandColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(brandColor.opacity(0.1))
                        .cornerRadius(8)
                    
                    Spacer()
                    
                    Text("종료")
                        .font(.suite(size: 10))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(width: 220)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.95))
                .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
    }
}


// MARK: - FAB

struct FloatingActionLogButton: View {
    let count: Int
    let action: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    
    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(brandColor)
                    .frame(width: 56, height: 56)
                    .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )
                
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24)
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

// MARK: - Map View

struct ActivityLogMapView: UIViewRepresentable {
    let mapMarkers: [MapMarker]
    let stayTimes: [StayTime]
    let sliderValue: Double
    let isSliderDragging: Bool
    
    private let rainbowColors: [UIColor] = [
        UIColor(red: 255/255, green: 138/255, blue: 128/255, alpha: 1), // Pastel Red
        UIColor(red: 255/255, green: 183/255, blue: 77/255, alpha: 1),  // Pastel Orange
        UIColor(red: 255/255, green: 213/255, blue: 79/255, alpha: 1),  // Pastel Yellow
        UIColor(red: 129/255, green: 199/255, blue: 132/255, alpha: 1), // Pastel Green
        UIColor(red: 79/255, green: 195/255, blue: 247/255, alpha: 1),  // Pastel Blue
        UIColor(red: 121/255, green: 134/255, blue: 203/255, alpha: 1), // Pastel Indigo
        UIColor(red: 186/255, green: 104/255, blue: 200/255, alpha: 1)  // Pastel Violet
    ]

    func makeUIView(context: Context) -> NMFMapView {
        let m = NMFMapView()
        m.positionMode = .disabled
        m.logoAlign = .leftBottom
        m.zoomLevel = 15
        
        // 사용자의 현재 위치로 초기화
        let lastLocation = LocationService.sharedInstance.getLastLocation()
        if lastLocation.coordinate.latitude != 0.0 && lastLocation.coordinate.longitude != 0.0 {
            let initialPosition = NMGLatLng(lat: lastLocation.coordinate.latitude, lng: lastLocation.coordinate.longitude)
            m.moveCamera(NMFCameraUpdate(scrollTo: initialPosition))
            print("📍 [ActivityLogMapView] Using device location: (\(lastLocation.coordinate.latitude), \(lastLocation.coordinate.longitude))")
        } else {
            print("📍 [ActivityLogMapView] No device location, using default")
        }
        
        return m
    }
    
    func updateUIView(_ mapView: NMFMapView, context: Context) {
        // 1. Data Processing
        let sorted = mapMarkers.sorted { ($0.mlt_gps_time ?? "") < ($1.mlt_gps_time ?? "") }
        
        var validMarkers: [MapMarker] = []
        var coords: [NMGLatLng] = []
        for marker in sorted {
            if marker.latitude != 0 && marker.longitude != 0 {
                validMarkers.append(marker)
                coords.append(NMGLatLng(lat: marker.latitude, lng: marker.longitude))
            }
        }
        
        // 2. Path Drawing (Only if data changed)
        if context.coordinator.lastMapMarkersCount != mapMarkers.count || context.coordinator.lastMapMarkersCount == 0 {
            context.coordinator.clearOverlays()
            context.coordinator.lastMapMarkersCount = mapMarkers.count
            
            print("📍 [ActivityLogMapView] Redrawing path. Markers: \(validMarkers.count)")
            
            // Draw Gradient Path
            if coords.count >= 2 {
                for i in 0..<(coords.count - 1) {
                    let start = coords[i]
                    let end = coords[i+1]
                    
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let line = NMFPolylineOverlay([start, end])
                    line?.color = interpolatedColor
                    line?.width = 6
                    line?.mapView = mapView
                    if let line = line {
                        context.coordinator.polylines.append(line)
                    }
                }
                
                // Draw Path Dots
                for i in 0..<coords.count {
                    let progress = Double(i) / Double(coords.count - 1)
                    let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                    let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                    let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                    
                    let color1 = rainbowColors[colorIndex]
                    let color2 = rainbowColors[nextColorIndex]
                    let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                    
                    let dot = NMFMarker()
                    dot.position = coords[i]
                    dot.iconImage = NMFOverlayImage(image: generatePathDotImage(color: interpolatedColor))
                    dot.width = 8
                    dot.height = 8
                    dot.anchor = CGPoint(x: 0.5, y: 0.5)
                    dot.mapView = mapView
                    context.coordinator.pathDotMarkers.append(dot)
                }
                
                // Draw Arrows
                for i in 0..<(coords.count - 1) {
                    if i % 3 == 0, i + 1 < coords.count {
                        let start = coords[i]
                        let end = coords[i+1]
                        
                        let dLon = (end.lng - start.lng) * .pi / 180
                        let y = sin(dLon) * cos(end.lat * .pi / 180)
                        let x = cos(start.lat * .pi / 180) * sin(end.lat * .pi / 180) - sin(start.lat * .pi / 180) * cos(end.lat * .pi / 180) * cos(dLon)
                        var heading = atan2(y, x) * 180 / .pi
                        if heading < 0 { heading += 360 }
                        
                        let progress = Double(i) / Double(coords.count - 1)
                        let colorIndex = Int(progress * Double(rainbowColors.count - 1))
                        let nextColorIndex = min(colorIndex + 1, rainbowColors.count - 1)
                        let segmentProgress = (progress * Double(rainbowColors.count - 1)) - Double(colorIndex)
                        
                        let color1 = rainbowColors[colorIndex]
                        let color2 = rainbowColors[nextColorIndex]
                        let interpolatedColor = interpolateColor(color1: color1, color2: color2, factor: CGFloat(segmentProgress))
                        
                        let arrow = NMFMarker()
                        arrow.position = NMGLatLng(lat: (start.lat + end.lat)/2, lng: (start.lng + end.lng)/2)
                        arrow.iconImage = NMFOverlayImage(image: generateArrowImage(color: interpolatedColor))
                        arrow.angle = heading
                        arrow.width = 12
                        arrow.height = 12
                        arrow.anchor = CGPoint(x: 0.5, y: 0.5)
                        arrow.mapView = mapView
                        context.coordinator.arrowMarkers.append(arrow)
                    }
                }
            }
            
            // Draw Start/End Markers
            if let first = validMarkers.first {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: first.latitude, lng: first.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "S", color: UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
                
                let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: first.latitude, lng: first.longitude))
                cameraUpdate.animation = .fly
                mapView.moveCamera(cameraUpdate)
            }
            
            if let last = validMarkers.last {
                let m = NMFMarker()
                m.position = NMGLatLng(lat: last.latitude, lng: last.longitude)
                m.iconImage = NMFOverlayImage(image: generateStartEndMarkerImage(text: "E", color: UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)))
                m.width = 24
                m.height = 24
                m.anchor = CGPoint(x: 0.5, y: 0.5)
                m.mapView = mapView
                context.coordinator.markers.append(m)
            }
            
            // Stay Markers
            for (index, stay) in stayTimes.enumerated() {
                if stay.stayLatitude != 0 && stay.stayLongitude != 0 {
                    let m = NMFMarker()
                    m.position = NMGLatLng(lat: stay.stayLatitude, lng: stay.stayLongitude)
                    
                    let durationForColor = stay.duration
                    var color = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)
                    var size: CGFloat = 26
                    
                    if durationForColor >= 300 { 
                        color = UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 1); size = 40
                    } else if durationForColor >= 120 {
                        color = UIColor(red: 234/255, green: 88/255, blue: 12/255, alpha: 1); size = 36
                    } else if durationForColor >= 60 {
                        color = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1); size = 32
                    } else if durationForColor >= 30 {
                        color = UIColor(red: 234/255, green: 179/255, blue: 8/255, alpha: 1); size = 28
                    }
                    
                    let markerResult = generateStayMarkerImage(number: index + 1, duration: stay.formattedDuration, color: color, size: size)
                    
                    m.iconImage = NMFOverlayImage(image: markerResult.image)
                    m.width = CGFloat(markerResult.image.size.width)
                    m.height = CGFloat(markerResult.image.size.height)
                    m.anchor = markerResult.anchor
                    
                    m.mapView = mapView
                    context.coordinator.stayMarkers.append(m)
                }
            }
        }
        
        // 3. Current Position Marker & Camera
        if !validMarkers.isEmpty {
            let index = Int(Double(validMarkers.count - 1) * sliderValue / 100.0)
            let curr = validMarkers[max(0, min(index, validMarkers.count - 1))]
            
            context.coordinator.currentPositionMarker?.mapView = nil
            
            let m = NMFMarker()
            m.position = NMGLatLng(lat: curr.latitude, lng: curr.longitude)
            
            // Current Position Marker (Blue Bordered Circle)
            m.iconImage = NMFOverlayImage(image: generateCurrentLocationMarkerImage(color: UIColor(red: 1/255, green: 19/255, blue: 163/255, alpha: 1)))
            m.width = 24
            m.height = 24
            m.zIndex = 1000
            m.mapView = mapView
            context.coordinator.currentPositionMarker = m
            
            let cameraUpdate = NMFCameraUpdate(scrollTo: NMGLatLng(lat: curr.latitude, lng: curr.longitude))
            cameraUpdate.animation = .none
            mapView.moveCamera(cameraUpdate)
        }
    }
    
    private func interpolateColor(color1: UIColor, color2: UIColor, factor: CGFloat) -> UIColor {
        var r1: CGFloat=0, g1: CGFloat=0, b1: CGFloat=0, a1: CGFloat=0
        var r2: CGFloat=0, g2: CGFloat=0, b2: CGFloat=0, a2: CGFloat=0
        color1.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        color2.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(
            red: r1 + (r2 - r1) * factor,
            green: g1 + (g2 - g1) * factor,
            blue: b1 + (b2 - b1) * factor,
            alpha: 1.0
        )
    }
    
    func makeCoordinator() -> Coordinator { Coordinator() }
    
    private func generateArrowImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 20, height: 20)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 10, y: 0))
            path.addLine(to: CGPoint(x: 20, y: 20))
            path.addLine(to: CGPoint(x: 10, y: 15))
            path.addLine(to: CGPoint(x: 0, y: 20))
            path.close()
            color.setFill()
            path.fill()
        }
    }
    
    private func generatePathDotImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 8, height: 8)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 8, height: 8))
            color.setFill()
            path.fill()
            let borderPath = UIBezierPath(ovalIn: CGRect(x: 0.5, y: 0.5, width: 7, height: 7))
            UIColor.white.setStroke()
            borderPath.lineWidth = 1.0
            borderPath.stroke()
        }
    }
    
    private func generateStayMarkerImage(number: Int, duration: String, color: UIColor, size: CGFloat = 30) -> (image: UIImage, anchor: CGPoint) {
        let bubbleFont = UIFont(name: "SUITE-Medium", size: 11) ?? UIFont.systemFont(ofSize: 11, weight: .medium)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        let bubbleAttrs: [NSAttributedString.Key: Any] = [
            .font: bubbleFont,
            .foregroundColor: UIColor.white,
            .paragraphStyle: paragraphStyle
        ]
        let bubbleSizeCalc = duration.size(withAttributes: bubbleAttrs)
        let bubblePaddingH: CGFloat = 12
        let bubblePaddingV: CGFloat = 4
        let bubbleW = bubbleSizeCalc.width + bubblePaddingH
        let bubbleH = bubbleSizeCalc.height + bubblePaddingV
        let margin: CGFloat = 10
        let markerX: CGFloat = margin
        let initialMarkerY: CGFloat = margin + bubbleH/2 
        let bubbleX = markerX + size - 10
        let bubbleBottom = initialMarkerY + 8
        let bubbleY = bubbleBottom - bubbleH
        let yShift = max(0, margin - bubbleY)
        let finalMarkerY = initialMarkerY + yShift
        let finalBubbleY = bubbleY + yShift
        let canvasW = bubbleX + bubbleW + margin
        let canvasH = max(finalMarkerY + size + margin, finalBubbleY + bubbleH + margin)
        let canvasSize = CGSize(width: canvasW, height: canvasH)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        let image = renderer.image { ctx in
            let bubbleRect = CGRect(x: bubbleX, y: finalBubbleY, width: bubbleW, height: bubbleH)
            let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: 6)
            UIColor(red: 31/255, green: 41/255, blue: 55/255, alpha: 1).setFill()
            bubblePath.fill()
            let textRect = CGRect(x: bubbleRect.minX, y: bubbleRect.minY + (bubbleRect.height - bubbleSizeCalc.height) / 2, width: bubbleRect.width, height: bubbleSizeCalc.height)
            duration.draw(in: textRect, withAttributes: bubbleAttrs)
            let markerRect = CGRect(x: markerX, y: finalMarkerY, width: size, height: size)
            let circlePath = UIBezierPath(ovalIn: markerRect)
            color.setFill()
            circlePath.fill()
            let borderRect = markerRect.insetBy(dx: 1.5, dy: 1.5)
            let borderPath = UIBezierPath(ovalIn: borderRect)
            UIColor.white.setStroke()
            borderPath.lineWidth = 3
            borderPath.stroke()
            let numberStr = "\(number)"
            let numberFont = UIFont(name: "SUITE-Bold", size: 12) ?? UIFont.boldSystemFont(ofSize: 12)
            let numberAttrs: [NSAttributedString.Key: Any] = [.font: numberFont, .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let numberSize = numberStr.size(withAttributes: numberAttrs)
            let numberRect = CGRect(x: markerRect.midX - numberSize.width/2, y: markerRect.midY - numberSize.height/2, width: numberSize.width, height: numberSize.height)
            numberStr.draw(in: numberRect, withAttributes: numberAttrs)
        }
        let anchorX = (markerX + size/2) / canvasSize.width
        let anchorY = (finalMarkerY + size/2) / canvasSize.height
        return (image: image, anchor: CGPoint(x: anchorX, y: anchorY))
    }
    
    private func generateCurrentLocationMarkerImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            // White circle background
            let circleRect = CGRect(x: 2.5, y: 2.5, width: 19, height: 19)
            let circlePath = UIBezierPath(ovalIn: circleRect)
            UIColor.white.setFill()
            circlePath.fill()
            
            // Color border
            color.setStroke()
            circlePath.lineWidth = 5
            circlePath.stroke()
        }
    }
    
    private func generateStartEndMarkerImage(text: String, color: UIColor) -> UIImage {
        let size = CGSize(width: 24, height: 24)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let rect = CGRect(x: 2, y: 2, width: 20, height: 20)
            let path = UIBezierPath(ovalIn: rect)
            color.setFill()
            path.fill()
            UIColor.white.setStroke()
            path.lineWidth = 2
            path.stroke()
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center
            let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 10), .foregroundColor: UIColor.white, .paragraphStyle: paragraphStyle]
            let textSize = text.size(withAttributes: attrs)
            let textRect = CGRect(x: (24 - textSize.width)/2, y: (24 - textSize.height)/2, width: textSize.width, height: textSize.height)
            text.draw(in: textRect, withAttributes: attrs)
        }
    }

    class Coordinator: NSObject {
        var markers: [NMFMarker] = []
        var stayMarkers: [NMFMarker] = []
        var arrowMarkers: [NMFMarker] = []
        var pathDotMarkers: [NMFMarker] = []
        var polylines: [NMFPolylineOverlay] = []
        var currentPositionMarker: NMFMarker?
        var lastMapMarkersCount: Int = 0
        
        func clearOverlays() {
            markers.forEach { $0.mapView = nil }
            markers.removeAll()
            stayMarkers.forEach { $0.mapView = nil }
            stayMarkers.removeAll()
            arrowMarkers.forEach { $0.mapView = nil }
            arrowMarkers.removeAll()
            pathDotMarkers.forEach { $0.mapView = nil }
            pathDotMarkers.removeAll()
            polylines.forEach { $0.mapView = nil }
            polylines.removeAll()
            currentPositionMarker?.mapView = nil
            currentPositionMarker = nil
            lastMapMarkersCount = 0
        }
    }
}

// MARK: - Preview

struct ActivityLogView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogView()
    }
}

// MARK: - Phone Number TextField with Auto Hyphenation (iOS 13+ / UIViewRepresentable)
// Handles cursor jumping issue by managing formatting at the UITextField level.
struct PhoneTextField: UIViewRepresentable {
    @Binding var text: String
    let placeholder: String
    var onEditingChanged: ((Bool) -> Void)? = nil
    
    class Coordinator: NSObject, UITextFieldDelegate {
        @Binding var text: String
        var onEditingChanged: ((Bool) -> Void)?
        
        init(text: Binding<String>, onEditingChanged: ((Bool) -> Void)?) {
            _text = text
            self.onEditingChanged = onEditingChanged
        }
        
        @objc func textFieldDidChange(_ textField: UITextField) {
            let digits = (textField.text ?? "").filter { $0.isNumber }.prefix(11)
            let formatted = formatPhone(String(digits))
            
            // Calculate cursor offset from the end to maintain position
            let selectedRange = textField.selectedTextRange
            let cursorOffsetFromEnd = textField.offset(from: textField.endOfDocument, to: selectedRange?.end ?? textField.endOfDocument)
            
            textField.text = formatted
            self.text = String(digits) // Update binding with digits only
            
            // Restore cursor position
            if let newPosition = textField.position(from: textField.endOfDocument, offset: cursorOffsetFromEnd) {
                textField.selectedTextRange = textField.textRange(from: newPosition, to: newPosition)
            }
        }
        
        func textFieldDidBeginEditing(_ textField: UITextField) {
            onEditingChanged?(true)
        }
        
        func textFieldDidEndEditing(_ textField: UITextField) {
            onEditingChanged?(false)
        }
        
        private func formatPhone(_ value: String) -> String {
            let limited = String(value.prefix(11))
            switch limited.count {
            case 0...3:
                return limited
            case 4...6:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                return "\(limited[..<index1])-\(limited[index1...])"
            case 7...10:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                let index2 = limited.index(limited.startIndex, offsetBy: 6)
                return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
            default:
                let index1 = limited.index(limited.startIndex, offsetBy: 3)
                let index2 = limited.index(limited.startIndex, offsetBy: 7)
                return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onEditingChanged: onEditingChanged)
    }
    
    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.placeholder = placeholder
        textField.keyboardType = .numberPad
        textField.delegate = context.coordinator
        textField.font = UIFont(name: "SUITE-Regular", size: 16)
        textField.addTarget(context.coordinator, action: #selector(Coordinator.textFieldDidChange(_:)), for: .editingChanged)
        
        // Initial text
        let digits = text.filter { $0.isNumber }
        textField.text = formatPhone(String(digits.prefix(11)))
        
        return textField
    }
    
    func updateUIView(_ uiView: UITextField, context: Context) {
        let digits = text.filter { $0.isNumber }
        let formatted = formatPhone(String(digits.prefix(11)))
        if uiView.text != formatted {
            uiView.text = formatted
        }
    }
    
    private func formatPhone(_ value: String) -> String {
        let limited = String(value.prefix(11))
        switch limited.count {
        case 0...3: return limited
        case 4...6:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            return "\(limited[..<index1])-\(limited[index1...])"
        case 7...10:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            let index2 = limited.index(limited.startIndex, offsetBy: 6)
            return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
        default:
            let index1 = limited.index(limited.startIndex, offsetBy: 3)
            let index2 = limited.index(limited.startIndex, offsetBy: 7)
            return "\(limited[..<index1])-\(limited[index1..<index2])-\(limited[index2...])"
        }
    }
}
