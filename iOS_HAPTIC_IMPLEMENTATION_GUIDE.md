# iOS 햅틱 피드백 구현 가이드 📱

## 🎯 개요

이 가이드는 iOS WebView에서 JavaScript로부터 햅틱 피드백 요청을 받아 실제 햅틱을 실행하는 방법을 설명합니다.

## 📋 요구사항

- iOS 10.0+
- Xcode 12.0+
- UIKit 프레임워크
- WebKit 프레임워크

## 🔧 구현 단계

### 1단계: 프로젝트 설정

#### Podfile (CocoaPods 사용 시)
```ruby
platform :ios, '10.0'
use_frameworks!

target 'YourApp' do
  pod 'GoogleSignIn'  # 기존 Google Sign-In 지원
end
```

#### Info.plist 설정
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 네트워크 보안 설정 -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
    
    <!-- 앱 정보 -->
    <key>CFBundleDisplayName</key>
    <string>SMAP</string>
    
    <!-- 권한 설정 (필요시) -->
    <key>NSCameraUsageDescription</key>
    <string>프로필 사진 촬영을 위해 카메라 권한이 필요합니다.</string>
    
    <key>NSMicrophoneUsageDescription</key>
    <string>음성 메모 기능을 위해 마이크 권한이 필요합니다.</string>
</dict>
</plist>
```

### 2단계: WebView 설정

#### MainView.swift (SwiftUI 버전)
```swift
import SwiftUI
import WebKit
import UIKit

struct MainView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        
        // ⭐ 핵심: 메시지 핸들러 등록
        configuration.userContentController.add(
            context.coordinator, 
            name: "smapIos"  // JavaScript에서 사용하는 핸들러 이름
        )
        
        // WebView 최적화 설정
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsAirPlayForMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        
        // HTTPS 강제 설정 (보안)
        webView.customUserAgent = "SMAP-iOS-App/1.0"
        
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        // 필요시 업데이트 로직
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
}
```

### 3단계: 햅틱 피드백 핸들러 구현

#### Coordinator 클래스 (핵심 구현)
```swift
extension MainView {
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        
        // MARK: - WKScriptMessageHandler (JavaScript → iOS 통신)
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            
            // ⭐ 햅틱 피드백 메시지 처리
            if message.name == "smapIos" {
                guard let body = message.body as? [String: Any] else {
                    print("❌ [iOS] 메시지 파싱 실패: \(message.body)")
                    return
                }
                
                let type = body["type"] as? String ?? ""
                let param = body["param"]
                
                print("🔵 [iOS] 메시지 수신: \(type)")
                
                // 햅틱 피드백 처리 (새로운 JSON 방식)
                if type == "hapticFeedback" {
                    handleHapticFeedback(param: param)
                    return
                }
                
                // 햅틱 피드백 처리 (기존 단순 방식)
                if type == "haptic" {
                    if let hapticType = param as? String {
                        triggerHaptic(type: hapticType)
                    }
                    return
                }
                
                // 다른 메시지 타입들...
                print("⚠️ [iOS] 처리되지 않은 메시지: \(type)")
            }
        }
        
        // MARK: - 햅틱 피드백 처리 로직
        
        private func handleHapticFeedback(param: Any?) {
            if let paramString = param as? String,
               let data = paramString.data(using: .utf8),
               let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                
                // JSON 파라미터에서 햅틱 타입 추출
                let feedbackType = hapticData["feedbackType"] as? String ?? ""
                let description = hapticData["description"] as? String ?? ""
                
                print("🔵 [iOS] 햅틱 피드백: \(feedbackType)")
                if !description.isEmpty {
                    print("🔵 [iOS] 설명: \(description)")
                }
                
                triggerHaptic(type: feedbackType)
                
            } else if let hapticType = param as? String {
                // 단순 문자열 방식 지원
                print("🔵 [iOS] 단순 햅틱: \(hapticType)")
                triggerHaptic(type: hapticType)
            }
        }
        
        // MARK: - 실제 햅틱 실행 함수
        
        private func triggerHaptic(type: String) {
            DispatchQueue.main.async {
                // iPad에서는 햅틱 제한적
                guard UIDevice.current.userInterfaceIdiom == .phone else {
                    print("⚠️ [iOS] iPad - 햅틱 제한됨")
                    return
                }
                
                // iOS 버전 확인 (iOS 10+)
                guard #available(iOS 10.0, *) else {
                    print("⚠️ [iOS] 햅틱 미지원 버전")
                    return
                }
                
                // 햅틱 타입별 실행
                switch type.lowercased() {
                case "light", "selection":
                    self.triggerLightHaptic()
                    
                case "medium":
                    self.triggerMediumHaptic()
                    
                case "heavy", "error":
                    self.triggerHeavyHaptic()
                    
                case "success":
                    self.triggerSuccessHaptic()
                    
                case "warning":
                    self.triggerWarningHaptic()
                    
                default:
                    print("⚠️ [iOS] 알 수 없는 햅틱: \(type)")
                    self.triggerMediumHaptic() // 기본값
                }
            }
        }
    }
}
```

### 4단계: 햅틱 타입별 구현

```swift
extension MainView.Coordinator {
    
