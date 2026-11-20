//
// CustomAppleSignInButton.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI
import AuthenticationServices

// MARK: - Custom Apple Sign In Button (Google 스타일과 동일)

struct CustomAppleSignInButton: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.impact(style: .medium)
            onTap()
        }) {
            LoginProviderLabel(name: "Apple", background: .black, brandText: .white) {
                Image(systemName: "apple.logo")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.white)
            }
        }
        .accessibilityLabel("Apple로 계속하기")
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
