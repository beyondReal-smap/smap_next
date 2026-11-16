package com.dmonster.smap.ui.settings

import android.app.DatePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.components.SmapBanner
import com.dmonster.smap.ui.components.SmapBannerTone
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.components.SmapTopBar
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText
import kotlinx.coroutines.delay

/** 저장 성공 안내를 보여 준 뒤 이전 화면으로 돌아가기까지의 시간(이메일 변경 화면과 같다) */
private const val SUCCESS_HOLD_MILLIS = 1200L

/**
 * 프로필 편집 — 36단계: 이메일 변경·회원탈퇴와 같은 "제목 + 설명 + 입력창 + 아래 버튼" 폼 화면으로.
 *
 * 이전에는 흰 "< 뒤로" 알약 머리 + 행마다 파랑·주황·분홍·보라 아이콘 상자 + 결과 알림창이었다.
 * 결과는 알림창 대신 버튼 위 배너로 보여 주고, 성공하면 잠깐 뒤 이전 화면으로 돌아간다.
 * 이름·생년월일·성별은 한 번 등록하면 바꿀 수 없다는 기존 규칙은 그대로이며, 잠긴 칸에는 이유를 적는다.
 */
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val result by viewModel.result.collectAsState()
    val context = LocalContext.current
    val colors = MaterialTheme.colorScheme

    var name by remember(user) { mutableStateOf(user?.mtName ?: "") }
    var nickname by remember(user) { mutableStateOf(user?.mtNickname ?: "") }
    var birthDate by remember(user) { mutableStateOf(user?.mtBirth ?: "") }
    // 성별을 고른 적 없으면 비워 둔다 — 이전에는 남성(1)이 미리 선택돼 저장하면 남성으로 등록됐다.
    var gender by remember(user) { mutableStateOf(user?.mtGender?.takeIf { it == 1 || it == 2 }) }

    // 이미 등록된 값은 바꿀 수 없다(기존 규칙)
    val isNameLocked = remember(user) { !user?.mtName.isNullOrBlank() }
    val isBirthDateLocked = remember(user) { !user?.mtBirth.isNullOrBlank() }
    val isGenderLocked = remember(user) { user?.mtGender != null && user?.mtGender != 0 }

    var successMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(result) {
        result?.takeIf { it.operation == "profile" }?.let {
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
        topBar = { SmapTopBar(title = "프로필 편집", onBack = onBack) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(colors.surface)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(SmapSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(SmapSpacing.sm)
            ) {
                Text("프로필을 수정해 주세요", style = SmapText.title, color = colors.onSurface)
                Text("닉네임은 그룹 멤버에게 보이는 이름이에요.", style = SmapText.secondary, color = colors.onSurfaceVariant)

                Spacer(Modifier.height(SmapSpacing.md))

                SmapTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = "이름",
                    placeholder = "이름을 입력하세요",
                    leadingIcon = Icons.Outlined.Person,
                    enabled = !isNameLocked,
                    imeAction = ImeAction.Next,
                    helperText = if (isNameLocked) "등록한 이름은 바꿀 수 없어요" else null,
                )
                SmapTextField(
                    value = nickname,
                    onValueChange = { nickname = it },
                    label = "닉네임",
                    placeholder = "닉네임을 입력하세요",
                    leadingIcon = Icons.Outlined.AlternateEmail,
                    imeAction = ImeAction.Done,
                )

                Spacer(Modifier.height(SmapSpacing.sm))
                Text("선택 정보", style = SmapText.captionBold, color = colors.onSurfaceVariant)

                PickerField(
                    label = "생년월일",
                    value = birthDate.ifEmpty { null },
                    placeholder = "선택",
                    enabled = !isBirthDateLocked,
                    helperText = if (isBirthDateLocked) "등록한 생년월일은 바꿀 수 없어요" else null,
                    onClick = {
                        // 처음 고를 땐 1990-01-01 에서 연다(iOS 와 같다) — 오늘 날짜에서 열면 생년까지 한참 넘겨야 했다.
                        val (y, m, d) = parseBirth(birthDate) ?: Triple(1990, 1, 1)
                        DatePickerDialog(
                            context,
                            { _, year, month, day -> birthDate = String.format("%04d-%02d-%02d", year, month + 1, day) },
                            y, m - 1, d
                        ).apply { datePicker.maxDate = System.currentTimeMillis() }.show()
                    }
                )

                Text("성별", style = SmapText.captionMedium, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = SmapSpacing.xs))
                Row(horizontalArrangement = Arrangement.spacedBy(SmapSpacing.sm)) {
                    GenderOption("남성", selected = gender == 1, enabled = !isGenderLocked, modifier = Modifier.weight(1f)) { gender = 1 }
                    GenderOption("여성", selected = gender == 2, enabled = !isGenderLocked, modifier = Modifier.weight(1f)) { gender = 2 }
                }
                if (isGenderLocked) {
                    Text("등록한 성별은 바꿀 수 없어요", style = SmapText.caption, color = colors.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
                }
            }

            successMessage?.let {
                SmapBanner(message = it, tone = SmapBannerTone.Success, modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm))
            }
            errorMessage?.let {
                SmapBanner(message = it, tone = SmapBannerTone.Error, modifier = Modifier.padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.sm))
            }

            SmapButton(
                text = "저장",
                onClick = {
                    errorMessage = null
                    viewModel.updateProfile(name, nickname, birthDate.takeIf { it.isNotEmpty() }, gender)
                },
                enabled = successMessage == null && name.isNotBlank() && nickname.isNotBlank(),
                isLoading = isLoading,
                modifier = Modifier.padding(SmapSpacing.lg),
            )
        }
    }
}

