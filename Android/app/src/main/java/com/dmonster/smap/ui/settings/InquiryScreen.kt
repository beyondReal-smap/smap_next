package com.dmonster.smap.ui.settings

import androidx.activity.compose.BackHandler

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.ui.common.rememberSmapHaptics
import com.dmonster.smap.ui.theme.AccentColors
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SettingsColors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import com.dmonster.smap.ui.theme.SuiteFont
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@EntryPoint
@InstallIn(SingletonComponent::class)
interface InquiryEntryPoint {
    fun authService(): AuthService
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InquiryScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val authService = remember {
        EntryPointAccessors.fromApplication(context.applicationContext, InquiryEntryPoint::class.java).authService()
    }
    
    // 문의 초안은 세션 내내 유지되어야 하므로 rememberSaveable 사용
    var category by rememberSaveable { mutableStateOf("general") }
    var email by rememberSaveable { mutableStateOf("") }
    var subject by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var showResult by remember { mutableStateOf(false) }
    var resultMessage by remember { mutableStateOf("") }
    var isSuccess by remember { mutableStateOf(false) }
    var showUnsavedAlert by rememberSaveable { mutableStateOf(false) }

    val haptics = rememberSmapHaptics()
    val focusManager = LocalFocusManager.current
    val maxMessageLength = 1000

    // 이모지 대신 Material 아이콘 사용(시각 일관성). 카테고리 칩 자체에 contentDescription 시맨틱이 이미 부여됨.
    val categories = listOf(
        Triple("general", "일반 문의", Icons.Filled.Chat),
        Triple("technical", "기술 지원", Icons.Filled.Build),
        Triple("account", "계정 문제", Icons.Filled.Person),
        Triple("billing", "결제 문의", Icons.Filled.CreditCard)
    )

    val isEmailValid = android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    val isFormValid = isEmailValid && subject.isNotBlank() && message.isNotBlank()

    val hasUnsavedChanges = category != "general" || email.isNotBlank() || subject.isNotBlank() || message.isNotBlank()
    val attemptBack = {
        if (hasUnsavedChanges) {
            showUnsavedAlert = true
        } else {
            onBack()
        }
    }
    BackHandler { attemptBack() }

    val botToken = BuildConfig.TELEGRAM_BOT_TOKEN
    val chatId = BuildConfig.TELEGRAM_CHAT_ID

