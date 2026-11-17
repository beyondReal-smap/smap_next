package com.dmonster.smap.ui.components

import com.dmonster.smap.ui.theme.SmapText
import androidx.compose.animation.core.exponentialDecay
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.AnchoredDraggableState
import androidx.compose.foundation.gestures.DragScope
import androidx.compose.foundation.gestures.DraggableAnchors
import androidx.compose.foundation.gestures.DraggableState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.animateTo
import androidx.compose.foundation.gestures.animateToWithDecay
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/** 지도 시트의 두 자리 — 접힘(peek)·펼침. */
enum class SmapSheetValue { Collapsed, Expanded }

/**
 * 지도 시트 상태.
 *
 * 2026-11-17: Material3 BottomSheetScaffold(1.3.1)는 "천천히 56dp 이상 끌거나 초당 125dp 이상으로 놓아야" 넘어가고
 * 그보다 덜 끌면 제자리로 튕겨 돌아갔다(값을 바꿀 수 없음). 그래서 조금 올리다 놓으면 "버벅이며 안 올라가는" 일이 잦았다.
 * 여기서는 놓는 순간 방향을 정하면 그 끝까지 간다 — iOS SMAPMapSheet 와 같은 규칙.
 *  1) 놓을 때 뚜렷하게 튕겼으면(초당 [FlingVelocity] 이상) 그 방향
 *  2) 아니면 손가락이 움직인 방향([DirectionSlop] 이상)
 *  3) 거의 안 움직였으면 가까운 자리
 */
@OptIn(ExperimentalFoundationApi::class)
@Stable
class SmapMapSheetState internal constructor(
    initialValue: SmapSheetValue,
    density: Density,
) {
    private val flingPx = with(density) { FlingVelocity.toPx() }
    private val slopPx = with(density) { DirectionSlop.toPx() }

    internal val anchored = AnchoredDraggableState(
        initialValue = initialValue,
        // 놓은 뒤의 목적지는 [settle] 이 직접 정한다. 아래 두 값은 라이브러리 기본 동작(쓰지 않음)용.
        positionalThreshold = { distance -> distance / 2f },
        velocityThreshold = { flingPx },
        snapAnimationSpec = spring(dampingRatio = 1f, stiffness = 400f), // 튕김 없이(펼친 시트 아래로 지도가 비치지 않게)
        decayAnimationSpec = exponentialDecay(),
    )

    val currentValue: SmapSheetValue get() = anchored.currentValue

    suspend fun expand() = anchored.animateTo(SmapSheetValue.Expanded)

    suspend fun partialExpand() = anchored.animateTo(SmapSheetValue.Collapsed)

    internal suspend fun toggle() =
        if (anchored.targetValue == SmapSheetValue.Expanded) partialExpand() else expand()

    /** 이번 끌기를 시작한 위치 — 놓을 때 방향을 정하는 기준. 끌기가 끝나면 NaN. */
    private var dragStartOffset = Float.NaN

    private fun markDragStart() {
        if (dragStartOffset.isNaN()) dragStartOffset = anchored.offset
    }

    /** 접힘·펼침 위치(위쪽 y). 크기나 peek 가 바뀔 때만 갱신한다. */
    internal fun updateAnchors(expandedY: Float, collapsedY: Float) {
        val current = anchored.anchors
        if (current.positionOf(SmapSheetValue.Expanded) == expandedY &&
            current.positionOf(SmapSheetValue.Collapsed) == collapsedY
        ) return
        anchored.updateAnchors(
            DraggableAnchors {
                SmapSheetValue.Expanded at expandedY
                SmapSheetValue.Collapsed at collapsedY
            },
            anchored.targetValue,
        )
    }

    /** 시트 위쪽 y. 첫 측정 전에는 [fallback](접힌 자리). */
    internal fun offsetOr(fallback: Float): Float = anchored.offset.let { if (it.isNaN()) fallback else it }

    /** 손을 뗀 순간 목적지를 정하고 끝까지 움직인다. [velocity] 는 아래쪽이 +(px/s). */
    internal suspend fun settle(velocity: Float) {
        val offset = anchored.offset
        if (offset.isNaN()) return
        val start = if (dragStartOffset.isNaN()) offset else dragStartOffset
        dragStartOffset = Float.NaN
        val moved = offset - start
        val target = when {
            velocity <= -flingPx -> SmapSheetValue.Expanded
            velocity >= flingPx -> SmapSheetValue.Collapsed
            moved <= -slopPx -> SmapSheetValue.Expanded
            moved >= slopPx -> SmapSheetValue.Collapsed
            else -> anchored.anchors.closestAnchor(offset) ?: anchored.currentValue
        }
        anchored.animateToWithDecay(target, velocity)
    }

    /**
     * 손잡이·머리 띠 등 스크롤 없는 곳을 끌 때. 끄는 동안은 [AnchoredDraggableState.anchoredDrag] 안에서 움직여
     * 진행 중인 펼침·접힘 애니메이션을 끊고 손가락을 바로 따라간다.
     */
    internal val draggableState = object : DraggableState {
        override fun dispatchRawDelta(delta: Float) {
            anchored.dispatchRawDelta(delta)
        }

        override suspend fun drag(dragPriority: MutatePriority, block: suspend DragScope.() -> Unit) {
            anchored.anchoredDrag(dragPriority) { anchors ->
                val scope = object : DragScope {
                    override fun dragBy(pixels: Float) {
                        val next = (anchored.offset + pixels).coerceIn(anchors.minAnchor(), anchors.maxAnchor())
                        dragTo(next)
                    }
                }
                scope.block()
            }
        }
    }

    internal fun onDragStarted() = markDragStart()

    /**
     * 시트 안 목록(스크롤)을 끌 때. 위로 끌면 시트가 먼저 끝까지 올라가고, 목록 맨 위에서 아래로 끌면 시트가 내려간다.
     * 목록만 스크롤하다 놓은 경우(시트는 그대로)에는 시트를 건드리지 않는다 — 목록을 세게 내려 맨 위에 닿았다고 시트가 접히지 않게.
     */
    internal val nestedScrollConnection = object : NestedScrollConnection {
        override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
            val dy = available.y
            if (dy >= 0f || source != NestedScrollSource.UserInput) return Offset.Zero
            val used = anchored.dispatchRawDelta(dy)
            if (used != 0f) markDragStart()
            return Offset(0f, used)
        }

        override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
            if (source != NestedScrollSource.UserInput) return Offset.Zero
            val used = anchored.dispatchRawDelta(available.y)
            if (used != 0f) markDragStart()
            return Offset(0f, used)
        }

        override suspend fun onPreFling(available: Velocity): Velocity {
            if (dragStartOffset.isNaN()) return Velocity.Zero
            // 시트가 이미 끝까지 올라간 뒤 계속 위로 튕기면 그 힘은 목록 스크롤에 쓴다.
            val atTop = anchored.offset <= anchored.anchors.minAnchor()
            if (available.y < 0f && atTop) {
                dragStartOffset = Float.NaN
                return Velocity.Zero
            }
            settle(available.y)
            return available
        }

        override suspend fun onPostFling(consumed: Velocity, available: Velocity): Velocity {
            if (dragStartOffset.isNaN()) return Velocity.Zero
            settle(available.y)
            return available
        }
    }

    private companion object {
        /** 이보다 빠르게 튕기면 움직인 거리와 상관없이 튕긴 방향으로 */
        val FlingVelocity = 300.dp
        /** 이만큼만 움직여도 그 방향으로 끝까지 */
        val DirectionSlop = 4.dp
    }
}

