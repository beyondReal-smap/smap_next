//
// RootCoordinatorView.swift
// smap
//
// 앱 진입점 - 로그인 상태에 따라 화면 분기
// iOS 13+ 호환
//

import SwiftUI
import WebKit
import Combine



/// iOS 13 호환 ProgressView 래퍼
struct ActivityIndicator: UIViewRepresentable {
    var isAnimating: Bool = true
    var style: UIActivityIndicatorView.Style = .large
    var color: UIColor = .white
    
    func makeUIView(context: Context) -> UIActivityIndicatorView {
        let indicator = UIActivityIndicatorView(style: style)
        indicator.color = color
        return indicator
    }
    
    func updateUIView(_ uiView: UIActivityIndicatorView, context: Context) {
        if isAnimating {
            uiView.startAnimating()
        } else {
            uiView.stopAnimating()
        }
    }
}

// MARK: - Map Loading Overlay

struct MapLoadingOverlay: View {
    @State private var dotOffset = 0
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()
    
    var body: some View {
        ZStack {
            // 배경 (브랜드 컬러 그라데이션)
            LinearGradient(
                gradient: Gradient(colors: [
                    brandColor.opacity(0.95),
                    Color(red: 102/255, green: 126/255, blue: 234/255).opacity(0.95)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 30) {
                // 지도 아이콘
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.15))
                        .frame(width: 90, height: 90)
                    
                    Image(systemName: "map.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 16) {
                    Text("지도 로딩 중")
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    // 순차적으로 움직이는 점 3개
                    HStack(spacing: 8) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(Color.white)
                                .frame(width: 10, height: 10)
                                .scaleEffect(dotOffset == index ? 1.5 : 1.0)
                                .opacity(dotOffset == index ? 1.0 : 0.4)
                        }
                    }
                }
            }
        }
        .onAppear {
            print("🎬 [MapLoadingOverlay] Overlay appeared")
        }
        .onReceive(timer) { _ in
            withAnimation(.easeInOut(duration: 0.4)) {
                dotOffset = (dotOffset + 1) % 3
            }
        }
    }
}

/// 앱의 루트 화면 - 로그인 상태에 따라 LoginView 또는 MainView로 분기
struct RootCoordinatorView: View {
    
    @StateObject private var coordinator = RootCoordinator()
    
    var body: some View {
        Group {
            switch coordinator.currentScreen {
            case .splash:
                SplashView()
                    .onAppear {
                        coordinator.checkAuthState()
                    }
                
            case .login:
                LoginView(
                    onLoginSuccess: {
                        coordinator.navigateToMain()
                    },
                    onNavigateToRegister: { socialData in
                        coordinator.navigateToRegister(socialData: socialData)
                    }
                )
                
            case .register:
                // 회원가입 (Native)
                NativeRegisterView(onComplete: {
                    // Registration complete
                    // Backend now returns token on registration, and AuthService saves it.
                    // So we should check if we are logged in.
                    if AuthService.shared.isLoggedIn {
                        coordinator.navigateToMain()
                    } else {
                        // Fallback if no token (should not happen with new backend)
                        coordinator.navigateToLogin()
                    }
                })
                
            case .main:
                MainWebViewContainer()
                
            case .schedule:
                NativeScheduleListView()
            }
        }
    }
}

// MARK: - Screen Enum

enum AppScreen: Equatable {
    case splash
    case login
    case register
    case main
    case schedule
}

// MARK: - Root Coordinator

class RootCoordinator: ObservableObject {
    
    @Published var currentScreen: AppScreen = .splash
    @Published var registerSocialData: [String: Any]?
    
    private let authService = AuthService.shared
    private var logoutObserver: Any?
    
    init() {
        // 로그아웃 알림 감시
        logoutObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("logout"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            print("🔐 [RootCoordinator] 로그아웃 알림 수신 - LoginView로 이동")
            self?.currentScreen = .login
        }
        
        // 일정 화면 이동 알림 감시
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("navigateToSchedule"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            print("📅 [RootCoordinator] 일정 화면 이동 알림 수신")
            self?.currentScreen = .schedule
        }
    }
    
    deinit {
        if let observer = logoutObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    /// 인증 상태 확인 및 화면 분기
    func checkAuthState() {
        print("🔍 [RootCoordinator] 인증 상태 확인 중...")
        
        // 스플래시 화면 최소 2초 표시
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self = self else { return }
            
            if self.authService.isLoggedIn {
                print("✅ [RootCoordinator] 로그인 상태 - MainView로 이동")
                self.currentScreen = .main
            } else {
                print("🔐 [RootCoordinator] 로그아웃 상태 - LoginView로 이동")
                self.currentScreen = .login
            }
        }
    }
    
    /// 메인 화면으로 이동
    func navigateToMain() {
        print("🏠 [RootCoordinator] 메인 화면으로 이동")
        currentScreen = .main
    }
    
    /// 로그인 화면으로 이동
    func navigateToLogin() {
        print("🔐 [RootCoordinator] 로그인 화면으로 이동")
        authService.logout()
        currentScreen = .login
    }
    
    /// 회원가입 화면으로 이동
    func navigateToRegister(socialData: [String: Any]?) {
        print("📝 [RootCoordinator] 회원가입 화면으로 이동")
        registerSocialData = socialData
        currentScreen = .register
    }
}

// MARK: - Splash View (Premium Animated)

struct SplashView: View {
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background Color #353538
                Color(red: 53/255, green: 53/255, blue: 56/255)
                    .edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 0) {
                    // App Icon (AppNoBg from Assets)
                    Image("AppNoBg")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 80, height: 80) // Adjust size as needed
                }
                .position(x: geometry.size.width / 2, y: geometry.size.height * 0.25) // 1/4 Height Position
            }
        }
    }
}



// MARK: - Main WebView Container (기존 MainView 사용)

struct MainWebViewContainer: View {
    var body: some View {
        MainWebViewRepresentable()
            .edgesIgnoringSafeArea(.all)
    }
}

struct MainWebViewRepresentable: UIViewControllerRepresentable {
    
    func makeUIViewController(context: Context) -> UINavigationController {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let mainVC = storyboard.instantiateViewController(withIdentifier: "MainView") as! UINavigationController
        return mainVC
    }
    
    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}

// MARK: - Preview

struct RootCoordinatorView_Previews: PreviewProvider {
    static var previews: some View {
        RootCoordinatorView()
    }
}

// MARK: - Native Settings Views (Consolidated to fix scope issues)

public struct SettingMenuView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    public init() {}
    
    public var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all)
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Menu Sections
                        VStack(spacing: 24) {
                            SettingsMenuSectionView(title: "계정 관리", items: [
                                SettingsMenuItem(title: "계정설정", icon: "person.fill", color: .indigo, destination: AnyView(AccountSettingsView()))
                            ])
                            
                            SettingsMenuSectionView(title: "약관 & 정책", items: [
                                SettingsMenuItem(title: "서비스 이용약관", icon: "doc.text.fill", color: .teal, destination: AnyView(ServiceTermsView())),
                                SettingsMenuItem(title: "개인정보 처리방침", icon: "shield.fill", color: .cyan, destination: AnyView(PrivacyPolicyView())),
                                SettingsMenuItem(title: "위치기반서비스 이용약관", icon: "location.fill", color: .purple, destination: AnyView(LocationTermsView())),
                                SettingsMenuItem(title: "마케팅 정보 수집 및 이용 동의", icon: "star.fill", color: Color(red: 1/255, green: 20/255, blue: 162/255), destination: AnyView(MarketingConsentView())),
                                SettingsMenuItem(title: "개인정보 제3자 제공 동의", icon: "person.2.fill", color: .pink, destination: AnyView(ThirdPartyProvisionView()))
                            ])
                            
                            SettingsMenuSectionView(title: "고객 지원", items: [
                                SettingsMenuItem(title: "사용 가이드", icon: "book.fill", color: .yellow, destination: AnyView(TermsWebView(title: "사용 가이드", url: "https://nextstep.smap.site/setting/manual"))),
                                SettingsMenuItem(title: "1:1 문의", icon: "envelope.fill", color: .orange, destination: AnyView(InquiryView())),
                                SettingsMenuItem(title: "공지사항", icon: "bell.fill", color: .red, destination: AnyView(NoticeListView()))
                            ])
                        }
                        .padding(.horizontal)
                        
                        // App Version Info
                        VStack(spacing: 4) {
                            Text("SMAP")
                                .font(.suite(size: 14, weight: .semibold))
                                .foregroundColor(.gray)
                            Text("버전 3.0.0")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray.opacity(0.8))
                        }
                        .padding(.vertical, 32)
                    }
                    .padding(.vertical)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.suite(size: 18, weight: .semibold))
                            Text("홈")
                                .font(.suite(size: 18, weight: .bold))
                        }
                        .foregroundColor(.primary)
                    }
                }
            }
        }
    }
}

struct ProfileSummaryCard: View {
    let user: SMAPUser
    
    var body: some View {
        HStack(spacing: 16) {
            // Avatar
            if let avatarUrl = AuthService.getProfileImageURL(user.mt_file1) {
                AsyncImage(url: avatarUrl) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 2))
            } else {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .frame(width: 60, height: 60)
                    .foregroundColor(.white.opacity(0.5))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(user.mt_nickname ?? user.mt_name ?? "사용자")
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text(user.mt_level == 5 ? "VIP" : "일반")
                        .font(.suite(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                }
                
                Text(user.mt_email ?? "이메일 정보 없음")
                    .font(.suite(size: 13))
                    .foregroundColor(.white.opacity(0.8))
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.white.opacity(0.5))
        }
        .padding(20)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color(red: 1/255, green: 19/255, blue: 163/255), Color(red: 102/255, green: 126/255, blue: 234/255)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(24)
        .shadow(color: Color.blue.opacity(0.2), radius: 10, x: 0, y: 5)
    }
}

struct SettingsMenuSectionView: View {
    let title: String
    let items: [SettingsMenuItem]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.suite(size: 16, weight: .bold))
                    .foregroundColor(.primary)
                
                Spacer()
                
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 1)
                    .padding(.leading, 8)
            }
            
            VStack(spacing: 0) {
                ForEach(0..<items.count, id: \.self) { index in
                    NavigationLink(destination: items[index].destination) {
                        SettingsMenuItemView(item: items[index])
                    }
                    
                    if index < items.count - 1 {
                        Divider().padding(.leading, 56)
                    }
                }
            }
            .background(Color.white)
            .cornerRadius(20)
            .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
        }
    }
}

struct SettingsMenuItem {
    let title: String
    let icon: String
    let color: Color
    let destination: AnyView
}

struct SettingsMenuItemView: View {
    let item: SettingsMenuItem
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(item.color.opacity(0.1))
                    .frame(width: 40, height: 40)
                
