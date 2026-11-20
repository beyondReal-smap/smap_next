package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.FamilyColors
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
                    horizontal = true,
                    onClick = onAllClick,
                    accessibility = "전체 멤버 보기",
                ) { _ ->
                    val colors = MaterialTheme.colorScheme
                    Box(
                        Modifier
                            .size(40.dp)
                            .background(colors.primaryContainer, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (members.size >= 2) {
                            Row(horizontalArrangement = Arrangement.spacedBy((-7).dp)) {
                                members.take(2).forEach { member ->
                                    SmapAvatar(
                                        name = member.displayName,
                                        imagePath = member.mtFile1,
                                        size = 21.dp,
                                        memberId = member.mtIdx,
                                        modifier = Modifier.border(1.5.dp, androidx.compose.ui.graphics.Color.White, CircleShape),
                                    )
                                }
                            }
                        } else {
                            Icon(Icons.Outlined.Map, contentDescription = null, tint = colors.primary)
                        }
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
                horizontal = onAllClick != null,
                onClick = { onSelect(member) },
                accessibility = if (isMe) "${member.displayName}, 나" else member.displayName,
            ) { sel ->
                SmapAvatar(name = member.displayName, imagePath = member.mtFile1, size = if (onAllClick != null) 40.dp else 52.dp,
                    selected = sel && onAllClick == null,
                    memberId = if (onAllClick != null) member.mtIdx else null)
            }
        }
    }
}

@Composable
private fun StripItem(
    label: String,
    selected: Boolean,
    horizontal: Boolean,
    onClick: () -> Unit,
    accessibility: String,
    avatar: @Composable (Boolean) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    if (horizontal) {
        val accent = LocalSmapAccent.current
        Row(
            Modifier.height(50.dp).clip(CircleShape)
                .background(if (selected) accent.deep else Color.White)
                .border(1.dp, if (selected) accent.deep else accent.deep.copy(alpha = 0.16f), CircleShape)
                .selectable(selected = selected, onClick = onClick, role = Role.Tab)
                .semantics(mergeDescendants = true) { contentDescription = accessibility }
                .padding(start = 5.dp, end = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            avatar(selected)
            Text(label, modifier = Modifier.widthIn(max = 96.dp), style = SmapText.captionBold,
                color = if (selected) Color.White else FamilyColors.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        return
    }
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
