package com.dmonster.smap.ui.login

import android.animation.ValueAnimator
import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import com.dmonster.smap.R
import com.dmonster.smap.ui.components.SmapAccent
import com.dmonster.smap.ui.components.SmapAccentTheme
import com.dmonster.smap.ui.components.SmapButton
import com.dmonster.smap.ui.components.SmapPasswordField
import com.dmonster.smap.ui.components.SmapTextField
import com.dmonster.smap.ui.theme.SmapTextStyle
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 로그인 화면 — 첫 화면에서 로그인 방법을 선택하고 이메일 입력으로 이동한다.
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = hiltViewModel(),
    onLoginSuccess: () -> Unit = {},
    onNavigateToRegister: (Map<String, String>?) -> Unit = {},
    onGoogleSignInClick: () -> Unit = {},
    onKakaoSignInClick: () -> Unit = {}
) = SmapAccentTheme(SmapAccent.Family) {
    val uiState by viewModel.uiState.collectAsState()
    
    var showsEmailForm by rememberSaveable { mutableStateOf(uiState.phoneNumber.isNotBlank()) }

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
    
    val view = LocalView.current
    val dark = isSystemInDarkTheme()
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !dark
        }
    }

    val colors = MaterialTheme.colorScheme
    val notices = remember { SnackbarHostState() }
    LaunchedEffect(uiState.showError, uiState.errorMessage) {
        val message = uiState.errorMessage
        if (uiState.showError && message != null) {
            notices.showSnackbar(message = message, actionLabel = "닫기", duration = SnackbarDuration.Long)
            viewModel.dismissError()
        }
    }
    val changeStep: (Boolean) -> Unit = { email ->
        viewModel.dismissError()
        showsEmailForm = email
    }
    BackHandler(enabled = showsEmailForm && !showForgotPassword) {
        if (!uiState.isLoading) changeStep(false)
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.surface)) {
        Crossfade(
            targetState = showsEmailForm,
            modifier = Modifier.fillMaxSize().statusBarsPadding().imePadding().navigationBarsPadding(),
            label = "loginStep",
        ) { email ->
            BoxWithConstraints(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                val viewportHeight = maxHeight
                val scroll = rememberScrollState()
                if (email) {
                    Column(
                        modifier = Modifier.widthIn(max = 488.dp).fillMaxWidth()
                            .verticalScroll(scroll, enabled = scroll.maxValue > 0)
                            .padding(horizontal = 24.dp, vertical = 8.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            IconButton(enabled = !uiState.isLoading, onClick = { changeStep(false) }) {
                                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "뒤로")
                            }
                            TextButton(enabled = !uiState.isLoading, onClick = { onNavigateToRegister(null) }) {
                                Text("회원가입", style = SmapText.captionBold, color = colors.onSurface)
                            }
                        }
                        EmailLoginForm(uiState, viewModel, onForgotPassword = { showForgotPassword = true })
                    }
                } else {
                    Column(
                        modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth()
                            .verticalScroll(scroll, enabled = scroll.maxValue > 0)
                            .heightIn(min = viewportHeight)
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(painterResource(R.drawable.app_no_bg), contentDescription = null, modifier = Modifier.size(30.dp))
                            Spacer(Modifier.width(9.dp))
                            Text(
                                "도착했어", style = SmapTextStyle.logoTitle.copy(fontSize = 23.sp, letterSpacing = (-0.8).sp),
                                color = colors.onSurface, modifier = Modifier.weight(1f).semantics { heading() },
                            )
                            TextButton(enabled = !uiState.isLoading, onClick = { onNavigateToRegister(null) }) {
                                Text("회원가입", style = SmapText.captionBold, color = colors.onSurface)
                            }
                        }

                        Spacer(Modifier.height(8.dp))
                        ArrivalPhoto(
                            modifier = Modifier.fillMaxWidth().height((viewportHeight - 252.dp).coerceIn(145.dp, 530.dp)),
                            isActive = !showsEmailForm && !uiState.isLoading && !uiState.showError,
                        )

                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { changeStep(true) }, enabled = !uiState.isLoading,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SmapAccent.Family.deep, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 20.dp),
                        ) {
                            Icon(Icons.Outlined.Email, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Text("이메일로 계속하기", style = SmapText.bodyBold, modifier = Modifier.weight(1f))
                            Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, modifier = Modifier.size(20.dp))
                        }

                        Spacer(Modifier.height(18.dp))
                        DividerWithText()
                        Spacer(Modifier.height(10.dp))
                        SocialLoginSection(onGoogleSignInClick, onKakaoSignInClick, uiState.isLoading)
                    }
                }
            }
        }

        val noticePosition = if (showsEmailForm) {
            Modifier.align(Alignment.BottomCenter).navigationBarsPadding().imePadding().padding(bottom = 12.dp)
        } else {
            Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 70.dp)
        }
        SnackbarHost(notices, modifier = noticePosition.widthIn(max = 520.dp).padding(horizontal = 16.dp))

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

