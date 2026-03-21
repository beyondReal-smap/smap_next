# iOS App Refactoring, Performance & UI/UX Optimization

## Overview

SMAP iOS 앱의 전면 현대화. 리팩토링, 성능 최적화, UI/UX 개선을 Bottom-Up 방식으로 4단계에 걸쳐 수행한다.

**현재 상태:**
- 41,000+ LOC, Swift 파일 38개
- 거대 파일 다수:
  - LoginView.swift (9,699줄, 51개 View struct 내장 — Auth 외에 HomeView, NotificationListView, MyPlaceView, ActivityLogView 등 6개+ 피처 포함)
  - AppDelegate.swift (9,370줄, FCM 토큰 관리/재시도 로직이 대부분)
  - RootCoordinatorView.swift (6,090줄, 43개 View struct — Settings, Schedule, Profile, Terms 등 포함)
- Alamofire + URLSession 혼재
- WebView 하이브리드 아키텍처 (Main.storyboard → UIKit entry point)
- iOS 15+ 타겟, CocoaPods 10개 의존성
- API 키 하드코딩 (Kakao API key in LocationService, hash key in Http.swift)

**목표 상태:**
- ~30,000 LOC (목표), 파일당 최대 ~300줄
- 전체 네이티브 SwiftUI 앱 (WebView 제거)
- iOS 17+ 타겟, 최신 API 활용 (@Observable, NavigationStack)
- 외부 의존성 5개로 축소 (Firebase, Google/Kakao SDK, NMapsMap)
- 통합 네트워크 레이어, 디자인 시스템, 타입-safe 스토리지
- .xcconfig 기반 시크릿 관리

**유지 사항:**
- 기존 브랜드 디자인 (SUITE 폰트, 커스텀 컬러)
- 모든 기존 기능 (로그인, 그룹, 마이플레이스, 위치 추적, 푸시 알림, 스케줄, 활동 로그, 알림 목록, 프로필 편집, 약관/법적 페이지, 공지/FAQ)

---

## Architecture

### New Directory Structure