                Image(systemName: item.icon)
                    .foregroundColor(item.color)
                    .font(.suite(size: 18))
            }
            
            Text(item.title)
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.primary)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.suite(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

struct AccountSettingsView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    @State private var showingLogoutAlert = false
    
    @State private var showingImagePicker = false
    @State private var inputImage: UIImage?
    @State private var selectedImage: UIImage? // 즉시 표시용
    @State private var isLoadingImage = false
    @State private var showingImageUploadError = false
    @State private var imageUploadErrorMessage = ""
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                profileHeaderCard
                
                if authService.currentUser != nil {
                    accountManagementSection
                    accountInfoSection
                    logoutSection
                    withdrawLink
                }
                
                Spacer(minLength: 40)
            }
        }
        .background(Color(UIColor.secondarySystemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("계정설정")
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
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker(image: $inputImage)
        }
        .onChange(of: inputImage) { newImage in
            if let newImage = newImage {
                selectedImage = newImage
                uploadImage()
            }
        }
        .alert(isPresented: $showingLogoutAlert) {
            Alert(
                title: Text("로그아웃"),
                message: Text("정말로 로그아웃 하시겠습니까?"),
                primaryButton: .destructive(Text("로그아웃")) {
                    authService.logout()
                    NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
                },
                secondaryButton: .cancel(Text("취소"))
            )
        }
        .onAppear {
            // 페이지 진입 시 로컬 선택 이미지 초기화 (서버 데이터로 표시)
            selectedImage = nil
            inputImage = nil
            
            // 서버에서 최신 사용자 정보 가져오기
            Task {
                do {
                    _ = try await authService.fetchUserProfile()
                    print("✅ [AccountSettingsView] 사용자 프로필 갱신 완료")
                } catch {
                    print("⚠️ [AccountSettingsView] 사용자 프로필 갱신 실패: \(error)")
                }
            }
        }
        .alert("이미지 업로드 실패", isPresented: $showingImageUploadError) {
            Button("확인", role: .cancel) { }
        } message: {
            Text(imageUploadErrorMessage)
        }
    }
    
    // MARK: - Extracted View Properties
    
    private var profileHeaderCard: some View {
        HStack(spacing: 20) {
            ZStack(alignment: .bottomTrailing) {
                if isLoadingImage {
                    ProgressView()
                        .frame(width: 80, height: 80)
                        .background(Color.gray.opacity(0.1))
                        .clipShape(Circle())
                } else if let selected = selectedImage {
                    Image(uiImage: selected)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 80, height: 80)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 3))
                        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
                } else if let user = authService.currentUser,
                          let avatarUrl = AuthService.getProfileImageURL(user.mt_file1) {
                    AsyncImage(url: avatarUrl) { phase in
                        if let image = phase.image {
                            image.resizable().aspectRatio(contentMode: .fill)
                        } else {
                            defaultAvatar
                        }
                    }
                    .frame(width: 80, height: 80)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.white, lineWidth: 3))
                    .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
                } else {
                    defaultAvatar
                }
                
                Button(action: { showingImagePicker = true }) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(6)
                        .background(brandColor)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                }
                .offset(x: 2, y: 2)
            }
            
            if let user = authService.currentUser {
                VStack(alignment: .leading, spacing: 4) {
                    Text(user.displayName)
                        .font(.suite(size: 20, weight: .bold))
                        .foregroundColor(.white)
                    
                    if let email = user.mt_email, !email.isEmpty {
                        Text(email)
                            .font(.suite(size: 13))
                            .foregroundColor(.white.opacity(0.8))
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [brandColor, Color(red: 102/255, green: 126/255, blue: 234/255)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(24)
        .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
    
    private var accountManagementSection: some View {
        SettingsSectionView(title: "계정 관리") {
            NavigationLink(destination: EditProfileView()) {
                SettingsRowView(icon: "person.fill", iconColor: .indigo, title: "프로필 편집")
            }
            
            Divider().padding(.leading, 52)
            
            NavigationLink(destination: ChangePasswordView()) {
                SettingsRowView(icon: "lock.fill", iconColor: .pink, title: "비밀번호 변경")
            }
        }
    }
    
    @ViewBuilder
    private var accountInfoSection: some View {
        if let user = authService.currentUser {
            // 소셜 로그인 여부 확인 (2=카카오, 3=Apple, 4=Google)
            let isSocialLogin = user.mt_type == 2 || user.mt_type == 3 || user.mt_type == 4
            
            SettingsSectionView(title: "내 정보") {
                // 소셜 로그인이 아닌 경우에만 휴대폰 번호 표시
                if !isSocialLogin {
                    SettingsInfoRowView(icon: "phone.fill", iconColor: brandColor, title: "휴대폰", value: user.mt_id ?? "-")
                    Divider().padding(.leading, 52)
                }
                SettingsInfoRowView(icon: "at", iconColor: .orange, title: "닉네임", value: user.mt_nickname ?? "-")
                Divider().padding(.leading, 52)
                SettingsInfoRowView(icon: "person.badge.key.fill", iconColor: .purple, title: "로그인 방식", value: getLoginMethodText(user.mt_type))
                Divider().padding(.leading, 52)
                SettingsInfoRowView(icon: "calendar", iconColor: .teal, title: "가입일", value: formatDate(user.mt_wdate))
            }
        }
    }
    
    private var logoutSection: some View {
        VStack(spacing: 0) {
            Button(action: { showingLogoutAlert = true }) {
                HStack {
                    Text("로그아웃")
                        .font(.suite(size: 16))
                        .foregroundColor(.red)
                    Spacer()
                }
                .padding()
                .background(Color(UIColor.systemBackground))
            }
        }
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }
    
    private var withdrawLink: some View {
        NavigationLink(destination: WithdrawView()) {
            Text("회원탈퇴")
                .font(.suite(size: 14))
                .foregroundColor(.secondary)
        }
        .padding(.top, 8)
    }
    
    private var defaultAvatar: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: 90, height: 90)
            .foregroundColor(Color.gray.opacity(0.3))
    }
    
    private func uploadImage() {
        guard let image = inputImage else {
            print("❌ [AccountSettingsView] inputImage가 nil")
            return
        }
        guard let imageData = image.jpegData(compressionQuality: 0.7) else {
            print("❌ [AccountSettingsView] JPEG 변환 실패")
            return
        }
        
        print("📸 [AccountSettingsView] 이미지 업로드 시작 - 크기: \(imageData.count) bytes")
        isLoadingImage = true
        
        Task {
            do {
                let response = try await authService.uploadProfileImage(image: imageData)
                await MainActor.run {
                    isLoadingImage = false
                    if response.success {
                        print("✅ [AccountSettingsView] 이미지 업로드 성공")
                        inputImage = nil
                        // selectedImage는 유지 (성공 시 즉시 표시 유지)
                    } else {
                        print("❌ [AccountSettingsView] 서버 응답 실패: \(response.message)")
                        selectedImage = nil
                        inputImage = nil
                        imageUploadErrorMessage = response.message
                        showingImageUploadError = true
                    }
                }
            } catch {
                await MainActor.run {
                    isLoadingImage = false
                    inputImage = nil
                    selectedImage = nil // Revert on failure
                    print("❌ [AccountSettingsView] 프로필 이미지 업로드 실패: \(error)")
                    imageUploadErrorMessage = error.localizedDescription
                    showingImageUploadError = true
                }
            }
        }
    }
    
    private func getLoginMethodText(_ type: Int?) -> String {
        switch type {
        case 1: return "일반"
        case 2: return "카카오"
        case 3: return "Apple"
        case 4: return "Google"
        default: return "일반"
        }
    }
    
    private func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "-" }
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "yyyy.MM.dd"
            return displayFormatter.string(from: date)
        }
        return dateString.components(separatedBy: "T").first ?? dateString
    }
}

// MARK: - Settings Section Components

struct SettingsSectionView<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.suite(size: 13, weight: .medium))
                .foregroundColor(.secondary)
                .padding(.horizontal, 20)
            
            VStack(spacing: 0) {
                content
            }
            .background(Color(UIColor.systemBackground))
            .cornerRadius(12)
            .padding(.horizontal, 16)
        }
    }
}

struct SettingsRowView: View {
    let icon: String
    let iconColor: Color
    let title: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)
            
            Text(title)
                .font(.suite(size: 16))
                .foregroundColor(.primary)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color(UIColor.tertiaryLabel))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

struct SettingsInfoRowView: View {
    let icon: String
    let iconColor: Color
    let title: String
    let value: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(iconColor)
                .cornerRadius(6)
            
            Text(title)
                .font(.suite(size: 16))
                .foregroundColor(.primary)
            
            Spacer()
            
            Text(value)
                .font(.suite(size: 15))
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(UIColor.systemBackground))
    }
}


struct PremiumBadgeCard: View {
    let title: String
    let value: String
    let icon: String
    let gradientColors: [Color]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                Text(title)
                    .font(.suite(size: 12, weight: .medium))
            }
            .foregroundColor(.white.opacity(0.9))
            
            Text(value)
                .font(.suite(size: 18, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(colors: gradientColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        )
        .shadow(color: gradientColors.first?.opacity(0.3) ?? .clear, radius: 8, x: 0, y: 4)
    }
}

struct PremiumActionRow: View {
    let label: String
    let subtitle: String
    let icon: String
    let iconColor: Color
    
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(iconColor)
                .frame(width: 36, height: 36)
                .background(iconColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.4))
        }
        .padding(14)
    }
}

struct AccountInfoRowV2: View {
    let label: String
    let value: String
    let icon: String
    
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .frame(width: 36, height: 36)
                .background(Color.gray.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
                Text(value)
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.primary)
            }
            
            Spacer()
        }
        .padding(14)
    }
}


struct AccountActionRow: View {
    let label: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.indigo)
                .frame(width: 24)
            
            Text(label)
                .font(.suite(size: 16))
                .foregroundColor(.primary)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.gray.opacity(0.3))
        }
        .padding()
    }
}

// MARK: - ImagePicker Implementation
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.presentationMode) var presentationMode

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let uiImage = info[.originalImage] as? UIImage {
                parent.image = uiImage
            }

            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

struct InfoBadgeCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.suite(size: 14))
                    .foregroundColor(color)
                Text(title)
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }
            
            Text(value)
                .font(.suite(size: 16, weight: .bold))
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.02), radius: 5, x: 0, y: 2)
    }
}

struct AccountInfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.suite(size: 15))
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .font(.suite(size: 15, weight: .medium))
                .foregroundColor(.primary)
        }
        .padding()
    }
}

struct TermsWebView: View {
    let title: String
    let url: String
    
    var body: some View {
        WebViewWrapper(urlString: url)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct WebViewWrapper: UIViewRepresentable {
    let urlString: String
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = URL(string: urlString) {
            let request = URLRequest(url: url)
            uiView.load(request)
        }
    }
}

// MARK: - Notice Models & Service

struct SmapNoticeListWithPagination: Codable {
    let notices: [SmapNotice]
    let total: Int
    let page: Int
    let size: Int
    let total_pages: Int
}

struct SmapNotice: Codable, Identifiable {
    var id: Int { nt_idx }
    let nt_idx: Int
    let nt_title: String
    let nt_content: String
    let nt_hit: Int
    let nt_wdate: String
}

class NoticeService {
    static let shared = NoticeService()
    private let authService = AuthService.shared
    private let baseURL = "https://api3.smap.site/api/v1"
    
    private init() {}
    
    func getNotices(page: Int = 1, size: Int = 20) async throws -> SmapNoticeListWithPagination {
        let url = URL(string: "\(baseURL)/notices/?page=\(page)&size=\(size)&show_only=true")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "공지사항을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        return try JSONDecoder().decode(SmapNoticeListWithPagination.self, from: data)
    }
}

struct NoticeListView: View {
    @State private var notices: [SmapNotice] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        ZStack {
            Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all)
            
            if isLoading {
                ProgressView("공지사항을 불러오는 중...")
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.suite(size: 48))
                        .foregroundColor(.orange)
                    Text(error)
                        .font(.suite(size: 16))
                        .foregroundColor(.gray)
                    Button("다시 시도") {
                        fetchNotices()
                    }
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
            } else if notices.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "bell.slash")
                        .font(.suite(size: 48))
                        .foregroundColor(.gray.opacity(0.3))
                    Text("등록된 공지사항이 없습니다.")
                        .font(.suite(size: 16))
                        .foregroundColor(.gray)
                }
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        // Notice Header Card
                        VStack(spacing: 12) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("공지사항")
                                        .font(.suite(size: 20, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("최신 소식 및 업데이트")
                                        .font(.suite(size: 14))
                                        .foregroundColor(.white.opacity(0.8))
                                }
                                Spacer()
                                Image(systemName: "bell.fill")
                                    .font(.suite(size: 32))
                                    .foregroundColor(.white.opacity(0.3))
                            }
                        }
                        .padding(24)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [.red, Color(red: 0.8, green: 0, blue: 0)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(24)
                        .padding(.horizontal)
                        .padding(.top, 12)
                        
                        // Notice List
                        VStack(spacing: 12) {
                            ForEach(notices) { notice in
                                NavigationLink(destination: NoticeDetailView(notice: notice)) {
                                    NoticeRow(notice: notice)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.bottom, 20)
                }
            }
        }
        .navigationTitle("공지사항")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            fetchNotices()
        }
    }
    
    private func fetchNotices() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let response = try await NoticeService.shared.getNotices()
                await MainActor.run {
                    self.notices = response.notices
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}

struct NoticeRow: View {
    let notice: SmapNotice
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(notice.nt_title)
                .font(.suite(size: 16, weight: .bold))
                .foregroundColor(.primary)
                .lineLimit(1)
            
            Text(notice.nt_content)
                .font(.suite(size: 14))
                .foregroundColor(.gray)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            
            HStack {
                Text(formatDate(notice.nt_wdate))
                    .font(.suite(size: 12))
                    .foregroundColor(.gray.opacity(0.6))
                
                Spacer()
                
                HStack(spacing: 4) {
                    Image(systemName: "eye.fill")
                        .font(.suite(size: 10))
                    Text("조회 \(notice.nt_hit)")
                        .font(.suite(size: 12))
                }
                .foregroundColor(.gray.opacity(0.4))
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.02), radius: 5, x: 0, y: 2)
    }
    
    private func formatDate(_ dateString: String) -> String {
        if let dateOnly = dateString.components(separatedBy: "T").first {
            return dateOnly.replacingOccurrences(of: "-", with: ".")
        }
        return dateString
    }
}

struct NoticeDetailView: View {
    let notice: SmapNotice
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(notice.nt_title)
                        .font(.suite(size: 22, weight: .bold))
                        .foregroundColor(.primary)
                    
                    HStack {
                        Text(formatDate(notice.nt_wdate))
                        Spacer()
                        Text("조회 \(notice.nt_hit)")
                    }
                    .font(.suite(size: 14))
                    .foregroundColor(.gray)
                }
                .padding(.bottom, 8)
                
                Divider()
                
                Text(notice.nt_content)
                    .font(.suite(size: 16))
                    .foregroundColor(.primary.opacity(0.8))
                    .lineSpacing(6)
            }
            .padding(20)
        }
        .navigationTitle("공지 상세")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func formatDate(_ dateString: String) -> String {
        if let dateOnly = dateString.components(separatedBy: "T").first {
            return dateOnly.replacingOccurrences(of: "-", with: ".")
        }
        return dateString
    }
}

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
    
    private let botToken = "7701491070:AAH6wpf7wK5o7jq--mRlZWpE_rb3HIIjvBU"
    private let chatId = "6495247513"
    
    private let categories = [
        ("general", "일반 문의", "💬"),
        ("technical", "기술 지원", "🔧"),
        ("account", "계정 문제", "👤"),
        ("billing", "결제 문의", "💳")
    ]
    
    var body: some View {
        ZStack {
            Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("1:1 문의")
                                    .font(.suite(size: 20, weight: .bold))
                                    .foregroundColor(.white)
                                Text("궁금한 점을 문의하세요")
                                    .font(.suite(size: 14))
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            Spacer()
                            Image(systemName: "envelope.fill")
                                .font(.suite(size: 32))
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }
                    .padding(24)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [.orange, Color(red: 1.0, green: 0.4, blue: 0)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(24)
                    .padding(.horizontal)
                    
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("문의 유형")
                                .font(.suite(size: 15, weight: .bold))
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(categories, id: \.0) { item in
                                    Button(action: { category = item.0 }) {
                                        VStack(spacing: 4) {
                                            Text(item.2).font(.suite(size: 20))
                                            Text(item.1).font(.suite(size: 13, weight: .medium))
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(category == item.0 ? Color.orange.opacity(0.1) : Color.gray.opacity(0.05))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(category == item.0 ? Color.orange : Color.clear, lineWidth: 2)
                                        )
                                        .cornerRadius(12)
                                        .foregroundColor(category == item.0 ? .orange : .primary)
                                    }
                                }
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("이메일")
                                .font(.suite(size: 15, weight: .bold))
                            TextField("답변받을 이메일을 입력하세요", text: $email)
                                .font(.suite(size: 15))
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .padding()
                                .background(Color.white)
                                .cornerRadius(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("제목")
                                .font(.suite(size: 15, weight: .bold))
                            TextField("문의 제목을 입력하세요", text: $subject)
                                .font(.suite(size: 15))
                                .padding()
                                .background(Color.white)
                                .cornerRadius(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("내용")
                                .font(.suite(size: 15, weight: .bold))
                            ZStack(alignment: .topLeading) {
                                if message.isEmpty {
                                    Text("문의 내용을 입력해주세요")
                                        .font(.suite(size: 15))
                                        .foregroundColor(Color(UIColor.placeholderText))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 16)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $message)
                                    .font(.suite(size: 15))
                                    .frame(height: 150)
                                    .padding(8)
                                    .hideScrollBackground()
                                    .background(Color.clear)
                            }
                            .background(Color.white)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                        }
                        
                        Button(action: sendInquiry) {
                            HStack {
                                if isSending {
                                    ProgressView().tint(.white)
                                } else {
                                    Image(systemName: "paperplane.fill")
                                    Text("문의 전송")
                                }
                            }
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isFormValid ? Color.orange : Color.gray.opacity(0.3))
                            .cornerRadius(16)
                        }
                        .disabled(!isFormValid || isSending)
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
        }
        .navigationTitle("1:1 문의")
        .navigationBarTitleDisplayMode(.inline)
        .alert(isPresented: $showingAlert) {
            Alert(
                title: Text(isSuccess ? "전송 완료" : "오류"),
                message: Text(alertMessage),
                dismissButton: .default(Text("확인")) {
                    if isSuccess {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            )
        }
    }
    
    private var isFormValid: Bool {
        !email.isEmpty && !subject.isEmpty && !message.isEmpty && email.contains("@")
    }
    
    private func sendInquiry() {
        guard isFormValid else { return }
        isSending = true
        
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy. M. d. a h:mm:ss"
        let dateString = formatter.string(from: Date())
        
        let categoryName = categories.first(where: { $0.0 == category })?.1 ?? category
        
        let text = """
📨 새로운 1:1 문의

📋 문의 유형: \(categoryName)
📝 제목: \(subject)
📧 이메일: \(email)

💬 문의 내용:
\(message)

⏰ 접수 시간: \(dateString)
"""
        
        let urlString = "https://api.telegram.org/bot\(botToken)/sendMessage"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "chat_id": chatId,
            "text": text,
            "parse_mode": "HTML"
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                isSending = false
                if let error = error {
                    alertMessage = "전송 중 오류가 발생했습니다: \(error.localizedDescription)"
                    isSuccess = false
                    showingAlert = true
                } else if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        alertMessage = "문의가 성공적으로 전송되었습니다."
                        isSuccess = true
                        showingAlert = true
                        // Reset form
                        email = ""
                        subject = ""
                        message = ""
                    } else {
                        let errorDetail = data.flatMap { String(data: $0, encoding: .utf8) } ?? "상세 오류 없음"
                        alertMessage = "전송에 실패했습니다. (Error: \(httpResponse.statusCode))\n\(errorDetail)"
                        isSuccess = false
                        showingAlert = true
                    }
                } else {
                    alertMessage = "알 수 없는 오류가 발생했습니다."
                    isSuccess = false
                    showingAlert = true
                }
            }
        }.resume()
    }
}