@Composable
private fun ArrivalPhoto(modifier: Modifier, isActive: Boolean) {
    val photos = remember { listOf(R.drawable.login_arrival, R.drawable.login_arrival_cycling, R.drawable.login_arrival_doorway) }
    var index by rememberSaveable { mutableIntStateOf(0) }
    var paused by rememberSaveable { mutableStateOf(false) }
    val owner = LocalLifecycleOwner.current
    val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    val playing = isActive && LocalWindowInfo.current.isWindowFocused && !paused && !reduceMotion
    LaunchedEffect(owner, playing) {
        if (playing) owner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                delay(6_000)
                index = (index + 1) % photos.size
            }
        }
    }
    Box(modifier = modifier.clip(RoundedCornerShape(20.dp)), contentAlignment = Alignment.BottomStart) {
        Crossfade(
            targetState = index, modifier = Modifier.matchParentSize(),
            animationSpec = tween(if (reduceMotion) 0 else 700), label = "arrivalPhoto",
        ) { slide ->
            Image(
                painter = painterResource(photos[slide]), contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = BiasAlignment(horizontalBias = if (slide == 2) 0.20f else 0.56f, verticalBias = 0f),
                modifier = Modifier.fillMaxSize(),
            )
        }
        Spacer(Modifier.matchParentSize().background(
            Brush.verticalGradient(0.45f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.63f))
        ))
        Text(
            "가족이 도착하면,\n먼저 알려드려요.",
            style = SmapTextStyle.logoTitle.copy(fontSize = 30.sp, lineHeight = 36.sp, letterSpacing = (-1).sp),
            color = Color.White,
            modifier = Modifier.padding(20.dp),
        )
        val control = if (reduceMotion) "다음 사진" else if (paused) "사진 전환 재생" else "사진 전환 일시 정지"
        Row(
            modifier = Modifier.align(Alignment.TopEnd).padding(top = 4.dp, end = 12.dp)
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button) { if (reduceMotion) index = (index + 1) % photos.size else paused = !paused }
                .semantics {
                    contentDescription = control
                    stateDescription = "${index + 1} / ${photos.size}"
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier.background(Color.Black.copy(alpha = 0.55f), CircleShape)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${index + 1} / ${photos.size}", style = SmapText.captionMedium, color = Color.White,
                    modifier = Modifier.clearAndSetSemantics {})
                Icon(
                    when {
                        reduceMotion -> Icons.AutoMirrored.Filled.KeyboardArrowRight
                        paused -> Icons.Filled.PlayArrow
                        else -> Icons.Filled.Pause
                    },
                    contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp),
                )
            }
        }
    }
}

@Composable
private fun EmailLoginForm(uiState: LoginUiState, viewModel: LoginViewModel, onForgotPassword: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val focusManager = LocalFocusManager.current
    Column(modifier = Modifier.fillMaxWidth().padding(top = 22.dp)) {
        Text(
            "이메일 로그인", style = SmapTextStyle.logoTitle.copy(fontSize = 32.sp), color = colors.onSurface,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(24.dp))
        SmapTextField(
            value = uiState.phoneNumber,
            onValueChange = viewModel::onPhoneNumberChange,
            label = "이메일",
            placeholder = "name@example.com",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) })
        )

        Spacer(modifier = Modifier.height(12.dp))

        SmapPasswordField(
            value = uiState.password,
            onValueChange = viewModel::onPasswordChange,
            label = "비밀번호",
            placeholder = "비밀번호 입력",
            imeAction = ImeAction.Done,
            keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() })
        )

        Spacer(modifier = Modifier.height(20.dp))

        SmapButton(
            text = "로그인",
            onClick = {
                focusManager.clearFocus()
                viewModel.login()
            },
            enabled = uiState.isInputValid,
            isLoading = uiState.isLoading
        )

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onForgotPassword, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("비밀번호 찾기", style = SmapText.captionMedium, color = colors.onSurfaceVariant)
        }
    }
}

/**
 * 간편 로그인 구분선
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
            text = "간편 로그인",
            modifier = Modifier.padding(horizontal = 12.dp),
            style = SmapText.captionMedium,
            color = colors.onSurfaceVariant
        )
        HorizontalDivider(modifier = Modifier.weight(1f), color = colors.outlineVariant)
    }
}

@Composable
private fun SocialLoginSection(
    onGoogleClick: () -> Unit,
    onKakaoClick: () -> Unit,
    isLoading: Boolean
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LoginProviderButton("Google", R.drawable.ic_google_logo, Color.White, !isLoading, onGoogleClick, Modifier.weight(1f))
        LoginProviderButton("카카오", R.drawable.ic_kakao_logo, Color(0xFFFEE500), !isLoading, onKakaoClick, Modifier.weight(1f), brandText = Color.Black)
    }
}

@Composable
private fun LoginProviderButton(
    name: String, logo: Int, background: Color, enabled: Boolean, onClick: () -> Unit, modifier: Modifier,
    brandText: Color? = null,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier = modifier.heightIn(min = 48.dp).clip(shape)
            .then(if (brandText == null) Modifier.border(1.dp, colors.outline, shape) else Modifier.background(background))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = "${name}로 계속하기" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
    ) {
        Box(Modifier.size(26.dp).background(background, CircleShape), contentAlignment = Alignment.Center) {
            Image(painterResource(logo), contentDescription = null, modifier = Modifier.size(17.dp))
        }
        Text(name, style = SmapText.captionMedium, color = brandText ?: colors.onSurface, modifier = Modifier.clearAndSetSemantics {})
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
