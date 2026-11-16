package com.dmonster.smap.ui.activitylog

import com.dmonster.smap.ui.components.SheetHeaderBandGap
import com.dmonster.smap.ui.components.SheetHeaderMinHeight
import com.dmonster.smap.ui.components.SmapBrush
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import com.dmonster.smap.ui.components.sheetHeaderBand
import com.dmonster.smap.ui.components.SmapOnNavyMuted
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.background
import androidx.compose.foundation.systemGestureExclusion
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.interaction.collectIsDraggedAsState
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

val ActivityLogSheetPeekHeight = 180.dp

/** 경로 따라가기 줄이 있을 때 접힌 시트에 더하는 높이. */
val ActivityLogRouteControlHeight = 76.dp

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
    // 이동 경로가 있을 때만 머리 줄 아래에 놓는 "경로 따라가기" 줄(접힌 상태에서도 보인다).
    routeControl: (@Composable () -> Unit)? = null,
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
            .sheetHeaderBand()
            .heightIn(min = SheetHeaderMinHeight)
            .padding(horizontal = SmapSpacing.screenHorizontal),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "$name · $dateText",
                style = SmapText.headline,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                when {
                    isLoadingLogs -> "기록을 불러오는 중…"
                    // 지도 가운데 큰 카드 대신 여기서 알린다(카드는 펼친 시트를 가렸다).
                    !hasLogs -> "이 날은 이동 기록이 없어요 · 다른 날을 골라 보세요"
                    summary == null -> "이동 기록이 있어요 · 아래 막대로 따라가 보세요"
                    else -> "${summary.distanceFormatted} 이동 · ${summary.timeFormatted} · ${summary.stepsFormatted}"
                },
                style = SmapText.caption,
                color = SmapOnNavyMuted,
                maxLines = 1,
            )
        }
    }
    if (routeControl != null) routeControl()
    // 경로 막대가 있으면 막대 자체가 띠 아래 여백 역할을 한다.
    Spacer(Modifier.height(if (routeControl != null) SmapSpacing.sm else SheetHeaderBandGap))
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

/**
 * 경로 따라가기 — 막대를 밀면 지도 위 표시가 그 시각 위치로 움직인다.
 * 이전에는 접힌 시트 위에 떠 있는 작은 카드라 시트를 올리면 가려졌다. 이제 시트 머리 줄 아래에 늘 보인다.
 * 값 범위 0~100(기존 지도 연동 계약 유지).
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun RouteScrubber(
    value: Float,
    currentTime: String?,
    startTime: String?,
    endTime: String?,
    onValueChange: (Float) -> Unit,
    onDraggingChange: (Boolean) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val dragging by interaction.collectIsDraggedAsState()
    androidx.compose.runtime.LaunchedEffect(dragging) { onDraggingChange(dragging) }

    Column(
        Modifier
            .fillMaxWidth()
            .height(ActivityLogRouteControlHeight)
            .padding(horizontal = SmapSpacing.screenHorizontal),
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("경로 따라가기", style = SmapText.captionBold, color = colors.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(currentTime ?: "--:--", style = SmapText.bodyBold, color = colors.primary)
        }
        androidx.compose.material3.Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = 0f..100f,
            interactionSource = interaction,
            // 기본 손잡이(가는 세로 막대 + 흰 틈)는 맨 왼쪽에 있을 때 채워진 막대가 없어 무엇인지 구분이 안 됐다.
            // 흰 테두리 남색 원 손잡이 + 지나온 구간 남색 채움으로 바꿔 시작 위치에서도 손잡이가 분명히 보이게 한다.
            thumb = { RouteThumb(dragging) },
            track = { state ->
                val span = state.valueRange.endInclusive - state.valueRange.start
                val fraction = if (span > 0f) ((state.value - state.valueRange.start) / span).coerceIn(0f, 1f) else 0f
                RouteTrack(fraction)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(32.dp)
                // 맨 처음 위치의 손잡이가 화면 왼쪽 가장자리(제스처 내비게이션의 "뒤로" 영역)에 걸려,
                // 손잡이를 잡고 끌면 막대 대신 뒤로 가기가 실행됐다. 막대 영역만 시스템 제스처에서 뺀다.
                .systemGestureExclusion()
                .semantics { contentDescription = "경로 따라가기, 현재 ${currentTime ?: "알 수 없음"}" },
        )
        Row {
            Text(startTime ?: "", style = SmapText.captionSmall, color = colors.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(endTime ?: "", style = SmapText.captionSmall, color = colors.onSurfaceVariant)
        }
    }
}

/** 경로 막대 손잡이 — 흰 테두리 남색 원. 끄는 중에는 조금 커져 잡혀 있다는 것이 보인다. */
@Composable
private fun RouteThumb(dragging: Boolean) {
    val size = if (dragging) 26.dp else 22.dp
    Box(
        Modifier
            .size(size)
            .shadow(3.dp, CircleShape)
            .background(Color.White, CircleShape)
            .padding(3.dp)
            .background(SmapBrush.navy, CircleShape)
    )
}

/** 경로 막대 — 연한 남색 바탕 위에 지나온 구간([fraction])만 남색으로 채운다. */
@Composable
private fun RouteTrack(fraction: Float) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
    ) {
        Box(
            Modifier
                .fillMaxWidth(fraction)
                .fillMaxHeight()
                .background(SmapBrush.navyBand)
        )
    }
}
