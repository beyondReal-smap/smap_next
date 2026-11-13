package com.dmonster.smap.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapSize
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 하단 탭 화면(홈·그룹·일정·내장소·활동 로그) 공용 머리글 — 왼쪽 큰 제목 + 오른쪽 동작.
 *
 * 탭마다 머리글을 따로 그리면서 배경(반투명/흰색), 여백, 부제 유무가 제각각이었고,
 * 지도 화면에서는 반투명 배경 너머 지도 글자가 제목과 섞여 읽기 어려웠다.
 * 배경을 불투명 surface 로 고정하고, 지도 위에 얹힐 때만 얇은 그림자로 경계를 준다.
 * 정보가 없는 안내성 부제("~해보세요")는 두지 않는다.
 *
 * @param overMap 지도 위에 겹쳐 놓일 때 true — 그림자로 지도와 구분한다.
 * @param insetStatusBar 화면이 상태바 아래까지 그려질 때 true — 상태바 영역까지 배경을 채운다.
 */
@Composable
fun SmapTabHeader(
    title: String,
    modifier: Modifier = Modifier,
    overMap: Boolean = false,
    insetStatusBar: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = if (overMap) 2.dp else 0.dp,
    ) {
        Row(
            modifier = Modifier
                .then(if (insetStatusBar) Modifier.statusBarsPadding() else Modifier)
                .fillMaxWidth()
                .heightIn(min = SmapSize.topBarHeight)
                // 오른쪽은 IconButton 자체 여백(48dp 터치 영역)이 있어 좁게 둔다.
                .padding(start = SmapSpacing.screenHorizontal, end = SmapSpacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title,
                style = SmapText.title,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .semantics { heading() },
            )
            actions()
        }
    }
}
