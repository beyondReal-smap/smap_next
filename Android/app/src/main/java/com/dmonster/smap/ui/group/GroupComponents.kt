package com.dmonster.smap.ui.group

import androidx.compose.foundation.background
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.dmonster.smap.ui.theme.FamilyColors
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
import com.dmonster.smap.ui.components.SmapDangerIcon
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapMotion
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.components.HeroStats
import com.dmonster.smap.ui.components.HeroHeading
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
    var showJoin by rememberSaveable { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val showPlaceholder = isLoading && groups.isEmpty()
    PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = onRefresh, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(if (isSystemInDarkTheme()) colors.background else FamilyColors.Paper),
            contentPadding = PaddingValues(start = SmapSpacing.md, end = SmapSpacing.md, top = SmapSpacing.md, bottom = SmapSpacing.xl),
            verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
        ) {
            item {
                Column {
                    GroupListHero(groups, groupMemberCounts, userName, currentUserIdx, showPlaceholder,
                        showJoin, onCreateClick, {
                            if (showJoin) focusManager.clearFocus()
                            showJoin = !showJoin
                        })
                    AnimatedVisibility(
                        visible = showJoin,
                        enter = expandVertically(SmapMotion.enter(), expandFrom = Alignment.Top) + fadeIn(SmapMotion.enter()),
                        exit = shrinkVertically(SmapMotion.exit(), shrinkTowards = Alignment.Top) + fadeOut(SmapMotion.exit()),
                    ) {
                        Box(Modifier.padding(top = SmapSpacing.lg)) {
                            InviteJoinSection(inviteCode, onInviteCodeChange, onPasteInviteCode, onJoinGroup, isJoining)
                        }
                    }
                }
            }
            item {
                SmapSection(title = if (groups.isEmpty()) "내 그룹" else "내 그룹 · ${groups.size}") {
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
                                leading = {
                                    Box(Modifier.size(44.dp, 48.dp).background(FamilyColors.Highlight, RoundedCornerShape(12.dp)),
                                        contentAlignment = Alignment.Center) {
                                        Text(g.sgtTitle.orEmpty().take(1).ifBlank { "그" }, style = SmapText.headline, color = FamilyColors.Ink)
                                    }
                                },
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
    showJoin: Boolean,
    onCreate: () -> Unit,
    onToggleJoin: () -> Unit,
) {
    val totalMembers = groups.sumOf { groupMemberCounts[it.sgtIdx] ?: it.memberCount ?: 0 }
    val owned = groups.count { currentUserIdx != null && it.mtIdx == currentUserIdx }
    Column(Modifier.fillMaxWidth().background(FamilyColors.Ink, RoundedCornerShape(24.dp)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(userName?.let { "${it}님의 그룹" } ?: "내 그룹", style = SmapText.captionBold, color = FamilyColors.Highlight)
            Text("함께하는 사람들", style = SmapText.title.copy(fontSize = 30.sp, lineHeight = 36.sp), color = Color.White,
                modifier = Modifier.semantics { heading() })
            Text(when {
                isLoading -> "그룹을 불러오는 중…"
                groups.isEmpty() -> "첫 그룹을 만들거나 초대 코드로 참여하세요"
                else -> "그룹 ${groups.size}개 · 그룹별 멤버 합계 ${totalMembers}명 · 내가 만든 그룹 ${owned}개"
            }, style = SmapText.captionSmall, color = Color.White.copy(alpha = 0.85f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = onCreate, modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = FamilyColors.Highlight, contentColor = FamilyColors.Ink),
                shape = RoundedCornerShape(13.dp)) {
                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("새 그룹", style = SmapText.captionBold)
            }
            OutlinedButton(onClick = onToggleJoin, modifier = Modifier.weight(1f),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.45f)), shape = RoundedCornerShape(13.dp)) {
                Text(if (showJoin) "코드 입력 닫기" else "코드로 참여", color = Color.White, style = SmapText.captionBold)
            }
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
            .background(if (isSystemInDarkTheme()) colors.background else FamilyColors.Paper),
        contentPadding = PaddingValues(SmapSpacing.md),
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg),
    ) {
        // 요약 — 화면의 시각적 중심(남색 카드). 이전 흰 카드는 아래 묶음들과 구분이 안 돼 밋밋했다.
        item {
            Column(Modifier.fillMaxWidth().background(FamilyColors.Ink, RoundedCornerShape(24.dp)).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (!isLoading && members.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
                            members.take(3).forEach { member ->
                                SmapAvatar(name = member.displayName, imagePath = member.mtFile1, size = 38.dp, memberId = member.mtIdx,
                                    modifier = Modifier.border(2.dp, FamilyColors.Ink, CircleShape))
                            }
                        }
                        Spacer(Modifier.width(14.dp))
                    }
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
                            leading = { SmapAvatar(name = m.displayName, imagePath = m.mtFile1, memberId = m.mtIdx) },
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

        // 관리
        item {
            SmapSection(title = "관리") {
                if (isOwner) {
                    SmapListRow(title = "그룹 정보 수정", leading = { SmapRowIcon(Icons.Outlined.Edit) }, trailing = { Chevron() }, onClick = onEditClick)
                    SmapRowDivider()
                    SmapListRow(
                        title = "그룹 삭제",
                        subtitle = "모든 멤버가 그룹에서 빠지고 되돌릴 수 없어요",
                        leading = { SmapDangerIcon(Icons.Outlined.DeleteOutline) },
                        destructive = true,
                        onClick = onDeleteClick,
                    )
                } else {
                    SmapListRow(
                        title = "그룹 나가기",
                        leading = { SmapDangerIcon(Icons.AutoMirrored.Outlined.ExitToApp) },
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
                if (strong) Modifier.background(SmapBrush.accent, RoundedCornerShape(50))
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
