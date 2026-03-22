package com.dmonster.smap.ui.register

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.viewinterop.AndroidView
import android.view.ContextThemeWrapper
import android.widget.DatePicker
import java.util.Calendar
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.R
import com.dmonster.smap.data.model.RegisterStep
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

/**
 * 회원가입 화면 (iOS NativeRegisterView 기반)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    viewModel: RegisterViewModel = hiltViewModel(),
    onComplete: () -> Unit = {},
    onBack: () -> Unit = {},
    onExistingUser: (String) -> Unit = {},
    socialData: Map<String, String>? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    
    // 소셜 데이터 적용
    LaunchedEffect(socialData) {
        viewModel.applySocialData(socialData)
    }
    
    // 기존 가입자 발견 시 - AlertDialog 표시
    if (uiState.showExistingUserAlert) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissExistingUserAlert() },
            title = {
                Text(
                    text = "이미 가입된 전화번호",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "이미 가입된 전화번호입니다.\n로그인 페이지로 이동하시겠습니까?",
                    fontFamily = SuiteFont
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onExistingUser(uiState.existingUserPhone)
                        viewModel.dismissExistingUserAlert()
                    }
                ) {
                    Text(
                        text = "로그인으로 이동",
                        fontFamily = SuiteFont,
                        color = BrandColors.Primary
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissExistingUserAlert() }) {
                    Text(
                        text = "취소",
                        fontFamily = SuiteFont,
                        color = BrandColors.TextSecondary
                    )
                }
            }
        )
    }
    
    
    // 약관 상세 열려있을 때 시스템 뒤로가기 처리
    BackHandler(enabled = uiState.currentLegalDocument != null) {
        viewModel.hideLegalDocument()
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(

        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = uiState.currentStep.title,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                },
                navigationIcon = {
                    if (uiState.currentStep != RegisterStep.COMPLETE) {
                        IconButton(onClick = {
                            if (uiState.currentStep == RegisterStep.TERMS) {
                                onBack()
                            } else {
                                viewModel.previousStep()
                            }
                        }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "뒤로")
                        }
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.White)
        ) {
            // Progress Bar
            if (uiState.currentStep != RegisterStep.COMPLETE) {
                LinearProgressIndicator(
                    progress = { uiState.currentStep.progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp),
                    color = BrandColors.Primary,
                    trackColor = BrandColors.Border
                )
            }
            
            // Content
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                AnimatedContent(
                    targetState = uiState.currentStep,
                    transitionSpec = {
                        val isForward = targetState.progress > initialState.progress
                        if (isForward) {
                            slideInHorizontally(animationSpec = tween(300)) { width -> width } togetherWith
                            slideOutHorizontally(animationSpec = tween(300)) { width -> -width }
                        } else {
                            slideInHorizontally(animationSpec = tween(300)) { width -> -width } togetherWith
                            slideOutHorizontally(animationSpec = tween(300)) { width -> width }
                        }
                    },
                    label = "step_transition"
                ) { step ->
                    if (step == RegisterStep.COMPLETE) {
                        CompleteContent()
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(24.dp)
                        ) {
                            when (step) {
                                RegisterStep.TERMS -> TermsContent(viewModel, uiState)
                                RegisterStep.PHONE -> PhoneContent(viewModel, uiState)
                                RegisterStep.VERIFICATION -> VerificationContent(viewModel, uiState)
                                RegisterStep.BASIC_INFO -> BasicInfoContent(viewModel, uiState)
                                RegisterStep.PROFILE -> ProfileContent(viewModel, uiState)
                                else -> {}
                            }
                        }
                    }
                }
            }
            
            // Error Message
            if (uiState.showError && uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage!!,
                    color = BrandColors.Error,
                    fontFamily = SuiteFont,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 8.dp),
                    textAlign = TextAlign.Center
                )
            }
            
            // "전체 동의하기" 버튼 위에 위치 (약관 단계일 때만)
            if (uiState.currentStep == RegisterStep.TERMS) {
                Box(modifier = Modifier.padding(horizontal = 24.dp)) {
                    TermsCheckItem(
                        title = "전체 동의하기",
                        isChecked = viewModel.isAllTermsAgreed,
                        onCheckedChange = { viewModel.setAllTerms(it) },
                        isHeader = true
                    )
                }
            }
            
            // Bottom Button
            val isEnabled = when (uiState.currentStep) {
                RegisterStep.TERMS -> viewModel.isRequiredTermsAgreed
                RegisterStep.PHONE -> viewModel.isPhoneValid
                RegisterStep.VERIFICATION -> uiState.verificationCode.length == 6
                RegisterStep.BASIC_INFO -> viewModel.isBasicInfoValid
                RegisterStep.PROFILE -> viewModel.isProfileValid
                RegisterStep.COMPLETE -> true
            }
            
            val buttonText = when (uiState.currentStep) {
                RegisterStep.PHONE -> if (viewModel.isSocialAccount) "다음" else "인증번호 받기"
                RegisterStep.VERIFICATION -> "인증 확인"
                RegisterStep.PROFILE -> "가입 완료"
                RegisterStep.COMPLETE -> "시작하기"
                else -> "다음"
            }
            
            Button(
                onClick = {
                    when (uiState.currentStep) {
                        RegisterStep.PHONE -> viewModel.sendVerificationCode()
                        RegisterStep.VERIFICATION -> viewModel.verifyCode()
                        RegisterStep.COMPLETE -> onComplete()
                        else -> viewModel.nextStep()
                    }
                },
                enabled = isEnabled && !uiState.isLoading && !uiState.isVerificationLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrandColors.Primary,
                    disabledContainerColor = BrandColors.Primary.copy(alpha = 0.3f),
                    disabledContentColor = Color.White
                )
            ) {
                if (uiState.isLoading || uiState.isVerificationLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = buttonText,
                        fontFamily = SuiteFont,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp
                    )
                }
            }
        }
        
        }
        
        // Legal Document Detail Overlay with Animation
        AnimatedContent(
            targetState = uiState.currentLegalDocument,
            transitionSpec = {
                if (targetState != null) {
                    // Enter (Push): Target slides in from right, Initial slides out to left
                    slideInHorizontally(animationSpec = tween(300)) { it } togetherWith
                    slideOutHorizontally(animationSpec = tween(300)) { -it }
                } else {
                    // Exit (Pop): Target slides in from left, Initial slides out to right
                    slideInHorizontally(animationSpec = tween(300)) { -it } togetherWith
                    slideOutHorizontally(animationSpec = tween(300)) { it }
                }
            },
            label = "legal_transition"
        ) { document ->
            if (document != null) {
                Box(modifier = Modifier.fillMaxSize().background(Color.White)) {
                    LegalScreen(
                        document = document,
                        onBack = { viewModel.hideLegalDocument() }
                    )
                }
            }
        }
    }
}

// MARK: - Step Contents

@Composable
private fun TermsContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "서비스 이용약관에\n동의해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp,
            lineHeight = 34.sp
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        // 개별 약관 (전체 동의는 하단 버튼 위로 이동됨)
        TermsCheckItem(
            title = "서비스 이용약관 동의 (필수)",
            isChecked = uiState.registerData.mtAgree1,
            onCheckedChange = { viewModel.setAgree1(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ServiceTerms) }
        )
        
        TermsCheckItem(
            title = "개인정보 처리방침 동의 (필수)",
            isChecked = uiState.registerData.mtAgree2,
            onCheckedChange = { viewModel.setAgree2(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.PrivacyPolicy) }
        )
        
        TermsCheckItem(
            title = "위치정보 이용약관 동의 (필수)",
            isChecked = uiState.registerData.mtAgree3,
            onCheckedChange = { viewModel.setAgree3(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.LocationTerms) }
        )
        
        TermsCheckItem(
            title = "개인정보 제3자 제공 동의 (선택)",
            isChecked = uiState.registerData.mtAgree4,
            onCheckedChange = { viewModel.setAgree4(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.ThirdPartyProvision) }
        )
        
        TermsCheckItem(
            title = "마케팅 정보 수신 동의 (선택)",
            isChecked = uiState.registerData.mtAgree5,
            onCheckedChange = { viewModel.setAgree5(it) },
            onDetailClick = { viewModel.showLegalDocument(LegalContent.MarketingConsent) }
        )
    }
}

@Composable
private fun TermsCheckItem(
    title: String,
    isChecked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    isHeader: Boolean = false,
    onDetailClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!isChecked) }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isChecked) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (isChecked) BrandColors.Primary else BrandColors.TextSecondary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            fontFamily = SuiteFont,
            fontWeight = if (isHeader) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = if (isHeader) 18.sp else 16.sp,
            color = BrandColors.TextPrimary
        )
        
        if (onDetailClick != null) {
            Spacer(modifier = Modifier.weight(1f))
            IconButton(
                onClick = onDetailClick,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "상세보기",
                    tint = BrandColors.TextSecondary
                )
            }
        }
    }
}

/**
 * 전화번호를 하이픈으로 포맷팅하는 VisualTransformation
 * 커서 위치를 올바르게 유지하면서 010-1234-5678 형식으로 표시
 */
