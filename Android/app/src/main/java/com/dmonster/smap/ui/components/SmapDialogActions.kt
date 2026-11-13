package com.dmonster.smap.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 확인창 아래 버튼 한 쌍 — [취소][확인]을 같은 크기·모양으로 나란히 둔다.
 * 이전에는 확인만 큰 빨간 버튼, 취소는 작은 글자 버튼이라 둘이 다른 화면 것처럼 보였다.
 * AlertDialog 의 confirmButton 자리에 넣고 dismissButton 은 비워 둔다.
 */
@Composable
fun SmapDialogActions(
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    dismissText: String = "취소",
    destructive: Boolean = false,
    isLoading: Boolean = false,
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SmapButton(
            text = dismissText,
            onClick = onDismiss,
            style = SmapButtonStyle.Neutral,
            enabled = !isLoading,
            modifier = Modifier.weight(1f),
        )
        SmapButton(
            text = confirmText,
            onClick = onConfirm,
            style = if (destructive) SmapButtonStyle.Destructive else SmapButtonStyle.Primary,
            enabled = !isLoading,
            isLoading = isLoading,
            modifier = Modifier.weight(1f),
        )
    }
}