@Composable
fun rememberSmapMapSheetState(initialValue: SmapSheetValue = SmapSheetValue.Collapsed): SmapMapSheetState {
    val density = LocalDensity.current
    return remember(density) { SmapMapSheetState(initialValue, density) }
}

/**
 * 지도 탭(홈·내장소·활동 로그) 공용 골격 — 지도는 화면 전체, 조작은 아래에서 끌어올리는 시트 하나.
 *
 * 이전에는 탭마다 모양이 다른 왼쪽 사이드바를 떠 있는 버튼으로 열어야 멤버를 고를 수 있었고, 열면 지도가 가려졌다.
 * 시트는 접힌 상태([peekHeight])에서도 핵심(멤버 얼굴 줄 등)이 보이고, 끌어올리면 목록이 펼쳐진다.
 * 끄는 방식은 [SmapMapSheetState] 참고(방향이 정해지면 끝까지).
 *
 * - [overlay]: 지도 위에 떠 있는 조작(그룹 전환 알약, 원형 버튼). 상태 표시줄 아래에 놓인다.
 * - 시트를 끝까지 올려도 [overlay] 줄은 가리지 않도록 최대 높이를 제한한다.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SmapMapSheetScaffold(
    peekHeight: Dp,
    sheetContent: @Composable ColumnScope.() -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SmapMapSheetState = rememberSmapMapSheetState(),
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
    overlay: @Composable BoxScope.() -> Unit = {},
    maxHeightFraction: Float = 0.55f,
    map: @Composable BoxScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    BoxWithConstraints(
        modifier
            .fillMaxSize()
            .clipToBounds() // 접힌 시트의 화면 밖 부분이 아래 탭바 위에 그려지지 않게
            .background(colors.background)
    ) {
        val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        // 끝까지 올려도 화면의 [maxHeightFraction] 까지만 — 지도의 절반가량은 늘 보이게 한다.
        // (이전에는 위쪽 조작 줄만 남기고 지도를 거의 다 가렸다.) 내용이 더 길면 시트 안에서 스크롤된다.
        val sheetMaxHeight = minOf(maxHeight * maxHeightFraction, maxHeight - topInset - 76.dp)
        val layoutHeightPx = constraints.maxHeight
        val collapsedY = (layoutHeightPx - with(LocalDensity.current) { peekHeight.roundToPx() }).toFloat()

        Box(Modifier.fillMaxSize()) {
            map()
            // 상태 표시줄 아이콘이 지도 글자와 섞이지 않게 위쪽에 옅은 흰 막을 깐다.
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(topInset + 24.dp)
                    .background(
                        androidx.compose.ui.graphics.Brush.verticalGradient(
                            0f to colors.surface.copy(alpha = 0.92f),
                            0.6f to colors.surface.copy(alpha = 0.6f),
                            1f to colors.surface.copy(alpha = 0f),
                        )
                    )
            )
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(top = topInset),
                content = overlay,
            )
        }

        Surface(
            shape = RoundedCornerShape(topStart = SmapRadius.sheet, topEnd = SmapRadius.sheet),
            color = colors.surface,
            shadowElevation = 12.dp,
            tonalElevation = 0.dp,
            modifier = Modifier
                .fillMaxWidth()
                // 위치는 그리기 단계에서만 읽는다 — 끄는 동안 지도·목록을 다시 구성하지 않아 매끄럽다.
                .offset { IntOffset(0, sheetState.offsetOr(collapsedY).roundToInt()) }
                .layout { measurable, c ->
                    val placeable = measurable.measure(c)
                    val expandedY = minOf((layoutHeightPx - placeable.height).toFloat(), collapsedY)
                    sheetState.updateAnchors(expandedY = expandedY, collapsedY = collapsedY)
                    layout(placeable.width, placeable.height) { placeable.place(0, 0) }
                }
                .nestedScroll(sheetState.nestedScrollConnection)
                .draggable(
                    state = sheetState.draggableState,
                    orientation = Orientation.Vertical,
                    startDragImmediately = sheetState.anchored.isAnimationRunning,
                    onDragStarted = { sheetState.onDragStarted() },
                    onDragStopped = { velocity -> sheetState.settle(velocity) },
                ),
        ) {
            Column(Modifier.fillMaxWidth()) {
                SheetHandle(
                    expanded = sheetState.anchored.targetValue == SmapSheetValue.Expanded,
                    onClick = { scope.launch { sheetState.toggle() } },
                )
                Column(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = sheetMaxHeight),
                    content = sheetContent,
                )
            }
        }

        // 스낵바는 시트 바로 위에 뜬다(이전 BottomSheetScaffold 와 같은 자리).
        SnackbarHost(
            snackbarHostState,
            Modifier
                .align(Alignment.TopCenter)
                .layout { measurable, c ->
                    val placeable = measurable.measure(c)
                    layout(placeable.width, placeable.height) {
                        placeable.place(0, sheetState.offsetOr(collapsedY).roundToInt() - placeable.height)
                    }
                },
        )
    }
}

/**
 * 손잡이 — 남색 띠 위 흰 막대. 바로 아래 머리 줄([sheetHeaderBand])과 같은 띠로 이어져
 * 시트 위쪽이 남색 머리로 보인다(흰 시트만 있을 때는 지도 위에서 밋밋했다).
 * 누르면 펼침·접힘을 바꾼다(iOS 와 같음, 화면 읽기 프로그램에서도 이 동작으로 연다).
 */
