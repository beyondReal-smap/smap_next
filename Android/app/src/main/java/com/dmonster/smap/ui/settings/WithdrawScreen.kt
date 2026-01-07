package com.dmonster.smap.ui.settings

import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

data class WithdrawReasonData(val id: Int, val icon: String, val text: String)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WithdrawScreen(
    onBack: () -> Unit,
    onSuccess: () -> Unit,
    viewModel: SettingsViewModel
) {
    val user by viewModel.user.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    var currentStep by remember { mutableStateOf(1) }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val selectedReasons = remember { mutableStateListOf<String>() }
    var etcReason by remember { mutableStateOf("") }
    var agreement by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var showConfirmWithdrawAlert by remember { mutableStateOf(false) }
    
    val reasonsArr = listOf(
        WithdrawReasonData(1, "😴", "자주 사용하지 않아요"),
        WithdrawReasonData(2, "🚫", "원하는 기능 부족"),
        WithdrawReasonData(3, "😕", "서비스가 불편해요"),
        WithdrawReasonData(4, "🔒", "개인정보 우려"),
        WithdrawReasonData(5, "❓", "기타 이유")
    )
    
    val isSocialLogin = user?.mtType in listOf(2, 3, 4)
    
    val canProceed = when (currentStep) {
        1 -> isSocialLogin || password.isNotEmpty()
        2 -> selectedReasons.isNotEmpty() && (!selectedReasons.contains("기타 이유") || etcReason.isNotBlank())
        3 -> agreement
        else -> false
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("회원탈퇴", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = {
                        if (currentStep > 1) {
                            currentStep -= 1
                        } else {
                            onBack()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "뒤로")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            Surface(
                color = Color.White,
                shadowElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(20.dp)
                ) {
                    if (errorMessage.isNotEmpty()) {
                        Text(
                            text = errorMessage,
                            color = Color(0xFFDC2626),
                            fontSize = 13.sp,
                            fontFamily = SuiteFont,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                    }
                    
                    Button(
                        onClick = {
                            errorMessage = ""
                            when (currentStep) {
                                1 -> {
                                    if (isSocialLogin) {
                                        currentStep = 2
                                    } else {
                                        viewModel.verifyPassword(password) { success, message ->
                                            if (success) {
                                                currentStep = 2
                                            } else {
                                                errorMessage = message ?: "비밀번호가 일치하지 않습니다."
                                            }
                                        }
                                    }
                                }
                                2 -> currentStep = 3
                                3 -> showConfirmWithdrawAlert = true
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (canProceed) {
                                if (currentStep == 3) Color(0xFFDC2626) else BrandColors.Primary
                            } else Color.Gray.copy(alpha = 0.3f),
                            contentColor = Color.White
                        ),
                        enabled = canProceed && !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                        } else {
                            Text(
                                text = if (currentStep == 3) "탈퇴하기" else "다음",
                                fontFamily = SuiteFont,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFFF7F7F7)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Step Indicator
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 20.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                for (step in 1..3) {
                    StepItem(
                        step = step,
                        currentStep = currentStep,
                        isLast = step == 3
                    )
                }
            }
            
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                AnimatedContent(
                    targetState = currentStep,
                    transitionSpec = {
                        if (targetState > initialState) {
                            (slideInHorizontally { it } + fadeIn()).togetherWith(slideOutHorizontally { -it } + fadeOut())
                        } else {
                            (slideInHorizontally { -it } + fadeIn()).togetherWith(slideOutHorizontally { it } + fadeOut())
                        }.using(SizeTransform(clip = false))
                    },
                    label = "step_transition"
                ) { step ->
                    when (step) {
                        1 -> StepOneContent(isSocialLogin, user?.mtType ?: 0, password, showPassword, { password = it }, { showPassword = it })
                        2 -> StepTwoContent(reasonsArr, selectedReasons, etcReason, { etcReason = it })
                        3 -> StepThreeContent(agreement, { agreement = it })
                    }
                }
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    if (showConfirmWithdrawAlert) {
        AlertDialog(
            onDismissRequest = { showConfirmWithdrawAlert = false },
            title = { Text("정말 탈퇴하시겠습니까?", fontFamily = SuiteFont, fontWeight = FontWeight.Bold) },
            text = { Text("모든 데이터가 삭제되며 복구할 수 없습니다.", fontFamily = SuiteFont) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirmWithdrawAlert = false
                        val primaryReason = selectedReasons.firstOrNull() ?: "기타 이유"
                        val reasonMapping = mapOf(
                            "자주 사용하지 않아요" to 1,
                            "원하는 기능 부족" to 2,
                            "서비스가 불편해요" to 3,
                            "개인정보 우려" to 4,
                            "기타 이유" to 5
                        )
                        val reasonIdx = reasonMapping[primaryReason] ?: 5
                        
                        viewModel.withdraw(
                            reasonIdx = reasonIdx,
                            etcReason = if (selectedReasons.contains("기타 이유")) etcReason else null,
                            reasons = selectedReasons.toList(),
                            onSuccess = onSuccess
                        )
                    }
                ) {
                    Text("탈퇴", color = Color(0xFFDC2626), fontFamily = SuiteFont, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmWithdrawAlert = false }) {
                    Text("취소", fontFamily = SuiteFont)
                }
            }
        )
    }
}

@Composable
fun StepItem(step: Int, currentStep: Int, isLast: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(if (step <= currentStep) BrandColors.Primary else Color.Gray.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            if (step < currentStep) {
                StepIcon(Icons.Default.Check, contentSize = 12.dp, tint = Color.White)
            } else {
                Text(
                    text = step.toString(),
                    color = if (step <= currentStep) Color.White else Color.Gray,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont
                )
            }
        }
        
        if (!isLast) {
            Box(
                modifier = Modifier
                    .width(24.dp)
                    .height(2.dp)
                    .padding(horizontal = 8.dp)
                    .background(if (step < currentStep) BrandColors.Primary else Color.Gray.copy(alpha = 0.2f))
            )
        }
    }
}

@Composable
fun StepIcon(imageVector: ImageVector, contentSize: androidx.compose.ui.unit.Dp, tint: Color) {
    androidx.compose.material3.Icon(
        imageVector = imageVector,
        contentDescription = null,
        modifier = Modifier.size(contentSize),
        tint = tint
    )
}

@Composable
fun StepOneContent(
    isSocialLogin: Boolean,
    userType: Int,
    password: String,
    showPassword: Boolean,
    onPasswordChange: (String) -> Unit,
    onToggleShowPassword: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("본인 확인", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Text(
                text = if (isSocialLogin) "소셜 계정으로 로그인 중입니다.\n본인 확인이 완료되었습니다." else "계정 보안을 위해 비밀번호를 입력해주세요.",
                fontFamily = SuiteFont,
                fontSize = 15.sp,
                color = Color.Gray,
                style = androidx.compose.ui.text.TextStyle(
                    lineBreak = LineBreak.Paragraph
                )
            )
        }
        
        if (isSocialLogin) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val (icon, tint, text) = when (userType) {
                        3 -> Triple(Icons.Default.AccountCircle, Color.Black, "Apple ID로 로그인됨")
                        4 -> Triple(Icons.Default.AccountCircle, Color(0xFF4285F4), "Google 계정으로 로그인됨")
                        2 -> Triple(Icons.Default.AccountCircle, Color(0xFFFEE500), "카카오 계정으로 로그인됨")
                        else -> Triple(Icons.Default.AccountCircle, Color.Gray, "소셜 계정으로 로그인됨")
                    }
                    androidx.compose.material3.Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = tint)
                    Text(text, fontFamily = SuiteFont, fontWeight = FontWeight.Medium, fontSize = 16.sp)
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("비밀번호", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.Gray)
                OutlinedTextField(
                    value = password,
                    onValueChange = onPasswordChange,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    placeholder = { Text("현재 비밀번호", fontFamily = SuiteFont) },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { onToggleShowPassword(!showPassword) }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = Color.Gray
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = BrandColors.Primary,
                        unfocusedBorderColor = Color.Transparent
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
            }
        }
        
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = BrandColors.Primary.copy(alpha = 0.05f)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                androidx.compose.material3.Icon(Icons.Default.Shield, contentDescription = null, modifier = Modifier.size(18.dp), tint = BrandColors.Primary)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("보안 강화", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.Black)
                    Text(
                        "탈퇴 전 본인 확인 과정을 통해 소중한 정보를 안전하게 보호합니다.",
                        fontFamily = SuiteFont,
                        fontSize = 13.sp,
                        color = Color.Gray,
                        style = androidx.compose.ui.text.TextStyle(
                            lineBreak = LineBreak.Paragraph
                        )
                    )
                }
            }
        }
    }
}

