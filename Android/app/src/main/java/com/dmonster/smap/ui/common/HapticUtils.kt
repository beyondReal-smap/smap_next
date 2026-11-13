package com.dmonster.smap.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback

/**
 * iOS SMAP 의 HapticManager 와 동등한 경량 헬퍼.
 * Compose 환경에서 `rememberSmapHaptics()` 로 얻은 인스턴스를 통해
 * - `light()` : 선택/가벼운 탭 피드백
 * - `medium()` : 확정/전환 같은 중간 강도
 * - `success()/error()` : 결과 알림 (Compose LongPress 유사로 매핑)
 *
 * SDK 레벨 차이에 따라 가능한 최대 세분화된 HapticFeedbackType 사용.
 */
class SmapHaptics internal constructor(private val feedback: HapticFeedback) {

    fun light() {
        // Compose LongPress 는 보통 약한 "탭" 톤으로 대부분의 기기에서 느껴짐
        feedback.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    fun medium() {
        feedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    /** 성공 피드백 — 저장/전송 완료 시 사용 */
    fun success() {
        feedback.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    /** 경고 피드백 — 검증 실패, 확인 필요 시 사용 */
    fun warning() {
        feedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    /** 오류 피드백 — 네트워크 실패 등 사용 */
    fun error() {
        feedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }
}

@Composable
fun rememberSmapHaptics(): SmapHaptics {
    val feedback = LocalHapticFeedback.current
    return SmapHaptics(feedback)
}
