package com.dmonster.smap.ui.settings

import com.dmonster.smap.ui.components.SmapDialogActions
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import com.dmonster.smap.ui.components.SmapAvatar
import com.dmonster.smap.ui.components.SmapDangerIcon
import com.dmonster.smap.ui.components.SmapListRow
import com.dmonster.smap.ui.components.SmapRowDivider
import com.dmonster.smap.ui.components.SmapRowIcon
import com.dmonster.smap.ui.components.SmapSection
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapTextButton
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SuiteFont

enum class AccountSubScreen {
    NONE, EDIT_PROFILE, CHANGE_PASSWORD, WITHDRAW, EMAIL
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val result by viewModel.result.collectAsState()
    val scope = rememberCoroutineScope()
    var imageMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    
    var currentScreen by remember { mutableStateOf(AccountSubScreen.NONE) }
    BackHandler(enabled = currentScreen != AccountSubScreen.NONE) { currentScreen = AccountSubScreen.NONE }
    var showingLogoutAlert by remember { mutableStateOf(false) }
    var isUploadingImage by remember { mutableStateOf(false) }
    
    // Photo picker launcher
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            isUploadingImage = true
            scope.launch {
                try {
                    val bytes = withContext(Dispatchers.IO) {
                        context.contentResolver.openInputStream(it)?.use { stream -> stream.readBytes() }
                            ?: throw java.io.IOException("이미지를 열 수 없습니다.")
                    }
                    viewModel.uploadProfileImage(bytes)
                } catch (e: Exception) {
                    isUploadingImage = false
                    imageMessage = "이미지를 불러오지 못했습니다."
                }
            }
        }
    }

    LaunchedEffect(result) {
        result?.takeIf { it.operation == "image" }?.let {
            isUploadingImage = false
            imageMessage = it.message
            viewModel.clearResult()
        }
    }
    imageMessage?.let { message ->
        AlertDialog(onDismissRequest = { imageMessage = null }, title = { Text("알림") },
            text = { Text(message) }, confirmButton = { TextButton(onClick = { imageMessage = null }) { Text("확인") } })
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Main Account Settings Content
        AnimatedVisibility(
            visible = currentScreen == AccountSubScreen.NONE,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> -fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> -fullWidth },
                animationSpec = tween(300)
            )
        ) {
            val colors = MaterialTheme.colorScheme
            Box(modifier = Modifier.fillMaxSize().background(colors.surface)) {
                Column(modifier = Modifier.fillMaxSize()) {
                    SmapTopBar(title = "계정설정", onBack = onBack)
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = SmapSpacing.md),
                        verticalArrangement = Arrangement.spacedBy(SmapSpacing.lg)
                    ) {
                        Spacer(Modifier.height(SmapSpacing.xs))
                        // 이메일 미등록 회원 안내(비밀번호 찾기에 필요)
                        if (user != null && user?.mtEmail.isNullOrBlank()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                SmapBanner(
                                    message = "이메일을 등록해 주세요. 비밀번호를 잊었을 때 필요해요.",
                                    tone = SmapBannerTone.Info,
                                )
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    SmapTextButton(text = "등록하기", onClick = { currentScreen = AccountSubScreen.EMAIL })
                                }
                            }
                        }

                        SmapSection(title = "계정 관리") {
                            SmapListRow(
                                title = "프로필 사진 변경",
                                leading = {
                                    SmapAvatar(
                                        name = user?.displayName ?: "회원",
                                        imagePath = user?.mtFile1,
                                        size = 40.dp,
                                        modifier = Modifier.clearAndSetSemantics {}
                                    )
                                },
                                trailing = {
                                    if (isUploadingImage) {
                                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                    } else {
                                        RowChevron()
                                    }
                                },
                                onClick = if (isUploadingImage) null else ({
                                    photoPickerLauncher.launch("image/*")
                                })
                            )
                            SmapRowDivider()
                            SmapListRow(
                                title = "프로필 편집",
                                leading = { SmapRowIcon(Icons.Default.Edit) },
                                trailing = { RowChevron() },
                                onClick = { currentScreen = AccountSubScreen.EDIT_PROFILE }
                            )
                            SmapRowDivider()
                            SmapListRow(
                                title = "비밀번호 변경",
                                leading = { SmapRowIcon(Icons.Default.Lock) },
                                trailing = { RowChevron() },
                                onClick = { currentScreen = AccountSubScreen.CHANGE_PASSWORD }
                            )
                            SmapRowDivider()
                            val registeredEmail = user?.mtEmail?.takeIf { it.isNotBlank() }
                            SmapListRow(
                                title = "이메일",
                                leading = { SmapRowIcon(Icons.Default.Email) },
                                trailing = {
                                    RowValue(registeredEmail ?: "등록 필요", alert = registeredEmail == null)
                                    RowChevron()
                                },
                                onClick = { currentScreen = AccountSubScreen.EMAIL }
                            )
                        }

                        user?.let { u ->
                            SmapSection(title = "내 정보") {
                                // 휴대폰 가입 회원은 없다(이메일 가입) — 아이디가 이메일이라 "휴대폰" 칸에 이메일이 보이던 행을 뺐다.
                                SmapListRow(title = "닉네임", leading = { SmapRowIcon(Icons.Default.AlternateEmail) }, trailing = { RowValue(u.mtNickname ?: "-") })
                                SmapRowDivider()
                                SmapListRow(
                                    title = "로그인 방식",
                                    leading = { SmapRowIcon(Icons.Default.VpnKey) },
                                    trailing = {
                                        RowValue(
                                            when (u.mtType) {
                                                2 -> "카카오"
                                                3 -> "Apple"
                                                4 -> "Google"
                                                else -> "일반"
                                            }
                                        )
                                    }
                                )
                                SmapRowDivider()
                                // iOS 에는 있던 가입일을 같이 보여 준다(양쪽 같은 항목).
                                SmapListRow(title = "가입일", leading = { SmapRowIcon(Icons.Default.CalendarMonth) }, trailing = { RowValue(u.mtWdate?.take(10) ?: "-") })
                            }
                        }

                        SmapSection {
                            SmapListRow(
                                title = "로그아웃",
                                destructive = true,
                                leading = { SmapDangerIcon(Icons.AutoMirrored.Filled.Logout) },
                                onClick = { showingLogoutAlert = true }
                            )
                        }

                        // 회원 탈퇴 — 실수로 누르지 않게 작은 글자 링크로 둔다(탈퇴 화면에서 한 번 더 확인).
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "회원 탈퇴",
                                style = SmapText.caption,
                                color = colors.onSurfaceVariant,
                                textDecoration = TextDecoration.Underline,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable(role = Role.Button) { currentScreen = AccountSubScreen.WITHDRAW }
                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(SmapSpacing.xl))
                    }
                }

                // 사진 업로드 진행 상태는 해당 행에서 표시한다.
                if (isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = colors.primary)
                    }
                }
            }
        }
        
        // Edit Profile Screen with Animation
        AnimatedVisibility(
            visible = currentScreen == AccountSubScreen.EDIT_PROFILE,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            EditProfileScreen(
                onBack = { currentScreen = AccountSubScreen.NONE },
                viewModel = viewModel
            )
        }
        
        // Change Password Screen with Animation
        AnimatedVisibility(
            visible = currentScreen == AccountSubScreen.CHANGE_PASSWORD,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            ChangePasswordScreen(
                onBack = { currentScreen = AccountSubScreen.NONE },
                viewModel = viewModel
            )
        }

        // Email Register/Change Screen with Animation
        AnimatedVisibility(
            visible = currentScreen == AccountSubScreen.EMAIL,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            EmailChangeScreen(
                onBack = { currentScreen = AccountSubScreen.NONE },
                onCompleted = {
                    viewModel.reloadStoredUser()
                    currentScreen = AccountSubScreen.NONE
                }
            )
        }

        // Withdraw Screen with Animation
        AnimatedVisibility(
            visible = currentScreen == AccountSubScreen.WITHDRAW,
            enter = slideInHorizontally(
                initialOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            ),
            exit = slideOutHorizontally(
                targetOffsetX = { fullWidth -> fullWidth },
                animationSpec = tween(300)
            )
        ) {
            WithdrawScreen(
                onBack = { currentScreen = AccountSubScreen.NONE },
                onSuccess = onLogout,
                viewModel = viewModel
            )
        }
    }

    if (showingLogoutAlert) {
        AlertDialog(
            onDismissRequest = { showingLogoutAlert = false },
            title = { Text("로그아웃", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text("정말로 로그아웃 하시겠습니까?", fontFamily = SuiteFont) },
            confirmButton = {
                SmapDialogActions(
                    confirmText = "로그아웃",
                    onConfirm = {
                        showingLogoutAlert = false
                        viewModel.logout(onLogout)
                    },
                    onDismiss = { showingLogoutAlert = false },
                    destructive = true
                )
            }
        )
    }
}

/** 행 오른쪽 값 — 길면 줄임. [alert] 면 빨강 굵게(예: 이메일 "등록 필요"). */
@Composable
private fun RowValue(text: String, alert: Boolean = false) {
    Text(
        text = text,
        style = if (alert) SmapText.captionBold else SmapText.caption,
        color = if (alert) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.widthIn(max = 180.dp)
    )
}

@Composable
private fun RowChevron() {
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(20.dp))
}
