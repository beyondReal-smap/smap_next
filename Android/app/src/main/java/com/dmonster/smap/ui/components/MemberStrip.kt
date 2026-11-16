package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 시트 맨 위 가로 멤버 얼굴 줄 — 접힌 시트에서도 보여 한 번에 멤버를 고른다.
 * [onAllClick] 이 있으면 맨 앞에 "전체" 항목(모든 멤버가 보이게 지도 맞춤)을 둔다.
 */
@Composable
fun MemberStrip(
    members: List<SmapGroupMember>,
    selectedMemberId: Int?,
    currentUserIdx: Int?,
    onSelect: (SmapGroupMember) -> Unit,
    modifier: Modifier = Modifier,
    onAllClick: (() -> Unit)? = null,
) {
    LazyRow(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = SmapSpacing.md),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (onAllClick != null) {
            item(key = "all") {
                StripItem(
                    label = "전체",
                    selected = selectedMemberId == null,
                    onClick = onAllClick,
                    accessibility = "전체 멤버 보기",
                ) { selected ->
                    val colors = MaterialTheme.colorScheme
                    Box(
                        Modifier
                            .size(52.dp)
                            .then(if (selected) Modifier.border(2.5.dp, SmapBrush.navy, CircleShape) else Modifier)
                            .padding(if (selected) 4.5.dp else 0.dp)
                            // 선택되면 남색으로 채워 "지금 전체를 보고 있다"가 분명히 보이게 한다.
                            .then(if (selected) Modifier.background(SmapBrush.navy, CircleShape) else Modifier.background(colors.surfaceVariant, CircleShape)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Map, contentDescription = null, tint = if (selected) androidx.compose.ui.graphics.Color.White else colors.onSurfaceVariant)
                    }
                }
            }
        }
        items(members, key = { it.mtIdx }) { member ->
            val isMe = member.mtIdx == currentUserIdx
            val selected = member.mtIdx == selectedMemberId
            StripItem(
                label = if (isMe) "나" else member.displayName,
                selected = selected,
                onClick = { onSelect(member) },
                accessibility = if (isMe) "${member.displayName}, 나" else member.displayName,
            ) { sel ->
                SmapAvatar(name = member.displayName, imagePath = member.mtFile1, size = 52.dp, selected = sel)
            }
        }
    }
}

@Composable
private fun StripItem(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    accessibility: String,
    avatar: @Composable (Boolean) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    Column(
        Modifier
            .width(60.dp)
            .selectable(selected = selected, onClick = onClick, role = Role.Tab)
            .semantics(mergeDescendants = true) { contentDescription = accessibility },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        avatar(selected)
        Spacer(Modifier.height(6.dp))
        Text(
            label,
            style = if (selected) SmapText.captionBold else SmapText.caption,
            color = if (selected) colors.primary else colors.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
    }
}
