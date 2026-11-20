package com.dmonster.smap.ui.register

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapTextButton
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

// 파일·함수 이름의 "Phone" 은 SMS 인증 시절의 이름이다. 호출부(RegisterScreen)와 단계 enum 이
// 같은 이름을 쓰고 있어, 이메일 전환 로직 작업과 충돌하지 않도록 이름은 그대로 두었다.

/** 가입 1단계 — 로그인 ID 가 될 이메일을 입력한다. */
@Composable
internal fun PhoneContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
        StepHeader(
            title = "어떤 이메일로 가입할까요?",
            description = "로그인에 사용할 이메일로 인증번호를 보내드려요."
        )

        Spacer(Modifier.height(SmapSpacing.md))

        SmapTextField(
            value = uiState.registerData.mtId,
            onValueChange = { viewModel.setPhoneNumber(it) },
            label = "이메일",
            placeholder = "name@example.com",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done,
        )
    }
}

/** 가입 2단계 — 메일로 받은 6자리 인증번호를 입력한다. */
@Composable
internal fun VerificationContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    val resendWait = viewModel.remainingResendTime()
    val canResend = resendWait == 0 && !uiState.isVerificationLoading
    val expired = uiState.verificationSent && uiState.verificationTimer == 0

    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
        StepHeader(
            title = "인증번호를 입력해 주세요",
            description = "${uiState.registerData.mtId}로 보낸 숫자 6자리를 입력해 주세요."
        )

        Spacer(Modifier.height(SmapSpacing.md))

        SmapTextField(
            value = uiState.verificationCode,
            onValueChange = { viewModel.setVerificationCode(it) },
            label = "인증번호",
            placeholder = "6자리 숫자",
            keyboardType = KeyboardType.NumberPassword,
            imeAction = ImeAction.Done,
            // 남은 시간을 입력창 바로 아래에 두어, 만료 여부를 입력하면서 볼 수 있게 한다.
            helperText = if (uiState.verificationTimer > 0) "남은 시간 ${formatTimer(uiState.verificationTimer)}" else null,
            errorText = if (expired) "인증번호가 만료됐어요. 다시 받아 주세요." else null,
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
                // 대기 중에는 몇 초 뒤에 누를 수 있는지 알려 준다("재발송 대기 중"만으로는 알 수 없었다).
                text = if (resendWait > 0) "다시 받기 (${resendWait}초)" else "인증번호 다시 받기",
                onClick = { viewModel.sendVerificationCode() },
                enabled = canResend,
            )
        }

        SmapBanner(
            message = "메일이 보이지 않으면 스팸함을 확인해 주세요.",
            tone = SmapBannerTone.Info,
        )
    }
}

@Composable
internal fun StepHeader(title: String, description: String) {
    Text(text = title, style = SmapText.title.copy(fontSize = 28.sp, lineHeight = 35.sp),
        color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.semantics { heading() })
    Text(text = description, style = SmapText.secondary, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

private fun formatTimer(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "$minutes:${seconds.toString().padStart(2, '0')}"
}
