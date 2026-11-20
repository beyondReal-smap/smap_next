package com.dmonster.smap.ui.schedule

import com.dmonster.smap.ui.components.SmapBrush
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.background
import com.dmonster.smap.ui.components.SmapScheduleRow
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter

// MARK: - Schedule Status

enum class ScheduleStatusUI(val label: String, val color: Color, val bgColor: Color) {
    UPCOMING("예정", SemanticColors.StatUpcoming, SemanticColors.StatUpcoming.copy(alpha = 0.12f)),
    ONGOING("진행 중", SemanticColors.StatCompleted, SemanticColors.StatCompleted.copy(alpha = 0.12f)),
    COMPLETED("지남", Color(0xFF6B7280), Color(0xFFF3F4F6))
}

fun getScheduleStatusUI(schedule: SmapSchedule): ScheduleStatusUI {
    val now = LocalDateTime.now()
    val dateStr = schedule.date ?: return ScheduleStatusUI.UPCOMING
    val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
    return try {
        val startTime = if (dateStr.length >= 16) {
            LocalDateTime.parse(dateStr.take(16).replace('T', ' '), fmt)
        } else {
            LocalDate.parse(dateStr.take(10)).atStartOfDay()
        }
        val endTimeStr = schedule.sstEdate
        val endTime = if (!endTimeStr.isNullOrEmpty() && endTimeStr.length >= 16) {
            LocalDateTime.parse(endTimeStr.take(16).replace('T', ' '), fmt)
        } else {
            startTime.plusHours(1)
        }
        when {
            now.isBefore(startTime) -> ScheduleStatusUI.UPCOMING
            now.isAfter(endTime) -> ScheduleStatusUI.COMPLETED
            else -> ScheduleStatusUI.ONGOING
        }
    } catch (e: java.time.format.DateTimeParseException) {
        ScheduleStatusUI.UPCOMING
    }
}

// MARK: - Month Calendar

/**
 * 월 달력 — 36단계 재설계.
 * 이전: 그림자 카드 + 가운데 "오늘로 이동" 작은 글씨 + 빨간 일정 점.
 * 지금: 왼쪽에 "2026년 11월", 오른쪽에 [오늘] < > — 조작이 한곳에 모인다.
 * 남색 강조(2026-11-16): 흰 묶음은 밋밋하다는 피드백으로 달력을 남색 그라데이션 카드로 바꿔 일정 탭의 시각적 중심으로 둔다.
 * 선택한 날은 흰 원 + 남색 글자, 오늘은 옅은 흰 원, 일정 점은 흰색.
 */
