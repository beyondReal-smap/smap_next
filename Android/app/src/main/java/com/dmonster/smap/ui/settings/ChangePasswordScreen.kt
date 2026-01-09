package com.dmonster.smap.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()
    
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    
    var showCurrentPassword by remember { mutableStateOf(false) }
    var showNewPassword by remember { mutableStateOf(false) }
    var showConfirmPassword by remember { mutableStateOf(false) }
    
    var showResultDialog by remember { mutableStateOf(false) }
    var dialogMessage by remember { mutableStateOf("") }
    var isSuccess by remember { mutableStateOf(false) }
    
    // Password validation
    val isLengthValid = newPassword.length in 8..20
    val hasLetter = newPassword.any { it.isLetter() }
    val hasNumber = newPassword.any { it.isDigit() }
    val hasSpecial = newPassword.any { !it.isLetterOrDigit() }
    val isPasswordStrong = isLengthValid && hasLetter && hasNumber && hasSpecial
    val isPasswordMatch = newPassword.isNotEmpty() && newPassword == confirmPassword
    
    // Check if social login user
    val isSocialUser = user?.mtType?.let { it != 1 } ?: false
    
    // Handle message from ViewModel
    LaunchedEffect(userMessage) {
        userMessage?.let { msg ->
            dialogMessage = msg
            isSuccess = msg.contains("성공") || msg.contains("변경")
            showResultDialog = true
            viewModel.clearMessage()
        }
    }

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
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
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
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                if (isSocialUser) {
                    // Social User View
                    SocialUserNotice(onBack = onBack)
                } else {
                    // Password Change Form
                    PasswordChangeForm(
                        currentPassword = currentPassword,
                        newPassword = newPassword,
                        confirmPassword = confirmPassword,
                        showCurrentPassword = showCurrentPassword,
                        showNewPassword = showNewPassword,
                        showConfirmPassword = showConfirmPassword,
                        onCurrentPasswordChange = { currentPassword = it },
                        onNewPasswordChange = { newPassword = it },
                        onConfirmPasswordChange = { confirmPassword = it },
                        onToggleCurrentPassword = { showCurrentPassword = !showCurrentPassword },
                        onToggleNewPassword = { showNewPassword = !showNewPassword },
                        onToggleConfirmPassword = { showConfirmPassword = !showConfirmPassword },
                        isLengthValid = isLengthValid,
                        hasLetter = hasLetter,
                        hasNumber = hasNumber,
                        hasSpecial = hasSpecial,
                        isPasswordMatch = isPasswordMatch,
                        isPasswordStrong = isPasswordStrong,
                        isLoading = isLoading,
                        onSubmit = {
                            viewModel.changePassword(currentPassword, newPassword)
                        }
                    )
                }
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
    
    if (showResultDialog) {
        AlertDialog(
            onDismissRequest = { 
                showResultDialog = false
                if (isSuccess) onBack()
            },
            title = { Text("알림", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text(dialogMessage, fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = { 
                    showResultDialog = false
                    if (isSuccess) onBack()
                }) {
                    Text("확인", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, color = BrandColors.Primary)
                }
            }
        )
    }
}

@Composable
private fun SocialUserNotice(onBack: () -> Unit) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.Shield,
                contentDescription = null,
                tint = Color(0xFFFFA726),
                modifier = Modifier.size(60.dp)
            )
            Text(
                text = "소셜 로그인 사용자는\n비밀번호를 변경할 수 없습니다.",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Color.Black,
                lineHeight = 26.sp,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Text(
                text = "Google 또는 Apple 계정을 통해 로그인하신 경우, 해당 서비스의 설정에서 비밀번호를 관리해 주세요.",
                fontFamily = SuiteFont,
                fontSize = 14.sp,
                color = Color.Gray,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
            ) {
                Text("뒤로 가기", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            }
        }
    }
}

@Composable
private fun PasswordChangeForm(
    currentPassword: String,
    newPassword: String,
    confirmPassword: String,
    showCurrentPassword: Boolean,
    showNewPassword: Boolean,
    showConfirmPassword: Boolean,
    onCurrentPasswordChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onToggleCurrentPassword: () -> Unit,
    onToggleNewPassword: () -> Unit,
    onToggleConfirmPassword: () -> Unit,
    isLengthValid: Boolean,
    hasLetter: Boolean,
    hasNumber: Boolean,
    hasSpecial: Boolean,
    isPasswordMatch: Boolean,
    isPasswordStrong: Boolean,
    isLoading: Boolean,
    onSubmit: () -> Unit
) {
    // Header Card
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(BrandColors.Primary, Color(0xFF667EEA))),
                RoundedCornerShape(20.dp)
            )
            .padding(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "비밀번호 변경",
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = Color.White
            )
            Text(
                text = "보안을 위해 8~20자의 영문, 숫자,\n특수문자를 조합하여 설정해 주세요.",
                fontFamily = SuiteFont,
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.85f),
                lineHeight = 20.sp
            )
        }
    }
    
    // Password Fields
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            PasswordField(
                label = "현재 비밀번호",
                value = currentPassword,
                onValueChange = onCurrentPasswordChange,
                showPassword = showCurrentPassword,
                onTogglePassword = onToggleCurrentPassword
            )
            
            PasswordField(
                label = "새 비밀번호",
                value = newPassword,
                onValueChange = onNewPasswordChange,
                showPassword = showNewPassword,
                onTogglePassword = onToggleNewPassword
            )
            
            // Password Strength Indicators
            if (newPassword.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    PasswordRequirement("8~20자", isLengthValid)
                    PasswordRequirement("영문 포함", hasLetter)
                    PasswordRequirement("숫자 포함", hasNumber)
                    PasswordRequirement("특수문자 포함", hasSpecial)
                }
            }
            
            PasswordField(
                label = "새 비밀번호 확인",
                value = confirmPassword,
                onValueChange = onConfirmPasswordChange,
                showPassword = showConfirmPassword,
                onTogglePassword = onToggleConfirmPassword
            )
            
            if (confirmPassword.isNotEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        if (isPasswordMatch) Icons.Default.CheckCircle else Icons.Default.Cancel,
                        contentDescription = null,
                        tint = if (isPasswordMatch) Color(0xFF4CAF50) else Color(0xFFE53935),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = if (isPasswordMatch) "비밀번호가 일치합니다" else "비밀번호가 일치하지 않습니다",
                        fontFamily = SuiteFont,
                        fontSize = 12.sp,
                        color = if (isPasswordMatch) Color(0xFF4CAF50) else Color(0xFFE53935)
                    )
                }
            }
        }
    }
    
    // Submit Button
    Button(
        onClick = onSubmit,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary),
        enabled = !isLoading && currentPassword.isNotEmpty() && isPasswordStrong && isPasswordMatch
    ) {
        if (isLoading) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
        } else {
            Text("비밀번호 변경", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        }
    }
}

@Composable
private fun PasswordField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    showPassword: Boolean,
    onTogglePassword: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontFamily = SuiteFont, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = onTogglePassword) {
                    Icon(
                        if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = null,
                        tint = Color.Gray
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f)
            )
        )
    }
}

@Composable
private fun PasswordRequirement(text: String, met: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            if (met) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (met) Color(0xFF4CAF50) else Color.Gray.copy(alpha = 0.4f),
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = text,
            fontFamily = SuiteFont,
            fontSize = 12.sp,
            color = if (met) Color(0xFF4CAF50) else Color.Gray.copy(alpha = 0.6f)
        )
    }
}