// MARK: - Service Terms View
struct ServiceTermsView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("서비스 이용약관")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("시행일: 2024-05-30")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                
                Group {
                    TermSection(title: "제1조(목적)", content: "이 약관은 비욘드리얼(이하 \"회사\")가 제공하는 제반 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.")
                    
                    TermSection(title: "제2조(정의)", content: """
                    1. \"서비스\"라 함은 구현되는 단말기(PC, TV, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 이용자가 이용할 수 있는 회사의 제반 서비스를 의미합니다.
                       ① smap 서비스
                       ② 기타 회사가 정하는 서비스
                    2. \"smap 서비스\"라 함은 실시간 위치조회, 위치와 일정 기반 알림 등 회사가 이용자에게 제공하는 서비스를 말합니다.
                    3. \"이용자\"란 회사가 제공하는 서비스를 받는 개인회원과 비회원을 말합니다.
                    4. \"개인회원\"은 회사에 개인정보를 제공하여 회원등록을 한 사람으로, 회사로부터 지속적으로 정보를 제공받고 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
                    5. \"비회원\"은 회원가입 없이 회사가 제공하는 서비스를 이용하는 자를 말합니다.
                    6. \"아이디(ID)\"란 회원의 식별과 서비스 이용을 위하여 회원이 정하고 회사가 승인하는 문자 또는 문자와 숫자의 조합을 의미합니다.
                    7. \"비밀번호\"란 회원이 부여받은 아이디와 일치되는 회원임을 확인하고 비밀의 보호를 위해 회원이 정한 문자(특수문자 포함)와 숫자의 조합을 의미합니다.
                    8. \"유료서비스\"란 회사가 유료로 제공하는 제반 서비스를 의미합니다.
                    9. \"결제\"란 회사가 제공하는 유료서비스를 이용하기 위하여 회원이 지불수단을 선택하고 금융정보를 입력하는 행위를 말합니다.
                    10. \"할인쿠폰\"은 이용자가 회사의 서비스를 이용하면서 그 대가를 지급하는 데 사용하기 위하여 회사가 발행 및 관리하는 지급수단을 말합니다.
                    11. \"콘텐츠\"란 정보통신망법에 따라 정보통신망에서 사용되는 부호·문자·음성·음향·이미지 또는 영상 등으로 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 말합니다.
                    """)
                    
                    TermSection(title: "제3조(약관 외 준칙)", content: "이 약관에서 정하지 아니한 사항은 법령 또는 회사가 정한 서비스의 개별약관, 운영정책 및 규칙 등(이하 \"세부지침\")의 규정에 따르며, 본 약관과 세부지침이 충돌할 경우 세부지침이 우선합니다.")
                    
                    TermSection(title: "제4조(약관의 효력과 변경)", content: """
                    1. 이 약관은 회사가 제공하는 모든 인터넷서비스에 게시하여 공시합니다. 회사는 전자상거래법, 약관규제법, 정보통신망법 등 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 최소 7일(불리하거나 중대한 사항은 30일) 이전부터 공지합니다. 기존 이용자에게는 전자적 수단(전자우편, 문자메시지, 서비스 내 알림 등)으로 개별 통지할 수 있습니다. 변경 된 약관은 시행일부터 효력이 발생합니다.
                    2. 회사는 개정약관 공지 또는 통지 시, '변경에 동의하지 아니한 경우 공지일 또는 통지를 받은 날로부터 7일(불리하거나 중대한 사항은 30일) 내 해지 가능하며, 해지 의사표시가 없으면 동의한 것으로 간주'됨을 함께 통지합니다.
                    3. 이용자가 전항의 기간 내 거절 의사를 표시하지 않을 때에는 개정 약관에 동의한 것으로 봅니다.
                    """)
                }
                
                Group {
                    TermSection(title: "제5조(이용자에 대한 통지)", content: """
                    1. 회사는 이 약관에 별도 규정이 없는 한 전자우편, 문자(SMS), 전자쪽지, 푸시 알림 등의 전자적 수단으로 통지할 수 있습니다.
                    2. 이용자 전체에 대한 통지는 7일 이상 서비스 내 공지 게시로 갈음할 수 있습니다. 다만, 회원 개별 거래에 중대한 영향을 미치는 사항은 개별 통지합니다.
                    3. 연락처 미기재, 변경 후 미수정, 오기재 등으로 개별 통지가 어려운 경우 공지로 개별 통지를 갈음한 것으로 간주합니다.
                    """)
                    
                    TermSection(title: "제6조(이용계약의 체결)", content: """
                    1. 회원가입 시, 이용자가 약관에 동의하고 가입 신청을 하며 회사가 이를 승낙한 때
                    2. 비회원 유료 이용의 경우, 결제가 완료된 때
                    3. 무료 서비스인 경우, 관련 부가 기능 이용에 필요한 절차 진행 시
                    """)
                    
                    TermSection(title: "제7조(회원가입에 대한 승낙)", content: """
                    1. 회사는 이용계약 요청이 있으면 원칙적으로 승낙합니다.
                    2. 필요 시 실명확인 및 본인인증을 요청할 수 있습니다.
                    3. 설비 부족, 기술·업무상 문제 등으로 승낙을 유보할 수 있습니다.
                    4. 승낙 거절·유보 시 원칙적으로 신청자에게 알립니다(불가피한 경우 예외).
                    5. 계약 성립 시점은 가입완료(또는 결제완료) 표시 시점입니다.
                    6. 회사 정책에 따라 등급별로 이용시간·횟수·메뉴 등에 차등을 둘 수 있습니다.
                    7. 관련 법령에 따른 연령·등급 제한을 둘 수 있습니다.
                    """)
                }
                
                TermSection(title: "기타 조항", content: "제8조부터 제24조까지의 상세 내용은 서비스 내 운영정책을 따르며, 회사는 개인정보보호, 서비스 이용 제한, 손해배상 및 면책사항 등에 대해 관련 법령을 준수합니다. 상세 문의는 고객센터를 통해 확인 가능합니다.")
                
                // Footer
                VStack(spacing: 8) {
                    Text("부칙")
                        .font(.suite(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Text("본 약관은 2024-05-30부터 시행합니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all))
        .navigationBarTitleDisplayMode(.inline)
    }
}


// MARK: - Privacy Policy View
struct PrivacyPolicyView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("개인정보 처리방침")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("시행일: 2024-05-30")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                
                VStack(alignment: .leading, spacing: 20) {
                    Text("비욘드리얼 (\"회사\"라 함)는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법, 통신비밀보호법, 전기통신사업법, 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.")
                        .font(.suite(size: 15))
                        .lineSpacing(6)
                    
                    Text("본 개인정보처리방침은 회사가 제공하는 \"홈페이지(www.smap.co.kr)\" 및 \"어플리케이션 (smap)\" (이하에서는 홈페이지 및 어플리케이션을 이하 '서비스'라 합니다.) 이용에 적용되며 다음과 같은 내용을 담고 있습니다.")
                        .font(.suite(size: 15))
                        .lineSpacing(6)
                        
                    TermSection(title: "개인정보 수집 항목 및 이용목적", content: "\"회사\"는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 최소한의 개인정보를 필수항목으로 수집하고 있습니다.")
                    
                    TermSection(title: "개인정보의 제3자에 대한 제공", content: "회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.")
                    
                    TermSection(title: "개인정보의 처리 및 보유기간", content: "회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.")
                    
                    TermSection(title: "개인정보의 파기", content: "회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.")
                    
                    TermSection(title: "정보주체의 권리·의무 및 행사방법", content: "이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.")
                    
                    TermSection(title: "개인정보 보호책임자", content: "회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.")
                    
                    // Custom box for contact info
                    VStack(alignment: .leading, spacing: 8) {
                        Text("개인정보 보호책임자")
                            .font(.suite(size: 16, weight: .bold))
                        Text("담당: 정진 | 전화: 070-8065-2207 | 이메일: admin@smap.site")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.blue.opacity(0.05))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.blue.opacity(0.1), lineWidth: 1)
                    )
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Location Terms View
struct LocationTermsView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("위치기반서비스 이용약관")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("시행일: 2024-05-30")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                
                VStack(alignment: .leading, spacing: 20) {
                    TermSection(title: "제1조(목적)", content: "본 약관은 회원(비욘드리얼 서비스 약관에 동의한 자, 이하 “회원”)이 비욘드리얼(이하 “회사”)이 제공하는 웹/모바일 애플리케이션(“smap”)의 위치기반서비스를 이용함에 있어 회원과 회사의 권리와 의무, 기타 제반 사항을 정함을 목적으로 합니다.")
                    
                    TermSection(title: "제2조(가입자격)", content: "서비스에 가입할 수 있는 회원은 위치기반서비스를 이용할 수 있는 이동전화 단말기의 소유자 본인이어야 합니다.")
                    
                    TermSection(title: "제3조(서비스 가입)", content: """
                    회사는 다음 각 호에 해당하는 가입신청을 승낙하지 않을 수 있습니다.
                    1. 실명이 아니거나 타인의 명의를 사용하는 등 허위로 신청하는 경우
                    2. 고객 등록 사항을 누락하거나 오기하여 신청하는 경우
                    3. 공공질서 또는 미풍양속을 저해하거나 저해할 목적을 가지고 신청하는 경우
                    4. 기타 회사가 정한 이용신청 요건이 충족되지 않았을 경우
                    """)
                    
                    TermSection(title: "제4조(서비스 해지)", content: "회원은 회사가 정한 절차를 통해 서비스 해지를 신청할 수 있습니다.")
                    
                    TermSection(title: "제5조(이용약관의 효력 및 변경)", content: """
                    1. 본 약관은 서비스를 신청한 고객 또는 개인위치정보주체가 회사가 정한 절차에 따라 회원으로 등록함으로써 효력이 발생합니다.
                    2. 서비스 신청자가 온라인에서 본 약관을 모두 읽고 “동의하기”를 클릭한 경우 본 약관의 내용에 동의한 것으로 봅니다.
                    3. 본 약관에 동의하지 않는 경우, 회사가 개인위치정보를 기반으로 제공하는 혜택 및 편의 제공에 일부 제한이 발생할 수 있습니다.
                    4. 회사는 관계 법령의 범위 내에서 본 약관을 개정할 수 있으며, 개정 시 적용일자, 개정사유를 명시하여 적용일자 10일 전부터 서비스 내 공지합니다. 회원에게 불리하거나 권리를 제한하는 개정의 경우 30일 전부터 공지하고 전자적 수단으로 고지합니다.
                    """)
                    
                    TermSection(title: "제6조(약관 외 준칙)", content: "본 약관에 명시되지 않은 사항은 관계 법령 및 건전한 거래관행에 따릅니다.")
                    
                    TermSection(title: "제7조(서비스의 내용)", content: """
                    회사가 제공하는 위치기반서비스는 아래와 같습니다.
                    1. 위치기반 콘텐츠 분류(지오태깅)
                    2. 회사 및 제휴사의 상품/서비스 정보 제공
                    3. 마케팅 서비스 및 프로모션 혜택 알림 제공
                    4. 길 안내 등 생활편의 서비스 제공
                    """)
                    
                    TermSection(title: "제8조(서비스 이용요금)", content: """
                    1. 서비스는 무료 제공을 원칙으로 합니다. 단, 유료서비스는 해당 화면에 명시된 요금을 지불하여 이용할 수 있습니다.
                    2. 무선 데이터 통신료는 이동통신사 정책에 따르며 회원이 부담합니다.
                    3. MMS 등으로 게시물을 등록할 경우 발생하는 요금은 이동통신사 정책에 따릅니다.
                    """)
                    
                    TermSection(title: "부칙", content: "본 약관은 2024-05-30부터 시행합니다.")
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Marketing Consent View
struct MarketingConsentView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("마케팅 정보 수집 및 이용 동의")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("시행일: 2024-05-30")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                
                VStack(alignment: .leading, spacing: 20) {
                    Text("비욘드리얼(이하 \"회사\")는 고객에게 더 나은 서비스와 혜택을 제공하기 위해 마케팅 정보 수집 및 이용에 대한 동의를 요청합니다.")
                        .font(.suite(size: 15))
                        .lineSpacing(6)
                    
                    TermSection(title: "수집하는 마케팅 정보", content: """
                    회사는 다음과 같은 마케팅 정보를 수집할 수 있습니다:
                    • 이름, 연락처(전화번호, 이메일)
                    • 서비스 이용 내역 및 선호도
                    • 마케팅 캠페인 참여 이력
                    • 고객 만족도 조사 결과
                    """)
                    
                    TermSection(title: "마케팅 정보 이용 목적", content: """
                    수집된 마케팅 정보는 다음 목적으로만 이용됩니다:
                    • 신규 서비스 및 이벤트 안내
                    • 맞춤형 혜택 및 프로모션 제공
                    • 고객 만족도 향상을 위한 서비스 개선
                    • 마케팅 성과 분석 및 통계
                    """)
                    
                    TermSection(title: "동의 철회 및 거부", content: "고객은 언제든지 마케팅 정보 수집 및 이용에 대한 동의를 철회하거나 거부할 수 있습니다.")
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("동의 철회 방법")
                            .font(.suite(size: 16, weight: .bold))
                        Text("설정 > 개인정보 처리방침에서 동의 철회 가능")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.blue.opacity(0.05))
                    .cornerRadius(12)
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Third Party Provision View
struct ThirdPartyProvisionView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("개인정보 제3자 제공 동의")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("시행일: 2024-05-30")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                
                VStack(alignment: .leading, spacing: 20) {
                    Text("비욘드리얼(이하 \"회사\")는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.")
                        .font(.suite(size: 15))
                        .lineSpacing(6)
                    
                    TermSection(title: "제3자 제공이 필요한 경우", content: """
                    다음의 경우에만 개인정보를 제3자에게 제공할 수 있습니다:
                    • 이용자가 개인정보의 수집 및 이용에 대한 동의와 별도로 제3자 제공에 사전 동의한 경우
                    • 법률규정이 있거나 법령상 의무준수를 위해 불가피한 경우
                    • 수사기관이 수사목적을 위해 관계법령이 정한 절차를 거쳐 요구하는 경우
                    • 통계작성 및 학술연구 등의 목적을 위해 필요한 경우
                    """)
                    
                    TermSection(title: "제3자 제공 시 고지사항", content: """
                    개인정보를 제3자에게 제공하는 경우 다음 사항을 미리 고지합니다:
                    • 개인정보를 제공받는 자의 성명과 연락처
                    • 제공받는 자의 개인정보 이용 목적
                    • 제공하는 개인정보의 항목
                    • 제공받는 자의 개인정보 보유 및 이용 기간
                    • 동의 거부권이 존재한다는 사실 및 동의 거부에 따른 불이익의 내용
                    """)
                    
                    TermSection(title: "동의 철회 및 거부", content: "이용자는 언제든지 제3자 제공에 대한 동의를 철회하거나 거부할 수 있습니다.")
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("동의 철회 방법")
                            .font(.suite(size: 16, weight: .bold))
                        Text("설정 > 개인정보 처리방침에서 동의 철회 가능")
                            .font(.suite(size: 13))
                            .foregroundColor(.gray)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.blue.opacity(0.05))
                    .cornerRadius(12)
                }
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all))
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct TermSection: View {
    let title: String
    let content: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.suite(size: 18, weight: .bold))
                .foregroundColor(Color(red: 1/255, green: 19/255, blue: 163/255))
            
            Text(content)
                .font(.suite(size: 15))
                .lineSpacing(6)
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
    }
}

