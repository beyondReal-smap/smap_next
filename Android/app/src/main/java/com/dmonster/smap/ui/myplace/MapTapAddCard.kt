package com.dmonster.smap.ui.myplace

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLocationAlt
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 지도를 한 번 눌렀을 때 접힌 시트 위에 뜨는 확인 카드.
 *
 * 이전에는 "길게 누르기"로만 장소를 추가할 수 있어 기능을 찾기 어려웠다. 그렇다고 누르자마자 입력 시트를 띄우면
 * 지도를 움직이다 스친 것만으로도 시트가 열리므로, 임시 핀 + 이 카드로 한 번 더 확인받는다.
 * 지도를 다시 누르면 핀이 그 자리로 옮겨 간다.
 */
@Composable
fun MapTapAddCard(
    targetMemberName: String?,
    onAdd: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(SmapRadius.lg),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
    ) {
        Column(Modifier.padding(start = SmapSpacing.md, end = SmapSpacing.xs, top = SmapSpacing.sm, bottom = SmapSpacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SmapRowIcon(Icons.Outlined.AddLocationAlt)
                Column(
                    Modifier
                        .weight(1f)
                        .padding(start = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = if (targetMemberName != null) "${targetMemberName}님 장소로 추가할까요?" else "이 위치를 장소로 추가할까요?",
                        style = SmapText.bodyBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = "지도를 다시 누르면 위치를 옮길 수 있어요",
                        style = SmapText.caption,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(
                        Icons.Outlined.Close,
                        contentDescription = "닫기",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(SmapSpacing.sm))
            SmapButton(
                text = "이 위치 추가",
                onClick = onAdd,
                modifier = Modifier.padding(end = SmapSpacing.sm),
            )
        }
    }
}