@Composable
private fun SheetHandle(expanded: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(SmapBrush.accentBand)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClickLabel = if (expanded) "시트 접기" else "시트 펼치기",
                onClick = onClick,
            )
            .semantics { contentDescription = "시트 손잡이" }
            .padding(top = 7.dp, bottom = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(width = 36.dp, height = 4.dp)
                .background(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.55f), RoundedCornerShape(2.dp))
        )
    }
}

/** 지도 시트 머리 줄 바탕 — 손잡이 띠에 이어지는 메뉴 강조색 띠(그 탭의 색을 읽으려고 @Composable). 안의 글자는 흰색·[SmapOnNavyMuted] 로 쓴다. */
@Composable
fun Modifier.sheetHeaderBand(): Modifier = this
    .fillMaxWidth()
    .background(SmapBrush.accentBand)
    .padding(bottom = SheetHeaderBandBottom)

/** 머리 띠 아래 여백 — 각 시트의 접힌 높이에 이만큼 더한다. */
val SheetHeaderBandBottom = 8.dp

/** 머리 줄 최소 높이(띠 안). 두꺼워 보인다는 피드백으로 52 → 48. */
val SheetHeaderMinHeight = 48.dp

/** 남색 띠와 그 아래 첫 줄(멤버 얼굴 줄·날짜 줄) 사이 흰 여백 — 띠에 붙어 답답해 보이지 않게. */
val SheetHeaderBandGap = 14.dp

/**
 * 남색 머리 띠 위 주 동작 버튼 — 흰 알약 + 남색 글자·아이콘.
 * 내장소 "장소 추가"와 홈 "전체 보기"가 같은 모양을 쓰도록 한곳에 둔다(글자 버튼은 띠 위에서 눈에 띄지 않았다).
 */
@Composable
fun SheetBandButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    androidx.compose.material3.Button(
        onClick = onClick,
        shape = androidx.compose.foundation.shape.CircleShape,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 8.dp),
        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
            containerColor = androidx.compose.ui.graphics.Color.White,
            contentColor = MaterialTheme.colorScheme.primary,
        ),
        modifier = modifier.height(40.dp),
    ) {
        androidx.compose.material3.Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        androidx.compose.foundation.layout.Spacer(Modifier.size(4.dp))
        Text(text, style = SmapText.captionBold)
    }
}