```
smap/
├── App/
│   ├── SmapApp.swift              # SwiftUI @main entry point (Main.storyboard 제거)
│   ├── AppConfiguration.swift     # 환경별 설정, API URL, .xcconfig 시크릿
│   └── AppDelegate.swift          # 축소: Firebase/Push 초기화만

├── Core/
│   ├── Network/
│   │   ├── APIClient.swift        # 통합 네트워크 클라이언트 (URLSession)
│   │   ├── APIEndpoint.swift      # 타입-safe 엔드포인트 enum
│   │   └── APIError.swift         # 통합 에러 타입 (network, auth, server, decode)
│   ├── Storage/
│   │   ├── KeychainManager.swift  # 토큰 관리
│   │   ├── UserDefaultsManager.swift  # 타입-safe UserDefaults
│   │   └── DataMigration.swift    # 기존 저장소 → 새 저장소 1회 마이그레이션
│   └── Location/
│       ├── LocationManager.swift  # CLLocationManager 래핑 (@Observable)
│       ├── MotionManager.swift    # 모션 활동 감지
│       └── LocationUploader.swift # 위치 데이터 서버 전송

├── DesignSystem/
│   ├── Theme.swift                # 컬러, 폰트, 간격 통합
│   ├── Components/
│   │   ├── SMAPButton.swift
│   │   ├── SMAPTextField.swift
│   │   ├── SMAPLoadingView.swift
│   │   └── SMAPSnackBar.swift     # SnackBar.swift Pod 대체
│   └── Modifiers/
│       └── SMAPTextStyle.swift

├── Features/
│   ├── Auth/
│   │   ├── LoginView.swift              # 메인 컨테이너 (~200줄)
│   │   ├── LoginViewModel.swift         # UI 상태, 유효성 검증 (~300줄)
│   │   ├── Components/
│   │   │   ├── PhoneInputSection.swift
│   │   │   ├── PasswordInputSection.swift
│   │   │   ├── SocialLoginButtons.swift
│   │   │   ├── TermsAgreementView.swift
│   │   │   ├── VerificationCodeView.swift
│   │   │   └── ProfileSetupView.swift
│   │   ├── SocialAuth/
│   │   │   ├── GoogleAuthService.swift
│   │   │   ├── KakaoAuthService.swift
│   │   │   └── AppleAuthService.swift
│   │   ├── RegisterView.swift
│   │   ├── ForgotPasswordView.swift
│   │   └── LoginStep.swift
│   │
│   ├── Home/
│   │   ├── HomeView.swift               # 네이티브 메인 화면
│   │   ├── HomeViewModel.swift
│   │   ├── NaverMapView.swift           # NMFMapView SwiftUI 래퍼
│   │   ├── GroupSelectorBar.swift
│   │   ├── MemberCardCarousel.swift
│   │   └── SidebarView.swift
│   │
│   ├── Group/
│   │   ├── GroupListView.swift
│   │   ├── GroupDetailView.swift
│   │   ├── GroupCreationView.swift
│   │   └── GroupViewModel.swift
│   │
│   ├── MyPlace/
│   │   ├── MyPlaceView.swift
│   │   ├── MyPlaceViewModel.swift
│   │   └── Components/               # MyPlace 하위 뷰들
│   │
│   ├── Schedule/
│   │   ├── ScheduleListView.swift     # RootCoordinatorView에서 추출
│   │   ├── ScheduleFormView.swift
│   │   └── ScheduleViewModel.swift
│   │
│   ├── ActivityLog/
│   │   ├── ActivityLogView.swift      # LoginView.swift에서 추출
│   │   ├── ActivityLogSidebarView.swift
│   │   ├── ActivityLogHeaderView.swift
│   │   ├── ActivityLogFloatingCard.swift
│   │   └── ActivityLogViewModel.swift
│   │
│   ├── Notifications/
│   │   ├── NotificationListView.swift  # LoginView.swift에서 추출
│   │   ├── NotificationRow.swift
│   │   └── NotificationViewModel.swift
│   │
│   ├── Settings/
│   │   ├── SettingsView.swift
│   │   ├── EditProfileView.swift       # RootCoordinatorView에서 추출
│   │   ├── ChangePasswordView.swift    # RootCoordinatorView에서 추출
│   │   ├── WithdrawView.swift
│   │   ├── Terms/
│   │   │   ├── ServiceTermsView.swift      # RootCoordinatorView에서 추출
│   │   │   ├── PrivacyPolicyView.swift
│   │   │   ├── LocationTermsView.swift
│   │   │   ├── MarketingConsentView.swift
│   │   │   └── ThirdPartyProvisionView.swift
│   │   └── Support/
│   │       ├── NoticeListView.swift         # RootCoordinatorView에서 추출
│   │       ├── NoticeDetailView.swift
│   │       ├── InquiryView.swift
│   │       └── UserGuideView.swift
│   │
│   └── Shared/
│       ├── LocationDetailPanel.swift
│       ├── LocationSearchView.swift
│       ├── ShareOptionsView.swift
│       └── QRCodeView.swift

├── Services/
│   ├── AuthService.swift
│   ├── GroupService.swift
│   ├── MyPlaceService.swift
│   ├── NotificationService.swift
│   ├── ScheduleService.swift
│   ├── PurchaseService.swift          # StoreKit 2
│   ├── FCMService.swift               # AppDelegate에서 분리
│   ├── DeepLinkService.swift
│   └── KakaoPlaceSearchService.swift  # 기존 Services/LocationService.swift 이름 변경

├── Models/
│   ├── LoginModels.swift
│   ├── HomeModels.swift
│   ├── MyPlaceModels.swift
│   ├── ScheduleModels.swift
│   └── NotificationModels.swift

└── Navigation/
    └── Router.swift                   # NavigationStack 기반 라우팅
```

### Key Architecture Decisions

