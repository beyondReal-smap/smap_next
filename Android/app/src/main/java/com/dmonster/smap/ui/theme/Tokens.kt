package com.dmonster.smap.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 간격 토큰 — iOS SMAPTheme.Spacing 과 동일 값.
 * 화면에서 `16.dp` 같은 리터럴 대신 이 값을 써서 리듬을 맞춘다.
 */
object SmapSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp

    /** 화면 좌우 기본 여백 */
    val screenHorizontal = 20.dp
}

/** 모서리 반경 토큰 — iOS SMAPTheme.Radius 와 동일 값. */
object SmapRadius {
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
}

/** 크기 토큰 — 터치 타깃과 공용 컴포넌트 높이. */
object SmapSize {
    /** Material 접근성 최소 터치 타깃 */
    val minTouchTarget = 48.dp
    val buttonHeight = 52.dp
    val topBarHeight = 56.dp
}

/**
 * 본문용 타이포 단계 — iOS SMAPTheme.Font 와 이름·크기를 1:1 로 맞춘다.
 * 색은 지정하지 않는다. 호출부가 colorScheme(onSurface / onSurfaceVariant)에서 고르거나
 * Text 기본값(LocalContentColor)을 따르게 해서 다크 모드에서 깨지지 않게 한다.
 */
object SmapText {
    val title = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 30.sp)
    val headline = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 26.sp)
    val subheadline = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp)
    val body = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp)
    val bodyMedium = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Medium, fontSize = 17.sp, lineHeight = 24.sp)
    val bodyBold = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp)
    val secondary = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp)
    val secondaryMedium = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 22.sp)
    val caption = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp)
    val captionMedium = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp)
    val captionBold = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 20.sp)
    val captionSmall = TextStyle(fontFamily = SuiteFont, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp)
}
