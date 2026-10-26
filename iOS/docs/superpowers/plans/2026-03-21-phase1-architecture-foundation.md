# Phase 1: Architecture Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish iOS 17+ foundation with unified network layer, type-safe storage, design system, and secrets management — without breaking existing app behavior.

**Architecture:** Bottom-up infrastructure build. New modules (APIClient, KeychainManager, UserDefaultsManager, Theme) are created alongside existing code. Existing Services continue to work unchanged until Phase 2 migration. Dependency cleanup removes unused/easily-replaceable pods.

**Tech Stack:** Swift 5.9, iOS 17.0+, SwiftUI, URLSession async/await, XCTest

**Spec:** `docs/superpowers/specs/2026-03-21-ios-refactoring-design.md`

---

## File Map

### New Files (Phase 1)
```
smap/
├── App/
│   └── AppConfiguration.swift          # .xcconfig 기반 환경 설정
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift             # 통합 네트워크 클라이언트
│   │   ├── APIEndpoint.swift           # 타입-safe 엔드포인트 enum
│   │   └── NetworkError.swift          # 통합 에러 타입
│   └── Storage/
│       ├── KeychainManager.swift       # 토큰 관리
│       ├── UserDefaultsManager.swift   # 타입-safe UserDefaults
│       └── DataMigration.swift         # 기존→신규 스토리지 마이그레이션
├── DesignSystem/
│   ├── Theme.swift                     # 컬러, 폰트, 간격 통합
│   └── Components/
│       ├── SMAPButton.swift            # 재사용 버튼
│       ├── SMAPTextField.swift         # 재사용 텍스트필드
│       ├── SMAPLoadingView.swift       # 로딩 인디케이터
│       └── SMAPSnackBar.swift          # 토스트/스낵바 (Pod 대체)

Config/
├── Debug.xcconfig                      # 디버그 환경 시크릿
├── Release.xcconfig                    # 릴리스 환경 시크릿
└── Shared.xcconfig                     # 공통 설정

smapTests/
└── (test target — Task 2에서 생성)
```

### Modified Files
```
Podfile                                 # iOS 17.0, 불필요 Pod 제거
smap.xcodeproj/project.pbxproj          # deployment target, xcconfig 연결, 새 파일 참조
smap/Info.plist                         # xcconfig 변수 참조
```

### Deleted Files
```
smap/Helper/AppSnackBar.swift           # SnackBar.swift Pod 의존성 → SMAPSnackBar 대체
smap/Helper/Api/Api.swift               # Alamofire → APIClient 대체 (Phase 2에서 호출부 전환 후 삭제)
```

**Note:** `Api.swift`는 Phase 1에서 APIClient를 만들되, 기존 호출부(AppDelegate의 `Api.shared.memberLocation`, `Api.shared.auth` 등)는 Phase 2에서 전환하므로 Phase 1에서는 삭제하지 않음. Alamofire pod도 Phase 2까지 유지.

**Deferred to Phase 2:** Spec 1.1의 Storyboard 제거, `SmapApp.swift` `@main` 진입점, `@UIApplicationDelegateAdaptor` 전환, IntroView→RootView 전환은 Phase 2의 Router 구현 및 Navigation 시스템 전환과 동시에 수행. 이유: Storyboard 제거는 앱 진입점 전체를 변경하는 작업으로, Router와 탭 네비게이션이 준비되지 않은 상태에서 수행하면 기존 WebView 기반 메인 화면과 네이티브 화면 간 전환이 깨질 위험이 높음. Phase 1에서는 인프라만 구축하고 앱 동작을 변경하지 않는 것이 목표.

---

## Task 1: iOS 17+ Deployment Target

**Files:**
- Modify: `Podfile`
- Modify: `smap.xcodeproj/project.pbxproj` (Xcode 설정)

- [ ] **Step 1: Podfile platform 업데이트**

`Podfile` 첫 줄을 변경:
```ruby
# 변경 전
platform :ios, '15.0'

# 변경 후
platform :ios, '17.0'
```

post_install 블록에서도 deployment target 변경:
```ruby
# 변경 전
config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'

# 변경 후
config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
```

- [ ] **Step 2: 불필요 Pod 제거**

Podfile에서 다음 Pod 제거:
```ruby
# 제거할 Pod들:
pod 'IQKeyboardManagerSwift'    # SwiftUI @FocusState로 대체
pod 'SnackBar.swift'            # SMAPSnackBar(SwiftUI)로 대체
pod 'SDWebImage', '~> 5.0'     # 미사용 확인됨
```

**유지할 Pod** (Phase 1에서 아직 필요):
```ruby
pod 'Alamofire', '~> 5.5'      # Api.swift가 아직 사용 중, Phase 2에서 제거
pod 'SwiftyStoreKit'            # StoreKitManager가 사용 중, Phase 2+에서 제거
pod 'Firebase/Auth'
pod 'Firebase/Core'
pod 'Firebase/Messaging'
pod 'GoogleSignIn', '~> 7.0'
pod 'AppAuth', '~> 1.7'
pod 'KakaoSDKCommon', '~> 2.22'
pod 'KakaoSDKAuth', '~> 2.22'
pod 'KakaoSDKUser', '~> 2.22'
pod 'NMapsMap'
```

- [ ] **Step 3: IQKeyboardManager 코드 제거**

`smap/AppDelegate.swift`에서 다음 제거:
```swift
// 제거: import
import IQKeyboardManagerSwift

// 제거: setupKeyboard() 또는 didFinishLaunching 내 다음 3줄
IQKeyboardManager.shared.isEnabled = true
IQKeyboardManager.shared.setValue(false, forKey: "enableAutoToolbar")
IQKeyboardManager.shared.resignOnTouchOutside = true
```

- [ ] **Step 4: SnackBar 의존성 코드 제거**

`smap/Helper/AppSnackBar.swift` — 파일 삭제.

`smap/Helper/Utils.swift` — `showSnackBar` 메서드 본문을 UIKit toast로 대체 (메서드 시그니처는 유지하여 MainView.swift 등 8곳 이상의 호출부가 깨지지 않도록 함):
```swift
// 변경 전 (파일 상단)
import SnackBar_swift

// 변경 후
// import SnackBar_swift  ← 삭제

// 변경 전 (showSnackBar 메서드 본문)
AppSnackBar.make(in: view, message: message, duration: .lengthLong).show()

// 변경 후 (기존 showToast 구현을 인라인)
let toastLabel = UILabel()
toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
toastLabel.textColor = UIColor.white
toastLabel.font = UIFont.systemFont(ofSize: 14)
toastLabel.textAlignment = .center
toastLabel.text = message
toastLabel.alpha = 1.0
toastLabel.layer.cornerRadius = 10
toastLabel.clipsToBounds = true
toastLabel.numberOfLines = 0
let maxWidth = view.frame.size.width - 40
let textSize = toastLabel.sizeThatFits(CGSize(width: maxWidth, height: CGFloat.greatestFiniteMagnitude))
toastLabel.frame = CGRect(
    x: (view.frame.size.width - textSize.width - 40) / 2,
    y: view.frame.size.height - 100,
    width: textSize.width + 40,
    height: textSize.height + 20
)
view.addSubview(toastLabel)
UIView.animate(withDuration: 3.0, delay: 0.1, options: .curveEaseOut) {
    toastLabel.alpha = 0.0
} completion: { _ in
    toastLabel.removeFromSuperview()
}
```

**주의:** `AppSnackBar.swift` 삭제 전 반드시 `showSnackBar` 메서드 본문을 먼저 교체해야 합니다. `MainView.swift`에서 `Utils.shared.showSnackBar(...)` 호출이 8곳 이상 있으므로 메서드 시그니처는 그대로 유지합니다.

- [ ] **Step 5: pod install 실행**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && pod install`
Expected: 성공, 제거된 Pod들이 Pods/ 디렉토리에서 삭제됨

- [ ] **Step 6: Xcode 프로젝트 deployment target 업데이트**

`project.pbxproj`에서 `IPHONEOS_DEPLOYMENT_TARGET`을 모두 `17.0`으로 변경.
(sed 또는 ruby xcodeproj gem 사용)

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
project.build_configurations.each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
end
project.native_targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  end
end
project.save
"
```

- [ ] **Step 7: 빌드 확인**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' -quiet 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 8: 커밋**

```bash
git add Podfile Podfile.lock smap.xcodeproj/project.pbxproj smap/AppDelegate.swift smap/Helper/Utils.swift
git rm smap/Helper/AppSnackBar.swift
git commit -m "chore: upgrade to iOS 17.0, remove IQKeyboardManager/SnackBar/SDWebImage pods"
```

