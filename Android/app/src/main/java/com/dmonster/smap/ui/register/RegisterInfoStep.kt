package com.dmonster.smap.ui.register

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.components.SmapPasswordField
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/** 가입 3단계 — 이름·닉네임·(선택) 전화번호·비밀번호. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BasicInfoContent(
    viewModel: RegisterViewModel,
    uiState: RegisterViewModel.RegisterUiState
) {
    val password = uiState.registerData.mtPwd ?: ""
    val confirmMismatch = uiState.passwordConfirm.isNotEmpty() && !viewModel.isPasswordMatch

    Column(verticalArrangement = Arrangement.spacedBy(SmapSpacing.md)) {
        Text(
            text = "기본 정보를 입력해 주세요",
            style = SmapText.title,
            color = MaterialTheme.colorScheme.onSurface,
        )

        SmapTextField(
            value = uiState.registerData.mtName,
            onValueChange = { viewModel.setName(it) },
            label = "이름",
            imeAction = ImeAction.Next,
        )

        SmapTextField(
            value = uiState.registerData.mtNickname,
            onValueChange = { viewModel.setNickname(it) },
            label = "닉네임",
            helperText = "그룹 멤버에게 보이는 이름이에요.",
            imeAction = ImeAction.Next,
        )

        // 로그인 ID 가 이메일로 바뀌면서 전화번호는 선택 입력이 됐다.
        SmapTextField(
            value = uiState.registerData.mtHp ?: "",
            onValueChange = { viewModel.setOptionalPhone(it) },
            label = "전화번호 (선택)",
            keyboardType = KeyboardType.Phone,
            imeAction = ImeAction.Next,
        )

        Spacer(Modifier.height(SmapSpacing.xs))

        SmapPasswordField(
            value = password,
            onValueChange = { viewModel.setPassword(it) },
            label = "비밀번호",
            imeAction = ImeAction.Next,
        )

        // 규칙을 처음부터 보여 주고 충족한 항목만 체크로 바꾼다.
        // 입력 전에는 한 줄 안내만, 입력을 시작하면 빨간 X 가 한꺼번에 나타나던 방식은
        // 아직 다 치지 않은 사용자에게 오류처럼 보였다.
        FlowRow(
            modifier = Modifier.padding(start = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PasswordRuleChip("8자 이상", viewModel.isPasswordLengthValid)
            PasswordRuleChip("영문 대소문자", viewModel.hasPasswordLetter)
            PasswordRuleChip("숫자", viewModel.hasPasswordNumber)
            PasswordRuleChip("특수문자", viewModel.hasPasswordSpecialChar)
        }

        SmapPasswordField(
            value = uiState.passwordConfirm,
            onValueChange = { viewModel.setPasswordConfirm(it) },
            label = "비밀번호 확인",
            errorText = if (confirmMismatch) "비밀번호가 일치하지 않아요." else null,
            imeAction = ImeAction.Done,
        )
    }
}

@Composable
internal fun PasswordRuleChip(text: String, isValid: Boolean) {
    val color = if (isValid) BrandColors.Success else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        verticalAlignment = Alignment.CenterVertically,
        // 색만으로 구분하지 않도록 아이콘 모양도 바꾸고, 낭독기에는 충족 여부를 문장으로 알린다.
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = if (isValid) "$text, 충족" else "$text, 미충족"
        },
    ) {
        Icon(
            imageVector = if (isValid) Icons.Filled.Check else Icons.Outlined.RadioButtonUnchecked,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(text = text, style = SmapText.captionSmall, color = color)
    }
}
