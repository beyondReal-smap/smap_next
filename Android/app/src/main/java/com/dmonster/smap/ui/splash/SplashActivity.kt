package com.dmonster.smap.ui.splash

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.MainActivity
import javax.inject.Inject
import com.dmonster.smap.ui.login.LoginActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 스플래시 화면 (앱 시작점)
 * - 이미 로그인된 경우: MainActivity로 이동
 * - 로그인 필요한 경우: LoginActivity로 이동
 */
@AndroidEntryPoint
@SuppressLint("CustomSplashScreen")
class SplashActivity : ComponentActivity() {

    companion object {
        private const val SPLASH_DELAY = 800L  // 0.8초 (더 빠른 전환)
    }

    @Inject lateinit var authService: AuthService
    @Inject lateinit var smapApi: SmapApi

    private var keepSplashScreen = true
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 12+ 시스템 스플래시. 12 미만은 Theme.Smap.Splash의 windowBackground가 표시된다.
        // setContent로 별도 Compose 스플래시를 그리지 않는다 — 시스템 스플래시와 겹쳐 두 번
        // 보이는 현상을 방지하기 위함. 강제 업데이트 다이얼로그는 setContent 없이도 정상 표시된다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            installSplashScreen().setKeepOnScreenCondition { keepSplashScreen }
        }

        super.onCreate(savedInstanceState)

        // 스플래시 유지 + 강제 업데이트 체크 후 다음 화면으로 이동
        lifecycleScope.launch {
            delay(SPLASH_DELAY)
            val needsUpdate = checkForceUpdate()
            keepSplashScreen = false

            if (needsUpdate) {
                // 강제 업데이트 다이얼로그를 띄운 상태에서 멈춤. navigateNext 호출 안 함.
                return@launch
            }
            navigateNext()
        }
    }

    /**
     * /app/version-check 호출. 강제 업데이트가 필요하면 다이얼로그를 띄우고 true 반환.
     * 네트워크 실패는 정책상 막지 않고 false 반환(앱 실행 차단보다 통과 우선).
     */
    private suspend fun checkForceUpdate(): Boolean {
        val response = runCatching {
            smapApi.checkAppVersion(version = BuildConfig.VERSION_NAME)
        }.getOrNull() ?: return false

        if (!response.forceUpdate) return false

        showForceUpdateDialog(response.minSupportedVersion ?: "")
        return true
    }

    private fun showForceUpdateDialog(minVersion: String) {
        AlertDialog.Builder(this)
            .setCancelable(false)
            .setTitle("업데이트 필요")
            .setMessage("새 버전이 있어 업데이트 후 이용해 주세요.\n(현재 ${BuildConfig.VERSION_NAME} → 최소 ${minVersion})")
            .setPositiveButton("스토어로 이동") { _, _ ->
                openPlayStore()
                finish()
            }
            .setNegativeButton("종료") { _, _ -> finish() }
            .show()
    }

    private fun openPlayStore() {
        val pkg = packageName
        val intent = runCatching {
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
        }.getOrElse {
            Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(intent) }.onFailure {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
        }
    }

    private fun navigateNext() {
        val isLoggedIn = authService.isLoggedIn
        android.util.Log.d("SMAP_DEBUG", "🔍 SplashActivity: isLoggedIn = $isLoggedIn")
        
        val nextActivity = if (isLoggedIn) {
            android.util.Log.d("SMAP_DEBUG", "🚀 로그인 확인됨 -> MainActivity로 이동")
            MainActivity::class.java
        } else {
            android.util.Log.d("SMAP_DEBUG", "🚀 로그인 필요 -> LoginActivity로 이동")
            LoginActivity::class.java
        }
        
        val intent = Intent(this, nextActivity)
        startActivity(intent)

        // 화면 전환 애니메이션 비활성화
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, android.R.anim.fade_in, android.R.anim.fade_out)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }

        finish()
    }
}
