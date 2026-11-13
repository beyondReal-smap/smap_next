package com.dmonster.smap.ui.group

import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.BuildConfig
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.theme.SmapMotion
import androidx.compose.ui.unit.IntOffset
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
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (currentView == GroupViewModel.ViewState.DETAIL) {
                SmapTopBar(title = "그룹", onBack = { viewModel.backToList() })
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
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
                        GroupListContent(
                            groups = groups,
                            groupMemberCounts = groupMemberCounts,
                            inviteCode = inviteCode,
                            isLoading = isLoading,
                            isJoining = isJoining,
                            isRefreshing = isRefreshing,
                            onGroupClick = { viewModel.selectGroup(it) },
                            onCreateClick = { viewModel.showCreateDialog() },
                            onInviteCodeChange = { viewModel.updateInviteCode(it) },
                            onJoinGroup = { viewModel.joinGroupByCode() },
                            onRefresh = { viewModel.refresh() }
                        )
                    }
                    GroupViewModel.ViewState.DETAIL -> {
                        selectedGroup?.let { group ->
                            GroupDetailContent(
                                group = group,
                                members = groupMembers,
                                memberCount = groupMemberCounts[group.sgtIdx] ?: groupMembers.size,
                                scheduleCount = weeklyScheduleCount,
                                locationCount = totalLocationCount,
                                isLoading = isMembersLoading,
                                isOwner = viewModel.isCurrentUserOwner(),
                                currentUserIdx = viewModel.currentUserIdx(),
                                onEditClick = { viewModel.showEditDialog() },
                                onDeleteClick = { viewModel.showDeleteDialog() },
                                // 삭제와 나가기는 같은 확인 대화상자를 쓰고 isLeave 로 구분한다.
                                onLeaveClick = { viewModel.showDeleteDialog() },
                                onInviteClick = { viewModel.showInviteBottomSheet() },
                                onCopyCode = {
                                    group.sgtCode?.let {
                                        clipboardManager.setText(AnnotatedString(it))
                                        viewModel.showSuccess("초대 코드를 복사했어요")
                                    }
                                },
                                onMemberClick = { member -> viewModel.showMemberManageDialog(member) }
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