---

## Task 2: Test Infrastructure Setup

**Files:**
- Modify: `smap.xcodeproj/project.pbxproj`
- Create: `smapTests/` directory with initial test file

- [ ] **Step 1: 테스트 타겟 생성 (xcodeproj gem 사용)**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
mkdir -p smapTests
```

```bash
ruby -e "
require 'xcodeproj'

project = Xcodeproj::Project.open('smap.xcodeproj')

# 테스트 타겟 생성
test_target = project.new_target(:unit_test_bundle, 'smapTests', :ios, '17.0')
test_target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  config.build_settings['TEST_HOST'] = '\$(BUILT_PRODUCTS_DIR)/smap.app/\$(BUNDLE_EXECUTABLE_FOLDER_PATH)/smap'
  config.build_settings['BUNDLE_LOADER'] = '\$(TEST_HOST)'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.dmonster.smapTests'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['INFOPLIST_FILE'] = ''
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
end

# 메인 타겟에 대한 의존성 추가
main_target = project.targets.find { |t| t.name == 'smap' }
test_target.add_dependency(main_target) if main_target

# 테스트 파일 그룹 생성
tests_group = project.main_group.new_group('smapTests', 'smapTests')
test_ref = tests_group.new_file('PlaceholderTests.swift')
test_target.source_build_phase.add_file_reference(test_ref)

project.save
puts 'Test target created successfully'
"
```

- [ ] **Step 2: Placeholder 테스트 파일 생성**

Create: `smapTests/PlaceholderTests.swift`
```swift
import XCTest
@testable import smap

final class PlaceholderTests: XCTestCase {
    func testAppLaunches() {
        // Phase 1 infrastructure tests will be added here
        XCTAssertTrue(true)
    }
}
```

- [ ] **Step 3: 테스트 빌드 확인**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests -quiet 2>&1 | tail -10`
Expected: Test Suite 'All tests' passed (또는 빌드 성공 확인)

- [ ] **Step 4: 커밋**

```bash
git add smapTests/ smap.xcodeproj/project.pbxproj
git commit -m "test: add unit test target infrastructure"
```

---

## Task 3: Secrets Management (.xcconfig)

**Files:**
- Create: `Config/Debug.xcconfig`
- Create: `Config/Release.xcconfig`
- Create: `Config/Shared.xcconfig`
- Create: `Config/Debug.xcconfig.example`
- Create: `smap/App/AppConfiguration.swift`
- Modify: `.gitignore`
- Modify: `smap.xcodeproj/project.pbxproj` (xcconfig 연결)

- [ ] **Step 1: xcconfig 파일 생성**

Create: `Config/Shared.xcconfig`
```
// Shared configuration for SMAP iOS app
// API URLs
API_BASE_URL = https:/$()/api3.aiagnt.kr/api/
WEB_BASE_URL = https:/$()/nextstep.aiagnt.kr/
FILE_API_URL = https:/$()/nextstep.aiagnt.kr/api/
IMAGE_BASE_URL = https:/$()/api3.aiagnt.kr

// App Info
PRODUCT_BUNDLE_IDENTIFIER = com.dmonster.smap
```

Create: `Config/Debug.xcconfig`
```
#include "Shared.xcconfig"

// Secrets — DO NOT COMMIT
// 실제 값은 Http.swift의 hashKey, LocationService.swift의 kakaoAPIKey에서 복사
KAKAO_API_KEY = <Http.swift 또는 기존 LocationService.swift에서 복사>
AUTH_SECRET_KEY = <Http.swift의 hashKey 값 복사>
```

Create: `Config/Release.xcconfig`
```
#include "Shared.xcconfig"

// Secrets — DO NOT COMMIT (CI에서 환경변수로 주입)
KAKAO_API_KEY = <Debug.xcconfig과 동일>
AUTH_SECRET_KEY = <Debug.xcconfig과 동일>
```

Create: `Config/Debug.xcconfig.example`
```
#include "Shared.xcconfig"

// Copy this file to Debug.xcconfig and fill in actual values
KAKAO_API_KEY = your_kakao_api_key_here
AUTH_SECRET_KEY = your_auth_secret_key_here
```

- [ ] **Step 2: .gitignore에 xcconfig 추가**

`.gitignore`에 추가:
```
# Secrets
Config/Debug.xcconfig
Config/Release.xcconfig
!Config/*.xcconfig.example
!Config/Shared.xcconfig
```

- [ ] **Step 3: Info.plist에 xcconfig 변수 참조 추가**

`smap/Info.plist`에 다음 키 추가 (기존 키 옆에):
```xml
<key>API_BASE_URL</key>
<string>$(API_BASE_URL)</string>
<key>WEB_BASE_URL</key>
<string>$(WEB_BASE_URL)</string>
<key>FILE_API_URL</key>
<string>$(FILE_API_URL)</string>
<key>IMAGE_BASE_URL</key>
<string>$(IMAGE_BASE_URL)</string>
<key>KAKAO_API_KEY</key>
<string>$(KAKAO_API_KEY)</string>
<key>AUTH_SECRET_KEY</key>
<string>$(AUTH_SECRET_KEY)</string>
```

- [ ] **Step 4: AppConfiguration.swift 생성**

Create: `smap/App/AppConfiguration.swift`
```swift
import Foundation

enum AppConfiguration {
    // MARK: - API URLs

    static let apiBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["API_BASE_URL"] as? String, !url.isEmpty else {
            return "https://api3.aiagnt.kr/api/"
        }
        return url
    }()

    static let webBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["WEB_BASE_URL"] as? String, !url.isEmpty else {
            return "https://nextstep.aiagnt.kr/"
        }
        return url
    }()

    static let fileAPIURL: String = {
        guard let url = Bundle.main.infoDictionary?["FILE_API_URL"] as? String, !url.isEmpty else {
            return "https://nextstep.aiagnt.kr/api/"
        }
        return url
    }()

    static let imageBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["IMAGE_BASE_URL"] as? String, !url.isEmpty else {
            return "https://api3.aiagnt.kr"
        }
        return url
    }()

    // MARK: - API Keys

    static let kakaoAPIKey: String = {
        Bundle.main.infoDictionary?["KAKAO_API_KEY"] as? String ?? ""
    }()

    static let authSecretKey: String = {
        Bundle.main.infoDictionary?["AUTH_SECRET_KEY"] as? String ?? ""
    }()

    // MARK: - API v1 Base URL (Services에서 사용)

    static let apiV1BaseURL: String = {
        // apiBaseURL이 "https://api3.aiagnt.kr/api/"이면 v1은 "https://api3.aiagnt.kr/api/v1"
        let base = apiBaseURL.hasSuffix("/") ? String(apiBaseURL.dropLast()) : apiBaseURL
        return "\(base)/v1"
    }()
}
```

- [ ] **Step 5: project.pbxproj에 xcconfig 연결**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'

project = Xcodeproj::Project.open('smap.xcodeproj')

# Config 그룹 생성
config_group = project.main_group.new_group('Config', 'Config')
debug_ref = config_group.new_file('Debug.xcconfig')
release_ref = config_group.new_file('Release.xcconfig')
shared_ref = config_group.new_file('Shared.xcconfig')

# App 그룹 생성 (smap 그룹 하위)
smap_group = project.main_group.groups.find { |g| g.name == 'smap' || g.path == 'smap' }
if smap_group
  app_group = smap_group.new_group('App', 'smap/App')
  app_config_ref = app_group.new_file('AppConfiguration.swift')
  main_target = project.targets.find { |t| t.name == 'smap' }
  main_target.source_build_phase.add_file_reference(app_config_ref) if main_target
end

# Build Configuration에 xcconfig 연결
project.build_configurations.each do |config|
  if config.name == 'Debug'
    config.base_configuration_reference = debug_ref
  elsif config.name == 'Release'
    config.base_configuration_reference = release_ref
  end
end

