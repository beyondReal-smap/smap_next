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

// MARK: - Brand Colors

public struct BrandColors {
    public static let primary = Color(red: 1/255, green: 19/255, blue: 163/255)  // #0113A3
    public static let primaryDark = Color(red: 0/255, green: 31/255, blue: 135/255)  // #001f87
    public static let background = Color(red: 254/255, green: 248/255, blue: 249/255)  // #fef8f9
    public static let textPrimary = Color.black
    public static let textSecondary = Color(UIColor.systemGray)
    public static let inputBackground = Color(UIColor.systemGray6)
    public static let border = Color(UIColor.systemGray4)
    public static let error = Color.red
    public static let success = Color.green
    public static let warning = Color.orange
}

// MARK: - Custom Font Extension (SUITE)

public extension Font {
    static func suite(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        var fontName = "SUITE-Regular"
        switch weight {
        case .ultraLight: fontName = "SUITE-Light"
        case .thin: fontName = "SUITE-Light"
        case .light: fontName = "SUITE-Light"
        case .regular: fontName = "SUITE-Regular"
        case .medium: fontName = "SUITE-Medium"
        case .semibold: fontName = "SUITE-SemiBold"
        case .bold: fontName = "SUITE-Bold"
        case .heavy: fontName = "SUITE-Heavy"
        case .black: fontName = "SUITE-ExtraBold"
        default: fontName = "SUITE-Regular"
        }
        return Font.custom(fontName, size: size)
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
    static func suite(size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        var fontName = "SUITE-Regular"
        switch weight {
        case .ultraLight, .thin, .light:
            fontName = "SUITE-Light"
        case .regular:
            fontName = "SUITE-Regular"
        case .medium:
            fontName = "SUITE-Medium"
        case .semibold:
            fontName = "SUITE-SemiBold"
        case .bold:
            fontName = "SUITE-Bold"
        case .heavy:
            fontName = "SUITE-Heavy"
        case .black:
            fontName = "SUITE-ExtraBold"
        default:
            fontName = "SUITE-Regular"
        }
        return UIFont(name: fontName, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
    }
}
