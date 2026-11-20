package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.Icons
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 목록 한 줄 — 왼쪽(아바타·아이콘) · 제목/보조 줄 · 오른쪽(값·스위치·화살표).
 * 화면마다 카드 안에 카드를 쌓던 것을 이 한 가지 행으로 통일한다.
 */
@Composable
fun SmapListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    selected: Boolean = false,
    destructive: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (selected) Modifier.background(colors.primaryContainer.copy(alpha = 0.55f)) else Modifier)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .heightIn(min = 60.dp)
            .padding(horizontal = SmapSpacing.md, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = SmapText.bodyBold,
                color = if (destructive) colors.error else colors.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = SmapText.caption,
                    color = colors.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(SmapSpacing.sm))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                trailing()
            }
        }
    }
}

/**
 * 행 왼쪽에 두는 아이콘 원(장소·설정 항목 등).
 * [emphasized] 면 남색 그라데이션 원 + 흰 아이콘 — 그 화면의 주인공 항목(그룹·장소 등)에 써서 목록에 무게를 준다.
 */
@Composable
fun SmapRowIcon(icon: ImageVector, modifier: Modifier = Modifier, emphasized: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    androidx.compose.foundation.layout.Box(
        modifier = modifier
            .size(40.dp)
            .clip(CircleShape)
            .then(if (emphasized) Modifier.background(SmapBrush.accent) else Modifier.background(colors.primaryContainer)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (emphasized) androidx.compose.ui.graphics.Color.White else colors.primary,
            modifier = Modifier.size(20.dp),
        )
    }
}

/**
 * 위험 동작(삭제·나가기·로그아웃) 행 왼쪽 아이콘 — 연한 빨강 원 + 빨강 아이콘.
 * 그룹 상세에만 있던 것을 계정설정 로그아웃과 함께 쓰려고 공용으로 옮겼다.
 */
@Composable
fun SmapDangerIcon(icon: ImageVector, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    androidx.compose.foundation.layout.Box(
        modifier = modifier
            .size(40.dp)
            .background(colors.error.copy(alpha = 0.08f), CircleShape),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = colors.error, modifier = Modifier.size(20.dp)) }
}

/**
 * 구역 — 회색 배경 위 "작은 제목 + 흰 묶음". 묶음 안의 행 사이에는 얇은 구분선을 넣는다.
 * [action] 은 제목 오른쪽 글자 버튼(예: "전체 보기", "추가").
 */
@Composable
fun SmapSection(
    modifier: Modifier = Modifier,
    title: String? = null,
    action: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    Column(modifier.fillMaxWidth()) {
        if (title != null || action != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(start = 4.dp, end = 0.dp, bottom = SmapSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    title.orEmpty(),
                    style = SmapText.captionBold,
                    color = colors.onSurfaceVariant,
                    modifier = Modifier
                        .weight(1f)
                        .semantics { heading() },
                )
                action?.invoke(this)
            }
        }
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(SmapRadius.lg))
                .background(colors.surface),
            content = content,
        )
    }
}

/** 묶음 안 행 사이 구분선 — 왼쪽 아이콘 뒤에서 시작해 정렬선을 맞춘다. */
@Composable
fun SmapRowDivider(inset: Boolean = true) {
    HorizontalDivider(
        modifier = Modifier.padding(start = if (inset) 68.dp else 16.dp),
        thickness = 0.5.dp,
        color = MaterialTheme.colorScheme.outlineVariant,
    )
}

/**
 * 일정 한 줄 — 왼쪽 시각(시작·끝)과 강조색 세로 막대, 가운데 세 줄:
 * 제목 / 멤버(얼굴·이름) + 반복 칩 / 장소(핀). 오른쪽 위는 진행 중일 때만 강조 표시.
 * 일정 탭 목록과 홈 시트 "오늘의 일정"이 함께 쓴다(iOS SMAPScheduleRow 와 같은 모양). 색은 감싼 SmapAccentTheme 을 따른다.
 * 2026-11-20: 이전엔 "멤버 · 장소 · 반복"을 부제 한 줄에 이어 붙여 길면 잘리고 무엇이 무엇인지 읽기 어려웠다.
 *
 * @param start "15:30" — 종일이면 무시
 * @param ongoingLabel 값이 있으면 제목 오른쪽에 강조 배지("진행 중")
 * @param onClick null 이면 누를 수 없는 줄(누름 표시도 없음)
 */
@Composable
fun SmapScheduleRow(
    start: String?,
    end: String?,
    allDay: Boolean,
    title: String,
    modifier: Modifier = Modifier,
    memberName: String? = null,
    memberPhoto: String? = null,
    memberId: Int? = null,
    place: String? = null,
    repeatText: String? = null,
    isDone: Boolean = false,
    ongoingLabel: String? = null,
    onClick: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    // 읽기 도구는 한 번에 "15:30 ~ 18:00, 수학학원, 민지, 장소 …, 반복 …" 으로 읽는다.
    val spoken = listOfNotNull(
        if (allDay) "종일" else listOfNotNull(start, end?.let { "~ $it" }).joinToString(" ").ifBlank { null },
        title,
        memberName,
        place?.let { "장소 $it" },
        repeatText?.let { "반복 $it" },
        ongoingLabel,
    ).joinToString(", ")

    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .heightIn(min = 60.dp)
            .height(IntrinsicSize.Min)
            .padding(horizontal = SmapSpacing.md, vertical = 12.dp)
            .clearAndSetSemantics {
                contentDescription = spoken
                if (onClick != null) role = Role.Button
            },
    ) {
        // 시각
        Column(Modifier.width(48.dp)) {
            Text(
                if (allDay) "종일" else start ?: "-",
                style = SmapText.bodyBold,
                color = if (isDone) colors.onSurfaceVariant else colors.primary
            )
            if (!allDay && end != null) {
                Text(end, style = SmapText.captionSmall, color = colors.onSurfaceVariant)
            }
        }
        Spacer(Modifier.width(12.dp))
        // 시간 막대 — 목록이 하루 시간표처럼 읽히게. 끝난 일정은 회색.
        Box(
            Modifier
                .width(3.dp)
                .fillMaxHeight()
                .background(if (isDone) colors.outlineVariant else colors.primary, RoundedCornerShape(2.dp))
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    title,
                    style = SmapText.bodyBold,
                    color = if (isDone) colors.onSurfaceVariant else colors.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (ongoingLabel != null) {
                    // 진행 중은 지금 봐야 할 일정이라 강조색으로 채워 목록에서 가장 먼저 보이게 한다.
                    Spacer(Modifier.width(8.dp))
                    Text(
                        ongoingLabel,
                        style = SmapText.captionBold,
                        color = Color.White,
                        modifier = Modifier
                            .background(SmapBrush.accent, RoundedCornerShape(50))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
            if (memberName != null || repeatText != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (memberName != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SmapAvatar(name = memberName, imagePath = memberPhoto, size = 20.dp, memberId = memberId)
                            Text(memberName, style = SmapText.caption, color = colors.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (repeatText != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier
                                .background(colors.primaryContainer, RoundedCornerShape(50))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Icon(Icons.Outlined.Repeat, contentDescription = null, tint = colors.onPrimaryContainer, modifier = Modifier.size(12.dp))
                            Text(repeatText, style = SmapText.captionSmall, color = colors.onPrimaryContainer, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
            if (place != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.Place, contentDescription = null, tint = colors.onSurfaceVariant, modifier = Modifier.size(13.dp))
                    Text(place, style = SmapText.caption, color = colors.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}
