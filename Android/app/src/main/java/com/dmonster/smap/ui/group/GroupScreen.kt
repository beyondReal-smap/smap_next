package com.dmonster.smap.ui.group

import com.dmonster.smap.BuildConfig
import android.content.Intent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.theme.FamilyColors
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 그룹 화면 — 목록 위에 상세를 바텀시트로 띄운다.
 * 이전에는 상세를 옆에서 밀려 들어오는 화면 + "그룹" 머리 줄로 보여 줬는데, 남색 요약 카드와 머리 줄이 겹쳐 어색했다(2026-11-20).
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
    
    val isDetailOpen = currentView == GroupViewModel.ViewState.DETAIL
    Scaffold(
        // 상세 시트가 열려 있으면 알림 줄은 시트 안에 띄운다(시트는 별도 창이라 아래 화면의 알림 줄을 가린다).
        snackbarHost = { if (!isDetailOpen) SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            GroupListContent(
                groups = groups,
                groupMemberCounts = groupMemberCounts,
                userName = viewModel.currentUserName(),
                currentUserIdx = viewModel.currentUserIdx(),
                inviteCode = inviteCode,
                isLoading = isLoading,
                isJoining = isJoining,
                isRefreshing = isRefreshing,
                onGroupClick = { viewModel.selectGroup(it) },
                onCreateClick = { viewModel.showCreateDialog() },
                onInviteCodeChange = { viewModel.updateInviteCode(it) },
                onPasteInviteCode = { viewModel.pasteInviteCode(it) },
                onJoinGroup = { viewModel.joinGroupByCode() },
                onRefresh = { viewModel.refresh() }
            )
        }
    }

    // 그룹 상세 — 끝까지 펼친 바텀시트. 아래로 끌거나 뒤로 가기로 닫으면 목록으로 돌아간다.
    if (isDetailOpen) {
        selectedGroup?.let { group ->
            // 시트 바탕을 상세 내용 바탕(종이색)과 맞춰 손잡이 영역과 내용이 한 장으로 보이게.
            val sheetColor = if (isSystemInDarkTheme()) MaterialTheme.colorScheme.background else FamilyColors.Paper
            ModalBottomSheet(
                onDismissRequest = { viewModel.backToList() },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                containerColor = sheetColor,
            ) {
                // 끝까지 채우면 상태 표시줄까지 덮어 전체 화면처럼 보인다 → 위쪽을 조금 남겨 뒤의 목록이 보이게(iOS 큰 시트와 같은 느낌).
                Box(Modifier.fillMaxHeight(0.92f)) {
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
                    SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter).navigationBarsPadding())
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
                    val message = "[도착했어] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: ${inviteLink(group.sgtIdx, group.sgtCode)}"
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
                    val message = "[도착했어] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: ${inviteLink(group.sgtIdx, group.sgtCode)}"
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
                    val message = "[도착했어] ${group.sgtTitle} 그룹에 초대합니다!\n초대 코드: $code\n링크: $link"
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

