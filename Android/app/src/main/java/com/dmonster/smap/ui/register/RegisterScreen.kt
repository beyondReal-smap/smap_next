package com.dmonster.smap.ui.register

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapAccentTheme
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.data.model.RegisterStep
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
) = SmapAccentTheme(SmapAccent.Family) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.socialSessionExpired) {
        AlertDialog(onDismissRequest = onBack, title = { Text("알림") },
            text = { Text("소셜 로그인을 다시 진행해 주세요") },
            confirmButton = { TextButton(onClick = onBack) { Text("확인") } })
    }

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
                    text = "이미 가입된 계정",
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "이미 가입된 계정입니다.\n로그인 페이지로 이동하시겠습니까?",
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
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissExistingUserAlert() }) {
                    Text(
                        text = "취소",
                        fontFamily = SuiteFont,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        )
    }


    // 상단 화살표와 시스템 뒤로가기가 같은 동작을 하도록 한 곳에서 정의한다.
    // 기존에는 시스템 뒤로가기에 처리기가 없어, 가입 도중 누르면 앱이 종료되고 입력이 사라졌다.
    val goBack: () -> Unit = {
        if (uiState.currentStep == RegisterStep.TERMS) onBack() else viewModel.previousStep()
    }
    BackHandler(enabled = uiState.currentLegalDocument == null && uiState.currentStep != RegisterStep.COMPLETE) {
        goBack()
    }

    // 약관 상세 열려있을 때 시스템 뒤로가기 처리
    BackHandler(enabled = uiState.currentLegalDocument != null) {
        viewModel.hideLegalDocument()
    }

    val step = uiState.currentStep
    val (stage, stageName) = when (step) {
        RegisterStep.TERMS -> 1 to "약관 동의"
        RegisterStep.PHONE, RegisterStep.VERIFICATION -> 2 to "이메일 인증"
        RegisterStep.BASIC_INFO -> 3 to "계정 정보"
        RegisterStep.PROFILE, RegisterStep.COMPLETE -> 4 to "프로필"
    }
    val colors = MaterialTheme.colorScheme

    Box(Modifier.fillMaxSize().background(colors.surface), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier = Modifier.widthIn(max = 520.dp).fillMaxSize()
                .statusBarsPadding().navigationBarsPadding().imePadding()
                .padding(horizontal = 20.dp),
        ) {
            Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
                if (step != RegisterStep.COMPLETE) {
                    IconButton(onClick = goBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                }
                Text("회원가입", style = SmapText.headline, color = colors.onSurface, modifier = Modifier.weight(1f))
                if (step != RegisterStep.COMPLETE) {
                    Text("$stageName  ·  $stage/4", style = SmapText.captionMedium, color = colors.onSurfaceVariant)
                }
            }
            if (step != RegisterStep.COMPLETE) {
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    for (index in 1..4) {
                        Spacer(Modifier.weight(1f).height(3.dp).background(
                            if (index <= stage) colors.primary else colors.outlineVariant, RoundedCornerShape(2.dp)
                        ))
                    }
                }
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
                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 22.dp)
                    ) {
                        when (step) {
                            RegisterStep.TERMS -> TermsContent(viewModel, uiState)
                            RegisterStep.PHONE -> PhoneContent(viewModel, uiState)
                            RegisterStep.VERIFICATION -> VerificationContent(viewModel, uiState)
                            RegisterStep.BASIC_INFO -> BasicInfoContent(viewModel, uiState)
                            RegisterStep.PROFILE -> ProfileContent(viewModel, uiState)
                            RegisterStep.COMPLETE -> CompleteContent()
                        }
                    }
                }
                if (uiState.showError) {
                    val message = uiState.errorMessage.orEmpty()
                    Snackbar(
                        modifier = Modifier.align(Alignment.BottomCenter),
                        action = { TextButton(onClick = viewModel::dismissError) { Text("닫기", color = colors.inversePrimary) } },
                    ) {
                        Text(if (message.isBlank() || message.contains("알 수 없는 오류")) "가입을 진행할 수 없어요. 잠시 후 다시 시도해 주세요." else message)
                    }
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
                RegisterStep.TERMS -> "동의하고 계속하기"
                RegisterStep.PHONE -> "인증번호 받기"
                RegisterStep.VERIFICATION -> "인증 확인"
                RegisterStep.PROFILE -> "가입 완료"
                RegisterStep.COMPLETE -> "시작하기"
                else -> "다음"
            }

            val busy = uiState.isLoading || uiState.isVerificationLoading
            Button(
                onClick = {
                    when (uiState.currentStep) {
                        RegisterStep.PHONE -> viewModel.sendVerificationCode()
                        RegisterStep.VERIFICATION -> viewModel.verifyCode()
                        RegisterStep.COMPLETE -> onComplete()
                        else -> viewModel.nextStep()
                    }
                },
                enabled = isEnabled && !busy,
                modifier = Modifier.padding(vertical = 10.dp).fillMaxWidth().heightIn(min = 54.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SmapAccent.Family.deep, contentColor = Color.White),
            ) {
                if (busy) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text(buttonText, style = SmapText.bodyBold)
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
                Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                    LegalScreen(
                        document = document,
                        onBack = { viewModel.hideLegalDocument() }
                    )
                }
            }
        }
    }
}


@Composable
internal fun RegisterPhotoHeader(image: Int, title: String, height: Dp) {
    Box(
        modifier = Modifier.fillMaxWidth().heightIn(min = height).clip(RoundedCornerShape(20.dp)),
        contentAlignment = Alignment.BottomStart,
    ) {
        Image(painterResource(image), contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize())
        Spacer(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.68f)))))
        Text(title, color = Color.White, style = SmapText.title.copy(fontSize = 29.sp, lineHeight = 34.sp),
            modifier = Modifier.padding(20.dp).semantics { heading() })
    }
}
