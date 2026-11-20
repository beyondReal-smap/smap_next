package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.theme.FamilyColors
import androidx.compose.material.icons.outlined.Map
import com.dmonster.smap.ui.components.SheetBandButton
import com.dmonster.smap.ui.components.SmapAccent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import com.dmonster.smap.ui.components.SmapAccentTheme
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.data.model.ScheduleStatus
import com.dmonster.smap.ui.components.DateChipItem
import com.dmonster.smap.ui.components.DateStrip
import com.dmonster.smap.ui.components.MemberStrip
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapScheduleRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.TimeZone

val HomeSheetPeekHeight = 228.dp

@Composable
fun ColumnScope.HomeSheetContent(
    members: List<SmapGroupMember>,
    selectedMemberId: Int?,
    currentUserIdx: Int?,
    calendarDays: List<Pair<String, String>>,
    selectedDate: String,
    schedules: List<SmapSchedule>,
    memberStats: (Int) -> MemberStats,
    isExpanded: Boolean,
    expansionProgress: () -> Float,
    onToggleSchedule: () -> Unit,
    onSelectMember: (SmapGroupMember) -> Unit,
    onShowAll: () -> Unit,
    onSelectDate: (String) -> Unit,
    /** 장소가 저장된 일정을 누르면 지도를 그 장소로 옮긴다 */
    onSelectSchedule: (SmapSchedule) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val selected = members.firstOrNull { it.mtIdx == selectedMemberId }
    val daySchedules = remember(schedules) { schedules.sortedBy { it.date } }

    val date = remember(selectedDate) { runCatching { LocalDate.parse(selectedDate) }.getOrNull() }
    val day = if (date == LocalDate.now()) "오늘" else "이날"
    val featured = daySchedules.firstOrNull { it.status != ScheduleStatus.COMPLETED } ?: daySchedules.lastOrNull()

    Column(Modifier.fillMaxWidth().background(FamilyColors.Paper)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = SmapSpacing.lg),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (date != null) {
                Column(
                    Modifier.size(46.dp, 48.dp).clip(RoundedCornerShape(10.dp)).background(Color.White)
                        .border(1.dp, FamilyColors.Ink.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(Modifier.fillMaxWidth().background(FamilyColors.Highlight), contentAlignment = Alignment.Center) {
                        Text("${date.monthValue}월", style = SmapText.captionBold.copy(fontSize = 11.sp, lineHeight = 14.sp), color = FamilyColors.Ink)
                    }
                    Text("${date.dayOfMonth}", style = SmapText.title, color = FamilyColors.Ink)
                }
            }
            Column(Modifier.weight(1f)) {
                val title = when {
                    selected == null -> "우리의 하루"
                    selected.mtIdx == currentUserIdx -> "나의 하루"
                    else -> "${selected.displayName}의 하루"
                }
                Text(title, style = SmapText.title, color = FamilyColors.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.semantics { heading() })
                val status = when {
                    selected != null -> memberStatusLine(selected) ?: "아직 위치 정보가 없어요"
                    members.isEmpty() -> "함께할 멤버가 아직 없어요"
                    else -> listOfNotNull(date?.dayOfWeek?.getDisplayName(java.time.format.TextStyle.FULL, Locale.KOREAN),
                        "함께하는 ${members.size}명").joinToString(" · ")
                }
                Text(status, style = SmapText.captionSmall, color = FamilyColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (selected != null) {
                SmapAccentTheme(SmapAccent.Family) {
                    SheetBandButton(text = "전체 보기", icon = Icons.Outlined.Map, onClick = onShowAll)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        SmapAccentTheme(SmapAccent.Family) {
            MemberStrip(
                members = members, selectedMemberId = selectedMemberId, currentUserIdx = currentUserIdx,
                onSelect = onSelectMember, onAllClick = onShowAll,
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 14.dp)
                .clip(RoundedCornerShape(16.dp)).background(FamilyColors.Ink)
                .clickable(role = Role.Button, onClickLabel = if (isExpanded) "일정 목록 접기" else "일정 목록 펼치기", onClick = onToggleSchedule)
                .heightIn(min = 64.dp).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.width(66.dp), contentAlignment = Alignment.Center) {
                if (featured != null) Text(scheduleTime(featured), style = SmapText.title, color = FamilyColors.Highlight)
                else Icon(Icons.Outlined.EventAvailable, contentDescription = null, tint = FamilyColors.Highlight)
            }
            Spacer(Modifier.width(1.dp).height(31.dp).background(Color.White.copy(alpha = 0.26f)))
            Column(Modifier.weight(1f)) {
                Text(if (schedules.isEmpty()) "${day}의 일정" else "${day}의 일정 · ${schedules.size}개",
                    style = SmapText.captionSmall, color = Color.White.copy(alpha = 0.8f))
                Text(featured?.displayTitle ?: "잡힌 약속이 없어요", style = SmapText.subheadline, color = Color.White,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(
                Icons.Filled.KeyboardArrowUp,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(20.dp).graphicsLayer { rotationZ = 180f * expansionProgress() },
            )
        }
    }

    // 펼친 영역 — 회색 바탕 위 묶음들
    Column(
        Modifier
            .fillMaxWidth()
            .weight(1f, fill = false)
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = SmapSpacing.md, vertical = SmapSpacing.md),
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
    ) {
        val dateItems = calendarDays.mapNotNull { (d, _) ->
            runCatching { DateChipItem(LocalDate.parse(d)) }.getOrNull()
        }
        if (dateItems.isNotEmpty() && date != null) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = SmapSpacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        if (date == LocalDate.now()) "오늘의 일정" else "이날의 일정",
                        style = SmapText.headline,
                        color = colors.onSurface,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        date.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)),
                        style = SmapText.caption,
                        color = colors.onSurfaceVariant,
                    )
                }
                DateStrip(
                    items = dateItems,
                    selected = date,
                    onSelect = { onSelectDate(it.date.toString()) },
                    modifier = Modifier.padding(bottom = SmapSpacing.sm),
                )
                SmapSection {
                    if (schedules.isEmpty()) {
                        SmapListRow(
                            title = "아직 잡힌 일정이 없어요",
                            subtitle = "일정 탭에서 함께할 약속을 추가해요",
                            leading = { SmapRowIcon(Icons.Outlined.EventAvailable) },
                        )
                    } else {
                        daySchedules.forEachIndexed { i, s ->
                            if (i > 0) SmapRowDivider()
                            // 일정 탭과 같은 줄(시각·막대 / 제목 / 멤버·반복 / 장소). 색은 일정 강조색.
                            // 멤버는 전체 보기일 때만 — 한 멤버만 볼 때는 모두 같은 사람이다.
                            // 그룹 일정 응답엔 멤버 이름이 없어(이전엔 모두 "나"로 보일 수 있었다) 일정 주인으로 멤버 목록에서 찾는다.
                            val owner = if (selected == null) members.firstOrNull { it.mtIdx == (s.mtIdx ?: s.mtScheduleIdx) } else null
                            SmapAccentTheme(SmapAccent.Schedule) {
                                SmapScheduleRow(
                                    start = markerClock(s.date),
                                    end = markerClock(s.sstEdate),
                                    allDay = s.sstAllDay == "Y",
                                    title = s.displayTitle,
                                    memberName = owner?.displayName,
                                    memberPhoto = owner?.mtFile1,
                                    memberId = owner?.mtIdx,
                                    place = s.location?.takeIf { it.isNotBlank() },
                                    repeatText = if (s.isRecurring) (s.repeatDescription ?: "반복") else null,
                                    isDone = s.status == ScheduleStatus.COMPLETED,
                                    ongoingLabel = if (s.status == ScheduleStatus.ONGOING) s.status.text else null,
                                    // 장소가 있는 일정만 누를 수 있다 — 장소 없는 일정은 옮겨 갈 곳이 없으니 누름 표시도 하지 않는다.
                                    onClick = if (s.mapLatLng != null) ({ onSelectSchedule(s) }) else null,
                                )
                            }
                        }
                    }
                }
            }
        }
        SmapSection(title = "함께하는 멤버") {
            members.forEachIndexed { i, m ->
                if (i > 0) SmapRowDivider()
                val stats = memberStats(m.mtIdx)
                val todayCount = stats.completed + stats.ongoing + stats.upcoming
                SmapListRow(
                    title = if (m.mtIdx == currentUserIdx) "${m.displayName} (나)" else m.displayName,
                    subtitle = memberStatusLine(m) ?: "위치 정보 없음",
                    leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1, memberId = m.mtIdx) },
                    trailing = if (todayCount > 0) {
                        { CountPill("일정 $todayCount") }
                    } else null,
                    selected = m.mtIdx == selectedMemberId,
                    onClick = { onSelectMember(m) },
                )
            }
        }
        Spacer(Modifier.height(SmapSpacing.lg))
    }
}

