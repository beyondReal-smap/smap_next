package com.dmonster.smap.ui.login

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.R
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapOnNavyMuted
import com.dmonster.smap.ui.components.SmapPasswordField
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSize
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 로그인 화면 — 위쪽 브랜드 남색(아이콘·이름) + 아래 흰 입력 시트. iOS LoginView 와 같은 구성.
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
    
    // 로그인 성공 시 콜백 (one-shot event)
    LaunchedEffect(uiState.isLoggedIn) {
        if (uiState.isLoggedIn) {
            onLoginSuccess()
            viewModel.resetLoginState()
        }
    }

    // 신규 회원 시 회원가입 화면으로 이동 (one-shot event)
    LaunchedEffect(uiState.isNewUser) {
        if (uiState.isNewUser) {
            onNavigateToRegister(uiState.socialLoginData)
            viewModel.resetNewUserState()
        }
    }
    
    // 위쪽 남색 바탕에는 흰 상태바 아이콘, 비밀번호 찾기(밝은 화면)가 덮을 때는 어두운 아이콘.
    // LoginActivity 의 enableEdgeToEdge() 기본값은 라이트 모드에서 어두운 아이콘이라 남색 위에서 안 보인다.
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = showForgotPassword
        }
    }

    val focusManager = LocalFocusManager.current
    val surface = MaterialTheme.colorScheme.surface

    Box(
        modifier = Modifier
            .fillMaxSize()
            // 스플래시와 같은 브랜드 남색에서 이어지게 한다(iOS SMAPTheme.Navy.gradient 와 같은 값).
            .background(SmapAccent.Navy.brush)
    ) {
        // 내용이 화면보다 짧아도 흰 시트가 화면 아래 끝까지 이어 보이게 아래 절반을 흰색으로 깐다.
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.5f)
                .background(surface)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
        ) {
            LogoSection(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 40.dp, bottom = 32.dp)
            )

            // 입력 시트 — 위쪽 모서리만 둥근 흰 판(앱 공용 시트 반경)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = SmapRadius.sheet, topEnd = SmapRadius.sheet))
                    .background(surface)
                    .navigationBarsPadding()
                    .padding(horizontal = SmapSpacing.lg, vertical = SmapSpacing.xl),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                SmapTextField(
                    value = uiState.phoneNumber,
                    onValueChange = viewModel::onPhoneNumberChange,
                    label = null,
                    placeholder = "이메일",
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                    keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
                )

                Spacer(modifier = Modifier.height(12.dp))

                SmapPasswordField(
                    value = uiState.password,
                    onValueChange = viewModel::onPasswordChange,
                    label = null,
                    placeholder = "비밀번호",
                    imeAction = ImeAction.Done,
                    keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() })
                )

                if (uiState.showError && uiState.errorMessage != null) {
                    Spacer(modifier = Modifier.height(SmapSpacing.md))
                    ErrorMessage(message = uiState.errorMessage!!)
                }

                Spacer(modifier = Modifier.height(SmapSpacing.lg))

                SmapButton(
                    text = "로그인",
                    onClick = {
                        focusManager.clearFocus()
                        viewModel.login()
                    },
                    enabled = uiState.isInputValid,
                    isLoading = uiState.isLoading
                )

                Spacer(modifier = Modifier.height(SmapSpacing.sm))

                TextButton(onClick = { showForgotPassword = true }) {
                    Text(
                        text = "비밀번호를 잊으셨나요?",
                        style = SmapText.secondaryMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                Spacer(modifier = Modifier.height(SmapSpacing.md))

                DividerWithText()

                Spacer(modifier = Modifier.height(SmapSpacing.lg))

                SocialLoginSection(
                    onGoogleClick = onGoogleSignInClick,
                    onKakaoClick = onKakaoSignInClick,
                    isLoading = uiState.isLoading
                )

                Spacer(modifier = Modifier.height(SmapSpacing.lg))

                SignUpSection(
                    onClick = { onNavigateToRegister(null) }
                )
            }
        }

        // 로딩 오버레이
        if (uiState.isLoading) {
            LoadingOverlay()
        }

        // 비밀번호 찾기 오버레이 (Slide-up Animation)
        if (showForgotPassword) {
            BackHandler { showForgotPassword = false }
        }
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
 * 로고 섹션 — 남색 바탕 위 앱 아이콘·이름·한 줄 소개
 */