@Composable
fun StepTwoContent(
    reasons: List<WithdrawReasonData>,
    selectedReasons: MutableList<String>,
    etcReason: String,
    onEtcReasonChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("탈퇴 사유", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Text(
                "서비스 개선을 위해 소중한 의견을 들려주세요\n(중복 선택 가능)",
                fontFamily = SuiteFont,
                fontSize = 15.sp,
                color = Color.Gray,
                style = androidx.compose.ui.text.TextStyle(
                    lineBreak = LineBreak.Paragraph
                )
            )
        }
        
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            reasons.forEach { reason ->
                val isSelected = selectedReasons.contains(reason.text)
                Surface(
                    onClick = {
                        if (isSelected) {
                            selectedReasons.remove(reason.text)
                        } else {
                            selectedReasons.add(reason.text)
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    color = if (isSelected) BrandColors.Primary.copy(alpha = 0.05f) else Color.White,
                    border = BorderStroke(1.dp, if (isSelected) BrandColors.Primary else Color.Transparent),
                    shadowElevation = if (isSelected) 0.dp else 1.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(reason.icon, fontSize = 20.sp)
                        Text(
                            text = reason.text,
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Medium,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f)
                        )
                        if (isSelected) {
                            androidx.compose.material3.Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(22.dp), tint = BrandColors.Primary)
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(22.dp)
                                    .border(1.dp, Color.Gray.copy(alpha = 0.3f), CircleShape)
                            )
                        }
                    }
                }
            }
        }
        
        if (selectedReasons.contains("기타 이유")) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("상세 사유", fontFamily = SuiteFont, fontSize = 14.sp, color = Color.Gray)
                OutlinedTextField(
                    value = etcReason,
                    onValueChange = onEtcReasonChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = BrandColors.Primary,
                        unfocusedBorderColor = Color.Transparent
                    ),
                    textStyle = androidx.compose.ui.text.TextStyle(fontFamily = SuiteFont, fontSize = 14.sp)
                )
            }
        }
    }
}

