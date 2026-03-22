package com.dmonster.smap.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * 화면 너비가 작은 기기(360dp 이하)를 위한 반응형 글자 크기 조절 익스텐션
 */

@Composable
fun Int.responsiveSp(): TextUnit {
    val screenWidth = LocalConfiguration.current.screenWidthDp
    val scale = if (screenWidth < 360) 0.85f else 1.0f
    return (this * scale).sp
}

@Composable
fun Double.responsiveSp(): TextUnit {
    val screenWidth = LocalConfiguration.current.screenWidthDp
    val scale = if (screenWidth < 360) 0.85f else 1.0f
    return (this * scale).sp
}

@Composable
fun Float.responsiveSp(): TextUnit {
    val screenWidth = LocalConfiguration.current.screenWidthDp
    val scale = if (screenWidth < 360) 0.85f else 1.0f
    return (this * scale).sp
}
