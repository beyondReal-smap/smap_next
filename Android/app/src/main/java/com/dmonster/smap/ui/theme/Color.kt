package com.dmonster.smap.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * 브랜드 색상 정의 (iOS BrandColors / SMAPTheme 기반 동기화)
 */
object BrandColors {
    val Primary = Color(0xFF0113A3)       // #0113A3
    val Secondary = Color(0xFF667EEA)     // #667eea
    val PrimaryDark = Color(0xFF001F87)   // #001f87
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
 * iOS SMAPTheme.ScheduleSection — 일정 작성 폼 섹션별 색.
 * 과도한 배경 톤을 피하려고 badge.opacity(0.06) + stroke(0.18) 구조 사용.
 */
object ScheduleSectionColors {
    // Badge — 섹션 번호/아이콘 포인트 컬러
    val BadgeGroup = Color(0xFFDC2626)    // Red 600
    val BadgeContent = Color(0xFF2563EB)  // Blue 600
    val BadgeDateTime = Color(0xFF16A34A) // Green 600
    val BadgeExtra = Color(0xFFD97706)    // Amber 600

    // 배경 — badge 색의 6% alpha (산만함 완화)
    val BgGroup = BadgeGroup.copy(alpha = 0.06f)
    val BgContent = BadgeContent.copy(alpha = 0.06f)
    val BgDateTime = BadgeDateTime.copy(alpha = 0.06f)
    val BgExtra = BadgeExtra.copy(alpha = 0.06f)

    // 구분선 — 배경이 연해졌으므로 stroke 로 경계 구분
    val StrokeGroup = BadgeGroup.copy(alpha = 0.18f)
    val StrokeContent = BadgeContent.copy(alpha = 0.18f)
    val StrokeDateTime = BadgeDateTime.copy(alpha = 0.18f)
    val StrokeExtra = BadgeExtra.copy(alpha = 0.18f)
}

/**
 * 라이트/다크 적응 배경색 — 수동 전환도 가능하도록 쌍으로 제공.
 * 다크 테마가 활성화됐을 때 Color.kt 내부 로직이 아닌 Theme.kt 의 colorScheme 가 담당.
 */
object AdaptiveColors {
    // 페이지 기본 배경 (라이트)
    val PageBackgroundLight = Color(0xFFFAFAFF)
    val PageBackgroundDark = Color(0xFF16161F)
    // 카드/표면
    val SurfaceLight = Color.White
    val SurfaceDark = Color(0xFF28282F)
    // 사이드바 전용 배경
    val SidebarBackgroundLight = Color(0xFFF5F7FA)
    val SidebarBackgroundDark = Color(0xFF1C1F24)
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

    // 요약 카드 통계 아이콘
    val StatDistance = Color(0xFFEF4444) // 이동거리 Red
    val StatTime = Color(0xFFF59E0B)     // 이동시간 Orange
    val StatSteps = Color(0xFF3B82F6)    // 걸음수 Blue

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

/**
 * 그라데이션 배경 색상 (로그인 화면용)
 */
object GradientColors {
    val LoginGradient = listOf(
        Color(0xFF667EEA),  // #667eea
        Color(0xFF764BA2),  // #764ba2
        Color(0xFFF093FB),  // #f093fb
        Color(0xFFF5576C),  // #f5576c
        Color(0xFF4FACFE),  // #4facfe
        Color(0xFF00F2FE)   // #00f2fe
    )
}
