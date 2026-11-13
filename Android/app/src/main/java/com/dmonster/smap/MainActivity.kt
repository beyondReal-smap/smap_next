package com.dmonster.smap

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.JoinGroupRequest
import com.dmonster.smap.data.model.parseInviteLink
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import kotlinx.coroutines.launch
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.ui.components.BackgroundLocationGuideDialog
import com.dmonster.smap.ui.components.LocationDeniedOverlay
import com.dmonster.smap.ui.login.LoginActivity
import com.dmonster.smap.ui.navigation.MainTabScreen
import com.dmonster.smap.ui.theme.SmapTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    @Inject lateinit var authService: AuthService
    @Inject lateinit var smapApi: SmapApi
    private val inviteMessage = mutableStateOf<String?>(null)
    private val inviteFailed = mutableStateOf(false)
    private var joiningInvite = false
    private var navigatingToLogin = false
    private val authListener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if ((key == "auth_token" || key == null) && authService.getToken().isNullOrBlank()) {
            runOnUiThread { stopLocationService(); navigateToLogin() }
        }
    }

    // Mutable state for overlay so onResume can clear it
    private var showLocationDeniedOverlay = mutableStateOf(false)
    private var showBackgroundGuide = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        val isLoggedIn = authService.isLoggedIn

        if (BuildConfig.DEBUG) {
            Log.d(TAG, "[AUTH_GUARD] Check: $isLoggedIn")
        }

        if (!isLoggedIn) {
            Log.e(TAG, "[AUTH_GUARD] Not logged in - Redirecting to LoginActivity")
            navigateToLogin()
            return
        }

        // 딥링크 처리
        getSharedPreferences("smap_auth_prefs", MODE_PRIVATE).registerOnSharedPreferenceChangeListener(authListener)
        processPendingInvite()

        // 🔥 [FCM] 로그인 상태로 앱에 진입할 때마다 최신 FCM 토큰을 서버에 멱등 재등록한다.
        // 기존 구조는 onNewToken(토큰 회전 시에만 발화, 수개월 주기)에만 의존하여
        // 이미 로그인된 사용자의 죽은 토큰(UnregisteredError)을 갱신하지 못했고,
        // 그 결과 푸시 전송이 전체적으로 중단됐다(서버 토큰 보유율 15.6%).
        // 앱 진입마다 getToken→/member-fcm-token/register 를 호출해 등록 파이프라인을 복구한다.
        ensureFcmTokenRegistered()

        setContent {
            SmapTheme {
                inviteMessage.value?.let { message ->
                    androidx.compose.material3.AlertDialog(
                        onDismissRequest = { inviteMessage.value = null },
                        title = { androidx.compose.material3.Text("그룹 초대") },
                        text = { androidx.compose.material3.Text(message) },
                        confirmButton = { androidx.compose.material3.TextButton(onClick = {
                            inviteMessage.value = null
                            if (inviteFailed.value || getSharedPreferences("smap_prefs", MODE_PRIVATE).contains("pending_group_id")) processPendingInvite()
                        }) { androidx.compose.material3.Text(if (inviteFailed.value) "다시 시도" else "확인") } },
                        dismissButton = if (inviteFailed.value) ({ androidx.compose.material3.TextButton(onClick = { inviteMessage.value = null }) { androidx.compose.material3.Text("닫기") } }) else null
                    )
                }
                val locationDeniedOverlay by showLocationDeniedOverlay
                val backgroundGuide by showBackgroundGuide

                // Sequential permission launchers
                val backgroundLocationLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    if (isGranted) {
                        startLocationService()
                    }
                }

                // ACTIVITY_RECOGNITION은 ActivityRecognition Transition API에서 motion 기반 모드 전환에 사용된다.
                // 거부되어도 LocationService는 GPS 콜백 기반 fallback으로 동작하므로 치명적이지 않다.
                val activityRecognitionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    Log.d(TAG, "[PERM] ACTIVITY_RECOGNITION granted=$isGranted")
                    if (isGranted) {
                        // 권한 부여 직후 LocationService가 이미 떠 있다면, startIfEligible이
                        // onStartCommand를 재진입시켜 registerActivityTransitions()를 호출하게 한다.
                        // (서비스가 안 떠 있으면 hasRequiredPermissions 통과 후 새로 시작됨)
                        startLocationService()
                    }
                }

                val locationPermissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) { permissions ->
                    val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                                         permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
                    if (locationGranted) {
                        // Location granted ("앱을 사용할 때" 포함) -> 서비스 시작
                        startLocationService()
                        // ACTIVITY_RECOGNITION 런타임 권한 요청 (Android 10+에서 dangerous)
                        requestActivityRecognitionIfNeeded(activityRecognitionLauncher)
                        // "항상 허용"이 아니면 백그라운드 안내 (1회)
                        if (!hasBackgroundLocationPermission() && !hasShownBackgroundGuide()) {
                            showBackgroundGuide.value = true
                        }
                    } else {
                        // Location DENIED -> show persistent overlay
                        showLocationDeniedOverlay.value = true
                    }
                }

                // 알림 권한을 위치 권한 흐름과 독립적으로 요청하기 위한 런처
                // (위치 권한을 이미 보유한 사용자는 기존 흐름상 알림 권한을 영영 요청받지 못해
                //  토큰이 등록돼도 푸시가 표시되지 않는 2차 장애가 발생했다.)
                val notificationOnlyLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { granted ->
                    Log.d(TAG, "[PERM] POST_NOTIFICATIONS(독립 요청) granted=$granted")
                }

                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { _ ->
                    // After notification result (granted or not), request location
                    if (!hasLocationPermissions()) {
                        locationPermissionLauncher.launch(
                            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                        )
                    } else {
                        // Already has location — start service
                        startLocationService()
                        requestActivityRecognitionIfNeeded(activityRecognitionLauncher)
                        if (!hasBackgroundLocationPermission() && !hasShownBackgroundGuide()) {
                            showBackgroundGuide.value = true
                        }
                    }
                }

                // Permission check on launch
                LaunchedEffect(Unit) {
                    if (hasLocationPermissions()) {
                        // "앱을 사용할 때" 또는 "항상 허용" — 서비스 시작
                        startLocationService()
                        requestActivityRecognitionIfNeeded(activityRecognitionLauncher)
                        // Android 13+ 알림 권한을 위치 권한과 독립적으로 보장한다.
                        // 위치 권한을 이미 보유한 사용자는 기존 흐름(else 분기)을 타지 않아
                        // 알림 권한을 영영 요청받지 못했고, FCM 토큰이 등록돼도 푸시가 표시되지 않았다.
                        // (첫 실행·위치 미보유 경로는 아래 else의 순차 요청이 담당하므로 중복되지 않는다.)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                            ContextCompat.checkSelfPermission(
                                this@MainActivity, Manifest.permission.POST_NOTIFICATIONS
                            ) != PackageManager.PERMISSION_GRANTED
                        ) {
                            notificationOnlyLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        // "항상 허용"이 아니면 백그라운드 안내 (첫 1회만)
                        if (!hasBackgroundLocationPermission() && !hasShownBackgroundGuide()) {
                            showBackgroundGuide.value = true
                        }
                    } else {
                        // No location permission
                        if (isFirstLaunch()) {
                            // First launch -> sequential: notification first, then location
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            } else {
                                locationPermissionLauncher.launch(
                                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                                )
                            }
                            markFirstLaunchDone()
                        } else {
                            // Subsequent launch with denied location -> show overlay immediately
                            showLocationDeniedOverlay.value = true
                        }
                    }
                }

                Surface(modifier = Modifier.fillMaxSize()) {
                    // 1. Main content ALWAYS visible first
                    MainTabScreen(
                        onLogout = {
                            stopLocationService()
                            navigateToLogin()
                        }
                    )

                    // 2. Location denied overlay (persistent until user acts)
                    if (locationDeniedOverlay) {
                        LocationDeniedOverlay(
                            onGoToSettings = {
                                showLocationDeniedOverlay.value = false
                                // Open app settings
                                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.fromParts("package", packageName, null)
                                }
                                startActivity(intent)
                            },
                            onDismiss = {
                                showLocationDeniedOverlay.value = false
                            }
                        )
                    }

                    // 3. Background location guide
                    if (backgroundGuide) {
                        BackgroundLocationGuideDialog(
                            onConfirm = {
                                showBackgroundGuide.value = false
                                // Android 11+(API 30+)부터는 RequestPermission으로 ACCESS_BACKGROUND_LOCATION을
                                // 직접 요청해도 시스템 다이얼로그에 "항상 허용" 옵션이 없다(공식 문서).
                                // 사용자를 앱 설정으로 유도해 직접 "항상 허용"을 선택하게 한다.
                                // Android 10(API 29)에서는 다이얼로그가 정상 동작하므로 기존 launcher 사용.
                                when {
                                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                                        // Android 11+ → 설정 화면으로 유도
                                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                            data = Uri.fromParts("package", packageName, null)
                                        }
                                        startActivity(intent)
                                    }
                                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                                        // Android 10 → system dialog에 "항상 허용" 표시됨
                                        backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                                    }
                                    else -> {
                                        startLocationService()
                                    }
                                }
                            },
                            onDismiss = {
                                showBackgroundGuide.value = false
                                markBackgroundGuideDismissed()
                                // 백그라운드 권한 없이도 포그라운드 위치 서비스는 시작
                                startLocationService()
                            }
                        )
                    }
                }
            }
        }
    }

    // Re-check when returning from Settings
    override fun onResume() {
        super.onResume()
        if (hasLocationPermissions()) {
            showLocationDeniedOverlay.value = false
            if (hasBackgroundLocationPermission()) {
                showBackgroundGuide.value = false
            }
            // 앱 복귀 시 항상 재가동 시도.
            // LocationService가 401 누적으로 stopSelf 되었거나 OS에 의해 종료된 경우
            // 사용자가 재진입한 순간 세션이 유효하면 바로 복구된다.
            // startIfEligible이 로그인/권한/중복을 알아서 검사한다.
            startLocationService()
        }
    }

    private fun hasLocationPermissions(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }

    private fun hasBackgroundLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Android 10+(API 29+)에서 ACTIVITY_RECOGNITION은 dangerous permission이라 런타임 부여 필요.
     * 거부되어도 LocationService는 GPS 콜백 fallback으로 작동하므로 critical은 아니다.
     */
    private fun requestActivityRecognitionIfNeeded(
        launcher: androidx.activity.result.ActivityResultLauncher<String>
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasActivityRecognitionPermission()) {
            launcher.launch(Manifest.permission.ACTIVITY_RECOGNITION)
        }
    }

    private fun isFirstLaunch(): Boolean {
        val prefs = getSharedPreferences("smap_prefs", MODE_PRIVATE)
        return !prefs.getBoolean("permission_onboarding_done", false)
    }

    private fun markFirstLaunchDone() {
        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
            .putBoolean("permission_onboarding_done", true)
            .apply()
    }

    private fun hasShownBackgroundGuide(): Boolean {
        return getSharedPreferences("smap_prefs", MODE_PRIVATE)
            .getBoolean("background_guide_dismissed", false)
    }

    private fun markBackgroundGuideDismissed() {
        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
            .putBoolean("background_guide_dismissed", true)
            .apply()
    }

    private fun startLocationService() {
        if (!LocationService.isUserLoggedIn(this)) {
            Log.w(TAG, "[LOCATION] Skip start - user not logged in")
            return
        }
        if (!LocationService.hasRequiredPermissions(this)) {
            Log.w(TAG, "[LOCATION] Skip start - required location permissions missing")
            return
        }
        LocationService.startIfEligible(this, "main_activity")
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
        Log.d(TAG, "[LOCATION] LocationService stopped")
    }

    private fun navigateToLogin() {
        if (navigatingToLogin || isFinishing) return
        navigatingToLogin = true
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, android.R.anim.fade_in, android.R.anim.fade_out)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
        }
        finish()
    }

    /**
     * 로그인 상태에서 앱 진입 시 현재 FCM 토큰을 서버에 등록한다.
     * FirebaseMessaging.getToken()으로 최신 토큰을 받아 forceUpdateTokenToServer로 전송하며,
     * SharedPreferences(smap_auth_prefs)의 auth_token/mt_idx 가드를 통과해야 실제 전송된다.
     * 멱등 호출이며 서버측 중복방지 로직과 충돌하지 않는다.
     */
    private fun ensureFcmTokenRegistered() {
        runCatching {
            MyFirebaseMessagingService.triggerTokenUpdate(this)
        }.onFailure {
            Log.w(TAG, "[FCM] 토큰 등록 트리거 실패", it)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
        processPendingInvite()
    }

    override fun onDestroy() {
        getSharedPreferences("smap_auth_prefs", MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(authListener)
        super.onDestroy()
    }

    private fun processPendingInvite() {
        val prefs = getSharedPreferences("smap_prefs", MODE_PRIVATE)
        val value = prefs.getString("pending_group_id", null) ?: return
        val groupId = value.toIntOrNull() ?: return
        val code = prefs.getString("pending_group_code", null)
        val memberId = authService.getMtIdx()
        if (joiningInvite || memberId == 0 || !authService.isLoggedIn) return
        joiningInvite = true
        lifecycleScope.launch {
            try {
                smapApi.joinGroupFromInvite(groupId, JoinGroupRequest(memberId, groupId, code)).close()
                if (prefs.getString("pending_group_id", null) == value && prefs.getString("pending_group_code", null) == code)
                    prefs.edit().remove("pending_group_id").remove("pending_group_code").apply()
                GlobalEventBus.emit(GlobalEvent.GroupsChanged)
                inviteFailed.value = false
                inviteMessage.value = "그룹에 가입했습니다."
            } catch (e: Exception) {
                inviteFailed.value = true
                inviteMessage.value = if (e is retrofit2.HttpException && e.code() == 403) "초대 링크가 유효하지 않거나 만료됐어요" else "그룹 가입에 실패했습니다. 다시 시도해 주세요."
            } finally { joiningInvite = false }
        }
    }

    private fun handleDeepLink(intent: Intent?) {
        val invite = intent?.dataString?.let(::parseInviteLink) ?: return
        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
            .putString("pending_group_id", invite.groupId.toString())
            .putString("pending_group_code", invite.code)
            .apply()
    }
}
