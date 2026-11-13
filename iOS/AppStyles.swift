//
//  AppStyles.swift
//  smap
//
//  앱 전체 통합 스타일 시스템
//  - BrandColors: 브랜드 색상
//  - Font.suite(): SUITE 폰트 extension
//  - AppFonts: 텍스트 스타일 정의
//

import SwiftUI
import UIKit

// MARK: - Brand Colors

public struct BrandColors {
    public static let primary = Color(red: 1/255, green: 19/255, blue: 163/255)  // #0113A3
    public static let primaryDark = Color(red: 0/255, green: 31/255, blue: 135/255)  // #001f87
    public static let background = Color(red: 254/255, green: 248/255, blue: 249/255)  // #fef8f9
    public static let textPrimary = Color.black
    public static let textSecondary = Color(UIColor.systemGray)
    public static let inputBackground = Color(UIColor.systemGray6)
    public static let border = Color(UIColor.systemGray4)
    // 시스템 색상 — iOS 다크모드/접근성 고대비 자동 대응.
    public static let error = Color(UIColor.systemRed)
    public static let success = Color(UIColor.systemGreen)
    public static let warning = Color(UIColor.systemOrange)
}

// MARK: - Custom Font Extension (AtoZ / A2Z)
// 함수명 `suite`는 기존 호출 사이트(수백 곳) 호환성을 위해 유지. 실제 반환 폰트는 A2Z 패밀리.
// A2Z 폰트는 weight 별로 독립 family로 등록되어 있어 PostScript 이름을 런타임에 조회한다.

public extension Font {
    /// 고정 크기(Font.custom) 앱 기본 폰트. 내부적으로 A2Z 패밀리 사용.
    static func suite(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom(appFontName(for: weight), size: size)
    }

    /// Dynamic Type 지원 앱 기본 폰트. `relativeTo` textStyle에 연동되어 접근성 > 텍스트 크기 설정에 자동 스케일.
    /// 사용 예: `.font(.suite(size: 16, weight: .medium, relativeTo: .body))`
    static func suite(size: CGFloat, weight: Font.Weight = .regular, relativeTo textStyle: Font.TextStyle) -> Font {
        Font.custom(appFontName(for: weight), size: size, relativeTo: textStyle)
    }

    private static func appFontName(for weight: Font.Weight) -> String {
        let family: String
        switch weight {
        case .ultraLight, .thin: family = "A2Z 1 Thin"
        case .light: family = "A2Z 3 Light"
        case .regular: family = "A2Z 4 Regular"
        case .medium: family = "A2Z 5 Medium"
        case .semibold: family = "A2Z 6 SemiBold"
        case .bold: family = "A2Z 7 Bold"
        case .heavy: family = "A2Z 8 ExtraBold"
        case .black: family = "A2Z 9 Black"
        default: family = "A2Z 4 Regular"
        }
        return UIFont.fontNames(forFamilyName: family).first ?? family
    }
}

// MARK: - App Text Styles (SUITE 기반)
// 헤더는 기존 크기 유지, 본문/캡션은 크기 증가

public struct AppFonts {
    
    // MARK: - Headers (크기 유지)
    
    /// 화면 제목, 큰 헤더 (22pt, Bold)
    public static let title = Font.suite(size: 22, weight: .bold)
    
    /// 섹션 헤더 (18pt, Bold)
    public static let headline = Font.suite(size: 18, weight: .bold)
    
    /// 작은 섹션 헤더 (16pt, Semibold)
    public static let subheadline = Font.suite(size: 16, weight: .semibold)
    
    // MARK: - Body Text (크기 증가: 14pt → 16pt)
    
    /// 일반 본문 텍스트 (16pt, Regular)
    public static let body = Font.suite(size: 16, weight: .regular)
    
    /// 강조 본문 (17pt, Medium)
    public static let bodyMedium = Font.suite(size: 17, weight: .medium)
    
    /// 굵은 본문 (16pt, Semibold)
    public static let bodyBold = Font.suite(size: 16, weight: .semibold)
    
    // MARK: - Secondary Text (크기 증가: 13pt → 15pt)
    
    /// 부가 정보—날짜, 서브텍스트 (15pt, Regular)
    public static let secondary = Font.suite(size: 15, weight: .regular)
    
    /// 부가 정보 굵게 (15pt, Medium)
    public static let secondaryMedium = Font.suite(size: 15, weight: .medium)
    
    // MARK: - Caption (크기 증가: 12pt → 14pt)
    
    /// 캡션—작은 부가 정보 (14pt, Regular)
    public static let caption = Font.suite(size: 14, weight: .regular)
    
    /// 캡션 굵게 (14pt, Medium)
    public static let captionMedium = Font.suite(size: 14, weight: .medium)
    
    /// 캡션 볼드 (14pt, Bold)
    public static let captionBold = Font.suite(size: 14, weight: .bold)
    
    // MARK: - Small Caption (크기 증가: 10pt → 12pt)
    
    /// 아주 작은 텍스트—뱃지, 태그 (12pt, Regular)
    public static let captionSmall = Font.suite(size: 12, weight: .regular)
    
    /// 아주 작은 텍스트 굵게 (12pt, Semibold)
    public static let captionSmallBold = Font.suite(size: 12, weight: .semibold)
    
    // MARK: - Icons & Special
    
    /// 아이콘용 시스템 폰트 (SF Symbols와 함께 사용)
    public static func icon(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        return .system(size: size, weight: weight)
    }
    
    // MARK: - Button Text
    
    /// 버튼 텍스트 (16pt, Semibold)
    public static let button = Font.suite(size: 16, weight: .semibold)
    
    /// 작은 버튼 텍스트 (14pt, Medium)
    public static let buttonSmall = Font.suite(size: 14, weight: .medium)
    
    // MARK: - Input Fields
    
    /// 입력 필드 텍스트 (16pt, Regular)
    public static let input = Font.suite(size: 16, weight: .regular)
    
    /// 플레이스홀더 (16pt, Regular)
    public static let placeholder = Font.suite(size: 16, weight: .regular)
}

// MARK: - UIFont Extension (UIKit 호환)

public extension UIFont {
    /// 앱 기본 폰트(A2Z). 함수명 `suite`는 호출 사이트 호환을 위해 유지.
    static func suite(size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let family: String
        switch weight {
        case .ultraLight, .thin: family = "A2Z 1 Thin"
        case .light: family = "A2Z 3 Light"
        case .regular: family = "A2Z 4 Regular"
        case .medium: family = "A2Z 5 Medium"
        case .semibold: family = "A2Z 6 SemiBold"
        case .bold: family = "A2Z 7 Bold"
        case .heavy: family = "A2Z 8 ExtraBold"
        case .black: family = "A2Z 9 Black"
        default: family = "A2Z 4 Regular"
        }
        let psName = UIFont.fontNames(forFamilyName: family).first ?? family
        return UIFont(name: psName, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
    }
}
