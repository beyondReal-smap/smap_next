package com.dmonster.smap.ui.group

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.HeroStats
import com.dmonster.smap.ui.components.HeroHeading
import com.dmonster.smap.ui.components.SmapHeroCard
import com.dmonster.smap.ui.components.SmapBrush
import androidx.compose.ui.graphics.Color

/*
 * 36단계 재설계 — 그룹 탭.
 * 이전: 흰 바탕 위 카드 목록 + 오른쪽 아래 + 버튼, 상세는 남색 큰 카드와 분홍·노랑·남색 통계 타일.
 * 지금: 회색 바탕 위 "구역 제목 + 흰 묶음" 목록. 새 그룹은 제목 옆 + 버튼, 상세는 요약·초대·멤버·관리 4구역.
 */

/** 그룹 목록 화면. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupListContent(
    groups: List<SmapGroup>,
    groupMemberCounts: Map<Int, Int>,
    userName: String?,
    currentUserIdx: Int?,
    inviteCode: String,
    isLoading: Boolean,
    isJoining: Boolean,
    isRefreshing: Boolean,
    onGroupClick: (SmapGroup) -> Unit,
    onCreateClick: () -> Unit,
    onInviteCodeChange: (String) -> Unit,
    onPasteInviteCode: (String) -> Unit,
    onJoinGroup: () -> Unit,
    onRefresh: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    // 이미 받은 목록이 있으면 다시 불러오는 동안에도 그대로 보여 준다. 탭을 다시 열 때마다 자리 표시(회색 줄)로
    // 바뀌었다가 목록이 돌아와 깜빡이는 것처럼 보였다. 자리 표시는 처음 불러올 때만.
    val showPlaceholder = isLoading && groups.isEmpty()
    PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = onRefresh, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(colors.background),
            contentPadding = PaddingValues(start = SmapSpacing.md, end = SmapSpacing.md, top = SmapSpacing.md, bottom = SmapSpacing.xl),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
        ) {
            item { GroupListHero(groups, groupMemberCounts, userName, currentUserIdx, showPlaceholder) }

            item {
                // 새 그룹 만들기는 "내 그룹" 줄 오른쪽에 둔다. 큰 제목을 뺀 뒤 맨 위에 + 하나만 남아
                // 빈 줄이 생겼던 것을 없애고, 목록과 그 목록에 대한 동작을 한 줄에 묶는다.
                SmapSection(
                    title = if (groups.isEmpty()) "내 그룹" else "내 그룹 ${groups.size}",
                    action = {
                        TextButton(
                            onClick = onCreateClick,
                            contentPadding = PaddingValues(horizontal = SmapSpacing.sm),
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(SmapSpacing.xs))
                            Text("새 그룹", style = SmapText.captionBold)
                        }
                    },
                ) {
                    when {
                        showPlaceholder -> repeat(2) { i ->
                            if (i > 0) SmapRowDivider()
                            SkeletonRow()
                        }
                        groups.isEmpty() -> SmapListRow(
                            title = "아직 그룹이 없어요",
                            subtitle = "가족·친구와 위치를 함께 보려면 그룹을 만들거나 초대 코드로 참여하세요.",
                            leading = { SmapRowIcon(Icons.Outlined.Groups) },
                            trailing = {
                                Text("만들기", style = SmapText.captionBold, color = colors.primary)
                            },
                            onClick = onCreateClick,
                        )
                        else -> groups.forEachIndexed { i, g ->
                            if (i > 0) SmapRowDivider()
                            val count = groupMemberCounts[g.sgtIdx] ?: g.memberCount ?: 0
                            val mine = currentUserIdx != null && g.mtIdx == currentUserIdx
                            SmapListRow(
                                title = g.sgtTitle ?: "이름 없는 그룹",
                                subtitle = listOfNotNull("멤버 ${count}명", g.sgtMemo?.takeIf { it.isNotBlank() }).joinToString(" · "),
                                leading = { SmapRowIcon(Icons.Outlined.Groups, emphasized = true) },
                                trailing = {
                                    if (mine) RoleBadge("그룹장")
                                    Chevron()
                                },
                                onClick = { onGroupClick(g) },
                            )
                        }
                    }
                }
            }

            item { InviteJoinSection(inviteCode, onInviteCodeChange, onPasteInviteCode, onJoinGroup, isJoining) }
        }
    }
}

/**
 * 그룹 탭 맨 위 남색 요약 카드 — 인사 + 그룹·멤버 수.
 * 멤버 수는 그룹별 인원의 합이라 여러 그룹에 같은 사람이 있으면 겹쳐 센다("전체 멤버").
 */