class PhoneVisualTransformation : VisualTransformation {
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
                    offset <= 8 -> offset - 1
                    else -> offset - 2
                }.coerceAtMost(digits.length)
            }
        }
        
        return TransformedText(AnnotatedString(formatted), offsetMapping)
    }
}

@Composable
private fun PhoneContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "전화번호를 입력해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )
        
        Text(
            text = "본인 인증을 위해 전화번호가 필요합니다",
            fontFamily = SuiteFont,
            color = BrandColors.TextSecondary,
            fontSize = 16.sp
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        var isFocused by remember { mutableStateOf(false) }
        
        OutlinedTextField(
            value = uiState.registerData.mtId,
            onValueChange = { viewModel.setPhoneNumber(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocused = it.isFocused },
            placeholder = { Text("010-1234-5678", fontFamily = SuiteFont) },
            leadingIcon = {
                Icon(
                    Icons.Default.Phone, 
                    contentDescription = null, 
                    tint = if (isFocused) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            visualTransformation = PhoneVisualTransformation(),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border
            )
        )
    }
}

@Composable
private fun VerificationContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "인증번호를 입력해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )
        
        Text(
            text = "${viewModel.formattedPhoneNumber}로 발송된\n6자리 인증번호를 입력해주세요",
            fontFamily = SuiteFont,
            color = BrandColors.TextSecondary,
            fontSize = 16.sp
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        var isFocusedCode by remember { mutableStateOf(false) }
        
        OutlinedTextField(
            value = uiState.verificationCode,
            onValueChange = { viewModel.setVerificationCode(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedCode = it.isFocused },
            placeholder = { Text("인증번호 6자리", fontFamily = SuiteFont) },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = if (isFocusedCode) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border
            )
        )
        
        // 타이머
        if (uiState.verificationTimer > 0) {
            val minutes = uiState.verificationTimer / 60
            val seconds = uiState.verificationTimer % 60
            Text(
                text = "남은 시간: ${minutes}:${seconds.toString().padStart(2, '0')}",
                fontFamily = SuiteFont,
                color = BrandColors.Primary,
                fontSize = 16.sp
            )
        }
        
        // 재발송 버튼 - 타이머가 0일 때만 활성화
        val canResend = uiState.verificationTimer == 0
        TextButton(
            onClick = { viewModel.sendVerificationCode() },
            enabled = canResend
        ) {
            Text(
                text = if (canResend) "인증번호 재발송" else "재발송 대기 중",
                fontFamily = SuiteFont,
                color = if (canResend) BrandColors.Primary else BrandColors.TextSecondary
            )
        }
    }
}

