package com.dmonster.smap.ui.login

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapPasswordField
import com.dmonster.smap.ui.components.SmapTextButton
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.register.PasswordRuleChip
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

private typealias Step = ForgotPasswordViewModel.Step
private typealias Kind = ForgotPasswordViewModel.InputKind

/**
 * 비밀번호 찾기 화면 (iOS ForgotPasswordView 참고)
 * 가입 흐름(RegisterScreen)과 같은 구성: 상단바 + 진행 표시 + 본문 + 하단 고정 버튼, 오류는 화면 안 배너.
 */
@Composable
fun ForgotPasswordScreen(
    onDismiss: () -> Unit,
    viewModel: ForgotPasswordViewModel = hiltViewModel()
) {
    val currentStep by viewModel.currentStep.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()
    val sentKind by viewModel.sentKind.collectAsState()
    val verificationCode by viewModel.verificationCode.collectAsState()
    val verificationTimer by viewModel.verificationTimer.collectAsState()
    val newPassword by viewModel.newPassword.collectAsState()
    val confirmPassword by viewModel.confirmPassword.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    // ViewModel 의 오류는 한 번 전달되면 비워진다. 알럿/스낵바 대신 화면 안 배너로 남겨 두고,
    // 단계가 바뀌거나 사용자가 다시 입력하면 지운다. (단계 효과를 먼저 선언해 같은 프레임의
    // "오류 + 단계 되돌림"에서 오류가 지워지지 않게 한다.)
    var shownError by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(currentStep) { shownError = null }
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            shownError = it
            viewModel.clearError()
        }
    }

    val goBack: () -> Unit = { if (!viewModel.goBack()) onDismiss() }
    BackHandler(enabled = currentStep != Step.COMPLETE) { goBack() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.surface,
        topBar = {
            SmapTopBar(
                title = "비밀번호 찾기",
                onBack = if (currentStep != Step.COMPLETE) goBack else null,
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (currentStep != Step.COMPLETE) {
                LinearProgressIndicator(
                    progress = { progressOf(currentStep) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                AnimatedContent(
                    targetState = currentStep,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                            slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "step_transition"
                ) { step ->
                    if (step == Step.COMPLETE) {
                        CompleteStepContent(showEmailHint = sentKind == Kind.PHONE)
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(24.dp)
                        ) {
                            when (step) {
                                Step.PHONE -> PhoneStepContent(
                                    input = phoneNumber,
                                    onInputChange = {
                                        shownError = null
                                        viewModel.updatePhoneNumber(it)
                                    },
                                    canSend = ForgotPasswordViewModel.classify(phoneNumber) != Kind.INVALID,
                                    isLoading = isLoading,
                                    onSendCode = { viewModel.checkUserAndSendCode() },
                                )
                                Step.VERIFICATION -> VerificationStepContent(
                                    target = phoneNumber.trim(),
                                    sentKind = sentKind,
                                    code = verificationCode,
                                    onCodeChange = {
                                        shownError = null
                                        viewModel.updateVerificationCode(it)
                                    },
                                    timer = verificationTimer,
                                    resendWait = viewModel.remainingResendSeconds(),
                                    canResend = !isLoading,
                                    onResend = { viewModel.checkUserAndSendCode() },
                                )
                                Step.NEW_PASSWORD -> NewPasswordStepContent(
                                    newPassword = newPassword,
                                    confirmPassword = confirmPassword,
                                    onNewPasswordChange = {
                                        shownError = null
                                        viewModel.updateNewPassword(it)
                                    },
                                    onConfirmPasswordChange = {
                                        shownError = null
                                        viewModel.updateConfirmPassword(it)
                                    },
                                    isPasswordLengthValid = viewModel.isPasswordLengthValid,
                                    hasPasswordLetter = viewModel.hasPasswordLetter,
                                    hasPasswordNumber = viewModel.hasPasswordNumber,
                                    hasPasswordSpecialChar = viewModel.hasPasswordSpecialChar,
                                    passwordsMatch = viewModel.passwordsMatch,
                                )
                                Step.COMPLETE -> {}
                            }
                        }
                    }
                }
            }

            shownError?.let {
                SmapBanner(
                    message = it,
                    tone = SmapBannerTone.Error,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
            }

            val enabled = when (currentStep) {
                Step.PHONE -> ForgotPasswordViewModel.classify(phoneNumber) != Kind.INVALID
                Step.VERIFICATION -> verificationCode.length == 6
                Step.NEW_PASSWORD -> viewModel.isPasswordRulesSatisfied && viewModel.passwordsMatch
                Step.COMPLETE -> true
            }
            SmapButton(
                text = when (currentStep) {
                    Step.PHONE -> "인증번호 받기"
                    Step.VERIFICATION -> "인증 확인"
                    Step.NEW_PASSWORD -> "비밀번호 변경"
                    Step.COMPLETE -> "로그인하러 가기"
                },
                onClick = {
                    when (currentStep) {
                        Step.PHONE -> viewModel.checkUserAndSendCode()
                        Step.VERIFICATION -> viewModel.verifyCode()
                        Step.NEW_PASSWORD -> viewModel.resetPassword()
                        Step.COMPLETE -> onDismiss()
                    }
                },
                enabled = enabled,
                isLoading = isLoading,
                modifier = Modifier.padding(24.dp),
            )
        }
    }
}

private fun progressOf(step: Step): Float = when (step) {
    Step.PHONE -> 1f / 3f
    Step.VERIFICATION -> 2f / 3f
    Step.NEW_PASSWORD, Step.COMPLETE -> 1f
}

@Composable
private fun StepHeader(title: String, description: String) {
    Text(text = title, style = SmapText.pageTitle, color = MaterialTheme.colorScheme.onSurface)
    Text(text = description, style = SmapText.secondary, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

/** 1단계 — 가입할 때 쓴 이메일을 입력한다. */
@Composable
private fun PhoneStepContent(
    input: String,
    onInputChange: (String) -> Unit,
    canSend: Boolean,
    isLoading: Boolean,
    onSendCode: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
        StepHeader(
            title = "이메일을 입력해 주세요",
            description = "가입할 때 쓴 주소로 인증번호를 보내 드려요."
        )

        Spacer(Modifier.height(SmapSpacing.md))

        SmapTextField(
            value = input,
            onValueChange = onInputChange,
            label = "이메일",
            placeholder = "name@example.com",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done,
            keyboardActions = KeyboardActions(onDone = { if (canSend && !isLoading) onSendCode() }),
        )
    }
}

/** 2단계 — 메일(또는 문자)로 받은 6자리 인증번호를 입력한다. */
@Composable
private fun VerificationStepContent(
    target: String,
    sentKind: Kind,
    code: String,
    onCodeChange: (String) -> Unit,
    timer: Int,
    resendWait: Int,
    canResend: Boolean,
    onResend: () -> Unit,
) {
    val isPhone = sentKind == Kind.PHONE
    val expired = timer == 0

    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
        StepHeader(
            title = "인증번호를 입력해 주세요",
            description = if (isPhone) {
                "$target\n문자로 보낸 6자리 숫자를 입력해 주세요."
            } else {
                "$target\n위 주소로 보낸 6자리 숫자를 입력해 주세요."
            }
        )

        Spacer(Modifier.height(SmapSpacing.md))

        SmapTextField(
            value = code,
            onValueChange = onCodeChange,
            label = "인증번호",
            placeholder = "6자리 숫자",
            keyboardType = KeyboardType.NumberPassword,
            imeAction = ImeAction.Done,
            helperText = if (timer > 0) "남은 시간 ${formatTimer(timer)}" else null,
            errorText = if (expired) "인증번호가 만료됐어요. 다시 받아 주세요." else null,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = if (isPhone) "문자가 오지 않았나요?" else "메일이 오지 않았나요?",
                style = SmapText.caption,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            SmapTextButton(
                text = if (resendWait > 0) "다시 받기 (${resendWait}초)" else "인증번호 다시 받기",
                onClick = onResend,
                enabled = canResend && resendWait == 0,
            )
        }

        if (!isPhone) {
            SmapBanner(
                message = "메일이 보이지 않으면 스팸함을 확인해 주세요.",
                tone = SmapBannerTone.Info,
            )
        }
    }
}

/** 3단계 — 새 비밀번호를 정한다. 규칙 칩은 가입 화면의 PasswordRuleChip 을 재사용한다. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewPasswordStepContent(
    newPassword: String,
    confirmPassword: String,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    isPasswordLengthValid: Boolean,
    hasPasswordLetter: Boolean,
    hasPasswordNumber: Boolean,
    hasPasswordSpecialChar: Boolean,
    passwordsMatch: Boolean,
) {
    val confirmMismatch = confirmPassword.isNotEmpty() && !passwordsMatch

    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
        StepHeader(
            title = "새 비밀번호를 정해 주세요",
            description = "8자 이상, 영문 대소문자·숫자·특수문자를 모두 포함해 주세요."
        )

        Spacer(Modifier.height(SmapSpacing.md))

        SmapPasswordField(
            value = newPassword,
            onValueChange = onNewPasswordChange,
            label = "새 비밀번호",
            imeAction = ImeAction.Next,
        )

        FlowRow(
            modifier = Modifier.padding(start = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PasswordRuleChip("8자 이상", isPasswordLengthValid)
            PasswordRuleChip("영문 대소문자", hasPasswordLetter)
            PasswordRuleChip("숫자", hasPasswordNumber)
            PasswordRuleChip("특수문자", hasPasswordSpecialChar)
        }

        SmapPasswordField(
            value = confirmPassword,
            onValueChange = onConfirmPasswordChange,
            label = "비밀번호 확인",
            errorText = if (confirmMismatch) "비밀번호가 일치하지 않아요." else null,
            imeAction = ImeAction.Done,
        )
    }
}

/** 4단계 — 성공 상태. 전화번호로 재설정한 경우 이메일 등록 안내를 함께 보여 준다. */
@Composable
private fun CompleteStepContent(showEmailHint: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = BrandColors.Success,
            modifier = Modifier.size(80.dp)
        )

        Spacer(Modifier.height(SmapSpacing.lg))

        Text(
            text = "비밀번호를 바꿨어요",
            style = SmapText.pageTitle,
            color = MaterialTheme.colorScheme.onSurface,
        )

        Spacer(Modifier.height(SmapSpacing.sm))

        Text(
            text = "새 비밀번호로 로그인해 주세요.",
            style = SmapText.body,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        // 전화번호로 재설정한 경우: 이메일 등록 유도 (다음에는 이메일로 찾을 수 있음)
        if (showEmailHint) {
            Spacer(Modifier.height(SmapSpacing.md))
            SmapBanner(
                message = "이메일을 등록해 두면 다음에는 이메일로 찾을 수 있어요.",
                tone = SmapBannerTone.Info,
            )
        }
    }
}

private fun formatTimer(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "$minutes:${seconds.toString().padStart(2, '0')}"
}
