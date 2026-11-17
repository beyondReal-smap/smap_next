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
            HStack(spacing: 10) {
                // Apple 로고
                Image(systemName: "apple.logo")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 20, height: 20)

                Text("Apple로 계속하기")
                    .font(.suite(size: 16, weight: .medium))  // 로그인 화면 Google·카카오 버튼과 같은 16
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity)
            // 높이·모서리는 앱 공용 버튼(SMAPButton 52pt·12pt)과 맞춘다(Google·카카오 버튼과 같은 규격).
            .frame(height: 52)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
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