| 현재 | 변경 후 | 이유 |
|------|---------|------|
| `ObservableObject` + `@Published` | `@Observable` 매크로 | iOS 17+ 성능 최적화, 보일러플레이트 감소 |
| `NavigationView` | `NavigationStack` + `Router` | 타입-safe 네비게이션, 딥링크 지원 |
| Alamofire + URLSession 혼재 | 통합 `APIClient` (URLSession) | 의존성 제거, 일관성 |
| 분산된 컬러/폰트 | `DesignSystem/Theme.swift` | 단일 source of truth |
| WebView 하이브리드 | 전체 네이티브 SwiftUI | 성능, UX 일관성 |
| Singleton + ObservableObject | Singleton + `@Observable` + `@Environment` 주입 | 관찰 정확성, 테스트 용이성 |
| Main.storyboard UIKit entry | SwiftUI `@main` App struct | 현대적 앱 진입점 |
| 하드코딩된 API 키 | `.xcconfig` 파일 + Info.plist 주입 | 보안, 환경별 설정 분리 |

### Observation Pattern for Singletons

`@Observable` 싱글턴은 `@Environment`로 주입하여 SwiftUI 뷰에서 정확한 관찰이 이루어지도록 한다:

```swift
// App entry point에서 등록
@main
struct SmapApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(AuthService.shared)
                .environment(LocationManager.shared)
        }
    }
}

// View에서 사용
struct GroupListView: View {
    @Environment(AuthService.self) private var authService
    @State private var viewModel = GroupViewModel()
    // ...
}
```

### Router Ownership

4개 탭 각각 독립된 NavigationStack을 가지므로, 탭별 Router는 TabView 내부에서 관리:

```swift
struct MainTabView: View {
    @State private var homePath = NavigationPath()
    @State private var groupPath = NavigationPath()
    @State private var myPlacePath = NavigationPath()
    @State private var settingsPath = NavigationPath()
    // 각 탭에 해당 path 바인딩
}
```

글로벌 라우팅(딥링크, 푸시 알림에서 특정 화면으로 이동)은 `DeepLinkService`가 처리.

---

## Phase 1: Architecture Foundation

### 1.1 iOS 17+ Migration & Storyboard Removal

- Deployment target을 iOS 17.0으로 변경
- Podfile의 platform을 `ios, '17.0'`으로 업데이트
- **Main.storyboard 제거**: 프로젝트 설정에서 Main Interface를 삭제하고 `SmapApp.swift`를 `@main` 진입점으로 설정
- **AppDelegate의 `@main` 제거**: `@UIApplicationDelegateAdaptor`로 전환
- IntroView(스플래시/인증 체크)를 SwiftUI `RootView`로 대체
- `@Observable` 전환은 Phase 2에서 ViewModel 분리와 동시에 수행 (이중 작업 방지)

### 1.2 Dependency Cleanup

**제거:**

| Pod | 대체 |
|-----|------|
| `Alamofire ~> 5.5` | `URLSession` + `APIClient` |
| `IQKeyboardManagerSwift` | SwiftUI `.scrollDismissesKeyboard()`, `@FocusState` |
| `SnackBar.swift` | 커스텀 `SMAPSnackBar` (SwiftUI overlay) |
| `SwiftyStoreKit` | `StoreKit 2` 네이티브 API |
| `SDWebImage ~> 5.0` | 제거 (현재 코드에서 미사용 확인) |

**유지:**
- `Firebase/Auth`, `Firebase/Core`, `Firebase/Messaging`
- `GoogleSignIn ~> 7.0`, `AppAuth ~> 1.7`
- `KakaoSDKCommon ~> 2.22`, `KakaoSDKAuth ~> 2.22`, `KakaoSDKUser ~> 2.22`
- `NMapsMap`

### 1.3 Secrets Management

하드코딩된 API 키를 `.xcconfig` 파일로 이동:

