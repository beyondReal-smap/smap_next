package com.dmonster.smap.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * 브랜드 색상 정의 (iOS BrandColors 기반)
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
    val Error = Color(0xFFFF3B30)         // systemRed
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
