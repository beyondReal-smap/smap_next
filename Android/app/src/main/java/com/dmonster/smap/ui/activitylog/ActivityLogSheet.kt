package com.dmonster.smap.ui.activitylog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.DailyCount
import com.dmonster.smap.data.model.LocationSummary
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SubscriptionStatusResponse
import com.dmonster.smap.data.service.SubscriptionPolicy
import com.dmonster.smap.ui.components.DateChipItem
import com.dmonster.smap.ui.components.DateStrip
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

val ActivityLogSheetPeekHeight = 174.dp

/**
 * 활동 로그 지도 시트 — 사이드바("로그 조회")와 지도 위 요약 카드를 대신한다.
 *
 * 접힌 상태: "멤버 · 날짜" + 요약 한 줄(거리·시간·걸음) + 14일 날짜 줄(기록 있는 날 점, 구독 필요한 날 자물쇠).
 * 펼친 상태: 요약 3칸, 멤버 목록(최근 14일 중 기록한 날 수).
 */
@Composable
fun ColumnScope.ActivityLogSheetContent(
    members: List<SmapGroupMember>,
    selectedMember: SmapGroupMember?,
    currentUserIdx: Int?,
    selectedDate: LocalDate,
    summary: LocationSummary?,
    hasLogs: Boolean,
    isLoadingLogs: Boolean,
    activityStats: Map<Int, List<DailyCount>>,
    subscriptionStatus: SubscriptionStatusResponse?,
    onSelectMember: (SmapGroupMember) -> Unit,
    onSelectDate: (LocalDate) -> Unit,
    onLockedDate: (LocalDate) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val today = remember(System.currentTimeMillis() / 86_400_000) { LocalDate.now() }
    val activeDates = remember(selectedMember?.mtIdx, activityStats) {
        activeDatesOf(activityStats[selectedMember?.mtIdx].orEmpty())
    }
    val dateItems = remember(today, activeDates, subscriptionStatus) {
        (13 downTo 0).map { today.minusDays(it.toLong()) }.map { d ->
            DateChipItem(d, dot = d in activeDates, locked = SubscriptionPolicy.isActivityDateLocked(d, today, subscriptionStatus))
        }
    }
    val name = selectedMember?.let { if (it.mtIdx == currentUserIdx) "나" else it.displayName } ?: "멤버"
    val dateText = selectedDate.format(DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN))

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .padding(horizontal = SmapSpacing.screenHorizontal),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "$name · $dateText",
                style = SmapText.headline,
                color = colors.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                when {
                    isLoadingLogs -> "기록을 불러오는 중…"
                    // 지도 가운데 큰 카드 대신 여기서 알린다(카드는 펼친 시트를 가렸다).
                    !hasLogs || summary == null -> "이 날은 이동 기록이 없어요 · 다른 날을 골라 보세요"
                    else -> "${summary.distanceFormatted} 이동 · ${summary.timeFormatted} · ${summary.stepsFormatted}"
                },
                style = SmapText.caption,
                color = colors.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
    Spacer(Modifier.height(SmapSpacing.sm))
    DateStrip(
        items = dateItems,
        selected = selectedDate,
        onSelect = { if (it.locked) onLockedDate(it.date) else onSelectDate(it.date) },
    )
    Spacer(Modifier.height(SmapSpacing.md))

    Column(
        Modifier
            .fillMaxWidth()
            .weight(1f, fill = false)
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(SmapSpacing.md),
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
    ) {
        SmapSection(title = "요약") {
            Row(Modifier.fillMaxWidth().padding(vertical = SmapSpacing.md)) {
                StatCell("이동 거리", summary?.distanceFormatted ?: "0 m", Modifier.weight(1f))
                StatCell("이동 시간", summary?.timeFormatted ?: "0분", Modifier.weight(1f))
                StatCell("걸음 수", summary?.stepsFormatted ?: "0", Modifier.weight(1f))
            }
        }
        SmapSection(title = "멤버") {
            members.forEachIndexed { i, m ->
                if (i > 0) SmapRowDivider()
                val days = activeDatesOf(activityStats[m.mtIdx].orEmpty()).count { !it.isBefore(today.minusDays(13)) }
                SmapListRow(
                    title = if (m.mtIdx == currentUserIdx) "${m.displayName} (나)" else m.displayName,
                    subtitle = if (days > 0) "최근 2주 중 ${days}일 기록" else "최근 2주 기록 없음",
                    leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1) },
                    selected = m.mtIdx == selectedMember?.mtIdx,
                    onClick = { onSelectMember(m) },
                )
            }
        }
        Spacer(Modifier.height(SmapSpacing.lg))
    }
}

@Composable
private fun StatCell(label: String, value: String, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier.semantics(mergeDescendants = true) { contentDescription = "$label $value" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = SmapText.headline, color = colors.onSurface, maxLines = 1)
        Text(label, style = SmapText.captionSmall, color = colors.onSurfaceVariant)
    }
}

/** 서버 일별 기록 수에서 기록이 있는 날짜만 뽑는다("yyyy-MM-dd" 또는 "yyyy-MM-dd HH:mm:ss"). */
private fun activeDatesOf(counts: List<DailyCount>): Set<LocalDate> =
    counts.filter { (it.count ?: 0) > 0 }.mapNotNull { c ->
        c.date?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    }.toSet()