    val sendInquiry = {
        if (isFormValid && !isSending) {
            isSending = true
            scope.launch {
                val dateStr = SimpleDateFormat("yyyy. M. d. a h:mm:ss", Locale.KOREA).format(Date())
                val catName = categories.first { it.first == category }.second
                
                val text = """
                    📨 새로운 1:1 문의 (Android)
                    
                    📋 문의 유형: $catName
                    📝 제목: $subject
                    📧 이메일: $email
                    
                    💬 문의 내용:
                    $message
                    
                    ⏰ 접수 시간: $dateStr
                """.trimIndent()
                
                val result = authService.sendTelegramInquiry(chatId, botToken, text)
                val success = result.isSuccess
                isSuccess = success
                resultMessage = if (success) "문의가 성공적으로 전송되었습니다." else "전송 중 오류가 발생했습니다."
                if (success) haptics.success() else haptics.error()
                isSending = false
                showResult = true
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SettingsColors.PageBackground)
            .imePadding()
    ) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Surface(
                    onClick = { attemptBack() },
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    modifier = Modifier.height(44.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "뒤로",
                            tint = Color.Black,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = "뒤로",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.Black
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
            ) {
                // Header Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(AccentColors.Orange, SettingsColors.SupportInquiryIcon)
                            ),
                            shape = RoundedCornerShape(24.dp)
                        )
                        .padding(24.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("1:1 문의", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.White)
                            Text("궁금한 점을 문의하세요", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f))
                        }
                        Icon(Icons.Default.Email, contentDescription = null, tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Category Selection
                Text("문의 유형", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(bottom = 12.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    categories.forEach { item ->
                        val isSelected = category == item.first
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(
                                    if (isSelected) AccentColors.Orange.copy(alpha = 0.1f) else Color.Gray.copy(alpha = 0.05f),
                                    RoundedCornerShape(12.dp)
                                )
                                .border(
                                    width = 2.dp,
                                    color = if (isSelected) AccentColors.Orange else Color.Transparent,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .heightIn(min = 48.dp)
                                .clickable(role = Role.Button) {
                                    haptics.light()
                                    category = item.first
                                }
                                .semantics { contentDescription = "${item.second}${if (isSelected) " 선택됨" else ""}" }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(item.third, contentDescription = null, modifier = Modifier.size(22.dp), tint = if (isSelected) AccentColors.Orange else Color.Gray)
                                Text(item.second, fontFamily = SuiteFont, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = if (isSelected) AccentColors.Orange else Color.Black)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Email
                Text("이메일", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(bottom = 8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    placeholder = { Text("답변받을 이메일을 입력하세요", fontFamily = SuiteFont, fontSize = 15.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = Color.White,
                        focusedContainerColor = Color.White,
                        unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f),
                        focusedBorderColor = if (isEmailValid) BrandColors.Success.copy(alpha = 0.5f) else BrandColors.Error.copy(alpha = 0.5f)
                    ),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                        autoCorrectEnabled = false,
                        capitalization = KeyboardCapitalization.None
                    ),
                    keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
                    singleLine = true
                )
                if (email.isNotBlank()) {
                    Row(modifier = Modifier.padding(top = 4.dp, start = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(if (isEmailValid) Icons.Default.CheckCircle else Icons.Default.Error, contentDescription = if (isEmailValid) "유효" else "오류", tint = if (isEmailValid) BrandColors.Success else BrandColors.Error, modifier = Modifier.size(12.dp))
                        Text(if (isEmailValid) "올바른 이메일 형식입니다." else "올바른 이메일 형식이 아닙니다.", fontFamily = SuiteFont, fontSize = 12.sp, color = if (isEmailValid) BrandColors.Success else BrandColors.Error)
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Subject
                Text("제목", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(bottom = 8.dp))
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    placeholder = { Text("문의 제목을 입력하세요", fontFamily = SuiteFont, fontSize = 15.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = Color.White,
                        focusedContainerColor = Color.White,
                        unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f)
                    ),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Message — 글자수 카운터 + 최대 길이 제한
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("내용", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(
                        text = "${message.length} / $maxMessageLength",
                        fontFamily = SuiteFont,
                        fontSize = 12.sp,
                        color = if (message.length >= maxMessageLength) BrandColors.Error else BrandColors.TextSecondary
                    )
                }
                OutlinedTextField(
                    value = message,
                    onValueChange = { if (it.length <= maxMessageLength) message = it },
                    placeholder = { Text("문의 내용을 입력해주세요", fontFamily = SuiteFont, fontSize = 15.sp) },
                    modifier = Modifier.fillMaxWidth().height(150.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = Color.White,
                        focusedContainerColor = Color.White,
                        unfocusedBorderColor = Color.Gray.copy(alpha = 0.2f)
                    ),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        capitalization = KeyboardCapitalization.Sentences
                    )
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Submit Button
                Button(
                    onClick = {
                        haptics.medium()
                        focusManager.clearFocus()
                        sendInquiry()
                    },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isFormValid) AccentColors.Orange else Color.Gray.copy(alpha = 0.3f),
                        disabledContainerColor = Color.Gray.copy(alpha = 0.3f)
                    ),
                    enabled = isFormValid && !isSending
                ) {
                    if (isSending) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                            Text("문의 전송", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    if (showResult) {
        AlertDialog(
            onDismissRequest = { if (isSuccess) onBack() else showResult = false },
            title = { Text(if (isSuccess) "전송 완료" else "오류", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text(resultMessage, fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = {
                    showResult = false
                    if (isSuccess) onBack()
                }) {
                    Text("확인", fontFamily = SuiteFont, fontWeight = FontWeight.Bold)
                }
            },
            shape = RoundedCornerShape(16.dp),
            containerColor = Color.White
        )
    }

    if (showUnsavedAlert) {
        AlertDialog(
            onDismissRequest = { showUnsavedAlert = false },
            title = { Text("작성 중인 문의가 있어요", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text("지금 나가면 작성한 내용이 모두 삭제됩니다.\n그래도 나가시겠습니까?", fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(onClick = {
                    showUnsavedAlert = false
                    haptics.warning()
                    onBack()
                }) {
                    Text("나가기", color = BrandColors.Error, fontFamily = SuiteFont, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnsavedAlert = false }) {
                    Text("계속 작성", fontFamily = SuiteFont)
                }
            },
            shape = RoundedCornerShape(16.dp),
            containerColor = Color.White
        )
    }
}