project.save
puts 'xcconfig files linked to project'
"
```

- [ ] **Step 6: 빌드 확인**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' -quiet 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 7: 커밋**

```bash
git add Config/Shared.xcconfig Config/Debug.xcconfig.example smap/App/AppConfiguration.swift smap/Info.plist smap.xcodeproj/project.pbxproj .gitignore
git commit -m "feat: add .xcconfig-based secrets management and AppConfiguration"
```

---

## Task 4: NetworkError — 통합 에러 타입 (TDD)

**Files:**
- Create: `smap/Core/Network/NetworkError.swift`
- Create: `smapTests/Core/Network/NetworkErrorTests.swift`

**Note:** 기존 `LoginModels.swift`의 `struct APIError`와 이름 충돌을 피하기 위해 `NetworkError`로 명명. Phase 2에서 기존 `APIError`를 `APIErrorResponse`로 리네이밍한 후 `NetworkError` → `APIError`로 변경 가능.

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Network/NetworkErrorTests.swift`
```swift
import XCTest
@testable import smap

final class NetworkErrorTests: XCTestCase {

    func testNetworkErrorDescription_unauthorized() {
        let error = NetworkError.unauthorized
        XCTAssertEqual(error.userMessage, "로그인이 만료되었습니다.")
    }

    func testNetworkErrorDescription_networkError() {
        let urlError = URLError(.notConnectedToInternet)
        let error = NetworkError.network(urlError)
        XCTAssertEqual(error.userMessage, "네트워크 연결을 확인해주세요.")
    }

    func testNetworkErrorDescription_serverError() {
        let error = NetworkError.serverError(500, "Internal Server Error")
        XCTAssertEqual(error.userMessage, "서버 오류가 발생했습니다.")
    }

    func testNetworkErrorDescription_decodingFailed() {
        let context = DecodingError.Context(codingPath: [], debugDescription: "test")
        let decodingError = DecodingError.dataCorrupted(context)
        let error = NetworkError.decodingFailed(decodingError)
        XCTAssertEqual(error.userMessage, "데이터 처리 중 오류가 발생했습니다.")
    }

    func testNetworkErrorDescription_notFound() {
        let error = NetworkError.notFound
        XCTAssertEqual(error.userMessage, "요청한 정보를 찾을 수 없습니다.")
    }

    func testNetworkErrorDescription_forbidden() {
        let error = NetworkError.forbidden
        XCTAssertEqual(error.userMessage, "접근 권한이 없습니다.")
    }

    func testNetworkErrorDescription_badRequest() {
        let error = NetworkError.badRequest("Invalid input")
        XCTAssertEqual(error.userMessage, "Invalid input")
    }

    func testNetworkError_isUnauthorized() {
        XCTAssertTrue(NetworkError.unauthorized.isUnauthorized)
        XCTAssertFalse(NetworkError.notFound.isUnauthorized)
    }

    // MARK: - fromHTTPStatus factory method

    func testFromHTTPStatus_401_returnsUnauthorized() {
        let error = NetworkError.fromHTTPStatus(401, data: nil)
        XCTAssertTrue(error.isUnauthorized)
    }

    func testFromHTTPStatus_403_returnsForbidden() {
        let error = NetworkError.fromHTTPStatus(403, data: nil)
        if case .forbidden = error {} else { XCTFail("Expected .forbidden") }
    }

    func testFromHTTPStatus_404_returnsNotFound() {
        let error = NetworkError.fromHTTPStatus(404, data: nil)
        if case .notFound = error {} else { XCTFail("Expected .notFound") }
    }

    func testFromHTTPStatus_400_parsesDetailFromBody() {
        let body = #"{"detail": "Invalid phone number"}"#.data(using: .utf8)
        let error = NetworkError.fromHTTPStatus(400, data: body)
        if case .badRequest(let message) = error {
            XCTAssertEqual(message, "Invalid phone number")
        } else {
            XCTFail("Expected .badRequest")
        }
    }

    func testFromHTTPStatus_500_returnsServerError() {
        let error = NetworkError.fromHTTPStatus(500, data: "Internal".data(using: .utf8))
        if case .serverError(let code, _) = error {
            XCTAssertEqual(code, 500)
        } else {
            XCTFail("Expected .serverError")
        }
    }

    func testFromHTTPStatus_unknownCode_returnsUnknown() {
        let error = NetworkError.fromHTTPStatus(418, data: nil)
        if case .unknown(let code, _) = error {
            XCTAssertEqual(code, 418)
        } else {
            XCTFail("Expected .unknown")
        }
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/NetworkErrorTests -quiet 2>&1 | tail -10`
Expected: FAIL — `NetworkError` 타입이 존재하지 않음

- [ ] **Step 3: NetworkError 구현**

Create: `smap/Core/Network/NetworkError.swift`
```swift
import Foundation

/// 통합 네트워크 에러 타입
/// Phase 2에서 기존 `struct APIError` 제거 후 `APIError`로 리네이밍 예정
enum NetworkError: Error, LocalizedError {
    case network(URLError)
    case unauthorized
    case forbidden
    case notFound
    case badRequest(String?)
    case serverError(Int, String?)
    case decodingFailed(DecodingError)
    case unknown(Int, Data?)

    var errorDescription: String? { userMessage }

    var userMessage: String {
        switch self {
        case .network:
            return "네트워크 연결을 확인해주세요."
        case .unauthorized:
            return "로그인이 만료되었습니다."
        case .forbidden:
            return "접근 권한이 없습니다."
        case .notFound:
            return "요청한 정보를 찾을 수 없습니다."
        case .badRequest(let message):
            return message ?? "잘못된 요청입니다."
        case .serverError:
            return "서버 오류가 발생했습니다."
        case .decodingFailed:
            return "데이터 처리 중 오류가 발생했습니다."
        case .unknown:
            return "알 수 없는 오류가 발생했습니다."
        }
    }

    var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        return false
    }

    /// HTTP 상태 코드로부터 적절한 에러 생성
    static func fromHTTPStatus(_ statusCode: Int, data: Data?) -> NetworkError {
        switch statusCode {
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 400:
            let message = data.flatMap { try? JSONDecoder().decode(ErrorDetail.self, from: $0) }?.detail
            return .badRequest(message)
        case 500...599:
            let message = data.flatMap { String(data: $0, encoding: .utf8) }
            return .serverError(statusCode, message)
        default:
            return .unknown(statusCode, data)
        }
    }
}

/// 서버 에러 응답 디코딩용 (내부 사용)
private struct ErrorDetail: Decodable {
    let detail: String?
    let message: String?
}
```

- [ ] **Step 4: 테스트 파일을 프로젝트에 추가하고 테스트 통과 확인**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
main_target = project.targets.find { |t| t.name == 'smap' }
test_target = project.targets.find { |t| t.name == 'smapTests' }
smap_group = project.main_group.groups.find { |g| g.name == 'smap' || g.path == 'smap' }

# Core/Network 그룹 생성
core_group = smap_group.new_group('Core', 'smap/Core')
network_group = core_group.new_group('Network', 'smap/Core/Network')
ref = network_group.new_file('NetworkError.swift')
main_target.source_build_phase.add_file_reference(ref)

# 테스트 파일 추가
tests_group = project.main_group.groups.find { |g| g.name == 'smapTests' }
test_core_group = tests_group.new_group('Core', 'Core')
test_network_group = test_core_group.new_group('Network', 'Network')
test_ref = test_network_group.new_file('NetworkErrorTests.swift')
test_target.source_build_phase.add_file_reference(test_ref)

project.save
"
```

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/NetworkErrorTests -quiet 2>&1 | tail -10`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Network/NetworkError.swift smapTests/Core/Network/NetworkErrorTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add NetworkError unified error type with tests"
```

---

## Task 5: APIEndpoint — 타입-safe 엔드포인트 (TDD)

**Files:**
- Create: `smap/Core/Network/APIEndpoint.swift`
- Create: `smapTests/Core/Network/APIEndpointTests.swift`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Network/APIEndpointTests.swift`
```swift
import XCTest
@testable import smap

final class APIEndpointTests: XCTestCase {

    let baseURL = "https://api3.aiagnt.kr/api/v1"

    // MARK: - URL 구성 테스트

    func testLogin_urlAndMethod() {
        let endpoint = APIEndpoint.login(mt_id: "01012345678", mt_pwd: "pass123")
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/auth/login")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testGetGroups_urlAndMethod() {
        let endpoint = APIEndpoint.getCurrentUserGroups
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/groups/current-user")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testGetGroupMembers_urlContainsSgtIdx() {
        let endpoint = APIEndpoint.getGroupMembers(sgtIdx: 42)
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/group-members/member/42")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testCreateGroup_hasPostBody() {
        let endpoint = APIEndpoint.createGroup(title: "테스트 그룹", memo: "메모")
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertNotNil(request.httpBody)

        let body = try! JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        XCTAssertEqual(body["sgt_title"] as? String, "테스트 그룹")
    }

    func testDeleteMember_urlAndMethod() {
        let endpoint = APIEndpoint.removeMember(sgtIdx: 1, mtIdx: 2)
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/group-members/1/member/2")
        XCTAssertEqual(request.httpMethod, "DELETE")
    }

    func testMarkNotificationRead_usesPatch() {
        let endpoint = APIEndpoint.markNotificationRead(notificationId: 99)
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertTrue(request.url!.absoluteString.contains("99"))
    }

    func testMemberLocations_hasCorrectPath() {
        let endpoint = APIEndpoint.getMemberLocations(memberId: 5)
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/locations/member/5")
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testFetchProfile_urlAndMethod() {
        let endpoint = APIEndpoint.fetchProfile
        let request = endpoint.urlRequest(baseURL: baseURL)

        XCTAssertEqual(request.url?.absoluteString, "\(baseURL)/members/me")
        XCTAssertEqual(request.httpMethod, "GET")
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/APIEndpointTests -quiet 2>&1 | tail -10`
Expected: FAIL — `APIEndpoint` 타입이 존재하지 않음

