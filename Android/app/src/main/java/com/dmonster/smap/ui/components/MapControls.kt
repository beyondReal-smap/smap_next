package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/** 지도 위에 떠 있는 흰 원형 버튼. [badge] 면 오른쪽 위에 빨간 점(읽지 않은 알림 등). */
@Composable
fun MapCircleButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: Boolean = false,
) {
    Box(modifier) {
        Surface(
            onClick = onClick,
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 4.dp,
            modifier = Modifier
                .size(44.dp)
                .semantics { this.contentDescription = contentDescription },
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(22.dp))
            }
        }
        if (badge) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 6.dp, end = 6.dp)
                    .size(9.dp)
                    .background(MaterialTheme.colorScheme.error, CircleShape)
            )
        }
    }
}

/**
 * 지도 왼쪽 위 그룹 전환 알약. 이전에는 사이드바를 열고 드롭다운 카드를 눌러야 그룹을 바꿀 수 있었다.
 */
@Composable
fun GroupSwitcherPill(
    groupName: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = colors.surface,
        shadowElevation = 4.dp,
        modifier = modifier
            .height(44.dp)
            .widthIn(max = 240.dp)
            .semantics { contentDescription = "그룹 ${groupName ?: "선택"}, 눌러서 바꾸기"; role = Role.Button },
    ) {
        Row(
            Modifier.padding(start = 14.dp, end = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Groups, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.size(8.dp))
            Text(
                groupName ?: "그룹 선택",
                style = SmapText.captionBold,
                color = colors.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = colors.onSurfaceVariant, modifier = Modifier.size(20.dp))
        }
    }
}

/** 그룹 선택 시트 — 지도 탭과 일정 탭 공용. [onCreateGroup] 이 있으면 맨 아래 "새 그룹 만들기" 행. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupPickerSheet(
    groups: List<SmapGroup>,
    selectedGroupId: Int?,
    onSelect: (SmapGroup) -> Unit,
    onDismiss: () -> Unit,
    onCreateGroup: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = SmapSpacing.md),
        ) {
            Text(
                "그룹",
                style = SmapText.headline,
                color = colors.onSurface,
                modifier = Modifier.padding(horizontal = SmapSpacing.screenHorizontal, vertical = SmapSpacing.sm),
            )
            groups.forEach { group ->
                val isSelected = group.sgtIdx == selectedGroupId
                SmapListRow(
                    title = group.sgtTitle ?: "이름 없는 그룹",
                    subtitle = group.memberCount?.let { "멤버 ${it}명" },
                    leading = { SmapRowIcon(Icons.Outlined.Groups) },
                    trailing = if (isSelected) {
                        { Icon(Icons.Filled.Check, contentDescription = "선택됨", tint = colors.primary) }
                    } else null,
                    onClick = { onSelect(group); onDismiss() },
                )
            }
            if (onCreateGroup != null) {
                SmapRowDivider(inset = false)
                SmapListRow(
                    title = "새 그룹 만들기",
                    leading = {
                        Box(
                            Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(colors.surfaceVariant),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Outlined.Add, contentDescription = null, tint = colors.onSurfaceVariant) }
                    },
                    onClick = { onCreateGroup(); onDismiss() },
                )
            }
        }
    }
}

/**
 * 그룹 알약 줄의 위아래 여백 — 지도 탭과 일정 탭이 같은 값을 써야 알약 위치가 탭을 바꿔도 그대로다.
 * (일정 탭만 16dp 를 써서 알약이 6dp 아래에 있었다.)
 */
val TopControlsVerticalPadding = 10.dp

/** 지도 위 떠 있는 조작 줄 — 왼쪽 그룹 알약, 오른쪽 원형 버튼들. */
@Composable
fun MapTopControls(
    groupName: String?,
    onGroupClick: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit = {},
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = SmapSpacing.md, vertical = TopControlsVerticalPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm),
    ) {
        // 알약은 남는 폭 안에서 이름 길이만큼만 차지하고, 버튼들은 항상 오른쪽 끝에 붙는다.
        Box(Modifier.weight(1f)) {
            GroupSwitcherPill(groupName = groupName, onClick = onGroupClick)
        }
        actions()
    }
}