@Composable
fun MonthCalendar(
    currentMonth: YearMonth,
    selectedDate: LocalDate,
    eventDates: Set<LocalDate>,
    onDateSelect: (LocalDate) -> Unit,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onToday: () -> Unit,
    modifier: Modifier = Modifier
) {
    val today = LocalDate.now()
    val daysInMonth = currentMonth.lengthOfMonth()
    val firstDayOfWeek = currentMonth.atDay(1).dayOfWeek.value % 7
    val isThisMonth = currentMonth == YearMonth.from(today)

    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier
            .fillMaxWidth()
            .shadow(10.dp, shape, ambientColor = SmapBrush.Accent, spotColor = SmapBrush.Accent)
            .clip(shape)
            .background(SmapBrush.accent)
            .drawBehind {
                drawCircle(Color.White.copy(alpha = 0.07f), radius = size.width * 0.38f, center = Offset(size.width * 1.0f, 0f))
            }
            .padding(start = SmapSpacing.md, end = 4.dp, top = 4.dp, bottom = SmapSpacing.sm)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${currentMonth.year}년 ${currentMonth.monthValue}월",
                style = SmapText.headline,
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
            if (!isThisMonth || selectedDate != today) {
                TextButton(onClick = onToday) { Text("오늘", style = SmapText.captionBold, color = Color.White) }
            }
            IconButton(onClick = onPreviousMonth) {
                Icon(Icons.Filled.ChevronLeft, contentDescription = "이전 달", tint = Color.White.copy(alpha = 0.85f))
            }
            IconButton(onClick = onNextMonth) {
                Icon(Icons.Filled.ChevronRight, contentDescription = "다음 달", tint = Color.White.copy(alpha = 0.85f))
            }
        }

        Row(Modifier.fillMaxWidth().padding(end = SmapSpacing.md - 4.dp, bottom = 4.dp)) {
            listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { index, day ->
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        day,
                        style = SmapText.captionSmall,
                        color = when (index) {
                            0 -> CalendarSundayOnNavy
                            else -> Color.White.copy(alpha = 0.94f)
                        }
                    )
                }
            }
        }

        val rows = (firstDayOfWeek + daysInMonth + 6) / 7
        Column(Modifier.padding(end = SmapSpacing.md - 4.dp)) {
            for (row in 0 until rows) {
                Row(Modifier.fillMaxWidth()) {
                    for (col in 0 until 7) {
                        val dayNumber = row * 7 + col - firstDayOfWeek + 1
                        Box(
                            Modifier
                                .weight(1f)
                                .height(44.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (dayNumber in 1..daysInMonth) {
                                val date = currentMonth.atDay(dayNumber)
                                CalendarDay(
                                    day = dayNumber,
                                    isSunday = col == 0,
                                    isSelected = date == selectedDate,
                                    isToday = date == today,
                                    hasEvent = date in eventDates,
                                    onClick = { onDateSelect(date) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarDay(
    day: Int,
    isSunday: Boolean,
    isSelected: Boolean,
    isToday: Boolean,
    hasEvent: Boolean,
    onClick: () -> Unit
) {
    Column(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(
                when {
                    isSelected -> Color.White
                    isToday -> Color.White.copy(alpha = 0.08f)
                    else -> Color.Transparent
                }
            )
            .clickable(onClick = onClick)
            .semantics {
                selected = isSelected
                contentDescription = buildString {
                    append("${day}일")
                    if (isToday) append(", 오늘")
                    if (hasEvent) append(", 일정 있음")
                }
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            day.toString(),
            style = SmapText.body.copy(fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal),
            color = when {
                isSelected -> SmapBrush.Accent
                isToday -> Color.White
                isSunday -> CalendarSundayOnNavy
                else -> Color.White
            }
        )
        Box(
            Modifier
                .padding(top = 1.dp)
                .size(4.dp)
                .clip(CircleShape)
                .background(
                    when {
                        !hasEvent -> Color.Transparent
                        isSelected -> SmapBrush.Accent
                        else -> Color.White
                    }
                )
        )
    }
}

/** 남색 바탕 위 일요일 — 빨강을 옅게 해 남색 위에서도 읽히게 한다. */
private val CalendarSundayOnNavy = Color(0xFFFFEEDF)

// MARK: - Schedule Row

/**
 * 일정 탭 한 줄 — 모양은 공용 [SmapScheduleRow](홈 시트와 같은 줄). 여기서는 일정 모델을 값으로 풀어 넘긴다.
 * 눌러서 여는 상세 시트에 수정·삭제가 있다.
 */
@Composable
fun ScheduleRow(
    schedule: SmapSchedule,
    onClick: () -> Unit,
) {
    val status = getScheduleStatusUI(schedule)
    SmapScheduleRow(
        start = timeOf(schedule.date),
        end = timeOf(schedule.sstEdate),
        allDay = schedule.sstAllDay == "Y",
        title = schedule.displayTitle,
        memberName = schedule.validMemberName.takeIf { it.isNotBlank() },
        memberPhoto = schedule.validMemberPhoto,
        memberId = schedule.mtIdx,
        place = schedule.location?.takeIf { it.isNotBlank() },
        repeatText = if (schedule.isRecurring) (schedule.repeatDescription ?: "반복") else null,
        isDone = status == ScheduleStatusUI.COMPLETED,
        ongoingLabel = if (status == ScheduleStatusUI.ONGOING) status.label else null,
        onClick = onClick,
    )
}

/** "2026-11-13 10:00:00" / "2026-11-13T10:00" → "10:00" */
private fun timeOf(raw: String?): String? {
    val m = Regex("""[T ](\d{2}):(\d{2})""").find(raw.orEmpty()) ?: return null
    return "${m.groupValues[1]}:${m.groupValues[2]}"
}

/** 선택 날짜 구역 제목 — "11월 13일 금요일". */
fun scheduleDateTitle(date: LocalDate): String =
    date.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", java.util.Locale.KOREAN))

