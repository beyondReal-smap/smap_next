package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetValue
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.material3.BottomSheetScaffoldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius

/**
 * 지도 탭(홈·내장소·활동 로그) 공용 골격 — 지도는 화면 전체, 조작은 아래에서 끌어올리는 시트 하나.
 *
 * 이전에는 탭마다 모양이 다른 왼쪽 사이드바를 떠 있는 버튼으로 열어야 멤버를 고를 수 있었고, 열면 지도가 가려졌다.
 * 시트는 접힌 상태([peekHeight])에서도 핵심(멤버 얼굴 줄 등)이 보이고, 끌어올리면 목록이 펼쳐진다.
 *
 * - [overlay]: 지도 위에 떠 있는 조작(그룹 전환 알약, 원형 버튼). 상태 표시줄 아래에 놓인다.
 * - 시트를 끝까지 올려도 [overlay] 줄은 가리지 않도록 최대 높이를 제한한다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmapMapSheetScaffold(
    peekHeight: Dp,
    sheetContent: @Composable ColumnScope.() -> Unit,
    modifier: Modifier = Modifier,
    scaffoldState: BottomSheetScaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(
            initialValue = SheetValue.PartiallyExpanded,
            skipHiddenState = true,
        )
    ),
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
    overlay: @Composable BoxScope.() -> Unit = {},
    maxHeightFraction: Float = 0.55f,
    map: @Composable BoxScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    BoxWithConstraints(modifier.fillMaxSize()) {
        val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        // 끝까지 올려도 화면의 [maxHeightFraction] 까지만 — 지도의 절반가량은 늘 보이게 한다.
        // (이전에는 위쪽 조작 줄만 남기고 지도를 거의 다 가렸다.) 내용이 더 길면 시트 안에서 스크롤된다.
        val sheetMaxHeight = minOf(maxHeight * maxHeightFraction, maxHeight - topInset - 76.dp)
        BottomSheetScaffold(
            scaffoldState = scaffoldState,
            sheetPeekHeight = peekHeight,
            sheetShape = RoundedCornerShape(topStart = SmapRadius.sheet, topEnd = SmapRadius.sheet),
            sheetContainerColor = colors.surface,
            sheetShadowElevation = 12.dp,
            sheetTonalElevation = 0.dp,
            sheetDragHandle = { SheetHandle() },
            snackbarHost = { SnackbarHost(snackbarHostState) },
            containerColor = colors.background,
            sheetContent = {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = sheetMaxHeight),
                    content = sheetContent,
                )
            },
        ) {
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
        }
    }
}

/**
 * 손잡이 — 남색 띠 위 흰 막대. 바로 아래 머리 줄([sheetHeaderBand])과 같은 띠로 이어져
 * 시트 위쪽이 남색 머리로 보인다(흰 시트만 있을 때는 지도 위에서 밋밋했다).
 */
@Composable
private fun SheetHandle() {
    Box(
        Modifier
            .fillMaxWidth()
            .background(SmapBrush.navyBand)
            .padding(top = 10.dp, bottom = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(width = 36.dp, height = 4.dp)
                .background(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.55f), RoundedCornerShape(2.dp))
        )
    }
}

/** 지도 시트 머리 줄 바탕 — 손잡이 띠에 이어지는 남색 띠. 안의 글자는 흰색·[SmapOnNavyMuted] 로 쓴다. */
fun Modifier.sheetHeaderBand(): Modifier = this
    .fillMaxWidth()
    .background(SmapBrush.navyBand)
    .padding(bottom = SheetHeaderBandBottom)

/** 머리 띠 아래 여백 — 각 시트의 접힌 높이에 이만큼 더한다. */
val SheetHeaderBandBottom = 12.dp