- [ ] **Step 3: APIEndpoint 구현**

Create: `smap/Core/Network/APIEndpoint.swift`
```swift
import Foundation

/// 타입-safe API 엔드포인트 정의
/// 모든 API 요청의 URL, HTTP method, body를 한 곳에서 관리
enum APIEndpoint {

    // MARK: - Auth
    case login(mt_id: String, mt_pwd: String, fcmToken: String? = nil, deviceId: String? = nil, deviceModel: String? = nil, osVersion: String? = nil, appVersion: String? = nil)
    case googleLogin(GoogleLoginRequest)
    case appleLogin(AppleLoginRequest)
    case register(RegisterRequest)

    // MARK: - Profile
    case fetchProfile
    case updateProfile(UpdateProfileRequest)
    case changePassword(ChangePasswordRequest)
    case uploadProfileImage  // multipart — body는 APIClient에서 별도 처리
    case verifyPassword(VerifyPasswordRequest)
    case withdraw(WithdrawRequest)

    // MARK: - Groups
    case getCurrentUserGroups
    case getGroupStats(sgtIdx: Int)
    case createGroup(title: String, memo: String)
    case updateGroup(sgtIdx: Int, title: String, memo: String)
    case deleteGroup(sgtIdx: Int)  // Note: HTTP PUT (soft delete via sgt_show="N"), not DELETE
    case joinGroupByCode(code: String)
    case joinGroupById(sgtIdx: Int, mtIdx: Int)

    // MARK: - Group Members
    case getGroupMembers(sgtIdx: Int)
    case updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool)
    case removeMember(sgtIdx: Int, mtIdx: Int)

    // MARK: - My Places (Locations)
    case getMemberLocations(memberId: Int)
    case createLocation(memberId: Int, request: AnyEncodable)
    case updateLocation(locationId: Int, request: AnyEncodable)
    case deleteLocation(locationId: Int)
    case toggleLocationNotification(locationId: Int, enabled: String)

    // MARK: - Schedules
    case getGroupSchedules(sgtIdx: Int)

    // MARK: - Notifications
    case getMemberPushLogs(memberId: Int)
    case markNotificationRead(notificationId: Int)
    case markAllNotificationsRead(memberId: Int)
    case deleteNotification(notificationId: Int)
    case deleteAllNotifications(memberId: Int)

    // MARK: - Location Logging
    case createLocationLog(params: [String: Any])

    // MARK: - FCM
    case registerFCMToken(mtIdx: String, fcmToken: String, apnsToken: String?)

    // MARK: - URL Request Builder

    func urlRequest(baseURL: String) -> URLRequest {
        let url = URL(string: "\(baseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            request.httpBody = body
        }

        return request
    }

    // MARK: - Private Helpers

    private var path: String {
        switch self {
        // Auth
        case .login: return "/auth/login"
        case .googleLogin: return "/auth/google-login"
        case .appleLogin: return "/auth/apple-login"
        case .register: return "/auth/register"

        // Profile
        case .fetchProfile: return "/members/me"
        case .updateProfile: return "/members/update-profile"
        case .changePassword: return "/members/change-password"
        case .uploadProfileImage: return "/members/upload-profile-image"
        case .verifyPassword: return "/members/verify-password"
        case .withdraw: return "/members/withdraw"

        // Groups
        case .getCurrentUserGroups: return "/groups/current-user"
        case .getGroupStats(let sgtIdx): return "/groups/\(sgtIdx)/stats"
        case .createGroup: return "/groups/"
        case .updateGroup(let sgtIdx, _, _): return "/groups/\(sgtIdx)"
        case .deleteGroup(let sgtIdx): return "/groups/\(sgtIdx)"
        case .joinGroupByCode(let code): return "/groups/code/\(code)"
        case .joinGroupById(let sgtIdx, _): return "/groups/\(sgtIdx)/join"

        // Group Members
        case .getGroupMembers(let sgtIdx): return "/group-members/member/\(sgtIdx)"
        case .updateMemberRole(let sgtIdx, _, _): return "/group-members/\(sgtIdx)/role"
        case .removeMember(let sgtIdx, let mtIdx): return "/group-members/\(sgtIdx)/member/\(mtIdx)"

        // My Places
        case .getMemberLocations(let memberId): return "/locations/member/\(memberId)"
        case .createLocation(let memberId, _): return "/locations/members/\(memberId)/locations"
        case .updateLocation(let locationId, _): return "/locations/\(locationId)"
        case .deleteLocation(let locationId): return "/locations/\(locationId)"
        case .toggleLocationNotification(let locationId, _): return "/locations/\(locationId)/notification"

        // Schedules
        case .getGroupSchedules(let sgtIdx): return "/schedules/group/\(sgtIdx)"

        // Notifications
        case .getMemberPushLogs(let memberId): return "/push-logs/member/\(memberId)"
        case .markNotificationRead(let id): return "/push-logs/\(id)/read"
        case .markAllNotificationsRead(let memberId): return "/push-logs/read-all?mt_idx=\(memberId)"
        case .deleteNotification(let id): return "/push-logs/\(id)"
        case .deleteAllNotifications(let memberId): return "/push-logs/delete-all?mt_idx=\(memberId)"

        // Location Logging
        case .createLocationLog: return "/logs/member-location-logs"

        // FCM
        case .registerFCMToken: return "/member-fcm-token/register"
        }
    }

    private enum HTTPMethod: String {
        case GET, POST, PUT, DELETE, PATCH
    }

    private var method: HTTPMethod {
        switch self {
        case .getCurrentUserGroups, .getGroupMembers, .getGroupStats,
             .fetchProfile, .getMemberLocations, .getGroupSchedules,
             .getMemberPushLogs, .joinGroupByCode:
            return .GET

        case .login, .googleLogin, .appleLogin, .register,
             .createGroup, .joinGroupById, .createLocation,
             .updateProfile, .changePassword, .verifyPassword, .withdraw,
             .uploadProfileImage, .createLocationLog, .registerFCMToken,
             .markAllNotificationsRead, .deleteAllNotifications:
            return .POST

        case .updateGroup, .updateLocation, .toggleLocationNotification,
             .updateMemberRole, .deleteGroup:
            return .PUT

        case .deleteLocation, .removeMember, .deleteNotification:
            return .DELETE

        case .markNotificationRead:
            return .PATCH
        }
    }

    private var body: Data? {
        switch self {
        case .login(let mtId, let mtPwd, let fcmToken, let deviceId, let deviceModel, let osVersion, let appVersion):
            var dict: [String: Any] = ["mt_id": mtId, "mt_pwd": mtPwd, "os_type": "ios"]
            if let fcmToken { dict["fcm_token"] = fcmToken }
            if let deviceId { dict["device_id"] = deviceId }
            if let deviceModel { dict["device_model"] = deviceModel }
            if let osVersion { dict["os_version"] = osVersion }
            if let appVersion { dict["app_version"] = appVersion }
            return try? JSONSerialization.data(withJSONObject: dict)

        case .googleLogin(let req): return try? JSONEncoder().encode(req)
        case .appleLogin(let req): return try? JSONEncoder().encode(req)
        case .register(let req): return try? JSONEncoder().encode(req)
        case .updateProfile(let req): return try? JSONEncoder().encode(req)
        case .changePassword(let req): return try? JSONEncoder().encode(req)
        case .verifyPassword(let req): return try? JSONEncoder().encode(req)
        case .withdraw(let req): return try? JSONEncoder().encode(req)

        case .createGroup(let title, let memo):
            return try? JSONSerialization.data(withJSONObject: ["sgt_title": title, "sgt_memo": memo, "sgt_show": "Y"])

        case .updateGroup(_, let title, let memo):
            return try? JSONSerialization.data(withJSONObject: ["sgt_title": title, "sgt_memo": memo])

        case .deleteGroup:
            return try? JSONSerialization.data(withJSONObject: ["sgt_show": "N"])

        case .joinGroupById(_, let mtIdx):
            return try? JSONSerialization.data(withJSONObject: ["mt_idx": mtIdx])

        case .updateMemberRole(_, let mtIdx, let isLeader):
            return try? JSONSerialization.data(withJSONObject: ["mt_idx": mtIdx, "is_leader": isLeader])

        case .createLocation(_, let req), .updateLocation(_, let req):
            return try? JSONEncoder().encode(req)

        case .toggleLocationNotification(_, let enabled):
            return try? JSONSerialization.data(withJSONObject: ["slt_enter_alarm": enabled])

        case .createLocationLog(let params):
            return try? JSONSerialization.data(withJSONObject: params)

        case .registerFCMToken(let mtIdx, let fcmToken, let apnsToken):
            var dict: [String: Any] = ["mt_idx": mtIdx, "fcm_token": fcmToken]
            if let apnsToken { dict["apns_token"] = apnsToken }
            return try? JSONSerialization.data(withJSONObject: dict)

        default:
            return nil
        }
    }
}

// MARK: - AnyEncodable (타입-erased Encodable wrapper)

struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
```

