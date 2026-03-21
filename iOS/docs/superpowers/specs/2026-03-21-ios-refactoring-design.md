# iOS App Refactoring, Performance & UI/UX Optimization

## Overview

SMAP iOS 앱의 전면 현대화. 리팩토링, 성능 최적화, UI/UX 개선을 Bottom-Up 방식으로 4단계에 걸쳐 수행한다.

**현재 상태:**
- 41,000+ LOC, Swift 파일 38개
- 거대 파일 다수 (LoginView 9,699줄, AppDelegate 9,370줄, RootCoordinatorView 6,090줄)
- Alamofire + URLSession 혼재
- WebView 하이브리드 아키텍처
- iOS 15+ 타겟, CocoaPods 10개 의존성

**목표 상태:**
- ~25,000 LOC (40% 감소), 파일당 최대 ~300줄
- 전체 네이티브 SwiftUI 앱 (WebView 제거)
- iOS 17+ 타겟, 최신 API 활용 (@Observable, NavigationStack)
- 외부 의존성 5개로 축소 (Firebase, Google/Kakao SDK, NMapsMap)
- 통합 네트워크 레이어, 디자인 시스템, 타입-safe 스토리지

**유지 사항:**
- 기존 브랜드 디자인 (SUITE 폰트, 커스텀 컬러)
- 모든 기존 기능 (로그인, 그룹, 마이플레이스, 위치 추적, 푸시 알림)

---

## Architecture

### New Directory Structure

```
smap/
├── App/
│   ├── SmapApp.swift              # SwiftUI @main entry point
│   ├── AppConfiguration.swift     # 환경별 설정, API URL
│   └── AppDelegate.swift          # 축소: Firebase/Push 초기화만
│
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift        # 통합 네트워크 클라이언트 (actor)
│   │   ├── APIEndpoint.swift      # 타입-safe 엔드포인트 enum
│   │   └── APIError.swift         # 통합 에러 타입
│   ├── Storage/
│   │   ├── KeychainManager.swift  # 토큰 관리
│   │   └── UserDefaultsManager.swift  # 타입-safe UserDefaults
│   └── Location/
│       ├── LocationManager.swift  # CLLocationManager 래핑 (@Observable)
│       ├── MotionManager.swift    # 모션 활동 감지
│       └── LocationUploader.swift # 위치 데이터 서버 전송
│
├── DesignSystem/
│   ├── Theme.swift                # 컬러, 폰트, 간격 통합
│   ├── Components/
│   │   ├── SMAPButton.swift
│   │   ├── SMAPTextField.swift
│   │   ├── SMAPLoadingView.swift
│   │   └── SMAPSnackBar.swift     # SnackBar.swift Pod 대체
│   └── Modifiers/
│       └── SMAPTextStyle.swift
│
├── Features/
│   ├── Auth/
│   │   ├── LoginView.swift        # 메인 컨테이너 (~200줄)
│   │   ├── LoginViewModel.swift   # UI 상태, 유효성 검증 (~300줄)
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
│   │   └── LoginStep.swift        # enum 단계 정의
│   ├── Home/
│   │   ├── HomeView.swift         # 네이티브 메인 화면
│   │   ├── HomeViewModel.swift
│   │   ├── NaverMapView.swift     # NMFMapView SwiftUI 래퍼
│   │   ├── GroupSelectorBar.swift
│   │   └── MemberCardCarousel.swift
│   ├── Group/
│   │   ├── GroupListView.swift
│   │   ├── GroupDetailView.swift
│   │   └── GroupViewModel.swift
│   ├── MyPlace/
│   │   ├── MyPlaceView.swift
│   │   └── MyPlaceViewModel.swift
│   ├── Settings/
│   │   ├── SettingsView.swift
│   │   └── WithdrawView.swift
│   └── Shared/
│       ├── LocationDetailPanel.swift
│       ├── LocationSearchView.swift
│       ├── ShareOptionsView.swift
│       └── QRCodeView.swift
│
├── Services/
│   ├── AuthService.swift
│   ├── GroupService.swift
│   ├── MyPlaceService.swift
│   ├── NotificationService.swift
│   ├── PurchaseService.swift      # StoreKit 2
│   ├── FCMService.swift           # AppDelegate에서 분리
│   └── DeepLinkService.swift
│
├── Models/
│   ├── LoginModels.swift
│   ├── HomeModels.swift
│   ├── MyPlaceModels.swift
│   └── NotificationModels.swift
│
└── Navigation/
    └── Router.swift               # NavigationStack 기반 라우팅
```

