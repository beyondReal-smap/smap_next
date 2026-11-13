package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Notes
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapButtonStyle
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.time.LocalDate

/**
 * 일정 상세 시트 — 36단계 재설계.
 * 이전: 가운데 대화상자, 남색 아이콘 + 글자 줄, 상태 배지 색이 제각각.
 * 지금: 아래 시트. 제목 → 정보 행(언제·누구·어디·반복·메모) → 아래에 [삭제][수정].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailDialog(
    schedule: SmapSchedule,
    canEdit: Boolean,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    val status = getScheduleStatusUI(schedule)
    val dateText = schedule.date?.take(10)?.let { d ->
        runCatching { scheduleDateTitle(LocalDate.parse(d)) }.getOrDefault(d)
    } ?: ""
    val start = schedule.date?.let { Regex("""[T ](\d{2}:\d{2})""").find(it)?.groupValues?.get(1) }
    val end = schedule.sstEdate?.let { Regex("""[T ](\d{2}:\d{2})""").find(it)?.groupValues?.get(1) }
    val timeText = when {
        schedule.sstAllDay == "Y" -> "하루 종일"
        start != null && end != null -> "$start – $end"
        start != null -> start
        else -> null
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = SmapSpacing.md)
        ) {
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
            ) {
                Column(Modifier.padding(horizontal = SmapSpacing.screenHorizontal)) {
                    Text(
                        status.label,
                        style = SmapText.captionBold,
                        color = if (status == ScheduleStatusUI.ONGOING) colors.primary else colors.onSurfaceVariant,
                    )
                    Text(
                        schedule.displayTitle,
                        style = SmapText.title,
                        color = colors.onSurface,
                        modifier = Modifier.semantics { heading() },
                    )
                }
                SmapListRow(
                    title = dateText,
                    subtitle = timeText,
                    leading = { SmapRowIcon(Icons.Outlined.Schedule) },
                )
                schedule.validMemberName.takeIf { it.isNotBlank() }?.let {
                    SmapListRow(title = it, subtitle = "일정 대상", leading = { SmapRowIcon(Icons.Outlined.Person) })
                }
                schedule.location?.takeIf { it.isNotBlank() }?.let {
                    SmapListRow(title = it, subtitle = "장소", leading = { SmapRowIcon(Icons.Outlined.Place) })
                }
                if (schedule.isRecurring) {
                    SmapListRow(
                        title = schedule.repeatDescription ?: "반복 일정",
                        subtitle = "반복",
                        leading = { SmapRowIcon(Icons.Outlined.Repeat) },
                    )
                }
                schedule.sstMemo?.takeIf { it.isNotBlank() }?.let { memo ->
                    Row(Modifier.padding(horizontal = SmapSpacing.md, vertical = 10.dp)) {
                        SmapRowIcon(Icons.AutoMirrored.Outlined.Notes)
                        Text(
                            memo,
                            style = SmapText.body,
                            color = colors.onSurface,
                            modifier = Modifier.padding(start = 12.dp, top = 9.dp),
                        )
                    }
                }
            }

            if (canEdit) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.screenHorizontal, top = SmapSpacing.md),
                    horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm),
                ) {
                    SmapButton(
                        text = "삭제",
                        onClick = onDelete,
                        style = SmapButtonStyle.Secondary,
                        modifier = Modifier.weight(1f),
                    )
                    SmapButton(
                        text = "수정",
                        onClick = onEdit,
                        leadingIcon = Icons.Outlined.Edit,
                        modifier = Modifier.weight(2f),
                    )
                }
            }
        }
    }
}
