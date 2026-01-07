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
    primary = BrandColors.Primary,
    onPrimary = Color.White,
    primaryContainer = BrandColors.Primary.copy(alpha = 0.1f),
    onPrimaryContainer = BrandColors.Primary,
    
    secondary = BrandColors.Primary,
    onSecondary = Color.White,
    
    background = BrandColors.Background,
    onBackground = BrandColors.TextPrimary,
    
    surface = Color.White,
    onSurface = BrandColors.TextPrimary,
    surfaceVariant = BrandColors.InputBackground,
    onSurfaceVariant = BrandColors.TextSecondary,
    
    error = BrandColors.Error,
    onError = Color.White,
    
    outline = BrandColors.Border,
    outlineVariant = BrandColors.Border.copy(alpha = 0.5f)
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
