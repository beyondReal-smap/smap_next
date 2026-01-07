package com.dmonster.smap.ui.login

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 비밀번호 찾기 화면 (iOS ForgotPasswordView 참고)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgotPasswordScreen(
    onDismiss: () -> Unit,
    viewModel: ForgotPasswordViewModel = viewModel()
) {
    val currentStep by viewModel.currentStep.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()
    val verificationCode by viewModel.verificationCode.collectAsState()
    val verificationTimer by viewModel.verificationTimer.collectAsState()
    val newPassword by viewModel.newPassword.collectAsState()
    val confirmPassword by viewModel.confirmPassword.collectAsState()
    val showNewPassword by viewModel.showNewPassword.collectAsState()
    val showConfirmPassword by viewModel.showConfirmPassword.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    
    // Snackbar for errors
    val snackbarHostState = remember { SnackbarHostState() }
    
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearError()
        }
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    if (!viewModel.goBack()) {
                        onDismiss()
                    }
                }) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.Black
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
            }
            
            // Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
            ) {
                // Title Section
                TitleSection(currentStep)
                
                Spacer(modifier = Modifier.height(30.dp))
                
                // Step Content with Animation
                AnimatedContent(
                    targetState = currentStep,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                                slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "step_transition"
                ) { step ->
                    when (step) {
                        ForgotPasswordViewModel.Step.PHONE -> PhoneStepContent(
                            phoneNumber = phoneNumber,
                            onPhoneChange = { viewModel.updatePhoneNumber(it) },
                            onSendCode = { viewModel.checkUserAndSendCode() },
                            isLoading = isLoading
                        )
                        ForgotPasswordViewModel.Step.VERIFICATION -> VerificationStepContent(
                            verificationCode = verificationCode,
                            onCodeChange = { viewModel.updateVerificationCode(it) },
                            timer = verificationTimer,
                            onVerify = { viewModel.verifyCode() },
                            onResend = { viewModel.checkUserAndSendCode() }
                        )
                        ForgotPasswordViewModel.Step.NEW_PASSWORD -> NewPasswordStepContent(
                            newPassword = newPassword,
                            confirmPassword = confirmPassword,
                            showNewPassword = showNewPassword,
                            showConfirmPassword = showConfirmPassword,
                            onNewPasswordChange = { viewModel.updateNewPassword(it) },
                            onConfirmPasswordChange = { viewModel.updateConfirmPassword(it) },
                            onToggleNewPassword = { viewModel.toggleShowNewPassword() },
                            onToggleConfirmPassword = { viewModel.toggleShowConfirmPassword() },
                            isPasswordLengthValid = viewModel.isPasswordLengthValid,
                            hasPasswordLetter = viewModel.hasPasswordLetter,
                            hasPasswordNumber = viewModel.hasPasswordNumber,
                            hasPasswordSpecialChar = viewModel.hasPasswordSpecialChar,
                            passwordsMatch = viewModel.passwordsMatch,
                            isRulesSatisfied = viewModel.isPasswordRulesSatisfied,
                            onResetPassword = { viewModel.resetPassword() },
                            isLoading = isLoading
                        )
                        ForgotPasswordViewModel.Step.COMPLETE -> CompleteStepContent(
                            onDismiss = onDismiss
                        )
                    }
                }
            }
        }
        
        // Loading Overlay
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    color = BrandColors.Primary,
                    modifier = Modifier.size(48.dp)
                )
            }
        }
        
        // Snackbar Host
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun TitleSection(currentStep: ForgotPasswordViewModel.Step) {
    val (title, description) = when (currentStep) {
        ForgotPasswordViewModel.Step.PHONE -> "비밀번호 찾기" to "가입하실 때 사용한 전화번호를 입력해주세요."
        ForgotPasswordViewModel.Step.VERIFICATION -> "인증번호 입력" to "전화번호로 발송된 6자리 인증번호를 입력해주세요."
        ForgotPasswordViewModel.Step.NEW_PASSWORD -> "새 비밀번호 설정" to "새로운 비밀번호를 설정해주세요."
        ForgotPasswordViewModel.Step.COMPLETE -> "설정 완료" to "비밀번호가 성공적으로 변경되었습니다."
    }
    
    Column {
        Text(
            text = title,
            fontSize = 28.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = description,
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color.Gray
        )
    }
}

@Composable
private fun PhoneStepContent(
    phoneNumber: String,
    onPhoneChange: (String) -> Unit,
    onSendCode: () -> Unit,
    isLoading: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(40.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "전화번호",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.SemiBold,
                color = Color.Gray
            )
            
            OutlinedTextField(
                value = phoneNumber,
                onValueChange = onPhoneChange,
                placeholder = { Text("010-0000-0000", fontFamily = SuiteFont) },
                visualTransformation = ForgotPhoneVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    focusedBorderColor = BrandColors.Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = Color.Transparent
                ),
                singleLine = true
            )
        }
        
        Button(
            onClick = onSendCode,
            enabled = phoneNumber.replace("-", "").length >= 10 && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = BrandColors.Primary,
                disabledContainerColor = Color.Gray.copy(alpha = 0.3f)
            )
        ) {
            Text(
                text = "인증번호 받기",
                fontSize = 18.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun VerificationStepContent(
    verificationCode: String,
    onCodeChange: (String) -> Unit,
    timer: Int,
    onVerify: () -> Unit,
    onResend: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(40.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "인증번호",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Gray
                )
                if (timer > 0) {
                    Text(
                        text = String.format("%d:%02d", timer / 60, timer % 60),
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Medium,
                        color = Color.Red
                    )
                }
            }
            
            OutlinedTextField(
                value = verificationCode,
                onValueChange = onCodeChange,
                placeholder = { Text("6자리 입력", fontFamily = SuiteFont) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    focusedBorderColor = BrandColors.Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = Color.Transparent
                ),
                singleLine = true
            )
        }
        
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Button(
                onClick = onVerify,
                enabled = verificationCode.length == 6,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrandColors.Primary,
                    disabledContainerColor = Color.Gray.copy(alpha = 0.3f)
                )
            ) {
                Text(
                    text = "인증하기",
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            TextButton(
                onClick = onResend,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text(
                    text = "인증번호 재발송",
                    fontSize = 14.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Medium,
                    color = Color.Gray
                )
            }
        }
    }
}