- [ ] **Step 4: 프로젝트에 파일 추가 및 테스트 통과 확인**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
main_target = project.targets.find { |t| t.name == 'smap' }
test_target = project.targets.find { |t| t.name == 'smapTests' }

# 기존 Core/Network 그룹 찾기
smap_group = project.main_group.groups.find { |g| g.name == 'smap' || g.path == 'smap' }
core_group = smap_group.groups.find { |g| g.name == 'Core' }
network_group = core_group.groups.find { |g| g.name == 'Network' }
ref = network_group.new_file('APIEndpoint.swift')
main_target.source_build_phase.add_file_reference(ref)

# 테스트 파일 추가
tests_group = project.main_group.groups.find { |g| g.name == 'smapTests' }
test_core = tests_group.groups.find { |g| g.name == 'Core' }
test_network = test_core.groups.find { |g| g.name == 'Network' }
test_ref = test_network.new_file('APIEndpointTests.swift')
test_target.source_build_phase.add_file_reference(test_ref)

project.save
"
```

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/APIEndpointTests -quiet 2>&1 | tail -10`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Network/APIEndpoint.swift smapTests/Core/Network/APIEndpointTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add APIEndpoint type-safe endpoint definitions with tests"
```

---

## Task 6: APIClient — 통합 네트워크 클라이언트 (TDD)

**Files:**
- Create: `smap/Core/Network/APIClient.swift`
- Create: `smapTests/Core/Network/APIClientTests.swift`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Network/APIClientTests.swift`
```swift
import XCTest
@testable import smap

final class APIClientTests: XCTestCase {

    var client: APIClient!

    // 테스트 전용 디코딩 타입 — 모델 레이어와 결합 방지
    private struct TestItem: Decodable, Equatable {
        let id: Int
        let name: String
    }

    override func setUp() {
        super.setUp()
        // URLProtocol 스텁 등록
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        client = APIClient(session: URLSession(configuration: config), baseURL: "https://test.api.com/v1")
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testRequest_decodesSuccessResponse() async throws {
        // Given
        let responseJSON = """
        [{"id": 1, "name": "Test"}]
        """.data(using: .utf8)!

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url?.path, "/v1/groups/current-user")
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, responseJSON)
        }

        // When
        let items: [TestItem] = try await client.request(.getCurrentUserGroups)

        // Then
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].name, "Test")
    }

    func testRequest_throwsUnauthorized_on401() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            XCTAssertTrue(error.isUnauthorized)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testRequest_throwsServerError_on500() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (response, "Server Error".data(using: .utf8)!)
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            if case .serverError(let code, _) = error {
                XCTAssertEqual(code, 500)
            } else {
                XCTFail("Expected serverError, got \(error)")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }

    func testRequest_injectsAuthorizationHeader() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, "[]".data(using: .utf8)!)
        }

        let _: [TestItem] = try await client.request(.getCurrentUserGroups, token: "test-token")
    }

    func testRequest_throwsDecodingError_onInvalidJSON() async {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, "not json".data(using: .utf8)!)
        }

        do {
            let _: [TestItem] = try await client.request(.getCurrentUserGroups)
            XCTFail("Should have thrown")
        } catch let error as NetworkError {
            if case .decodingFailed = error {
                // Expected
            } else {
                XCTFail("Expected decodingFailed, got \(error)")
            }
        } catch {
            XCTFail("Wrong error type")
        }
    }
}

// MARK: - MockURLProtocol

class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            fatalError("MockURLProtocol.requestHandler not set")
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/APIClientTests -quiet 2>&1 | tail -10`
Expected: FAIL — `APIClient` 타입이 존재하지 않음

- [ ] **Step 3: APIClient 구현**

Create: `smap/Core/Network/APIClient.swift`
```swift
import Foundation

/// 통합 네트워크 클라이언트
/// 모든 Service의 URLRequest 구성, 토큰 주입, 에러 처리를 중앙 관리
final class APIClient: @unchecked Sendable {

    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String

    init(
        session: URLSession = .shared,
        baseURL: String = AppConfiguration.apiV1BaseURL
    ) {
        self.session = session
        self.baseURL = baseURL
    }

    // MARK: - JSON Request

    /// JSON 응답을 디코딩하여 반환
    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        token: String? = nil,
        decoder: JSONDecoder = JSONDecoder()
    ) async throws -> T {
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        // 토큰 주입
        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(-1, data)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.fromHTTPStatus(httpResponse.statusCode, data: data)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch let error as DecodingError {
            throw NetworkError.decodingFailed(error)
        }
    }

    /// JSON 디코딩 없이 raw Data 반환 (상태 코드만 확인)
    func requestRaw(
        _ endpoint: APIEndpoint,
        token: String? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(-1, data)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.fromHTTPStatus(httpResponse.statusCode, data: data)
        }

        return (data, httpResponse)
    }

    // MARK: - Multipart Upload

    /// multipart/form-data 파일 업로드
    func upload(
        _ endpoint: APIEndpoint,
        fileData: Data,
        fileName: String,
        fieldName: String = "file",
        mimeType: String = "image/jpeg",
        additionalFields: [String: String] = [:],
        token: String? = nil
    ) async throws -> Data {
        var urlRequest = endpoint.urlRequest(baseURL: baseURL)

        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let boundary = UUID().uuidString
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // 파일 데이터
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)

        // 추가 필드
        for (key, value) in additionalFields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        urlRequest.httpBody = body

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw NetworkError.fromHTTPStatus(statusCode, data: data)
        }

        return data
    }

    // MARK: - Private

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            throw NetworkError.network(error)
        }
    }
}
```

- [ ] **Step 4: 프로젝트에 파일 추가 및 테스트 통과 확인**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
main_target = project.targets.find { |t| t.name == 'smap' }
test_target = project.targets.find { |t| t.name == 'smapTests' }

smap_group = project.main_group.groups.find { |g| g.name == 'smap' || g.path == 'smap' }
core_group = smap_group.groups.find { |g| g.name == 'Core' }
network_group = core_group.groups.find { |g| g.name == 'Network' }
ref = network_group.new_file('APIClient.swift')
main_target.source_build_phase.add_file_reference(ref)

tests_group = project.main_group.groups.find { |g| g.name == 'smapTests' }
test_core = tests_group.groups.find { |g| g.name == 'Core' }
test_network = test_core.groups.find { |g| g.name == 'Network' }
test_ref = test_network.new_file('APIClientTests.swift')
test_target.source_build_phase.add_file_reference(test_ref)

project.save
"
```

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/APIClientTests -quiet 2>&1 | tail -10`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Network/APIClient.swift smapTests/Core/Network/APIClientTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add APIClient unified network client with tests"
```

---

## Task 7: KeychainManager — 토큰 관리 (TDD)

**Files:**
- Create: `smap/Core/Storage/KeychainManager.swift`
- Create: `smapTests/Core/Storage/KeychainManagerTests.swift`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Storage/KeychainManagerTests.swift`
```swift
import XCTest
@testable import smap

final class KeychainManagerTests: XCTestCase {

    var manager: KeychainManager!

    override func setUp() {
        super.setUp()
        // 테스트용 서비스 이름으로 격리
        manager = KeychainManager(service: "com.dmonster.smap.tests")
        manager.deleteToken() // 클린 상태
    }

    override func tearDown() {
        manager.deleteToken()
        super.tearDown()
    }

    func testSaveAndRetrieveToken() {
        manager.saveToken("test-jwt-token-12345")
        XCTAssertEqual(manager.getToken(), "test-jwt-token-12345")
    }

    func testGetToken_returnsNil_whenNoTokenSaved() {
        XCTAssertNil(manager.getToken())
    }

    func testDeleteToken_removesToken() {
        manager.saveToken("token-to-delete")
        manager.deleteToken()
        XCTAssertNil(manager.getToken())
    }

    func testSaveToken_overwritesExistingToken() {
        manager.saveToken("old-token")
        manager.saveToken("new-token")
        XCTAssertEqual(manager.getToken(), "new-token")
    }

    func testHasToken() {
        XCTAssertFalse(manager.hasToken)
        manager.saveToken("some-token")
        XCTAssertTrue(manager.hasToken)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests/KeychainManagerTests -quiet 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: KeychainManager 구현**

Create: `smap/Core/Storage/KeychainManager.swift`
```swift
import Foundation
import Security