```
# Config/Debug.xcconfig
KAKAO_API_KEY = 7fbf60571daf54ca5bee8373a1f31d2d
API_BASE_URL = https:$(/)$(/)api3.smap.site$(/)api$(/)
WEB_BASE_URL = https:$(/)$(/)nextstep.smap.site$(/)

# Config/Release.xcconfig
KAKAO_API_KEY = $(KAKAO_API_KEY)
API_BASE_URL = https:$(/)$(/)api3.smap.site$(/)api$(/)
WEB_BASE_URL = https:$(/)$(/)nextstep.smap.site$(/)
```

Info.plist에서 `$(KAKAO_API_KEY)` 등으로 참조. `.xcconfig` 파일은 `.gitignore`에 추가하고 `.xcconfig.example` 템플릿을 커밋.

```swift
enum AppConfiguration {
    static let apiBaseURL: String = {
        Bundle.main.infoDictionary?["API_BASE_URL"] as? String ?? "https://api3.smap.site/api/"
    }()
    static let kakaoAPIKey: String = {
        Bundle.main.infoDictionary?["KAKAO_API_KEY"] as? String ?? ""
    }()
}
```

### 1.4 Unified Network Layer (APIClient)

`APIClient`로 thread-safe한 통합 네트워크 클라이언트 구현:
- 모든 Service가 `APIClient`를 통해 요청
- 자동 토큰 주입 (KeychainManager 연동)
- 통합 에러 핸들링
- `APIEndpoint` enum으로 타입-safe 엔드포인트 정의
- JSON request, multipart upload 모두 지원

```swift
final class APIClient: Sendable {
    static let shared = APIClient()

    func request<T: Decodable>(_ endpoint: APIEndpoint, type: T.Type) async throws -> T
    func upload(_ endpoint: APIEndpoint, fileData: Data, fileName: String, mimeType: String) async throws -> Data
}

enum APIEndpoint {
    case login(LoginRequest)
    case groups
    case groupMembers(sgtIdx: Int)
    case groupStats(sgtIdx: Int)
    case createGroup(CreateGroupRequest)
    case myPlaces
    case schedules
    case locationLog(LocationLogRequest)
    case registerFCM(FCMTokenRequest)
    case kakaoPlaceSearch(query: String)
    // ...

    func urlRequest(baseURL: String) -> URLRequest { ... }
}

enum APIError: Error, LocalizedError {
    case network(URLError)
    case unauthorized          // 401 — 토큰 만료
    case forbidden             // 403
    case notFound              // 404
    case serverError(Int, String?)  // 5xx
    case decodingFailed(DecodingError)
    case unknown(Int, Data)

    var errorDescription: String? { ... }
}
```

Note: `actor` 대신 `final class`로 구현. 네트워크 요청 자체가 이미 async이므로 `actor` 격리의 오버헤드가 불필요하며, 동기 유틸리티 메서드 접근이 자연스러움.

### 1.5 Design System (SMAPTheme)

분산된 컬러/폰트 정의를 하나로 통합:

```swift
enum SMAPTheme {
    enum Color { static let primary, background, textPrimary, error, ... }
    enum Font { static func suite(_ weight: SUITEWeight, size: CGFloat) -> SwiftUI.Font }
    enum Spacing { static let xs: CGFloat = 4, sm: 8, md: 16, lg: 24, xl: 32 }
}
```

### 1.6 Type-safe Storage with Data Migration

매직 스트링 UserDefaults → `StorageKey` enum + `UserDefaultsManager` struct.
Keychain 접근도 `KeychainManager`로 통합.

**데이터 마이그레이션:** 기존 사용자가 업데이트 시 재로그인하지 않도록 1회성 마이그레이션 수행:

```swift
struct DataMigration {
    static func migrateIfNeeded() {
        let migrationKey = "smap_storage_migrated_v2"
        guard !UserDefaults.standard.bool(forKey: migrationKey) else { return }

        // 기존 Keychain 키 (smap_auth_token) → 새 KeychainManager로 이전
        if let oldToken = legacyKeychainRead("smap_auth_token") {
            KeychainManager.shared.saveToken(oldToken)
        }

        // 기존 UserDefaults 키 → 새 UserDefaultsManager로 이전
        if let mtIdx = UserDefaults.standard.string(forKey: "mt_idx") {
            UserDefaultsManager.mtIdx = mtIdx
        }

        UserDefaults.standard.set(true, forKey: migrationKey)
    }
}
```