@Composable
private fun CountPill(text: String) {
    Text(
        text,
        style = SmapText.captionBold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
internal fun TimeBadge(text: String) {
    Box(
        Modifier.width(52.dp).heightIn(min = 28.dp)
            .background(SmapAccent.Schedule.container, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SmapText.captionBold, color = SmapAccent.Schedule.deep)
    }
}

/** "16:46 갱신 · 배터리 80%" — 값이 없는 항목은 빼고, 모두 없으면 null. */
internal fun memberStatusLine(m: SmapGroupMember): String? {
    val parts = buildList {
        formatGpsTime(m.mltGpsTime)?.let { add("$it 갱신") }
        m.mltBattery?.takeIf { it >= 0 }?.let { add("배터리 $it%") }
        // 서버 값은 m/s — km/h 로 바꿔 보여 준다(iOS 와 같게)
        m.mltSpeed?.let { it * 3.6 }?.takeIf { it >= 1.0 }?.let { add("${String.format(Locale.US, "%.0f", it)}km/h 이동 중") }
    }
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

/**
 * 서버 GPS 시각을 "HH:mm"(오늘) 또는 "M/d HH:mm" 으로.
 * 서버는 시간대 표시 없이 한국 시각을 보낸다 — 끝에 Z 가 있을 때만 UTC 로 읽는다.
 * (이전 말풍선은 항상 UTC 로 읽어 9시간 뒤 시각이 보였다.)
 */
internal fun formatGpsTime(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    return try {
        val isUtc = raw.endsWith("Z")
        val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.KOREA).apply {
            timeZone = if (isUtc) TimeZone.getTimeZone("UTC") else TimeZone.getDefault()
        }
        val date = input.parse(raw.removeSuffix("Z").replace(" ", "T").split(".")[0]) ?: return null
        val sameDay = SimpleDateFormat("yyyyMMdd", Locale.KOREA).let { it.format(date) == it.format(java.util.Date()) }
        SimpleDateFormat(if (sameDay) "HH:mm" else "M/d HH:mm", Locale.KOREA).format(date)
    } catch (e: java.text.ParseException) {
        null
    }
}

/** 일정 시작 시각 "HH:mm", 하루 종일이면 "종일". */
private fun scheduleTime(s: SmapSchedule): String {
    if (s.sstAllDay == "Y") return "종일"
    val m = Regex("""[T ](\d{2}):(\d{2})""").find(s.date.orEmpty()) ?: return "-"
    return "${m.groupValues[1]}:${m.groupValues[2]}"
}
