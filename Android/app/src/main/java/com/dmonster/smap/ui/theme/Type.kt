package com.dmonster.smap.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.dmonster.smap.R

/**
 * SUITE 커스텀 폰트 패밀리 (iOS와 동일)
 */
val SuiteFont = FontFamily(
    Font(R.font.suite_light, FontWeight.Light),
    Font(R.font.suite_regular, FontWeight.Normal),
    Font(R.font.suite_medium, FontWeight.Medium),
    Font(R.font.suite_semibold, FontWeight.SemiBold),
    Font(R.font.suite_bold, FontWeight.Bold),
    Font(R.font.suite_extrabold, FontWeight.ExtraBold),
    Font(R.font.suite_heavy, FontWeight.Black)
)

/**
 * 앱 전체 Typography (SUITE 폰트 기반)
 */
val SmapTypography = Typography(
    // Display
    displayLarge = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Bold,
        fontSize = 59.sp,
        lineHeight = 66.sp
    ),
    displayMedium = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Bold,
        fontSize = 47.sp,
        lineHeight = 54.sp
    ),
    displaySmall = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Bold,
        fontSize = 38.sp,
        lineHeight = 46.sp
    ),
    
    // Headline
    headlineLarge = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 42.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 30.sp,
        lineHeight = 38.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 26.sp,
        lineHeight = 34.sp
    ),
    
    // Title
    titleLarge = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 30.sp
    ),
    titleMedium = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 18.sp,
        lineHeight = 26.sp
    ),
    titleSmall = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    
    // Body
    bodyLarge = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 18.sp,
        lineHeight = 26.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    bodySmall = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    
    // Label
    labelLarge = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    labelMedium = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelSmall = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp
    )
)

/**
 * 커스텀 텍스트 스타일 (iOS 스타일과 동일하게 사용)
 */
object SmapTextStyle {
    // 로고/브랜드
    val logoTitle = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp
    )
    
    val logoSubtitle = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        color = BrandColors.TextSecondary
    )
    
    // 버튼
    val buttonPrimary = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp
    )
    
    val buttonSecondary = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Medium,
        fontSize = 17.sp
    )
    
    // 입력 필드
    val inputText = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 18.sp
    )
    
    val inputPlaceholder = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 18.sp,
        color = BrandColors.TextSecondary
    )
    
    // 링크
    val link = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        color = BrandColors.Primary
    )
    
    // 에러
    val error = TextStyle(
        fontFamily = SuiteFont,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        color = BrandColors.Error
    )
}
