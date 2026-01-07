package com.dmonster.smap.ui.activitylog

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.naver.maps.geometry.LatLng
import com.naver.maps.map.compose.PolylineOverlay
import com.naver.maps.map.compose.Marker
import com.naver.maps.map.compose.MarkerState
import com.naver.maps.map.compose.ExperimentalNaverMapApi
import com.naver.maps.map.overlay.OverlayImage
import com.dmonster.smap.R
import kotlin.math.*

// MARK: - Gradient Path Utilities (iOS Style - 7 Pastel Colors)

// iOS와 동일한 선명한 파스텔 무지개색 배열 (Muted Pastel -> Vivid Pastel)
private val RainbowColors = listOf(
    Color(0xFFFF8585), // Vivid Red
    Color(0xFFFFB366), // Vivid Orange
    Color(0xFFFFE066), // Vivid Yellow
    Color(0xFF85E085), // Vivid Green
    Color(0xFF85C2FF), // Vivid Blue
    Color(0xFFA3A3FF), // Vivid Indigo
    Color(0xFFD6A3FF)  // Vivid Violet
)

private fun interpolateColor(color1: Color, color2: Color, factor: Float): Color {
    val r = (color1.red + (color2.red - color1.red) * factor).coerceIn(0f, 1f)
    val g = (color1.green + (color2.green - color1.green) * factor).coerceIn(0f, 1f)
    val b = (color1.blue + (color2.blue - color1.blue) * factor).coerceIn(0f, 1f)
    val a = (color1.alpha + (color2.alpha - color1.alpha) * factor).coerceIn(0f, 1f)
    return Color(r, g, b, a)
}

// progress 기반 색상 계산
fun getColorForProgress(progress: Float): Color {
    val colorIndex = (progress * (RainbowColors.size - 1)).toInt().coerceIn(0, RainbowColors.size - 2)
    val nextColorIndex = (colorIndex + 1).coerceAtMost(RainbowColors.size - 1)
    val segmentProgress = (progress * (RainbowColors.size - 1)) - colorIndex
    return interpolateColor(RainbowColors[colorIndex], RainbowColors[nextColorIndex], segmentProgress)
}

/**
 * 파스텔 그라데이션 경로와 점 마커 오버레이
 */
@OptIn(ExperimentalNaverMapApi::class)
@Composable
fun GradientPathOverlay(
    coords: List<LatLng>,
    width: androidx.compose.ui.unit.Dp = 6.dp
) {
    if (coords.size < 2) return
    
    // 1. 그라데이션 Polyline 그리기
    for (i in 0 until coords.size - 1) {
        val start = coords[i]
        val end = coords[i + 1]
        
        val progress = i.toFloat() / (coords.size - 1).toFloat()
        val segmentColor = getColorForProgress(progress)
        
        PolylineOverlay(
            coords = listOf(start, end),
            width = width,
            color = segmentColor,
            capType = com.naver.maps.map.compose.LineCap.Round,
            joinType = com.naver.maps.map.compose.LineJoin.Round
        )
    }
    
    // 2. 경로 점 마커 (Dot Markers)
    val totalSegments = coords.size - 1
    val dotStep = maxOf(1, totalSegments / 40) // 점 밀집도 조절 (스크린샷처럼 촘촘하게)
    
    for (i in 0 until coords.size step dotStep) {
        val pos = coords[i]
        
        Marker(
            state = MarkerState(position = pos),
            icon = OverlayImage.fromResource(R.drawable.ic_dot_marker),
            width = 5.dp,
            height = 5.dp,
            anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
            iconTintColor = Color.White.copy(alpha = 0.9f),
            zIndex = 50,
            isFlat = true
        )
    }
}
