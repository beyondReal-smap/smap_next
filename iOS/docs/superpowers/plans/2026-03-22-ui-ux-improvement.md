# UI/UX 전면 개선 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SMAPTheme 디자인 시스템을 전체 앱에 적용하고, deprecated API를 최신 iOS 17+ API로 교체하고, 접근성을 추가.

**Architecture:** 3단계 기계적 치환. Stage 1은 find-and-replace 수준 (색상, deprecated API). Stage 2는 패턴 교체 (.task, .refreshable). Stage 3은 접근성 라벨 추가. 각 단계 후 빌드 확인.

**Tech Stack:** SwiftUI, iOS 17+

**Spec:** `docs/superpowers/specs/2026-03-22-ui-ux-improvement-design.md`

---

## Task 1: Stage 1 — 색상 + NavigationStack + deprecated API 치환

**Files:** Features/ 전체 (~26개 파일)

이 태스크는 대규모 기계적 치환. subagent에게 전체 파일 목록과 치환 규칙을 제공.

- [ ] **Step 1: 하드코딩 색상 → SMAPTheme.Color**

모든 Features/ 파일에서:
```swift
// 치환 규칙
Color(red: 1/255, green: 19/255, blue: 163/255)  →  SMAPTheme.Color.primary
Color(red: 0/255, green: 31/255, blue: 135/255)   →  SMAPTheme.Color.primaryDark

// 로컬 brandColor 변수 제거
private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)  →  삭제
brandColor  →  SMAPTheme.Color.primary

// LoginView.swift의 로컬 BrandColors struct 제거
```

- [ ] **Step 2: NavigationView → NavigationStack**

7개 파일에서 단순 치환.

- [ ] **Step 3: .edgesIgnoringSafeArea → .ignoresSafeArea**

37곳:
```swift
.edgesIgnoringSafeArea(.all)     →  .ignoresSafeArea()
.edgesIgnoringSafeArea(.bottom)  →  .ignoresSafeArea(edges: .bottom)
.edgesIgnoringSafeArea(.top)     →  .ignoresSafeArea(edges: .top)
```

- [ ] **Step 4: .navigationBarHidden → .toolbar**

18곳:
```swift
.navigationBarHidden(true)   →  .toolbar(.hidden, for: .navigationBar)
.navigationBarHidden(false)  →  제거 (기본값)
```

- [ ] **Step 5: 빌드 확인**

- [ ] **Step 6: 커밋**

```bash
git commit -m "refactor: adopt SMAPTheme colors, replace deprecated NavigationView/edgesIgnoringSafeArea/navigationBarHidden"
```

---

## Task 2: Stage 2 — 모던 SwiftUI 패턴 + 컴포넌트 채택

**Files:** 주요 화면 ~10개 파일

- [ ] **Step 1: .onAppear { Task {} } → .task {}**

패턴 검색 후 치환:
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

- [ ] **Step 2: .refreshable 추가**

ScrollView 기반 리스트가 있는 화면에 추가:
- HomeView
- MyPlaceView
- ActivityLogView
- NativeScheduleListView

```swift
ScrollView {
    // content
}
.refreshable {
    await viewModel.fetchData()
}
```

- [ ] **Step 3: Alert API 통일**

구 Alert() → 신 .alert modifier:
```swift
// Before
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

- [ ] **Step 4: 빌드 확인**

- [ ] **Step 5: 커밋**

```bash
git commit -m "refactor: adopt .task/.refreshable/.alert modern SwiftUI patterns"
```

---

## Task 3: Stage 3 — 접근성 추가

**Files:** 인터랙티브 요소가 있는 모든 뷰 (~15개 파일)

- [ ] **Step 1: 아이콘 버튼에 .accessibilityLabel**

모든 `Image(systemName:)` 기반 Button에:
```swift
Button(action: { ... }) {
    Image(systemName: "xmark")
}
.accessibilityLabel("닫기")
```

주요 대상: xmark(닫기), bell(알림), gearshape(설정), plus(추가), arrow.left(뒤로), magnifyingglass(검색), person(프로필), trash(삭제), pencil(수정)

- [ ] **Step 2: 탭바 접근성**

MainTabView의 각 탭:
```swift
Label("홈", systemImage: "house.fill")
    .accessibilityLabel("홈")
```

- [ ] **Step 3: 장식 이미지 숨기기**

배경, 스플래시, 장식용 이미지:
```swift
Image("AppNoBg")
    .accessibilityHidden(true)
```

- [ ] **Step 4: 빌드 확인**

- [ ] **Step 5: 커밋**

```bash
git commit -m "feat: add accessibility labels to interactive elements and tab bar"
```

---

## Task 4: 전체 빌드 & 테스트 검증

- [ ] **Step 1: 전체 테스트**
- [ ] **Step 2: 전체 빌드**
- [ ] **Step 3: deprecated 경고 확인**

```bash
xcodebuild build ... 2>&1 | grep -i "deprecated\|warning:" | grep -v "Pods/" | head -20
```
