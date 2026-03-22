//
//  SmapApp.swift
//  smap
//
//  SwiftUI @main entry point — replaces Storyboard-based launch
//

import SwiftUI
import KakaoSDKAuth

@main
struct SmapApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    // Kakao / Google / deep-link URL routing
                    // DeepLinkService already handles all schemes;
                    // AppDelegate.application(_:open:options:) delegates there too,
                    // but SwiftUI lifecycle needs onOpenURL for reliable delivery.
                    _ = DeepLinkService.shared.handleURL(url)
                }
        }
    }
}
