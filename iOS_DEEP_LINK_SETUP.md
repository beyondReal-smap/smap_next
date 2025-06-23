# iOS 딥링크 설정 가이드

## 1. Info.plist 설정

iOS 앱의 `Info.plist` 파일에 다음 설정을 추가해야 합니다:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.dmonster.smap</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>smap</string>
        </array>
    </dict>
</array>
```

## 2. AppDelegate.swift 수정

`AppDelegate.swift` 파일에 딥링크 처리 로직을 추가합니다:

```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    // 딥링크 처리
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        handleDeepLink(url: url)
        return true
    }
    
    // iOS 13+ SceneDelegate 사용 시
    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
            if let url = userActivity.webpageURL {
                handleDeepLink(url: url)
            }
        }
        return true
    }
    
    private func handleDeepLink(url: URL) {
        print("딥링크 수신: \(url)")
        
        // URL 파싱
        let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
        let pathComponents = url.pathComponents
        
        // 그룹 가입 딥링크 처리
        if pathComponents.count >= 4 && pathComponents[1] == "group" && pathComponents[3] == "join" {
            let groupId = pathComponents[2]
            print("그룹 가입 딥링크: groupId = \(groupId)")
            
            // 그룹 ID를 UserDefaults에 저장하여 앱 시작 시 처리
            UserDefaults.standard.set(groupId, forKey: "pendingGroupJoin")
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "pendingGroupJoinTimestamp")
            
            // 메인 화면으로 이동
            NotificationCenter.default.post(name: NSNotification.Name("NavigateToMain"), object: nil)
        }
    }
}
```

## 3. SceneDelegate.swift 수정 (iOS 13+)

`SceneDelegate.swift` 파일에도 딥링크 처리를 추가합니다:

```swift
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // 딥링크로 앱이 시작된 경우 처리
        if let urlContext = connectionOptions.urlContexts.first {
            handleDeepLink(url: urlContext.url)
        }
    }
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // 앱이 실행 중일 때 딥링크 수신
        if let urlContext = URLContexts.first {
            handleDeepLink(url: urlContext.url)
        }
    }
    
    private func handleDeepLink(url: URL) {
        // AppDelegate와 동일한 처리 로직
        print("딥링크 수신: \(url)")
        
        let pathComponents = url.pathComponents
        
        if pathComponents.count >= 4 && pathComponents[1] == "group" && pathComponents[3] == "join" {
            let groupId = pathComponents[2]
            print("그룹 가입 딥링크: groupId = \(groupId)")
            
            UserDefaults.standard.set(groupId, forKey: "pendingGroupJoin")
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "pendingGroupJoinTimestamp")
            
            NotificationCenter.default.post(name: NSNotification.Name("NavigateToMain"), object: nil)
        }
    }
}
```

## 4. 메인 화면에서 그룹 가입 처리

앱의 메인 화면에서 저장된 그룹 가입 정보를 확인하고 처리합니다:

```swift
class MainViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 딥링크로 전달된 그룹 가입 처리
        checkPendingGroupJoin()
        
        // 딥링크 알림 수신
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeepLinkNotification),
            name: NSNotification.Name("NavigateToMain"),
            object: nil
        )
    }
    
    private func checkPendingGroupJoin() {
        if let groupId = UserDefaults.standard.string(forKey: "pendingGroupJoin") {
            let timestamp = UserDefaults.standard.double(forKey: "pendingGroupJoinTimestamp")
            let currentTime = Date().timeIntervalSince1970
            
            // 5분 이내의 요청만 처리
            if currentTime - timestamp < 300 {
                print("저장된 그룹 가입 처리: \(groupId)")
                
                // 그룹 가입 API 호출
                joinGroup(groupId: groupId)
                
                // 저장된 정보 삭제
                UserDefaults.standard.removeObject(forKey: "pendingGroupJoin")
                UserDefaults.standard.removeObject(forKey: "pendingGroupJoinTimestamp")
            }
        }
    }
    
    @objc private func handleDeepLinkNotification() {
        checkPendingGroupJoin()
    }
    
    private func joinGroup(groupId: String) {
        // 그룹 가입 API 호출 로직
        // 사용자가 로그인되어 있는지 확인 후 그룹 가입 처리
    }
}
```

## 5. Universal Links 설정 (선택사항)

웹사이트에서도 앱을 열 수 있도록 Universal Links를 설정할 수 있습니다:

1. `apple-app-site-association` 파일을 웹사이트 루트에 생성:

```json
{
    "applinks": {
        "apps": [],
        "details": [
            {
                "appID": "TEAM_ID.com.dmonster.smap",
                "paths": ["/group/*/join"]
            }
        ]
    }
}
```

2. `Info.plist`에 Associated Domains 추가:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:yourdomain.com</string>
</array>
```

## 테스트 방법

1. 시뮬레이터나 실제 기기에서 앱 설치
2. Safari에서 `smap://group/123/join` 입력
3. 앱이 열리고 그룹 가입 처리가 되는지 확인

## 주의사항

- 딥링크는 앱이 설치되어 있어야 작동합니다
- 앱이 설치되어 있지 않으면 스토어로 이동하도록 웹에서 처리해야 합니다
- 그룹 가입은 사용자가 로그인된 상태에서만 가능합니다 