# Phase 2B: AppDelegate Decomposition + SwiftUI Entry Point

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract FCM/DeepLink code from 9,365-line AppDelegate into focused services, create SwiftUI @main entry point, remove Storyboard-based launch.

**Architecture:** Extract-then-slim approach. FCMService captures essential token lifecycle (~300줄). DeepLinkService handles URL schemes (~80줄). SmapApp.swift becomes @main with @UIApplicationDelegateAdaptor. AppDelegate retains SDK init and delegates only (~300줄).

**Tech Stack:** Swift, SwiftUI, Firebase Messaging, UIKit interop

---

## Task 1: Create FCMService (Essential Token Management)

**Files:**
- Create: `smap/Services/FCMService.swift`
- Modify: `smap/AppDelegate.swift`

**Strategy:** AppDelegate의 90+ FCM 메서드 중 핵심 기능만 FCMService로 추출. Debug/test 메서드와 중복 retry 로직은 AppDelegate에 그대로 두거나 삭제 — Phase 3+에서 정리.

**FCMService에 포함할 핵심 메서드:**
1. `sendFCMTokenToServer(token:completion:)` — 서버 토큰 등록 (핵심)
2. `handleForceUpdateFCMToken()` — 로그인 후 토큰 업데이트 트리거
3. `messaging(_:didReceiveRegistrationToken:)` delegate forwarding
4. Token storage helpers (UserDefaults 기반)
5. `isValidFCMToken(_:)` — 토큰 유효성 확인

- [ ] **Step 1: FCMService.swift 생성**

Implementer가 AppDelegate.swift를 읽고, 위 핵심 메서드를 추출하여 FCMService.swift 작성. AppDelegate에서는 FCMService로 위임하는 패턴으로 변경.

```swift
// FCMService 기본 구조
import Foundation
import FirebaseMessaging

class FCMService {
    static let shared = FCMService()
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // 서버에 FCM 토큰 등록
    func registerTokenWithServer(token: String, apnsToken: String?, completion: @escaping (Bool) -> Void) { ... }

    // 토큰 유효성 검사
    func isValidToken(_ token: String) -> Bool { ... }

    // 현재 FCM 토큰 가져오기
    func getCurrentToken() async -> String? { ... }
}
```

- [ ] **Step 2: AppDelegate에서 FCMService 사용하도록 변경**

`AppDelegate.sendFCMTokenToServer` → `FCMService.shared.registerTokenWithServer` 위임.

- [ ] **Step 3: 빌드 확인 & 커밋**

---

## Task 2: Create DeepLinkService

**Files:**
- Create: `smap/Services/DeepLinkService.swift`
- Modify: `smap/AppDelegate.swift`

- [ ] **Step 1: AppDelegate의 deep link handler (lines 7262-7331) 추출**

```swift
import Foundation
import GoogleSignIn
import KakaoSDKAuth

class DeepLinkService {
    static let shared = DeepLinkService()

    /// URL scheme 처리 (AppDelegate에서 호출)
    func handleURL(_ url: URL) -> Bool {
        // Google Sign-In
        if GIDSignIn.sharedInstance.handle(url) { return true }
        // Kakao
        if AuthApi.isKakaoTalkLoginUrl(url) {
            return AuthController.handleOpenUrl(url: url)
        }
        // smap:// scheme (group join)
        if url.scheme == "smap", let code = extractGroupCode(from: url) {
            NotificationCenter.default.post(name: .init("handleGroupJoinDeepLink"), object: nil, userInfo: ["code": code])
            return true
        }
        // smapapp:// scheme (legacy)
        if url.scheme == "smapapp" { return handleLegacyScheme(url) }
        return false
    }

    private func extractGroupCode(from url: URL) -> String? { ... }
    private func handleLegacyScheme(_ url: URL) -> Bool { ... }
}
```

- [ ] **Step 2: AppDelegate의 `application(_:open:options:)` 간소화**

```swift
func application(_ app: UIApplication, open url: URL, options: ...) -> Bool {
    DeepLinkService.shared.handleURL(url)
}
```

- [ ] **Step 3: 빌드 확인 & 커밋**

---

## Task 3: Create SmapApp.swift + RootView (SwiftUI @main Entry Point)

**Files:**
- Create: `smap/App/SmapApp.swift`
- Create: `smap/App/RootView.swift`
- Modify: `smap/AppDelegate.swift` (remove @main)
- Modify: `smap.xcodeproj/project.pbxproj` (Main Interface 제거)

**현재 앱 흐름:**
1. Main.storyboard → IntroView (UIViewController)
2. IntroView → 2초 스플래시 → auth 체크
3. auth OK → MainTabView (SwiftUI via UIHostingController)
4. auth NO → LoginView (SwiftUI via UIHostingController)

**새 앱 흐름:**
1. SmapApp.swift (@main) → RootView (SwiftUI)
2. RootView → 스플래시 → auth 체크
3. auth OK → MainTabView (SwiftUI, 직접)
4. auth NO → LoginView (SwiftUI, 직접)

