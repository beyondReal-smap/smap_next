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

    // MARK: - Fonts (SUITE 폰트 기반 — uses Font.suite() extension from AppStyles.swift)

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