@Composable
private fun GroupListHero(
    groups: List<SmapGroup>,
    groupMemberCounts: Map<Int, Int>,
    userName: String?,
    currentUserIdx: Int?,
    isLoading: Boolean,
) {
    val totalMembers = groups.sumOf { groupMemberCounts[it.sgtIdx] ?: it.memberCount ?: 0 }
    val owned = groups.count { currentUserIdx != null && it.mtIdx == currentUserIdx }
    SmapHeroCard {
        HeroHeading(
            eyebrow = userName?.let { "안녕하세요, ${it}님" } ?: "안녕하세요",
            title = when {
                isLoading -> "그룹을 불러오고 있어요"
                groups.isEmpty() -> "그룹을 만들고\n가족을 초대해 보세요"
                else -> "${groups.size}개 그룹에서\n함께 위치를 나누고 있어요"
            },
        )
        if (!isLoading && groups.isNotEmpty()) {
            HeroStats(
                listOf(
                    "${groups.size}" to "내 그룹",
                    "$totalMembers" to "전체 멤버",
                    "$owned" to "내가 만든 그룹",
                )
            )
        }
    }
}

@Composable
private fun InviteJoinSection(
    inviteCode: String,
    onCodeChange: (String) -> Unit,
    onPaste: (String) -> Unit,
    onJoin: () -> Unit,
    isJoining: Boolean,
) {
    val focus = LocalFocusManager.current
    val clipboard = LocalClipboardManager.current
    // 코드는 대개 초대 메시지에서 복사해 온다 — 제목 옆 "붙여넣기"로 입력창을 길게 누르지 않고 바로 넣는다.
    SmapSection(
        title = "초대 코드로 참여",
        action = {
            TextButton(
                onClick = { clipboard.getText()?.text?.let(onPaste) },
                contentPadding = PaddingValues(horizontal = SmapSpacing.sm),
            ) {
                Icon(Icons.Outlined.ContentPaste, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(SmapSpacing.xs))
                Text("붙여넣기", style = SmapText.captionBold)
            }
        },
    ) {
        Column(Modifier.padding(SmapSpacing.md), verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
            Row(verticalAlignment = Alignment.Top) {
                SmapTextField(
                    value = inviteCode,
                    // 초대 코드는 영문 대문자·숫자로만 이뤄진다.
                    onValueChange = { v -> onCodeChange(v.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }) },
                    label = "초대 코드",
                    placeholder = "예: 5JDZRMNVEV",
                    leadingIcon = Icons.Outlined.PersonAdd,
                    keyboardType = KeyboardType.Ascii,
                    imeAction = ImeAction.Done,
                    keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); if (inviteCode.isNotBlank()) onJoin() }),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(SmapSpacing.sm))
                SmapButton(
                    text = "참여",
                    onClick = { focus.clearFocus(); onJoin() },
                    enabled = inviteCode.isNotBlank() && !isJoining,
                    isLoading = isJoining,
                    modifier = Modifier
                        .padding(top = 26.dp)
                        .width(80.dp),
                )
            }
        }
    }
}

