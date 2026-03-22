package com.dmonster.smap.ui.register

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

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
internal fun PhoneContent(
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
internal fun VerificationContent(
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
