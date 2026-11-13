package com.dmonster.smap.ui.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapTextButton
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import kotlinx.coroutines.delay

/** 성공 안내 배너를 보여 준 뒤 이전 화면으로 돌아가기까지의 시간 */
private const val SUCCESS_HOLD_MILLIS = 1200L

/**
 * 기존 회원의 이메일 등록·변경 화면(한 화면 안의 2단계).
 * 문구 톤·컴포넌트·간격은 가입 화면의 이메일 인증 단계(RegisterPhoneStep)와 같게 맞춘다.
 */
@Composable
fun EmailChangeScreen(
    onBack: () -> Unit,
    onCompleted: () -> Unit,
    viewModel: EmailChangeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // ViewModel 은 설정 화면 범위로 남으므로, 열 때와 닫을 때 모두 이전 입력·인증 상태를 지운다.
    DisposableEffect(Unit) {
        viewModel.reset()
        onDispose { viewModel.reset() }
    }

    LaunchedEffect(uiState.isCompleted) {
        if (uiState.isCompleted) {
            delay(SUCCESS_HOLD_MILLIS)
            onCompleted()
        }
    }

    // 상단 화살표와 시스템 뒤로가기가 같은 동작: 2단계면 1단계로, 1단계면 화면 닫기.
    val goBack: () -> Unit = {
        if (uiState.step == EmailChangeViewModel.Step.CODE && !uiState.isCompleted) viewModel.backToEmail() else onBack()
    }
    BackHandler(enabled = !uiState.isCompleted) { goBack() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.surface,
        topBar = {
            SmapTopBar(
                title = if (uiState.isRegistered) "이메일 변경" else "이메일 등록",
                onBack = if (uiState.isCompleted) null else goBack,
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(SmapSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
            ) {
                when (uiState.step) {
                    EmailChangeViewModel.Step.EMAIL -> EmailStepContent(viewModel, uiState)
                    EmailChangeViewModel.Step.CODE -> CodeStepContent(viewModel, uiState)
                }
            }

            if (uiState.isCompleted) {
                SmapBanner(
                    message = if (uiState.isRegistered) "이메일이 등록됐어요." else "이메일이 변경됐어요.",
                    tone = SmapBannerTone.Success,
                    modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm),
                )
            }
            uiState.errorMessage?.let { message ->
                SmapBanner(
                    message = message,
                    tone = SmapBannerTone.Error,
                    modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm),
                )
            }

            val onCodeStep = uiState.step == EmailChangeViewModel.Step.CODE
            SmapButton(
                text = if (onCodeStep) "확인" else "인증번호 받기",
                onClick = { if (onCodeStep) viewModel.confirm() else viewModel.sendCode() },
                enabled = !uiState.isCompleted &&
                    if (onCodeStep) uiState.code.length == EmailChangeViewModel.CODE_LENGTH else uiState.canSend,
                isLoading = uiState.isLoading,
                modifier = Modifier.padding(SmapSpacing.lg),
            )
        }
    }
}

@Composable
private fun EmailStepContent(viewModel: EmailChangeViewModel, uiState: EmailChangeViewModel.UiState) {
    StepHeader(
        title = if (uiState.isRegistered) "새 이메일을 입력해 주세요" else "이메일을 입력해 주세요",
        description = if (uiState.isRegistered) {
            "새 이메일로 인증하면 이메일이 변경돼요."
        } else {
            "이메일을 등록하면 비밀번호를 잊었을 때 계정을 되찾을 수 있어요. 등록한 이메일로도 로그인할 수 있어요."
        }
    )

    Spacer(Modifier.height(SmapSpacing.md))

    SmapTextField(
        value = uiState.email,
        onValueChange = { viewModel.setEmail(it) },
        label = "이메일",
        placeholder = "name@example.com",
        leadingIcon = Icons.Outlined.Email,
        keyboardType = KeyboardType.Email,
        imeAction = ImeAction.Done,
        helperText = if (uiState.isRegistered) "현재 이메일 ${uiState.currentEmail}" else null,
        errorText = if (uiState.isSameAsCurrent) EmailChangeViewModel.MSG_SAME_EMAIL else null,
    )
}

@Composable
private fun CodeStepContent(viewModel: EmailChangeViewModel, uiState: EmailChangeViewModel.UiState) {
    // 쿨다운 초는 시계 기반이라 StateFlow 변경(남은 시간 1초 틱)에 맞춰 다시 계산된다.
    val resendWait = viewModel.remainingResendSeconds()
    val canResend = resendWait == 0 && !uiState.isLoading && !uiState.isCompleted

    StepHeader(
        title = "인증번호를 입력해 주세요",
        description = "${uiState.email}\n위 주소로 보낸 6자리 숫자를 입력해 주세요."
    )

    Spacer(Modifier.height(SmapSpacing.md))

    SmapTextField(
        value = uiState.code,
        onValueChange = { viewModel.setCode(it) },
        label = "인증번호",
        placeholder = "6자리 숫자",
        leadingIcon = Icons.Outlined.Pin,
        keyboardType = KeyboardType.NumberPassword,
        imeAction = ImeAction.Done,
        enabled = !uiState.isCompleted,
        helperText = if (uiState.timerSeconds > 0) "남은 시간 ${formatTimer(uiState.timerSeconds)}" else null,
        errorText = if (uiState.isCodeExpired) "인증번호가 만료됐어요. 다시 받아 주세요." else null,
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = "메일이 오지 않았나요?",
            style = SmapText.caption,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SmapTextButton(
            text = if (resendWait > 0) "다시 받기 (${resendWait}초)" else "인증번호 다시 받기",
            onClick = { viewModel.sendCode() },
            enabled = canResend,
        )
    }

    SmapBanner(
        message = "메일이 보이지 않으면 스팸함을 확인해 주세요.",
        tone = SmapBannerTone.Info,
    )

    SmapTextButton(
        text = "이메일 다시 입력",
        onClick = { viewModel.backToEmail() },
        enabled = !uiState.isLoading && !uiState.isCompleted,
    )
}

@Composable
private fun StepHeader(title: String, description: String) {
    Text(text = title, style = SmapText.title, color = MaterialTheme.colorScheme.onSurface)
    Text(text = description, style = SmapText.secondary, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

private fun formatTimer(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "$minutes:${seconds.toString().padStart(2, '0')}"
}