/// Keychain 기반 토큰 관리
/// AuthService의 Keychain 로직을 통합한 독립 모듈
final class KeychainManager: Sendable {

    static let shared = KeychainManager()

    private let service: String
    private let tokenAccount = "smap_auth_token"

    init(service: String = "com.dmonster.smap") {
        self.service = service
    }

    // MARK: - Token Operations

    /// JWT 토큰 저장 (기존 토큰 덮어쓰기)
    func saveToken(_ token: String) {
        deleteToken()

        guard let data = token.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    /// JWT 토큰 조회
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    /// JWT 토큰 삭제
    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount
        ]

        SecItemDelete(query as CFDictionary)
    }

    /// 토큰 존재 여부
    var hasToken: Bool {
        getToken() != nil
    }
}
```

- [ ] **Step 4: 프로젝트에 파일 추가 및 테스트 통과 확인**

프로젝트에 Storage 그룹 생성 및 파일 추가 (ruby xcodeproj 스크립트).

Run: `xcodebuild test ... -only-testing:smapTests/KeychainManagerTests`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Storage/KeychainManager.swift smapTests/Core/Storage/KeychainManagerTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add KeychainManager for unified token management with tests"
```

---

## Task 8: UserDefaultsManager — 타입-safe UserDefaults (TDD)

**Files:**
- Create: `smap/Core/Storage/UserDefaultsManager.swift`
- Create: `smapTests/Core/Storage/UserDefaultsManagerTests.swift`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Storage/UserDefaultsManagerTests.swift`
```swift
import XCTest
@testable import smap

final class UserDefaultsManagerTests: XCTestCase {

