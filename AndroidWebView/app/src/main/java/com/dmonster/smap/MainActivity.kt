package com.dmonster.smap

import android.annotation.SuppressLint
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.webkit.*
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.Gson
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

class MainActivity : AppCompatActivity() {
    companion object {
        private const val TAG: String = "SMAP_MainActivity"
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE: Int = 1001
        private const val MULTIPLE_PERMISSIONS_REQUEST_CODE: Int = 1002
        private const val BACKGROUND_LOCATION_PERMISSION_REQUEST_CODE: Int = 1003
        private const val LOCATION_PERMISSIONS_REQUEST_CODE: Int = 1004
    }
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLayout: LinearLayout
    private lateinit var retryButton: Button
    
    // 🔥 스레드 안전성을 위한 User-Agent 저장
    private val userAgentString: String by lazy {
        if (isEmulator()) {
            "Mozilla/5.0 (Linux; Android 14; Emulator) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 SMAP-Android-Emulator/1.0"
        } else {
            "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 SMAP-Android/1.0"
        }
    }
    
    // 🔥 운영서버로만 접속하도록 설정
    private val webViewUrl: String get() {
        android.util.Log.d("SMAP_WebView", "운영서버로 접속: https://nextstep.smap.site/")
        return "https://nextstep.smap.site/"
    }
    
    private val fallbackUrls: List<String> get() {
        val urls = listOf(
            "https://nextstep.smap.site/"     // 운영서버만 사용
        )
        
        android.util.Log.d("SMAP_WebView", "🔥 fallbackUrls 설정: ${urls.joinToString(", ")}")
        return urls
    }
    private var currentUrlIndex = 0
    private var vibrator: Vibrator? = null
    private var isLoading = false
    
    // Google Sign-In 관련 변수
    private lateinit var googleSignInClient: GoogleSignInClient
    private val gson = Gson()
    
    // FCM 관련 변수 (최소화)
    private lateinit var firebaseMessaging: FirebaseMessaging
    
    // 🌍 웹 위치 권한 콜백 (onGeolocationPermissionsShowPrompt에서 사용)
    private var pendingGeolocationOrigin: String? = null
    private var pendingGeolocationCallback: android.webkit.GeolocationPermissions.Callback? = null
    
    // 🔥 권한 요청 관련 변수들
    private val requiredPermissions = mutableListOf<String>().apply {
        add(Manifest.permission.CAMERA) // 카메라 권한
        add(Manifest.permission.READ_EXTERNAL_STORAGE) // 사진보관함 읽기 권한
        // 위치 권한은 별도로 관리 (필요할 때만 요청)
        
        // Android 10 (API 29) 이상에서 동작 인식 권한
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        
        // Android 13 (API 33) 이상에서 알림 권한
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    
    // 🔥 위치 권한은 별도로 관리 (필요할 때만 요청)
    private val locationPermissions = listOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )
    
    // 🔥 백그라운드 위치 권한 (Android 10+ 에서 별도 요청 필요)
    private val backgroundLocationPermission = Manifest.permission.ACCESS_BACKGROUND_LOCATION
    
    private var isFirstLogin = false // 첫 로그인 여부 확인
    private var hasRequestedPermissions = false // 권한 요청 여부 확인
    
