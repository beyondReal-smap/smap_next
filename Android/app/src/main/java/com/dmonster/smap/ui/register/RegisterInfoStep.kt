package com.dmonster.smap.ui.register

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
internal fun BasicInfoContent(
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

@Composable
internal fun PasswordRuleChip(text: String, isValid: Boolean) {
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
