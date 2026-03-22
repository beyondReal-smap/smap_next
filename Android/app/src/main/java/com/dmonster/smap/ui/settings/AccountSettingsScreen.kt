package com.dmonster.smap.ui.settings

import com.dmonster.smap.BuildConfig
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.BrandColors

enum class AccountSubScreen {
    NONE, EDIT_PROFILE, CHANGE_PASSWORD, WITHDRAW
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
    val userMessage by viewModel.userMessage.collectAsState()
    val context = LocalContext.current
    
    var currentScreen by remember { mutableStateOf(AccountSubScreen.NONE) }
    var showingLogoutAlert by remember { mutableStateOf(false) }
    var isUploadingImage by remember { mutableStateOf(false) }
    
    // Photo picker launcher
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            isUploadingImage = true
            context.contentResolver.openInputStream(it)?.use { inputStream ->
                val bytes = inputStream.readBytes()
                viewModel.uploadProfileImage(bytes)
            }
        }
    }
    
    // Handle upload result
    LaunchedEffect(userMessage) {
        if (userMessage?.contains("이미지") == true) {
            isUploadingImage = false
            viewModel.clearMessage()
        }
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
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFF7F7F7))
            ) {
                Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
                    // Header
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 20.dp)
                    ) {
                        Surface(
                            onClick = onBack,
                            shape = RoundedCornerShape(24.dp),
                            color = Color.White,
                            shadowElevation = 2.dp,
                            modifier = Modifier.height(44.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                    contentDescription = "뒤로",
                                    tint = Color.Black,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "설정",
                                    fontFamily = SuiteFont,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    color = Color.Black
                                )
                            }
                        }
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Profile Header Card with Photo Upload
                        ProfileHeaderWithUpload(
                            name = user?.displayName ?: "사용자",
                            email = user?.mtEmail ?: "이메일 정보 없음",
                            profileImage = user?.mtFile1,
                            isUploading = isUploadingImage,
                            onPhotoClick = { photoPickerLauncher.launch("image/*") }
                        )

                        // Account Management
                        SettingsSection(title = "계정 관리") {
                            AccountSettingsRow(
                                icon = Icons.Default.Edit,
                                iconColor = Color(0xFF5C6BC0),
                                title = "프로필 편집",
                                onClick = { currentScreen = AccountSubScreen.EDIT_PROFILE }
                            )
                            HorizontalDivider(modifier = Modifier.padding(start = 52.dp), thickness = 0.5.dp, color = Color.Gray.copy(alpha = 0.1f))
                            AccountSettingsRow(
                                icon = Icons.Default.Lock,
                                iconColor = Color(0xFFF06292),
                                title = "비밀번호 변경",
                                onClick = { currentScreen = AccountSubScreen.CHANGE_PASSWORD }
                            )
                        }

                        // Info Section
                        user?.let { u ->
                            SettingsSection(title = "내 정보") {
                                val isSocialLogin = u.mtType in listOf(2, 3, 4)
                                if (!isSocialLogin) {
                                    AccountInfoRow(icon = Icons.Default.Phone, iconColor = BrandColors.Primary, title = "휴대폰", value = u.mtId ?: "-")
                                    HorizontalDivider(modifier = Modifier.padding(start = 52.dp), thickness = 0.5.dp, color = Color.Gray.copy(alpha = 0.1f))
                                }
                                AccountInfoRow(icon = Icons.Default.AlternateEmail, iconColor = Color(0xFFFFA726), title = "닉네임", value = u.mtNickname ?: "-")
                                HorizontalDivider(modifier = Modifier.padding(start = 52.dp), thickness = 0.5.dp, color = Color.Gray.copy(alpha = 0.1f))
                                AccountInfoRow(
                                    icon = Icons.Default.VpnKey,
                                    iconColor = Color(0xFF9C27B0),
                                    title = "로그인 방식",
                                    value = when (u.mtType) {
                                        1 -> "일반"
                                        2 -> "카카오"
                                        3 -> "Apple"
                                        4 -> "Google"
                                        else -> "일반"
                                    }
                                )
                            }
                        }

                        // Logout Section
                        SettingsSection(title = "지원") {
                            AccountSettingsRow(
                                icon = Icons.AutoMirrored.Filled.Logout,
                                iconColor = Color.Red.copy(alpha = 0.7f),
                                title = "로그아웃",
                                onClick = { showingLogoutAlert = true }
                            )
                        }

                        // Withdrawal Link
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "회원 탈퇴",
                                fontFamily = SuiteFont,
                                fontSize = 13.sp,
                                color = Color.Gray.copy(alpha = 0.5f),
                                modifier = Modifier.clickable { currentScreen = AccountSubScreen.WITHDRAW }
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(40.dp))
                    }
                }

                if (isLoading || isUploadingImage) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = BrandColors.Primary)
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
                TextButton(onClick = {
                    showingLogoutAlert = false
                    viewModel.logout(onLogout)
                }) {
                    Text("로그아웃", color = Color.Red, fontFamily = SuiteFont, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showingLogoutAlert = false }) {
                    Text("취소", fontFamily = SuiteFont)
                }
            }
        )
    }
}

@Composable
fun ProfileHeaderWithUpload(
    name: String,
    email: String,
    profileImage: String?,
    isUploading: Boolean,
    onPhotoClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(BrandColors.Primary, Color(0xFF667EEA))
                )
            )
            .padding(24.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Avatar with camera button
            Box(contentAlignment = Alignment.BottomEnd) {
                if (isUploading) {
                    Box(
                        modifier = Modifier.size(80.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(32.dp), strokeWidth = 2.dp)
                    }
                } else if (!profileImage.isNullOrBlank()) {
                    val imageUrl = when {
                        profileImage.startsWith("http") -> profileImage
                        profileImage.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}$profileImage"
                        profileImage.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images$profileImage"
                        else -> "${BuildConfig.IMAGE_BASE_URL}/images/$profileImage"
                    }
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.2f))
                    )
                } else {
                    Box(
                        modifier = Modifier.size(80.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(40.dp))
                    }
                }
                
                // Camera Button
                Surface(
                    onClick = onPhotoClick,
                    shape = CircleShape,
                    color = BrandColors.Primary,
                    modifier = Modifier.size(28.dp).offset(x = 2.dp, y = 2.dp),
                    border = BorderStroke(2.dp, Color.White)
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(Icons.Default.CameraAlt, contentDescription = "사진 변경", tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
            }

            Column {
                Text(
                    text = name,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Color.White
                )
                Text(
                    text = email,
                    fontFamily = SuiteFont,
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }
    }
}

@Composable
fun SettingsSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = title,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier.padding(start = 4.dp)
        )
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth(),
            shadowElevation = 1.dp
        ) {
            Column(content = content)
        }
    }
}

@Composable
fun AccountSettingsRow(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(iconColor.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp))
        }
        Text(
            text = title,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            fontSize = 15.sp,
            color = Color.Black,
            modifier = Modifier.weight(1f)
        )
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Color.Gray.copy(alpha = 0.3f), modifier = Modifier.size(16.dp))
    }
}

@Composable
fun AccountInfoRow(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(iconColor.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontFamily = SuiteFont,
                fontSize = 11.sp,
                color = Color.Gray
            )
            Text(
                text = value,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium,
                fontSize = 15.sp,
                color = Color.Black
            )
        }
    }
}
