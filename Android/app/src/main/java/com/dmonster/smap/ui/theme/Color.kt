package com.dmonster.smap.ui.theme

import androidx.compose.ui.graphics.Color

object FamilyColors {
    val Paper = Color(0xFFF4F8FC)
    val Ink = Color(0xFF294F77)
    val Highlight = Color(0xFFFFDBBC)
    val Muted = Color(0xFF53677C)
}

/**
 * 브랜드 색상 정의 (iOS BrandColors / SMAPTheme 기반 동기화)
 */
object BrandColors {
    // 2026-11-20: 파랑(#0113A3·#001F87)에서 앱 남색으로 — 홈 강조색(SmapAccent.Family)과 같은 값. 아이콘·스플래시와 한 톤.
    val Primary = Color(0xFF345F8C)       // #345F8C
    val Secondary = Color(0xFF667EEA)     // #667eea
    val PrimaryDark = Color(0xFF26496E)   // #26496E
    val Background = Color(0xFFFEF8F9)    // #fef8f9
    val TextPrimary = Color.Black
    val TextSecondary = Color(0xFF8E8E93) // systemGray
    val InputBackground = Color(0xFFF2F2F7) // systemGray6
    val Border = Color(0xFFD1D1D6)        // systemGray4

    // Semantic status — 다크모드 대응 시스템 색
    val Error = Color(0xFFFF3B30)         // systemRed
    val Success = Color(0xFF34C759)       // systemGreen
    val Warning = Color(0xFFFF9500)       // systemOrange
}

/**
 * iOS SMAPTheme.Accent — 브랜드 보조 색
 */
object AccentColors {
    val Pink = Color(0xFFEC4899)          // Pink-500
    val PinkDeep = Color(0xFFF43F5E)      // Rose-500
    val Orange = Color(0xFFF59E0B)        // Amber-500
    val Indigo = Color(0xFF6366F1)        // Indigo-500
    val Crown = Color(0xFFEAB308)         // Yellow-500 (오너 왕관)
    val NotificationDot = Color(0xFFDC2626) // Red-600 (읽지 않음 배지)
    val PrimarySoft = Color(0xFF667EEA)   // Indigo-400 (프로필 그라데이션 종점)
}

/**
 * iOS SMAPTheme.Semantic — 도메인 의미 색
 */
object SemanticColors {
    // 사이드바 섹션 인디케이터
    val IndicatorGroup = Color(0xFFDC2626)   // Red-600
    val IndicatorDate = Color(0xFFD97706)    // Amber-600
    val IndicatorMember = Color(0xFF2563EB)  // Blue-600
    val IndicatorLocation = Color(0xFF16A34A) // Green-600

    // 멤버 일정 상태 (완료/진행/예정)
    val StatCompleted = Color(0xFF16A34A)   // Green-600
    val StatOngoing = Color(0xFFD97706)     // Amber-600
    val StatUpcoming = Color(0xFF2563EB)    // Blue-600

    // 캘린더 요일 — iOS systemRed/systemBlue 와 동일 톤.
    // 다크모드 시스템 자동 대응은 colorScheme 확장 시 재매핑.
    val CalendarSunday = Color(0xFFFF3B30)  // iOS systemRed
    val CalendarSaturday = Color(0xFF007AFF) // iOS systemBlue
}

/**
 * 활동로그 전용 팔레트 — 경로 그라데이션/머물기 시간대/히트맵에서 공용.
 * 하드코딩을 차단해 추후 다크모드·테마 변경 시 한 곳만 수정하면 된다.
 */
object ActivityLogColors {
    // 경로 그라데이션 (iOS 무지개 파스텔) — 시작→종료 순서 유지
    val PathRainbow = listOf(
        Color(0xFFFF8585), // Red
        Color(0xFFFFB366), // Orange
        Color(0xFFFFE066), // Yellow
        Color(0xFF85E085), // Green
        Color(0xFF85C2FF), // Blue
        Color(0xFFA3A3FF), // Indigo
        Color(0xFFD6A3FF)  // Violet
    )

    // 머물기 시간대 강도 (오래 머무를수록 따뜻한 계열)
    val StayLong = Color(0xFFFF6B6B)    // 5분+ Red
    val StayMedium = Color(0xFFFF9F43)  // 2분+ Orange
    val StayShort = Color(0xFFFFD600)   // 1분+ Yellow
    val StayBrief = Color(0xFF4CAF50)   // 30초+ Green
    val StayInstant = Color(0xFF2196F3) // 즉시 Blue

    // 히트맵
    val HeatmapActive = Color(0xFF6366F1)       // Indigo-500
    val HeatmapSelectedStart = Color(0xFFEC4899) // Pink
    val HeatmapSelectedEnd = Color(0xFFF43F5E)   // Rose
}

/**
 * 설정 메뉴 아이콘 컬러 팔레트 — iOS Settings 스타일의 원색 아이콘에 대응.
 * 아이콘 색과 배경은 항상 쌍으로 사용되며, 배경은 `iconColor.copy(alpha = 0.1f)` 근사값.
 */
object SettingsColors {
    // 계정 (Indigo tone)
    val AccountIcon = Color(0xFF6271D8)
    val AccountBg = Color(0xFFE8EAF6)

    // 약관·정책
    val TermsServiceIcon = Color(0xFF00BCD4)      // Cyan
    val TermsServiceBg = Color(0xFFE0F7FA)
    val TermsPrivacyIcon = Color(0xFF03A9F4)      // LightBlue
    val TermsPrivacyBg = Color(0xFFE1F5FE)
    val TermsLocationIcon = Color(0xFF9C27B0)     // Purple
    val TermsLocationBg = Color(0xFFF3E5F5)
    val TermsMarketingIcon = Color(0xFF3F51B5)    // Indigo
    val TermsMarketingBg = Color(0xFFE8EAF6)
    val TermsThirdpartyIcon = Color(0xFFE91E63)   // Pink
    val TermsThirdpartyBg = Color(0xFFFCE4EC)

    // 고객 지원
    val SupportGuideIcon = Color(0xFFFFB300)      // Amber
    val SupportGuideBg = Color(0xFFFFFDE7)
    val SupportInquiryIcon = Color(0xFFFF9800)    // Orange
    val SupportInquiryBg = Color(0xFFFFF3E0)
    val SupportNoticeIcon = Color(0xFFF44336)     // Red
    val SupportNoticeBg = Color(0xFFFFEBEE)

    // 화면 공통 배경 — iOS systemGroupedBackground 톤
    val PageBackground = Color(0xFFF7F7F7)
    val Divider = Color(0xFFF5F5F5)
    val TextBodyPrimary = Color(0xFF333333)
}