---

## Phase 2: Core Logic Refactoring

### 2.1 AppDelegate Decomposition (9,370줄 → ~200줄)

```
AppDelegate.swift (9,370줄)
    ↓
├── App/SmapApp.swift (~50줄)              # @main 진입점
├── App/AppDelegate.swift (~200줄)         # Firebase 초기화, SDK 설정만
├── Services/FCMService.swift (~150줄)     # FCM 토큰, 푸시 수신/파싱
├── Services/DeepLinkService.swift (~100줄) # URL scheme, 딥링크 라우팅
└── Services/NotificationService.swift     # 기존 확장
```

**Note:** AppDelegate에 있는 method swizzling (UNUserNotificationCenter.requestAuthorization, CLLocationManager permission swizzling)은 `#if DEBUG` 래핑하여 디버그 전용 진단 도구로 분리. 프로덕션 코드에서는 제거.

### 2.2 Navigation Router (RootCoordinatorView 6,090줄 → 분해)

RootCoordinatorView에서 추출해야 할 43개 View struct의 분류:

| 카테고리 | View structs | 목적지 |
|---------|-------------|--------|
| Settings | SettingsView, EditProfileView, ChangePasswordView | `Features/Settings/` |
| Schedule | NativeScheduleListView, ScheduleFormView + 하위 뷰 | `Features/Schedule/` |
| Terms/Legal | ServiceTermsView, PrivacyPolicyView 등 5개 | `Features/Settings/Terms/` |
| Support | NoticeListView, NoticeDetailView, InquiryView, UserGuideView | `Features/Settings/Support/` |
| Routing | 인증 분기, 네비게이션 로직 | `Navigation/Router.swift` |
| Components | DatePickerWith10MinInterval, ActivityIndicator, MapLoadingOverlay | `DesignSystem/Components/` |

Router:

```swift
@Observable
class Router {
    var sheet: Sheet?
    var fullScreenCover: FullScreenCover?

    enum Destination: Hashable {
        case groupList, groupDetail(SmapGroup), myPlace
        case schedule, scheduleForm(Schedule?)
        case editProfile, changePassword, withdraw
        case serviceTerms, privacyPolicy, locationTerms
        case noticeList, noticeDetail(Notice), inquiry, userGuide
        case locationSearch, activityLog
    }

    enum Sheet: Identifiable { case shareOptions(SmapGroup), qrCode(String) }
    enum FullScreenCover: Identifiable { case login }
}
```

### 2.3 Service Layer Modernization

모든 Service에서 반복되는 URLRequest 구성, 토큰 주입, 에러 처리를 `APIClient`로 위임.

`Services/LocationService.swift`(실제로는 KakaoLocationSearchService)는 `KakaoPlaceSearchService.swift`로 이름 변경.
`Helper/LocationService.swift`만 `Core/Location/LocationManager.swift`로 이동.

### 2.4 ViewModel Refactoring + @Observable Migration

Phase 1에서 지연한 `@Observable` 전환을 ViewModel 분리와 동시에 수행:

```
LoginViewModel.swift (1,425줄)
    ↓
├── Features/Auth/LoginViewModel.swift (~300줄)   # @Observable, UI 상태, 유효성 검증
├── Services/SocialAuth/GoogleAuthService.swift (~100줄)
├── Services/SocialAuth/KakaoAuthService.swift (~100줄)
└── Services/SocialAuth/AppleAuthService.swift (~100줄)
```

기존 `GroupViewModel`도 동시에 `@Observable`로 전환.

### 2.5 LocationService Consolidation

`Helper/LocationService.swift` (CLLocationManager + WebView 커플링)를 분리:

```
Core/Location/
├── LocationManager.swift (~200줄)   # CLLocationManager, 권한, 위치 업데이트
├── MotionManager.swift (~100줄)     # CMMotionActivityManager
└── LocationUploader.swift (~100줄)  # 위치 데이터 서버 전송 (Api.memberLocation 대체)
```

WebView 참조 (`LocationService.webView`) 완전 제거.

---

## Phase 3: View Refactoring + UI/UX Optimization

### 3.1 LoginView.swift Decomposition (9,699줄, 51개 View struct)

LoginView.swift에 내장된 51개 View struct를 피처별로 추출:

| 카테고리 | 포함된 View structs | 목적지 |
|---------|-------------------|--------|
| Auth (로그인 흐름) | LoginView, PhoneInputSection, PasswordInputSection, SocialLoginButtons, VerificationCodeView 등 | `Features/Auth/` |
| Register (회원가입) | NativeRegisterView + 6개 하위 뷰 | `Features/Auth/RegisterView.swift` + Components |
| ForgotPassword | ForgotPasswordView | `Features/Auth/ForgotPasswordView.swift` |
| Home | HomeView, SidebarView, MainTabView | `Features/Home/` |
| Notifications | NotificationListView, NotificationRow | `Features/Notifications/` |
| MyPlace | MyPlaceView + 6개 하위 뷰 | `Features/MyPlace/` |
| ActivityLog | ActivityLogView + 7개 하위 뷰 | `Features/ActivityLog/` |
| Group | GroupCreationView | `Features/Group/` |
| LocationDetail | LocationDetailPanel | `Features/Shared/` |

**예상 결과: 51개 View → ~40개 독립 파일** (일부 소규모 뷰는 부모 파일에 유지)

### 3.2 Reusable Design System Components

- `SMAPButton` — primary/secondary/outline/danger 스타일, 로딩 상태
- `SMAPTextField` — 에러 메시지, `@FocusState` 키보드 처리
- `SMAPSnackBar` — ViewModifier 기반 토스트 (SnackBar.swift Pod 대체)
- `SMAPLoadingView` — 통일된 로딩 인디케이터
- `DatePickerWith10MinInterval` — RootCoordinatorView에서 이동

### 3.3 Performance Optimization

- `LazyVStack` for lists (GroupList, MyPlace, NotificationList, Schedule 등)
- `.task` modifier for async data loading
- `.refreshable` for pull-to-refresh
- 통일된 transition/animation (`AnyTransition.smapSlide`, `Animation.smapSpring`)

### 3.4 Keyboard Handling (IQKeyboardManager 대체)

- `@FocusState` per-view 키보드 관리
- `.scrollDismissesKeyboard(.interactively)`
- `.submitLabel(.next/.done)` + `.onSubmit` 체이닝
- `ToolbarItemGroup(placement: .keyboard)` for dismiss button

---

## Phase 4: WebView to Native Transition

### 4.1 WebView Feature Mapping

| WebView 기능 | 네이티브 대체 | 비고 |
|-------------|-------------|------|
| 지도 표시 | `NaverMapView` (NMFMapView SwiftUI 래퍼) | 신규 구현 |
| 멤버 위치 표시 | 네이티브 마커 + 타이머 업데이트 | 신규 구현 |
| 스케줄 관리 | `ScheduleView` | Phase 3에서 기존 네이티브 코드 추출 완료 |
| 알림 목록 | `NotificationListView` | Phase 3에서 기존 네이티브 코드 추출 완료 |
| JS ↔ Native 브릿지 | 제거 (불필요) | |
| WebView 캐시 | 제거 (불필요) | |

Note: Schedule과 Notification은 이미 RootCoordinatorView/LoginView에 네이티브 구현이 존재. Phase 3에서 추출된 코드를 재사용하며, WebView 전환이 아니라 정리 작업에 가까움.

### 4.2 Native Home Screen

`HomeView` — 전체 화면 지도 + 상단 그룹 선택 바 + 하단 멤버 카드 캐러셀.
마커 탭 시 `LocationDetailPanel`을 `.presentationDetents([.medium, .large])`로 표시.

