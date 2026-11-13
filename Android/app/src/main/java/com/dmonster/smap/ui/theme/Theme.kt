package com.dmonster.smap.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * 라이트 모드 색상 스키마
 */
private val LightColorScheme = lightColorScheme(
    // SMAP 2.0 — 브랜드 남색 하나 + 차가운 회색 계열. 화면 배경은 연회색, 묶음(카드·시트)은 흰색으로 층을 나눈다.
    primary = BrandColors.Primary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE8EBFB),
    onPrimaryContainer = BrandColors.Primary,

    secondary = BrandColors.Primary,
    onSecondary = Color.White,

    background = Color(0xFFF4F5F8),
    onBackground = Color(0xFF111827),

    surface = Color.White,
    onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFEEF0F4),
    onSurfaceVariant = Color(0xFF6B7280),

    error = BrandColors.Error,
    onError = Color.White,

    outline = Color(0xFFD5D9E0),
    outlineVariant = Color(0xFFE8EAEF),

    // 대화상자·날짜 선택기·메뉴·시트가 쓰는 바탕. 지정하지 않으면 머티리얼 기본(보라빛)이 나와
    // 확인창만 연보라로 떠 보였다. 모두 흰색으로, 가장 진한 단계만 입력칸·스위치 바탕용 회색으로 둔다.
    surfaceTint = Color.White,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color.White,
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color.White,
    surfaceContainerHighest = Color(0xFFEEF0F4),
    secondaryContainer = Color(0xFFE8EBFB),
    onSecondaryContainer = BrandColors.Primary,
)

/**
 * 다크 모드 색상 스키마
 */
private val DarkColorScheme = darkColorScheme(
    primary = BrandColors.Primary,
    onPrimary = Color.White,
    primaryContainer = BrandColors.Primary.copy(alpha = 0.2f),
    onPrimaryContainer = Color.White,
    
    secondary = BrandColors.Primary,
    onSecondary = Color.White,
    
    background = Color(0xFF121212),
    onBackground = Color.White,
    
    surface = Color(0xFF1E1E1E),
    onSurface = Color.White,
    surfaceVariant = Color(0xFF2C2C2C),
    onSurfaceVariant = Color(0xFFAAAAAA),
    
    error = BrandColors.Error,
    onError = Color.White,
    
    outline = Color(0xFF555555),
    outlineVariant = Color(0xFF333333)
)

/**
 * Smap 앱 테마 (SUITE 폰트 + 브랜드 색상)
 */
@Composable
fun SmapTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    
    MaterialTheme(
        colorScheme = colorScheme,
        typography = SmapTypography,
        content = content
    )
}