@Composable
private fun NewPasswordStepContent(
    newPassword: String,
    confirmPassword: String,
    showNewPassword: Boolean,
    showConfirmPassword: Boolean,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onToggleNewPassword: () -> Unit,
    onToggleConfirmPassword: () -> Unit,
    isPasswordLengthValid: Boolean,
    hasPasswordLetter: Boolean,
    hasPasswordNumber: Boolean,
    hasPasswordSpecialChar: Boolean,
    passwordsMatch: Boolean,
    isRulesSatisfied: Boolean,
    onResetPassword: () -> Unit,
    isLoading: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(30.dp)) {
        // New Password Field
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "새 비밀번호",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.SemiBold,
                color = Color.Gray
            )
            
            OutlinedTextField(
                value = newPassword,
                onValueChange = onNewPasswordChange,
                placeholder = { Text("8자 이상, 영문/숫자/특수문자 포함", fontFamily = SuiteFont) },
                visualTransformation = if (showNewPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = onToggleNewPassword) {
                        Icon(
                            imageVector = if (showNewPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = "Toggle password visibility",
                            tint = Color.Gray
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    focusedBorderColor = BrandColors.Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = Color.Transparent
                ),
                singleLine = true
            )
            
            // Password Rules
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                PasswordRuleRow(text = "8자 이상", isValid = isPasswordLengthValid)
                PasswordRuleRow(text = "영문 포함", isValid = hasPasswordLetter)
                PasswordRuleRow(text = "숫자 포함", isValid = hasPasswordNumber)
                PasswordRuleRow(text = "특수문자 포함", isValid = hasPasswordSpecialChar)
            }
        }
        
        // Confirm Password Field
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "비밀번호 확인",
                fontSize = 14.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.SemiBold,
                color = Color.Gray
            )
            
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = onConfirmPasswordChange,
                placeholder = { Text("다시 입력해주세요", fontFamily = SuiteFont) },
                visualTransformation = if (showConfirmPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = onToggleConfirmPassword) {
                        Icon(
                            imageVector = if (showConfirmPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = "Toggle password visibility",
                            tint = Color.Gray
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    focusedBorderColor = BrandColors.Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = Color.Transparent
                ),
                singleLine = true
            )
            
            if (confirmPassword.isNotEmpty() && !passwordsMatch) {
                Text(
                    text = "비밀번호가 일치하지 않습니다.",
                    fontSize = 12.sp,
                    fontFamily = SuiteFont,
                    color = Color.Red
                )
            }
        }
        
        Spacer(modifier = Modifier.height(10.dp))
        
        Button(
            onClick = onResetPassword,
            enabled = isRulesSatisfied && passwordsMatch && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = BrandColors.Primary,
                disabledContainerColor = Color.Gray.copy(alpha = 0.3f)
            )
        ) {
            Text(
                text = "비밀번호 변경",
                fontSize = 18.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun PasswordRuleRow(text: String, isValid: Boolean) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isValid) Icons.Filled.CheckCircle else Icons.Filled.Cancel,
            contentDescription = null,
            tint = if (isValid) Color(0xFF22C55E) else Color.Gray.copy(alpha = 0.5f),
            modifier = Modifier.size(16.dp)
        )
        Text(
            text = text,
            fontSize = 12.sp,
            fontFamily = SuiteFont,
            color = if (isValid) Color(0xFF22C55E) else Color.Gray.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun CompleteStepContent(onDismiss: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(40.dp)
    ) {
        Spacer(modifier = Modifier.height(40.dp))
        
        // Success Icon
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(Color(0xFF22C55E).copy(alpha = 0.1f), RoundedCornerShape(50.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = "Success",
                tint = Color(0xFF22C55E),
                modifier = Modifier.size(60.dp)
            )
        }
        
        Text(
            text = "비밀번호가 변경되었습니다!\n새 비밀번호로 로그인해주세요.",
            fontSize = 16.sp,
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            color = Color.Gray,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(20.dp))
        
        Button(
            onClick = onDismiss,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
        ) {
            Text(
                text = "로그인으로 돌아가기",
                fontSize = 18.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

/**
 * 전화번호를 하이픈으로 포맷팅하는 VisualTransformation
 */
private class ForgotPhoneVisualTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val digits = text.text
        val formatted = buildString {
            digits.forEachIndexed { index, c ->
                if (index == 3 || index == 7) append('-')
                append(c)
            }
        }
        
        val offsetMapping = object : OffsetMapping {
            override fun originalToTransformed(offset: Int): Int {
                return when {
                    offset <= 3 -> offset
                    offset <= 7 -> offset + 1
                    else -> offset + 2
                }.coerceAtMost(formatted.length)
            }
            
            override fun transformedToOriginal(offset: Int): Int {
                return when {
                    offset <= 3 -> offset
                    offset <= 4 -> offset // 하이픈 위치 대응
                    offset <= 8 -> offset - 1
                    offset <= 9 -> offset - 1 // 하이픈 위치 대응
                    else -> offset - 2
                }.coerceAtMost(digits.length)
            }
        }
        
        return TransformedText(AnnotatedString(formatted), offsetMapping)
    }
}