### 4.3 Tab Navigation

`MainTabView` — 홈(지도), 그룹, 내 장소, 설정 4개 탭.
각 탭에 독립된 `NavigationStack` 적용.

### 4.4 Coexistence Strategy

Phase 3과 Phase 4 사이 전환 기간 동안:
- Phase 3 완료 후 네이티브 화면이 모두 독립 파일로 존재
- Phase 4에서 MainView(WebView)를 HomeView(네이티브 지도)로 교체
- 교체 시점까지 WebView는 지도 표시 역할만 담당
- 나머지 화면(그룹, 마이플레이스, 스케줄, 설정 등)은 Phase 3에서 이미 네이티브 전환 완료

### 4.5 Files to Remove

| 파일 | 줄 수 | 이유 |
|------|------|------|
| `Main/MainView.swift` | 3,549 | `HomeView`로 대체 |
| `WebViewController.swift` | 2,383 | 불필요 |
| `SMAP_WebView_Cache_Manager.swift` | 315 | WebView 없음 |
| `Helper/Api/Api.swift` | 178 | `APIClient`로 대체 |
| `Http/Http.swift` | 64 | `AppConfiguration`으로 대체 |
| `Helper/Utils.swift` | 149 | 역할별 분산 |
| `Helper/Extensions.swift` | 122 | WKWebView 관련 제거 |
| `Intro/IntroView.swift` | 156 | `RootView`로 대체 |
| `Base.lproj/Main.storyboard` | - | SwiftUI @main으로 대체 |

**총 제거: ~6,916줄 + Storyboard**

---

## Cross-cutting Concerns

### Error Handling Strategy

통합 `APIError` enum으로 에러를 분류하고, View 레벨에서 사용자 메시지로 변환:

```swift
extension APIError {
    var userMessage: String {
        switch self {
        case .network: return "네트워크 연결을 확인해주세요."
        case .unauthorized: return "로그인이 만료되었습니다."
        case .serverError: return "서버 오류가 발생했습니다."
        case .decodingFailed: return "데이터 처리 중 오류가 발생했습니다."
        // ...
        }
    }
}
```

### Testing Strategy

각 Phase에서 핵심 로직에 대한 테스트를 함께 작성:

- **Phase 1:** `APIClient` request 구성 및 에러 핸들링 단위 테스트
- **Phase 2:** `LoginViewModel` 유효성 검증, `Router` 네비게이션 단위 테스트
- **Phase 3:** 주요 화면 흐름 (로그인, 그룹 관리) UI 테스트
- **Phase 4:** 지도 마커 표시, 위치 업데이트 통합 테스트

---

## Summary

| Phase | 핵심 작업 | 파일 변경 |
|-------|----------|----------|
| **1** | iOS 17+, Storyboard 제거, 의존성 정리, APIClient, DesignSystem, Storage, 시크릿 관리 | 신규 ~12, 수정 ~15 |
| **2** | AppDelegate 분해, Router, Service 통일, ViewModel 분리 + @Observable | 신규 ~10, 수정 ~12, 삭제 ~2 |
| **3** | LoginView(51 structs) + RootCoordinatorView(43 structs) 분해, 컴포넌트 추출, UI/UX 최적화 | 신규 ~50, 수정 ~10, 삭제 ~2 |
| **4** | WebView → 네이티브 지도, 탭 네비게이션, 정리 | 신규 ~5, 삭제 ~9 |

**최종 결과:**
- 41,000줄 → ~30,000줄 (코드량 ~27% 감소, 구조적 품질 대폭 개선)
- 외부 의존성 10개 → 5개
- 파일당 최대 ~300줄
- 전체 네이티브 SwiftUI 앱
- iOS 17+ 최신 API 활용
- 타입-safe 네트워크/스토리지/네비게이션
- .xcconfig 기반 시크릿 관리
- 데이터 마이그레이션으로 기존 사용자 세션 보존
