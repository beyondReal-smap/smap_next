//
//  RootView.swift
//  smap
//
//  Root navigation view — replaces IntroView (UIViewController) logic.
//  Manages app-level navigation state: splash -> login / main.
//

import SwiftUI
import UIKit

struct RootView: View {

    @State private var appState: AppLaunchState = .splash
    @State private var forceUpdateMin: String? = nil

    // Register-flow transient state
    @State private var registerSocialData: [String: Any]?
    @State private var loginPrefilledPhone: String?

    // MARK: - State enum

    enum AppLaunchState {
        case splash
        case authenticated
        case unauthenticated
        case register
        case forceUpdate
    }

    // MARK: - Body

    var body: some View {
        Group {
            switch appState {
            case .splash:
                SplashView()
                    .task { await checkAuth() }

            case .authenticated:
                MainTabView()

            case .unauthenticated:
                loginContent

            case .register:
                registerContent

            case .forceUpdate:
                ForceUpdateView(minVersion: forceUpdateMin ?? "")
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState)
        // External navigation requests (replaces IntroView static calls)
        .onReceive(NotificationCenter.default.publisher(for: .navigateToMain)) { _ in
            loginPrefilledPhone = nil
            registerSocialData = nil
            appState = .authenticated
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToLogin)) { notification in
            loginPrefilledPhone = notification.userInfo?["prefilledPhone"] as? String
            appState = .unauthenticated
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToRegister)) { notification in
            registerSocialData = notification.userInfo?["socialData"] as? [String: Any]
            appState = .register
        }
        // Legacy "logout" notification (posted by AuthService.shared.logout)
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("logout"))) { _ in
            loginPrefilledPhone = nil
            appState = .unauthenticated
        }
    }

    // MARK: - Auth check (replaces IntroView.checkAuthAndNavigate)

    private func checkAuth() async {
        // Minimum splash display time (matches original 2-second delay)
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // 강제 업데이트 체크 — 네트워크 실패는 통과(앱 차단보다 통과 우선)
        if let min = await fetchForceUpdateMinIfRequired() {
            forceUpdateMin = min
            appState = .forceUpdate
            return
        }

        // Run data migration for existing users
        DataMigration.migrateIfNeeded()

        if AuthService.shared.isLoggedIn {
            appState = .authenticated
        } else {
            appState = .unauthenticated
        }
    }

    /// /app/version-check 호출. force_update=true이면 최소 버전을 반환, 아니면 nil.
    private func fetchForceUpdateMinIfRequired() async -> String? {
        let currentVersion = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0.0.0"
        do {
            let response: AppVersionCheckResponse = try await APIClient.shared.request(
                .appVersionCheck(platform: "ios", version: currentVersion)
            )
            return response.force_update ? (response.min_supported_version ?? "") : nil
        } catch {
            return nil
        }
    }

    // MARK: - Sub-views

    @ViewBuilder
    private var loginContent: some View {
        LoginView(
            prefilledPhone: loginPrefilledPhone,
            onLoginSuccess: {
                appState = .authenticated
            },
            onNavigateToRegister: { socialData in
                registerSocialData = socialData
                appState = .register
            }
        )
    }

    @ViewBuilder
    private var registerContent: some View {
        NativeRegisterView(
            onComplete: {
                registerSocialData = nil
                if AuthService.shared.isLoggedIn {
                    appState = .authenticated
                } else {
                    loginPrefilledPhone = nil
                    appState = .unauthenticated
                }
            },
            socialData: registerSocialData,
            onExistingUser: { phone in
                registerSocialData = nil
                loginPrefilledPhone = phone
                appState = .unauthenticated
            }
        )
    }
}

// MARK: - Navigation Notification Names

extension Notification.Name {
    /// Transition root to authenticated (MainTabView)
    static let navigateToMain = Notification.Name("navigateToMain")
    /// Transition root to login screen; userInfo may contain "prefilledPhone"
    static let navigateToLogin = Notification.Name("navigateToLogin")
    /// Transition root to register screen; userInfo may contain "socialData"
    static let navigateToRegister = Notification.Name("navigateToRegister")
}

// MARK: - Force update screen

/// 강제 업데이트가 필요한 경우 표시되는 종단 화면. 사용자가 스토어로 이동하기 전까지
/// 다른 화면으로 진행할 수 없다. 정책: "구버전 즉시 강제 업데이트".
private struct ForceUpdateView: View {
    let minVersion: String

    var body: some View {
        let currentVersion = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "-"
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "arrow.up.circle.fill")
                .font(.suite(size: 64))
                .foregroundColor(.accentColor)
            Text("업데이트가 필요합니다")
                .font(.title2.bold())
            Text("새 버전으로 업데이트 후 이용해 주세요.\n현재 \(currentVersion) → 최소 \(minVersion.isEmpty ? "최신" : minVersion)")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal, 24)
            Spacer()
            Button {
                openAppStore()
            } label: {
                Text("App Store로 이동")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    private func openAppStore() {
        // SMAP iOS App Store ID. iTunes Lookup API 검증값 (bundleId: com.dmonster.smap).
        let urlString = "https://apps.apple.com/app/id6480279658"
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url)
        }
    }
}