### Key Architecture Decisions

| 현재 | 변경 후 | 이유 |
|------|---------|------|
| `ObservableObject` + `@Published` | `@Observable` 매크로 | iOS 17+ 성능 최적화, 보일러플레이트 감소 |
| `NavigationView` | `NavigationStack` + `Router` | 타입-safe 네비게이션, 딥링크 지원 |
| Alamofire + URLSession 혼재 | 통합 `APIClient` (actor, URLSession) | 의존성 제거, 일관성, thread safety |
| 분산된 컬러/폰트 | `DesignSystem/Theme.swift` | 단일 source of truth |
| WebView 하이브리드 | 전체 네이티브 SwiftUI | 성능, UX 일관성 |
| Singleton Services | Singleton 유지 + `@Observable` | 점진적 전환, 안정성 |

---

## Phase 1: Architecture Foundation

### 1.1 iOS 17+ Migration

- Deployment target을 iOS 17.0으로 변경
- Podfile의 platform을 `ios, '17.0'`으로 업데이트
- `ObservableObject` + `@Published` → `@Observable` 매크로 전환
- View에서 `@StateObject` → `@State`, `@ObservedObject` → 직접 참조
- `@Observable`은 실제 읽힌 프로퍼티만 추적하므로 불필요한 re-render 감소

### 1.2 Dependency Cleanup

**제거:**

| Pod | 대체 |
|-----|------|
| `Alamofire ~> 5.5` | `URLSession` + `APIClient` |
| `IQKeyboardManagerSwift` | SwiftUI `.scrollDismissesKeyboard()`, `@FocusState` |
| `SnackBar.swift` | 커스텀 `SMAPSnackBar` (SwiftUI overlay) |
| `SwiftyStoreKit` | `StoreKit 2` 네이티브 API |
| `SDWebImage ~> 5.0` | `AsyncImage` |

**유지:**
- `Firebase/Auth`, `Firebase/Core`, `Firebase/Messaging`
- `GoogleSignIn ~> 7.0`, `AppAuth ~> 1.7`
- `KakaoSDKCommon ~> 2.22`, `KakaoSDKAuth ~> 2.22`, `KakaoSDKUser ~> 2.22`
- `NMapsMap`

### 1.3 Unified Network Layer (APIClient)

`actor APIClient`로 thread-safe한 통합 네트워크 클라이언트 구현:
- 모든 Service가 `APIClient`를 통해 요청
- 자동 토큰 주입 (KeychainManager 연동)
- 통합 에러 핸들링
- `APIEndpoint` enum으로 타입-safe 엔드포인트 정의
- JSON request, multipart upload 모두 지원

```swift
actor APIClient {
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
    case locationLog(LocationLogRequest)
    case registerFCM(FCMTokenRequest)
    // ...

    func urlRequest(baseURL: String) -> URLRequest { ... }
}
```

### 1.4 Design System (SMAPTheme)

분산된 컬러/폰트 정의를 하나로 통합:

```swift
enum SMAPTheme {
    enum Color { static let primary, background, textPrimary, error, ... }
    enum Font { static func suite(_ weight: SUITEWeight, size: CGFloat) -> SwiftUI.Font }
    enum Spacing { static let xs, sm, md, lg, xl: CGFloat }
}
```

### 1.5 Type-safe Storage

매직 스트링 UserDefaults → `StorageKey` enum + `UserDefaultsManager` struct.
Keychain 접근도 `KeychainManager`로 통합.

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

### 2.2 Navigation Router (RootCoordinatorView 6,090줄 → 분해)

`RootCoordinatorView`에서 라우팅 로직을 `Router`로, 커스텀 컴포넌트를 `DesignSystem/Components`로 분리:

```swift
@Observable
class Router {
    var path = NavigationPath()
    var sheet: Sheet?
    var fullScreenCover: FullScreenCover?

    enum Destination: Hashable { case groupList, groupDetail(SmapGroup), myPlace, ... }
    enum Sheet: Identifiable { case shareOptions(SmapGroup), qrCode(String) }
    enum FullScreenCover: Identifiable { case login }

    func navigate(to:), dismiss(), popToRoot()
}
```

`RootView`는 인증 상태에 따라 `MainTabView` 또는 `LoginView`로 분기하는 ~30줄 View.

### 2.3 Service Layer Modernization

모든 Service에서 반복되는 URLRequest 구성, 토큰 주입, 에러 처리를 `APIClient`로 위임:

```swift
// Before: 각 메서드마다 ~15줄의 보일러플레이트
// After:
class GroupService {
    func getCurrentUserGroups() async throws -> [SmapGroup] {
        try await APIClient.shared.request(.groups, type: [SmapGroup].self)
    }
}
```

### 2.4 LoginViewModel Split (1,425줄 → ~300줄 + 서비스)

```
LoginViewModel.swift (1,425줄)
    ↓
├── ViewModels/LoginViewModel.swift (~300줄)   # UI 상태, 유효성 검증, 흐름 제어
├── Services/SocialAuth/GoogleAuthService.swift (~100줄)
├── Services/SocialAuth/KakaoAuthService.swift (~100줄)
└── Services/SocialAuth/AppleAuthService.swift (~100줄)
```

### 2.5 LocationService Consolidation

`Helper/LocationService.swift`와 `Services/LocationService.swift` 두 파일을 통합 후 역할 분리:

```
Core/Location/
├── LocationManager.swift (~200줄)   # CLLocationManager, 권한, 위치 업데이트
├── MotionManager.swift (~100줄)     # CMMotionActivityManager
└── LocationUploader.swift (~100줄)  # 위치 데이터 서버 전송
```

---

## Phase 3: View Refactoring + UI/UX Optimization

### 3.1 LoginView Decomposition (9,699줄 → 컴포넌트 분리)

```
Features/Auth/
├── LoginView.swift (~200줄)                    # 메인 컨테이너, 단계별 흐름
├── RegisterView.swift (~200줄)
├── Components/
│   ├── PhoneInputSection.swift (~100줄)
│   ├── PasswordInputSection.swift (~80줄)
│   ├── SocialLoginButtons.swift (~100줄)
│   ├── TermsAgreementView.swift (~100줄)
│   ├── VerificationCodeView.swift (~80줄)
│   └── ProfileSetupView.swift (~100줄)
└── LoginStep.swift (~30줄)
```

### 3.2 Reusable Design System Components

- `SMAPButton` — primary/secondary/outline/danger 스타일, 로딩 상태
- `SMAPTextField` — 에러 메시지, `@FocusState` 키보드 처리
- `SMAPSnackBar` — ViewModifier 기반 토스트 (SnackBar.swift Pod 대체)
- `SMAPLoadingView` — 통일된 로딩 인디케이터
- `CachedAsyncImage` — SDWebImage 대체

### 3.3 Performance Optimization

- `LazyVStack` for lists (GroupList, MyPlace 등)
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

| WebView 기능 | 네이티브 대체 |
|-------------|-------------|
| 지도 표시 | `NaverMapView` (NMFMapView SwiftUI 래퍼) |
| 멤버 위치 표시 | 네이티브 마커 + 타이머 업데이트 |
| 스케줄 관리 | `ScheduleView` (네이티브) |
| 알림 목록 | `NotificationListView` (네이티브) |
| JS ↔ Native 브릿지 | 제거 (불필요) |
| WebView 캐시 | 제거 (불필요) |

### 4.2 Native Home Screen

`HomeView` — 전체 화면 지도 + 상단 그룹 선택 바 + 하단 멤버 카드 캐러셀.
마커 탭 시 `LocationDetailPanel`을 `.presentationDetents([.medium, .large])`로 표시.

### 4.3 Tab Navigation

`MainTabView` — 홈(지도), 그룹, 내 장소, 설정 4개 탭.
각 탭에 `NavigationStack` 적용.

### 4.4 Files to Remove

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

**총 제거: ~6,916줄**

---

## Summary

| Phase | 핵심 작업 | 파일 변경 |
|-------|----------|----------|
| **1** | iOS 17+, 의존성 정리, APIClient, DesignSystem, Storage | 신규 ~10, 수정 ~15 |
| **2** | AppDelegate 분해, Router, Service 통일, ViewModel 분리 | 신규 ~8, 수정 ~12, 삭제 ~2 |
| **3** | LoginView 분해, 컴포넌트 추출, UI/UX 최적화 | 신규 ~15, 수정 ~10 |
| **4** | WebView → 네이티브, 탭 네비게이션, 정리 | 신규 ~5, 삭제 ~8 |

**최종 결과:**
- 41,000줄 → ~25,000줄 (코드량 ~40% 감소)
- 외부 의존성 10개 → 5개
- 파일당 최대 ~300줄
- 전체 네이티브 SwiftUI 앱
- iOS 17+ 최신 API 활용
