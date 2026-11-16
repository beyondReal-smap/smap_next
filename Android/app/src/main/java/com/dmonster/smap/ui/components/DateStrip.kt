package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/** 날짜 줄 한 칸. [dot] 은 그날 기록(일정·활동)이 있는지, [locked] 는 구독이 필요한 날. */
data class DateChipItem(
    val date: LocalDate,
    val dot: Boolean = false,
    val locked: Boolean = false,
)

/**
 * 가로 날짜 줄 — 홈(일정 날짜)·활동 로그(14일) 공용. 선택한 날은 남색으로 채운다.
 * 처음 그릴 때 선택한 날이 보이도록 스크롤한다.
 */
@Composable
fun DateStrip(
    items: List<DateChipItem>,
    selected: LocalDate,
    onSelect: (DateChipItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()
    val selectedIndex = items.indexOfFirst { it.date == selected }
    LaunchedEffect(items.size) {
        if (selectedIndex > 2) listState.scrollToItem(selectedIndex - 2)
    }
    val today = LocalDate.now()
    LazyRow(
        modifier = modifier,
        state = listState,
        contentPadding = PaddingValues(horizontal = SmapSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        items(items, key = { it.date.toEpochDay() }) { item ->
            DateChip(item, isSelected = item.date == selected, isToday = item.date == today, onClick = { onSelect(item) })
        }
    }
}

@Composable
private fun DateChip(item: DateChipItem, isSelected: Boolean, isToday: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val weekday = item.date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.KOREAN)
    val weekdayColor = when {
        isSelected -> Color.White.copy(alpha = 0.8f)
        item.date.dayOfWeek == DayOfWeek.SUNDAY -> colors.error
        else -> colors.onSurfaceVariant
    }
    val a11y = buildString {
        append("${item.date.monthValue}월 ${item.date.dayOfMonth}일 $weekday")
        if (isToday) append(", 오늘")
        if (item.locked) append(", 구독 필요")
        if (item.dot) append(", 기록 있음")
    }
    Column(
        Modifier
            .width(48.dp)
            .clip(RoundedCornerShape(14.dp))
            .then(if (isSelected) Modifier.background(SmapBrush.navy) else Modifier.background(colors.surfaceVariant))
            .selectable(selected = isSelected, onClick = onClick, role = Role.Tab)
            .semantics(mergeDescendants = true) { contentDescription = a11y },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(8.dp))
        Text(if (isToday) "오늘" else weekday, style = SmapText.captionSmall, color = weekdayColor)
        Spacer(Modifier.height(2.dp))
        if (item.locked) {
            Box(Modifier.height(24.dp), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = colors.onSurfaceVariant.copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
            }
        } else {
            Text(
                "${item.date.dayOfMonth}",
                style = SmapText.subheadline,
                color = if (isSelected) Color.White else colors.onSurface,
            )
        }
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier
                .size(5.dp)
                .background(
                    when {
                        !item.dot -> Color.Transparent
                        isSelected -> Color.White
                        else -> colors.primary
                    },
                    CircleShape,
                )
        )
        Spacer(Modifier.height(7.dp))
    }
}
