package com.dmonster.smap.ui.theme

import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * iOS SMAPTheme.Motion 과 동등한 앱 전역 모션 토큰.
 *
 * Material Motion + Apple HIG 가이드를 따라 150–400ms 범위를 세분화.
 * 모든 Compose 애니메이션은 이 상수를 사용해 리듬을 일관화한다.
 */
object SmapMotion {
    /** 마이크로 인터랙션 (버튼 pressed / 작은 토글). 150ms */
    const val MicroMs = 150
    /** 기본 뷰 전환 (페이드/슬라이드). 250ms */
    const val DefaultMs = 250
    /** 리스트↔상세 같은 주요 뷰 간 전환. 350ms */
    const val ScreenTransitionMs = 350
    /** 드로어/바텀시트 등 큰 표면 전환. 400ms */
    const val SurfaceMs = 400

    /** Material Motion 표준 감속(enter) — ease-out */
    val StandardDecelerate = CubicBezierEasing(0.0f, 0.0f, 0.2f, 1.0f)
    /** Material Motion 표준 가속(exit) — ease-in */
    val StandardAccelerate = CubicBezierEasing(0.4f, 0.0f, 1.0f, 1.0f)

    /** enter 용 애니메이션 spec — 감속 */
    fun <T> enter(durationMs: Int = DefaultMs): FiniteAnimationSpec<T> =
        tween(durationMillis = durationMs, easing = StandardDecelerate)

    /** exit 용 애니메이션 spec — 가속, enter 보다 짧게 (체감 응답성) */
    fun <T> exit(durationMs: Int = (DefaultMs * 0.7f).toInt()): FiniteAnimationSpec<T> =
        tween(durationMillis = durationMs, easing = StandardAccelerate)
}

/**
 * OS 접근성 "애니메이션 제거"(설정 > 접근성 > 애니메이션 제거) 활성 여부.
 *
 * 시스템 ANIMATOR_DURATION_SCALE 이 0 이면 사용자가 모션 감소를 원하는 것이므로,
 * 무한 반복/장식성 애니메이션은 정지해야 한다(WCAG 2.3.3 — 전정기관 민감 사용자 보호).
 */
@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        runCatching {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f
            ) == 0f
        }.getOrDefault(false)
    }
}
