package com.dmonster.smap.ui.login

import android.util.Log
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.R
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.GradientColors
import com.dmonster.smap.ui.theme.SuiteFont
import com.dmonster.smap.ui.theme.responsiveSp

/**
 * 로그인 화면 (iOS LoginView 기반)
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = hiltViewModel(),
    onLoginSuccess: () -> Unit = {},
    onNavigateToRegister: (Map<String, String>?) -> Unit = {},
    onGoogleSignInClick: () -> Unit = {},
    onKakaoSignInClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    
    // 비밀번호 찾기 화면 표시 여부
    var showForgotPassword by remember { mutableStateOf(false) }
    
    // 로그인 성공 시 콜백
    LaunchedEffect(uiState.isLoggedIn) {
        if (uiState.isLoggedIn) {
            onLoginSuccess()
        }
    }
    
    // 신규 회원 시 회원가입 화면으로 이동
    LaunchedEffect(uiState.isNewUser) {
        if (uiState.isNewUser) {
            onNavigateToRegister(uiState.socialLoginData)
        }
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.linearGradient(
                    colors = GradientColors.LoginGradient,
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                )
            )
    ) {
        // 배경 애니메이션 (플로팅 원)
        FloatingBackground()
        
        // 메인 컨텐츠
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // 카드 컨테이너
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.White.copy(alpha = 0.95f)
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // 로고 섹션
                    LogoSection()
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // 로그인 폼
                    LoginForm(
                        phoneNumber = uiState.phoneNumber,
                        onPhoneNumberChange = viewModel::onPhoneNumberChange,
                        password = uiState.password,
                        onPasswordChange = viewModel::onPasswordChange,
                        showPassword = uiState.showPassword,
                        onToggleShowPassword = viewModel::toggleShowPassword
                    )
                    
                    // 에러 메시지
                    if (uiState.showError && uiState.errorMessage != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        ErrorMessage(message = uiState.errorMessage!!)
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // 로그인 버튼
                    LoginButton(
                        enabled = viewModel.isInputValid && !uiState.isLoading,
                        isLoading = uiState.isLoading,
                        onClick = {
                            viewModel.login()
                        }
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // 비밀번호 찾기 링크
                    TextButton(onClick = { showForgotPassword = true }) {
                        Text(
                            text = "비밀번호를 잊어버리셨나요?",
                            color = BrandColors.Primary,
                            fontSize = 16.responsiveSp(),
                            fontFamily = SuiteFont
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // 구분선
                    DividerWithText()
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // 소셜 로그인 버튼들
                    SocialLoginSection(
                        onGoogleClick = onGoogleSignInClick,
                        onKakaoClick = onKakaoSignInClick,
                        isLoading = uiState.isLoading
                    )
                    
                    Spacer(modifier = Modifier.height(32.dp))
                    
                    // 회원가입 링크
                    SignUpSection(
                        onClick = { onNavigateToRegister(null) }
                    )
                }
            }
        }
        
        // 로딩 오버레이
        if (uiState.isLoading) {
            LoadingOverlay()
        }
        
        // 비밀번호 찾기 오버레이 (Slide-up Animation)
        androidx.compose.animation.AnimatedVisibility(
            visible = showForgotPassword,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            ForgotPasswordScreen(
                onDismiss = { showForgotPassword = false }
            )
        }
    }
}

/**
 * 로고 섹션
 */
@Composable
private fun LogoSection() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // 앱 아이콘 (AppNoBg)
        Image(
            painter = painterResource(id = R.drawable.app_no_bg),
            contentDescription = "smap logo",
            modifier = Modifier.size(80.dp)
        )
        
        // 앱 이름
        Text(
            text = "smap",
            fontSize = 34.responsiveSp(),
            fontFamily = SuiteFont,
            fontWeight = FontWeight.Bold,
            color = BrandColors.TextPrimary
        )
        
        // 서브텍스트
        Text(
            text = "소중한 사람들과 함께하는 위치 공유",
            fontSize = 16.responsiveSp(),
            fontFamily = SuiteFont,
            color = BrandColors.TextSecondary,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * 전화번호를 하이픈으로 포맷팅하는 VisualTransformation
 */
private class PhoneVisualTransformation : VisualTransformation {
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
                    offset <= 4 -> offset // 하이픈 위치 대응
                    offset <= 8 -> offset - 1
                    offset <= 9 -> offset - 1 // 하이픈 위치 대응
                    else -> offset - 2
                }.coerceAtMost(digits.length)
            }
        }
        
        return TransformedText(AnnotatedString(formatted), offsetMapping)
    }
}

/**
 * 로그인 폼
 */
