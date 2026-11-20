package com.dmonster.smap.ui.login

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.MainActivity
import com.dmonster.smap.R
import com.dmonster.smap.ui.theme.SmapTheme
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.kakao.sdk.auth.model.OAuthToken
import com.kakao.sdk.common.model.ClientError
import com.kakao.sdk.common.model.ClientErrorCause
import com.kakao.sdk.user.UserApiClient
import dagger.hilt.android.AndroidEntryPoint

/**
 * 네이티브 로그인 Activity (Jetpack Compose)
 */
@AndroidEntryPoint
class LoginActivity : ComponentActivity() {
    
    companion object {
        private const val TAG = "LoginActivity"
    }
    
    private val viewModel: LoginViewModel by viewModels()
    private var googleSignInClient: GoogleSignInClient? = null
    
    // Google Sign-In 결과 처리
    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_CANCELED && result.data == null) {
            viewModel.setLoading(false)
            return@registerForActivityResult
        }
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            Log.d(TAG, "✅ Google Sign-In 성공: ${account.email}")
            
            val idToken = account.idToken
            if (idToken != null) {
                Log.d(TAG, "🟢 ID Token 획득 성공 (토큰 길이: ${idToken.length})")
                viewModel.handleGoogleLoginResult(
                    idToken = idToken,
                    email = account.email,
                    name = account.displayName,
                    googleId = account.id,
                    profileImage = account.photoUrl?.toString()
                )
            } else {
                Log.e(TAG, "❌ ID Token이 null입니다. Web Client ID 설정을 확인하세요.")
                viewModel.setLoading(false)
                viewModel.showErrorMessage("구글 로그인에 실패했습니다. 다시 시도해주세요.")
            }
        } catch (e: ApiException) {
            viewModel.setLoading(false)
            if (e.statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED || e.statusCode == CommonStatusCodes.CANCELED) {
                return@registerForActivityResult
            }
            Log.e(TAG, "Google 로그인 실패 (status=${e.statusCode})")
            val errorMsg = when (e.statusCode) {
                CommonStatusCodes.NETWORK_ERROR -> "인터넷 연결을 확인한 뒤 다시 시도해 주세요."
                else -> "Google 로그인을 완료하지 못했어요. 다시 시도하거나 이메일로 계속해 주세요."
            }
            viewModel.showErrorMessage(errorMsg)
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        
        setupGoogleSignIn()
                                                                                                                                                                                                
        // 기존 가입자로부터 전달된 전화번호 확인
        val prefilledPhone = intent.getStringExtra("prefilled_phone")
        if (prefilledPhone != null) {
            Log.d(TAG, "📱 전달받은 전화번호: $prefilledPhone")
            viewModel.setPrefilledPhone(prefilledPhone)
        }
        
        setContent {
            SmapTheme {
                Surface(
                    modifier = Modifier.fillMaxSize()
                ) {
                    LoginScreen(
                        viewModel = viewModel,
                        onLoginSuccess = {
                            Log.d(TAG, "✅ 로그인 성공 - MainActivity로 이동")
                            navigateToMain()
                        },
                        onNavigateToRegister = { socialData ->
                            Log.d(TAG, "📝 회원가입 화면으로 이동")
                            navigateToRegister(socialData)
                        },
                        onGoogleSignInClick = {
                            Log.d(TAG, "🔵 Google 로그인 시작")
                            startGoogleSignIn()
                        },
                        onKakaoSignInClick = {
                            Log.d(TAG, "🟡 Kakao 로그인 시작")
                            startKakaoSignIn()
                        }
                    )
                }
            }
        }
    }
    
    private fun setupGoogleSignIn() {
        // Web OAuth 클라이언트 ID (requestIdToken에는 반드시 Web Client ID를 사용해야 함).
        // google-services 플러그인이 google-services.json 의 웹 클라이언트(client_type 3)로 생성한 리소스.
        // 리소스가 없으면 컴파일 단계에서 실패한다(값이 비어 조용히 건너뛰지 않도록 단일 출처로 둔다).
        val serverClientId = getString(R.string.default_web_client_id)

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(serverClientId)
            .requestEmail()
            .requestProfile()
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)
        Log.d(TAG, "Google Sign-In 설정 완료")
    }
    
    private fun startGoogleSignIn() {
        val client = googleSignInClient
        if (client == null) {
            Log.e(TAG, "❌ Google Sign-In이 초기화되지 않았습니다.")
            viewModel.showErrorMessage("Google 로그인을 완료하지 못했어요. 다시 시도하거나 이메일로 계속해 주세요.")
            return
        }
        viewModel.setLoading(true)
        val signInIntent = client.signInIntent
        googleSignInLauncher.launch(signInIntent)
    }
    
    private fun startKakaoSignIn() {
        viewModel.setLoading(true)
        
        // 카카오톡 설치 여부 확인
        if (UserApiClient.instance.isKakaoTalkLoginAvailable(this)) {
            UserApiClient.instance.loginWithKakaoTalk(this) { token, error ->
                if (error != null) {
                    Log.e(TAG, "❌ 카카오톡 로그인 실패", error)
                    // 사용자가 취소한 경우가 아니면 카카오계정 로그인 시도
                    if (error is ClientError && error.reason == ClientErrorCause.Cancelled) {
                        viewModel.setLoading(false)
                    } else {
                        startKakaoAccountSignIn()
                    }
                } else if (token != null) {
                    Log.d(TAG, "✅ 카카오톡 로그인 성공")
                    fetchKakaoUserInfo(token.accessToken)
                }
            }
        } else {
            startKakaoAccountSignIn()
        }
    }

    private fun startKakaoAccountSignIn() {
        UserApiClient.instance.loginWithKakaoAccount(this) { token, error ->
            if (error != null) {
                Log.e(TAG, "❌ 카카오계정 로그인 실패", error)
                viewModel.setLoading(false)
                if (error !is ClientError || error.reason != ClientErrorCause.Cancelled) {
                    viewModel.showErrorMessage("카카오 로그인을 완료하지 못했어요. 다시 시도하거나 이메일로 계속해 주세요.")
                }
            } else if (token != null) {
                Log.d(TAG, "✅ 카카오계정 로그인 성공")
                fetchKakaoUserInfo(token.accessToken)
            }
        }
    }

    private fun fetchKakaoUserInfo(accessToken: String) {
        UserApiClient.instance.me { user, error ->
            if (error != null) {
                Log.e(TAG, "❌ 카카오 사용자 정보 요청 실패", error)
                viewModel.setLoading(false)
                viewModel.showErrorMessage("카카오 사용자 정보를 가져오지 못했습니다.")
            } else if (user != null) {
                Log.d(TAG, "✅ 카카오 사용자 정보 획득: ${user.kakaoAccount?.email}")
                viewModel.handleKakaoLoginResult(
                    accessToken = accessToken,
                    email = user.kakaoAccount?.email,
                    nickname = user.kakaoAccount?.profile?.nickname,
                    kakaoId = user.id.toString(),
                    profileImage = user.kakaoAccount?.profile?.profileImageUrl
                )
            }
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, android.R.anim.fade_in, android.R.anim.fade_out)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }
        finish()
    }

    private fun navigateToRegister(socialData: Map<String, String>?) {
        val intent = Intent(this, com.dmonster.smap.ui.register.RegisterActivity::class.java)
        socialData?.let {
            intent.putExtra(
                com.dmonster.smap.ui.register.RegisterActivity.EXTRA_SOCIAL_DATA,
                HashMap(it)
            )
        }
        startActivity(intent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, android.R.anim.fade_in, android.R.anim.fade_out)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }
        finish()
    }
}
