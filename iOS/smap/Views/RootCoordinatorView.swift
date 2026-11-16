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
    

    // Android 스플래시(values-v31/styles.xml)와 같은 모양 — 밝은 배경(#FEF8F9) 가운데 앱 아이콘.
    // 이전에는 어두운 회색 배경 + 위쪽 1/4 위치라, 흰 런치 화면에서 넘어올 때 색이 확 바뀌고 Android 와도 달랐다.
    var body: some View {
        ZStack {
            SMAPTheme.Color.background
                .ignoresSafeArea()

            Image("AppNoBg")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 112, height: 112)
                .accessibilityHidden(true)
        }
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
