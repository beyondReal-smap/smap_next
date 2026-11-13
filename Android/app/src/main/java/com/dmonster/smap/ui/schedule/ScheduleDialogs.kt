package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.components.SmapDialogActions
import com.dmonster.smap.ui.theme.SmapText

/*
 * 일정 삭제·반복 범위 확인 — 36단계 재설계.
 * 이전: 빨간 경고 삼각형 + 가운데 정렬 + 빨간·옅은 빨강 버튼 두 개.
 * 지금: 그룹 삭제 확인과 같은 모양(왼쪽 정렬 문장 + 빨간 확인 버튼 하나). 범위는 라디오로 고른다.
 */

@Composable
fun DeleteScheduleDialog(
    schedule: SmapSchedule,
    isRepeat: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (deleteOption: String) -> Unit,
    isLoading: Boolean
) {
    var selectedOption by remember { mutableStateOf("this") }
    val colors = MaterialTheme.colorScheme

    AlertDialog(
        onDismissRequest = { if (!isLoading) onDismiss() },
        title = { Text("'${schedule.displayTitle}'을(를) 삭제할까요?", style = SmapText.headline) },
        text = {
            Column {
                Text("삭제하면 되돌릴 수 없어요.", style = SmapText.secondary, color = colors.onSurfaceVariant)
                if (isRepeat) {
                    ScopeOptions(
                        options = listOf("this" to "이 일정만", "future" to "이후 모든 일정", "all" to "모든 반복 일정"),
                        selected = selectedOption,
                        onSelect = { selectedOption = it },
                    )
                }
            }
        },
        confirmButton = {
            SmapDialogActions(
                confirmText = "삭제",
                onConfirm = { onConfirm(selectedOption) },
                onDismiss = onDismiss,
                destructive = true,
                isLoading = isLoading,
            )
        }
    )
}

/** 반복 일정을 수정·삭제할 때 범위를 고른다. 호출부 계약(onThisOnly/onAll)은 그대로 둔다. */
@Composable
fun RecurringScheduleActionDialog(
    title: String,
    message: String,
    thisOnlyLabel: String,
    allLabel: String,
    isDestructive: Boolean = false,
    onThisOnly: () -> Unit,
    onAll: () -> Unit,
    onDismiss: () -> Unit
) {
    var selected by remember { mutableStateOf("this") }
    val colors = MaterialTheme.colorScheme

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, style = SmapText.headline) },
        text = {
            Column {
                Text(message, style = SmapText.secondary, color = colors.onSurfaceVariant)
                ScopeOptions(
                    options = listOf("this" to thisOnlyLabel, "all" to allLabel),
                    selected = selected,
                    onSelect = { selected = it },
                )
            }
        },
        confirmButton = {
            SmapDialogActions(
                confirmText = if (isDestructive) "삭제" else "다음",
                onConfirm = { if (selected == "all") onAll() else onThisOnly() },
                onDismiss = onDismiss,
                destructive = isDestructive,
            )
        }
    )
}

@Composable
private fun ScopeOptions(
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(Modifier.padding(top = 12.dp).selectableGroup()) {
        options.forEach { (value, label) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.RadioButton) { onSelect(value) }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(selected = selected == value, onClick = null, modifier = Modifier.padding(12.dp))
                Text(label, style = SmapText.body, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}
