# SMAP iOS

가족 위치 공유 앱 SMAP의 iOS 클라이언트입니다.

## 환경

| 항목 | 버전 |
|------|------|
| iOS Deployment Target | 17.0 |
| Swift | 5.9 |
| Xcode | 15.0+ |
| 의존성 관리 | CocoaPods |

## 기술 스택

- **UI**: SwiftUI
- **아키텍처**: MVVM (ViewModel + Service + Model)
- **지도**: Naver Maps SDK (NMapsMap)
- **인증**: Firebase Auth, Google Sign-In 7.x, Kakao SDK 2.22
- **푸시**: Firebase Cloud Messaging (FCM)
- **네트워크**: URLSession + APIClient (자체 구현)

## 프로젝트 구조

```
smap/
├── App/                          # 앱 진입점 (SmapApp, RootView)
├── Core/
│   ├── Network/                  # APIClient, APIEndpoint (엔드포인트 정의)
│   ├── Location/                 # 위치 권한 및 추적
│   └── Storage/                  # 로컬 저장소
├── DesignSystem/                 # 테마, 색상, 폰트 (SUITE)
├── Features/
│   ├── Home/                     # 홈 탭 (지도, 멤버 위치, 일정 카드)
│   ├── Group/                    # 그룹 목록, 그룹 상세, 생성/가입
│   ├── Schedule/                 # 캘린더, 일정 생성/수정/삭제
│   ├── MyPlace/                  # 장소 저장, 지도 검색
│   ├── ActivityLog/              # 활동 로그 (이동 경로, 체류시간)
│   ├── Chat/                     # 채팅 (그룹채팅, 1:1 DM)
│   ├── Notifications/            # 알림 목록
│   ├── Settings/                 # 설정, 프로필, 약관
│   ├── Auth/                     # 로그인 (Google, Apple, Kakao)
│   ├── Registration/             # 회원가입 (본인인증, 정보입력, 약관)
│   └── Shared/                   # MainTabView (탭 네비게이션)
├── Models/                       # 데이터 모델 (Codable)
│   ├── HomeModels.swift
│   ├── ChatModels.swift
│   ├── ActivityLogModels.swift
│   ├── ScheduleModels.swift
│   ├── MyPlaceModels.swift
│   └── ...
├── ViewModels/                   # 화면별 ViewModel (@MainActor)
│   ├── HomeViewModel.swift
│   ├── ChatViewModel.swift
│   ├── ActivityLogViewModel.swift
│   ├── ScheduleViewModel.swift
│   └── ...
├── Services/                     # API 서비스 (싱글턴)
│   ├── AuthService.swift         # 인증, 토큰 관리
│   ├── ChatService.swift         # 채팅 REST API
│   ├── ChatSocketManager.swift   # WebSocket (Socket.IO)
│   ├── GroupService.swift        # 그룹 CRUD
│   ├── ScheduleService.swift     # 일정 CRUD
│   ├── MyPlaceService.swift      # 장소 CRUD
│   ├── ActivityLogService.swift  # 활동 로그 조회
│   ├── FCMService.swift          # FCM 푸시 토큰
│   └── ...
├── Font/                         # SUITE 커스텀 폰트
└── Helper/                       # 유틸리티
```

## 화면 구성 (5탭)

| 탭 | 화면 | 설명 |
|----|------|------|
| 홈 | HomeView | 네이버 지도, 멤버 위치, 일정 카드, 알림 |
| 그룹 | GroupListView | 그룹 목록, 생성, 초대코드 가입 |
| 일정 | NativeScheduleListView | 월별 캘린더, 일정 CRUD |
| 내장소 | MyPlaceView | 장소 저장, 카카오 검색, 알림 설정 |
| 활동로그 | ActivityLogView | 이동 경로, 체류시간, 경로 슬라이더 |

## 빌드

```bash
cd iOS
pod install
open smap.xcworkspace
```

Xcode에서 빌드 타겟을 `smap`으로 선택 후 빌드합니다.

## 설정 파일

- `GoogleService-Info.plist` — Firebase 설정
- `Info.plist` — 권한 설명, URL 스킴
- `Podfile` — CocoaPods 의존성

## API

백엔드: `https://api3.smap.site/api/v1/`