/** "yyyy-MM-dd" → (년, 월, 일). 형식이 다르면 null(오늘 날짜로 달력을 연다). */
private fun parseBirth(value: String): Triple<Int, Int, Int>? {
    val parts = value.split("-").mapNotNull { it.toIntOrNull() }
    return if (parts.size == 3) Triple(parts[0], parts[1], parts[2]) else null
}

/** 입력창과 같은 모양의 "눌러서 고르는" 칸 — 생년월일처럼 직접 타이핑하지 않는 값. */
@Composable
private fun PickerField(
    label: String,
    value: String?,
    placeholder: String,
    enabled: Boolean,
    helperText: String?,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = SmapText.captionMedium, color = colors.onSurfaceVariant)
        Surface(
            onClick = onClick,
            enabled = enabled,
            shape = RoundedCornerShape(SmapRadius.md),
            color = if (enabled) colors.surface else colors.surfaceVariant,
            border = BorderStroke(1.dp, colors.outline),
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = colors.onSurfaceVariant, modifier = Modifier.size(24.dp))
                Text(
                    text = value ?: placeholder,
                    style = SmapText.body,
                    color = if (value == null || !enabled) colors.onSurfaceVariant else colors.onSurface,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (helperText != null) {
            Text(helperText, style = SmapText.caption, color = colors.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
        }
    }
}

/** 성별 고르기 — 반반 나눈 두 칸, 고른 칸은 메뉴 강조색으로 채운다. */
@Composable
private fun GenderOption(label: String, selected: Boolean, enabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(SmapRadius.md),
        color = when {
            selected && enabled -> colors.primary
            selected -> colors.onSurfaceVariant.copy(alpha = 0.35f)
            else -> colors.surfaceVariant
        },
        modifier = modifier
            .heightIn(min = 52.dp)
            .semantics { role = Role.RadioButton; this.selected = selected },
    ) {
        Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = if (selected) SmapText.bodyBold else SmapText.body,
                color = if (selected) colors.onPrimary else colors.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 15.dp),
            )
        }
    }
}
