package com.dmonster.smap.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.dmonster.smap.R
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.MainActivity
import com.dmonster.smap.ui.login.LoginActivity
import com.dmonster.smap.ui.theme.SmapTheme
import dagger.hilt.android.AndroidEntryPoint

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
    
    private var keepSplashScreen = true
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 12+ 시스템 스플래시 처
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val splashScreen = installSplashScreen()
            splashScreen.setKeepOnScreenCondition { keepSplashScreen }
        }
        
        super.onCreate(savedInstanceState)
        
        setContent {
            SmapTheme {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF353538)), // iOS 스플래시와 동일한 배경색
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.app_no_bg),
                        contentDescription = null,
                        modifier = Modifier.size(80.dp)
                    )
                }
            }
        }
        
        // 스플래시 딜레이 후 다음 화면으로 이동
        Handler(Looper.getMainLooper()).postDelayed({
            keepSplashScreen = false
            navigateNext()
        }, SPLASH_DELAY)
    }
    
    private fun navigateNext() {
        val authService = AuthService.getInstance(this)
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
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
        
        finish()
    }
}
