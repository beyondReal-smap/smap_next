# UI/UX 전면 개선 — 디자인 시스템 통합, 모던 API, 접근성

## Overview

SMAP iOS 앱의 UI/UX를 3단계에 걸쳐 개선. Phase 1 에서 만든 SMAPTheme 디자인 시스템을 전체 앱에 적용하고, deprecated SwiftUI API를 최신 iOS 17+ API로 교체하며, 접근성을 추가.

**현재 상태:**
- 214개 하드코딩된 Color(red:...) — SMAPTheme.Color 사용 0곳
- SMAPButton/SMAPTextField/SMAPLoadingView 사용 0곳
- NavigationView 7곳 (deprecated)
- .edgesIgnoringSafeArea 37곳 (deprecated)
- .navigationBarHidden 18곳 (deprecated)
- accessibilityLabel/Hint 0건
- .refreshable 1곳만 사용
- .task {} 0곳

**목표 상태:**
- 모든 색상/폰트 SMAPTheme 참조
- 모든 NavigationView → NavigationStack
- 모든 deprecated API 교체
- 주요 인터랙티브 요소 접근성 라벨 완비
- 모든 스크롤 리스트에 pull-to-refresh
- .task {} 패턴으로 비동기 로딩 통일

---

## Stage 1: 기계적 치환 (하드코딩 → 디자인 시스템 + deprecated API 제거)

### 1.1 색상 치환

모든 `Color(red: 1/255, green: 19/255, blue: 163/255)` 및 로컬 `brandColor` 변수를 `SMAPTheme.Color.primary`로 교체. 파일별 로컬 BrandColors 정의도 제거.

**치환 매핑:**
| 현재 패턴 | SMAPTheme |
|----------|-----------|
| `Color(red: 1/255, green: 19/255, blue: 163/255)` | `SMAPTheme.Color.primary` |
| `Color(red: 0/255, green: 31/255, blue: 135/255)` | `SMAPTheme.Color.primaryDark` |
| `Color(red: 254/255, green: 248/255, blue: 249/255)` | `SMAPTheme.Color.background` |
| `Color(UIColor.systemGray)` | `SMAPTheme.Color.textSecondary` |
| `Color(UIColor.systemGray6)` | `SMAPTheme.Color.inputBackground` |
| `Color(UIColor.systemGray4)` | `SMAPTheme.Color.border` |
| `Color.red` (에러 컨텍스트) | `SMAPTheme.Color.error` |
| `Color.green` (성공 컨텍스트) | `SMAPTheme.Color.success` |
| 로컬 `let brandColor = Color(...)` | 제거, SMAPTheme.Color.primary 직접 사용 |
| 로컬 `struct BrandColors` (LoginView.swift) | 제거 |

### 1.2 NavigationView → NavigationStack

7개 파일:
```swift
// Before
NavigationView { content }

// After
NavigationStack { content }
```

파일: MyPlaceView, AccountSettingsView, ScheduleFormView, NativeScheduleListView, ForgotPasswordView, LocationDetailPanel, NotificationListView

### 1.3 .edgesIgnoringSafeArea → .ignoresSafeArea

37곳:
```swift
// Before
.edgesIgnoringSafeArea(.all)
.edgesIgnoringSafeArea(.bottom)

// After
.ignoresSafeArea()
.ignoresSafeArea(edges: .bottom)
```

### 1.4 .navigationBarHidden → .toolbar

18곳:
```swift
// Before
.navigationBarHidden(true)

// After
.toolbar(.hidden, for: .navigationBar)
```

### 1.5 폰트 치환 (매칭 가능한 경우)

