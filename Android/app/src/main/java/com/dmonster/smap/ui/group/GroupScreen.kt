package com.dmonster.smap.ui.group

import androidx.compose.material.icons.outlined.Groups
import com.dmonster.smap.ui.components.SmapEmptyState
import com.dmonster.smap.ui.components.SmapTabHeader
import com.dmonster.smap.BuildConfig
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SemanticColors
import com.dmonster.smap.ui.theme.SmapMotion
import androidx.compose.ui.unit.IntOffset
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 그룹 화면 - 리스트/상세 뷰 전환
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupScreen(
    viewModel: GroupViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    
    // Collect States
    val currentView by viewModel.currentView.collectAsState()
    BackHandler(enabled = currentView != GroupViewModel.ViewState.LIST) { viewModel.backToList() }
    val isLoading by viewModel.isLoading.collectAsState()
    val isMembersLoading by viewModel.isMembersLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    val groups by viewModel.groups.collectAsState()
    val selectedGroup by viewModel.selectedGroup.collectAsState()
    val groupMembers by viewModel.groupMembers.collectAsState()
    val groupMemberCounts by viewModel.groupMemberCounts.collectAsState()
    val weeklyScheduleCount by viewModel.weeklyScheduleCount.collectAsState()
    val totalLocationCount by viewModel.totalLocationCount.collectAsState()
    
    val inviteCode by viewModel.inviteCode.collectAsState()
    val isJoining by viewModel.isJoining.collectAsState()
    val isCreating by viewModel.isCreating.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val isActionLoading by viewModel.isActionLoading.collectAsState()
    
    // Dialog States
    val showCreateDialog by viewModel.showCreateDialog.collectAsState()
    val showEditDialog by viewModel.showEditDialog.collectAsState()
    val showDeleteDialog by viewModel.showDeleteDialog.collectAsState()
    val showShareDialog by viewModel.showShareDialog.collectAsState()
    val showMemberManageDialog by viewModel.showMemberManageDialog.collectAsState()
    val selectedMember by viewModel.selectedMember.collectAsState()
    val showInviteBottomSheet by viewModel.showInviteBottomSheet.collectAsState()
    val showQRCodeDialog by viewModel.showQRCodeDialog.collectAsState()
    
    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Handle messages - use snapshotFlow to avoid race between error and success
    LaunchedEffect(Unit) {
        snapshotFlow { errorMessage }.collect { msg ->
            msg?.let {
                snackbarHostState.currentSnackbarData?.dismiss()
                snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
                viewModel.clearError()
            }
        }
    }

    LaunchedEffect(Unit) {
        snapshotFlow { successMessage }.collect { msg ->
            msg?.let {
                snackbarHostState.currentSnackbarData?.dismiss()
                snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
                viewModel.clearSuccess()
            }
        }
    }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            GroupTopBar(
                currentView = currentView,
                onBackClick = { viewModel.backToList() }
            )
        },
        floatingActionButton = {
            if (currentView == GroupViewModel.ViewState.LIST) {
                FloatingActionButton(
                    onClick = { viewModel.showCreateDialog() },
                    modifier = Modifier.size(64.dp),
                    shape = CircleShape,
                    containerColor = com.dmonster.smap.ui.theme.BrandColors.Primary,
                    contentColor = Color.White
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "그룹 추가",
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.White)
        ) {
            AnimatedContent(
                targetState = currentView,
                transitionSpec = {
                    // 리스트↔상세 전환 — 350ms enter / 245ms exit (Material Motion 표준)
                    val enter = SmapMotion.enter<IntOffset>(SmapMotion.ScreenTransitionMs)
                    val exit = SmapMotion.exit<IntOffset>()
                    val fadeEnter = SmapMotion.enter<Float>(SmapMotion.ScreenTransitionMs)
                    val fadeExit = SmapMotion.exit<Float>()
                    if (targetState == GroupViewModel.ViewState.DETAIL) {
                        (slideInHorizontally(animationSpec = enter) { it } +
                            fadeIn(animationSpec = fadeEnter)) togetherWith
                            (slideOutHorizontally(animationSpec = exit) { -it } +
                                fadeOut(animationSpec = fadeExit))
                    } else {
                        (slideInHorizontally(animationSpec = enter) { -it } +
                            fadeIn(animationSpec = fadeEnter)) togetherWith
                            (slideOutHorizontally(animationSpec = exit) { it } +
                                fadeOut(animationSpec = fadeExit))
                    }
                },
                label = "viewTransition"
            ) { view ->
                when (view) {
                    GroupViewModel.ViewState.LIST -> {
                        GroupListView(
                            groups = groups,
                            groupMemberCounts = groupMemberCounts,
                            inviteCode = inviteCode,
                            isLoading = isLoading,
                            isJoining = isJoining,
                            isRefreshing = isRefreshing,
                            onGroupClick = { viewModel.selectGroup(it) },
                            onInviteCodeChange = { viewModel.updateInviteCode(it) },
                            onJoinGroup = { viewModel.joinGroupByCode() },
                            onRefresh = { viewModel.refresh() },
                            totalMembers = groupMemberCounts.values.sum()
                        )
                    }
                    GroupViewModel.ViewState.DETAIL -> {
                        selectedGroup?.let { group ->
                            GroupDetailView(
                                group = group,
                                members = groupMembers,
                                memberCount = groupMemberCounts[group.sgtIdx] ?: 0,
                                scheduleCount = weeklyScheduleCount,
                                locationCount = totalLocationCount,
                                isLoading = isMembersLoading,
                                isOwner = viewModel.isCurrentUserOwner(),
                                onEditClick = { viewModel.showEditDialog() },
                                onDeleteClick = { viewModel.showDeleteDialog() },
                                // Both delete and leave show the same dialog; isLeave flag differentiates behavior
                                onLeaveClick = { viewModel.showDeleteDialog() },
                                onShareClick = { viewModel.showShareDialog() },
                                onInviteClick = { viewModel.showInviteBottomSheet() },
                                onCopyCode = {
                                    group.sgtCode?.let {
                                        clipboardManager.setText(AnnotatedString(it))
                                        viewModel.showSuccess("초대 코드를 복사했어요")
                                    }
                                },
                                onMemberClick = { member ->
                                    if (viewModel.isCurrentUserOwner() && member.sgdtOwnerChk != "Y") {
                                        viewModel.showMemberManageDialog(member)
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
    
    // Dialogs
    if (showCreateDialog) {
        CreateGroupDialog(
            onDismiss = { viewModel.hideCreateDialog() },
            onCreate = { name, desc -> viewModel.createGroup(name, desc) },
            isLoading = isCreating
        )
    }
    
    if (showEditDialog) {
        selectedGroup?.let { group ->
            EditGroupDialog(
                group = group,
                onDismiss = { viewModel.hideEditDialog() },
                onUpdate = { name, desc -> viewModel.updateGroup(name, desc) },
                isLoading = isActionLoading
            )
        }
    }

    if (showDeleteDialog) {
        selectedGroup?.let { group ->
            val isOwner = viewModel.isCurrentUserOwner()
            DeleteConfirmDialog(
                group = group,
                isLeave = !isOwner,
                onDismiss = { viewModel.hideDeleteDialog() },
                onConfirm = {
                    if (isOwner) viewModel.deleteGroup()
                    else viewModel.leaveGroup()
                },
                isLoading = isActionLoading
            )
        }
    }
    
    if (showShareDialog) {
        selectedGroup?.let { group ->
            ShareGroupDialog(
                group = group,
                onDismiss = { viewModel.hideShareDialog() },
                onCopyCode = {
                    group.sgtCode?.let {
                        clipboardManager.setText(AnnotatedString(it))
                        viewModel.showSuccess("초대 코드를 복사했어요")
                    }
                    viewModel.hideShareDialog()
                },
                onCopyLink = {
                    val link = inviteLink(group.sgtIdx, group.sgtCode)
                    clipboardManager.setText(AnnotatedString(link))
                    viewModel.showSuccess("초대 링크를 복사했어요")
                    viewModel.hideShareDialog()
                },
                onSMS = {
                    val code = group.sgtCode ?: ""
                    val message = "[SMAP] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: ${inviteLink(group.sgtIdx, group.sgtCode)}"
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse("sms:?body=${android.net.Uri.encode(message)}")
                    }
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) android.util.Log.e("GroupScreen", "Failed to start activity", e)
                    }
                    viewModel.hideShareDialog()
                }
            )
        }
    }

    if (showMemberManageDialog) {
        selectedMember?.let { member ->
            MemberManageDialog(
                member = member,
                onDismiss = { viewModel.hideMemberManageDialog() },
                onChangeRole = { isLeader -> viewModel.updateMemberRole(isLeader) },
                onRemove = { viewModel.removeMember() },
                isLoading = isActionLoading
            )
        }
    }
    
    // Invite Bottom Sheet
    if (showInviteBottomSheet) {
        selectedGroup?.let { group ->
            InviteMemberBottomSheet(
                group = group,
                onDismiss = { viewModel.hideInviteBottomSheet() },
                onCopyLink = {
                    val link = inviteLink(group.sgtIdx, group.sgtCode)
                    clipboardManager.setText(AnnotatedString(link))
                    viewModel.showSuccess("초대 링크를 복사했어요")
                    viewModel.hideInviteBottomSheet()
                },
                onShowQRCode = {
                    viewModel.hideInviteBottomSheet()
                    viewModel.showQRCodeDialog()
                },
                onShareSMS = {
                    val code = group.sgtCode ?: ""
                    val message = "[SMAP] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: ${inviteLink(group.sgtIdx, group.sgtCode)}"
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse("sms:?body=${android.net.Uri.encode(message)}")
                    }
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) android.util.Log.e("GroupScreen", "Failed to start activity", e)
                    }
                    viewModel.hideInviteBottomSheet()
                },
                onDefaultShare = {
                    val code = group.sgtCode ?: ""
                    val link = inviteLink(group.sgtIdx, group.sgtCode)
                    val message = "[SMAP] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: $link"
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, message)
                    }
                    try {
                        context.startActivity(Intent.createChooser(shareIntent, "공유하기"))
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) android.util.Log.e("GroupScreen", "Failed to start activity", e)
                    }
                    viewModel.hideInviteBottomSheet()
                },
                onCopyCode = {
                    // BottomSheet 내부 IconButton 에서 이미 클립보드 복사 + Haptic 처리됨.
                    // 상위에서는 Snackbar 피드백만 발행.
                    viewModel.showSuccess("초대 코드를 복사했어요")
                }
            )
        }
    }
    
    // QR Code Dialog
    if (showQRCodeDialog) {
        selectedGroup?.let { group ->
            val qrData = inviteLink(group.sgtIdx, group.sgtCode)
            val scope = rememberCoroutineScope()
            QRCodeDialog(
                data = qrData,
                onDismiss = { viewModel.hideQRCodeDialog() },
                onShare = { bitmap ->
                    scope.launch {
                        try {
                        // Perform file I/O off the main thread
                        val uri = withContext(Dispatchers.IO) {
                            val cachePath = java.io.File(context.cacheDir, "images")
                            cachePath.mkdirs()
                            val file = java.io.File(cachePath, "qr_code.png")
                            val fileOutputStream = java.io.FileOutputStream(file)
                            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, fileOutputStream)
                            fileOutputStream.close()

                            androidx.core.content.FileProvider.getUriForFile(
                                context,
                                "${context.packageName}.provider",
                                file
                            )
                        }

                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "image/png"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                            context.startActivity(Intent.createChooser(shareIntent, "QR 코드 공유"))
                        } catch (e: Exception) {
                            if (BuildConfig.DEBUG) android.util.Log.e("GroupScreen", "Failed to start activity", e)
                            viewModel.showError("QR 코드를 공유하지 못했어요.")
                        }
                    }
                }
            )
        }
    }
}