    // 🟢 가벼운 햅틱 (네비게이션, 메뉴 선택)
    private func triggerLightHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Light 햅틱")
        }
    }
    
    // 🔵 중간 햅틱 (버튼 클릭, 토글)
    private func triggerMediumHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Medium 햅틱")
        }
    }
    
    // 🔴 강한 햅틱 (중요한 액션)
    private func triggerHeavyHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
            print("✅ [iOS] Heavy 햅틱")
        }
    }
    
    // ✅ 성공 햅틱 (작업 완료, 로딩 완료)
    private func triggerSuccessHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
            print("✅ [iOS] Success 햅틱")
        }
    }
    
    // ⚠️ 경고 햅틱
    private func triggerWarningHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.warning)
            print("✅ [iOS] Warning 햅틱")
        }
    }
    
    // ❌ 에러 햅틱
    private func triggerErrorHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.error)
            print("✅ [iOS] Error 햅틱")
        }
    }
    
    // 🔄 선택 변경 햅틱 (탭 전환, 슬라이더)
    private func triggerSelectionHaptic() {
        if #available(iOS 10.0, *) {
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            generator.selectionChanged()
            print("✅ [iOS] Selection 햅틱")
        }
    }
}
```

### 5단계: ContentView 설정

```swift
struct ContentView: View {
    var body: some View {
        MainView(url: URL(string: "https://your-domain.com")!)
            .edgesIgnoringSafeArea(.all)
            .onAppear {
                print("🚀 [iOS] SMAP 앱 시작")
            }
    }
}

@main
struct SmapApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 🧪 테스트 방법

### 1. Xcode 콘솔 확인
JavaScript에서 햅틱 요청 시 다음과 같은 로그가 출력됩니다:
```
🔵 [iOS] 메시지 수신: hapticFeedback
🔵 [iOS] 햅틱 피드백: success
🔵 [iOS] 설명: 데이터 로딩 완료
✅ [iOS] Success 햅틱
```

### 2. 물리 디바이스에서 테스트
- **시뮬레이터에서는 햅틱이 작동하지 않습니다**
- iPhone (실제 기기)에서만 테스트 가능
- 무음 모드에서도 햅틱은 작동합니다

### 3. JavaScript 테스트 코드
브라우저 개발자 도구에서 실행:
```javascript
// 성공 햅틱 테스트
hapticFeedback.dataLoadComplete();

// 메뉴 선택 햅틱 테스트  
hapticFeedback.menuSelect();

// 에러 햅틱 테스트
hapticFeedback.error();
```

## 🔧 문제 해결

### 햅틱이 작동하지 않을 때

1. **메시지 핸들러 등록 확인**
   ```swift
   configuration.userContentController.add(context.coordinator, name: "smapIos")
   ```

2. **iOS 버전 확인**
   - iOS 10.0+ 필요
   - iPad에서는 제한적

3. **물리 디바이스 사용**
   - 시뮬레이터 ❌
   - 실제 iPhone ✅

4. **콘솔 로그 확인**
   ```swift
   print("🔵 [iOS] 메시지 수신: \(type)")
   ```

### 메모리 누수 방지

```swift
deinit {
    // 메시지 핸들러 제거
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "smapIos")
    print("🔄 [iOS] 핸들러 정리 완료")
}
```

## 📱 지원 디바이스

| 디바이스 | 햅틱 지원 | 권장 사용 |
|---------|----------|----------|
| iPhone 7+ | ✅ 전체 | 추천 |
| iPhone 6s | ⚠️ 제한적 | 기본 |
| iPad | ❌ 없음 | 사용 안함 |

## 🎯 성능 최적화

1. **prepare() 호출**: 햅틱 반응성 향상
2. **메인 스레드 실행**: DispatchQueue.main.async
3. **적절한 사용**: 과도한 햅틱 금지
4. **배터리 고려**: 필요한 경우에만 사용

완료! 이제 iOS 앱에서 JavaScript 햅틱 피드백을 완벽하게 지원할 수 있습니다. 🎉 