@Composable
fun StepThreeContent(
    agreement: Boolean,
    onAgreementChange: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("최종 확인", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Text("탈퇴 전 주의사항을 꼭 확인해주세요.", fontFamily = SuiteFont, fontSize = 15.sp, color = Color.Gray)
        }
        
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            shadowElevation = 2.dp
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    androidx.compose.material3.Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(20.dp), tint = Color(0xFFF59E0B))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("계정 정보 및 데이터 영구 삭제", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            "탈퇴 시 회원의 모든 프로필 정보, 활동 내역, 설정 정보가 즉시 삭제되며 복구가 불가능합니다.",
                            fontFamily = SuiteFont,
                            fontSize = 14.sp,
                            color = Color.Gray,
                            style = androidx.compose.ui.text.TextStyle(
                                lineBreak = LineBreak.Paragraph
                            )
                        )
                    }
                }
                
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    androidx.compose.material3.Icon(Icons.AutoMirrored.Filled.EventNote, contentDescription = null, modifier = Modifier.size(20.dp), tint = Color(0xFFF59E0B))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("재가입 제한 안내", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            "탈퇴 후 30일 동안 동일한 정보로 재가입이 제한될 수 있습니다.",
                            fontFamily = SuiteFont,
                            fontSize = 14.sp,
                            color = Color.Gray,
                            style = androidx.compose.ui.text.TextStyle(
                                lineBreak = LineBreak.Paragraph
                            )
                        )
                    }
                }
            }
        }
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onAgreementChange(!agreement) }
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            androidx.compose.material3.Icon(
                imageVector = if (agreement) Icons.Default.CheckBox else Icons.Default.CheckBoxOutlineBlank,
                contentDescription = null,
                tint = if (agreement) BrandColors.Primary else Color.Gray,
                modifier = Modifier.size(24.dp)
            )
            Text("안내사항을 모두 확인하였으며, 이에 동의합니다.", fontFamily = SuiteFont, fontSize = 14.sp)
        }
    }
}