// MARK: - Extensions
extension View {
    @ViewBuilder
    func hideScrollBackground() -> some View {
        if #available(iOS 16.0, *) {
            self.scrollContentBackground(.hidden)
        } else {
            self.onAppear {
                #if os(iOS)
                UITextView.appearance().backgroundColor = .clear
                #endif
            }
        }
    }
}

// MARK: - Schedule Models Consolidated

struct AlertItem: Identifiable {
    let id = UUID()
    let message: String
}

struct ScheduleListResponse: Codable {
    let success: Bool
    let data: ScheduleData?
    let error: String?
}

struct ScheduleData: Codable {
    let schedules: [Schedule]
    let groupMembers: [SmapGroupMember]
    let userPermission: UserPermissions
}

struct UserPermissions: Codable {
    let canManage: Bool
    let isOwner: Bool
    let isLeader: Bool
}

struct Schedule: Codable, Identifiable, Equatable {
    var id: String { sst_idx }
    let sst_idx: String
    let mt_idx: Int?
    let sst_title: String?
    let sst_sdate: String?
    let sst_edate: String?
    let sst_all_day: String?
    let sgt_idx: Int?
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_show: String?
    let mt_name: String?
    let mt_file1: String?
    let sst_alram: Int?
    let sst_supplies: String?
    let sst_repeat_json: String? // Added for recurrence
    let sst_repeat_json_v: String?
    let member_name: String?
    let member_photo: String?
    
    enum CodingKeys: String, CodingKey {
        case sst_idx, mt_idx, sst_title, sst_sdate, sst_edate, sst_all_day, sgt_idx
        case sst_location_title, sst_location_add, sst_location_lat, sst_location_long
        case sst_memo, sst_show, mt_name, mt_file1
        case sst_alram, sst_supplies
        case sst_repeat_json, sst_repeat_json_v
        case member_name, member_photo
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Flexible decoding for sst_idx (String or Int)
        if let idInt = try? container.decode(Int.self, forKey: .sst_idx) {
            sst_idx = String(idInt)
        } else {
            sst_idx = try container.decode(String.self, forKey: .sst_idx)
        }
        
        mt_idx = try? container.decode(Int.self, forKey: .mt_idx)
        sst_title = try? container.decode(String.self, forKey: .sst_title)
        sst_sdate = try? container.decode(String.self, forKey: .sst_sdate)
        sst_edate = try? container.decode(String.self, forKey: .sst_edate)
        sst_all_day = try? container.decode(String.self, forKey: .sst_all_day)
        sgt_idx = try? container.decode(Int.self, forKey: .sgt_idx)
        sst_location_title = try? container.decode(String.self, forKey: .sst_location_title)
        sst_location_add = try? container.decode(String.self, forKey: .sst_location_add)
        sst_location_lat = try? container.decode(Double.self, forKey: .sst_location_lat)
        sst_location_long = try? container.decode(Double.self, forKey: .sst_location_long)
        sst_memo = try? container.decode(String.self, forKey: .sst_memo)
        sst_show = try? container.decode(String.self, forKey: .sst_show)
        mt_name = try? container.decode(String.self, forKey: .mt_name)
        mt_file1 = try? container.decode(String.self, forKey: .mt_file1)
        
        // Flexible decoding for sst_alram (Int or String)
        if let alramInt = try? container.decode(Int.self, forKey: .sst_alram) {
            sst_alram = alramInt
        } else if let alramStr = try? container.decode(String.self, forKey: .sst_alram) {
            sst_alram = Int(alramStr)
        } else {
            sst_alram = nil
        }
        
        sst_supplies = try? container.decode(String.self, forKey: .sst_supplies)
        sst_repeat_json = try? container.decode(String.self, forKey: .sst_repeat_json)
        sst_repeat_json_v = try? container.decode(String.self, forKey: .sst_repeat_json_v)
        
        member_name = try? container.decode(String.self, forKey: .member_name)
        member_photo = try? container.decode(String.self, forKey: .member_photo)
    }
    
    // Parsed properties for UI
    var validMemberName: String {
        return member_name ?? mt_name ?? "알 수 없음"
    }
    
    var validMemberPhoto: String? {
        return member_photo ?? mt_file1
    }
    
    var repeatDescription: String? {
        if let v = sst_repeat_json_v, !v.isEmpty, v != "안함", v != "None" {
            return v
        }
        guard let jsonResult = sst_repeat_json,
              let data = jsonResult.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let r1 = json["r1"] as? String else {
            return nil
        }
        switch r1 {
        case "1": return "매일"
        case "2": return "매월"
        case "3": return "매주"
        case "4": return "매년"
        default: return nil
        }
    }
    
    static func == (lhs: Schedule, rhs: Schedule) -> Bool {
        return lhs.sst_idx == rhs.sst_idx && lhs.sst_title == rhs.sst_title && lhs.sst_sdate == rhs.sst_sdate && lhs.sst_edate == rhs.sst_edate && lhs.sst_all_day == rhs.sst_all_day && lhs.sst_location_title == rhs.sst_location_title && lhs.sst_memo == rhs.sst_memo
    }
    
    var status: ScheduleDisplayStatus {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        
        guard let sDateStr = sst_sdate, let eDateStr = sst_edate else { return .defaultStatus }
        
        let start = formatter.date(from: sDateStr) ?? isoFormatter.date(from: sDateStr)
        let end = formatter.date(from: eDateStr) ?? isoFormatter.date(from: eDateStr)
        
        guard let validStart = start, let validEnd = end else { return .defaultStatus }
        
        let now = Date()
        if now > validEnd { return .completed }
        if now >= validStart && now <= validEnd { return .ongoing }
        return .upcoming
    }
    
    var startDateOnly: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        
        guard let dateStr = sst_sdate else { return nil }
        guard let date = formatter.date(from: dateStr) ?? isoFormatter.date(from: dateStr) else { return nil }
        return Calendar.current.startOfDay(for: date)
    }
}

struct CreateScheduleRequest: Codable {
    let groupId: Int
    let targetMemberId: Int
    let sst_title: String
    let sst_sdate: String
    let sst_edate: String
    let sst_all_day: String
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_alram: Int?
    let sst_supplies: String?
    let sst_repeat_json: String?
    let sst_repeat_json_v: String?
}

struct UpdateScheduleRequest: Codable {
    let sst_idx: String
    let groupId: Int
    let sst_title: String
    let sst_sdate: String
    let sst_edate: String
    let sst_all_day: String
    let sst_location_title: String?
    let sst_location_add: String?
    let sst_location_lat: Double?
    let sst_location_long: Double?
    let sst_memo: String?
    let sst_alram: Int?
    let sst_supplies: String?
    let sst_repeat_json: String?
    let sst_repeat_json_v: String?
}

struct ScheduleSimpleResponse: Codable {
    let success: Bool
    let message: String?
}

enum ScheduleDisplayStatus {
    case completed
    case ongoing
    case upcoming
    case defaultStatus
    
    var text: String {
        switch self {
        case .completed: return "완료"
        case .ongoing: return "진행중"
        case .upcoming: return "예정"
        case .defaultStatus: return "-"
        }
    }
}

// MARK: - Schedule Service Consolidated

class ScheduleService {
    static let shared = ScheduleService()
    private let authService = AuthService.shared
    private init() {}
    private var baseURL: String { return authService.baseURL }
    
    func getGroupSchedules(groupId: Int, startDate: String, endDate: String, memberId: Int? = nil) async throws -> ScheduleData {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        var components = URLComponents(string: "\(baseURL)/schedule/group/\(groupId)/schedules")!
        
        // Backend expects yyyy-MM-dd
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let apiFormatter = DateFormatter()
        apiFormatter.dateFormat = "yyyy-MM-dd"
        
        let apiStartDate = displayFormatter.string(from: displayFormatter.date(from: startDate) ?? Date())
        let apiEndDate = displayFormatter.string(from: displayFormatter.date(from: endDate) ?? Date())
        
        var queryItems = [
            URLQueryItem(name: "current_user_id", value: currentUserId),
            URLQueryItem(name: "start_date", value: apiStartDate),
            URLQueryItem(name: "end_date", value: apiEndDate)
        ]
        if let memberId = memberId { queryItems.append(URLQueryItem(name: "member_id", value: String(memberId))) }
        components.queryItems = queryItems
        
        guard let url = components.url else { throw APIError(detail: nil, message: "잘못된 URL 형식입니다.") }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        
        print("🌐 [ScheduleService] Fetching schedules: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("🌐 [ScheduleService] Status: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                 let errorBody = String(data: data, encoding: .utf8) ?? ""
                 print("🌐 [ScheduleService] Error body: \(errorBody)")
            }
        }
        
        if let jsonString = String(data: data, encoding: .utf8) {
            print("📦 [ScheduleService] Raw JSON: \(jsonString)")
        }
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄을 불러오는데 실패했습니다. (Error: \(statusCode))")
        }
        
        let decoder = JSONDecoder()
        do {
            let result = try decoder.decode(ScheduleListResponse.self, from: data)
            if result.success, let scheduleData = result.data { return scheduleData }
            else { throw APIError(detail: nil, message: result.error ?? "스케줄 로드 실패") }
        } catch {
            // Fallback: Try decoding as raw array [Schedule]
            if let schedules = try? decoder.decode([Schedule].self, from: data) {
                print("⚠️ [ScheduleService] Decoded as raw array. Using default permissions.")
                return ScheduleData(
                    schedules: schedules,
                    groupMembers: [],
                    userPermission: UserPermissions(canManage: false, isOwner: false, isLeader: false)
                )
            }
            print("❌ [ScheduleService] Decoding failed: \(error)")
            throw error
        }
    }
    
    func createSchedule(_ scheduleRequest: CreateScheduleRequest) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        let url = URL(string: "\(baseURL)/schedule/group/\(scheduleRequest.groupId)/schedules?current_user_id=\(currentUserId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        
        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(scheduleRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 생성에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }
    
    func updateSchedule(_ scheduleRequest: UpdateScheduleRequest) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        let url = URL(string: "\(baseURL)/schedule/group/\(scheduleRequest.groupId)/schedules/\(scheduleRequest.sst_idx)?current_user_id=\(currentUserId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        
        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(scheduleRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 수정에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }
    
    func deleteSchedule(sstIdx: String, groupId: Int) async throws -> Bool {
        let currentUserId = UserDefaults.standard.string(forKey: "mt_idx") ?? ""
        var components = URLComponents(string: "\(baseURL)/schedule/group/\(groupId)/schedules/\(sstIdx)")!
        components.queryItems = [URLQueryItem(name: "current_user_id", value: currentUserId)]
        
        guard let url = components.url else { throw APIError(detail: nil, message: "잘못된 URL 형식입니다.") }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let token = authService.getToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError(detail: nil, message: "스케줄 삭제에 실패했습니다. (Error: \(statusCode))")
        }
        let result = try JSONDecoder().decode(ScheduleSimpleResponse.self, from: data)
        return result.success
    }
}

