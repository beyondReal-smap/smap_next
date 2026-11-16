package com.dmonster.smap.ui.home

import com.dmonster.smap.ui.components.SheetHeaderBandGap
import com.dmonster.smap.ui.components.SheetHeaderMinHeight
import com.dmonster.smap.ui.components.sheetHeaderBand
import com.dmonster.smap.ui.components.SmapOnNavyMuted
import androidx.compose.ui.graphics.Color
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.ui.components.DateChipItem
import com.dmonster.smap.ui.components.DateStrip
import com.dmonster.smap.ui.components.MemberStrip
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapListRow
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

/** 접힌 시트 높이: 손잡이 + 머리 줄 + 멤버 얼굴 줄 */
val HomeSheetPeekHeight = 178.dp

/**
 * 홈 지도 시트 — 사이드바("멤버 조회")와 지도 위 말풍선을 대신한다.
 *
 * 접힌 상태: 머리 줄(선택한 멤버의 상태 또는 "멤버 N명") + 얼굴 줄.
 * 펼친 상태: 멤버 목록(위치 갱신·배터리·오늘 일정 수) → 날짜 줄 → 그날 일정.
 */
@Composable
fun ColumnScope.HomeSheetContent(
    members: List<SmapGroupMember>,
    selectedMemberId: Int?,
    currentUserIdx: Int?,
    calendarDays: List<Pair<String, String>>,
    selectedDate: String,
    schedules: List<SmapSchedule>,
    memberStats: (Int) -> MemberStats,
    onSelectMember: (SmapGroupMember) -> Unit,
    onShowAll: () -> Unit,
    onSelectDate: (String) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val selected = members.firstOrNull { it.mtIdx == selectedMemberId }

    // 머리 줄
    Row(
        Modifier
            .sheetHeaderBand()
            .heightIn(min = SheetHeaderMinHeight)
            .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            if (selected != null) {
                Text(
                    if (selected.mtIdx == currentUserIdx) "${selected.displayName} (나)" else selected.displayName,
                    style = SmapText.headline,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    memberStatusLine(selected) ?: "아직 위치 정보가 없어요",
                    style = SmapText.caption,
                    color = SmapOnNavyMuted,
                    maxLines = 1,
                )
            } else {
                Text(
                    "멤버 ${members.size}명",
                    style = SmapText.headline,
                    color = Color.White,
                    modifier = Modifier.semantics { heading() },
                )
                Text("얼굴을 누르면 그 멤버 위치로 이동해요", style = SmapText.caption, color = SmapOnNavyMuted)
            }
        }
        if (selected != null) {
            TextButton(onClick = onShowAll) { Text("전체 보기", style = SmapText.captionBold, color = Color.White) }
        }
    }

    Spacer(Modifier.height(SheetHeaderBandGap))
    MemberStrip(
        members = members,
        selectedMemberId = selectedMemberId,
        currentUserIdx = currentUserIdx,
        onSelect = onSelectMember,
        onAllClick = onShowAll,
    )
    Spacer(Modifier.height(SmapSpacing.md))

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
        SmapSection(title = "멤버") {
            members.forEachIndexed { i, m ->
                if (i > 0) SmapRowDivider()
                val stats = memberStats(m.mtIdx)
                val todayCount = stats.completed + stats.ongoing + stats.upcoming
                SmapListRow(
                    title = if (m.mtIdx == currentUserIdx) "${m.displayName} (나)" else m.displayName,
                    subtitle = memberStatusLine(m) ?: "위치 정보 없음",
                    leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1) },
                    trailing = if (todayCount > 0) {
                        { CountPill("일정 $todayCount") }
                    } else null,
                    selected = m.mtIdx == selectedMemberId,
                    onClick = { onSelectMember(m) },
                )
            }
        }

        val dateItems = calendarDays.mapNotNull { (d, _) ->
            runCatching { DateChipItem(LocalDate.parse(d)) }.getOrNull()
        }
        val selectedLocal = runCatching { LocalDate.parse(selectedDate) }.getOrNull()
        if (dateItems.isNotEmpty() && selectedLocal != null) {
            Column {
                Text(
                    selectedLocal.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)) + " 일정",
                    style = SmapText.captionBold,
                    color = colors.onSurfaceVariant,
                    modifier = Modifier
                        .padding(start = 4.dp, bottom = SmapSpacing.sm)
                        .semantics { heading() },
                )
                DateStrip(
                    items = dateItems,
                    selected = selectedLocal,
                    onSelect = { onSelectDate(it.date.toString()) },
                    modifier = Modifier.padding(bottom = SmapSpacing.sm),
                )
                SmapSection {
                    if (schedules.isEmpty()) {
                        SmapListRow(
                            title = "일정이 없어요",
                            subtitle = "일정 탭에서 추가할 수 있어요",
                            leading = { SmapRowIcon(Icons.Outlined.EventAvailable) },
                        )
                    } else {
                        schedules.forEachIndexed { i, s ->
                            if (i > 0) SmapRowDivider()
                            SmapListRow(
                                title = s.displayTitle,
                                subtitle = listOfNotNull(s.validMemberName, s.location?.takeIf { it.isNotBlank() }).joinToString(" · "),
                                leading = { TimeBadge(scheduleTime(s)) },
                            )
                        }
                    }
                }
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
private fun TimeBadge(text: String) {
    Box(Modifier.width(52.dp), contentAlignment = Alignment.CenterStart) {
        Text(text, style = SmapText.captionBold, color = MaterialTheme.colorScheme.primary)
    }
}

/** "16:46 갱신 · 배터리 80%" — 값이 없는 항목은 빼고, 모두 없으면 null. */
internal fun memberStatusLine(m: SmapGroupMember): String? {
    val parts = buildList {
        formatGpsTime(m.mltGpsTime)?.let { add("$it 갱신") }
        m.mltBattery?.takeIf { it >= 0 }?.let { add("배터리 $it%") }
        m.mltSpeed?.takeIf { it >= 1.0 }?.let { add("${String.format(Locale.US, "%.0f", it)}km/h 이동 중") }
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
