package com.dmonster.smap.ui.register

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.RegisterStep
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
