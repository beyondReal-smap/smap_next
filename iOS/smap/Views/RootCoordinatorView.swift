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
    

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background Color #353538
                Color(red: 53/255, green: 53/255, blue: 56/255)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // App Icon (AppNoBg from Assets)
                    Image("AppNoBg")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 80, height: 80) // Adjust size as needed
                        .accessibilityHidden(true)
                }
                .position(x: geometry.size.width / 2, y: geometry.size.height * 0.25) // 1/4 Height Position
            }
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