SMAPTheme.Font 프리셋과 정확히 매칭되는 패턴만 치환:
```swift
// Before
.font(.suite(size: 22, weight: .bold))      → .font(SMAPTheme.Font.title)
.font(.suite(size: 18, weight: .bold))      → .font(SMAPTheme.Font.headline)
.font(.suite(size: 16, weight: .semibold))  → .font(SMAPTheme.Font.subheadline)
.font(.suite(size: 16, weight: .regular))   → .font(SMAPTheme.Font.body)
.font(.suite(size: 14, weight: .regular))   → .font(SMAPTheme.Font.caption)
.font(.suite(size: 12, weight: .regular))   → .font(SMAPTheme.Font.captionSmall)
```

정확히 매칭되지 않는 커스텀 사이즈는 그대로 유지.

---

## Stage 2: 모던 SwiftUI 패턴 + 컴포넌트 채택

### 2.1 .onAppear { Task {} } → .task {}

```swift
// Before
.onAppear {
    Task {
        await viewModel.fetchData()
    }
}

// After
.task {
    await viewModel.fetchData()
}
```

장점: 뷰 사라질 때 자동 취소, 더 간결.

### 2.2 .refreshable 추가

ScrollView 기반 리스트에 pull-to-refresh 추가:
- HomeView (그룹/멤버 새로고침)
- MyPlaceView (장소 새로고침)
- ActivityLogView (로그 새로고침)
- NativeScheduleListView (일정 새로고침)
- NotificationListView (이미 있음 — 확인만)

```swift
ScrollView {
    // content
}
.refreshable {
    await viewModel.fetchData()
}
```

### 2.3 SMAPLoadingView 채택

ProgressView() 직접 사용 → SMAPLoadingView로 교체:
```swift
// Before
ProgressView()
    .progressViewStyle(CircularProgressViewStyle())

// After
SMAPLoadingView(message: "로딩 중...")
```

### 2.4 Alert API 통일

구 Alert API → 신 .alert modifier:
```swift
// Before (deprecated)
.alert(isPresented: $showError) {
    Alert(title: Text("오류"), message: Text(errorMessage ?? ""))
}

// After
.alert("오류", isPresented: $showError) {
    Button("확인", role: .cancel) {}
} message: {
    Text(errorMessage ?? "")
}
```

---

## Stage 3: 접근성

### 3.1 아이콘 버튼 접근성 라벨

모든 Image(systemName:) 기반 버튼에 `.accessibilityLabel` 추가:
```swift
Button(action: { dismiss() }) {
    Image(systemName: "xmark")
}
.accessibilityLabel("닫기")
```

대상: 닫기 버튼, 메뉴 버튼, 설정 버튼, 알림 버튼, FAB 버튼 등 ~40개

### 3.2 폼 필드 접근성

TextField/SecureField에 `.accessibilityHint` 추가:
```swift
TextField("전화번호", text: $phone)
    .accessibilityLabel("전화번호 입력")
    .accessibilityHint("010으로 시작하는 전화번호를 입력하세요")
```

대상: 로그인, 회원가입, 프로필 편집, 비밀번호 변경 등 ~20개

### 3.3 탭바 접근성

MainTabView의 각 탭에 접근성 라벨:
```swift
.accessibilityLabel("홈")
.accessibilityLabel("그룹")
.accessibilityLabel("일정")
.accessibilityLabel("내 장소")
.accessibilityLabel("활동 로그")
```

### 3.4 장식 이미지

순수 장식 이미지에 `.accessibilityHidden(true)`:
```swift
Image("splash_bg")
    .accessibilityHidden(true)
```

---

## 영향 범위

### Stage 1 수정 파일 (~26개)
`Features/` 전체 + `Views/` 잔여 파일

### Stage 2 수정 파일 (~10개)
주요 화면 뷰 파일

### Stage 3 수정 파일 (~15개)
인터랙티브 요소가 있는 모든 뷰

### 변경하지 않는 것
- Core/ (네트워크, 스토리지) — UI 아님
- Services/ — UI 아님
- ViewModels/ — UI 아님 (Stage 2에서 .task 관련으로 일부 시그니처 변경 가능)
- Models/ — UI 아님
- AppDelegate.swift — UI 아님