/** 그룹 상세 화면 — 요약 · 초대 · 멤버 · 관리. */
@Composable
fun GroupDetailContent(
    group: SmapGroup,
    members: List<SmapGroupMember>,
    memberCount: Int,
    scheduleCount: Int,
    locationCount: Int,
    isLoading: Boolean,
    isOwner: Boolean,
    currentUserIdx: Int?,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onInviteClick: () -> Unit,
    onCopyCode: () -> Unit,
    onMemberClick: (SmapGroupMember) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(SmapSpacing.md),
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
    ) {
        // 요약 — 화면의 시각적 중심(남색 카드). 이전 흰 카드는 아래 묶음들과 구분이 안 돼 밋밋했다.
        item {
            SmapHeroCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(52.dp)
                            .background(Color.White.copy(alpha = 0.16f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Outlined.Groups, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp)) }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        HeroHeading(
                            eyebrow = if (isOwner) "내가 만든 그룹" else "참여 중인 그룹",
                            title = group.sgtTitle ?: "이름 없는 그룹",
                            subtitle = group.sgtMemo?.takeIf { it.isNotBlank() },
                        )
                    }
                }
                HeroStats(
                    listOf(
                        "${memberCount}명" to "멤버",
                        "${scheduleCount}개" to "이번 주 일정",
                        "${locationCount}곳" to "등록 장소",
                    )
                )
            }
        }

        // 초대
        item {
            SmapSection(title = "초대") {
                SmapListRow(
                    title = group.sgtCode ?: "초대 코드 없음",
                    subtitle = "이 코드를 받은 사람은 그룹에 참여할 수 있어요",
                    leading = { SmapRowIcon(Icons.Outlined.PersonAdd) },
                    trailing = if (group.sgtCode != null) {
                        { IconButton(onClick = onCopyCode) { Icon(Icons.Outlined.ContentCopy, contentDescription = "초대 코드 복사", tint = colors.onSurfaceVariant) } }
                    } else null,
                )
                SmapButton(
                    text = "멤버 초대하기",
                    onClick = onInviteClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = SmapSpacing.md, end = SmapSpacing.md, bottom = SmapSpacing.md),
                )
            }
        }

        // 멤버
        item {
            SmapSection(title = "멤버 ${if (isLoading) "" else members.size}".trim()) {
                when {
                    isLoading -> repeat(3) { i -> if (i > 0) SmapRowDivider(); SkeletonRow() }
                    members.isEmpty() -> SmapListRow(
                        title = "아직 멤버가 없어요",
                        subtitle = "초대 코드를 보내 멤버를 초대해 보세요",
                        leading = { SmapRowIcon(Icons.Outlined.PersonAdd) },
                    )
                    else -> members.forEachIndexed { i, m ->
                        if (i > 0) SmapRowDivider()
                        val role = when {
                            m.sgdtOwnerChk == "Y" -> "그룹장"
                            m.sgdtLeaderChk == "Y" -> "리더"
                            else -> null
                        }
                        val manageable = isOwner && m.sgdtOwnerChk != "Y"
                        SmapListRow(
                            title = if (m.mtIdx == currentUserIdx) "${m.displayName} (나)" else m.displayName,
                            // 역할은 오른쪽 배지로만 보여 준다(보조 줄과 배지에 "그룹장"이 두 번 나오던 문제).
                            subtitle = if (role == null && !manageable) "멤버" else null,
                            leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1) },
                            trailing = if (role != null || manageable) {
                                {
                                    if (role != null) RoleBadge(role)
                                    if (manageable) Chevron()
                                }
                            } else null,
                            onClick = if (manageable) ({ onMemberClick(m) }) else null,
                        )
                    }
                }
            }
        }

        // 관리
        item {
            SmapSection(title = "관리") {
                if (isOwner) {
                    SmapListRow(title = "그룹 정보 수정", leading = { SmapRowIcon(Icons.Outlined.Edit) }, trailing = { Chevron() }, onClick = onEditClick)
                    SmapRowDivider()
                    SmapListRow(
                        title = "그룹 삭제",
                        subtitle = "모든 멤버가 그룹에서 빠지고 되돌릴 수 없어요",
                        leading = { DangerIcon(Icons.Outlined.DeleteOutline) },
                        destructive = true,
                        onClick = onDeleteClick,
                    )
                } else {
                    SmapListRow(
                        title = "그룹 나가기",
                        leading = { DangerIcon(Icons.AutoMirrored.Outlined.ExitToApp) },
                        destructive = true,
                        onClick = onLeaveClick,
                    )
                }
            }
        }
    }
}

/** 역할 배지 — 그룹장은 남색 채움(가장 강한 역할), 리더는 연한 남색. */
@Composable
private fun RoleBadge(text: String) {
    val strong = text == "그룹장"
    Text(
        text,
        style = SmapText.captionBold,
        color = if (strong) Color.White else MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .then(
                if (strong) Modifier.background(SmapBrush.navy, RoundedCornerShape(50))
                else Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(50))
            )
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun Chevron() {
    Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
}

@Composable
private fun DangerIcon(icon: androidx.compose.ui.graphics.vector.ImageVector) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier
            .size(40.dp)
            .background(colors.error.copy(alpha = 0.08f), CircleShape),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = colors.error, modifier = Modifier.size(20.dp)) }
}

@Composable
private fun SkeletonRow() {
    val c = MaterialTheme.colorScheme.surfaceVariant
    Row(Modifier.fillMaxWidth().padding(SmapSpacing.md), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).background(c, CircleShape))
        Spacer(Modifier.width(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(width = 140.dp, height = 14.dp).background(c, RoundedCornerShape(4.dp)))
            Box(Modifier.size(width = 90.dp, height = 10.dp).background(c, RoundedCornerShape(4.dp)))
        }
    }
}