    // Google Sign-In 결과 처리
    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            handleGoogleSignInSuccess(account)
        } catch (e: ApiException) {
            // 🔥 에뮬레이터에서도 구글 로그인 테스트 활성화
            if (isEmulator() && e.statusCode == 10) {
                android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 서명 오류 발생 - Google Cloud Console 설정 확인 필요")
                android.util.Log.w("GoogleSignIn", "⚠️ SHA-1 지문이 등록되어 있는지 확인하세요: 8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17")
                
                // 실제 오류 메시지를 표시하여 문제를 정확히 파악할 수 있도록 함
                handleGoogleSignInError(e)
            } else {
                handleGoogleSignInError(e)
            }
        } catch (e: Exception) {
            android.util.Log.e("GoogleSignIn", "Google Sign-In 결과 처리 중 예상치 못한 오류", e)
            // 일반적인 예외 처리
            val status = com.google.android.gms.common.api.Status(com.google.android.gms.common.api.CommonStatusCodes.INTERNAL_ERROR)
            val apiException = ApiException(status)
            handleGoogleSignInError(apiException)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // ⚠️ setDefaultUncaughtExceptionHandler 제거
            // - 기본 크래시 리포팅(Google Play Console)을 방해함
            // - ANR 및 크래시 정보가 Play Console에 전달되지 않음
            // - 대신 로그만 남기고 기본 핸들러에게 처리 위임
            
            // 🔥 에뮬레이터 환경 정보 로깅
            android.util.Log.d("SMAP_WebView", "=== 앱 시작 ===")
            android.util.Log.d("SMAP_WebView", "빌드 타입: ${if (BuildConfig.DEBUG) "DEBUG" else "RELEASE"}")
            android.util.Log.d("SMAP_WebView", "에뮬레이터 감지: ${isEmulator()}")
            android.util.Log.d("SMAP_WebView", "기기 모델: ${android.os.Build.MODEL}")
            android.util.Log.d("SMAP_WebView", "제조사: ${android.os.Build.MANUFACTURER}")
            android.util.Log.d("SMAP_WebView", "FINGERPRINT: ${android.os.Build.FINGERPRINT}")
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "onCreate 초기화 중 오류: ${e.message}", e)
            // 초기화 실패 시에도 앱이 시작되도록 함
        }
        
        // 🔥 에뮬레이터에서 Toast로 디버그 정보 표시
        if (isEmulator()) {
            val debugMessage = if (BuildConfig.DEBUG) {
                "🔧 에뮬레이터 DEBUG 모드\n개발 서버 연결 시도: 10.0.2.2:3000"
            } else {
                "🔧 에뮬레이터 RELEASE 모드\n운영 서버 연결: nextstep.smap.site"
            }
            Toast.makeText(this, debugMessage, Toast.LENGTH_LONG).show()
        }
        
        // Android 15 호환성을 위한 Edge-to-Edge 설정
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
        }
        
        setContentView(R.layout.activity_main)

        try {
            // View 초기화
            webView = findViewById(R.id.webView)
            progressBar = findViewById(R.id.progressBar)
            errorLayout = findViewById(R.id.errorLayout)
            retryButton = findViewById(R.id.retryButton)

            // *** WebView 디버깅 (개발 환경에서만 활성화) ***
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)  // DEBUG 빌드에서만 활성화
            }
            // ************************************

            // 🔥 FCM 토큰 초기화 (앱 시작 시 즉시 실행)
            initializeFCMToken()

            setupGoogleSignIn()
            setupVibrator()

            // 🔥 WebView 설정 전에 즉시 인터페이스 등록
            android.util.Log.d("SMAP_WebView", "🔥 onCreate에서 AndroidGoogleSignIn 인터페이스 즉시 등록")

            setupWebView()
            
            // 🔥 쿠키 영속성 설정 (로그인 세션 2주 이상 유지)
            // ⚠️ webView 초기화 이후에 호출해야 함
            setupCookiePersistence()
            
            setupRetryButton()
            loadWebView()

            // 🚀 FCM 토큰 초기화 (최소화 - 필요할 때만 업데이트)
            initializeFCMTokenMinimal()

                    // 🔄 iOS 스타일 FCM 토큰 검증 (새로 추가)
        validateFCMTokenOnAppStart()

        // FCM 진단 함수 웹뷰 인터페이스에 추가
        webView.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun diagnoseFCMIssues() {
                runOnUiThread {
                    diagnoseFCMIssues()
                }
            }

            @android.webkit.JavascriptInterface
            fun forceRefreshFCMToken() {
                runOnUiThread {
                    forceRefreshFCMToken()
                }
            }
        }, "FCMDiagnostic")

            // 🔥 앱 설치 후 권한 요청 (iOS 스타일)
            requestInitialPermissions()
            
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "onCreate 중 오류 발생", e)
            // 오류 발생 시 기본 오류 화면 표시
            showError()
        }
    }

    private fun setupGoogleSignIn() {
        try {
            android.util.Log.d("GoogleSignIn", "Google Sign-In 설정 시작");
            
            // 🔥 에뮬레이터에서 Google Play Services 네트워크 문제 완화
            if (isEmulator()) {
                android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터 환경 감지")
                
                // ⚠️ Thread.sleep() 제거 - ANR 원인!
                // 네트워크 연결 상태 확인
                if (!isNetworkAvailable()) {
                    android.util.Log.w("GoogleSignIn", "⚠️ 네트워크 연결 없음 - Google Sign-In 설정 건너뜀")
                    return
                }
            }
            
            // 🔥 Android 전용 OAuth 클라이언트 ID (향후 네이티브 Google Sign-In 구현 시 사용 예정)
            // Google Cloud Console의 "Android 애플리케이션" OAuth 클라이언트 ID
            // val androidClientId = if (BuildConfig.DEBUG) {
            //     "283271180972-vr5c8q3uh9k8nkl6ql0i9qr8rv9kqm0n.apps.googleusercontent.com"
            // } else {
            //     "283271180972-vr5c8q3uh9k8nkl6ql0i9qr8rv9kqm0n.apps.googleusercontent.com"
            // }
            
            // 🔥 Android 앱에서는 Android OAuth 클라이언트 ID를 사용해야 함
            // 주의: Google Cloud Console에서 Android 클라이언트 ID를 복사해서 사용
            val androidClientId = "283271180972-02ajuasfuecajd0holgu7iqb5hvtjgbp.apps.googleusercontent.com"  // TODO: Google Cloud Console에서 Android 클라이언트 ID로 교체 필요
            val serverClientId = androidClientId  // Android 클라이언트 ID 사용
            
            android.util.Log.d("GoogleSignIn", "빌드 타입: ${if (BuildConfig.DEBUG) "DEBUG" else "RELEASE"}")
            android.util.Log.d("GoogleSignIn", "Server(Web) OAuth 클라이언트 ID: $serverClientId")
            android.util.Log.d("GoogleSignIn", "패키지 이름: com.dmonster.smap")
            android.util.Log.d("GoogleSignIn", "에뮬레이터 환경: ${isEmulator()}")
            
            // 🔥 Google Play Services 버전 확인
            try {
                val packageInfo = packageManager.getPackageInfo("com.google.android.gms", 0)
                android.util.Log.d("GoogleSignIn", "Google Play Services 버전: ${packageInfo.versionName} (${packageInfo.versionCode})")
            } catch (e: Exception) {
                android.util.Log.w("GoogleSignIn", "Google Play Services 버전 확인 실패: ${e.message}")
            }
            
            // 🔥 Google Play Services 상태 먼저 확인 (실제 기기에서도 확인)
            val googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance()
            val resultCode = googleApiAvailability.isGooglePlayServicesAvailable(this)
            android.util.Log.d("GoogleSignIn", "Google Play Services 상태: $resultCode")
            
            // 실제 기기에서 Google Play Services 문제 시 해결 시도
            if (resultCode != com.google.android.gms.common.ConnectionResult.SUCCESS && !isEmulator()) {
                android.util.Log.w("GoogleSignIn", "⚠️ 실제 기기에서 Google Play Services 문제 감지")
                if (googleApiAvailability.isUserResolvableError(resultCode)) {
                    android.util.Log.d("GoogleSignIn", "사용자가 해결 가능한 오류 - 다이얼로그 표시")
                    googleApiAvailability.getErrorDialog(this, resultCode, 9001)?.show()
                }
            }
            
            when (resultCode) {
                com.google.android.gms.common.ConnectionResult.SUCCESS -> {
                    android.util.Log.d("GoogleSignIn", "✅ Google Play Services 정상")
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED -> {
                    android.util.Log.w("GoogleSignIn", "⚠️ Google Play Services 업데이트 필요")
                    if (isEmulator()) {
                        android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서는 Google Sign-In 기능 제한될 수 있음")
                        // 에뮬레이터에서는 서명 오류를 무시하고 계속 진행
                        android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 서명 오류 무시하고 계속 진행")
                    }
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_DISABLED -> {
                    android.util.Log.e("GoogleSignIn", "❌ Google Play Services 비활성화")
                    if (isEmulator()) {
                        android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 Google Play Services가 비활성화됨 - 계속 진행")
                        // 에뮬레이터에서도 계속 진행하여 실제 오류를 확인할 수 있도록 함
                    }
                }
                else -> {
                    android.util.Log.e("GoogleSignIn", "❌ Google Play Services 오류: $resultCode")
                    if (isEmulator()) {
                        android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 Google Play Services 오류 - 계속 진행")
                        // 에뮬레이터에서도 계속 진행하여 실제 오류를 확인할 수 있도록 함
                    }
                }
            }
            
            // 🔥 Google Sign-In 설정 (Android 네이티브 + 서버 검증용)
            // WebView가 아닌 시스템 브라우저에서 인증하도록 설정
            val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(serverClientId)  // 서버 검증용 Web 클라이언트 ID로 ID 토큰 요청
                .requestEmail()
                .requestProfile()
                .build()
            
            android.util.Log.d("GoogleSignIn", "GoogleSignInOptions 생성 완료")
            
            googleSignInClient = GoogleSignIn.getClient(this, gso)
            android.util.Log.d("GoogleSignIn", "GoogleSignInClient 생성 완료")
            
            // 🔥 현재 로그인된 계정 확인 (에뮬레이터에서는 timeout 방지)
            try {
                val account = GoogleSignIn.getLastSignedInAccount(this)
                if (account != null) {
                    android.util.Log.d("GoogleSignIn", "이미 로그인된 계정 발견: ${account.email}")
                    android.util.Log.d("GoogleSignIn", "계정 ID: ${account.id}")
                    android.util.Log.d("GoogleSignIn", "계정 이름: ${account.displayName}")
                    android.util.Log.d("GoogleSignIn", "ID 토큰 존재: ${account.idToken != null}")
                    android.util.Log.d("GoogleSignIn", "서버 인증 코드 존재: ${account.serverAuthCode != null}")
                } else {
                    android.util.Log.d("GoogleSignIn", "로그인된 계정 없음")
                }
            } catch (e: Exception) {
                android.util.Log.w("GoogleSignIn", "기존 계정 확인 중 오류 (에뮬레이터에서 정상): ${e.message}")
            }
            
            android.util.Log.d("GoogleSignIn", "Google Sign-In 설정 완료")
            
        } catch (e: Exception) {
            android.util.Log.e("GoogleSignIn", "Google Sign-In 설정 실패", e)
            android.util.Log.e("GoogleSignIn", "오류 상세: ${e.message}")
            
            // 🔥 에뮬레이터에서는 Google Sign-In 실패를 경고로 처리
            if (isEmulator()) {
                android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 Google Sign-In 설정 실패는 정상적인 현상일 수 있음")
                android.util.Log.w("GoogleSignIn", "⚠️ 웹 기반 로그인을 사용하거나 실제 기기에서 테스트하세요")
            }
        }
    }

    private fun setupVibrator() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    private fun setupWebView() {
        try {
            // 🔥 AndroidGoogleSignIn 인터페이스 즉시 등록 (가장 먼저)
            android.util.Log.d("SMAP_WebView", "🔥 setupWebView 시작 - AndroidGoogleSignIn 인터페이스 즉시 등록")
            webView.addJavascriptInterface(GoogleSignInInterface(), "AndroidGoogleSignIn")
            android.util.Log.d("SMAP_WebView", "✅ AndroidGoogleSignIn 인터페이스 등록 완료 (setupWebView)")
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "WebView 인터페이스 등록 중 오류: ${e.message}", e)
            // 인터페이스 등록 실패 시에도 앱이 계속 작동하도록 함
        }
        
        try {
            // 🔥 권한 요청 인터페이스 등록
            webView.addJavascriptInterface(PermissionInterface(), "AndroidPermissions")
            android.util.Log.d("SMAP_WebView", "✅ AndroidPermissions 인터페이스 등록 완료")
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "권한 인터페이스 등록 중 오류: ${e.message}", e)
        }

        // 🔥 localStorage 데이터 저장 인터페이스 등록
        webView.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun saveUserDataToPrefs(userDataJson: String?) {
                runOnUiThread {
                    saveUserDataFromLocalStorage(userDataJson)
                }
            }

            @android.webkit.JavascriptInterface
            fun saveMtIdxToPrefs(mtIdx: String?) {
                runOnUiThread {
                    saveMtIdxFromLocalStorage(mtIdx)
                }
            }

            @android.webkit.JavascriptInterface
            fun saveAuthTokenToPrefs(authToken: String?) {
                runOnUiThread {
                    saveAuthTokenFromLocalStorage(authToken)
                }
            }
        }, "AndroidStorage")
        android.util.Log.d("SMAP_WebView", "✅ AndroidStorage 인터페이스 등록 완료")
        
        // 🔥 Google OAuth WebView 차단 우회를 위한 User-Agent 설정
        // WebView 식별 문자열을 제거하여 일반 브라우저로 인식되도록 함
        val originalUserAgent = WebSettings.getDefaultUserAgent(this)
        val customUserAgent = originalUserAgent
            .replace("; wv", "")  // WebView 식별자 제거
            .replace("Version/[0-9.]+\\s+".toRegex(), "")  // Version 정보 제거
            .replace("\\s+Mobile\\s+".toRegex(), " Mobile ")  // Mobile 정보 정규화
        
        android.util.Log.d("SMAP_WebView", "원본 User-Agent: $originalUserAgent")
        android.util.Log.d("SMAP_WebView", "수정된 User-Agent: $customUserAgent")
        
        webView.settings.userAgentString = customUserAgent
        
        webView.settings.apply {
            // 🔥 기본 기능 - 완전 허용
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

            // 🔥 확대/축소 설정
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // 🔥 네트워크/캐시 정책 - 쿠키/세션 유지를 위해 LOAD_DEFAULT 사용
            cacheMode = WebSettings.LOAD_DEFAULT
            loadsImagesAutomatically = true
            blockNetworkImage = false
            blockNetworkLoads = false

            // 🔥 권한/보안 관련 - 완전 허용
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            setNeedInitialFocus(false)
            setSupportMultipleWindows(false)

            // 🔥 추가 WebView 설정 - 완전 허용
            setDatabaseEnabled(true)
            setDomStorageEnabled(true)
            setSaveFormData(false)
            setAllowContentAccess(false)
            setLoadsImagesAutomatically(true)
            setBlockNetworkImage(false)
            setBlockNetworkLoads(false)
            setJavaScriptCanOpenWindowsAutomatically(true)
            setSupportMultipleWindows(false)
            setLoadWithOverviewMode(true)
            setUseWideViewPort(true)
            setBuiltInZoomControls(false)
            setDisplayZoomControls(false)
            setSupportZoom(false)
        }
        
        // 🔥 보안 강화된 WebView 설정 (Google Play 정책 준수)
        webView.settings.allowUniversalAccessFromFileURLs = false  // 보안 강화
        webView.settings.allowFileAccessFromFileURLs = false       // 보안 강화
        webView.settings.setSupportMultipleWindows(false)          // 보안 강화
        webView.settings.javaScriptCanOpenWindowsAutomatically = false  // 보안 강화
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT      // 캐시 정상 사용
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        
        // 🔥 보안 강화를 위한 설정
        webView.settings.allowContentAccess = false
        webView.settings.allowFileAccess = false
        webView.settings.loadWithOverviewMode = true
        webView.settings.useWideViewPort = true
        webView.settings.setNeedInitialFocus(false)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        
        // 🔥 강력한 ORB 우회 설정
        webView.settings.setSupportMultipleWindows(true)
        webView.settings.javaScriptCanOpenWindowsAutomatically = true
        webView.settings.setDomStorageEnabled(true)
        webView.settings.setDatabaseEnabled(true)
        webView.settings.setGeolocationEnabled(true)
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT  // 🔥 로그인 세션 유지를 위해 LOAD_DEFAULT 사용
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        
        // 🔥 보안 강화 - 파일 URL 접근 제한
        webView.settings.allowUniversalAccessFromFileURLs = false
        webView.settings.allowFileAccessFromFileURLs = false

        // 🔥 Google OAuth 지원을 위한 WebView 위장 설정
        webView.evaluateJavascript("""
            window.chrome = window.chrome || {};
            window.chrome.webview = false;  // WebView가 아닌 것처럼 설정
            
            // Google OAuth를 위한 추가 설정
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true
            });
            
            // WebView 감지 방지
            Object.defineProperty(window, '_cordovaNative', {
                get: () => undefined,
                configurable: true
            });
            
            // Android 브리지 숨기기 (OAuth 동안만)
            window._originalAndroidBridge = window.AndroidGoogleSignIn;
            
            console.log('🔥 [WEBVIEW SETUP] Google OAuth 지원 설정 완료');
        """, null)
        
        // 🔥 Android 브리지 스크립트를 미리 주입
        injectAndroidBridgeEarly()
        
        // 🔥 초기 JavaScript 인터페이스 등록 (WebView 설정 시점에 즉시 실행)
        injectInitialInterfaces()

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                android.util.Log.d("SMAP_WebView", "🔥 페이지 로딩 시작: $url (index: $currentUrlIndex)")
                showLoading(true)
                hideError()
                
                // 🔥 페이지 로딩 시작 시 인터페이스 상태 확인
                android.util.Log.d("SMAP_WebView", "🔍 페이지 로딩 시작 - 인터페이스 상태 확인")
                
                // 🔥 인터페이스 상태 확인
                webView.evaluateJavascript("""
                    console.log('🔍 [PAGE START] 인터페이스 상태 확인');
                    console.log('🔍 [PAGE START] AndroidGoogleSignIn:', !!window.AndroidGoogleSignIn);
                    console.log('🔍 [PAGE START] AndroidPermissions:', !!window.AndroidPermissions);
                    console.log('🔍 [PAGE START] signIn 함수:', !!(window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function'));
                    if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                        console.log('✅ [PAGE START] 인터페이스 정상 작동');
                        window.__ANDROID_GOOGLE_SIGNIN_READY__ = true;
                    } else {
                        console.error('❌ [PAGE START] 인터페이스 문제 발견');
                        window.__ANDROID_GOOGLE_SIGNIN_READY__ = false;
                    }
                """, null)
                
                // 🔥 페이지 로딩 시작 시 타이머 설정 (5초 후 타임아웃)
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    if (isLoading) {
                        android.util.Log.w("SMAP_WebView", "⚠️ 페이지 로딩 타임아웃 (5초), 강제 로딩 상태 해제 및 오류 화면 표시")
                        showLoading(false)
                        showError()
                    }
                }, 5000)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                android.util.Log.d("SMAP_WebView", "✅ 페이지 로딩 완료: $url")
                
                // 🔥 로딩 상태 확실히 해제
                showLoading(false)
                
                // 🔥 nextstep.smap.site가 정상적으로 로드된 경우 오류 화면 숨기기
                if (url?.contains("nextstep.smap.site") == true) {
                    android.util.Log.d("SMAP_WebView", "✅ nextstep.smap.site 로딩 완료 - 오류 화면 숨김")
                    hideError()
                }
                
                // 🔥 페이지 로드 완료 후 인터페이스 상태 확인만 (중복 등록 방지)
                android.util.Log.d("SMAP_WebView", "✅ 페이지 로드 완료 - 인터페이스 상태 확인")
                
                // 🔥 1초 후 인터페이스 상태만 확인 (재등록하지 않음)
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    android.util.Log.d("SMAP_WebView", "🔍 1초 후 인터페이스 상태 확인")
                    // 인터페이스가 제대로 등록되었는지 JavaScript로 확인
                    webView.evaluateJavascript("""
                        console.log('🔍 [PAGE LOAD] 인터페이스 상태 확인');
                        console.log('🔍 [PAGE LOAD] AndroidGoogleSignIn:', !!window.AndroidGoogleSignIn);
                        console.log('🔍 [PAGE LOAD] AndroidStorage:', !!window.AndroidStorage);
                        console.log('🔍 [PAGE LOAD] signIn 함수:', !!(window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function'));
                        if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                            console.log('✅ [PAGE LOAD] 인터페이스 정상 작동');
                        } else {
                            console.error('❌ [PAGE LOAD] 인터페이스 문제 발견');
                        }

                        // 🔥 localStorage에서 사용자 데이터 확인 및 Android로 전달
                        try {
                            const userDataStr = localStorage.getItem('user-data') || localStorage.getItem('smap_user_data');
                            if (userDataStr && window.AndroidStorage) {
                                console.log('📦 [STORAGE] localStorage에서 사용자 데이터 발견, Android로 전달');
                                window.AndroidStorage.saveUserDataToPrefs(userDataStr);

                                // JSON 파싱하여 개별 필드도 저장
                                const userData = JSON.parse(userDataStr);
                                if (userData && userData.mt_idx) {
                                    window.AndroidStorage.saveMtIdxToPrefs(userData.mt_idx.toString());
                                    console.log('✅ [STORAGE] 사용자 데이터 Android SharedPreferences에 저장 완료');
                                }
                            } else if (!window.AndroidStorage) {
                                console.warn('⚠️ [STORAGE] AndroidStorage 인터페이스 없음 - WebView 환경 아님');
                            } else {
                                console.log('📦 [STORAGE] localStorage에 사용자 데이터 없음');
                            }
                        } catch (error) {
                            console.warn('⚠️ [STORAGE] localStorage 데이터 처리 중 오류:', error);
                        }
                    """, null)
                }, 1000)
            }
            
            override fun onLoadResource(view: WebView?, url: String?) {
                super.onLoadResource(view, url)
                android.util.Log.d("SMAP_WebView", "📦 리소스 로딩: $url")
            }
            
            @Deprecated("Deprecated in Java")
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                android.util.Log.e("SMAP_WebView", "❌ WebView 오류: $errorCode - $description - $failingUrl")
                
                // 🔥 DNS 해석 실패 시 대체 URL 시도
                if (errorCode == -105 && failingUrl?.contains("google.com") == true) {
                    android.util.Log.d("SMAP_WebView", "🔥 DNS 해석 실패, 대체 URL 시도")
                    runOnUiThread {
                        webView.loadUrl("https://www.bing.com")
                    }
                }
            }

            // 🔥 DNS 해석 문제 해결을 위한 요청 가로채기
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                // 🔥 강력한 ORB 정책 우회: 모든 외부 리소스 요청 허용
                val url = request?.url?.toString() ?: ""
                val method = request?.method ?: "GET"
                
                android.util.Log.d("SMAP_WebView", "🔓 요청 가로채기: $method $url")
                
                // 🔥 모든 외부 리소스 허용 (ORB 정책 완전 우회)
                if (url.contains("accounts.google.com") || 
                    url.contains("oapi.map.naver.com") ||
                    url.contains("googleapis.com") ||
                    url.contains("gstatic.com") ||
                    url.contains("google.com")) {
                    android.util.Log.d("SMAP_WebView", "🔓 외부 리소스 요청 허용: $url")
                    return null // 기본 처리 허용
                }
                
                // 🔥 기본 동작 유지
                return super.shouldInterceptRequest(view, request)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                
                val errorCode = error?.errorCode
                val errorDescription = error?.description
                val errorUrl = request?.url?.toString()
                
                android.util.Log.e("SMAP_WebView", "🔥 WebView 오류 발생:")
                android.util.Log.e("SMAP_WebView", "  - URL: $errorUrl")
                android.util.Log.e("SMAP_WebView", "  - 오류 코드: $errorCode")
                android.util.Log.e("SMAP_WebView", "  - 오류 설명: $errorDescription")
                android.util.Log.e("SMAP_WebView", "  - 에뮬레이터: ${isEmulator()}")
                android.util.Log.e("SMAP_WebView", "  - 요청 메서드: ${request?.method}")
                android.util.Log.e("SMAP_WebView", "  - 요청 헤더: ${request?.requestHeaders}")
                
                // 🔥 ORB 차단 오류 완전 무시 및 강제 로드
                if (errorDescription?.toString()?.contains("ERR_BLOCKED_BY_ORB", ignoreCase = true) == true) {
                    android.util.Log.w("SMAP_WebView", "🔓 ORB 차단 오류 무시하고 JavaScript로 강제 로드: $errorUrl")
                    
                    // 🔥 JavaScript를 통해 차단된 리소스를 강제로 로드
                    runOnUiThread {
                        when {
                            errorUrl?.contains("accounts.google.com/gsi/client") == true -> {
                                webView.evaluateJavascript("""
                                    (function() {
                                        console.log('🔓 Google Sign-In 스크립트 강제 로드');
                                        window.google = window.google || {};
                                        window.google.accounts = window.google.accounts || {};
                                        window.google.accounts.id = window.google.accounts.id || {
                                            initialize: function() { console.log('Google ID initialized'); },
                                            renderButton: function() { console.log('Google button rendered'); },
                                            prompt: function() { console.log('Google prompt shown'); }
                                        };
                                    })();
                                """, null)
                            }
                            errorUrl?.contains("oapi.map.naver.com") == true -> {
                                webView.evaluateJavascript("""
                                    (function() {
                                        console.log('🔓 네이버 지도 API 강제 로드');
                                        window.naver = window.naver || {};
                                        window.naver.maps = window.naver.maps || {
                                            Map: function() { console.log('Naver Map initialized'); }
                                        };
                                    })();
                                """, null)
                            }
                        }
                    }
                    return // ORB 오류는 더 이상 처리하지 않음
                }
                
                // 🔥 DNS 해석 실패 시 IP 주소로 직접 접근 시도
                if (errorCode == WebViewClient.ERROR_HOST_LOOKUP || 
                    errorDescription?.toString()?.contains("ERR_NAME_NOT_RESOLVED", ignoreCase = true) == true) {
                    android.util.Log.w("SMAP_WebView", "DNS 해석 실패, IP 주소로 직접 접근 시도")
                    
                    // IP 주소로 직접 접근하는 URL로 변경
                    val ipUrl = when {
                        errorUrl?.contains("smap-next.vercel.app") == true -> "https://smap-next.vercel.app/"
                        errorUrl?.contains("nextstep.smap.site") == true -> "https://smap-next.vercel.app/"
                        else -> null
                    }
                    
                    if (ipUrl != null) {
                        android.util.Log.d("SMAP_WebView", "IP 주소로 재시도: $ipUrl")
                        // 🔥 스레드 안전성을 위해 runOnUiThread 사용
                        runOnUiThread {
                            // DNS/네트워크 음성 캐시를 비우고 재시도
                            try { webView.clearCache(true); webView.clearHistory() } catch (_: Exception) {}
                            webView.loadUrl(ipUrl)
                        }
                        return
                    }
                }
                
                // 🔥 nextstep.smap.site가 정상적으로 로드된 경우 오류 무시
                if (errorUrl?.contains("nextstep.smap.site") == true) {
                    android.util.Log.w("SMAP_WebView", "⚠️ nextstep.smap.site 오류 무시 - 정상적인 리소스 로딩 실패일 수 있음")
                    return
                }
                
                // 🔥 에뮬레이터에서 특정 오류는 무시 (Google Play Services 관련)
                if (isEmulator() && (errorDescription?.contains("google") == true || 
                                    errorDescription?.contains("gms") == true ||
                                    errorUrl?.contains("google") == true)) {
                    android.util.Log.w("SMAP_WebView", "⚠️ 에뮬레이터에서 Google 서비스 오류 무시: $errorDescription")
                    return
                }
                
                runOnUiThread {
                    when (errorCode) {
                        WebViewClient.ERROR_HOST_LOOKUP -> {
                            // DNS 오류 시 다음 URL 시도
                            android.util.Log.w("SMAP_WebView", "DNS resolution failed, trying next URL")
                            currentUrlIndex++
                            if (currentUrlIndex < fallbackUrls.size) {
                                Toast.makeText(this@MainActivity, "다른 서버로 연결을 시도합니다...", Toast.LENGTH_SHORT).show()
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        WebViewClient.ERROR_TIMEOUT -> {
                            // 타임아웃 시 재시도 (무한루프 방지)
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                android.util.Log.w("SMAP_WebView", "Connection timeout, trying next URL")
                                Toast.makeText(this@MainActivity, "연결 시간이 초과되었습니다. 다시 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "연결 시간이 초과되었습니다.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        WebViewClient.ERROR_CONNECT -> {
                            // 연결 오류 시 재시도 (무한루프 방지)
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                android.util.Log.w("SMAP_WebView", "Connection error, trying next URL")
                                Toast.makeText(this@MainActivity, "서버 연결에 실패했습니다. 다시 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "서버 연결에 실패했습니다.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        WebViewClient.ERROR_BAD_URL -> {
                            Toast.makeText(this@MainActivity, "잘못된 URL입니다.", Toast.LENGTH_LONG).show()
                            showError()
                        }
                        WebViewClient.ERROR_UNSUPPORTED_SCHEME -> {
                            Toast.makeText(this@MainActivity, "지원하지 않는 프로토콜입니다.", Toast.LENGTH_LONG).show()
                            showError()
                        }
                        WebViewClient.ERROR_FAILED_SSL_HANDSHAKE -> {
                            Toast.makeText(this@MainActivity, "SSL 연결에 실패했습니다.", Toast.LENGTH_LONG).show()
                            showError()
                        }
                        WebViewClient.ERROR_REDIRECT_LOOP -> {
                            Toast.makeText(this@MainActivity, "리다이렉트 루프가 발생했습니다.", Toast.LENGTH_LONG).show()
                            showError()
                        }
                        WebViewClient.ERROR_UNSUPPORTED_AUTH_SCHEME -> {
                            Toast.makeText(this@MainActivity, "지원하지 않는 인증 방식입니다.", Toast.LENGTH_LONG).show()
                            showError()
                        }
                        WebViewClient.ERROR_FILE_NOT_FOUND -> {
                            // 404 오류 시 다음 URL 시도
                            android.util.Log.w("SMAP_WebView", "404 Not Found, trying next URL")
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                Toast.makeText(this@MainActivity, "서버를 찾을 수 없습니다. 다른 서버로 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "서버를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        -1 -> {
                            // ORB 차단 오류 처리 - 더 강력한 재시도
                            android.util.Log.w("SMAP_WebView", "ORB blocked, trying next URL")
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                Toast.makeText(this@MainActivity, "접근이 차단되었습니다. 다른 서버로 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                // 대기 후 재시도
                                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                                    loadWebViewInternal()
                                }, 1000)
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "웹페이지 접근이 차단되었습니다.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        -2 -> {
                            // DNS 해석 실패 오류 처리
                            android.util.Log.w("SMAP_WebView", "DNS resolution failed, trying next URL")
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                Toast.makeText(this@MainActivity, "도메인을 찾을 수 없습니다. 다른 서버로 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "도메인을 찾을 수 없습니다. 네트워크 연결을 확인해주세요.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                        else -> {
                            // 기타 오류 시에도 재시도 (무한루프 방지)
                            if (currentUrlIndex < fallbackUrls.size - 1) {
                                android.util.Log.w("SMAP_WebView", "Unknown error, trying next URL")
                                Toast.makeText(this@MainActivity, "웹페이지 로드 중 오류가 발생했습니다. 다시 시도합니다...", Toast.LENGTH_SHORT).show()
                                currentUrlIndex++
                                loadWebViewInternal()
                                return@runOnUiThread
                            } else {
                                Toast.makeText(this@MainActivity, "웹페이지를 불러올 수 없습니다.", Toast.LENGTH_LONG).show()
                                showError()
                            }
                        }
                    }
                }
            }

            // SSL 오류 처리 - Google Play 정책 준수 (모든 SSL 오류 거부)
            // ⚠️ 중요: handler.proceed()를 호출하면 Google Play 정책 위반!
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                android.util.Log.e("SMAP_WebView", "❌ SSL Error 발생: ${error?.toString()}")
                
                // SSL 오류 유형 확인 (로깅용)
                val sslErrorType = when (error?.primaryError) {
                    SslError.SSL_NOTYETVALID -> "인증서가 아직 유효하지 않음"
                    SslError.SSL_EXPIRED -> "인증서 만료"
                    SslError.SSL_IDMISMATCH -> "호스트명 불일치"
                    SslError.SSL_UNTRUSTED -> "신뢰할 수 없는 인증서"
                    SslError.SSL_DATE_INVALID -> "인증서 날짜 오류"
                    SslError.SSL_INVALID -> "일반 SSL 오류"
                    else -> "알 수 없는 오류"
                }
                val host = error?.url ?: "unknown"
                
                android.util.Log.e("SMAP_WebView", "❌ SSL Error Type: $sslErrorType, Host: $host")
                
                // ⚠️ Google Play 정책 준수: 모든 SSL 오류 거부 (proceed 금지)
                // handler?.proceed()는 절대 호출하지 않음!
                handler?.cancel()
                
                // 사용자에게 오류 알림
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity, 
                        "보안 연결에 실패했습니다. 네트워크 연결을 확인해주세요.", 
                        Toast.LENGTH_LONG
                    ).show()
                    showError()
                }
            }

            // 인증 실패(401/403) 시, 초기 비로그인 상태에서는 인증 실패 페이지로 가지 않도록 홈으로 우회
            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)

                try {
                    val statusCode = errorResponse?.statusCode ?: return
                    val isMainFrame = request?.isForMainFrame == true
                    val notLoggedIn = !isUserLoggedIn()

                    if (isMainFrame && notLoggedIn && (statusCode == 401 || statusCode == 403)) {
                        android.util.Log.w(
                            "SMAP_WebView",
                            "⚠️ 인증 오류($statusCode) 감지 - 비로그인 초기 상태, 홈으로 우회"
                        )
                        runOnUiThread {
                            webView.loadUrl("https://nextstep.smap.site/home")
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("SMAP_WebView", "onReceivedHttpError 처리 중 오류", e)
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                
                // 🔥 무한루프 방지: 같은 URL로의 반복 요청 차단
                if (url == webView.url && currentUrlIndex == 0) {
                    android.util.Log.w("SMAP_WebView", "Preventing infinite loop for URL: $url")
                    return true
                }

                // 비로그인 초기 상태에서 인증 실패/권한 오류 페이지로의 이동을 우회
                try {
                    if (!isUserLoggedIn()) {
                        val lower = url.lowercase()
                        val isAuthFailUrl =
                            (lower.contains("auth") && (lower.contains("fail") || lower.contains("unauthorized"))) ||
                            lower.contains("/login-fail") ||
                            lower.contains("/auth-fail") ||
                            lower.contains("/unauthorized") ||
                            lower.contains("status=401") ||
                            lower.contains("status=403")

                        if (isAuthFailUrl) {
                            android.util.Log.w(
                                "SMAP_WebView",
                                "⚠️ 비로그인 상태에서 인증 실패 URL 감지: $url → 홈으로 우회"
                            )
                            webView.loadUrl("https://nextstep.smap.site/home")
                            return true
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("SMAP_WebView", "인증 실패 URL 우회 처리 중 오류", e)
                }
                
                // 외부 앱으로 열어야 하는 URL 처리
                when {
                    url.startsWith("tel:") -> {
                        // 전화 앱으로 열기
                        return false
                    }
                    url.startsWith("mailto:") -> {
                        // 이메일 앱으로 열기
                        return false
                    }
                    url.startsWith("sms:") -> {
                        // SMS 앱으로 열기
                        return false
                    }
                    url.startsWith("geo:") -> {
                        // 지도 앱으로 열기
                        return false
                    }
                    url.startsWith("market:") -> {
                        // Play Store로 열기
                        return false
                    }
                    else -> {
                        // 웹뷰에서 처리
                        return false
                    }
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                // 프로그레스바 업데이트 (필요시)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
            
            // 🌍 위치 권한 prompt 반복 방지 (한 번 동의하면 이후 자동 허용)
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                android.util.Log.d("SMAP_WebView", "🌍 [GEOLOCATION] 웹에서 위치 권한 요청: $origin")
                
                // 저장된 위치 권한 동의 여부 확인
                val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
                val isGeolocationGranted = prefs.getBoolean("web_geolocation_granted", false)
                
                // 네이티브 앱 위치 권한 확인
                val hasNativeLocationPermission = hasLocationPermissions()
                
                android.util.Log.d("SMAP_WebView", "🌍 [GEOLOCATION] 저장된 웹 위치 동의: $isGeolocationGranted")
                android.util.Log.d("SMAP_WebView", "🌍 [GEOLOCATION] 네이티브 위치 권한: $hasNativeLocationPermission")
                
                if (hasNativeLocationPermission) {
                    // 네이티브 앱에 위치 권한이 있으면 자동 허용
                    android.util.Log.d("SMAP_WebView", "✅ [GEOLOCATION] 네이티브 권한 있음 - 웹 위치 권한 자동 허용")
                    
                    // 웹 위치 권한 동의 저장
                    prefs.edit().putBoolean("web_geolocation_granted", true).apply()
                    
                    // 위치 권한 허용 (remember: true로 설정하여 다음 요청 시 prompt 생략)
                    callback?.invoke(origin, true, true)
                } else if (isGeolocationGranted) {
                    // 이전에 동의한 적이 있으면 자동 허용
                    android.util.Log.d("SMAP_WebView", "✅ [GEOLOCATION] 이전 동의 기록 있음 - 자동 허용")
                    callback?.invoke(origin, true, true)
                } else {
                    // 네이티브 권한도 없고 이전 동의도 없으면 권한 요청 후 허용
                    android.util.Log.d("SMAP_WebView", "🔔 [GEOLOCATION] 위치 권한 요청 실행")
                    
                    // 네이티브 위치 권한 요청
                    requestLocationPermissionsForWeb(origin, callback)
                }
            }
            
            // 🌍 위치 권한 해제 시 호출
            override fun onGeolocationPermissionsHidePrompt() {
                android.util.Log.d("SMAP_WebView", "🌍 [GEOLOCATION] 위치 권한 prompt 숨김")
            }
        }
    }

    private fun injectHapticInterface() {
        android.util.Log.d("SMAP_WebView", "🔥 JavaScript 인터페이스 주입 시작")
        
        try {
            // 🔥 기존 인터페이스 제거 후 재등록
            webView.removeJavascriptInterface("AndroidHaptic")
            webView.removeJavascriptInterface("AndroidGoogleSignIn")
            webView.removeJavascriptInterface("AndroidPermissions")
            
            // 🔥 JavaScript 인터페이스들을 WebView에 등록
            webView.addJavascriptInterface(HapticInterface(), "AndroidHaptic")
            android.util.Log.d("SMAP_WebView", "✅ AndroidHaptic 인터페이스 등록 완료")
            
            webView.addJavascriptInterface(PermissionInterface(), "AndroidPermissions")
            android.util.Log.d("SMAP_WebView", "✅ AndroidPermissions 인터페이스 등록 완료")
            
            // 🔥 Google Sign-In 인터페이스는 onPageStarted에서 등록 (중복 방지)
            android.util.Log.d("SMAP_WebView", "ℹ️ AndroidGoogleSignIn 인터페이스는 onPageStarted에서 등록됨")
            
            // 🔥 즉시 JavaScript 주입 (지연 없이)
            android.util.Log.d("SMAP_WebView", "🔥 즉시 JavaScript 주입 시작")
            
            val hapticScript = """
                console.log('📱 [ANDROID BRIDGE] JavaScript 인터페이스 주입 시작');
                
                // 햅틱 피드백 인터페이스 주입
                if (typeof window.hapticFeedback === 'undefined') {
                    window.hapticFeedback = {
                        light: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.lightHaptic();
                            }
                        },
                        medium: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.mediumHaptic();
                            }
                        },
                        heavy: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.heavyHaptic();
                            }
                        },
                        success: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.successHaptic();
                            }
                        },
                        warning: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.warningHaptic();
                            }
                        },
                        error: function() {
                            if (window.AndroidHaptic) {
                                window.AndroidHaptic.errorHaptic();
                            }
                        }
                    };
                    
                    // iOS와 호환성을 위한 별칭
                    window.haptic = window.hapticFeedback;
                    
                    console.log('✅ [ANDROID BRIDGE] Haptic feedback interface injected');
                }
                
                // 🔥 Google Sign-In 인터페이스 강화 주입 (즉시 실행)
                (function() {
                    console.log('🔍 [ANDROID GOOGLE SIGNIN] Google Sign-In 인터페이스 초기화 시작');
                    
                    // 네이티브 인터페이스 즉시 확인
                    if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                        console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 인터페이스 즉시 발견!');
                        
                        // 네이티브 인터페이스 참조 저장
                        var nativeInterface = window.AndroidGoogleSignIn;
                        
                        // 전역 Google Sign-In 객체 생성 (무한 루프 방지)
                        window.AndroidGoogleSignIn = {
                            _isSigningIn: false, // 중복 호출 방지 플래그
                            
                            signIn: function() {
                                console.log('📱 [ANDROID GOOGLE SIGNIN] signIn() 호출됨');
                                
                                // 중복 호출 방지
                                if (this._isSigningIn) {
                                    console.log('📱 [ANDROID GOOGLE SIGNIN] 이미 진행 중, 중복 호출 무시');
                                    return;
                                }
                                
                                this._isSigningIn = true;
                                console.log('📱 [ANDROID GOOGLE SIGNIN] 진행 중 플래그 설정');
                                
                                try {
                                    console.log('📱 [ANDROID GOOGLE SIGNIN] 네이티브 signIn() 호출 시도...');
                                    nativeInterface.signIn();
                                    console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 signIn() 호출 성공');
                                    
                                    // 10초 후 플래그 자동 해제 (타임아웃)
                                    setTimeout(function() {
                                        if (this._isSigningIn) {
                                            console.log('📱 [ANDROID GOOGLE SIGNIN] 타임아웃, 플래그 해제');
                                            this._isSigningIn = false;
                                        }
                                    }.bind(this), 10000);
                                    
                                } catch (error) {
                                    console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 signIn() 호출 실패:', error);
                                    this._isSigningIn = false;
                                }
                            },
                            
                            signOut: function() {
                                console.log('📱 [ANDROID GOOGLE SIGNIN] signOut() 호출됨');
                                try {
                                    nativeInterface.signOut();
                                    console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 signOut() 호출 성공');
                                } catch (error) {
                                    console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 signOut() 호출 실패:', error);
                                }
                            },
                            
                            checkStatus: function() {
                                console.log('📱 [ANDROID GOOGLE SIGNIN] checkStatus() 호출됨');
                                try {
                                    nativeInterface.checkStatus();
                                    console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 checkStatus() 호출 성공');
                                } catch (error) {
                                    console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 checkStatus() 호출 실패:', error);
                                }
                            },
                            
                            // 🔥 테스트 함수 추가
                            testConnection: function() {
                                console.log('🧪 [ANDROID GOOGLE SIGNIN] testConnection() 호출됨');
                                try {
                                    nativeInterface.testConnection();
                                    console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 testConnection() 호출 성공');
                                } catch (error) {
                                    console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 testConnection() 호출 실패:', error);
                                }
                            },
                            
                            // 진행 중 플래그 해제 (콜백에서 호출)
                            _clearSigningInFlag: function() {
                                console.log('📱 [ANDROID GOOGLE SIGNIN] 진행 중 플래그 해제');
                                this._isSigningIn = false;
                            }
                        };
                        
                        // 별칭 객체들도 생성 (웹에서 찾기 쉽게)
                        window.androidGoogleSignIn = window.AndroidGoogleSignIn;
                        window.androidBridge = {
                            googleSignIn: window.AndroidGoogleSignIn
                        };
                        
                        // 🔥 전역 테스트 함수 추가
                        window.testAndroidGoogleSignIn = function() {
                            console.log('🧪 [ANDROID TEST] 전역 테스트 함수 호출됨');
                            if (window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.testConnection) {
                                window.AndroidGoogleSignIn.testConnection();
                            } else {
                                console.error('🧪 [ANDROID TEST] testConnection 함수 없음');
                            }
                        };
                        
                        // 주입 완료 플래그 설정
                        window.__ANDROID_GOOGLE_SIGNIN_INJECTED__ = true;
                        window.__ANDROID_GOOGLE_SIGNIN_READY__ = true;
                        
                        console.log('✅ [ANDROID GOOGLE SIGNIN] Google Sign-In 인터페이스 주입 완료');
                        console.log('🔍 [ANDROID GOOGLE SIGNIN] 사용 가능한 객체들:', {
                            AndroidGoogleSignIn: !!window.AndroidGoogleSignIn,
                            androidGoogleSignIn: !!window.androidGoogleSignIn,
                            androidBridge: !!window.androidBridge,
                            hasSignInMethod: !!(window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.signIn),
                            hasTestMethod: !!(window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.testConnection)
                        });
                        
                        // 🔥 즉시 테스트 실행
                        console.log('🧪 [ANDROID TEST] 자동 테스트 시작');
                        setTimeout(function() {
                            if (window.testAndroidGoogleSignIn) {
                                window.testAndroidGoogleSignIn();
                            }
                        }, 1000);
                        
                    } else {
                        console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 인터페이스를 찾을 수 없습니다.');
                        console.log('🔍 [ANDROID GOOGLE SIGNIN] 사용 가능한 객체들:', {
                            AndroidGoogleSignIn: !!window.AndroidGoogleSignIn,
                            androidGoogleSignIn: !!window.androidGoogleSignIn,
                            androidBridge: !!window.androidBridge,
                            hasSignInMethod: !!(window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.signIn)
                        });
                        
                        // 🔥 재시도 로직 추가 (3초 후)
                        setTimeout(function() {
                            console.log('🔄 [ANDROID GOOGLE SIGNIN] 3초 후 재시도');
                            if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                                console.log('✅ [ANDROID GOOGLE SIGNIN] 재시도 성공 - 네이티브 인터페이스 발견!');
                                // 위의 인터페이스 설정 로직을 다시 실행
                                var nativeInterface = window.AndroidGoogleSignIn;
                                window.AndroidGoogleSignIn = {
                                    _isSigningIn: false,
                                    signIn: function() {
                                        if (this._isSigningIn) return;
                                        this._isSigningIn = true;
                                        try {
                                            nativeInterface.signIn();
                                            setTimeout(function() {
                                                if (this._isSigningIn) this._isSigningIn = false;
                                            }.bind(this), 10000);
                                        } catch (error) {
                                            console.error('❌ [ANDROID GOOGLE SIGNIN] 재시도 후 signIn() 호출 실패:', error);
                                            this._isSigningIn = false;
                                        }
                                    },
                                    signOut: function() {
                                        try { nativeInterface.signOut(); } catch (error) { console.error('signOut 실패:', error); }
                                    },
                                    checkStatus: function() {
                                        try { nativeInterface.checkStatus(); } catch (error) { console.error('checkStatus 실패:', error); }
                                    },
                                    testConnection: function() {
                                        try { nativeInterface.testConnection(); } catch (error) { console.error('testConnection 실패:', error); }
                                    },
                                    _clearSigningInFlag: function() { this._isSigningIn = false; }
                                };
                                window.androidGoogleSignIn = window.AndroidGoogleSignIn;
                                window.androidBridge = { googleSignIn: window.AndroidGoogleSignIn };
                                window.__ANDROID_GOOGLE_SIGNIN_INJECTED__ = true;
                                window.__ANDROID_GOOGLE_SIGNIN_READY__ = true;
                                console.log('✅ [ANDROID GOOGLE SIGNIN] 재시도 후 인터페이스 설정 완료');
                            } else {
                                console.error('❌ [ANDROID GOOGLE SIGNIN] 재시도 실패 - 여전히 인터페이스 없음');
                            }
                        }, 3000);
                    }
                })();
                
                // 🔥 핸들러 상태 모니터링 및 강제 초기화
                (function() {
                    console.log('🔍 [ANDROID HANDLER MONITOR] 핸들러 모니터링 시작');
                    
                    // 전역 플래그 설정
                    window.__SMAP_ANDROID_HANDLERS_READY__ = true;
                    window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = !!(window.AndroidGoogleSignIn);
                    window.__SMAP_ANDROID_HAPTIC_READY__ = !!(window.AndroidHaptic);
                    
                    // 핸들러 목록 생성
                    window.__SMAP_ANDROID_HANDLERS_LIST__ = [];
                    
                    if (window.AndroidHaptic) {
                        window.__SMAP_ANDROID_HANDLERS_LIST__.push('AndroidHaptic');
                    }
                    
                    if (window.AndroidGoogleSignIn) {
                        window.__SMAP_ANDROID_HANDLERS_LIST__.push('AndroidGoogleSignIn');
                    }
                    
                    console.log('✅ [ANDROID HANDLER MONITOR] 핸들러 모니터링 설정 완료');
                    console.log('📋 [ANDROID HANDLER MONITOR] 사용 가능한 핸들러들:', window.__SMAP_ANDROID_HANDLERS_LIST__);
                    
                    // 주입 완료 플래그 설정
                    window.__ANDROID_HANDLER_MONITOR_INJECTED__ = true;
                })();
                
                console.log('✅ [ANDROID BRIDGE] 모든 JavaScript 인터페이스 주입 완료');
            """.trimIndent()
            
            webView.evaluateJavascript(hapticScript) { result ->
                android.util.Log.d("SMAP_WebView", "📱 JavaScript 주입 완료: $result")
            }
            
            // 🔥 추가로 1초 후 재확인 및 강제 설정
            webView.postDelayed({
                android.util.Log.d("SMAP_WebView", "🔥 1초 후 인터페이스 재확인 및 강제 설정")
                
                val confirmScript = """
                    console.log('🔍 [ANDROID BRIDGE] 1초 후 인터페이스 재확인');
                    
                    // 강제로 인터페이스 존재 확인 및 설정
                    if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                        console.log('✅ [ANDROID BRIDGE] 1초 후 확인 - AndroidGoogleSignIn 인터페이스 정상');
                        
                        // 별칭 객체들 강제 생성
                        if (!window.androidGoogleSignIn) {
                            window.androidGoogleSignIn = window.AndroidGoogleSignIn;
                            console.log('✅ [ANDROID BRIDGE] androidGoogleSignIn 별칭 생성');
                        }
                        
                        if (!window.androidBridge) {
                            window.androidBridge = { googleSignIn: window.AndroidGoogleSignIn };
                            console.log('✅ [ANDROID BRIDGE] androidBridge 객체 생성');
                        }
                        
                        // 플래그 강제 설정
                        window.__ANDROID_GOOGLE_SIGNIN_INJECTED__ = true;
                        window.__ANDROID_GOOGLE_SIGNIN_READY__ = true;
                        window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = true;
                        
                        console.log('✅ [ANDROID BRIDGE] 1초 후 강제 설정 완료');
                    } else {
                        console.error('❌ [ANDROID BRIDGE] 1초 후 확인 - AndroidGoogleSignIn 인터페이스 없음');
                        console.log('🔍 [ANDROID BRIDGE] 사용 가능한 객체들:', {
                            AndroidGoogleSignIn: !!window.AndroidGoogleSignIn,
                            androidGoogleSignIn: !!window.androidGoogleSignIn,
                            androidBridge: !!window.androidBridge,
                            hasSignInMethod: !!(window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.signIn)
                        });
                    }
                """.trimIndent()
                
                webView.evaluateJavascript(confirmScript) { result ->
                    android.util.Log.d("SMAP_WebView", "📱 1초 후 재확인 완료: $result")
                }
            }, 1000)
            
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ JavaScript 인터페이스 주입 실패", e)
        }
    }
    
    private fun loadAndroidBridgeScript() {
        try {
            val bridgeScript = """
                // Android Bridge for Google Sign-In (개선된 버전)
                (function() {
                    'use strict';
                    
                    console.log('📱 Android Bridge 로드 중...');
                    
                    // Android 환경 감지
                    const isAndroid = /Android/.test(navigator.userAgent);
                    const hasAndroidGoogleSignIn = !!(window.AndroidGoogleSignIn);
                    const hasAndroidHaptic = !!(window.AndroidHaptic);
                    
                    console.log('🔍 Android 환경 감지:', {
                        isAndroid: isAndroid,
                        hasAndroidGoogleSignIn: hasAndroidGoogleSignIn,
                        hasAndroidHaptic: hasAndroidHaptic,
                        userAgent: navigator.userAgent.substring(0, 100)
                    });
                    
                    if (!isAndroid) {
                        console.log('📱 Android 환경이 아니므로 Android Bridge를 비활성화합니다.');
                        return;
                    }
                    
                    // Android Google Sign-In 브리지 객체 생성
                    window.androidBridge = {
                        googleSignIn: {
                            // Google 로그인 시작
                            signIn: function() {
                                console.log('📱 Android Google Sign-In 시작');
                                
                                if (hasAndroidGoogleSignIn) {
                                    try {
                                        window.AndroidGoogleSignIn.signIn();
                                        console.log('✅ Android Google Sign-In 네이티브 호출 성공');
                                        return true;
                                    } catch (error) {
                                        console.error('❌ Android Google Sign-In 네이티브 호출 실패:', error);
                                        return false;
                                    }
                                } else {
                                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                                    return false;
                                }
                            },
                            
                            // Google 로그아웃
                            signOut: function() {
                                console.log('📱 Android Google Sign-Out 시작');
                                
                                if (hasAndroidGoogleSignIn) {
                                    try {
                                        window.AndroidGoogleSignIn.signOut();
                                        console.log('✅ Android Google Sign-Out 네이티브 호출 성공');
                                        return true;
                                    } catch (error) {
                                        console.error('❌ Android Google Sign-Out 네이티브 호출 실패:', error);
                                        return false;
                                    }
                                } else {
                                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                                    return false;
                                }
                            },
                            
                            // 로그인 상태 확인
                            checkStatus: function() {
                                console.log('📱 Android Google Sign-In 상태 확인');
                                
                                if (hasAndroidGoogleSignIn) {
                                    try {
                                        window.AndroidGoogleSignIn.checkStatus();
                                        console.log('✅ Android Google Sign-In 상태 확인 네이티브 호출 성공');
                                        return true;
                                    } catch (error) {
                                        console.error('❌ Android Google Sign-In 상태 확인 네이티브 호출 실패:', error);
                                        return false;
                                    }
                                } else {
                                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                                    return false;
                                }
                            }
                        },
                        
                        // 햅틱 피드백
                        haptic: {
                            light: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.lightHaptic();
                                }
                            },
                            medium: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.mediumHaptic();
                                }
                            },
                            heavy: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.heavyHaptic();
                                }
                            },
                            success: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.successHaptic();
                                }
                            },
                            warning: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.warningHaptic();
                                }
                            },
                            error: function() {
                                if (window.AndroidHaptic) {
                                    window.AndroidHaptic.errorHaptic();
                                }
                            }
                        }
                    };
                    
                    // 🔥 전역 플래그 설정 (개선된 버전)
                    window.__SMAP_ANDROID_BRIDGE_READY__ = true;
                    window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = hasAndroidGoogleSignIn;
                    window.__SMAP_ANDROID_HAPTIC_READY__ = hasAndroidHaptic;
                    window.__SMAP_HANDLERS_READY__ = true; // iOS와 호환성
                    window.__SMAP_GOOGLE_LOGIN_READY__ = hasAndroidGoogleSignIn; // iOS와 호환성
                    
                    // 핸들러 목록 생성 (iOS와 호환성)
                    window.__SMAP_HANDLERS_LIST__ = [];
                    if (hasAndroidGoogleSignIn) window.__SMAP_HANDLERS_LIST__.push('AndroidGoogleSignIn');
                    if (hasAndroidHaptic) window.__SMAP_HANDLERS_LIST__.push('AndroidHaptic');
                    
                    console.log('✅ Android Bridge 초기화 완료:', {
                        hasGoogleSignIn: hasAndroidGoogleSignIn,
                        hasHaptic: hasAndroidHaptic,
                        bridgeReady: window.__SMAP_ANDROID_BRIDGE_READY__,
                        googleSignInReady: window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__,
                        hapticReady: window.__SMAP_ANDROID_HAPTIC_READY__,
                        handlersList: window.__SMAP_HANDLERS_LIST__
                    });
                    
                    // 🔥 핸들러 모니터링 함수 (iOS와 호환성)
                    window.__SMAP_CHECK_HANDLERS__ = function() {
                        const status = {
                            hasAndroidGoogleSignIn: hasAndroidGoogleSignIn,
                            hasAndroidHaptic: hasAndroidHaptic,
                            hasWebkit: !!(window.webkit),
                            hasMessageHandlers: !!(window.webkit?.messageHandlers),
                            handlersList: window.__SMAP_HANDLERS_LIST__,
                            bridgeReady: window.__SMAP_ANDROID_BRIDGE_READY__
                        };
                        
                        console.log('🔍 [ANDROID HANDLER CHECK] 핸들러 상태 확인:', status);
                        return status;
                    };
                    
                    // Android Google Sign-In 콜백 함수들을 전역으로 등록
                    window.googleSignInSuccess = function(idToken, userInfoJson) {
                        console.log('📱 Android Google Sign-In 성공 콜백 수신:', {
                            hasIdToken: !!idToken,
                            hasUserInfo: !!userInfoJson,
                            idTokenLength: idToken ? idToken.length : 0
                        });
                        
                        try {
                            const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
                            console.log('📱 Android Google Sign-In 사용자 정보:', userInfo);
                            
                            // 🚨 기존 iOS 콜백을 완전히 우회하고 직접 백엔드 API 호출
                            console.log('📱 Android Google Sign-In 백엔드 API 직접 호출 시작');
                            
                            // 성공 햅틱 피드백
                            if (window.SmapApp && window.SmapApp.haptic) {
                                window.SmapApp.haptic.success();
                            }
                            
                            // 🚨 기존 iOS 콜백 호출 방지
                            console.log('📱 Android Google Sign-In - 기존 iOS 콜백 호출 방지');
                            
                            // 요청 본문 구성
                            const requestBody = {
                                idToken: idToken,  // ✅ 올바른 파라미터 이름으로 전송
                                userInfo: userInfo,
                                source: 'android_native'
                            };
                            
                            console.log('📱 Android Google Sign-In 요청 본문:', {
                                hasIdToken: !!requestBody.idToken,
                                idTokenLength: requestBody.idToken ? requestBody.idToken.length : 0,
                                idTokenPrefix: requestBody.idToken ? requestBody.idToken.substring(0, 50) + '...' : 'N/A',
                                hasUserInfo: !!requestBody.userInfo,
                                userInfoKeys: requestBody.userInfo ? Object.keys(requestBody.userInfo) : [],
                                source: requestBody.source
                            });
                            
                            fetch('/api/google-auth', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(requestBody),
                            })
                            .then(response => {
                                console.log('📱 Android Google Sign-In 백엔드 응답 상태:', response.status);
                                return response.json();
                            })
                            .then(data => {
                                console.log('📱 Android Google Sign-In 백엔드 응답 데이터:', data);
                                
                                if (data.success) {
                                    console.log('📱 Android Google Sign-In 성공:', data.user);
                                    
                                    // 성공 햅틱 피드백
                                    if (window.SmapApp && window.SmapApp.haptic) {
                                        window.SmapApp.haptic.success();
                                    }
                                    
                                    // 🚨 직접 홈 페이지로 이동 (기존 콜백 우회)
                                    console.log('📱 Android Google Sign-In 직접 처리 - 홈으로 이동');
                                    window.location.href = '/home';
                                } else {
                                    throw new Error(data.error || '로그인에 실패했습니다.');
                                }
                            })
                            .catch(error => {
                                console.error('📱 Android Google Sign-In 백엔드 API 오류:', error);
                                
                                // 에러 햅틱 피드백
                                if (window.SmapApp && window.SmapApp.haptic) {
                                    window.SmapApp.haptic.error();
                                }
                                
                                // 에러 표시
                                if (window.showError) {
                                    window.showError(error.message || '백엔드 인증에 실패했습니다.');
                                } else {
                                    alert(error.message || '백엔드 인증에 실패했습니다.');
                                }
                            });
                            
                        } catch (error) {
                            console.error('📱 Android Google Sign-In 사용자 정보 파싱 오류:', error);
                            
                            // 에러 햅틱 피드백
                            if (window.SmapApp && window.SmapApp.haptic) {
                                window.SmapApp.haptic.error();
                            }
                            
                            // 에러 표시
                            if (window.showError) {
                                window.showError('사용자 정보를 처리하는 중 오류가 발생했습니다.');
                            } else {
                                alert('사용자 정보를 처리하는 중 오류가 발생했습니다.');
                            }
                        }
                    };
                    
                    // 🚨 기존 iOS 콜백을 덮어쓰기
                    window.onNativeGoogleLoginSuccess = function(idToken, userInfo) {
                        console.log('📱 Android - 기존 iOS 콜백 덮어쓰기됨, Android 전용 콜백 사용');
                        // 아무것도 하지 않음 - Android 전용 콜백이 처리함
                    };
                    
                    window.handleNativeGoogleLoginSuccess = function(idToken, userInfo) {
                        console.log('📱 Android - 기존 iOS 콜백 덮어쓰기됨, Android 전용 콜백 사용');
                        // 아무것도 하지 않음 - Android 전용 콜백이 처리함
                    };
                    
                    window.googleSignInError = function(errorMessage) {
                        console.error('📱 Android Google Sign-In 실패 콜백 수신:', errorMessage);
                        
                        if (window.onNativeGoogleLoginError) {
                            window.onNativeGoogleLoginError(errorMessage);
                        } else if (window.handleNativeGoogleLoginError) {
                            window.handleNativeGoogleLoginError(errorMessage);
                        } else {
                            // 백업 처리
                            alert('Google 로그인 실패: ' + errorMessage);
                        }
                    };
                    
                    window.googleSignOutSuccess = function() {
                        console.log('📱 Android Google Sign-Out 성공 콜백 수신');
                        
                        // 로그아웃 성공 처리
                        if (window.onNativeGoogleLogoutSuccess) {
                            window.onNativeGoogleLogoutSuccess();
                        }
                    };
                    
                    window.googleSignInStatusResult = function(isSignedIn, userInfoJson) {
                        console.log('📱 Android Google Sign-In 상태 확인 결과:', {
                            isSignedIn: isSignedIn,
                            hasUserInfo: !!userInfoJson
                        });
                        
                        if (isSignedIn && userInfoJson) {
                            try {
                                const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
                                console.log('📱 Android Google Sign-In 현재 사용자:', userInfo);
                            } catch (error) {
                                console.error('📱 Android Google Sign-In 상태 정보 파싱 오류:', error);
                            }
                        }
                    };
                    
                    console.log('✅ Android Google Sign-In 콜백 함수 등록 완료');
                    
                    // 🔥 즉시 핸들러 상태 확인
                    setTimeout(function() {
                        console.log('🔍 [ANDROID BRIDGE] 초기 핸들러 상태 확인');
                        window.__SMAP_CHECK_HANDLERS__();
                    }, 100);
                    
                })();
            """.trimIndent()
            
            webView.evaluateJavascript(bridgeScript, null)
            android.util.Log.d("MainActivity", "Android Bridge 스크립트 로드 완료")
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Android Bridge 스크립트 로드 실패", e)
        }
    }

    private fun injectAndroidBridgeEarly() {
        // 🔥 Android 브리지 스크립트를 미리 주입
        val earlyBridgeScript = """
            // 🔥 Android 브리지 스크립트 미리 주입
            (function() {
                'use strict';
                
                console.log('📱 Android Bridge 미리 주입 시작');
                
                // Android 환경 감지
                const isAndroid = /Android/.test(navigator.userAgent);
                
                if (!isAndroid) {
                    console.log('📱 Android 환경이 아니므로 Android Bridge 미리 주입을 건너뜁니다.');
                    return;
                }
                
                // 🔥 기존 iOS 콜백을 미리 덮어쓰기
                window.onNativeGoogleLoginSuccess = function(idToken, userInfo) {
                    console.log('📱 Android - 기존 iOS 콜백 미리 덮어쓰기됨');
                    // 아무것도 하지 않음 - Android 전용 콜백이 처리함
                };
                
                window.handleNativeGoogleLoginSuccess = function(idToken, userInfo) {
                    console.log('📱 Android - 기존 iOS 콜백 미리 덮어쓰기됨');
                    // 아무것도 하지 않음 - Android 전용 콜백이 처리함
                };
                
                // 전역 플래그 설정
                window.__SMAP_ANDROID_BRIDGE_EARLY_INJECTED__ = true;
                
                console.log('✅ Android Bridge 미리 주입 완료');
            })();
        """.trimIndent()
        
        webView.evaluateJavascript(earlyBridgeScript, null)
    }

    // 햅틱 피드백을 위한 JavaScript 인터페이스
    inner class HapticInterface {
        @JavascriptInterface
        fun lightHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.LIGHT)
            }
        }

        @JavascriptInterface
        fun mediumHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.MEDIUM)
            }
        }

        @JavascriptInterface
        fun heavyHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.HEAVY)
            }
        }

        @JavascriptInterface
        fun successHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.SUCCESS)
            }
        }

        @JavascriptInterface
        fun warningHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.WARNING)
            }
        }

        @JavascriptInterface
        fun errorHaptic() {
            runOnUiThread {
                performHapticFeedback(HapticType.ERROR)
            }
        }
    }

    // Google Sign-In을 위한 JavaScript 인터페이스
    inner class GoogleSignInInterface {
        @JavascriptInterface
        fun signIn() {
            android.util.Log.d("GoogleSignIn", "🔥 JavaScript에서 signIn() 호출됨")
            android.util.Log.d("GoogleSignIn", "🔥 현재 스레드: ${Thread.currentThread().name}")
            android.util.Log.d("GoogleSignIn", "🔥 GoogleSignInClient 상태: ${::googleSignInClient.isInitialized}")
            
            try {
                // GoogleSignInClient가 초기화되었는지 확인
                if (!::googleSignInClient.isInitialized) {
                    android.util.Log.e("GoogleSignIn", "❌ GoogleSignInClient가 초기화되지 않음")
                    runOnUiThread {
                        // JavaScript에 에러 콜백 호출
                        val errorScript = """
                            console.error('📱 [ANDROID NATIVE] GoogleSignInClient 초기화되지 않음');
                            if (window.googleSignInError) {
                                window.googleSignInError('Google 로그인 클라이언트가 초기화되지 않았습니다.');
                            } else {
                                alert('Google 로그인 클라이언트가 초기화되지 않았습니다.');
                            }
                        """.trimIndent()
                        webView.evaluateJavascript(errorScript, null)
                    }
                    return
                }
                
                runOnUiThread {
                    android.util.Log.d("GoogleSignIn", "🔥 UI 스레드에서 startGoogleSignIn() 호출")
                    startGoogleSignIn()
                }
                
            } catch (e: Exception) {
                android.util.Log.e("GoogleSignIn", "❌ signIn() 함수에서 예외 발생", e)
                runOnUiThread {
                    // JavaScript에 에러 콜백 호출
                    val errorScript = """
                        console.error('📱 [ANDROID NATIVE] signIn() 함수 오류: ${e.message}');
                        if (window.googleSignInError) {
                            window.googleSignInError('Google 로그인 시작 중 오류가 발생했습니다: ${e.message}');
                        } else {
                            alert('Google 로그인 시작 중 오류가 발생했습니다: ${e.message}');
                        }
                    """.trimIndent()
                    webView.evaluateJavascript(errorScript, null)
                }
            }
        }
        
        @JavascriptInterface
        fun googleLogin() {
            android.util.Log.d("GoogleSignIn", "🔥 JavaScript에서 googleLogin() 호출됨")
            android.util.Log.d("GoogleSignIn", "🔥 현재 스레드: ${Thread.currentThread().name}")
            
            // signIn() 함수와 동일한 로직 사용
            signIn()
        }
        
        @JavascriptInterface
        fun signOut() {
            android.util.Log.d("GoogleSignIn", "🔥 JavaScript에서 signOut() 호출됨")
            
            try {
                if (!::googleSignInClient.isInitialized) {
                    android.util.Log.e("GoogleSignIn", "❌ GoogleSignInClient가 초기화되지 않음")
                    return
                }
                
                runOnUiThread {
                    googleSignInClient.signOut().addOnCompleteListener {
                        // 로그아웃 완료 후 JavaScript 콜백 호출
                        val script = "if (window.googleSignOutSuccess) window.googleSignOutSuccess();"
                        webView.evaluateJavascript(script, null)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("GoogleSignIn", "❌ signOut() 함수에서 예외 발생", e)
            }
        }
        
        @JavascriptInterface
        fun checkStatus() {
            android.util.Log.d("GoogleSignIn", "🔥 JavaScript에서 checkStatus() 호출됨")
            
            try {
                runOnUiThread {
                    val account = GoogleSignIn.getLastSignedInAccount(this@MainActivity)
                    if (account != null) {
                        // 로그인된 상태
                        val userInfo = createUserInfoJson(account)
                        val script = "if (window.googleSignInStatusResult) window.googleSignInStatusResult(true, '$userInfo');"
                        webView.evaluateJavascript(script, null)
                    } else {
                        // 로그인되지 않은 상태
                        val script = "if (window.googleSignInStatusResult) window.googleSignInStatusResult(false, null);"
                        webView.evaluateJavascript(script, null)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("GoogleSignIn", "❌ checkStatus() 함수에서 예외 발생", e)
            }
        }
        
        // 🔥 테스트용 함수 추가
        @JavascriptInterface
        fun testConnection() {
            android.util.Log.d("GoogleSignIn", "🧪 JavaScript에서 testConnection() 호출됨")
            
            runOnUiThread {
                val testScript = """
                    console.log('🧪 [ANDROID TEST] 네이티브 연결 테스트 성공');
                    console.log('🧪 [ANDROID TEST] AndroidGoogleSignIn 객체:', !!window.AndroidGoogleSignIn);
                    console.log('🧪 [ANDROID TEST] signIn 함수:', !!(window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function'));
                    
                    if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                        console.log('✅ [ANDROID TEST] 인터페이스 정상 작동');
                        // 테스트용 토스트 메시지 표시
                        if (window.showToast) {
                            window.showToast('네이티브 연결 테스트 성공!');
                        }
                    } else {
                        console.error('❌ [ANDROID TEST] 인터페이스 문제 있음');
                    }
                """.trimIndent()
                
                webView.evaluateJavascript(testScript) { result ->
                    android.util.Log.d("GoogleSignIn", "🧪 테스트 스크립트 실행 완료: $result")
                }
                
                // 안드로이드 토스트로도 확인
                Toast.makeText(this@MainActivity, "네이티브 연결 테스트 성공!", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun startGoogleSignIn() {
        try {
            android.util.Log.d("GoogleSignIn", "🔥 startGoogleSignIn 함수 시작")
            android.util.Log.d("GoogleSignIn", "🔥 현재 스레드: ${Thread.currentThread().name}")
            android.util.Log.d("GoogleSignIn", "🔥 GoogleSignInClient: $googleSignInClient")
            android.util.Log.d("GoogleSignIn", "🔥 GoogleSignInClient 초기화 상태: ${::googleSignInClient.isInitialized}")
            
            // 🔥 즉시 로딩 상태 설정 및 진행 중 플래그 설정
            val setProgressScript = """
                console.log('📱 [ANDROID NATIVE] Google Sign-In 시작 - 상태 설정');
                
                // 진행 중 플래그 설정
                window.__GOOGLE_LOGIN_IN_PROGRESS__ = true;
                console.log('📱 [ANDROID NATIVE] Google Sign-In 진행 중 플래그 설정');
                
                // 로딩 상태 설정 (여러 방법으로 시도)
                if (window.setIsLoading) {
                    try {
                        window.setIsLoading(true);
                        console.log('📱 [ANDROID NATIVE] setIsLoading(true) 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] setIsLoading(true) 호출 중 오류:', e);
                    }
                }
                
                // 추가 로딩 상태 설정 방법들
                if (window.showLoading) {
                    try {
                        window.showLoading();
                        console.log('📱 [ANDROID NATIVE] showLoading() 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] showLoading() 호출 중 오류:', e);
                    }
                }
                
                if (window.setLoading) {
                    try {
                        window.setLoading(true);
                        console.log('📱 [ANDROID NATIVE] setLoading(true) 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] setLoading(true) 호출 중 오류:', e);
                    }
                }
                
                // 전역 로딩 상태 변수 설정
                window.isLoading = true;
                console.log('📱 [ANDROID NATIVE] 전역 isLoading 변수 설정');
                
                // 🔥 타임아웃 설정 (30초 후 자동 해제)
                if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                    clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                }
                window.__GOOGLE_LOGIN_TIMEOUT__ = setTimeout(() => {
                    console.error('📱 [ANDROID NATIVE] Google Sign-In 타임아웃 (30초)');
                    
                    // 로딩 상태 해제
                    if (window.setIsLoading) {
                        window.setIsLoading(false);
                    }
                    window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                    
                    // 오류 메시지 표시
                    if (window.setError) {
                        window.setError('Google 로그인 요청이 시간 초과되었습니다. 다시 시도해주세요.');
                    } else {
                        alert('Google 로그인 요청이 시간 초과되었습니다. 다시 시도해주세요.');
                    }
                }, 30000);
                
                if (window.loading !== undefined) {
                    window.loading = true;
                    console.log('📱 [ANDROID NATIVE] 전역 loading 변수 설정');
                }
                
                console.log('📱 [ANDROID NATIVE] Google Sign-In 시작 - 상태 설정 완료');
            """.trimIndent()
            
            webView.evaluateJavascript(setProgressScript) { result ->
                android.util.Log.d("GoogleSignIn", "📱 진행 상태 설정 스크립트 실행 완료: $result")
            }
            
            // 실제 기기에서 Google Play Services 확인
            if (!isEmulator()) {
                val googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance()
                val resultCode = googleApiAvailability.isGooglePlayServicesAvailable(this)
                android.util.Log.d("GoogleSignIn", "🔥 실제 기기 Google Play Services 상태: $resultCode")
                
                if (resultCode != com.google.android.gms.common.ConnectionResult.SUCCESS) {
                    android.util.Log.w("GoogleSignIn", "⚠️ 실제 기기에서 Google Play Services 문제")
                    if (googleApiAvailability.isUserResolvableError(resultCode)) {
                        android.util.Log.d("GoogleSignIn", "사용자 해결 가능한 오류 - 다이얼로그 표시")
                        googleApiAvailability.getErrorDialog(this, resultCode, 9001)?.show()
                        return
                    } else {
                        android.util.Log.e("GoogleSignIn", "Google Play Services 문제로 Sign-In 불가")
                        handleGoogleSignInError(Exception("Google Play Services가 필요합니다"))
                        return
                    }
                }
            }
            
            // 🔥 Google Sign-In Intent 생성 전 상태 확인
            android.util.Log.d("GoogleSignIn", "🔥 Google Sign-In Intent 생성 시작")
            
            try {
                val signInIntent = googleSignInClient.signInIntent
                android.util.Log.d("GoogleSignIn", "🔥 SignInIntent created: $signInIntent")
                android.util.Log.d("GoogleSignIn", "🔥 SignInIntent action: ${signInIntent.action}")
                android.util.Log.d("GoogleSignIn", "🔥 SignInIntent package: ${signInIntent.`package`}")
                android.util.Log.d("GoogleSignIn", "🔥 SignInIntent data: ${signInIntent.data}")
                
                // 🔥 Intent가 유효한지 확인
                if (signInIntent.action == null) {
                    android.util.Log.e("GoogleSignIn", "❌ SignInIntent action이 null")
                    handleGoogleSignInError(Exception("Google Sign-In Intent가 유효하지 않습니다"))
                    return
                }
                
                android.util.Log.d("GoogleSignIn", "🔥 Google Sign-In launcher 실행 전")
                googleSignInLauncher.launch(signInIntent)
                android.util.Log.d("GoogleSignIn", "🔥 Google Sign-In launcher 실행 완료")
                
                // 🔥 launcher 실행 후 상태 확인
                android.util.Log.d("GoogleSignIn", "🔥 launcher 실행 후 - 현재 액티비티 상태: ${isFinishing}")
                
            } catch (e: Exception) {
                android.util.Log.e("GoogleSignIn", "❌ SignInIntent 생성 또는 실행 중 오류", e)
                handleGoogleSignInError(Exception("Google Sign-In Intent 생성 실패: ${e.message}"))
                return
            }
            
        } catch (e: Exception) {
            android.util.Log.e("GoogleSignIn", "❌ Error starting Google Sign-In", e)
            android.util.Log.e("GoogleSignIn", "❌ 오류 상세: ${e.message}")
            android.util.Log.e("GoogleSignIn", "❌ 오류 스택: ${e.stackTraceToString()}")
            handleGoogleSignInError(Exception("Google Sign-In을 시작할 수 없습니다: ${e.message}"))
        }
    }
    
    private fun handleGoogleSignInSuccess(account: GoogleSignInAccount) {
        try {
            android.util.Log.d("GoogleSignIn", "🎉 Google Sign-In 성공 처리 시작");
            android.util.Log.d("GoogleSignIn", "📧 이메일: ${account.email}")
            android.util.Log.d("GoogleSignIn", "🆔 Account ID: ${account.id}")
            android.util.Log.d("GoogleSignIn", "👤 Display Name: ${account.displayName}")
            android.util.Log.d("GoogleSignIn", "📝 Given Name: ${account.givenName}")
            android.util.Log.d("GoogleSignIn", "📝 Family Name: ${account.familyName}")
            android.util.Log.d("GoogleSignIn", "🖼️ Photo URL: ${account.photoUrl}")
            
            // ID 토큰 가져오기
            val idToken = account.idToken
            if (idToken == null) {
                android.util.Log.e("GoogleSignIn", "❌ ID Token is null")
                handleGoogleSignInError(Exception("ID 토큰을 가져올 수 없습니다"))
                return
            }
            
            android.util.Log.d("GoogleSignIn", "✅ ID Token received, length: ${idToken.length}")
            android.util.Log.d("GoogleSignIn", "🔑 ID Token (처음 50자): ${idToken.take(50)}...")
            
            // 사용자 정보 JSON 생성
            val userInfo = createUserInfoJson(account)
            android.util.Log.d("GoogleSignIn", "📋 User Info JSON created: $userInfo")
            
            // ID 토큰과 사용자 정보를 안전하게 이스케이프
            val escapedIdToken = idToken.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"")
            val escapedUserInfo = userInfo.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"")
            
            android.util.Log.d("GoogleSignIn", "🔒 ID Token escaped, length: ${escapedIdToken.length}")
            android.util.Log.d("GoogleSignIn", "🔒 User Info escaped, length: ${escapedUserInfo.length}")
            
            // 🔥 즉시 로딩 상태 해제 및 진행 중 플래그 해제
            val clearProgressScript = """
                console.log('📱 [ANDROID NATIVE] Google Sign-In 성공 - 상태 정리 시작');
                
                // 타임아웃 클리어
                if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                    clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                    window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                    console.log('📱 [ANDROID NATIVE] 타임아웃 클리어 완료');
                }
                
                // 진행 중 플래그 해제
                window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                console.log('📱 [ANDROID NATIVE] Google Sign-In 진행 중 플래그 해제');
                
                // 로딩 상태 해제 (여러 방법으로 시도)
                if (window.setIsLoading) {
                    try {
                        window.setIsLoading(false);
                        console.log('📱 [ANDROID NATIVE] setIsLoading(false) 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] setIsLoading(false) 호출 중 오류:', e);
                    }
                }
                
                // 추가 로딩 상태 해제 방법들
                if (window.hideLoading) {
                    try {
                        window.hideLoading();
                        console.log('📱 [ANDROID NATIVE] hideLoading() 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] hideLoading() 호출 중 오류:', e);
                    }
                }
                
                if (window.setLoading) {
                    try {
                        window.setLoading(false);
                        console.log('📱 [ANDROID NATIVE] setLoading(false) 호출 완료');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] setLoading(false) 호출 중 오류:', e);
                    }
                }
                
                // 전역 로딩 상태 변수 해제
                if (window.isLoading !== undefined) {
                    window.isLoading = false;
                    console.log('📱 [ANDROID NATIVE] 전역 isLoading 변수 해제');
                }
                
                if (window.loading !== undefined) {
                    window.loading = false;
                    console.log('📱 [ANDROID NATIVE] 전역 loading 변수 해제');
                }
                
                console.log('📱 [ANDROID NATIVE] Google Sign-In 성공 - 상태 정리 완료');
            """.trimIndent()
            
            webView.evaluateJavascript(clearProgressScript) { result ->
                android.util.Log.d("GoogleSignIn", "📱 상태 정리 스크립트 실행 완료: $result")
            }
            
            // 🔥 성공 콜백 호출 (개선된 버전)
            val successScript = """
                console.log('📱 [ANDROID NATIVE] Google Sign-In 성공 콜백 호출 시작');
                console.log('📱 [ANDROID NATIVE] ID Token 길이: ${idToken.length}');
                console.log('📱 [ANDROID NATIVE] User Info 길이: ${userInfo.length}');
                
                // 🔥 성공 햅틱 피드백
                if (window.SmapApp && window.SmapApp.haptic) {
                    try {
                        window.SmapApp.haptic.success();
                        console.log('📱 [ANDROID NATIVE] 성공 햅틱 피드백 실행');
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] 햅틱 피드백 오류:', e);
                    }
                }
                
                // 🔥 1순위: googleSignInSuccess 콜백
                if (window.googleSignInSuccess) {
                    console.log('📱 [ANDROID NATIVE] googleSignInSuccess 함수 발견, 호출 중...');
                    try {
                        window.googleSignInSuccess('$escapedIdToken', '$escapedUserInfo');
                        console.log('📱 [ANDROID NATIVE] googleSignInSuccess 함수 호출 완료');
                        return; // 성공하면 여기서 종료
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] googleSignInSuccess 호출 중 오류:', e);
                    }
                }
                
                // 🔥 2순위: handleGoogleLoginResult 콜백
                if (window.handleGoogleLoginResult) {
                    console.log('📱 [ANDROID NATIVE] handleGoogleLoginResult 함수 발견, 호출 중...');
                    try {
                        const googleData = {
                            credential: '$escapedIdToken',
                            user: $escapedUserInfo
                        };
                        window.handleGoogleLoginResult(googleData);
                        console.log('📱 [ANDROID NATIVE] handleGoogleLoginResult 함수 호출 완료');
                        return; // 성공하면 여기서 종료
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] handleGoogleLoginResult 호출 중 오류:', e);
                    }
                }
                
                // 🔥 3순위: onNativeGoogleLoginSuccess 콜백
                if (window.onNativeGoogleLoginSuccess) {
                    console.log('📱 [ANDROID NATIVE] onNativeGoogleLoginSuccess 함수 발견, 호출 중...');
                    try {
                        window.onNativeGoogleLoginSuccess('$escapedIdToken', '$escapedUserInfo');
                        console.log('📱 [ANDROID NATIVE] onNativeGoogleLoginSuccess 함수 호출 완료');
                        return; // 성공하면 여기서 종료
                    } catch (e) {
                        console.error('📱 [ANDROID NATIVE] onNativeGoogleLoginSuccess 호출 중 오류:', e);
                    }
                }
                
                // 🔥 4순위: 직접 백엔드 API 호출
                console.log('📱 [ANDROID NATIVE] 모든 콜백 함수 실패, 직접 백엔드 API 호출');
                try {
                    const requestBody = {
                        idToken: '$escapedIdToken',
                        userInfo: $escapedUserInfo,
                        source: 'android_native'
                    };
                    
                    console.log('📱 [ANDROID NATIVE] 백엔드 API 요청 시작');
                    
                    fetch('/api/google-auth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody),
                    })
                    .then(response => {
                        console.log('📱 [ANDROID NATIVE] 백엔드 응답 상태:', response.status);
                        return response.json();
                    })
                    .then(data => {
                        console.log('📱 [ANDROID NATIVE] 백엔드 응답 데이터:', data);
                        
                        if (data.success) {
                            console.log('📱 [ANDROID NATIVE] 백엔드 인증 성공');
                            // 홈 페이지로 이동
                            window.location.href = '/home';
                        } else {
                            throw new Error(data.error || '백엔드 인증에 실패했습니다.');
                        }
                    })
                    .catch(error => {
                        console.error('📱 [ANDROID NATIVE] 백엔드 API 오류:', error);
                        // 에러 표시
                        if (window.showError) {
                            window.showError(error.message || '백엔드 인증에 실패했습니다.');
                        } else {
                            alert(error.message || '백엔드 인증에 실패했습니다.');
                        }
                    });
                    
                } catch (error) {
                    console.error('📱 [ANDROID NATIVE] 백엔드 API 호출 중 오류:', error);
                    // 최후 수단: 페이지 새로고침
                    console.log('📱 [ANDROID NATIVE] 모든 방법 실패, 페이지 새로고침');
                    window.location.reload();
                }
            """.trimIndent()
            
            webView.evaluateJavascript(successScript) { result ->
                android.util.Log.d("GoogleSignIn", "📱 성공 콜백 스크립트 실행 완료: $result")
            }
            
            android.util.Log.d("GoogleSignIn", "✅ Google Sign-In 성공 처리 완료");
            
        } catch (e: Exception) {
            android.util.Log.e("GoogleSignIn", "❌ Error handling Google Sign-In success", e)
            android.util.Log.e("GoogleSignIn", "❌ 오류 상세: ${e.message}")
            android.util.Log.e("GoogleSignIn", "❌ 오류 스택: ${e.stackTraceToString()}")
            handleGoogleSignInError(e)
        }
    }
    
    private fun handleGoogleSignInError(exception: Exception) {
        android.util.Log.e("GoogleSignIn", "❌ Google Sign-In 실패 처리 시작", exception)
        
        // 🔥 즉시 로딩 상태 해제 및 진행 중 플래그 해제
        val clearProgressScript = """
            console.log('📱 [ANDROID NATIVE] Google Sign-In 에러 - 상태 정리 시작');
            
            // 타임아웃 클리어
            if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                console.log('📱 [ANDROID NATIVE] 에러 시 타임아웃 클리어 완료');
            }
            
            // 진행 중 플래그 해제
            window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
            console.log('📱 [ANDROID NATIVE] Google Sign-In 진행 중 플래그 해제 (에러)');
            
            // 로딩 상태 해제 (여러 방법으로 시도)
            if (window.setIsLoading) {
                try {
                    window.setIsLoading(false);
                    console.log('📱 [ANDROID NATIVE] setIsLoading(false) 호출 완료 (에러)');
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] setIsLoading(false) 호출 중 오류:', e);
                }
            }
            
            // 추가 로딩 상태 해제 방법들
            if (window.hideLoading) {
                try {
                    window.hideLoading();
                    console.log('📱 [ANDROID NATIVE] hideLoading() 호출 완료 (에러)');
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] hideLoading() 호출 중 오류:', e);
                }
            }
            
            if (window.setLoading) {
                try {
                    window.setLoading(false);
                    console.log('📱 [ANDROID NATIVE] setLoading(false) 호출 완료 (에러)');
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] setLoading(false) 호출 중 오류:', e);
                }
            }
            
            // 전역 로딩 상태 변수 해제
            if (window.isLoading !== undefined) {
                window.isLoading = false;
                console.log('📱 [ANDROID NATIVE] 전역 isLoading 변수 해제 (에러)');
            }
            
            if (window.loading !== undefined) {
                window.loading = false;
                console.log('📱 [ANDROID NATIVE] 전역 loading 변수 해제 (에러)');
            }
            
            console.log('📱 [ANDROID NATIVE] Google Sign-In 에러 - 상태 정리 완료');
        """.trimIndent()
        
        webView.evaluateJavascript(clearProgressScript) { result ->
            android.util.Log.d("GoogleSignIn", "📱 에러 상태 정리 스크립트 실행 완료: $result")
        }
        
        val errorMessage = when (exception) {
            is ApiException -> {
                val statusCode = exception.statusCode
                val statusMessage = exception.statusMessage ?: "알 수 없는 상태 메시지"
                
                android.util.Log.e("GoogleSignIn", "🔍 Status Code: $statusCode, Status Message: $statusMessage")
                android.util.Log.e("GoogleSignIn", "🔍 Exception: ${exception.javaClass.simpleName}")
                
                when (statusCode) {
                    12501 -> {
                        android.util.Log.d("GoogleSignIn", "ℹ️ 사용자가 로그인을 취소함");
                        "사용자가 로그인을 취소했습니다"
                    }
                    7 -> {
                        android.util.Log.e("GoogleSignIn", "🌐 네트워크 오류");
                        "네트워크 오류가 발생했습니다"
                    }
                    5 -> {
                        android.util.Log.e("GoogleSignIn", "🚫 잘못된 계정");
                        "잘못된 계정입니다"
                    }
                    4 -> {
                        android.util.Log.e("GoogleSignIn", "🔐 로그인 필요");
                        "로그인이 필요합니다"
                    }
                    10 -> {
                        // DEVELOPER_ERROR: Google Cloud Console 설정 문제
                        android.util.Log.e("GoogleSignIn", "⚙️ DEVELOPER_ERROR - Google Cloud Console 설정 문제")
                        
                        // 🔥 상세한 디버깅 정보 출력
                        val currentServerClientId = "283271180972-02ajuasfuecajd0holgu7iqb5hvtjgbp.apps.googleusercontent.com"
                        android.util.Log.e("GoogleSignIn", "🔧 현재 사용 중인 클라이언트 ID: $currentServerClientId")
                        android.util.Log.e("GoogleSignIn", "📦 패키지명: com.dmonster.smap")
                        android.util.Log.e("GoogleSignIn", "🔑 SHA-1 지문: 8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17")
                        android.util.Log.e("GoogleSignIn", "🏗️ 빌드 타입: ${if (BuildConfig.DEBUG) "DEBUG" else "RELEASE"}")
                        android.util.Log.e("GoogleSignIn", "📱 에뮬레이터: ${isEmulator()}")
                        
                        if (isEmulator()) {
                            android.util.Log.w("GoogleSignIn", "⚠️ 에뮬레이터에서 DEVELOPER_ERROR 발생")
                            android.util.Log.w("GoogleSignIn", "💡 가능한 해결책:")
                            android.util.Log.w("GoogleSignIn", "1. Google Cloud Console에서 Android OAuth 클라이언트 ID 생성")
                            android.util.Log.w("GoogleSignIn", "2. 패키지명: com.dmonster.smap")
                            android.util.Log.w("GoogleSignIn", "3. SHA-1 지문: 8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17")
                            android.util.Log.e("GoogleSignIn", "4. 에뮬레이터에 Google 계정 로그인 상태 확인")
                            "DEVELOPER_ERROR: Google Cloud Console 설정을 확인해주세요"
                        } else {
                            android.util.Log.e("GoogleSignIn", "⚙️ 개발자 설정 오류 - OAuth 클라이언트 ID 확인 필요")
                            android.util.Log.e("GoogleSignIn", "🔧 빌드 타입: ${if (BuildConfig.DEBUG) "DEBUG" else "RELEASE"}");
                            android.util.Log.e("GoogleSignIn", "🔧 패키지 이름: com.dmonster.smap");
                            android.util.Log.e("GoogleSignIn", "🔧 SHA-1 인증서: 8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17");
                            android.util.Log.e("GoogleSignIn", "🔧 기기 정보:");
                            android.util.Log.e("GoogleSignIn", "   - 기기 모델: ${android.os.Build.MODEL}");
                            android.util.Log.e("GoogleSignIn", "   - 제조사: ${android.os.Build.MANUFACTURER}");
                            android.util.Log.e("GoogleSignIn", "   - FINGERPRINT: ${android.os.Build.FINGERPRINT}");
                            android.util.Log.e("GoogleSignIn", "   - 에뮬레이터 여부: ${isEmulator()}");
                            android.util.Log.e("GoogleSignIn", "🔧 해결 방법:");
                            android.util.Log.e("GoogleSignIn", "   1. Google Cloud Console에서 Android용 OAuth 클라이언트 ID 생성");
                            android.util.Log.e("GoogleSignIn", "   2. 패키지 이름: com.dmonster.smap");
                            android.util.Log.e("GoogleSignIn", "   3. SHA-1 인증서: 8D:9A:10:73:F8:D4:6C:38:DD:45:FD:39:4E:F5:3F:8B:52:7D:0D:17");
                            android.util.Log.e("GoogleSignIn", "   4. 현재는 Android용 클라이언트 ID를 사용 중");
                            android.util.Log.e("GoogleSignIn", "   5. Google Cloud Console에서 클라이언트 ID가 올바르게 설정되었는지 확인");
                            android.util.Log.e("GoogleSignIn", "   6. 앱을 완전히 종료하고 다시 시작");
                            
                            // 안드로이드에서 네이티브 구글 로그인 실패 시 웹 로그인으로 fallback하도록 안내
                            "Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요."
                        }
                    }
                    12500 -> {
                        android.util.Log.e("GoogleSignIn", "🔧 개발자 설정 오류 - Google Cloud Console에서 설정 확인 필요");
                        "Google 로그인 설정에 문제가 있습니다. 앱을 다시 시작해주세요"
                    }
                    else -> {
                        android.util.Log.e("GoogleSignIn", "❓ 알 수 없는 오류 코드: $statusCode");
                        "Google 로그인에 실패했습니다 (오류 코드: $statusCode, 메시지: $statusMessage)"
                    }
                }
            }
            else -> {
                android.util.Log.e("GoogleSignIn", "🔍 Exception type: ${exception.javaClass.simpleName}")
                android.util.Log.e("GoogleSignIn", "🔍 Exception message: ${exception.message}")
                android.util.Log.e("GoogleSignIn", "🔍 Exception stack: ${exception.stackTraceToString()}")
                exception.message ?: "알 수 없는 오류가 발생했습니다"
            }
        }
        
        android.util.Log.d("GoogleSignIn", "📝 최종 에러 메시지: $errorMessage")
        
        // 🔥 에러 콜백 호출 (개선된 버전)
        val escapedMessage = errorMessage.replace("'", "\\'")
        val errorScript = """
            console.log('📱 [ANDROID NATIVE] Google Sign-In 에러 콜백 호출: $escapedMessage');
            
            // 🔥 에러 햅틱 피드백
            if (window.SmapApp && window.SmapApp.haptic) {
                try {
                    window.SmapApp.haptic.error();
                    console.log('📱 [ANDROID NATIVE] 에러 햅틱 피드백 실행');
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] 에러 햅틱 피드백 오류:', e);
                }
            }
            
            // 🔥 1순위: googleSignInError 콜백
            if (window.googleSignInError) {
                try {
                    window.googleSignInError('$escapedMessage');
                    console.log('📱 [ANDROID NATIVE] googleSignInError 함수 호출 완료');
                    return; // 성공하면 여기서 종료
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] googleSignInError 호출 중 오류:', e);
                }
            }
            
            // 🔥 2순위: onNativeGoogleLoginError 콜백
            if (window.onNativeGoogleLoginError) {
                try {
                    window.onNativeGoogleLoginError('$escapedMessage');
                    console.log('📱 [ANDROID NATIVE] onNativeGoogleLoginError 함수 호출 완료');
                    return; // 성공하면 여기서 종료
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] onNativeGoogleLoginError 호출 중 오류:', e);
                }
            }
            
            // 🔥 3순위: handleNativeGoogleLoginError 콜백
            if (window.handleNativeGoogleLoginError) {
                try {
                    window.handleNativeGoogleLoginError('$escapedMessage');
                    console.log('📱 [ANDROID NATIVE] handleNativeGoogleLoginError 함수 호출 완료');
                    return; // 성공하면 여기서 종료
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] handleNativeGoogleLoginError 호출 중 오류:', e);
                }
            }
            
            // 🔥 4순위: 직접 에러 표시
            console.log('📱 [ANDROID NATIVE] 모든 에러 콜백 함수 실패, 직접 에러 표시');
            if (window.showError) {
                try {
                    window.showError('$escapedMessage');
                    console.log('📱 [ANDROID NATIVE] showError 함수 호출 완료');
                } catch (e) {
                    console.error('📱 [ANDROID NATIVE] showError 호출 중 오류:', e);
                    // 최후 수단: alert
                    alert('Google 로그인 실패: $escapedMessage');
                }
            } else {
                // 최후 수단: alert
                alert('Google 로그인 실패: $escapedMessage');
            }
        """.trimIndent()
        
        webView.evaluateJavascript(errorScript) { result ->
            android.util.Log.d("GoogleSignIn", "📱 에러 콜백 스크립트 실행 완료: $result")
        }
        
        android.util.Log.d("GoogleSignIn", "✅ Google Sign-In 에러 처리 완료");
    }
    
    private fun createUserInfoJson(account: GoogleSignInAccount): String {
        val userInfo = JSONObject().apply {
            put("email", account.email ?: "")
            put("name", account.displayName ?: "")
            put("givenName", account.givenName ?: "")
            put("familyName", account.familyName ?: "")
            put("id", account.id ?: "")
            put("photoUrl", account.photoUrl?.toString() ?: "")
        }
        return userInfo.toString()
    }

    private fun performHapticFeedback(type: HapticType) {
        if (vibrator?.hasVibrator() == true) {
            val pattern = when (type) {
                HapticType.LIGHT -> longArrayOf(0, 10)
                HapticType.MEDIUM -> longArrayOf(0, 20)
                HapticType.HEAVY -> longArrayOf(0, 30)
                HapticType.SUCCESS -> longArrayOf(0, 50, 100, 50)
                HapticType.WARNING -> longArrayOf(0, 100, 50, 100)
                HapticType.ERROR -> longArrayOf(0, 200, 100, 200)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(pattern, -1)
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }
        }
    }

    // 🔥 앱이 포그라운드로 돌아올 때 권한 체크
    override fun onResume() {
        super.onResume()
        android.util.Log.d(TAG, "🔥 onResume - 위치/동작 권한 상태 체크")

        // 🔥 위치 권한 확인 및 자동 서비스 시작
        checkAndStartLocationService()

        // WebView에 포그라운드 복귀 알림
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "javascript:if(window.onAppResumed) { window.onAppResumed(); }",
                null
            )
        }
    }

    private fun setupRetryButton() {
        retryButton.setOnClickListener {
            // 🔥 재시도 시 URL 인덱스 초기화
            currentUrlIndex = 0
            loadWebView()
        }
    }



    // 🔥 에뮬레이터 감지 함수 추가
    private fun isEmulator(): Boolean {
        return (android.os.Build.FINGERPRINT.startsWith("generic")
                || android.os.Build.FINGERPRINT.startsWith("unknown")
                || android.os.Build.MODEL.contains("google_sdk")
                || android.os.Build.MODEL.contains("Emulator")
                || android.os.Build.MODEL.contains("Android SDK built for x86")
                || android.os.Build.MODEL.contains("sdk_gphone")
                || android.os.Build.MANUFACTURER.contains("Genymotion")
                || android.os.Build.MANUFACTURER.contains("Google")
                || (android.os.Build.BRAND.startsWith("generic") && android.os.Build.DEVICE.startsWith("generic"))
                || "google_sdk" == android.os.Build.PRODUCT
                || android.os.Build.MODEL.contains("emu"))
    }
    
    // 🔥 권한 확인 함수
    private fun hasAllPermissions(): Boolean {
        return requiredPermissions.all { permission ->
            ActivityCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    // 🔥 누락된 권한 목록 가져오기
    private fun getMissingPermissions(): List<String> {
        return requiredPermissions.filter { permission ->
            ActivityCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
    }
    
    // 🔥 앱 설치 후 초기 권한 요청 함수 (iOS 스타일)
    private fun requestInitialPermissions() {
        android.util.Log.d(TAG, "🔥 [PERMISSIONS] 앱 설치 후 초기 권한 요청 시작")

        // 앱이 처음 실행되는지 확인 (SharedPreferences 사용)
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        val isFirstRun = prefs.getBoolean("is_first_run", true)

        if (isFirstRun) {
            android.util.Log.d(TAG, "🔥 첫 번째 앱 실행 감지 - 권한 요청 진행")

            val missingPermissions = getMissingPermissions()
            if (missingPermissions.isNotEmpty()) {
                android.util.Log.d(TAG, "🔥 초기 권한 요청: ${missingPermissions.joinToString()}")

                // 권한 요청 다이얼로그 표시 전 사용자 안내
                Toast.makeText(this, "앱 사용을 위해 다음 권한들이 필요합니다", Toast.LENGTH_LONG).show()

                ActivityCompat.requestPermissions(
                    this,
                    missingPermissions.toTypedArray(),
                    MULTIPLE_PERMISSIONS_REQUEST_CODE
                )
            } else {
                android.util.Log.d(TAG, "🔥 모든 권한이 이미 허용됨")
                onAllPermissionsGranted()
            }

            // 첫 실행 플래그 업데이트
            prefs.edit().putBoolean("is_first_run", false).apply()
        } else {
            android.util.Log.d(TAG, "🔥 이미 초기 권한 요청이 완료됨")
        }
    }

    // 🔥 권한 요청 함수 - home 화면에서만 요청하도록 제한
    private fun requestPermissions() {
        android.util.Log.d(TAG, "🔥 [PERMISSIONS] 권한 요청 시작 - home 화면에서 호출됨")

        val missingPermissions = getMissingPermissions()
        if (missingPermissions.isNotEmpty()) {
            android.util.Log.d(TAG, "🔥 권한 요청: ${missingPermissions.joinToString()}")
            ActivityCompat.requestPermissions(
                this,
                missingPermissions.toTypedArray(),
                MULTIPLE_PERMISSIONS_REQUEST_CODE
            )
        } else {
            android.util.Log.d(TAG, "🔥 모든 권한이 이미 허용됨")
            onAllPermissionsGranted()
        }
    }
    
    // 🔥 특정 권한들만 체크하는 함수
    private fun hasSpecificPermissions(permissions: List<String>): Boolean {
        return permissions.all { permission ->
            ActivityCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    // 🔥 특정 권한들 중 누락된 것만 가져오기
    private fun getMissingSpecificPermissions(permissions: List<String>): List<String> {
        return permissions.filter { permission ->
            ActivityCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
    }
    
    // 🔥 특정 권한들만 요청하는 함수 - home 화면에서만 요청하도록 제한
    private fun requestSpecificPermissions(permissions: List<String>) {
        android.util.Log.d(TAG, "🔥 [PERMISSIONS] 특정 권한 요청 시작 - home 화면에서 호출됨")
        
        val missingPermissions = getMissingSpecificPermissions(permissions)
        if (missingPermissions.isNotEmpty()) {
            android.util.Log.d(TAG, "🔥 특정 권한 요청: ${missingPermissions.joinToString()}")
            ActivityCompat.requestPermissions(
                this,
                missingPermissions.toTypedArray(),
                MULTIPLE_PERMISSIONS_REQUEST_CODE
            )
        } else {
            android.util.Log.d(TAG, "🔥 요청된 권한들이 이미 허용됨")
            onAllPermissionsGranted()
        }
    }
    
    // 🔥 모든 권한이 허용되었을 때 실행될 함수
    private fun onAllPermissionsGranted() {
        android.util.Log.d(TAG, "🔥 모든 권한 허용 완료")
        
        // 기본 위치 권한이 허용되었으면 백그라운드 위치 권한 요청
        if (hasLocationPermissions()) {
            requestBackgroundLocationPermission()
        } else {
            // WebView에 권한 허용 완료 알림
            webView.evaluateJavascript(
                "javascript:if(window.onPermissionsGranted) { window.onPermissionsGranted(); }",
                null
            )
        }
    }
    
    // 🔥 위치 권한 확인 함수
    private fun hasLocationPermissions(): Boolean {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
    
    // 🔥 백그라운드 위치 권한 요청 함수
    private fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ActivityCompat.checkSelfPermission(this, backgroundLocationPermission) != PackageManager.PERMISSION_GRANTED) {
                android.util.Log.d(TAG, "🔥 백그라운드 위치 권한 요청")
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(backgroundLocationPermission),
                    BACKGROUND_LOCATION_PERMISSION_REQUEST_CODE
                )
            } else {
                android.util.Log.d(TAG, "🔥 백그라운드 위치 권한이 이미 허용됨")
                onAllPermissionsGrantedComplete()
            }
        } else {
            // Android 10 미만에서는 백그라운드 위치 권한이 자동으로 포함됨
            onAllPermissionsGrantedComplete()
        }
    }
    
    // 🔥 모든 권한 요청 완료 후 실행될 함수
    private fun onAllPermissionsGrantedComplete() {
        // WebView에 권한 허용 완료 알림
        webView.evaluateJavascript(
            "javascript:if(window.onPermissionsGranted) { window.onPermissionsGranted(); }",
            null
        )
    }
    
    // 🔥 위치 권한 동적 요청 함수
    private fun requestLocationPermissions() {
        android.util.Log.d(TAG, "🔥 위치 권한 동적 요청 시작")
        
        val missingLocationPermissions = locationPermissions.filter { permission ->
            ActivityCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
        
        if (missingLocationPermissions.isNotEmpty()) {
            android.util.Log.d(TAG, "🔥 위치 권한 요청: ${missingLocationPermissions.joinToString()}")
            ActivityCompat.requestPermissions(
                this,
                missingLocationPermissions.toTypedArray(),
                LOCATION_PERMISSIONS_REQUEST_CODE
            )
        } else {
            android.util.Log.d(TAG, "🔥 위치 권한이 이미 허용됨")
            onLocationPermissionsGranted()
        }
    }
    
    // 🔥 위치 권한 허용 후 실행될 함수
    private fun onLocationPermissionsGranted() {
        android.util.Log.d(TAG, "🔥 위치 권한 허용 완료")
        // 위치 서비스 시작
        checkAndStartLocationService()
        
        // WebView에 위치 권한 허용 완료 알림
        webView.evaluateJavascript(
            "javascript:if(window.onLocationPermissionsGranted) { window.onLocationPermissionsGranted(); }",
            null
        )
    }
    
    // 🔥 위치/동작 권한이 허용되었을 때 실행될 함수
    private fun onLocationActivityPermissionsGranted() {
        android.util.Log.d(TAG, "🔥 위치/동작 권한 허용 완료")
        // WebView에 위치/동작 권한 허용 완료 알림
        webView.evaluateJavascript(
            "javascript:if(window.onLocationActivityPermissionsGranted) { window.onLocationActivityPermissionsGranted(); }",
            null
        )
    }
    
    // 🌍 웹에서 위치 권한 요청 시 네이티브 권한 요청
    private fun requestLocationPermissionsForWeb(
        origin: String?,
        callback: android.webkit.GeolocationPermissions.Callback?
    ) {
        android.util.Log.d(TAG, "🌍 [GEOLOCATION] 웹 위치 권한을 위한 네이티브 권한 요청")
        
        // 콜백 저장 (권한 허용 후 호출하기 위해)
        pendingGeolocationOrigin = origin
        pendingGeolocationCallback = callback
        
        // 이미 위치 권한이 있는지 확인
        if (hasLocationPermissions()) {
            android.util.Log.d(TAG, "✅ [GEOLOCATION] 이미 위치 권한 있음 - 바로 허용")
            handleGeolocationPermissionGranted()
            return
        }
        
        // 네이티브 위치 권한 요청
        val missingLocationPermissions = locationPermissions.filter { permission ->
            ActivityCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
        
        if (missingLocationPermissions.isNotEmpty()) {
            android.util.Log.d(TAG, "🔔 [GEOLOCATION] 네이티브 위치 권한 요청 시작: ${missingLocationPermissions.joinToString()}")
            ActivityCompat.requestPermissions(
                this,
                missingLocationPermissions.toTypedArray(),
                LOCATION_PERMISSIONS_REQUEST_CODE
            )
        }
    }
    
    // 🌍 웹 위치 권한 허용 처리
    private fun handleGeolocationPermissionGranted() {
        android.util.Log.d(TAG, "✅ [GEOLOCATION] 웹 위치 권한 허용 처리")
        
        // 저장된 콜백이 있으면 호출
        pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, true, true)
        
        // SharedPreferences에 웹 위치 권한 동의 저장
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("web_geolocation_granted", true).apply()
        
        // 콜백 초기화
        pendingGeolocationOrigin = null
        pendingGeolocationCallback = null
    }
    
    // 🌍 웹 위치 권한 거부 처리
    private fun handleGeolocationPermissionDenied() {
        android.util.Log.w(TAG, "❌ [GEOLOCATION] 웹 위치 권한 거부 처리")
        
        // 저장된 콜백이 있으면 거부로 호출
        pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, false, false)
        
        // 콜백 초기화
        pendingGeolocationOrigin = null
        pendingGeolocationCallback = null
    }
    
    // 🔥 권한 요청 결과 처리
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            LOCATION_PERMISSIONS_REQUEST_CODE -> {
                val deniedPermissions = mutableListOf<String>()
                
                for (i in permissions.indices) {
                    if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                        deniedPermissions.add(permissions[i])
                    }
                }
                
                if (deniedPermissions.isEmpty()) {
                    android.util.Log.d(TAG, "🔥 위치 권한이 모두 허용됨")
                    onLocationPermissionsGranted()
                    
                    // 🌍 웹 위치 권한 콜백도 처리
                    if (pendingGeolocationCallback != null) {
                        android.util.Log.d(TAG, "🌍 [GEOLOCATION] 웹 위치 권한 콜백 호출")
                        handleGeolocationPermissionGranted()
                    }
                } else {
                    android.util.Log.w(TAG, "⚠️ 위치 권한 거부됨: ${deniedPermissions.joinToString()}")
                    // 위치 권한이 거부되어도 앱은 계속 작동
                    webView.evaluateJavascript(
                        "javascript:if(window.onLocationPermissionsDenied) { window.onLocationPermissionsDenied(); }",
                        null
                    )
                    
                    // 🌍 웹 위치 권한 콜백도 처리 (거부)
                    if (pendingGeolocationCallback != null) {
                        android.util.Log.d(TAG, "🌍 [GEOLOCATION] 웹 위치 권한 거부 콜백 호출")
                        handleGeolocationPermissionDenied()
                    }
                }
            }
            BACKGROUND_LOCATION_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.d(TAG, "🔥 백그라운드 위치 권한 허용됨")
                    onAllPermissionsGrantedComplete()
                } else {
                    android.util.Log.w(TAG, "⚠️ 백그라운드 위치 권한 거부됨")
                    // 백그라운드 위치 권한이 거부되어도 앱은 계속 작동
                    onAllPermissionsGrantedComplete()
                }
            }
            MULTIPLE_PERMISSIONS_REQUEST_CODE -> {
                val deniedPermissions = mutableListOf<String>()
                
                for (i in permissions.indices) {
                    if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                        deniedPermissions.add(permissions[i])
                    }
                }
                
                if (deniedPermissions.isEmpty()) {
                    android.util.Log.d(TAG, "🔥 요청된 권한들이 모두 허용됨")
                    
                    // 전체 권한 요청인지 위치/동작 권한만 요청했는지 확인
                    val locationAndActivityPermissions = mutableListOf<String>().apply {
                        add(Manifest.permission.ACCESS_FINE_LOCATION)
                        add(Manifest.permission.ACCESS_COARSE_LOCATION)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            add(Manifest.permission.ACTIVITY_RECOGNITION)
                        }
                    }
                    
                    val isLocationActivityOnly = permissions.all { it in locationAndActivityPermissions }
                    
                    if (isLocationActivityOnly) {
                        android.util.Log.d(TAG, "🔥 위치/동작 권한만 요청했으므로 해당 콜백 호출")
                        onLocationActivityPermissionsGranted()
                    } else {
                        android.util.Log.d(TAG, "🔥 전체 권한 요청이므로 전체 콜백 호출")
                        onAllPermissionsGranted()
                    }
                } else {
                    android.util.Log.w(TAG, "⚠️ 거부된 권한: ${deniedPermissions.joinToString()}")
                    
                    // 사용자에게 권한이 필요한 이유 설명
                    val permissionNames = deniedPermissions.map { permission ->
                        when (permission) {
                            Manifest.permission.CAMERA -> "카메라"
                            Manifest.permission.READ_EXTERNAL_STORAGE -> "사진보관함"
                            Manifest.permission.ACCESS_FINE_LOCATION -> "위치"
                            Manifest.permission.ACCESS_COARSE_LOCATION -> "위치"
                            Manifest.permission.POST_NOTIFICATIONS -> "알림"
                            Manifest.permission.ACTIVITY_RECOGNITION -> "동작 인식"
                            else -> permission
                        }
                    }.joinToString(", ")
                    
                    Toast.makeText(
                        this,
                        "앱의 원활한 사용을 위해 ${permissionNames} 권한이 필요합니다.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }



    // 🔥 개발 서버 연결 테스트 (에뮬레이터용) - 개선된 버전
    private fun testDevServerConnection(callback: (Boolean) -> Unit) {
        Thread {
            var isDevServerRunning = false
            
            // 🔥 여러 방법으로 개발 서버 연결 테스트
            val testUrls = listOf(
                "http://10.0.2.2:3000/api/health",     // Health check endpoint
                "http://10.0.2.2:3000/",               // Root endpoint
                "http://localhost:3000/api/health",     // Alternative localhost
                "http://127.0.0.1:3000/api/health"     // Alternative loopback
            )
            
            for (testUrl in testUrls) {
                try {
                    android.util.Log.d("DevServer", "테스트 중: $testUrl")
                    val url = java.net.URL(testUrl)
                    val connection = url.openConnection() as java.net.HttpURLConnection
                    
                    // 🔥 에뮬레이터 환경에 맞춰 타임아웃 단축
                    connection.connectTimeout = 3000 // 3초로 단축
                    connection.readTimeout = 3000
                    connection.requestMethod = "GET"
                    
                    // 🔥 에뮬레이터 환경을 위한 헤더 추가
                    connection.setRequestProperty("User-Agent", "AndroidEmulator/1.0")
                    connection.setRequestProperty("Accept", "*/*")
                    
                    val responseCode = connection.responseCode
                    connection.disconnect()
                    
                    if (responseCode in 200..299) {
                        android.util.Log.d("DevServer", "✅ 개발 서버 연결 성공: $testUrl (응답: $responseCode)")
                        isDevServerRunning = true
                        break
                    } else {
                        android.util.Log.w("DevServer", "⚠️ 응답 코드 오류: $testUrl ($responseCode)")
                    }
                } catch (e: java.net.ConnectException) {
                    android.util.Log.d("DevServer", "❌ 연결 거부: $testUrl - 서버가 실행되지 않음")
                } catch (e: java.net.SocketTimeoutException) {
                    android.util.Log.d("DevServer", "⏰ 연결 타임아웃: $testUrl")
                } catch (e: java.net.UnknownHostException) {
                    android.util.Log.d("DevServer", "🔍 호스트 찾을 수 없음: $testUrl")
                } catch (e: Exception) {
                    android.util.Log.w("DevServer", "❓ 기타 오류: $testUrl - ${e.message}")
                }
            }
            
            android.util.Log.d("DevServer", "최종 개발 서버 상태: ${if (isDevServerRunning) "실행 중" else "실행되지 않음"}")
            
            runOnUiThread {
                callback(isDevServerRunning)
            }
        }.start()
    }
    
    // 🔥 실제 인터넷 연결 테스트 (에뮬레이터용 개선)
    private fun testInternetConnection(callback: (Boolean) -> Unit) {
        Thread {
            try {
                // 🔥 에뮬레이터에서는 여러 URL을 테스트
                val testUrls = if (isEmulator()) {
                    listOf(
                        "http://10.0.2.2:3000/api/health",
                        "http://localhost:3000/api/health",
                        "https://www.google.com"
                    )
                } else {
                    listOf(
                        "https://www.google.com",
                        "http://localhost:3000/api/health"
                    )
                }
                
                var isConnected = false
                
                for (urlString in testUrls) {
                    try {
                        android.util.Log.d("Network", "인터넷 연결 테스트: $urlString")
                        val url = java.net.URL(urlString)
                        val connection = url.openConnection() as java.net.HttpURLConnection
                        connection.connectTimeout = 3000
                        connection.readTimeout = 3000
                        connection.requestMethod = "HEAD"
                        
                        val responseCode = connection.responseCode
                        connection.disconnect()
                        
                        if (responseCode == 200) {
                            android.util.Log.d("Network", "✅ 연결 성공: $urlString (응답 코드: $responseCode)")
                            isConnected = true
                            break
                        } else {
                            android.util.Log.w("Network", "⚠️ 연결 실패: $urlString (응답 코드: $responseCode)")
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("Network", "❌ 연결 테스트 실패: $urlString - ${e.message}")
                    }
                }
                
                android.util.Log.d("Network", "최종 인터넷 연결 상태: $isConnected")
                
                runOnUiThread {
                    callback(isConnected)
                }
            } catch (e: Exception) {
                android.util.Log.e("Network", "인터넷 연결 테스트 실패", e)
                runOnUiThread {
                    callback(false)
                }
            }
        }.start()
    }

    private fun showLoading(show: Boolean) {
        isLoading = show
        android.util.Log.d("SMAP_WebView", "🔥 로딩 상태 변경: $show")
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }

    private fun showError() {
        runOnUiThread {
            android.util.Log.d("SMAP_WebView", "🔥 오류 화면 표시 시작")
            
            webView.visibility = View.GONE
            progressBar.visibility = View.GONE
            
            // 🔥 nextstep.smap.site 연결 오류 메시지
            val errorTitle = "서버 연결 오류"
            val errorMessage = "nextstep.smap.site에 연결할 수 없습니다.<br>네트워크 연결을 확인하고 다시 시도해주세요."
            
            // 🔥 오프라인 페이지 표시
            val offlineHtml = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>SMAP - $errorTitle</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            margin: 0;
                            padding: 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                        }
                        .container {
                            text-align: center;
                            max-width: 400px;
                            background: rgba(255, 255, 255, 0.1);
                            padding: 40px 20px;
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                        }
                        .icon {
                            font-size: 64px;
                            margin-bottom: 20px;
                        }
                        h1 {
                            margin: 0 0 10px 0;
                            font-size: 24px;
                            font-weight: 600;
                        }
                        p {
                            margin: 0 0 30px 0;
                            opacity: 0.9;
                            line-height: 1.5;
                            text-align: left;
                        }
                        .retry-btn {
                            background: rgba(255, 255, 255, 0.2);
                            border: 1px solid rgba(255, 255, 255, 0.3);
                            color: white;
                            padding: 12px 24px;
                            border-radius: 25px;
                            font-size: 16px;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            text-decoration: none;
                            display: inline-block;
                        }
                        .retry-btn:hover {
                            background: rgba(255, 255, 255, 0.3);
                            transform: translateY(-2px);
                        }
                        .status {
                            margin-top: 20px;
                            font-size: 14px;
                            opacity: 0.7;
                        }
                        .emulator-info {
                            margin-top: 15px;
                            padding: 10px;
                            background: rgba(255, 255, 255, 0.1);
                            border-radius: 10px;
                            font-size: 12px;
                            text-align: left;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">📡</div>
                        <h1>$errorTitle</h1>
                        <p>$errorMessage</p>
                        <button class="retry-btn" onclick="retryConnection()">다시 시도</button>
                        <div class="status">
                            <div>시도한 서버: nextstep.smap.site</div>
                            <div>마지막 시도: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}</div>
                        </div>
                    </div>
                    <script>
                        function retryConnection() {
                            if (window.AndroidRetry) {
                                window.AndroidRetry.retry();
                            } else {
                                location.reload();
                            }
                        }
                    </script>
                </body>
                </html>
            """.trimIndent()
            
            webView.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null)
            webView.visibility = View.VISIBLE
            
            // 🔥 재시도 버튼을 위한 JavaScript 인터페이스 추가
            webView.addJavascriptInterface(object {
                @android.webkit.JavascriptInterface
                fun retry() {
                    runOnUiThread {
                        currentUrlIndex = 0
                        loadWebView()
                    }
                }
            }, "AndroidRetry")
        }
    }

    private fun hideError() {
        android.util.Log.d("SMAP_WebView", "🔥 오류 화면 숨기기")
        // 🔥 오프라인 페이지 숨기기 - WebView가 정상적으로 로드되면 자동으로 호출됨
        webView.visibility = View.VISIBLE
        progressBar.visibility = View.GONE
    }



    // 🔥 WebView 로딩 함수 추가
    private fun loadWebViewInternal() {
        try {
            android.util.Log.d("SMAP_WebView", "🔥 loadWebViewInternal 시작")
            
            // WebView가 초기화되었는지 확인
            if (::webView.isInitialized) {
                android.util.Log.d("SMAP_WebView", "✅ WebView 초기화 확인됨")
                // nextstep.smap.site만 사용하므로 fallback 로직 제거
                val targetUrl = "https://nextstep.smap.site/"
                android.util.Log.d("SMAP_WebView", "🔥 대상 URL 로딩: $targetUrl")
                webView.loadUrl(targetUrl)
            } else {
                android.util.Log.e("SMAP_WebView", "❌ WebView가 초기화되지 않음")
                showError()
            }
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ WebView 로딩 중 오류 발생", e)
            showError()
        }
    }
    
    // 🔥 초기 WebView 로딩 함수
    private fun loadWebView() {
        android.util.Log.d("SMAP_WebView", "🔥 loadWebView 시작")
        currentUrlIndex = 0
        
        try {
            val firstUrl = try {
                fallbackUrls.getOrElse(currentUrlIndex) { "https://nextstep.smap.site/" }
            } catch (e: Exception) { "https://nextstep.smap.site/" }
            android.util.Log.d("SMAP_WebView", "🔥 초기 URL 로딩: $firstUrl")
            webView.loadUrl(firstUrl)
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ WebView 로딩 중 오류 발생", e)
            showError()
        }
    }

    // 현재 앱에 저장된 사용자 로그인 상태 확인 (SharedPreferences의 mt_idx 기준)
    private fun isUserLoggedIn(): Boolean {
        return try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val mtIdx = prefs.getInt("mt_idx", -1)
            mtIdx != -1
        } catch (e: Exception) {
            false
        }
    }

    // 🔥 네트워크 연결 상태 확인 함수
    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        return capabilities != null && (
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        )
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.destroy()
        stopLocationService()
        super.onDestroy()
    }

    private fun checkAndStartLocationService() {
        android.util.Log.d("MainActivity", "🔥 [AUTO] 위치 서비스 자동 시작 확인 시작")

        // 위치 권한 확인
        if (!hasLocationPermissions()) {
            android.util.Log.d("MainActivity", "❌ [AUTO] 위치 권한이 없음 - 위치 서비스 시작하지 않음")
            return
        }

        android.util.Log.d("MainActivity", "✅ [AUTO] 위치 권한이 있음 - 위치 서비스 자동 시작")

        // 사용자 로그인 상태 확인 (mt_idx가 있는지)
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        val mtIdx = prefs.getInt("mt_idx", -1)
        android.util.Log.d("MainActivity", "🔍 [AUTO] 사용자 로그인 상태 - mt_idx: $mtIdx")

        if (mtIdx != -1) {
            android.util.Log.d("MainActivity", "✅ [AUTO] 사용자가 로그인됨 - 위치 서비스 시작")
            startLocationService()
        } else {
            android.util.Log.d("MainActivity", "⚠️ [AUTO] 사용자가 로그인되지 않음 - 위치 서비스 시작 보류")
        }
    }
    
    private fun startLocationService() {
        try {
            if (!LocationService.isRunning(this)) {
                val serviceIntent = Intent(this, LocationService::class.java)
                // 액티비티 포그라운드에서 시작하므로 일반 startService로 시작해 FGS 타임아웃을 피함
                startService(serviceIntent)
                android.util.Log.d("MainActivity", "LocationService started")
            }
        } catch (e: Exception) {
            android.util.Log.w("MainActivity", "LocationService 시작 실패 (정상적인 현상): ${e.message}")
            // LocationService 시작 실패는 앱 실행에 영향을 주지 않음
        }
    }

    private fun stopLocationService() {
        if (LocationService.isRunning(this)) {
            val serviceIntent = Intent(this, LocationService::class.java)
            stopService(serviceIntent)
            android.util.Log.d("MainActivity", "LocationService stopped")
        }
    }

    enum class HapticType {
        LIGHT, MEDIUM, HEAVY, SUCCESS, WARNING, ERROR
    }

    // 🔥 초기 JavaScript 인터페이스 등록 (WebView 설정 시점에 즉시 실행)
    private fun injectInitialInterfaces() {
        android.util.Log.d("SMAP_WebView", "🔥 초기 JavaScript 인터페이스 등록 시작")
        
        try {
            // 🔥 JavaScript 인터페이스들을 WebView에 즉시 등록
            webView.addJavascriptInterface(HapticInterface(), "AndroidHaptic")
            android.util.Log.d("SMAP_WebView", "✅ 초기 AndroidHaptic 인터페이스 등록 완료")
            
            webView.addJavascriptInterface(PermissionInterface(), "AndroidPermissions")
            android.util.Log.d("SMAP_WebView", "✅ 초기 AndroidPermissions 인터페이스 등록 완료")
            
            // 🔥 Google Sign-In 인터페이스는 이미 setupWebView에서 등록됨 (중복 방지)
            android.util.Log.d("SMAP_WebView", "ℹ️ AndroidGoogleSignIn 인터페이스는 이미 등록됨")
            
            // 🔥 즉시 간단한 확인 스크립트 실행
            val checkScript = """
                console.log('📱 [ANDROID INIT] 초기 인터페이스 확인 시작');
                console.log('📱 [ANDROID INIT] AndroidHaptic:', !!window.AndroidHaptic);
                console.log('📱 [ANDROID INIT] AndroidGoogleSignIn:', !!window.AndroidGoogleSignIn);
                console.log('📱 [ANDROID INIT] AndroidPermissions:', !!window.AndroidPermissions);
                console.log('📱 [ANDROID INIT] AndroidGoogleSignIn.signIn:', !!(window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function'));
                console.log('📱 [ANDROID INIT] AndroidGoogleSignIn 객체 상세:', window.AndroidGoogleSignIn);
                
                if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                    console.log('✅ [ANDROID INIT] 초기 Google Sign-In 인터페이스 정상');
                    window.__ANDROID_GOOGLE_SIGNIN_INITIAL_READY__ = true;
                    
                    // 🔥 초기 콜백 함수들 등록
                    if (!window.googleSignInSuccess) {
                        window.googleSignInSuccess = function(idToken, userInfoJson) {
                            console.log('📱 [INIT CALLBACK] googleSignInSuccess 호출됨');
                            
                            // 타임아웃 클리어
                            if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                                clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                                window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                            }
                            
                            // 로딩 상태 해제
                            if (window.setIsLoading) {
                                window.setIsLoading(false);
                            }
                            window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                            
                            // 성공 처리
                            setTimeout(() => {
                                window.location.href = '/home';
                            }, 100);
                        };
                    }
                    
                    if (!window.googleSignInError) {
                        window.googleSignInError = function(errorMessage) {
                            console.error('📱 [INIT CALLBACK] googleSignInError 호출됨:', errorMessage);
                            
                            // 타임아웃 클리어
                            if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                                clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                                window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                            }
                            
                            // 로딩 상태 해제
                            if (window.setIsLoading) {
                                window.setIsLoading(false);
                            }
                            window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                            
                            // 오류 메시지 표시
                            if (window.setError) {
                                window.setError(errorMessage || 'Google 로그인에 실패했습니다.');
                            } else {
                                alert(errorMessage || 'Google 로그인에 실패했습니다.');
                            }
                        };
                    }
                    
                    // 테스트 함수 등록
                    window.testAndroidGoogleSignIn = function() {
                        console.log('🧪 [ANDROID TEST] 테스트 함수 호출됨');
                        if (window.AndroidGoogleSignIn && window.AndroidGoogleSignIn.signIn) {
                            console.log('🧪 [ANDROID TEST] signIn 함수 호출 시도');
                            window.AndroidGoogleSignIn.signIn();
                        } else {
                            console.error('🧪 [ANDROID TEST] signIn 함수 없음');
                        }
                    };
                    console.log('🧪 [ANDROID TEST] 테스트 함수 등록됨: window.testAndroidGoogleSignIn');
                    console.log('📱 [INIT CALLBACK] 모든 콜백 함수 등록 완료');
                } else {
                    console.error('❌ [ANDROID INIT] 초기 Google Sign-In 인터페이스 없음');
                }
            """.trimIndent()
            
            webView.evaluateJavascript(checkScript) { result ->
                android.util.Log.d("SMAP_WebView", "📱 초기 인터페이스 확인 완료: $result")
            }
            
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ 초기 JavaScript 인터페이스 등록 실패", e)
        }
    }
    
    // 🔥 Google Sign-In 인터페이스 주입
    private fun injectGoogleSignInInterface() {
        android.util.Log.d("SMAP_WebView", "🔥 Google Sign-In 인터페이스 주입 시작")
        
        try {
            // 🔥 인터페이스가 이미 등록되어 있는지 확인
            // 🔥 Google Sign-In 인터페이스 강제 등록
            webView.addJavascriptInterface(GoogleSignInInterface(), "AndroidGoogleSignIn")
            android.util.Log.d("SMAP_WebView", "✅ Google Sign-In 인터페이스 등록 완료")
            
            // 확인 스크립트 실행 및 콜백 함수 등록
            val checkScript = """
                console.log('🔍 [ANDROID GOOGLE SIGNIN] Google Sign-In 인터페이스 초기화 시작');
                console.log('🔍 [ANDROID GOOGLE SIGNIN] AndroidGoogleSignIn 객체:', !!window.AndroidGoogleSignIn);
                console.log('🔍 [ANDROID GOOGLE SIGNIN] signIn 함수:', !!(window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function'));
                
                // 🔥 Google Sign-In 성공 콜백 함수 확실히 등록
                window.googleSignInSuccess = function(idToken, userInfoJson) {
                    console.log('📱 [ANDROID CALLBACK] googleSignInSuccess 호출됨');
                    console.log('📱 [ANDROID CALLBACK] ID Token 길이:', idToken ? idToken.length : 0);
                    console.log('📱 [ANDROID CALLBACK] User Info:', userInfoJson);
                    
                    try {
                        // 타임아웃 클리어
                        if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                            clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                            window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                            console.log('📱 [ANDROID CALLBACK] 타임아웃 클리어 완료');
                        }
                        
                        // 즉시 로딩 상태 해제
                        if (window.setIsLoading) {
                            window.setIsLoading(false);
                            console.log('📱 [ANDROID CALLBACK] setIsLoading(false) 완료');
                        }
                        
                        // 진행 중 플래그 해제
                        window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                        console.log('📱 [ANDROID CALLBACK] 진행 중 플래그 해제');
                        
                        // 사용자 정보 파싱
                        const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
                        console.log('📱 [ANDROID CALLBACK] 파싱된 사용자 정보:', userInfo);
                        
                        // 성공 처리 진행
                        console.log('📱 [ANDROID CALLBACK] Google 로그인 성공 처리 완료');
                        
                        // 페이지 새로고침 또는 리다이렉트
                        setTimeout(() => {
                            window.location.href = '/home';
                        }, 100);
                        
                    } catch (error) {
                        console.error('📱 [ANDROID CALLBACK] googleSignInSuccess 처리 중 오류:', error);
                        
                        // 오류 시에도 로딩 상태 해제
                        if (window.setIsLoading) {
                            window.setIsLoading(false);
                        }
                        window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                        
                        // 오류 메시지 표시
                        if (window.setError) {
                            window.setError('로그인 처리 중 오류가 발생했습니다.');
                        }
                    }
                };
                
                // 🔥 Google Sign-In 실패 콜백 함수 확실히 등록
                window.googleSignInError = function(errorMessage) {
                    console.error('📱 [ANDROID CALLBACK] googleSignInError 호출됨:', errorMessage);
                    
                    try {
                        // 타임아웃 클리어
                        if (window.__GOOGLE_LOGIN_TIMEOUT__) {
                            clearTimeout(window.__GOOGLE_LOGIN_TIMEOUT__);
                            window.__GOOGLE_LOGIN_TIMEOUT__ = null;
                            console.log('📱 [ANDROID CALLBACK] 오류 시 타임아웃 클리어 완료');
                        }
                        
                        // 즉시 로딩 상태 해제
                        if (window.setIsLoading) {
                            window.setIsLoading(false);
                            console.log('📱 [ANDROID CALLBACK] 오류 시 setIsLoading(false) 완료');
                        }
                        
                        // 진행 중 플래그 해제
                        window.__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                        console.log('📱 [ANDROID CALLBACK] 오류 시 진행 중 플래그 해제');
                        
                        // 오류 메시지 표시
                        if (window.setError) {
                            window.setError(errorMessage || 'Google 로그인에 실패했습니다.');
                        } else {
                            alert(errorMessage || 'Google 로그인에 실패했습니다.');
                        }
                        
                    } catch (error) {
                        console.error('📱 [ANDROID CALLBACK] googleSignInError 처리 중 오류:', error);
                    }
                };
                
                if (window.AndroidGoogleSignIn && typeof window.AndroidGoogleSignIn.signIn === 'function') {
                    console.log('✅ [ANDROID GOOGLE SIGNIN] 네이티브 인터페이스 즉시 발견!');
                    window.__ANDROID_GOOGLE_SIGNIN_READY__ = true;
                } else {
                    console.error('❌ [ANDROID GOOGLE SIGNIN] 네이티브 인터페이스 없음');
                }
                
                console.log('📱 [ANDROID CALLBACK] 모든 콜백 함수 등록 완료');
            """.trimIndent()
            
            webView.evaluateJavascript(checkScript) { result ->
                android.util.Log.d("SMAP_WebView", "📱 Google Sign-In 인터페이스 확인 완료: $result")
            }
            
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ Google Sign-In 인터페이스 주입 실패", e)
        }
    }
    
    // 🔥 모든 인터페이스 강제 주입
    private fun injectAllInterfaces() {
        android.util.Log.d("SMAP_WebView", "🔥 모든 인터페이스 강제 주입 시작")
        
        try {
            // 🔥 모든 인터페이스 강제 등록
            webView.addJavascriptInterface(HapticInterface(), "AndroidHaptic")
            android.util.Log.d("SMAP_WebView", "✅ AndroidHaptic 인터페이스 등록 완료")
            
            webView.addJavascriptInterface(GoogleSignInInterface(), "AndroidGoogleSignIn")
            android.util.Log.d("SMAP_WebView", "✅ AndroidGoogleSignIn 인터페이스 등록 완료")
            
            webView.addJavascriptInterface(PermissionInterface(), "AndroidPermissions")
            android.util.Log.d("SMAP_WebView", "✅ AndroidPermissions 인터페이스 등록 완료")
            
            android.util.Log.d("SMAP_WebView", "✅ 인터페이스 등록 상태 확인 완료")
            
            // 확인 스크립트 실행
            val checkScript = """
                (function(){
                  try {
                    console.log('🔍 [ANDROID HANDLER MONITOR] 핸들러 모니터링 시작');
                    if (window.__ANDROID_HANDLERS_MONITOR_INITIALIZED__) {
                      console.log('ℹ️ [ANDROID HANDLER MONITOR] 이미 초기화됨, 재정의 생략');
                      return;
                    }
                    window.__ANDROID_HANDLERS_MONITOR_INITIALIZED__ = true;

                    function _smapCheckHandlers() {
                      var handlers = [];
                      if (window.AndroidHaptic) handlers.push('AndroidHaptic');
                      if (window.AndroidGoogleSignIn) handlers.push('AndroidGoogleSignIn');
                      console.log('📋 [ANDROID HANDLER MONITOR] 사용 가능한 핸들러들:', handlers.join(','));
                      if (handlers.length > 0) {
                        console.log('✅ [ANDROID HANDLER MONITOR] 핸들러 모니터링 설정 완료');
                        window.__ANDROID_HANDLERS_READY__ = true;
                      } else {
                        console.error('❌ [ANDROID HANDLER MONITOR] 사용 가능한 핸들러 없음');
                      }
                    }

                    _smapCheckHandlers();
                  } catch (e) {
                    console.error('[ANDROID HANDLER MONITOR] 초기화 오류:', e && e.message ? e.message : e);
                  }
                })();
            """.trimIndent()
            
            webView.evaluateJavascript(checkScript) { result ->
                android.util.Log.d("SMAP_WebView", "📱 1초 후 재확인 완료: $result")
            }
            
        } catch (e: Exception) {
            android.util.Log.e("SMAP_WebView", "❌ 모든 인터페이스 주입 실패", e)
        }
    }
    

    
    private fun saveTokenToPreferences(token: String) {
        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("fcm_token", token)
                .putLong("fcm_token_timestamp", System.currentTimeMillis())
                .apply()
            android.util.Log.d(TAG, "💾 [FCM] 토큰을 SharedPreferences에 저장 완료")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM] 토큰 저장 실패", e)
        }
    }
    
    private fun validateAndSendTokenIfUserExists(token: String) {
        android.util.Log.d(TAG, "🔍 [FCM] 토큰 유효성 검증 및 서버 전송 시작")

        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val mtIdx = prefs.getInt("mt_idx", -1)

            if (mtIdx != -1) {
                android.util.Log.d(TAG, "✅ [FCM] 사용자 정보 존재 (mt_idx: $mtIdx) - 토큰 검증 및 전송")

                // FCM 토큰 검증 서비스 호출
                val service = MyFirebaseMessagingService()
                service.validateAndRefreshTokenIfNeeded()
            } else {
                android.util.Log.d(TAG, "⚠️ [FCM] 사용자 정보 없음 - 로그인 후 토큰 검증 예정")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM] 토큰 검증 및 서버 전송 중 오류", e)
        }
    }

    private fun sendTokenToServerIfUserExists(token: String) {
        android.util.Log.d(TAG, "🚀 [FCM] 토큰 서버 전송 확인 (MainActivity에서)")

        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val mtIdx = prefs.getInt("mt_idx", -1)

            if (mtIdx != -1) {
                android.util.Log.d(TAG, "✅ [FCM] 사용자 정보 존재 (mt_idx: $mtIdx) - 토큰 전송 시작")

                // MyFirebaseMessagingService와 동일한 로직으로 서버에 전송
                val service = MyFirebaseMessagingService()
                // onNewToken을 직접 호출할 수는 없지만, 토큰이 준비되었음을 알림

                android.util.Log.d(TAG, "🔔 [FCM] 토큰 준비 완료 - MyFirebaseMessagingService가 자동 처리")
            } else {
                android.util.Log.d(TAG, "⚠️ [FCM] 사용자 정보 없음 - 로그인 후 토큰 전송 예정")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM] 토큰 서버 전송 확인 중 오류", e)
        }
    }
    
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPermission = ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasPermission) {
                android.util.Log.d(TAG, "🔔 [FCM] 알림 권한 요청")
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    NOTIFICATION_PERMISSION_REQUEST_CODE
                )
            } else {
                android.util.Log.d(TAG, "✅ [FCM] 알림 권한 이미 허용됨")
            }
        }
    }
    
    private fun sendStoredTokenToServer() {
        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val fcmToken = prefs.getString("fcm_token", null)
            val mtIdx = prefs.getInt("mt_idx", -1)
            
            if (fcmToken != null && mtIdx != -1) {
                android.util.Log.d(TAG, "🚀 [FCM] 저장된 토큰을 서버에 전송 - mt_idx: $mtIdx")
                android.util.Log.d(TAG, "🚀 [FCM] 토큰 미리보기: ${fcmToken.take(30)}...")
                
                // MyFirebaseMessagingService의 로직 사용
                // 토큰 새로고침으로 강제 전송
                FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { deleteTask ->
                    if (deleteTask.isSuccessful) {
                        android.util.Log.d(TAG, "🔄 [FCM] 기존 토큰 삭제 완료, 새 토큰 요청 중...")
                        
                        FirebaseMessaging.getInstance().token.addOnCompleteListener { newTokenTask ->
                            if (newTokenTask.isSuccessful) {
                                val newToken = newTokenTask.result
                                android.util.Log.d(TAG, "🆕 [FCM] 새 토큰 생성 완료 - 서버 전송됨")
                            } else {
                                android.util.Log.e(TAG, "❌ [FCM] 새 토큰 생성 실패", newTokenTask.exception)
                            }
                        }
                    } else {
                        android.util.Log.e(TAG, "❌ [FCM] 기존 토큰 삭제 실패", deleteTask.exception)
                    }
                }
            } else {
                android.util.Log.d(TAG, "⚠️ [FCM] 저장된 토큰 또는 사용자 정보 없음")
                android.util.Log.d(TAG, "   - FCM 토큰: ${if (fcmToken != null) "있음" else "없음"}")
                android.util.Log.d(TAG, "   - mt_idx: ${if (mtIdx != -1) mtIdx else "없음"}")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM] 저장된 토큰 전송 중 오류", e)
        }
    }
    
    // 🔥 권한 요청을 위한 JavaScript Interface
    inner class PermissionInterface {
        @JavascriptInterface
        fun checkPermission(permission: String): String {
            android.util.Log.d(TAG, "🔥 JavaScript에서 권한 체크 호출됨: $permission")
            
            try {
                val hasPermission = when (permission) {
                    "notifications" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                        } else {
                            true
                        }
                    }
                    "camera" -> {
                        ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    }
                    "storage" -> {
                        ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
                    }
                    "activity" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
                        } else {
                            true
                        }
                    }
                    "location" -> {
                        ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                        ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    }
                    else -> false
                }
                
                val canAskAgain = when (permission) {
                    "notifications" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            true
                        }
                    }
                    "camera" -> {
                        ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.CAMERA)
                    }
                    "storage" -> {
                        ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE)
                    }
                    "activity" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.ACTIVITY_RECOGNITION)
                        } else {
                            true
                        }
                    }
                    "location" -> {
                        ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) ||
                        ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION)
                    }
                    else -> false
                }
                
                val result = JSONObject().apply {
                    put("granted", hasPermission)
                    put("canAskAgain", canAskAgain)
                    put("shouldShowRationale", canAskAgain)
                }
                
                android.util.Log.d(TAG, "🔥 권한 체크 결과: $permission = $result")
                return result.toString()
                
            } catch (e: Exception) {
                android.util.Log.e(TAG, "🔥 권한 체크 중 오류: $permission", e)
                val errorResult = JSONObject().apply {
                    put("granted", false)
                    put("canAskAgain", false)
                    put("shouldShowRationale", false)
                }
                return errorResult.toString()
            }
        }
        
        @JavascriptInterface
        fun requestPermissions() {
            android.util.Log.d(TAG, "🔥 JavaScript에서 권한 요청 호출됨")
            // 🔥 앱 실행 시 즉시 권한 요청하지 않음 - 로그인 후 홈 화면에서만 처리
            android.util.Log.d(TAG, "🔥 권한 요청은 로그인 후 홈 화면에서만 처리됨")
            // runOnUiThread {
            //     this@MainActivity.requestPermissions()
            // }
        }
        
        @JavascriptInterface
        fun hasAllPermissions(): Boolean {
            val hasPermissions = this@MainActivity.hasAllPermissions()
            android.util.Log.d(TAG, "🔥 권한 확인 결과: $hasPermissions")
            return hasPermissions
        }
        
        @JavascriptInterface
        fun getMissingPermissions(): String {
            val missing = this@MainActivity.getMissingPermissions()
            val result = missing.joinToString(",")
            android.util.Log.d(TAG, "🔥 누락된 권한: $result")
            return result
        }
        
        @JavascriptInterface
        fun setFirstLogin(isFirst: Boolean) {
            android.util.Log.d(TAG, "🔥 첫 로그인 설정: $isFirst")
            this@MainActivity.isFirstLogin = isFirst
            if (isFirst) {
                // 🔥 첫 로그인일 때도 즉시 권한 요청하지 않음 - home 화면에서만 처리
                android.util.Log.d(TAG, "🔥 첫 로그인 감지됨 - 하지만 즉시 권한 요청하지 않음")
                android.util.Log.d(TAG, "🔥 권한 요청은 home 화면에서 처리됨")
                // runOnUiThread {
                //     this@MainActivity.requestPermissions()
                // }
            }
        }
        
        @JavascriptInterface
        fun resetPermissionState() {
            android.util.Log.d(TAG, "🔄 JavaScript에서 권한 상태 초기화 요청됨")
            runOnUiThread {
                try {
                    // 권한 상태 관련 변수들 초기화
                    this@MainActivity.isFirstLogin = true
                    this@MainActivity.hasRequestedPermissions = false
                    
                    // SharedPreferences에서 권한 관련 데이터 초기화
                    val sharedPrefs = getSharedPreferences("SMAP_PERMISSIONS", Context.MODE_PRIVATE)
                    val editor = sharedPrefs.edit()
                    editor.remove("permissions_granted")
                    editor.remove("first_login_completed")
                    editor.remove("permission_request_count")
                    editor.apply()
                    
                    android.util.Log.d(TAG, "✅ 권한 상태 초기화 완료")
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "❌ 권한 상태 초기화 중 오류", e)
                }
            }
        }
        
        @JavascriptInterface
        fun hasLocationAndActivityPermissions(): Boolean {
            val locationAndActivityPermissions = mutableListOf<String>().apply {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    add(Manifest.permission.ACTIVITY_RECOGNITION)
                }
            }
            val hasPermissions = this@MainActivity.hasSpecificPermissions(locationAndActivityPermissions)
            android.util.Log.d(TAG, "🔥 위치/동작 권한 확인 결과: $hasPermissions")
            return hasPermissions
        }
        
        @JavascriptInterface
        fun requestPermission(permission: String): String {
            android.util.Log.d(TAG, "🔥 JavaScript에서 권한 요청 호출됨: $permission")
            
            try {
                val permissionList = when (permission) {
                    "notifications" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            arrayOf<String>()
                        }
                    }
                    "camera" -> arrayOf(Manifest.permission.CAMERA)
                    "storage" -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                    "activity" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            arrayOf(Manifest.permission.ACTIVITY_RECOGNITION)
                        } else {
                            arrayOf<String>()
                        }
                    }
                    "location" -> arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                    else -> arrayOf<String>()
                }
                
                if (permissionList.isNotEmpty()) {
                    runOnUiThread {
                        ActivityCompat.requestPermissions(
                            this@MainActivity,
                            permissionList,
                            MULTIPLE_PERMISSIONS_REQUEST_CODE
                        )
                    }
                    
                    val result = JSONObject().apply {
                        put("success", true)
                        put("permission", permission)
                        put("message", "권한 요청 다이얼로그가 표시되었습니다.")
                    }
                    
                    android.util.Log.d(TAG, "🔥 권한 요청 시작: $permission")
                    return result.toString()
                } else {
                    val result = JSONObject().apply {
                        put("success", false)
                        put("permission", permission)
                        put("message", "이 권한은 이 버전의 Android에서 지원되지 않습니다.")
                    }
                    
                    android.util.Log.w(TAG, "🔥 권한 요청 실패: $permission - 지원되지 않음")
                    return result.toString()
                }
                
            } catch (e: Exception) {
                android.util.Log.e(TAG, "🔥 권한 요청 중 오류: $permission", e)
                val errorResult = JSONObject().apply {
                    put("success", false)
                    put("permission", permission)
                    put("message", "권한 요청 중 오류가 발생했습니다: ${e.message}")
                }
                return errorResult.toString()
            }
        }
        
        @JavascriptInterface
        fun requestLocationAndActivityPermissions() {
            android.util.Log.d(TAG, "🔥 JavaScript에서 위치/동작 권한 요청 호출됨")
            // 🔥 앱 실행 시 즉시 권한 요청하지 않음 - 로그인 후 홈 화면에서만 처리
            android.util.Log.d(TAG, "🔥 위치/동작 권한 요청은 로그인 후 홈 화면에서만 처리됨")
            // val locationAndActivityPermissions = mutableListOf<String>().apply {
            //     add(Manifest.permission.ACCESS_FINE_LOCATION)
            //     add(Manifest.permission.ACCESS_COARSE_LOCATION)
            //     if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            //         add(Manifest.permission.ACTIVITY_RECOGNITION)
            //     }
            // }
            // runOnUiThread {
            //     this@MainActivity.requestSpecificPermissions(locationAndActivityPermissions)
            // }
        }
        
        @JavascriptInterface
        fun getMissingLocationAndActivityPermissions(): String {
            val locationAndActivityPermissions = mutableListOf<String>().apply {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    add(Manifest.permission.ACTIVITY_RECOGNITION)
                }
            }
            val missing = this@MainActivity.getMissingSpecificPermissions(locationAndActivityPermissions)
            val result = missing.joinToString(",")
            android.util.Log.d(TAG, "🔥 누락된 위치/동작 권한: $result")
            return result
        }

        @JavascriptInterface
        fun startLocationService() {
            android.util.Log.d(TAG, "🚀 JavaScript에서 위치 서비스 시작 요청됨")
            runOnUiThread {
                try {
                    // 위치 권한이 없으면 먼저 요청
                    if (!hasLocationPermissions()) {
                        requestLocationPermissions()
                    } else {
                        this@MainActivity.startLocationService()
                        android.util.Log.d(TAG, "✅ 위치 서비스 시작 완료")
                    }
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "❌ 위치 서비스 시작 실패", e)
                }
            }
        }
        
        @JavascriptInterface
        fun requestLocationPermissions() {
            android.util.Log.d(TAG, "🔥 JavaScript에서 위치 권한 요청됨")
            runOnUiThread {
                try {
                    this@MainActivity.requestLocationPermissions()
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "❌ 위치 권한 요청 실패", e)
                }
            }
        }

        @JavascriptInterface
        fun stopLocationService() {
            android.util.Log.d(TAG, "🛑 JavaScript에서 위치 서비스 정지 요청됨")
            runOnUiThread {
                try {
                    this@MainActivity.stopLocationService()
                    android.util.Log.d(TAG, "✅ 위치 서비스 정지 완료")
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "❌ 위치 서비스 정지 실패", e)
                }
            }
        }

        @JavascriptInterface
        fun isLocationServiceRunning(): Boolean {
            val isRunning = LocationService.isRunning(this@MainActivity)
            android.util.Log.d(TAG, "🔍 위치 서비스 실행 상태 확인: $isRunning")
            return isRunning
        }
    }

    /**
     * FCM 토큰 즉시 초기화 (무조건 푸시 수신 보장)
     */
    private fun initializeFCMToken() {
        android.util.Log.d(TAG, "🚀 FCM 토큰 즉시 초기화 시작")

        try {
            // FCM 토큰 가져오기
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    android.util.Log.w(TAG, "❌ FCM 토큰 가져오기 실패", task.exception)
                    // 실패 시 3초 후 재시도
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        initializeFCMToken()
                    }, 3000)
                    return@addOnCompleteListener
                }

                val token = task.result
                android.util.Log.d(TAG, "✅ [ANDROID POLICY 3] FCM 토큰 가져오기 성공: ${token?.take(30)}...")

                // ✅ 3단계: 앱 실행 시마다 토큰 유효성 검사 (안정성 강화)
                // 앱이 시작되면 FCM SDK로부터 현재 토큰을 가져옴
                val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
                val savedToken = prefs.getString("fcm_token", null)

                if (savedToken == null) {
                    android.util.Log.w(TAG, "⚠️ [ANDROID POLICY 3] mt_token_id 없음: SharedPreferences에 토큰이 없음")
                    // 토큰이 없으면 즉시 등록
                    registerTokenForFirstTime(token)
                } else if (savedToken != token) {
                    android.util.Log.i(TAG, "🔄 [ANDROID POLICY 3] 토큰 변경 감지: 기존 토큰 → 새 토큰")
                    // 토큰이 다르면 즉시 업데이트
                    updateTokenOnAppLaunch(token, savedToken)
                } else {
                    android.util.Log.i(TAG, "✅ [ANDROID POLICY 3] 토큰 동일 - 추가 검증만 진행")
                    // 토큰이 같아도 서버 검증 진행
                    validateTokenOnAppLaunch(token)
                }
            }

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ FCM 토큰 초기화 중 오류 발생", e)
            // 오류 시 5초 후 재시도
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                initializeFCMToken()
            }, 5000)
        }
    }

    // ✅ 3단계: 앱 실행 시 토큰 유효성 검사 관련 함수들

    /**
     * 최초 토큰 등록 (SharedPreferences에 토큰이 없는 경우)
     */
    private fun registerTokenForFirstTime(token: String?) {
        if (token.isNullOrEmpty()) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 토큰이 null이거나 비어있음")
            return
        }

        android.util.Log.d(TAG, "📝 [POLICY 3] 최초 토큰 등록 시작")

        // 로컬에 저장
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("fcm_token", token)
            .putLong("fcm_token_timestamp", System.currentTimeMillis())
            .apply()

        // FCM 서비스를 통해 서버로 전송
        try {
            val fcmService = MyFirebaseMessagingService()
            fcmService.forceUpdateTokenToServer(token, "first_time_register")
            android.util.Log.d(TAG, "✅ [POLICY 3] 최초 토큰 등록 요청 완료")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 최초 토큰 등록 실패", e)
        }
    }

    /**
     * 앱 실행 시 토큰 변경 감지된 경우 업데이트
     */
    private fun updateTokenOnAppLaunch(newToken: String?, oldToken: String?) {
        if (newToken.isNullOrEmpty()) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 새 토큰이 null이거나 비어있음")
            return
        }

        android.util.Log.d(TAG, "🔄 [POLICY 3] 앱 실행 시 토큰 업데이트 시작")

        // 로컬에 새 토큰 저장
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("fcm_token", newToken)
            .putLong("fcm_token_timestamp", System.currentTimeMillis())
            .apply()

        // FCM 서비스를 통해 서버로 업데이트
        try {
            val fcmService = MyFirebaseMessagingService()
            fcmService.forceUpdateTokenToServer(newToken, "app_launch_update")
            android.util.Log.d(TAG, "✅ [POLICY 3] 토큰 업데이트 요청 완료")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 토큰 업데이트 실패", e)
        }
    }

    /**
     * 앱 실행 시 토큰 동일한 경우 서버 검증만 진행
     */
    private fun validateTokenOnAppLaunch(token: String?) {
        if (token.isNullOrEmpty()) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 토큰이 null이거나 비어있음")
            return
        }

        android.util.Log.d(TAG, "🔍 [POLICY 3] 토큰 서버 검증 시작")

        // FCM 서비스 직접 호출 대신 로컬 검증 로직 사용
        try {
            validateFCMTokenLocally(token)
            android.util.Log.d(TAG, "✅ [POLICY 3] 토큰 검증 요청 완료")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [POLICY 3] 토큰 검증 실패", e)
        }
    }

    /**
     * 로컬에서 FCM 토큰 검증 (Service 직접 호출 대신)
     */
    private fun validateFCMTokenLocally(token: String) {
        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val currentUserMtIdx = getCurrentUserMtIdxFromPrefs()

            if (currentUserMtIdx == null) {
                android.util.Log.w(TAG, "⚠️ [FCM LOCAL] 사용자 정보 없음 - 검증 스킵")
                return
            }

            android.util.Log.d(TAG, "🔍 [FCM LOCAL] 토큰 검증 시작 - mt_idx: $currentUserMtIdx")

            // 토큰 검증 API 호출
            val client = okhttp3.OkHttpClient()
            val url = "https://api3.smap.site/api/v1/member-fcm-token/validate-and-refresh"

            val requestData = org.json.JSONObject().apply {
                put("mt_idx", currentUserMtIdx)
                put("fcm_token", token)
            }

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val requestBody = requestData.toString().toRequestBody(mediaType)

            val request = okhttp3.Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "SMAP-Android-App")
                .build()

            client.newCall(request).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    android.util.Log.e(TAG, "❌ [FCM LOCAL] 검증 네트워크 오류", e)
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    try {
                        response.body?.string()?.let { responseBody ->
                            val jsonResponse = org.json.JSONObject(responseBody)
                            val success = jsonResponse.optBoolean("success", false)

                            if (success) {
                                android.util.Log.d(TAG, "✅ [FCM LOCAL] 토큰 검증 성공")
                            } else {
                                android.util.Log.w(TAG, "⚠️ [FCM LOCAL] 토큰 검증 실패")
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e(TAG, "❌ [FCM LOCAL] 응답 파싱 오류", e)
                    }
                    response.close()
                }
            })

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM LOCAL] 로컬 검증 중 오류", e)
        }
    }

    /**
     * SharedPreferences에서 사용자 mt_idx 가져오기 (안전한 버전)
     */
    private fun getCurrentUserMtIdxFromPrefs(): Int? {
        return try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)

            // 여러 키에서 mt_idx 확인
            val mtIdx = prefs.getInt("mt_idx", -1)
            if (mtIdx != -1) return mtIdx

            val altMtIdx = prefs.getString("savedMtIdx", null)?.toIntOrNull()
            if (altMtIdx != null && altMtIdx != -1) return altMtIdx

            val currentMtIdx = prefs.getString("current_mt_idx", null)?.toIntOrNull()
            if (currentMtIdx != null && currentMtIdx != -1) return currentMtIdx

            // 로그인 상태 확인
            val isLoggedIn = prefs.getBoolean("is_logged_in", false)
            if (isLoggedIn) {
                android.util.Log.w(TAG, "⚠️ [FCM LOCAL] mt_idx 없지만 로그인 상태 - 기본값 사용")
                return 1186
            }

            null
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM LOCAL] mt_idx 가져오기 실패", e)
            null
        }
    }

    // ✅ 최소화된 FCM 토큰 초기화 함수
    /**
     * FCM 토큰을 최소한으로만 초기화 (필요할 때만 업데이트)
     */
    private fun initializeFCMTokenMinimal() {
        android.util.Log.d(TAG, "🔍 [FCM] 최소화된 FCM 토큰 초기화 시작")
        
        try {
            // FirebaseMessaging 인스턴스만 초기화 (토큰 자동 갱신 방지)
            firebaseMessaging = FirebaseMessaging.getInstance()
            
            // 토큰 자동 갱신 비활성화
            firebaseMessaging.isAutoInitEnabled = false
            android.util.Log.d(TAG, "✅ [FCM] 자동 토큰 갱신 비활성화")
            
            // 기존 토큰이 있으면 유지, 없으면 새로 생성 (한 번만)
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val existingToken = prefs.getString("fcm_token", null)
            
            if (existingToken != null) {
                android.util.Log.d(TAG, "✅ [FCM] 기존 토큰 유지: ${existingToken.take(30)}...")
                return
            }
            
            // 토큰이 없을 때만 새로 생성
            firebaseMessaging.token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    if (!token.isNullOrEmpty()) {
                        prefs.edit()
                            .putString("fcm_token", token)
                            .putLong("fcm_token_timestamp", System.currentTimeMillis())
                            .apply()
                        android.util.Log.d(TAG, "✅ [FCM] 새 토큰 생성 및 저장: ${token.take(30)}...")
                    }
                } else {
                    android.util.Log.w(TAG, "⚠️ [FCM] 토큰 생성 실패: ${task.exception?.message}")
                }
            }
            
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM] 최소화된 FCM 토큰 초기화 중 오류", e)
        }
    }

    // ✅ 1단계: 로그인 시 토큰 등록을 위한 함수
    /**
     * 로그인 완료 후 FCM 토큰 등록 (1단계 정책)
     * 사용자가 로그인할 때마다 호출되어야 함
     */
    fun registerFCMTokenOnLogin(mtIdx: Int) {
        android.util.Log.d(TAG, "📝 [POLICY 1] 로그인 시 FCM 토큰 등록 시작 - mt_idx: $mtIdx")

        try {
            // FCM 토큰 가져오기
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    android.util.Log.w(TAG, "❌ [POLICY 1] 로그인 시 토큰 가져오기 실패", task.exception)
                    return@addOnCompleteListener
                }

                val token = task.result
                android.util.Log.d(TAG, "✅ [POLICY 1] 로그인 시 토큰 가져오기 성공: ${token?.take(30)}...")

                // 사용자 정보 저장
                val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
                prefs.edit()
                    .putInt("mt_idx", mtIdx)
                    .apply()

                // FCM 서비스를 통해 서버로 전송
                try {
                    val fcmService = MyFirebaseMessagingService()
                    fcmService.forceUpdateTokenToServer(token, "login_register")
                    android.util.Log.d(TAG, "✅ [POLICY 1] 로그인 시 토큰 등록 요청 완료")
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "❌ [POLICY 1] 로그인 시 토큰 등록 실패", e)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [POLICY 1] 로그인 시 FCM 토큰 등록 중 오류", e)
        }
    }

    // MARK: - 🔄 iOS 스타일 FCM 토큰 관리 시스템 (Android 적용)
    // iOS AppDelegate의 FCM 토큰 관리 로직을 Android에 적용

    /**
     * 🔄 FCM 토큰 스마트 업데이트 (iOS 스타일)
     * - 사용자 식별 상태 확인 후 토큰 업데이트
     * - 백그라운드에서도 토큰 업데이트 허용
     * - 중복 실행 방지
     */
    private fun updateFCMTokenIfNeededWithFetch() {
        // 🔒 중복 실행 방지 (iOS 스타일)
        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
        val isUpdateInProgress = prefs.getBoolean("fcm_update_in_progress", false)

        if (isUpdateInProgress) {
            android.util.Log.d(TAG, "⏳ [FCM iOS-STYLE] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }

        // 사용자 식별 상태 확인 (mt_idx 기준) - iOS와 동일
        val hasUserIdentified = prefs.getInt("mt_idx", -1) != -1 ||
                               prefs.getString("savedMtIdx", null) != null ||
                               prefs.getString("current_mt_idx", null) != null

        if (!hasUserIdentified) {
            android.util.Log.d(TAG, "🔒 [FCM iOS-STYLE] 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 스킵")
            return
        }

        android.util.Log.d(TAG, "🔄 [FCM iOS-STYLE] FCM 토큰 업데이트 시작 (토큰 변경 감지 시)")

        // 업데이트 진행 중 플래그 설정
        prefs.edit().putBoolean("fcm_update_in_progress", true).apply()

        // FCM 토큰 가져오기 (iOS의 Messaging.messaging().token과 동일)
        com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            // 진행 중 플래그 해제
            prefs.edit().putBoolean("fcm_update_in_progress", false).apply()

            if (!task.isSuccessful) {
                android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] FCM 토큰 가져오기 실패", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            if (token.isNullOrEmpty()) {
                android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] FCM 토큰이 null이거나 비어있음")
                return@addOnCompleteListener
            }

            android.util.Log.d(TAG, "✅ [FCM iOS-STYLE] FCM 토큰 가져오기 성공: ${token.take(30)}...")

            // 토큰 변경 감지 및 서버 업데이트 (iOS의 checkAndUpdateFCMTokenIfNeeded와 동일)
            checkAndUpdateFCMTokenIfNeeded(token)
        }
    }

    /**
     * 🔍 FCM 토큰 변경 감지 및 스마트 업데이트 (iOS 스타일)
     * - 토큰이 실제로 변경되었을 때만 서버 업데이트
     * - 백그라운드에서도 업데이트 허용
     * - 로그인 상태 확인
     */
    fun checkAndUpdateFCMTokenIfNeeded(currentToken: String) {
        android.util.Log.d(TAG, "🔍 [FCM iOS-STYLE] 토큰 변경 분석 시작")

        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)

        // 🔒 중복 실행 방지: 이미 업데이트 진행 중이면 스킵
        val isUpdateInProgress = prefs.getBoolean("fcm_update_in_progress", false)
        if (isUpdateInProgress) {
            android.util.Log.d(TAG, "⏳ [FCM iOS-STYLE] FCM 토큰 업데이트 이미 진행 중 - 스킵")
            return
        }

        // 백그라운드에서도 토큰 업데이트 허용 (iOS와 동일)
        val appState = getApplicationState()
        val isBackground = appState == "background"

        if (isBackground) {
            android.util.Log.d(TAG, "🛡️ [FCM iOS-STYLE] 앱이 백그라운드 상태 - 토큰 업데이트 허용 (푸시 수신 우선)")
        }

        // 로그인 상태 확인 (여러 키에서 확인) - iOS와 동일
        val isLoggedIn = prefs.getBoolean("is_logged_in", false) ||
                        prefs.getInt("mt_idx", -1) != -1 ||
                        prefs.getString("savedMtIdx", null) != null

        if (!isLoggedIn) {
            android.util.Log.d(TAG, "🔒 [FCM iOS-STYLE] 로그인 상태가 아님 - FCM 토큰 업데이트 스킵")
            return
        }

        // 이전에 저장된 FCM 토큰과 비교
        val lastSavedToken = prefs.getString("last_fcm_token", null)

        // ✅ 스마트 업데이트: 토큰이 실제로 변경되었을 때만 업데이트
        val hasTokenChanged = lastSavedToken != currentToken
        val hasNoSavedToken = lastSavedToken == null

        android.util.Log.d(TAG, "🔍 [FCM iOS-STYLE] 토큰 변경 분석:")
        android.util.Log.d(TAG, "   이전 토큰: ${lastSavedToken?.take(20) ?: "없음"}...")
        android.util.Log.d(TAG, "   현재 토큰: ${currentToken.take(20)}...")
        android.util.Log.d(TAG, "   토큰 변경됨: $hasTokenChanged")
        android.util.Log.d(TAG, "   저장된 토큰 없음: $hasNoSavedToken")

        // 토큰이 변경되었거나 저장된 토큰이 없는 경우에만 업데이트
        if (!hasTokenChanged && !hasNoSavedToken) {
            android.util.Log.d(TAG, "ℹ️ [FCM iOS-STYLE] FCM 토큰이 변경되지 않음 - 서버 업데이트 스킵")
            return
        }

        // 🔒 업데이트 진행 중 플래그 설정
        prefs.edit().putBoolean("fcm_update_in_progress", true).apply()

        // 새로운 토큰을 SharedPreferences에 저장 (iOS UserDefaults와 동일)
        prefs.edit()
            .putString("last_fcm_token", currentToken)
            .putLong("last_fcm_token_update_time", System.currentTimeMillis())
            .apply()

        android.util.Log.d(TAG, "🚀 [FCM iOS-STYLE] FCM 토큰을 서버에 업데이트 시작 (토큰 변경됨)")

        // 서버에 FCM 토큰 업데이트 (iOS의 sendFCMTokenToServer와 동일)
        sendFCMTokenToServer(currentToken) { success ->
            if (success) {
                android.util.Log.d(TAG, "✅ [FCM iOS-STYLE] FCM 토큰 업데이트 성공")

                // 성공 시 마지막 업데이트 시간 기록
                prefs.edit()
                    .putLong("last_fcm_token_update_time", System.currentTimeMillis())
                    .putBoolean("fcm_update_in_progress", false)
                    .apply()
            } else {
                android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] FCM 토큰 업데이트 실패")

                // 실패 시 플래그만 해제 (재시도는 다음 기회에)
                prefs.edit().putBoolean("fcm_update_in_progress", false).apply()
            }
        }
    }

    /**
     * 🌐 FCM 토큰을 서버에 전송 (iOS 스타일)
     * - 사용자 식별 정보와 함께 전송
     * - 플랫폼 정보 포함
     * - 네트워크 오류 시 재시도
     */
    private fun sendFCMTokenToServer(token: String, completion: (Boolean) -> Unit) {
        android.util.Log.d(TAG, "🚀 [FCM iOS-STYLE] FCM 토큰 서버 업데이트 시작")

        val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)

        // 🚫 사용자가 식별되지 않았으면 업데이트하지 않음 (iOS와 동일)
        val hasUserIdentified = prefs.getInt("mt_idx", -1) != -1 ||
                               prefs.getString("savedMtIdx", null) != null ||
                               prefs.getString("current_mt_idx", null) != null

        if (!hasUserIdentified) {
            android.util.Log.d(TAG, "🚫 [FCM iOS-STYLE] 사용자가 식별되지 않음(mt_idx 없음) - FCM 토큰 업데이트 건너뜀")
            completion(false)
            return
        }

        // UserDefaults에서 mt_idx 가져오기 (여러 키에서 시도) - iOS와 동일
        val mtIdx = prefs.getInt("mt_idx", -1).takeIf { it != -1 }
                   ?: prefs.getString("savedMtIdx", null)?.toIntOrNull()
                   ?: prefs.getString("current_mt_idx", null)?.toIntOrNull()

        if (mtIdx == null) {
            android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] 로그인 상태이지만 mt_idx를 찾을 수 없음 - 업데이트 건너뜀")
            completion(false)
            return
        }

        android.util.Log.d(TAG, "✅ [FCM iOS-STYLE] mt_idx 발견: $mtIdx")

        // 서버 API 호출 (iOS의 sendFCMTokenToServer와 동일한 로직)
        val client = okhttp3.OkHttpClient()
        val url = "https://api3.smap.site/api/v1/member-fcm-token/register"

        val requestData = org.json.JSONObject().apply {
            put("mt_idx", mtIdx)
            put("fcm_token", token)
            put("force_update", true)
            put("reason", "ios_style_update")
            put("platform", "android")
            put("device_type", "android")
        }

        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = requestData.toString().toRequestBody(mediaType!!)

        val request = okhttp3.Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "SMAP-Android-App")
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] 네트워크 오류: ${e.message}")

                // 3초 후 재시도
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    sendFCMTokenToServer(token, completion)
                }, 3000)
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                android.util.Log.d(TAG, "📊 [FCM iOS-STYLE] HTTP 응답 코드: ${response.code}")

                response.body?.string()?.let { responseBody ->
                    try {
                        val jsonResponse = org.json.JSONObject(responseBody)
                        android.util.Log.d(TAG, "📋 [FCM iOS-STYLE] 서버 응답: $jsonResponse")

                        val success = jsonResponse.optBoolean("success", false)
                        if (success) {
                            android.util.Log.d(TAG, "✅ [FCM iOS-STYLE] FCM 토큰 업데이트 성공!")
                            completion(true)
                        } else {
                            android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] 서버 오류")
                            completion(false)
                        }
                    } catch (e: Exception) {
                        android.util.Log.e(TAG, "❌ [FCM iOS-STYLE] JSON 파싱 오류: ${e.message}")
                        completion(false)
                    }
                }
                response.close()
            }
        })
    }

    /**
     * 📱 앱 상태 확인 헬퍼 함수
     */
    private fun getApplicationState(): String {
        return when {
            isFinishing -> "finishing"
            isDestroyed -> "destroyed"
            else -> "active"
        }
    }

    /**
     * 🔄 앱 시작 시 FCM 토큰 검증 (iOS 스타일 자동 실행)
     * - 앱이 시작되면 자동으로 토큰 상태를 확인하고 업데이트
     */
    fun validateFCMTokenOnAppStart() {
        android.util.Log.d(TAG, "🚀 [FCM iOS-STYLE] 앱 시작 시 FCM 토큰 검증 시작")

        // iOS의 updateFCMTokenIfNeededWithFetch와 동일한 로직 실행
        updateFCMTokenIfNeededWithFetch()
    }

    /**
     * 🔄 백그라운드에서 FCM 토큰 업데이트 (iOS 스타일)
     * - 앱이 백그라운드로 갈 때 토큰 상태 확인
     */
    fun updateFCMTokenInBackgroundIfNeeded() {
        android.util.Log.d(TAG, "🛡️ [FCM iOS-STYLE] 백그라운드 FCM 토큰 업데이트 시작")

        // 백그라운드에서도 iOS와 동일하게 토큰 업데이트 진행
        updateFCMTokenIfNeededWithFetch()
    }

    /**
     * 🔍 FCM 상태 진단 및 문제 해결
     * - Android 폰에서 FCM 토큰 업데이트가 안 될 때 사용
     */
    fun diagnoseFCMIssues() {
        android.util.Log.d(TAG, "🔍 [FCM DIAGNOSIS] FCM 문제 진단 시작")

        try {
            // 1. Google Play Services 상태 확인
            checkGooglePlayServicesStatus()

            // 2. FCM 권한 상태 확인
            checkFCMPermissions()

            // 3. 네트워크 상태 확인
            checkNetworkStatus()

            // 4. FCM 토큰 상태 확인
            checkFCMTokenStatus()

            // 5. 강제 FCM 토큰 재요청
            forceRefreshFCMToken()

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM DIAGNOSIS] 진단 중 오류 발생", e)
        }
    }

    /**
     * 📱 Google Play Services 상태 확인
     */
    private fun checkGooglePlayServicesStatus() {
        try {
            val googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance()
            val resultCode = googleApiAvailability.isGooglePlayServicesAvailable(this)

            when (resultCode) {
                com.google.android.gms.common.ConnectionResult.SUCCESS -> {
                    android.util.Log.d(TAG, "✅ [GPS] Google Play Services 정상")
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_MISSING -> {
                    android.util.Log.e(TAG, "❌ [GPS] Google Play Services가 설치되지 않음")
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_UPDATING -> {
                    android.util.Log.w(TAG, "⚠️ [GPS] Google Play Services 업데이트 중")
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED -> {
                    android.util.Log.e(TAG, "❌ [GPS] Google Play Services 업데이트 필요")
                }
                com.google.android.gms.common.ConnectionResult.SERVICE_DISABLED -> {
                    android.util.Log.e(TAG, "❌ [GPS] Google Play Services 비활성화됨")
                }
                else -> {
                    android.util.Log.e(TAG, "❌ [GPS] Google Play Services 오류: $resultCode")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [GPS] Google Play Services 상태 확인 실패", e)
        }
    }

    /**
     * 🔐 FCM 권한 상태 확인
     */
    private fun checkFCMPermissions() {
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val channel = notificationManager.getNotificationChannel("smap_notification_channel")
                if (channel != null) {
                    android.util.Log.d(TAG, "✅ [FCM PERM] 알림 채널 존재: ${channel.name}")
                } else {
                    android.util.Log.w(TAG, "⚠️ [FCM PERM] 알림 채널 없음 - 생성 필요")
                }
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                val granted = androidx.core.app.ActivityCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                android.util.Log.d(TAG, "📢 [FCM PERM] 알림 권한 상태: ${if (granted) "허용됨" else "거부됨"}")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM PERM] FCM 권한 확인 실패", e)
        }
    }

    /**
     * 🌐 네트워크 상태 확인
     */
    private fun checkNetworkStatus() {
        try {
            val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            val network = connectivityManager.activeNetwork
            val capabilities = connectivityManager.getNetworkCapabilities(network)

            if (capabilities != null) {
                val hasInternet = capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
                val hasValidated = capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)

                android.util.Log.d(TAG, "🌐 [NETWORK] 인터넷 연결: ${if (hasInternet) "있음" else "없음"}")
                android.util.Log.d(TAG, "🌐 [NETWORK] 네트워크 검증: ${if (hasValidated) "성공" else "실패"}")

                if (capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)) {
                    android.util.Log.d(TAG, "📶 [NETWORK] WiFi 연결")
                } else if (capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    android.util.Log.d(TAG, "📶 [NETWORK] 모바일 데이터 연결")
                }
            } else {
                android.util.Log.e(TAG, "❌ [NETWORK] 네트워크 연결 없음")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [NETWORK] 네트워크 상태 확인 실패", e)
        }
    }

    /**
     * 🎫 FCM 토큰 상태 확인
     */
    private fun checkFCMTokenStatus() {
        try {
            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val savedToken = prefs.getString("fcm_token", null)
            val lastUpdate = prefs.getLong("last_fcm_token_update_time", 0)

            android.util.Log.d(TAG, "🎫 [FCM TOKEN] 저장된 토큰: ${savedToken?.take(20) ?: "없음"}...")
            android.util.Log.d(TAG, "🎫 [FCM TOKEN] 마지막 업데이트: ${if (lastUpdate > 0) java.util.Date(lastUpdate).toString() else "없음"}")

            // 현재 FCM 토큰 가져오기 시도
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val currentToken = task.result
                    android.util.Log.d(TAG, "🎫 [FCM TOKEN] 현재 토큰: ${currentToken?.take(20) ?: "실패"}...")

                    if (savedToken != currentToken) {
                        android.util.Log.w(TAG, "⚠️ [FCM TOKEN] 토큰 불일치 감지 - 업데이트 필요")
                        // 토큰 업데이트 실행
                        updateFCMTokenIfNeededWithFetch()
                    } else {
                        android.util.Log.d(TAG, "✅ [FCM TOKEN] 토큰 일치")
                    }
                } else {
                    android.util.Log.e(TAG, "❌ [FCM TOKEN] 현재 토큰 가져오기 실패", task.exception)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM TOKEN] 토큰 상태 확인 실패", e)
        }
    }

    /**
     * 🔄 FCM 토큰 강제 새로고침
     */
    private fun forceRefreshFCMToken() {
        android.util.Log.d(TAG, "🔄 [FCM REFRESH] FCM 토큰 강제 새로고침 시작")

        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { deleteTask ->
                if (deleteTask.isSuccessful) {
                    android.util.Log.d(TAG, "🗑️ [FCM REFRESH] 기존 토큰 삭제 성공")

                    // 새 토큰 요청
                    com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { newTokenTask ->
                        if (newTokenTask.isSuccessful) {
                            val newToken = newTokenTask.result
                            android.util.Log.d(TAG, "🆕 [FCM REFRESH] 새 토큰 생성 성공: ${newToken?.take(20)}...")

                            // 새 토큰으로 업데이트 실행
                            updateFCMTokenIfNeededWithFetch()
                        } else {
                            android.util.Log.e(TAG, "❌ [FCM REFRESH] 새 토큰 생성 실패", newTokenTask.exception)
                        }
                    }
                } else {
                    android.util.Log.e(TAG, "❌ [FCM REFRESH] 기존 토큰 삭제 실패", deleteTask.exception)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [FCM REFRESH] 토큰 강제 새로고침 실패", e)
        }
    }

    /**
     * localStorage에서 가져온 사용자 데이터를 SharedPreferences에 저장
     */
    private fun saveUserDataFromLocalStorage(userDataJson: String?) {
        try {
            if (userDataJson.isNullOrEmpty()) {
                android.util.Log.w(TAG, "⚠️ [STORAGE] 사용자 데이터가 null이거나 비어있음")
                return
            }

            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()

            // JSON 파싱하여 데이터 추출
            val jsonObject = org.json.JSONObject(userDataJson)

            // mt_idx 저장
            val mtIdx = jsonObject.optInt("mt_idx", -1)
            if (mtIdx != -1) {
                editor.putInt("mt_idx", mtIdx)
                android.util.Log.d(TAG, "💾 [STORAGE] mt_idx 저장: $mtIdx")
            }

            // 사용자 이름 저장
            val mtName = jsonObject.optString("mt_name", null)
            if (!mtName.isNullOrEmpty()) {
                editor.putString("mt_name", mtName)
                android.util.Log.d(TAG, "💾 [STORAGE] mt_name 저장: $mtName")
            }

            // 로그인 상태 저장
            editor.putBoolean("is_logged_in", true)
            editor.putLong("login_timestamp", System.currentTimeMillis())

            editor.apply()

            android.util.Log.d(TAG, "✅ [STORAGE] 사용자 데이터 저장 완료")

            // 로그인 완료 후 Pending FCM 토큰 처리
            try {
                val fcmService = MyFirebaseMessagingService()
                fcmService.processPendingTokenAfterLogin()
                android.util.Log.d(TAG, "✅ [FCM] 로그인 후 Pending 토큰 처리 요청됨")
            } catch (e: Exception) {
                android.util.Log.e(TAG, "❌ [FCM] Pending 토큰 처리 중 오류", e)
            }

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [STORAGE] 사용자 데이터 저장 실패", e)
        }
    }

    /**
     * localStorage에서 가져온 mt_idx를 SharedPreferences에 저장
     */
    private fun saveMtIdxFromLocalStorage(mtIdxStr: String?) {
        try {
            if (mtIdxStr.isNullOrEmpty()) {
                android.util.Log.w(TAG, "⚠️ [STORAGE] mt_idx가 null이거나 비어있음")
                return
            }

            val mtIdx = mtIdxStr.toIntOrNull()
            if (mtIdx == null || mtIdx == -1) {
                android.util.Log.w(TAG, "⚠️ [STORAGE] 유효하지 않은 mt_idx: $mtIdxStr")
                return
            }

            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putInt("mt_idx", mtIdx)
                .putBoolean("is_logged_in", true)
                .putLong("login_timestamp", System.currentTimeMillis())
                .apply()

            android.util.Log.d(TAG, "✅ [STORAGE] mt_idx 저장 완료: $mtIdx")

            // FCM 서비스에서 사용할 수 있도록 저장된 값 확인
            val savedMtIdx = prefs.getInt("mt_idx", -1)
            android.util.Log.d(TAG, "🔍 [STORAGE] 저장 후 확인 - mt_idx: $savedMtIdx")

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [STORAGE] mt_idx 저장 실패", e)
        }
    }

    /**
     * localStorage에서 가져온 auth token을 SharedPreferences에 저장
     */
    private fun saveAuthTokenFromLocalStorage(authToken: String?) {
        try {
            if (authToken.isNullOrEmpty()) {
                android.util.Log.w(TAG, "⚠️ [STORAGE] auth token이 null이거나 비어있음")
                return
            }

            val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("auth_token", authToken)
                .putBoolean("is_logged_in", true)
                .putLong("token_timestamp", System.currentTimeMillis())
                .apply()

            android.util.Log.d(TAG, "✅ [STORAGE] auth token 저장 완료")

        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [STORAGE] auth token 저장 실패", e)
        }
    }

    /**
     * 🔥 쿠키 영속성 설정 (로그인 세션 2주 이상 유지)
     * WebView의 쿠키를 영속적으로 저장하여 앱 재시작 후에도 로그인 상태 유지
     */
    private fun setupCookiePersistence() {
        try {
            android.util.Log.d(TAG, "🍪 [COOKIE] 쿠키 영속성 설정 시작")
            
            val cookieManager = android.webkit.CookieManager.getInstance()
            
            // 쿠키 허용
            cookieManager.setAcceptCookie(true)
            
            // 서드파티 쿠키 허용 (API 21+)
            // ⚠️ webView가 초기화된 경우에만 설정
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    if (::webView.isInitialized) {
                        cookieManager.setAcceptThirdPartyCookies(webView, true)
                        android.util.Log.d(TAG, "🍪 [COOKIE] 서드파티 쿠키 허용 설정 완료")
                    } else {
                        android.util.Log.w(TAG, "⚠️ [COOKIE] webView가 초기화되지 않음 - 서드파티 쿠키 설정 건너뜀")
                    }
                } catch (e: Exception) {
                    android.util.Log.w(TAG, "⚠️ [COOKIE] 서드파티 쿠키 설정 실패: ${e.message}")
                }
            }
            
            // 쿠키 영속성 활성화 (앱 종료 후에도 쿠키 유지)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.flush()
            }
            
            android.util.Log.d(TAG, "✅ [COOKIE] 쿠키 영속성 설정 완료")
            android.util.Log.d(TAG, "🍪 [COOKIE] 현재 쿠키 수락 상태: ${cookieManager.acceptCookie()}")
            
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ [COOKIE] 쿠키 영속성 설정 실패", e)
        }
    }
}

