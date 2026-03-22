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
