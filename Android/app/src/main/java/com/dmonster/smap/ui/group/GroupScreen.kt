package com.dmonster.smap.ui.group

import com.dmonster.smap.BuildConfig
import android.content.Intent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp
import androidx.compose.material3.pulltorefresh.PullToRefreshBox

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
    
    // Handle messages
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }
    
    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearSuccess()
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
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFFFBBF24), Color(0xFFF59E0B))
                            )
                        )
                        .clickable { viewModel.showCreateDialog() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "그룹 추가",
                        tint = Color.White,
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
                    if (targetState == GroupViewModel.ViewState.DETAIL) {
                        slideInHorizontally { it } + fadeIn() togetherWith
                            slideOutHorizontally { -it } + fadeOut()
                    } else {
                        slideInHorizontally { -it } + fadeIn() togetherWith
                            slideOutHorizontally { it } + fadeOut()
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
                                onLeaveClick = { viewModel.showDeleteDialog() },
                                onShareClick = { viewModel.showShareDialog() },
                                onInviteClick = { viewModel.showInviteBottomSheet() },
                                onCopyCode = {
                                    group.sgtCode?.let {
                                        clipboardManager.setText(AnnotatedString(it))
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
    
    if (showEditDialog && selectedGroup != null) {
        EditGroupDialog(
            group = selectedGroup!!,
            onDismiss = { viewModel.hideEditDialog() },
            onUpdate = { name, desc -> viewModel.updateGroup(name, desc) },
            isLoading = false
        )
    }
    
    if (showDeleteDialog && selectedGroup != null) {
        val isOwner = viewModel.isCurrentUserOwner()
        DeleteConfirmDialog(
            group = selectedGroup!!,
            isLeave = !isOwner,
            onDismiss = { viewModel.hideDeleteDialog() },
            onConfirm = { 
                if (isOwner) viewModel.deleteGroup() 
                else viewModel.leaveGroup() 
            },
            isLoading = false
        )
    }
    
    if (showShareDialog && selectedGroup != null) {
        ShareGroupDialog(
            group = selectedGroup!!,
            onDismiss = { viewModel.hideShareDialog() },
            onCopyCode = {
                selectedGroup?.sgtCode?.let {
                    clipboardManager.setText(AnnotatedString(it))
                }
                viewModel.hideShareDialog()
            },
            onCopyLink = {
                val link = "${BuildConfig.WEB_BASE_URL}/group/${selectedGroup?.sgtIdx}/join"
                clipboardManager.setText(AnnotatedString(link))
                viewModel.hideShareDialog()
            },
            onSMS = {
                val code = selectedGroup?.sgtCode ?: ""
                val message = "[SMAP] ${selectedGroup?.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code"
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = android.net.Uri.parse("sms:?body=${android.net.Uri.encode(message)}")
                }
                context.startActivity(intent)
                viewModel.hideShareDialog()
            }
        )
    }
    
    if (showMemberManageDialog && selectedMember != null) {
        MemberManageDialog(
            member = selectedMember!!,
            onDismiss = { viewModel.hideMemberManageDialog() },
            onChangeRole = { isLeader -> viewModel.updateMemberRole(isLeader) },
            onRemove = { viewModel.removeMember() },
            isLoading = false
        )
    }
    
    // Invite Bottom Sheet
    if (showInviteBottomSheet && selectedGroup != null) {
        InviteMemberBottomSheet(
            group = selectedGroup!!,
            onDismiss = { viewModel.hideInviteBottomSheet() },
            onCopyLink = {
                val link = "${BuildConfig.WEB_BASE_URL}/group/${selectedGroup?.sgtIdx}/join"
                clipboardManager.setText(AnnotatedString(link))
                viewModel.hideInviteBottomSheet()
            },
            onShowQRCode = {
                viewModel.hideInviteBottomSheet()
                viewModel.showQRCodeDialog()
            },
            onShareSMS = {
                val code = selectedGroup?.sgtCode ?: ""
                val message = "[SMAP] ${selectedGroup?.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code"
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = android.net.Uri.parse("sms:?body=${android.net.Uri.encode(message)}")
                }
                context.startActivity(intent)
                viewModel.hideInviteBottomSheet()
            },
            onDefaultShare = {
                val code = selectedGroup?.sgtCode ?: ""
                val link = "${BuildConfig.WEB_BASE_URL}/group/${selectedGroup?.sgtIdx}/join"
                val message = "[SMAP] ${selectedGroup?.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: $link"
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, message)
                }
                context.startActivity(Intent.createChooser(shareIntent, "공유하기"))
                viewModel.hideInviteBottomSheet()
            },
            onCopyCode = {
                // Code is already copied inside the composable
            }
        )
    }
    
    // QR Code Dialog
    if (showQRCodeDialog && selectedGroup != null) {
        val qrData = "${BuildConfig.WEB_BASE_URL}/group/${selectedGroup?.sgtIdx}/join"
        QRCodeDialog(
            data = qrData,
            onDismiss = { viewModel.hideQRCodeDialog() },
            onShare = { bitmap ->
                // Share QR code as image
                val cachePath = java.io.File(context.cacheDir, "images")
                cachePath.mkdirs()
                val file = java.io.File(cachePath, "qr_code.png")
                val fileOutputStream = java.io.FileOutputStream(file)
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, fileOutputStream)
                fileOutputStream.close()
                
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.provider",
                    file
                )
                
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(shareIntent, "QR 코드 공유"))
            }
        )
    }
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
                    color = Color(0xFF1F2937)
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
        contentPadding = PaddingValues(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // iOS Style Large Title
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "그룹",
                    fontSize = 22.responsiveSp(),
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    color = Color.Black
                )
                Text(
                    text = "그룹과 멤버를 한눈에 관리하세요",
                    fontSize = 13.responsiveSp(),
                    fontFamily = SuiteFont,
                    color = BrandColors.TextSecondary
                )
            }
        }

        // Stats Cards
        item {
            if (isLoading) {
                // Skeleton
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    repeat(2) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(115.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(Color.Gray.copy(alpha = 0.1f))
                        )
                    }
                }
            } else {
                GroupStatsCards(
                    groupsCount = groups.size,
                    totalMembers = totalMembers
                )
            }
        }

        // Invite Code Section
        item {
            InviteCodeSection(
                inviteCode = inviteCode,
                onCodeChange = onInviteCodeChange,
                onJoin = onJoinGroup,
                isLoading = isJoining
            )
        }
        
        // Group Cards
        if (isLoading) {
            items(2) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .height(100.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color.Gray.copy(alpha = 0.1f))
                )
            }
        } else {
            items(groups) { group ->
                GroupCard(
                    group = group,
                    memberCount = groupMemberCounts[group.sgtIdx] ?: 0,
                    onClick = { onGroupClick(group) },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
        }
        
        // Empty State
        if (!isLoading && groups.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Filled.Groups,
                        contentDescription = "그룹 없음",
                        tint = BrandColors.TextSecondary.copy(alpha = 0.3f),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "아직 그룹이 없습니다",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        color = BrandColors.TextSecondary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "새 그룹을 만들거나 초대 코드로 가입해보세요",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = BrandColors.TextSecondary.copy(alpha = 0.6f)
                    )
                }
            }
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
                color = Color(0xFF1F2937),
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
                    isOwner = member.sgdtOwnerChk == "Y",
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
                        text = "그룹원이 없습니다",
                        fontSize = 16.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = BrandColors.TextSecondary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "새로운 멤버를 초대해보세요",
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = BrandColors.TextSecondary.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onShareClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF22C55E)
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
