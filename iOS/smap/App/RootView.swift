//
//  RootView.swift
//  smap
//
//  Root navigation view — replaces IntroView (UIViewController) logic.
//  Manages app-level navigation state: splash -> login / main.
//

import SwiftUI

struct RootView: View {

    @State private var appState: AppLaunchState = .splash

    // Register-flow transient state
    @State private var registerSocialData: [String: Any]?
    @State private var loginPrefilledPhone: String?

    // MARK: - State enum

    enum AppLaunchState {
        case splash
        case authenticated
        case unauthenticated
        case register
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

        // Run data migration for existing users
        DataMigration.migrateIfNeeded()

        if AuthService.shared.isLoggedIn {
            appState = .authenticated
        } else {
            appState = .unauthenticated
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
                if AuthService.shared.isLoggedIn {
                    appState = .authenticated
                } else {
                    loginPrefilledPhone = nil
                    appState = .unauthenticated
                }
            },
            socialData: registerSocialData,
            onExistingUser: { phone in
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
