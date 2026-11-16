//
// RootCoordinatorView.swift
// smap
//
// Shared views and extensions used across the app.
// Legacy RootCoordinatorView/MainWebViewContainer removed — RootView.swift is the active entry point.
//

import SwiftUI

// MARK: - Splash View (Premium Animated)

struct SplashView: View {
    

    // Android 스플래시(values-v31/styles.xml)와 같은 모양 — 화면 전체 브랜드 남색 + 가운데 두 핀.
    // LaunchScreen.storyboard 도 같은 그림이라 런치 화면 → 이 화면으로 넘어갈 때 아무것도 바뀌지 않는다.
    // 핀 크기는 Android 스플래시에서 잰 실제 크기(핀 폭 약 75dp)에 맞춘 값이다.
    var body: some View {
        ZStack {
            SMAPTheme.Color.primary
                .ignoresSafeArea()

            Image("SplashPins")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 289, height: 289)
                .accessibilityHidden(true)
        }
        // 남색 위에서 상태바 글자를 흰색으로(스플래시가 사라지면 앱 기본 라이트 모드로 돌아간다)
        .preferredColorScheme(.dark)
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