    var store: UserDefaultsManager!
    var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "com.dmonster.smap.tests")!
        defaults.removePersistentDomain(forName: "com.dmonster.smap.tests")
        store = UserDefaultsManager(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "com.dmonster.smap.tests")
        super.tearDown()
    }

    func testMtIdx_saveAndRetrieve() {
        store.mtIdx = "123"
        XCTAssertEqual(store.mtIdx, "123")
    }

    func testMtIdx_defaultsToNil() {
        XCTAssertNil(store.mtIdx)
    }

    func testIsLoggedIn_defaultsToFalse() {
        XCTAssertFalse(store.isLoggedIn)
    }

    func testIsLoggedIn_saveAndRetrieve() {
        store.isLoggedIn = true
        XCTAssertTrue(store.isLoggedIn)
    }

    func testUserData_encodeDecode() {
        let user = SMAPUser(
            mt_idx: 42,
            mt_id: "01012345678",
            mt_name: "테스트",
            mt_nickname: "닉네임"
        )
        store.saveUserData(user)
        let retrieved = store.getUserData()
        XCTAssertEqual(retrieved?.mt_idx, 42)
        XCTAssertEqual(retrieved?.mt_name, "테스트")
    }

    func testClearAll_removesAllKeys() {
        store.mtIdx = "123"
        store.isLoggedIn = true
        store.fcmToken = "fcm-token"
        store.clearAll()
        XCTAssertNil(store.mtIdx)
        XCTAssertFalse(store.isLoggedIn)
        XCTAssertNil(store.fcmToken)
    }

    func testFcmToken_saveAndRetrieve() {
        store.fcmToken = "fcm-token-abc"
        XCTAssertEqual(store.fcmToken, "fcm-token-abc")
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test ... -only-testing:smapTests/UserDefaultsManagerTests`
Expected: FAIL

- [ ] **Step 3: UserDefaultsManager 구현**

Create: `smap/Core/Storage/UserDefaultsManager.swift`
```swift
import Foundation

/// 타입-safe UserDefaults 관리
/// 매직 스트링 UserDefaults 접근을 통합 관리
final class UserDefaultsManager {

    static let shared = UserDefaultsManager()

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Storage Keys

    private enum Key: String {
        case mtIdx = "mt_idx"
        case mtId = "mt_id"
        case mtName = "mt_name"
        case mtEmail = "mt_email"
        case isLoggedIn = "is_logged_in"
        case fcmToken = "fcm_token"
        case apnsToken = "last_apns_token"
        case lastFCMUpdate = "last_updated_fcm_token"
        case userData = "smap_user_data"
        case loginTime = "smap_login_time"
        case storageMigrated = "smap_storage_migrated_v2"
    }

    // MARK: - User Identity

    var mtIdx: String? {
        get { defaults.string(forKey: Key.mtIdx.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtIdx.rawValue) }
    }

    var mtId: String? {
        get { defaults.string(forKey: Key.mtId.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtId.rawValue) }
    }

    var mtName: String? {
        get { defaults.string(forKey: Key.mtName.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtName.rawValue) }
    }

    var mtEmail: String? {
        get { defaults.string(forKey: Key.mtEmail.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtEmail.rawValue) }
    }

    var isLoggedIn: Bool {
        get { defaults.bool(forKey: Key.isLoggedIn.rawValue) }
        set { defaults.set(newValue, forKey: Key.isLoggedIn.rawValue) }
    }

    // MARK: - Push Notifications

    var fcmToken: String? {
        get { defaults.string(forKey: Key.fcmToken.rawValue) }
        set { defaults.set(newValue, forKey: Key.fcmToken.rawValue) }
    }

    var apnsToken: String? {
        get { defaults.string(forKey: Key.apnsToken.rawValue) }
        set { defaults.set(newValue, forKey: Key.apnsToken.rawValue) }
    }

    var lastFCMUpdate: String? {
        get { defaults.string(forKey: Key.lastFCMUpdate.rawValue) }
        set { defaults.set(newValue, forKey: Key.lastFCMUpdate.rawValue) }
    }

    // MARK: - User Data (Encoded)

    func saveUserData(_ user: SMAPUser) {
        if let encoded = try? JSONEncoder().encode(user) {
            defaults.set(encoded, forKey: Key.userData.rawValue)
            defaults.set(Date().timeIntervalSince1970, forKey: Key.loginTime.rawValue)
        }
    }

    func getUserData() -> SMAPUser? {
        guard let data = defaults.data(forKey: Key.userData.rawValue) else { return nil }
        return try? JSONDecoder().decode(SMAPUser.self, from: data)
    }

    // MARK: - Migration

    var isStorageMigrated: Bool {
        get { defaults.bool(forKey: Key.storageMigrated.rawValue) }
        set { defaults.set(newValue, forKey: Key.storageMigrated.rawValue) }
    }

    // MARK: - Clear

    func clearAll() {
        let keys: [Key] = [.mtIdx, .mtId, .mtName, .mtEmail, .isLoggedIn,
                           .fcmToken, .apnsToken, .lastFCMUpdate,
                           .userData, .loginTime]
        keys.forEach { defaults.removeObject(forKey: $0.rawValue) }
    }
}
```

- [ ] **Step 4: 프로젝트에 파일 추가 및 테스트 통과 확인**

Run: `xcodebuild test ... -only-testing:smapTests/UserDefaultsManagerTests`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Storage/UserDefaultsManager.swift smapTests/Core/Storage/UserDefaultsManagerTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add UserDefaultsManager type-safe storage with tests"
```

---

## Task 9: DataMigration — 기존 데이터 마이그레이션 (TDD)

**Files:**
- Create: `smap/Core/Storage/DataMigration.swift`
- Create: `smapTests/Core/Storage/DataMigrationTests.swift`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `smapTests/Core/Storage/DataMigrationTests.swift`
```swift
import XCTest
@testable import smap

final class DataMigrationTests: XCTestCase {

    var defaults: UserDefaults!
    var store: UserDefaultsManager!
    var keychain: KeychainManager!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "com.dmonster.smap.migration-tests")!
        defaults.removePersistentDomain(forName: "com.dmonster.smap.migration-tests")
        store = UserDefaultsManager(defaults: defaults)
        keychain = KeychainManager(service: "com.dmonster.smap.migration-tests")
        keychain.deleteToken()
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "com.dmonster.smap.migration-tests")
        keychain.deleteToken()
        super.tearDown()
    }

    func testMigrateIfNeeded_migratesUserDefaults() {
        // Given: 기존 데이터 시뮬레이션
        defaults.set("42", forKey: "mt_idx")
        defaults.set("01012345678", forKey: "mt_id")
        defaults.set("홍길동", forKey: "mt_name")

        // When
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)

        // Then
        XCTAssertEqual(store.mtIdx, "42")
        XCTAssertEqual(store.mtId, "01012345678")
        XCTAssertEqual(store.mtName, "홍길동")
        XCTAssertTrue(store.isStorageMigrated)
    }

    func testMigrateIfNeeded_skipsIfAlreadyMigrated() {
        // Given: 이미 마이그레이션된 상태
        store.isStorageMigrated = true
        defaults.set("old-value", forKey: "mt_idx")
        store.mtIdx = "new-value"

        // When
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)

        // Then: store의 값은 변경되지 않아야 함
        XCTAssertEqual(store.mtIdx, "new-value")
    }

    func testMigrateIfNeeded_setsStorageMigratedFlag() {
        DataMigration.migrateIfNeeded(store: store, keychain: keychain, defaults: defaults)
        XCTAssertTrue(store.isStorageMigrated)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `xcodebuild test ... -only-testing:smapTests/DataMigrationTests`
Expected: FAIL

- [ ] **Step 3: DataMigration 구현**

Create: `smap/Core/Storage/DataMigration.swift`
```swift
import Foundation

/// 기존 UserDefaults/Keychain 데이터를 새 Manager로 1회 마이그레이션
/// 기존 사용자가 앱 업데이트 후 재로그인하지 않도록 보존
enum DataMigration {

    /// 마이그레이션 실행 (이미 완료된 경우 스킵)
    static func migrateIfNeeded(
        store: UserDefaultsManager = .shared,
        keychain: KeychainManager = .shared,
        defaults: UserDefaults = .standard
    ) {
        guard !store.isStorageMigrated else { return }

        // 기존 Keychain 토큰 마이그레이션
        // AuthService의 기존 Keychain 접근 패턴과 동일한 키 사용
        if let oldToken = legacyKeychainRead("smap_auth_token"), !keychain.hasToken {
            keychain.saveToken(oldToken)
        }

        // 기존 UserDefaults 값 마이그레이션
        if let mtIdx = defaults.string(forKey: "mt_idx") {
            store.mtIdx = mtIdx
        }
        if let mtId = defaults.string(forKey: "mt_id") {
            store.mtId = mtId
        }
        if let mtName = defaults.string(forKey: "mt_name") {
            store.mtName = mtName
        }
        if let mtEmail = defaults.string(forKey: "mt_email") {
            store.mtEmail = mtEmail
        }
        if defaults.object(forKey: "is_logged_in") != nil {
            store.isLoggedIn = defaults.bool(forKey: "is_logged_in")
        }
        if let fcmToken = defaults.string(forKey: "fcm_token") {
            store.fcmToken = fcmToken
        }

        // 기존 인코딩된 사용자 데이터
        if let userData = defaults.data(forKey: "smap_user_data"),
           let user = try? JSONDecoder().decode(SMAPUser.self, from: userData) {
            store.saveUserData(user)
        }

        // 마이그레이션 후 레거시 Keychain 항목 정리
        // AuthService의 기존 항목은 kSecAttrService 없이 저장됨
        // KeychainManager는 service를 지정하므로 별도 항목
        legacyKeychainDelete("smap_auth_token")

        store.isStorageMigrated = true
        print("✅ [DataMigration] 데이터 마이그레이션 완료")
    }

    // MARK: - Legacy Keychain Access

    /// 기존 AuthService의 Keychain 접근 패턴 (service 미지정)
    private static func legacyKeychainRead(_ account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    /// 레거시 Keychain 항목 삭제 (service 미지정)
    private static func legacyKeychainDelete(_ account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

- [ ] **Step 4: 프로젝트에 파일 추가 및 테스트 통과 확인**

Run: `xcodebuild test ... -only-testing:smapTests/DataMigrationTests`
Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add smap/Core/Storage/DataMigration.swift smapTests/Core/Storage/DataMigrationTests.swift smap.xcodeproj/project.pbxproj
git commit -m "feat: add DataMigration for legacy storage migration with tests"
```

---

## Task 10: DesignSystem — Theme 통합

**Files:**
- Create: `smap/DesignSystem/Theme.swift`
- Create: `smap/DesignSystem/Components/SMAPButton.swift`
- Create: `smap/DesignSystem/Components/SMAPTextField.swift`
- Create: `smap/DesignSystem/Components/SMAPLoadingView.swift`
- Create: `smap/DesignSystem/Components/SMAPSnackBar.swift`

**Note:** 기존 `AppStyles.swift`는 유지하되, 새 코드에서는 `SMAPTheme`을 사용. Phase 3에서 기존 `BrandColors`/`AppFonts` 참조를 전환한 후 삭제.

- [ ] **Step 1: Theme.swift 생성**

Create: `smap/DesignSystem/Theme.swift`

**Note:** `SMAPTheme.Font`은 `AppStyles.swift`에 정의된 `Font.suite()` extension에 의존합니다. Phase 3에서 `AppStyles.swift`를 제거할 때 이 extension을 `Theme.swift`로 이동해야 합니다. 현재는 중복 정의를 피하기 위해 기존 extension을 그대로 사용합니다.

```swift
import SwiftUI

/// 디자인 시스템 통합 진입점
/// 기존 BrandColors, AppFonts를 하나의 네임스페이스로 통합
/// Note: Font.suite() extension은 AppStyles.swift에 정의됨 — Phase 3에서 여기로 이동 예정
enum SMAPTheme {

    // MARK: - Colors

    enum Color {
        static let primary = SwiftUI.Color(red: 1/255, green: 19/255, blue: 163/255)    // #0113A3
        static let primaryDark = SwiftUI.Color(red: 0/255, green: 31/255, blue: 135/255) // #001f87
        static let background = SwiftUI.Color(red: 254/255, green: 248/255, blue: 249/255) // #fef8f9
        static let textPrimary = SwiftUI.Color.black
        static let textSecondary = SwiftUI.Color(UIColor.systemGray)
        static let inputBackground = SwiftUI.Color(UIColor.systemGray6)
        static let border = SwiftUI.Color(UIColor.systemGray4)
        static let error = SwiftUI.Color.red
        static let success = SwiftUI.Color.green
        static let warning = SwiftUI.Color.orange
        static let white = SwiftUI.Color.white
    }

    // MARK: - Fonts (SUITE 폰트 기반)

    enum Font {
        static let title = SwiftUI.Font.suite(size: 22, weight: .bold)
        static let headline = SwiftUI.Font.suite(size: 18, weight: .bold)
        static let subheadline = SwiftUI.Font.suite(size: 16, weight: .semibold)
        static let body = SwiftUI.Font.suite(size: 16, weight: .regular)
        static let bodyMedium = SwiftUI.Font.suite(size: 17, weight: .medium)
        static let bodyBold = SwiftUI.Font.suite(size: 16, weight: .semibold)
        static let secondary = SwiftUI.Font.suite(size: 15, weight: .regular)
        static let secondaryMedium = SwiftUI.Font.suite(size: 15, weight: .medium)
        static let caption = SwiftUI.Font.suite(size: 14, weight: .regular)
        static let captionMedium = SwiftUI.Font.suite(size: 14, weight: .medium)
        static let captionBold = SwiftUI.Font.suite(size: 14, weight: .bold)
        static let captionSmall = SwiftUI.Font.suite(size: 12, weight: .regular)
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    // MARK: - Corner Radius

    enum Radius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let full: CGFloat = 999
    }
}
```

- [ ] **Step 2: SMAPButton 생성**

Create: `smap/DesignSystem/Components/SMAPButton.swift`
```swift
import SwiftUI

/// 재사용 버튼 컴포넌트
/// 스타일: primary, secondary, outline, danger
struct SMAPButton: View {

    enum Style {
        case primary, secondary, outline, danger
    }

    let title: String
    let style: Style
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    init(
        _ title: String,
        style: Style = .primary,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: SMAPTheme.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(foregroundColor)
                }
                Text(title)
                    .font(SMAPTheme.Font.bodyBold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(backgroundColor)
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.md))
            .overlay {
                if style == .outline {
                    RoundedRectangle(cornerRadius: SMAPTheme.Radius.md)
                        .stroke(SMAPTheme.Color.primary, lineWidth: 1)
                }
            }
        }
        .disabled(isDisabled || isLoading)
        .opacity((isDisabled || isLoading) ? 0.6 : 1.0)
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: return SMAPTheme.Color.primary
        case .secondary: return SMAPTheme.Color.inputBackground
        case .outline: return .clear
        case .danger: return SMAPTheme.Color.error
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .primary, .danger: return SMAPTheme.Color.white
        case .secondary: return SMAPTheme.Color.textPrimary
        case .outline: return SMAPTheme.Color.primary
        }
    }
}
```

- [ ] **Step 3: SMAPTextField 생성**

Create: `smap/DesignSystem/Components/SMAPTextField.swift`
```swift
import SwiftUI

