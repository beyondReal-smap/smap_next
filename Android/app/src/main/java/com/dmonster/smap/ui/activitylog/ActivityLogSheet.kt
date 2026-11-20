package com.dmonster.smap.ui.activitylog

import com.dmonster.smap.ui.theme.FamilyColors
import com.dmonster.smap.ui.components.SheetHeaderMinHeight
import com.dmonster.smap.ui.components.SmapBrush
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import com.dmonster.smap.ui.components.SmapAccent
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.TextButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DirectionsWalk
import androidx.compose.material3.Icon
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

val ActivityLogSheetPeekHeight = 190.dp

/** 경로 따라가기 줄이 있을 때 접힌 시트에 더하는 높이. */
val ActivityLogRouteControlHeight = 84.dp

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
    /** 이동 점이 2개 이상 — 경로 따라가기 막대를 끌 수 있다. */
    hasRoute: Boolean,
    // 날짜 줄 아래 "경로 따라가기" 줄(접힌 상태에서도 보인다). 경로가 없는 날도 흐린 막대로 자리를 지킨다.
    routeControl: @Composable () -> Unit,
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
    val dateText = selectedDate.format(DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN))
    var choosingMember by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().background(SmapAccent.Activity.container).padding(horizontal = SmapSpacing.screenHorizontal)) {
        Row(Modifier.fillMaxWidth().heightIn(min = SheetHeaderMinHeight), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (selectedMember != null) {
                SmapAvatar(name = selectedMember.displayName, imagePath = selectedMember.mtFile1, size = 48.dp, memberId = selectedMember.mtIdx)
            } else {
                Box(Modifier.size(48.dp).background(Color.White, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.DirectionsWalk, contentDescription = null, tint = SmapAccent.Activity.deep)
                }
            }
            Column(Modifier.weight(1f)) {
                Text(dateText, style = SmapText.captionBold, color = SmapAccent.Activity.deep)
                Text(when {
                    selectedMember == null -> "하루의 발자취"
                    selectedMember.mtIdx == currentUserIdx -> "나의 발자취"
                    else -> "${selectedMember.displayName}의 발자취"
                }, style = SmapText.title, color = FamilyColors.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.semantics { heading() })
            }
            if (members.size > 1) {
                Box {
                    TextButton(onClick = { choosingMember = true }, colors = ButtonDefaults.textButtonColors(
                        containerColor = Color.White, contentColor = SmapAccent.Activity.deep)) {
                        Text("멤버 변경", style = SmapText.captionBold)
                    }
                    DropdownMenu(expanded = choosingMember, onDismissRequest = { choosingMember = false }) {
                        members.forEach { member ->
                            DropdownMenuItem(text = { Text(if (member.mtIdx == currentUserIdx) "${member.displayName} (나)" else member.displayName) },
                                onClick = { choosingMember = false; onSelectMember(member) })
                        }
                    }
                }
            }
        }
        Text(when {
            isLoadingLogs -> "기록을 불러오는 중…"
            !hasLogs -> "이날은 이동 기록이 없어요"
            summary == null -> if (hasRoute) "아래 막대로 경로를 따라가 보세요" else "위치가 한 곳에 기록됐어요"
            else -> "${summary.distanceFormatted} 이동 · ${summary.timeFormatted} · ${summary.stepsFormatted}"
        }, style = SmapText.captionBold, color = SmapAccent.Activity.deep, modifier = Modifier.padding(top = 6.dp, bottom = 10.dp))
    }
    Spacer(Modifier.height(8.dp))
    DateStrip(
        items = dateItems,
        selected = selectedDate,
        onSelect = { if (it.locked) onLockedDate(it.date) else onSelectDate(it.date) },
    )
    routeControl()
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
        if (summary != null && hasLogs) SmapSection(title = "이날의 이동") {
            Row(Modifier.fillMaxWidth().padding(vertical = SmapSpacing.md)) {
                StatCell("이동 거리", summary.distanceFormatted, Modifier.weight(1f))
                StatCell("이동 시간", summary.timeFormatted, Modifier.weight(1f))
                StatCell("걸음 수", summary.stepsFormatted, Modifier.weight(1f))
            }
        }
        SmapSection(title = "기록을 볼 멤버") {
            members.forEachIndexed { i, m ->
                if (i > 0) SmapRowDivider()
                val days = activeDatesOf(activityStats[m.mtIdx].orEmpty()).count { !it.isBefore(today.minusDays(13)) }
                SmapListRow(
                    title = if (m.mtIdx == currentUserIdx) "${m.displayName} (나)" else m.displayName,
                    subtitle = if (days > 0) "최근 2주 중 ${days}일 기록" else "최근 2주 기록 없음",
                    leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1, memberId = m.mtIdx) },
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
    /** false 면 경로가 없는 날 — 흐리게 두고 끌 수 없다(자리만 지킨다). */
    enabled: Boolean = true,
) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val dragging by interaction.collectIsDraggedAsState()
    androidx.compose.runtime.LaunchedEffect(dragging) { onDraggingChange(dragging) }

    Column(
        Modifier
            .fillMaxWidth()
            .height(ActivityLogRouteControlHeight)
            .alpha(if (enabled) 1f else 0.4f)
            // 남색 띠 바로 아래 "경로 따라가기" 글자가 띠에 붙어 보였다(대표님 피드백) — 위 여백을 12dp 두고 위에서부터 쌓는다.
            .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.screenHorizontal, top = 12.dp),
        verticalArrangement = Arrangement.Top,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("경로 따라가기", style = SmapText.captionBold, color = colors.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(currentTime ?: "--:--", style = SmapText.bodyBold, color = colors.primary)
        }
        androidx.compose.material3.Slider(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
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
                .semantics {
                    contentDescription = if (enabled) "경로 따라가기, 현재 ${currentTime ?: "알 수 없음"}" else "경로 따라가기, 이날은 따라갈 경로가 없음"
                },
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
            .background(SmapBrush.accent, CircleShape)
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
                .background(SmapBrush.accentBand)
        )
    }
}