@Composable
private fun LogoSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Image(
            painter = painterResource(id = R.drawable.app_no_bg),
            contentDescription = null,
            modifier = Modifier.size(76.dp)
        )
        Spacer(modifier = Modifier.height(SmapSpacing.md))
        Text(
            text = "도착했어",
            style = SmapText.title.copy(fontSize = 32.sp, lineHeight = 40.sp),
            color = Color.White,
            modifier = Modifier.semantics { heading() }
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "가족이 도착하면 먼저 알려 드려요",
            style = SmapText.body,
            color = SmapOnNavyMuted,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * 에러 메시지
 */
@Composable
private fun ErrorMessage(message: String) {
    val error = MaterialTheme.colorScheme.error
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(color = error.copy(alpha = 0.1f), shape = RoundedCornerShape(SmapRadius.sm))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            tint = error,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(text = message, style = SmapText.secondary, color = error)
    }
}

/**
 * 구분선 ("또는")
 */
@Composable
private fun DividerWithText() {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = colors.outlineVariant)
        Text(
            text = "또는",
            modifier = Modifier.padding(horizontal = 12.dp),
            style = SmapText.secondary,
            color = colors.onSurfaceVariant
        )
        HorizontalDivider(modifier = Modifier.weight(1f), color = colors.outlineVariant)
    }
}

/**
 * 소셜 로그인 섹션 — 높이·모서리는 앱 공용 버튼(SmapButton 52dp·12dp)과 맞춘다.
 */
@Composable
private fun SocialLoginSection(
    onGoogleClick: () -> Unit,
    onKakaoClick: () -> Unit,
    isLoading: Boolean
) {
    val shape = RoundedCornerShape(SmapRadius.md)
    val noElevation = ButtonDefaults.buttonElevation(0.dp, 0.dp, 0.dp, 0.dp, 0.dp)
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Google — 공식 규격: 흰 바탕 + 옅은 테두리 + 컬러 G 로고
        Button(
            onClick = onGoogleClick,
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth().height(SmapSize.buttonHeight),
            shape = shape,
            border = BorderStroke(1.dp, Color(0xFFDADCE0)),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = Color(0xFF1F1F1F),
                disabledContainerColor = Color.White,
                disabledContentColor = Color(0xFF1F1F1F).copy(alpha = 0.38f)
            ),
            elevation = noElevation
        ) {
            Image(
                painter = painterResource(id = R.drawable.ic_google_logo),
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(text = "Google로 계속하기", style = SmapText.secondaryMedium.copy(fontSize = 16.sp))
        }

        // 카카오 — 공식 규격: 바탕 #FEE500, 심볼 #000000, 글자 #000000 85%
        Button(
            onClick = onKakaoClick,
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth().height(SmapSize.buttonHeight),
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = KakaoYellow,
                contentColor = KakaoLabel,
                disabledContainerColor = KakaoYellow.copy(alpha = 0.5f),
                disabledContentColor = KakaoLabel
            ),
            elevation = noElevation
        ) {
            Image(
                painter = painterResource(id = R.drawable.ic_kakao_logo),
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(text = "카카오로 계속하기", style = SmapText.secondaryMedium.copy(fontSize = 16.sp))
        }
    }
}

private val KakaoYellow = Color(0xFFFEE500)
private val KakaoLabel = Color(0xD9000000)

/**
 * 회원가입 섹션
 */
@Composable
private fun SignUpSection(onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "아직 회원이 아니신가요?",
            style = SmapText.secondary,
            color = colors.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "가입하기",
            style = SmapText.captionBold.copy(fontSize = 15.sp, lineHeight = 22.sp),
            color = colors.primary,
            modifier = Modifier
                .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                .clickable(onClick = onClick)
                .wrapContentSize(Alignment.Center)
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

// Preview removed: LoginScreen requires hiltViewModel() which is not available in @Preview