- [ ] **Step 1: SmapApp.swift 생성**

```swift
import SwiftUI

@main
struct SmapApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
```

- [ ] **Step 2: RootView.swift 생성**

IntroView의 auth 체크 로직을 SwiftUI로 재구현:

```swift
import SwiftUI

struct RootView: View {
    @State private var appState: AppState = .splash

    enum AppState {
        case splash
        case login
        case main
        case register(socialData: SocialLoginData?)
    }

    var body: some View {
        Group {
            switch appState {
            case .splash:
                SplashView()
                    .onAppear { checkAuth() }
            case .login:
                // LoginView와 동일한 구조, onLogin/onRegister 콜백 포함
                loginView
            case .main:
                MainTabView()
            case .register(let socialData):
                registerView(socialData: socialData)
            }
        }
    }

    private func checkAuth() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if AuthService.shared.isLoggedIn {
                DataMigration.migrateIfNeeded()
                appState = .main
            } else {
                appState = .login
            }
        }
    }
    // ... loginView, registerView computed properties
}
```

**핵심:** IntroView의 static 메서드(`navigateToMainView`, `navigateToLoginView`, `navigateToRegisterView`)가 외부에서 호출되는지 확인. 이 호출부도 RootView 상태 변경으로 전환 필요.

- [ ] **Step 3: AppDelegate에서 @main 제거**

AppDelegate.swift line 26의 `@main` 제거.

- [ ] **Step 4: project.pbxproj에서 Main Interface 제거**

Main.storyboard를 initial storyboard에서 제거 (프로젝트 설정의 Main Interface 삭제).

```ruby
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
project.native_targets.each do |target|
  next unless target.name == 'smap'
  target.build_configurations.each do |config|
    config.build_settings.delete('INFOPLIST_KEY_UIMainStoryboardFile')
  end
end
project.save
```

Info.plist에서도 `UIMainStoryboardFile` 키 제거 (있는 경우).

- [ ] **Step 5: IntroView.swift 호출부 확인 및 전환**

```bash
grep -rn "IntroView\.\|navigateToMainView\|navigateToLoginView\|navigateToRegisterView" smap/
```

발견된 호출부를 NotificationCenter 기반 앱 상태 변경으로 전환하거나, RootView의 상태를 @Environment로 공유.

- [ ] **Step 6: 빌드 확인 & 커밋**

---

## Task 4: Slim AppDelegate (~300줄 목표)

**Files:**
- Modify: `smap/AppDelegate.swift`

이 태스크는 가장 위험하므로 신중하게 진행.

- [ ] **Step 1: Debug/Test 메서드 제거**

다음 패턴의 메서드들을 삭제 (프로덕션에서 불필요):
- `debugFCMTokenStatus`, `testFCMPushManually`, `testFCMPushMessage`
- `testLocalNotificationDisplay`, `sendTestPushNotification`, `testFCMTokenGeneration`
- `debugPushNotificationStatus`, `showFCMTroubleshootingGuide`
- `printFCMDebugInfo`, `diagnoseFCMTokenReception`, `testFCMMessageReception`
- `validateFirebaseConfiguration`, `validateFCMMessageTypes`, `testFCMServerConnection`
- Permission swizzling 메서드 (`smap_installRequestAuthSwizzle`, `smap_installLocationAuthSwizzle`)
- `debugPrintUsageDescriptions`, `checkAndWarnEmptyUsageDescriptions`

**NOTE:** 삭제 전 `grep`으로 호출부 확인. 호출되는 곳이 없으면 안전하게 삭제.

- [ ] **Step 2: 중복 retry/validation 메서드 통합**

90+ FCM 메서드 중 핵심만 보존하고 나머지 제거. 보존 기준:
- Firebase delegate 메서드 (필수)
- `sendFCMTokenToServer` (핵심 서버 통신)
- `handleForceUpdateFCMToken` (로그인 트리거)
- App lifecycle 핸들러 (필수)
- Push notification delegate 메서드 (필수)

- [ ] **Step 3: 빌드 확인**

**각 삭제 후 빌드하여 깨지는 곳이 없는지 확인.**

- [ ] **Step 4: 커밋**

---

## Task 5: Build & Test Verification

- [ ] **Step 1: 전체 테스트 실행**
- [ ] **Step 2: 전체 빌드 확인**
- [ ] **Step 3: AppDelegate 줄 수 확인** (`wc -l smap/AppDelegate.swift`)

---

## Summary

| Task | 핵심 작업 | 위험도 |
|------|----------|--------|
| 1 | FCMService 추출 | 중 |
| 2 | DeepLinkService 추출 | 저 |
| 3 | SmapApp.swift + RootView | 고 |
| 4 | AppDelegate 슬리밍 | 고 |
| 5 | 전체 검증 | - |