/// 재사용 텍스트필드 컴포넌트
/// 에러 메시지, @FocusState 키보드 처리 포함
struct SMAPTextField: View {

    let placeholder: String
    @Binding var text: String
    var errorMessage: String?
    var isSecure: Bool
    var keyboardType: UIKeyboardType
    var submitLabel: SubmitLabel

    init(
        _ placeholder: String,
        text: Binding<String>,
        errorMessage: String? = nil,
        isSecure: Bool = false,
        keyboardType: UIKeyboardType = .default,
        submitLabel: SubmitLabel = .done
    ) {
        self.placeholder = placeholder
        self._text = text
        self.errorMessage = errorMessage
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.submitLabel = submitLabel
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                }
            }
            .font(SMAPTheme.Font.body)
            .padding(.horizontal, SMAPTheme.Spacing.md)
            .padding(.vertical, 14)
            .background(SMAPTheme.Color.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm))
            .overlay {
                RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm)
                    .stroke(errorMessage != nil ? SMAPTheme.Color.error : .clear, lineWidth: 1)
            }
            .submitLabel(submitLabel)

            if let error = errorMessage {
                Text(error)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Color.error)
            }
        }
    }
}
```

- [ ] **Step 4: SMAPLoadingView 생성**

Create: `smap/DesignSystem/Components/SMAPLoadingView.swift`
```swift
import SwiftUI

/// 통일된 로딩 인디케이터
struct SMAPLoadingView: View {

    var message: String?

    var body: some View {
        VStack(spacing: SMAPTheme.Spacing.md) {
            ProgressView()
                .controlSize(.large)
                .tint(SMAPTheme.Color.primary)

            if let message {
                Text(message)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```

- [ ] **Step 5: SMAPSnackBar 생성 (SnackBar.swift Pod 대체)**

Create: `smap/DesignSystem/Components/SMAPSnackBar.swift`
```swift
import SwiftUI

/// SwiftUI 기반 스낵바/토스트 컴포넌트
/// 기존 SnackBar.swift Pod를 대체
struct SMAPSnackBar: ViewModifier {

    @Binding var isPresented: Bool
    let message: String
    let duration: TimeInterval

    init(isPresented: Binding<Bool>, message: String, duration: TimeInterval = 3.0) {
        self._isPresented = isPresented
        self.message = message
        self.duration = duration
    }

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if isPresented {
                Text(message)
                    .font(SMAPTheme.Font.secondary)
                    .foregroundStyle(SMAPTheme.Color.white)
                    .padding(.horizontal, SMAPTheme.Spacing.lg)
                    .padding(.vertical, SMAPTheme.Spacing.md)
                    .background(Color.black.opacity(0.85))
                    .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.sm))
                    .padding(.horizontal, SMAPTheme.Spacing.md)
                    .padding(.bottom, SMAPTheme.Spacing.xl)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task {
                        try? await Task.sleep(for: .seconds(duration))
                        withAnimation { isPresented = false }
                    }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: isPresented)
    }
}

extension View {
    /// 스낵바 표시
    func smapSnackBar(isPresented: Binding<Bool>, message: String, duration: TimeInterval = 3.0) -> some View {
        modifier(SMAPSnackBar(isPresented: isPresented, message: message, duration: duration))
    }
}
```

- [ ] **Step 6: 프로젝트에 모든 DesignSystem 파일 추가**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
ruby -e "
require 'xcodeproj'
project = Xcodeproj::Project.open('smap.xcodeproj')
main_target = project.targets.find { |t| t.name == 'smap' }
smap_group = project.main_group.groups.find { |g| g.name == 'smap' || g.path == 'smap' }

# DesignSystem 그룹 생성
ds_group = smap_group.new_group('DesignSystem', 'smap/DesignSystem')
comp_group = ds_group.new_group('Components', 'smap/DesignSystem/Components')

files = {
  ds_group => ['Theme.swift'],
  comp_group => [
    'SMAPButton.swift',
    'SMAPTextField.swift',
    'SMAPLoadingView.swift',
    'SMAPSnackBar.swift'
  ]
}

files.each do |group, paths|
  paths.each do |path|
    ref = group.new_file(path)
    main_target.source_build_phase.add_file_reference(ref)
  end
end

project.save
puts 'DesignSystem files added to project'
"
```

- [ ] **Step 7: 빌드 확인**

Run: `xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' -quiet 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 8: 커밋**

```bash
git add smap/DesignSystem/ smap.xcodeproj/project.pbxproj
git commit -m "feat: add SMAPTheme design system with reusable components"
```

---

## Task 11: 전체 빌드 & 테스트 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:smapTests -quiet 2>&1 | tail -20`
Expected: All tests passed (NetworkError, APIEndpoint, APIClient, KeychainManager, UserDefaultsManager, DataMigration)

- [ ] **Step 2: 전체 앱 빌드**

Run: `cd /Users/genie/SmapSource/smap_next/iOS && xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' -quiet 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: 생성된 파일 구조 확인**

```bash
find smap/App smap/Core smap/DesignSystem smapTests -name "*.swift" | sort
```

Expected:
```
smap/App/AppConfiguration.swift
smap/Core/Network/APIClient.swift
smap/Core/Network/APIEndpoint.swift
smap/Core/Network/NetworkError.swift
smap/Core/Storage/DataMigration.swift
smap/Core/Storage/KeychainManager.swift
smap/Core/Storage/UserDefaultsManager.swift
smap/DesignSystem/Components/SMAPButton.swift
smap/DesignSystem/Components/SMAPLoadingView.swift
smap/DesignSystem/Components/SMAPSnackBar.swift
smap/DesignSystem/Components/SMAPTextField.swift
smap/DesignSystem/Theme.swift
smapTests/Core/Network/APIClientTests.swift
smapTests/Core/Network/APIEndpointTests.swift
smapTests/Core/Network/NetworkErrorTests.swift
smapTests/Core/Storage/DataMigrationTests.swift
smapTests/Core/Storage/KeychainManagerTests.swift
smapTests/Core/Storage/UserDefaultsManagerTests.swift
smapTests/PlaceholderTests.swift
```

---

## Summary

| Task | 핵심 작업 | 신규 파일 | TDD |
|------|----------|----------|-----|
| 1 | iOS 17+, Pod 정리 | 0 | - |
| 2 | 테스트 타겟 | 1 | - |
| 3 | .xcconfig 시크릿 | 4 (xcconfig) + 1 (swift) | - |
| 4 | NetworkError | 1 + 1 test | Yes |
| 5 | APIEndpoint | 1 + 1 test | Yes |
| 6 | APIClient | 1 + 1 test | Yes |
| 7 | KeychainManager | 1 + 1 test | Yes |
| 8 | UserDefaultsManager | 1 + 1 test | Yes |
| 9 | DataMigration | 1 + 1 test | Yes |
| 10 | DesignSystem | 5 | - |
| 11 | 검증 | 0 | - |

**Phase 1 완료 후 상태:**
- iOS 17.0 deployment target
- IQKeyboardManager, SnackBar.swift, SDWebImage Pod 제거
- 통합 네트워크 인프라 (APIClient + APIEndpoint + NetworkError) — 아직 기존 Service에서 사용하지 않음
- 타입-safe 스토리지 (KeychainManager + UserDefaultsManager + DataMigration)
- 디자인 시스템 (SMAPTheme + 재사용 컴포넌트)
- .xcconfig 기반 시크릿 관리
- 유닛 테스트 인프라 + 6개 테스트 스위트

**Phase 2에서 할 일:**
- 기존 Services를 APIClient 사용으로 마이그레이션
- AuthService의 Keychain/UserDefaults를 KeychainManager/UserDefaultsManager로 전환
- Alamofire Pod 제거 + Api.swift 삭제
- AppDelegate 분해
- Router 구현
- ViewModel @Observable 전환