// MARK: - Schedule Views Consolidated

struct NativeScheduleListView: View {
    @StateObject private var viewModel = ScheduleViewModel()
    @Environment(\.presentationMode) var presentationMode
    
    @State private var showingAddSchedule = false
    @State private var scheduleToEdit: Schedule?
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all)
                
                
                VStack(spacing: 0) {
                    titleView // "Schedule" Title area
                        .zIndex(1)
                    
                    // Floating Card Container (Month Nav + Calendar)
                    VStack(spacing: 0) {
                        monthNavView
                        calendarGridView
                    }
                    .padding(.bottom, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 5)
                    .padding(.horizontal, 16) // Aligned with summary card padding
                    .zIndex(1)

                    // Scrollable Event List
                    ScrollView {
                        VStack(spacing: 20) {
                            eventListView
                        }
                        .padding(.top, 20)
                        .padding(.bottom, 80)
                    }
                }
                
                if viewModel.isLoading {
                    ZStack {
                        Color.black.opacity(0.1).edgesIgnoringSafeArea(.all)
                        ActivityIndicator(style: .large, color: brandColor.uiColor)
                            .padding()
                            .background(Color.white)
                            .cornerRadius(12)
                    }
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showingAddSchedule) {
                ScheduleFormView(
                    viewModel: viewModel,
                    initialGroupId: viewModel.selectedGroup?.sgt_idx ?? 0,
                    onSave: {
                        viewModel.fetchSchedules()
                        showingAddSchedule = false
                    }
                )
            }
            .sheet(item: $scheduleToEdit) { schedule in
                ScheduleFormView(
                    viewModel: viewModel,
                    initialGroupId: viewModel.selectedGroup?.sgt_idx ?? 0,
                    schedule: schedule,
                    onSave: {
                        viewModel.fetchSchedules()
                        scheduleToEdit = nil
                    }
                )
            }
        }
    }
    
    private var titleView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("일정")
                    .font(.suite(size: 22, weight: .bold)) // Updated to match Group List
                    .foregroundColor(.primary)
                Text("그룹 멤버들과 일정을 공유해보세요")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }
            Spacer()
            Button(action: { showingAddSchedule = true }) {
                Image(systemName: "plus")
                    .font(.suite(size: 22, weight: .bold)) // Larger Plus
                    .foregroundColor(brandColor)
            }
        }

        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .padding(.bottom, 10) // Extra bottom spacing for card separation
    }

    private var monthNavView: some View {
        // Month Navigation and "Go to Today"
        VStack(spacing: 0) { 
            HStack(spacing: 0) {
                Spacer()
                Button(action: { viewModel.changeMonth(by: -1) }) {
                    Image(systemName: "chevron.left")
                        .font(.suite(size: 20, weight: .semibold))
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                }
                Text(formatMonth(viewModel.currentMonth))
                    .font(.suite(size: 20, weight: .bold)) // Larger Month
                    .frame(width: 140)
                Button(action: { viewModel.changeMonth(by: 1) }) {
                    Image(systemName: "chevron.right")
                        .font(.suite(size: 20, weight: .semibold))
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                }
                Spacer()
            }
            .padding(.top, 8)
            
            Button(action: { 
                withAnimation {
                    viewModel.goToToday() 
                }
            }) {
                Text("오늘로 이동")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(brandColor)
            }
            .padding(.bottom, 4)
            .padding(.top, 4)
        }
    }
    
    private var calendarGridView: some View {
        VStack(spacing: 0) { // Reduced spacing
            let days = ["일", "월", "화", "수", "목", "금", "토"]
            HStack {
                ForEach(days, id: \.self) { day in
                    Text(day)
                        .font(.suite(size: 12))
                        .foregroundColor(day == "일" ? .red : (day == "토" ? .blue : .gray))
                        .frame(maxWidth: .infinity)
                }
            }
            let monthDays = generateMonthDays()
            ForEach(0..<monthDays.count / 7, id: \.self) { weekIndex in
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { dayIndex in
                        let index = weekIndex * 7 + dayIndex
                        if index < monthDays.count {
                            let date = monthDays[index]
                            CalendarDateCell(
                                date: date,
                                isSelected: Calendar.current.isDate(date, inSameDayAs: viewModel.selectedDate),
                                isToday: Calendar.current.isDateInToday(date),
                                isCurrentMonth: Calendar.current.isDate(date, equalTo: viewModel.currentMonth, toGranularity: .month),
                                hasEvent: viewModel.datesWithEvents.contains(Calendar.current.startOfDay(for: date)),
                                onTap: { viewModel.selectDate(date) }
                            )
                        }
                    }
                }
            }
        }
        .padding(.horizontal)
        .padding(.top, 4)
        .padding(.bottom, 0)
    }
    
    private var memberFilterView: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Text removed as requested
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(viewModel.groupMembers) { member in
                        Button(action: { 
                            withAnimation(.spring()) {
                                viewModel.toggleMemberSelection(member.id) 
                            }
                        }) {
                            VStack(spacing: 8) {
                                ZStack {
                                    if let photoUrl = member.mt_file1, !photoUrl.isEmpty {
                                        AsyncImage(url: URL(string: photoUrl.hasPrefix("http") ? photoUrl : "https://nextstep.smap.site\(photoUrl)")) { phase in
                                            if let image = phase.image {
                                                image.resizable().aspectRatio(contentMode: .fill)
                                            } else {
                                                Image(systemName: "person.circle.fill").resizable().foregroundColor(.gray.opacity(0.3))
                                            }
                                        }
                                        .frame(width: 52, height: 52)
                                        .clipShape(Circle())
                                    } else {
                                        Image(systemName: "person.circle.fill")
                                            .resizable()
                                            .frame(width: 52, height: 52)
                                            .foregroundColor(.gray.opacity(0.3))
                                    }
                                    
                                    if viewModel.selectedMemberIds.contains(member.id) {
                                        Circle()
                                            .stroke(brandColor, lineWidth: 3)
                                            .frame(width: 60, height: 60)
                                        
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(brandColor)
                                            .background(Color.white.clipShape(Circle()))
                                            .font(.suite(size: 16))
                                            .offset(x: 20, y: 20)
                                    }
                                }
                                .padding(4)
                                
                                Text(member.displayName)
                                    .font(.suite(size: 11, weight: viewModel.selectedMemberIds.contains(member.id) ? .bold : .medium))
                                    .foregroundColor(viewModel.selectedMemberIds.contains(member.id) ? .primary : .gray)
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 4)
            }
        }
        .padding(.vertical, 8)
    }
    
    private var eventListView: some View {
        VStack(spacing: 0) {
            // Selected Date Banner
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(formatSelectedDate(viewModel.selectedDate))
                        .font(.suite(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("\(viewModel.filteredSchedules.count)개의 일정")
                        .font(.suite(size: 14))
                        .foregroundColor(.white.opacity(0.8))
                }
                Spacer()
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color(red: 0/255, green: 20/255, blue: 140/255)) // Dark Brand Color
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 16)

            VStack(alignment: .leading, spacing: 8) {
                if viewModel.filteredSchedules.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "calendar.badge.plus")
                            .font(.suite(size: 48))
                            .foregroundColor(.gray.opacity(0.2))
                        Text("등록된 일정이 없습니다")
                            .font(.suite(size: 16))
                            .foregroundColor(.gray)
                        Button(action: { showingAddSchedule = true }) {
                            Text("일정 추가하기")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(brandColor)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(brandColor.opacity(0.1))
                                .cornerRadius(20)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    ForEach(viewModel.filteredSchedules) { schedule in
                        ScheduleEventCard(
                            schedule: schedule,
                            groupName: viewModel.selectedGroup?.sgt_title,
                            onEdit: { scheduleToEdit = schedule },
                            onDelete: { viewModel.deleteSchedule(schedule) }
                        )
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
    }
    
    private func formatMonth(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy년 MM월"
        return formatter.string(from: date)
    }
    
    private func formatSelectedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M월 d일 EEEE"
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.string(from: date)
    }
    
    private func generateMonthDays() -> [Date] {
        let calendar = Calendar.current
        
        // Start of the month
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: viewModel.currentMonth))!
        
        // End of the month
        let range = calendar.range(of: .day, in: .month, for: startOfMonth)!
        let endOfMonth = calendar.date(byAdding: .day, value: range.count - 1, to: startOfMonth)!
        
        // Start of the grid (Previous Sunday)
        let firstWeekday = calendar.component(.weekday, from: startOfMonth)
        let startOfCalendar = calendar.date(byAdding: .day, value: -(firstWeekday - 1), to: startOfMonth)!
        
        // End of the grid (Next Saturday)
        let lastWeekday = calendar.component(.weekday, from: endOfMonth)
        let daysToAdd = 7 - lastWeekday
        let endOfCalendar = calendar.date(byAdding: .day, value: daysToAdd, to: endOfMonth)!
        
        // Total days to show
        let numberOfDays = calendar.dateComponents([.day], from: startOfCalendar, to: endOfCalendar).day! + 1
        
        var days: [Date] = []
        for i in 0..<numberOfDays {
            if let date = calendar.date(byAdding: .day, value: i, to: startOfCalendar) {
                days.append(date)
            }
        }
        return days
    }
}

struct CalendarDateCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let isCurrentMonth: Bool
    let hasEvent: Bool
    let onTap: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(spacing: 0) { // Spacing 0 for tighter layout
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.suite(size: 15, weight: isSelected ? .bold : (isToday ? .bold : .medium)))
                .foregroundColor(textColor)
                .frame(width: 36, height: 36)
                .background(
                    ZStack {
                        if isSelected {
                            brandColor
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .shadow(color: brandColor.opacity(0.3), radius: 4, x: 0, y: 2)
                        } else if isToday {
                            brandColor.opacity(0.1)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                )
            
            if hasEvent {
                Circle()
                    .fill(Color.red) // Red Dot
                    .frame(width: 4, height: 4)
                    .padding(.top, -8) // Pull closer to the number
            } else {
                Spacer().frame(height: 4) // Mantain height consistency
            }
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { 
            withAnimation(.spring()) {
                onTap()
            }
        }
        .opacity(isCurrentMonth ? 1.0 : 0.2)
        // Removed vertical padding to reduce height
    }
    
    private var textColor: Color {
        if isSelected { return .white }
        if isToday { return brandColor }
        let weekday = Calendar.current.component(.weekday, from: date)
        if weekday == 1 { return .red.opacity(isCurrentMonth ? 1.0 : 0.5) }
        if weekday == 7 { return .blue.opacity(isCurrentMonth ? 1.0 : 0.5) }
        return .primary
    }
}

struct ScheduleEventCard: View {
    let schedule: Schedule
    let groupName: String? // Added groupName
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Left: Time Block (Compact)
            VStack(alignment: .leading, spacing: 2) {
                if let sDate = scheduleDate(from: schedule.sst_sdate) {
                    Text(formatTime(sDate))
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }
                
                if let eDate = scheduleDate(from: schedule.sst_edate) {
                    Text("~ \(formatTime(eDate))")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
                
                // Moved Repeat Info to here for visibility
                if let repeatText = schedule.repeatDescription {
                     HStack(spacing: 2) {
                        Image(systemName: "repeat")
                            .font(.suite(size: 10))
                        Text(repeatText)
                            .font(.suite(size: 11))
                    }
                    .foregroundColor(.blue.opacity(0.8))
                    .padding(.top, 4)
                }
            }
            .frame(width: 70, alignment: .leading)
            
            // Right: Content Block
            VStack(alignment: .leading, spacing: 4) {
                // Member & Group Info
                HStack(spacing: 6) {
                    // Avatar
                    if #available(iOS 15.0, *), 
                       let photo = schedule.validMemberPhoto, 
                       !photo.isEmpty, 
                       let url = URL(string: photo.hasPrefix("http") ? photo : "https://nextstep.smap.site\(photo)") {
                        
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().aspectRatio(contentMode: .fill)
                            } else {
                                Image(systemName: "person.circle.fill").foregroundColor(.gray)
                            }
                        }
                        .frame(width: 20, height: 20)
                        .clipShape(Circle())
                    } else {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .frame(width: 20, height: 20)
                            .foregroundColor(.gray)
                    }

                    Text(schedule.validMemberName)
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(brandColor)
                    
                    if let gName = groupName {
                        Text("•")
                            .font(.suite(size: 10))
                            .foregroundColor(.gray)
                        Text(gName)
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                    }
                }
                
