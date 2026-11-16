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

    init() {
        #if DEBUG
        // 스토어 스크린샷용 데모 모드(디버그 빌드 + 실행 인자 -SMAPDemo YES 일 때만)
        DemoURLProtocol.registerIfRequested()
        #endif
    }

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
