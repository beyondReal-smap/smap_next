package com.dmonster.smap.ui.components

import androidx.compose.foundation.layout.RowScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import com.dmonster.smap.ui.theme.SmapText

/**
 * 하위 화면 공용 상단바 — 뒤로가기 + 가운데 제목 + 선택적 우측 동작.
 *
 * 설정 하위 화면마다 헤더를 복사해 쓰면서 높이·제목 크기·아이콘이 조금씩 달랐다.
 * 상단 화살표와 시스템 뒤로가기가 같은 동작을 하도록, 호출부는 같은 [onBack] 을
 * BackHandler 에도 넘겨야 한다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmapTopBar(
    title: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = MaterialTheme.colorScheme
    CenterAlignedTopAppBar(
        title = { Text(title, style = SmapText.headline, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        modifier = modifier,
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = colors.surface,
            titleContentColor = colors.onSurface,
            navigationIconContentColor = colors.onSurface,
            actionIconContentColor = colors.onSurface,
        ),
    )
}