@Composable
private fun LoginForm(
    phoneNumber: String,
    onPhoneNumberChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    showPassword: Boolean,
    onToggleShowPassword: () -> Unit
) {
    var isPhoneFocused by remember { mutableStateOf(false) }
    var isPasswordFocused by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 전화번호 입력
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = onPhoneNumberChange,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isPhoneFocused = it.isFocused },
            placeholder = { Text("전화번호") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Phone,
                    contentDescription = "Phone",
                    tint = if (isPhoneFocused) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            visualTransformation = PhoneVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border,
                focusedContainerColor = BrandColors.InputBackground,
                unfocusedContainerColor = BrandColors.InputBackground
            )
        )
        
        // 비밀번호 입력
        OutlinedTextField(
            value = password,
            onValueChange = onPasswordChange,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { isPasswordFocused = it.isFocused },
            placeholder = { Text("비밀번호") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Password",
                    tint = if (isPasswordFocused) BrandColors.Primary else BrandColors.TextSecondary
                )
            },
            trailingIcon = {
                IconButton(onClick = onToggleShowPassword) {
                    Icon(
                        imageVector = if (showPassword) Icons.Default.Visibility
                                     else Icons.Default.VisibilityOff,
                        contentDescription = "Toggle password visibility",
                        tint = BrandColors.TextSecondary
                    )
                }
            },
            visualTransformation = if (showPassword) VisualTransformation.None 
                                   else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = BrandColors.Primary,
                unfocusedBorderColor = BrandColors.Border,
                focusedContainerColor = BrandColors.InputBackground,
                unfocusedContainerColor = BrandColors.InputBackground
            )
        )
    }
}

/**
 * 에러 메시지
 */
@Composable
private fun ErrorMessage(message: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = BrandColors.Error.copy(alpha = 0.1f),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = "Error",
            tint = BrandColors.Error,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = message,
            color = BrandColors.Error,
            fontSize = 16.sp
        )
    }
}

/**
 * 로그인 버튼
 */
@Composable
private fun LoginButton(
    enabled: Boolean,
    isLoading: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = BrandColors.Primary,
            disabledContainerColor = BrandColors.Primary.copy(alpha = 0.3f),
            disabledContentColor = Color.White
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = Color.White,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = "로그인",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * 구분선 ("또는")
 */
@Composable
private fun DividerWithText() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = BrandColors.Border
        )
        Text(
            text = "또는",
            modifier = Modifier.padding(horizontal = 12.dp),
            color = BrandColors.TextSecondary,
            fontSize = 16.sp
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = BrandColors.Border
        )
    }
}

/**
 * 소셜 로그인 섹션
 */
@Composable
private fun SocialLoginSection(
    onGoogleClick: () -> Unit,
    onKakaoClick: () -> Unit,
    isLoading: Boolean
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Google 로그인 버튼
        Button(
            onClick = onGoogleClick,
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, Color(0xFFE5E7EB)),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = BrandColors.TextPrimary,
                disabledContainerColor = Color.White,
                disabledContentColor = BrandColors.TextSecondary
            ),
            elevation = ButtonDefaults.buttonElevation(
                defaultElevation = 0.dp,
                pressedElevation = 0.dp,
                focusedElevation = 0.dp,
                hoveredElevation = 0.dp,
                disabledElevation = 0.dp
            )
        ) {
            // Google 로고
            Image(
                painter = painterResource(id = R.drawable.ic_google_logo),
                contentDescription = "Google Logo",
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "Google로 계속하기",
                color = BrandColors.TextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.Medium
            )
        }
        
        // 카카오 로그인 버튼
        Button(
            onClick = onKakaoClick,
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFFEE500),  // 카카오 노란색
                disabledContainerColor = Color(0xFFFEE500).copy(alpha = 0.5f)
            )
        ) {
            // 카카오 로고
            Image(
                painter = painterResource(id = R.drawable.ic_kakao_logo),
                contentDescription = "Kakao Logo",
                modifier = Modifier.size(24.dp),
                colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(Color(0xFF3A1D1D)) // Kakao Brown/Black
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "카카오로 계속하기",
                color = Color(0xFF191919),  // 카카오 검정색
                fontSize = 17.sp,
                fontFamily = SuiteFont,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

/**
 * 회원가입 섹션
 */
@Composable
private fun SignUpSection(onClick: () -> Unit) {
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "아직 회원이 아니신가요?",
            color = BrandColors.TextSecondary,
            fontSize = 16.sp
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "가입하기",
            color = BrandColors.Primary,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.clickable(onClick = onClick)
        )
    }
}

/**
 * 플로팅 배경 애니메이션
 */
@Composable
private fun FloatingBackground() {
    val infiniteTransition = rememberInfiniteTransition(label = "floating")
    
    val offset1 by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 30f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "offset1"
    )
    
    val offset2 by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = -20f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "offset2"
    )
    
    Box(modifier = Modifier.fillMaxSize()) {
        // 플로팅 원 1
        Box(
            modifier = Modifier
                .offset(x = (50 + offset1).dp, y = (100 + offset1).dp)
                .size(120.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.1f))
        )
        
        // 플로팅 원 2
        Box(
            modifier = Modifier
                .offset(x = (250 + offset2).dp, y = (300 + offset2).dp)
                .size(80.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.15f))
        )
        
        // 플로팅 원 3
        Box(
            modifier = Modifier
                .offset(x = (100 - offset1).dp, y = (500 - offset1).dp)
                .size(100.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.08f))
        )
    }
}

/**
 * 로딩 오버레이
 */
@Composable
private fun LoadingOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.4f)),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.Black.copy(alpha = 0.7f)
            )
        ) {
            Column(
                modifier = Modifier.padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 3.dp
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "로그인 중...",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun LoginScreenPreview() {
    LoginScreen()
}
