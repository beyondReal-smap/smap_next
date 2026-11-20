package com.dmonster.smap.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapPasswordField
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import kotlinx.coroutines.delay

/** 변경 성공 안내를 보여 준 뒤 이전 화면으로 돌아가기까지의 시간(이메일 변경 화면과 같다) */
private const val SUCCESS_HOLD_MILLIS = 1200L

/** 비밀번호 변경 API(POST /members/change-password)가 받는 특수문자 — 서버 검사와 같은 목록 */
private const val SERVER_SPECIAL_CHARS = "@$!%*?&"

/**
 * 비밀번호 변경 — 36단계: 이메일 변경·회원탈퇴와 같은 "제목 + 설명 + 입력창 + 아래 버튼" 폼 화면으로.
 *
 * 이전에는 흰 "< 뒤로" 알약 머리 + 파랑 그라데이션 머리 카드 + 결과 알림창이었다.
 * 조건 목록을 서버 검사와 맞췄다: 이전 목록은 `#` 같은 특수문자도 통과로 표시했지만 서버는 @$!%*?& 만 받아,
 * 화면에선 다 맞았는데 변경이 거절될 수 있었다.
 */
@Composable
fun ChangePasswordScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val result by viewModel.result.collectAsState()
    val colors = MaterialTheme.colorScheme
    val focusManager = LocalFocusManager.current

    // 회전해도 입력이 사라지지 않게(rememberSaveable)
    var currentPassword by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }

    var successMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val rules = listOf(
        "8자 이상" to (newPassword.length >= 8),
        "영문 대문자" to newPassword.any { it in 'A'..'Z' },
        "영문 소문자" to newPassword.any { it in 'a'..'z' },
        "숫자" to newPassword.any { it in '0'..'9' },
        "특수문자 ($SERVER_SPECIAL_CHARS)" to newPassword.any { it in SERVER_SPECIAL_CHARS },
    )
    val isPasswordStrong = rules.all { it.second }
    val isPasswordMatch = newPassword.isNotEmpty() && newPassword == confirmPassword

    // 소셜 로그인 회원(mt_type 1 이 아님)은 비밀번호가 없다
    val isSocialUser = user?.mtType?.let { it != 1 } ?: false

    LaunchedEffect(result) {
        result?.takeIf { it.operation == "password" }?.let {
            if (it.success) {
                successMessage = it.message
                errorMessage = null
            } else {
                errorMessage = it.message
            }
            viewModel.clearResult()
        }
    }
    LaunchedEffect(successMessage) {
        if (successMessage != null) {
            delay(SUCCESS_HOLD_MILLIS)
            onBack()
        }
    }

    Scaffold(
        containerColor = colors.surface,
        topBar = { SmapTopBar(title = "비밀번호 변경", onBack = onBack) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(colors.surface)
                .imePadding()
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(SmapSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
            ) {
                if (isSocialUser) {
                    SocialUserNotice()
                    return@Column
                }

                Text("새 비밀번호를 설정해 주세요", style = SmapText.pageTitle, color = colors.onSurface)
                Text("영문 대·소문자, 숫자, 특수문자를 섞어 8자 이상으로 만들어 주세요.", style = SmapText.secondary, color = colors.onSurfaceVariant)

                Spacer(Modifier.height(SmapSpacing.md))

                val next = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
                SmapPasswordField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it },
                    label = "현재 비밀번호",
                    imeAction = ImeAction.Next,
                    keyboardActions = next,
                )
                SmapPasswordField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = "새 비밀번호",
                    imeAction = ImeAction.Next,
                    keyboardActions = next,
                )
                SmapPasswordField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = "새 비밀번호 확인",
                    imeAction = ImeAction.Done,
                    keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                    errorText = if (confirmPassword.isNotEmpty() && !isPasswordMatch) "새 비밀번호와 달라요" else null,
                )

                // 조건 목록 — 처음부터 보여 주고, 맞춘 조건은 초록 체크로 바뀐다.
                Column(
                    modifier = Modifier
                        .padding(top = SmapSpacing.sm)
                        .fillMaxWidth()
                        .background(colors.surfaceVariant, RoundedCornerShape(12.dp))
                        .padding(SmapSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    rules.forEach { (text, met) -> RuleRow(text, met) }
                    RuleRow("새 비밀번호 확인 일치", isPasswordMatch)
                }
            }

            if (!isSocialUser) {
                successMessage?.let {
                    SmapBanner(message = it, tone = SmapBannerTone.Success, modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm))
                }
                errorMessage?.let {
                    SmapBanner(message = it, tone = SmapBannerTone.Error, modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm))
                }
            }

            SmapButton(
                text = if (isSocialUser) "돌아가기" else "비밀번호 변경",
                onClick = {
                    if (isSocialUser) {
                        onBack()
                    } else {
                        errorMessage = null
                        viewModel.changePassword(currentPassword, newPassword)
                    }
                },
                enabled = isSocialUser || (successMessage == null && currentPassword.isNotEmpty() && isPasswordStrong && isPasswordMatch),
                isLoading = isLoading,
                modifier = Modifier.padding(SmapSpacing.lg),
            )
        }
    }
}

/** 소셜 로그인 회원 안내 — 비밀번호는 그 서비스(카카오·Apple·Google)에서 관리한다. */
@Composable
private fun SocialUserNotice() {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = SmapSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm),
    ) {
        Icon(
            Icons.Outlined.Shield,
            contentDescription = null,
            tint = colors.primary,
            modifier = Modifier
                .size(72.dp)
                .background(colors.primaryContainer, RoundedCornerShape(36.dp))
                .padding(18.dp),
        )
        Spacer(Modifier.height(SmapSpacing.sm))
        Text("비밀번호를 바꿀 수 없는 계정이에요", style = SmapText.pageTitle, color = colors.onSurface)
        Text(
            "카카오·Apple·Google 계정으로 로그인했다면 그 서비스의 설정에서 비밀번호를 관리해 주세요.",
            style = SmapText.secondary,
            color = colors.onSurfaceVariant,
        )
    }
}

/** 조건 한 줄 — 맞으면 초록 체크, 아니면 빈 원. 읽기 프로그램에는 "충족/미충족"으로 알린다. */
@Composable
private fun RuleRow(text: String, met: Boolean) {
    val colors = MaterialTheme.colorScheme
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$text ${if (met) "충족" else "미충족"}" },
    ) {
        Icon(
            if (met) Icons.Filled.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (met) BrandColors.Success else colors.outline,
            modifier = Modifier.size(18.dp),
        )
        Text(text, style = SmapText.caption, color = if (met) colors.onSurface else colors.onSurfaceVariant)
    }
}