@Composable
private fun BasicInfoContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "기본 정보를 입력해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        var isFocusedName by remember { mutableStateOf(false) }
        
        // 이름
        OutlinedTextField(
            value = uiState.registerData.mtName,
            onValueChange = { viewModel.setName(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedName = it.isFocused },
            label = { Text("이름", fontFamily = SuiteFont) },
            leadingIcon = {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    tint = if (isFocusedName) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border
            )
        )
        
        var isFocusedNickname by remember { mutableStateOf(false) }
        
        // 닉네임
        OutlinedTextField(
            value = uiState.registerData.mtNickname,
            onValueChange = { viewModel.setNickname(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedNickname = it.isFocused },
            label = { Text("닉네임", fontFamily = SuiteFont) },
            leadingIcon = {
                Icon(
                    Icons.Default.Badge,
                    contentDescription = null,
                    tint = if (isFocusedNickname) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border
            )
        )
        
        var isFocusedEmail by remember { mutableStateOf(false) }
        
        // 이메일 (선택)
        OutlinedTextField(
            value = uiState.registerData.mtEmail ?: "",
            onValueChange = { viewModel.setEmail(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedEmail = it.isFocused },
            label = { Text("이메일 (선택)", fontFamily = SuiteFont) },
            leadingIcon = {
                Icon(
                    Icons.Default.Email,
                    contentDescription = null,
                    tint = if (isFocusedEmail) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border
            )
        )
        
        // 이메일 형식 오류 메시지
        val email = uiState.registerData.mtEmail
        if (!email.isNullOrBlank() && !viewModel.isEmailValid) {
            Text(
                text = "올바른 이메일 형식을 입력해주세요",
                fontFamily = SuiteFont,
                color = BrandColors.Error,
                fontSize = 13.sp,
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        
        if (!viewModel.isSocialAccount) {
            Spacer(modifier = Modifier.height(8.dp))
            
            var isFocusedPwd by remember { mutableStateOf(false) }
            
            // 비밀번호
            OutlinedTextField(
                value = uiState.registerData.mtPwd ?: "",
                onValueChange = { viewModel.setPassword(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .onFocusChanged { isFocusedPwd = it.isFocused },
                label = { Text("비밀번호", fontFamily = SuiteFont) },
                leadingIcon = {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        tint = if (isFocusedPwd) BrandColors.Primary else BrandColors.TextSecondary
                    )
                },
                visualTransformation = if (uiState.showPassword) VisualTransformation.None 
                                      else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { viewModel.toggleShowPassword() }) {
                        Icon(
                            imageVector = if (uiState.showPassword) Icons.Default.Visibility 
                                         else Icons.Default.VisibilityOff,
                            contentDescription = null,
                            tint = if (isFocusedPwd) BrandColors.Primary else BrandColors.TextSecondary
                        )
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandColors.Primary,
                    unfocusedBorderColor = BrandColors.Border
                )
            )
            
            // 비밀번호 규칙 안내 (한 줄로 표시)
            val pwd = uiState.registerData.mtPwd ?: ""
            if (pwd.isEmpty()) {
                Text(
                    text = "8자 이상, 영문, 숫자, 특수문자 포함",
                    fontFamily = SuiteFont,
                    color = BrandColors.TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(start = 4.dp)
                )
            } else {
                Row(
                    modifier = Modifier.padding(start = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PasswordRuleChip("8자+", viewModel.isPasswordLengthValid)
                    PasswordRuleChip("영문", viewModel.hasPasswordLetter)
                    PasswordRuleChip("숫자", viewModel.hasPasswordNumber)
                    PasswordRuleChip("특수문자", viewModel.hasPasswordSpecialChar)
                }
            }
            
            var isFocusedPwdConfirm by remember { mutableStateOf(false) }
            
            // 비밀번호 확인
            OutlinedTextField(
                value = uiState.passwordConfirm,
                onValueChange = { viewModel.setPasswordConfirm(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .onFocusChanged { isFocusedPwdConfirm = it.isFocused },
                label = { Text("비밀번호 확인", fontFamily = SuiteFont) },
                leadingIcon = {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        tint = if (isFocusedPwdConfirm) BrandColors.Primary else BrandColors.TextSecondary
                    )
                },
                visualTransformation = if (uiState.showPasswordConfirm) VisualTransformation.None 
                                      else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { viewModel.toggleShowPasswordConfirm() }) {
                        Icon(
                            imageVector = if (uiState.showPasswordConfirm) Icons.Default.Visibility 
                                         else Icons.Default.VisibilityOff,
                            contentDescription = null,
                            tint = if (isFocusedPwdConfirm) BrandColors.Primary else BrandColors.TextSecondary
                        )
                    }
                },
                isError = uiState.passwordConfirm.isNotEmpty() && !viewModel.isPasswordMatch,
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandColors.Primary,
                    unfocusedBorderColor = BrandColors.Border
                )
            )
            
            if (uiState.passwordConfirm.isNotEmpty() && !viewModel.isPasswordMatch) {
                Text(
                    text = "비밀번호가 일치하지 않습니다",
                    fontFamily = SuiteFont,
                    color = BrandColors.Error,
                    fontSize = 14.sp
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = "프로필 정보를 설정해주세요",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )
        
        Spacer(modifier = Modifier.height(2.dp))
        
        var isFocusedBirth by remember { mutableStateOf(false) }
        
        // 생년월일 (DatePicker)
        var showDatePicker by remember { mutableStateOf(false) }
        
        OutlinedTextField(
            value = uiState.registerData.mtBirth ?: "",
            onValueChange = {},
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isFocusedBirth = it.isFocused }
                .clickable { showDatePicker = true },
            label = { Text("생년월일 (선택)", fontFamily = SuiteFont) },
            placeholder = { Text("탭하여 선택", fontFamily = SuiteFont) },
            readOnly = true,
            enabled = false,
            leadingIcon = {
                Icon(
                    Icons.Default.Cake,
                    contentDescription = null,
                    tint = if (isFocusedBirth || showDatePicker) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            trailingIcon = {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = "날짜 선택",
                    tint = if (isFocusedBirth || showDatePicker) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = Color.Black,
                disabledBorderColor = BrandColors.Border,
                disabledLabelColor = BrandColors.TextSecondary,
                disabledPlaceholderColor = BrandColors.TextSecondary
            )
        )
        
        // Wheel Style (Spinner) DatePicker Dialog
        if (showDatePicker) {
            val calendar = Calendar.getInstance()
            // 기존 생년월일이 있으면 해당 날짜로 초기화
            uiState.registerData.mtBirth?.let { birth ->
                try {
                    val parts = birth.split("-")
                    if (parts.size == 3) {
                        calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
                    }
                } catch (e: Exception) {}
            }
            
            var selectedYear = calendar.get(Calendar.YEAR)
            var selectedMonth = calendar.get(Calendar.MONTH)
            var selectedDay = calendar.get(Calendar.DAY_OF_MONTH)

            AlertDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val formatted = String.format("%04d-%02d-%02d", selectedYear, selectedMonth + 1, selectedDay)
                            viewModel.setBirthDate(formatted)
                            showDatePicker = false
                        }
                    ) {
                        Text("확인", fontFamily = SuiteFont, color = BrandColors.Primary)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("취소", fontFamily = SuiteFont, color = BrandColors.TextSecondary)
                    }
                },
                text = {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AndroidView(
                            factory = { context ->
                                val locale = java.util.Locale.KOREA
                                java.util.Locale.setDefault(locale)
                                val config = android.content.res.Configuration(context.resources.configuration)
                                config.setLocale(locale)
                                val localizedContext = context.createConfigurationContext(config)
                                
                                DatePicker(ContextThemeWrapper(localizedContext, android.R.style.Theme_Holo_Light_Dialog)).apply {
                                    calendarViewShown = false
                                    spinnersShown = true
                                    init(selectedYear, selectedMonth, selectedDay) { _, year, monthOfYear, dayOfMonth ->
                                        selectedYear = year
                                        selectedMonth = monthOfYear
                                        selectedDay = dayOfMonth
                                    }
                                }
                            },
                            modifier = Modifier.wrapContentSize()
                        )
                    }
                }
            )
        }
        
        // 성별 선택
        Text(
            text = "성별 (선택)",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Medium,
            fontSize = 16.sp,
            color = BrandColors.TextSecondary
        )
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GenderButton(
                text = "남성",
                isSelected = uiState.registerData.mtGender == 1,
                onClick = { viewModel.setGender(1) },
                modifier = Modifier.weight(1f)
            )
            GenderButton(
                text = "여성",
                isSelected = uiState.registerData.mtGender == 2,
                onClick = { viewModel.setGender(2) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun GenderButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) BrandColors.Primary else Color.White,
            contentColor = if (isSelected) Color.White else BrandColors.TextPrimary
        ),
        border = if (!isSelected) androidx.compose.foundation.BorderStroke(
            width = 1.dp,
            color = BrandColors.Border
        ) else null
    ) {
        Text(
            text = text,
            fontFamily = SuiteFont,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun CompleteContent() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = BrandColors.Primary,
            modifier = Modifier.size(80.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "가입을 환영합니다!",
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            fontSize = 26.sp
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "smap과 함께 소중한 사람들과\n위치를 공유해보세요",
            fontFamily = SuiteFont,
            color = BrandColors.TextSecondary,
            fontSize = 18.sp,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun PasswordRuleChip(text: String, isValid: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isValid) Icons.Default.Check else Icons.Default.Close,
            contentDescription = null,
            tint = if (isValid) BrandColors.Primary else BrandColors.Error,
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = text,
            fontFamily = SuiteFont,
            color = if (isValid) BrandColors.Primary else BrandColors.TextSecondary,
            fontSize = 12.sp
        )
    }
}
