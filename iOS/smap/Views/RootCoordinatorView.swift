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
                print("✅ [RootCoordinator] 로그인 상태 - 프로필 갱신 후 MainView로 이동")

                // 앱 시작 시 사용자 프로필 및 아바타 이미지 갱신
                Task {
                    do {
                        let updatedUser = try await self.authService.fetchUserProfile()
                        print("✅ [RootCoordinator] 사용자 프로필 갱신 완료: \(updatedUser.displayName)")

                        // 아바타 이미지 미리 캐시 (있는 경우)
                        if let avatarPath = updatedUser.mt_file1,
                           let avatarUrl = AuthService.getProfileImageURL(avatarPath) {
                            self.prefetchAvatarImage(url: avatarUrl)
                        }
                    } catch {
                        print("⚠️ [RootCoordinator] 프로필 갱신 실패 (오프라인 모드로 계속): \(error)")
                    }
                }

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

    /// 아바타 이미지 미리 다운로드 및 캐시
    private func prefetchAvatarImage(url: URL) {
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let data = data, let _ = UIImage(data: data) {
                print("✅ [RootCoordinator] 아바타 이미지 캐시 완료: \(url.lastPathComponent)")
            } else if let error = error {
                print("⚠️ [RootCoordinator] 아바타 이미지 캐시 실패: \(error.localizedDescription)")
            }
        }.resume()
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

extension Color {
    var uiColor: UIColor {
        return UIColor(self)
    }
}

extension DateFormatter {
    static let yyyyMMdd: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
