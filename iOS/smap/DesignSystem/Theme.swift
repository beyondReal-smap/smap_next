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
        // 시스템 색상 — iOS가 다크모드/접근성 고대비에 맞춰 자동 조정.
        static let error = SwiftUI.Color(UIColor.systemRed)
        static let success = SwiftUI.Color(UIColor.systemGreen)
        static let warning = SwiftUI.Color(UIColor.systemOrange)
        static let white = SwiftUI.Color.white
    }

    // MARK: - Accent (보조 액션/브랜드 보조 색상)
    // 기존에 여러 파일에서 `private let pinkColor` 형태로 반복 정의되던 값들을 통합.

    enum Accent {
        static let pink = SwiftUI.Color(red: 236/255, green: 72/255, blue: 153/255)   // Pink-500
        static let pinkDeep = SwiftUI.Color(red: 244/255, green: 63/255, blue: 94/255) // Rose-500 (활동 셀 그라데이션 끝점)
        static let orange = SwiftUI.Color(red: 245/255, green: 158/255, blue: 11/255) // Amber-500
        static let indigo = SwiftUI.Color(red: 99/255, green: 102/255, blue: 241/255) // Indigo-500 (활동 로그 보조)
        static let crown = SwiftUI.Color(red: 234/255, green: 179/255, blue: 8/255)   // Yellow-500 (오너 왕관)
        static let notificationDot = SwiftUI.Color(red: 220/255, green: 38/255, blue: 38/255) // Red-600 (읽지 않음 배지)
        static let primarySoft = SwiftUI.Color(red: 102/255, green: 126/255, blue: 234/255) // Indigo-400 (프로필·비밀번호 그라데이션 종점)
    }

    // MARK: - Semantic (앱 컨텍스트별 의미 색상)
    // 사이드바 섹션 인디케이터, 멤버 통계 등 "도메인 의미"가 있는 색상.

    enum Semantic {
        // Sidebar section indicators — 그룹/날짜/멤버 섹션 시각 구분
        static let indicatorGroup = SwiftUI.Color(red: 220/255, green: 38/255, blue: 38/255)  // Red-600
        static let indicatorDate = SwiftUI.Color(red: 217/255, green: 119/255, blue: 6/255)   // Amber-600
        static let indicatorMember = SwiftUI.Color(red: 37/255, green: 99/255, blue: 235/255) // Blue-600

        // Member today stats — 완료/진행/예정
        static let statCompleted = SwiftUI.Color(red: 22/255, green: 163/255, blue: 74/255)   // Green-600
        static let statOngoing = SwiftUI.Color(red: 217/255, green: 119/255, blue: 6/255)     // Amber-600
        static let statUpcoming = SwiftUI.Color(red: 37/255, green: 99/255, blue: 235/255)    // Blue-600

        // MyPlace section indicator — 장소 목록. 의미상 "완료된 기록"과 동일 톤이라 재사용.
        static let indicatorLocation = statCompleted
    }

    // MARK: - Adaptive (light/dark 자동 분기)
    // UIKit의 `UIColor { trait in ... }` 기반. 현재 전역 다크모드는 활성화되지 않았으나,
    // 앞으로 `.preferredColorScheme` 해제 시 주요 배경색이 자동 적응되도록 토대만 제공.

    enum Adaptive {
        /// 주요 화면 배경 (카드 외곽 페이지 배경)
        static let pageBackground = SwiftUI.Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0.09, green: 0.09, blue: 0.12, alpha: 1)
                : UIColor(red: 0.98, green: 0.98, blue: 1.00, alpha: 1)
        })

        /// 카드/패널 표면
        static let surface = SwiftUI.Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0.16, green: 0.16, blue: 0.19, alpha: 1)
                : UIColor.white
        })

        /// 사이드바 배경
        static let sidebarBackground = SwiftUI.Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0.11, green: 0.12, blue: 0.14, alpha: 1)
                : UIColor(red: 245/255, green: 247/255, blue: 250/255, alpha: 1)
        })
    }

    /// Dynamic Color 헬퍼 — 임시 커스텀 분기가 필요할 때 사용.
    static func adaptiveColor(light: SwiftUI.Color, dark: SwiftUI.Color) -> SwiftUI.Color {
        SwiftUI.Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }

    // MARK: - Fonts (SUITE 폰트 기반 — uses Font.suite() extension from AppStyles.swift)

    enum Font {
        // 고정 크기 — 기존 레이아웃 유지가 필요한 지점(아이콘 정렬, FAB 라벨 등).
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

        // Dynamic Type — 접근성 "큰 글자" 설정 연동.
        // 본문·부가정보·본문형 라벨에 우선 적용 권장. 레이아웃에 민감한 헤더/배지는 고정 크기 유지.
        // `Font.suite` 와 같은 SUITE 글꼴을 쓰되, 시스템 글자 크기 설정에 맞춰 커지도록 `relativeTo` 를 준다.
        static let titleDynamic = dynamicSuite(size: 22, weight: .bold, relativeTo: .title2)
        static let headlineDynamic = dynamicSuite(size: 18, weight: .bold, relativeTo: .title3)
        static let subheadlineDynamic = dynamicSuite(size: 16, weight: .semibold, relativeTo: .headline)
        static let bodyDynamic = dynamicSuite(size: 16, weight: .regular, relativeTo: .body)
        static let bodyMediumDynamic = dynamicSuite(size: 17, weight: .medium, relativeTo: .body)
        static let secondaryDynamic = dynamicSuite(size: 15, weight: .regular, relativeTo: .subheadline)
        static let captionDynamic = dynamicSuite(size: 14, weight: .regular, relativeTo: .caption)

        private static func dynamicSuite(
            size: CGFloat,
            weight: SwiftUI.Font.Weight,
            relativeTo textStyle: SwiftUI.Font.TextStyle
        ) -> SwiftUI.Font {
            let psName = SuiteFontName.postScriptName(for: weight)
            return SwiftUI.Font.custom(psName, size: size, relativeTo: textStyle)
        }
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