                Text(schedule.sst_title ?? "제목 없음")
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                
                if let location = schedule.sst_location_title, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.suite(size: 12))
                        Text(location)
                            .font(.suite(size: 13))
                    }
                    .foregroundColor(.gray)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Status Badge & Menu
            VStack(alignment: .trailing, spacing: 4) {
                Text(schedule.status.text)
                    .font(.suite(size: 11, weight: .bold))
                    .foregroundColor(statusColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(statusColor.opacity(0.1))
                    .cornerRadius(4)
                
                Menu {
                    Button(action: onEdit) {
                        Label("수정", systemImage: "pencil")
                    }
                    Button(role: .destructive, action: onDelete) {
                        Label("삭제", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                        .padding(8)
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
    
    private func scheduleDate(from string: String?) -> Date? {
        guard let str = string else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = formatter.date(from: str) { return date }
        
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter.date(from: str)
    }
    
    private var statusColor: Color {
        switch schedule.status {
        case .completed: return .green
        case .ongoing: return .orange
        case .upcoming: return .blue
        case .defaultStatus: return .gray
        }
    }
}

struct ScheduleFormView: View {
    @ObservedObject var viewModel: ScheduleViewModel
    let initialGroupId: Int
    var schedule: Schedule? = nil
    let onSave: () -> Void
    
    @Environment(\.presentationMode) var presentationMode
    
    // Form State
    @State private var selectedGroupId: Int
    @State private var members: [SmapGroupMember] = []
    
    @State private var title: String = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date().addingTimeInterval(3600)
    @State private var isAllDay: Bool = false
    @State private var location: String = ""
    @State private var locationAddress: String?
    @State private var locationLat: Double?
    @State private var locationLong: Double?
    @State private var showingLocationSearch: Bool = false
    @State private var memo: String = ""
    @State private var targetMemberId: Int = 0
    @State private var supplies: String = ""
    @State private var alarm: Int = 0
    
    // Repeat State
    @State private var repeatOption: String = "안함"
    @State private var selectedWeekdays: Set<Int> = []
    
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let repeatOptions = ["안함", "매일", "매주", "매월", "매년"]
    private let weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    
    init(viewModel: ScheduleViewModel, initialGroupId: Int, schedule: Schedule? = nil, onSave: @escaping () -> Void) {
        self.viewModel = viewModel
        self.initialGroupId = initialGroupId
        self.schedule = schedule
        self.onSave = onSave
        
        let startGroupId = schedule?.sgt_idx ?? (initialGroupId > 0 ? initialGroupId : (viewModel.groups.first?.sgt_idx ?? 0))
        _selectedGroupId = State(initialValue: startGroupId)
    }
    
    // Section colors (matching Next.js design)
    private var section1BgColor: Color { Color(red: 224/255, green: 231/255, blue: 255/255) } // Indigo 50
    private var section2BgColor: Color { Color(red: 219/255, green: 234/255, blue: 254/255) } // Blue 50
    private var section3BgColor: Color { Color(red: 220/255, green: 252/255, blue: 231/255) } // Green 50
    private var section4BgColor: Color { Color(red: 255/255, green: 251/255, blue: 235/255) } // Amber 50
    
    private var section1BadgeColor: Color { Color(red: 79/255, green: 70/255, blue: 229/255) }  // Indigo 600
    private var section2BadgeColor: Color { Color(red: 37/255, green: 99/255, blue: 235/255) }  // Blue 600
    private var section3BadgeColor: Color { Color(red: 22/255, green: 163/255, blue: 74/255) }  // Green 600
    private var section4BadgeColor: Color { Color(red: 217/255, green: 119/255, blue: 6/255) }  // Amber 600
    
    // Alarm options
    private var alarmOptions: [(String, Int)] {
        [("없음", 0), ("정시", 1), ("5분 전", 5), ("10분 전", 10), ("15분 전", 15), ("30분 전", 30), ("1시간 전", 60), ("1일 전", 1440)]
    }
    
    @State private var showingAlarmSheet: Bool = false
    @State private var showingRepeatSheet: Bool = false
    @State private var showingDateTimeSheet: Bool = false
    
    var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.98, green: 0.98, blue: 1.0).edgesIgnoringSafeArea(.all)
                
                ScrollView {
                    VStack(spacing: 16) {
                        // Section 1: 그룹 및 멤버 선택
                        modernSection1
                        
                        // Section 2: 일정 제목 및 내용
                        modernSection2
                        
                        // Section 3: 날짜 및 시간
                        modernSection3
                        
                        // Section 4: 추가 설정
                        modernSection4
                        
                        // 저장 버튼
                        saveButton
                            .padding(.top, 8)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
                }
                
                if isLoading {
                    ZStack {
                        Color.black.opacity(0.2).edgesIgnoringSafeArea(.all)
                        VStack(spacing: 12) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: brandColor))
                                .scaleEffect(1.2)
                            Text("저장 중...")
                                .font(.suite(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .padding(24)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.1), radius: 10)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(schedule == nil ? "일정 추가" : "일정 수정")
                        .font(.suite(size: 17, weight: .semibold))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("취소") { 
                    presentationMode.wrappedValue.dismiss() 
                }
                .font(.suite(size: 16))
                .foregroundColor(.gray)
            )
            .onAppear(perform: setupInitialValues)
            .alert(item: Binding<AlertItem?>(
                get: { errorMessage.map { AlertItem(message: $0) } },
                set: { _ in errorMessage = nil }
            )) { item in
                Alert(title: Text("오류"), message: Text(item.message), dismissButton: .default(Text("확인")))
            }
            .sheet(isPresented: $showingAlarmSheet) {
                alarmSelectionSheet
            }
            .sheet(isPresented: $showingRepeatSheet) {
                repeatSelectionSheet
            }
        }
    }
    
    // MARK: - Section 1: 그룹 및 멤버 선택
    private var modernSection1: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section1BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("1")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("그룹 및 멤버 선택")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }
            
            // Group Picker
            if !viewModel.groups.isEmpty {
                Menu {
                    ForEach(viewModel.groups, id: \.sgt_idx) { group in
                        Button(action: {
                            selectedGroupId = group.sgt_idx
                            loadMembers(groupId: group.sgt_idx)
                        }) {
                            HStack {
                                Text(group.sgt_title ?? "알 수 없는 그룹")
                                if selectedGroupId == group.sgt_idx {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text(viewModel.groups.first(where: { $0.sgt_idx == selectedGroupId })?.sgt_title ?? "그룹 선택")
                            .font(.suite(size: 15))
                            .foregroundColor(.primary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                    }
                    .padding(14)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                }
            }
            
            // Member Selection (Avatar Grid)
            if !members.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("대상 멤버")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(members) { member in
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        targetMemberId = member.mt_idx
                                    }
                                }) {
                                    VStack(spacing: 6) {
                                        ZStack {
                                            if let photoUrl = member.mt_file1, !photoUrl.isEmpty {
                                                AsyncImage(url: URL(string: photoUrl.hasPrefix("http") ? photoUrl : "https://nextstep.smap.site\(photoUrl)")) { phase in
                                                    if let image = phase.image {
                                                        image.resizable().aspectRatio(contentMode: .fill)
                                                    } else {
                                                        Image(systemName: "person.circle.fill")
                                                            .resizable()
                                                            .foregroundColor(.gray.opacity(0.3))
                                                    }
                                                }
                                                .frame(width: 48, height: 48)
                                                .clipShape(Circle())
                                            } else {
                                                Image(systemName: "person.circle.fill")
                                                    .resizable()
                                                    .frame(width: 48, height: 48)
                                                    .foregroundColor(.gray.opacity(0.3))
                                            }
                                            
                                            if targetMemberId == member.mt_idx {
                                                Circle()
                                                    .stroke(section1BadgeColor, lineWidth: 3)
                                                    .frame(width: 54, height: 54)
                                                
                                                Image(systemName: "checkmark.circle.fill")
                                                    .font(.suite(size: 16))
                                                    .foregroundColor(section1BadgeColor)
                                                    .background(Color.white.clipShape(Circle()))
                                                    .offset(x: 16, y: 16)
                                            }
                                        }
                                        
                                        Text(member.displayName)
                                            .font(.suite(size: 12, weight: targetMemberId == member.mt_idx ? .bold : .medium))
                                            .foregroundColor(targetMemberId == member.mt_idx ? section1BadgeColor : .gray)
                                            .lineLimit(1)
                                    }
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            } else {
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .gray))
                    Text("멤버를 불러오는 중...")
                        .font(.suite(size: 14))
                        .foregroundColor(.gray)
                }
                .padding()
            }
        }
        .padding(16)
        .background(section1BgColor)
        .cornerRadius(16)
    }
    
    // MARK: - Section 2: 일정 제목 및 내용
    private var modernSection2: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section2BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("2")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("일정 제목 및 내용")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }
            
            // Title Input
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("일정 제목")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    Text("*")
                        .foregroundColor(.red)
                }
                
                TextField("일정 제목을 입력하세요", text: $title)
                    .font(.suite(size: 15))
                    .frame(height: 24)
                    .padding(14)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(title.isEmpty ? Color.red.opacity(0.3) : Color.gray.opacity(0.3), lineWidth: 1)
                    )
                
                HStack {
                    Text("예) 팀 회의, 프로젝트 미팅 등")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                    Spacer()
                    Text("\(title.count)/100")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
            }
            
            // Memo Input
            VStack(alignment: .leading, spacing: 6) {
                Text("일정 내용 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)
                
                TextEditor(text: $memo)
                    .font(.suite(size: 15))
                    .frame(height: 80)
                    .padding(10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                
                HStack {
                    Text("예) 회의 안건, 준비물, 참고사항 등")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                    Spacer()
                    Text("\(memo.count)/500")
                        .font(.suite(size: 12))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(16)
        .background(section2BgColor)
        .cornerRadius(16)
    }
    
    // MARK: - Section 3: 날짜 및 시간
    private var modernSection3: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section3BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("3")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("날짜 및 시간")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }
            
            // All Day Toggle
            HStack {
                Text("하루 종일")
                    .font(.suite(size: 15))
                    .foregroundColor(.primary)
                Spacer()
                Toggle("", isOn: $isAllDay)
                    .labelsHidden()
                    .tint(section3BadgeColor)
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)
            
            // Date/Time Info Card
            VStack(spacing: 12) {
                // Start
                HStack {
                    Text("시작")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(width: 50, alignment: .leading)
                    
                    DatePicker("", selection: $startDate, displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute])
                        .labelsHidden()
                        .datePickerStyle(CompactDatePickerStyle())
                        .accentColor(section3BadgeColor)
                }
                
                Divider()
                
                // End
                HStack {
                    Text("종료")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(width: 50, alignment: .leading)
                    
                    DatePicker("", selection: $endDate, displayedComponents: isAllDay ? [.date] : [.date, .hourAndMinute])
                        .labelsHidden()
                        .datePickerStyle(CompactDatePickerStyle())
                        .accentColor(section3BadgeColor)
                }
            }
            .padding(14)
            .background(Color.white)
            .cornerRadius(12)
            
            // Repeat & Alarm Row (moved from section 4)
            HStack(spacing: 12) {
                // Repeat Button
                VStack(alignment: .leading, spacing: 6) {
                    Text("반복")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    
                    Button(action: { showingRepeatSheet = true }) {
                        HStack {
                            Text(repeatOption == "매주" && !selectedWeekdays.isEmpty ? "매주 \(selectedWeekdays.sorted().map { weekdays[$0] }.joined(separator: ","))" : repeatOption)
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        .padding(12)
                        .background(Color.white)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                
                // Alarm Button
                VStack(alignment: .leading, spacing: 6) {
                    Text("알림")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                    
                    Button(action: { showingAlarmSheet = true }) {
                        HStack {
                            Text(alarmOptions.first(where: { $0.1 == alarm })?.0 ?? "없음")
                                .font(.suite(size: 14))
                                .foregroundColor(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                        }
                        .padding(12)
                        .background(Color.white)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(section3BgColor)
        .cornerRadius(16)
    }
    
    // MARK: - Section 4: 추가 설정
    private var modernSection4: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section Header
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(section4BadgeColor)
                        .frame(width: 24, height: 24)
                    Text("4")
                        .font(.suite(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("추가 설정")
                    .font(.suite(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
            }
            
            // Location
            VStack(alignment: .leading, spacing: 6) {
                Text("장소 정보 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)
                
                Button(action: { showingLocationSearch = true }) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "mappin.and.ellipse")
                                .foregroundColor(section4BadgeColor)
                            Text(location.isEmpty ? "장소를 검색하세요" : location)
                                .font(.suite(size: 14))
                                .foregroundColor(location.isEmpty ? .gray : .primary)
                            Spacer()
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.gray)
                        }
                        
                        if let addr = locationAddress, !addr.isEmpty {
                            Text(addr)
                                .font(.suite(size: 12))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                        }
                    }
                    .padding(12)
                    .background(Color.white)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                }
            }
            .sheet(isPresented: $showingLocationSearch) {
                NavigationView {
                    LocationSearchView { place in
                        self.location = place.place_name
                        self.locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                        if let x = Double(place.x), let y = Double(place.y) {
                            self.locationLong = x
                            self.locationLat = y
                        }
                    }
                }
            }
            
            // Supplies
            VStack(alignment: .leading, spacing: 6) {
                Text("준비물 (선택)")
                    .font(.suite(size: 14, weight: .medium))
                    .foregroundColor(.gray)
                
                TextField("준비물을 입력하세요", text: $supplies)
                    .font(.suite(size: 14))
                    .padding(12)
                    .background(Color.white)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
            }
        }
        .padding(16)
        .background(section4BgColor)
        .cornerRadius(16)
    }
    
    // MARK: - Save Button
    private var saveButton: some View {
        Button(action: saveSchedule) {
            HStack {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text(schedule == nil ? "일정 추가" : "일정 수정")
                        .font(.suite(size: 16, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [brandColor, Color(red: 0, green: 26/255, blue: 138/255)]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .foregroundColor(.white)
            .cornerRadius(14)
            .shadow(color: brandColor.opacity(0.3), radius: 8, x: 0, y: 4)
        }
        .disabled(title.isEmpty || isLoading)
        .opacity(title.isEmpty ? 0.6 : 1.0)
    }
    
    // MARK: - Alarm Selection Sheet
    private var alarmSelectionSheet: some View {
        NavigationView {
            List {
                ForEach(alarmOptions, id: \.1) { option in
                    Button(action: {
                        alarm = option.1
                        showingAlarmSheet = false
                    }) {
                        HStack {
                            Text(option.0)
                                .font(.suite(size: 16))
                                .foregroundColor(.primary)
                            Spacer()
                            if alarm == option.1 {
                                Image(systemName: "checkmark")
                                    .foregroundColor(section4BadgeColor)
                            }
                        }
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("알림 설정")
                        .font(.suite(size: 17, weight: .semibold))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("완료") { showingAlarmSheet = false }.font(.suite(size: 16)))
        }
    }
    
    // MARK: - Repeat Selection Sheet
    private var repeatSelectionSheet: some View {
        NavigationView {
            VStack(spacing: 0) {
                List {
                    ForEach(repeatOptions, id: \.self) { option in
                        Button(action: {
                            repeatOption = option
                            if option != "매주" {
                                selectedWeekdays.removeAll()
                                showingRepeatSheet = false
                            }
                        }) {
                            HStack {
                                Text(option)
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Spacer()
                                if repeatOption == option {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(section3BadgeColor)
                                }
                            }
                        }
                    }
                }
                
                // Weekday Selection (if 매주 selected)
                if repeatOption == "매주" {
                    VStack(spacing: 12) {
                        Text("반복할 요일 선택")
                            .font(.suite(size: 14, weight: .medium))
                            .foregroundColor(.gray)
                        
                        HStack(spacing: 10) {
                            ForEach(0..<7) { index in
                                Button(action: {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        if selectedWeekdays.contains(index) {
                                            selectedWeekdays.remove(index)
                                        } else {
                                            selectedWeekdays.insert(index)
                                        }
                                    }
                                }) {
                                    Text(weekdays[index])
                                        .font(.suite(size: 14, weight: .bold))
                                        .frame(width: 38, height: 38)
                                        .background(selectedWeekdays.contains(index) ? section3BadgeColor : Color.gray.opacity(0.1))
                                        .foregroundColor(selectedWeekdays.contains(index) ? .white : .primary)
                                        .clipShape(Circle())
                                }
                            }
                        }
                        
                        Button("완료") {
                            showingRepeatSheet = false
                        }
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 40)
                        .padding(.vertical, 12)
                        .background(section3BadgeColor)
                        .cornerRadius(10)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(section3BgColor)
                }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("반복 설정")
                        .font(.suite(size: 17, weight: .semibold))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("완료") { showingRepeatSheet = false }.font(.suite(size: 16)))
        }
    }
    
    // Old sections removed - now using modernSection1, modernSection2, modernSection3, modernSection4
    
    private func setupInitialValues() {
        loadMembers(groupId: selectedGroupId)
        
        if let schedule = schedule {
            title = schedule.sst_title ?? ""
            location = schedule.sst_location_title ?? ""
            locationAddress = schedule.sst_location_add
            locationLat = schedule.sst_location_lat
            locationLong = schedule.sst_location_long
            memo = schedule.sst_memo ?? ""
            isAllDay = schedule.sst_all_day == "Y"
            supplies = schedule.sst_supplies ?? ""
            targetMemberId = schedule.mt_idx ?? 0
            
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            if let sDateStr = schedule.sst_sdate, let sDate = formatter.date(from: sDateStr) { startDate = sDate }
            if let eDateStr = schedule.sst_edate, let eDate = formatter.date(from: eDateStr) { endDate = eDate }
            
            // Parse Repeat
            if let v = schedule.sst_repeat_json_v, !v.isEmpty {
                 if v.contains("매주") {
                     repeatOption = "매주"
                 } else if repeatOptions.contains(v) {
                     repeatOption = v
                 }
            }
        } else {
            if let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let mtIdx = Int(mtIdxStr) {
                targetMemberId = mtIdx
            }
        }
    }
    
    private func loadMembers(groupId: Int) {
        Task {
            do {
                let fetched = try await GroupService.shared.getGroupMembers(sgtIdx: groupId)
                DispatchQueue.main.async {
                    self.members = fetched
                    // Select member
                    if !fetched.contains(where: { $0.mt_idx == targetMemberId }) {
                        if let mtIdxStr = UserDefaults.standard.string(forKey: "mt_idx"), let mtIdx = Int(mtIdxStr), fetched.contains(where: { $0.mt_idx == mtIdx }) {
                            targetMemberId = mtIdx
                        } else {
                            targetMemberId = fetched.first?.mt_idx ?? 0
                        }
                    }
                }
            } catch {
                print("Error loading members: \(error)")
            }
        }
    }
    
    private func saveSchedule() {
        guard !title.isEmpty else { return }
        
        isLoading = true
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        
        let sDateStr = formatter.string(from: startDate)
        let eDateStr = formatter.string(from: endDate)
        
        // Repeat JSON
        var repeatJson: String? = nil
        var repeatJsonV: String? = nil
        if repeatOption != "안함" {
            var r1 = "0"
            switch repeatOption {
            case "매일": r1 = "1"
            case "매월": r1 = "2"
            case "매주": r1 = "3"
            case "매년": r1 = "4"
            default: break
            }
            repeatJson = "{\"r1\":\"\(r1)\"}"
            repeatJsonV = repeatOption
            if repeatOption == "매주" {
                let sortedDays = selectedWeekdays.sorted()
                if !sortedDays.isEmpty {
                     let dayString = sortedDays.map { weekdays[$0] }.joined(separator: ",")
                     repeatJsonV = "매주 \(dayString)"
                }
            }
        }
        
        Task {
            do {
                let success: Bool
                if let schedule = schedule {
                    let request = UpdateScheduleRequest(
                        sst_idx: schedule.id,
                        groupId: selectedGroupId,
                        sst_title: title,
                        sst_sdate: sDateStr,
                        sst_edate: eDateStr,
                        sst_all_day: isAllDay ? "Y" : "N",
                        sst_location_title: location,
                        sst_location_add: locationAddress,
                        sst_location_lat: locationLat,
                        sst_location_long: locationLong,
                        sst_memo: memo,
                        sst_alram: alarm == 0 ? nil : alarm,
                        sst_supplies: supplies,
                        sst_repeat_json: repeatJson,
                        sst_repeat_json_v: repeatJsonV
                    )
                    success = try await ScheduleService.shared.updateSchedule(request)
                } else {
                    let request = CreateScheduleRequest(
                        groupId: selectedGroupId,
                        targetMemberId: targetMemberId,
                        sst_title: title,
                        sst_sdate: sDateStr,
                        sst_edate: eDateStr,
                        sst_all_day: isAllDay ? "Y" : "N",
                        sst_location_title: location,
                        sst_location_add: locationAddress,
                        sst_location_lat: locationLat,
                        sst_location_long: locationLong,
                        sst_memo: memo,
                        sst_alram: alarm == 0 ? nil : alarm,
                        sst_supplies: supplies,
                        sst_repeat_json: repeatJson,
                        sst_repeat_json_v: repeatJsonV
                    )
                    success = try await ScheduleService.shared.createSchedule(request)
                }
                
                DispatchQueue.main.async {
                    if success {
                        onSave()
                        presentationMode.wrappedValue.dismiss()
                    } else {
                        errorMessage = "저장에 실패했습니다."
                    }
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

@MainActor
class ScheduleViewModel: ObservableObject {
    @Published var schedules: [Schedule] = []
    @Published var groupMembers: [SmapGroupMember] = []
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var selectedDate: Date = Date()
    @Published var currentMonth: Date = Date()
    @Published var selectedMemberIds: Set<Int> = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var userPermissions: UserPermissions?
    
    private let scheduleService = ScheduleService.shared
    private let groupService = GroupService.shared
    private var cancellables = Set<AnyCancellable>()
    
    var filteredSchedules: [Schedule] {
        let schedulesForDate = schedules.filter { schedule in
            guard let startDate = schedule.startDateOnly else { return false }
            return Calendar.current.isDate(startDate, inSameDayAs: selectedDate)
        }
        if selectedMemberIds.isEmpty {
            return schedulesForDate
        } else {
            return schedulesForDate.filter { schedule in
                if let mtIdx = schedule.mt_idx { return selectedMemberIds.contains(mtIdx) }
                return false
            }
        }
    }
    
    var datesWithEvents: Set<Date> {
        let dates = schedules.compactMap { $0.startDateOnly }
        return Set(dates)
    }
    
    init() { fetchGroups() }
    
    func fetchGroups() {
        isLoading = true
        Task {
            do {
                let fetchedGroups = try await groupService.getCurrentUserGroups()
                DispatchQueue.main.async {
                    self.groups = fetchedGroups
                    if self.selectedGroup == nil, let firstGroup = fetchedGroups.first { self.selectGroup(firstGroup) }
                    self.isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func fetchSchedules() {
        guard let group = selectedGroup else { return }
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: currentMonth))!
        let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth)!
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let startDateStr = formatter.string(from: calendar.startOfDay(for: startOfMonth))
        let endDateStr = formatter.string(from: calendar.date(bySettingHour: 23, minute: 59, second: 59, of: endOfMonth)!)
        isLoading = true
        Task {
            do {
                let data = try await scheduleService.getGroupSchedules(groupId: group.sgt_idx, startDate: startDateStr, endDate: endDateStr)
                DispatchQueue.main.async {
                    self.schedules = data.schedules
                    self.groupMembers = data.groupMembers
                    self.userPermissions = data.userPermission
                    self.isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func selectGroup(_ group: SmapGroup) {
        selectedGroup = group
        selectedMemberIds.removeAll()
        fetchSchedules()
    }
    
    func changeMonth(by value: Int) {
        if let newMonth = Calendar.current.date(byAdding: .month, value: value, to: currentMonth) {
            currentMonth = newMonth
            fetchSchedules()
        }
    }
    
    func goToToday() {
        let now = Date()
        selectedDate = now
        currentMonth = now
        fetchSchedules()
    }
    
    func selectDate(_ date: Date) { selectedDate = date }
    func toggleMemberSelection(_ memberId: Int) {
        if selectedMemberIds.contains(memberId) { selectedMemberIds.remove(memberId) }
        else { selectedMemberIds.insert(memberId) }
    }
    
    func deleteSchedule(_ schedule: Schedule) {
        guard let groupId = selectedGroup?.sgt_idx else { return }
        isLoading = true
        Task {
            do {
                let success = try await scheduleService.deleteSchedule(sstIdx: schedule.sst_idx, groupId: groupId)
                if success { fetchSchedules() }
                else {
                    DispatchQueue.main.async {
                        self.errorMessage = "일정 삭제에 실패했습니다."
                        self.isLoading = false
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}


extension Color {
    var uiColor: UIColor {
        return UIColor(self)
    }
}

struct RoundedCorners: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}

// MARK: - Account Management Views (Moved for Scope)

struct EditProfileView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    @State private var name: String = ""
    @State private var nickname: String = ""
    @State private var birthDate: Date = Date()
    @State private var gender: Int = 1
    
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
            }
            _gender = State(initialValue: user.mt_gender ?? 1)
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
                        
                        Text("생년월일")
                            .font(.suite(size: 16))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                            .layoutPriority(1)
                            .frame(width: 100, alignment: .leading)
                        
                        Spacer()
                        
                        DatePicker("", selection: $birthDate, displayedComponents: .date)
                            .labelsHidden()
                            .datePickerStyle(.compact)
                            .accentColor(brandColor)
                            .fixedSize()
                            .frame(width: 130, height: 34, alignment: .trailing)
                            .clipped()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(height: 52)
                    
                    Divider().padding(.leading, 52)
                    
                    HStack(spacing: 12) {
                        Image(systemName: "person.2.fill")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.purple)
                            .cornerRadius(6)
                        
                        Text("성별")
                            .font(.suite(size: 16))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                            .layoutPriority(1)
                            .frame(width: 100, alignment: .leading)
                        
                        Spacer()
                        
                        HStack(spacing: 8) {
                            GenderChip(title: "남성", isSelected: gender == 1) { gender = 1 }
                            GenderChip(title: "여성", isSelected: gender == 2) { gender = 2 }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
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
        let birthStr = dateFormatter.string(from: birthDate)
        
        Task {
            do {
                let response = try await authService.updateProfile(
                    name: name,
                    nickname: nickname,
                    birth: birthStr,
                    gender: gender
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

struct ChangePasswordView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    @State private var currentPassword: String = ""
    @State private var newPassword: String = ""
    @State private var confirmPassword: String = ""
    
    @State private var isLoading: Bool = false
    @State private var showAlert: Bool = false
    @State private var alertMessage: String = ""
    
    // Password Strength
    private var isLengthValid: Bool { newPassword.count >= 8 && newPassword.count <= 20 }
    private var hasLetter: Bool { newPassword.rangeOfCharacter(from: .letters) != nil }
    private var hasNumber: Bool { newPassword.rangeOfCharacter(from: .decimalDigits) != nil }
    private var hasSpecial: Bool { newPassword.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*()-_=+[]{}|;:'\",.<>/?")) != nil }
    private var isPasswordStrong: Bool { isLengthValid && hasLetter && hasNumber && hasSpecial }
    private var isPasswordMatch: Bool { !newPassword.isEmpty && newPassword == confirmPassword }
    
    private var isSocialUser: Bool {
        guard let type = authService.currentUser?.mt_type else { return false }
        return type != 1
    }
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if isSocialUser {
                    socialUserView
                        .padding(.top, 60)
                } else {
                    changePasswordForm
                }
            }
            .padding(.top, 20)
        }
        .background(Color(UIColor.secondarySystemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("비밀번호 변경")
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
                title: Text("알림").font(.suite(size: 17, weight: .bold)),
                message: Text(alertMessage).font(.suite(size: 15)),
                dismissButton: .default(Text("확인").font(.suite(size: 16, weight: .semibold))) {
                    if alertMessage.contains("성공") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            )
        }
    }
    
    private var socialUserView: some View {
        VStack(spacing: 24) {
            Image(systemName: "shield.slash")
                .font(.system(size: 60))
                .foregroundColor(.orange)
            
            Text("소셜 로그인 사용자는\n비밀번호를 변경할 수 없습니다.")
                .font(.suite(size: 20, weight: .bold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            Text("Google 또는 Apple 계정을 통해 로그인하신 경우, 해당 서비스의 설정에서 비밀번호를 관리해 주세요.")
                .font(.suite(size: 15))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            Button(action: { presentationMode.wrappedValue.dismiss() }) {
                Text("뒤로 가기")
                    .font(.suite(size: 17, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(brandColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
        }
        .padding(24)
        .background(Color(UIColor.systemBackground))
        .cornerRadius(20)
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        .padding(.horizontal, 16)
    }
    
    private var changePasswordForm: some View {
        VStack(spacing: 24) {
            // Header Card (Premium Gradient)
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("비밀번호 변경")
                            .font(.suite(size: 24, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text("보안을 위해 8~20자의 영문, 숫자,\n특수문자를 조합하여 설정해 주세요.")
                            .font(.suite(size: 14))
                            .foregroundColor(.white.opacity(0.85))
                            .lineSpacing(4)
                    }
                    Spacer()
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.white.opacity(0.3))
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [brandColor, Color(red: 102/255, green: 126/255, blue: 234/255)]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(24)
            .shadow(color: brandColor.opacity(0.3), radius: 12, x: 0, y: 8)
            .padding(.horizontal, 16)
            .padding(.top, 8)

            // Input Fields Card
            VStack(spacing: 20) {
                PasswordFormRow(icon: "lock.fill", iconColor: brandColor, label: "현재 비밀번호", text: $currentPassword, placeholder: "현재 비밀번호를 입력하세요")
                
                PasswordFormRow(icon: "key.fill", iconColor: brandColor, label: "새 비밀번호", text: $newPassword, placeholder: "새 비밀번호 (8-20자)")
                
                PasswordFormRow(icon: "checkmark.circle.fill", iconColor: .green, label: "새 비밀번호 확인", text: $confirmPassword, placeholder: "비밀번호를 한번 더 입력해 주세요")
            }
            .padding(20)
            .background(Color(UIColor.systemBackground))
            .cornerRadius(20)
            .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
            .padding(.horizontal, 16)

            // Password Strength Indicators
            VStack(alignment: .leading, spacing: 12) {
                Text("비밀번호 체크")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.primary)
                    .padding(.leading, 4)
                
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 10) {
                        StrengthRow(title: "8-20자 이내", isValid: isLengthValid)
                        StrengthRow(title: "영문/숫자/특수문자", isValid: isPasswordStrong)
                    }
                    Spacer()
                    VStack(alignment: .leading, spacing: 10) {
                        StrengthRow(title: "비밀번호 일치", isValid: isPasswordMatch)
                        Spacer().frame(height: 12)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(UIColor.systemBackground))
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
            }
            .padding(.horizontal, 16)
            
            // Action Button
            Button(action: handleSave) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .padding(.trailing, 8)
                    }
                    Text("비밀번호 변경 완료")
                        .font(.suite(size: 17, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(canSave ? brandColor : Color.gray.opacity(0.3))
                .foregroundColor(.white)
                .cornerRadius(12)
                .shadow(color: canSave ? brandColor.opacity(0.2) : Color.clear, radius: 8, x: 0, y: 4)
            }
            .disabled(!canSave || isLoading)
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
        }
    }
    
    private var canSave: Bool {
        !currentPassword.isEmpty && isPasswordStrong && isPasswordMatch
    }
    
    private func handleSave() {
        isLoading = true
        
        Task {
            do {
                let response = try await authService.changePassword(
                    current: currentPassword,
                    new: newPassword
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

struct PasswordFormRow: View {
    let icon: String
    let iconColor: Color
    let label: String
    @Binding var text: String
    let placeholder: String
    @State private var isVisible: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(iconColor)
                Text(label)
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(.primary)
            }
            .padding(.leading, 4)
            
            ZStack(alignment: .trailing) {
                if isVisible {
                    TextField(placeholder, text: $text)
                        .autocapitalization(.none)
                } else {
                    SecureField(placeholder, text: $text)
                        .autocapitalization(.none)
                }
                
                Button(action: { isVisible.toggle() }) {
                    Image(systemName: isVisible ? "eye.slash.fill" : "eye.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.gray.opacity(0.5))
                        .padding(10)
                }
            }
            .font(.suite(size: 15))
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(UIColor.secondarySystemBackground).opacity(0.5))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.gray.opacity(0.1), lineWidth: 1)
            )
        }
    }
}

struct StrengthRow: View {
    let title: String
    let isValid: Bool
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 12))
                .foregroundColor(isValid ? .green : .gray.opacity(0.5))
            Text(title)
                .font(.suite(size: 12))
                .foregroundColor(isValid ? .green : .gray)
        }
        .padding(.leading, 4)
    }
}

// MARK: - Withdraw View

struct WithdrawReason: Identifiable {
    let id: Int
    let icon: String
    let text: String
}

struct WithdrawView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var authService = AuthService.shared
    
    @State private var currentStep = 1
    @State private var password = ""
    @State private var showPassword = false
    @State private var selectedReasons: Set<String> = []
    @State private var etcReason = ""
    @State private var agreement = false
    
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showSuccessAlert = false
    @State private var showConfirmWithdrawAlert = false
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let errorRed = Color(red: 220/255, green: 38/255, blue: 38/255)
    
    let reasonsArr = [
        WithdrawReason(id: 1, icon: "😴", text: "자주 사용하지 않아요"),
        WithdrawReason(id: 2, icon: "🚫", text: "원하는 기능 부족"),
        WithdrawReason(id: 3, icon: "😕", text: "서비스가 불편해요"),
        WithdrawReason(id: 4, icon: "🔒", text: "개인정보 우려"),
        WithdrawReason(id: 5, icon: "❓", text: "기타 이유")
    ]
    
    private var isSocialLogin: Bool {
        guard let user = authService.currentUser else { return false }
        return user.mt_type != 1
    }
    
    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                withdrawHeader
                withdrawStepIndicator
                
                ScrollView {
                    VStack(spacing: 24) {
                        if currentStep == 1 {
                            stepOneView
                        } else if currentStep == 2 {
                            stepTwoView
                        } else {
                            stepThreeView
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
                
                withdrawBottomButton
            }
        }
        .navigationBarHidden(true)
        .alert(isPresented: $showSuccessAlert) {
            Alert(
                title: Text("탈퇴 완료"),
                message: Text("회원 탈퇴가 완료되었습니다. 그동안 서비스를 이용해주셔서 감사합니다."),
                dismissButton: .default(Text("확인")) { }
            )
        }
        .alert(isPresented: $showConfirmWithdrawAlert) {
            Alert(
                title: Text("정말 탈퇴하시겠습니까?"),
                message: Text("모든 데이터가 삭제되며 복구할 수 없습니다."),
                primaryButton: .destructive(Text("탈퇴")) {
                    performWithdraw()
                },
                secondaryButton: .cancel(Text("취소"))
            )
        }
    }
    
    // MARK: - Extracted Views
    
    private var withdrawHeader: some View {
        HStack {
            Button(action: {
                if currentStep > 1 {
                    withAnimation { currentStep -= 1 }
                } else {
                    presentationMode.wrappedValue.dismiss()
                }
            }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.primary)
                    .padding(8)
            }
            
            Spacer()
            
            Text("회원탈퇴")
                .font(.suite(size: 18, weight: .bold))
            
            Spacer()
            
            Image(systemName: "chevron.left")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.clear)
                .padding(8)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color(UIColor.systemBackground))
    }
    
    private var withdrawStepIndicator: some View {
        HStack(spacing: 12) {
            ForEach(1...3, id: \.self) { step in
                HStack(spacing: 0) {
                    ZStack {
                        Circle()
                            .fill(step <= currentStep ? brandColor : Color.gray.opacity(0.2))
                            .frame(width: 28, height: 28)
                        
                        if step < currentStep {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else {
                            Text("\(step)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(step <= currentStep ? .white : .gray)
                        }
                    }
                    
                    if step < 3 {
                        Rectangle()
                            .fill(step < currentStep ? brandColor : Color.gray.opacity(0.2))
                            .frame(width: 24, height: 2)
                            .padding(.leading, 8)
                    }
                }
            }
        }
        .padding(.vertical, 20)
    }
    
    private var withdrawBottomButton: some View {
        VStack(spacing: 0) {
            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.suite(size: 13))
                    .foregroundColor(errorRed)
                    .padding(.bottom, 12)
            }
            
            Button(action: handleNext) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .padding(.trailing, 8)
                    }
                    Text(currentStep == 3 ? "탈퇴하기" : "다음")
                        .font(.suite(size: 16, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(canProceed ? (currentStep == 3 ? errorRed : brandColor) : Color.gray.opacity(0.3))
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(!canProceed || isLoading)
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .padding(.top, 12)
    }
    
    private var canProceed: Bool {
        switch currentStep {
        case 1:
            return isSocialLogin || !password.isEmpty
        case 2:
            if selectedReasons.isEmpty { return false }
            if selectedReasons.contains("기타 이유") && etcReason.trimmingCharacters(in: .whitespaces).isEmpty {
                return false
            }
            return true
        case 3:
            return agreement
        default:
            return false
        }
    }
    
    // MARK: - Steps Views
    
    private var stepOneView: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("본인 확인")
                    .font(.suite(size: 22, weight: .bold))
                Text(isSocialLogin ? "소셜 계정으로 로그인 중입니다.\n본인 확인이 완료되었습니다." : "계정 보안을 위해 비밀번호를 입력해주세요.")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 8)
            
            if isSocialLogin {
                socialLoginIndicator
            } else {
                passwordInputField
            }
            
            securityInfoCard
        }
    }
    
    private var socialLoginIndicator: some View {
        HStack(spacing: 12) {
            let userType = authService.currentUser?.mt_type ?? 0
            Group {
                if userType == 3 {
                    Image(systemName: "applelogo")
                        .font(.system(size: 24))
                    Text("Apple ID로 로그인됨")
                } else if userType == 4 {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                    Text("Google 계정으로 로그인됨")
                } else if userType == 2 {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.yellow)
                    Text("카카오 계정으로 로그인됨")
                } else {
                    Image(systemName: "person.badge.key.fill")
                        .font(.system(size: 24))
                    Text("소셜 계정으로 로그인됨")
                }
            }
            .font(.suite(size: 16, weight: .medium))
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
    }
    
    private var passwordInputField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("비밀번호")
                .font(.suite(size: 14, weight: .medium))
                .foregroundColor(.secondary)
            
            HStack {
                if showPassword {
                    TextField("현재 비밀번호", text: $password)
                        .font(.suite(size: 16))
                } else {
                    SecureField("현재 비밀번호", text: $password)
                        .font(.suite(size: 16))
                }
                
                Button(action: { showPassword.toggle() }) {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .foregroundColor(.gray)
                }
            }
            .padding()
            .background(Color.white)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
        }
    }
    
    private var securityInfoCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "shield.lefthalf.filled")
                .foregroundColor(brandColor)
                .font(.system(size: 18))
            
            VStack(alignment: .leading, spacing: 4) {
                Text("보안 강화")
                    .font(.suite(size: 15, weight: .bold))
                Text("탈퇴 전 본인 확인 과정을 통해 소중한 정보를 안전하게 보호합니다.")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(brandColor.opacity(0.05))
        .cornerRadius(12)
    }
    
    private var stepTwoView: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Text("탈퇴 사유")
                    .font(.suite(size: 22, weight: .bold))
                Text("서비스 개선을 위해 소중한 의견을 들려주세요 (중복 선택 가능)")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 10) {
                ForEach(reasonsArr) { reason in
                    Button(action: {
                        if selectedReasons.contains(reason.text) {
                            selectedReasons.remove(reason.text)
                        } else {
                            selectedReasons.insert(reason.text)
                        }
                    }) {
                        HStack {
                            Text(reason.icon)
                                .font(.system(size: 20))
                                .frame(width: 32)
                            
                            Text(reason.text)
                                .font(.suite(size: 15, weight: .medium))
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            if selectedReasons.contains(reason.text) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(brandColor)
                            } else {
                                Circle()
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                    .frame(width: 22, height: 22)
                            }
                        }
                        .padding()
                        .background(selectedReasons.contains(reason.text) ? brandColor.opacity(0.05) : Color.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(selectedReasons.contains(reason.text) ? brandColor : Color.clear, lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
                    }
                }
            }
            
            if selectedReasons.contains("기타 이유") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("상세 사유")
                        .font(.suite(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    
                    TextEditor(text: $etcReason)
                        .font(.suite(size: 14))
                        .frame(height: 100)
                        .padding(8)
                        .background(Color.white)
                        .cornerRadius(12)
                        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
                }
            }
        }
    }
    
    private var stepThreeView: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text("최종 확인")
                    .font(.suite(size: 22, weight: .bold))
                Text("탈퇴 전 주의사항을 꼭 확인해주세요.")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text("계정 정보 및 데이터 영구 삭제")
                        .font(.suite(size: 15, weight: .bold))
                }
                
                Text("탈퇴 시 회원의 모든 프로필 정보, 활동 내역, 설정 정보가 즉시 삭제되며 복구가 불가능합니다.")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.leading, 32)
                
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .foregroundColor(.orange)
                    Text("재가입 제한 안내")
                        .font(.suite(size: 15, weight: .bold))
                }
                
                Text("탈퇴 후 30일 동안 동일한 정보로 재가입이 제한될 수 있습니다.")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.leading, 32)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .cornerRadius(16)
            .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 4)
            
            Button(action: { agreement.toggle() }) {
                HStack(spacing: 12) {
                    Image(systemName: agreement ? "checkmark.square.fill" : "square")
                        .font(.system(size: 20))
                        .foregroundColor(agreement ? brandColor : .gray)
                    
                    Text("안내사항을 모두 확인하였으며, 이에 동의합니다.")
                        .font(.suite(size: 14))
                        .foregroundColor(.primary)
                }
            }
            .padding(.top, 8)
        }
    }
    
    // MARK: - Actions
    
    private func handleNext() {
        errorMessage = ""
        
        if currentStep == 1 {
            if isSocialLogin {
                withAnimation { currentStep = 2 }
            } else {
                verifyPassword()
            }
        } else if currentStep == 2 {
            withAnimation { currentStep = 3 }
        } else {
            showConfirmWithdrawAlert = true
        }
    }
    
    private func verifyPassword() {
        isLoading = true
        Task {
            do {
                let response = try await authService.verifyPassword(password: password)
                await MainActor.run {
                    isLoading = false
                    if response.success {
                        withAnimation { currentStep = 2 }
                    } else {
                        errorMessage = response.message
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func performWithdraw() {
        isLoading = true
        
        let primaryReason = selectedReasons.first ?? "기타 이유"
        let reasonMapping: [String: Int] = [
            "자주 사용하지 않아요": 1,
            "원하는 기능 부족": 2,
            "서비스가 불편해요": 3,
            "개인정보 우려": 4,
            "기타 이유": 5
        ]
        let reasonIdx = reasonMapping[primaryReason] ?? 5
        
        Task {
            do {
                let response = try await authService.withdraw(
                    reasonIdx: reasonIdx,
                    etcReason: selectedReasons.contains("기타 이유") ? etcReason : nil,
                    reasons: Array(selectedReasons)
                )
                
                await MainActor.run {
                    isLoading = false
                    if response.success {
                        showSuccessAlert = true
                    } else {
                        errorMessage = response.message
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

extension DateFormatter {
    static let yyyyMMdd: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