private fun inviteLink(groupId: Int, code: String?): String {
    val base = "${BuildConfig.WEB_BASE_URL}/group/$groupId/join"
    return if (code.isNullOrBlank()) base else "$base?code=${java.net.URLEncoder.encode(code, "UTF-8")}"
}

// MARK: - Top Bar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupTopBar(
    currentView: GroupViewModel.ViewState,
    onBackClick: () -> Unit
) {
    if (currentView == GroupViewModel.ViewState.DETAIL) {
        CenterAlignedTopAppBar(
            title = {
                Text(
                    text = "그룹 상세",
                    fontSize = 18.responsiveSp(),
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = BrandColors.TextPrimary
                )
            },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .background(Color.White, CircleShape)
                            .border(1.dp, Color.Gray.copy(alpha = 0.1f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.ChevronLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black
                        )
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent
            )
        )
    }
}

// MARK: - List View

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun GroupListView(
    groups: List<com.dmonster.smap.data.model.SmapGroup>,
    groupMemberCounts: Map<Int, Int>,
    inviteCode: String,
    isLoading: Boolean,
    isJoining: Boolean,
    isRefreshing: Boolean,
    onGroupClick: (com.dmonster.smap.data.model.SmapGroup) -> Unit,
    onInviteCodeChange: (String) -> Unit,
    onJoinGroup: () -> Unit,
    onRefresh: () -> Unit,
    totalMembers: Int
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize()
    ) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // 아래 여백은 오른쪽 아래 + 버튼(FAB)이 마지막 항목을 가리지 않도록 넉넉히 둔다.
        contentPadding = PaddingValues(bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 탭 공용 머리글(목록과 함께 스크롤된다)
        item {
            SmapTabHeader(title = "그룹")
        }

        // 한 줄 요약(그룹 수 · 멤버 수)
        if (!isLoading && groups.isNotEmpty()) {
            item {
                GroupSummaryLine(groupsCount = groups.size, totalMembers = totalMembers)
            }
        }

        // Group Cards — 목록이 이 화면의 주인공
        if (isLoading) {
            items(2) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .height(88.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                )
            }
        } else {
            items(groups, key = { it.sgtIdx }) { group ->
                GroupCard(
                    group = group,
                    memberCount = groupMemberCounts[group.sgtIdx] ?: 0,
                    onClick = { onGroupClick(group) },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
        }

        // Empty State — 공용 빈 상태
        if (!isLoading && groups.isEmpty()) {
            item {
                SmapEmptyState(
                    title = "아직 그룹이 없어요",
                    description = "오른쪽 아래 + 버튼으로 새 그룹을 만들거나\n초대 코드로 참여해 보세요.",
                    icon = Icons.Outlined.Groups,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            }
        }

        // 초대 코드로 참여 — 목록 아래에 둔다(가장 자주 쓰는 건 목록이므로)
        item {
            InviteCodeSection(
                inviteCode = inviteCode,
                onCodeChange = onInviteCodeChange,
                onJoin = onJoinGroup,
                isLoading = isJoining,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
    } // PullToRefreshBox
}

// MARK: - Detail View

@Composable
private fun GroupDetailView(
    group: com.dmonster.smap.data.model.SmapGroup,
    members: List<com.dmonster.smap.data.model.SmapGroupMember>,
    memberCount: Int,
    scheduleCount: Int,
    locationCount: Int,
    isLoading: Boolean,
    isOwner: Boolean,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onShareClick: () -> Unit,
    onInviteClick: () -> Unit,
    onCopyCode: () -> Unit,
    onMemberClick: (com.dmonster.smap.data.model.SmapGroupMember) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Group Header Card
        item {
            GroupHeaderCard(
                group = group,
                isOwner = isOwner,
                onEditClick = onEditClick,
                onDeleteClick = onDeleteClick,
                onLeaveClick = onLeaveClick,
                onCopyCode = onCopyCode,
                onInviteClick = onInviteClick,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }
        
        // Stats Cards
        item {
            DetailStatsCards(
                memberCount = memberCount,
                scheduleCount = scheduleCount,
                locationCount = locationCount,
                isLoading = isLoading
            )
        }
        
        // Member Section Header
        item {
            Text(
                text = "그룹 멤버",
                fontSize = 18.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium,
                color = BrandColors.TextPrimary,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }
        
        // Member List
        if (isLoading) {
            items(3) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .height(72.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Gray.copy(alpha = 0.1f))
                )
            }
        } else {
            items(members) { member ->
                MemberListItem(
                    member = member,
                    canManage = isOwner,
                    onClick = { onMemberClick(member) },
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }
        }
        
        // Empty Members State
        if (!isLoading && members.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "멤버 없음",
                        tint = BrandColors.Primary.copy(alpha = 0.3f),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "아직 멤버가 없어요",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.TextSecondary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "멤버를 초대해 보세요",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = BrandColors.TextSecondary.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onShareClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = BrandColors.Success
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.GroupAdd, null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("멤버 초대", fontFamily = SuiteFont)
                    }
                }
            }
        }
    }
}
