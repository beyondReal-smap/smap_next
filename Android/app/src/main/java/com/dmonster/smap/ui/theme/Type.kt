package com.dmonster.smap.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.dmonster.smap.R

/**
 * 앱 기본 폰트 패밀리 — iOS 와 동일하게 AtoZ(A2Z) 로 전환.
 * 이름은 `SuiteFont` 로 유지해 호출부 파급 제거.
 *
 * Weight 매핑 (AtoZ 1~9 → Compose Font.Weight):
 *   Thin(100), ExtraLight(200), Light(300), Normal(400), Medium(500),
 *   SemiBold(600), Bold(700), ExtraBold(800), Black(900)
 */
val SuiteFont = FontFamily(
    Font(R.font.atoz_1thin,        FontWeight.Thin),
    Font(R.font.atoz_2extralight,  FontWeight.ExtraLight),
    Font(R.font.atoz_3light,       FontWeight.Light),
    Font(R.font.atoz_4regular,     FontWeight.Normal),
    Font(R.font.atoz_5medium,      FontWeight.Medium),
    Font(R.font.atoz_6semibold,    FontWeight.SemiBold),
    Font(R.font.atoz_7bold,        FontWeight.Bold),
    Font(R.font.atoz_8extrabold,   FontWeight.ExtraBold),
    Font(R.font.atoz_9black,       FontWeight.Black)
)

/** 의미 명확화를 위한 AtoZ 별칭. 새 코드에서는 `AtoZFont` 로 쓰는 걸 권장. */
val AtoZFont: FontFamily = SuiteFont

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
